/**
 * Boots the game: renderer, scene, world generation, input and the frame loop.
 */
(function (SL) {
  'use strict';

  /** Distance past which creatures stop being drawn and think at a lower rate. */
  const CULL_DISTANCE = 70;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.time = 0;
      this.running = false;
      this.started = false;

      this.fish = [];
      this.stalkers = [];
      this.scrap = [];

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
        })
      };

      this.audio = new SL.Audio();
      this.input = {
        forward: false, back: false, left: false, right: false,
        up: false, down: false, sprint: false
      };

      this.scrapTimer = 20;
      this._tmp = new THREE.Vector3();
    }

    build() {
      const started = performance.now();

      SL.World.buildLighting(this);
      SL.World.buildTerrain(this);
      SL.World.buildWaterSurface(this);
      const plants = SL.World.scatterFlora(this);
      SL.World.scatterScrap(this);

      this.player = new SL.Player(this);
      this.hud = new SL.Hud(this);

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
      this.canvas.requestPointerLock();
    }

    update(dt) {
      this.time += dt;

      this.player.update(dt, this.input);

      const playerPos = this.player.position;

      // Creatures past the fog are neither drawn nor stepped at full rate.
      for (const fish of this.fish) {
        const far = fish.position.distanceToSquared(playerPos) > CULL_DISTANCE * CULL_DISTANCE;
        fish.object.visible = !far;
        if (far && !fish.dead && (this.frame & 3) !== 0) continue;
        fish.update(far ? dt * 4 : dt);
      }

      // Stalkers always think - one hunting you from out in the murk is the point.
      for (const stalker of this.stalkers) {
        stalker.object.visible = stalker.position.distanceToSquared(playerPos) < 1.8 * CULL_DISTANCE * CULL_DISTANCE;
        stalker.update(dt);
      }

      for (let i = this.scrap.length - 1; i >= 0; i--) this.scrap[i].update(dt);

      this.scrapTimer -= dt;
      if (this.scrapTimer <= 0) { this.scrapTimer = 20; SL.World.replenishScrap(this); }

      SL.World.updateAmbience(this, dt);
      this.hud.update(dt);
    }

    loop(now) {
      requestAnimationFrame((t) => this.loop(t));

      const dt = Math.min((now - (this.lastFrame || now)) / 1000, 0.05);
      this.lastFrame = now;
      this.frame = (this.frame || 0) + 1;

      if (dt > 0) this.update(dt);
      this.renderer.render(this.scene, this.camera);
    }

    resize() {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------

  function bindInput(game) {
    const KEYS = {
      KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right',
      ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right',
      Space: 'up', ControlLeft: 'down', KeyC: 'down', ShiftLeft: 'sprint'
    };

    window.addEventListener('keydown', (e) => {
      if (KEYS[e.code] !== undefined) { game.input[KEYS[e.code]] = true; e.preventDefault(); }

      switch (e.code) {
        case 'KeyE': game.player.interact(); break;
        case 'KeyF': game.player.toggleFlashlight(); break;
        case 'KeyR': if (game.player.dead) game.player.respawn(); break;
        case 'KeyM':
          game.audio.setMuted(!game.audio.muted);
          game.hud.showMuted(game.audio.muted);
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

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === game.canvas) {
        game.player.look(e.movementX, e.movementY);
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (document.pointerLockElement === game.canvas && e.button === 0) game.player.swing();
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === game.canvas;
      const paused = !locked && game.started && !game.player.dead;
      document.body.classList.toggle('is-paused', !locked && game.started);
      document.getElementById('pauseScreen').classList.toggle('is-visible', paused);
      if (!locked) for (const key of Object.keys(game.input)) game.input[key] = false;
    });

    window.addEventListener('resize', () => game.resize());
  }

  function boot() {
    const canvas = document.getElementById('scene');
    const title = document.getElementById('titleScreen');
    const pauseScreen = document.getElementById('pauseScreen');

    if (!window.THREE) {
      document.getElementById('loadError').classList.add('is-visible');
      return;
    }

    const game = new Game(canvas);
    window.SL.game = game;

    game.build();
    bindInput(game);
    game.loop(performance.now());

    // The ocean is already rendering behind the title card.
    document.body.classList.add('is-ready');

    const enter = () => {
      title.classList.remove('is-visible');
      pauseScreen.classList.remove('is-visible');
      game.enter();
    };

    title.addEventListener('click', enter);
    pauseScreen.addEventListener('click', () => {
      pauseScreen.classList.remove('is-visible');
      game.enter();
    });
    window.addEventListener('keydown', function once(e) {
      if (e.code === 'Enter' && !game.started) { enter(); window.removeEventListener('keydown', once); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.SL);
