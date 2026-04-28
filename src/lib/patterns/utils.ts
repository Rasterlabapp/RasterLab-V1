// ──────────────────────────────────────────────────────────────────────────────
// Pattern Engines — shared utilities
// ──────────────────────────────────────────────────────────────────────────────

/** Sample luminance at (x, y) with bilinear interpolation.  Returns 0–1. */
export function sampleBrightness(
  pixels: Uint8ClampedArray,
  width:  number,
  height: number,
  x:      number,
  y:      number,
): number {
  const x0 = Math.max(0, Math.min(width  - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.min(width  - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;

  const idx = (row: number, col: number) => (row * width + col) * 4;
  const lum = (i: number) =>
    (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;

  const tl = lum(idx(y0, x0));
  const tr = lum(idx(y0, x1));
  const bl = lum(idx(y1, x0));
  const br = lum(idx(y1, x1));

  return tl + (tr - tl) * fx + (bl - tl) * fy + (tl - tr - bl + br) * fx * fy;
}

/** clamp n to [lo, hi] */
export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/** Simple hash-based smooth value noise — no external dependency. */
function hash2(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}
function smoothstep(t: number) { return t * t * (3 - 2 * t); }

export function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = smoothstep(fx), uy = smoothstep(fy);
  const a = hash2(ix,     iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix,     iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (d - a + a - b - c + b + c - d) * ux * uy;
}

/** Fractional Brownian Motion — 3 octaves. */
export function fbm(x: number, y: number): number {
  return (
    valueNoise(x,       y      ) * 0.5  +
    valueNoise(x * 2,   y * 2  ) * 0.25 +
    valueNoise(x * 4,   y * 4  ) * 0.125
  );
}

/** Fill canvas with white. */
export function clearWhite(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  w: number,
  h: number,
) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
}

/** Remap t in [0,1]: t=0 → lo, t=1 → hi */
export function lerp(lo: number, hi: number, t: number): number {
  return lo + (hi - lo) * t;
}

/** Random float in [0, 1) from a seed. Cheap but non-zero variance. */
export function seededRand(seed: number): number {
  const s = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (s >>> 0) / 0xffffffff;
}
