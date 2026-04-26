/**
 * renderer.ts
 *
 * Draws a Dot[] onto any Canvas 2D context (HTML or Offscreen).
 *
 * Colour path:
 *   - Samples dot colour from pre-built RGB SATs (O(1) per dot)
 *   - Quantises to 32-level palette per channel → sorts dots by palette bucket
 *   - Batch-fills all dots of the same colour in one beginPath/fill call
 *   - Minimises fillStyle reassignments → fast on all GPU-backed renderers
 *
 * Monochrome path:
 *   - Single colour, single beginPath → as fast as possible
 *
 * Sub-pixel dots (r < 1):
 *   - Drawn at r = 1 with globalAlpha = r for smooth anti-aliased fade
 */

import type { PointillistSettings } from './types';
import type { AnalysisMaps } from './edgeDetection';
import { satMean } from './edgeDetection';
import type { Dot } from './sampling';

// ─── Colour quantisation ──────────────────────────────────────────────────────

const BITS  = 5;                      // 32 levels per channel
const SHIFT = 8 - BITS;
const MASK  = (1 << BITS) - 1;

function quantize(r: number, g: number, b: number): number {
  return ((r >> SHIFT) << (BITS * 2)) | ((g >> SHIFT) << BITS) | (b >> SHIFT);
}

function bucketToRGB(bkt: number): [number, number, number] {
  const half = 1 << (SHIFT - 1);
  return [
    ((bkt >> (BITS * 2)) & MASK) * (1 << SHIFT) + half,
    ((bkt >>  BITS)      & MASK) * (1 << SHIFT) + half,
    ( bkt                & MASK) * (1 << SHIFT) + half,
  ];
}

// ─── Background helpers ───────────────────────────────────────────────────────

function isLightBg(bg: string): boolean {
  if (!bg.startsWith('#') || bg === 'transparent') return false;
  const r = parseInt(bg.slice(1, 3), 16) || 0;
  const g = parseInt(bg.slice(3, 5), 16) || 0;
  const b = parseInt(bg.slice(5, 7), 16) || 0;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
}

// ─── Public entry point ───────────────────────────────────────────────────────

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Fills background then draws all dots onto `ctx`.
 * Anti-aliased circles via ctx.arc() — the browser/GPU handles AA.
 * Sub-pixel dots use globalAlpha for smooth fade.
 */
export function renderDots(
  dots:     Dot[],
  maps:     AnalysisMaps,
  ctx:      Ctx,
  sw:       number,
  sh:       number,
  settings: PointillistSettings,
): void {
  const { rSAT, gSAT, bSAT, aw, ah } = maps;
  const isColor = settings.colorMode === 'color';
  const TWO_PI  = Math.PI * 2;

  // ── Background ─────────────────────────────────────────────────────────────
  if (settings.backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, sw, sh);
  } else {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, sw, sh);
  }

  if (dots.length === 0) return;

  // ── SAT colour sampler ─────────────────────────────────────────────────────
  // Sample a 4×4 analysis-pixel window around each dot position
  const HALF = 2;
  const sampleColor = (ax: number, ay: number): [number, number, number] => [
    Math.round(satMean(rSAT, aw, ah, ax - HALF, ay - HALF, ax + HALF, ay + HALF)),
    Math.round(satMean(gSAT, aw, ah, ax - HALF, ay - HALF, ax + HALF, ay + HALF)),
    Math.round(satMean(bSAT, aw, ah, ax - HALF, ay - HALF, ax + HALF, ay + HALF)),
  ];

  // ── Monochrome fast path ───────────────────────────────────────────────────
  if (!isColor) {
    const fg = isLightBg(settings.backgroundColor) ? '#111111' : '#ffffff';
    ctx.fillStyle = fg;
    ctx.beginPath();

    for (const d of dots) {
      if (d.r < 0.25) continue;
      if (d.r < 1) {
        // flush current path, draw sub-pixel dot with alpha
        ctx.fill();
        ctx.globalAlpha = Math.max(0.1, d.r);
        ctx.beginPath();
        ctx.arc(d.x, d.y, 1, 0, TWO_PI);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = fg;
        ctx.beginPath();
      } else {
        ctx.moveTo(d.x + d.r, d.y);
        ctx.arc(d.x, d.y, d.r, 0, TWO_PI);
      }
    }
    ctx.fill();
    return;
  }

  // ── Colour path — batch by quantised palette bucket ────────────────────────

  // 1. Assign colour bucket to every dot (pass-1 structural dots first so they
  //    paint below pass-2 edge dots for correct layering)
  const n       = dots.length;
  const buckets = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const d       = dots[i];
    const [r,g,b] = sampleColor(d.ax, d.ay);
    buckets[i]    = quantize(r, g, b);
  }

  // 2. Sort by bucket (pass 0 then pass 1 within each bucket for layering)
  const order = new Int32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  // Composite sort key: bucket << 1 | pass
  order.sort((a, b) => {
    const ka = (buckets[a] << 1) | dots[a].pass;
    const kb = (buckets[b] << 1) | dots[b].pass;
    return ka - kb;
  });

  // 3. Draw batched arcs
  let currentBucket = -1;
  let pathOpen      = false;

  for (let ii = 0; ii < n; ii++) {
    const i   = order[ii];
    const d   = dots[i];
    const bkt = buckets[i];

    // Sub-pixel: flush, draw individually with alpha, continue
    if (d.r < 1) {
      if (pathOpen) { ctx.fill(); pathOpen = false; currentBucket = -1; }
      const [cr, cg, cb] = bucketToRGB(bkt);
      ctx.globalAlpha = Math.max(0.1, d.r);
      ctx.fillStyle   = `rgb(${cr},${cg},${cb})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1, 0, TWO_PI);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    // Switch colour bucket → flush and start new path
    if (bkt !== currentBucket) {
      if (pathOpen) ctx.fill();
      const [cr, cg, cb] = bucketToRGB(bkt);
      ctx.fillStyle   = `rgb(${cr},${cg},${cb})`;
      ctx.beginPath();
      currentBucket = bkt;
      pathOpen      = true;
    }

    ctx.moveTo(d.x + d.r, d.y);
    ctx.arc(d.x, d.y, d.r, 0, TWO_PI);
  }

  if (pathOpen) ctx.fill();
  ctx.globalAlpha = 1;
}
