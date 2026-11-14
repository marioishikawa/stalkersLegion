/**
 * The lobster cave: a dome of packed sand on the floor of the Safe Shallows,
 * with one way in, and the Big Lobster living inside it.
 *
 * Lobsters round about know where it is. Hurt one and it runs for the cave.
 * Hurt one - or kill one - and the Big Lobster remembers: go into its cave
 * after that and it comes for you, claws first, until you are back out of the
 * door. It does not follow you out. It is the cave it cares about.
 *
 * The cave is found, not rolled - the nearest flat patch of shallows deep
 * enough to hold it, scanning outward from the wreck - so building it moves
 * nothing else in the world. It is placed before the terrain is built, so the
 * sand under it can be levelled.
 *
 * Its shape is half an ellipsoid: `R` across, `H` high, sitting on level sand
 * at `y`. The door faces the wreck.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;

  const C = {
    placed: false,
    x: 0, y: 0, z: 0,
    /** Half-width and height of the dome. */
    R: 7.5, H: 4.4,
    /** The door: which way it faces (an angle in the x-z plane), how wide, how tall. */
    door: 0, doorHalf: 0.3, archTop: 2.7,
    /** Level sand round it, and the blend back into the floor. */
    flat: 10, edge: 16,
    /** How thick the walls count as, for bumping into them. */
    wall: 0.35
  };

  const _n = { x: 0, y: 0, z: 0 };

  function angleGap(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }

  /** Distance from the centre in the dome's own squashed space: R at the wall. */
  function shellDistance(dx, dy, dz) {
    return Math.hypot(dx, Math.max(dy, 0) * (C.R / C.H), dz);
  }

  /** Whether a point (relative to the centre) is in the doorway. */
  function inDoor(dx, dy, dz, radius) {
    if (dy > C.archTop - radius * 0.5) return false;
    const slack = Math.min(C.doorHalf * 0.8, (radius * 0.9) / C.R);
    return angleGap(Math.atan2(dz, dx), C.door) < C.doorHalf - slack;
  }

  /** Moves (dx, dy, dz) to squashed distance `target` from the centre, into `out` as a push. */
  function pushTo(dx, dy, dz, q, target, out) {
    const k = target / Math.max(q, 1e-3);
    const nx = dx * k, nz = dz * k;
    const ny = dy > 0 ? dy * k : dy;
    out.x = nx - dx; out.y = ny - dy; out.z = nz - dz;
    return out;
  }

  const Cave = {
    layout: C,

    /** The Big Lobster that lives here, once spawned. */
    keeper: null,

    /** Set once the diver has hurt a lobster; cleared once they have been seen out. */
    grudge: false,
    chased: false,

    get placed() { return C.placed; },

    /**
     * Finds the cave's spot for the world now seeded. Runs after the biome
     * index is built and before the terrain is, so the level sand under it is
     * part of the floor everything else sees.
     */
    place() {
      C.placed = false;
      this.keeper = null;
      this.grudge = false;
      this.chased = false;

      const B = SL.Biomes;
      const shallows = B.byId.shallows;
      const flatEnough = (x, z, y) => {
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          for (const r of [4, 9]) {
            const sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r;
            if (B.biomeAt(sx, sz) !== shallows) return false;
            if (Math.abs(B.floorHeightAt(sx, sz) - y) > 2.6) return false;
          }
        }
        return true;
      };

      let found = null;
      for (let r = 70; r <= 420 && !found; r += 14) {
        const steps = Math.max(24, Math.round(r / 6));
        for (let i = 0; i < steps; i++) {
          const a = (i / steps) * Math.PI * 2 + r * 0.013;
          const x = Math.cos(a) * r, z = Math.sin(a) * r;
          if (SL.Wreck && Math.hypot(x - SL.Wreck.layout.x, z - SL.Wreck.layout.z) < SL.Wreck.layout.craterEdge + C.edge) continue;
          if (B.biomeAt(x, z) !== shallows) continue;
          const y = B.floorHeightAt(x, z);
          if (-y < 9.5 || -y > 18) continue;
          if (!flatEnough(x, z, y)) continue;
          found = { x, z, y };
          break;
        }
      }
      if (!found) return false;

      C.x = found.x; C.z = found.z;
      // Level it at the average of the sand round about, so neither edge
      // sits in a hole.
      let sum = 0, n = 0;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        sum += B.floorHeightAt(found.x + Math.cos(a) * 8, found.z + Math.sin(a) * 8); n++;
      }
      C.y = sum / n;
      // The door looks back towards the wreck, the way you will come.
      C.door = Math.atan2(-found.z, -found.x);
      C.placed = true;
      return true;
    },

    /** The sea floor, levelled under and round the cave. */
    floor(x, z, y) {
      if (!C.placed) return y;
      const dx = x - C.x, dz = z - C.z;
      if (dx > C.edge || dx < -C.edge || dz > C.edge || dz < -C.edge) return y;
      const r = Math.hypot(dx, dz);
      if (r >= C.edge) return y;
      return SL.lerp(C.y, y, SL.smoothstep((r - C.flat) / (C.edge - C.flat)));
    },

    /** Whether a patch of floor is part of the cave's level sand. */
    inYard(x, z) {
      return C.placed && Math.hypot(x - C.x, z - C.z) < C.edge;
    },

    /** Whether the dome covers this patch of sand, with some room to spare. */
    covers(x, z, margin) {
      return C.placed && Math.hypot(x - C.x, z - C.z) < C.R + (margin || 0);
    },

    /** Whether a point is inside the dome. */
    isInside(position) {
      if (!C.placed) return false;
      const dx = position.x - C.x, dy = position.y - C.y, dz = position.z - C.z;
      return dy < C.H && shellDistance(dx, dy, dz) < C.R - 0.1;
    },

    /** Whether a spot on the floor is well inside, `margin` metres clear of the wall. */
    insideXZ(x, z, margin) {
      return C.placed && Math.hypot(x - C.x, z - C.z) < C.R - margin;
    },

    /** A spot on the sand inside, clear of the walls and off the doorway. */
    innerSpot(out) {
      const a = C.door + Math.PI + SL.randRange(-1.9, 1.9);
      const r = SL.randRange(0.5, C.R - 2.6);
      return out.set(C.x + Math.cos(a) * r, 0, C.z + Math.sin(a) * r);
    },

    /** A point on the door's line, `along` metres out from the centre. */
    doorPoint(along, out) {
      return out.set(C.x + Math.cos(C.door) * along, 0, C.z + Math.sin(C.door) * along);
    },

    /**
     * The way in from wherever something is, as points to walk: round the
     * outside of the dome to the door if it starts behind it, through the
     * door, and somewhere inside.
     */
    routeIn(from) {
      const pts = [];
      const a = Math.atan2(from.z - C.z, from.x - C.x);
      let gap = a - C.door;
      while (gap > Math.PI) gap -= Math.PI * 2;
      while (gap < -Math.PI) gap += Math.PI * 2;
      const around = C.R + 3;
      // Round the side in steps, so nothing walks into the wall.
      const steps = Math.floor(Math.abs(gap) / 0.7);
      for (let i = 1; i <= steps; i++) {
        const t = a - Math.sign(gap) * i * 0.7;
        pts.push(new THREE.Vector3(C.x + Math.cos(t) * around, 0, C.z + Math.sin(t) * around));
      }
      pts.push(this.doorPoint(C.R + 2.5, new THREE.Vector3()));
      pts.push(this.doorPoint(C.R - 2.5, new THREE.Vector3()));
      pts.push(this.innerSpot(new THREE.Vector3()));
      return pts;
    },

    /** The way back out, and home. */
    routeOut(home) {
      return [
        this.doorPoint(C.R - 2.5, new THREE.Vector3()),
        this.doorPoint(C.R + 3, new THREE.Vector3()),
        new THREE.Vector3(home.x, 0, home.z)
      ];
    },

    /** The diver has hurt a lobster. The Big Lobster will not forget it. */
    wronged(game) {
      if (!C.placed) return;
      if (!this.grudge && game && game.hud && game.player && this.isInside(game.player.position)) {
        game.hud.toast('Something big stirs at the back of the cave');
      }
      this.grudge = true;
    },

    /**
     * The walls, solid both ways, for the diver and for things that walk.
     * Which side you are on is where you were before this frame's move; the
     * doorway is the one gap. Returns the world push, or null.
     */
    collide(position, previous, radius, out) {
      if (!C.placed) return null;
      const dx = position.x - C.x, dy = position.y - C.y, dz = position.z - C.z;
      const reach = C.R + C.wall + radius + 1;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach || dy > C.H + C.wall + radius + 1) return null;
      if (inDoor(dx, dy, dz, radius)) return null;

      const q = shellDistance(dx, dy, dz);
      const was = shellDistance(previous.x - C.x, previous.y - C.y, previous.z - C.z);
      if (was < C.R) {
        const room = C.R - C.wall - radius;
        if (q > room) return pushTo(dx, dy, dz, q, room, out);
      } else {
        const clear = C.R + C.wall + radius;
        if (q < clear) {
          if (q < 1e-3) { out.x = 0; out.y = C.H + clear - dy; out.z = 0; return out; }
          return pushTo(dx, dy, dz, q, clear, out);
        }
      }
      return null;
    },

    /**
     * For everything that swims: the whole dome is solid, doorway and all.
     * The cave belongs to the lobsters.
     */
    keepOut(position, margin, out) {
      if (!C.placed) return null;
      const dx = position.x - C.x, dy = position.y - C.y, dz = position.z - C.z;
      const reach = C.R + margin + 1;
      if (Math.abs(dx) > reach || Math.abs(dz) > reach || dy > C.H + margin + 1) return null;
      const q = shellDistance(dx, dy, dz);
      const clear = C.R + margin;
      if (q >= clear) return null;
      if (q < 1e-3) { out.x = 0; out.y = C.H + clear - dy; out.z = 0; return out; }
      return pushTo(dx, dy, dz, q, clear, out);
    },

    /** The rocks by the door are solid. Called once the rock grid is cleared for a new world. */
    addSolids() {
      if (!C.placed || !SL.Solids) return;
      for (const side of [-1, 1]) {
        const a = C.door + side * (C.doorHalf + 0.08);
        const r = C.R + 0.4;
        SL.Solids.add(C.x + Math.cos(a) * r, C.y + 0.5, C.z + Math.sin(a) * r, 1.0);
      }
    },

    /** The dome itself, the rocks either side of its door, and some shells inside. */
    build(game) {
      if (!C.placed) return;
      const mesh = new MeshData();
      const sand = new THREE.Color(0.74, 0.64, 0.44);
      const dark = new THREE.Color(0.52, 0.43, 0.29);
      const pale = new THREE.Color(0.86, 0.79, 0.62);

      // Rings from the crown down to below the sand, so no gap shows where
      // the dome meets the floor.
      const around = 40;
      const rings = 12;
      const archTheta = Math.acos(C.archTop / C.H);
      const lump = (theta, phi) => SL.fbm(Math.cos(phi) * 2 + 7, Math.sin(phi) * 2 + theta * 2, 3, 1, 2, 0.5, 6121);
      const base = mesh.count;
      for (let i = 0; i <= rings + 1; i++) {
        const theta = Math.min(i / rings, 1) * Math.PI / 2;
        for (let k = 0; k <= around; k++) {
          const phi = (k / around) * Math.PI * 2;
          const n = lump(theta, phi);
          const r = (C.R + n * 0.5) * Math.sin(theta);
          let y = C.H * Math.cos(theta) + n * 0.25;
          if (i > rings) y = -1.2;                 // the skirt, sunk in the sand
          const c = sand.clone().lerp(n > 0 ? pale : dark, Math.min(1, Math.abs(n) * 1.8));
          // Darker low down, where it has been half buried.
          if (theta > 1.2) c.lerp(dark, (theta - 1.2) * 0.9);
          mesh.vertex(Math.cos(phi) * r, y, Math.sin(phi) * r, 0, 1, 0, c);
        }
      }
      for (let i = 0; i <= rings; i++) {
        for (let k = 0; k < around; k++) {
          const phi = ((k + 0.5) / around) * Math.PI * 2;
          const theta = Math.min((i + 0.5) / rings, 1) * Math.PI / 2;
          // The doorway: nothing below the arch.
          if (angleGap(phi, C.door) < C.doorHalf && theta > archTheta) continue;
          const p = base + i * (around + 1) + k;
          const q = p + around + 1;
          mesh.quad(p, p + 1, q + 1, q);
        }
      }

      // A rock either side of the door, and one over it, so the doorway reads
      // as a doorway rather than a hole.
      const rock = new THREE.Color(0.46, 0.40, 0.32);
      for (const side of [-1, 1]) {
        const a = C.door + side * (C.doorHalf + 0.08);
        const r = C.R + 0.4;
        Geo.sphere(mesh, Math.cos(a) * r, 0.5, Math.sin(a) * r, 1.15, 9, rock);
        Geo.sphere(mesh, Math.cos(a) * (r + 0.3), 1.6, Math.sin(a) * (r + 0.3), 0.8, 8, dark);
      }
      {
        const r = C.R * Math.sin(archTheta) + 0.3;
        Geo.sphere(mesh, Math.cos(C.door) * r, C.archTop + 0.45, Math.sin(C.door) * r, 0.9, 8, rock);
      }

      // Shells and bits of old lobster on the floor inside.
      const shell = new THREE.Color(0.86, 0.36, 0.22);
      const bone = new THREE.Color(0.90, 0.86, 0.74);
      for (let i = 0; i < 14; i++) {
        const a = C.door + Math.PI + (i * 2.399) % 3.6 - 1.8;
        const r = 1.2 + ((i * 0.618) % 1) * (C.R - 3);
        Geo.sphere(mesh, Math.cos(a) * r, 0.05, Math.sin(a) * r, 0.12 + (i % 3) * 0.06, 6, i % 2 ? shell : bone);
      }

      mesh.computeNormals();
      const group = new THREE.Group();
      group.add(new THREE.Mesh(mesh.toGeometry(), game.materials.surface));
      // Dim inside, but not black: light through the door and the sand.
      const glow = new THREE.PointLight(0xffd7a0, 0.6, C.R * 2, 1.5);
      glow.position.set(0, C.H * 0.5, 0);
      group.add(glow);
      group.position.set(C.x, C.y, C.z);
      game.addToWorld(group);
      game.lobsterCave = group;
    }
  };

  SL.LobsterCave = Cave;
})(window.SL);
