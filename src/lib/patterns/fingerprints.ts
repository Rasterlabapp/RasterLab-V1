// ──────────────────────────────────────────────────────────────────────────────
// Fingerprints — concentric ridge lines distorted by image gradients
//
// Dark areas → tightly spaced, thick ridges.
// Light areas → wide spacing, thin lines.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, fbm, clearWhite, clamp } from './utils';
import type { EngineRenderArgs } from './types';

export function renderFingerprints({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { ringSpacing, distortion, thickness, density, invert } = settings;

  // Number of ridge centers — driven by density
  const centers = Math.max(1, Math.round(lerp(2, 14, density / 100)));
  const dist    = distortion / 100;

  ctx.strokeStyle = '#000000';
  ctx.lineCap     = 'round';

  // Distribute centers across the canvas
  for (let ci = 0; ci < centers; ci++) {
    // Place center at a point biased toward image centroid
    const angle  = (ci / centers) * Math.PI * 2;
    const spread = Math.min(width, height) * 0.33;
    const cx     = width  * 0.5 + Math.cos(angle) * spread * (0.2 + (ci % 3) * 0.25);
    const cy     = height * 0.5 + Math.sin(angle) * spread * (0.2 + ((ci + 1) % 3) * 0.25);
    const maxR   = Math.max(width, height) * 0.7;

    for (let r = ringSpacing; r < maxR; r += ringSpacing) {
      const steps = Math.max(12, Math.round(r * Math.PI * 2 / 1.5));
      ctx.beginPath();
      let started = false;

      for (let si = 0; si <= steps; si++) {
        const theta  = (si / steps) * Math.PI * 2;
        const px0    = cx + r * Math.cos(theta);
        const py0    = cy + r * Math.sin(theta);

        if (px0 < -maxR || px0 > width + maxR || py0 < -maxR || py0 > height + maxR) {
          if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
          continue;
        }

        // Distort position with FBM noise
        const nx = fbm(px0 * 0.006, py0 * 0.006) * 2 - 1;
        const ny = fbm(px0 * 0.006 + 5.2, py0 * 0.006 + 1.3) * 2 - 1;
        const px = clamp(px0 + nx * r * 0.4 * dist, -10, width + 10);
        const py = clamp(py0 + ny * r * 0.4 * dist, -10, height + 10);

        if (px < 0 || px > width || py < 0 || py > height) {
          if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
          continue;
        }

        const brightness = sampleBrightness(pixels, width, height, px, py);
        const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);

        if (darkness < 0.06) {
          if (started) { ctx.stroke(); ctx.beginPath(); started = false; }
          continue;
        }

        const lw = clamp(thickness * (0.15 + darkness * 0.85), 0.25, thickness * 1.3);
        ctx.lineWidth = lw;

        if (!started) { ctx.moveTo(px, py); started = true; }
        else           { ctx.lineTo(px, py); }
      }
      if (started) ctx.stroke();
    }
  }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
