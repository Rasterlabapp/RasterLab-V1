/**
 * sampling.ts
 *
 * Generates dot positions using an adaptive variant of Bridson's Fast Poisson
 * Disk Sampling (Robert Bridson, 2007).
 *
 * ── Key improvement: adaptive minimum distance ────────────────────────────────
 * Each candidate point q is assigned a local Poisson radius r(q) derived from
 * the image luminance at that position:
 *
 *   dark  (lum ≈ 0)  →  r_min   (tight packing, many dots)
 *   light (lum ≈ 1)  →  r_max   (loose packing, few dots)
 *
 * The separation check between an existing point s and a candidate q uses the
 * symmetric variable-radius condition:
 *
 *   dist(q, s)  ≥  (r(q) + r(s)) / 2
 *
 * This is the correct formulation for a polydisperse Poisson disk process —
 * it avoids both the under-packing of always using min(r_q, r_s) and the
 * over-packing of using max(r_q, r_s).
 *
 * ── Two-pass strategy ─────────────────────────────────────────────────────────
 * Pass 0 — Structural: adaptive radius → tonal density variation.
 * Pass 1 — Edge detail: tighter fixed radius in edge zones → fine contours.
 *
 * ── Draw radius ───────────────────────────────────────────────────────────────
 * Separate from the Poisson spacing radius.  Dark pixels → r close to dotSize;
 * light pixels → r as small as 0.20 × dotSize.  This doubles the tonal
 * impression: spacing AND size both respond to image luminance.
 */

