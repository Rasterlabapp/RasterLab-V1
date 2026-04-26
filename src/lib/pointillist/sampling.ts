/**
 * sampling.ts
 *
 * Generates dot positions using an adaptive variant of Bridson's Fast Poisson
 * Disk Sampling (Robert Bridson, 2007).
 *
 * ── Adaptive minimum distance (luminance + edge) ──────────────────────────────
 * Every candidate point q gets a local Poisson radius r(q) derived from both
 * image luminance and Sobel edge strength at that position:
 *
 *   r_lum(x,y) = r_dark + (r_light − r_dark) × lum(x,y)^γ
 *   r(x,y)     = r_lum × (1 − edgeW × edge(x,y) × 0.70)
 *
 * Dark regions   → r close to r_dark  (tight packing, many dots)
 * Light regions  → r close to r_light (loose packing, few dots)
 * Edge regions   → r compressed further by the edge factor
 *                  → increased local dot count, reduced spacing
 *                  → preserves contours of faces, eyes, hair, objects
 *
 * The separation check uses the symmetric polydisperse condition:
 *
 *   dist(q, s)  ≥  (r(q) + r(s)) / 2
 *
 * ── Two-pass strategy ─────────────────────────────────────────────────────────
 * Pass 0 — Structural: radius driven by luminance + edge compression.
 * Pass 1 — Edge detail: radius driven purely by edge gradient magnitude;
 *           stronger edges → smaller radius → denser fine dots along contours.
 *           Both passes use the same adaptiveBridson algorithm.
 *
 * ── Draw radius ───────────────────────────────────────────────────────────────
 * Separate from the Poisson spacing radius.  Dark pixels → r ≈ dotSize;
 * light pixels → r ≈ 0.20 × dotSize.  Spacing AND size both respond to
 * image luminance, doubling the tonal impression.
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

// ─── Public entry point ───────────────────────────────────────────────────────

export function generateDots(
  sw:       number,
  sh:       number,
  maps:     AnalysisMaps,
  settings: PointillistSettings,
): Dot[] {
  const { lum, edges, aw, ah } = maps;
  const densityT = settings.density         / 100;
  const edgeW    = settings.edgeSensitivity / 100;
  const jitterT  = settings.randomness      / 100;
  const dotSize  = settings.dotSize;

  // Deterministic seed → same image + settings = same output
  const seed = ((sw * 73856093) ^ (sh * 19349663) ^ (dotSize * 7919) ^
                (settings.density * 1009) ^ (settings.randomness * 503)) | 0;
  const rng = makeLCG(seed);

  const imgToA = aw / sw;   // analysis pixels per image pixel
  const aToImg = sw / aw;   // image pixels per analysis pixel

  // ── Lookup helpers ─────────────────────────────────────────────────────────
  const lumAt = (ax: number, ay: number) =>
    lum[Math.max(0, Math.min(ah - 1, Math.round(ay))) * aw +
        Math.max(0, Math.min(aw - 1, Math.round(ax)))];

  const edgeAt = (ax: number, ay: number) =>
    edges[Math.max(0, Math.min(ah - 1, Math.round(ay))) * aw +
          Math.max(0, Math.min(aw - 1, Math.round(ax)))];

  // ── Base radii from density setting ────────────────────────────────────────
  const dotSizeA = Math.max(0.5, dotSize * imgToA);
  //  r_dark  = tightest spacing (used in the darkest pixels)
  //  r_light = loosest spacing  (used in the lightest pixels, always 4× r_dark)
  const r_dark  = Math.max(1.0, dotSizeA * (0.70 + (1 - densityT) * 1.20));
  const r_light = r_dark * 4.0;
  // Minimum floor: prevents degenerate 0-radius near pure-white + strong edge
  const r_floor = Math.max(0.6, r_dark * 0.22);
  // Luminance curve exponent — γ < 1 keeps mid-tones feeling relatively dense
  const GAMMA = 0.65;
  // Edge compression strength — how much a fully-detected edge tightens spacing
  const EDGE_COMPRESS = 0.70;

  // ── Pass 0 radius: luminance baseline + Sobel edge compression ─────────────
  //
  //   r₀(x,y) = [r_dark + (r_light − r_dark) × lum^γ]
  //             × (1 − edgeW × edgeMag × EDGE_COMPRESS)
  //
  // Where edges are strong:  factor → (1 − edgeW × 0.70)  →  spacing shrinks
  //                           → more dots per unit area, contours are preserved
  // Where edges are absent:  factor → 1.0  →  pure luminance-driven spacing
  //
  const getRadius0 = (ax: number, ay: number): number => {
    const l   = lumAt(ax, ay);
    const e   = edgeAt(ax, ay);
    const r   = r_dark + (r_light - r_dark) * Math.pow(l, GAMMA);
    const cmp = 1 - edgeW * e * EDGE_COMPRESS;
    return Math.max(r_floor, r * cmp);
  };

  // ── Pass 0: Structural dots ─────────────────────────────────────────────────
  //
  // r_light is the true max radius (light areas with no edge).
  // The floor may push globalMinR lower than r_dark, so we use r_floor.
  //
  const pass0Max = Math.round(MAX_DOTS * 0.70);
  const raw0     = adaptiveBridson(aw, ah, getRadius0, r_floor, r_light, rng, pass0Max);
  const dots: Dot[] = [];

  for (const { x: ax, y: ay } of raw0) {
    if (dots.length >= pass0Max) break;
    const l    = lumAt(ax, ay);
    const dark = 1 - l;

    // Draw radius: dark → dotSize, light → 0.20 × dotSize
    const drawR = dotSize * Math.max(0.20, Math.pow(dark, 0.50));

    // Extra jitter on top of Poisson's inherent organic spread
    const jAmt = r_dark * jitterT * 0.35 * aToImg;
    const jx   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
    const jy   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

    dots.push({ x: ax * aToImg + jx, y: ay * aToImg + jy, r: drawR, ax, ay, pass: 0 });
  }

  // ── Pass 1 radius: pure Sobel gradient magnitude → contour fidelity ─────────
  //
  // The radius for each edge-detail candidate is derived solely from the local
  // edge strength, giving a direct mapping from gradient magnitude to dot density:
  //
  //   r₁(x,y) = r1_loose − (r1_loose − r1_tight) × (edgeMag × edgeW)^0.55
  //
  //   weak edge   (e×edgeW ≈ 0.2)  →  r₁ close to r1_loose  (sparse detail)
  //   medium edge (e×edgeW ≈ 0.5)  →  r₁ in the middle
  //   strong edge (e×edgeW ≈ 1.0)  →  r₁ close to r1_tight  (dense, crisp)
  //
  // This produces graduated edge fidelity: faces/eyes/hair get the finest dots;
  // subtle texture gets moderate detail; non-edge areas get none.
  //
  if (edgeW > 0.05) {
    const r1_tight = Math.max(r_floor, r_dark * 0.25);  // finest detail
    const r1_loose = Math.max(r_floor, r_dark * 0.55);  // coarsest detail dot

    const getRadius1 = (ax: number, ay: number): number => {
      const e    = Math.min(1, edgeAt(ax, ay) * edgeW * 1.3); // slight amplification
      const t    = Math.pow(e, 0.55);
      return r1_loose - (r1_loose - r1_tight) * t;
    };

    const pass1Max = Math.round(MAX_DOTS * 0.32);
    const raw1     = adaptiveBridson(aw, ah, getRadius1, r1_tight, r1_loose, rng, pass1Max);

    for (const { x: ax, y: ay } of raw1) {
      if (dots.length >= MAX_DOTS) break;

      const e    = edgeAt(ax, ay) * edgeW;
      if (e < 0.12) continue;               // skip genuinely flat areas

      const l    = lumAt(ax, ay);
      const dark = 1 - l;
      if (dark < 0.04) continue;            // skip near-white (invisible anyway)

      // Probabilistic acceptance — stronger edges place more dots
      if (rng() > Math.pow(e, 0.6) * 1.35) continue;

      // Edge dots are small and sharp — proportional to darkness + edge strength
      const drawR = dotSize * Math.max(0.10, Math.pow(dark, 0.55) * Math.min(1, e * 0.9) * 0.50);

      // Tiny jitter to avoid mechanical alignment on the edge line
      const jAmt = r1_tight * jitterT * 0.12 * aToImg;
      const jx   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
      const jy   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

      dots.push({ x: ax * aToImg + jx, y: ay * aToImg + jy, r: drawR, ax, ay, pass: 1 });
    }
  }

  return dots;
}
