// ──────────────────────────────────────────────────────────────────────────────
// Worms — organic random-walk agents guided by image darkness
//
// Dark areas → dense worm coverage, longer trails.
// Light areas → sparse or absent worms.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, valueNoise, clearWhite, clamp, seededRand } from './utils';
import type { EngineRenderArgs } from './types';

export function renderWorms({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { density, length, thickness, motionCurve, invert } = settings;

  const agentCount = Math.round(lerp(30, 600, density / 100));
  const maxSteps   = Math.round(length);
  const stepSize   = 2.5;
  const maxTurn    = (motionCurve / 100) * 0.6; // radians per step

  ctx.strokeStyle = '#000000';
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  let seed = 42;

  for (let a = 0; a < agentCount; a++) {
    // Spawn position — biased toward dark areas via rejection sampling
    let sx = 0, sy = 0, spawned = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      const tx = seededRand(seed++) * width;
      const ty = seededRand(seed++) * height;
      const b  = sampleBrightness(pixels, width, height, tx, ty);
      const d  = invert ? b : (1 - b);
      if (d > seededRand(seed++)) { sx = tx; sy = ty; spawned = true; break; }
    }
    if (!spawned) { sx = seededRand(seed++) * width; sy = seededRand(seed++) * height; }

    let x   = sx;
    let y   = sy;
    let ang = seededRand(seed++) * Math.PI * 2;

    const brightness = sampleBrightness(pixels, width, height, x, y);
    const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);

    const lw = clamp(thickness * (0.2 + darkness * 0.8), 0.3, thickness * 1.4);
    const steps = Math.round(maxSteps * (0.4 + darkness * 0.6));

    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x, y);

    for (let s = 0; s < steps; s++) {
      // Flow field angle from noise
      const noiseAng = valueNoise(x * 0.008 + a, y * 0.008) * Math.PI * 2;
      const turnBias = (noiseAng - ang) * 0.15;
      const randTurn = (seededRand(seed++) - 0.5) * 2 * maxTurn;
      ang += clamp(turnBias + randTurn, -maxTurn * 1.5, maxTurn * 1.5);

      x += Math.cos(ang) * stepSize;
      y += Math.sin(ang) * stepSize;

      if (x < 0 || x > width || y < 0 || y > height) break;

      ctx.lineTo(x, y);

      // Fade out in bright areas
      const b2 = sampleBrightness(pixels, width, height, x, y);
      const d2 = invert ? b2 : (1 - b2);
      if (d2 < 0.08 && seededRand(seed++) > d2 * 4) break;
    }

    ctx.stroke();
  }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
