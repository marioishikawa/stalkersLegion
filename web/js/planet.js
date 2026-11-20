/**
 * Which planet a world is on.
 *
 * 1 - Legion, the Rustjaw Legion's own sea, where the game starts.
 * 2 - Vireth, where the second ship comes down: a hot world, red and orange
 *     and yellow, with its own places and its own animals. Of everything from
 *     Legion only the rustjaw made it there.
 * 3 - Earth, home: a real sea, a little town, and a fisherman.
 *
 * A world's planet is set before its ocean is generated. Everything that asks
 * which species exist, which ones count for the databank, what a place is
 * called and what colour its water is goes through here.
 */
(function (SL) {
  'use strict';

  const NAMES = { 1: 'Legion', 2: 'Vireth', 3: 'Earth' };
  const EARTH = 3;

  const C = (r, g, b) => new THREE.Color(r, g, b);

  /**
   * Vireth's places. The sea floor has the same shape - a shelf, a kelp-like
   * forest, a plateau, seamounts, a trench - but every one of them is a
   * different place there, with its own name and its own hot colours.
   */
  const VIRETH = {
    shallows: { name: 'Ember Flats', water: C(0.42, 0.24, 0.10), floor: C(0.86, 0.56, 0.30) },
    kelp: { name: 'Scorchweed Forest', water: C(0.36, 0.16, 0.06), floor: C(0.58, 0.30, 0.14) },
    plateau: { name: 'Ash Plateau', water: C(0.34, 0.20, 0.10), floor: C(0.54, 0.48, 0.42) },
    coral: { name: 'Magma Reef', water: C(0.44, 0.14, 0.06), floor: C(0.70, 0.20, 0.10) },
    boulders: { name: 'Slag Slope', water: C(0.26, 0.12, 0.06), floor: C(0.30, 0.22, 0.18) },
    crystal: { name: 'Sulphur Caverns', water: C(0.34, 0.30, 0.06), floor: C(0.80, 0.70, 0.18) },
    trench: { name: 'Burning Trench', water: C(0.20, 0.04, 0.02), floor: C(0.24, 0.06, 0.04) },
    kings: { name: 'Cinder Basin', water: C(0.22, 0.10, 0.04), floor: C(0.26, 0.18, 0.12) },
    farkelp: { name: 'Flare Forest', water: C(0.46, 0.26, 0.06), floor: C(0.72, 0.50, 0.16) },
    abyss: { name: 'Smoulder Plain', water: C(0.16, 0.06, 0.04), floor: C(0.24, 0.12, 0.08) },
    coldreef: { name: 'Ochre Reef', water: C(0.30, 0.18, 0.06), floor: C(0.66, 0.46, 0.18) },
    vents: { name: 'Boiling Field', water: C(0.42, 0.10, 0.02), floor: C(0.18, 0.08, 0.06) },
    islet: { name: 'Volcano Isle', water: C(0.48, 0.26, 0.10), floor: C(0.40, 0.22, 0.16) },
    meadow: { name: 'Saffron Meadow', water: C(0.46, 0.34, 0.08), floor: C(0.86, 0.64, 0.16) },
    tentacles: { name: 'Lash Grounds', water: C(0.40, 0.12, 0.10), floor: C(0.62, 0.22, 0.20) }
  };

  /** Everything not listed above on Vireth still gets the heat. */
  const HOT = { water: C(0.40, 0.18, 0.06), floor: C(0.70, 0.42, 0.20) };

  let originals = null;

  const Planet = {
    current: 1,

    get name() { return NAMES[this.current] || 'Legion'; },
    nameOf(n) { return NAMES[n] || 'Legion'; },

    /** The little bright fish the sharks hunt, which differs from planet to planet. */
    get prey() { return this.current === 2 ? 'redglimmer' : this.current === EARTH ? 'goldfish' : 'glimmerfin'; },

    /** Whether this world is Earth. */
    get onEarth() { return this.current === EARTH; },
    /** Whether this world is Vireth. */
    get onVireth() { return this.current === 2; },
    EARTH,

    /** Whether a species is missing from the planet this world is on. */
    absent(species) {
      // A species lives on the planets it lists - by default only Legion.
      const on = (species && species.planets) || [1];
      return on.indexOf(this.current) < 0;
    },

    /** Switches to a planet: call before the ocean is built. */
    set(n) {
      this.current = NAMES[n] ? n : 1;
      if (!SL.Biomes) return;
      if (!originals) {
        originals = SL.Biomes.list.map((b) => ({ water: b.waterColor.clone(), floor: b.floorColor.clone(), name: b.name }));
      }
      SL.Biomes.list.forEach((b, i) => {
        const o = originals[i];
        if (!o) return;
        b.waterColor.copy(o.water);
        b.floorColor.copy(o.floor);
        b.name = o.name;
        if (this.current === 2) {
          const v = VIRETH[b.id] || HOT;
          if (v.name) b.name = v.name;
          b.waterColor.copy(v.water);
          b.floorColor.copy(v.floor);
        }
      });
    }
  };

  SL.Planet = Planet;
})(window.SL);
