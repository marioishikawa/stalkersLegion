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

/**
 * The Red Puff Leviathan.
 *
 * The third leviathan, and the only one that never hunts anything. It grazes
 * the reef and would rather be left alone. Provoke it and it does not chase:
 * it swells to twice its size, throws a cage of thorned vines up around
 * whatever provoked it, then comes after it - slowly, because a swollen fish
 * is not a fast one, but it does not stop until the aggro runs out.
 *
 * Being caged is the threat. The vines are solid, they wither on their own, and
 * a knife cuts through one faster than waiting does.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();

  const LABELS = {
    graze: 'grazing the reef',
    puffed: 'swollen and furious',
    settle: 'deflating'
  };

  class RedPuff extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 34;
      this.state = 'graze';
      this.stateTimer = 0;
      this.biteCooldown = 0;
      this.cageCooldown = 0;
      this.chargeCooldown = 0;
      this.threat = null;
      this.aggro = 0;
      this.puff = 0;                       // 0 slack, 1 fully inflated
      this.grazeTarget = new THREE.Vector3(x, y, z);
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.5 + 2; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** Purely defensive: it only ever reacts to being hit. */
    provoke(threat) {
      if (this.dead || !threat) return;
      this.threat = threat;
      this.aggro = 16;

      if (this.state !== 'puffed') {
        this.enterState('puffed');
        this.game.hud.toast('The Red Puff swells');
      }

      // Every hit stokes it further, up to a hard ceiling.
      this.aggro = Math.min(this.aggro + 8, 34);

      // Throw the cage, but not every single time it is touched.
      if (this.cageCooldown <= 0) {
        this.cageCooldown = 9;
        // Sixteen stalks on a three-metre ring puts roughly 1.2 m between
        // their centres and 0.3 m between their edges - comfortably narrower
        // than the diver, so the ring holds instead of being squeezed through.
        SL.Vine.cage(this.game, threat.position, 3.0, 16);
        this.game.audio.crystal();
      }
    }

    onHurt(damage, source) { this.provoke(source); }

    onDeath() {
      SL.Pickup.burst(this.game, 'quartz', this.position, 8);
      SL.Pickup.burst(this.game, 'titanium', this.position, 5);
      SL.Pickup.burst(this.game, 'diamond', this.position, 2);
    }

    /** Inflation is a scale on the body, so it reads at any distance. */
    animate(dt) {
      super.animate(dt);
      const scale = 1 + this.puff * 0.85;
      this.bodyMesh.scale.setScalar(scale);
      if (this.jawMesh) this.jawMesh.scale.setScalar(scale);
    }

    desiredVelocity(dt) {
      const S = this.species;
      this.stateTimer += dt;
      this.aggro = Math.max(0, this.aggro - dt);
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);
      this.cageCooldown = Math.max(0, this.cageCooldown - dt);
      this.chargeCooldown = Math.max(0, this.chargeCooldown - dt);

      switch (this.state) {
        case 'puffed': {
          this.puff = SL.damp(this.puff, 1, 3, dt);
          this.jawOpen = SL.damp(this.jawOpen, 0.25, 2, dt);

          const threat = this.threat;
          if (!threat || threat.dead || this.aggro <= 0) {
            this.enterState('settle');
            return _tmp.set(0, 0, 0);
          }

          const distance = threat.position.distanceTo(this.position);

          if (distance < this.biteReach && this.biteCooldown <= 0) {
            this.biteCooldown = S.biteInterval;
            this.game.audio.bite(0);
            threat.hurt(S.biteDamage, this);
          }

          // Now that it is up, it comes for whoever woke it. A ball of spines
          // is slow, so this is a thing you can outswim in open water - which
          // is exactly why it cages you first.
          if (distance > 90) {
            this.enterState('settle');
            return _tmp.set(0, 0, 0);
          }

          // A fresh cage every so often, so running only buys you distance.
          if (this.cageCooldown <= 0 && distance < 30) {
            this.cageCooldown = 9;
            SL.Vine.cage(this.game, threat.position, 3.0, 16);
            this.game.audio.crystal();
          }

          _tmp.subVectors(threat.position, this.position).normalize();

          // It lunges in bursts rather than grinding along at one speed. The
          // burst is faster than a diver swims and the grind is slower, so
          // sprinting away works and paddling away does not - which is the
          // whole trade, because sprinting burns air you may not have.
          let speed = S.cruiseSpeed * 1.9;
          if (this.chargeCooldown <= 0 && distance < 34) {
            this.chargeCooldown = SL.randRange(3.5, 6);
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
          }
          if (this.chargeCooldown > 2.6) speed = S.sprintSpeed;

          // Close enough to bite and it stops shoving, so it does not push the
          // diver out through its own vines.
          if (distance < this.biteReach * 0.8) speed *= 0.15;

          return _tmp.multiplyScalar(speed);
        }

        case 'settle': {
          this.puff = SL.damp(this.puff, 0, 1.2, dt);
          this.jawOpen = SL.damp(this.jawOpen, 0.05, 1.5, dt);
          if (this.stateTimer > 6) { this.threat = null; this.enterState('graze'); }
          return _tmp.set(0, 0, 0);
        }

        case 'graze':
        default: {
          this.puff = SL.damp(this.puff, 0, 1.5, dt);
          this.jawOpen = SL.damp(this.jawOpen, 0.1 + 0.1 * Math.sin(this.game.time * 0.7), 1, dt);

          if (this.grazeTarget.distanceToSquared(this.position) < 16 || this.stateTimer > 20) {
            this.stateTimer = 0;
            const angle = SL.random() * Math.PI * 2;
            const radius = SL.randRange(8, this.territoryRadius);
            const x = this.territory.x + Math.cos(angle) * radius;
            const z = this.territory.z + Math.sin(angle) * radius;
            this.grazeTarget.set(x, SL.Biomes.floorHeightAt(x, z) + SL.randRange(3, 8), z);
          }

          return _tmp.subVectors(this.grazeTarget, this.position).normalize()
            .multiplyScalar(S.cruiseSpeed * 0.7);
        }
      }
    }
  }

  SL.RedPuff = RedPuff;
})(window.SL);

