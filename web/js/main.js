/**
 * Boots the game: renderer, scene, world generation, input and the frame loop.
 */
(function (SL) {
  'use strict';

  /** Distance past which creatures stop being drawn and think at a lower rate. */
  const CULL_DISTANCE = 55;

  /** The three fish update tiers: full rate, quarter rate, sixteenth rate. */
  const NEAR_DISTANCE_SQ = CULL_DISTANCE * CULL_DISTANCE;
  const MID_DISTANCE_SQ = (CULL_DISTANCE * 2.6) * (CULL_DISTANCE * 2.6);

  /** Frame rate below which the renderer drops resolution to keep input snappy. */
  const TARGET_FPS = 48;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.time = 0;
      this.running = false;
      this.started = false;

      this.fish = [];
      this.stalkers = [];
      this.scrap = [];
      this.pickups = [];
      this.crystals = [];
      this.kings = [];
      this.whales = [];
      this.puffers = [];
      this.kelperLevs = [];
      this.glowLevs = [];
      this.carniLevs = [];
      this.crabers = [];
      this.kelpers = [];
      this.pets = [];
      this.petRespawn = 0;
      this.beacons = [];
      this.vines = [];
      this.bubbles = [];
      this.nests = [];
      this.carnis = [];

      // Paused covers the title card, the pause screen and the fabricator. The
      // world keeps moving so the ocean stays alive behind them, but the diver
      // is frozen - no air burned, no bites landed.
      this.paused = true;
      this.fabricatorOpen = false;
      this.indexOpen = false;

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      // Deliberately left in the renderer's linear pipeline. Every colour in the
      // game is an authored vertex colour rather than a texture, and sRGB output
      // encoding lifts those mid-tones until the sea floor reads as white. Linear
      // output plus total light near 1.0 renders the palette as written.

      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(0x0b4a52, 0.012);
      this.scene.background = this.scene.fog.color;

      this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 400);
      this.scene.add(this.camera);

      this.materials = {
        // Everything here is hand-wound geometry, and fins, kelp leaves and
        // the water surface are all meant to be seen from either face, so the
        // shared materials are double-sided rather than relying on winding.
        surface: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
        glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
        water: new THREE.MeshBasicMaterial({
          vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.9
        }),

        // The sky dome. Unlit, unfogged and written behind everything, so it
        // reads as distance rather than as a painted ceiling.
        sky: new THREE.MeshBasicMaterial({
          vertexColors: true, side: THREE.BackSide, fog: false,
          depthWrite: false, transparent: true, opacity: 1
        }),

        // Light bleeding into the water around something that produces it.
        // Additive and depth-write-off so it layers over whatever is behind it
        // instead of cutting a hole, and back-faced so the body still reads
        // through its own halo.
        halo: new THREE.MeshBasicMaterial({
          color: 0x6ee8ff, transparent: true, opacity: 0.16, depthWrite: false,
          side: THREE.BackSide, blending: THREE.AdditiveBlending
        })
      };

      // 'pointerlock' is the good path. Some embeddings (an iframe without the
      // pointer-lock permission, for one) refuse it, and without a fallback the
      // game would simply be unaimable - so 'drag' exists as a second mode.
      this.lookMode = 'pointerlock';

      this.audio = new SL.Audio();
      this.input = {
        forward: false, back: false, left: false, right: false,
        up: false, down: false, sprint: false, scan: false
      };

      this.scrapTimer = 20;
      this._tmp = new THREE.Vector3();

      // Seconds played in the current world, which is what a save records.
      this.worldTime = 0;
      this.world = null;
      this.completionOpen = false;
      this.worldGroup = new THREE.Group();
      this.scene.add(this.worldGroup);

      // Adaptive resolution. A retina display at devicePixelRatio 2 costs four
      // times the pixels of 1, which is the usual reason a scene like this feels
      // sluggish to the mouse.
      this.pixelRatio = Math.min(window.devicePixelRatio, 1.5);
      this.renderer.setPixelRatio(this.pixelRatio);
      this.frameTimes = [];
    }

    /** Everything belonging to the current world, so it can be torn down. */
    addToWorld(object) {
      this.worldGroup.add(object);
      return object;
    }

    /**
     * Removes the current world completely. Geometry shared between worlds
     * (creature bodies, pickup shapes) is marked and left alone; everything
     * else - terrain, kelp, scrap - is disposed so switching worlds does not
     * leak the old one onto the GPU.
     */
    teardownWorld() {
      for (const fish of this.fish) fish.object.parent && fish.object.parent.remove(fish.object);
      this.fish.length = 0;
      this.stalkers.length = 0;
      this.scrap.length = 0;
      this.pickups.length = 0;
      this.crystals.length = 0;
      this.kings.length = 0;
      this.whales.length = 0;
      this.puffers.length = 0;
      this.kelperLevs.length = 0;
      this.glowLevs.length = 0;
      this.carniLevs.length = 0;
      this.crabers.length = 0;
      // The surface patch lives in worldGroup and is rebuilt with it.
      this.water = null;
      this.kelpers.length = 0;
      this.pets.length = 0;
      this.petRespawn = 0;
      this.beacons.length = 0;
      this.vines.length = 0;
      this.bubbles.length = 0;
      this.nests.length = 0;
      this.carnis.length = 0;

      if (this.worldGroup) {
        this.worldGroup.traverse((node) => {
          if (node.geometry && !node.geometry.userData.shared) node.geometry.dispose();
        });
        this.scene.remove(this.worldGroup);
      }

      this.worldGroup = new THREE.Group();
      this.scene.add(this.worldGroup);
    }

    /** Every leviathan in the world, in the one list the chart wants. */
    leviathans() {
      return this.kings.concat(this.whales, this.puffers, this.kelperLevs,
        this.glowLevs, this.carniLevs);
    }

    /** Generates a world from a seed. The same seed always gives the same ocean. */
    build(seed) {
      const started = performance.now();

      this.seed = seed >>> 0;
      SL.setSeed(this.seed);
      SL.Biomes.setSeed(this.seed);
      // One sampling pass builds both the spawn index and the chart.
      SL.Biomes.buildIndex();
      this.teardownWorld();

      SL.World.buildLighting(this);
      SL.World.buildTerrain(this);
      SL.World.buildWaterSurface(this);
      if (!this.sky) SL.World.buildSky(this);
      const plants = SL.World.scatterFlora(this);
      SL.World.scatterScrap(this);
      SL.World.scatterCrystals(this);

      // The player and HUD survive world changes; only the ocean is rebuilt.
      if (!this.player) this.player = new SL.Player(this);
      if (!this.hud) this.hud = new SL.Hud(this);
      SL.Index.init(this);
      SL.Crafting.reset();
      SL.Index.reset();
      this.player.resetLoadout();

      SL.World.spawnCreatures(this);

      this.stats = {
        plants,
        fish: this.fish.length,
        stalkers: this.stalkers.length,
        scrap: this.scrap.length,
        ms: Math.round(performance.now() - started)
      };
      console.log('[Stalkers Legion] ocean generated in ' + this.stats.ms + 'ms:',
        this.stats.fish + ' fish,', this.stats.stalkers + ' stalkers,',
        this.stats.scrap + ' scrap,', plants + ' plants');
    }

    distanceToPlayer(position) {
      return this.player ? position.distanceTo(this.player.position) : 999;
    }

    /** Called from the first user gesture: starts audio and grabs the pointer. */
    enter() {
      this.audio.start();
      this.started = true;
      this.paused = false;
      this.fabricatorOpen = false;
      this.hud.setFabricatorOpen(false);
      this.indexOpen = false;
      SL.Index.setOpen(false);
      document.getElementById('pauseScreen').classList.remove('is-visible');

      if (this.lookMode !== 'pointerlock') { this.updateCursor(); return; }

      const lock = this.canvas.requestPointerLock();
      if (lock && typeof lock.catch === 'function') lock.catch(() => {});

      // If the lock has not engaged shortly after asking, it is not going to -
      // fall back to drag-look rather than leaving the player unable to aim.
      clearTimeout(this._lockCheck);
      this._lockCheck = setTimeout(() => {
        if (document.pointerLockElement !== this.canvas && this.started
          && !this.fabricatorOpen && !this.indexOpen) {
          this.useDragLook();
        }
      }, 700);

      this.updateCursor();
    }

    useDragLook() {
      if (this.lookMode === 'drag') return;
      this.lookMode = 'drag';
      this.paused = false;
      document.getElementById('pauseScreen').classList.remove('is-visible');
      document.body.classList.add('is-drag-look');
      this.hud.showLookMode('drag');
      this.updateCursor();
    }

    /** The cursor is only free on the title card, the pause screen and the fabricator. */
    updateCursor() {
      const free = this.paused || !this.started;
      document.body.classList.toggle('is-cursor-free', free);
    }

    togglePause(paused) {
      this.setPaused(paused);
      const show = paused && this.started && !this.player.dead
        && !this.fabricatorOpen && !this.indexOpen && !this.completionOpen;
      document.getElementById('pauseScreen').classList.toggle('is-visible', show);
      if (show) document.getElementById('pauseObjective').textContent = SL.Quest.summary();
      this.updateCursor();
    }

    /**
     * The world is finished. Nothing ends - this is a card you dismiss, and the
     * only lasting change is that the world can no longer be deleted.
     */
    showCompletion() {
      this.completionOpen = true;
      this.setPaused(true);
      document.getElementById('pauseScreen').classList.remove('is-visible');
      document.getElementById('completionScreen').classList.add('is-visible');
      this.updateCursor();
      this.audio.craft();
    }

    closeCompletion(andLeave) {
      this.completionOpen = false;
      document.getElementById('completionScreen').classList.remove('is-visible');
      if (andLeave) this.quitToMenu();
      else this.enter();
    }

    /** Writes the current run into its world record. Never blocks the game. */
    saveWorld(options) {
      if (!this.world || !this.player) return Promise.resolve(false);

      SL.Saves.capture(this.world, this);
      const saved = SL.Saves.put(this.world);

      if (options && options.announce) {
        saved.then((ok) => this.hud.toast(ok ? 'World saved' : 'Could not save'));
      }
      return saved;
    }

    /** Generates `world`'s ocean and drops the diver back into it. */
    enterWorld(world) {
      this.world = world;
      this.completionOpen = false;
      document.getElementById('completionScreen').classList.remove('is-visible');
      this.build(world.seed);
      SL.Saves.restore(world, this);
      this.hud.refreshFabricator();
      this.hud.setWorldName(world.name);
      this.enter();
    }

    /** Saves and returns to the world list. */
    async quitToMenu() {
      await this.saveWorld();
      this.started = false;
      this.setPaused(true);
      document.getElementById('pauseScreen').classList.remove('is-visible');
      this.hud.setFabricatorOpen(false);
      this.fabricatorOpen = false;
      await SL.Menu.open(this);
    }

    setPaused(paused) {
      this.paused = paused;
      if (paused && document.pointerLockElement === this.canvas) document.exitPointerLock();
      this.updateCursor();
    }

    /** The databank is a reading screen, so it pauses like the fabricator. */
    toggleIndex() {
      if (!this.started || this.player.dead) return;
      this.indexOpen = !this.indexOpen;
      SL.Index.setOpen(this.indexOpen);
      this.setPaused(this.indexOpen);
      this.audio.click();
      if (!this.indexOpen) this.enter();
    }

    toggleFabricator() {
      if (!this.started || this.player.dead) return;
      this.fabricatorOpen = !this.fabricatorOpen;
      this.hud.setFabricatorOpen(this.fabricatorOpen);
      this.setPaused(this.fabricatorOpen);
      this.audio.click();
      if (!this.fabricatorOpen) this.enter();
    }

    update(dt) {
      this.time += dt;

      // The diver only ticks while actually playing - this is what stops air
      // draining behind the title card and the pause screen.
      if (!this.paused) {
        this.player.update(dt, this.input);
        this.worldTime += dt;

        this.autosaveTimer = (this.autosaveTimer || 0) - dt;
        if (this.autosaveTimer <= 0) { this.autosaveTimer = 25; this.saveWorld(); }
      }

      const playerPos = this.player.position;

      // Creatures past the fog are neither drawn nor stepped at full rate, in
      // three tiers rather than two.
      //
      // Two tiers was fine on a smaller map. The world is now 2,400 m across
      // and carries most of its fish somewhere you are not, so the outer tier
      // exists to stop the frame cost growing with the map: the far majority
      // are stepped once every sixteen frames with a correspondingly longer
      // step, which is invisible at 140 m and costs a sixteenth of the work.
      for (const fish of this.fish) {
        const d2 = fish.position.distanceToSquared(playerPos);
        const near = d2 <= NEAR_DISTANCE_SQ;
        fish.object.visible = near;

        if (near || fish.dead) {
          fish.update(dt);
          continue;
        }

        if (d2 <= MID_DISTANCE_SQ) {
          if ((this.frame & 3) !== 0) continue;
          fish.update(dt * 4);
        } else {
          if ((this.frame & 15) !== 0) continue;
          // Capped, because a long step and a fast fish is how something ends
          // up on the wrong side of a seamount.
          fish.update(Math.min(dt * 16, 0.4));
        }
      }

      // Stalkers always think - one hunting you from out in the murk is the point.
      for (const stalker of this.stalkers) {
        stalker.object.visible = stalker.position.distanceToSquared(playerPos) < 1.8 * CULL_DISTANCE * CULL_DISTANCE;
        stalker.update(dt);
      }

      // The apexes are visible from much further off, being the size they are,
      // and they keep running their standoff whether or not anyone is watching.
      for (const king of this.kings) {
        king.object.visible = king.position.distanceToSquared(playerPos) < 9 * CULL_DISTANCE * CULL_DISTANCE;
        king.update(dt);
      }
      for (const whale of this.whales) {
        whale.object.visible = whale.position.distanceToSquared(playerPos) < 16 * CULL_DISTANCE * CULL_DISTANCE;
        whale.update(dt);
      }
      for (const puffer of this.puffers) {
        puffer.object.visible = puffer.position.distanceToSquared(playerPos) < 6 * CULL_DISTANCE * CULL_DISTANCE;
        puffer.update(dt);
      }
      for (const lev of this.kelperLevs) {
        lev.object.visible = lev.position.distanceToSquared(playerPos) < 9 * CULL_DISTANCE * CULL_DISTANCE;
        lev.update(dt);
      }

      // The glow one carries a light that reaches ninety metres, so it stays
      // drawn well past the range anything else would be culled at - being
      // visible from a long way off in the dark is the entire animal.
      for (const lev of this.glowLevs) {
        lev.object.visible = lev.position.distanceToSquared(playerPos) < 25 * CULL_DISTANCE * CULL_DISTANCE;
        lev.update(dt);
      }

      // Kelpers exist to reach you, so they always think - and they remove
      // themselves the moment they get away, hence the backwards walk.
      for (let i = this.kelpers.length - 1; i >= 0; i--) {
        const kelper = this.kelpers[i];
        kelper.object.visible = kelper.position.distanceToSquared(playerPos) < 4 * CULL_DISTANCE * CULL_DISTANCE;
        kelper.update(dt);
      }

      // The islander walks the one island in the world; there are never more
      // than a couple and they are worth seeing from a long way off.
      for (const carni of this.carnis) {
        carni.object.visible = carni.position.distanceToSquared(playerPos) < 6 * CULL_DISTANCE * CULL_DISTANCE;
        carni.update(dt);
      }
      for (const carni of this.carniLevs) {
        carni.object.visible = carni.position.distanceToSquared(playerPos) < 12 * CULL_DISTANCE * CULL_DISTANCE;
        carni.update(dt);
      }

      // Crabs are small and low to the floor, so they are culled like fish.
      for (const crab of this.crabers) {
        const near = crab.position.distanceToSquared(playerPos) <= NEAR_DISTANCE_SQ;
        crab.object.visible = near;
        if (near || crab.dead) crab.update(dt);
        else if ((this.frame & 3) === 0) crab.update(dt * 4);
      }

      // The pet is always beside you, so it is never culled.
      for (const pet of this.pets) pet.update(dt);
      SL.Pet.update(this, dt);

      for (let i = this.scrap.length - 1; i >= 0; i--) this.scrap[i].update(dt);
      for (let i = this.pickups.length - 1; i >= 0; i--) this.pickups[i].update(dt);
      for (let i = this.crystals.length - 1; i >= 0; i--) this.crystals[i].update(dt);
      for (const beacon of this.beacons) beacon.update(dt);
      for (let i = this.vines.length - 1; i >= 0; i--) this.vines[i].update(dt);
      for (let i = this.bubbles.length - 1; i >= 0; i--) this.bubbles[i].update(dt);

      this.scrapTimer -= dt;
      if (this.scrapTimer <= 0) { this.scrapTimer = 20; SL.World.replenishScrap(this); }

      SL.World.updateWater(this, dt);
      SL.World.updateAmbience(this, dt);
      this.hud.update(dt);

      // A death is worth recording the moment it happens.
      if (this.player.dead && !this._deathSaved) {
        this._deathSaved = true;
        if (this.world) this.world.deaths = (this.world.deaths || 0) + 1;
        this.saveWorld();
      } else if (!this.player.dead) {
        this._deathSaved = false;
      }
    }

    loop(now) {
      requestAnimationFrame((t) => this.loop(t));

      const dt = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
      this.lastFrame = now;
      this.frame = (this.frame || 0) + 1;
      this.measurePerformance(dt);

      if (dt > 0) this.update(dt);
      this.renderer.render(this.scene, this.camera);
    }

    /**
     * Watches the frame rate and drops resolution once if the machine cannot
     * hold the target. Resolution is never raised again, so this settles rather
     * than oscillating.
     */
    measurePerformance(dt) {
      if (dt <= 0) return;
      this.frameTimes.push(dt);
      if (this.frameTimes.length < 90) return;

      const average = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
      this.fps = Math.round(1 / average);
      this.frameTimes.length = 0;

      if (this.fps < TARGET_FPS && this.pixelRatio > 0.75) {
        this.pixelRatio = this.fps < 30 ? 0.75 : 1;
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    }

    resize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  /**
   * Cheat codes, typed anywhere during play. Only the last few letters pressed
   * are kept, so they never interfere with the movement keys.
   */
  const CHEATS = {
    // Everything unlocked, stocked, and nothing can touch you.
    sus(game) {
      SL.Crafting.unlockAll(game);
      game.hud.toast('CHEAT — all gear, infinite health and air, and fast');
      game.hud.refreshFabricator();
    },
    // Put the two leviathans on each other and pull up a seat.
    sandwich(game) {
      SL.forceClash(game);
    },
    // A candle that burns underwater, in exactly one place.
    candle(game) {
      const on = game.player.toggleCandle();
      game.hud.toast(on
        ? 'CHEAT — hacked candle lit. It only burns in the Deep Trench'
        : 'CHEAT — candle out');
    },
    // The stalker you would otherwise have to fill the databank for.
    tame(game) {
      if (game.pets.length) {
        game.hud.toast('CHEAT — your stalker is already with you');
        return;
      }
      game.petRespawn = 0;
      SL.Pet.spawn(game);
      game.hud.toast('CHEAT — a stalker has bonded to you');
    }
  };

  const CHEAT_CODES = Object.keys(CHEATS);

  /**
   * Feeds a keystroke to the cheat buffer and reports what it meant.
   *
   * The buffer only ever holds the longest tail that could still grow into a
   * code, which is what lets the caller tell a letter typed mid-cheat from an
   * ordinary keypress: 'sandwich' contains i, h, c and b, all of which are
   * bound to actions, so typing it would otherwise open the databank and spend
   * a medkit on the way past.
   *
   * Returns 'fired', 'prefix' (mid-code, so swallow the key) or 'none'.
   */
  function checkCheat(game, key) {
    if (!game.started) return 'none';

    const buffer = (game.cheatBuffer || '') + key;

    let live = '';
    for (let i = 0; i < buffer.length; i++) {
      const tail = buffer.slice(i);
      if (CHEAT_CODES.some((code) => code.startsWith(tail))) { live = tail; break; }
    }
    game.cheatBuffer = live;

    if (CHEATS[live]) {
      game.cheatBuffer = '';
      game.audio.cheat();
      CHEATS[live](game);
      return 'fired';
    }

    return live ? 'prefix' : 'none';
  }

  function bindInput(game) {
    const KEYS = {
      KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
      ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
      Space: 'up', ControlLeft: 'down', KeyC: 'down', ShiftLeft: 'sprint',
      KeyX: 'scan'
    };

    window.addEventListener('keydown', (e) => {
      if (KEYS[e.code] !== undefined) { game.input[KEYS[e.code]] = true; e.preventDefault(); }
      const cheat = (e.key && e.key.length === 1)
        ? checkCheat(game, e.key.toLowerCase())
        : 'none';

      // A letter part-way through a cheat code belongs to the code, not to
      // whatever it is normally bound to.
      if (cheat === 'none') {
        switch (e.code) {
          case 'KeyE': game.player.interact(); break;
          case 'KeyF': game.player.toggleFlashlight(); break;
          case 'KeyH': game.player.useMedkit(); break;
          case 'KeyG': game.player.dropBeacon(); break;
          case 'KeyB': game.player.throwBait(); break;
          case 'KeyV': game.player.useRepel(); break;
          case 'KeyI':
            e.preventDefault();
            game.toggleIndex();
            break;
          case 'KeyR': if (game.player.dead) game.player.respawn(); break;
          case 'KeyM':
            game.audio.setMuted(!game.audio.muted);
            game.hud.showMuted(game.audio.muted);
            break;
        }
      }

      switch (e.code) {
        case 'Tab':
          e.preventDefault();
          game.toggleFabricator();
          break;
        case 'Escape':
          // Esc always pauses and hands the cursor back, in either look mode.
          // Browsers release pointer lock on Esc themselves, but doing it here
          // too means pausing never depends on that happening.
          if (game.started && !game.fabricatorOpen && !game.paused) game.togglePause(true);
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      if (KEYS[e.code] !== undefined) { game.input[KEYS[e.code]] = false; e.preventDefault(); }
    });

    // Losing focus should not leave the diver swimming into the dark.
    window.addEventListener('blur', () => {
      for (const key of Object.keys(game.input)) game.input[key] = false;
    });

    // --- Looking around -------------------------------------------------------
    //
    // With pointer lock the cursor is captured and every mousemove is a raw
    // delta. Without it the cursor stays on screen, so looking is done by
    // dragging - and a click that did not drag is still a knife swing.

    let dragging = false;
    let dragDistance = 0;

    const isLocked = () => document.pointerLockElement === game.canvas;

    document.addEventListener('mousemove', (e) => {
      if (game.paused) return;

      if (isLocked()) {
        game.player.look(e.movementX, e.movementY);
      } else if (dragging && game.lookMode === 'drag') {
        const dx = e.movementX || 0;
        const dy = e.movementY || 0;
        dragDistance += Math.abs(dx) + Math.abs(dy);
        game.player.look(dx, dy);
      }
    });

    game.canvas.addEventListener('mousedown', (e) => {
      if (!game.started || game.paused) return;

      if (isLocked()) {
        if (e.button === 0) game.player.swing();
        return;
      }

      if (game.lookMode === 'drag') {
        dragging = true;
        dragDistance = 0;
        e.preventDefault();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (!dragging) return;
      dragging = false;
      // A press that barely moved was aimed at something, not a look.
      if (e.button === 0 && dragDistance < 6 && !game.paused) game.player.swing();
    });

    // Right-drag should not open the context menu mid-look.
    game.canvas.addEventListener('contextmenu', (e) => {
      if (game.lookMode === 'drag' && game.started) e.preventDefault();
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = isLocked();
      document.body.classList.toggle('is-paused', !locked && game.started);

      if (locked) {
        clearTimeout(game._lockCheck);
        game.lookMode = 'pointerlock';
        document.body.classList.remove('is-drag-look');
        game.paused = false;
        document.getElementById('pauseScreen').classList.remove('is-visible');
        game.updateCursor();
        return;
      }

      for (const key of Object.keys(game.input)) game.input[key] = false;

      // Losing the lock means Esc, or the window lost focus. Either way: pause,
      // free the cursor, and wait for a click. Drag-look never pauses this way,
      // because it never held the cursor in the first place.
      if (game.lookMode === 'pointerlock' && game.started
        && !game.fabricatorOpen && !game.indexOpen) {
        game.togglePause(true);
      }
    });

    window.addEventListener('resize', () => game.resize());
  }

  function boot() {
    const canvas = document.getElementById('scene');

    if (!window.THREE) {
      document.getElementById('loadError').classList.add('is-visible');
      return;
    }

    const game = new Game(canvas);
    window.SL.game = game;

    // A world is generated straight away so the menu sits over a living ocean
    // rather than a black screen. Picking a world replaces it.
    game.build(SL.newSeed());
    bindInput(game);
    game.loop(performance.now());
    document.body.classList.add('is-ready');

    SL.Menu.init(game);
    SL.Menu.open(game);

    // --- Pause menu -----------------------------------------------------------
    const pauseScreen = document.getElementById('pauseScreen');

    document.getElementById('resumeButton').addEventListener('click', () => {
      pauseScreen.classList.remove('is-visible');
      game.enter();
    });

    document.getElementById('saveButton').addEventListener('click', () => {
      game.saveWorld({ announce: true });
    });

    document.getElementById('quitButton').addEventListener('click', () => {
      game.quitToMenu();
    });

    document.getElementById('keepDivingButton').addEventListener('click', () => {
      game.closeCompletion(false);
    });

    document.getElementById('leaveCompleteButton').addEventListener('click', () => {
      game.closeCompletion(true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.SL);
