// ──────────────────────────────────────────────────────────────────────────────
// Maze — recursive backtracker labyrinth whose wall density follows image luma
//
// Dark areas → thick walls, narrow passages (dense maze).
// Light areas → thin walls, open passages.
// ──────────────────────────────────────────────────────────────────────────────

import { sampleBrightness, clearWhite, clamp } from './utils';
import type { EngineRenderArgs } from './types';

export function renderMaze({
  ctx, pixels, width, height, settings,
}: EngineRenderArgs): void {
  clearWhite(ctx, width, height);

  const { pathWidth, complexity, sharpness, invert } = settings;

  // Cell size driven by complexity (1→large cells, 100→tiny cells)
  const cellSize = Math.max(6, Math.round(lerp(40, 8, complexity / 100)));
  const cols     = Math.ceil(width  / cellSize);
  const rows     = Math.ceil(height / cellSize);

  // Build visited grid + wall data using recursive backtracker
  const visited  = new Uint8Array(cols * rows);
  // Each cell stores which walls are REMOVED (open): bit0=N, bit1=E, bit2=S, bit3=W
  const walls    = new Uint8Array(cols * rows); // 0 = all walls present

  const idx = (c: number, r: number) => r * cols + c;

  const stack: number[] = [];
  const startIdx = 0;
  visited[startIdx] = 1;
  stack.push(startIdx);

  const DIRS = [
    { dc:  0, dr: -1, bit: 0, opp: 2 }, // N
    { dc:  1, dr:  0, bit: 1, opp: 3 }, // E
    { dc:  0, dr:  1, bit: 2, opp: 0 }, // S
    { dc: -1, dr:  0, bit: 3, opp: 1 }, // W
  ];

  let iter = 0;
  const maxIter = cols * rows * 8;

  while (stack.length && iter++ < maxIter) {
    const top  = stack[stack.length - 1];
    const tc   = top % cols;
    const tr   = Math.floor(top / cols);

    // Shuffle directions using index-based pseudo-random
    const order = [0, 1, 2, 3].sort((a, b) => {
      const ha = Math.sin(top * 4 + a) * 9301;
      const hb = Math.sin(top * 4 + b) * 9301;
      return (ha - Math.floor(ha)) - (hb - Math.floor(hb));
    });

    let moved = false;
    for (const di of order) {
      const d   = DIRS[di];
      const nc  = tc + d.dc;
      const nr  = tr + d.dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const ni = idx(nc, nr);
      if (visited[ni]) continue;

      // Carve wall
      walls[top] |= (1 << d.bit);
      walls[ni]  |= (1 << d.opp);
      visited[ni] = 1;
      stack.push(ni);
      moved = true;
      break;
    }
    if (!moved) stack.pop();
  }

  // Draw walls
  ctx.strokeStyle = '#000000';
  ctx.lineCap     = 'square';

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0  = c * cellSize;
      const y0  = r * cellSize;
      const x1  = x0 + cellSize;
      const y1  = y0 + cellSize;
      const cx  = x0 + cellSize * 0.5;
      const cy  = y0 + cellSize * 0.5;

      const brightness = sampleBrightness(pixels, width, height, cx, cy);
      const darkness   = clamp(invert ? brightness : (1 - brightness), 0, 1);

      // Snap with sharpness
      const snapped = darkness > clamp(0.5 - sharpness / 200, 0.1, 0.9)
        ? darkness
        : darkness * (1 - sharpness / 100);

      const lw = clamp(pathWidth * (0.1 + snapped * 0.9), 0.4, pathWidth);
      ctx.lineWidth = lw;

      const cell = walls[idx(c, r)];

      ctx.beginPath();
      // North wall
      if (!(cell & 1)) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); }
      // East wall
      if (!(cell & 2)) { ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); }
      // South wall (only if last row — prevent double-draw)
      if (r === rows - 1) { ctx.moveTo(x0, y1); ctx.lineTo(x1, y1); }
      // West wall (only if first col)
      if (c === 0) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); }

      ctx.stroke();
    }
  }
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
