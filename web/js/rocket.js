/**
 * The rocket home.
 *
 * Finishing a world - every species catalogued, every leviathan dead - opens
 * the last job: the launch pad on the crater sand beside the wreck. Bring it
 * eighty titanium, twenty quartz, five simyphit and five gold and it spends
 * five minutes putting a rocket together, rising up off the pad as it goes.
 * Climb aboard and it takes you up out of the sea and home.
 *
 * Going home does not end the world. You can come back down and keep diving,
 * and the rocket is waiting on the pad if you want to leave again.
 */
(function (SL) {
  'use strict';

  const COST = { titanium: 80, quartz: 20, simyphit: 5, gold: 5 };
  const BUILD_TIME = 300;
  const HEIGHT = 14;
  /** How long the flight lasts before the ending screen. */
  const FLIGHT = 8;

  function costLine() {
    return Object.keys(COST).map((k) => COST[k] + ' ' + k).join(' · ');
  }

  function clock(seconds) {
    const s = Math.ceil(seconds);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  const Rocket = {
    /** 'none' (not paid for), 'building', 'built', or 'flying'. */
    state: 'none',
    remaining: 0,
    flightTime: 0,
    wentHome: false,

    setup(game) {
      this.game = game;
      this.state = 'none';
      this.remaining = 0;
      this.flightTime = 0;
      this.wentHome = false;
      if (!SL.Wreck) return;
      this.pad = SL.Wreck.rocketPoint();
      this.buildPad(game);
      this.buildRocket(game);
      this.show();
    },

    buildPad(game) {
      const g = new THREE.Group();
      const concrete = new THREE.MeshLambertMaterial({ color: 0x5c6266 });
      const yellow = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
      const steel = new THREE.MeshLambertMaterial({ color: 0x3a4246 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.0, 0.4, 28), concrete);
      base.position.y = 0.1;
      g.add(base);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.1, 6, 36), yellow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.32;
      g.add(ring);
      // The gantry: a tower beside the rocket with a few cross-braces.
      for (const [x, z] of [[4.2, -0.5], [4.2, 0.5], [5.2, -0.5], [5.2, 0.5]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.18, HEIGHT + 1, 0.18), steel);
        leg.position.set(x, (HEIGHT + 1) / 2, z);
        g.add(leg);
      }
      for (let y = 2; y < HEIGHT; y += 3) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.2), steel);
        brace.position.set(4.7, y, 0);
        g.add(brace);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 0.3), yellow);
        arm.position.set(3.0, y + 0.4, 0);
        g.add(arm);
      }
      this.lampMat = new THREE.MeshBasicMaterial({ color: 0xf04030 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), this.lampMat);
      lamp.position.set(4.7, HEIGHT + 1.2, 0);
      g.add(lamp);
      g.position.copy(this.pad);
      game.addToWorld(g);
      this.padGroup = g;
    },

    buildRocket(game) {
      const white = new THREE.MeshLambertMaterial({ color: 0xe8ebe6 });
      const red = new THREE.MeshLambertMaterial({ color: 0xc23a2a });
      const dark = new THREE.MeshLambertMaterial({ color: 0x2c3236 });
      const glass = new THREE.MeshBasicMaterial({ color: 0x9fe8ff });
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, HEIGHT - 3.5, 20), white);
      body.position.y = (HEIGHT - 3.5) / 2 + 0.5;
      g.add(body);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3, 20), red);
      nose.position.y = HEIGHT - 3 + 1.5;
      g.add(nose);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.5, 20), red);
      band.position.y = 3;
      g.add(band);
      const window_ = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), glass);
      window_.position.set(0, HEIGHT - 4.5, 1.05);
      g.add(window_);
      for (let i = 0; i < 4; i++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 1.4), red);
        const a = (i / 4) * Math.PI * 2;
        fin.position.set(Math.cos(a) * 1.4, 1.4, Math.sin(a) * 1.4);
        fin.rotation.y = -a;
        g.add(fin);
      }
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.95, 0.9, 14), dark);
      bell.position.y = 0.2;
      g.add(bell);
      // The flame, only lit on the way up.
      this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.85, 4, 14), new THREE.MeshBasicMaterial({
        color: 0xffa040, transparent: true, opacity: 0.85, depthWrite: false }));
      this.flame.rotation.x = Math.PI;
      this.flame.position.y = -2;
      this.flame.visible = false;
      g.add(this.flame);
      g.position.copy(this.pad);
      game.addToWorld(g);
      this.group = g;
    },

    /** The rocket as far along as it is: absent, growing, or whole. */
    show() {
      if (!this.group) return;
      const built = this.state === 'built' || this.state === 'flying';
      const progress = this.state === 'building' ? 1 - this.remaining / BUILD_TIME : built ? 1 : 0;
      this.group.visible = progress > 0;
      this.group.scale.set(1, Math.max(0.02, progress), 1);
      this.lampMat.color.setHex(built ? 0x40e070 : this.state === 'building' ? 0xf0b030 : 0xf04030);
    },

    // --- Saving ---------------------------------------------------------------------

    capture() {
      if (this.state === 'none' && !this.wentHome) return null;
      return { state: this.state === 'flying' ? 'built' : this.state, remaining: this.remaining, wentHome: this.wentHome };
    },

    restore(data) {
      if (!data) return;
      this.state = data.state || 'none';
      this.remaining = data.remaining || 0;
      this.wentHome = !!data.wentHome;
      this.show();
    },

    // --- The diver -------------------------------------------------------------------

    near(p) {
      if (!this.pad) return false;
      const dx = p.position.x - this.pad.x, dz = p.position.z - this.pad.z;
      return dx * dx + dz * dz < 6.5 * 6.5 && p.position.y < this.pad.y + HEIGHT + 2;
    },

    prompt(p) {
      if (p.dead || !this.near(p)) return null;
      if (this.state === 'building') return 'Rocket pad · building the rocket · ' + clock(this.remaining) + ' to go';
      if (this.state === 'built') return '[E] climb aboard the rocket and go home';
      if (!SL.Quest.finished) return 'Rocket pad · finish every objective first · ' + SL.Quest.summary();
      return '[E] build the rocket · ' + costLine() + ' · takes 5 minutes';
    },

    /** E. Returns true if it used the key. */
    interact(p) {
      if (!this.game || p.dead || !this.near(p) || this.state === 'flying') return false;
      const hud = this.game.hud;
      if (this.state === 'building') { hud.toast('The rocket will be ready in ' + clock(this.remaining)); return true; }
      if (this.state === 'built') { this.launch(p); return true; }
      if (!SL.Quest.finished) {
        hud.toast('The rocket needs every objective done first — ' + SL.Quest.summary());
        return true;
      }
      const inv = SL.Crafting.inventory;
      const short = Object.keys(COST).filter((k) => (inv[k] || 0) < COST[k]);
      if (short.length) {
        hud.toast('The rocket needs ' + costLine() + ' — short of ' + short.join(', '));
        return true;
      }
      for (const k of Object.keys(COST)) inv[k] -= COST[k];
      this.state = 'building';
      this.remaining = BUILD_TIME;
      this.game.audio.craft();
      hud.toast('The rocket is being built — five minutes');
      if (hud.refreshFabricator) hud.refreshFabricator();
      this.show();
      this.game.saveWorld();
      return true;
    },

    launch(p) {
      if (SL.Mech && SL.Mech.piloting) SL.Mech.exit(p);
      this.state = 'flying';
      this.flightTime = 0;
      this.flame.visible = true;
      this.game.hud.toast('Lift-off');
      this.game.audio.blow(0);
    },

    /** While flying, the diver rides in the nose, looking out. Called from the diver's update. */
    carry(p) {
      p.velocity.set(0, 0, 0);
      p.position.set(this.group.position.x + 7, this.group.position.y + HEIGHT * 0.6, this.group.position.z + 7);
      // Looking at the rocket as it climbs.
      const dx = this.group.position.x - p.position.x, dz = this.group.position.z - p.position.z;
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = 0.15;
    },

    get flying() { return this.state === 'flying'; },

    update(dt) {
      const game = this.game;
      if (!game || !this.group) return;

      if (this.state === 'building') {
        const before = this.remaining;
        this.remaining = Math.max(0, this.remaining - dt);
        for (const mark of [240, 180, 120, 60]) {
          if (before > mark && this.remaining <= mark) game.hud.toast('Rocket ' + clock(this.remaining) + ' from ready');
        }
        if (this.remaining <= 0) {
          this.state = 'built';
          game.audio.craft();
          game.hud.toast('The rocket is ready — climb aboard at the pad to go home');
          game.saveWorld();
        }
        this.show();
      }

      if (this.state === 'flying') {
        this.flightTime += dt;
        const t = this.flightTime;
        // Slow off the pad, then faster and faster.
        this.group.position.y = this.pad.y + 1.5 * t * t;
        this.flame.scale.set(1, 1 + Math.sin(game.time * 30) * 0.15, 1);
        if (SL.Bubbles && this.group.position.y < SL.WATER_LEVEL) {
          SL.Bubbles.puff(game, this.group.position, 3, 1.2, 0.2);
        }
        if (t > FLIGHT) this.arrive();
      }
    },

    /** Home. */
    arrive() {
      const game = this.game;
      this.state = 'built';
      this.wentHome = true;
      this.flame.visible = false;
      this.group.position.copy(this.pad);
      this.show();
      if (game.world) game.world.wentHome = true;
      // Back in the wreck, for if they come back down.
      const p = game.player;
      if (SL.Wreck) {
        const spawn = SL.Wreck.spawnPoint();
        p.position.copy(spawn.position);
        p.yaw = spawn.yaw;
      }
      p.velocity.set(0, 0, 0);
      game.saveWorld();
      game.showHome();
    }
  };

  SL.Rocket = Rocket;
})(window.SL);
