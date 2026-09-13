/**
 * Kelp, grass, coral, boulders and glow pods.
 *
 * A kelp forest needs hundreds of plants, and hundreds of objects would be
 * hundreds of draw calls. Instead the world builder groups nearby plants into a
 * patch and bakes them all into a single geometry - one lit, one emissive for
 * the glow pods.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hash = SL.hash;

  /** A tall kelp stalk with a lazy curve and leaves running up it. */
  function kelp(mesh, seed, scale) {
    const height = SL.lerp(4.2, 9.8, hash(seed, 1, 3)) * scale;
    const radius = SL.lerp(0.05, 0.09, hash(seed, 2, 3)) * scale;
    const rings = 12;

    // The stalk leans and twists so no two plants match.
    const leanAngle = hash(seed, 3, 3) * Math.PI * 2;
    const leanAmount = SL.lerp(0.3, 1.4, hash(seed, 4, 3));
    const twist = SL.lerp(0.6, 2.2, hash(seed, 5, 3));

    const spine = [], widths = [], heights = [], colors = [];
    const base = new THREE.Color(0.10, 0.26, 0.10);
    const tip = new THREE.Color(0.55, 0.62, 0.18);

    for (let i = 0; i < rings; i++) {
      const t = i / (rings - 1);
      // Sway baked into the geometry, growing toward the tip.
      const sway = Math.sin(t * Math.PI * twist) * leanAmount * t;
      spine.push(V(Math.cos(leanAngle) * sway, t * height, Math.sin(leanAngle) * sway));
      const r = radius * SL.lerp(1, 0.35, t);
      widths.push(r); heights.push(r);
      colors.push(base.clone().lerp(tip, t));
    }

    Geo.loft(mesh, spine, widths, heights, colors, 6, 2, base, 0);

    // Leaves: broad blades hanging off alternating sides of the stalk.
    const leaves = 5 + Math.floor(hash(seed, 6, 3) * 5);
    for (let i = 0; i < leaves; i++) {
      const t = SL.lerp(0.25, 0.97, i / Math.max(1, leaves - 1));
      const root = spine[SL.clamp(Math.round(t * (rings - 1)), 0, rings - 1)];
      const angle = leanAngle + i * 2.4;
      const dir = V(Math.cos(angle), 0, Math.sin(angle));
      const len = SL.lerp(0.6, 1.5, hash(seed, 20 + i, 3)) * scale;
      const color = new THREE.Color(0.14, 0.34, 0.12).lerp(new THREE.Color(0.42, 0.55, 0.16), t);

      Geo.quadPoly(mesh,
        root.clone().add(V(0, -0.08, 0)),
        root.clone().add(V(0, 0.14, 0)),
        root.clone().addScaledVector(dir, len).add(V(0, 0.20 - len * 0.25, 0)),
        root.clone().addScaledVector(dir, len).add(V(0, -0.30 - len * 0.25, 0)),
        color, true);
    }
  }

  /** A tuft of thin blades. */
  function seagrass(mesh, seed, scale) {
    const blades = 6 + Math.floor(hash(seed, 1, 7) * 8);
    for (let i = 0; i < blades; i++) {
      const angle = hash(seed, i * 2, 7) * Math.PI * 2;
      const dist = hash(seed, i * 2 + 1, 7) * 0.4 * scale;
      const root = V(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

      const h = SL.lerp(0.7, 1.9, hash(seed, i + 40, 7)) * scale;
      const w = SL.lerp(0.04, 0.09, hash(seed, i + 80, 7)) * scale;
      const lean = hash(seed, i + 120, 7) * Math.PI * 2;
      const tip = root.clone().add(V(Math.cos(lean) * h * 0.35, h, Math.sin(lean) * h * 0.35));

      const color = new THREE.Color(0.18, 0.40, 0.16).lerp(new THREE.Color(0.48, 0.62, 0.22), hash(seed, i, 11));
      Geo.quadPoly(mesh,
        root.clone().add(V(-w, 0, 0)), root.clone().add(V(w, 0, 0)),
        tip.clone().add(V(w * 0.3, 0, 0)), tip.clone().add(V(-w * 0.3, 0, 0)),
        color, true);
    }
  }

  /** A flat, ribbed coral fan. */
  function coralFan(mesh, seed, scale) {
    const radius = SL.lerp(0.35, 0.85, hash(seed, 1, 13)) * scale;
    const ribs = 7;
    const spread = SL.lerp(1.6, 2.6, hash(seed, 2, 13));
    const facing = hash(seed, 3, 13) * Math.PI * 2;
    const inner = new THREE.Color(0.55, 0.10, 0.12);
    const outer = new THREE.Color(0.95, 0.35, 0.28);

    for (let i = 0; i < ribs; i++) {
      const t0 = i / ribs, t1 = (i + 1) / ribs;
      const a0 = facing + (t0 - 0.5) * spread;
      const a1 = facing + (t1 - 0.5) * spread;
      // A shallow bowl: the fan curls forward at its edges.
      Geo.quadPoly(mesh,
        V(Math.cos(a0) * radius * 0.2, radius * 0.15, Math.sin(a0) * radius * 0.2),
        V(Math.cos(a0) * radius, radius * 1.1, Math.sin(a0) * radius),
        V(Math.cos(a1) * radius, radius * 1.1, Math.sin(a1) * radius),
        V(Math.cos(a1) * radius * 0.2, radius * 0.15, Math.sin(a1) * radius * 0.2),
        inner.clone().lerp(outer, t0), true);
    }
  }

  /** A cluster of coral tubes of uneven height. */
  function coralTube(mesh, seed, scale) {
    const tubes = 3 + Math.floor(hash(seed, 1, 17) * 4);
    for (let i = 0; i < tubes; i++) {
      const angle = hash(seed, i, 17) * Math.PI * 2;
      const dist = hash(seed, i + 10, 17) * 0.6 * scale;
      const bx = Math.cos(angle) * dist, bz = Math.sin(angle) * dist;

      const height = SL.lerp(0.8, 2.6, hash(seed, i + 20, 17)) * scale;
      const radius = SL.lerp(0.14, 0.30, hash(seed, i + 30, 17)) * scale;
      const color = new THREE.Color(0.85, 0.25, 0.30).lerp(new THREE.Color(0.95, 0.55, 0.20), hash(seed, i + 40, 17));

      const spine = [], widths = [], heights = [], colors = [];
      const rings = 5;
      for (let r = 0; r < rings; r++) {
        const t = r / (rings - 1);
        spine.push(V(bx, t * height, bz));
        const taper = radius * SL.lerp(1, 0.7, t);
        widths.push(taper); heights.push(taper);
        colors.push(color.clone().multiplyScalar(SL.lerp(0.75, 1.15, t)));
      }
      Geo.loft(mesh, spine, widths, heights, colors, 7, 2, color, 0);
    }
  }

  /** A lumpy rock: a sphere with its vertices pushed around by noise. */
  function boulder(mesh, seed, scale) {
    const radius = SL.lerp(0.9, 3.2, hash(seed, 1, 19)) * scale;
    const rock = new MeshData();
    Geo.sphere(rock, 0, 0, 0, radius, 10, new THREE.Color(0.30, 0.30, 0.32));

    for (let i = 0; i < rock.count; i++) {
      const x = rock.pos[i * 3], y = rock.pos[i * 3 + 1], z = rock.pos[i * 3 + 2];
      const offset = seed % 97;
      const noise = SL.fbm(x + offset, z - offset, 3, 1.2, 2.1, 0.5, seed);
      const s = 1 + noise * 0.28;
      rock.pos[i * 3] = x * s;
      rock.pos[i * 3 + 1] = Math.max(y * s, -radius * 0.25); // flatten the buried underside
      rock.pos[i * 3 + 2] = z * s;

      const shade = 0.8 + noise * 0.35;
      rock.col[i * 3] = 0.30 * shade;
      rock.col[i * 3 + 1] = 0.30 * shade;
      rock.col[i * 3 + 2] = 0.33 * shade;
    }

    rock.computeNormals();
    mesh.append(rock, new THREE.Matrix4().makeTranslation(0, radius * 0.35, 0));
  }

  /** A glowing pod on a thin stalk. The pod goes in the emissive mesh. */
  function glowPod(mesh, glowMesh, seed, scale) {
    const height = SL.lerp(0.9, 2.6, hash(seed, 1, 23)) * scale;
    const podRadius = SL.lerp(0.22, 0.46, hash(seed, 2, 23)) * scale;

    Geo.cone(mesh, 0, 0, 0, 0.09 * scale, height, 6,
      new THREE.Color(0.10, 0.14, 0.12), new THREE.Color(0.16, 0.24, 0.20));

    const podColor = new THREE.Color(0.20, 0.95, 0.85).lerp(new THREE.Color(0.55, 0.75, 1.0), hash(seed, 3, 23));
    Geo.sphere(glowMesh, 0, height, 0, podRadius, 9, podColor);
  }

  /** A low cluster of pink crystal shards. Decoration; the cuttable ones are
   *  Crystal entities placed separately by the world builder. */
  function crystal(mesh, glowMesh, seed, scale) {
    const shards = 3 + Math.floor(hash(seed, 1, 29) * 4);
    for (let i = 0; i < shards; i++) {
      const angle = hash(seed, i, 29) * Math.PI * 2;
      const dist = hash(seed, i + 5, 29) * 0.6 * scale;
      const height = SL.lerp(0.4, 1.6, hash(seed, i + 10, 29)) * scale;
      const radius = SL.lerp(0.07, 0.20, hash(seed, i + 15, 29)) * scale;

      const base = new THREE.Color(0.55, 0.14, 0.38);
      const tip = new THREE.Color(1.0, 0.60, 0.85).lerp(new THREE.Color(0.80, 0.66, 1.0), hash(seed, i + 20, 29));

      const shard = new MeshData();
      Geo.cone(shard, 0, 0, 0, radius, height, 6, base, tip);
      const lean = (hash(seed, i + 25, 29) - 0.5) * 0.8;
      glowMesh.append(shard, new THREE.Matrix4().compose(
        V(Math.cos(angle) * dist, 0, Math.sin(angle) * dist),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, angle, lean * 0.5)),
        V(1, 1, 1)));
    }
  }

  const BUILDERS = { kelp, seagrass, coralFan, coralTube, boulder, glowPod };

  /**
   * Bakes a list of {type, x, y, z, yaw, scale, seed} into one Object3D.
   * Positions are patch-local.
   */
  SL.buildFloraPatch = function (instances, materials) {
    const opaque = new MeshData();
    const emissive = new MeshData();
    const matrix = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);

    for (const it of instances) {
      const local = new MeshData();
      const localGlow = new MeshData();

      if (it.type === 'glowPod') glowPod(local, localGlow, it.seed, it.scale);
      else if (it.type === 'crystal') crystal(local, localGlow, it.seed, it.scale);
      else BUILDERS[it.type](local, it.seed, it.scale);

      quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), it.yaw);
      matrix.compose(new THREE.Vector3(it.x, it.y, it.z), quat, one);

      opaque.append(local, matrix);
      if (!localGlow.isEmpty) emissive.append(localGlow, matrix);
    }

    const group = new THREE.Group();
    if (!opaque.isEmpty) {
      opaque.computeNormals();
      group.add(new THREE.Mesh(opaque.toGeometry(), materials.surface));
    }
    if (!emissive.isEmpty) {
      emissive.computeNormals();
      group.add(new THREE.Mesh(emissive.toGeometry(), materials.glow));
    }
    return group;
  };
})(window.SL);
