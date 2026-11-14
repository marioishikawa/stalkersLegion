/**
 * The mech: a walking diving suit you build at the wreck.
 *
 * The lit console at the bow of the wreck is its deployer. Bring it thirty
 * titanium, five quartz and a gold, and a minute later it has put the mech
 * together and walked it out onto the charging pad outside the breach.
 *
 * It walks. It cannot swim - it is far too heavy - but on the sea floor it is
 * quicker than any pair of fins. It carries 500 seconds of air of its own;
 * when that runs out you hold R for ten seconds to refill it. It runs on a
 * battery that walking and shooting drain, and a flat mech goes nowhere: get
 * out, tie a rope to it (T) and tow it back to the pad, or shove it there by
 * swimming into it. On the pad it charges.
 *
 * Its one weapon is a laser on the arm - click, or hold Q - which does very
 * little damage per second but never needs to get close.
 */
(function (SL) {
  'use strict';

  const COST = { titanium: 30, quartz: 5, gold: 1 };
  /** How long the deployer takes to put one together, in seconds. */
  const BUILD_TIME = 60;
  const MAX_AIR = 500;
  const REFILL_HOLD = 10;
  const EYE = 2.3;
  const WALK = 9;
  const SPRINT = 1.6;
  const LASER_RANGE = 28;
  /** Damage per tick and ticks per second: eight a second, which is not much. */
  const LASER_HIT = 2, LASER_TICK = 0.25;
  const ROPE = 5;

  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _tmp = new THREE.Vector3();
  const _to = new THREE.Vector3();

  function ground(x, z) {
    return SL.Terrain ? SL.Terrain.surfaceAt(x, z) : SL.Biomes.floorHeightAt(x, z);
  }

  function costLine() {
    return Object.keys(COST).map((k) => COST[k] + ' ' + k).join(' · ');
  }

  const Mech = {
    built: false,
    /** Seconds left on the build, while the deployer is working; 0 otherwise. */
    building: 0,
    piloting: false,
    towing: false,
    battery: 100,
    air: MAX_AIR,
    refillHold: 0,
    position: new THREE.Vector3(),
    heading: 0,
    hop: 0,
    hopSpeed: 0,
    walkPhase: 0,
    laserTimer: 0,
    pulse: 0,
    flatWarned: false,
    airWarned: false,
    charging: false,

    // --- Setting up, per world --------------------------------------------------

    /** Builds the pad and the (hidden) mech for a fresh world. */
    setup(game) {
      this.game = game;
      this.built = false;
      this.building = 0;
      this.piloting = false;
      this.towing = false;
      this.battery = 100;
      this.air = MAX_AIR;
      this.refillHold = 0;
      this.pulse = 0;
      // A new world always starts on foot, knife in hand.
      if (game.player && game.player.knife) game.player.knife.visible = true;
      if (!SL.Wreck) return;

      this.pad = SL.Wreck.padPoint();
      this.console = SL.Wreck.consolePoint();
      this.position.copy(this.pad);
      this.heading = Math.atan2(this.console.x - this.pad.x, this.console.z - this.pad.z) + Math.PI;

      this.buildPad(game);
      this.buildBody(game);
      this.buildRope(game);
      this.buildBeam(game);
      this.buildGun(game);
      this.place();
    },

    buildPad(game) {
      const g = new THREE.Group();
      const dark = new THREE.MeshLambertMaterial({ color: 0x2e3436 });
      const yellow = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
      const disk = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.25, 24), dark);
      disk.position.y = 0.05;
      g.add(disk);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.08, 6, 32), yellow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.2;
      g.add(ring);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.2, 0.25), dark);
      post.position.set(2.7, 1.1, 0);
      g.add(post);
      this.padLamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0x3fe0a0 }));
      this.padLamp.position.set(2.7, 2.3, 0);
      g.add(this.padLamp);
      g.position.copy(this.pad);
      game.addToWorld(g);
    },

    buildBody(game) {
      const paint = new THREE.MeshLambertMaterial({ color: 0xd08a2a });
      const steel = new THREE.MeshLambertMaterial({ color: 0x4a5257 });
      const glass = new THREE.MeshLambertMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0.45 });
      const g = new THREE.Group();

      // Two legs, each a thigh and a shin on a knee, hung from the hips.
      this.legs = [];
      for (const side of [1, -1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.5, 1.3, 0);
        const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.7, 0.36), steel);
        thigh.position.y = -0.35;
        hip.add(thigh);
        const knee = new THREE.Group();
        knee.position.y = -0.7;
        const shin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.6, 0.32), paint);
        shin.position.y = -0.3;
        knee.add(shin);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.62), steel);
        foot.position.set(0, -0.6, 0.1);
        knee.add(foot);
        hip.add(knee);
        g.add(hip);
        this.legs.push({ hip, knee, side });
      }

      // The body, with a glass dome for a cockpit and a laser on the right arm.
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 1.2), paint);
      body.position.y = 1.75;
      g.add(body);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
      dome.position.set(0, 2.2, 0.1);
      g.add(dome);
      const pack = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.4), steel);
      pack.position.set(0, 1.85, -0.75);
      g.add(pack);
      for (const side of [1, -1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.9), steel);
        arm.position.set(side * 0.92, 1.65, 0.25);
        g.add(arm);
      }
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.8, 8), steel);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(-0.92, 1.65, 0.9);
      g.add(barrel);

      // A light on top that shows the charge: green, amber, red.
      this.lampMat = new THREE.MeshBasicMaterial({ color: 0x40e070 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.lampMat);
      lamp.position.set(0.45, 2.25, -0.4);
      g.add(lamp);

      g.visible = false;
      game.addToWorld(g);
      this.group = g;
    },

    buildRope(game) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8c49a }));
      this.rope.frustumCulled = false;
      this.rope.visible = false;
      game.addToWorld(this.rope);
    },

    buildBeam(game) {
      const geo = new THREE.CylinderGeometry(0.04, 0.04, 1, 6, 1, true);
      geo.translate(0, 0.5, 0);
      geo.rotateX(Math.PI / 2);                // along +Z, from 0 to 1
      this.beam = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xff4a30, transparent: true, opacity: 0.85, depthWrite: false }));
      this.beam.frustumCulled = false;
      this.beam.visible = false;
      game.addToWorld(this.beam);
    },

    /** The laser as you see it from the cockpit, held where the knife was. */
    buildGun(game) {
      const p = game.player;
      if (!p || !p.hand) return;
      if (p.mechGun) p.hand.remove(p.mechGun);
      const steel = new THREE.MeshLambertMaterial({ color: 0x4a5257 });
      const g = new THREE.Group();
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.18, 8), steel);
      barrel.rotation.x = Math.PI / 2;
      g.add(barrel);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff6a40 }));
      tip.position.z = 0.095;
      g.add(tip);
      // The hand is turned round: its -X is the camera's right.
      g.position.set(-0.2, -0.2, 0.72);
      g.visible = false;
      p.hand.add(g);
      p.mechGun = g;
    },

    // --- Saving ---------------------------------------------------------------------

    capture() {
      if (this.building > 0) return { building: this.building };
      if (!this.built) return null;
      return { x: this.position.x, z: this.position.z, heading: this.heading,
        battery: this.battery, air: this.air };
    },

    restore(data) {
      if (!data || !this.group) return;
      if (data.building) { this.building = data.building; return; }
      this.built = true;
      this.position.set(data.x, ground(data.x, data.z), data.z);
      this.heading = data.heading || 0;
      this.battery = SL.clamp(data.battery === undefined ? 100 : data.battery, 0, 100);
      this.air = SL.clamp(data.air === undefined ? MAX_AIR : data.air, 0, MAX_AIR);
      this.group.visible = true;
      this.place();
    },

    // --- What the diver can do with it --------------------------------------------------

    nearConsole(p) {
      return this.console && p.position.distanceTo(this.console) < 3;
    },

    nearMech(p) {
      if (!this.built || this.piloting) return false;
      const dx = p.position.x - this.position.x, dz = p.position.z - this.position.z;
      const dy = p.position.y - this.position.y;
      return dx * dx + dz * dz < 4.2 * 4.2 && dy > -1 && dy < 4.5;
    },

    /** The line of help for the HUD, or null. */
    prompt(p) {
      if (p.dead || !this.game) return null;
      if (this.nearConsole(p)) {
        if (this.building > 0) return 'Mech deployer · building the mech · ' + Math.ceil(this.building) + 's';
        return this.built ? 'Mech deployer · your mech is out on the charging pad'
          : '[E] build the mech · ' + costLine() + ' · takes 1 minute';
      }
      if (this.nearMech(p)) return '[E] climb in   ·   [T] ' + (this.towing ? 'untie the rope' : 'tie a rope to it');
      if (this.towing) return 'Towing the mech · [T] untie the rope';
      return null;
    },

    /** The cockpit readout, while you are in it. */
    status() {
      if (!this.piloting) return null;
      let line = 'Mech · battery ' + Math.round(this.battery) + '% · air ' + Math.ceil(this.air) + 's';
      if (this.refillHold > 0) line += ' · refilling ' + this.refillHold.toFixed(1) + '/' + REFILL_HOLD + 's';
      else if (this.air < MAX_AIR) line += ' · hold R refill';
      if (this.charging) line += ' · charging';
      return line + ' · Q laser · E out';
    },

    /** E. Returns true if it used the key. */
    interact(p) {
      if (!this.game || p.dead) return false;
      if (this.piloting) { this.exit(p); return true; }
      if (p.carriedScrap) return false;

      if (this.nearConsole(p)) {
        if (this.built) { this.game.hud.toast('Your mech is out on the charging pad'); return true; }
        if (this.building > 0) {
          this.game.hud.toast('Still building — ' + Math.ceil(this.building) + ' seconds to go');
          return true;
        }
        const inv = SL.Crafting.inventory;
        const short = Object.keys(COST).filter((k) => (inv[k] || 0) < COST[k]);
        if (short.length) {
          this.game.hud.toast('The mech needs ' + costLine() + ' — short of ' + short.join(', '));
          return true;
        }
        for (const k of Object.keys(COST)) inv[k] -= COST[k];
        this.building = BUILD_TIME;
        this.game.audio.craft();
        this.game.hud.toast('The deployer is building your mech — one minute');
        if (this.game.hud.refreshFabricator) this.game.hud.refreshFabricator();
        return true;
      }

      if (this.nearMech(p)) { this.enter(p); return true; }
      return false;
    },

    /** T: tie a rope to it, or untie it. */
    toggleRope(p) {
      if (!this.built || this.piloting || p.dead) return;
      if (this.towing) {
        this.towing = false;
        this.game.hud.toast('Rope untied');
        return;
      }
      if (!this.nearMech(p)) { this.game.hud.toast('Get closer to the mech to tie a rope to it'); return; }
      this.towing = true;
      this.game.hud.toast('Rope tied — swim and the mech follows');
    },

    enter(p) {
      this.piloting = true;
      this.towing = false;
      this.group.visible = false;
      p.position.set(this.position.x, this.position.y + EYE, this.position.z);
      p.velocity.set(0, 0, 0);
      p.yaw = this.heading + Math.PI;
      if (p.knife) p.knife.visible = false;
      if (p.mechGun) p.mechGun.visible = true;
      this.game.hud.toast(this.battery <= 0 ? 'The battery is flat — it will not move' : 'In the mech');
    },

    exit(p) {
      this.piloting = false;
      this.refillHold = 0;
      this.group.visible = true;
      this.beam.visible = false;
      _right.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
      p.position.set(this.position.x, this.position.y + 1.4, this.position.z).addScaledVector(_right, 1.9);
      p.velocity.set(0, 0, 0);
      if (p.knife) p.knife.visible = true;
      if (p.mechGun) p.mechGun.visible = false;
      this.place();
    },

    /** A click: a short burst of the laser. */
    pulseLaser() { this.pulse = 0.35; },

    /** While you are in it, the cockpit air is what you breathe. */
    breathing(p, dt) {
      if (!this.piloting || this.air <= 0) return false;
      p.oxygen = Math.min(p.maxOxygen, p.oxygen + dt * 10);
      return true;
    },

    // --- Driving -----------------------------------------------------------------

    /** Called from the diver's update in place of swimming. */
    drive(dt, input, p) {
      p.camera.getWorldDirection(_fwd);
      _fwd.y = 0;
      if (_fwd.lengthSq() < 1e-6) _fwd.set(0, 0, -1);
      _fwd.normalize();
      _right.set(_fwd.z, 0, -_fwd.x);

      _tmp.set(0, 0, 0);
      if (this.battery > 0) {
        if (input.forward) _tmp.add(_fwd);
        if (input.back) _tmp.sub(_fwd);
        if (input.right) _tmp.sub(_right);
        if (input.left) _tmp.add(_right);
      }
      const moving = _tmp.lengthSq() > 0;
      p.sprinting = !!input.sprint && moving;
      if (moving) _tmp.normalize().multiplyScalar(WALK * (p.sprinting ? SPRINT : 1));
      p.velocity.x = SL.lerp(p.velocity.x, _tmp.x, 1 - Math.exp(-7 * dt));
      p.velocity.z = SL.lerp(p.velocity.z, _tmp.z, 1 - Math.exp(-7 * dt));

      // It walks; the only way up is a hop.
      if (this.hop <= 0 && input.up && this.battery > 0) this.hopSpeed = 5.5;
      this.hopSpeed -= 11 * dt;
      this.hop = Math.max(0, this.hop + this.hopSpeed * dt);
      if (this.hop <= 0 && this.hopSpeed < 0) this.hopSpeed = 0;

      const floor = ground(p.position.x, p.position.z);
      p.velocity.y = 0;
      p.position.y = SL.damp(p.position.y, floor + EYE + this.hop, 14, dt);

      const speed = Math.hypot(p.velocity.x, p.velocity.z);
      if (speed > 0.3) {
        this.battery = Math.max(0, this.battery - dt * (p.sprinting ? 0.45 : 0.25));
        this.walkPhase += dt * speed * 1.1;
      }
    },

    // --- Every frame ---------------------------------------------------------------

    /** The build finishing: the mech walks out onto the pad. */
    finishBuild() {
      this.building = 0;
      this.built = true;
      this.battery = 100;
      this.air = MAX_AIR;
      this.position.set(this.pad.x, ground(this.pad.x, this.pad.z), this.pad.z);
      this.group.visible = true;
      this.place();
      this.game.audio.craft();
      this.game.hud.toast('Mech built — it is waiting on the charging pad outside');
    },

    update(dt) {
      const game = this.game;
      if (!game) return;
      if (this.building > 0) {
        const before = this.building;
        this.building = Math.max(0, this.building - dt);
        if (before > 30 && this.building <= 30) game.hud.toast('Mech half built — 30 seconds');
        if (this.building <= 0) this.finishBuild();
        return;
      }
      if (!this.built) return;
      const p = game.player;
      const input = game.input;

      if (this.piloting) {
        if (p.dead) { this.exit(p); return; }
        // The mech is wherever its pilot is.
        this.position.set(p.position.x, ground(p.position.x, p.position.z), p.position.z);
        this.heading = p.yaw + Math.PI;

        // Air.
        if (this.air > 0) {
          this.air = Math.max(0, this.air - dt);
          if (this.air <= 0) {
            game.hud.toast('Mech air is empty — hold R for 10 seconds to refill it');
          }
        }
        if (input.refill && this.air < MAX_AIR) {
          this.refillHold += dt;
          if (this.refillHold >= REFILL_HOLD) {
            this.refillHold = 0;
            this.air = MAX_AIR;
            game.hud.toast('Mech air refilled — ' + MAX_AIR + ' seconds');
          }
        } else {
          this.refillHold = 0;
        }

        this.updateLaser(dt, p, input);
      } else {
        this.beam.visible = false;
        this.updateTow(dt, p);
        this.updatePush(p);
      }

      // Battery: flat is flat, and the pad charges it.
      const onPad = Math.hypot(this.position.x - this.pad.x, this.position.z - this.pad.z) < 2.6;
      this.charging = onPad && this.battery < 100;
      if (this.charging) {
        if (!this.wasCharging && this.battery < 90) game.hud.toast('Mech on the pad — charging');
        this.battery = Math.min(100, this.battery + dt * 5);
        if (this.battery >= 100 && !this.fullSaid) { this.fullSaid = true; game.hud.toast('Mech fully charged'); }
      }
      this.wasCharging = this.charging;
      if (this.battery <= 0 && !this.flatWarned) {
        this.flatWarned = true;
        game.hud.toast('Mech battery flat — get out, tie a rope to it [T] and tow it to the charging pad');
      }
      if (this.battery > 5) this.flatWarned = false;
      if (this.battery < 90) this.fullSaid = false;

      this.lampMat.color.setHex(this.battery > 50 ? 0x40e070 : this.battery > 15 ? 0xf0b030 : 0xf04030);
      this.padLamp.material.color.setHex(this.charging ? (Math.sin(game.time * 6) > 0 ? 0x3fe0a0 : 0x1a5a40) : 0x3fe0a0);

      this.place(dt);
    },

    /** On a rope it follows the diver, walking along the floor behind them. */
    updateTow(dt, p) {
      if (!this.towing) { this.rope.visible = false; return; }
      if (p.dead) { this.towing = false; this.rope.visible = false; return; }
      _to.set(p.position.x - this.position.x, 0, p.position.z - this.position.z);
      const d = _to.length();
      if (d > 40) { this.towing = false; this.game.hud.toast('The rope slipped'); this.rope.visible = false; return; }
      if (d > ROPE) {
        const step = Math.min(d - ROPE, 5 * dt);
        this.position.addScaledVector(_to.normalize(), step);
        this.heading = Math.atan2(_to.x, _to.z);
        this.walkPhase += step * 1.1;
        // Dragging something this heavy slows you down.
        if (d > ROPE + 1) p.velocity.multiplyScalar(0.96);
      }
      this.position.y = ground(this.position.x, this.position.z);
      const a = this.rope.geometry.attributes.position;
      a.setXYZ(0, p.position.x, p.position.y - 0.3, p.position.z);
      a.setXYZ(1, this.position.x, this.position.y + 1.8, this.position.z);
      a.needsUpdate = true;
      this.rope.visible = true;
    },

    /** Swimming into it shoves it along. */
    updatePush(p) {
      if (p.dead) return;
      const dx = this.position.x - p.position.x, dz = this.position.z - p.position.z;
      const dy = p.position.y - this.position.y;
      if (dy < 0 || dy > 2.6) return;
      const d = Math.hypot(dx, dz), clear = 1.4;
      if (d >= clear || d < 1e-3) return;
      const k = (clear - d) / d;
      this.position.x += dx * k * 0.6;
      this.position.z += dz * k * 0.6;
      p.position.x -= dx * k * 0.4;
      p.position.z -= dz * k * 0.4;
      this.position.y = ground(this.position.x, this.position.z);
      this.walkPhase += (clear - d) * 0.6;
    },

    updateLaser(dt, p, input) {
      this.pulse = Math.max(0, this.pulse - dt);
      const firing = (input.fire || this.pulse > 0) && this.battery > 0 && !p.dead;
      if (!firing) { this.beam.visible = false; this.laserTimer = 0; return; }

      this.battery = Math.max(0, this.battery - dt * 0.8);
      p.camera.getWorldDirection(_fwd);
      _right.set(_fwd.z, 0, -_fwd.x).normalize();
      const start = _tmp.copy(p.position).addScaledVector(_right, -0.2).add(_to.set(0, -0.2, 0)).addScaledVector(_fwd, 0.82);

      // The nearest thing along the line.
      let hit = null, hitAt = LASER_RANGE;
      for (const c of this.game.creatures()) {
        if (c.dead) continue;
        _to.subVectors(c.position, p.position);
        const along = _to.dot(_fwd);
        if (along < 0.5 || along > hitAt) continue;
        const off = _to.addScaledVector(_fwd, -along).length();
        if (off < (c.radius || 0.3) + Math.max(0.3, c.bodyLength * 0.25)) { hit = c; hitAt = along; }
      }

      const length = hit ? Math.max(0.5, hitAt - 0.8) : LASER_RANGE;
      this.beam.position.copy(start);
      this.beam.lookAt(_to.copy(start).addScaledVector(_fwd, 1));
      this.beam.scale.set(1, 1, length);
      this.beam.visible = true;

      this.laserTimer += dt;
      if (this.laserTimer >= LASER_TICK) {
        this.laserTimer -= LASER_TICK;
        if (hit) {
          hit.hurt(LASER_HIT, p);
          if (hit.provoke && !hit.dead) hit.provoke(p);
        }
      }
    },

    /** Puts the model where the mech is, legs swinging if it is walking. */
    place() {
      if (!this.group) return;
      this.group.position.copy(this.position);
      this.group.rotation.set(0, this.heading, 0);
      const swing = Math.sin(this.walkPhase) * 0.5;
      for (const leg of this.legs) {
        leg.hip.rotation.x = swing * leg.side;
        leg.knee.rotation.x = Math.max(0, -swing * leg.side) * 0.9;
      }
    }
  };

  SL.Mech = Mech;
})(window.SL);
