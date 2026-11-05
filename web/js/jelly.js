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

    /**
     * Where it stings: the line from the crown of the bell to the ends of the
     * tentacles, the bell's width at the top and a little less at the bottom.
     */
    stingZone() {
      const L = this.layout;
      return { from: L.top, to: L.bottom, wide: L.bell, narrow: L.bell * 0.85 };
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
      if (this.stingCooldown > 0 || player.dead) return;
      // The Sting Guard is exactly what it says - for an ordinary jelly. A
      // leviathan's sting is too much for it, and it only takes the edge off.
      if (player.stingGuard && !this.species.leviathan) return;

      // Cheap reject first: almost every jelly is nowhere near the diver.
      const reach = this.layout.length * 0.5 + this.layout.bell + DIVER_RADIUS;
      if (this.position.distanceToSquared(player.position) > reach * reach) return;

      // Touching it means coming within its width of the line its stinging
      // part runs along - see stingZone().
      const zone = this.stingZone();
      this.bodyAxis(_axis);
      _a.copy(this.position).addScaledVector(_axis, zone.from);
      _b.copy(this.position).addScaledVector(_axis, zone.to);
      _tmp.subVectors(_b, _a);
      const t = SL.clamp(_axis.subVectors(player.position, _a).dot(_tmp) / _tmp.lengthSq(), 0, 1);
      const nearest = _a.addScaledVector(_tmp, t);
      const width = SL.lerp(zone.wide, zone.narrow, t) + DIVER_RADIUS;
      if (nearest.distanceToSquared(player.position) > width * width) return;

      this.stingCooldown = STING_COOLDOWN;
      player.hurt(this.species.biteDamage * (player.stingGuard ? 0.5 : 1), this);

      // One toast for a run of stings, not one per jelly in a bloom.
      const now = this.game.time;
      if (!this.game.lastStingToast || now - this.game.lastStingToast > 4) {
        this.game.lastStingToast = now;
        this.game.hud.toast('Stung by a ' + this.species.name);
      }
    }
  }

  SL.Jelly = Jelly;

  // ---------------------------------------------------------------------------

  /**
   * The Sun Jelly Leviathan.
   *
   * A jellyfish five metres across, glowing orange, drifting with its bell
   * just under the sunlit surface and twenty metres of tentacles hanging
   * down beneath it - the lion's mane jellyfish, which is real, and is the
   * biggest there is.
   *
   * It does not chase and it does not flee; it drifts in a slow loop over
   * deep water. Only the tentacles sting, and they sting hard. The bell is
   * solid and safe, so the way to it is from above or from the side, and
   * the danger is the curtain of tentacles trailing under it as it moves.
   */
  class SunJelly extends Jelly {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.driftTarget = new THREE.Vector3(x, y, z);
      this.pickDrift();
    }

    get stateLabel() { return this.dead ? '' : 'drifting in the sun'; }

    /**
     * Not a capsule. The diver's ordinary collision treats an animal as solid
     * along its whole length, which here would be a wall twenty metres high
     * where the tentacles are - and tentacles are the thing you swim into and
     * get stung by. The bell is made solid by update() instead.
     */
    get ghost() { return true; }

    stingZone() {
      const L = this.layout;
      return { from: L.rim, to: L.bottom, wide: L.bell * 0.85, narrow: L.bell * 0.6 };
    }

    /** Somewhere over water deep enough for its tentacles to hang clear. */
    pickDrift() {
      const need = this.layout.length + 6;
      for (let tries = 0; tries < 16; tries++) {
        const angle = SL.random() * Math.PI * 2;
        const r = SL.randRange(30, 160);
        const x = this.territory.x + Math.cos(angle) * r;
        const z = this.territory.z + Math.sin(angle) * r;
        if (SL.Biomes.floorHeightAt(x, z) > SL.WATER_LEVEL - need) continue;
        this.driftTarget.set(x, SL.WATER_LEVEL - this.layout.top - 1.5, z);
        return;
      }
      this.driftTarget.copy(this.territory);
    }

    desiredVelocity(dt) {
      const S = this.species;
      this.pulse += dt * S.wagRate;
      const beat = Math.sin(this.pulse);
      this.squeeze = beat > 0.55 ? (beat - 0.55) / 0.45 : 0;

      if (this.driftTarget.distanceToSquared(this.position) < 100) this.pickDrift();
      _tmp.subVectors(this.driftTarget, this.position);
      const lift = SL.clamp(_tmp.y * 0.2, -0.3, 0.3);
      _tmp.setY(0);
      if (_tmp.lengthSq() > 1e-6) _tmp.normalize();
      return _tmp.multiplyScalar(S.cruiseSpeed * (0.5 + this.squeeze)).setY(lift);
    }

    update(dt) {
      super.update(dt);
      if (this.dead) return;

      // The bell is solid: a soft sphere you are pushed out of.
      const player = this.game.player;
      if (player.dead) return;
      const L = this.layout;
      this.bodyAxis(_axis);
      _a.copy(this.position).addScaledVector(_axis, L.rim + L.bellHeight * 0.45);
      _tmp.subVectors(player.position, _a);
      const d = _tmp.length();
      const clear = L.bell * 0.95 + 0.5;
      if (d < clear && d > 1e-4) {
        _tmp.multiplyScalar((clear - d) / d);
        player.position.add(_tmp);
        const into = player.velocity.dot(_tmp.normalize());
        if (into < 0) player.velocity.addScaledVector(_tmp, -into);
      }
    }

    onDeath() {
      SL.Pickup.burst(this.game, 'simyphit', this.position, 3);
      SL.Pickup.burst(this.game, 'gold', this.position, 4);
      SL.Pickup.burst(this.game, 'quartz', this.position, 6);
      this.game.hud.toast('The Sun Jelly Leviathan sinks, and its light goes out');
    }
  }

  SL.SunJelly = SunJelly;
})(window.SL);
