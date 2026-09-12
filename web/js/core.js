/**
 * Stalkers Legion - shared namespace, math helpers and the noise field.
 *
 * This is a direct port of Source/StalkersLegion/.../SLProcMesh.cpp, with one
 * change: the Unreal build works in centimetres with Z up, and this one works
 * in metres with Y up (Three.js convention). Every distance here is metres.
 */
window.SL = window.SL || {};

(function (SL) {
  'use strict';

  SL.WATER_LEVEL = 0;      // y of the sea surface
  SL.WORLD_RADIUS = 120;   // metres from the origin to the edge of the map

  // --- Math -----------------------------------------------------------------

  SL.clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  SL.lerp = (a, b, t) => a + (b - a) * t;
  SL.smoothstep = (t) => { t = SL.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /** Frame-rate independent approach to a target. */
  SL.damp = (current, target, speed, dt) => SL.lerp(current, target, 1 - Math.exp(-speed * dt));

  SL.randRange = (a, b) => a + Math.random() * (b - a);
  SL.randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  SL.pick = (array) => array[Math.floor(Math.random() * array.length)];

  // --- Noise ----------------------------------------------------------------

  /** Stable pseudo-random float in [0,1) from two integers and a seed. */
  SL.hash = function (a, b, seed) {
    let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(seed | 0, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 8) / 16777216;
  };

  /** Smooth value noise in [-1,1]. */
  SL.valueNoise = function (x, y, seed) {
    const fx = Math.floor(x), fy = Math.floor(y);
    const tx = x - fx, ty = y - fy;
    const u = tx * tx * (3 - 2 * tx);
    const v = ty * ty * (3 - 2 * ty);

    const c00 = SL.hash(fx, fy, seed);
    const c10 = SL.hash(fx + 1, fy, seed);
    const c01 = SL.hash(fx, fy + 1, seed);
    const c11 = SL.hash(fx + 1, fy + 1, seed);

    const bottom = c00 + (c10 - c00) * u;
    const top = c01 + (c11 - c01) * u;
    return (bottom + (top - bottom) * v) * 2 - 1;
  };

  /** Fractal brownian motion, roughly [-1,1]. */
  SL.fbm = function (x, y, octaves, frequency, lacunarity, gain, seed) {
    let sum = 0, amplitude = 1, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += SL.valueNoise(x * frequency, y * frequency, seed + i * 7919) * amplitude;
      norm += amplitude;
      frequency *= lacunarity;
      amplitude *= gain;
    }
    return norm > 0 ? sum / norm : 0;
  };
})(window.SL);
