/**
 * CPU-side mesh assembly. Everything visible in the game - terrain, fish, kelp,
 * scrap, the knife - is built by appending primitives into one of these and
 * handing the result to Three.js as a BufferGeometry with vertex colours.
 *
 * Port of FSLMeshData / SLProcMesh from the Unreal build.
 */
(function (SL) {
  'use strict';

  const _v = new THREE.Vector3();
  const _n = new THREE.Vector3();

  class MeshData {
    constructor() {
      this.pos = [];
      this.norm = [];
      this.col = [];
      this.idx = [];
    }

    get count() { return this.pos.length / 3; }
    get isEmpty() { return this.idx.length === 0; }

    vertex(x, y, z, nx, ny, nz, color) {
      this.pos.push(x, y, z);
      this.norm.push(nx, ny, nz);
      this.col.push(color.r, color.g, color.b);
      return this.count - 1;
    }

    tri(a, b, c) { this.idx.push(a, b, c); }

    quad(a, b, c, d) { this.idx.push(a, b, c, a, c, d); }

    /** Appends another mesh transformed by a Matrix4. */
    append(other, matrix) {
      const base = this.count;
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

      for (let i = 0; i < other.count; i++) {
        _v.set(other.pos[i * 3], other.pos[i * 3 + 1], other.pos[i * 3 + 2]).applyMatrix4(matrix);
        _n.set(other.norm[i * 3], other.norm[i * 3 + 1], other.norm[i * 3 + 2])
          .applyMatrix3(normalMatrix).normalize();

        this.pos.push(_v.x, _v.y, _v.z);
        this.norm.push(_n.x, _n.y, _n.z);
        this.col.push(other.col[i * 3], other.col[i * 3 + 1], other.col[i * 3 + 2]);
      }

      for (let i = 0; i < other.idx.length; i++) this.idx.push(base + other.idx[i]);
    }

    /** Area-weighted smooth normals. Call once the mesh is complete. */
    computeNormals() {
      const n = new Float32Array(this.pos.length);
      const ax = new THREE.Vector3(), bx = new THREE.Vector3(), cx = new THREE.Vector3();
      const e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), face = new THREE.Vector3();

      for (let i = 0; i < this.idx.length; i += 3) {
        const i0 = this.idx[i] * 3, i1 = this.idx[i + 1] * 3, i2 = this.idx[i + 2] * 3;
        ax.set(this.pos[i0], this.pos[i0 + 1], this.pos[i0 + 2]);
        bx.set(this.pos[i1], this.pos[i1 + 1], this.pos[i1 + 2]);
        cx.set(this.pos[i2], this.pos[i2 + 1], this.pos[i2 + 2]);

        // Unnormalised cross product weights each face by its area.
        face.copy(e1.subVectors(bx, ax)).cross(e2.subVectors(cx, ax));

        n[i0] += face.x; n[i0 + 1] += face.y; n[i0 + 2] += face.z;
        n[i1] += face.x; n[i1 + 1] += face.y; n[i1 + 2] += face.z;
        n[i2] += face.x; n[i2 + 1] += face.y; n[i2 + 2] += face.z;
      }

      for (let i = 0; i < n.length; i += 3) {
        const len = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
        this.norm[i] = n[i] / len;
        this.norm[i + 1] = n[i + 1] / len;
        this.norm[i + 2] = n[i + 2] / len;
      }
    }

    toGeometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.norm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      g.setIndex(this.idx);
      g.computeBoundingSphere();
      return g;
    }
  }

  // --- Primitives -------------------------------------------------------------

  const Geo = {
    /** Axis-aligned box. */
    box(mesh, cx, cy, cz, ex, ey, ez, color) {
      const faces = [
        [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]
      ];

      for (const [nx, ny, nz] of faces) {
        // Build an orthonormal basis for the face and emit one quad.
        const ref = Math.abs(ny) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        const ux = ny * ref[2] - nz * ref[1];
        const uy = nz * ref[0] - nx * ref[2];
        const uz = nx * ref[1] - ny * ref[0];
        const vx = ny * uz - nz * uy;
        const vy = nz * ux - nx * uz;
        const vz = nx * uy - ny * ux;

        const fx = cx + nx * ex, fy = cy + ny * ey, fz = cz + nz * ez;
        const sux = ux * ex, suy = uy * ey, suz = uz * ez;
        const svx = vx * ex, svy = vy * ey, svz = vz * ez;

        const a = mesh.vertex(fx - sux - svx, fy - suy - svy, fz - suz - svz, nx, ny, nz, color);
        const b = mesh.vertex(fx + sux - svx, fy + suy - svy, fz + suz - svz, nx, ny, nz, color);
        const c = mesh.vertex(fx + sux + svx, fy + suy + svy, fz + suz + svz, nx, ny, nz, color);
        const d = mesh.vertex(fx - sux + svx, fy - suy + svy, fz - suz + svz, nx, ny, nz, color);
        mesh.quad(a, b, c, d);
      }
    },

    /** UV sphere. */
    sphere(mesh, cx, cy, cz, radius, segments, color) {
      const rings = Math.max(3, segments >> 1);
      const base = mesh.count;

      for (let ring = 0; ring <= rings; ring++) {
        const phi = Math.PI * ring / rings;
        const sp = Math.sin(phi), cp = Math.cos(phi);
        for (let seg = 0; seg <= segments; seg++) {
          const theta = 2 * Math.PI * seg / segments;
          const nx = sp * Math.cos(theta), ny = cp, nz = sp * Math.sin(theta);
          mesh.vertex(cx + nx * radius, cy + ny * radius, cz + nz * radius, nx, ny, nz, color);
        }
      }

      const stride = segments + 1;
      for (let ring = 0; ring < rings; ring++) {
        for (let seg = 0; seg < segments; seg++) {
          const a = base + ring * stride + seg;
          mesh.quad(a, a + 1, a + stride + 1, a + stride);
        }
      }
    },

    /** Cone pointing up +Y, base at (cx,cy,cz). */
    cone(mesh, cx, cy, cz, radius, height, sides, baseColor, tipColor) {
      for (let i = 0; i < sides; i++) {
        const t0 = 2 * Math.PI * i / sides, t1 = 2 * Math.PI * (i + 1) / sides;
        const x0 = cx + Math.cos(t0) * radius, z0 = cz + Math.sin(t0) * radius;
        const x1 = cx + Math.cos(t1) * radius, z1 = cz + Math.sin(t1) * radius;

        const a = mesh.vertex(x0, cy, z0, Math.cos(t0), 0.35, Math.sin(t0), baseColor);
        const b = mesh.vertex(x1, cy, z1, Math.cos(t1), 0.35, Math.sin(t1), baseColor);
        const c = mesh.vertex(cx, cy + height, cz, 0, 1, 0, tipColor);
        mesh.tri(a, b, c);
      }
    },

    /** Paper-thin triangle, wound both ways so it is visible from either side. */
    fin(mesh, a, b, c, color) {
      const e1 = new THREE.Vector3().subVectors(b, a);
      const e2 = new THREE.Vector3().subVectors(c, a);
      const n = new THREE.Vector3().crossVectors(e1, e2).normalize();

      const i0 = mesh.vertex(a.x, a.y, a.z, n.x, n.y, n.z, color);
      const i1 = mesh.vertex(b.x, b.y, b.z, n.x, n.y, n.z, color);
      const i2 = mesh.vertex(c.x, c.y, c.z, n.x, n.y, n.z, color);
      mesh.tri(i0, i1, i2);

      const j0 = mesh.vertex(a.x, a.y, a.z, -n.x, -n.y, -n.z, color);
      const j1 = mesh.vertex(c.x, c.y, c.z, -n.x, -n.y, -n.z, color);
      const j2 = mesh.vertex(b.x, b.y, b.z, -n.x, -n.y, -n.z, color);
      mesh.tri(j0, j1, j2);
    },

    /** Flat quad, optionally two-sided. */
    quadPoly(mesh, a, b, c, d, color, twoSided) {
      const n = new THREE.Vector3().crossVectors(
        new THREE.Vector3().subVectors(b, a),
        new THREE.Vector3().subVectors(c, a)).normalize();

      const i0 = mesh.vertex(a.x, a.y, a.z, n.x, n.y, n.z, color);
      const i1 = mesh.vertex(b.x, b.y, b.z, n.x, n.y, n.z, color);
      const i2 = mesh.vertex(c.x, c.y, c.z, n.x, n.y, n.z, color);
      const i3 = mesh.vertex(d.x, d.y, d.z, n.x, n.y, n.z, color);
      mesh.quad(i0, i1, i2, i3);

      if (twoSided) {
        const j0 = mesh.vertex(a.x, a.y, a.z, -n.x, -n.y, -n.z, color);
        const j1 = mesh.vertex(d.x, d.y, d.z, -n.x, -n.y, -n.z, color);
        const j2 = mesh.vertex(c.x, c.y, c.z, -n.x, -n.y, -n.z, color);
        const j3 = mesh.vertex(b.x, b.y, b.z, -n.x, -n.y, -n.z, color);
        mesh.quad(j0, j1, j2, j3);
      }
    },

    /**
     * Lofts a closed tube along a spine. Each ring gets its own frame built from
     * the local spine tangent, so this works whether the spine runs along a fish
     * (+Z) or up a kelp stalk (+Y).
     *
     * `power` controls the cross-section: 2 is an ellipse, 4+ squares it off,
     * which is what makes a boxfish boxy.
     */
    loft(mesh, spine, halfWidths, halfHeights, ringColors, radialSegments, power, bellyColor, bellyBlend) {
      const ringCount = spine.length;
      if (ringCount < 2) return;

      const base = mesh.count;
      const invPower = 2 / Math.max(0.5, power);
      const tangent = new THREE.Vector3();
      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      const ref = new THREE.Vector3();
      const offset = new THREE.Vector3();
      const tmp = new THREE.Color();

      const tangentAt = (ring) => {
        const prev = spine[Math.max(0, ring - 1)];
        const next = spine[Math.min(ringCount - 1, ring + 1)];
        return tangent.subVectors(next, prev).normalize();
      };

      for (let ring = 0; ring < ringCount; ring++) {
        const color = ringColors[ring];
        tangentAt(ring);

        // A reference axis that is never parallel to the tangent.
        ref.set(0, 1, 0);
        if (Math.abs(tangent.y) > 0.95) ref.set(0, 0, 1);
        right.crossVectors(ref, tangent).normalize();
        up.crossVectors(tangent, right).normalize();

        for (let seg = 0; seg <= radialSegments; seg++) {
          const theta = 2 * Math.PI * seg / radialSegments;
          const ct = Math.cos(theta), st = Math.sin(theta);
          const sx = Math.sign(ct) * Math.pow(Math.abs(ct), invPower);
          const sy = Math.sign(st) * Math.pow(Math.abs(st), invPower);

          offset.copy(right).multiplyScalar(sx * halfWidths[ring])
            .addScaledVector(up, sy * halfHeights[ring]);

          // Countershading: a light belly fading up into the darker back.
          const bellyMask = Math.max(0, -sy) * bellyBlend;
          tmp.copy(color).lerp(bellyColor, bellyMask);

          const len = offset.length() || 1;
          mesh.vertex(
            spine[ring].x + offset.x, spine[ring].y + offset.y, spine[ring].z + offset.z,
            offset.x / len, offset.y / len, offset.z / len, tmp);
        }
      }

      const stride = radialSegments + 1;
      for (let ring = 0; ring + 1 < ringCount; ring++) {
        for (let seg = 0; seg < radialSegments; seg++) {
          const a = base + ring * stride + seg;
          mesh.quad(a, a + 1, a + stride + 1, a + stride);
        }
      }

      // Caps.
      const startT = tangentAt(0).clone();
      const nose = mesh.vertex(spine[0].x, spine[0].y, spine[0].z, -startT.x, -startT.y, -startT.z, ringColors[0]);
      for (let seg = 0; seg < radialSegments; seg++) mesh.tri(nose, base + seg + 1, base + seg);

      const lastBase = base + (ringCount - 1) * stride;
      const endT = tangentAt(ringCount - 1).clone();
      const last = spine[ringCount - 1];
      const tail = mesh.vertex(last.x, last.y, last.z, endT.x, endT.y, endT.z, ringColors[ringCount - 1]);
      for (let seg = 0; seg < radialSegments; seg++) mesh.tri(tail, lastBase + seg, lastBase + seg + 1);
    }
  };

  SL.MeshData = MeshData;
  SL.Geo = Geo;
})(window.SL);
