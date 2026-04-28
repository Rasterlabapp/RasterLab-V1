// ──────────────────────────────────────────────────────────────────────────────
// Spots — jittered grid of filled blobs scaled by image darkness
//
// Dark areas → large spots.  Light areas → tiny or invisible spots.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, clearWhite, clamp, seededRand } from './utils';
import type { EngineRenderArgs } from './types';

export function renderSpots({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { blobSize, spread, softness, density, invert } = settings;

  // Grid spacing derived from density + blobSize
  const gridSpacing = Math.max(blobSize * 1.1, lerp(blobSize * 3.5, blobSize * 1.2, density / 100));
  const cols        = Math.ceil(width  / gridSpacing) + 1;
  const rows        = Math.ceil(height / gridSpacing) + 1;
  const jitterMax   = gridSpacing * 0.5 * (spread / 100);

  let seed = 7;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const jx = (seededRand(seed++) - 0.5) * 2 * jitterMax;
      const jy = (seededRand(seed++) - 0.5) * 2 * jitterMax;
      const cx = (col + 0.5) * gridSpacing + jx;
      const cy = (row + 0.5) * gridSpacing + jy;

      const brightness = sampleBrightness(pixels, width, height, cx, cy);
      const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);
      if (darkness < 0.04) continue;

      const r = blobSize * (darkness * 0.85 + 0.15);
      if (r < 0.5) continue;

      if (softness > 2) {
        // Radial gradient for soft blobs
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        grd.addColorStop(0,                    'rgba(0,0,0,1)');
        grd.addColorStop(1 - softness / 120,   'rgba(0,0,0,0.9)');
        grd.addColorStop(1,                    'rgba(0,0,0,0)');
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = '#000000';
      }

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
