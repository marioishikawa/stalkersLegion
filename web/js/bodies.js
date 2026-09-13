/**
 * Grows a creature body from a species definition.
 *
 * Bodies are built nose-forward along +Z (so Object3D.lookAt points them where
 * they swim) and split into three pieces so they can animate without a
 * skeleton: a static body, a tail that wags around its pivot, and - for
 * predators - a hinged lower jaw.
 */
(function (SL) {
  'use strict';

  const { MeshData, Geo } = SL;

  /** Smooth bump peaking at `peak`, falling to zero at both ends. */
  function bump(t, peak, sharpness) {
    const span = t < peak ? Math.max(peak, 1e-4) : Math.max(1 - peak, 1e-4);
    const d = SL.clamp(Math.abs(t - peak) / span, 0, 1);
    return Math.pow(1 - d, sharpness);
  }

  /**
   * The silhouette function: how wide and tall the body is at position t along
   * the spine (0 = nose, 1 = tail root). This is what separates an eel from a
   * boxfish before a single colour is applied.
   */
  function profileAt(profile, t, bellyPosition) {
    t = SL.clamp(t, 0, 1);
    const peak = SL.clamp(bellyPosition, 0.05, 0.95);
    let w, h;

    switch (profile) {
      case 'torpedo':
        // Even spindle: fat amidships, tapering smoothly to both ends.
        w = bump(t, peak, 0.65); h = bump(t, peak, 0.6);
        break;

      case 'disc':
        // Tall coin. Height stays near maximum across most of the body.
        w = bump(t, peak, 0.9);
        h = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.75)), 0.45);
        break;

      case 'ribbon':
        // Long flat band that barely narrows until the very tail.
        w = bump(t, 0.3, 1.2) * 0.8 + 0.2 * (1 - t);
        h = SL.clamp(1 - Math.pow(t, 3), 0.15, 1) * (0.4 + 0.6 * Math.sin(Math.PI * Math.min(t * 3, 1)));
        break;

      case 'boxy':
        // Blunt brick: near-constant section, abrupt taper at the tail root.
        w = t < 0.7 ? Math.sin(Math.PI * Math.min(t / 0.7, 1) * 0.5 + 0.35) : SL.lerp(0.93, 0.12, (t - 0.7) / 0.3);
        h = w * 1.05;
        break;

      case 'eel':
        // Near-cylindrical over the full length with a rounded snout.
        w = Math.sin(Math.PI * Math.min(t * 4, 1) * 0.5) * SL.lerp(1, 0.25, Math.pow(t, 2.2));
        h = w * 1.15;
        break;

      case 'diamond':
        // Angular: straight ramp up to sharp shoulders, straight ramp down.
        w = t < peak ? t / peak : 1 - (t - peak) / (1 - peak);
        h = Math.pow(Math.max(w, 0), 0.7);
        w = Math.pow(Math.max(w, 0), 0.9);
        break;

      case 'arrow':
        // Needle nose flaring hard into broad shoulders, then a slow taper.
        w = t <= peak ? Math.pow(t / peak, 1.8) : Math.pow(1 - (t - peak) / (1 - peak), 0.55);
        h = w * 0.95;
        break;

      case 'bulb':
      default:
        // Fat round head with a thin whip of a tail.
        w = t < peak ? Math.sin(Math.PI * 0.5 * t / peak) : Math.pow(1 - (t - peak) / (1 - peak), 1.6);
        h = w;
        break;
    }

    return { w: SL.clamp(w, 0.02, 1), h: SL.clamp(h, 0.02, 1) };
  }

  /** Builds the three geometries and the pivots that animate them. */
  function build(species) {
    const S = species.shape;
    const body = new MeshData();
    const tailMesh = new MeshData();
    const jawMesh = new MeshData();

    const rings = SL.clamp(S.spineSegments, 5, 40);
    const length = Math.max(0.04, S.length);
    const maxHalfHeight = length * Math.max(0.01, S.height);
    const maxHalfWidth = length * Math.max(0.01, S.width);

    const spine = [];
    const halfWidths = [];
    const halfHeights = [];
    const ringColors = [];
    const dark = species.backColor.clone().multiplyScalar(0.25);

    for (let ring = 0; ring < rings; ring++) {
      const t = ring / (rings - 1);
      const { w, h } = profileAt(species.profile, t, S.bellyPosition);

      // Sharpen the snout by pulling in the first fifth of the body.
      const noseT = Math.min(t / 0.2, 1);
      const nose = Math.pow(noseT, 0.35 + S.noseSharpness * 0.9);

      spine.push(new THREE.Vector3(0, 0, t * length));
      halfWidths.push(maxHalfWidth * w * nose);
      halfHeights.push(maxHalfHeight * h * nose);

      // Stripes darken bands of rings.
      const stripe = S.stripes > 0 ? Math.pow(Math.abs(Math.sin(t * Math.PI * S.stripes)), 6) : 0;
      ringColors.push(species.backColor.clone().lerp(dark, stripe));
    }

    Geo.loft(body, spine, halfWidths, halfHeights, ringColors,
      SL.clamp(S.radialSegments, 5, 24), S.crossSection, species.bellyColor, 0.85);

    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const ringAt = (t) => SL.clamp(Math.round(t * (rings - 1)), 0, rings - 1);

    // --- Dorsal fin: a swept triangle riding the back -------------------------
    if (S.dorsalFin > 0.001) {
      const f = ringAt(0.34), b = ringAt(0.72);
      const front = V(0, halfHeights[f] * 0.9, spine[f].z);
      const back = V(0, halfHeights[b] * 0.9, spine[b].z);
      const peak = V(0, Math.max(front.y, back.y) + length * S.dorsalFin, (front.z + back.z) * 0.5);
      Geo.fin(body, front, back, peak, species.finColor);
    }

    // --- Ventral fin -----------------------------------------------------------
    if (S.ventralFin > 0.001) {
      const f = ringAt(0.45), b = ringAt(0.75);
      const front = V(0, -halfHeights[f] * 0.9, spine[f].z);
      const back = V(0, -halfHeights[b] * 0.9, spine[b].z);
      const peak = V(0, Math.min(front.y, back.y) - length * S.ventralFin, (front.z + back.z) * 0.5);
      Geo.fin(body, back, front, peak, species.finColor);
    }

    // --- Pectoral fins: one per side, angled back -------------------------------
    if (S.sideFin > 0.001) {
      const r = ringAt(0.32);
      const finLen = length * S.sideFin;
      for (const side of [1, -1]) {
        const root = V(side * halfWidths[r] * 0.85, 0, spine[r].z);
        const tip = V(side * (halfWidths[r] + finLen), -finLen * 0.35, root.z - finLen * 0.7);
        const back = V(side * halfWidths[r] * 0.85, 0, root.z + finLen * 0.45);
        Geo.fin(body, root, back, tip, species.finColor);
      }
    }

    // --- Back spikes -----------------------------------------------------------
    for (let i = 0; i < S.backSpikes; i++) {
      const t = SL.lerp(0.25, 0.8, S.backSpikes > 1 ? i / (S.backSpikes - 1) : 0.5);
      const r = ringAt(t);
      const len = length * 0.09;
      const y = halfHeights[r] * 0.95;
      Geo.fin(body,
        V(0, y, spine[r].z - len * 0.4),
        V(0, y, spine[r].z + len * 0.4),
        V(0, y + len, spine[r].z - len * 0.3),
        species.finColor.clone().multiplyScalar(0.7));
    }

    // --- Eyes -------------------------------------------------------------------
    if (S.eyeSize > 0.001) {
      const r = SL.clamp(ringAt(0.14), 1, rings - 1);
      const eyeRadius = length * S.eyeSize;
      for (const side of [1, -1]) {
        Geo.sphere(body, side * halfWidths[r] * 0.75, halfHeights[r] * 0.45, spine[r].z,
          eyeRadius, 7, species.eyeColor);
      }
    }

    // --- Tail fin: its own mesh so it can wag -----------------------------------
    const tailSpan = length * Math.max(0.02, S.tailSweep);
    const tailHalf = length * Math.max(0.02, S.tailHeight);
    const tailPivot = new THREE.Vector3(0, 0, length * 0.97);
    {
      // Built around its own origin; the Object3D sits at tailPivot.
      const root = V(0, 0, 0);
      const top = V(0, tailHalf, -tailSpan);
      const bottom = V(0, -tailHalf, -tailSpan);
      const notch = V(0, 0, -tailSpan * (1 - SL.clamp(S.tailFork, 0, 0.95)));
      Geo.fin(tailMesh, root, notch, top, species.finColor);
      Geo.fin(tailMesh, notch, root, bottom, species.finColor);
    }

    // --- Hinged lower jaw for predators ------------------------------------------
    let jawPivot = null;
    if (S.jawLength > 0.001) {
      const jawLen = length * S.jawLength;
      const r = SL.clamp(ringAt(0.2), 1, rings - 1);
      jawPivot = new THREE.Vector3(0, -halfHeights[r] * 0.35, spine[r].z);

      const halfW = halfWidths[r] * 0.85;
      const jawColor = species.backColor.clone().multiplyScalar(0.6);

      // A wedge running forward from the hinge.
      Geo.quadPoly(jawMesh,
        V(-halfW, 0, 0), V(halfW, 0, 0),
        V(halfW * 0.35, -jawLen * 0.12, jawLen), V(-halfW * 0.35, -jawLen * 0.12, jawLen),
        jawColor, true);

      // Teeth along both edges.
      const toothColor = new THREE.Color(0.92, 0.90, 0.82);
      const teeth = 6;
      for (let i = 0; i < teeth; i++) {
        const t = i / (teeth - 1);
        const z = SL.lerp(jawLen * 0.9, jawLen * 0.1, t);
        const w = SL.lerp(halfW * 0.4, halfW * 0.9, t);
        const len = jawLen * 0.22 * SL.lerp(1, 0.6, t);
        for (const side of [1, -1]) {
          Geo.fin(jawMesh,
            V(side * w, 0, z - len * 0.3),
            V(side * w, 0, z + len * 0.3),
            V(side * w * 0.9, len, z),
            toothColor);
        }
      }
    }

    body.computeNormals();
    tailMesh.computeNormals();
    if (!jawMesh.isEmpty) jawMesh.computeNormals();

    // The loft grows nose-at-origin toward +Z, but Object3D.lookAt() points an
    // object's +Z at its target - so a body used as built swims tail-first.
    // Turn it end for end and recentre, which puts the nose at +Z (forward) and
    // the tail root at -Z, with the object pivoting mid-body.
    //
    // The tail and jaw are separate objects positioned at the pivots below, and
    // both are authored along this corrected axis already: the tail fin sweeps
    // back toward -Z and the jaw runs forward toward +Z.
    const recentre = new THREE.Matrix4().makeRotationY(Math.PI);
    recentre.premultiply(new THREE.Matrix4().makeTranslation(0, 0, length * 0.5));

    const centred = new MeshData();
    centred.append(body, recentre);
    tailPivot.applyMatrix4(recentre);
    if (jawPivot) jawPivot.applyMatrix4(recentre);

    return {
      body: centred.toGeometry(),
      tail: tailMesh.toGeometry(),
      jaw: jawMesh.isEmpty ? null : jawMesh.toGeometry(),
      tailPivot,
      jawPivot,
      length,
      radius: Math.max(maxHalfWidth, maxHalfHeight)
    };
  }

  // A school of ten shares one shape, so build each species once.
  const cache = {};
  SL.buildBody = function (species) {
    if (!cache[species.id]) {
      const built = build(species);
      // Shared across every individual of the species and across worlds, so
      // world teardown must not dispose these.
      for (const geometry of [built.body, built.tail, built.jaw]) {
        if (geometry) geometry.userData.shared = true;
      }
      cache[species.id] = built;
    }
    return cache[species.id];
  };
  SL.profileAt = profileAt;
})(window.SL);
