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

    fish('stingray', 'Stingray', 'plateau', 'disc', {
      // Broad wings, a whip tail, and it hugs the grass. Harmless.
      backColor: C(0.36, 0.30, 0.22), bellyColor: C(0.90, 0.86, 0.76), finColor: C(0.44, 0.37, 0.27),
      maxHealth: 40, cruiseSpeed: 1.5, sprintSpeed: 3.4, turnRate: 1.3,
      schoolSize: 2, groups: 5, altitude: 1.4, wagRate: 1.8,
      shape: { length: 1.1, height: 0.05, width: 0.62, bellyPosition: 0.36, noseSharpness: 0.55,
               crossSection: 1.6, tailHeight: 0.04, tailSweep: 0.62, tailFork: 0,
               dorsalFin: 0, ventralFin: 0, sideFin: 0, eyeSize: 0.024, spineSegments: 18 }
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

    fish('puffer', 'Cinder Puffer', 'coral', 'bulb', {
      // Spiky, ash-dark, with an ember underside. Drifts rather than swims.
      backColor: C(0.28, 0.12, 0.10), bellyColor: C(0.95, 0.42, 0.12), finColor: C(0.55, 0.22, 0.12),
      glow: 0.2, maxHealth: 26, cruiseSpeed: 0.9, sprintSpeed: 2.2, turnRate: 1.3,
      schoolSize: 3, groups: 5, wagRate: 3.5,
      shape: { length: 0.38, height: 0.36, width: 0.34, bellyPosition: 0.40, noseSharpness: 0.06,
               crossSection: 2.1, tailHeight: 0.18, tailSweep: 0.14, tailFork: 0,
               dorsalFin: 0.06, sideFin: 0.13, eyeSize: 0.07, backSpikes: 6 }
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

    fish('skate', 'Rift Skate', 'boulders', 'disc', {
      // Wide and flat rather than tall - a ray gliding over the rubble.
      backColor: C(0.26, 0.24, 0.28), bellyColor: C(0.78, 0.76, 0.70), finColor: C(0.34, 0.32, 0.34),
      maxHealth: 34, cruiseSpeed: 1.3, sprintSpeed: 3.2, turnRate: 1.5,
      schoolSize: 2, groups: 7, altitude: 1.2, wagRate: 2.4,
      shape: { length: 0.66, height: 0.055, width: 0.44, bellyPosition: 0.38, noseSharpness: 0.5,
               crossSection: 1.7, tailHeight: 0.07, tailSweep: 0.34, tailFork: 0,
               dorsalFin: 0, ventralFin: 0, sideFin: 0, eyeSize: 0.028, spineSegments: 16 }
    }),

    // ---------------------------------------------------------- Crystal Caverns
    fish('goldfin', 'Goldfin', 'crystal', 'diamond', {
      // Cast in soft gold. Slow, heavy, and worth cutting open.
      backColor: C(0.95, 0.72, 0.12), bellyColor: C(1.0, 0.90, 0.52), finColor: C(0.78, 0.52, 0.06),
      eyeColor: C(0.15, 0.10, 0.02), glow: 0.25,
      maxHealth: 38, cruiseSpeed: 1.1, sprintSpeed: 2.6, turnRate: 1.3,
      schoolSize: 4, groups: 5, altitude: 3, wagRate: 3.2,
      drops: { gold: [1, 2] },
      shape: { length: 0.44, height: 0.34, width: 0.16, bellyPosition: 0.36, noseSharpness: 0.4,
               crossSection: 2.8, tailHeight: 0.30, tailSweep: 0.22, tailFork: 0.5,
               dorsalFin: 0.16, sideFin: 0.12, eyeSize: 0.05, stripes: 2 }
    }),
    fish('diamondfish', 'Prism Diamondfish', 'crystal', 'boxy', {
      // Faceted and near-colourless; it catches what little light reaches here.
      backColor: C(0.78, 0.92, 0.98), bellyColor: C(0.95, 0.99, 1.0), finColor: C(0.62, 0.86, 0.96),
      eyeColor: C(0.20, 0.35, 0.45), glow: 0.7,
      maxHealth: 52, cruiseSpeed: 0.9, sprintSpeed: 2.2, turnRate: 1.1,
      schoolSize: 2, groups: 5, altitude: 4, wagRate: 2.6,
      drops: { diamond: [1, 1], quartz: [1, 2] },
      shape: { length: 0.36, height: 0.30, width: 0.26, bellyPosition: 0.45, noseSharpness: 0.6,
               crossSection: 6, tailHeight: 0.20, tailSweep: 0.16, tailFork: 0.2,
               dorsalFin: 0.12, sideFin: 0.10, eyeSize: 0.05, backSpikes: 3, radialSegments: 7 }
    }),
    fish('silverscale', 'Silverscale', 'crystal', 'torpedo', {
      // Quick, bright and common - the biome's small change.
      backColor: C(0.80, 0.84, 0.88), bellyColor: C(0.96, 0.98, 1.0), finColor: C(0.60, 0.68, 0.76),
      glow: 0.3, maxHealth: 20, cruiseSpeed: 2.0, sprintSpeed: 4.6, turnRate: 2.6,
      schoolSize: 7, groups: 6, altitude: 5, wagRate: 6.5,
      drops: { titanium: [1, 1] },
      shape: { length: 0.30, height: 0.24, width: 0.12, noseSharpness: 0.7, tailFork: 0.6,
               dorsalFin: 0.14, sideFin: 0.10, eyeSize: 0.05, stripes: 3 }
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

    // ------------------------------------------------------------ King's Domain
    fish('crownfin', 'Crownfin', 'kings', 'diamond', {
      // Lives in the hoard's shadow. Bronze, armoured, unbothered by stalkers.
      backColor: C(0.42, 0.28, 0.10), bellyColor: C(0.82, 0.70, 0.44), finColor: C(0.62, 0.44, 0.16),
      glow: 0.15, maxHealth: 40, cruiseSpeed: 1.4, sprintSpeed: 3.4,
      schoolSize: 4, groups: 5, altitude: 4, wagRate: 4,
      shape: { length: 0.5, height: 0.36, width: 0.14, bellyPosition: 0.34, noseSharpness: 0.5,
               tailHeight: 0.34, tailFork: 0.6, dorsalFin: 0.26, ventralFin: 0.12,
               sideFin: 0.12, eyeSize: 0.045, backSpikes: 3, stripes: 4 }
    }),

    // -------------------------------------------------------------- Whale Reach
    fish('bluedrifter', 'Blue Drifter', 'whale', 'ribbon', {
      // Open-water plankton feeder, drifting in loose ribbons near the whale.
      backColor: C(0.14, 0.32, 0.58), bellyColor: C(0.70, 0.88, 0.98), finColor: C(0.24, 0.48, 0.78),
      glow: 0.25, maxHealth: 24, cruiseSpeed: 1.2, sprintSpeed: 2.8, turnRate: 1.2,
      schoolSize: 6, groups: 6, altitude: 12, wagRate: 2.4,
      shape: { length: 0.8, height: 0.20, width: 0.05, bellyPosition: 0.28, noseSharpness: 0.45,
               tailHeight: 0.16, tailSweep: 0.3, tailFork: 0.15, dorsalFin: 0.14,
               ventralFin: 0.10, sideFin: 0.06, eyeSize: 0.03, spineSegments: 18 }
    }),

    // ------------------------------------------------------------- The predator
    fish('stalker', 'Stalker', 'kelp', 'eel', {
      diet: 'carnivore',
      backColor: C(0.22, 0.26, 0.20), bellyColor: C(0.62, 0.60, 0.46), finColor: C(0.30, 0.34, 0.24),
      eyeColor: C(0.95, 0.85, 0.15),
      maxHealth: 130, cruiseSpeed: 2.2, sprintSpeed: 6.2, turnRate: 1.9,
      // A stalker that bites every 1.8s for 22 kills a full-health diver in
      // four passes with no way to answer. It now hits for less, far less
      // often, and breaks off after every bite (see the 'veerOff' state).
      senseRadius: 30, biteDamage: 13, biteInterval: 3.4,
      schoolSize: 1, groups: 0, altitude: 4.5, wagRate: 2.6,
      shape: { length: 2.6, height: 0.115, width: 0.085, bellyPosition: 0.18, noseSharpness: 0.25,
               crossSection: 2.3, tailHeight: 0.20, tailSweep: 0.22, tailFork: 0.25,
               dorsalFin: 0.09, ventralFin: 0.05, sideFin: 0.10, eyeSize: 0.022,
               jawLength: 0.17, backSpikes: 7, spineSegments: 20, radialSegments: 10 }
    }),

    // ------------------------------------------------------- The Stalker King
    fish('kingstalker', 'Stalker Leviathan', 'kings', 'eel', {
      // Three times a stalker in every dimension, sitting on a hoard of scrap
      // its subjects drag out to it. It will not start a fight with the diver -
      // but it finishes one.
      diet: 'carnivore',
      backColor: C(0.16, 0.19, 0.15), bellyColor: C(0.52, 0.48, 0.34), finColor: C(0.34, 0.30, 0.14),
      eyeColor: C(1.0, 0.55, 0.05), glow: 0.2,
      maxHealth: 900, cruiseSpeed: 2.4, sprintSpeed: 7.0, turnRate: 1.0,
      senseRadius: 46, biteDamage: 34, biteInterval: 4.2,
      schoolSize: 1, groups: 0, altitude: 8, wagRate: 1.4,
      shape: { length: 8.4, height: 0.125, width: 0.10, bellyPosition: 0.20, noseSharpness: 0.22,
               crossSection: 2.4, tailHeight: 0.26, tailSweep: 0.30, tailFork: 0.3,
               dorsalFin: 0.13, ventralFin: 0.07, sideFin: 0.13, eyeSize: 0.018,
               jawLength: 0.20, backSpikes: 12, spineSegments: 24, radialSegments: 11 }
    }),

    // ------------------------------------------------------------- The Whale
    fish('whale', 'Glasswhale', 'whale', 'bulb', {
      // The only thing out here that eats stalkers. It has no interest in
      // anything as small as a diver and will never harm one.
      diet: 'whale',
      backColor: C(0.16, 0.30, 0.46), bellyColor: C(0.72, 0.86, 0.92), finColor: C(0.22, 0.42, 0.58),
      eyeColor: C(0.06, 0.10, 0.14), glow: 0.18,
      maxHealth: 2600, cruiseSpeed: 1.8, sprintSpeed: 4.4, turnRate: 0.5,
      senseRadius: 60, biteDamage: 0, biteInterval: 5,
      schoolSize: 1, groups: 0, altitude: 16, wagRate: 0.8,
      shape: { length: 15, height: 0.19, width: 0.17, bellyPosition: 0.30, noseSharpness: 0.10,
               crossSection: 2.2, tailHeight: 0.26, tailSweep: 0.24, tailFork: 0.55,
               dorsalFin: 0.07, ventralFin: 0.04, sideFin: 0.16, eyeSize: 0.012,
               spineSegments: 26, radialSegments: 12 }
    })
  ];

  const byId = {};
  SPECIES.forEach((s) => { byId[s.id] = s; });

  SL.Species = {
    list: SPECIES,
    byId,
    stalker: byId.stalker,
    kingStalker: byId.kingstalker,
    whale: byId.whale,
    // Only ordinary prey spawns from the biome roster; the predators and the
    // whale are placed individually by the world builder.
    ofBiome: (biomeId) => SPECIES.filter(
      (s) => s.biome === biomeId && s.diet !== 'carnivore' && s.diet !== 'whale')
  };
})(window.SL);
