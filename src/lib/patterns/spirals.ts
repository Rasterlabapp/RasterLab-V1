// ──────────────────────────────────────────────────────────────────────────────
// Spirals — Archimedean spiral clusters mapped to image brightness
//
// Dark areas → large, tightly-wound spirals.
// Light areas → small or invisible spirals.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, clearWhite, clamp, seededRand } from './utils';
import type { EngineRenderArgs } from './types';

export function renderSpirals({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { spacing, radius, arms, wrap, direction, thickness, invert } = settings;

  ctx.strokeStyle = '#000000';
  ctx.lineCap     = 'round';
  ctx.lineWidth   = clamp(thickness * 0.7, 0.4, 4);

  const cols = Math.ceil(width  / spacing) + 1;
  const rows = Math.ceil(height / spacing) + 1;

  let seed = 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Center with slight jitter
      const jx = (seededRand(seed++) - 0.5) * spacing * 0.35;
      const jy = (seededRand(seed++) - 0.5) * spacing * 0.35;
      const cx = col * spacing + jx;
      const cy = row * spacing + jy;

      if (cx < -radius || cx > width + radius || cy < -radius || cy > height + radius) continue;

      const brightness = sampleBrightness(pixels, width, height, cx, cy);
      const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);
      if (darkness < 0.05) continue;

      const maxR = radius * darkness;
      if (maxR < 1.5) continue;

      // Direction per spiral: clockwise, counterclockwise, or seeded random
      let dir: number;
      if (direction === 'clockwise')        dir = 1;
      else if (direction === 'counterclockwise') dir = -1;
      else dir = seededRand(seed++) > 0.5 ? 1 : -1;

      for (let arm = 0; arm < arms; arm++) {
        const armOffset = (arm / arms) * Math.PI * 2;
        const steps     = Math.round(120 * wrap * (maxR / radius));

        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const t     = i / steps;
          const theta = dir * t * Math.PI * 2 * wrap + armOffset;
          const r     = t * maxR;
          const px    = cx + r * Math.cos(theta);
          const py    = cy + r * Math.sin(theta);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
  }
}
