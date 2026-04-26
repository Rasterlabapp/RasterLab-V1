// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointillistSettings {
  dotSize: number;          // 1–20  base radius
  density: number;          // 1–100 coverage
  randomness: number;       // 0–100 position jitter
  contrast: number;         // -100 to 100
  brightness: number;       // -100 to 100
  edgeSensitivity: number;  // 0–100 edge detail boost
  smoothing: number;        // 0–100 pre-blur
  invert: boolean;
  colorMode: 'color' | 'monochrome';
  backgroundColor: string;
}

export const DEFAULT_POINTILLIST: PointillistSettings = {
  dotSize: 4,
  density: 60,
  randomness: 30,
  contrast: 10,
  brightness: 0,
  edgeSensitivity: 40,
  smoothing: 20,
  invert: false,
  colorMode: 'color',
  backgroundColor: '#0a0a0a',
};

// ─── Math ─────────────────────────────────────────────────────────────────────

const clamp01  = (v: number) => v < 0 ? 0 : v > 1 ? 1 : v;
const clamp255 = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v;

/** ITU-R BT.709 perceptual luminance [0–1] */
const luma = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Photographic S-curve — lifts mid-tones, compresses extremes.
 * strength > 1 = more contrast in the mid-range.
 */
function sCurve(t: number, strength = 2.0): number {
  const s = 1 / (1 + Math.exp(-strength * (t - 0.5) * 6));
  return clamp01((s - 0.269) / (0.731 - 0.269));
}

/** Photoshop-style brightness + contrast per channel */
function applyBC(v: number, brightness: number, contrast: number): number {
  const b = brightness * 2.55;
  const c = contrast > 0
    ? (259 * (contrast + 255)) / (255 * (259 - contrast))
    : 1 + contrast / 100;
  return clamp255(c * (v + b - 128) + 128);
}

// ─── Separable box blur (Float32, O(w·h) sliding window) ─────────────────────

function boxBlurF32(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return src;
  const tmp = new Float32Array(src.length);

  // Horizontal
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let dx = 0; dx <= r; dx++) sum += src[y * w + Math.min(w - 1, dx)];
    for (let x = 0; x < w; x++) {
      const cnt = Math.min(x + r, w - 1) - Math.max(0, x - r) + 1;
      tmp[y * w + x] = sum / cnt;
      if (x - r >= 0)       sum -= src[y * w + (x - r)];
      if (x + r + 1 < w)    sum += src[y * w + (x + r + 1)];
    }
  }

  const out = new Float32Array(src.length);
  // Vertical
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = 0; dy <= r; dy++) sum += tmp[Math.min(h - 1, dy) * w + x];
    for (let y = 0; y < h; y++) {
      const cnt = Math.min(y + r, h - 1) - Math.max(0, y - r) + 1;
      out[y * w + x] = sum / cnt;
      if (y - r >= 0)       sum -= tmp[(y - r) * w + x];
      if (y + r + 1 < h)    sum += tmp[(y + r + 1) * w + x];
    }
  }
  return out;
}

/** Same as above but for Uint8ClampedArray (in-place) */
function fastBoxBlur(data: Uint8ClampedArray, w: number, h: number, r: number) {
  if (r < 1) return;
  const tmp = new Uint8ClampedArray(data.length);
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
      if (x - r >= 0)    { const li = (y * w + (x - r)) * 4;     sr -= data[li]; sg -= data[li + 1]; sb -= data[li + 2]; }
      if (x + r + 1 < w) { const ri = (y * w + (x + r + 1)) * 4; sr += data[ri]; sg += data[ri + 1]; sb += data[ri + 2]; }
    }
  }
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
      if (y - r >= 0)    { const li = ((y - r) * w + x) * 4;     sr -= tmp[li]; sg -= tmp[li + 1]; sb -= tmp[li + 2]; }
      if (y + r + 1 < h) { const ri = ((y + r + 1) * w + x) * 4; sr += tmp[ri]; sg += tmp[ri + 1]; sb += tmp[ri + 2]; }
    }
  }
}

// ─── Summed Area Table ────────────────────────────────────────────────────────

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

