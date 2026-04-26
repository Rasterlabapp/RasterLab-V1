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

// ─── Math helpers ─────────────────────────────────────────────────────────────

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** ITU-R BT.709 perceptual luminance [0-1] */
function luma(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Photographic S-curve for radius mapping — mid-tones get gentler treatment */
function sCurve(t: number, strength = 1.8): number {
  // Lifted sigmoid centered at 0.5
  const s = 1 / (1 + Math.exp(-strength * (t - 0.5) * 6));
  return clamp01((s - 0.269) / (0.731 - 0.269)); // normalize to [0,1]
}

/** Per-channel brightness + contrast (Photoshop formula) */
function applyBC(v: number, brightness: number, contrast: number): number {
  const b = brightness * 2.55;
  const c = contrast > 0
    ? (259 * (contrast + 255)) / (255 * (259 - contrast))
    : 1 + contrast / 100;
  return clamp255(c * (v + b - 128) + 128);
}

// ─── Summed Area Table (SAT) ──────────────────────────────────────────────────
// Enables O(1) rectangular region averages for cell sampling and variance map.

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

/** Sum of values in rectangle [x1,y1]–[x2,y2] inclusive via SAT */
function satQuery(sat: Float64Array, w: number, x1: number, y1: number, x2: number, y2: number): number {
  // clamp
  if (x2 < 0 || y2 < 0 || x1 >= w) return 0;
  x1 = Math.max(0, x1); y1 = Math.max(0, y1);
  const h = sat.length / w;
  x2 = Math.min(w - 1, x2); y2 = Math.min(h - 1, y2);
  const i = y2 * w + x2;
  return sat[i]
    - (x1 > 0 ? sat[i - x1] : 0)
    - (y1 > 0 ? sat[(y1 - 1) * w + x2] : 0)
    + (x1 > 0 && y1 > 0 ? sat[(y1 - 1) * w + (x1 - 1)] : 0);
}

function satMean(sat: Float64Array, w: number, x1: number, y1: number, x2: number, y2: number): number {
  const h = sat.length / w;
  x1 = Math.max(0, x1); y1 = Math.max(0, y1);
  x2 = Math.min(w - 1, x2); y2 = Math.min(h - 1, y2);
  const n = (x2 - x1 + 1) * (y2 - y1 + 1);
  if (n <= 0) return 0;
  return satQuery(sat, w, x1, y1, x2, y2) / n;
}

// ─── Analysis pipeline ────────────────────────────────────────────────────────

interface AnalysisMaps {
  lumSAT: Float64Array;    // SAT of luminance
  lum2SAT: Float64Array;   // SAT of lum² (for variance)
  edgeMap: Float32Array;   // 0–1 combined edge strength (normalized)
  rSAT: Float64Array;      // SAT of red channel (for color sampling)
  gSAT: Float64Array;
  bSAT: Float64Array;
  aw: number;
  ah: number;
  scale: number;           // analysis_px / source_px
}

/** Max resolution for analysis maps — keeps Sobel + SAT fast even at 3000px */
const ANALYSIS_MAX = 900;

function buildAnalysis(
  pixels: Uint8ClampedArray,
  sw: number,
  sh: number,
): AnalysisMaps {
  // Downscale factor — for 3000px images this is ~3.33x reduction
  const scale = Math.min(1, ANALYSIS_MAX / Math.max(sw, sh));
  const aw = Math.round(sw * scale);
  const ah = Math.round(sh * scale);

  // ── Build downscaled pixel arrays via area averaging ─────────────────────
  const lumF   = new Float32Array(aw * ah);
  const lum2F  = new Float32Array(aw * ah);
  const rF     = new Float32Array(aw * ah);
  const gF     = new Float32Array(aw * ah);
  const bF     = new Float32Array(aw * ah);

  const scaleX = sw / aw;
  const scaleY = sh / ah;

  for (let ay = 0; ay < ah; ay++) {
    for (let ax = 0; ax < aw; ax++) {
      // Region in source this analysis cell covers
      const sx0 = Math.floor(ax * scaleX);
      const sy0 = Math.floor(ay * scaleY);
      const sx1 = Math.min(sw - 1, Math.floor((ax + 1) * scaleX) - 1);
      const sy1 = Math.min(sh - 1, Math.floor((ay + 1) * scaleY) - 1);

      let sumR = 0, sumG = 0, sumB = 0, n = 0;
      for (let py = sy0; py <= sy1; py++) {
        for (let px = sx0; px <= sx1; px++) {
          const pi = (py * sw + px) * 4;
          sumR += pixels[pi]; sumG += pixels[pi + 1]; sumB += pixels[pi + 2];
          n++;
        }
      }
      const r = sumR / n, g = sumG / n, b = sumB / n;
      const L = luma(r, g, b);

      const ai = ay * aw + ax;
      lumF[ai]  = L;
      lum2F[ai] = L * L;
      rF[ai] = r; gF[ai] = g; bF[ai] = b;
    }
  }

  // ── Edge map: combine Sobel magnitude + local variance ───────────────────
  // Sobel captures sharp edges; variance captures textures, facial detail, hair
  const sobelMag  = new Float32Array(aw * ah);
  const localVar  = new Float32Array(aw * ah);

  // Build lum SAT first for variance
  const lumSAT  = buildSAT(lumF,  aw, ah);
  const lum2SAT = buildSAT(lum2F, aw, ah);

  let maxSobel = 0;
  const VAR_RADIUS = 2; // 5×5 neighborhood for local variance

  for (let y = 1; y < ah - 1; y++) {
    for (let x = 1; x < aw - 1; x++) {
      // Sobel 3×3
      const tl = lumF[(y-1)*aw+(x-1)], tc = lumF[(y-1)*aw+x], tr = lumF[(y-1)*aw+(x+1)];
      const ml = lumF[ y   *aw+(x-1)],                         mr = lumF[ y   *aw+(x+1)];
      const bl = lumF[(y+1)*aw+(x-1)], bc = lumF[(y+1)*aw+x], br = lumF[(y+1)*aw+(x+1)];
      const gx = -tl - 2*ml - bl + tr + 2*mr + br;
      const gy = -tl - 2*tc - tr + bl + 2*bc + br;
      const mag = Math.sqrt(gx*gx + gy*gy);
      sobelMag[y*aw+x] = mag;
      if (mag > maxSobel) maxSobel = mag;

      // Local variance via SAT — E[X²] - E[X]²
      const x1 = x - VAR_RADIUS, y1 = y - VAR_RADIUS;
      const x2 = x + VAR_RADIUS, y2 = y + VAR_RADIUS;
      const meanL  = satMean(lumSAT,  aw, x1, y1, x2, y2);
      const meanL2 = satMean(lum2SAT, aw, x1, y1, x2, y2);
      localVar[y*aw+x] = Math.max(0, meanL2 - meanL * meanL);
    }
  }

  // Normalize Sobel and variance separately then blend
  let maxVar = 0;
  for (let i = 0; i < localVar.length; i++) if (localVar[i] > maxVar) maxVar = localVar[i];

  const edgeMap = new Float32Array(aw * ah);
  // Dilate edges slightly so nearby dots get the boost too
  const DILATION = 1;

  for (let y = 0; y < ah; y++) {
    for (let x = 0; x < aw; x++) {
      let maxS = 0, maxV = 0;
      for (let dy = -DILATION; dy <= DILATION; dy++) {
        for (let dx = -DILATION; dx <= DILATION; dx++) {
          const ny = y + dy, nx = x + dx;
          if (nx < 0 || nx >= aw || ny < 0 || ny >= ah) continue;
          const i = ny * aw + nx;
          if (sobelMag[i] > maxS) maxS = sobelMag[i];
          if (localVar[i] > maxV) maxV = localVar[i];
        }
      }
      // Blend: 60% Sobel (sharp edges), 40% variance (texture + subtle features)
      const normS = maxSobel > 0 ? maxS / maxSobel : 0;
      const normV = maxVar   > 0 ? maxV / maxVar   : 0;
      edgeMap[y * aw + x] = clamp01(normS * 0.60 + normV * 0.40);
    }
  }

  return {
    lumSAT, lum2SAT, edgeMap,
    rSAT: buildSAT(rF, aw, ah),
    gSAT: buildSAT(gF, aw, ah),
    bSAT: buildSAT(bF, aw, ah),
    aw, ah, scale,
  };
}

// ─── Color quantization for draw batching ─────────────────────────────────────
// Groups dots into color buckets to minimize fillStyle switches.
// 6-bit per channel (64 levels each) → buckets are perceptually close enough.

const COLOR_BITS = 5; // 32 levels per channel — good enough for AA blend
const COLOR_LEVELS = 1 << COLOR_BITS;
const COLOR_SHIFT = 8 - COLOR_BITS;

function quantizeColor(r: number, g: number, b: number): number {
  return ((r >> COLOR_SHIFT) << (COLOR_BITS * 2))
       | ((g >> COLOR_SHIFT) << COLOR_BITS)
       |  (b >> COLOR_SHIFT);
}

function bucketToRGB(bucket: number): [number, number, number] {
  const step = 1 << COLOR_SHIFT;
  const half = step >> 1;
  return [
    ((bucket >> (COLOR_BITS * 2)) & (COLOR_LEVELS - 1)) * step + half,
    ((bucket >> COLOR_BITS)       & (COLOR_LEVELS - 1)) * step + half,
    ( bucket                      & (COLOR_LEVELS - 1)) * step + half,
  ];
}

// ─── Seeded pseudo-random (deterministic per-cell jitter) ─────────────────────
// Using a fast LCG so the same settings always produce the same pattern.
// The seed encodes the cell position, so each cell's jitter is independent.

function cellRng(gx: number, gy: number): () => number {
  let s = (gx * 1664525 + gy * 1013904223) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

// ─── Core render ─────────────────────────────────────────────────────────────

export function renderPointillist(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  s: PointillistSettings,
): number {
  const t0 = performance.now();

  const sw = src.width, sh = src.height;
  dst.width = sw; dst.height = sh;

  // ── 1. Prepare source pixels with brightness + contrast ───────────────────
  const workCanvas = document.createElement('canvas');
  workCanvas.width = sw; workCanvas.height = sh;
  const wCtx = workCanvas.getContext('2d')!;
  wCtx.drawImage(src, 0, 0);

  const imgData = wCtx.getImageData(0, 0, sw, sh);
  const pixels = imgData.data;

  // BC on full-res pixels before downscaling (ensures correct BC appearance)
  if (s.brightness !== 0 || s.contrast !== 0) {
    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i]     = applyBC(pixels[i],     s.brightness, s.contrast);
      pixels[i + 1] = applyBC(pixels[i + 1], s.brightness, s.contrast);
      pixels[i + 2] = applyBC(pixels[i + 2], s.brightness, s.contrast);
    }
  }

  // Smoothing: slight box blur on source (reduces noise before analysis)
  // Done efficiently via a single-pass running sum
  const blurPx = Math.round((s.smoothing / 100) * 4);
  if (blurPx >= 1) fastBoxBlur(pixels, sw, sh, blurPx);

  // ── 2. Build analysis maps ─────────────────────────────────────────────────
  const maps = buildAnalysis(pixels, sw, sh);
  const { lumSAT, edgeMap, rSAT, gSAT, bSAT, aw, ah, scale } = maps;

  // ── 3. Dot placement parameters ───────────────────────────────────────────
  // Grid step in source pixels
  const densityT   = s.density / 100;                        // 0–1
  const gridStep   = Math.max(2, Math.round(s.dotSize * 1.8 * (1 - densityT * 0.85) + 1.2));
  const jitterAmt  = (s.randomness / 100) * gridStep * 0.75; // max jitter
  const baseMaxR   = s.dotSize;
  const edgeW      = s.edgeSensitivity / 100;

  // Placement probability baseline — density controls how many cells produce a dot
  // At density=100 almost every cell fires; at density=1 only the darkest do.
  const placementBase = 0.15 + densityT * 0.85;

  // ── 4. Collect dots ───────────────────────────────────────────────────────
  // We use flat typed arrays to avoid GC — store (x, y, r, bucket) per dot.
  const maxDots = Math.ceil((sw / gridStep + 2) * (sh / gridStep + 2) * 2);
  const dotX   = new Float32Array(maxDots);
  const dotY   = new Float32Array(maxDots);
  const dotR   = new Float32Array(maxDots);
  const dotBkt = new Int32Array(maxDots);  // color bucket (-1 = monochrome)
  let dotCount = 0;

  // half-cell in analysis coordinates
  const halfCellA = Math.max(0.5, (gridStep * scale) / 2);

  for (let gy = 0; gy < sh; gy += gridStep) {
    for (let gx = 0; gx < sw; gx += gridStep) {
      const rng = cellRng(gx, gy);

      // ── Jitter position ─────────────────────────────────────────────────
      const jx = gx + (rng() - 0.5) * 2 * jitterAmt;
      const jy = gy + (rng() - 0.5) * 2 * jitterAmt;

      // ── Sample analysis maps via SAT ─────────────────────────────────────
      const ax = Math.round(jx * scale);
      const ay = Math.round(jy * scale);

      const x1 = Math.round(ax - halfCellA), y1 = Math.round(ay - halfCellA);
      const x2 = Math.round(ax + halfCellA), y2 = Math.round(ay + halfCellA);

      let lumCell = satMean(lumSAT, aw, x1, y1, x2, y2);
      if (s.invert) lumCell = 1 - lumCell;

      // Edge strength at this cell
      const aiClamped = Math.max(0, Math.min(aw * ah - 1, ay * aw + ax));
      const edgeStrength = edgeMap[aiClamped] ?? 0;

      // ── Darkness → radius ────────────────────────────────────────────────
      // Apply s-curve for more artistic, less linear mapping
      const darkness = clamp01(1 - lumCell);
      // Edges get their own dot density boost (finer effective grid)
      const edgeBoost = edgeStrength * edgeW;

      // Combined dot "weight" — drives both placement probability and radius
      const weight = clamp01(darkness + edgeBoost * 0.5);

      // Probabilistic placement — lighter areas drop out based on density
      // Dark pixels always place; light pixels need high density to appear
      const placementThreshold = placementBase * (1 - darkness * 0.6);
      if (rng() > placementThreshold * Math.pow(weight + 0.1, 0.4)) continue;

      // Radius: s-curve of darkness, boosted slightly by edges
      // Edge dots are slightly smaller but more numerous → sharp detail
      const edgeRadiusMod = 1 - edgeStrength * edgeW * 0.25;
      const rawR = sCurve(darkness, 1.6) * baseMaxR * edgeRadiusMod;
      const r = Math.max(0.4, rawR);

      // ── Color sampling ────────────────────────────────────────────────────
      let bucket: number;
      if (s.colorMode === 'monochrome') {
        bucket = -1;
      } else {
        const sr = Math.round(satMean(rSAT, aw, x1, y1, x2, y2));
        const sg = Math.round(satMean(gSAT, aw, x1, y1, x2, y2));
        const sb = Math.round(satMean(bSAT, aw, x1, y1, x2, y2));
        bucket = quantizeColor(sr, sg, sb);
      }

      if (dotCount < maxDots) {
        dotX[dotCount]   = jx;
        dotY[dotCount]   = jy;
        dotR[dotCount]   = r;
        dotBkt[dotCount] = bucket;
        dotCount++;
      }
    }
  }

  // ── 5. Draw ───────────────────────────────────────────────────────────────
  const dstCtx = dst.getContext('2d')!;

  // Background
  dstCtx.fillStyle = s.backgroundColor;
  dstCtx.fillRect(0, 0, sw, sh);

  if (s.colorMode === 'monochrome') {
    // ── Mono: single path, bg-colored dots on black (or white on dark bg) ──
    const isLight = isLightColor(s.backgroundColor);
    dstCtx.fillStyle = isLight ? '#111111' : '#ffffff';
    dstCtx.beginPath();
    for (let i = 0; i < dotCount; i++) {
      const r = dotR[i];
      if (r < 0.4) continue;
      dstCtx.moveTo(dotX[i] + r, dotY[i]);
      dstCtx.arc(dotX[i], dotY[i], r, 0, Math.PI * 2);
    }
    dstCtx.fill();

  } else {
    // ── Color: sort dots by bucket, draw batched paths ─────────────────────
    // Sort the index array by bucket (indirect sort via Int32Array indices)
    const indices = new Int32Array(dotCount);
    for (let i = 0; i < dotCount; i++) indices[i] = i;
    indices.sort((a, b) => dotBkt[a] - dotBkt[b]);

    let currentBucket = -2;
    let pathOpen = false;

    for (let ii = 0; ii < dotCount; ii++) {
      const i = indices[ii];
      const bkt = dotBkt[i];
      const r = dotR[i];

      if (bkt !== currentBucket) {
        if (pathOpen) dstCtx.fill();
        const [cr, cg, cb] = bucketToRGB(bkt);
        dstCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
        dstCtx.beginPath();
        currentBucket = bkt;
        pathOpen = true;
      }

      // Sub-pixel anti-aliasing: dots smaller than 1px fade via globalAlpha
      if (r < 1) {
        if (pathOpen) { dstCtx.fill(); pathOpen = false; }
        dstCtx.globalAlpha = r; // fade tiny dots
        dstCtx.beginPath();
        dstCtx.arc(dotX[i], dotY[i], 1, 0, Math.PI * 2);
        dstCtx.fill();
        dstCtx.globalAlpha = 1;
        currentBucket = -2; // force next dot to re-open path
        pathOpen = false;
      } else {
        dstCtx.moveTo(dotX[i] + r, dotY[i]);
        dstCtx.arc(dotX[i], dotY[i], r, 0, Math.PI * 2);
      }
    }

    if (pathOpen) dstCtx.fill();
    dstCtx.globalAlpha = 1;
  }

  return Math.round(performance.now() - t0);
}

