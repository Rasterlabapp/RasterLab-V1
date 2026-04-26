// ─── Types ────────────────────────────────────────────────────────────────────

export interface PointillistSettings {
  dotSize: number;        // 1–20 base radius
  density: number;        // 1–100  (higher = more dots)
  randomness: number;     // 0–100  (jitter on dot position)
  contrast: number;       // -100 to 100
  brightness: number;     // -100 to 100
  edgeSensitivity: number;// 0–100  (boost dots on detected edges)
  smoothing: number;      // 0–100  (gaussian pre-blur on source)
  invert: boolean;
  colorMode: 'color' | 'monochrome';
  backgroundColor: string; // hex
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo = 0, hi = 255) {
  return Math.max(lo, Math.min(hi, v));
}

function toLinear(c: number) { return c / 255; }

/** Luminance from linear sRGB (ITU-R BT.709) */
function luminance(r: number, g: number, b: number) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Apply brightness+contrast to a single channel [0–255] */
function applyBC(v: number, brightness: number, contrast: number): number {
  const b = brightness * 2.55;
  const cFactor = contrast > 0
    ? (259 * (contrast + 255)) / (255 * (259 - contrast))
    : 1 + contrast / 100;
  return clamp(cFactor * (v + b - 128) + 128);
}

/** Very fast box-blur approximation used for smoothing */
function boxBlur(data: Uint8ClampedArray, w: number, h: number, radius: number) {
  if (radius < 1) return;
  const r = Math.ceil(radius);
  const tmp = new Uint8ClampedArray(data.length);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sr = 0, sg = 0, sb = 0, count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = clamp(x + dx, 0, w - 1);
        const i = (y * w + nx) * 4;
        sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
        count++;
      }
      const i = (y * w + x) * 4;
      tmp[i] = sr / count; tmp[i + 1] = sg / count; tmp[i + 2] = sb / count; tmp[i + 3] = data[i + 3];
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sr = 0, sg = 0, sb = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = clamp(y + dy, 0, h - 1);
        const i = (ny * w + x) * 4;
        sr += tmp[i]; sg += tmp[i + 1]; sb += tmp[i + 2];
        count++;
      }
      const i = (y * w + x) * 4;
      data[i] = sr / count; data[i + 1] = sg / count; data[i + 2] = sb / count;
    }
  }
}

/** Sobel edge magnitude at each pixel, returns 0–1 Float32Array */
function sobelEdges(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = (data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114) / 255;
  }

  const edges = new Float32Array(w * h);
  let maxMag = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y - 1) * w + (x - 1)];
      const tc = gray[(y - 1) * w + x];
      const tr = gray[(y - 1) * w + (x + 1)];
      const ml = gray[y * w + (x - 1)];
      const mr = gray[y * w + (x + 1)];
      const bl = gray[(y + 1) * w + (x - 1)];
      const bc = gray[(y + 1) * w + x];
      const br = gray[(y + 1) * w + (x + 1)];

      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const mag = Math.sqrt(gx * gx + gy * gy);
      edges[y * w + x] = mag;
      if (mag > maxMag) maxMag = mag;
    }
  }

  // Normalize
  if (maxMag > 0) {
    for (let i = 0; i < edges.length; i++) edges[i] /= maxMag;
  }
  return edges;
}

// ─── Core Render ─────────────────────────────────────────────────────────────

export function renderPointillist(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  s: PointillistSettings,
): number {
  const t0 = performance.now();

  const sw = src.width, sh = src.height;
  dst.width = sw; dst.height = sh;

  const dstCtx = dst.getContext('2d')!;

  // ── 1. Sample source with BC and optional smoothing ──────────────────────
  const workCanvas = document.createElement('canvas');
  workCanvas.width = sw; workCanvas.height = sh;
  const wCtx = workCanvas.getContext('2d')!;
  wCtx.drawImage(src, 0, 0);

  const imgData = wCtx.getImageData(0, 0, sw, sh);
  const pixels = imgData.data;

  // Apply brightness/contrast
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i]     = applyBC(pixels[i],     s.brightness, s.contrast);
    pixels[i + 1] = applyBC(pixels[i + 1], s.brightness, s.contrast);
    pixels[i + 2] = applyBC(pixels[i + 2], s.brightness, s.contrast);
  }

  // Smoothing (pre-blur source for sampling)
  const blurRadius = (s.smoothing / 100) * 6;
  if (blurRadius > 0.5) boxBlur(pixels, sw, sh, blurRadius);

  // ── 2. Edge map ─────────────────────────────────────────────────────────
  const edges = s.edgeSensitivity > 0 ? sobelEdges(pixels, sw, sh) : null;
  const edgeWeight = s.edgeSensitivity / 100;

  // ── 3. Build dot list ────────────────────────────────────────────────────
  const gridStep = Math.max(1, Math.round(20 * (1 - s.density / 100) + 2));
  const jitter = (s.randomness / 100) * gridStep * 0.9;
  const maxDot = s.dotSize;

  // Background
  dstCtx.fillStyle = s.backgroundColor;
  dstCtx.fillRect(0, 0, sw, sh);

  // We'll batch paths by color bucket for performance
  type DotCmd = { x: number; y: number; r: number; r255: number; g255: number; b255: number; a: number };
  const dots: DotCmd[] = [];

  for (let gy = 0; gy < sh; gy += gridStep) {
    for (let gx = 0; gx < sw; gx += gridStep) {
      // Jitter
      const jx = gx + (Math.random() - 0.5) * jitter * 2;
      const jy = gy + (Math.random() - 0.5) * jitter * 2;

      const sx = clamp(Math.round(jx), 0, sw - 1);
      const sy = clamp(Math.round(jy), 0, sh - 1);

      const idx = (sy * sw + sx) * 4;
      let pr = pixels[idx], pg = pixels[idx + 1], pb = pixels[idx + 2];

      let lum = luminance(pr, pg, pb);
      if (s.invert) lum = 1 - lum;

      // Darkness drives dot size: dark = big, light = small/none
      const darkness = 1 - lum;

      // Edge boost: edges get extra dot presence
      let edgeBoost = 0;
      if (edges) {
        const ei = sy * sw + sx;
        edgeBoost = edges[ei] * edgeWeight;
      }

      const dotStrength = Math.min(1, darkness + edgeBoost * 0.6);
      if (dotStrength < 0.05) continue; // skip near-white

      const r = dotStrength * maxDot;
      if (r < 0.4) continue;

      // Color or mono
      let dr = pr, dg = pg, db = pb;
      if (s.colorMode === 'monochrome') {
        const g = Math.round(0.299 * pr + 0.587 * pg + 0.114 * pb);
        dr = dg = db = g;
      }

      dots.push({ x: jx, y: jy, r, r255: dr, g255: dg, b255: db, a: 1 });
    }
  }

  // ── 4. Draw — group by color to minimize fillStyle switches ─────────────
  // For color mode, each dot is unique so we draw individually
  // For mono mode, we can batch by luminance bucket
  if (s.colorMode === 'monochrome') {
    dstCtx.fillStyle = '#ffffff';
    dstCtx.beginPath();
    for (const d of dots) {
      dstCtx.moveTo(d.x + d.r, d.y);
      dstCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    }
    dstCtx.fill();
  } else {
    // Color: use OffscreenCanvas trick — draw with alpha multiplied by darkness
    for (const d of dots) {
      dstCtx.fillStyle = `rgb(${d.r255},${d.g255},${d.b255})`;
      dstCtx.beginPath();
      dstCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      dstCtx.fill();
    }
  }

  return Math.round(performance.now() - t0);
}