function satMean(sat: Float64Array, w: number, x1: number, y1: number, x2: number, y2: number): number {
  const h = sat.length / w;
  x1 = Math.max(0, x1); y1 = Math.max(0, y1);
  x2 = Math.min(w - 1, x2); y2 = Math.min(h - 1, y2);
  if (x2 < x1 || y2 < y1) return 0;
  const n = (x2 - x1 + 1) * (y2 - y1 + 1);
  const i = y2 * w + x2;
  const sum = sat[i]
    - (x1 > 0 ? sat[i - x1] : 0)
    - (y1 > 0 ? sat[(y1 - 1) * w + x2] : 0)
    + (x1 > 0 && y1 > 0 ? sat[(y1 - 1) * w + (x1 - 1)] : 0);
  return sum / n;
}

// ─── Sobel magnitude on a Float32 luminance map ───────────────────────────────

function sobelMagnitude(lum: Float32Array, w: number, h: number): Float32Array {
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
 * Runs Sobel at three blur levels and blends the results.
 *
 *  Scale 0 (r=0) → fine detail:   eyelashes, pores, fine hair, iris ring
 *  Scale 1 (r=2) → contours:      eyebrows, lip edges, nose bridge, ear rim
 *  Scale 2 (r=7) → silhouettes:   face outline, chin, shoulders, hair mass
 *
 * Blending: fine × 0.40 + contour × 0.35 + silhouette × 0.25
 * — fine features dominate slightly so portrait micro-detail is preserved.
 *
 * After blending, the map is dilated by 1px so neighboring cells also
 * benefit from the edge boost (avoids hard cutoffs).
 */
function buildMultiScaleEdgeMap(lum: Float32Array, w: number, h: number): Float32Array {
  const e0 = sobelMagnitude(lum, w, h);                     // fine
  const e1 = sobelMagnitude(boxBlurF32(lum, w, h, 2), w, h); // contour
  const e2 = sobelMagnitude(boxBlurF32(lum, w, h, 7), w, h); // silhouette

  // Weighted blend
  const blended = new Float32Array(w * h);
  for (let i = 0; i < blended.length; i++) {
    blended[i] = clamp01(e0[i] * 0.40 + e1[i] * 0.35 + e2[i] * 0.25);
  }

  // 1-pixel dilation (max-pool 3×3) so adjacent cells inherit edge boost
  const dilated = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let mx = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const ny = y + dy, nx = x + dx;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
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

// ─── Local variance map ───────────────────────────────────────────────────────
/**
 * E[X²] − E[X]² in a 3×3 window of the analysis image.
 * High variance = textured/detailed area (hair, iris, fabric, grass).
 * Low variance  = flat area (sky, painted wall, smooth skin patch).
 *
 * Used to suppress muddy dot clusters in uniform zones.
 */
function buildVarianceMap(lum: Float32Array, w: number, h: number): Float32Array {
  const lum2 = new Float32Array(lum.length);
  for (let i = 0; i < lum.length; i++) lum2[i] = lum[i] * lum[i];

  const lumSAT  = buildSAT(lum,  w, h);
  const lum2SAT = buildSAT(lum2, w, h);

  const variance = new Float32Array(w * h);
  let maxVar = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const meanL  = satMean(lumSAT,  w, x - 1, y - 1, x + 1, y + 1);
      const meanL2 = satMean(lum2SAT, w, x - 1, y - 1, x + 1, y + 1);
      const v = Math.max(0, meanL2 - meanL * meanL);
      variance[y * w + x] = v;
      if (v > maxVar) maxVar = v;
    }
  }
  if (maxVar > 0) for (let i = 0; i < variance.length; i++) variance[i] /= maxVar;
  return variance;
}

// ─── Analysis maps ────────────────────────────────────────────────────────────

const ANALYSIS_MAX = 900;

interface AnalysisMaps {
  edgeMap:     Float32Array;  // 0–1 multi-scale edge strength
  varianceMap: Float32Array;  // 0–1 local luminance variance
  lumSAT:      Float64Array;  // SAT of luminance for fast cell sampling
  rSAT:        Float64Array;
  gSAT:        Float64Array;
  bSAT:        Float64Array;
  aw: number; ah: number;
  scale: number;              // analysis_px / source_px
}