// ─── Fast separable box blur ──────────────────────────────────────────────────
// Uses a sliding window sum — O(w*h) regardless of radius.

function fastBoxBlur(data: Uint8ClampedArray, w: number, h: number, r: number) {
  const tmp = new Uint8ClampedArray(data.length);

  // ── Horizontal pass ───────────────────────────────────────────────────────
  for (let y = 0; y < h; y++) {
    let sumR = 0, sumG = 0, sumB = 0;
    // Prime the window
    for (let dx = 0; dx <= r; dx++) {
      const px = Math.min(w - 1, dx);
      const pi = (y * w + px) * 4;
      sumR += data[pi]; sumG += data[pi+1]; sumB += data[pi+2];
    }
    for (let x = 0; x < w; x++) {
      const count = Math.min(x + r, w - 1) - Math.max(0, x - r) + 1;
      const oi = (y * w + x) * 4;
      tmp[oi] = sumR / count; tmp[oi+1] = sumG / count; tmp[oi+2] = sumB / count; tmp[oi+3] = data[oi+3];
      // Slide window: remove left edge, add right edge
      if (x - r >= 0) {
        const li = (y * w + (x - r)) * 4;
        sumR -= data[li]; sumG -= data[li+1]; sumB -= data[li+2];
      }
      if (x + r + 1 < w) {
        const ri = (y * w + (x + r + 1)) * 4;
        sumR += data[ri]; sumG += data[ri+1]; sumB += data[ri+2];
      }
    }
  }

  // ── Vertical pass ─────────────────────────────────────────────────────────
  for (let x = 0; x < w; x++) {
    let sumR = 0, sumG = 0, sumB = 0;
    for (let dy = 0; dy <= r; dy++) {
      const py = Math.min(h - 1, dy);
      const pi = (py * w + x) * 4;
      sumR += tmp[pi]; sumG += tmp[pi+1]; sumB += tmp[pi+2];
    }
    for (let y = 0; y < h; y++) {
      const count = Math.min(y + r, h - 1) - Math.max(0, y - r) + 1;
      const oi = (y * w + x) * 4;
      data[oi] = sumR / count; data[oi+1] = sumG / count; data[oi+2] = sumB / count;
      if (y - r >= 0) {
        const li = ((y - r) * w + x) * 4;
        sumR -= tmp[li]; sumG -= tmp[li+1]; sumB -= tmp[li+2];
      }
      if (y + r + 1 < h) {
        const ri = ((y + r + 1) * w + x) * 4;
        sumR += tmp[ri]; sumG += tmp[ri+1]; sumB += tmp[ri+2];
      }
    }
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function isLightColor(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return luma(r, g, b) > 0.5;
}
