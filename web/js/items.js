/**
 * Loose items you swim into to collect.
 *
 * Two resources drive the whole crafting economy, and each one comes from a
 * different half of the kelp forest loop:
 *
 *   Titanium      - cut a scrap pile apart with the knife until it breaks.
 *   Stalker teeth - stalkers shed them while chewing metal, and drop a handful
 *                   when killed. Baiting a stalker onto a plate and letting it
 *                   work is the efficient way to farm them.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;
  const _tmp = new THREE.Vector3();

  const TYPES = {
    titanium: {
      label: 'Titanium',
      build() {
        // A stubby ingot with bevelled ends.
        const mesh = new MeshData();
        const steel = new THREE.Color(0.62, 0.68, 0.74);
        const bright = new THREE.Color(0.80, 0.86, 0.92);
        Geo.box(mesh, 0, 0, 0, 0.09, 0.05, 0.14, steel);
        Geo.box(mesh, 0, 0.05, 0, 0.06, 0.012, 0.10, bright);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },
    quartz: {
      label: 'Quartz',
      build() {
        // A stubby pink prism.
        const mesh = new MeshData();
        const pink = new THREE.Color(0.95, 0.55, 0.78);
        const pale = new THREE.Color(1.0, 0.82, 0.92);
        Geo.cone(mesh, 0, -0.06, 0, 0.07, 0.20, 6, pink, pale);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },
    gold: {
      label: 'Gold',
      build() {
        const mesh = new MeshData();
        const gold = new THREE.Color(1.0, 0.76, 0.18);
        const deep = new THREE.Color(0.72, 0.48, 0.06);
        Geo.box(mesh, 0, 0, 0, 0.08, 0.045, 0.12, gold);
        Geo.box(mesh, 0, 0.045, 0, 0.05, 0.012, 0.085, deep);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },
    diamond: {
      label: 'Diamond',
      build() {
        // Two cones base to base - a cut stone.
        const mesh = new MeshData();
        const ice = new THREE.Color(0.82, 0.96, 1.0);
        const bright = new THREE.Color(1.0, 1.0, 1.0);
        Geo.cone(mesh, 0, 0, 0, 0.08, 0.14, 6, ice, bright);
        const lower = new MeshData();
        Geo.cone(lower, 0, 0, 0, 0.08, 0.09, 6, ice, bright);
        mesh.append(lower, new THREE.Matrix4().makeRotationX(Math.PI));
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },
    tooth: {
      label: 'Stalker Tooth',
      build() {
        // A curved ivory spike.
        const mesh = new MeshData();
        const ivory = new THREE.Color(0.92, 0.89, 0.78);
        const root = new THREE.Color(0.72, 0.66, 0.54);
        Geo.cone(mesh, 0, -0.08, 0, 0.045, 0.22, 7, root, ivory);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },

    // --- The carried kit ----------------------------------------------------
    //
    // These exist because a dead diver drops everything they were carrying.
    // They go back into the consumable stacks rather than the material
    // inventory, which is what `stacks` in Crafting decides when one is picked
    // up - see collect() below.
    medkit: {
      label: 'Medkit',
      stack: true,
      build() {
        const mesh = new MeshData();
        const white = new THREE.Color(0.94, 0.95, 0.92);
        const red = new THREE.Color(0.86, 0.20, 0.16);
        Geo.box(mesh, 0, 0, 0, 0.11, 0.07, 0.08, white);
        Geo.box(mesh, 0, 0.038, 0, 0.035, 0.012, 0.085, red);
        Geo.box(mesh, 0, 0.038, 0, 0.09, 0.012, 0.03, red);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },
    beacon: {
      label: 'Beacon',
      stack: true,
      build() {
        const mesh = new MeshData();
        const shell = new THREE.Color(0.30, 0.34, 0.38);
        const lamp = new THREE.Color(0.40, 0.91, 0.85);
        Geo.box(mesh, 0, -0.04, 0, 0.07, 0.09, 0.07, shell);
        Geo.cone(mesh, 0, 0.03, 0, 0.05, 0.10, 6, lamp, lamp);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },
    bait: {
      label: 'Bait Pod',
      stack: true,
      build() {
        const mesh = new MeshData();
        const husk = new THREE.Color(0.52, 0.42, 0.22);
        const flesh = new THREE.Color(0.86, 0.46, 0.34);
        Geo.sphere(mesh, 0, 0, 0, 0.075, 8, husk);
        Geo.box(mesh, 0, 0.05, 0, 0.05, 0.03, 0.05, flesh);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    },
    repel: {
      label: 'Repellent',
      stack: true,
      build() {
        const mesh = new MeshData();
        const glass = new THREE.Color(0.58, 0.80, 0.52);
        const cap = new THREE.Color(0.24, 0.30, 0.26);
        Geo.cone(mesh, 0, -0.05, 0, 0.055, 0.14, 7, glass, glass);
        Geo.box(mesh, 0, 0.055, 0, 0.035, 0.03, 0.035, cap);
        mesh.computeNormals();
        return mesh.toGeometry();
      }
    }
  };

  const geometryCache = {};

  class Pickup {
    constructor(game, type, position, velocity) {
      this.game = game;
      this.type = type;
      this.dead = false;
      this.life = 0;
      this.velocity = velocity ? velocity.clone() : new THREE.Vector3();
      this.spin = SL.randRange(0.6, 1.8);
      this.bobOffset = Math.random() * Math.PI * 2;

      if (!geometryCache[type]) {
        geometryCache[type] = TYPES[type].build();
        geometryCache[type].userData.shared = true;   // survives world teardown
      }
      this.object = new THREE.Mesh(geometryCache[type], game.materials.glow);
      this.object.position.copy(position);
      game.addToWorld(this.object);
    }

    get position() { return this.object.position; }

    update(dt) {
      this.life += dt;
      const p = this.position;

      // Settle to just above the floor, then hover and turn.
      const floor = SL.Biomes.floorHeightAt(p.x, p.z) + 0.4;
      if (p.y > floor) {
        this.velocity.y -= 2.2 * dt;
        this.velocity.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
        p.addScaledVector(this.velocity, dt);
        if (p.y < floor) { p.y = floor; this.velocity.set(0, 0, 0); }
      } else {
        p.y = floor + Math.sin(this.life * 1.6 + this.bobOffset) * 0.08;
      }

      this.object.rotation.y += this.spin * dt;

      // Drift toward the player when close, so collection is forgiving.
      const player = this.game.player;
      if (!player || player.dead) return;

      const distance = _tmp.subVectors(player.position, p).length();
      if (distance < 2.6) {
        p.addScaledVector(_tmp.normalize(), Math.min(4.5, 9 / Math.max(distance, 0.4)) * dt);
      }
      if (distance < 0.9) this.collect();
    }

    collect() {
      if (this.dead) return;

      // A carried item goes back into the kit; everything else is material.
      if (TYPES[this.type].stack) {
        SL.Crafting.stacks[this.type] = (SL.Crafting.stacks[this.type] || 0) + 1;
        if (this.game.hud) this.game.hud.refreshFabricator();
      } else {
        SL.Crafting.add(this.type, 1);
      }
      this.game.audio.pickUp();
      this.game.hud.toast('+1 ' + TYPES[this.type].label);
      this.destroy();
    }

    destroy() {
      this.dead = true;
      if (this.object.parent) this.object.parent.remove(this.object);
      const i = this.game.pickups.indexOf(this);
      if (i >= 0) this.game.pickups.splice(i, 1);
    }
  }

  /** Scatters `count` items outward from a point. */
  Pickup.burst = function (game, type, position, count) {
    for (let i = 0; i < count; i++) {
      const velocity = new THREE.Vector3(
        SL.randRange(-1.2, 1.2), SL.randRange(0.6, 1.8), SL.randRange(-1.2, 1.2));
      game.pickups.push(new Pickup(game, type, position, velocity));
    }
  };

  Pickup.TYPES = TYPES;
  SL.Pickup = Pickup;
})(window.SL);