import type { PointillistSettings } from './types';
import type { AnalysisMaps } from './edgeDetection';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Dot {
  x:    number;   // full-resolution x (image pixels)
  y:    number;   // full-resolution y
  r:    number;   // draw radius (image pixels)
  ax:   number;   // analysis-space x (for SAT colour lookup)
  ay:   number;   // analysis-space y
  pass: 0 | 1;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SQRT2  = Math.sqrt(2);
const TWO_PI = Math.PI * 2;
/** Hard cap — protects the worker from extreme settings (tiny dotSize + max density). */
const MAX_DOTS = 90_000;

// ─── Deterministic LCG ───────────────────────────────────────────────────────

function makeLCG(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ─── Adaptive Poisson disk sampling ──────────────────────────────────────────
/**
 * Bridson's algorithm with per-point variable minimum distance.
 *
 * `getRadius(x, y)` — returns the local Poisson radius at that position.
 *   The grid cell size is keyed to `globalMinR` (smallest possible radius),
 *   which guarantees correctness regardless of how large `getRadius` can get.
 *
 * `globalMaxR` — largest value `getRadius` will ever return.
 *   Used to pre-compute the grid neighbourhood search radius so we never
 *   miss a conflicting point.
 */
function adaptiveBridson(
  w:          number,
  h:          number,
  getRadius:  (x: number, y: number) => number,
  globalMinR: number,
  globalMaxR: number,
  rng:        () => number,
  maxPts:     number,
): Array<{ x: number; y: number; localR: number }> {
  const k        = 22;                    // candidate attempts per active point
  const cellSize = globalMinR / SQRT2;    // ≤ 1 point per cell guaranteed
  const cols     = Math.ceil(w / cellSize) + 1;
  const rows     = Math.ceil(h / cellSize) + 1;

  // Each cell stores the index of the point occupying it (-1 = empty)
  const grid  = new Int32Array(cols * rows).fill(-1);
  const pts:  Array<{ x: number; y: number; localR: number }> = [];
  const localRs = new Float32Array(MAX_DOTS + 10); // pre-allocated radius store
  const active: number[] = [];

  // Grid neighbourhood to search: must cover the maximum possible check
  // distance (r_q + r_s)/2 ≤ (globalMaxR + globalMaxR)/2 = globalMaxR
  const checkCells = Math.ceil(globalMaxR / cellSize) + 1;

  const addPt = (x: number, y: number, lr: number) => {
    const idx    = pts.length;
    localRs[idx] = lr;
    pts.push({ x, y, localR: lr });
    active.push(idx);
    const ci = Math.floor(x / cellSize);
    const cj = Math.floor(y / cellSize);
    if (ci >= 0 && ci < cols && cj >= 0 && cj < rows) {
      grid[cj * cols + ci] = idx;
    }
  };

  // Seed
  const sx = rng() * w, sy = rng() * h;
  addPt(sx, sy, getRadius(sx, sy));

  while (active.length > 0 && pts.length < maxPts) {
    const ai = Math.floor(rng() * active.length);
    const p  = pts[active[ai]];
    let found = false;

    for (let attempt = 0; attempt < k; attempt++) {
      // Candidate in annulus [r_p, 2·r_p] around the active point
      const angle = rng() * TWO_PI;
      const dist  = p.localR * (1 + rng());
      const cx    = p.x + Math.cos(angle) * dist;
      const cy    = p.y + Math.sin(angle) * dist;

      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

      const r_q = getRadius(cx, cy);
      const ci  = Math.floor(cx / cellSize);
      const cj  = Math.floor(cy / cellSize);
      let valid = true;

      // ── Neighbourhood check with symmetric variable-radius condition ───────
      // Minimum allowed distance between q and any existing s:
      //   (r_q + r_s) / 2
      // We must search cells within checkCells to guarantee we find all
      // conflicting points even when r_s >> cellSize.
      outer:
      for (let dj = -checkCells; dj <= checkCells; dj++) {
        const nj = cj + dj;
        if (nj < 0 || nj >= rows) continue;
        for (let di = -checkCells; di <= checkCells; di++) {
          const ni = ci + di;
          if (ni < 0 || ni >= cols) continue;
          const sid = grid[nj * cols + ni];
          if (sid < 0) continue;
          const s    = pts[sid];
          const minD = (r_q + localRs[sid]) * 0.5;  // symmetric check
          const dx   = cx - s.x, dy = cy - s.y;
          if (dx * dx + dy * dy < minD * minD) { valid = false; break outer; }
        }
      }

      if (valid) {
        addPt(cx, cy, r_q);
        found = true;
        break;
      }
    }

    if (!found) {
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }

  return pts;
}

// ─── Fixed-radius Bridson (used for edge-detail pass) ────────────────────────

function fixedBridson(
  w:      number,
  h:      number,
  minR:   number,
  rng:    () => number,
  maxPts: number,
): Array<{ x: number; y: number }> {
  const k        = 20;
  const cellSize = minR / SQRT2;
  const cols     = Math.ceil(w / cellSize) + 1;
  const rows     = Math.ceil(h / cellSize) + 1;
  const grid     = new Int32Array(cols * rows).fill(-1);
  const pts: Array<{ x: number; y: number }> = [];
  const active: number[] = [];
  const chk = Math.ceil(minR / cellSize) + 1; // ≈ 3 for fixed radius

  const addPt = (x: number, y: number) => {
    const idx = pts.length;
    pts.push({ x, y });
    active.push(idx);
    const ci = Math.floor(x / cellSize), cj = Math.floor(y / cellSize);
    if (ci >= 0 && ci < cols && cj >= 0 && cj < rows) grid[cj * cols + ci] = idx;
  };

  addPt(rng() * w, rng() * h);

  while (active.length > 0 && pts.length < maxPts) {
    const ai = Math.floor(rng() * active.length);
    const p  = pts[active[ai]];
    let found = false;

    for (let attempt = 0; attempt < k; attempt++) {
      const angle = rng() * TWO_PI;
      const dist  = minR * (1 + rng());
      const cx = p.x + Math.cos(angle) * dist;
      const cy = p.y + Math.sin(angle) * dist;
      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;

      const ci = Math.floor(cx / cellSize), cj = Math.floor(cy / cellSize);
      let valid = true;
      outer:
      for (let dj = -chk; dj <= chk; dj++) {
        const nj = cj + dj;
        if (nj < 0 || nj >= rows) continue;
        for (let di = -chk; di <= chk; di++) {
          const ni = ci + di;
          if (ni < 0 || ni >= cols) continue;
          const sid = grid[nj * cols + ni];
          if (sid < 0) continue;
          const s = pts[sid];
          const dx = cx - s.x, dy = cy - s.y;
          if (dx * dx + dy * dy < minR * minR) { valid = false; break outer; }
        }
      }
      if (valid) { addPt(cx, cy); found = true; break; }
    }

    if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
  }

  return pts;
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function generateDots(
  sw:       number,
  sh:       number,
  maps:     AnalysisMaps,
  settings: PointillistSettings,
): Dot[] {
  const { lum, edges, aw, ah } = maps;
  const densityT = settings.density        / 100;
  const edgeW    = settings.edgeSensitivity / 100;
  const jitterT  = settings.randomness     / 100;
  const dotSize  = settings.dotSize;

  // Deterministic seed → same image + settings = same output
  const seed = ((sw * 73856093) ^ (sh * 19349663) ^ (dotSize * 7919) ^
                (settings.density * 1009) ^ (settings.randomness * 503)) | 0;
  const rng  = makeLCG(seed);

  const imgToA = aw / sw;  // analysis pixels per image pixel
  const aToImg = sw / aw;  // image pixels per analysis pixel

  // ── Luminance helpers ──────────────────────────────────────────────────────
  const lumAt = (ax: number, ay: number) =>
    lum[Math.max(0, Math.min(ah - 1, Math.round(ay))) * aw +
        Math.max(0, Math.min(aw - 1, Math.round(ax)))];

  const edgeAt = (ax: number, ay: number) =>
    edges[Math.max(0, Math.min(ah - 1, Math.round(ay))) * aw +
          Math.max(0, Math.min(aw - 1, Math.round(ax)))];

  // ── Adaptive radius function ───────────────────────────────────────────────
  //
  // The Poisson spacing radius r(x,y) maps luminance to dot spacing:
  //
  //   lum = 0 (black) → r_dark  (tight, many dots)
  //   lum = 1 (white) → r_light (loose, few dots)
  //
  // r_dark is derived from dotSize and density; r_light is a fixed multiple
  // of r_dark (4×) so light areas always end up visibly sparser.
  //
  // Power γ < 1 compresses the dark end of the curve, meaning mid-tones
  // already feel relatively dense — matching the perceptual expectation
  // that medium-grey should have a moderate number of dots.
  //
  const dotSizeA = Math.max(0.5, dotSize * imgToA);
  // Base spacing for the darkest pixels: density slider controls this.
  const r_dark   = Math.max(1.0, dotSizeA * (0.70 + (1 - densityT) * 1.20));
  // Spacing for the lightest pixels: always at least 4× the dark spacing.
  const r_light  = r_dark * 4.0;
  // Luminance-to-radius curve exponent (< 1 = more dots in mid-tones)
  const GAMMA    = 0.65;

  const getRadius = (ax: number, ay: number): number => {
    const l = lumAt(ax, ay);
    // Power curve: 0 → r_dark, 1 → r_light
    return r_dark + (r_light - r_dark) * Math.pow(l, GAMMA);
  };

  // ── Pass 0: Structural (adaptive) ─────────────────────────────────────────
  const pass0Max = Math.round(MAX_DOTS * 0.72);
  const raw0     = adaptiveBridson(aw, ah, getRadius, r_dark, r_light, rng, pass0Max);
  const dots: Dot[] = [];

  for (const { x: ax, y: ay } of raw0) {
    if (dots.length >= pass0Max) break;
    const l    = lumAt(ax, ay);
    const dark = 1 - l;

    // Draw radius: dark → full dotSize, light → 0.20 × dotSize.
    // γ=0.5 gives a natural mid-tone feel without tiny unreadable dots.
    const drawR = dotSize * Math.max(0.20, Math.pow(dark, 0.50));

    // Optional extra jitter (Poisson is inherently organic; this adds more)
    const jAmt = r_dark * jitterT * 0.35 * aToImg;
    const jx   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
    const jy   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

    dots.push({ x: ax * aToImg + jx, y: ay * aToImg + jy, r: drawR, ax, ay, pass: 0 });
  }

  // ── Pass 1: Edge detail (fixed radius, edge zones only) ───────────────────
  if (edgeW > 0.05) {
    // Tighter grid at ~42% of the dark spacing → fills in fine contour detail
    const r_edge   = Math.max(0.7, r_dark * 0.42);
    const pass1Max = Math.round(MAX_DOTS * 0.30);
    const raw1     = fixedBridson(aw, ah, r_edge, rng, pass1Max);

    for (const { x: ax, y: ay } of raw1) {
      if (dots.length >= MAX_DOTS) break;
      const e    = edgeAt(ax, ay) * edgeW;
      if (e < 0.18) continue;
      const l    = lumAt(ax, ay);
      const dark = 1 - l;
      if (dark < 0.05) continue;
      if (rng() > e * 1.4) continue;

      const drawR = dotSize * Math.max(0.12, Math.pow(dark, 0.60) * 0.42);
      const jAmt  = r_edge * jitterT * 0.15 * aToImg;
      const jx    = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
      const jy    = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

      dots.push({ x: ax * aToImg + jx, y: ay * aToImg + jy, r: drawR, ax, ay, pass: 1 });
    }
  }

  return dots;
}
