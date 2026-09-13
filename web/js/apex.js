/**
 * The two apex creatures, and the standoff between them.
 *
 * Neither is a scaled-up stalker in behaviour. The King Stalker sits on a hoard
 * and ignores the diver entirely until struck; the Glasswhale hunts stalkers
 * across open water and has no concept of the diver as prey. When the two meet
 * they clash, neither wins, and both withdraw - which is the only time you can
 * watch something out here that has nothing to do with you.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _look = new THREE.Vector3();

  /** How close the two apexes must be before they square up. */
  const CLASH_RANGE = 26;
  const CLASH_DURATION = 9;
  const CLASH_COOLDOWN = 70;

  /**
   * Starts a clash if both are willing. Neither dies - they trade a few real
   * blows, break off, and stay away from each other for a while.
   */
  function tryClash(a, b, game) {
    if (!a || !b || a.dead || b.dead) return false;
    if (a.clashCooldown > 0 || b.clashCooldown > 0) return false;
    if (a.position.distanceTo(b.position) > CLASH_RANGE) return false;

    for (const [self, other] of [[a, b], [b, a]]) {
      self.clashTarget = other;
      self.clashTimer = CLASH_DURATION;
      self.clashCooldown = CLASH_COOLDOWN;
      self.enterState('clash');
    }

    game.hud.toast('Something enormous is fighting out there');
    game.audio.bite(game.distanceToPlayer(a.position));
    return true;
  }

  /** Shared clash steering: circle the opponent, snapping at it. */
  function clashStep(self, dt, game) {
    const other = self.clashTarget;
    self.clashTimer -= dt;

    if (!other || other.dead || self.clashTimer <= 0) {
      self.clashTarget = null;
      self.enterState('withdraw');
      self.stateTimer = 0;
      return _tmp.copy(self.velocity).normalize().multiplyScalar(self.species.cruiseSpeed);
    }

    const distance = other.position.distanceTo(self.position);
    self.jawOpen = 0.5 + 0.5 * Math.sin(game.time * 5);

    // Lunge in, then swing wide, so the pair wheel around each other.
    const phase = Math.sin(self.clashTimer * 1.4);
    if (distance < self.bodyLength * 0.7 || phase < 0) {
      _look.subVectors(self.position, other.position).normalize()
        .multiplyScalar(self.bodyLength).add(other.position);
    } else {
      _look.copy(other.position);
    }

    if (distance < self.bodyLength * 0.8 && self.biteCooldown <= 0) {
      self.biteCooldown = 1.6;
      game.audio.bite(game.distanceToPlayer(self.position));
      // Real damage, but never enough to settle it either way.
      other.health = Math.max(other.species.maxHealth * 0.35, other.health - 40);
    }

    return _tmp.subVectors(_look, self.position).normalize()
      .multiplyScalar(self.species.sprintSpeed * 0.8);
  }

  // ---------------------------------------------------------------------------
  // The King Stalker
  // ---------------------------------------------------------------------------

  const KING_LABELS = {
    guard: 'guarding the hoard',
    clash: 'fighting the whale',
    withdraw: 'withdrawing',
    enraged: 'enraged'
  };

  class KingStalker extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 16;
      this.state = 'guard';
      this.stateTimer = 0;
      this.biteCooldown = 0;
      this.clashTimer = 0;
      this.clashCooldown = 20;
      this.clashTarget = null;
      this.threat = null;
      this.aggro = 0;
      this.senseTimer = 0;

      /** Where its subjects pile the scrap they drag out here. */
      this.hoard = new THREE.Vector3(x, SL.Biomes.floorHeightAt(x, z) + 1, z);
      this.patrolTarget = new THREE.Vector3(x, y, z);
    }

    get stateLabel() { return KING_LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.45 + 2.5; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** Only ever provoked - it starts nothing with the diver. */
    provoke(threat) {
      if (this.dead || !threat) return;
      this.threat = threat;
      this.aggro = 26;
      this.enterState('enraged');
      this.game.hud.toast('The Stalker Leviathan has noticed you');
    }

    onHurt(damage, source) {
      if (source === this.game.player) this.provoke(source);
    }

    onDeath() {
      // A king's worth of salvage.
      SL.Pickup.burst(this.game, 'tooth', this.position, 14);
      SL.Pickup.burst(this.game, 'titanium', this.position, 8);
      SL.Pickup.burst(this.game, 'gold', this.position, 4);
      this.game.hud.toast('The Stalker Leviathan is dead');
    }

    desiredVelocity(dt) {
      const S = this.species;
      this.stateTimer += dt;
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);
      this.clashCooldown = Math.max(0, this.clashCooldown - dt);
      this.aggro = Math.max(0, this.aggro - dt);

      // Look for the whale a few times a second.
      this.senseTimer -= dt;
      if (this.senseTimer <= 0) {
        this.senseTimer = 0.5;
        if (this.state === 'guard' || this.state === 'enraged') {
          for (const whale of this.game.whales) tryClash(this, whale, this.game);
        }
      }

      switch (this.state) {
        case 'clash':
          return clashStep(this, dt, this.game);

        case 'withdraw': {
          // Break off and go home to the hoard.
          this.jawOpen = SL.damp(this.jawOpen, 0, 2, dt);
          if (this.stateTimer > 14 || this.position.distanceTo(this.hoard) < 12) {
            this.enterState('guard');
          }
          return _tmp.subVectors(this.hoard, this.position).normalize().multiplyScalar(S.cruiseSpeed);
        }

        case 'enraged': {
          const threat = this.threat;
          if (!threat || threat.dead || this.aggro <= 0) {
            this.threat = null;
            this.enterState('guard');
            return _tmp.set(0, 0, 0);
          }

          const distance = threat.position.distanceTo(this.position);
          this.jawOpen = SL.damp(this.jawOpen, distance < 12 ? 1 : 0.35, 4, dt);

          // It will not chase you across the ocean; leave and it loses interest.
          if (distance > S.senseRadius * 1.4) {
            this.threat = null;
            this.aggro = 0;
            this.enterState('guard');
            return _tmp.set(0, 0, 0);
          }

          if (distance < this.biteReach && this.biteCooldown <= 0) {
            this.biteCooldown = S.biteInterval;
            this.game.audio.bite(0);
            threat.hurt(S.biteDamage, this);
            _look.subVectors(this.position, threat.position).normalize()
              .multiplyScalar(18).add(this.position);
            return _tmp.subVectors(_look, this.position).normalize().multiplyScalar(S.sprintSpeed);
          }

          return _tmp.subVectors(threat.position, this.position).normalize().multiplyScalar(S.sprintSpeed);
        }

        case 'guard':
        default: {
          this.jawOpen = SL.damp(this.jawOpen, 0.1, 1.5, dt);

          // Slow circuits of the hoard.
          if (this.patrolTarget.distanceToSquared(this.position) < 25 || this.stateTimer > 16) {
            this.stateTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            const radius = SL.randRange(6, this.territoryRadius);
            this.patrolTarget.set(
              this.hoard.x + Math.cos(angle) * radius,
              this.hoard.y + SL.randRange(3, 10),
              this.hoard.z + Math.sin(angle) * radius);
          }

          return _tmp.subVectors(this.patrolTarget, this.position).normalize()
            .multiplyScalar(S.cruiseSpeed * 0.7);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // The Glasswhale
  // ---------------------------------------------------------------------------

  const WHALE_LABELS = {
    drift: 'drifting',
    hunt: 'hunting stalkers',
    swallow: 'feeding',
    clash: 'fighting the king',
    withdraw: 'withdrawing'
  };

  class Whale extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 60;
      this.state = 'drift';
      this.stateTimer = 0;
      this.senseTimer = 0;
      this.biteCooldown = 0;
      this.clashTimer = 0;
      this.clashCooldown = 30;
      this.clashTarget = null;
      this.prey = null;
      this.driftTarget = new THREE.Vector3(x, y, z);
    }

    get stateLabel() { return WHALE_LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.42 + 3; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** Nothing the diver does makes a whale hostile. */
    provoke() {}
    onHurt() {}

    onDeath() {
      SL.Pickup.burst(this.game, 'titanium', this.position, 10);
      SL.Pickup.burst(this.game, 'quartz', this.position, 6);
    }

    sense() {
      // Stalkers anywhere in its enormous range are food.
      let closest = null;
      let closestDistance = this.species.senseRadius;

      for (const stalker of this.game.stalkers) {
        if (stalker.dead) continue;
        const distance = stalker.position.distanceTo(this.position);
        if (distance < closestDistance) { closestDistance = distance; closest = stalker; }
      }

      for (const king of this.game.kings) tryClash(this, king, this.game);

      if (closest && this.state === 'drift') {
        this.prey = closest;
        this.enterState('hunt');
      }
    }

    desiredVelocity(dt) {
      const S = this.species;
      this.stateTimer += dt;
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);
      this.clashCooldown = Math.max(0, this.clashCooldown - dt);

      this.senseTimer -= dt;
      if (this.senseTimer <= 0) {
        this.senseTimer = 0.8;
        if (this.state === 'drift' || this.state === 'hunt') this.sense();
      }

      switch (this.state) {
        case 'clash':
          return clashStep(this, dt, this.game);

        case 'withdraw': {
          this.jawOpen = SL.damp(this.jawOpen, 0, 1.5, dt);
          if (this.stateTimer > 16) this.enterState('drift');
          const from = this.clashTarget ? this.clashTarget.position : this.driftTarget;
          return _tmp.subVectors(this.position, from).normalize().multiplyScalar(S.cruiseSpeed);
        }

        case 'hunt': {
          const prey = this.prey;
          if (!prey || prey.dead || this.stateTimer > 40) {
            this.prey = null;
            this.enterState('drift');
            return _tmp.set(0, 0, 0);
          }

          const distance = prey.position.distanceTo(this.position);
          this.jawOpen = SL.damp(this.jawOpen, distance < 16 ? 1 : 0.2, 2, dt);

          if (distance < this.biteReach) {
            // Swallowed whole.
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
            prey.hurt(99999, this);
            this.prey = null;
            this.enterState('swallow');
            if (this.game.distanceToPlayer(this.position) < 70) {
              this.game.hud.toast('The Glasswhale took a stalker');
            }
            return _tmp.set(0, 0, 0);
          }

          // Lead the target - it is slow, so it aims well ahead.
          _look.copy(prey.velocity).multiplyScalar(Math.min(distance / S.sprintSpeed, 3)).add(prey.position);
          return _tmp.subVectors(_look, this.position).normalize().multiplyScalar(S.sprintSpeed);
        }

        case 'swallow': {
          this.jawOpen = Math.max(0, 1 - this.stateTimer / 3);
          if (this.stateTimer > 3) this.enterState('drift');
          return _tmp.copy(this.velocity).normalize().multiplyScalar(S.cruiseSpeed * 0.4);
        }

        case 'drift':
        default: {
          this.jawOpen = SL.damp(this.jawOpen, 0.05, 1, dt);

          if (this.driftTarget.distanceToSquared(this.position) < 100 || this.stateTimer > 30) {
            this.stateTimer = 0;
            const angle = Math.random() * Math.PI * 2;
            const radius = SL.randRange(20, this.territoryRadius);
            const x = this.territory.x + Math.cos(angle) * radius;
            const z = this.territory.z + Math.sin(angle) * radius;
            this.driftTarget.set(x, SL.Biomes.floorHeightAt(x, z) + SL.randRange(12, 30), z);
          }

          return _tmp.subVectors(this.driftTarget, this.position).normalize().multiplyScalar(S.cruiseSpeed);
        }
      }
    }
  }

  /**
   * Cheat: drag the two leviathans together and start a clash, then put the
   * diver somewhere safe to watch it from. Normally this only happens when the
   * whale's wandering brings it into the king's water, which can take a while.
   */
  SL.forceClash = function (game) {
    const king = game.kings.find((k) => !k.dead);
    const whale = game.whales.find((w) => !w.dead);

    if (!king || !whale) {
      game.hud.toast('Both leviathans have to be alive for that');
      return false;
    }

    // Reset them to full and clear the standoff cooldown.
    king.health = king.species.maxHealth;
    whale.health = whale.species.maxHealth;
    king.clashCooldown = 0;
    whale.clashCooldown = 0;
    king.threat = null;
    king.aggro = 0;

    // Bring the whale to the king, a little above and off to one side.
    whale.object.position.copy(king.position).add(new THREE.Vector3(16, 5, 0));
    whale.velocity.set(0, 0, 0);

    if (!tryClash(king, whale, game)) {
      game.hud.toast('They would not engage');
      return false;
    }

    // A ringside seat. Close enough to see through the murk out here, far
    // enough to stay clear of two animals throwing their weight around.
    const seat = king.position.clone().add(new THREE.Vector3(5, 9, 19));
    game.player.position.copy(seat);
    game.player.velocity.set(0, 0, 0);

    const look = new THREE.Vector3().subVectors(
      king.position.clone().lerp(whale.position, 0.5), seat).normalize();
    game.player.yaw = Math.atan2(-look.x, -look.z);
    game.player.pitch = Math.asin(SL.clamp(look.y, -1, 1));

    game.hud.toast('SANDWICH — the leviathans are fighting');
    return true;
  };

  SL.KingStalker = KingStalker;
  SL.Whale = Whale;
})(window.SL);
