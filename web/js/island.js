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
  const _mouth = new THREE.Vector3();

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
    constructor(game, x, z, species) {
      const y = SL.Biomes.floorHeightAt(x, z);
      super(game, species || SL.Species.walkingcarni, x, y, z);

      this.home = new THREE.Vector3(x, y, z);
      this.rangeRadius = 103;

      this.state = 'roam';
      this.stateTimer = 0;
      this.biteCooldown = 0;
      this.aggro = 0;
      this.threat = null;

      this.prey = null;
      this.hunger = SL.randRange(MEAL_INTERVAL[0] * 0.3, MEAL_INTERVAL[1]);
      this.meals = 0;

      this.heading = SL.random() * Math.PI * 2;
      /** What to keep pointing at while standing still, if anything. */
      this.faceTarget = null;
      this.target = new THREE.Vector3(x, y, z);
      this.stride = SL.random() * Math.PI * 2;

      this.pickTarget();
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.6 + 0.8; }

    /** How deep the water it will wade into gets before it turns back. */
    get wadeDepth() { return WADE_DEPTH; }

    /** Where its jaw is. At six metres the pivot is nowhere near the target. */
    mouthPosition() {
      return _mouth.set(0, 0, this.bodyLength * 0.45)
        .applyQuaternion(this.object.quaternion).add(this.position);
    }

    /** How far in front of the pivot the jaw sits. */
    get mouthOffset() { return this.bodyLength * 0.45; }

    canBite(target) {
      const reach = Math.max(1.4, this.bodyLength * 0.45);
      return this.mouthPosition().distanceToSquared(target.position) < reach * reach;
    }

    /** Whether it is currently coming for the diver, for the proximity warning. */
    get hunting() { return !this.dead && this.state === 'angry'; }

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
        if (-SL.Biomes.floorHeightAt(x, z) > this.wadeDepth) continue;

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
        if (-SL.Biomes.floorHeightAt(fish.position.x, fish.position.z) > this.wadeDepth) continue;
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
      //
      // A stationary animal still has to be able to turn. Facing only followed
      // movement, so once it reached its standoff it froze pointing wherever it
      // had last walked - and a jaw pointing the wrong way never reaches
      // anything however close it is standing.
      const speed = Math.hypot(step.x, step.z);
      if (speed > 0.05) {
        this.heading = SL.dampAngle(this.heading, Math.atan2(step.x, step.z), 6, dt);
      } else if (this.faceTarget) {
        this.heading = SL.dampAngle(this.heading,
          Math.atan2(this.faceTarget.x - p.x, this.faceTarget.z - p.z), 5, dt);
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
            this.faceTarget = null;
            this.enterState('roam');
            this.pickTarget();
            return _tmp.set(0, 0, 0);
          }

          // Keep the jaw on them even when it has stopped closing.
          this.faceTarget = threat.position;

          if (this.biteCooldown <= 0 && this.canBite(threat)) {
            this.biteCooldown = S.biteInterval;
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
            threat.hurt(S.biteDamage, this);
          }

          // It cannot follow anyone into deep water, which is the whole defence
          // against it - back off the flat and it has to let you go.
          const towards = _look.subVectors(threat.position, this.position).setY(0);
          const gap = towards.length();
          towards.normalize();

          // Too deep ahead, or the diver is somewhere it cannot climb to -
          // either way it has to let them go.
          const next = _tmp.copy(this.position).addScaledVector(towards, 2);
          if (!this.canReach(threat)
            || -SL.Biomes.floorHeightAt(next.x, next.z) > this.wadeDepth) {
            this.threat = null;
            this.faceTarget = null;
            this.enterState('roam');
            this.pickTarget();
            return _tmp.set(0, 0, 0);
          }

          // Walk to where the JAW lands on them, not where the pivot does.
          //
          // Driving the pivot onto the target pushes the mouth clean past it -
          // on a six-metre animal the head ends up three metres the other side,
          // and the bite check never fires however long it stands there. So it
          // stops a body-length short and lets its head do the rest.
          if (gap < this.mouthOffset * 0.85) return _tmp.set(0, 0, 0);

          return _tmp.copy(towards).multiplyScalar(S.sprintSpeed);
        }

        case 'hunt': {
          const prey = this.prey;
          if (!prey || prey.dead || this.stateTimer > 26) {
            this.prey = null;
            this.faceTarget = null;
            this.enterState('roam');
            this.pickTarget();
            return _tmp.set(0, 0, 0);
          }

          this.faceTarget = prey.position;

          if (this.canBite(prey)) {
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
          // it only ever catches ones that stray onto the flat. Same standoff
          // as above, so the jaw arrives rather than the belly.
          _look.subVectors(prey.position, this.position).setY(0);
          if (_look.length() < this.mouthOffset * 0.85) return _tmp.set(0, 0, 0);
          return _tmp.copy(_look).normalize().multiplyScalar(S.sprintSpeed * 0.85);
        }

        case 'feed': {
          if (this.stateTimer > 6) { this.enterState('roam'); this.pickTarget(); }
          return _tmp.set(0, 0, 0);
        }

        case 'roam':
        default: {
          this.faceTarget = null;

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

  // ---------------------------------------------------------------------------
  // The Walkingcarni Leviathan
  // ---------------------------------------------------------------------------
  //
  // The same animal three and a half times over, with a third pair of legs and
  // none of the patience. Where the small one has no opinion about divers until
  // one cuts it, this one owns the island: set foot on the slope and it comes
  // down it at you.
  //
  // It still cannot swim. Everything it is - the walk, the lean on the slope,
  // the wading limit - is inherited; what changes is that it goes looking.

  class WalkingcarniLeviathan extends Walkingcarni {
    constructor(game, x, z) {
      super(game, x, z, SL.Species.carniLeviathan);

      // It patrols the whole island rather than a corner of it, and will go
      // a little further into the surf, because a diver in the shallows is the
      // point - but it is an island animal and it does not leave.
      this.rangeRadius = 159;
      this.guardTimer = 0;

      const islet = SL.Biomes.islet;
      this.islandCentre = islet
        ? new THREE.Vector3(islet.x, 0, islet.z)
        : new THREE.Vector3(x, 0, z);
      // The leash: the islet's own shoulder, which is where the island stops
      // being an island. Wading limit alone was not enough - chasing a diver
      // down a shallow flank walked it out to sea.
      this.leash = islet ? islet.shoulderRadius : 90;
    }

    get wadeDepth() { return 7; }

    /**
     * It bites, and that is all it does to you.
     *
     * Six and a half metres of animal walking into a diver used to shove them
     * across the beach - the bite knocked them back, and then the body itself
     * bulldozed them along in front of it, so a fight with it was mostly being
     * pushed about. The damage is the threat; the barging was never meant to
     * be part of it.
     */
    get knockback() { return 0; }
    get diverPush() { return 0; }

    /**
     * Its own island - and it has to be able to see across the beach.
     *
     * The summit is eighty metres from the nearest water on an island this
     * size, and a diver is always in the water, so a sense radius sized for
     * the small one meant it could never notice anybody at all.
     */
    get guardRadius() { return 95; }

    /**
     * Whether it could actually get its jaw to something.
     *
     * Two ways to fail. The water there may be deeper than it will wade, which
     * is the defence against it - swim off the flat and it has to turn back. Or
     * the target may be nowhere near the ground: someone treading water above
     * the summit is thirty metres over anything with legs, and chasing that
     * left it standing on the peak enraged at somebody in the sky.
     *
     * Height off the ground is the test rather than whether the ground is dry,
     * so a diver who has climbed out onto the island counts - which they can,
     * now that the surface is no longer a ceiling.
     */
    canReach(target) {
      const ground = SL.Biomes.floorHeightAt(target.position.x, target.position.z);
      if (-ground > this.wadeDepth) return false;
      return target.position.y - ground < 6;
    }

    /**
     * It patrols the shoreline rather than the summit.
     *
     * Everything it could ever want is at the waterline: the fish on the flat,
     * and anything swimming in off it. A predator that walks the peak is a
     * predator that never meets anything.
     */
    pickTarget() {
      const islet = SL.Biomes.islet;
      if (!islet) return super.pickTarget();

      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(islet.peakRadius * 0.8, islet.shoulderRadius * 1.5);
        const x = islet.x + Math.cos(angle) * radius;
        const z = islet.z + Math.sin(angle) * radius;

        // Anywhere from just inland of the tideline to as deep as it will wade.
        const depth = -SL.Biomes.floorHeightAt(x, z);
        if (depth < -6 || depth > this.wadeDepth) continue;

        this.target.set(x, 0, z);
        return;
      }
      super.pickTarget();
    }

    onDeath(killer) {
      super.onDeath(killer);
      this.game.hud.toast('The Walkingcarni Leviathan is dead');
    }

    steer(dt) {
      const player = this.game.player;

      // The leash comes before everything. However good the chase is going, it
      // does not leave its island - swimming away from the shore is the whole
      // of your defence and it has to actually hold.
      const fromHome = Math.hypot(this.position.x - this.islandCentre.x,
        this.position.z - this.islandCentre.z);
      if (fromHome > this.leash) {
        if (this.state === 'angry') {
          this.threat = null;
          this.enterState('roam');
        }
        return _tmp.set(this.islandCentre.x - this.position.x, 0,
          this.islandCentre.z - this.position.z)
          .normalize().multiplyScalar(this.species.cruiseSpeed);
      }

      // Already committed, or the diver is gone: the inherited machine handles
      // chasing, biting and giving up at the waterline.
      if (this.state !== 'angry' && !player.dead) {
        const distance = player.position.distanceTo(this.position);

        if (distance < this.guardRadius && this.canReach(player)) {
          this.guardTimer += dt;
          // A beat before it commits, so walking across a corner of the island
          // is not instantly a fight.
          if (this.guardTimer > 1.5) {
            this.guardTimer = 0;
            this.threat = player;
            this.aggro = 26;
            this.enterState('angry');
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
            this.game.hud.toast('The island has something bigger on it');
            return _tmp.set(0, 0, 0);
          }
        } else {
          this.guardTimer = Math.max(0, this.guardTimer - dt);
        }
      }

      return super.steer(dt);
    }
  }

  SL.Walkingcarni = Walkingcarni;
  SL.WalkingcarniLeviathan = WalkingcarniLeviathan;
})(window.SL);