function buildAnalysis(pixels: Uint8ClampedArray, sw: number, sh: number): AnalysisMaps {
  const scale = Math.min(1, ANALYSIS_MAX / Math.max(sw, sh));
  const aw = Math.round(sw * scale);
  const ah = Math.round(sh * scale);
  const scaleX = sw / aw, scaleY = sh / ah;

  // Area-average downscale into typed float channels
  const lumF = new Float32Array(aw * ah);
  const rF   = new Float32Array(aw * ah);
  const gF   = new Float32Array(aw * ah);
  const bF   = new Float32Array(aw * ah);

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
          sr += pixels[pi]; sg += pixels[pi + 1]; sb += pixels[pi + 2];
          n++;
        }
      }
      const r = sr / n, g = sg / n, b = sb / n;
      const ai = ay * aw + ax;
      lumF[ai] = luma(r, g, b);
      rF[ai] = r; gF[ai] = g; bF[ai] = b;
    }
  }

  return {
    edgeMap:     buildMultiScaleEdgeMap(lumF, aw, ah),
    varianceMap: buildVarianceMap(lumF, aw, ah),
    lumSAT:      buildSAT(lumF, aw, ah),
    rSAT:        buildSAT(rF, aw, ah),
    gSAT:        buildSAT(gF, aw, ah),
    bSAT:        buildSAT(bF, aw, ah),
    aw, ah, scale,
  };
}

// ─── Occupancy grid ───────────────────────────────────────────────────────────
/**
 * Prevents muddy overlap in flat dark areas.
 * Cell size ≈ dotSize — each dot claims its center cell.
 * Sub-pixel dots (edge refinement pass) use a finer grid.
 */
class OccupancyGrid {
  private grid: Uint8Array;
  private w: number;
  private cellSize: number;

  constructor(imageW: number, imageH: number, cellSize: number) {
    this.cellSize = Math.max(1, cellSize);
    this.w = Math.ceil(imageW / this.cellSize);
    const h = Math.ceil(imageH / this.cellSize);
    this.grid = new Uint8Array(this.w * h);
  }

  isOccupied(x: number, y: number): boolean {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return this.grid[cy * this.w + cx] > 0;
  }

  mark(x: number, y: number) {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    this.grid[cy * this.w + cx] = 1;
  }
}

// ─── Deterministic per-cell LCG ───────────────────────────────────────────────

