/**
 * Builds and runs the ocean: terrain, water surface, lighting, and every plant,
 * scrap pile and creature in it. Also drives the ambience - fog colour and
 * density track whichever biome the player is swimming through.
 */
(function (SL) {
  'use strict';

  const { MeshData } = SL;

  /** The sea floor, as tiles sampled from the analytic height field. */
  function buildTerrain(game) {
    // 9 x 9 tiles of 32 cells at 1.8 m covers roughly 520 m across, which holds
    // the 240 m world radius with margin. Tiles are frustum-culled, so only a
    // fraction of the triangle count is ever drawn.
    const TILES = 9;
    const CELLS = 32;
    const CELL_SIZE = 1.8;
    const tileSize = CELLS * CELL_SIZE;
    const half = tileSize * TILES * 0.5;

    for (let ty = 0; ty < TILES; ty++) {
      for (let tx = 0; tx < TILES; tx++) {
        const originX = -half + tx * tileSize;
        const originZ = -half + ty * tileSize;
        const mesh = new MeshData();
        const verts = CELLS + 1;

        for (let z = 0; z < verts; z++) {
          for (let x = 0; x < verts; x++) {
            // Vertices are in world space, so neighbouring tiles share exact
            // edge heights and the floor has no visible seams.
            const wx = originX + x * CELL_SIZE;
            const wz = originZ + z * CELL_SIZE;
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
    }
  }

  /**
   * A gently rippled sheet at the water line. From below it is the ceiling of
   * the world; from above it reads as open ocean.
   */
  function buildWaterSurface(game) {
    const extent = SL.WORLD_RADIUS * 1.5;
    const cells = 26;
    const step = (extent * 2) / cells;
    const mesh = new MeshData();
    const verts = cells + 1;
    const color = new THREE.Color();

    for (let z = 0; z < verts; z++) {
      for (let x = 0; x < verts; x++) {
        const wx = -extent + x * step;
        const wz = -extent + z * step;
        const ripple = SL.fbm(wx, wz, 2, 0.08, 2, 0.5, 4242) * 0.35;
        color.setRGB(0.04, 0.22, 0.30).multiplyScalar(1 + ripple * 0.4);
        mesh.vertex(wx, SL.WATER_LEVEL + ripple, wz, 0, 1, 0, color);
      }
    }

    for (let z = 0; z < cells; z++) {
      for (let x = 0; x < cells; x++) {
        const a = z * verts + x;
        mesh.quad(a, a + verts, a + verts + 1, a + 1);
      }
    }

    mesh.computeNormals();
    game.addToWorld(new THREE.Mesh(mesh.toGeometry(), game.materials.water));
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
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * 7;
          const x = center.x + Math.cos(angle) * dist;
          const z = center.z + Math.sin(angle) * dist;

          instances.push({
            type: SL.pick(biome.flora),
            // Patch-local, with each plant's foot on the sea floor.
            x: x - center.x,
            y: SL.Biomes.floorHeightAt(x, z),
            z: z - center.z,
            yaw: Math.random() * Math.PI * 2,
            scale: SL.randRange(0.7, 1.4),
            seed: (Math.random() * 1e9) | 0
          });
        }

        const patch = SL.buildFloraPatch(instances, game.materials);
        patch.position.set(center.x, 0, center.z);
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
        game.scrap.push(new SL.Scrap(game, point.x, point.z, (Math.random() * 1e9) | 0));
      }
    }
  }

  /**
   * Scales every school count at once. Each fish is two draw calls, so this is
   * the dial to turn if the frame rate suffers on a weaker machine.
   */
  const POPULATION = 0.45;

  /**
   * School counts are authored per species, but the rings are wildly different
   * sizes - the Red Coral Reef covers nearly three times the sea floor of the
   * Safe Shallows. Spawning the same number of schools in both leaves the outer
   * biomes feeling empty, because you can swim a long way between clusters.
   * This scales school counts by ring area so the distance between schools stays
   * roughly constant wherever you are.
   */
  /**
   * Biomes no longer occupy tidy rings - a seamount reef may be a tenth the
   * size of the abyssal plain - so populations are expressed as a density and
   * multiplied by how much sea floor the biome actually covers in this world.
   */
  function areaFactorOf(biome) {
    return SL.clamp(SL.Biomes.areaShareOf(biome) * 9, 0.35, 3.2);
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

    const ground = SL.Biomes.whaleGround;
    if (ground) {
      const y = SL.Biomes.floorHeightAt(ground.x, ground.z) + 26;
      const whale = new SL.Whale(game, SL.Species.whale, ground.x, y, ground.z);
      whale.territory.set(ground.x, y, ground.z);
      game.whales.push(whale);
    }
  }

  function spawnCreatures(game) {
    spawnLeviathans(game);

    for (const biome of SL.Biomes.list) {
      const density = POPULATION * areaFactorOf(biome);

      // --- Fish -------------------------------------------------------------
      for (const species of SL.Species.ofBiome(biome.id)) {
        const groups = Math.max(1, Math.round(species.groups * density));
        for (let g = 0; g < groups; g++) {
          const point = SL.Biomes.randomPointIn(biome);
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

      game.scrap.push(new SL.Scrap(game, point.x, point.z, (Math.random() * 1e9) | 0));
    }
  }

  const _fogTarget = new THREE.Color();

  function updateAmbience(game, dt) {
    const p = game.player.position;
    const biome = SL.Biomes.biomeAt(p.x, p.z);

    // Above the surface the haze lifts; deeper water is darker water.
    const submerged = SL.clamp((SL.WATER_LEVEL - p.y) / 4, 0, 1);
    const depthFade = SL.clamp(1 - (SL.WATER_LEVEL - p.y) / 90, 0.12, 1);

    // The Quartz Visor cuts the murk everywhere.
    const clarity = 1 - (game.player.visionBonus || 0);

    _fogTarget.copy(biome.waterColor).multiplyScalar(depthFade);

    game.scene.fog.color.lerp(_fogTarget, 1 - Math.exp(-1.2 * dt));
    game.scene.fog.density = SL.damp(game.scene.fog.density, biome.fogDensity * submerged * clarity, 1.2, dt);
    game.scene.background = game.scene.fog.color;

    game.audio.setDepth(game.player.depth);
  }

  SL.World = { buildTerrain, buildWaterSurface, buildLighting, scatterFlora, scatterScrap,
    scatterCrystals, spawnCreatures, spawnLeviathans, replenishScrap, updateAmbience };
})(window.SL);
