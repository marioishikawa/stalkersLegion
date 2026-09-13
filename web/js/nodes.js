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
      // Sits on the floor, but never so high that its lamp pokes out of the sea.
      const floorY = SL.Biomes.floorHeightAt(position.x, position.z);
      this.object.position.y = Math.min(floorY + 0.1, SL.WATER_LEVEL - 1.1);
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

/**
 * Red vines.
 *
 * The Red Puff Leviathan does not chase anything. Cornered, it throws up a cage
 * of thorned vines around whatever cornered it - a barrier you are inside of,
 * rather than a monster you are running from. They are solid, they wither on
 * their own after a while, and a knife gets you out faster than waiting does.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;

  const LIFETIME = 26;
  const GROW_TIME = 0.9;

  class Vine {
    constructor(game, x, z, baseY, height, seed) {
      this.game = game;
      this.dead = false;
      this.age = 0;
      this.integrity = 45;
      this.height = height;
      this.radius = 0.45;

      this.base = baseY;
      this.object = new THREE.Mesh(Vine.geometryFor(height, seed), game.materials.glow);
      this.object.position.set(x, this.base, z);
      this.object.rotation.y = SL.random() * Math.PI * 2;
      this.object.scale.set(1, 0.02, 1);       // bursts up out of the floor
      game.addToWorld(this.object);
    }

    static geometryFor(height, seed) {
      const mesh = new MeshData();
      const rings = 10;
      const spine = [];
      const widths = [];
      const heights = [];
      const colors = [];

      const lean = SL.hash(seed, 1, 71) * Math.PI * 2;
      const curve = SL.lerp(0.2, 0.8, SL.hash(seed, 2, 71));

      const deep = new THREE.Color(0.42, 0.03, 0.06);
      const bright = new THREE.Color(0.95, 0.14, 0.20);

      for (let i = 0; i < rings; i++) {
        const t = i / (rings - 1);
        const sway = Math.sin(t * Math.PI * 0.8) * curve;
        spine.push(new THREE.Vector3(Math.cos(lean) * sway, t * height, Math.sin(lean) * sway));
        const r = SL.lerp(0.30, 0.10, t);
        widths.push(r);
        heights.push(r);
        colors.push(deep.clone().lerp(bright, t * 0.8));
      }

      Geo.loft(mesh, spine, widths, heights, colors, 6, 2, deep, 0);

      // Thorns, so it reads as something that would hurt to push through.
      const thorns = 9;
      for (let i = 0; i < thorns; i++) {
        const t = SL.lerp(0.15, 0.92, i / (thorns - 1));
        const ring = SL.clamp(Math.round(t * (rings - 1)), 0, rings - 1);
        const angle = lean + i * 2.1;
        const root = spine[ring];
        const dir = new THREE.Vector3(Math.cos(angle), 0.35, Math.sin(angle)).normalize();
        const len = 0.34;

        Geo.fin(mesh,
          root.clone().add(new THREE.Vector3(0, -0.08, 0)),
          root.clone().add(new THREE.Vector3(0, 0.08, 0)),
          root.clone().addScaledVector(dir, len),
          new THREE.Color(1.0, 0.42, 0.30));
      }

      mesh.computeNormals();
      return mesh.toGeometry();
    }

    get position() { return this.object.position; }

    /** Cut with the knife. */
    bite(damage) {
      this.integrity -= Math.max(0, damage);
      this.game.audio.crystal();
      if (this.integrity <= 0) { this.wither(); return true; }
      return false;
    }

    wither() {
      this.dead = true;
      if (this.object.parent) this.object.parent.remove(this.object);
      this.object.geometry.dispose();
      const i = this.game.vines.indexOf(this);
      if (i >= 0) this.game.vines.splice(i, 1);
    }

    update(dt) {
      this.age += dt;

      // Burst up, hold, then shrink away rather than blinking out.
      if (this.age < GROW_TIME) {
        this.object.scale.y = SL.clamp(this.age / GROW_TIME, 0.02, 1);
      } else if (this.age > LIFETIME - 1.5) {
        this.object.scale.y = Math.max(0.02, (LIFETIME - this.age) / 1.5);
      } else {
        this.object.scale.y = 1;
      }

      if (this.age > LIFETIME) this.wither();
    }

    /** Current standing height, which matters while it is still growing. */
    get standingHeight() { return this.height * this.object.scale.y; }
  }

  /**
   * Throws a ring of vines up around a point.
   *
   * The cage has to enclose whoever it is aimed at, and that cannot be done by
   * growing stalks off the sea floor - a diver hanging ten metres up would
   * simply watch a hedge sprout beneath them. Each vine is anchored to the
   * floor when the target is near it and extruded around the target's own depth
   * when it is not, which is the only reading under which a defence like this
   * works at all.
   *
   * Spacing is deliberate: the stalks sit closer together than the diver is
   * wide, so the ring genuinely holds, and exactly one gap is left so that
   * finding the way out is possible without cutting.
   */
  Vine.cage = function (game, center, radius, count) {
    const startAngle = SL.random() * Math.PI * 2;
    const gapAt = Math.floor(SL.random() * count);

    for (let i = 0; i < count; i++) {
      if (i === gapAt) continue;

      const angle = startAngle + (i / count) * Math.PI * 2;
      const r = radius * SL.randRange(0.92, 1.08);
      const x = center.x + Math.cos(angle) * r;
      const z = center.z + Math.sin(angle) * r;

      const floor = SL.Biomes.floorHeightAt(x, z);
      const ceiling = SL.WATER_LEVEL - 1;

      // The base always sits below the target, whatever the ground is doing.
      // On a seamount flank the floor on the uphill side of the ring can be
      // higher than the diver, and a stalk rooted there would sprout above
      // their head and let them swim out underneath it.
      const base = Math.min(floor, center.y - SL.randRange(3.5, 5));
      const wantsTop = Math.max(center.y + 3.5, base + 4);
      const height = Math.min(wantsTop, ceiling) - base;
      if (height < 1.5) continue;

      game.vines.push(new Vine(game, x, z, base, height, (SL.random() * 1e9) | 0));
    }
  };

  SL.Vine = Vine;
})(window.SL);
