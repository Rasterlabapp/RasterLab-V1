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
  const { lum, edges, saliency, aw, ah } = maps;
  const densityT = settings.density         / 100;
  const edgeW    = settings.edgeSensitivity / 100;
  const jitterT  = settings.randomness      / 100;
  const dotSize  = settings.dotSize;

  // Deterministic seed → same image + settings = same output
  const seed = ((sw * 73856093) ^ (sh * 19349663) ^ (dotSize * 7919) ^
                (settings.density * 1009) ^ (settings.randomness * 503)) | 0;
  const rng = makeLCG(seed);

  const imgToA = aw / sw;
  const aToImg = sw / aw;

  // ── Inline lookup helpers (avoids repeated Math.round + clamp) ────────────
  const idx = (ax: number, ay: number) =>
    Math.max(0, Math.min(ah - 1, Math.round(ay))) * aw +
    Math.max(0, Math.min(aw - 1, Math.round(ax)));

  const lumAt  = (ax: number, ay: number) => lum[idx(ax, ay)];
  const edgeAt = (ax: number, ay: number) => edges[idx(ax, ay)];
  const salAt  = (ax: number, ay: number) => saliency[idx(ax, ay)];

  // ── Base radii ─────────────────────────────────────────────────────────────
  const dotSizeA = Math.max(0.5, dotSize * imgToA);
  const r_dark   = Math.max(1.0, dotSizeA * (0.70 + (1 - densityT) * 1.20));
  const r_light  = r_dark * 4.0;
  // Hard floor: even the most salient pixel can't go below this
  const r_floor  = Math.max(0.5, r_dark * 0.18);

  const GAMMA         = 0.65;  // luminance-to-radius curve exponent
  const EDGE_COMPRESS = 0.68;  // how much a full Sobel edge compresses spacing
  const SAL_COMPRESS  = 0.58;  // how much full saliency compresses spacing
                                // (on top of EDGE_COMPRESS — additive in log space)

  // ── Pass 0 radius: luminance + Sobel + portrait saliency ──────────────────
  //
  //   r₀(x,y) = r_lum(lum)
  //             × (1 − edgeW × edge × EDGE_COMPRESS)   ← Sobel compression
  //             × (1 − sal × SAL_COMPRESS)              ← saliency compression
  //
  // The two compression factors stack multiplicatively, so a pixel on a strong
  // Sobel edge inside a high-saliency zone (e.g. the iris rim) can shrink to
  // as little as r_floor — guaranteeing very dense dot coverage there.
  //
  // At low density (r_dark large), saliency still forces tight packing around
  // eyes/mouth/jawline so the face remains recognisable even with few dots.
  //
  const getRadius0 = (ax: number, ay: number): number => {
    const l   = lumAt(ax, ay);
    const e   = edgeAt(ax, ay);
    const sal = salAt(ax, ay);
    const r   = r_dark + (r_light - r_dark) * Math.pow(l, GAMMA);
    return Math.max(r_floor,
      r * (1 - edgeW * e * EDGE_COMPRESS) * (1 - sal * SAL_COMPRESS));
  };

  // ── Pass 0: Structural dots ────────────────────────────────────────────────
  const pass0Max = Math.round(MAX_DOTS * 0.68);
  const raw0     = adaptiveBridson(aw, ah, getRadius0, r_floor, r_light, rng, pass0Max);
  const dots: Dot[] = [];

  for (const { x: ax, y: ay } of raw0) {
    if (dots.length >= pass0Max) break;
    const l    = lumAt(ax, ay);
    const dark = 1 - l;
    const sal  = salAt(ax, ay);

    const drawR = dotSize * Math.max(0.20, Math.pow(dark, 0.50));

    // Jitter is scaled down in high-saliency zones so structural dots stay
    // precisely on facial contours rather than drifting away from them.
    const jScale = 1 - sal * 0.80;
    const jAmt   = r_dark * jitterT * 0.35 * jScale * aToImg;
    const jx     = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
    const jy     = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

    dots.push({ x: ax * aToImg + jx, y: ay * aToImg + jy, r: drawR, ax, ay, pass: 0 });
  }

  // ── Pass 1: Edge + saliency detail dots ───────────────────────────────────
  //
  // The "feature strength" at each point is the union of Sobel edge response
  // and portrait saliency — whichever is higher wins.  This means:
  //
  //   jaw / hairline → high Sobel, moderate saliency → feature ≈ high Sobel
  //   eye interior   → moderate Sobel, high saliency → feature ≈ high saliency
  //   nose bridge    → low Sobel (shading not edge), high local contrast /
  //                    saliency → feature still fires
  //   flat cheek     → low Sobel, low saliency → skipped
  //
  // Radius:  r₁(x,y) = r1_loose − (r1_loose − r1_tight) × featureStr^0.50
  // Stronger feature → smaller radius → denser, crisper dots.
  //
  // Acceptance:  kept when rng() < featureStr^0.50 × 1.40
  // Jitter:      near-zero in high-saliency zones (dots trace the contour).
  //
  if (edgeW > 0.05) {
    const r1_tight = Math.max(r_floor, r_dark * 0.22);
    const r1_loose = Math.max(r_floor, r_dark * 0.52);

    const getRadius1 = (ax: number, ay: number): number => {
      const e   = edgeAt(ax, ay) * edgeW;
      const sal = salAt(ax, ay);
      // Saliency uses a slightly lower weight so Sobel still leads on sharp edges
      const fStr = Math.min(1, Math.max(e * 1.20, sal * 0.90));
      return r1_loose - (r1_loose - r1_tight) * Math.pow(fStr, 0.50);
    };

    const pass1Max = Math.round(MAX_DOTS * 0.34);
    const raw1     = adaptiveBridson(aw, ah, getRadius1, r1_tight, r1_loose, rng, pass1Max);

    for (const { x: ax, y: ay } of raw1) {
      if (dots.length >= MAX_DOTS) break;

      const e    = edgeAt(ax, ay) * edgeW;
      const sal  = salAt(ax, ay);
      // Feature strength: max of Sobel and saliency signals
      const fStr = Math.min(1, Math.max(e * 1.20, sal * 0.90));

      if (fStr < 0.11) continue;      // genuinely flat, non-facial area

      const l    = lumAt(ax, ay);
      const dark = 1 - l;
      if (dark < 0.04) continue;      // near-white → invisible

      // Acceptance probability — higher feature strength = more accepted
      if (rng() > Math.pow(fStr, 0.50) * 1.40) continue;

      // Draw radius: scaled by both darkness and feature strength so faint
      // outlines on pale skin remain readable
      const drawR = dotSize *
        Math.max(0.10, Math.pow(dark, 0.55) * Math.min(1, fStr * 0.95) * 0.52);

      // Jitter: very small in high-saliency zones (dots trace the contour);
      // slightly more elsewhere so edge dots don't look mechanical
      const jScale = 1 - sal * 0.90;
      const jAmt   = r1_tight * jitterT * 0.10 * jScale * aToImg;
      const jx     = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
      const jy     = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

      dots.push({ x: ax * aToImg + jx, y: ay * aToImg + jy, r: drawR, ax, ay, pass: 1 });
    }
  }

  return dots;
}
