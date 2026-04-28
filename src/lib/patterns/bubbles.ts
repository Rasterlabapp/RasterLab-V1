// ──────────────────────────────────────────────────────────────────────────────
// Bubbles — grid of circle outlines whose diameter tracks image darkness
//
// Dark areas → large circles packed tightly.
// Light areas → tiny circles (or absent).
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, clearWhite, clamp, seededRand } from './utils';
import type { EngineRenderArgs } from './types';

export function renderBubbles({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { bubbleSize, packing, randomness, thickness, invert } = settings;

  const gridStep = bubbleSize * 2 * (1 + (100 - packing) / 100);
  const jMax     = gridStep * 0.5 * (randomness / 100);

  const cols = Math.ceil(width  / gridStep) + 1;
  const rows = Math.ceil(height / gridStep) + 1;

  ctx.strokeStyle = '#000000';

  let seed = 99;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const jx = (seededRand(seed++) - 0.5) * 2 * jMax;
      const jy = (seededRand(seed++) - 0.5) * 2 * jMax;
      const cx = (col + 0.5) * gridStep + jx;
      const cy = (row + 0.5) * gridStep + jy;

      const brightness = sampleBrightness(pixels, width, height, cx, cy);
      const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);
      if (darkness < 0.04) continue;

      const r  = (bubbleSize * 0.5) * (0.08 + darkness * 0.92);
      if (r < 0.5) continue;

      ctx.lineWidth = clamp(thickness * (0.2 + darkness * 0.8), 0.3, thickness * 1.2);

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Inner fill for large dark bubbles — richer tones
      if (darkness > 0.65 && r > 3) {
        ctx.fillStyle = `rgba(0,0,0,${(darkness - 0.65) * 0.5})`;
        ctx.fill();
      }
    }
  }
}
