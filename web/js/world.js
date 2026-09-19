/**
 * Builds and runs the ocean: terrain, water surface, lighting, and every plant,
 * scrap pile and creature in it. Also drives the ambience - fog colour and
 * density track whichever biome the player is swimming through.
 */
(function (SL) {
  'use strict';

  const { MeshData } = SL;

  const CELLS = 32;

  /** Emits one square tile of sea floor, sampled from the height field. */
  function buildTile(game, originX, originZ, cellSize) {
    const mesh = new MeshData();
    const verts = CELLS + 1;

    for (let z = 0; z < verts; z++) {
      for (let x = 0; x < verts; x++) {
        // Vertices are in world space, so neighbouring tiles of the same
        // resolution share exact edge heights and the floor has no seams.
        const wx = originX + x * cellSize;
        const wz = originZ + z * cellSize;
        const color = SL.Biomes.floorColorAt(wx, wz);
        mesh.vertex(wx, SL.Biomes.floorHeightAt(wx, wz), wz, 0, 1, 0, color);
      }
    }

    for (let z = 0; z < CELLS; z++) {
      for (let x = 0; x < CELLS; x++) {
        const a = z * verts + x;
        mesh.quad(a, a + verts, a + verts + 1, a + 1);
      }
    }

    mesh.computeNormals();
    game.addToWorld(new THREE.Mesh(mesh.toGeometry(), game.materials.surface));
  }

  /**
   * The sea floor, in two resolutions.
   *
   * A single grid fine enough for the shelf, stretched over a 1,690 m map,
   * is 630,000 vertices and takes long enough to build that the dive stalls on
   * it. So the floor is a fine inner grid over the water you actually swim in
   * and a coarse outer ring over the abyss you cross, which costs a third of
   * that for the same extent.
   *
   * The coarse cells are exactly three fine cells wide and the ring starts on
   * a fine tile boundary, so the two grids share vertices along the seam rather
   * than tearing. What is left is T-junctions - two fine vertices between every
   * pair of coarse ones - which are sub-metre and 420 m out in water whose fog
   * hides anything past fifty.
   */
  function buildTerrain(game) {
    const FINE = 2.2;
    const COARSE = FINE * 3;          // 6.6 m, so the grids line up
    const FINE_TILES = 12;            // 12 x 12 x 32 x 2.2 m = 845 m across
    const COARSE_TILES = 18;          // 18 x 18 x 32 x 6.6 m = 3,802 m across

    const fineTile = CELLS * FINE;
    const fineHalf = fineTile * FINE_TILES * 0.5;

    const coarseTile = CELLS * COARSE;
    const coarseHalf = coarseTile * COARSE_TILES * 0.5;

    // The coarse ring first, with the middle left out - the fine grid covers
    // exactly the central four-by-four block of it.
    for (let ty = 0; ty < COARSE_TILES; ty++) {
      for (let tx = 0; tx < COARSE_TILES; tx++) {
        const originX = -coarseHalf + tx * coarseTile;
        const originZ = -coarseHalf + ty * coarseTile;

        const inside = originX >= -fineHalf && originX + coarseTile <= fineHalf
          && originZ >= -fineHalf && originZ + coarseTile <= fineHalf;
        if (inside) continue;

        buildTile(game, originX, originZ, COARSE);
      }
    }

    for (let ty = 0; ty < FINE_TILES; ty++) {
      for (let tx = 0; tx < FINE_TILES; tx++) {
        buildTile(game, -fineHalf + tx * fineTile, -fineHalf + ty * fineTile, FINE);
      }
    }
  }

  /**
   * The sea surface: a live patch of water that follows the diver.
   *
   * It used to be one enormous static sheet, which is all you need when the
   * only place you ever see it from is underneath. Now that you can put your
   * head out it has to read as water from above too, so it is a finer grid
   * covering rather less than the camera can see, recentred on the diver every
   * frame and displaced by a couple of crossing swells. The fog hides the far
   * edge long before the grid runs out.
   */
  const WATER_CELLS = 64;
  const WATER_EXTENT = 340;          // metres from the diver to the grid edge

  function buildWaterSurface(game) {
    const step = (WATER_EXTENT * 2) / WATER_CELLS;
    const mesh = new MeshData();
    const verts = WATER_CELLS + 1;
    const color = new THREE.Color(0.05, 0.24, 0.32);

    for (let z = 0; z < verts; z++) {
      for (let x = 0; x < verts; x++) {
        mesh.vertex(-WATER_EXTENT + x * step, SL.WATER_LEVEL, -WATER_EXTENT + z * step,
          0, 1, 0, color);
      }
    }

    for (let z = 0; z < WATER_CELLS; z++) {
      for (let x = 0; x < WATER_CELLS; x++) {
        const a = z * verts + x;
        mesh.quad(a, a + verts, a + verts + 1, a + 1);
      }
    }

    mesh.computeNormals();

    const surface = new THREE.Mesh(mesh.toGeometry(), game.materials.water);
    // It moves with the diver, so it must never be frustum-culled on the
    // strength of where it was built.
    surface.frustumCulled = false;
    game.addToWorld(surface);

    game.water = { mesh: surface, step, verts, centre: new THREE.Vector3(1e9, 0, 1e9) };
  }

  /**
   * Swell, and the patch keeping up with the diver.
   *
   * Recentring is snapped to whole cells, because sliding the grid continuously
   * under a wave function makes the whole sea crawl sideways; snapped, the
   * waves stay put in the world and only the patch moves.
   */
  function updateWater(game, dt) {
    const water = game.water;
    if (!water) return;

    const p = game.player.position;
    const cx = Math.round(p.x / water.step) * water.step;
    const cz = Math.round(p.z / water.step) * water.step;

    const geometry = water.mesh.geometry;
    const pos = geometry.attributes.position;
    const colours = geometry.attributes.color;
    const t = game.time;

    water.mesh.position.set(cx, 0, cz);
    water.centre.set(cx, 0, cz);

    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i) + cx;
      const wz = pos.getZ(i) + cz;

      // Two crossing swells and a small chop, which is enough to read as a
      // moving sea without anything as expensive as a real wave solver.
      const h =
        Math.sin(wx * 0.045 + t * 0.9) * 0.34 +
        Math.sin(wz * 0.031 - t * 0.7) * 0.28 +
        Math.sin((wx + wz) * 0.12 + t * 1.8) * 0.09;

      pos.setY(i, SL.WATER_LEVEL + h);

      // Crests catch the light, troughs go darker - the thing that actually
      // makes a flat-shaded sheet look wet.
      // Floored well above black: at eye level you are looking across wave
      // faces rather than down at them, and a dark trough colour turns the
      // whole horizon into a bar of soot.
      const lift = SL.clamp(0.5 + h * 0.9, 0, 1.4);
      colours.setXYZ(i, 0.09 + lift * 0.10, 0.30 + lift * 0.17, 0.38 + lift * 0.21);
    }

    pos.needsUpdate = true;
    colours.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  /**
   * The sky, for the first time - there was never anywhere to see it from.
   *
   * An inverted sphere carried on the camera, vertex-shaded from a pale horizon
   * to a deeper zenith, with fog off so it does not get eaten by the haze it is
   * supposed to be behind. Hidden underwater, where the murk is the ceiling.
   */
  function buildSky(game) {
    const mesh = new MeshData();
    const radius = 360;
    const rings = 10;
    const segments = 20;

    const horizon = new THREE.Color(0.62, 0.76, 0.84);
    const zenith = new THREE.Color(0.16, 0.38, 0.62);
    const colour = new THREE.Color();

    for (let ring = 0; ring <= rings; ring++) {
      // Only the upper half is ever looked at; below the horizon is sea.
      const phi = (ring / rings) * Math.PI * 0.6;
      const y = Math.cos(phi), r = Math.sin(phi);

      for (let seg = 0; seg <= segments; seg++) {
        const theta = (seg / segments) * Math.PI * 2;
        colour.copy(horizon).lerp(zenith, Math.pow(y, 0.65));
        mesh.vertex(Math.cos(theta) * r * radius, y * radius * 0.55 - 6,
          Math.sin(theta) * r * radius, 0, -1, 0, colour);
      }
    }

    const stride = segments + 1;
    for (let ring = 0; ring < rings; ring++) {
      for (let seg = 0; seg < segments; seg++) {
        const a = ring * stride + seg;
        mesh.quad(a, a + 1, a + stride + 1, a + stride);
      }
    }

    const sky = new THREE.Mesh(mesh.toGeometry(), game.materials.sky);
    sky.frustumCulled = false;
    sky.renderOrder = -1;
    game.camera.add(sky);
    game.sky = sky;
  }

  function buildLighting(game) {
    // Sunlight filtering down from above. Kept low deliberately: vertex colours
    // are already near full brightness, so anything above ~1.0 total blows the
    // sea floor out to white.
    const sun = new THREE.DirectionalLight(0xfff3d8, 0.62);
    sun.position.set(40, 80, 20);
    game.addToWorld(sun);

    // Sky above, dark water below - the classic underwater ambient split.
    // The three intensities deliberately total ~1.0 so vertex colours render at
    // roughly the value they were authored at.
    game.addToWorld(new THREE.HemisphereLight(0x9fd8e8, 0x081412, 0.28));
    game.addToWorld(new THREE.AmbientLight(0x1b3038, 0.12));
  }

  /**
   * Roughly how tall each kind of scenery grows at scale 1, in metres.
   *
   * Seamount tops come within a couple of metres of the surface and the shelf
   * is shallow, so a full-height kelp stalk or coral fan planted there would
   * stand up out of the sea. Every instance is scaled down to the headroom it
   * actually has, and skipped when there is not enough to look right.
   */
  const FLORA_HEIGHT = {
    kelp: 10.2, seagrass: 2.0, coralFan: 1.0, coralTube: 2.7,
    boulder: 4.4, glowPod: 3.2, crystal: 1.8
  };

  /** Keeps the tallest point of anything planted this far under the surface. */
  const SURFACE_CLEARANCE = 0.8;

  function scatterFlora(game) {
    let total = 0;

    for (const biome of SL.Biomes.list) {
      const patches = Math.round((biome.floraDensity || 0) * 34 * areaFactorOf(biome));
      for (let p = 0; p < patches; p++) {
        const center = SL.Biomes.randomPointIn(biome);
        if (!center) continue;

        const instances = [];
        const count = SL.randInt(8, 20);
        for (let i = 0; i < count; i++) {
          // Seeded throughout, so the same world regrows the same forest.
          const angle = SL.random() * Math.PI * 2;
          const dist = Math.sqrt(SL.random()) * 7;
          const x = center.x + Math.cos(angle) * dist;
          const z = center.z + Math.sin(angle) * dist;

          const type = SL.pick(biome.flora);
          const floorY = SL.Biomes.floorHeightAt(x, z);

          // Nothing is allowed to break the surface.
          const headroom = (SL.WATER_LEVEL - SURFACE_CLEARANCE) - floorY;
          const scale = Math.min(SL.randRange(0.7, 1.4), headroom / FLORA_HEIGHT[type]);
          if (scale < 0.25) continue;

          instances.push({
            type,
            // Patch-local, with each plant's foot on the sea floor.
            x: x - center.x,
            y: floorY,
            z: z - center.z,
            yaw: SL.random() * Math.PI * 2,
            scale,
            seed: (SL.random() * 1e9) | 0
          });
        }

        const patch = SL.buildFloraPatch(instances, game.materials);
        patch.position.set(center.x, 0, center.z);
        patch.userData.flora = true;
        game.addToWorld(patch);
        total += instances.length;
      }
    }

    return total;
  }

  /** Cuttable crystal clusters - the quartz source. */
  function scatterCrystals(game) {
    for (const biome of SL.Biomes.list) {
      const nodes = Math.round((biome.crystalDensity || 0) * 22 * areaFactorOf(biome));
      for (let i = 0; i < nodes; i++) {
        const point = SL.Biomes.randomPointIn(biome);
        if (!point) continue;

        const floorY = SL.Biomes.floorHeightAt(point.x, point.z);
        if ((SL.WATER_LEVEL - SURFACE_CLEARANCE) - floorY < 2.6) continue;

        game.crystals.push(new SL.Crystal(game, point.x, point.z, (SL.random() * 1e9) | 0));
      }
    }
  }

  function scatterScrap(game) {
    for (const biome of SL.Biomes.list) {
      const count = Math.round((biome.scrapDensity || 0) * 14 * areaFactorOf(biome));
      for (let i = 0; i < count; i++) {
        const point = SL.Biomes.randomPointIn(biome);
        if (!point) continue;
        game.scrap.push(new SL.Scrap(game, point.x, point.z, (SL.random() * 1e9) | 0));
      }
    }
  }

  /**
   * Scales every school count at once. Each fish is two draw calls, so this is
   * the dial to turn if the frame rate suffers on a weaker machine.
   *
   * This is a density, not a headcount: the number of schools it produces is
   * multiplied by how much sea floor a biome covers. Widening the map to 800 m
   * across therefore multiplied the area without touching this, and left the
   * ocean feeling empty - roughly seven fish inside the fifty-five metres you
   * can actually see. Tripled, that is around twenty, which is the density the
   * smaller map used to have.
   *
   * The cost of raising it is bounded: everything past CULL_DISTANCE is neither
   * drawn nor stepped at full rate, so what this really sets is how many fish
   * are near you, not how many exist.
   */
  const POPULATION = 1.35;

  /**
   * The sea floor a biome covers, in square metres.
   *
   * This is deliberately absolute rather than a share of the map. It used to be
   * a share, and that is why the ocean emptied out every single time the world
   * got wider: a biome holding the same fraction of a map with four times the
   * area got the same number of schools spread over four times the water. Now
   * a biome that covers twice the ground gets twice the fish, and widening the
   * map adds ocean without thinning it.
   */
  function areaOf(biome) {
    return SL.Biomes.areaShareOf(biome) * Math.PI * SL.WORLD_RADIUS * SL.WORLD_RADIUS;
  }

  /**
   * Square metres of sea floor per unit of population. Derived from the map
   * this was last tuned by eye on - a 400 m radius, where a biome holding a
   * ninth of the floor felt right at a factor of 1 - so the numbers authored
   * per species still mean what they meant.
   */
  const AREA_PER_UNIT = Math.PI * 400 * 400 / 9;

  /**
   * The ceiling stops the one enormous biome eating the whole frame budget;
   * the floor keeps a small biome from being empty. Some biomes are meant to
   * be thick with fish regardless of size, and say so.
   */
  function areaFactorOf(biome) {
    const factor = areaOf(biome) / AREA_PER_UNIT;

    // The ceiling scales with the map, because it is a share guard rather than
    // a headcount: it exists so one enormous biome cannot eat the whole frame
    // budget. Left fixed, it started biting on the big biomes the moment the
    // world grew - the abyssal plain and the boulder slope both pinned at the
    // cap, covering twice the ground with the same number of fish, which is
    // the share-versus-absolute thinning all over again by another route.
    const ceiling = 14 * Math.pow(SL.WORLD_RADIUS / 1200, 2);

    return SL.clamp(factor * (biome.populationBoost || 1), 0.5, ceiling);
  }

  /**
   * The two leviathans are placed at the features that exist for them - the
   * king in his basin, the whale over its open ground - rather than scattered
   * anywhere their biome happens to reach.
   */
  function spawnLeviathans(game) {
    const basin = SL.Biomes.kingBasin;
    if (basin) {
      const y = SL.Biomes.floorHeightAt(basin.x, basin.z) + 10;
      const king = new SL.KingStalker(game, SL.Species.kingStalker, basin.x, y, basin.z);
      king.territory.set(basin.x, y, basin.z);
      game.kings.push(king);

      // He already sits on a pile; his subjects keep adding to it.
      for (let j = 0; j < 10; j++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(1.5, 8);
        game.scrap.push(new SL.Scrap(game,
          basin.x + Math.cos(angle) * radius,
          basin.z + Math.sin(angle) * radius,
          (SL.random() * 1e9) | 0));
      }
    }

    // The Red Puff keeps to the reef on a seamount top, which is where it
    // grazes - so it is placed from the coral biome's own ground rather than a
    // feature of its own.
    // Seamount tops come within a couple of metres of the surface, and a six
    // metre animal cannot live in two metres of water - so the reef point is
    // chosen for depth, falling back to the deepest of the tries.
    let reef = null;
    let reefDepth = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = SL.Biomes.randomPointIn(SL.Biomes.byId.coral);
      if (!candidate) break;

      const depth = -SL.Biomes.floorHeightAt(candidate.x, candidate.z);
      if (depth > reefDepth) { reefDepth = depth; reef = candidate; }
      if (depth > 16) break;
    }

    if (reef) {
      const y = SL.Biomes.floorHeightAt(reef.x, reef.z) + Math.min(6, reefDepth * 0.45);
      const puffer = new SL.RedPuff(game, SL.Species.redPuff, reef.x, y, reef.z);
      puffer.territory.set(reef.x, y, reef.z);
      game.puffers.push(puffer);
    }

    // The far forest has a keeper, sat well inside the weeds - so the first
    // sign of it is usually its kelpers, not the animal itself.
    //
    // The bank's crown is the shallowest part of the forest, and eleven metres
    // of leviathan will not fit there, so the deepest forest point out of a
    // handful of tries is used instead.
    // Deep enough for eleven metres of animal, but still short of the rubble
    // the forest stops at, so it is standing in its own kelp.
    let grove = null;
    let groveDepth = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = SL.Biomes.randomPointIn(SL.Biomes.byId.farkelp);
      if (!candidate) break;

      const depth = -SL.Biomes.floorHeightAt(candidate.x, candidate.z);
      if (depth > 30) continue;
      if (depth > groveDepth) { groveDepth = depth; grove = candidate; }
      if (depth > 22) break;
    }

    if (grove) {
      const floor = SL.Biomes.floorHeightAt(grove.x, grove.z);
      const y = Math.min(floor + groveDepth * 0.45, SL.WATER_LEVEL - 6);
      const lev = new SL.KelperLeviathan(game, grove.x, y, grove.z);
      lev.territory.set(grove.x, y, grove.z);
      game.kelperLevs.push(lev);
    }

    // The glow one lives out on the plain, which is otherwise the emptiest
    // water in the game. Placed deep and far, so crossing the abyss is how you
    // find it rather than swimming to a marked spot.
    let plain = null;
    let plainDepth = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      const candidate = SL.Biomes.randomPointIn(SL.Biomes.byId.abyss);
      if (!candidate) break;

      const depth = -SL.Biomes.floorHeightAt(candidate.x, candidate.z);
      if (depth > plainDepth) { plainDepth = depth; plain = candidate; }
      if (depth > 80) break;
    }

    if (plain) {
      const y = Math.min(SL.Biomes.floorHeightAt(plain.x, plain.z) + 24, SL.WATER_LEVEL - 20);
      const glow = new SL.GlowLeviathan(game, SL.Species.glowLeviathan, plain.x, y, plain.z);
      glow.territory.set(plain.x, y, plain.z);
      game.glowLevs.push(glow);
    }

    const ground = SL.Biomes.whaleGround;
    if (ground) {
      const y = SL.Biomes.floorHeightAt(ground.x, ground.z) + 26;
      const whale = new SL.Whale(game, SL.Species.whale, ground.x, y, ground.z);
      whale.territory.set(ground.x, y, ground.z);
      game.whales.push(whale);
    }
  }

  /**
   * Nests, for the six species that build them.
   *
   * Placed before the schools are, because a nesting school is then anchored to
   * a nest rather than to an arbitrary point - which is what makes a nest worth
   * finding, instead of a decoration that happens to sit near some fish.
   */
  function scatterNests(game) {
    for (const species of SL.Species.list) {
      if (!species.nests) continue;

      const biomes = [species.biome].concat(species.alsoIn || []);
      for (const biomeId of biomes) {
        const biome = SL.Biomes.byId[biomeId];
        if (!biome) continue;

        const count = Math.max(1, Math.round(3 * areaFactorOf(biome)));
        for (let i = 0; i < count; i++) {
          const point = SL.Biomes.randomPointIn(biome);
          if (!point) continue;

          // Nothing nests where it would be left high and dry.
          if (SL.Biomes.floorHeightAt(point.x, point.z) > SL.WATER_LEVEL - 2.5) continue;

          game.nests.push(new SL.Nest(game, species, point.x, point.z,
            (SL.random() * 1e9) | 0));
        }
      }
    }
  }

  /**
   * The islet's two residents, standing on the only dry ground in the world.
   *
   * Both are placed by taking the highest of a handful of tries, so they start
   * on the island rather than in the surf around it - the leviathan first, and
   * from a tighter radius, so it gets the summit and the small one gets the
   * slope.
   */
  function highestPointOn(islet, spread, tries) {
    let spot = null;
    let best = -1e9;
    for (let attempt = 0; attempt < tries; attempt++) {
      const angle = SL.random() * Math.PI * 2;
      const radius = Math.sqrt(SL.random()) * islet.peakRadius * spread;
      const x = islet.x + Math.cos(angle) * radius;
      const z = islet.z + Math.sin(angle) * radius;
      const y = SL.Biomes.floorHeightAt(x, z);
      if (y > best) { best = y; spot = { x, z }; }
    }
    return spot;
  }

  function spawnIslander(game) {
    const islet = SL.Biomes.islet;
    if (!islet || !SL.Walkingcarni) return;

    // The big one starts on the beach. It lives at the tideline - that is
    // where the fish are and where a diver can actually be - so putting it on
    // the summit just meant a long walk down before anything happened.
    if (SL.WalkingcarniLeviathan) {
      let shore = null;
      for (let attempt = 0; attempt < 60 && !shore; attempt++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(islet.peakRadius, islet.shoulderRadius * 1.4);
        const x = islet.x + Math.cos(angle) * radius;
        const z = islet.z + Math.sin(angle) * radius;
        const y = SL.Biomes.floorHeightAt(x, z);
        if (y > -1 && y < 6) shore = { x, z };
      }
      shore = shore || highestPointOn(islet, 0.9, 30);
      if (shore) game.carniLevs.push(new SL.WalkingcarniLeviathan(game, shore.x, shore.z));
    }

    const slope = highestPointOn(islet, 1.4, 30);
    if (slope) game.carnis.push(new SL.Walkingcarni(game, slope.x, slope.z));
  }

  /** Crabs, on the sand of the Safe Shallows and nowhere else. */
  function scatterCrabers(game) {
    if (!SL.Craber) return;

    const shallows = SL.Biomes.byId.shallows;
    const count = Math.round(7 * areaFactorOf(shallows));

    for (let i = 0; i < count; i++) {
      // The index point carries up to half a cell of jitter - about eight
      // metres on a map this size - which is enough to drop a crab over the
      // line into the kelp. Checked, because "only the shallows" means it.
      let point = null;
      for (let attempt = 0; attempt < 8 && !point; attempt++) {
        const candidate = SL.Biomes.randomPointIn(shallows);
        if (!candidate) break;
        if (SL.Biomes.biomeAt(candidate.x, candidate.z) === shallows) point = candidate;
      }
      if (!point) continue;

      game.crabers.push(new SL.Craber(game, point.x, point.z));
    }
  }

  function spawnCreatures(game) {
    spawnLeviathans(game);
    scatterNests(game);
    spawnIslander(game);
    scatterCrabers(game);

    for (const biome of SL.Biomes.list) {
      const density = POPULATION * areaFactorOf(biome);

      // --- Fish -------------------------------------------------------------
      for (const species of SL.Species.ofBiome(biome.id)) {
        const groups = Math.max(1, Math.round(species.groups * density));

        // A nesting species keeps most of its schools over its own clutches.
        const nests = species.nests
          ? game.nests.filter((n) => n.species === species
              && SL.Biomes.biomeAt(n.position.x, n.position.z) === biome)
          : null;

        for (let g = 0; g < groups; g++) {
          const nest = nests && nests.length && SL.random() < 0.6
            ? nests[Math.floor(SL.random() * nests.length)]
            : null;

          const point = nest
            ? { x: nest.position.x + SL.randRange(-4, 4), z: nest.position.z + SL.randRange(-4, 4) }
            : SL.Biomes.randomPointIn(biome);
          if (!point) continue;

          const floor = SL.Biomes.floorHeightAt(point.x, point.z);
          const y = Math.min(floor + species.altitude * SL.randRange(0.8, 1.6), SL.WATER_LEVEL - 3);

          let leader = null;
          for (let i = 0; i < species.schoolSize; i++) {
            const fish = new SL.Fish(game, species,
              point.x + SL.randRange(-2.6, 2.6),
              y + SL.randRange(-1.2, 1.2),
              point.z + SL.randRange(-2.6, 2.6));
            fish.territory.set(point.x, y, point.z);
            fish.territoryRadius = 22;

            if (i === 0) {
              leader = fish;
            } else {
              // Followers hold a slot in a loose wedge behind the leader.
              const spacing = Math.max(0.6, species.shape.length * 1.6);
              const row = Math.ceil(i / 2);
              const side = i % 2 === 0 ? 1 : -1;
              fish.setLeader(leader, new THREE.Vector3(
                side * row * spacing * 0.8,
                SL.randRange(-0.4, 0.4) * spacing,
                -row * spacing));
            }
            game.fish.push(fish);
          }
        }
      }

      // --- Stalkers -----------------------------------------------------------
      const stalkers = Math.round((biome.stalkerDensity || 0) * 9 * areaFactorOf(biome));
      for (let i = 0; i < stalkers; i++) {
        const point = SL.Biomes.randomPointIn(biome);
        if (!point) continue;
        const y = SL.Biomes.floorHeightAt(point.x, point.z) + 5;
        const stalker = new SL.Stalker(game, SL.Species.stalker, point.x, y, point.z);
        stalker.territory.set(point.x, y, point.z);
        game.stalkers.push(stalker);
      }
    }
  }

  /**
   * Stalkers chew scrap out of existence, so top the kelp forest back up.
   * Without this the biome's whole reason to exist quietly disappears.
   */
  function replenishScrap(game) {
    const kelp = SL.Biomes.byId.kelp;
    const target = Math.round(kelp.scrapDensity * 14 * areaFactorOf(kelp));
    const alive = game.scrap.length;
    if (alive >= target) return;

    for (let i = alive; i < target; i++) {
      const point = SL.Biomes.randomPointIn(kelp);
      if (!point) continue;

      // Never pop a piece into existence in front of the player.
      const dx = point.x - game.player.position.x;
      const dz = point.z - game.player.position.z;
      if (dx * dx + dz * dz < 900) continue;

      game.scrap.push(new SL.Scrap(game, point.x, point.z, (SL.random() * 1e9) | 0));
    }
  }

  const _fogTarget = new THREE.Color();

  /** The colour the hacked candle drags the trench water toward. */
  const _candleWater = new THREE.Color(0.10, 0.062, 0.030);

  /** Where the air goes at distance, matched to the sky's horizon band. */
  const _airHaze = new THREE.Color(0.62, 0.76, 0.84);

  /** Thin, but enough to hide the rim of the water patch. */
  const AIR_FOG = 0.0045;

  function updateAmbience(game, dt) {
    const p = game.player.position;
    const biome = SL.Biomes.biomeAt(p.x, p.z);

    // Above the surface the haze lifts; deeper water is darker water.
    const submerged = SL.clamp((SL.WATER_LEVEL - p.y) / 4, 0, 1);
    const depthFade = SL.clamp(1 - (SL.WATER_LEVEL - p.y) / 90, 0.12, 1);

    // The sky is only there when there is somewhere to see it from, and it
    // fades in across the same few metres the murk fades out over.
    if (game.sky) {
      game.sky.material.opacity = 1 - submerged;
      game.sky.visible = submerged < 0.995;
    }

    // The Quartz Visor cuts the murk everywhere.
    let clarity = 1 - (game.player.visionBonus || 0);

    // The hacked candle cuts it in one place only. The trench is by far the
    // thickest water in the game (0.070 against the shallows' 0.012), so
    // halving it there is the difference between two metres of visibility and
    // actually seeing the canyon you are in.
    const candle = game.player.candleGlow || 0;
    clarity *= 1 - candle * 0.55;

    _fogTarget.copy(biome.waterColor).multiplyScalar(depthFade);

    // Warm the water it lights, so the trench reads as candlelit rather than
    // as the same black with less of it.
    if (candle > 0.01) _fogTarget.lerp(_candleWater, candle * 0.5);

    // Out of the water the fog becomes distance haze in the horizon's colour,
    // thin enough to see a long way and thick enough to swallow the edge of
    // the water patch before the camera's far plane cuts it.
    _fogTarget.lerp(_airHaze, 1 - submerged);
    const density = SL.lerp(AIR_FOG, biome.fogDensity * clarity, submerged);

    game.scene.fog.color.lerp(_fogTarget, 1 - Math.exp(-1.2 * dt));
    game.scene.fog.density = SL.damp(game.scene.fog.density, density, 1.2, dt);
    game.scene.background = game.scene.fog.color;

    game.audio.setDepth(game.player.depth);
  }

  SL.World = { buildTerrain, buildWaterSurface, buildSky, updateWater, buildLighting,
    scatterFlora, scatterScrap, scatterCrystals, spawnCreatures, spawnLeviathans,
    scatterNests, spawnIslander, scatterCrabers, replenishScrap, updateAmbience };
})(window.SL);
