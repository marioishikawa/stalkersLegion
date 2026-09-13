/**
 * Crystal formations.
 *
 * The Crystal Caverns are decorated with baked-in crystal scenery, but these are
 * the ones that matter: standing clusters you can cut apart with the knife for
 * quartz. They are the only resource in the game that does not come off a
 * creature or a stalker's leavings.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;

  class Crystal {
    constructor(game, x, z, seed) {
      this.game = game;
      this.dead = false;
      this.integrity = 70;
      this.shake = 0;

      this.object = new THREE.Mesh(Crystal.geometryFor(seed), game.materials.glow);
      this.object.position.set(x, SL.Biomes.floorHeightAt(x, z), z);
      this.object.rotation.y = SL.random() * Math.PI * 2;
      this.restRotation = this.object.rotation.clone();
      game.addToWorld(this.object);
    }

    static geometryFor(seed) {
      const mesh = new MeshData();
      const shards = 3 + Math.floor(SL.hash(seed, 1, 61) * 5);

      for (let i = 0; i < shards; i++) {
        const angle = SL.hash(seed, i, 61) * Math.PI * 2;
        const dist = SL.hash(seed, i + 10, 61) * 0.5;
        const height = SL.lerp(0.7, 2.4, SL.hash(seed, i + 20, 61));
        const radius = SL.lerp(0.10, 0.26, SL.hash(seed, i + 30, 61));

        // Pink through to a pale magenta tip.
        const base = new THREE.Color(0.62, 0.16, 0.42);
        const tip = new THREE.Color(1.0, 0.62, 0.86).lerp(
          new THREE.Color(0.86, 0.72, 1.0), SL.hash(seed, i + 40, 61));

        const shard = new MeshData();
        Geo.cone(shard, 0, 0, 0, radius, height, 6, base, tip);

        const lean = (SL.hash(seed, i + 50, 61) - 0.5) * 0.7;
        const matrix = new THREE.Matrix4().compose(
          new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, angle, lean * 0.6)),
          new THREE.Vector3(1, 1, 1));
        mesh.append(shard, matrix);
      }

      mesh.computeNormals();
      return mesh.toGeometry();
    }

    get position() { return this.object.position; }
    get isHeld() { return false; }

    /** Cut with the knife. Returns true once the cluster is broken up. */
    bite(damage) {
      this.integrity -= Math.max(0, damage);
      this.shake = 0.3;
      this.game.audio.crystal();

      if (this.integrity <= 0) {
        SL.Pickup.burst(this.game, 'quartz', this.position, SL.randInt(2, 4));
        // Crystal country hides the occasional better stone.
        if (SL.random() < 0.22) SL.Pickup.burst(this.game, 'diamond', this.position, 1);
        this.destroy();
        return true;
      }
      return false;
    }

    update(dt) {
      if (this.shake <= 0) return;
      this.shake -= dt;
      const amount = Math.max(0, this.shake) * 0.4;
      this.object.rotation.z = this.restRotation.z + Math.sin(this.game.time * 50) * amount;
      if (this.shake <= 0) this.object.rotation.copy(this.restRotation);
    }

    destroy() {
      this.dead = true;
      if (this.object.parent) this.object.parent.remove(this.object);
      this.object.geometry.dispose();
      const i = this.game.crystals.indexOf(this);
      if (i >= 0) this.game.crystals.splice(i, 1);
    }
  }

  SL.Crystal = Crystal;
})(window.SL);

/**
 * Marker beacons: the one thing the player can leave behind in the world.
 *
 * A beacon is a light in the dark and a pin on the chart. Dropping one at the
 * mouth of the trench, or beside a crystal field worth coming back to, is how a
 * 480 m map becomes navigable.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;

  /** Only this many beacons cast real light; the rest still glow and map. */
  const LIT_BEACONS = 5;

  let beaconGeometry = null;

  class Beacon {
    constructor(game, position) {
      this.game = game;
      this.dead = false;
      this.phase = SL.random() * Math.PI * 2;

      if (!beaconGeometry) {
        const mesh = new MeshData();
        const shell = new THREE.Color(0.16, 0.22, 0.24);
        const lamp = new THREE.Color(0.45, 1.0, 0.92);
        Geo.cone(mesh, 0, 0, 0, 0.22, 0.5, 6, shell, shell);
        Geo.sphere(mesh, 0, 0.62, 0, 0.20, 9, lamp);
        mesh.computeNormals();
        beaconGeometry = mesh.toGeometry();
        beaconGeometry.userData.shared = true;
      }

      this.object = new THREE.Mesh(beaconGeometry, game.materials.glow);
      this.object.position.copy(position);
      this.object.position.y = SL.Biomes.floorHeightAt(position.x, position.z) + 0.1;
      game.addToWorld(this.object);

      if (game.beacons.filter((b) => b.light).length < LIT_BEACONS) {
        this.light = new THREE.PointLight(0x8ffff0, 1.6, 26, 1.5);
        this.light.position.set(0, 0.62, 0);
        this.object.add(this.light);
      }
    }

    get position() { return this.object.position; }

    update(dt) {
      // A slow pulse, so a beacon reads as made rather than grown.
      this.phase += dt * 1.4;
      const pulse = 0.75 + 0.25 * Math.sin(this.phase);
      if (this.light) this.light.intensity = 1.6 * pulse;
      this.object.scale.setScalar(0.96 + 0.04 * pulse);
    }

    destroy() {
      this.dead = true;
      if (this.object.parent) this.object.parent.remove(this.object);
      const i = this.game.beacons.indexOf(this);
      if (i >= 0) this.game.beacons.splice(i, 1);
    }
  }

  SL.Beacon = Beacon;
})(window.SL);
