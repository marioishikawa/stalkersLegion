/**
 * The shark.
 *
 * A second predator in water that already had one, and deliberately not a
 * second stalker. A stalker is obsessed with scrap metal and bites whatever
 * interrupts it; the shark has no interest in metal at all. It is here for the
 * Glimmerfin, and it will pick a fight with a stalker that gets in its way.
 *
 * Three things make it its own animal:
 *
 *  * IT HUNTS ONE FISH. Glimmerfin are what it wants, and it will cross its
 *    whole range for one. Anything else is a fallback it only takes when there
 *    are no Glimmerfin worth chasing.
 *
 *  * IT WILL NOT EAT THEM OUT. Below a share of what the world started with it
 *    stops hunting them entirely and goes after something else, which with the
 *    nests on the species is what keeps the shallows from going quiet. A
 *    predator that eats the last of its prey has made a mistake, and this one
 *    does not make it.
 *
 *  * IT FIGHTS STALKERS, SOMETIMES. Not on sight and not every time: a roll
 *    when one comes into range, and a cooldown afterwards, so meeting a shark
 *    and a stalker in the same stretch of kelp is an event rather than a
 *    fixture. Neither of them is on the diver's side.
 *
 * It does not hunt the diver. Swim through its range and it will go round you;
 * cut it and it will take that very personally indeed.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _look = new THREE.Vector3();

  const LABELS = {
    patrol: 'cruising',
    hunt: 'hunting',
    feed: 'feeding',
    spar: 'squaring up to a stalker',
    attack: 'coming for you',
    veerOff: 'circling back',
    retreat: 'breaking off'
  };

  /** What it prefers above everything else. */
  const PREY = 'glimmerfin';

  /**
   * The share of the world's starting Glimmerfin below which the shark stops
   * hunting them. Nests refill a species fastest when it is scarcest, so this
   * hands the population back to them before it is in any real trouble.
   */
  const PREY_FLOOR = 0.45;

  /** How often it bothers to re-count the prey. Not a per-frame question. */
  const CENSUS_INTERVAL = 6;

  /**
   * Seconds between meals.
   *
   * Without this a shark eats a Glimmerfin every five seconds, which is both
   * silly to watch and a drain the nests cannot answer: twelve kills a minute
   * from one animal took seventy-seven fish out of the shallows in a minute
   * flat. A shark that has just eaten is not hunting; it is swimming about
   * digesting, which is what a shark mostly does.
   */
  const MEAL_INTERVAL = [55, 110];

  /** The chance a stalker in range turns into a fight, and the wait after one. */
  const SPAR_CHANCE = 0.35;
  const SPAR_COOLDOWN = [40, 90];

  class Shark extends SL.Creature {
    constructor(game, x, y, z) {
      super(game, SL.Species.shark, x, y, z);

      this.territoryRadius = 60;
      this.state = 'patrol';
      this.stateTimer = 0;
      this.senseTimer = SL.random() * 0.4;
      this.biteCooldown = 0;
      this.aggro = 0;
      this.snap = 0;

      this.threat = null;
      this.targetFish = null;
      this.rival = null;

      this.sparCooldown = SL.randRange(0, SPAR_COOLDOWN[0]);
      this.censusTimer = SL.random() * CENSUS_INTERVAL;
      this.preyHealthy = true;
      this.kills = 0;

      // Staggered, so a reef's worth of sharks do not all get hungry together.
      this.hunger = SL.randRange(0, MEAL_INTERVAL[1]);
      this.appetite = SL.randRange(MEAL_INTERVAL[0], MEAL_INTERVAL[1]);

      this.patrolTarget = new THREE.Vector3(x, y, z);
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.55 + 1.2; }

    /** For the proximity warning: it only counts when it is actually after you. */
    get hunting() { return !this.dead && this.state === 'attack'; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    provoke(threat) {
      if (this.dead || !threat) return;
      this.threat = threat;
      this.aggro = Math.max(this.aggro, 16);
      this.enterState('attack');
    }

    onHurt(damage, source) {
      // Badly hurt, it leaves. Otherwise whoever did that has its full
      // attention, diver or stalker.
      if (this.health < this.species.maxHealth * 0.22) {
        this.threat = source;
        this.enterState('retreat');
      } else if (source) {
        this.provoke(source);
      }
    }

    onDeath() {
      SL.Pickup.burst(this.game, 'tooth', this.position, SL.randInt(4, 7));
      SL.Pickup.burst(this.game, 'titanium', this.position, 1);
    }

    /**
     * Are there enough Glimmerfin left to be hunting them?
     *
     * Counted against what this world started with rather than an absolute
     * number, so it holds however big the map gets.
     */
    takeCensus() {
      const target = (this.game.startPopulation || {})[PREY] || 0;
      if (!target) { this.preyHealthy = true; return; }

      let alive = 0;
      for (const fish of this.game.fish) {
        if (fish.species.id === PREY && !fish.dead) alive++;
      }
      this.preyHealthy = alive >= target * PREY_FLOOR;
    }

    /** The nearest thing worth eating, preferring the one it came for. */
    findPrey(range) {
      const p = this.position;
      let best = null;
      let bestDistance = range * range;

      for (const fish of this.game.fish) {
        if (fish.dead) continue;
        const isPrey = fish.species.id === PREY;
        // Off-menu while the Glimmerfin are thin, and the only thing on it
        // while they are not.
        if (this.preyHealthy !== isPrey) continue;

        const d = fish.position.distanceToSquared(p);
        if (d < bestDistance) { bestDistance = d; best = fish; }
      }
      return best;
    }

    /** A stalker close enough to argue with. */
    findRival(range) {
      const p = this.position;
      let best = null;
      let bestDistance = range * range;

      for (const stalker of this.game.stalkers) {
        if (stalker.dead) continue;
        const d = stalker.position.distanceToSquared(p);
        if (d < bestDistance) { bestDistance = d; best = stalker; }
      }
      return best;
    }

    /** The priority ladder, a few times a second. */
    sense() {
      const S = this.species;
      const p = this.position;

      // 1. Something it is already angry with.
      if (this.aggro > 0 && this.threat && !this.threat.dead) {
        if (this.threat.position.distanceTo(p) < S.senseRadius * 1.6) {
          if (this.state !== 'retreat' && this.state !== 'veerOff') this.enterState('attack');
          return;
        }
        this.aggro = 0;
        this.threat = null;
      }

      // 2. Busy states finish.
      if (this.state === 'feed' || this.state === 'retreat'
        || this.state === 'veerOff' || this.state === 'spar') return;

      // 3. A stalker, sometimes. This is the whole of the rivalry: a roll when
      //    one is in range, then a long wait, so it is an event rather than a
      //    standing war.
      if (this.sparCooldown <= 0) {
        const rival = this.findRival(S.senseRadius);
        if (rival) {
          this.sparCooldown = SL.randRange(SPAR_COOLDOWN[0], SPAR_COOLDOWN[1]);
          if (SL.random() < SPAR_CHANCE) {
            this.rival = rival;
            // Mutual: the stalker does not stand there being bitten.
            rival.provoke(this);
            this.enterState('spar');
            if (this.game.distanceToPlayer(p) < 55) {
              this.game.hud.toast('A shark goes for a stalker');
            }
            return;
          }
        }
      }

      // 4. Dinner, if it is hungry. Most of the time it is not.
      if (this.hunger > this.appetite) {
        const prey = this.findPrey(S.senseRadius * 1.3);
        if (prey) { this.targetFish = prey; this.enterState('hunt'); return; }
      }

      this.enterState('patrol');
    }

    steerTo(target, speed) {
      return _tmp.subVectors(target, this.position).normalize().multiplyScalar(speed);
    }

    newPatrolTarget() {
      const angle = SL.random() * Math.PI * 2;
      const dist = SL.randRange(this.territoryRadius * 0.3, this.territoryRadius);
      const x = this.territory.x + Math.cos(angle) * dist;
      const z = this.territory.z + Math.sin(angle) * dist;
      this.patrolTarget.set(x,
        Math.min(SL.Biomes.floorHeightAt(x, z) + SL.randRange(3, 9), SL.WATER_LEVEL - 2), z);
    }

    desiredVelocity(dt) {
      const S = this.species;
      const p = this.position;

      this.stateTimer += dt;
      this.hunger += dt;
      this.aggro = Math.max(0, this.aggro - dt);
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);
      this.sparCooldown = Math.max(0, this.sparCooldown - dt);
      if (this.snap > 0) { this.snap -= dt; this.jawOpen = Math.max(0, this.jawOpen - dt * 6); }

      this.censusTimer -= dt;
      if (this.censusTimer <= 0) { this.censusTimer = CENSUS_INTERVAL; this.takeCensus(); }

      this.senseTimer -= dt;
      if (this.senseTimer <= 0) { this.senseTimer = 0.35; this.sense(); }

      switch (this.state) {
        case 'hunt': {
          const fish = this.targetFish;
          if (!fish || fish.dead) { this.targetFish = null; this.enterState('patrol'); break; }

          const distance = fish.position.distanceTo(p);
          if (distance > S.senseRadius * 2 || this.stateTimer > 20) {
            this.targetFish = null;
            this.enterState('patrol');
            break;
          }

          this.jawOpen = SL.damp(this.jawOpen, distance < 5 ? 1 : 0.25, 5, dt);

          if (distance < this.biteReach) {
            this.snap = 0.4;
            this.game.audio.bite(this.game.distanceToPlayer(p));
            fish.hurt(9999, this);
            this.targetFish = null;
            this.kills++;
            this.hunger = 0;
            this.appetite = SL.randRange(MEAL_INTERVAL[0], MEAL_INTERVAL[1]);
            this.enterState('feed');
            return _tmp.set(0, 0, 0);
          }

          // Aim where it is going, not where it is.
          _look.copy(fish.velocity).multiplyScalar(Math.min(distance / S.sprintSpeed, 1.3))
            .add(fish.position);
          return this.steerTo(_look, S.sprintSpeed);
        }

        case 'feed': {
          this.jawOpen = 0.5 + 0.5 * Math.sin(this.game.time * 11);
          if (this.stateTimer > 2.2) this.enterState('patrol');
          return _tmp.copy(this.velocity).normalize().multiplyScalar(S.cruiseSpeed * 0.3);
        }

        case 'spar': {
          const rival = this.rival;
          if (!rival || rival.dead || this.stateTimer > 26) {
            if (rival && rival.dead && this.game.distanceToPlayer(p) < 55) {
              this.game.hud.toast('The shark wins');
            }
            this.rival = null;
            this.enterState('patrol');
            break;
          }

          const distance = rival.position.distanceTo(p);
          if (distance > S.senseRadius * 1.8) { this.rival = null; this.enterState('patrol'); break; }

          this.jawOpen = SL.damp(this.jawOpen, distance < 5 ? 1 : 0.35, 5, dt);

          if (distance < this.biteReach && this.biteCooldown <= 0) {
            this.biteCooldown = S.biteInterval;
            this.snap = 0.35;
            this.game.audio.bite(this.game.distanceToPlayer(p));
            rival.hurt(S.biteDamage, this);
            // Both of them break and come back round, which is what makes it
            // look like a fight rather than a feeding.
            this.enterState('veerOff');
            this.threat = rival;
            return _tmp.subVectors(p, rival.position).normalize().multiplyScalar(S.sprintSpeed);
          }

          return this.steerTo(rival.position, S.sprintSpeed);
        }

        case 'attack': {
          const threat = this.threat;
          if (!threat || threat.dead) { this.threat = null; this.enterState('patrol'); break; }

          const distance = threat.position.distanceTo(p);
          if (distance > S.senseRadius * 1.8) {
            this.threat = null; this.aggro = 0;
            this.enterState('patrol');
            break;
          }

          this.jawOpen = SL.damp(this.jawOpen, distance < 6 ? 1 : 0.3, 5, dt);

          if (distance < this.biteReach && this.biteCooldown <= 0) {
            this.biteCooldown = S.biteInterval;
            this.snap = 0.35;
            this.game.audio.bite(0);
            threat.hurt(S.biteDamage, this);
            this.enterState('veerOff');
            return _tmp.subVectors(p, threat.position).normalize().multiplyScalar(S.sprintSpeed);
          }

          return this.steerTo(threat.position, S.sprintSpeed);
        }

        case 'veerOff': {
          this.jawOpen = SL.damp(this.jawOpen, 0.15, 3, dt);
          if (this.stateTimer > 3.5) {
            if (this.rival && !this.rival.dead) this.enterState('spar');
            else if (this.threat && !this.threat.dead && this.aggro > 0) this.enterState('attack');
            else this.enterState('patrol');
          }
          const away = this.rival || this.threat;
          return _tmp.subVectors(p, away ? away.position : this.patrolTarget)
            .normalize().multiplyScalar(S.cruiseSpeed * 1.4);
        }

        case 'retreat': {
          this.jawOpen = SL.damp(this.jawOpen, 0, 3, dt);
          if (this.stateTimer > 12) { this.aggro = 0; this.threat = null; this.enterState('patrol'); }
          const from = this.threat ? this.threat.position : this.patrolTarget;
          return _tmp.subVectors(p, from).normalize().multiplyScalar(S.sprintSpeed * 0.85);
        }
      }

      // --- Patrol ---------------------------------------------------------------
      this.jawOpen = SL.damp(this.jawOpen, 0.1, 2, dt);
      if (this.patrolTarget.distanceToSquared(p) < 25 || this.stateTimer > 16) {
        this.stateTimer = 0;
        this.newPatrolTarget();
      }
      return this.steerTo(this.patrolTarget, S.cruiseSpeed);
    }
  }

  SL.Shark = Shark;
})(window.SL);
