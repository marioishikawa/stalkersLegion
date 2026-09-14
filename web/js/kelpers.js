/**
 * The Kelper Leviathan and its kelpers.
 *
 * The far forest belongs to something that does not fight for it. Swim into
 * Kelper's Reach and the leviathan calls up kelpers - quick, spindly things
 * that dart in, take one loose item off you and run for the weeds with it.
 *
 * They only ever take what you could make again: bait, beacons, medkits, repel
 * charges. Built gear is yours, and so are raw materials. Kill the one that
 * robbed you and you get the item straight back; let it reach the forest and it
 * is gone.
 *
 * The leviathan itself is not a bystander. Robbing you is its opening move, not
 * its whole answer: stay in its water once the kelpers are out and it comes and
 * drives you off the bank itself.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _slot = new THREE.Vector3();
  const _mouth = new THREE.Vector3();

  /** How close its mouth has to get to land a bite. */
  const MOUTH_REACH = 5;

  /** Only the consumables are worth stealing. Upgrades are never touched. */
  const STEALABLE = ['bait', 'beacon', 'medkit', 'repel'];

  const LABELS = {
    approach: 'closing on you',
    flee: 'running with your gear',
    idle: 'circling'
  };

  // ---------------------------------------------------------------------------
  // The thieves
  // ---------------------------------------------------------------------------

  class Kelper extends SL.Creature {
    constructor(game, x, y, z, home) {
      super(game, SL.Species.kelper, x, y, z);
      this.state = 'approach';
      this.stateTimer = 0;
      this.life = 0;
      this.stolen = null;
      this.home = home ? home.clone() : new THREE.Vector3(x, y, z);
      this.weave = SL.random() * Math.PI * 2;
    }

    get stateLabel() { return LABELS[this.state] || ''; }

    /** Being hit just makes it leave. It is a thief, not a fighter. */
    provoke() { this.flee(); }

    onHurt() { this.flee(); }

    onDeath() {
      // Whatever it was carrying falls back to you.
      if (this.stolen) {
        SL.Crafting.stacks[this.stolen] = (SL.Crafting.stacks[this.stolen] || 0) + 1;
        this.game.hud.toast('Recovered your ' + Kelper.label(this.stolen));
        this.stolen = null;
      }
    }

    static label(type) {
      return { bait: 'bait pod', beacon: 'beacon', medkit: 'medkit', repel: 'repel charge' }[type] || type;
    }

    /** Picks one consumable off the diver, if they have any. */
    steal() {
      const held = STEALABLE.filter((type) => (SL.Crafting.stacks[type] || 0) > 0);
      if (!held.length) {
        // Nothing worth taking - it loses interest rather than hanging around.
        this.game.hud.toast('A kelper found nothing to take');
        this.flee();
        return;
      }

      const type = held[Math.floor(SL.random() * held.length)];
      SL.Crafting.stacks[type]--;
      this.stolen = type;

      this.game.audio.metalBite(0);
      this.game.hud.toast('A kelper took your ' + Kelper.label(type) + '!');
      this.flee();
    }

    flee() {
      if (this.state === 'flee') return;
      this.state = 'flee';
      this.stateTimer = 0;
    }

    update(dt) {
      super.update(dt);
      this.life += dt;
      // Called things do not hang around forever.
      if (!this.dead && this.life > 70) this.destroy();
    }

    desiredVelocity(dt) {
      const S = this.species;
      const player = this.game.player;
      this.stateTimer += dt;
      this.weave += dt * 3;

      if (this.state === 'flee') {
        this.jawOpen = SL.damp(this.jawOpen, 0.1, 3, dt);

        // Made it home, or far enough away: gone, with whatever it took.
        if (this.position.distanceTo(this.home) < 12 || this.stateTimer > 26) {
          this.stolen = null;                 // it got away with it
          this.destroy();
          return _tmp.set(0, 0, 0);
        }

        return _tmp.subVectors(this.home, this.position).normalize()
          .multiplyScalar(S.sprintSpeed);
      }

      // --- Closing in ----------------------------------------------------------
      const distance = player.position.distanceTo(this.position);
      this.jawOpen = SL.damp(this.jawOpen, distance < 6 ? 0.7 : 0.2, 4, dt);

      if (distance < 1.8) { this.steal(); return _tmp.set(0, 0, 0); }

      // Gave up on reaching them.
      if (this.stateTimer > 40) { this.flee(); return _tmp.set(0, 0, 0); }

      // A weaving approach, which makes them awkward to knife on the way in.
      _slot.copy(player.position);
      const sideways = Math.sin(this.weave) * Math.min(distance * 0.35, 4);
      _tmp.subVectors(_slot, this.position).normalize();
      _slot.set(-_tmp.z, 0, _tmp.x).multiplyScalar(sideways);

      return _tmp.multiplyScalar(S.sprintSpeed).add(_slot);
    }
  }

  // ---------------------------------------------------------------------------
  // The leviathan that calls them
  // ---------------------------------------------------------------------------

  const LEV_LABELS = {
    hold: 'holding the forest',
    calling: 'calling kelpers',
    driving: 'driving you out',
    angry: 'driving you out'
  };

  /** Inside this, and after this long, it stops delegating and comes itself. */
  const DRIVE_RANGE = 38;
  const PATIENCE = 10;

  class KelperLeviathan extends SL.Creature {
    constructor(game, x, y, z) {
      super(game, SL.Species.kelperLeviathan, x, y, z);
      // Kept tighter than its sense radius, so it never wanders off the bank's
      // crown and onto the bare rubble of the flanks.
      this.territoryRadius = 34;
      this.state = 'hold';
      this.stateTimer = 0;
      this.callCooldown = 8;
      this.biteCooldown = 0;
      this.aggro = 0;
      this.threat = null;
      // How long the diver has been in its water. It is patient, then it isn't.
      this.intrusion = 0;
      this.driftTarget = new THREE.Vector3(x, y, z);
    }

    get stateLabel() { return LEV_LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.4 + 2.5; }

    /** Where its mouth is. Eleven metres of animal does not bite with its middle. */
    mouthPosition() {
      return _mouth.set(0, 0, this.bodyLength * 0.45)
        .applyQuaternion(this.object.quaternion).add(this.position);
    }

    canBite(target) {
      return this.mouthPosition().distanceToSquared(target.position) < MOUTH_REACH * MOUTH_REACH;
    }

    /** Whether it is currently coming for the diver, for the proximity warning. */
    get hunting() {
      return !this.dead && (this.state === 'driving' || this.state === 'angry');
    }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    provoke(threat) {
      if (this.dead || !threat) return;
      this.threat = threat;
      this.aggro = 18;
      this.enterState('angry');
    }

    onHurt(damage, source) { this.provoke(source); }

    onDeath() {
      SL.Pickup.burst(this.game, 'titanium', this.position, 8);
      SL.Pickup.burst(this.game, 'quartz', this.position, 6);
      SL.Pickup.burst(this.game, 'gold', this.position, 3);
      this.game.hud.toast('The Kelper Leviathan is dead');
    }

    /** Sends up a handful of kelpers from the weeds around it. */
    callKelpers(count) {
      const game = this.game;
      if (game.kelpers.length >= 5) return;

      for (let i = 0; i < count; i++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(6, 18);
        const x = this.position.x + Math.cos(angle) * radius;
        const z = this.position.z + Math.sin(angle) * radius;
        const y = Math.min(SL.Biomes.floorHeightAt(x, z) + SL.randRange(3, 8), SL.WATER_LEVEL - 3);

        game.kelpers.push(new Kelper(game, x, y, z, this.position));
      }

      game.audio.dolphinWhistle(game.distanceToPlayer(this.position) * 0.4);
      if (game.distanceToPlayer(this.position) < 90) {
        game.hud.toast('The leviathan calls kelpers');
      }
    }

    desiredVelocity(dt) {
      const S = this.species;
      const player = this.game.player;

      this.stateTimer += dt;
      this.aggro = Math.max(0, this.aggro - dt);
      this.callCooldown = Math.max(0, this.callCooldown - dt);
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);

      const playerDistance = player.dead ? Infinity : player.position.distanceTo(this.position);
      const inForest = playerDistance < S.senseRadius;

      // Robbing is its whole answer to intruders, so it calls whether or not it
      // has been provoked - as long as someone is in its water.
      if (inForest && this.callCooldown <= 0) {
        this.callCooldown = SL.randRange(16, 26);
        this.callKelpers(SL.randInt(2, 3));
        if (this.state === 'hold') this.enterState('calling');
      }

      // Patience runs while someone is standing in its forest, and only there.
      if (inForest && playerDistance < DRIVE_RANGE && !player.dead) {
        this.intrusion += dt;
      } else {
        this.intrusion = Math.max(0, this.intrusion - dt * 0.5);
      }

      // Out of patience: it comes itself. This is the same behaviour as being
      // provoked, so the two states share everything below.
      if (this.state === 'hold' && this.intrusion > PATIENCE) {
        this.threat = player;
        this.aggro = 20;
        this.enterState('driving');
        this.game.hud.toast('The Kelper Leviathan is coming for you');
      }

      if (this.state === 'angry' || this.state === 'driving') {
        this.jawOpen = SL.damp(this.jawOpen, playerDistance < 14 ? 0.9 : 0.3, 3, dt);

        if (!this.threat || this.threat.dead || this.aggro <= 0) {
          this.threat = null;
          this.intrusion = 0;
          this.enterState('hold');
          return _tmp.set(0, 0, 0);
        }

        // It will not leave the forest to chase anyone, which is how you get
        // away from it: swim off the bank and it has to turn back.
        if (this.position.distanceTo(this.territory) > this.territoryRadius) {
          return _tmp.subVectors(this.territory, this.position).normalize()
            .multiplyScalar(S.cruiseSpeed);
        }

        if (this.biteCooldown <= 0 && this.canBite(this.threat)) {
          this.biteCooldown = S.biteInterval;
          this.game.audio.bite(0);
          this.threat.hurt(S.biteDamage, this);
        }

        return _tmp.subVectors(this.threat.position, this.mouthPosition()).normalize()
          .multiplyScalar(S.sprintSpeed);
      }

      if (this.state === 'calling' && this.stateTimer > 5) this.enterState('hold');

      // --- Holding station over its forest --------------------------------------
      this.jawOpen = SL.damp(this.jawOpen, 0.15, 1.5, dt);

      if (this.driftTarget.distanceToSquared(this.position) < 64 || this.stateTimer > 24) {
        this.stateTimer = 0;
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(10, this.territoryRadius * 0.7);
        const x = this.territory.x + Math.cos(angle) * radius;
        const z = this.territory.z + Math.sin(angle) * radius;
        this.driftTarget.set(x, Math.min(SL.Biomes.floorHeightAt(x, z) + SL.randRange(6, 14),
          SL.WATER_LEVEL - 4), z);
      }

      return _tmp.subVectors(this.driftTarget, this.position).normalize()
        .multiplyScalar(S.cruiseSpeed);
    }
  }

  SL.Kelper = Kelper;
  SL.KelperLeviathan = KelperLeviathan;
})(window.SL);
