/**
 * The Seahorse Leviathan.
 *
 * Thirteen metres of seahorse standing upright over the Seahorse Meadows. It
 * is slow, it grazes, and it has no interest in a diver who keeps out of its
 * way. What it is known for is the one thing every seahorse is known for: it
 * feeds by snapping its head forward faster than almost anything else in the
 * sea. Hang about in front of its snout and it takes an interest, draws its
 * head back - that is the warning - and strikes.
 *
 * Cut it and it stops being calm. It turns to face you, comes after you as
 * fast as a seahorse can (which is not fast), and strikes whenever you are
 * in front of it - with a shorter warning, because now it means it.
 *
 * The way to fight it is the way to fight anything slow with a long reach:
 * stay beside it or behind it, never in front.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _tip = new THREE.Vector3();
  const _forward = new THREE.Vector3();

  const LABELS = {
    graze: 'grazing the meadow',
    watch: 'watching you',
    aim: 'drawing its head back',
    snap: 'striking',
    recover: 'settling',
    angry: 'coming for you'
  };

  /** How close to the snout the strike lands. */
  const STRIKE_REACH = 9;
  /** Far enough in front to catch its eye. */
  const NOTICE_RANGE = 18;
  /** Seconds in front of it before curiosity becomes a strike. */
  const INTEREST_SECONDS = 2.5;
  /** The warning: how long the head is drawn back before it comes forward. */
  const AIM_SECONDS = 1.1;
  const ANGRY_AIM_SECONDS = 0.6;
  /** The strike itself is over almost before it is seen. */
  const SNAP_SECONDS = 0.16;
  const RECOVER_SECONDS = 2.8;
  /** How long a cut keeps it angry, refreshed by every cut. */
  const ANGER_SECONDS = 35;

  class SeahorseLeviathan extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 200;

      this.state = 'graze';
      this.stateTimer = 0;
      this.interest = 0;
      this.anger = 0;
      this.threat = null;
      this.struck = false;

      this.yaw = SL.random() * Math.PI * 2;
      this.pitch = 0;
      this.driftTarget = new THREE.Vector3(x, y, z);
      this.layout = SL.seahorseLayout(species.shape);
      this.pickDrift();
    }

    get stateLabel() { return LABELS[this.state] || ''; }

    /** For the HUD's warning: only when it means you harm. */
    get hunting() {
      return !this.dead && (this.state === 'angry' || this.state === 'aim' || this.state === 'snap');
    }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** The end of its snout, in the world. The strike is measured from here. */
    snoutTip() {
      const H = this.bodyLength;
      return _tip.set(0, this.layout.snoutTip.y * H, this.layout.snoutTip.z * H)
        .applyQuaternion(this.object.quaternion).add(this.position);
    }

    /** Whether a point is on its meadow. */
    onMeadow(x, z) {
      return SL.Biomes.biomeAt(x, z) === SL.Biomes.byId.meadow;
    }

    /** Somewhere else over the grass, at a height that keeps its tail clear. */
    pickDrift() {
      for (let attempt = 0; attempt < 14; attempt++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(20, this.territoryRadius);
        const x = this.territory.x + Math.cos(angle) * radius;
        const z = this.territory.z + Math.sin(angle) * radius;
        if (!this.onMeadow(x, z)) continue;
        this.driftTarget.set(x, this.restingHeightAt(x, z), z);
        return;
      }
      this.driftTarget.copy(this.territory);
    }

    restingHeightAt(x, z) {
      return Math.min(SL.Biomes.floorHeightAt(x, z) + this.bodyLength * 0.5 + 3,
        SL.WATER_LEVEL - this.bodyLength * 0.5 - 2);
    }

    provoke(threat) {
      if (this.dead) return;
      this.threat = threat || this.game.player;
      const wasCalm = this.anger <= 0;
      this.anger = ANGER_SECONDS;
      if (wasCalm && this.state !== 'snap' && this.state !== 'aim') {
        this.enterState('angry');
        this.game.hud.toast('The Seahorse Leviathan turns to face you');
      }
    }

    onHurt(damage, source) { this.provoke(source); }

    onDeath() {
      SL.Pickup.burst(this.game, 'gold', this.position, 8);
      SL.Pickup.burst(this.game, 'quartz', this.position, 6);
      SL.Pickup.burst(this.game, 'titanium', this.position, 8);
      this.game.hud.toast('The Seahorse Leviathan sinks into the grass');
    }

    /** Where the diver is, relative to the front of it. */
    sizeUp(player) {
      if (player.dead) return { distance: Infinity, ahead: -1 };
      const tip = this.snoutTip();
      const distance = tip.distanceTo(player.position);
      _forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      _tmp.subVectors(player.position, this.position).setY(0);
      const ahead = _tmp.lengthSq() > 1e-6 ? _forward.dot(_tmp.normalize()) : 0;
      return { distance, ahead };
    }

    desiredVelocity(dt) {
      const S = this.species;
      const player = this.game.player;
      this.stateTimer += dt;
      this.anger = Math.max(0, this.anger - dt);

      const { distance, ahead } = this.sizeUp(player);
      const inFront = ahead > 0.6;

      switch (this.state) {
        // --- The strike: almost no time at all, and one chance to land -------
        case 'snap': {
          if (!this.struck && this.stateTimer > SNAP_SECONDS * 0.6) {
            this.struck = true;
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
            if (!player.dead && this.snoutTip().distanceTo(player.position) < STRIKE_REACH && ahead > 0.3) {
              player.hurt(S.biteDamage, this);
            }
          }
          if (this.stateTimer > SNAP_SECONDS) this.enterState('recover');
          return _tmp.set(0, 0, 0);
        }

        case 'recover': {
          if (this.stateTimer > RECOVER_SECONDS) this.enterState(this.anger > 0 ? 'angry' : 'graze');
          return _tmp.set(0, 0, 0);
        }

        // --- The warning: head drawn back, quite still -------------------------
        case 'aim': {
          const wait = this.anger > 0 ? ANGRY_AIM_SECONDS : AIM_SECONDS;
          // Out of reach before it fires: it lets it go.
          if (distance > STRIKE_REACH * 2) {
            this.enterState(this.anger > 0 ? 'angry' : 'graze');
            return _tmp.set(0, 0, 0);
          }
          if (this.stateTimer > wait) {
            this.struck = false;
            this.enterState('snap');
          }
          return _tmp.set(0, 0, 0);
        }

        // --- Curious: it stops and looks ---------------------------------------
        case 'watch': {
          if (distance > NOTICE_RANGE * 1.5 || player.dead) {
            this.interest = 0;
            this.enterState('graze');
            return _tmp.set(0, 0, 0);
          }
          // Only time spent in front of it counts. Beside it, it loses interest.
          this.interest = inFront && distance < NOTICE_RANGE
            ? this.interest + dt
            : Math.max(0, this.interest - dt * 0.5);
          if (this.interest > INTEREST_SECONDS && distance < STRIKE_REACH * 1.4) {
            this.interest = 0;
            this.game.audio.blow(this.game.distanceToPlayer(this.position));
            this.enterState('aim');
          }
          // Settles its height to look you in the eye, slowly.
          return _tmp.set(0, (player.position.y - this.snoutTip().y) * 0.25, 0);
        }

        // --- Angry: closes until you are in front of its snout -----------------
        case 'angry': {
          const fromHome = Math.hypot(this.position.x - this.territory.x, this.position.z - this.territory.z);
          if (this.anger <= 0 || player.dead || fromHome > this.territoryRadius * 1.6) {
            this.enterState('graze');
            this.pickDrift();
            return _tmp.set(0, 0, 0);
          }
          if (inFront && distance < STRIKE_REACH * 0.9) {
            this.game.audio.blow(this.game.distanceToPlayer(this.position));
            this.enterState('aim');
            return _tmp.set(0, 0, 0);
          }
          // Steer so the snout, not the middle, ends up beside the diver.
          _tmp.subVectors(player.position, this.snoutTip());
          return _tmp.normalize().multiplyScalar(S.sprintSpeed);
        }

        // --- Grazing: drifting over the grass ----------------------------------
        case 'graze':
        default: {
          if (!player.dead && distance < NOTICE_RANGE && inFront) {
            this.enterState('watch');
            return _tmp.set(0, 0, 0);
          }
          if (!this.onMeadow(this.position.x, this.position.z)) {
            this.driftTarget.copy(this.territory);
          } else if (this.driftTarget.distanceToSquared(this.position) < 64 || this.stateTimer > 45) {
            this.stateTimer = 0;
            this.pickDrift();
          }
          // It pauses to graze, about half the time.
          if (Math.sin(this.stateTimer * 0.35) > 0.4) return _tmp.set(0, 0, 0);
          return _tmp.subVectors(this.driftTarget, this.position).normalize()
            .multiplyScalar(S.cruiseSpeed);
        }
      }
    }

    update(dt) {
      if (this.dead) {
        // Over onto its side, and down into the grass.
        this.deathTimer += dt;
        this.object.rotation.z = SL.damp(this.object.rotation.z, Math.PI / 2, 0.8, dt);
        const floor = SL.Biomes.floorHeightAt(this.position.x, this.position.z);
        if (this.position.y > floor + this.bodyLength * 0.15) this.position.y -= dt * 1.2;
        if (this.deathTimer > 30) this.destroy();
        return;
      }

      super.update(dt);

      // Facing. Grazing, it faces where it drifts; once it has noticed you it
      // turns to face you, slowly - and while it aims, not at all, which is
      // the moment to get out from in front of it.
      const player = this.game.player;
      let targetYaw = this.yaw;
      if (this.state === 'watch' || this.state === 'angry') {
        targetYaw = Math.atan2(player.position.x - this.position.x, player.position.z - this.position.z);
      } else if (this.state === 'graze' && this.velocity.lengthSq() > 0.01) {
        targetYaw = Math.atan2(this.velocity.x, this.velocity.z);
      }
      this.yaw = SL.dampAngle(this.yaw, targetYaw, this.state === 'angry' ? 1.1 : 0.6, dt);

      // The head: drawn back to aim, flung forward to strike, and slowly back
      // upright after.
      let pitchTarget = 0, rate = 2.5;
      if (this.state === 'aim') { pitchTarget = -0.22; rate = 4; }
      if (this.state === 'snap') { pitchTarget = 0.5; rate = 40; }
      this.pitch = SL.damp(this.pitch, pitchTarget, rate, dt);

      this.object.rotation.set(0, 0, 0);
      this.object.rotateY(this.yaw);
      this.object.rotateX(this.pitch);
    }
  }

  SL.SeahorseLeviathan = SeahorseLeviathan;
})(window.SL);
