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

  // Base knife stats. These live on the player rather than as constants because
  // the fabricator upgrades them in place.
  const KNIFE_ARC = Math.cos(THREE.MathUtils.degToRad(45));

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
      this.dead = false;
      this.timeSinceDamage = 999;

      this.swimSpeed = 4.2;
      this.sprintMultiplier = 1.85;
      this.sprinting = false;

      this.carriedScrap = null;
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
      this.knifeRest = new THREE.Vector3(-0.30, -0.26, 0.52);
      this.knife.position.copy(this.knifeRest);
      this.knife.rotation.set(-0.2, -0.3, 0.1);
      this.hand.add(this.knife);

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
      this.swimSpeed = 4.2;
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
      // Nothing touches the diver while the game is not being played.
      if (this.dead || damage <= 0 || this.game.paused) return;

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
      let best = null, bestDist = this.knifeReach;

      const consider = (target, position) => {
        _toTarget.subVectors(position, this.position);
        const distance = _toTarget.length() - (target.radius || 0.1);
        if (distance > bestDist || distance < -1) return;
        // Must be roughly under the crosshair, not merely nearby.
        if (_toTarget.normalize().dot(_forward) < KNIFE_ARC) return;
        bestDist = Math.max(0, distance);
        best = target;
      };

      for (const c of this.game.fish) if (!c.dead) consider(c, c.position);
      for (const c of this.game.stalkers) if (!c.dead) consider(c, c.position);
      for (const s of this.game.scrap) if (!s.dead && !s.isHeld) consider(s, s.position);

      if (!best) { this.game.audio.swingMiss(); return; }

      if (best instanceof SL.Creature) {
        best.hurt(this.knifeDamage, this);
        this.game.audio.hit();
        this.game.hud.showHitMarker(best.species.name, best.dead);
        // A stabbed stalker turns on you rather than shrugging it off.
        if (best instanceof SL.Stalker && !best.dead) best.provoke(this);
      } else {
        best.bite(this.knifeDamage, _forward);
        this.game.audio.metalBite(0);
        this.game.hud.showHitMarker('Scrap Metal', false);
      }
    }

    /** Pick up the nearest scrap, or throw what we are holding. */
    interact() {
      if (this.dead) return;

      if (this.carriedScrap) {
        this.camera.getWorldDirection(_forward);
        _tmp.copy(_forward).multiplyScalar(9).add(_right.set(0, 1.2, 0));
        this.carriedScrap.drop(_tmp.clone());
        this.carriedScrap = null;
        this.game.audio.throwScrap();
        return;
      }

      const nearby = SL.Scrap.findNearest(this.game, this.position, 3.2);
      if (nearby) {
        nearby.carriedBy(this, this.carryPoint, new THREE.Vector3(0, 0, 0));
        this.carriedScrap = nearby;
        this.game.audio.pickUp();
      }
    }

    toggleFlashlight() {
      this.flashlightOn = !this.flashlightOn;
      this.flashlight.intensity = this.flashlightOn ? 2.6 : 0;
      this.game.audio.click();
    }

    updateOxygen(dt) {
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

      // --- Swim where you look ------------------------------------------------
      this.camera.getWorldDirection(_forward);
      _right.set(_forward.z, 0, -_forward.x).normalize();

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
      this.position.addScaledVector(this.velocity, dt);

      this.clampToWorld();
      this.updateOxygen(dt);

      // Slow recovery once nothing has bitten you for a while. Without medkits
      // in the game, the alternative is a one-way trip.
      if (this.timeSinceDamage > 18 && this.health < this.maxHealth && this.oxygen > 0) {
        this.health = Math.min(this.maxHealth, this.health + 2.5 * dt);
      }

      this.focusTimer -= dt;
      if (this.focusTimer <= 0) { this.focusTimer = 0.12; this.updateFocus(); }

      this.updateKnife(dt);
    }

    clampToWorld() {
      const p = this.position;

      // The sea floor is solid.
      const floor = SL.Biomes.floorHeightAt(p.x, p.z) + 0.55;
      if (p.y < floor) { p.y = floor; if (this.velocity.y < 0) this.velocity.y = 0; }

      // You can break the surface but not leave the water.
      if (p.y > SL.WATER_LEVEL) {
        p.y = SL.WATER_LEVEL;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }

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
        this.knife.rotation.x = SL.damp(this.knife.rotation.x, -0.2, 8, dt);
        this.knife.rotation.y = SL.damp(this.knife.rotation.y, -0.3, 8, dt);
        this.knife.rotation.z = SL.damp(this.knife.rotation.z, 0.1, 8, dt);
        return;
      }

      this.swingTime = Math.max(0, this.swingTime - dt);
      const alpha = 1 - this.swingTime / this.swingDuration;

      // Wind up across the first third, slash through the middle, recover after.
      const arc = SL.clamp(alpha < 0.3
        ? SL.lerp(0, -1, alpha / 0.3)
        : SL.lerp(-1, 1, (alpha - 0.3) / 0.35), -1, 1);

      this.knife.position.set(
        this.knifeRest.x - arc * 0.30,
        this.knifeRest.y + Math.abs(arc) * 0.10,
        this.knifeRest.z + arc * 0.08);
      this.knife.rotation.set(-0.2 + arc * 0.5, -0.3 + arc * 0.9, 0.1 - arc * 0.8);

      // The blade connects partway through the slash.
      if (!this.strikeResolved && alpha >= 0.42) {
        this.strikeResolved = true;
        this.resolveStrike();
      }
    }
  }

  SL.Player = Player;
})(window.SL);
