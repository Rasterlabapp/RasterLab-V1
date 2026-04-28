// ──────────────────────────────────────────────────────────────────────────────
// Serpentines — brightness-modulated flowing wavy lines
//
// Dark areas → higher amplitude waves (lines bunch closer), thicker strokes.
// Light areas → flatter, finer lines.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, valueNoise, clearWhite, clamp } from './utils';
import type { EngineRenderArgs } from './types';

export function renderSerpentines({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { density, flow, thickness, turbulence, scale, invert } = settings;

  // Number of horizontal flow lines
  const lineCount = Math.max(4, Math.round(height * density / 100 * 0.6));
  const spacing   = height / lineCount;

  // Wave parameters
  const maxAmp  = spacing * 0.55 * (flow / 100);
  const freqBase = 0.008 * scale;
  const noiseStr = turbulence / 100;

  ctx.strokeStyle = '#000000';
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  for (let li = 0; li < lineCount; li++) {
    const yBase = (li + 0.5) * spacing;

    // Compute per-line average darkness to set stroke width
    let avgDark = 0;
    const samples = 12;
    for (let si = 0; si < samples; si++) {
      const sx = (si / samples) * width;
      const b  = sampleBrightness(pixels, width, height, sx, yBase);
      avgDark  += invert ? b : (1 - b);
    }
    avgDark /= samples;

    const lw = clamp(thickness * (0.15 + avgDark * 0.85), 0.3, thickness * 1.2);
    ctx.lineWidth = lw;

    ctx.beginPath();
    let started = false;

    for (let x = 0; x <= width; x += 1.5) {
      const brightness = sampleBrightness(pixels, width, height, x, yBase);
      const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);

      // Noise phase offset
      const nPhase = valueNoise(x * 0.004 * turbulence + li * 0.7, li * 0.3) * noiseStr * Math.PI * 2;

      // Primary sine + noise-driven secondary wave
      const amp = maxAmp * (0.1 + darkness * 0.9);
      const y   = yBase
        + amp * Math.sin(x * freqBase + li * 1.2 + nPhase)
        + amp * 0.3 * Math.sin(x * freqBase * 2.3 + nPhase * 0.7);

      if (!started) { ctx.moveTo(x, y); started = true; }
      else           { ctx.lineTo(x, y); }
    }

    ctx.stroke();
  }
}
