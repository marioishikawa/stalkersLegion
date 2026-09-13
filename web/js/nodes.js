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
