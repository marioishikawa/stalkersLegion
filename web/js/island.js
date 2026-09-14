/**
 * The islet, and the animal that lives on it.
 *
 * Everything else in this game swims. The Walkingcarni does not: it is stuck to
 * the ground, which on the islet means it is often out of the water entirely -
 * the only creature in the world that ever is. So it steers in two dimensions
 * and takes its height from the height field rather than integrating a velocity
 * against the sea floor the way Creature does.
 *
 * It is also not a threat. It is a small predator with a very slow appetite:
 * it takes a fish every few minutes out of the reef flat below the island and
 * otherwise mills about. It has no opinion about divers until one cuts it.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _look = new THREE.Vector3();

  const LABELS = {
    roam: 'walking the island',
    hunt: 'stalking a fish',
    feed: 'eating',
    angry: 'coming for you'
  };

  /** Seconds between meals. Deliberately long - it barely eats. */
  const MEAL_INTERVAL = [150, 260];

  /** How far down the flank it will go after a fish before giving up. */
  const WADE_DEPTH = 6;

  class Walkingcarni extends SL.Creature {
    constructor(game, x, z) {
      const y = SL.Biomes.floorHeightAt(x, z);
      super(game, SL.Species.walkingcarni, x, y, z);

      this.home = new THREE.Vector3(x, y, z);
      this.rangeRadius = 78;

      this.state = 'roam';
      this.stateTimer = 0;
      this.biteCooldown = 0;
      this.aggro = 0;
      this.threat = null;

      this.prey = null;
      this.hunger = SL.randRange(MEAL_INTERVAL[0] * 0.3, MEAL_INTERVAL[1]);
      this.meals = 0;

      this.heading = SL.random() * Math.PI * 2;
      this.target = new THREE.Vector3(x, y, z);
      this.stride = SL.random() * Math.PI * 2;

      this.pickTarget();
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.6 + 0.8; }

    /** How high its belly rides above whatever it is standing on. */
    get legHeight() { return this.bodyLength * 0.16; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    provoke(threat) {
      if (this.dead || !threat) return;
      this.threat = threat;
      this.aggro = 20;
      this.enterState('angry');
    }

    onHurt(damage, source) { this.provoke(source); }

    /** Somewhere else on the island to be. */
    pickTarget() {
      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(4, this.rangeRadius);
        const x = this.home.x + Math.cos(angle) * radius;
        const z = this.home.z + Math.sin(angle) * radius;

        // It will paddle about in the shallows but it will not swim off.
        if (-SL.Biomes.floorHeightAt(x, z) > WADE_DEPTH) continue;

        this.target.set(x, 0, z);
        return;
      }
      this.target.set(this.home.x, 0, this.home.z);
    }

    /** The nearest fish it could actually reach, or null. */
    findPrey() {
      const S = this.species;
      let best = null;
      let bestDist = S.senseRadius * S.senseRadius;

      for (const fish of this.game.fish) {
        if (fish.dead) continue;
        const d = fish.position.distanceToSquared(this.position);
        if (d >= bestDist) continue;
        // Nothing it cannot wade to.
        if (-SL.Biomes.floorHeightAt(fish.position.x, fish.position.z) > WADE_DEPTH) continue;
        bestDist = d;
        best = fish;
      }
      return best;
    }

    /**
     * Walking, not swimming. The whole body is placed on the ground each step,
     * so the base class's buoyancy, floor avoidance and surface clamp are all
     * skipped - they would hold it underwater, which is the one thing it must
     * not be.
     */
    update(dt) {
      if (this.dead) {
        this.deathTimer += dt;
        this.object.rotation.z += dt * 0.6;      // rolls onto its side
        if (this.deathTimer > 14) this.destroy();
        return;
      }

      this.stateTimer += dt;
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);
      this.aggro = Math.max(0, this.aggro - dt);
      this.hunger += dt;

      const step = this.steer(dt);

      // Move in the plane, then sit on whatever is under the new spot.
      const p = this.position;
      p.x += step.x * dt;
      p.z += step.z * dt;

      const ground = SL.Biomes.floorHeightAt(p.x, p.z);
      p.y = SL.damp(p.y, ground + this.legHeight, 9, dt);

      // Face the way it is going, and lean with the slope so it does not stand
      // bolt upright on the side of a hill.
      const speed = Math.hypot(step.x, step.z);
      if (speed > 0.05) {
        this.heading = SL.dampAngle(this.heading, Math.atan2(step.x, step.z), 6, dt);
      }

      const ahead = this.bodyLength * 0.5;
      const front = SL.Biomes.floorHeightAt(p.x + Math.sin(this.heading) * ahead,
        p.z + Math.cos(this.heading) * ahead);
      const back = SL.Biomes.floorHeightAt(p.x - Math.sin(this.heading) * ahead,
        p.z - Math.cos(this.heading) * ahead);
      const pitch = Math.atan2(front - back, ahead * 2);

      this.object.rotation.set(0, 0, 0);
      this.object.rotateY(this.heading);
      this.object.rotateX(-pitch);

      // A plodding gait: the body rocks rather than the tail wagging.
      this.stride += dt * (2.2 + speed * 1.4);
      this.object.position.y += Math.sin(this.stride * 2) * 0.03 * Math.min(speed, 2);
      this.object.rotateZ(Math.sin(this.stride) * 0.06 * Math.min(speed, 2));

      this.jawOpen = SL.damp(this.jawOpen,
        this.state === 'feed' ? 0.8 : (this.state === 'angry' ? 0.6 : 0.08), 4, dt);

      if (this.tailMesh) this.tailMesh.rotation.y = Math.sin(this.stride) * 0.22;
    }

    /** Returns the horizontal velocity it wants, as a Vector3 with y unused. */
    steer(dt) {
      const S = this.species;
      const player = this.game.player;

      switch (this.state) {
        case 'angry': {
          const threat = this.threat;
          if (!threat || threat.dead || this.aggro <= 0) {
            this.threat = null;
            this.enterState('roam');
            this.pickTarget();
            return _tmp.set(0, 0, 0);
          }

          const distance = threat.position.distanceTo(this.position);
          if (distance < this.biteReach && this.biteCooldown <= 0) {
            this.biteCooldown = S.biteInterval;
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
            threat.hurt(S.biteDamage, this);
          }

          // It cannot follow anyone into deep water, which is the whole defence
          // against it - back off the flat and it has to let you go.
          const towards = _look.subVectors(threat.position, this.position).setY(0);
          const next = _tmp.copy(this.position).addScaledVector(towards.normalize(), 2);
          if (-SL.Biomes.floorHeightAt(next.x, next.z) > WADE_DEPTH) {
            this.threat = null;
            this.enterState('roam');
            this.pickTarget();
            return _tmp.set(0, 0, 0);
          }

          return _tmp.copy(towards).multiplyScalar(S.sprintSpeed);
        }

        case 'hunt': {
          const prey = this.prey;
          if (!prey || prey.dead || this.stateTimer > 26) {
            this.prey = null;
            this.enterState('roam');
            this.pickTarget();
            return _tmp.set(0, 0, 0);
          }

          const distance = prey.position.distanceTo(this.position);
          if (distance < this.biteReach) {
            prey.hurt(999, this);
            this.prey = null;
            this.hunger = 0;
            this.meals++;
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
            if (this.game.distanceToPlayer(this.position) < 40) {
              this.game.hud.toast('The Walkingcarni takes a fish');
            }
            this.enterState('feed');
            return _tmp.set(0, 0, 0);
          }

          // Fish flee; it is not fast enough to run one down in open water, so
          // it only ever catches ones that stray onto the flat.
          return _look.subVectors(prey.position, this.position).setY(0)
            .normalize().multiplyScalar(S.sprintSpeed * 0.85);
        }

        case 'feed': {
          if (this.stateTimer > 6) { this.enterState('roam'); this.pickTarget(); }
          return _tmp.set(0, 0, 0);
        }

        case 'roam':
        default: {
          // Hungry, and something within reach: go and get it. Otherwise walk.
          if (this.hunger > SL.randRange(MEAL_INTERVAL[0], MEAL_INTERVAL[1]) * 0.5
            && this.stateTimer > 2) {
            const prey = this.findPrey();
            if (prey) { this.prey = prey; this.enterState('hunt'); return _tmp.set(0, 0, 0); }
            this.stateTimer = 0;
          }

          const dx = this.target.x - this.position.x;
          const dz = this.target.z - this.position.z;
          if (dx * dx + dz * dz < 4 || this.stateTimer > 30) {
            this.stateTimer = 0;
            this.pickTarget();
            // It stops a lot. Most of what it does is nothing.
            if (SL.random() < 0.45) return _tmp.set(0, 0, 0);
          }

          const wander = Math.hypot(dx, dz);
          if (wander < 0.01) return _tmp.set(0, 0, 0);
          return _tmp.set(dx / wander, 0, dz / wander).multiplyScalar(S.cruiseSpeed);
        }
      }
    }
  }

  SL.Walkingcarni = Walkingcarni;
})(window.SL);
