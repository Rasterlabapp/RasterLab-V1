/**
 * sampling.ts
 *
 * Generates dot positions using Bridson's Fast Poisson Disk Sampling
 * (Robert Bridson, 2007) in analysis-resolution space, then maps them
 * to full image-resolution coordinates.
 *
 * Two-pass strategy:
 *   Pass 0 — Structural: larger Poisson radius → fewer, bigger dots that
 *             form the tonal skeleton of the image.
 *   Pass 1 — Edge detail: tighter Poisson radius, restricted to edge zones →
 *             small, dense dots that sharpen contours and fine texture.
 *
 * Density adaptation:
 *   Each candidate point is kept/skipped based on local luminance (dark areas
 *   keep more dots) and a tunable density setting.  The dot draw-radius is also
 *   set per-point — dark → large, light → small.
 *
 * Randomness:
 *   After Poisson placement (which already has organic jitter built in),
 *   an optional extra position jitter is applied proportional to the spacing,
 *   controlled by settings.randomness.
 */

import type { PointillistSettings } from './types';
import type { AnalysisMaps } from './edgeDetection';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Dot {
  x:    number;   // full-resolution x (image pixels)
  y:    number;   // full-resolution y
  r:    number;   // draw radius (image pixels)
  ax:   number;   // analysis-space x (for SAT color lookup)
  ay:   number;   // analysis-space y
  pass: 0 | 1;    // which rendering pass
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SQRT2    = Math.sqrt(2);
const TWO_PI   = Math.PI * 2;
const MAX_DOTS = 90_000; // hard cap to protect against very small dotSize/high density

// ─── Deterministic LCG RNG ────────────────────────────────────────────────────

function makeLCG(seed: number): () => number {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ─── Bridson's Fast Poisson Disk Sampling ─────────────────────────────────────
/**
 * Returns up to `maxPts` evenly distributed candidate points in [0,w) × [0,h).
 *
 * `minR`    – minimum distance between any two points
 * `rng`     – seeded random source (deterministic)
 * `keepFn`  – optional per-candidate filter (return false = skip)
 */
function bridson(
  w:       number,
  h:       number,
  minR:    number,
  rng:     () => number,
  maxPts:  number,
  keepFn?: (x: number, y: number) => boolean,
): Array<{ x: number; y: number }> {
  const k        = 22;                 // max attempts per active point
  const cellSize = minR / SQRT2;       // guarantees ≤ 1 point per cell
  const cols     = Math.ceil(w / cellSize) + 1;
  const rows     = Math.ceil(h / cellSize) + 1;
  const grid     = new Int32Array(cols * rows).fill(-1);
  const pts: Array<{ x: number; y: number }> = [];
  const active: number[] = [];

  // Cells to check: radius = ceil(minR / cellSize) + 1 = ceil(√2) + 1 = 3
  // Fixed because we use a fixed minR here.
  const chk = Math.ceil(minR / cellSize) + 1;

  const addPt = (x: number, y: number) => {
    const idx = pts.length;
    pts.push({ x, y });
    active.push(idx);
    grid[Math.floor(y / cellSize) * cols + Math.floor(x / cellSize)] = idx;
  };

  // Seed with a random starting point
  addPt(rng() * w, rng() * h);

  while (active.length > 0 && pts.length < maxPts) {
    // Pick a random active point
    const ai = Math.floor(rng() * active.length);
    const p  = pts[active[ai]];
    let   found = false;

    for (let attempt = 0; attempt < k; attempt++) {
      // Uniform random point in the annulus [minR, 2·minR]
      const angle = rng() * TWO_PI;
      const dist  = minR * (1 + rng());
      const cx    = p.x + Math.cos(angle) * dist;
      const cy    = p.y + Math.sin(angle) * dist;

      if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
      if (keepFn && !keepFn(cx, cy)) continue;

      // Check surrounding grid cells for conflicts
      const ci = Math.floor(cx / cellSize);
      const cj = Math.floor(cy / cellSize);
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
          const s  = pts[sid];
          const dx = cx - s.x, dy = cy - s.y;
          if (dx * dx + dy * dy < minR * minR) { valid = false; break outer; }
        }
      }

      if (valid) {
        addPt(cx, cy);
        found = true;
        break;
      }
    }

    if (!found) {
      // Exhausted attempts — remove from active list (swap-and-pop)
      active[ai] = active[active.length - 1];
      active.pop();
    }
  }

  return pts;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Generates the full set of dots for both rendering passes.
 * All computation is in analysis space; positions are mapped back to
 * full image resolution before returning.
 */
export function generateDots(
  sw:       number,
  sh:       number,
  maps:     AnalysisMaps,
  settings: PointillistSettings,
): Dot[] {
  const { lum, edges, aw, ah } = maps;
  const densityT = settings.density       / 100;
  const edgeW    = settings.edgeSensitivity / 100;
  const jitterT  = settings.randomness    / 100;
  const dotSize  = settings.dotSize;

  // Seed RNG deterministically so same image + settings → same output
  const seed = ((sw * 73856093) ^ (sh * 19349663) ^ (dotSize * 7919) ^
                (settings.density * 1009) ^ (settings.randomness * 503)) | 0;
  const rng  = makeLCG(seed);

  // How many analysis pixels per image pixel
  const imgToA = aw / sw;   // < 1 when analysis is downscaled
  const aToImg = sw / aw;   // > 1 — multiply to go analysis → image

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const lumAt = (ax: number, ay: number): number => {
    const xi = Math.max(0, Math.min(aw - 1, Math.round(ax)));
    const yi = Math.max(0, Math.min(ah - 1, Math.round(ay)));
    return lum[yi * aw + xi];
  };
  const edgeAt = (ax: number, ay: number): number => {
    const xi = Math.max(0, Math.min(aw - 1, Math.round(ax)));
    const yi = Math.max(0, Math.min(ah - 1, Math.round(ay)));
    return edges[yi * aw + xi];
  };

  // ── Pass 0 — Structural ──────────────────────────────────────────────────────
  //
  // Poisson radius (in analysis pixels) drives the overall dot density.
  // Higher density setting → smaller radius → more dots.
  // dotSize is converted to analysis space so the physical density
  // feels the same regardless of image resolution.
  //
  const dotSizeA    = dotSize * imgToA;
  // spacing range: from 0.6× dotSizeA (dense) to 2.5× dotSizeA (sparse)
  const minR0       = Math.max(1.0, dotSizeA * (2.5 - densityT * 1.9));
  const pass0MaxPts = Math.round(MAX_DOTS * 0.72);

  const raw0 = bridson(aw, ah, minR0, rng, pass0MaxPts);
  const dots: Dot[] = [];

  // Luminance threshold above which we skip dots (light areas get fewer)
  // Denser settings push the cutoff higher so more of the image is covered.
  const lumCutoff = 0.25 + densityT * 0.65;  // [0.25 to 0.90]

  for (const { x: ax, y: ay } of raw0) {
    if (dots.length >= pass0MaxPts) break;

    const l     = lumAt(ax, ay);
    const dark  = 1 - l;

    // Stochastic skip for light areas: probability rises as l → 1
    if (l > lumCutoff) {
      const skipP = (l - lumCutoff) / (1 - lumCutoff + 1e-6);
      if (rng() < skipP * skipP) continue;  // quadratic falloff
    }

    // Draw radius: dark pixels get larger dots (S-curve feel)
    const drawR = dotSize * Math.max(0.20, Math.pow(dark, 0.50));

    // Optional extra jitter on top of Poisson's inherent randomness
    const jAmt = minR0 * jitterT * 0.40 * aToImg;
    const jx   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
    const jy   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

    dots.push({
      x:    ax * aToImg + jx,
      y:    ay * aToImg + jy,
      r:    drawR,
      ax, ay,
      pass: 0,
    });
  }

  // ── Pass 1 — Edge Detail ─────────────────────────────────────────────────────
  //
  // A second Poisson pass with ~45% of the structural radius, restricted to
  // cells with significant edge strength.  These small, dense dots sharpen
  // contours and add fine micro-texture along edges.
  //
  if (edgeW > 0.05) {
    const minR1       = Math.max(0.7, minR0 * 0.42);
    const pass1MaxPts = Math.round(MAX_DOTS * 0.30);

    const raw1 = bridson(aw, ah, minR1, rng, pass1MaxPts);

    for (const { x: ax, y: ay } of raw1) {
      if (dots.length >= MAX_DOTS) break;

      const e     = edgeAt(ax, ay);
      const eStr  = e * edgeW;
      if (eStr < 0.18) continue; // below edge threshold — skip

      const l    = lumAt(ax, ay);
      const dark = 1 - l;
      if (dark < 0.04) continue; // near-white → invisible anyway

      // Probability proportional to edge strength (stronger = more dots)
      if (rng() > eStr * 1.5) continue;

      // Smaller draw radius — these are detail/refinement dots
      const drawR = dotSize * Math.max(0.12, Math.pow(dark, 0.60) * 0.42);

      // Very small jitter for edge accuracy
      const jAmt = minR1 * jitterT * 0.15 * aToImg;
      const jx   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;
      const jy   = jAmt > 0 ? (rng() - 0.5) * 2 * jAmt : 0;

      dots.push({
        x:    ax * aToImg + jx,
        y:    ay * aToImg + jy,
        r:    drawR,
        ax, ay,
        pass: 1,
      });
    }
  }

  return dots;
}
