// ──────────────────────────────────────────────────────────────────────────────
// Noise Grid — structured cells filled with layered value noise
//
// Dark areas → cells nearly fully filled (dense).
// Light areas → cells mostly empty (sparse).
// noiseContrast sharpens or softens the fill threshold.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, valueNoise, clearWhite, clamp } from './utils';
import type { EngineRenderArgs } from './types';

export function renderNoiseGrid({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { noiseScale, noiseContrast, density, invert } = settings;

  const cell = Math.max(2, noiseScale);

  // Render pixel-level via ImageData for speed
  const out = ctx.createImageData(width, height);
  const d   = out.data;

  // contrast maps 0–100 → sharpness multiplier 0.5–8
  const sharpness = 0.5 + noiseContrast / 14;
  const biasK     = density / 100; // shifts fill probability

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const brightness = sampleBrightness(pixels, width, height, x, y);
      const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);

      // Sample multi-octave noise in cell coordinates
      const cx = x / cell;
      const cy = y / cell;
      const n  = valueNoise(cx, cy) * 0.5 +
                 valueNoise(cx * 2.1 + 3.7, cy * 2.1) * 0.3 +
                 valueNoise(cx * 4.3, cy * 4.3 + 1.1) * 0.2;

      // Fill threshold: dark area → high threshold → more cells filled
      const threshold = clamp(1 - darkness * biasK * 1.2, 0, 1);
      const filled    = sigmoidThreshold(n, threshold, sharpness);

      const v = filled ? 0 : 255;
      const i = (y * width + x) * 4;
      d[i]     = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
}

/** Smooth step threshold with adjustable sharpness */
function sigmoidThreshold(n: number, t: number, sharpness: number): boolean {
  // Sigmoid: probability of filling increases steeply around threshold
  const x = (n - t) * sharpness * 4;
  const sig = 1 / (1 + Math.exp(-x));
  return sig > 0.5;
}
