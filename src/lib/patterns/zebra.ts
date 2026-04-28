// ──────────────────────────────────────────────────────────────────────────────
// Zebra — luminosity-driven contour stripes rendered at pixel level
//
// The canvas is painted pixel-by-pixel: frac(luma × stripes) determines
// whether a pixel is black or white.  Bend distorts sampling coordinates
// to produce flowing, organic stripe shapes.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, clearWhite, clamp } from './utils';
import type { EngineRenderArgs } from './types';

export function renderZebra({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { stripeWidth, bend, contrast, invert } = settings;

  // stripeWidth 1–20 → numberOfStripes 3–60
  const numStripes = clamp(60 / stripeWidth, 3, 80);
  const bendAmt    = bend / 100;
  const contrastK  = 1 + contrast / 25;  // 1–5 gamma-like exaggeration
  const threshold  = 0.5; // stripe on/off split

  const out = ctx.createImageData(width, height);
  const d   = out.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Distort sampling coordinates with sine waves
      const sx = x + bendAmt * Math.sin(y * 0.04) * 20;
      const sy = y + bendAmt * Math.sin(x * 0.03) * 20;

      let brightness = sampleBrightness(pixels, width, height, sx, sy);
      if (invert) brightness = 1 - brightness;

      // Apply contrast exaggeration
      brightness = clamp(Math.pow(brightness, contrastK), 0, 1);

      // Stripe function: modular brightness
      const stripe = (brightness * numStripes) % 1;
      const black  = stripe < threshold ? 255 : 0;
      const i      = (y * width + x) * 4;

      d[i]     = 255 - black;
      d[i + 1] = 255 - black;
      d[i + 2] = 255 - black;
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(out, 0, 0);
}
