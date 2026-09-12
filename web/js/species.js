/**
 * Every creature in the game, as data.
 *
 * Each entry is a set of numbers the body builder grows a mesh from, so two
 * species are genuinely different animals rather than recoloured copies. All
 * lengths are metres, speeds metres/second.
 */
(function (SL) {
  'use strict';

  const C = (r, g, b) => new THREE.Color(r, g, b);

  /** Shared defaults, so each entry below only states what makes it different. */
  function fish(id, name, biome, profile, overrides) {
    return Object.assign({
      id, name, biome, profile,
      diet: 'grazer',
      maxHealth: 14,
      cruiseSpeed: 1.7,
      sprintSpeed: 4.2,
      turnRate: 2.4,          // radians/second
      senseRadius: 11,
      schoolSize: 7,
      groups: 4,
      altitude: 3.5,          // preferred metres above the floor
      wagRate: 7,
      biteDamage: 0,
      glow: 0,
      eyeColor: C(0.02, 0.02, 0.03),
      shape: {}
    }, overrides, { shape: Object.assign({
      length: 0.4, height: 0.28, width: 0.14,
      bellyPosition: 0.35, crossSection: 2, noseSharpness: 0.5,
      tailHeight: 0.35, tailSweep: 0.25, tailFork: 0.4,
      dorsalFin: 0.18, ventralFin: 0, sideFin: 0.12,
      eyeSize: 0.05, stripes: 0, backSpikes: 0, jawLength: 0,
      spineSegments: 14, radialSegments: 10
    }, overrides.shape) });
  }

  const SPECIES = [
    // ------------------------------------------------------------- Safe Shallows
    fish('glimmerfin', 'Glimmerfin', 'shallows', 'torpedo', {
      // Small, quick, mirror-bright. The first fish you ever see.
      backColor: C(0.35, 0.72, 0.85), bellyColor: C(0.95, 0.96, 0.90), finColor: C(0.95, 0.78, 0.30),
      schoolSize: 10, groups: 6,
      shape: { length: 0.26, height: 0.26, width: 0.11, noseSharpness: 0.55, tailFork: 0.55, stripes: 4, sideFin: 0.11 }
    }),
    fish('bubblepeep', 'Bubblepeep', 'shallows', 'bulb', {
      // Round, slow, comically wide-eyed. Easy knife practice.
      backColor: C(0.95, 0.55, 0.18), bellyColor: C(1.0, 0.92, 0.70), finColor: C(1.0, 0.80, 0.45),
      cruiseSpeed: 1.2, sprintSpeed: 3.0, schoolSize: 4, groups: 4, wagRate: 5,
      shape: { length: 0.34, height: 0.34, width: 0.30, bellyPosition: 0.34, noseSharpness: 0.1,
               crossSection: 2.2, tailHeight: 0.26, tailFork: 0.15, dorsalFin: 0.10, sideFin: 0.16, eyeSize: 0.095 }
    }),

    // -------------------------------------------------------------- Kelp Forest
    fish('bladefish', 'Bladefish', 'kelp', 'ribbon', {
      // Tall, flat and green - hides edge-on between kelp stalks.
      backColor: C(0.16, 0.42, 0.14), bellyColor: C(0.72, 0.80, 0.45), finColor: C(0.28, 0.55, 0.20),
      maxHealth: 18, schoolSize: 5, groups: 5, altitude: 5, wagRate: 4.5,
      shape: { length: 0.58, height: 0.30, width: 0.045, bellyPosition: 0.30, noseSharpness: 0.7,
               tailHeight: 0.24, tailSweep: 0.30, tailFork: 0.10, dorsalFin: 0.22, ventralFin: 0.16,
               sideFin: 0.08, eyeSize: 0.035, spineSegments: 18 }
    }),
    fish('darter', 'Kelp Darter', 'kelp', 'arrow', {
      // Needle-nosed sprinter. Bolts the instant anything looks at it.
      backColor: C(0.38, 0.46, 0.16), bellyColor: C(0.88, 0.90, 0.72), finColor: C(0.55, 0.62, 0.25),
      cruiseSpeed: 2.3, sprintSpeed: 5.6, turnRate: 3.4, schoolSize: 9, groups: 5, wagRate: 9,
      shape: { length: 0.40, height: 0.17, width: 0.10, bellyPosition: 0.42, noseSharpness: 0.95,
               tailHeight: 0.34, tailFork: 0.75, dorsalFin: 0.10, sideFin: 0.10, eyeSize: 0.04, stripes: 2 }
    }),

    // ----------------------------------------------------------- Grassy Plateau
    fish('spadefin', 'Spadefin', 'plateau', 'disc', {
      // Wafer-thin disc that turns sideways when it flees.
      backColor: C(0.12, 0.55, 0.55), bellyColor: C(0.93, 0.95, 0.88), finColor: C(0.10, 0.35, 0.42),
      schoolSize: 6, groups: 5,
      shape: { length: 0.44, height: 0.52, width: 0.06, bellyPosition: 0.42, noseSharpness: 0.35,
               tailHeight: 0.28, tailFork: 0.30, dorsalFin: 0.26, ventralFin: 0.24, sideFin: 0.13, stripes: 3 }
    }),
    fish('nibbler', 'Grass Nibbler', 'plateau', 'diamond', {
      // Angular grazer with hard shoulders; noses through the grass.
      backColor: C(0.45, 0.25, 0.62), bellyColor: C(0.90, 0.82, 0.95), finColor: C(0.62, 0.40, 0.80),
      maxHealth: 20, cruiseSpeed: 1.4, altitude: 1.8, groups: 5,
      shape: { length: 0.36, height: 0.30, width: 0.18, bellyPosition: 0.38, noseSharpness: 0.25,
               crossSection: 2.6, tailFork: 0.45, dorsalFin: 0.20, sideFin: 0.14, eyeSize: 0.06 }
    }),

    // ----------------------------------------------------------- Red Coral Reef
    fish('emberfin', 'Emberfin', 'coral', 'diamond', {
      // Hot-coloured reef fish with a deep forked tail.
      backColor: C(0.85, 0.18, 0.10), bellyColor: C(1.0, 0.78, 0.40), finColor: C(1.0, 0.45, 0.08),
      glow: 0.15, schoolSize: 8, groups: 5,
      shape: { length: 0.32, height: 0.38, width: 0.10, bellyPosition: 0.33, noseSharpness: 0.6,
               tailHeight: 0.40, tailSweep: 0.30, tailFork: 0.80, dorsalFin: 0.24, ventralFin: 0.14, stripes: 5 }
    }),
    fish('boxfish', 'Coral Boxfish', 'coral', 'boxy', {
      // A swimming brick. Slow, armoured, unbothered.
      backColor: C(0.95, 0.82, 0.15), bellyColor: C(0.98, 0.95, 0.75), finColor: C(0.20, 0.18, 0.15),
      maxHealth: 30, cruiseSpeed: 0.95, sprintSpeed: 2.0, turnRate: 1.4, schoolSize: 3, groups: 4, wagRate: 4,
      shape: { length: 0.30, height: 0.32, width: 0.28, bellyPosition: 0.45, noseSharpness: 0.05,
               crossSection: 5, tailHeight: 0.20, tailSweep: 0.16, tailFork: 0, dorsalFin: 0.08,
               sideFin: 0.12, eyeSize: 0.07, stripes: 6, radialSegments: 8 }
    }),

    // ------------------------------------------------------------ Boulder Field
    fish('gulper', 'Stone Gulper', 'boulders', 'bulb', {
      // Heavy bottom-feeder with a huge round head.
      backColor: C(0.30, 0.30, 0.33), bellyColor: C(0.70, 0.68, 0.60), finColor: C(0.42, 0.40, 0.38),
      maxHealth: 45, cruiseSpeed: 1.1, sprintSpeed: 2.4, turnRate: 1.2,
      schoolSize: 2, groups: 6, altitude: 1.5, wagRate: 3.5,
      shape: { length: 0.72, height: 0.30, width: 0.26, bellyPosition: 0.28, noseSharpness: 0.08,
               crossSection: 2.4, tailHeight: 0.24, tailFork: 0.20, dorsalFin: 0.12, sideFin: 0.18,
               eyeSize: 0.045, backSpikes: 4, spineSegments: 16 }
    }),

    // -------------------------------------------------------------- Deep Trench
    fish('lanternjaw', 'Lanternjaw', 'trench', 'eel', {
      // Bioluminescent eel. Often the only thing you can see down there.
      backColor: C(0.10, 0.55, 0.60), bellyColor: C(0.35, 0.95, 0.90), finColor: C(0.25, 0.85, 0.80),
      eyeColor: C(0.90, 1.0, 0.55), glow: 1, maxHealth: 26, cruiseSpeed: 1.3,
      schoolSize: 3, groups: 6, altitude: 6, wagRate: 3,
      shape: { length: 0.90, height: 0.10, width: 0.075, bellyPosition: 0.20, noseSharpness: 0.30,
               tailHeight: 0.16, tailFork: 0, dorsalFin: 0.07, ventralFin: 0.05, sideFin: 0.05,
               eyeSize: 0.03, spineSegments: 22, radialSegments: 8 }
    }),
    fish('ribbon', 'Abyss Ribbon', 'trench', 'ribbon', {
      // Long violet streamer that drifts in the dark.
      backColor: C(0.30, 0.10, 0.45), bellyColor: C(0.65, 0.40, 0.95), finColor: C(0.50, 0.20, 0.75),
      glow: 0.4, maxHealth: 22, cruiseSpeed: 1.05, sprintSpeed: 2.6, turnRate: 1.1,
      schoolSize: 2, groups: 5, altitude: 9, wagRate: 2.2,
      shape: { length: 1.20, height: 0.16, width: 0.03, bellyPosition: 0.22, noseSharpness: 0.4,
               tailHeight: 0.12, tailSweep: 0.40, tailFork: 0, dorsalFin: 0.10, ventralFin: 0.08,
               sideFin: 0, eyeSize: 0.022, spineSegments: 24 }
    }),

    // ------------------------------------------------------------- The predator
    fish('stalker', 'Stalker', 'kelp', 'eel', {
      diet: 'carnivore',
      backColor: C(0.22, 0.26, 0.20), bellyColor: C(0.62, 0.60, 0.46), finColor: C(0.30, 0.34, 0.24),
      eyeColor: C(0.95, 0.85, 0.15),
      maxHealth: 130, cruiseSpeed: 2.2, sprintSpeed: 6.2, turnRate: 1.9,
      senseRadius: 30, biteDamage: 22, biteInterval: 1.8,
      schoolSize: 1, groups: 0, altitude: 4.5, wagRate: 2.6,
      shape: { length: 2.6, height: 0.115, width: 0.085, bellyPosition: 0.18, noseSharpness: 0.25,
               crossSection: 2.3, tailHeight: 0.20, tailSweep: 0.22, tailFork: 0.25,
               dorsalFin: 0.09, ventralFin: 0.05, sideFin: 0.10, eyeSize: 0.022,
               jawLength: 0.17, backSpikes: 7, spineSegments: 20, radialSegments: 10 }
    })
  ];

  const byId = {};
  SPECIES.forEach((s) => { byId[s.id] = s; });

  SL.Species = {
    list: SPECIES,
    byId,
    stalker: byId.stalker,
    ofBiome: (biomeId) => SPECIES.filter((s) => s.biome === biomeId && s.diet !== 'carnivore')
  };
})(window.SL);
