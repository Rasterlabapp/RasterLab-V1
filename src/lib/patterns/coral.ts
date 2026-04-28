// ──────────────────────────────────────────────────────────────────────────────
// Coral — recursive branching structures seeded at image dark zones
//
// Dark areas → deep branching, thick trunks.
// Light areas → branches fade out early.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, valueNoise, clearWhite, clamp, seededRand } from './utils';
import type { EngineRenderArgs } from './types';

interface Branch {
  x:     number;
  y:     number;
  angle: number;
  depth: number;
  width: number;
}

export function renderCoral({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { branching, spread2, thickness, density, invert } = settings;

  const maxDepth   = Math.round(lerp(2, 7, branching / 7));
  const branchFan  = (spread2 / 100) * Math.PI * 0.6 + 0.15;
  const seedCount  = Math.max(2, Math.round(lerp(3, 18, density / 100)));
  const stepBase   = Math.min(width, height) * 0.06;

  ctx.strokeStyle = '#000000';
  ctx.lineCap     = 'round';

  let seed = 13;

  // Stack-based DFS — avoids call-stack overflow on large canvases
  const drawBranch = (startX: number, startY: number, startAngle: number) => {
    const stack: Branch[] = [{ x: startX, y: startY, angle: startAngle, depth: 0, width: thickness }];

    while (stack.length) {
      const { x, y, angle, depth, width: lw } = stack.pop()!;

      if (depth > maxDepth) continue;

      const brightness = sampleBrightness(pixels, width, height, x, y);
      const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);
      if (darkness < 0.05 && depth > 0) continue;

      const stepLen = stepBase * (1 - depth / (maxDepth + 1)) * (0.6 + darkness * 0.4);
      // Noise-driven drift
      const drift   = (valueNoise(x * 0.01, y * 0.01) - 0.5) * 0.4;
      const newAng  = angle + drift;

      const nx = x + Math.cos(newAng) * stepLen;
      const ny = y + Math.sin(newAng) * stepLen;

      ctx.lineWidth = clamp(lw, 0.3, thickness * 1.5);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(nx, ny);
      ctx.stroke();

      if (depth < maxDepth && darkness > 0.12) {
        const childW = lw * 0.62;
        // Number of children: 2 always, plus more based on darkness & branching
        const childCount = 2 + Math.floor(darkness * (branching / 7) * 2);
        for (let c = 0; c < Math.min(childCount, 4); c++) {
          const spread = (c / (childCount - 1 || 1) - 0.5) * branchFan * 2;
          const jitter = (seededRand(seed++) - 0.5) * 0.3;
          stack.push({
            x: nx, y: ny,
            angle: newAng + spread + jitter,
            depth: depth + 1,
            width: childW,
          });
        }
      }
    }
  };

  // Seed points — base of each coral, near image dark zones
  for (let si = 0; si < seedCount; si++) {
    // Rejection-sample for dark spawn
    let sx = 0, sy = 0;
    for (let att = 0; att < 12; att++) {
      const tx = seededRand(seed++) * width;
      const ty = seededRand(seed++) * height;
      const b  = sampleBrightness(pixels, width, height, tx, ty);
      const d  = invert ? b : (1 - b);
      if (d > 0.3) { sx = tx; sy = ty; break; }
    }
    const upAng = -Math.PI / 2 + (seededRand(seed++) - 0.5) * 0.8;
    drawBranch(sx, sy, upAng);
  }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
