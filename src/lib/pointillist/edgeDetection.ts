/**
 * edgeDetection.ts
 *
 * Builds all analysis maps needed by the sampling and renderer:
 *   - Perceptual luminance map  (BT.709)
 *   - Multi-scale Sobel edge map (fine/contour/silhouette blended)
 *   - R/G/B Summed-Area Tables  (O(1) color queries)
 *
 * Everything runs in analysis-resolution space (≤ ANALYSIS_MAX px on
 * the longest side) so the heavy math stays fast even for 3 K images.
 */

import type { PointillistSettings } from './types';

// ─── Constants ─────────────────────────────────────────────────────────────────

export const ANALYSIS_MAX = 800;

const LUMA_R = 0.2126;
const LUMA_G = 0.7152;
const LUMA_B = 0.0722;

// ─── Public types ─────────────────────────────────────────────────────────────

export interface AnalysisMaps {
  /** [0,1] perceptual luminance at analysis resolution */
  lum: Float32Array;
  /** [0,1] blended multi-scale edge strength at analysis resolution */
  edges: Float32Array;
  /** Summed-area tables for R, G, B channels (values 0–255) */
  rSAT: Float64Array;
  gSAT: Float64Array;
  bSAT: Float64Array;
  aw: number;
  ah: number;
  /** image pixels per analysis pixel (≥ 1) */
  scaleX: number;
  scaleY: number;
}

// ─── Brightness / contrast ────────────────────────────────────────────────────

function applyBC(v: number, brightness: number, contrast: number): number {
  const b = brightness * 2.55;
  const c = contrast > 0
    ? (259 * (contrast + 255)) / (255 * (259 - contrast))
    : 1 + contrast / 100;
  return Math.max(0, Math.min(255, c * (v + b - 128) + 128));
}

// ─── Separable box blur — RGBA Uint8ClampedArray (in-place) ──────────────────

function blurRGBA(data: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(data.length);
  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0;
    for (let dx = 0; dx <= r; dx++) {
      const pi = (y * w + Math.min(w - 1, dx)) * 4;
      sr += data[pi]; sg += data[pi + 1]; sb += data[pi + 2];
    }
    for (let x = 0; x < w; x++) {
      const cnt = Math.min(x + r, w - 1) - Math.max(0, x - r) + 1;
      const oi = (y * w + x) * 4;
      tmp[oi] = sr / cnt; tmp[oi + 1] = sg / cnt; tmp[oi + 2] = sb / cnt; tmp[oi + 3] = data[oi + 3];
      if (x - r >= 0)    { const li = (y * w + (x - r))     * 4; sr -= data[li]; sg -= data[li + 1]; sb -= data[li + 2]; }
      if (x + r + 1 < w) { const ri = (y * w + (x + r + 1)) * 4; sr += data[ri]; sg += data[ri + 1]; sb += data[ri + 2]; }
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sr = 0, sg = 0, sb = 0;
    for (let dy = 0; dy <= r; dy++) {
      const pi = (Math.min(h - 1, dy) * w + x) * 4;
      sr += tmp[pi]; sg += tmp[pi + 1]; sb += tmp[pi + 2];
    }
    for (let y = 0; y < h; y++) {
      const cnt = Math.min(y + r, h - 1) - Math.max(0, y - r) + 1;
      const oi = (y * w + x) * 4;
      data[oi] = sr / cnt; data[oi + 1] = sg / cnt; data[oi + 2] = sb / cnt;
      if (y - r >= 0)    { const li = ((y - r)     * w + x) * 4; sr -= tmp[li]; sg -= tmp[li + 1]; sb -= tmp[li + 2]; }
      if (y + r + 1 < h) { const ri = ((y + r + 1) * w + x) * 4; sr += tmp[ri]; sg += tmp[ri + 1]; sb += tmp[ri + 2]; }
    }
  }
}

// ─── Separable box blur — Float32Array ───────────────────────────────────────

export function blurF32(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let dx = 0; dx <= r; dx++) sum += src[y * w + Math.min(w - 1, dx)];
    for (let x = 0; x < w; x++) {
      const cnt = Math.min(x + r, w - 1) - Math.max(0, x - r) + 1;
      tmp[y * w + x] = sum / cnt;
      if (x - r >= 0)    sum -= src[y * w + (x - r)];
      if (x + r + 1 < w) sum += src[y * w + (x + r + 1)];
    }
  }
  const out = new Float32Array(src.length);
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = 0; dy <= r; dy++) sum += tmp[Math.min(h - 1, dy) * w + x];
    for (let y = 0; y < h; y++) {
      const cnt = Math.min(y + r, h - 1) - Math.max(0, y - r) + 1;
      out[y * w + x] = sum / cnt;
      if (y - r >= 0)    sum -= tmp[(y - r) * w + x];
      if (y + r + 1 < h) sum += tmp[(y + r + 1) * w + x];
    }
  }
  return out;
}

// ─── Sobel magnitude (normalised [0,1]) ──────────────────────────────────────

function sobel(lum: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  let maxMag = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = lum[(y-1)*w+(x-1)], tc = lum[(y-1)*w+x], tr = lum[(y-1)*w+(x+1)];
      const ml = lum[ y   *w+(x-1)],                       mr = lum[ y   *w+(x+1)];
      const bl = lum[(y+1)*w+(x-1)], bc = lum[(y+1)*w+x], br = lum[(y+1)*w+(x+1)];
      const gx = -tl - 2*ml - bl + tr + 2*mr + br;
      const gy = -tl - 2*tc - tr + bl + 2*bc + br;
      const mag = Math.sqrt(gx*gx + gy*gy);
      out[y*w+x] = mag;
      if (mag > maxMag) maxMag = mag;
    }
  }
  if (maxMag > 0) for (let i = 0; i < out.length; i++) out[i] /= maxMag;
  return out;
}

