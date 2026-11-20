/**
 * Earth: a small city you walk round after the rocket brings you home.
 *
 * It is a little island town on the sea - one street, a few buildings, some
 * trees and parked cars - with NASA at the far end of the street and a launch
 * pad behind it. Walk to NASA's door and hand over what you brought back;
 * they build you a new ship on the pad, you climb aboard, and it takes off for
 * a quick test hop. What could go wrong?
 *
 * The town only exists while you are there: it is built when you come home
 * and taken down when you leave, so the ocean you dive in never has a city
 * standing in it. But it is a place: quit while you are in it and you come
 * back to it, where you were standing, with NASA as far along as it was.
 */
(function (SL) {
  'use strict';

  /** Where the town stands, and how big it is. */
  const AT = { x: 0, z: -150 };
  const HALF_X = 46, HALF_Z = 22;
  const GROUND = SL.WATER_LEVEL + 2;
  const SHIP_HEIGHT = 18;
  const BUILD_TIME = 20;
  const FLIGHT = 6;

  const Earth = {
    active: false,
    /** 'arrived', 'building', 'ready' or 'flying'. */
    stage: 'arrived',
    timer: 0,
    boxes: [],

    groundAt(x, z) {
      if (!this.active) return -Infinity;
      return Math.abs(x - AT.x) < HALF_X && Math.abs(z - AT.z) < HALF_Z ? GROUND : -Infinity;
    },

    /** Keeps the diver out of the buildings. */
    collide(p, radius) {
      if (!this.active) return;
      for (const b of this.boxes) {
        if (p.y > b.top + 0.5) continue;
        const dx = p.x - b.x, dz = p.z - b.z;
        const ox = b.hx + radius - Math.abs(dx), oz = b.hz + radius - Math.abs(dz);
        if (ox <= 0 || oz <= 0) continue;
        if (ox < oz) p.x += Math.sign(dx || 1) * ox;
        else p.z += Math.sign(dz || 1) * oz;
      }
    },

    enter(game, quiet) {
      this.game = game;
      this.active = true;
      this.stage = 'arrived';
      this.timer = 0;
      this.build(game);
      const p = game.player;
      if (SL.Mech && SL.Mech.piloting) SL.Mech.exit(p);
      p.position.set(AT.x - HALF_X + 4, GROUND + 1.7, AT.z);
      p.velocity.set(0, 0, 0);
      p.yaw = -Math.PI / 2;               // looking down the street, towards NASA
      p.pitch = 0;
      p.health = p.maxHealth;
      p.oxygen = p.maxOxygen;
      if (!quiet) game.hud.toast('Home. NASA is at the end of the street');
    },

    /** Where you are in the town and how far NASA has got, for the save. */
    capture() {
      if (!this.active || !this.game) return null;
      const p = this.game.player.position;
      return { stage: this.stage === 'flying' || this.stage === 'done' ? 'ready' : this.stage,
        timer: this.timer, x: p.x, y: p.y, z: p.z, yaw: this.game.player.yaw };
    },

    /** Back into the town as it was left. */
    restore(data, game) {
      if (!data) return;
      this.enter(game, true);
      this.stage = data.stage || 'arrived';
      this.timer = data.timer || 0;
      if (this.stage === 'building' || this.stage === 'ready') {
        this.ship.visible = true;
        this.ship.scale.set(1, this.stage === 'ready' ? 1 : Math.max(0.02, 1 - this.timer / BUILD_TIME), 1);
      }
      const p = game.player;
      if (typeof data.x === 'number' && this.groundAt(data.x, data.z) > -Infinity) {
        p.position.set(data.x, Math.max(data.y, GROUND + 1.7), data.z);
        p.yaw = data.yaw || 0;
      }
      p.velocity.set(0, 0, 0);
      game.hud.toast(this.stage === 'ready' ? 'Back on Earth. Your new ship is on the pad behind NASA'
        : this.stage === 'building' ? 'Back on Earth. NASA is still building your ship' : 'Back on Earth');
    },

    leave() {
      if (!this.active) return;
      this.active = false;
      if (this.group && this.group.parent) this.group.parent.remove(this.group);
      this.group = null;
      this.boxes = [];
    },

    // --- The town ----------------------------------------------------------------

    build(game) {
      const g = new THREE.Group();
      const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
      const box = (w, h, d, c, x, y, z, solid) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
        m.position.set(x, y, z);
        g.add(m);
        if (solid) this.boxes.push({ x: AT.x + x, z: AT.z + z, hx: w / 2, hz: d / 2, top: GROUND + h });
        return m;
      };
      this.boxes = [];

      // The ground: the island under it, pavement, and the road down the middle.
      box(HALF_X * 2, 12, HALF_Z * 2, 0x6b6656, 0, GROUND - 6, 0);
      box(HALF_X * 2, 0.1, HALF_Z * 2, 0x9a978c, 0, GROUND + 0.05, 0);
      box(HALF_X * 2, 0.12, 8, 0x3a3c3e, 0, GROUND + 0.08, 0);
      for (let x = -HALF_X + 4; x < HALF_X - 14; x += 6) box(2.4, 0.13, 0.25, 0xe8e0c0, x, GROUND + 0.1, 0);

      // Buildings either side of the street.
      const colours = [0xb8a48a, 0x8f9ea8, 0xc9b9a0, 0x7f8c7a, 0xa88f86, 0x9aa3b5];
      let k = 0;
      for (const side of [1, -1]) {
        for (let x = -HALF_X + 6; x < HALF_X - 22; x += 11) {
          const h = 6 + ((k * 37) % 13);
          const w = 8, d = 8;
          const z = side * (HALF_Z - 6);
          box(w, h, d, colours[k % colours.length], x, GROUND + h / 2, z, true);
          // Rows of lit windows on the side facing the street.
          for (let y = 2; y < h - 1; y += 2.6) {
            box(w - 1.6, 1.0, 0.1, 0xffe9a8, x, GROUND + y, z - side * (d / 2 + 0.05));
          }
          box(1.6, 2.4, 0.1, 0x4a3a2a, x, GROUND + 1.2, z - side * (d / 2 + 0.06));
          k++;
        }
      }

      // Trees along the pavement, and a few parked cars.
      for (let x = -HALF_X + 9; x < HALF_X - 20; x += 11) {
        for (const side of [1, -1]) {
          const z = side * 5.6;
          box(0.35, 2.4, 0.35, 0x5a4030, x, GROUND + 1.2, z, true);
          const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), mat(0x3f7a3a));
          crown.position.set(x, GROUND + 3.4, z);
          g.add(crown);
        }
      }
      const cars = [0xc23a2a, 0x2a5ac2, 0xe0c040, 0xf0f0f0];
      [[-30, 2.3], [-8, -2.3], [6, 2.3], [-20, -2.3]].forEach(([x, z], i) => {
        box(4, 1.2, 1.9, cars[i % cars.length], x, GROUND + 0.75, z, true);
        box(2.2, 0.8, 1.7, 0x2a3036, x - 0.2, GROUND + 1.6, z);
      });

      // NASA: a big white building at the end of the street, with its name on it.
      const nx = HALF_X - 14;
      box(12, 10, 16, 0xeef0f2, nx, GROUND + 5, -HALF_Z + 9, true);
      box(12, 10, 0.1, 0xeef0f2, nx, GROUND + 5, -HALF_Z + 1);
      this.door = new THREE.Vector3(AT.x + nx, GROUND, AT.z - HALF_Z + 9 + 8.2);
      box(3, 3.2, 0.12, 0x1d3f8a, nx, GROUND + 1.6, -HALF_Z + 17.1);
      g.add(this.sign(nx, GROUND + 8, -HALF_Z + 17.12));

      // The launch pad behind it, and the new ship, which only appears once
      // it is being built.
      const px = HALF_X - 6, pz = HALF_Z - 9;
      box(9, 0.4, 9, 0x5c6266, px, GROUND + 0.2, pz);
      this.padAt = new THREE.Vector3(AT.x + px, GROUND, AT.z + pz);
      this.ship = this.buildShip(mat);
      this.ship.position.set(px, GROUND + 0.4, pz);
      this.ship.visible = false;
      g.add(this.ship);

      g.position.set(AT.x, 0, AT.z);
      game.addToWorld(g);
      this.group = g;
    },

    /** The word NASA, painted on a board. */
    sign(x, y, z) {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 96;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#1d3f8a';
      ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NASA', 128, 52);
      const tex = new THREE.CanvasTexture(canvas);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 2.25), new THREE.MeshBasicMaterial({ map: tex }));
      m.position.set(x, y, z);
      return m;
    },

    buildShip(mat) {
      const g = new THREE.Group();
      const white = mat(0xf2f4f6), blue = mat(0x1d3f8a), dark = mat(0x2c3236);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, SHIP_HEIGHT - 4, 22), white);
      body.position.y = (SHIP_HEIGHT - 4) / 2 + 0.6;
      g.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 4, 22), blue);
      nose.position.y = SHIP_HEIGHT - 4 + 0.6 + 2;
      g.add(nose);
      for (const y of [3, 9]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(1.62, 1.62, 0.6, 22), blue);
        band.position.y = y;
        g.add(band);
      }
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3, 2), blue);
        const a = (i / 4) * Math.PI * 2;
        fin.position.set(Math.cos(a) * 1.9, 1.6, Math.sin(a) * 1.9);
        fin.rotation.y = -a;
        g.add(fin);
      }
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 1, 14), dark);
      bell.position.y = 0.2;
      g.add(bell);
      this.flame = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 14), new THREE.MeshBasicMaterial({
        color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false }));
      this.flame.rotation.x = Math.PI;
      this.flame.position.y = -2.5;
      this.flame.visible = false;
      g.add(this.flame);
      return g;
    },

    // --- Walking about --------------------------------------------------------------

    nearDoor(p) { return this.door && p.position.distanceTo(_v.set(this.door.x, p.position.y, this.door.z)) < 4; },
    nearPad(p) { return this.padAt && Math.hypot(p.position.x - this.padAt.x, p.position.z - this.padAt.z) < 6; },

    prompt(p) {
      if (!this.active || p.dead) return null;
      if (this.stage === 'arrived') {
        return this.nearDoor(p) ? '[E] give NASA your materials to build a new ship' : 'Walk down the street to NASA';
      }
      if (this.stage === 'building') return 'NASA is building your new ship · ' + Math.ceil(this.timer) + 's';
      if (this.stage === 'ready') return this.nearPad(p) ? '[E] climb aboard the new ship' : 'Your new ship is on the pad behind NASA';
      return null;
    },

    interact(p) {
      if (!this.active) return false;
      const hud = this.game.hud;
      if (this.stage === 'arrived' && this.nearDoor(p)) {
        const inv = SL.Crafting.inventory;
        const total = Object.keys(inv).reduce((n, k) => n + (inv[k] || 0), 0);
        for (const k of Object.keys(inv)) inv[k] = 0;
        hud.toast('NASA takes everything you brought back' + (total ? ' — ' + total + ' materials' : ''));
        if (hud.refreshFabricator) hud.refreshFabricator();
        this.stage = 'building';
        this.timer = BUILD_TIME;
        this.ship.visible = true;
        this.ship.scale.set(1, 0.02, 1);
        this.game.audio.craft();
        return true;
      }
      if (this.stage === 'ready' && this.nearPad(p)) {
        this.stage = 'flying';
        this.timer = 0;
        this.flame.visible = true;
        hud.toast('Test flight — lift-off');
        this.game.audio.blow(0);
        return true;
      }
      return this.stage !== 'flying' && false;
    },

    get flying() { return this.active && this.stage === 'flying'; },

    /** While the new ship flies, you watch it go. */
    carry(p) {
      p.velocity.set(0, 0, 0);
      const s = this.ship;
      const wx = AT.x + s.position.x, wz = AT.z + s.position.z;
      p.position.set(wx - 14, GROUND + 6, wz - 10);
      p.yaw = Math.atan2(-(wx - p.position.x), -(wz - p.position.z));
      p.pitch = SL.clamp(Math.atan2(s.position.y - 4, 18) * 0.8, 0, 1.1);
    },

    update(dt) {
      if (!this.active) return;
      if (this.stage === 'building') {
        this.timer = Math.max(0, this.timer - dt);
        this.ship.scale.set(1, Math.max(0.02, 1 - this.timer / BUILD_TIME), 1);
        if (this.timer <= 0) {
          this.stage = 'ready';
          this.game.audio.craft();
          this.game.hud.toast('The new ship is ready on the pad behind NASA');
        }
      } else if (this.stage === 'flying') {
        this.timer += dt;
        this.ship.position.y = GROUND + 0.4 + 2 * this.timer * this.timer;
        this.flame.scale.set(1, 1 + Math.sin(this.game.time * 30) * 0.15, 1);
        if (this.timer > FLIGHT) {
          this.stage = 'done';
          this.flame.visible = false;
          this.game.crashScreen();
        }
      }
    }
  };

  const _v = new THREE.Vector3();
  SL.Earth = Earth;
})(window.SL);
