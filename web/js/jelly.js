/**
 * Jellyfish.
 *
 * They do not swim anywhere in particular. A jelly drifts, gives a pulse of
 * its bell that lifts it a little, and sinks slowly until the next one; a
 * bloom of them hangs about in the same patch of water for its whole life.
 * They do not flee and they do not chase.
 *
 * What they do is sting. Touch a jelly - its bell or anywhere down its
 * tentacles - and it costs you about five health. Each jelly can only sting
 * every second and a half, so brushing past one is a sting and swimming
 * through a bloom is several.
 */
(function (SL) {
  'use strict';

  const _axis = new THREE.Vector3();
  const _a = new THREE.Vector3();
  const _b = new THREE.Vector3();
  const _tmp = new THREE.Vector3();

  /** How often one jelly can sting. */
  const STING_COOLDOWN = 1.6;
  /**
   * How close counts as touching: the diver's body, plus the reach of a
   * tentacle.
   *
   * It has to be wider than the diver's own collision with the jelly (body
   * 0.5 plus the bell), because that collision shoves a soft jelly away the
   * moment you meet it. At 0.45 the shove always won - every jelly you swam
   * into was pushed just out of stinging range first, and nothing ever stung.
   */
  const DIVER_RADIUS = 0.62;
  /** How far a bloom drifts from where it started. */
  const LEASH = 26;

  class Jelly extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.layout = SL.jellyLayout(species.shape);

      this.pulse = SL.random() * Math.PI * 2;
      this.squeeze = 0;
      this.stingCooldown = 0;
      this.sway = SL.random() * 10;
      const heading = SL.random() * Math.PI * 2;
      this.drift = new THREE.Vector3(Math.cos(heading), 0, Math.sin(heading));
      this.driftTimer = SL.randRange(8, 20);
    }

    get stateLabel() { return this.dead ? '' : 'drifting'; }

    /** Soft: you push through a jelly rather than off it - which is how you get stung. */
    get diverPush() { return 0.15; }
    /** And a sting is not a bite: it does not throw you across the water. */
    get knockback() { return 0.2; }

    /** Nothing makes a jelly run. It has nothing to run with. */
    provoke() {}
    onHurt() {}

    desiredVelocity(dt) {
      const S = this.species;
      const p = this.position;

      // The bell: a quick squeeze, a long relax. Thrust only on the squeeze.
      this.pulse += dt * S.wagRate;
      const beat = Math.sin(this.pulse);
      this.squeeze = beat > 0.55 ? (beat - 0.55) / 0.45 : 0;

      // Wander a little, and always back towards home.
      this.driftTimer -= dt;
      if (this.driftTimer <= 0) {
        this.driftTimer = SL.randRange(8, 20);
        const heading = SL.random() * Math.PI * 2;
        this.drift.set(Math.cos(heading), 0, Math.sin(heading));
      }
      _tmp.set(this.territory.x - p.x, 0, this.territory.z - p.z);
      const away = _tmp.length();
      if (away > LEASH) this.drift.lerp(_tmp.normalize(), 0.05).normalize();

      // Stays in its band of water: pulses harder when low, rests when high.
      const floor = SL.Biomes.floorHeightAt(p.x, p.z);
      const low = floor + this.layout.length * 0.5 + 0.8;
      const high = Math.min(floor + S.altitude * 2.2, SL.WATER_LEVEL - this.layout.length * 0.5 - 1.2);
      let lift = this.squeeze * S.cruiseSpeed * 2.2 - 0.08;
      if (p.y < low) lift = Math.max(lift, 0.25);
      if (p.y > high) lift = Math.min(lift, -0.12);

      return _tmp.copy(this.drift).multiplyScalar(S.cruiseSpeed * (0.4 + this.squeeze))
        .setY(lift);
    }

    /** The bell pulses; the tentacles trail and sway after it. */
    animate(dt) {
      this.sway += dt;
      const s = this.squeeze;
      this.bodyMesh.scale.set(1 - s * 0.14, 1 + s * 0.1, 1 - s * 0.14);
      this.tailMesh.scale.set(1 - s * 0.1, 1 - s * 0.06, 1 - s * 0.1);
      this.tailMesh.rotation.x = Math.sin(this.sway * 0.7) * 0.12;
      this.tailMesh.rotation.z = Math.cos(this.sway * 0.53) * 0.1;
    }

    update(dt) {
      super.update(dt);
      if (this.dead) return;

      this.stingCooldown = Math.max(0, this.stingCooldown - dt);
      const player = this.game.player;
      // The Sting Guard is exactly what it says.
      if (this.stingCooldown > 0 || player.dead || player.stingGuard) return;

      // Cheap reject first: almost every jelly is nowhere near the diver.
      const reach = this.layout.length * 0.5 + this.layout.bell + DIVER_RADIUS;
      if (this.position.distanceToSquared(player.position) > reach * reach) return;

      // Touching it means coming within the bell's width of the line that
      // runs from the crown of its bell to the ends of its tentacles.
      this.bodyAxis(_axis);
      _a.copy(this.position).addScaledVector(_axis, this.layout.top);
      _b.copy(this.position).addScaledVector(_axis, this.layout.bottom);
      _tmp.subVectors(_b, _a);
      const t = SL.clamp(_axis.subVectors(player.position, _a).dot(_tmp) / _tmp.lengthSq(), 0, 1);
      const nearest = _a.addScaledVector(_tmp, t);
      // Narrower down the tentacles than across the bell.
      const width = SL.lerp(this.layout.bell, this.layout.bell * 0.85, t) + DIVER_RADIUS;
      if (nearest.distanceToSquared(player.position) > width * width) return;

      this.stingCooldown = STING_COOLDOWN;
      player.hurt(this.species.biteDamage, this);

      // One toast for a run of stings, not one per jelly in a bloom.
      const now = this.game.time;
      if (!this.game.lastStingToast || now - this.game.lastStingToast > 4) {
        this.game.lastStingToast = now;
        this.game.hud.toast('Stung by a ' + this.species.name);
      }
    }
  }

  SL.Jelly = Jelly;
})(window.SL);