function cellRng(gx: number, gy: number, pass: number): () => number {
  let s = ((gx * 1664525 + gy * 1013904223) ^ (pass * 2246822519)) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ─── Color quantization + batch drawing ──────────────────────────────────────

const COLOR_BITS  = 5;
const COLOR_SHIFT = 8 - COLOR_BITS;
const COLOR_MASK  = (1 << COLOR_BITS) - 1;

function quantizeColor(r: number, g: number, b: number): number {
  return ((r >> COLOR_SHIFT) << (COLOR_BITS * 2))
       | ((g >> COLOR_SHIFT) << COLOR_BITS)
       |  (b >> COLOR_SHIFT);
}

function bucketToRGB(bucket: number): [number, number, number] {
  const half = 1 << (COLOR_SHIFT - 1);
  return [
    ((bucket >> (COLOR_BITS * 2)) & COLOR_MASK) * (1 << COLOR_SHIFT) + half,
    ((bucket >> COLOR_BITS)       & COLOR_MASK) * (1 << COLOR_SHIFT) + half,
    ( bucket                      & COLOR_MASK) * (1 << COLOR_SHIFT) + half,
  ];
}

// ─── Core render (DOM-free — works in Worker + main thread) ──────────────────
/**
 * renderPointillistCore accepts raw RGBA pixels and any canvas 2D context
 * (HTMLCanvasElement ctx OR OffscreenCanvas ctx). This makes it callable
 * from a Web Worker using OffscreenCanvas without modification.
 *
 * Callers are responsible for:
 *   1. Providing a copy of pixels (the function mutates them for BC/blur)
 *   2. Setting dst context dimensions before calling
 */
export function renderPointillistCore(
  pixels: Uint8ClampedArray,  // mutable copy — will be modified in-place
  sw: number,
  sh: number,
  s: PointillistSettings,
  dstCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): number {
  const t0 = performance.now();

  // ── 1. BC + blur on raw pixels ────────────────────────────────────────────
  if (s.brightness !== 0 || s.contrast !== 0) {
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i]     = applyBC(pixels[i],     s.brightness, s.contrast);
      pixels[i + 1] = applyBC(pixels[i + 1], s.brightness, s.contrast);
      pixels[i + 2] = applyBC(pixels[i + 2], s.brightness, s.contrast);
    }
  }
  const blurPx = Math.round((s.smoothing / 100) * 4);
  if (blurPx >= 1) fastBoxBlur(pixels, sw, sh, blurPx);

  // ── 2. Analysis maps ──────────────────────────────────────────────────────
  const { edgeMap, varianceMap, lumSAT, rSAT, gSAT, bSAT, aw, ah, scale } =
    buildAnalysis(pixels, sw, sh);

  const edgeW = s.edgeSensitivity / 100;

  // ── 3. Placement parameters ───────────────────────────────────────────────
  const densityT   = s.density / 100;
  const baseMaxR   = s.dotSize;
  const gridStep   = Math.max(2, Math.round(baseMaxR * 1.9 * (1 - densityT * 0.82) + 1.4));
  const fineStep   = Math.max(1, Math.round(gridStep * 0.52)); // edge refinement grid
  const jitterBase = (s.randomness / 100) * gridStep * 0.70;

  // Thresholds for flat / edge zones
  const FLAT_VAR_THRESH  = 0.06;  // below = flat area
  const EDGE_STR_THRESH  = 0.30;  // above = edge zone

  // ── 4. Occupancy grids ────────────────────────────────────────────────────
  // Coarse pass: cellSize ≈ dotSize (prevents large-dot mud)
  const coarseOcc = new OccupancyGrid(sw, sh, Math.max(1, Math.round(baseMaxR * 0.85)));
  // Edge refinement: finer grid (smaller dots, finer spacing)
  const edgeOcc   = new OccupancyGrid(sw, sh, Math.max(1, Math.round(baseMaxR * 0.38)));

  // ── 5. Collect dots (two passes) ─────────────────────────────────────────
  const MAX_DOTS = Math.ceil((sw / fineStep + 4) * (sh / fineStep + 4) * 3);
  const dotX   = new Float32Array(MAX_DOTS);
  const dotY   = new Float32Array(MAX_DOTS);
  const dotR   = new Float32Array(MAX_DOTS);
  const dotBkt = new Int32Array(MAX_DOTS);
  let dotCount = 0;

  // Precomputed half-cell in analysis space for SAT queries
  const halfCellA0 = Math.max(0.5, (gridStep  * scale) * 0.45);
  const halfCellA1 = Math.max(0.5, (fineStep  * scale) * 0.45);

  function placeDot(
    worldX: number, worldY: number, r: number,
    ax: number, ay: number, halfCA: number,
    occ: OccupancyGrid,
  ) {
    if (r < 0.35) return;
    if (occ.isOccupied(worldX, worldY)) return;
    if (dotCount >= MAX_DOTS) return;

    // Color sample from analysis SAT
    const x1 = Math.round(ax - halfCA), y1 = Math.round(ay - halfCA);
    const x2 = Math.round(ax + halfCA), y2 = Math.round(ay + halfCA);
    let bucket = -1;
    if (s.colorMode === 'color') {
      const sr = Math.round(satMean(rSAT, aw, x1, y1, x2, y2));
      const sg = Math.round(satMean(gSAT, aw, x1, y1, x2, y2));
      const sb = Math.round(satMean(bSAT, aw, x1, y1, x2, y2));
      bucket = quantizeColor(sr, sg, sb);
    }

    occ.mark(worldX, worldY);
    dotX[dotCount]   = worldX;
    dotY[dotCount]   = worldY;
    dotR[dotCount]   = r;
    dotBkt[dotCount] = bucket;
    dotCount++;
  }

  // ── PASS 1: Coarse grid ─────────────────────────────────────────────────
  for (let gy = 0; gy < sh; gy += gridStep) {
    for (let gx = 0; gx < sw; gx += gridStep) {
      const rng = cellRng(gx, gy, 0);

      // Analysis-space coordinates
      const ax = Math.round(gx * scale);
      const ay = Math.round(gy * scale);
      const aiIdx = Math.max(0, Math.min(aw * ah - 1, ay * aw + ax));

      const edgeStr = edgeMap[aiIdx] * edgeW;
      const variance = varianceMap[aiIdx];

      // Cell-average luminance via SAT
      const x1a = Math.round(ax - halfCellA0), y1a = Math.round(ay - halfCellA0);
      const x2a = Math.round(ax + halfCellA0), y2a = Math.round(ay + halfCellA0);
      let lumCell = satMean(lumSAT, aw, x1a, y1a, x2a, y2a);
      if (s.invert) lumCell = 1 - lumCell;
      const darkness = clamp01(1 - lumCell);

      // Classify cell
      const isFlat = variance < FLAT_VAR_THRESH && edgeStr < EDGE_STR_THRESH * edgeW;
      const isEdge = edgeStr > EDGE_STR_THRESH * edgeW;

      // ── Placement probability ─────────────────────────────────────────
      // Dark cells nearly always place; light cells need high density.
      // Flat cells are strongly suppressed to avoid muddy uniform fills.
      const basePlacement = 0.18 + densityT * 0.82;
      const flatMult = isFlat  ? 0.22 : 1.0;
      const edgeMult = isEdge  ? 1.30 : 1.0;
      const darkMult = Math.pow(darkness + 0.08, 0.35);
      const prob = clamp01(basePlacement * flatMult * edgeMult * darkMult);

      if (rng() > prob) continue;

      // ── Radius ────────────────────────────────────────────────────────
      // Flat areas: slightly larger dots (fewer, more deliberate).
      // Edge areas: smaller dots (more numerous from the refinement pass).
      // Use S-curve so mid-tones feel painterly.
      const flatR = isFlat ? 1.20 : 1.0;
      const edgeR = isEdge ? 0.78 : 1.0;
      const r = Math.max(0.5, sCurve(darkness, 2.0) * baseMaxR * flatR * edgeR);

      // ── Jitter ────────────────────────────────────────────────────────
      // Near edges, dots snap closer to the true contour → sharper lines.
      const jitterScale = 1 - edgeStr * 0.55;
      const jx = gx + (rng() - 0.5) * 2 * jitterBase * jitterScale;
      const jy = gy + (rng() - 0.5) * 2 * jitterBase * jitterScale;

      placeDot(jx, jy, r, ax, ay, halfCellA0, coarseOcc);
    }
  }

  // ── PASS 2: Edge refinement ─────────────────────────────────────────────
  // Adds a second layer of smaller, denser dots along detected edges.
  // Only activates where edgeStr > threshold, so flat areas are untouched.
  if (edgeW > 0.05) {
    const edgeMinStr = 0.28;  // minimum edge strength to trigger refinement
    const edgeRScale = 0.45;  // refinement dots are 45% the size of coarse dots
    const edgePlacement = 0.72 + densityT * 0.25;

    for (let gy = 0; gy < sh; gy += fineStep) {
      for (let gx = 0; gx < sw; gx += fineStep) {
        const ax = Math.round(gx * scale);
        const ay = Math.round(gy * scale);
        const aiIdx = Math.max(0, Math.min(aw * ah - 1, ay * aw + ax));

        const edgeStr = edgeMap[aiIdx] * edgeW;
        if (edgeStr < edgeMinStr) continue; // skip non-edge cells

        // Weighted edge probability — stronger edges place more dots
        const rng = cellRng(gx, gy, 1);
        const prob = edgePlacement * Math.pow(edgeStr, 0.6);
        if (rng() > prob) continue;

        // Luminance for this fine cell
        let lumCell = satMean(lumSAT, aw, ax - 1, ay - 1, ax + 1, ay + 1);
        if (s.invert) lumCell = 1 - lumCell;
        const darkness = clamp01(1 - lumCell);
        if (darkness < 0.08) continue;

        // Small radius — these are detail dots, not area-fill dots
        const r = Math.max(0.4, sCurve(darkness, 2.5) * baseMaxR * edgeRScale);

        // Very low jitter — snap to edge precisely
        const jx = gx + (rng() - 0.5) * 2 * jitterBase * 0.15;
        const jy = gy + (rng() - 0.5) * 2 * jitterBase * 0.15;

        placeDot(jx, jy, r, ax, ay, halfCellA1, edgeOcc);
      }
    }
  }

  // ── 6. Draw ───────────────────────────────────────────────────────────────
  dstCtx.fillStyle = s.backgroundColor;
  dstCtx.fillRect(0, 0, sw, sh);

  if (s.colorMode === 'monochrome') {
    // Single path — fastest possible draw
    const isDarkBg = !isLightColor(s.backgroundColor);
    dstCtx.fillStyle = isDarkBg ? '#ffffff' : '#111111';
    dstCtx.beginPath();
    for (let i = 0; i < dotCount; i++) {
      const r = dotR[i];
      if (r < 0.35) continue;
      if (r < 1) {
        // Sub-pixel: draw at r=1 with alpha fade
        dstCtx.fill();
        dstCtx.globalAlpha = r;
        dstCtx.beginPath();
        dstCtx.arc(dotX[i], dotY[i], 1, 0, Math.PI * 2);
        dstCtx.fill();
        dstCtx.globalAlpha = 1;
        dstCtx.beginPath();
      } else {
        dstCtx.moveTo(dotX[i] + r, dotY[i]);
        dstCtx.arc(dotX[i], dotY[i], r, 0, Math.PI * 2);
      }
    }
    dstCtx.fill();

  } else {
    // Sort by color bucket → batch arcs per bucket → minimise fillStyle changes
    const indices = new Int32Array(dotCount);
    for (let i = 0; i < dotCount; i++) indices[i] = i;
    indices.sort((a, b) => dotBkt[a] - dotBkt[b]);

    let currentBucket = -2;
    let pathOpen = false;

    for (let ii = 0; ii < dotCount; ii++) {
      const i = indices[ii];
      const bkt = dotBkt[i];
      const r = dotR[i];

      // Sub-pixel dot: flush current path and draw individually with alpha
      if (r < 1) {
        if (pathOpen) { dstCtx.fill(); pathOpen = false; currentBucket = -2; }
        const [cr, cg, cb] = bucketToRGB(bkt);
        dstCtx.globalAlpha = r;
        dstCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
        dstCtx.beginPath();
        dstCtx.arc(dotX[i], dotY[i], 1, 0, Math.PI * 2);
        dstCtx.fill();
        dstCtx.globalAlpha = 1;
        continue;
      }

      if (bkt !== currentBucket) {
        if (pathOpen) dstCtx.fill();
        const [cr, cg, cb] = bucketToRGB(bkt);
        dstCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
        dstCtx.beginPath();
        currentBucket = bkt;
        pathOpen = true;
      }

      dstCtx.moveTo(dotX[i] + r, dotY[i]);
      dstCtx.arc(dotX[i], dotY[i], r, 0, Math.PI * 2);
    }

    if (pathOpen) dstCtx.fill();
    dstCtx.globalAlpha = 1;
  }

  return Math.round(performance.now() - t0);
}

// ─── Main-thread convenience wrapper ─────────────────────────────────────────
/**
 * Legacy API — extracts pixels from src canvas, runs core engine,
 * draws result to dst canvas. Used for fallback (no Worker support).
 */
export function renderPointillist(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  s: PointillistSettings,
): number {
  const pixels = extractPixels(src);
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  return renderPointillistCore(pixels, src.width, src.height, s, ctx);
}

/**
 * Extract a mutable copy of RGBA pixels from an HTMLCanvasElement.
 * Returns a new Uint8ClampedArray (safe to transfer to a Worker).
 */
export function extractPixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = canvas.getContext('2d')!;
  return new Uint8ClampedArray(
    ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer,
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return luma(r, g, b) > 0.5;
}
