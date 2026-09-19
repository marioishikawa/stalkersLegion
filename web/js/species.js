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
      antennae: 0, legPairs: 0, legScale: 0.11,
      eyePosition: 0.14, eyeHeight: 0.45, eyeRing: false, mouthLine: 0, jawTeeth: true,
      spineSegments: 14, radialSegments: 10,
      // How many linked pieces the body is built from. One is a rigid animal
      // that yaws and wags; more than one is a spine a wave can travel down.
      // bodySwing is how far each of those joints bends.
      bodySegments: 1, bodySwing: 0.24
    }, overrides.shape) });
  }

  const SPECIES = [
    // ------------------------------------------------------------- Safe Shallows
    fish('glimmerfin', 'Glimmerfin', 'shallows', 'torpedo', {
      alsoIn: ['islet'],
      note: "Small, quick and mirror-bright. The first fish anyone sees.",
      // Small, quick, mirror-bright. The first fish you ever see.
      backColor: C(0.35, 0.72, 0.85), bellyColor: C(0.95, 0.96, 0.90), finColor: C(0.95, 0.78, 0.30),
      schoolSize: 10, groups: 6,
      shape: { length: 0.26, height: 0.26, width: 0.11, noseSharpness: 0.55, tailFork: 0.55, stripes: 4, sideFin: 0.11 }
    }),
    fish('bubblepeep', 'Bubblepeep', 'shallows', 'bulb', {
      alsoIn: ['islet'],
      note: "Round, slow and comically wide-eyed. Bumps into things.",
      // Round, slow, comically wide-eyed. Easy knife practice.
      backColor: C(0.95, 0.55, 0.18), bellyColor: C(1.0, 0.92, 0.70), finColor: C(1.0, 0.80, 0.45),
      cruiseSpeed: 1.2, sprintSpeed: 3.0, schoolSize: 4, groups: 4, wagRate: 5,
      shape: { length: 0.34, height: 0.34, width: 0.30, bellyPosition: 0.34, noseSharpness: 0.1,
               crossSection: 2.2, tailHeight: 0.26, tailFork: 0.15, dorsalFin: 0.10, sideFin: 0.16, eyeSize: 0.095 }
    }),

    // -------------------------------------------------------------- Kelp Forest
    fish('bladefish', 'Bladefish', 'kelp', 'ribbon', {
      nests: true,
      note: "Tall, flat and green. Turns edge-on and vanishes into the kelp.",
      // Tall, flat and green - hides edge-on between kelp stalks.
      backColor: C(0.16, 0.42, 0.14), bellyColor: C(0.72, 0.80, 0.45), finColor: C(0.28, 0.55, 0.20),
      maxHealth: 18, schoolSize: 5, groups: 5, altitude: 5, wagRate: 4.5,
      shape: { length: 0.58, height: 0.30, width: 0.045, bellyPosition: 0.30, noseSharpness: 0.7,
               tailHeight: 0.24, tailSweep: 0.30, tailFork: 0.10, dorsalFin: 0.22, ventralFin: 0.16,
               sideFin: 0.08, eyeSize: 0.035, spineSegments: 18 }
    }),
    fish('stickfish', 'Stick Fish', 'kelp', 'eel', {
      note: 'A twig with an eye on it. Hangs vertically among the stalks and ' +
            'barely moves, which works until it has to go somewhere.',
      backColor: C(0.36, 0.30, 0.16), bellyColor: C(0.62, 0.56, 0.34), finColor: C(0.30, 0.26, 0.14),
      eyeColor: C(0.10, 0.08, 0.04),
      maxHealth: 10, cruiseSpeed: 0.7, sprintSpeed: 2.8, turnRate: 1.1,
      schoolSize: 3, groups: 6, altitude: 3.2,
      // Barely bends. It is a stick, and it drifts like one.
      wagRate: 1.1,
      shape: { length: 0.95, height: 0.035, width: 0.030, bellyPosition: 0.45,
               noseSharpness: 0.85, crossSection: 1.8, tailHeight: 0.035,
               tailSweep: 0.10, tailFork: 0, dorsalFin: 0.015, ventralFin: 0,
               sideFin: 0.02, eyeSize: 0.022, spineSegments: 20, radialSegments: 7 }
    }),
    fish('darter', 'Kelp Darter', 'kelp', 'arrow', {
      note: "Needle-nosed sprinter. Bolts the instant anything looks at it.",
      // Needle-nosed sprinter. Bolts the instant anything looks at it.
      backColor: C(0.38, 0.46, 0.16), bellyColor: C(0.88, 0.90, 0.72), finColor: C(0.55, 0.62, 0.25),
      cruiseSpeed: 2.3, sprintSpeed: 5.6, turnRate: 3.4, schoolSize: 9, groups: 5, wagRate: 9,
      shape: { length: 0.40, height: 0.17, width: 0.10, bellyPosition: 0.42, noseSharpness: 0.95,
               tailHeight: 0.34, tailFork: 0.75, dorsalFin: 0.10, sideFin: 0.10, eyeSize: 0.04, stripes: 2 }
    }),

    // ----------------------------------------------------------- Grassy Plateau
    fish('spadefin', 'Spadefin', 'plateau', 'disc', {
      note: "A wafer-thin disc that turns sideways when it flees.",
      // Wafer-thin disc that turns sideways when it flees.
      backColor: C(0.12, 0.55, 0.55), bellyColor: C(0.93, 0.95, 0.88), finColor: C(0.10, 0.35, 0.42),
      schoolSize: 6, groups: 5,
      shape: { length: 0.44, height: 0.52, width: 0.06, bellyPosition: 0.42, noseSharpness: 0.35,
               tailHeight: 0.28, tailFork: 0.30, dorsalFin: 0.26, ventralFin: 0.24, sideFin: 0.13, stripes: 3 }
    }),
    fish('platefish', 'Plate Fish', 'plateau', 'disc', {
      alsoIn: ['islet'],
      note: 'Round, white and flat enough to serve dinner on. Turns edge-on ' +
            'when something looks at it and effectively vanishes.',
      backColor: C(0.90, 0.90, 0.86), bellyColor: C(0.98, 0.98, 0.96), finColor: C(0.68, 0.72, 0.74),
      eyeColor: C(0.06, 0.06, 0.07),
      maxHealth: 16, cruiseSpeed: 1.2, sprintSpeed: 3.4, turnRate: 2.8,
      schoolSize: 5, groups: 6, altitude: 2.6, wagRate: 4.5,
      shape: { length: 0.44, height: 0.62, width: 0.045, bellyPosition: 0.50,
               noseSharpness: 0.25, crossSection: 1.5, tailHeight: 0.20,
               tailSweep: 0.14, tailFork: 0.1, dorsalFin: 0.06, ventralFin: 0.06,
               sideFin: 0.07, eyeSize: 0.05, eyeRing: true, spineSegments: 16 }
    }),
    fish('nibbler', 'Grass Nibbler', 'plateau', 'diamond', {
      nests: true,
      note: "Angular grazer with hard shoulders, nosing through the grass.",
      // Angular grazer with hard shoulders; noses through the grass.
      backColor: C(0.45, 0.25, 0.62), bellyColor: C(0.90, 0.82, 0.95), finColor: C(0.62, 0.40, 0.80),
      maxHealth: 20, cruiseSpeed: 1.4, altitude: 1.8, groups: 5,
      shape: { length: 0.36, height: 0.30, width: 0.18, bellyPosition: 0.38, noseSharpness: 0.25,
               crossSection: 2.6, tailFork: 0.45, dorsalFin: 0.20, sideFin: 0.14, eyeSize: 0.06 }
    }),

    fish('stingray', 'Stingray', 'plateau', 'disc', {
      alsoIn: ['islet'],
      note: "All wing and whip tail, hugging the plateau grass. Harmless.",
      // Broad wings, a whip tail, and it hugs the grass. Harmless.
      backColor: C(0.36, 0.30, 0.22), bellyColor: C(0.90, 0.86, 0.76), finColor: C(0.44, 0.37, 0.27),
      maxHealth: 40, cruiseSpeed: 1.5, sprintSpeed: 3.4, turnRate: 1.3,
      schoolSize: 2, groups: 5, altitude: 1.4, wagRate: 1.8,
      shape: { length: 1.1, height: 0.05, width: 0.62, bellyPosition: 0.36, noseSharpness: 0.55,
               crossSection: 1.6, tailHeight: 0.04, tailSweep: 0.62, tailFork: 0,
               dorsalFin: 0, ventralFin: 0, sideFin: 0, eyeSize: 0.024, spineSegments: 18 }
    }),

    // ------------------------------------------------------------- The mammals
    //
    // Air breathers. They hold a lungful, and when it runs low they break off
    // whatever they were doing and climb for the surface - which is why you
    // mostly meet them on the shelf, where the trip up is short.
    fish('porpoise', 'Reef Porpoise', 'kelp', 'torpedo', {
      diet: 'mammal',
      note: 'Air-breathing and curious. Pods work the kelp edge, then climb together to blow.',
      backColor: C(0.24, 0.28, 0.34), bellyColor: C(0.92, 0.93, 0.90), finColor: C(0.30, 0.34, 0.40),
      maxHealth: 60, cruiseSpeed: 2.6, sprintSpeed: 6.0, turnRate: 2.2,
      senseRadius: 16, schoolSize: 4, groups: 4, altitude: 6, wagRate: 4.5,
      breathSeconds: 70, voice: 'whistle', callInterval: [7, 18],
      shape: { length: 1.9, height: 0.17, width: 0.13, bellyPosition: 0.34, noseSharpness: 0.55,
               tailHeight: 0.17, tailSweep: 0.20, tailFork: 0.65, dorsalFin: 0.13,
               sideFin: 0.15, eyeSize: 0.018, spineSegments: 18 }
    }),
    fish('fatfish', 'Fatfish', 'shallows', 'bulb', {
      alsoIn: ['islet'],
      note: 'Almost perfectly spherical and entirely unbothered about it. Too ' +
            'wide to hide anywhere and too slow to run, so it simply does not.',
      backColor: C(0.86, 0.56, 0.22), bellyColor: C(0.98, 0.90, 0.72), finColor: C(0.72, 0.40, 0.16),
      eyeColor: C(0.05, 0.04, 0.03),
      maxHealth: 30, cruiseSpeed: 0.8, sprintSpeed: 1.9, turnRate: 1.4,
      schoolSize: 3, groups: 5, altitude: 2.4, wagRate: 3.2,
      shape: { length: 0.42, height: 0.78, width: 0.72, bellyPosition: 0.50,
               noseSharpness: 0.10, crossSection: 3.4, tailHeight: 0.22,
               tailSweep: 0.16, tailFork: 0.2, dorsalFin: 0.10, ventralFin: 0.08,
               sideFin: 0.20, eyeSize: 0.075, eyeRing: true, spineSegments: 16,
               radialSegments: 12 }
    }),
    fish('seal', 'Sand Seal', 'shallows', 'bulb', {
      diet: 'mammal',
      note: 'Sleeps on the sand between breaths. Fat, fast off the mark, entirely harmless.',
      backColor: C(0.44, 0.40, 0.34), bellyColor: C(0.88, 0.85, 0.76), finColor: C(0.36, 0.33, 0.28),
      maxHealth: 70, cruiseSpeed: 1.9, sprintSpeed: 5.2, turnRate: 1.8,
      senseRadius: 14, schoolSize: 2, groups: 4, altitude: 2.5, wagRate: 3,
      breathSeconds: 95, voice: 'blow',
      shape: { length: 1.5, height: 0.20, width: 0.18, bellyPosition: 0.32, noseSharpness: 0.2,
               crossSection: 2.2, tailHeight: 0.13, tailSweep: 0.16, tailFork: 0.4,
               dorsalFin: 0, sideFin: 0.20, eyeSize: 0.035, spineSegments: 16 }
    }),

    // ------------------------------------------------------------- The shrimp
    fish('glassshrimp', 'Glass Shrimp', 'kelp', 'shrimp', {
      note: 'Near-invisible until it moves. Swarms hang in the kelp like dust in a sunbeam.',
      backColor: C(0.72, 0.82, 0.74), bellyColor: C(0.90, 0.95, 0.92), finColor: C(0.60, 0.76, 0.70),
      eyeColor: C(0.05, 0.05, 0.06), glow: 0.3,
      maxHealth: 6, cruiseSpeed: 0.8, sprintSpeed: 3.4, turnRate: 4.5,
      senseRadius: 7, schoolSize: 14, groups: 7, altitude: 1.6, wagRate: 11,
      shape: { length: 0.10, height: 0.20, width: 0.16, bellyPosition: 0.34, noseSharpness: 0.35,
               tailHeight: 0.26, tailSweep: 0.18, tailFork: 0.35, dorsalFin: 0,
               sideFin: 0, eyeSize: 0.09, antennae: 1.1, legPairs: 4,
               spineSegments: 12, radialSegments: 8 }
    }),
    fish('embershrimp', 'Ember Shrimp', 'coral', 'shrimp', {
      alsoIn: ['islet'],
      note: 'Banded red and cream, and it keeps to the coral it matches.',
      backColor: C(0.82, 0.22, 0.16), bellyColor: C(0.98, 0.88, 0.72), finColor: C(0.92, 0.46, 0.20),
      eyeColor: C(0.08, 0.05, 0.04), glow: 0.2,
      maxHealth: 9, cruiseSpeed: 0.7, sprintSpeed: 3.0, turnRate: 4,
      senseRadius: 7, schoolSize: 9, groups: 6, altitude: 1.2, wagRate: 10,
      shape: { length: 0.14, height: 0.22, width: 0.17, bellyPosition: 0.34, noseSharpness: 0.3,
               tailHeight: 0.28, tailSweep: 0.20, tailFork: 0.3, dorsalFin: 0,
               sideFin: 0, eyeSize: 0.08, stripes: 5, antennae: 0.9, legPairs: 4,
               spineSegments: 12, radialSegments: 8 }
    }),

    // ----------------------------------------------------------- Red Coral Reef
    fish('bubbleclown', 'Bubble Clown', 'coral', 'disc', {
      alsoIn: ['islet'],
      nests: true,
      note: 'Orange and banded, and it shoots bubbles. Nobody has worked out ' +
            'how. Startle one and it empties itself in a panic and bolts.',
      backColor: C(0.98, 0.44, 0.10), bellyColor: C(1.0, 0.96, 0.92), finColor: C(0.12, 0.11, 0.14),
      eyeColor: C(0.06, 0.05, 0.08), glow: 0.15,
      maxHealth: 16, cruiseSpeed: 1.5, sprintSpeed: 4.6, turnRate: 3.4,
      schoolSize: 5, groups: 6, altitude: 2.2, wagRate: 8,

      // The whole point of it: a puff every few seconds, far more when scared.
      bubbleInterval: [2.2, 5.0],

      shape: { length: 0.30, height: 0.34, width: 0.13, bellyPosition: 0.42,
               noseSharpness: 0.30, crossSection: 2.4, tailHeight: 0.26,
               tailSweep: 0.20, tailFork: 0.25, dorsalFin: 0.22, ventralFin: 0.16,
               sideFin: 0.17, eyeSize: 0.075, eyeRing: true, stripes: 3,
               spineSegments: 14 }
    }),
    fish('emberfin', 'Emberfin', 'coral', 'diamond', {
      alsoIn: ['islet'],
      note: "Hot-coloured reef fish with a deeply forked tail.",
      // Hot-coloured reef fish with a deep forked tail.
      backColor: C(0.85, 0.18, 0.10), bellyColor: C(1.0, 0.78, 0.40), finColor: C(1.0, 0.45, 0.08),
      glow: 0.15, schoolSize: 8, groups: 5,
      shape: { length: 0.32, height: 0.38, width: 0.10, bellyPosition: 0.33, noseSharpness: 0.6,
               tailHeight: 0.40, tailSweep: 0.30, tailFork: 0.80, dorsalFin: 0.24, ventralFin: 0.14, stripes: 5 }
    }),
    fish('boxfish', 'Coral Boxfish', 'coral', 'boxy', {
      alsoIn: ['islet'],
      note: "A swimming brick. Slow, armoured and entirely unbothered.",
      // A swimming brick. Slow, armoured, unbothered.
      backColor: C(0.95, 0.82, 0.15), bellyColor: C(0.98, 0.95, 0.75), finColor: C(0.20, 0.18, 0.15),
      maxHealth: 30, cruiseSpeed: 0.95, sprintSpeed: 2.0, turnRate: 1.4, schoolSize: 3, groups: 4, wagRate: 4,
      shape: { length: 0.30, height: 0.32, width: 0.28, bellyPosition: 0.45, noseSharpness: 0.05,
               crossSection: 5, tailHeight: 0.20, tailSweep: 0.16, tailFork: 0, dorsalFin: 0.08,
               sideFin: 0.12, eyeSize: 0.07, stripes: 6, radialSegments: 8 }
    }),

    fish('puffer', 'Cinder Puffer', 'coral', 'bulb', {
      note: "Spiky and ash-dark with an ember underside. Drifts rather than swims.",
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
      nests: true,
      note: "Heavy bottom-feeder with a huge round head and a spined back.",
      // Heavy bottom-feeder with a huge round head.
      backColor: C(0.30, 0.30, 0.33), bellyColor: C(0.70, 0.68, 0.60), finColor: C(0.42, 0.40, 0.38),
      maxHealth: 45, cruiseSpeed: 1.1, sprintSpeed: 2.4, turnRate: 1.2,
      schoolSize: 2, groups: 6, altitude: 1.5, wagRate: 3.5,
      shape: { length: 0.72, height: 0.30, width: 0.26, bellyPosition: 0.28, noseSharpness: 0.08,
               crossSection: 2.4, tailHeight: 0.24, tailFork: 0.20, dorsalFin: 0.12, sideFin: 0.18,
               eyeSize: 0.045, backSpikes: 4, spineSegments: 16 }
    }),

    fish('cobblejaw', 'Cobblejaw', 'boulders', 'boxy', {
      nests: true,
      note: 'Squat and armoured, the colour of the rubble it grazes. Sits ' +
            'still often enough that you find them by moving, not by looking.',
      backColor: C(0.40, 0.38, 0.34), bellyColor: C(0.72, 0.70, 0.62), finColor: C(0.52, 0.46, 0.36),
      maxHealth: 40, cruiseSpeed: 1.0, sprintSpeed: 2.9, turnRate: 1.6,
      schoolSize: 4, groups: 8, altitude: 1.6, wagRate: 3.2,
      shape: { length: 0.44, height: 0.34, width: 0.32, bellyPosition: 0.44,
               noseSharpness: 0.18, crossSection: 5.5, tailHeight: 0.20,
               tailSweep: 0.16, tailFork: 0.1, dorsalFin: 0.10, ventralFin: 0.06,
               sideFin: 0.16, eyeSize: 0.055, backSpikes: 5, spineSegments: 12 }
    }),
    fish('skate', 'Rift Skate', 'boulders', 'disc', {
      note: "Wide and flat, gliding low over the rubble.",
      // Wide and flat rather than tall - a ray gliding over the rubble.
      backColor: C(0.26, 0.24, 0.28), bellyColor: C(0.78, 0.76, 0.70), finColor: C(0.34, 0.32, 0.34),
      maxHealth: 34, cruiseSpeed: 1.3, sprintSpeed: 3.2, turnRate: 1.5,
      schoolSize: 2, groups: 7, altitude: 1.2, wagRate: 2.4,
      shape: { length: 0.66, height: 0.055, width: 0.44, bellyPosition: 0.38, noseSharpness: 0.5,
               crossSection: 1.7, tailHeight: 0.07, tailSweep: 0.34, tailFork: 0,
               dorsalFin: 0, ventralFin: 0, sideFin: 0, eyeSize: 0.028, spineSegments: 16 }
    }),

    fish('snakefish', 'Snake Fish', 'boulders', 'eel', {
      alsoIn: ['coral'],
      note: 'Three and a half metres of banded rope. It has no trick for ' +
            'hiding and no speed to run with, so it simply pours itself ' +
            'between the boulders and is gone.',
      backColor: C(0.15, 0.20, 0.13), bellyColor: C(0.88, 0.86, 0.52), finColor: C(0.22, 0.30, 0.16),
      eyeColor: C(0.72, 0.62, 0.10),
      maxHealth: 26, cruiseSpeed: 1.5, sprintSpeed: 3.4,
      // Long things do not corner. It swings its whole length around instead.
      turnRate: 1.2,
      // Solitary, and thin on the ground: one of these is already plenty of
      // animal, and a reef with sixty of them in it is not a reef with a
      // snake in it.
      schoolSize: 1, groups: 2, altitude: 3,
      // Slow beats, big ones - the wave is what moves it, not a tail flick.
      wagRate: 3.4,
      shape: { length: 4.2, height: 0.026, width: 0.023, bellyPosition: 0.42,
               noseSharpness: 0.75, crossSection: 2.1, tailHeight: 0.042,
               tailSweep: 0.08, tailFork: 0, dorsalFin: 0.018, ventralFin: 0,
               sideFin: 0, eyeSize: 0.010, eyePosition: 0.045, eyeHeight: 0.55,
               stripes: 14, mouthLine: 0.010,
               // Eleven links and a long stride to the wave: a proper serpent.
               bodySegments: 11, bodySwing: 0.3,
               spineSegments: 33, radialSegments: 8 }
    }),

    // ---------------------------------------------------------- Crystal Caverns
    fish('goldfin', 'Goldfin', 'crystal', 'diamond', {
      note: "Cast in soft gold. Slow, heavy, and worth cutting open.",
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
      note: "Faceted and near-colourless. Catches what little light gets down here.",
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
    fish('krill', 'Crystal Krill', 'crystal', 'shrimp', {
      note: 'Swarms that glow faintly pink. The caverns are never entirely dark because of them.',
      backColor: C(0.92, 0.52, 0.76), bellyColor: C(1.0, 0.80, 0.92), finColor: C(0.86, 0.40, 0.70),
      eyeColor: C(0.20, 0.05, 0.14), glow: 1,
      maxHealth: 5, cruiseSpeed: 0.9, sprintSpeed: 3.2, turnRate: 4.5,
      senseRadius: 8, schoolSize: 16, groups: 7, altitude: 3, wagRate: 12,
      drops: { quartz: [1, 1] },
      shape: { length: 0.09, height: 0.20, width: 0.15, bellyPosition: 0.32, noseSharpness: 0.35,
               tailHeight: 0.26, tailSweep: 0.18, tailFork: 0.35, dorsalFin: 0,
               sideFin: 0, eyeSize: 0.09, antennae: 1.2, legPairs: 3,
               spineSegments: 12, radialSegments: 8 }
    }),
    fish('silverscale', 'Silverscale', 'crystal', 'torpedo', {
      note: "Quick and bright. The crystal country has no shortage of them.",
      // Quick, bright and common - the biome's small change.
      backColor: C(0.80, 0.84, 0.88), bellyColor: C(0.96, 0.98, 1.0), finColor: C(0.60, 0.68, 0.76),
      glow: 0.3, maxHealth: 20, cruiseSpeed: 2.0, sprintSpeed: 4.6, turnRate: 2.6,
      schoolSize: 7, groups: 6, altitude: 5, wagRate: 6.5,
      drops: { titanium: [1, 1] },
      shape: { length: 0.30, height: 0.24, width: 0.12, noseSharpness: 0.7, tailFork: 0.6,
               dorsalFin: 0.14, sideFin: 0.10, eyeSize: 0.05, stripes: 3 }
    }),

    fish('diamondlev', 'Diamond Fish Leviathan', 'crystal', 'diamond', {
      leviathan: true, markerColor: '#bfe9ff',
      diet: 'carnivore', groups: 0,
      note: 'Eleven metres of cut stone with a fish inside it. Nothing else ' +
            'down here comes close to what it can take: hit it hard enough ' +
            'and it simply stops, sets, and grows the damage back while you ' +
            'watch. Whittling it away does not work. Only a diver who will ' +
            'not stop swinging ever finishes one.',
      backColor: C(0.60, 0.81, 0.95), bellyColor: C(0.95, 0.99, 1.0), finColor: C(0.74, 0.91, 1.0),
      eyeColor: C(0.10, 0.28, 0.42), glow: 0.3,
      // The whole animal. Three thousand, and it heals.
      maxHealth: 3000, cruiseSpeed: 1.3, sprintSpeed: 4.2, turnRate: 0.55,
      senseRadius: 52, biteDamage: 36, biteInterval: 4.2,
      schoolSize: 1, altitude: 12, wagRate: 0.8,
      shape: { length: 11, height: 0.34, width: 0.27, bellyPosition: 0.44,
               noseSharpness: 0.55,
               // Low power on the superellipse: a faceted section rather than
               // a round one, so it reads as cut rather than grown.
               crossSection: 1.35,
               tailHeight: 0.38, tailSweep: 0.30, tailFork: 0.30,
               dorsalFin: 0.16, ventralFin: 0.10, sideFin: 0.15,
               eyeSize: 0.018, eyeRing: true, eyePosition: 0.15,
               mouthLine: 0.012, jawLength: 0.13, backSpikes: 9, stripes: 5,
               spineSegments: 24, radialSegments: 10 }
    }),

    // -------------------------------------------------------------- Deep Trench
    fish('lanternjaw', 'Lanternjaw', 'trench', 'eel', {
      note: "Bioluminescent eel. Often the only thing visible in the trench.",
      // Bioluminescent eel. Often the only thing you can see down there.
      backColor: C(0.10, 0.55, 0.60), bellyColor: C(0.35, 0.95, 0.90), finColor: C(0.25, 0.85, 0.80),
      eyeColor: C(0.90, 1.0, 0.55), glow: 1, maxHealth: 26, cruiseSpeed: 1.3,
      schoolSize: 3, groups: 6, altitude: 6, wagRate: 3,
      shape: { length: 0.90, height: 0.10, width: 0.075, bellyPosition: 0.20, noseSharpness: 0.30,
               tailHeight: 0.16, tailFork: 0, dorsalFin: 0.07, ventralFin: 0.05, sideFin: 0.05,
               eyeSize: 0.03, spineSegments: 22, radialSegments: 8 }
    }),
    fish('trenchdart', 'Trench Dart', 'trench', 'arrow', {
      note: 'Mirror-sided and very fast, in schools that turn as one. The ' +
            'flash of a school turning is often the only light down here.',
      backColor: C(0.52, 0.58, 0.66), bellyColor: C(0.88, 0.92, 0.98), finColor: C(0.40, 0.50, 0.62),
      glow: 0.45, maxHealth: 12, cruiseSpeed: 2.0, sprintSpeed: 6.4, turnRate: 3.8,
      schoolSize: 9, groups: 8, altitude: 5, wagRate: 10,
      shape: { length: 0.30, height: 0.17, width: 0.09, bellyPosition: 0.40,
               noseSharpness: 0.92, tailHeight: 0.26, tailSweep: 0.28, tailFork: 0.65,
               dorsalFin: 0.14, ventralFin: 0.08, sideFin: 0.10, eyeSize: 0.06,
               spineSegments: 14 }
    }),
    fish('ribbon', 'Abyss Ribbon', 'trench', 'ribbon', {
      note: "A metre of violet streamer, drifting in the dark.",
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
      note: "Bronze and armoured, living in the shadow of the hoard.",
      // Lives in the hoard's shadow. Bronze, armoured, unbothered by stalkers.
      backColor: C(0.42, 0.28, 0.10), bellyColor: C(0.82, 0.70, 0.44), finColor: C(0.62, 0.44, 0.16),
      glow: 0.15, maxHealth: 40, cruiseSpeed: 1.4, sprintSpeed: 3.4,
      schoolSize: 4, groups: 5, altitude: 4, wagRate: 4,
      shape: { length: 0.5, height: 0.36, width: 0.14, bellyPosition: 0.34, noseSharpness: 0.5,
               tailHeight: 0.34, tailFork: 0.6, dorsalFin: 0.26, ventralFin: 0.12,
               sideFin: 0.12, eyeSize: 0.045, backSpikes: 3, stripes: 4 }
    }),

    // -------------------------------------------------------------- Whale Reach
    fish('snowfleck', 'Snowfleck', 'abyss', 'shrimp', {
      note: 'Feeds on the marine snow falling through the open water. Swarms ' +
            'of them hang in the dark like dust in a sunbeam, minus the sunbeam.',
      backColor: C(0.78, 0.80, 0.86), bellyColor: C(0.94, 0.96, 1.0), finColor: C(0.62, 0.68, 0.80),
      eyeColor: C(0.10, 0.10, 0.14), glow: 0.75,
      maxHealth: 4, cruiseSpeed: 0.7, sprintSpeed: 2.6, turnRate: 4.2,
      senseRadius: 7, schoolSize: 18, groups: 9, altitude: 14, wagRate: 13,
      shape: { length: 0.07, height: 0.22, width: 0.16, bellyPosition: 0.34,
               noseSharpness: 0.3, tailHeight: 0.24, tailSweep: 0.16, tailFork: 0.3,
               dorsalFin: 0, sideFin: 0, eyeSize: 0.10, antennae: 1.4, legPairs: 3,
               spineSegments: 10, radialSegments: 8 }
    }),
    fish('ghostbell', 'Ghost Bell', 'abyss', 'bulb', {
      note: 'A slow pale bell that pulses rather than swims. It has no eyes ' +
            'worth the name and does not appear to notice anything at all.',
      backColor: C(0.62, 0.70, 0.78), bellyColor: C(0.88, 0.94, 0.98), finColor: C(0.50, 0.62, 0.76),
      eyeColor: C(0.30, 0.38, 0.48), glow: 0.85,
      maxHealth: 20, cruiseSpeed: 0.55, sprintSpeed: 1.6, turnRate: 0.9,
      senseRadius: 9, schoolSize: 2, groups: 8, altitude: 18, wagRate: 1.1,
      shape: { length: 0.52, height: 0.66, width: 0.60, bellyPosition: 0.50,
               noseSharpness: 0.05, crossSection: 3.0, tailHeight: 0.44,
               tailSweep: 0.42, tailFork: 0, dorsalFin: 0, ventralFin: 0,
               sideFin: 0, eyeSize: 0.02, spineSegments: 16, radialSegments: 12 }
    }),
    fish('bluedrifter', 'Blue Drifter', 'abyss', 'ribbon', {
      note: "Open-water plankton feeder, drifting in loose ribbons.",
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
      note: "Obsessed with scrap metal. Chews it, hauls it, and bites whatever interrupts.",
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
      note: "Sits on a hoard its subjects drag out to it. Ignores divers until struck.",
      leviathan: true, markerColor: '#e08a2c',
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
               dorsalFin: 0.13, ventralFin: 0.07, sideFin: 0.13,
               eyeSize: 0.020, eyeRing: true, mouthLine: 0.006,
               jawLength: 0.20, backSpikes: 12, spineSegments: 24, radialSegments: 11 }
    }),

    // ---------------------------------------------------- Kelper's Reach
    fish('frondfish', 'Frondfish', 'farkelp', 'ribbon', {
      note: "Drifts in the far forest with its fins spread like torn leaves.",
      backColor: C(0.22, 0.40, 0.18), bellyColor: C(0.80, 0.86, 0.58), finColor: C(0.34, 0.52, 0.22),
      glow: 0.2, maxHealth: 24, cruiseSpeed: 1.3, sprintSpeed: 3.2,
      schoolSize: 5, groups: 6, altitude: 5, wagRate: 3.4,
      shape: { length: 0.7, height: 0.28, width: 0.05, bellyPosition: 0.30, noseSharpness: 0.55,
               tailHeight: 0.26, tailSweep: 0.32, tailFork: 0.15, dorsalFin: 0.24,
               ventralFin: 0.18, sideFin: 0.08, eyeSize: 0.035, spineSegments: 18 }
    }),

    // The leviathan's servants: small, quick, and after your pockets.
    fish('weaverfish', 'Weaverfish', 'farkelp', 'diamond', {
      nests: true,
      note: 'Hangs between the fronds of the far forest with its fins spread, ' +
            'and is almost impossible to pick out until it moves.',
      backColor: C(0.30, 0.44, 0.20), bellyColor: C(0.86, 0.88, 0.62), finColor: C(0.44, 0.58, 0.24),
      maxHealth: 20, cruiseSpeed: 1.1, sprintSpeed: 3.6, turnRate: 2.6,
      schoolSize: 4, groups: 7, altitude: 4, wagRate: 5,
      shape: { length: 0.34, height: 0.46, width: 0.08, bellyPosition: 0.48,
               noseSharpness: 0.40, crossSection: 1.8, tailHeight: 0.30,
               tailSweep: 0.26, tailFork: 0.2, dorsalFin: 0.30, ventralFin: 0.26,
               sideFin: 0.12, eyeSize: 0.055, spineSegments: 14 }
    }),
    fish('glowlev', 'Glow Leviathan', 'abyss', 'torpedo', {
      leviathan: true, markerColor: '#5ce7ff',
      diet: 'carnivore', groups: 0,
      note: 'A very large fish that is lit from the inside, throwing enough ' +
            'light to read the sea floor by, and the only thing you will ever ' +
            'see out there. The light is bait. Come close enough and it puts ' +
            'itself out, and the plain is very dark without it.',
      // Everything about it is the glow, so the colours are the light.
      backColor: C(0.20, 0.86, 1.0), bellyColor: C(0.86, 1.0, 1.0), finColor: C(0.36, 0.72, 1.0),
      eyeColor: C(1.0, 0.98, 0.72), glow: 1,
      maxHealth: 1400, cruiseSpeed: 1.7, sprintSpeed: 5.0, turnRate: 0.7,
      senseRadius: 70, biteDamage: 30, biteInterval: 3.4,
      schoolSize: 1, altitude: 20, wagRate: 0.9,
      shape: { length: 13, height: 0.30, width: 0.22, bellyPosition: 0.38,
               noseSharpness: 0.42, crossSection: 2.4, tailHeight: 0.34,
               tailSweep: 0.26, tailFork: 0.45, dorsalFin: 0.20,
               ventralFin: 0.12, sideFin: 0.16,
               eyeSize: 0.022, eyeRing: true, eyePosition: 0.16,
               mouthLine: 0.010, jawLength: 0.14, stripes: 7,
               spineSegments: 26, radialSegments: 12 }
    }),
    fish('carnilev', 'Walkingcarni Leviathan', 'islet', 'boxy', {
      leviathan: true, markerColor: '#e2a33c',
      diet: 'carnivore', groups: 0,
      note: 'What the Walkingcarni grows into if nothing on the island eats ' +
            'it. Six and a half metres, six legs, and none of its smaller ' +
            "relative's indifference: the island is its island, and it comes " +
            'down the slope at anything that walks up it. It cannot follow ' +
            'you into deep water. That is the whole of your defence.',
      backColor: C(0.52, 0.34, 0.15), bellyColor: C(0.88, 0.78, 0.54), finColor: C(0.34, 0.22, 0.10),
      eyeColor: C(1.0, 0.66, 0.10), glow: 0.25,
      maxHealth: 900, cruiseSpeed: 2.0, sprintSpeed: 7.4, turnRate: 1.8,
      senseRadius: 95, biteDamage: 34, biteInterval: 3.0,
      schoolSize: 1, altitude: 1.4, wagRate: 1.6,
      drops: { tooth: [8, 12], titanium: [5, 8], gold: [2, 4] },

      // The same animal as the Walkingcarni, three and a half times the length,
      // and a third pair of legs under the middle to carry it.
      shape: { length: 6.5, height: 0.22, width: 0.28, bellyPosition: 0.46,
               noseSharpness: 0.32, crossSection: 4.8, tailHeight: 0.07,
               tailSweep: 0.60, tailFork: 0, dorsalFin: 0, ventralFin: 0,
               sideFin: 0, eyeSize: 0.030, eyeRing: true, eyePosition: 0.10,
               mouthLine: 0.012, jawLength: 0.22, backSpikes: 11,
               legPairs: 3, legScale: 0.26,
               spineSegments: 20, radialSegments: 12 }
    }),
    fish('craber', 'Craber', 'shallows', 'boxy', {
      // Walks the floor rather than swimming it, so the school spawner leaves
      // it alone and the world builder places it by hand.
      grounded: true, groups: 0,
      diet: 'scavenger',
      note: 'Eight legs, two eyes on stalks and no interest in open water. It ' +
            'potters about the sand of the Safe Shallows and bolts sideways ' +
            'the moment anything comes near, which is most of what it does.',
      backColor: C(0.78, 0.34, 0.20), bellyColor: C(0.94, 0.80, 0.62), finColor: C(0.60, 0.22, 0.12),
      eyeColor: C(0.06, 0.05, 0.05),
      maxHealth: 18, cruiseSpeed: 1.1, sprintSpeed: 5.6, turnRate: 3.6,
      senseRadius: 12, schoolSize: 1, altitude: 0.3, wagRate: 2,
      drops: { titanium: [1, 1] },
      shape: { length: 0.34, height: 0.26, width: 0.46, bellyPosition: 0.50,
               noseSharpness: 0.18, crossSection: 4.2, tailHeight: 0.06,
               tailSweep: 0.10, tailFork: 0, dorsalFin: 0, ventralFin: 0,
               sideFin: 0, eyeSize: 0.085, eyeRing: true, eyePosition: 0.16,
               backSpikes: 4, antennae: 0.5, legPairs: 4, legScale: 0.42,
               spineSegments: 12, radialSegments: 10 }
    }),
    fish('crober', 'Crober', 'shallows', 'boxy', {
      // The same crab in a different coat: everything below the colours is the
      // Craber's own numbers, because that is what it is.
      grounded: true, groups: 0,
      diet: 'scavenger',
      note: 'The Craber, in blue. Same eight legs, same eyes on stalks, same ' +
            'sideways bolt for cover - it is simply the blue one, and there ' +
            'are fewer of them, so finding one on the sand is a small event.',
      backColor: C(0.18, 0.42, 0.82), bellyColor: C(0.72, 0.86, 0.96), finColor: C(0.12, 0.28, 0.62),
      eyeColor: C(0.04, 0.05, 0.08),
      maxHealth: 18, cruiseSpeed: 1.1, sprintSpeed: 5.6, turnRate: 3.6,
      senseRadius: 12, schoolSize: 1, altitude: 0.3, wagRate: 2,
      drops: { titanium: [1, 1] },
      shape: { length: 0.34, height: 0.26, width: 0.46, bellyPosition: 0.50,
               noseSharpness: 0.18, crossSection: 4.2, tailHeight: 0.06,
               tailSweep: 0.10, tailFork: 0, dorsalFin: 0, ventralFin: 0,
               sideFin: 0, eyeSize: 0.085, eyeRing: true, eyePosition: 0.16,
               backSpikes: 4, antennae: 0.5, legPairs: 4, legScale: 0.42,
               spineSegments: 12, radialSegments: 10 }
    }),
    fish('walkingcarni', 'Walkingcarni', 'islet', 'boxy', {
      diet: 'carnivore', groups: 0,
      note: 'Lives on the islet and walks it. Four legs, a long jaw and very ' +
            'little appetite - it takes a fish or two a day out of the reef ' +
            'flat and spends the rest of its time doing nothing in particular. ' +
            'It has no interest in divers whatsoever, until one cuts it.',
      backColor: C(0.46, 0.34, 0.20), bellyColor: C(0.84, 0.76, 0.56), finColor: C(0.32, 0.24, 0.14),
      eyeColor: C(0.95, 0.72, 0.12), glow: 0.2,
      maxHealth: 120, cruiseSpeed: 1.6, sprintSpeed: 5.2, turnRate: 2.0,
      senseRadius: 26, biteDamage: 18, biteInterval: 2.6,
      schoolSize: 1, altitude: 0.6, wagRate: 2.2,
      drops: { tooth: [2, 4], titanium: [1, 2] },
      shape: { length: 1.8, height: 0.24, width: 0.30, bellyPosition: 0.46,
               noseSharpness: 0.34, crossSection: 4.6, tailHeight: 0.07,
               tailSweep: 0.62, tailFork: 0, dorsalFin: 0, ventralFin: 0,
               sideFin: 0, eyeSize: 0.040, eyeRing: true, eyePosition: 0.11,
               mouthLine: 0.014, jawLength: 0.22, backSpikes: 8,
               legPairs: 2, legScale: 0.30,
               spineSegments: 16, radialSegments: 10 }
    }),
    fish('kelper', 'Kelper', 'farkelp', 'arrow', {
      diet: 'carnivore', groups: 0,
      note: "Called up by the leviathan to rob you. Takes one loose item and runs " +
            "for the forest with it. Kill it and you get the thing back.",
      backColor: C(0.30, 0.46, 0.16), bellyColor: C(0.74, 0.82, 0.44), finColor: C(0.46, 0.62, 0.20),
      eyeColor: C(0.95, 0.80, 0.20), glow: 0.35,
      maxHealth: 26, cruiseSpeed: 3.2, sprintSpeed: 7.2, turnRate: 3.2,
      senseRadius: 34, biteDamage: 0, biteInterval: 1,
      schoolSize: 1, altitude: 4, wagRate: 8,
      shape: { length: 0.9, height: 0.20, width: 0.11, bellyPosition: 0.40, noseSharpness: 0.9,
               tailHeight: 0.30, tailSweep: 0.26, tailFork: 0.7, dorsalFin: 0.20,
               ventralFin: 0.10, sideFin: 0.14, eyeSize: 0.05, eyeRing: true,
               backSpikes: 4, spineSegments: 16 }
    }),

    fish('kelperlev', 'Kelper Leviathan', 'farkelp', 'ribbon', {
      leviathan: true, markerColor: '#7fc23a',
      diet: 'carnivore', groups: 0,
      note: "Holds the far forest and does not leave it. Rather than fight, it " +
            "calls up kelpers to strip anything loose off whoever came.",
      backColor: C(0.16, 0.34, 0.12), bellyColor: C(0.66, 0.78, 0.40), finColor: C(0.30, 0.56, 0.16),
      eyeColor: C(1.0, 0.86, 0.24), glow: 0.35,
      maxHealth: 780, cruiseSpeed: 1.9, sprintSpeed: 5.4, turnRate: 0.8,
      senseRadius: 52, biteDamage: 24, biteInterval: 3.6,
      schoolSize: 1, altitude: 9, wagRate: 1.2,
      shape: { length: 11, height: 0.26, width: 0.06, bellyPosition: 0.26, noseSharpness: 0.5,
               crossSection: 1.9, tailHeight: 0.30, tailSweep: 0.40, tailFork: 0.2,
               dorsalFin: 0.22, ventralFin: 0.14, sideFin: 0.10,
               eyeSize: 0.016, eyeRing: true, mouthLine: 0.008,
               jawLength: 0.13, backSpikes: 10, spineSegments: 26, radialSegments: 10 }
    }),

    // ---------------------------------------------------- The bonded stalker
    fish('petstalker', 'Bonded Stalker', 'kelp', 'eel', {
      // Never spawns on its own - awarded for finishing the databank.
      diet: 'carnivore', groups: 0,
      note: 'Follows at your shoulder and goes after whatever comes for you. ' +
            'Paler than its kin, and it will not bite the hand that catalogued it.',
      backColor: C(0.46, 0.52, 0.40), bellyColor: C(0.88, 0.90, 0.76), finColor: C(0.60, 0.66, 0.44),
      eyeColor: C(0.35, 0.90, 0.95),
      glow: 0.25,
      maxHealth: 160, cruiseSpeed: 3.0, sprintSpeed: 7.4, turnRate: 2.6,
      senseRadius: 20, biteDamage: 26, biteInterval: 1.6,
      schoolSize: 1, altitude: 4, wagRate: 3.4,
      shape: { length: 2.4, height: 0.115, width: 0.085, bellyPosition: 0.18,
               noseSharpness: 0.25, crossSection: 2.3,
               tailHeight: 0.20, tailSweep: 0.22, tailFork: 0.25,
               dorsalFin: 0.09, ventralFin: 0.05, sideFin: 0.10,
               eyeSize: 0.026, eyeRing: true,
               jawLength: 0.17, backSpikes: 7, spineSegments: 20, radialSegments: 10 }
    }),

    // --------------------------------------------------- The Red Puff Leviathan
    fish('redpuff', 'Red Puff Leviathan', 'coral', 'bulb', {
      leviathan: true, markerColor: '#e0452c',
      diet: 'carnivore',
      note: 'Grazes the reef and wants no trouble. Corner it and it swells, ' +
            'throws up a cage of thorned vines, and comes after you through them.',
      backColor: C(0.72, 0.12, 0.10), bellyColor: C(0.98, 0.86, 0.62), finColor: C(0.92, 0.38, 0.16),
      eyeColor: C(0.10, 0.06, 0.04), glow: 0.3,
      maxHealth: 520, cruiseSpeed: 1.3, sprintSpeed: 4.8, turnRate: 1.3,
      senseRadius: 40, biteDamage: 16, biteInterval: 3.8,
      schoolSize: 1, groups: 0, altitude: 5, wagRate: 1.8,
      shape: { length: 6.0, height: 0.34, width: 0.32, bellyPosition: 0.36,
               noseSharpness: 0.06, crossSection: 2.1,
               tailHeight: 0.16, tailSweep: 0.14, tailFork: 0.1,
               dorsalFin: 0.07, ventralFin: 0.05, sideFin: 0.14,
               eyeSize: 0.038, eyePosition: 0.16, eyeRing: true, mouthLine: 0.008,
               backSpikes: 14, spineSegments: 20, radialSegments: 12 }
    }),

    // ------------------------------------------------------------- The Whale
    fish('whale', 'Glasswhale Leviathan', 'abyss', 'bulb', {
      note: "Eats stalkers whole. Has no concept of a diver as prey, never " +
            "harms one, and cannot be harmed by one - the knife will not land " +
            "on it. The only animal down here that is simply left alone.",
      leviathan: true, markerColor: '#5fb8e8',
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
               dorsalFin: 0.07, ventralFin: 0.04, sideFin: 0.16,
               // A face: small dark eyes set low and back behind a pale ring,
               // and a broad baleen mouth that opens when it feeds.
               eyeSize: 0.016, eyePosition: 0.19, eyeHeight: 0.05, eyeRing: true,
               mouthLine: 0.012, jawLength: 0.17, jawTeeth: false,
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
    redPuff: byId.redpuff,
    petStalker: byId.petstalker,
    kelperLeviathan: byId.kelperlev,
    kelper: byId.kelper,
    walkingcarni: byId.walkingcarni,
    carniLeviathan: byId.carnilev,
    craber: byId.craber,
    crober: byId.crober,
    glowLeviathan: byId.glowlev,
    diamondLeviathan: byId.diamondlev,
    // Only ordinary prey spawns from the biome roster; the predators and the
    // whale are placed individually by the world builder.
    ofBiome: (biomeId) => SPECIES.filter(
      (s) => (s.biome === biomeId || (s.alsoIn && s.alsoIn.indexOf(biomeId) >= 0))
        && s.diet !== 'carnivore' && s.diet !== 'whale' && !s.grounded)
  };
})(window.SL);
