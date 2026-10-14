/**
 * The Starfishten: a starfish, and nothing more.
 *
 * It lies flat on the sand of the Safe Shallows and creeps. That is the whole
 * animal - a few metres a minute in one direction, a long rest, a few metres
 * in another. It cannot bite, it cannot run, and it does not try to; poked,
 * it draws its arms in and waits for whatever it was to go away.
 *
 * Like the crabs it walks rather than swims, so it shares their list and their
 * rules: height comes from the sea floor, steering is flat, and every point it
 * picks to creep to is checked against the biome first, so it never leaves
 * the shallows.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();

  const LABELS = {
    creep: 'creeping along',
    rest: 'lying still',
    curl: 'arms drawn in'
  };

  /** How far from where it was born it will ever wander. */
  const RANGE = 14;

  /** The floor as drawn, so it lies on the sand you can see, not in it. */
  function groundAt(x, z) {
    return SL.Terrain ? SL.Terrain.surfaceAt(x, z) : SL.Biomes.floorHeightAt(x, z);
  }

  class Starfish extends SL.Creature {
    constructor(game, x, z) {
      const y = groundAt(x, z);
      super(game, SL.Species.starfish, x, y, z);

      this.home = new THREE.Vector3(x, y, z);
      this.target = new THREE.Vector3(x, y, z);
      this.heading = SL.random() * Math.PI * 2;

      // Most of them are found resting. Staggered, so they do not all set off
      // at once.
      this.state = 'rest';
      this.stateTimer = 0;
      this.restFor = SL.randRange(4, 30);
      this.pulse = SL.random() * Math.PI * 2;
      this.curl = 0;
    }

    get stateLabel() { return LABELS[this.state] || ''; }

    enterState(state) {
      this.state = state;
      this.stateTimer = 0;
    }

    /** Anything that touches it gets the same answer: arms in, wait. */
    onHurt() { this.enterState('curl'); }
    provoke() { this.onHurt(); }

    /** Somewhere a little way off, and always on the sand of the shallows. */
    pickTarget() {
      const shallows = SL.Biomes.byId.shallows;
      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(1, RANGE);
        const x = this.home.x + Math.cos(angle) * radius;
        const z = this.home.z + Math.sin(angle) * radius;
        if (SL.Biomes.biomeAt(x, z) !== shallows) continue;
        this.target.set(x, 0, z);
        return;
      }
      this.target.set(this.home.x, 0, this.home.z);
    }

    update(dt) {
      const p = this.position;

      if (this.dead) {
        // Turns over, pale side up, and is gone.
        this.deathTimer += dt;
        this.object.rotation.x = SL.damp(this.object.rotation.x, Math.PI, 1.5, dt);
        if (this.deathTimer > 12) this.destroy();
        return;
      }

      this.stateTimer += dt;
      let speed = 0;

      if (this.state === 'curl') {
        if (this.stateTimer > 6) { this.enterState('rest'); this.restFor = SL.randRange(4, 10); }
      } else if (this.state === 'rest') {
        if (this.stateTimer > this.restFor) { this.pickTarget(); this.enterState('creep'); }
      } else {
        const dx = this.target.x - p.x;
        const dz = this.target.z - p.z;
        const gap = Math.hypot(dx, dz);

        if (gap < 0.2 || this.stateTimer > 90) {
          this.enterState('rest');
          this.restFor = SL.randRange(15, 45);
        } else {
          speed = this.species.cruiseSpeed;
          const step = Math.min(gap, speed * dt);
          const nx = p.x + (dx / gap) * step;
          const nz = p.z + (dz / gap) * step;

          // The sand ends somewhere. It stops there and thinks again.
          if (SL.Biomes.biomeAt(nx, nz) === SL.Biomes.byId.shallows) {
            p.x = nx;
            p.z = nz;
            // A starfish has no front; it turns as slowly as it does anything.
            this.heading = SL.dampAngle(this.heading, Math.atan2(dx, dz), 0.15, dt);
          } else {
            this.pickTarget();
          }
        }
      }

      // Flat on the floor, tilted to lie along the slope under it.
      const reach = this.bodyLength * 0.4;
      p.y = groundAt(p.x, p.z) + 0.01;
      const pitch = Math.atan2(groundAt(p.x, p.z + reach) - groundAt(p.x, p.z - reach), reach * 2);
      const roll = Math.atan2(groundAt(p.x + reach, p.z) - groundAt(p.x - reach, p.z), reach * 2);

      this.object.rotation.set(-pitch, 0, roll);
      this.object.rotateY(this.heading);

      // Arms drawn in when it is upset, and the faintest swell otherwise, so
      // it reads as alive rather than as a decal on the sand.
      this.curl = SL.damp(this.curl, this.state === 'curl' ? 1 : 0, 3, dt);
      this.pulse += dt * (speed > 0 ? 1.4 : 0.5);
      const spread = 1 - this.curl * 0.28 + Math.sin(this.pulse) * 0.02;
      this.object.scale.set(spread, 1 + this.curl * 0.4, spread);
    }
  }

  SL.Starfish = Starfish;
})(window.SL);
