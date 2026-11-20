/**
 * People: the fisherman on Earth's pier, his boat, and - if he comes - the
 * fisherman as your diving partner on Vireth.
 *
 * On Earth he stands at the end of the pier. Talk to him (E) and he lends
 * you his boat and asks one thing: find a whale shark and scan it. Come back
 * and he pays you, and he will sell you better fins or a new suit for it.
 * After that, if you ask, he will come with you on the next ship.
 *
 * On Vireth he dives with you. He is not much of a fighter, but every so often
 * he scans a fish you have not got yet, and now and then he comes back from
 * poking about with something useful.
 */
(function (SL) {
  'use strict';

  const PAY = 200;
  const SHOP = [
    { id: 'seafins', name: 'Sea Fins', price: 80, blurb: 'Swim speed up to 8' },
    { id: 'diversuit', name: 'Diver Suit', price: 120, blurb: 'Take at least 55% less damage' }
  ];
  const BOAT_SPEED = 12;

  const _v = new THREE.Vector3();
  const _f = new THREE.Vector3();

  /** A person: boots, trousers, a yellow coat, a face and a hat. */
  function person(diving) {
    const g = new THREE.Group();
    const m = (c) => new THREE.MeshLambertMaterial({ color: c });
    const coat = m(diving ? 0x2a4a6a : 0xe8c020);
    for (const side of [1, -1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.85, 0.24), m(0x2a3550));
      leg.position.set(side * 0.14, 0.43, 0);
      g.add(leg);
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.34), coat);
    body.position.y = 1.22;
    g.add(body);
    for (const side of [1, -1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.66, 0.18), coat);
      arm.position.set(side * 0.37, 1.2, 0);
      g.add(arm);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), m(0xe0b090));
    head.position.y = 1.78;
    g.add(head);
    const beard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.1), m(0xd8d4cc));
    beard.position.set(0, 1.68, 0.15);
    g.add(beard);
    if (diving) {
      const mask = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), m(0x9fe0f0));
      mask.position.set(0, 1.82, 0.18);
      g.add(mask);
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8), m(0xc0c4c8));
      tank.position.set(0, 1.25, -0.26);
      g.add(tank);
    } else {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14), coat);
      brim.position.y = 1.93;
      g.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.18, 12), coat);
      crown.position.y = 2.03;
      g.add(crown);
      // His rod.
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 2.4, 6), m(0x5a4530));
      rod.position.set(0.45, 1.6, 0.5);
      rod.rotation.x = 0.9;
      g.add(rod);
    }
    return g;
  }

  const People = {
    /** 'new', 'asked', 'paid' or 'joined'. */
    stage: 'new',
    coins: 0,
    boat: null,
    driving: false,
    /** On Vireth: the fisherman diving with you, if he came. */
    buddy: null,

    reset() {
      this.stage = 'new';
      this.coins = 0;
      this.driving = false;
      this.boat = null;
      this.boatShown = false;
      this.fisher = null;
      if (this.buddy && this.buddy.mesh.parent) this.buddy.mesh.parent.remove(this.buddy.mesh);
      this.buddy = null;
      this.joined = false;
    },

    capture() {
      const b = this.boatShown && this.boat ? { x: this.boat.position.x, z: this.boat.position.z, yaw: this.boat.rotation.y } : null;
      return { stage: this.stage, coins: this.coins, boat: b, joined: this.joined };
    },

    restore(data, game) {
      if (!data) return;
      this.stage = data.stage || 'new';
      this.coins = data.coins || 0;
      this.joined = !!data.joined;
      if (this.boat && this.stage !== 'new') {
        this.boatShown = true;
        this.boat.visible = true;
        if (data.boat) { this.boat.position.x = data.boat.x; this.boat.position.z = data.boat.z; this.boat.rotation.y = data.boat.yaw || 0; }
      }
      if (this.joined && !(SL.Planet && SL.Planet.onEarth)) this.spawnBuddy(game);
    },

    // --- Earth --------------------------------------------------------------------------

    /** The fisherman on the end of the pier, and his boat beside it. */
    buildEarth(game, group, at) {
      this.game = game;
      const end = SL.Earth.pierEnd();
      const f = person(false);
      f.position.set(end.x - at.x, end.y, end.z - at.z);
      f.rotation.y = Math.PI;               // looking back up the pier at you
      group.add(f);
      this.fisher = end.clone();

      // The boat: a white hull, a little cabin, an outboard. Hidden until he lends it.
      const b = new THREE.Group();
      const m = (c) => new THREE.MeshLambertMaterial({ color: c });
      const hull = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 5.2), m(0xf0f2f4));
      hull.position.y = 0.2;
      b.add(hull);
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.6, 4), m(0xf0f2f4));
      bow.rotation.x = Math.PI / 2;
      bow.rotation.y = Math.PI / 4;
      bow.position.set(0, 0.2, 3.3);
      b.add(bow);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.15, 5.24), m(0xc23a2a));
      stripe.position.y = 0.45;
      b.add(stripe);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.4), m(0x2a5ac2));
      cabin.position.set(0, 1.05, 0.4);
      b.add(cabin);
      const motor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), m(0x2c3236));
      motor.position.set(0, 0.3, -2.8);
      b.add(motor);
      b.position.set(end.x + 4, SL.WATER_LEVEL - 0.1, end.z - 2);
      b.visible = this.boatShown;
      game.addToWorld(b);
      this.boat = b;
    },

    nearFisher(p) {
      return SL.Earth && SL.Earth.active && this.fisher && p.position.distanceTo(_v.set(this.fisher.x, p.position.y, this.fisher.z)) < 3.2
        && Math.abs(p.position.y - this.fisher.y - 1.7) < 2.5;
    },

    nearBoat(p) {
      return this.boat && this.boatShown && !this.driving
        && Math.hypot(p.position.x - this.boat.position.x, p.position.z - this.boat.position.z) < 4.2
        && p.position.y > SL.WATER_LEVEL - 3;
    },

    prompt(p) {
      if (p.dead) return null;
      if (this.driving) return 'Boat · WASD to steer · Shift for speed · E to jump out';
      if (this.nearFisher(p)) return '[E] talk to the fisherman';
      if (this.nearBoat(p)) return '[E] take the boat';
      return null;
    },

    interact(p) {
      if (!this.game) return false;
      if (this.driving) { this.leaveBoat(p); return true; }
      if (this.nearFisher(p)) { this.talk(); return true; }
      if (this.nearBoat(p)) { this.board(p); return true; }
      return false;
    },

    board(p) {
      this.driving = true;
      p.velocity.set(0, 0, 0);
      p.yaw = this.boat.rotation.y + Math.PI;
      this.game.hud.toast('In the boat');
    },

    leaveBoat(p) {
      this.driving = false;
      _f.set(Math.cos(this.boat.rotation.y), 0, -Math.sin(this.boat.rotation.y));
      p.position.set(this.boat.position.x, SL.WATER_LEVEL - 0.6, this.boat.position.z).addScaledVector(_f, 2.2);
      p.velocity.set(0, 0, 0);
    },

    /** The boat, from the diver's update, in place of swimming. */
    drive(dt, input, p) {
      p.camera.getWorldDirection(_f);
      _f.y = 0;
      if (_f.lengthSq() < 1e-6) _f.set(0, 0, -1);
      _f.normalize();
      const b = this.boat;
      let throttle = 0;
      if (input.forward) throttle = 1;
      if (input.back) throttle = -0.4;
      const speed = BOAT_SPEED * (input.sprint ? 1.5 : 1) * throttle;
      // It points where you look, turning at a boat's pace.
      const want = Math.atan2(_f.x, _f.z);
      b.rotation.y = SL.dampAngle(b.rotation.y, want, 2.2, dt);
      const nx = b.position.x + Math.sin(b.rotation.y) * speed * dt;
      const nz = b.position.z + Math.cos(b.rotation.y) * speed * dt;
      // Not up the beach, and not out of the world.
      const floor = SL.Terrain ? SL.Terrain.surfaceAt(nx, nz) : SL.Biomes.floorHeightAt(nx, nz);
      const land = SL.Earth && SL.Earth.active ? SL.Earth.groundAt(nx, nz) : -Infinity;
      if (Math.max(floor, land) < SL.WATER_LEVEL - 1.2 && Math.hypot(nx, nz) < SL.WORLD_RADIUS - 10) {
        b.position.x = nx; b.position.z = nz;
      }
      b.position.y = SL.WATER_LEVEL - 0.1 + Math.sin(this.game.time * 2) * 0.06;
      b.rotation.z = Math.sin(this.game.time * 1.6) * 0.03;
      p.position.set(b.position.x, SL.WATER_LEVEL + 1.6, b.position.z);
      p.velocity.set(0, 0, 0);
    },

    // --- Talking ------------------------------------------------------------------------

    ui() {
      if (this.el) return this.el;
      const el = document.createElement('div');
      el.className = 'screen';
      el.id = 'talkScreen';
      el.innerHTML = '<h1 class="screen__title">The <em>fisherman</em></h1><div class="screen__rule"></div>'
        + '<p class="screen__sub" id="talkText"></p><p class="screen__meta" id="talkCoins"></p>'
        + '<div class="menu__actions" id="talkButtons"></div>';
      document.body.appendChild(el);
      this.el = el;
      return el;
    },

    open(text, buttons) {
      const game = this.game;
      const el = this.ui();
      el.querySelector('#talkText').textContent = text;
      el.querySelector('#talkCoins').textContent = this.stage === 'new' ? '' : 'You have ' + this.coins + ' coins';
      const row = el.querySelector('#talkButtons');
      row.innerHTML = '';
      buttons.forEach(([label, action], i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'screen__cta' + (i ? ' screen__cta--quiet' : '');
        b.textContent = label;
        b.addEventListener('click', () => action());
        row.appendChild(b);
      });
      game.completionOpen = true;
      game.setPaused(true);
      document.getElementById('pauseScreen').classList.remove('is-visible');
      el.classList.add('is-visible');
      game.updateCursor();
    },

    close() {
      if (!this.el) return;
      this.el.classList.remove('is-visible');
      this.game.completionOpen = false;
      this.game.enter();
    },

    talk() {
      const bye = ['Bye', () => this.close()];
      if (this.stage === 'new') {
        this.open('Ahoy! Haven\'t seen you on the island before. Listen - I\'ve been after a whale '
          + 'shark all season and never got a look at one. Take my boat, and here, a scanner. Find '
          + 'one out over the grassy plateau or the boulder slope, scan it, and come back. I\'ll pay you for it.',
        [['I\'ll do it', () => {
          this.stage = 'asked';
          this.boatShown = true;
          if (this.boat) this.boat.visible = true;
          this.close();
          this.game.hud.toast('The fisherman\'s boat is tied up at the end of the pier');
        }], bye]);
        return;
      }
      if (this.stage === 'asked') {
        if (SL.Index.scanned.whaleshark) {
          this.stage = 'paid';
          this.coins += PAY;
          this.open('You found one! Twelve metres of spots, and you got a scan of it. Here - ' + PAY
            + ' coins, as promised. And if you want to spend them, I\'ve fins and a suit for sale.',
          [['See what he sells', () => this.talk()], bye]);
          this.game.audio.craft();
          return;
        }
        this.open('No whale shark yet? They cruise out over the grassy plateau and the boulder slope, '
          + 'past the kelp. Slow, huge, spotty. You can\'t miss one, once you find one.', [bye]);
        return;
      }
      // Paid, or coming along: the shop, and the offer.
      const buttons = SHOP.filter((item) => !SL.Crafting.built[item.id]).map((item) => [
        'Buy ' + item.name + ' · ' + item.price + ' coins', () => this.buy(item)]);
      if (this.stage === 'paid') {
        buttons.push(['Come with me to Vireth?', () => {
          this.stage = 'joined';
          this.joined = true;
          this.open('Another planet? I\'ve fished every bit of water on this one. All right - I\'m '
            + 'coming. I\'ll be on the next ship with you, and I\'ll keep my eyes open down there.', [bye]);
        }]);
      }
      buttons.push(bye);
      const lines = this.stage === 'joined' ? 'Ready when you are. Say the word at NASA and I\'m on the ship.'
        : 'What\'ll it be? Fins to get about quicker, or a proper suit so things bite less.';
      this.open(lines + SHOP.map((i) => '  ·  ' + i.name + ': ' + i.blurb).join(''), buttons);
    },

    buy(item) {
      if (this.coins < item.price) {
        this.open('That\'s ' + item.price + ' coins, and you\'ve got ' + this.coins + '.', [['Back', () => this.talk()]]);
        return;
      }
      const recipe = SL.Crafting.recipes.find((r) => r.id === item.id);
      this.coins -= item.price;
      SL.Crafting.built[item.id] = true;
      if (recipe && recipe.apply) recipe.apply(this.game.player);
      this.game.audio.craft();
      this.open('There you go - ' + item.name + '. Look after them.', [['Back', () => this.talk()], ['Bye', () => this.close()]]);
    },

    // --- Vireth: the fisherman diving with you ------------------------------------------

    spawnBuddy(game) {
      if (this.buddy) return;
      const mesh = person(true);
      const p = game.player.position;
      mesh.position.set(p.x + 2, p.y - 1, p.z + 2);
      game.addToWorld(mesh);
      this.buddy = { mesh, scanTimer: 30, findTimer: 50, phase: 0 };
    },

    update(dt) {
      const game = this.game;
      if (!game) return;
      if (this.driving && game.player.dead) this.driving = false;
      const b = this.buddy;
      if (!b || game.player.dead) return;
      const p = game.player;

      // He keeps a couple of metres off your shoulder, swimming flat.
      p.camera.getWorldDirection(_f);
      _v.set(p.position.x - _f.x * 2.5 + _f.z * 1.8, p.position.y - 0.8, p.position.z - _f.z * 2.5 - _f.x * 1.8);
      const far = b.mesh.position.distanceTo(_v);
      if (far > 60) b.mesh.position.copy(_v);       // left behind: he catches up
      else b.mesh.position.lerp(_v, 1 - Math.exp(-dt * (far > 8 ? 2.5 : 1.2)));
      b.phase += dt * 3;
      b.mesh.rotation.set(-1.2, Math.atan2(_f.x, _f.z), Math.sin(b.phase) * 0.15);
      const floor = SL.Biomes.floorHeightAt(b.mesh.position.x, b.mesh.position.z) + 0.6;
      if (b.mesh.position.y < floor) b.mesh.position.y = floor;
      if (b.mesh.position.y > SL.WATER_LEVEL - 0.5) b.mesh.position.y = SL.WATER_LEVEL - 0.5;

      // Now and then, a scan of something you have not got yet.
      b.scanTimer -= dt;
      if (b.scanTimer <= 0) {
        b.scanTimer = SL.randRange(40, 70);
        let best = null, bestD = 40 * 40;
        for (const f of game.creatures()) {
          if (f.dead || SL.Index.scanned[f.species.id] || f.species.leviathan || f.species.uncatalogued) continue;
          if (SL.Planet && SL.Planet.absent(f.species)) continue;
          const d = f.position.distanceToSquared(b.mesh.position);
          if (d < bestD) { bestD = d; best = f; }
        }
        if (best && SL.Index.record(best.species.id)) game.hud.toast('The fisherman scanned a ' + best.species.name);
      }

      // And now and then, something he picked up.
      b.findTimer -= dt;
      if (b.findTimer <= 0) {
        b.findTimer = SL.randRange(60, 100);
        const roll = Math.random();
        const type = roll < 0.55 ? 'titanium' : roll < 0.8 ? 'quartz' : roll < 0.93 ? 'gold' : 'simyphit';
        const n = type === 'titanium' ? SL.randInt(1, 3) : 1;
        SL.Crafting.add(type, n);
        if (game.hud.refreshFabricator) game.hud.refreshFabricator();
        game.hud.toast('The fisherman found you ' + n + ' ' + type);
      }
    }
  };

  SL.People = People;
})(window.SL);
