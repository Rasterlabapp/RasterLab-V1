/**
 * pointillist-engine.ts — public API surface
 *
 * Orchestrates the three modular sub-systems:
 *   edgeDetection → buildAnalysisMaps()   (luminance + edge maps + SATs)
 *   sampling      → generateDots()         (Poisson disk, two passes)
 *   renderer      → renderDots()           (batched anti-aliased arcs)
 *
 * The public signatures below are intentionally unchanged so the Web Worker,
 * the renderer hook, the export tab, and the main-thread fallback all keep
 * working without modification.
 */

export type { PointillistSettings } from './pointillist/types';
export { DEFAULT_POINTILLIST }      from './pointillist/types';

import type { PointillistSettings } from './pointillist/types';
import { buildAnalysisMaps }        from './pointillist/edgeDetection';
import { generateDots }             from './pointillist/sampling';
import { renderDots }               from './pointillist/renderer';

// ─── Core render (DOM-free — works in Worker + main thread) ──────────────────
/**
 * Accepts a mutable copy of RGBA pixels and any Canvas 2D context
 * (HTMLCanvasElement or OffscreenCanvas).  Returns elapsed milliseconds.
 *
 * Pipeline:
 *   1. buildAnalysisMaps  — BC/blur, downscale, edge detection, SAT build
 *   2. generateDots       — two-pass Poisson disk sampling
 *   3. renderDots         — colour-batched arc drawing
 */
export function renderPointillistCore(
  pixels: Uint8ClampedArray,
  sw:     number,
  sh:     number,
  s:      PointillistSettings,
  dstCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
): number {
  const t0   = performance.now();
  const maps = buildAnalysisMaps(pixels, sw, sh, s);
  const dots = generateDots(sw, sh, maps, s);
  renderDots(dots, maps, dstCtx, sw, sh, s);
  return Math.round(performance.now() - t0);
}

// ─── Main-thread convenience wrapper ─────────────────────────────────────────
/**
 * Extracts pixels from `src`, sizes `dst` to match, runs core engine.
 * Used by: export tab (direct render at 1× or 2× scale).
 */
export function renderPointillist(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  s:   PointillistSettings,
): number {
  const pixels = extractPixels(src);
  dst.width  = src.width;
  dst.height = src.height;
  return renderPointillistCore(pixels, src.width, src.height, s, dst.getContext('2d')!);
}

/**
 * Returns a fresh mutable copy of RGBA pixels — safe to transfer to a Worker.
 */
export function extractPixels(canvas: HTMLCanvasElement): Uint8ClampedArray {
  return new Uint8ClampedArray(
    canvas.getContext('2d')!
      .getImageData(0, 0, canvas.width, canvas.height)
      .data.buffer,
  );
}
