/**
 * The wreck: a submarine on the sand at the spawn point, and the one place in
 * the sea where nothing comes after you.
 *
 * It lies in a crater of flat sand twelve metres down, a little sunk into it,
 * its hull rusted through in one place - a breach low on one side, down at
 * the sand - which is the only way in or out. You start inside it and you
 * wake up inside it.
 *
 * Nothing that swims can get in. Every creature that steers through the
 * shared avoidEnvironment is kept out of the whole hull, inside and all, so
 * a stalker can circle it but never follow you through the breach. The
 * things that walk the sand are the exception: they are stopped by the walls
 * the same way you are, so the breach is their way in too, and now and then
 * a crab or a starfish pottering about the crater wanders inside - rarely,
 * and back out again.
 *
 * Everything here is worked in the wreck's own frame: `a` along the hull from
 * stern to bow, `s` across it, `y` up from the hull's axis.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;

  const DEG = Math.PI / 180;

  const W = {
    x: 0, z: 0,
    yaw: 0.55,
    length: 22,
    radius: 3.2,
    /** The crater floor, which is also the sand inside the hull. */
    deck: -12,
    /** How far the hull's axis sits above the sand, in radii. */
    lift: 0.45,
    /** The breach: along the hull, and round it from the top towards +s. */
    door: { a: 1.5, half: 1.6, phiMin: 70 * DEG, phiMax: 125 * DEG },
    /** The conning tower, on top. */
    tower: { a: 4.0, half: 2.2, width: 0.8, height: 3.0 },
    /** Sand flattened round it, and the slope back up to the shelf. */
    craterFlat: 22,
    craterEdge: 44
  };
  const R = W.radius;
  const HALF = W.length / 2;
  const CY = W.deck + R * W.lift;
  const AX = Math.cos(W.yaw), AZ = Math.sin(W.yaw);

  const _l = { a: 0, s: 0, y: 0 };
  const _door = new THREE.Vector3();
  const _p = { a: 0, s: 0, y: 0 };

  function toLocal(p, out) {
    const dx = p.x - W.x, dz = p.z - W.z;
    out.a = dx * AX + dz * AZ;
    out.s = -dx * AZ + dz * AX;
    out.y = p.y - CY;
    return out;
  }

  function toWorld(a, y, s, out) {
    out.x = W.x + a * AX - s * AZ;
    out.z = W.z + a * AZ + s * AX;
    out.y = CY + y;
    return out;
  }

  /**
   * The hatch over the breach. Shut, the breach is just more hull; it has to
   * be most of the way open before anything fits through.
   */
  const hatch = { open: false, amount: 0, pivot: null };

  function inBreach(l) {
    if (hatch.amount < 0.8) return false;
    if (Math.abs(l.a - W.door.a) > W.door.half) return false;
    const phi = Math.atan2(l.s, l.y);
    return phi > W.door.phiMin && phi < W.door.phiMax;
  }

  function insideHull(l) {
    return Math.abs(l.a) < HALF && l.y * l.y + l.s * l.s < R * R;
  }

  /** Writes a local-frame correction into a world vector. */
  function shoveFrom(l, nl, out) {
    out.x = (nl.a - l.a) * AX - (nl.s - l.s) * AZ;
    out.z = (nl.a - l.a) * AZ + (nl.s - l.s) * AX;
    out.y = nl.y - l.y;
    return out;
  }

  /** The tower is a box on the hull's back. Pushes `l` out of it, if inside. */
  function outOfTower(l, margin) {
    const T = W.tower;
    const bottom = R * 0.6, top = R + T.height;
    const da = T.half + margin - Math.abs(l.a - T.a);
    const ds = T.width + margin - Math.abs(l.s);
    const dy = top + margin - l.y;
    if (da <= 0 || ds <= 0 || dy <= 0 || l.y < bottom) return false;
    // Out by whichever face is nearest.
    if (dy < da && dy < ds) l.y += dy;
    else if (da < ds) l.a += Math.sign(l.a - T.a || 1) * da;
    else l.s += Math.sign(l.s || 1) * ds;
    return true;
  }

  const Wreck = {
    layout: W,

    get hatchOpen() { return hatch.open; },

    /** The hatch starts shut every time a world is built. */
    resetHatch() { hatch.open = false; hatch.amount = 0; },

    /** Whether the diver is close enough to the hatch to work it, from either side. */
    nearHatch(position) {
      const door = toWorld(W.door.a, W.deck - CY + 1.3, R * 0.85, _door);
      return Math.hypot(position.x - door.x, position.y - door.y, position.z - door.z) < 3.4;
    },

    toggleHatch(game) {
      hatch.open = !hatch.open;
      if (game) {
        game.audio.metalBite(0);
        game.hud.toast(hatch.open ? 'Hatch opened' : 'Hatch closed');
      }
    },

    /** Swings the hatch towards where it has been told to be. */
    update(dt) {
      hatch.amount = SL.clamp(hatch.amount + (hatch.open ? dt : -dt) / 0.7, 0, 1);
      if (hatch.pivot) {
        const t = hatch.amount;
        hatch.pivot.rotation.x = -1.75 * (t * t * (3 - 2 * t));
      }
    },

    // --- The hull's outside, for the things that live on it -------------------

    /** The hull's exposed skin, as ranges of `a` and of angle round it. */
    skin: { aMin: -HALF + 0.6, aMax: HALF - 0.6, phiMax: 112 * DEG },

    /** Whether a spot on the skin is somewhere a crab should go. */
    skinFree(a, phi) {
      const D = W.door, T = W.tower;
      if (Math.abs(a - D.a) < D.half + 0.6 && phi > D.phiMin - 0.2 && phi < D.phiMax + 0.2) return false;
      if (Math.abs(a - T.a) < T.half + 0.5 && Math.abs(phi) < 22 * DEG) return false;
      return true;
    },

    /** A point on the outside of the hull, `lift` metres off the plates. */
    hullPoint(a, phi, lift, out) {
      const r = R + lift;
      return toWorld(a, Math.cos(phi) * r, Math.sin(phi) * r, out);
    },

    /** Straight out of the hull at an angle round it, in the world. */
    hullNormal(phi, out) {
      return out.set(-Math.sin(phi) * AZ, Math.cos(phi), Math.sin(phi) * AX);
    },

    /** The world direction of travel for a step of (da, darc) over the skin. */
    hullTangent(phi, da, darc, out) {
      return out.set(da * AX + darc * (-Math.cos(phi) * AZ), darc * -Math.sin(phi),
        da * AZ + darc * (Math.cos(phi) * AX));
    },

    /** Height of the crater floor blended into the shelf around it. */
    craterFloor(x, z, y) {
      const r = Math.hypot(x - W.x, z - W.z);
      if (r >= W.craterEdge) return y;
      return SL.lerp(W.deck, y, SL.smoothstep((r - W.craterFlat) / (W.craterEdge - W.craterFlat)));
    },

    /** Whether a point is in the crater, which counts as Safe Shallows. */
    inCrater(x, z) {
      return Math.hypot(x - W.x, z - W.z) < W.craterEdge;
    },

    /** Whether the hull covers this patch of sand, with some room to spare. */
    covers(x, z, margin) {
      const l = toLocal({ x, y: CY, z }, _l);
      const m = margin || 0;
      return Math.abs(l.a) < HALF + R + m && Math.abs(l.s) < R + m;
    },

    /** Where the diver wakes: on the sand inside, near the bow, facing the breach. */
    spawnPoint() {
      const at = toWorld(HALF - 3.5, W.deck - CY + 1.4, 0, new THREE.Vector3());
      const door = toWorld(W.door.a, W.deck - CY + 1.4, R * 0.6, new THREE.Vector3());
      const yaw = Math.atan2(-(door.x - at.x), -(door.z - at.z));
      return { position: at, yaw };
    },

    /**
     * Keeps the diver - or anything that walks - out of the hull's walls.
     *
     * Which side of the wall you are on is decided by where you were last
     * frame, so the hull has an inside and an outside rather than just being
     * a solid: inside, you are kept off the inner skin; outside, off the
     * outer. Inside the breach neither applies, which is what lets you
     * through. Returns the world push, or null.
     */
    collide(position, previous, radius, out) {
      const l = toLocal(position, _l);
      // Quick reject: nowhere near.
      if (Math.abs(l.a) > HALF + R + radius + 1 || Math.abs(l.s) > R + radius + 1
        || l.y > R + W.tower.height + radius + 1) return null;

      const before = toLocal(previous, _p);
      const nl = { a: l.a, s: l.s, y: l.y };
      let moved = false;

      if (insideHull(before)) {
        if (inBreach(l)) return null;
        const rr = Math.hypot(nl.y, nl.s);
        const room = R - radius;
        if (rr > room) { nl.y *= room / rr; nl.s *= room / rr; moved = true; }
        const end = HALF - radius;
        if (Math.abs(nl.a) > end) { nl.a = Math.sign(nl.a) * end; moved = true; }
      } else {
        if (inBreach(l) && Math.hypot(l.y, l.s) < R + radius) return null;
        if (Math.abs(nl.a) <= HALF) {
          const rr = Math.hypot(nl.y, nl.s);
          const clear = R + radius;
          if (rr < clear) {
            if (rr < 1e-3) { nl.y = clear; } else { nl.y *= clear / rr; nl.s *= clear / rr; }
            moved = true;
          }
        } else {
          // Bow and stern, as rounded ends.
          const ea = nl.a - Math.sign(nl.a) * HALF;
          const d = Math.hypot(ea, nl.y, nl.s);
          const clear = R + radius;
          if (d < clear && d > 1e-3) {
            const k = clear / d;
            nl.a = Math.sign(nl.a) * HALF + ea * k; nl.y *= k; nl.s *= k;
            moved = true;
          }
        }
        if (outOfTower(nl, radius)) moved = true;
      }

      return moved ? shoveFrom(l, nl, out) : null;
    },

    /**
     * Keeps a swimming creature out of the whole hull - inside included.
     *
     * Applied through avoidEnvironment to everything that swims. There is no
     * inside for them: the breach is not a way in, it is part of a solid they
     * are pushed out of. Returns the world push, or null.
     */
    keepOut(position, margin, out) {
      const l = toLocal(position, _l);
      if (Math.abs(l.a) > HALF + R + margin + 1 || Math.abs(l.s) > R + margin + 1
        || l.y > R + W.tower.height + margin + 1) return null;

      const nl = { a: l.a, s: l.s, y: l.y };
      let moved = false;
      const clear = R + margin;
      if (Math.abs(nl.a) <= HALF) {
        const rr = Math.hypot(nl.y, nl.s);
        if (rr < clear) {
          // From deep inside, straight up and out through the roof.
          if (rr < 1e-3) nl.y = clear; else { nl.y *= clear / rr; nl.s *= clear / rr; }
          moved = true;
        }
      } else {
        const ea = nl.a - Math.sign(nl.a) * HALF;
        const d = Math.hypot(ea, nl.y, nl.s);
        if (d < clear && d > 1e-3) {
          const k = clear / d;
          nl.a = Math.sign(nl.a) * HALF + ea * k; nl.y *= k; nl.s *= k;
          moved = true;
        }
      }
      if (outOfTower(nl, margin)) moved = true;
      return moved ? shoveFrom(l, nl, out) : null;
    },

    /** Whether a point is inside the hull. */
    isInside(position) {
      return insideHull(toLocal(position, _l));
    },

    /**
     * Sometimes, a way in - or the way back out.
     *
     * Called when a walker picks somewhere new to go. Something inside the
     * hull mostly heads for the breach and out, and occasionally potters
     * about inside a while longer. Something outside, living near enough to
     * the wreck, goes in about one time in twenty-five. Returns a list of
     * points to walk in order, or null for "carry on as normal".
     */
    routeFor(walker) {
      const at = walker.position;
      const doorOut = toWorld(W.door.a, 0, R + 1.6, new THREE.Vector3());
      const doorIn = toWorld(W.door.a, 0, R * 0.45, new THREE.Vector3());

      if (this.isInside(at)) {
        if (SL.random() < 0.3) {
          return [toWorld(SL.randRange(-HALF + 2, HALF - 2), 0, SL.randRange(-1.6, 1.6), new THREE.Vector3())];
        }
        return [doorIn, doorOut];
      }

      const home = walker.home || at;
      if (Math.hypot(home.x - W.x, home.z - W.z) > W.craterEdge + 10) return null;
      // A shut hatch is a wall like any other.
      if (!hatch.open) return null;
      if (SL.random() > 0.04) return null;
      return [doorOut, doorIn,
        toWorld(SL.randRange(-HALF + 2, HALF - 2), 0, SL.randRange(-1.6, 1.6), new THREE.Vector3())];
    },

    /** A few walkers that live round the wreck, so something does wander in. */
    populate(game) {
      const spots = (n, make) => {
        for (let i = 0; i < n; i++) {
          for (let tries = 0; tries < 12; tries++) {
            const angle = SL.random() * Math.PI * 2;
            const r = SL.randRange(8, W.craterFlat + 6);
            const x = W.x + Math.cos(angle) * r, z = W.z + Math.sin(angle) * r;
            if (this.covers(x, z, 1)) continue;
            make(x, z);
            break;
          }
        }
      };
      if (SL.Craber && SL.Species.craber) {
        spots(3, (x, z) => game.crabers.push(new SL.Craber(game, x, z, SL.Species.craber)));
        spots(1, (x, z) => game.crabers.push(new SL.Craber(game, x, z, SL.Species.crober)));
      }
      if (SL.Starfish) spots(2, (x, z) => game.crabers.push(new SL.Starfish(game, x, z)));

      // And the ones that live on the hull itself.
      if (SL.ScrapCrab && SL.Species.scrapcrab) {
        for (let i = 0; i < 5; i++) {
          for (let tries = 0; tries < 20; tries++) {
            const a = SL.randRange(this.skin.aMin, this.skin.aMax);
            const phi = SL.randRange(-this.skin.phiMax, this.skin.phiMax);
            if (!this.skinFree(a, phi)) continue;
            game.crabers.push(new SL.ScrapCrab(game, a, phi));
            break;
          }
        }
      }
    },

    // --- The hull itself --------------------------------------------------------

    build(game) {
      const hull = new MeshData();
      const lamps = new MeshData();

      const steel = new THREE.Color(0.30, 0.35, 0.33);
      const rust = new THREE.Color(0.46, 0.26, 0.13);
      const seam = new THREE.Color(0.18, 0.21, 0.20);
      const colourAt = (a, phi) => {
        const n = SL.fbm(a * 0.35, phi * 2.2, 3, 1, 2, 0.5, 4417);
        const c = steel.clone().lerp(rust, SL.clamp(0.35 + n * 0.9, 0, 1));
        // Plate seams every 2.2 m.
        if (Math.abs(((a + 100) % 2.2) - 1.1) > 1.0) c.lerp(seam, 0.6);
        return c;
      };

      // Rings round the hull, nose and stern included, as one lathe.
      const ring = 28;
      const stations = [];
      for (let i = 0; i <= 5; i++) {                    // the stern taper
        const t = i / 5;
        stations.push({ a: -HALF - 3.6 * (1 - t), r: R * SL.lerp(0.32, 1, Math.sqrt(t)) });
      }
      for (let a = -HALF + 1; a < HALF; a += 1) stations.push({ a, r: R });
      for (let i = 0; i <= 6; i++) {                    // the rounded bow
        const t = i / 6;
        stations.push({ a: HALF + R * 0.85 * Math.sin(t * Math.PI / 2), r: Math.max(0.02, R * Math.cos(t * Math.PI / 2)) });
      }

      const base = hull.count;
      for (const st of stations) {
        for (let k = 0; k <= ring; k++) {
          const phi = (k / ring) * Math.PI * 2 - Math.PI;
          hull.vertex(st.a, Math.cos(phi) * st.r, Math.sin(phi) * st.r, 0, 1, 0, colourAt(st.a, phi));
        }
      }
      for (let i = 0; i < stations.length - 1; i++) {
        for (let k = 0; k < ring; k++) {
          const phi = ((k + 0.5) / ring) * Math.PI * 2 - Math.PI;
          const a = (stations[i].a + stations[i + 1].a) / 2;
          // The breach: plates simply missing.
          if (Math.abs(a - W.door.a) < W.door.half && phi > W.door.phiMin - 0.05 && phi < W.door.phiMax + 0.2) continue;
          const p = base + i * (ring + 1) + k;
          const q = p + ring + 1;
          hull.quad(p, q, q + 1, p + 1);
        }
      }

      // The conning tower, a periscope, and the rudder and propeller astern.
      const T = W.tower;
      Geo.box(hull, T.a, R + T.height / 2 - 0.3, 0, T.half, T.height / 2 + 0.3, T.width, steel);
      Geo.box(hull, T.a - 0.8, R + T.height + 0.9, 0, 0.08, 0.9, 0.08, seam);
      Geo.box(hull, -HALF - 2.4, R * 0.7, 0, 1.0, 1.1, 0.08, rust);
      const hubA = -HALF - 3.7;
      // The stern taper ends in a ring; plugged, so it does not read as a
      // second way out - the breach is the only one.
      Geo.sphere(hull, -HALF - 3.55, 0, 0, R * 0.36, 10, seam);
      for (let i = 0; i < 3; i++) {
        const blade = new MeshData();
        Geo.box(blade, 0, 0.75, 0, 0.06, 0.75, 0.32, rust);
        hull.append(blade, new THREE.Matrix4().makeTranslation(hubA, 0, 0)
          .multiply(new THREE.Matrix4().makeRotationX((i / 3) * Math.PI * 2 + 0.4)));
      }

      // Inside: a control console at the bow end with its screen still lit,
      // a bunk along one wall, and a couple of crates that came loose.
      const deckY = W.deck - CY;
      Geo.box(hull, HALF - 1.2, deckY + 0.6, 0, 0.5, 0.6, 1.1, seam);
      Geo.box(lamps, HALF - 1.72, deckY + 1.0, 0, 0.02, 0.3, 0.7, new THREE.Color(0.35, 0.95, 0.75));
      Geo.box(hull, -4, deckY + 0.55, -R * 0.62, 2.0, 0.12, 0.45, rust);
      Geo.box(hull, -7.5, deckY + 0.35, 0.9, 0.4, 0.35, 0.4, new THREE.Color(0.40, 0.33, 0.22));
      Geo.box(hull, -6.8, deckY + 0.3, 1.5, 0.3, 0.3, 0.3, new THREE.Color(0.36, 0.30, 0.20));

      // Portholes, still lit, along both sides.
      const warm = new THREE.Color(1.0, 0.84, 0.5);
      for (const a of [-8, -5, -2, 5, 8]) {
        for (const side of [1, -1]) {
          if (side > 0 && Math.abs(a - W.door.a) < W.door.half + 0.6) continue;
          const phi = side * 58 * DEG;
          Geo.sphere(lamps, a, Math.cos(phi) * (R + 0.02), Math.sin(phi) * (R + 0.02), 0.26, 8, warm);
        }
      }

      hull.computeNormals();
      lamps.computeNormals();

      const group = new THREE.Group();
      group.add(new THREE.Mesh(hull.toGeometry(), game.materials.surface));
      group.add(new THREE.Mesh(lamps.toGeometry(), game.materials.glow));

      // --- The hatch --------------------------------------------------------
      //
      // A curved plate a little bigger than the breach, hinged along its top
      // edge - a line running along the hull - so it lifts up and outward
      // like an awning when it opens. Built round the hinge, so opening it
      // is a single rotation about the hull's long axis.
      const D = W.door;
      const hingePhi = D.phiMin - 0.06;
      const hy = Math.cos(hingePhi) * (R + 0.05), hs = Math.sin(hingePhi) * (R + 0.05);
      const plate = new MeshData();
      const yellow = new THREE.Color(0.78, 0.58, 0.16);
      const rim = new THREE.Color(0.44, 0.30, 0.10);
      const cols = 6, rows = 6;
      const pb = plate.count;
      for (let i = 0; i <= rows; i++) {
        const phi = SL.lerp(hingePhi, D.phiMax + 0.2, i / rows);
        for (let k = 0; k <= cols; k++) {
          const a = SL.lerp(D.a - D.half - 0.15, D.a + D.half + 0.15, k / cols);
          const edge = i === 0 || i === rows || k === 0 || k === cols;
          plate.vertex(a, Math.cos(phi) * (R + 0.05) - hy, Math.sin(phi) * (R + 0.05) - hs,
            0, 1, 0, edge ? rim : yellow);
        }
      }
      for (let i = 0; i < rows; i++) {
        for (let k = 0; k < cols; k++) {
          const p = pb + i * (cols + 1) + k, q = p + cols + 1;
          plate.quad(p, q, q + 1, p + 1);
        }
      }
      // A wheel to turn, on both faces, and the hinge pins along the top.
      const midPhi = (D.phiMin + D.phiMax) / 2;
      for (const off of [0.18, -0.12]) {
        const r = R + 0.05 + off;
        Geo.box(plate, D.a, Math.cos(midPhi) * r - hy, Math.sin(midPhi) * r - hs, 0.32, 0.05, 0.05, rim);
        Geo.box(plate, D.a, Math.cos(midPhi) * r - hy, Math.sin(midPhi) * r - hs, 0.05, 0.32, 0.05, rim);
      }
      for (const a of [D.a - D.half + 0.3, D.a + D.half - 0.3]) Geo.box(plate, a, 0, 0, 0.2, 0.09, 0.09, rim);
      plate.computeNormals();

      hatch.pivot = new THREE.Group();
      hatch.pivot.position.set(0, hy, hs);
      hatch.pivot.add(new THREE.Mesh(plate.toGeometry(), game.materials.surface));
      group.add(hatch.pivot);
      this.resetHatch();
      this.update(0);

      // A light inside, warm and not very bright: someone left it on.
      const light = new THREE.PointLight(0xffd9a0, 1.2, 15, 1.6);
      light.position.set(0, R * 0.4, 0);
      group.add(light);

      group.position.set(W.x, CY, W.z);
      group.rotation.y = -W.yaw;
      game.addToWorld(group);
      game.wreck = group;
    }
  };

  SL.Wreck = Wreck;
})(window.SL);