// ─── Multi-scale edge map ─────────────────────────────────────────────────────
/**
 * Three Sobel passes at different blur radii blended together:
 *   r=0 (sharp)  ×0.45 → fine detail (eyelashes, iris ring, text)
 *   r=2 (medium) ×0.35 → contours    (lips, eyebrows, hair edges)
 *   r=6 (coarse) ×0.20 → silhouettes (face outline, hair mass)
 *
 * Result is dilated by 1px so neighbouring cells inherit the boost.
 */
function buildEdgeMap(lum: Float32Array, w: number, h: number): Float32Array {
  const e0 = sobel(lum, w, h);
  const e1 = sobel(blurF32(lum, w, h, 2), w, h);
  const e2 = sobel(blurF32(lum, w, h, 6), w, h);

  const blended = new Float32Array(w * h);
  for (let i = 0; i < blended.length; i++) {
    blended[i] = Math.min(1, e0[i] * 0.45 + e1[i] * 0.35 + e2[i] * 0.20);
  }

  // 1-pixel max-pool dilation
  const dilated = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let mx = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w) {
            const v = blended[ny * w + nx];
            if (v > mx) mx = v;
          }
        }
      }
      dilated[y * w + x] = mx;
    }
  }
  return dilated;
}

// ─── Summed-Area Table ────────────────────────────────────────────────────────

function buildSAT(values: Float32Array, w: number, h: number): Float64Array {
  const sat = new Float64Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      sat[i] = values[i]
        + (x > 0 ? sat[i - 1] : 0)
        + (y > 0 ? sat[i - w] : 0)
        - (x > 0 && y > 0 ? sat[i - w - 1] : 0);
    }
  }
  return sat;
}

/**
 * O(1) rectangular mean query on a SAT.
 * Correct standard formula: TL − BL − TR + BR.
 */
export function satMean(
  sat: Float64Array, w: number, h: number,
  x1: number, y1: number, x2: number, y2: number,
): number {
  x1 = Math.max(0, Math.round(x1)); y1 = Math.max(0, Math.round(y1));
  x2 = Math.min(w - 1, Math.round(x2)); y2 = Math.min(h - 1, Math.round(y2));
  if (x2 < x1 || y2 < y1) return 0;
  const n = (x2 - x1 + 1) * (y2 - y1 + 1);
  const sum = sat[y2 * w + x2]
    - (x1 > 0 ? sat[y2 * w + (x1 - 1)] : 0)
    - (y1 > 0 ? sat[(y1 - 1) * w + x2] : 0)
    + (x1 > 0 && y1 > 0 ? sat[(y1 - 1) * w + (x1 - 1)] : 0);
  return sum / n;
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Downsamples the source image to analysis resolution, applies BC + blur,
 * then builds the luminance map, multi-scale edge map, and RGB SATs.
 *
 * The `pixels` array is NOT mutated.
 */
export function buildAnalysisMaps(
  pixels: Uint8ClampedArray,
  sw: number, sh: number,
  settings: PointillistSettings,
): AnalysisMaps {
  const scale  = Math.min(1, ANALYSIS_MAX / Math.max(sw, sh));
  const aw     = Math.max(1, Math.round(sw * scale));
  const ah     = Math.max(1, Math.round(sh * scale));
  const scaleX = sw / aw;
  const scaleY = sh / ah;

  // Work on a copy so the caller's buffer is unchanged
  const src = new Uint8ClampedArray(pixels);

  if (settings.brightness !== 0 || settings.contrast !== 0) {
    for (let i = 0; i < src.length; i += 4) {
      src[i]     = applyBC(src[i],     settings.brightness, settings.contrast);
      src[i + 1] = applyBC(src[i + 1], settings.brightness, settings.contrast);
      src[i + 2] = applyBC(src[i + 2], settings.brightness, settings.contrast);
    }
  }
  const blurPx = Math.round((settings.smoothing / 100) * 5);
  if (blurPx >= 1) blurRGBA(src, sw, sh, blurPx);

  // Area-average downsample into typed float channels
  const lumA = new Float32Array(aw * ah);
  const rA   = new Float32Array(aw * ah);
  const gA   = new Float32Array(aw * ah);
  const bA   = new Float32Array(aw * ah);

  for (let ay = 0; ay < ah; ay++) {
    for (let ax = 0; ax < aw; ax++) {
      const sx0 = Math.floor(ax * scaleX);
      const sy0 = Math.floor(ay * scaleY);
      const sx1 = Math.min(sw - 1, Math.ceil((ax + 1) * scaleX) - 1);
      const sy1 = Math.min(sh - 1, Math.ceil((ay + 1) * scaleY) - 1);
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let py = sy0; py <= sy1; py++) {
        for (let px = sx0; px <= sx1; px++) {
          const pi = (py * sw + px) * 4;
          sr += src[pi]; sg += src[pi + 1]; sb += src[pi + 2];
          n++;
        }
      }
      const r = sr / n, g = sg / n, b = sb / n;
      const ai = ay * aw + ax;
      const l  = (LUMA_R * r + LUMA_G * g + LUMA_B * b) / 255;
      lumA[ai] = settings.invert ? 1 - l : l;
      rA[ai] = r; gA[ai] = g; bA[ai] = b;
    }
  }

  return {
    lum:   lumA,
    edges: buildEdgeMap(lumA, aw, ah),
    rSAT:  buildSAT(rA, aw, ah),
    gSAT:  buildSAT(gA, aw, ah),
    bSAT:  buildSAT(bA, aw, ah),
    aw, ah, scaleX, scaleY,
  };
}
