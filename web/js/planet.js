/**
 * Which planet a world is on.
 *
 * Planet one is home - the sea the game starts in. Planet two is Vireth, the
 * water world the second ship comes down on after NASA builds it: the same
 * kind of ocean, rustjaws and all, but the water is a strange violet, the sand
 * is pinker, and some of the fish that live at home simply do not live there.
 * The Glimmerfin is the one everybody notices is missing.
 *
 * A world's planet is set before its ocean is generated. Everything that asks
 * which species exist, which ones count for the databank, and what colour the
 * water is goes through here.
 */
(function (SL) {
  'use strict';

  /** Home fish that never made it to Vireth. */
  const ABSENT = {
    // The Red Glimmer lives only on Vireth.
    1: ['redglimmer'],
    2: ['glimmerfin', 'bluefish', 'bluefat', 'fatfish', 'finfish', 'oscar', 'redfish',
      'darter', 'nibbler', 'emberfin']
  };

  const NAMES = { 1: 'Earth', 2: 'Vireth' };

  /** How each planet tints the water and the sand, from home's colours. */
  const TINT = {
    2: { water: new THREE.Color(0.30, 0.06, 0.38), waterMix: 0.78,
      floor: new THREE.Color(0.66, 0.34, 0.58), floorMix: 0.5 }
  };

  let originals = null;

  const Planet = {
    current: 1,

    get name() { return NAMES[this.current] || 'Earth'; },
    nameOf(n) { return NAMES[n] || 'Earth'; },

    /** The little bright fish the sharks hunt, which differs from planet to planet. */
    get prey() { return this.current === 2 ? 'redglimmer' : 'glimmerfin'; },

    /** Whether a species is missing from the planet this world is on. */
    absent(species) {
      const list = ABSENT[this.current];
      return !!(list && species && list.indexOf(species.id) >= 0);
    },

    /** Switches to a planet: call before the ocean is built. */
    set(n) {
      this.current = NAMES[n] ? n : 1;
      if (!SL.Biomes) return;
      if (!originals) {
        originals = SL.Biomes.list.map((b) => ({ water: b.waterColor.clone(), floor: b.floorColor.clone() }));
      }
      const tint = TINT[this.current];
      SL.Biomes.list.forEach((b, i) => {
        const o = originals[i];
        if (!o) return;
        b.waterColor.copy(o.water);
        b.floorColor.copy(o.floor);
        if (tint) {
          b.waterColor.lerp(tint.water, tint.waterMix);
          b.floorColor.lerp(tint.floor, tint.floorMix);
        }
      });
    }
  };

  SL.Planet = Planet;
})(window.SL);
