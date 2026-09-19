/**
 * The diver: six-degrees-of-freedom swimming, a finite supply of air, and a
 * survival knife. No other equipment.
 *
 * Movement is not physics-driven - velocity is damped toward an input-derived
 * target, which gives water's "quick to start, quick to stop" feel without a
 * solver. The only collision is against the analytic sea floor.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;
  const _forward = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _tmp = new THREE.Vector3();
  const _toTarget = new THREE.Vector3();
  const _axis = new THREE.Vector3();
  const _flat = new THREE.Vector3();
  const _swingA = new THREE.Vector3();
  const _swingB = new THREE.Vector3();
  const _bodyA = new THREE.Vector3();
  const _bodyB = new THREE.Vector3();
  const _d1 = new THREE.Vector3();
  const _d2 = new THREE.Vector3();
  const _r = new THREE.Vector3();
  const _c1 = new THREE.Vector3();
  const _c2 = new THREE.Vector3();
  const _normal = new THREE.Vector3();
  const _up = new THREE.Vector3();

  /** Out of the water, metres per second squared. Brisk, not lunar. */
  const GRAVITY = 16;

  /** A short hop, enough to get over a lip of rock on the way up a beach. */
  const JUMP_SPEED = 5.2;

  // Base knife stats live on the player rather than as constants, because the
  // fabricator upgrades them in place.

  /** The knife mesh, built from the same primitives as everything else. */
  function buildKnife() {
    const mesh = new MeshData();
    const blade = new THREE.Color(0.78, 0.80, 0.84);
    const edge = new THREE.Color(0.95, 0.96, 0.98);
    const grip = new THREE.Color(0.14, 0.16, 0.18);
    const guard = new THREE.Color(0.35, 0.33, 0.30);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);

    Geo.box(mesh, 0, 0, -0.06, 0.016, 0.022, 0.06, grip);
    Geo.box(mesh, 0, 0, 0.01, 0.030, 0.030, 0.010, guard);
    Geo.box(mesh, 0, 0.006, 0.10, 0.005, 0.020, 0.09, blade);

    // Tapered point.
    Geo.fin(mesh, V(-0.005, 0.026, 0.19), V(-0.005, -0.014, 0.19), V(-0.005, 0.012, 0.26), edge);
    Geo.fin(mesh, V(0.005, -0.014, 0.19), V(0.005, 0.026, 0.19), V(0.005, 0.012, 0.26), edge);

    // Serrations along the spine.
    for (let i = 0; i < 5; i++) {
      const z = 0.08 + i * 0.024;
      Geo.fin(mesh, V(0, 0.026, z), V(0, 0.026, z + 0.016), V(0, 0.040, z + 0.008), edge);
    }

    mesh.computeNormals();
    return mesh.toGeometry();
  }

  /**
   * The hacked candle: a wax stub in the off hand, and the flame it should not
   * physically be able to hold underwater.
   *
   * Two meshes, because they want different materials - the wax is lit like
   * everything else, the flame is unlit so it stays bright in water that is
   * eating every other colour.
   */
  function buildCandleWax() {
    const mesh = new MeshData();
    const wax = new THREE.Color(0.90, 0.86, 0.72);
    const drip = new THREE.Color(0.78, 0.73, 0.58);
    const wick = new THREE.Color(0.10, 0.09, 0.08);

    Geo.box(mesh, 0, 0, 0, 0.022, 0.022, 0.075, wax);
    Geo.box(mesh, 0, 0, 0.072, 0.026, 0.026, 0.008, drip);
    Geo.box(mesh, 0, 0, 0.088, 0.004, 0.004, 0.012, wick);

    mesh.computeNormals();
    return mesh.toGeometry();
  }

  function buildCandleFlame() {
    const mesh = new MeshData();
    const base = new THREE.Color(1.0, 0.72, 0.22);
    const tip = new THREE.Color(1.0, 0.95, 0.72);

    // The cone helper points up +Y, and the candle stands along +Z, so the
    // flame is built lying down and the group turns it upright.
    Geo.cone(mesh, 0, 0, 0, 0.020, 0.062, 7, base, tip);
    Geo.sphere(mesh, 0, 0.012, 0, 0.017, 7, base);

    mesh.computeNormals();
    return mesh.toGeometry();
  }

  /** How far the candle throws, and how far the flame pushes the murk back. */
  const CANDLE_RANGE = 34;
  const CANDLE_POWER = 2.4;

  /** The one biome it burns in. */
  const CANDLE_BIOME = 'trench';

  /**
   * The swing, written as three poses rather than one arc number.
   *
   * The hand is the camera turned around, so in these numbers +z is straight
   * ahead and -x is the diver's right. The knife cocks back over the right
   * shoulder, comes across the body to the left with the arm extending, and
   * settles back to the grip it started from.
   */
  const KNIFE_REST = { pos: [-0.30, -0.26, 0.52], rot: [-0.20, -0.30, 0.10] };
  const KNIFE_WIND = { pos: [-0.46, -0.08, 0.28], rot: [0.12, -0.95, 0.78] };
  const KNIFE_CUT = { pos: [0.12, -0.34, 0.74], rot: [-0.46, 0.52, -1.06] };

  /** Fractions of the swing spent winding up and cutting. The rest recovers. */
  const WINDUP_END = 0.20;
  const CUT_END = 0.52;

  /** Where in the swing the edge is actually passing through the target. */
  const CONTACT = 0.36;

  function poseKnife(knife, from, to, t) {
    knife.position.set(
      SL.lerp(from.pos[0], to.pos[0], t),
      SL.lerp(from.pos[1], to.pos[1], t),
      SL.lerp(from.pos[2], to.pos[2], t));
    knife.rotation.set(
      SL.lerp(from.rot[0], to.rot[0], t),
      SL.lerp(from.rot[1], to.rot[1], t),
      SL.lerp(from.rot[2], to.rot[2], t));
  }

  /** Shortest distance in the horizontal plane from a point to a travelled path. */
  function pathDistance2D(ax, az, bx, bz, px, pz) {
    const dx = bx - ax;
    const dz = bz - az;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq > 1e-9
      ? SL.clamp(((px - ax) * dx + (pz - az) * dz) / lengthSq, 0, 1)
      : 0;
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  }

  /** Shortest distance from a point to a segment. */
  function pointToSegment(point, a, bEnd) {
    _d1.subVectors(bEnd, a);
    const lengthSq = _d1.lengthSq();
    const t = lengthSq > 1e-9
      ? SL.clamp(_r.subVectors(point, a).dot(_d1) / lengthSq, 0, 1)
      : 0;
    return _c1.copy(a).addScaledVector(_d1, t).distanceTo(point);
  }

  /**
   * Shortest distance between two segments (Ericson's closest-point routine).
   * Used to ask whether a knife swing passed close enough to a body.
   */
  function segmentDistance(p1, q1, p2, q2) {
    _d1.subVectors(q1, p1);
    _d2.subVectors(q2, p2);
    _r.subVectors(p1, p2);

    const a = _d1.lengthSq();
    const e = _d2.lengthSq();
    const f = _d2.dot(_r);

    let s = 0;
    let t = 0;

    if (a < 1e-9 && e < 1e-9) return _r.length();

    if (a < 1e-9) {
      t = SL.clamp(f / e, 0, 1);
    } else {
      const c = _d1.dot(_r);
      if (e < 1e-9) {
        t = 0;
        s = SL.clamp(-c / a, 0, 1);
      } else {
        const bb = _d1.dot(_d2);
        const denom = a * e - bb * bb;
        s = denom > 1e-9 ? SL.clamp((bb * f - c * e) / denom, 0, 1) : 0;
        t = (bb * s + f) / e;

        if (t < 0) { t = 0; s = SL.clamp(-c / a, 0, 1); }
        else if (t > 1) { t = 1; s = SL.clamp((bb - c) / a, 0, 1); }
      }
    }

    _c1.copy(p1).addScaledVector(_d1, s);
    _c2.copy(p2).addScaledVector(_d2, t);
    return _c1.distanceTo(_c2);
  }

  class Player {
    constructor(game) {
      this.game = game;
      this.camera = game.camera;

      this.position = this.camera.position;
      this.velocity = new THREE.Vector3();
      this.yaw = 0;
      this.pitch = -0.35;

      this.maxHealth = 100;
      this.maxOxygen = 90;
      this.health = this.maxHealth;
      this.oxygen = this.maxOxygen;

      // Upgradeable by the fabricator - see crafting.js.
      this.knifeDamage = 28;
      this.knifeReach = 2.2;
      this.damageResist = 0;
      this.visionBonus = 0;
      this.lanternBuilt = false;
      this.invulnerable = false;
      this.dead = false;
      this.timeSinceDamage = 999;

      this.swimSpeed = 4.2;
      /** On dry land. Slower than swimming - you are carrying a tank. */
      this.walkSpeed = 3.4;
      this.sprintMultiplier = 1.85;
      this.sprinting = false;
      this.inWater = true;
      this.grounded = false;

      this.carriedScrap = null;

      // Scanning state, read by the HUD to draw the progress ring.
      this.scanTarget = null;
      this.scanProgress = 0;

      this.focusLabel = '';
      this.focusTimer = 0;

      // --- Held items, parented to the camera --------------------------------
      // A camera faces its own -Z, but geometry here is authored nose-forward
      // along +Z. Turning the hand around lets held items keep that convention.
      this.hand = new THREE.Object3D();
      this.hand.rotation.y = Math.PI;
      this.camera.add(this.hand);

      this.knife = new THREE.Mesh(buildKnife(), game.materials.surface);
      this.knife.scale.setScalar(0.72);
      this.knifeRest = new THREE.Vector3().fromArray(KNIFE_REST.pos);
      this.knife.position.copy(this.knifeRest);
      this.knife.rotation.fromArray(KNIFE_REST.rot);
      this.hand.add(this.knife);

      // --- The hacked candle, in the off hand --------------------------------
      //
      // It is carried the moment the hack is on, but it only ever catches in
      // the Deep Trench - which is the whole point of it. Everywhere else you
      // are holding an unlit stub.
      this.candleHack = false;
      this.candleLit = false;
      this.candleGlow = 0;

      this.candle = new THREE.Group();
      this.candle.position.set(0.32, -0.30, 0.60);
      this.candle.rotation.set(-0.16, 0.34, -0.10);
      this.candle.visible = false;
      this.hand.add(this.candle);

      this.candleWax = new THREE.Mesh(buildCandleWax(), game.materials.surface);
      this.candle.add(this.candleWax);

      // Upright out of the wick, which points along the stub's +Z.
      this.candleFlame = new THREE.Mesh(buildCandleFlame(), game.materials.glow);
      this.candleFlame.position.set(0, 0, 0.096);
      this.candleFlame.rotation.x = Math.PI / 2;
      this.candle.add(this.candleFlame);

      this.candleLight = new THREE.PointLight(0xffb257, 0, CANDLE_RANGE, 1.5);
      this.candleLight.position.set(0, 0, 0.12);
      this.candle.add(this.candleLight);

      this.carryPoint = new THREE.Object3D();
      this.carryPoint.position.set(0.34, -0.30, 0.75);
      this.hand.add(this.carryPoint);

      this.swingTime = 0;
      this.swingDuration = 0.48;
      this.strikeResolved = false;

      this.flashlight = new THREE.SpotLight(0xd9f2ff, 0, 45, 0.55, 0.45, 1.2);
      this.flashlight.position.set(0.1, -0.05, 0);
      this.flashlight.target.position.set(0, 0, -1);
      this.camera.add(this.flashlight);
      this.camera.add(this.flashlight.target);
      this.flashlightOn = false;

      this.respawn();
    }

    get depth() { return Math.max(0, SL.WATER_LEVEL - this.position.y); }
    get atSurface() { return this.position.y > SL.WATER_LEVEL - 0.9; }
    get biome() { return SL.Biomes.biomeAt(this.position.x, this.position.z); }

    /**
     * Back to a bare diver: base gear, full health and air. Called when a world
     * is entered, before that world's saved progress is applied over the top.
     */
    resetLoadout() {
      this.maxHealth = 100;
      this.maxOxygen = 90;
      this.knifeDamage = 28;
      this.knifeReach = 2.2;
      this.damageResist = 0;
      this.visionBonus = 0;
      this.lanternBuilt = false;
      this.invulnerable = false;
      this.swimSpeed = 4.2;
      this.walkSpeed = 3.4;
      this.swingDuration = 0.48;
      if (this.carriedScrap) { this.carriedScrap = null; }
      this.respawn();
    }

    respawn() {
      // Upgrades survive death; only health and air are restored.
      this.dead = false;
      this.health = this.maxHealth;
      this.oxygen = this.maxOxygen;
      this.timeSinceDamage = 999;
      this.velocity.set(0, 0, 0);
      this.position.set(0, SL.WATER_LEVEL - 1.2, 0);
      this.yaw = 0;
      this.pitch = -0.35;
      if (this.carriedScrap) { this.carriedScrap.drop(new THREE.Vector3()); this.carriedScrap = null; }
    }

    look(dx, dy) {
      if (this.dead) return;
      const sensitivity = 0.0022;
      this.yaw -= dx * sensitivity;
      this.pitch -= dy * sensitivity;
      this.pitch = SL.clamp(this.pitch, -1.5, 1.5);
    }

    hurt(damage, source) {
      // Nothing touches the diver while the game is not being played, and
      // nothing touches them at all once the cheat is in.
      if (this.dead || damage <= 0 || this.game.paused || this.invulnerable) return;

      damage *= (1 - this.damageResist);
      this.health -= damage;
      this.timeSinceDamage = 0;
      this.game.audio.playerHurt();
      this.game.hud.flashDamage();

      // Knocked back by the hit, which is what makes a stalker bite frightening.
      if (source && source.position) {
        _tmp.subVectors(this.position, source.position).normalize();
        this.velocity.addScaledVector(_tmp, 5.2);
        this.velocity.y += 0.6;
      }

      // A bitten diver drops whatever they were holding.
      if (this.carriedScrap) {
        this.carriedScrap.drop(new THREE.Vector3(0, -0.5, 0));
        this.carriedScrap = null;
      }

      if (this.health <= 0) { this.health = 0; this.die(); }
    }

    die() {
      if (this.dead) return;
      this.dead = true;
      this.sprinting = false;
      this.game.audio.death();
      if (this.carriedScrap) { this.carriedScrap.drop(new THREE.Vector3()); this.carriedScrap = null; }
    }

    swing() {
      if (this.dead || this.swingTime > 0) return;
      this.swingTime = this.swingDuration;
      this.strikeResolved = false;
      this.game.audio.swing();
    }

    /** Fired partway through the swing, once per swing. */
    resolveStrike() {
      this.camera.getWorldDirection(_forward);

      // The swing is a short segment running forward from the diver.
      const swingStart = _swingA.copy(this.position);
      const swingEnd = _swingB.copy(this.position).addScaledVector(_forward, this.knifeReach);

      let best = null;
      let bestDist = Infinity;

      const take = (target, distance, slack) => {
        if (distance > (target.radius || 0.1) + slack) return;
        if (distance < bestDist) { bestDist = distance; best = target; }
      };

      /**
       * A leviathan is eight to fifteen metres long, so treating a creature as
       * a point at its pivot makes everything but its middle unhittable. Each
       * creature is measured as the segment running nose to tail through its
       * body, and the swing as the segment in front of the diver: if those two
       * pass close enough, the blade connects - head, flank or tail.
       */
      const considerCreature = (creature) => {
        creature.object.getWorldDirection(_axis);
        const half = creature.bodyLength * 0.5;

        _bodyA.copy(creature.position).addScaledVector(_axis, -half);
        _bodyB.copy(creature.position).addScaledVector(_axis, half);

        take(creature, segmentDistance(swingStart, swingEnd, _bodyA, _bodyB), 0.35);
      };

      /** Scrap and crystals are small enough to stay points. */
      const considerPoint = (target) => {
        take(target, pointToSegment(target.position, swingStart, swingEnd), 0.55);
      };

      for (const c of this.game.fish) if (!c.dead) considerCreature(c);
      for (const c of this.game.stalkers) if (!c.dead) considerCreature(c);
      // Both leviathans were missing from this list, which is why neither of
      // them could be hurt at all.
      for (const c of this.game.kings) if (!c.dead) considerCreature(c);
      for (const c of this.game.whales) if (!c.dead) considerCreature(c);
      for (const c of this.game.puffers) if (!c.dead) considerCreature(c);
      for (const c of this.game.kelperLevs) if (!c.dead) considerCreature(c);
      for (const c of this.game.kelpers) if (!c.dead) considerCreature(c);
      for (const c of this.game.carnis) if (!c.dead) considerCreature(c);
      for (const c of this.game.glowLevs) if (!c.dead) considerCreature(c);
      for (const c of this.game.carniLevs) if (!c.dead) considerCreature(c);
      for (const c of this.game.crabers) if (!c.dead) considerCreature(c);

      for (const s of this.game.scrap) if (!s.dead && !s.isHeld) considerPoint(s);
      for (const c of this.game.crystals) if (!c.dead) considerPoint(c);
      for (const n of this.game.nests) if (!n.dead) considerPoint(n);

      // A vine is a standing stalk, so it is measured along its own height.
      for (const v of this.game.vines) {
        if (v.dead) continue;
        _bodyA.copy(v.position);
        _bodyB.copy(v.position).add(_up.set(0, v.standingHeight, 0));
        take(v, segmentDistance(swingStart, swingEnd, _bodyA, _bodyB), 0.3);
      }

      if (!best) { this.game.audio.swingMiss(); return; }

      if (best instanceof SL.Creature) {
        // Something that cannot be hurt is not a miss and not a hit - the blade
        // goes nowhere and the marker says which.
        if (best.immuneTo(this)) {
          best.hurt(this.knifeDamage, this);
          this.game.audio.swingMiss();
          this.game.hud.showHitMarker('Peaceful  ·  ' + best.species.name, false);
          return;
        }

        best.hurt(this.knifeDamage, this);
        this.game.audio.hit();
        this.game.hud.showHitMarker(best.species.name, best.dead);

        // Anything that can be provoked turns on whoever stabbed it. The whale
        // has no such response, and is meant not to.
        if (typeof best.provoke === 'function' && !best.dead) best.provoke(this);
      } else if (best instanceof SL.Vine) {
        const cut = best.bite(this.knifeDamage);
        this.game.hud.showHitMarker(cut ? 'Vine cut' : 'Vine', cut);
      } else if (best instanceof SL.Nest) {
        const wrecked = best.eggsLeft <= 1;
        best.bite();
        this.game.hud.showHitMarker(wrecked ? 'Nest wrecked' : 'Egg', wrecked);
      } else if (best instanceof SL.Crystal) {
        const broken = best.bite(this.knifeDamage);
        this.game.hud.showHitMarker(broken ? 'Crystal broken' : 'Crystal', broken);
      } else {
        best.bite(this.knifeDamage, _forward);
        this.game.audio.metalBite(0);
        this.game.hud.showHitMarker('Scrap Metal', false);
      }
    }

    /**
     * Holding the scan key on a creature catalogues it. Aim has to be held on
     * the same animal for the whole duration, which is why the fast ones are
     * harder to get than the dangerous ones.
     */
    updateScan(dt, scanning) {
      if (!scanning || this.dead || !SL.Crafting.built.scanner) {
        this.scanTarget = null;
        this.scanProgress = 0;
        return;
      }

      this.camera.getWorldDirection(_forward);
      let best = null;
      let bestDot = 0.975;

      const consider = (creature) => {
        _toTarget.subVectors(creature.position, this.position);
        if (_toTarget.length() > 16) return;
        const dot = _toTarget.normalize().dot(_forward);
        if (dot > bestDot) { bestDot = dot; best = creature; }
      };

      for (const c of this.game.fish) if (!c.dead) consider(c);
      for (const c of this.game.stalkers) if (!c.dead) consider(c);
      for (const c of this.game.kings) if (!c.dead) consider(c);
      for (const c of this.game.whales) if (!c.dead) consider(c);
      for (const c of this.game.puffers) if (!c.dead) consider(c);
      for (const c of this.game.kelperLevs) if (!c.dead) consider(c);
      for (const c of this.game.kelpers) if (!c.dead) consider(c);
      for (const c of this.game.carnis) if (!c.dead) consider(c);
      for (const c of this.game.glowLevs) if (!c.dead) consider(c);
      for (const c of this.game.carniLevs) if (!c.dead) consider(c);
      for (const c of this.game.crabers) if (!c.dead) consider(c);

      if (!best) { this.scanTarget = null; this.scanProgress = 0; return; }

      // Losing the target resets the hold.
      if (best !== this.scanTarget) {
        this.scanTarget = best;
        this.scanProgress = 0;
      }

      const wasWhole = Math.floor(this.scanProgress * 6);
      this.scanProgress += dt / 1.4;
      if (Math.floor(this.scanProgress * 6) !== wasWhole) this.game.audio.scanTick();

      if (this.scanProgress >= 1) {
        this.scanProgress = 0;
        const species = best.species;
        this.scanTarget = null;

        if (SL.Index.record(species.id)) {
          this.game.audio.scanDone();
          this.game.hud.toast(species.name + ' catalogued  ·  '
            + SL.Index.count + '/' + SL.Index.total);
        } else {
          this.game.hud.toast(species.name + ' — already catalogued');
        }
      }
    }

    /** Spends a medkit, if one is held and it would do anything. */
    useMedkit() {
      if (this.dead || this.health >= this.maxHealth) return;
      if (!SL.Crafting.consume('medkit')) {
        this.game.hud.toast('No medkits — build one at the fabricator');
        return;
      }

      this.health = Math.min(this.maxHealth, this.health + 55);
      this.game.audio.craft();
      this.game.hud.toast('Medkit used');
    }

    /** The lantern is a wider, longer-reaching lamp in place of the torch. */
    upgradeLight() {
      this.flashlight.distance = 90;
      this.flashlight.angle = 0.95;
      this.flashlight.penumbra = 0.6;
      this.flashlight.color.setHex(0xfff0cc);
      if (this.flashlightOn) this.flashlight.intensity = this.lightPower;
    }

    // The lantern's advantage is reach and spread, not raw brightness - pushing
    // intensity instead blows the sea floor out to white.
    get lightPower() { return this.lanternBuilt ? 2.9 : 2.6; }

    /**
     * Turns the hacked candle on or off. Returns what to tell the diver, since
     * the only thing that calls this is a cheat code.
     */
    toggleCandle() {
      this.candleHack = !this.candleHack;
      this.candle.visible = this.candleHack;
      if (!this.candleHack) {
        this.candleLit = false;
        this.candleGlow = 0;
        this.candleLight.intensity = 0;
      }
      return this.candleHack;
    }

    /**
     * The flame only catches in the Deep Trench, and gutters out on the way
     * over the lip of it. Everything else it does follows from candleGlow, so
     * the light, the flame and the fog all fade together rather than snapping.
     */
    updateCandle(dt) {
      if (!this.candleHack) return;

      const biome = this.biome;
      this.candleLit = !this.dead
        && !!biome && biome.id === CANDLE_BIOME
        && this.depth > 0.6;

      this.candleGlow = SL.damp(this.candleGlow, this.candleLit ? 1 : 0, 2.4, dt);

      // Two detuned sines, which reads as a flame rather than as a sine.
      const t = this.game.time;
      const flicker = 1 + Math.sin(t * 11.3) * 0.09 + Math.sin(t * 23.7) * 0.05;

      this.candleLight.intensity = this.candleGlow * CANDLE_POWER * flicker;
      this.candleFlame.visible = this.candleGlow > 0.02;
      this.candleFlame.scale.set(
        this.candleGlow * (0.9 + flicker * 0.12),
        this.candleGlow * flicker,
        this.candleGlow * (0.9 + flicker * 0.12));
    }

    toggleFlashlight() {
      this.flashlightOn = !this.flashlightOn;
      this.flashlight.intensity = this.flashlightOn ? this.lightPower : 0;
      this.game.audio.click();
    }

    /** Plants a beacon on the sea floor below. */
    dropBeacon() {
      if (this.dead) return;
      if (!SL.Crafting.consume('beacon')) {
        this.game.hud.toast('No beacons — build one at the fabricator');
        return;
      }
      this.game.beacons.push(new SL.Beacon(this.game, this.position.clone()));
      this.game.audio.pickUp();
      this.game.hud.toast('Beacon planted');
    }

    /**
     * A bait pod is scrap laced with something stalkers cannot ignore: it lands
     * as an ordinary piece of salvage, already making as much noise as a piece
     * being chewed, which is exactly what pulls them off you.
     */
    throwBait() {
      if (this.dead) return;
      if (!SL.Crafting.consume('bait')) {
        this.game.hud.toast('No bait pods — build one at the fabricator');
        return;
      }

      this.camera.getWorldDirection(_forward);
      const landing = this.position.clone().addScaledVector(_forward, 14);
      const scrap = new SL.Scrap(this.game, landing.x, landing.z, (SL.random() * 1e9) | 0);
      scrap.disturbance = 2;
      this.game.scrap.push(scrap);

      this.game.audio.throwScrap();
      this.game.hud.toast('Bait pod thrown');
    }

    /** Drives nearby stalkers off. Does nothing to a leviathan. */
    useRepel() {
      if (this.dead) return;
      if (!SL.Crafting.consume('repel')) {
        this.game.hud.toast('No repel charges — build one at the fabricator');
        return;
      }

      let scared = 0;
      for (const stalker of this.game.stalkers) {
        if (stalker.dead || stalker.position.distanceTo(this.position) > 25) continue;
        stalker.threat = this;
        stalker.aggro = 0;
        stalker.enterState('retreat');
        scared++;
      }

      this.game.audio.crystal();
      this.game.hud.toast(scared ? 'Repelled ' + scared + ' stalker' + (scared === 1 ? '' : 's')
        : 'Charge spent — nothing close enough');
    }

    updateOxygen(dt) {
      if (this.invulnerable) { this.oxygen = this.maxOxygen; return; }

      if (this.atSurface) {
        // Breaking the surface refills fast - the surface is always safety.
        this.oxygen = Math.min(this.maxOxygen, this.oxygen + dt * 28);
        return;
      }

      let drain = dt;
      if (this.sprinting && this.velocity.lengthSq() > 1) drain += dt * 0.8;
      this.oxygen = Math.max(0, this.oxygen - drain);

      if (this.oxygen <= 0) {
        this.health -= 9 * dt;
        this.timeSinceDamage = 0;
        if (this.health <= 0) { this.health = 0; this.die(); }
      }
    }

    /** What the crosshair is over, for the HUD. */
    updateFocus() {
      this.camera.getWorldDirection(_forward);
      this.focusLabel = '';
      let bestDot = 0.985;

      const consider = (label, position, range) => {
        _toTarget.subVectors(position, this.position);
        if (_toTarget.length() > range) return;
        const dot = _toTarget.normalize().dot(_forward);
        if (dot > bestDot) { bestDot = dot; this.focusLabel = label; }
      };

      for (const c of this.game.fish) if (!c.dead) consider(c.species.name, c.position, 14);
      for (const c of this.game.stalkers) if (!c.dead) consider(c.species.name, c.position, 22);
      for (const c of this.game.kings) if (!c.dead) consider(c.species.name, c.position, 40);
      for (const c of this.game.whales) if (!c.dead) consider(c.species.name, c.position, 60);
      for (const c of this.game.puffers) if (!c.dead) consider(c.species.name, c.position, 34);
      for (const c of this.game.kelperLevs) if (!c.dead) consider(c.species.name, c.position, 44);
      for (const c of this.game.kelpers) {
        if (!c.dead) consider(c.stolen ? 'Kelper   carrying your gear' : c.species.name, c.position, 20);
      }
      for (const c of this.game.carnis) if (!c.dead) consider(c.species.name, c.position, 30);
      for (const c of this.game.glowLevs) if (!c.dead) consider(c.species.name, c.position, 60);
      for (const c of this.game.carniLevs) if (!c.dead) consider(c.species.name, c.position, 50);
      for (const c of this.game.crabers) if (!c.dead) consider(c.species.name, c.position, 12);
      for (const n of this.game.nests) {
        consider(n.species.name + ' nest', n.position, 10);
      }
      for (const c of this.game.crystals) {
        if (!c.dead) consider('Crystal   [knife] for quartz', c.position, 12);
      }
      for (const s of this.game.scrap) {
        if (s.dead || s.isHeld) continue;
        const label = s.position.distanceTo(this.position) < 3.2 ? 'Scrap Metal   [E] pick up' : 'Scrap Metal';
        consider(label, s.position, 12);
      }
    }

    update(dt, input) {
      this.timeSinceDamage += dt;

      // Camera orientation from yaw/pitch.
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotateY(this.yaw);
      this.camera.rotateX(this.pitch);

      if (this.dead) {
        // Sink gently while dead.
        this.velocity.lerp(_tmp.set(0, -0.6, 0), 1 - Math.exp(-dt));
        this.position.addScaledVector(this.velocity, dt);
        this.clampToWorld();
        return;
      }

      this.camera.getWorldDirection(_forward);
      _right.set(_forward.z, 0, -_forward.x).normalize();

      // Head above the waterline is a different world: no water to swim
      // against, and something pulling you down.
      const ground = SL.Biomes.floorHeightAt(this.position.x, this.position.z) + 0.55;
      this.inWater = this.position.y < SL.WATER_LEVEL;
      this.grounded = !this.inWater && this.position.y <= ground + 0.08;

      if (this.inWater) {
        // --- Swim where you look ----------------------------------------------
        _tmp.set(0, 0, 0);
        if (input.forward) _tmp.add(_forward);
        if (input.back) _tmp.sub(_forward);
        if (input.right) _tmp.sub(_right);
        if (input.left) _tmp.add(_right);
        if (input.up) _tmp.y += 1;
        if (input.down) _tmp.y -= 1;

        this.sprinting = input.sprint && _tmp.lengthSq() > 0;
        const speed = this.swimSpeed * (this.sprinting ? this.sprintMultiplier : 1);

        if (_tmp.lengthSq() > 0) _tmp.normalize().multiplyScalar(speed);

        // Water: quick to get going, quick to stop. No inertia slides.
        this.velocity.lerp(_tmp, 1 - Math.exp(-6 * dt));
      } else {
        // --- Out of the water --------------------------------------------------
        //
        // Steering is flattened, because looking at your feet should not drive
        // you into them, and the vertical axis belongs to gravity now. Over the
        // island that means you walk; over open sea it means you fall back in,
        // which is exactly what should happen to someone who swam upwards.
        _flat.copy(_forward).setY(0);
        if (_flat.lengthSq() < 1e-6) _flat.set(0, 0, 1);
        _flat.normalize();

        _tmp.set(0, 0, 0);
        if (input.forward) _tmp.add(_flat);
        if (input.back) _tmp.sub(_flat);
        if (input.right) _tmp.sub(_right);
        if (input.left) _tmp.add(_right);
        _tmp.y = 0;

        this.sprinting = input.sprint && _tmp.lengthSq() > 0;
        const speed = this.walkSpeed * (this.sprinting ? this.sprintMultiplier : 1);
        if (_tmp.lengthSq() > 0) _tmp.normalize().multiplyScalar(speed);

        // Horizontal control only; far less of it in mid-air than on your feet.
        const grip = this.grounded ? 9 : 1.6;
        this.velocity.x = SL.lerp(this.velocity.x, _tmp.x, 1 - Math.exp(-grip * dt));
        this.velocity.z = SL.lerp(this.velocity.z, _tmp.z, 1 - Math.exp(-grip * dt));

        this.velocity.y -= GRAVITY * dt;

        if (this.grounded) {
          if (this.velocity.y < 0) this.velocity.y = 0;
          if (input.up) this.velocity.y = JUMP_SPEED;
        }
      }
      this.position.addScaledVector(this.velocity, dt);

      this.pushOutOfCreatures(dt);
      this.clampToWorld();
      this.updateOxygen(dt);

      // Slow recovery once nothing has bitten you for a while. Without medkits
      // in the game, the alternative is a one-way trip.
      if (this.timeSinceDamage > 18 && this.health < this.maxHealth && this.oxygen > 0) {
        this.health = Math.min(this.maxHealth, this.health + 2.5 * dt);
      }

      this.updateScan(dt, input.scan);

      this.focusTimer -= dt;
      if (this.focusTimer <= 0) { this.focusTimer = 0.12; this.updateFocus(); }

      this.updateKnife(dt);
      this.updateCandle(dt);
    }

    /**
     * Creatures are solid.
     *
     * Both sides are pushed apart, with the share decided by size: a leviathan
     * barely notices and the diver bounces off it, while a shrimp is the one
     * that gets shoved. That one rule covers everything from krill to a
     * fifteen-metre whale without a shrimp behaving like a wall.
     *
     * Bodies are treated as capsules around the nose-to-tail spine, so you
     * collide with the length of an animal rather than a ball at its middle.
     */
    pushOutOfCreatures(dt) {
      const DIVER_RADIUS = 0.5;
      const DIVER_MASS = 3;

      const resolve = (creature) => {
        if (creature.dead) return;

        const reach = creature.bodyLength * 0.5 + creature.radius + DIVER_RADIUS;
        if (creature.position.distanceToSquared(this.position) > reach * reach) return;

        creature.object.getWorldDirection(_axis);
        const half = creature.bodyLength * 0.5;
        _bodyA.copy(creature.position).addScaledVector(_axis, -half);
        _bodyB.copy(creature.position).addScaledVector(_axis, half);

        // Closest point on the creature's spine to the diver.
        _d1.subVectors(_bodyB, _bodyA);
        const lengthSq = _d1.lengthSq() || 1;
        const t = SL.clamp(_r.subVectors(this.position, _bodyA).dot(_d1) / lengthSq, 0, 1);
        _c1.copy(_bodyA).addScaledVector(_d1, t);

        const minimum = (creature.radius || 0.2) + DIVER_RADIUS;
        _normal.subVectors(this.position, _c1);
        const distance = _normal.length();
        const overlap = minimum - distance;
        if (overlap <= 0) return;

        // Straight through the middle: pick any sideways direction.
        if (distance < 1e-4) _normal.set(1, 0, 0); else _normal.divideScalar(distance);

        const creatureMass = Math.max(0.05, creature.bodyLength * creature.bodyLength);
        const diverShare = creatureMass / (creatureMass + DIVER_MASS);

        this.position.addScaledVector(_normal, overlap * diverShare);
        creature.object.position.addScaledVector(_normal, -overlap * (1 - diverShare));

        // Stop swimming into it, and let it know it was bumped.
        const closing = this.velocity.dot(_normal);
        if (closing < 0) this.velocity.addScaledVector(_normal, -closing);
        if (typeof creature.startle === 'function') creature.startle(this.position, 2.5);
      };

      for (const c of this.game.fish) resolve(c);
      for (const c of this.game.stalkers) resolve(c);
      for (const c of this.game.kings) resolve(c);
      for (const c of this.game.whales) resolve(c);
      for (const c of this.game.puffers) resolve(c);
      for (const c of this.game.kelperLevs) resolve(c);
      for (const c of this.game.kelpers) resolve(c);
      for (const c of this.game.carnis) resolve(c);
      for (const c of this.game.glowLevs) resolve(c);
      for (const c of this.game.carniLevs) resolve(c);
      for (const c of this.game.crabers) resolve(c);

      this.pushOutOfVines();
    }

    /**
     * Vines are immovable standing stalks, so they get their own resolution: a
     * horizontal push out of a vertical cylinder, only while the diver is
     * actually within the vine's height. This is what makes the cage a cage.
     */
    /**
     * Vines are immovable standing stalks, and the cage only works if you
     * cannot ooze between two of them.
     *
     * Resolving overlap after the fact is not enough: pushing clear of one
     * stalk shoves the diver towards its neighbour, and a few passes of that
     * walks them straight out through a gap narrower than they are. So the
     * *movement* is tested instead - if the path taken this frame passes within
     * a stalk, the diver is put back where they started. Overlap resolution is
     * still there for the case that matters most, a cage thrown up around
     * someone already standing there.
     */
    pushOutOfVines() {
      const DIVER_RADIUS = 0.5;
      const vines = this.game.vines;

      if (!vines.length) { this._prevXZ = null; return; }

      const x = this.position.x;
      const z = this.position.z;
      const prev = this._prevXZ;

      if (prev && !this.overlapsVineAt(prev.x, prev.z, DIVER_RADIUS)) {
        for (const vine of vines) {
          if (vine.dead || !this.withinVineHeight(vine)) continue;

          const minimum = vine.radius + DIVER_RADIUS;
          if (pathDistance2D(prev.x, prev.z, x, z, vine.position.x, vine.position.z) >= minimum) continue;

          // Blocked: stay where you were, and stop swimming into it.
          this.position.x = prev.x;
          this.position.z = prev.z;

          _normal.set(prev.x - vine.position.x, 0, prev.z - vine.position.z).normalize();
          const closing = this.velocity.dot(_normal);
          if (closing < 0) this.velocity.addScaledVector(_normal, -closing);
          break;
        }
      }

      // Still inside one? Then it grew around us - push clear.
      for (let pass = 0; pass < 3; pass++) this.resolveVinePass(DIVER_RADIUS);

      this._prevXZ = { x: this.position.x, z: this.position.z };
    }

    overlapsVineAt(x, z, DIVER_RADIUS) {
      for (const vine of this.game.vines) {
        if (vine.dead || !this.withinVineHeight(vine)) continue;
        if (Math.hypot(x - vine.position.x, z - vine.position.z) < vine.radius + DIVER_RADIUS) return true;
      }
      return false;
    }

    withinVineHeight(vine) {
      const top = vine.position.y + vine.standingHeight;
      return this.position.y >= vine.position.y - 0.6 && this.position.y <= top + 0.4;
    }

    resolveVinePass(DIVER_RADIUS) {
      for (const vine of this.game.vines) {
        if (vine.dead || !this.withinVineHeight(vine)) continue;

        const dx = this.position.x - vine.position.x;
        const dz = this.position.z - vine.position.z;
        const distance = Math.hypot(dx, dz);
        const minimum = vine.radius + DIVER_RADIUS;
        if (distance > minimum || distance < 1e-4) {
          if (distance < 1e-4) this.position.x += minimum;
          continue;
        }

        const push = (minimum - distance) / distance;
        this.position.x += dx * push;
        this.position.z += dz * push;
      }
    }

    clampToWorld() {
      const p = this.position;

      // The sea floor is solid.
      const floor = SL.Biomes.floorHeightAt(p.x, p.z) + 0.55;
      if (p.y < floor) { p.y = floor; if (this.velocity.y < 0) this.velocity.y = 0; }

      // The surface is no longer a ceiling. You can put your head out, and
      // where there is ground above the waterline you can climb out onto it -
      // gravity in update() is what brings you back down everywhere else.

      // A soft wall at the edge of the world.
      const distance = Math.hypot(p.x, p.z);
      const limit = SL.WORLD_RADIUS + 8;
      if (distance > limit) {
        p.x *= limit / distance;
        p.z *= limit / distance;
      }
    }

    updateKnife(dt) {
      if (this.swingTime <= 0) {
        // Idle bob, so the knife feels held rather than welded to the camera.
        const t = this.game.time;
        this.knife.position.lerp(_tmp.copy(this.knifeRest).add(
          _toTarget.set(Math.sin(t * 1.3) * 0.006, Math.sin(t * 1.9) * 0.008, 0)), 1 - Math.exp(-6 * dt));
        this.knife.rotation.x = SL.damp(this.knife.rotation.x, KNIFE_REST.rot[0], 8, dt);
        this.knife.rotation.y = SL.damp(this.knife.rotation.y, KNIFE_REST.rot[1], 8, dt);
        this.knife.rotation.z = SL.damp(this.knife.rotation.z, KNIFE_REST.rot[2], 8, dt);
        return;
      }

      this.swingTime = Math.max(0, this.swingTime - dt);
      const alpha = SL.clamp(1 - this.swingTime / this.swingDuration, 0, 1);

      if (alpha < WINDUP_END) {
        // Cocking back: quick off the grip, easing as the arm loads.
        const t = alpha / WINDUP_END;
        poseKnife(this.knife, KNIFE_REST, KNIFE_WIND, 1 - (1 - t) * (1 - t));
      } else if (alpha < CUT_END) {
        // The cut: slow off the shoulder, fastest through the middle.
        const t = (alpha - WINDUP_END) / (CUT_END - WINDUP_END);
        poseKnife(this.knife, KNIFE_WIND, KNIFE_CUT, SL.smoothstep(t));

        // A wrist roll laid over the sweep, so the edge leads the whole way
        // instead of the blade travelling flat-on through the water.
        this.knife.rotation.z -= Math.sin(t * Math.PI) * 0.55;
      } else {
        // Recovery. The old swing had none - it froze at full extension for the
        // last third and then let the idle bob snap the knife home, which is
        // what made the animation read as broken.
        const t = (alpha - CUT_END) / (1 - CUT_END);
        poseKnife(this.knife, KNIFE_CUT, KNIFE_REST, SL.smoothstep(t));
      }

      // The blade connects as the edge crosses in front of the diver.
      if (!this.strikeResolved && alpha >= CONTACT) {
        this.strikeResolved = true;
        this.resolveStrike();
      }
    }
  }

  SL.Player = Player;
})(window.SL);