/**
 * The Glow Leviathan.
 *
 * The abyssal plain is half the sea floor and it is meant to feel like
 * crossing nothing. This is the one thing out there - a thirteen-metre fish
 * lit from the inside, which is the only leviathan that is genuinely a light
 * source rather than a shape you make out. Everything else in the game is lit
 * by three fixed lights; this one carries its own and drags it across the dark.
 *
 * It wants nothing. It drifts, it breathes, and if you cut it it turns white
 * and comes at you.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();

  const LABELS = {
    drift: 'crossing the dark',
    flare: 'lighting you up',
    angry: 'blazing'
  };

  /**
   * Resting light, and what a flare or a wound pushes it to.
   *
   * These are large against a scene whose three fixed lights deliberately total
   * about 1.0 - but this one is a local light in the darkest biome in the game,
   * and if it does not visibly lay a pool of light on the sea floor then it is
   * a painted fish rather than a lamp.
   */
  const CALM_LIGHT = 5.5;
  const FLARE_LIGHT = 14;

  /** How far the light reaches. Far - it is supposed to be a landmark. */
  const LIGHT_RANGE = 120;

  class GlowLeviathan extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 150;
      this.state = 'drift';
      this.stateTimer = 0;
      this.biteCooldown = 0;
      this.aggro = 0;
      this.threat = null;
      this.driftTarget = new THREE.Vector3(x, y, z);

      // Its own light, carried in the middle of the body. This is the whole
      // creature really - the mesh is unlit and would read the same in a jar;
      // what makes it a leviathan is that the sea floor lights up under it.
      this.glow = 1;
      // A slow falloff, so the light is a wide dim pool rather than a hotspot.
      this.lamp = new THREE.PointLight(0x69e4ff, CALM_LIGHT, LIGHT_RANGE, 1.0);
      this.object.add(this.lamp);

      // Its own materials, because of one flag: fog is off.
      //
      // Every other colour in the game is fogged, which is what makes the murk
      // work - but a fogged light source dims with distance, and a light that
      // dims with distance is not a landmark. Bioluminescence in dark water
      // reads at range precisely because it is emitting rather than reflecting,
      // so this animal is the one thing the murk does not eat.
      const lit = game.materials.glow.clone();
      lit.fog = false;
      this.bodyMesh.material = lit;
      this.tailMesh.material = lit;
      if (this.jawMesh) this.jawMesh.material = lit;

      // A halo, which is what actually reads as the light coming off it. The
      // lamp lights things near it, but the abyssal floor out here is coarse
      // terrain on per-vertex Lambert and a point light barely marks it - the
      // glow has to be something you can see in the water itself.
      this.halo = new THREE.Mesh(this.bodyMesh.geometry, game.materials.halo.clone());
      this.halo.material.fog = false;
      this.halo.scale.setScalar(1.5);
      this.object.add(this.halo);

      this.pulse = SL.random() * Math.PI * 2;
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.44 + 3; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** It starts nothing. Cut it and it stops being scenery. */
    provoke(threat) {
      if (this.dead || !threat) return;
      this.threat = threat;
      this.aggro = 24;
      if (this.state !== 'angry') {
        this.enterState('angry');
        this.game.hud.toast('The Glow Leviathan flares');
      }
    }

    onHurt(damage, source) { this.provoke(source); }

    onDeath() {
      // The light goes out with it.
      this.lamp.intensity = 0;
      SL.Pickup.burst(this.game, 'quartz', this.position, 12);
      SL.Pickup.burst(this.game, 'diamond', this.position, 4);
      SL.Pickup.burst(this.game, 'titanium', this.position, 8);
      this.game.hud.toast('The Glow Leviathan is dark');
    }

    /** The light breathes, and dies with the animal. */
    animate(dt) {
      super.animate(dt);

      this.pulse += dt * (this.state === 'drift' ? 0.9 : 2.6);

      const target = this.dead ? 0
        : (this.state === 'drift' ? CALM_LIGHT : FLARE_LIGHT);
      this.glow = SL.damp(this.glow, target / CALM_LIGHT, 2.2, dt);

      const breath = 1 + Math.sin(this.pulse) * 0.16 + Math.sin(this.pulse * 2.7) * 0.06;
      this.lamp.intensity = Math.max(0, this.glow * CALM_LIGHT * breath);

      // Cold blue at rest, hot white when it is angry, so the colour of the
      // water around it tells you what it is doing before the label does.
      const heat = SL.clamp((this.lamp.intensity - CALM_LIGHT) / (FLARE_LIGHT - CALM_LIGHT), 0, 1);
      this.lamp.color.setRGB(
        SL.lerp(0.41, 1.0, heat),
        SL.lerp(0.89, 0.97, heat),
        1.0);

      // The halo breathes with the lamp and swells when it flares, so the glow
      // reads from far enough away to be a landmark.
      const shine = Math.min(this.glow, 3);
      this.halo.material.opacity = 0.22 * shine * breath;
      this.halo.material.color.copy(this.lamp.color);
      this.halo.scale.setScalar(1.35 + shine * 0.22 + Math.sin(this.pulse) * 0.05);
      this.halo.visible = this.halo.material.opacity > 0.01;
    }

    desiredVelocity(dt) {
      const S = this.species;
      const player = this.game.player;

      this.stateTimer += dt;
      this.aggro = Math.max(0, this.aggro - dt);
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);

      const playerDistance = player.dead ? Infinity : player.position.distanceTo(this.position);

      if (this.state === 'angry') {
        this.jawOpen = SL.damp(this.jawOpen, playerDistance < 18 ? 0.9 : 0.35, 3, dt);

        if (!this.threat || this.threat.dead || this.aggro <= 0 || playerDistance > 130) {
          this.threat = null;
          this.enterState('drift');
          return _tmp.set(0, 0, 0);
        }

        if (playerDistance < this.biteReach && this.biteCooldown <= 0) {
          this.biteCooldown = S.biteInterval;
          this.game.audio.bite(0);
          this.threat.hurt(S.biteDamage, this);
        }

        return _tmp.subVectors(this.threat.position, this.position).normalize()
          .multiplyScalar(S.sprintSpeed);
      }

      // A flare is a display, not a threat: it brightens when someone comes
      // close and goes back to its business. Nothing about it does damage.
      if (this.state === 'flare') {
        this.jawOpen = SL.damp(this.jawOpen, 0.2, 2, dt);
        if (this.stateTimer > 7 || playerDistance > S.senseRadius * 1.3) this.enterState('drift');
      } else if (playerDistance < S.senseRadius * 0.45 && this.stateTimer > 12) {
        this.enterState('flare');
      }

      this.jawOpen = SL.damp(this.jawOpen, 0.12, 1, dt);

      // --- Crossing ------------------------------------------------------------
      //
      // A long, slow line across open water rather than a circuit, because the
      // point of it is that you meet it somewhere out there.
      if (this.driftTarget.distanceToSquared(this.position) < 225 || this.stateTimer > 70) {
        this.stateTimer = 0;
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(60, this.territoryRadius);
        const x = this.territory.x + Math.cos(angle) * radius;
        const z = this.territory.z + Math.sin(angle) * radius;
        this.driftTarget.set(x,
          Math.min(SL.Biomes.floorHeightAt(x, z) + SL.randRange(7, 16), SL.WATER_LEVEL - 8), z);
      }

      return _tmp.subVectors(this.driftTarget, this.position).normalize()
        .multiplyScalar(S.cruiseSpeed);
    }
  }

  SL.GlowLeviathan = GlowLeviathan;
})(window.SL);
