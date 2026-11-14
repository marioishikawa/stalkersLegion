/**
 * The Kraken.
 *
 * A squid twenty-six metres long, living over the Tentacle Grounds. It hangs
 * in the gloom until it notices you, then comes closer and watches. Then it
 * rushes - mantle first, the way a squid swims, arms streaming behind - and
 * as it goes past, the arms take you. Held, you are squeezed every second
 * until you cut your way out: two good hits and it lets go and backs off, and
 * after a while it comes again.
 *
 * It will not leave its grounds to chase you, and it never follows anyone
 * into the wreck.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _fwd = new THREE.Vector3();
  const _arms = new THREE.Vector3();

  const LABELS = {
    lurk: 'hanging in the gloom',
    stalk: 'watching you',
    strike: 'rushing you',
    grab: 'squeezing you',
    retreat: 'backing off'
  };

  /** How long it holds on, at most, and how many cuts make it let go. */
  const HOLD_FOR = 6;
  const CUTS_TO_ESCAPE = 2;

  class KrakenLeviathan extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 200;
      this.state = 'lurk';
      this.stateTimer = 0;
      this.squeezeTimer = 0;
      this.cuts = 0;
      this.driftTarget = new THREE.Vector3(x, y, z);
      this.pickDrift();
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get hunting() { return !this.dead && this.state !== 'lurk'; }
    /** Holding you, it does not also shove you out of its own arms. */
    get diverPush() { return this.state === 'grab' ? 0 : 1; }

    /** Whether it has hold of the diver right now. */
    get holding() { return !this.dead && this.state === 'grab'; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** Where its arms are: well behind its middle, since it swims mantle first. */
    armPoint() {
      this.object.getWorldDirection(_fwd);
      return _arms.copy(this.position).addScaledVector(_fwd, -this.bodyLength * 0.36);
    }

    pickDrift() {
      const angle = SL.random() * Math.PI * 2;
      const r = SL.randRange(20, this.territoryRadius * 0.8);
      const x = this.territory.x + Math.cos(angle) * r;
      const z = this.territory.z + Math.sin(angle) * r;
      const floor = SL.Biomes.floorHeightAt(x, z);
      this.driftTarget.set(x, Math.min(floor + this.species.altitude, SL.WATER_LEVEL - 12), z);
    }

    canHunt(player) {
      if (player.dead) return false;
      if (SL.Wreck && SL.Wreck.isInside(player.position)) return false;
      const fromHome = Math.hypot(player.position.x - this.territory.x, player.position.z - this.territory.z);
      return fromHome < this.territoryRadius * 1.35;
    }

    provoke() {
      if (this.dead) return;
      if (this.state === 'lurk') this.enterState('stalk');
    }

    onHurt(damage, source) {
      if (this.state === 'grab') {
        if (source === this.game.player && ++this.cuts >= CUTS_TO_ESCAPE) this.release(true);
        return;
      }
      this.provoke();
    }

    /** Lets go of the diver, and backs off for a while. */
    release(cut) {
      this.cuts = 0;
      this.enterState('retreat');
      const player = this.game.player;
      if (!player.dead) {
        // Thrown clear, away from the arms.
        _tmp.subVectors(player.position, this.position).normalize();
        player.velocity.addScaledVector(_tmp, 6);
        this.game.hud.toast(cut ? 'You cut yourself free of the Kraken' : 'The Kraken lets you go');
      }
    }

    onDeath() {
      if (this.state === 'grab') this.release(true);
      SL.Pickup.burst(this.game, 'gold', this.position, 6);
      SL.Pickup.burst(this.game, 'simyphit', this.position, 6);
      SL.Pickup.burst(this.game, 'diamond', this.position, 2);
      SL.Pickup.burst(this.game, 'titanium', this.position, 8);
      this.game.hud.toast('The Kraken sinks, arms and all');
    }

    update(dt) {
      super.update(dt);
      if (this.dead || this.state !== 'grab') return;

      const player = this.game.player;
      if (player.dead || !this.canHunt(player)) { this.release(false); return; }

      // Held in the arms: wherever they go, you go.
      player.position.lerp(this.armPoint(), Math.min(1, dt * 6));
      player.velocity.set(0, 0, 0);

      this.squeezeTimer -= dt;
      if (this.squeezeTimer <= 0) {
        this.squeezeTimer = this.species.biteInterval;
        this.game.audio.bite(0);
        player.hurt(this.species.biteDamage, this);
        if (player.velocity) player.velocity.set(0, 0, 0);
      }
      if (this.stateTimer > HOLD_FOR) this.release(false);
    }

    desiredVelocity(dt) {
      const S = this.species;
      const player = this.game.player;
      this.stateTimer += dt;
      const distance = player.dead ? Infinity : player.position.distanceTo(this.position);
      const huntable = this.canHunt(player);
      this.jawOpen = SL.damp(this.jawOpen, this.state === 'grab' ? 0.8 : 0.1, 3, dt);

      switch (this.state) {
        case 'grab': {
          // Drawing you slowly down and away.
          this.object.getWorldDirection(_fwd);
          return _tmp.copy(_fwd).setY(_fwd.y - 0.4).normalize().multiplyScalar(S.cruiseSpeed * 0.5);
        }

        case 'strike': {
          if (!huntable) { this.enterState('retreat'); break; }
          // The arms are behind it, so it aims to go past: through where you
          // are and out the other side, sweeping its arms through you.
          if (this.armPoint().distanceTo(player.position) < 4.5) {
            this.enterState('grab');
            this.squeezeTimer = 0.4;
            this.cuts = 0;
            this.game.hud.toast('The Kraken has you - cut it to break free!');
            break;
          }
          if (this.stateTimer > 7) { this.enterState('retreat'); break; }
          _tmp.subVectors(player.position, this.position);
          const d = _tmp.length();
          _tmp.normalize();
          const aim = _fwd.copy(player.position).addScaledVector(_tmp, this.bodyLength * 0.45);
          return aim.sub(this.position).normalize().multiplyScalar(S.sprintSpeed);
        }

        case 'retreat': {
          if (this.stateTimer > 9) {
            this.enterState(huntable && distance < S.senseRadius ? 'stalk' : 'lurk');
            this.pickDrift();
            break;
          }
          if (player.dead) break;
          _tmp.subVectors(this.position, player.position).setY(0);
          if (_tmp.lengthSq() < 1e-4) _tmp.set(1, 0, 0);
          return _tmp.normalize().multiplyScalar(S.cruiseSpeed * 1.4);
        }

        case 'stalk': {
          if (!huntable || distance > S.senseRadius * 1.4) {
            this.enterState('lurk');
            this.pickDrift();
            break;
          }
          if (this.stateTimer > 6 && distance < 40) {
            this.game.audio.blow(this.game.distanceToPlayer(this.position));
            this.enterState('strike');
            break;
          }
          // Closer, and level with you, but not yet.
          _tmp.subVectors(player.position, this.position);
          const d = _tmp.length();
          const speed = d > 30 ? S.cruiseSpeed * 1.3 : S.cruiseSpeed * 0.4;
          return _tmp.normalize().multiplyScalar(speed);
        }

        case 'lurk':
        default: {
          if (huntable && distance < S.senseRadius) {
            this.enterState('stalk');
            this.game.hud.toast('Something with a great many arms is watching you');
            break;
          }
          if (this.driftTarget.distanceToSquared(this.position) < 400 || this.stateTimer > 60) {
            this.stateTimer = 0;
            this.pickDrift();
          }
          return _tmp.subVectors(this.driftTarget, this.position).normalize().multiplyScalar(S.cruiseSpeed * 0.6);
        }
      }
      return _tmp.set(0, 0, 0);
    }
  }

  SL.KrakenLeviathan = KrakenLeviathan;
})(window.SL);
