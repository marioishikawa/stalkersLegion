/**
 * Saved worlds.
 *
 * A world is a seed plus what the diver has done in it. The seed regenerates
 * the entire ocean - terrain, kelp, scrap, creatures - so a save is small and a
 * returning player gets the same sea floor back, not a fresh one.
 *
 * Storage tries the artifact's own database first, so worlds follow the player
 * rather than living in one browser profile. Where that is unavailable - the
 * page opened as a local file, or the capability not granted - it falls back to
 * localStorage, and where even that fails it keeps worlds in memory for the
 * session. The game never blocks on any of it.
 */
(function (SL) {
  'use strict';

  const COLLECTION = 'worlds';
  const LOCAL_KEY = 'stalkersLegion.worlds';

  let db = null;
  let backend = 'memory';
  let memory = {};

  function readLocal() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function writeLocal(worlds) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(worlds));
      return true;
    } catch (e) {
      return false;
    }
  }

  const Saves = {
    get backend() { return backend; },

    /** Resolves once storage has been chosen. Safe to call more than once. */
    async init() {
      if (this._ready) return this._ready;

      this._ready = (async () => {
        try {
          if (window.claude && typeof window.claude.use === 'function') {
            db = await window.claude.use('db');
          }
        } catch (e) {
          db = null;
        }

        if (db) {
          backend = 'cloud';
        } else {
          memory = readLocal();
          backend = writeLocal(memory) ? 'local' : 'memory';
        }
      })();

      return this._ready;
    },

    /** Every saved world, newest first. */
    async list() {
      await this.init();

      if (db) {
        try {
          const snapshot = await db.collection(COLLECTION).get();
          return snapshot.docs
            .map((d) => Object.assign({ id: d.id }, d.data()))
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        } catch (e) {
          return [];
        }
      }

      return Object.values(memory).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },

    async get(id) {
      await this.init();

      if (db) {
        try {
          const snapshot = await db.doc(COLLECTION + '/' + id).get();
          return snapshot.exists ? Object.assign({ id }, snapshot.data()) : null;
        } catch (e) {
          return null;
        }
      }

      return memory[id] || null;
    },

    async put(world) {
      await this.init();
      world.updatedAt = Date.now();

      if (db) {
        try {
          const body = Object.assign({}, world);
          delete body.id;                       // the id is the document path
          await db.doc(COLLECTION + '/' + world.id).set(body);
          return true;
        } catch (e) {
          return false;
        }
      }

      memory[world.id] = world;
      if (backend === 'local') writeLocal(memory);
      return true;
    },

    async remove(id) {
      await this.init();

      if (db) {
        try {
          await db.doc(COLLECTION + '/' + id).delete();
          return true;
        } catch (e) {
          return false;
        }
      }

      delete memory[id];
      if (backend === 'local') writeLocal(memory);
      return true;
    },

    /** A blank world record. */
    create(name) {
      return {
        id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
        name: (name || '').trim() || 'Untitled Reef',
        seed: SL.newSeed(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        playtime: 0,
        biome: 'Safe Shallows',
        depth: 0,
        deaths: 0,
        player: null,
        crafting: null
      };
    },

    /** Reads the live game into a world record. */
    capture(world, game) {
      const p = game.player;

      world.playtime = Math.round(game.worldTime || 0);
      world.biome = p.biome.name;
      world.depth = +p.depth.toFixed(1);
      world.player = {
        x: +p.position.x.toFixed(2), y: +p.position.y.toFixed(2), z: +p.position.z.toFixed(2),
        yaw: +p.yaw.toFixed(3), pitch: +p.pitch.toFixed(3),
        health: +p.health.toFixed(1), oxygen: +p.oxygen.toFixed(1)
      };
      // What has been catalogued, and whether the bond has been earned, belong
      // to the world just as much as the gear does.
      world.scanned = Object.assign({}, SL.Index.scanned);
      world.pet = game.pets.length > 0 || game.petRespawn > 0;

      world.crafting = {
        inventory: Object.assign({}, SL.Crafting.inventory),
        stacks: Object.assign({}, SL.Crafting.stacks),
        built: Object.assign({}, SL.Crafting.built)
      };
      return world;
    },

    /**
     * Writes a world record back onto the live game. Crafted gear is re-applied
     * from the recipe list rather than stored as numbers, so a save made before
     * a recipe was retuned still gets that recipe's current effect.
     */
    restore(world, game) {
      const p = game.player;
      game.worldTime = world.playtime || 0;

      SL.Index.reset();
      if (world.scanned) Object.assign(SL.Index.scanned, world.scanned);
      if (world.pet && !game.pets.length) SL.Pet.spawn(game);

      SL.Crafting.reset();
      if (world.crafting) {
        Object.assign(SL.Crafting.inventory, world.crafting.inventory || {});
        Object.assign(SL.Crafting.stacks, world.crafting.stacks || {});
        for (const recipe of SL.Crafting.recipes) {
          if (world.crafting.built && world.crafting.built[recipe.id]) {
            SL.Crafting.built[recipe.id] = true;
            if (recipe.apply) recipe.apply(p);
          }
        }
      }

      if (world.player) {
        p.position.set(world.player.x, world.player.y, world.player.z);
        p.yaw = world.player.yaw;
        p.pitch = world.player.pitch;
        p.health = Math.min(world.player.health, p.maxHealth);
        p.oxygen = Math.min(world.player.oxygen, p.maxOxygen);
        p.velocity.set(0, 0, 0);
      }
    }
  };

  SL.Saves = Saves;
})(window.SL);
