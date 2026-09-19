/**
 * The teleport, which is a cheat and looks like one.
 *
 * Typing `teletransportsus` while diving opens a box you write a place into.
 * The places are not a hardcoded list of coordinates - they are read off the
 * world every time the box opens, so they are whatever this world actually
 * has: its biomes, its landmarks, the leviathans still alive in it, and the
 * beacons the diver planted themselves.
 *
 * Matching is deliberately forgiving. Nobody is going to type "Kelper's Reach"
 * with the apostrophe in the right place, so names are stripped to letters and
 * digits and then tried four ways - exact, then prefix, then contained, then
 * containing - which means "kelp", "kelpers reach" and "the kelpers reach" all
 * arrive at the same forest.
 */
(function (SL) {
  'use strict';

  /** A typed name, reduced to the part worth comparing. */
  function key(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Somewhere safe to arrive, given a point on the map.
   *
   * Two things to not do: materialise inside the sea floor, and materialise
   * inside the islet, which is the one piece of ground that comes out of the
   * water. Dry ground is stood on; everything else is swum over.
   */
  function arriveAt(x, z, clearance) {
    const floor = SL.Biomes.floorHeightAt(x, z);
    const lid = SL.WATER_LEVEL - 1.2;
    if (floor > lid - 0.6) return { x, y: floor + 1.2, z };
    return { x, y: Math.min(floor + (clearance || 4), lid), z };
  }

  /** Off to one side of an animal, far enough out to see all of it. */
  function besideCreature(creature) {
    const p = creature.position;
    const reach = Math.max(14, creature.bodyLength * 1.6);
    const angle = SL.random() * Math.PI * 2;
    const x = p.x + Math.cos(angle) * reach;
    const z = p.z + Math.sin(angle) * reach;

    const floor = SL.Biomes.floorHeightAt(x, z);
    const lid = Math.max(SL.WATER_LEVEL - 1.2, floor + 1.6);
    return { x, y: SL.clamp(p.y + 2, floor + 1.6, lid), z };
  }

  /**
   * Everywhere this world can send you, in the order it is offered.
   *
   * Leviathans come first so that a one-word guess lands on the animal rather
   * than on the water it lives in - "diamond" is far more likely to mean the
   * thing that can kill you than the caverns it does it in.
   */
  function placesIn(game) {
    const places = [];
    const add = (name, hint, at, aliases) => places.push({
      name, hint, at, keys: [key(name)].concat((aliases || []).map(key))
    });

    // --- The leviathans that are still out there ------------------------------
    for (const lev of game.leviathans()) {
      if (lev.dead) continue;
      const short = lev.species.name.replace(' Leviathan', '');
      add(lev.species.name, 'leviathan', () => besideCreature(lev), [short]);
    }

    // --- Biomes ---------------------------------------------------------------
    const BIOME_ALIASES = {
      shallows: ['shallows', 'safe'],
      kelp: ['kelp', 'forest'],
      plateau: ['plateau', 'grass', 'grassy'],
      coral: ['coral', 'reef', 'seamount'],
      boulders: ['boulders', 'rubble', 'slope'],
      crystal: ['crystal', 'caverns', 'cave', 'caves'],
      trench: ['trench', 'canyon', 'deep'],
      kings: ['kings', 'basin', 'kingsbasin'],
      farkelp: ['farkelp', 'reach', 'farforest'],
      abyss: ['abyss', 'abyssal', 'plain'],
      islet: ['islet', 'island', 'isle', 'beach']
    };

    for (const biome of SL.Biomes.list) {
      add(biome.name, 'biome', () => {
        // A spawn point carries up to half an index cell of jitter, which on a
        // boundary is enough to put you in the biome next door - ask for the
        // abyss and arrive in the canyon that cuts through it. Checked, because
        // the whole job of this thing is to take you where you said.
        let point = null;
        for (let attempt = 0; attempt < 10 && !point; attempt++) {
          const candidate = SL.Biomes.randomPointIn(biome);
          if (!candidate) break;
          if (SL.Biomes.biomeAt(candidate.x, candidate.z) === biome) point = candidate;
        }
        point = point || SL.Biomes.randomPointIn(biome);
        return point ? arriveAt(point.x, point.z, 5) : null;
      }, BIOME_ALIASES[biome.id]);
    }

    // --- Landmarks ------------------------------------------------------------
    const islet = SL.Biomes.islet;
    if (islet) {
      add('The Island Summit', 'dry land',
        () => arriveAt(islet.x, islet.z, 3), ['summit', 'top', 'sand', 'dryland']);
    }

    const ground = SL.Biomes.whaleGround;
    if (ground) {
      add('The Whale Ground', 'open water',
        () => arriveAt(ground.x, ground.z, 26), ['whaleground', 'whales']);
    }

    const bank = SL.Biomes.farBank;
    if (bank) {
      add('The Far Bank', 'plateau out of the abyss',
        () => arriveAt(bank.x, bank.z, 8), ['farbank', 'bank']);
    }

    // --- Where you started, and straight up and down --------------------------
    add('Home', 'where the dive began',
      () => arriveAt(0, 0, 2), ['start', 'spawn', 'origin', 'zero']);

    add('The Surface', 'straight up from here', () => {
      const p = game.player.position;
      return { x: p.x, y: SL.WATER_LEVEL - 0.8, z: p.z };
    }, ['up', 'air', 'top', 'surface']);

    add('The Sea Floor', 'straight down from here', () => {
      const p = game.player.position;
      return arriveAt(p.x, p.z, 1.6);
    }, ['down', 'bottom', 'floor', 'seafloor']);

    // --- The diver's own markers ----------------------------------------------
    game.beacons.forEach((beacon, i) => {
      const name = 'Beacon ' + (i + 1);
      add(name, 'your marker', () => {
        const p = beacon.position;
        return arriveAt(p.x, p.z, Math.max(2, SL.WATER_LEVEL - p.y > 0 ? -p.y + 2 : 3));
      }, ['beacon' + (i + 1)]);
    });

    return places;
  }

  /**
   * How many single-letter changes turn one word into the other.
   *
   * Two rows of a Levenshtein table, because the words are short and this runs
   * against every name every time someone presses Enter.
   */
  function distance(a, b) {
    if (a === b) return 0;
    if (!a.length || !b.length) return Math.max(a.length, b.length);

    let previous = [];
    for (let j = 0; j <= b.length; j++) previous[j] = j;

    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) {
        row[j] = Math.min(
          previous[j] + 1,
          row[j - 1] + 1,
          previous[j - 1] + (a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1));
      }
      previous = row;
    }
    return previous[b.length];
  }

  /** The best place for what was typed, or null. */
  function find(places, text) {
    const want = key(text);
    if (!want) return null;

    const tests = [
      (k) => k === want,
      (k) => k.indexOf(want) === 0,
      (k) => k.indexOf(want) >= 0,
      (k) => k.length > 2 && want.indexOf(k) >= 0
    ];

    for (const test of tests) {
      const hit = places.find((place) => place.keys.some(test));
      if (hit) return hit;
    }

    // Nothing contains anything, so try spelling. "abbys" is the abyss and
    // everybody knows it; a third of the word may be wrong before this gives
    // up, which is loose enough for a typo and tight enough that a place that
    // is simply not here still says so.
    const slack = Math.max(1, Math.ceil(want.length / 3));
    let best = null;
    let bestGap = Infinity;

    for (const place of places) {
      for (const k of place.keys) {
        if (!k) continue;
        const gap = distance(want, k);
        if (gap <= slack && gap < bestGap) { bestGap = gap; best = place; }
      }
    }
    return best;
  }

  const Travel = {
    open(game) {
      if (!game.started || game.player.dead) return;

      this.el = this.el || {
        screen: document.getElementById('travelScreen'),
        input: document.getElementById('travelInput'),
        list: document.getElementById('travelList'),
        feedback: document.getElementById('travelFeedback')
      };
      if (!this.el.screen) return;

      // Read the world now, not at load: which leviathans are alive and how
      // many beacons are planted is a thing about this moment.
      this.places = placesIn(game);

      game.travelOpen = true;
      game.setPaused(true);
      // Anything held down when the box opened would still be held when it
      // closes, and the diver would swim off on their own.
      for (const held of Object.keys(game.input)) game.input[held] = false;

      this.el.screen.classList.add('is-visible');
      this.el.feedback.textContent = '';
      this.el.input.value = '';
      this.render(game, '');
      game.updateCursor();

      if (document.pointerLockElement) document.exitPointerLock();
      setTimeout(() => this.el.input.focus(), 0);

      if (!this.bound) {
        this.bound = true;
        this.el.input.addEventListener('input', () => this.render(game, this.el.input.value));
        this.el.input.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') { e.preventDefault(); this.go(game, this.el.input.value); }
          else if (e.key === 'Escape') { e.preventDefault(); this.close(game); }
        });
      }
    },

    close(game) {
      if (!game.travelOpen) return;
      game.travelOpen = false;
      if (this.el && this.el.screen) this.el.screen.classList.remove('is-visible');
      game.enter();
    },

    /** The list under the box, filtered by whatever has been typed so far. */
    render(game, text) {
      const want = key(text);
      const shown = this.places.filter((place) =>
        !want || place.keys.some((k) => k.indexOf(want) >= 0 || want.indexOf(k) >= 0));

      this.el.list.innerHTML = '';
      for (const place of shown.slice(0, 40)) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'travel__row';
        row.innerHTML = '<span class="travel__name"></span><span class="travel__hint"></span>';
        row.querySelector('.travel__name').textContent = place.name;
        row.querySelector('.travel__hint').textContent = place.hint;
        row.addEventListener('click', () => this.jump(game, place));
        this.el.list.appendChild(row);
      }

      if (!shown.length) {
        const empty = document.createElement('p');
        empty.className = 'fabricator__hint';
        empty.textContent = 'Nowhere by that name.';
        this.el.list.appendChild(empty);
      }
    },

    go(game, text) {
      const place = find(this.places, text);
      if (!place) {
        this.el.feedback.textContent = 'Nowhere called "' + text.trim() + '". Try a biome, a leviathan, or a beacon.';
        return;
      }
      this.jump(game, place);
    },

    jump(game, place) {
      const at = place.at();
      if (!at) {
        this.el.feedback.textContent = 'This world has no ' + place.name + '.';
        return;
      }

      const p = game.player;
      p.position.set(at.x, at.y, at.z);
      // Arriving with the last of your swimming still in you would fire you
      // straight back out of wherever you asked to be put.
      p.velocity.set(0, 0, 0);

      this.close(game);
      game.audio.cheat();
      game.hud.toast('CHEAT — ' + place.name);
    }
  };

  SL.Travel = Travel;
})(window.SL);
