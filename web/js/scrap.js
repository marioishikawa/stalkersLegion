/**
 * Scrap metal - the object the whole kelp forest revolves around.
 *
 * Stalkers are drawn to it: they swim over, bite it, and often carry it off to
 * drop somewhere else. The player can pick it up and throw it, which makes
 * scrap a deliberate tool - toss a plate away from you and every stalker in
 * earshot goes after the noise instead of after you.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;

  class Scrap {
    constructor(game, x, z, seed) {
      this.game = game;
      this.seed = seed;
      this.carrier = null;      // the stalker or player holding it
      this.falling = false;
      this.velocity = new THREE.Vector3();
      this.disturbance = 0;     // decays over time; loud scrap attracts stalkers
      this.shake = 0;
      this.dead = false;

      const scale = SL.lerp(0.7, 1.6, SL.hash(seed, 2, 91));
      this.maxIntegrity = 60 + 40 * scale;
      this.integrity = this.maxIntegrity;

      this.object = new THREE.Mesh(Scrap.geometryFor(seed, scale), game.materials.surface);
      this.object.position.set(x, SL.Biomes.floorHeightAt(x, z) + 0.14, z);
      this.restRotation = new THREE.Euler(
        (SL.hash(seed, 5, 3) - 0.5) * 0.4,
        SL.hash(seed, 6, 9) * Math.PI * 2,
        (SL.hash(seed, 7, 11) - 0.5) * 0.4);
      this.object.rotation.copy(this.restRotation);
      game.addToWorld(this.object);
    }

    /** A welded cluster of plates and bars, cached by seed bucket. */
    static geometryFor(seed, scale) {
      const mesh = new MeshData();
      const pieces = 2 + Math.floor(SL.hash(seed, 1, 77) * 4);

      for (let i = 0; i < pieces; i++) {
        const r1 = SL.hash(seed, i * 3 + 10, 5);
        const r2 = SL.hash(seed, i * 3 + 11, 5);
        const r3 = SL.hash(seed, i * 3 + 12, 5);
        const r4 = SL.hash(seed, i * 3 + 13, 5);
        const r5 = SL.hash(seed, i * 3 + 14, 5);

        // Mostly flat plates, with the occasional chunky bar.
        const bar = r5 > 0.72;
        const ex = (bar ? SL.lerp(0.18, 0.42, r1) : SL.lerp(0.14, 0.34, r1)) * scale;
        const ey = (bar ? SL.lerp(0.04, 0.09, r3) : SL.lerp(0.015, 0.04, r3)) * scale;
        const ez = (bar ? SL.lerp(0.04, 0.08, r2) : SL.lerp(0.10, 0.26, r2)) * scale;

        // Rust: grey steel drifting toward orange as the piece corrodes.
        const color = new THREE.Color(0.42, 0.44, 0.47)
          .lerp(new THREE.Color(0.46, 0.22, 0.09), r4 * 0.85);

        const piece = new MeshData();
        Geo.box(piece, 0, 0, 0, ex, ey, ez, color);

        const m = new THREE.Matrix4().compose(
          new THREE.Vector3((r2 - 0.5) * 0.34 * scale, i * 0.05 * scale, (r3 - 0.5) * 0.34 * scale),
          new THREE.Quaternion().setFromEuler(new THREE.Euler((r1 - 0.5) * 0.9, r2 * 6.28, (r3 - 0.5) * 0.7)),
          new THREE.Vector3(1, 1, 1));
        mesh.append(piece, m);
      }

      mesh.computeNormals();
      return mesh.toGeometry();
    }

    get position() { return this.object.position; }
    get isHeld() { return this.carrier !== null; }

    /** How loud this piece is to stalkers right now. */
    get lure() { return SL.clamp(0.35 + this.disturbance, 0, 2); }

    /** A stalker bite or a knife strike. Returns true if the piece is destroyed. */
    bite(damage, fromDirection) {
      this.integrity -= Math.max(0, damage);
      this.disturbance = Math.min(this.disturbance + 0.8, 1.6);
      this.shake = 0.35;

      if (!this.isHeld && fromDirection) {
        this.object.position.addScaledVector(fromDirection, 0.06);
      }

      if (this.integrity <= 0) {
        // Whoever finished it off, the salvage is left in the water.
        SL.Pickup.burst(this.game, 'titanium', this.position, SL.randInt(2, 3));
        this.destroy();
        return true;
      }
      return false;
    }

    /** Attaches to a carrier; `holder` is an Object3D the scrap parents to. */
    carriedBy(carrier, holder, localOffset) {
      this.carrier = carrier;
      this.falling = false;
      this.velocity.set(0, 0, 0);
      this.disturbance = Math.max(this.disturbance, 0.6);

      holder.add(this.object);
      this.object.position.copy(localOffset);
      this.object.rotation.set(0, 0, 0);
    }

    /** Detaches and lets the piece sink back to the floor. */
    drop(tossVelocity) {
      if (this.object.parent && this.object.parent !== this.game.worldGroup) {
        // Preserve world position when re-parenting out of a carrier.
        const world = new THREE.Vector3();
        this.object.getWorldPosition(world);
        this.game.worldGroup.add(this.object);
        this.object.position.copy(world);
      }

      this.carrier = null;
      this.falling = true;
      this.velocity.copy(tossVelocity || new THREE.Vector3());
      this.disturbance = Math.min(this.disturbance + 1, 2);
    }

    settle() {
      const p = this.object.position;
      p.y = SL.Biomes.floorHeightAt(p.x, p.z) + 0.14;
      this.falling = false;
      this.velocity.set(0, 0, 0);
      this.object.rotation.copy(this.restRotation);
    }

    update(dt) {
      this.disturbance = Math.max(0, this.disturbance - dt * 0.35);

      if (this.falling) {
        // Water-damped fall: gravity, heavy drag, and a slow tumble.
        this.velocity.y -= 4.2 * dt;
        this.velocity.multiplyScalar(Math.max(0, 1 - 1.4 * dt));
        this.object.position.addScaledVector(this.velocity, dt);
        this.object.rotation.x += dt * 1.0;
        this.object.rotation.y += dt * 1.6;

        const p = this.object.position;
        if (p.y <= SL.Biomes.floorHeightAt(p.x, p.z) + 0.14) this.settle();
        return;
      }

      if (this.shake > 0 && !this.isHeld) {
        // Rattle in place while a stalker works on it.
        this.shake -= dt;
        const amount = Math.max(0, this.shake) * 0.5;
        const wobble = Math.sin(this.game.time * 45) * amount;
        this.object.rotation.set(
          this.restRotation.x + wobble * 0.4,
          this.restRotation.y + wobble,
          this.restRotation.z + wobble * 0.25);
        if (this.shake <= 0) this.object.rotation.copy(this.restRotation);
      }
    }

    destroy() {
      this.dead = true;
      if (this.object.parent) this.object.parent.remove(this.object);
      this.object.geometry.dispose();
      const i = this.game.scrap.indexOf(this);
      if (i >= 0) this.game.scrap.splice(i, 1);
    }
  }

  /**
   * The nearest unheld piece within radius. Close scrap wins, but a piece that
   * was just disturbed outranks distance.
   */
  Scrap.findNearest = function (game, position, radius) {
    let best = null, bestScore = -Infinity;
    const r2 = radius * radius;

    for (const s of game.scrap) {
      if (s.isHeld || s.dead) continue;
      const d2 = s.position.distanceToSquared(position);
      if (d2 > r2) continue;
      const score = -Math.sqrt(d2) + s.lure * 15;
      if (score > bestScore) { bestScore = score; best = s; }
    }
    return best;
  };

  SL.Scrap = Scrap;
})(window.SL);
