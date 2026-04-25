import type { HalftoneSettings, CMYKChannel, CMYKAngles } from '@/types';

// ─── Color Utilities ──────────────────────────────────────────────────────────

function rgbToCmyk(r: number, g: number, b: number) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const k = 1 - Math.max(rn, gn, bn);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 1 };
  return {
    c: (1 - rn - k) / (1 - k),
    m: (1 - gn - k) / (1 - k),
    y: (1 - bn - k) / (1 - k),
    k,
  };
}

function toGray(r: number, g: number, b: number) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ─── Canvas Helpers ───────────────────────────────────────────────────────────

function applyBrightnessContrast(
  data: Uint8ClampedArray,
  brightness: number,
  contrast: number,
) {
  const b = brightness * 2.55;
  const c = contrast > 0 ? (1 + contrast / 100) : (1 + contrast / 100);
  const factor = (259 * (c * 100 + 255)) / (255 * (259 - c * 100));
  for (let i = 0; i < data.length; i += 4) {
    for (let ch = 0; ch < 3; ch++) {
      data[i + ch] = Math.min(255, Math.max(0, factor * (data[i + ch] + b - 128) + 128));
    }
  }
}

function gaussianBlur(ctx: CanvasRenderingContext2D, w: number, h: number, radius: number) {
  if (radius <= 0) return;
  ctx.filter = `blur(${radius}px)`;
  const tmp = ctx.getImageData(0, 0, w, h);
  ctx.putImageData(tmp, 0, 0);
  ctx.filter = 'none';
}

// ─── Halftone Rendering ───────────────────────────────────────────────────────

function renderHalftoneChannel(
  srcCanvas: HTMLCanvasElement,
  dstCanvas: HTMLCanvasElement,
  settings: HalftoneSettings,
  channelGetter: (r: number, g: number, b: number) => number,
  angle: number,
  color: string,
) {
  const w = srcCanvas.width, h = srcCanvas.height;
  dstCanvas.width = w;
  dstCanvas.height = h;

  const srcCtx = srcCanvas.getContext('2d')!;
  const dstCtx = dstCanvas.getContext('2d')!;

  const imgData = srcCtx.getImageData(0, 0, w, h);
  applyBrightnessContrast(imgData.data, settings.brightness, settings.contrast);

  // work canvas for reading pixels
  const workCanvas = document.createElement('canvas');
  workCanvas.width = w; workCanvas.height = h;
  const workCtx = workCanvas.getContext('2d')!;
  workCtx.putImageData(imgData, 0, 0);

  const cell = Math.max(2, Math.round(72 / settings.frequency));
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);

  dstCtx.fillStyle = '#fff';
  dstCtx.fillRect(0, 0, w, h);
  dstCtx.fillStyle = color;

  const diag = Math.sqrt(w * w + h * h);
  const cx = w / 2, cy = h / 2;

  for (let gx = -diag; gx < diag; gx += cell) {
    for (let gy = -diag; gy < diag; gy += cell) {
      const worldX = cx + gx * cos - gy * sin;
      const worldY = cy + gx * sin + gy * cos;

      if (worldX < 0 || worldX >= w || worldY < 0 || worldY >= h) continue;

      const px = Math.floor(worldX), py = Math.floor(worldY);
      if (px < 0 || px >= w || py < 0 || py >= h) continue;

      const idx = (py * w + px) * 4;
      const d = imgData.data;
      const v = channelGetter(d[idx], d[idx + 1], d[idx + 2]);
      const density = 1 - v;
      const maxR = (cell / 2) * settings.dotSize;
      const r = Math.sqrt(density) * maxR;

      if (r < 0.5) continue;

      const localX = cx + gx * cos - gy * sin;
      const localY = cy + gx * sin + gy * cos;

      drawShape(dstCtx, settings.mode, localX, localY, r, cell, angle);
    }
  }

  if (settings.cleanRadius > 0) {
    cleanFilter(dstCanvas, settings.cleanRadius);
  }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  mode: HalftoneSettings['mode'],
  x: number, y: number, r: number, cell: number, angle: number,
) {
  ctx.save();
  ctx.translate(x, y);

  switch (mode) {
    case 'dots':
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'lines': {
      const hw = Math.min(r, cell / 2);
      ctx.fillRect(-cell / 2, -hw, cell, hw * 2);
      break;
    }

    case 'crosshatch': {
      const hw = Math.min(r * 0.4, cell / 4);
      ctx.fillRect(-cell / 2, -hw, cell, hw * 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-cell / 2, -hw, cell, hw * 2);
      break;
    }

    case 'diamond': {
      const s = r * 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s, 0);
      ctx.lineTo(0, s);
      ctx.lineTo(-s, 0);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'square': {
      const s = r * 1.1;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      break;
    }

    case 'stochastic': {
      if (Math.random() < r / (cell / 2)) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(1, r * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'pattern': {
      const sides = 6;
      ctx.beginPath();
      for (let i = 0; i < sides; i++) {
        const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
        i === 0
          ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
          : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
  ctx.restore();
}

// ─── Clean Filter ─────────────────────────────────────────────────────────────

function cleanFilter(canvas: HTMLCanvasElement, radius: number) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;
  const out = new Uint8ClampedArray(data);
  const r = Math.floor(radius);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const isDark = data[idx] < 128;
      if (!isDark) continue;

      let neighborCount = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            if (data[(ny * w + nx) * 4] < 128) neighborCount++;
          }
        }
      }
      const area = (2 * r + 1) ** 2 - 1;
      if (neighborCount < area * 0.15) {
        out[idx] = out[idx + 1] = out[idx + 2] = 255;
      }
    }
  }
  img.data.set(out);
  ctx.putImageData(img, 0, 0);
}

// ─── SVG Export ───────────────────────────────────────────────────────────────

export function generateSVG(
  srcCanvas: HTMLCanvasElement,
  settings: HalftoneSettings,
): string {
  const w = srcCanvas.width, h = srcCanvas.height;
  const srcCtx = srcCanvas.getContext('2d')!;
  const imgData = srcCtx.getImageData(0, 0, w, h);
  applyBrightnessContrast(imgData.data, settings.brightness, settings.contrast);

  const cell = Math.max(2, Math.round(72 / settings.frequency));
  const angle = settings.angle;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const diag = Math.sqrt(w * w + h * h);
  const cx = w / 2, cy = h / 2;

  const shapes: string[] = [];

  for (let gx = -diag; gx < diag; gx += cell) {
    for (let gy = -diag; gy < diag; gy += cell) {
      const worldX = cx + gx * cos - gy * sin;
      const worldY = cy + gx * sin + gy * cos;
      if (worldX < 0 || worldX >= w || worldY < 0 || worldY >= h) continue;

      const px = Math.floor(worldX), py = Math.floor(worldY);
      const idx = (py * w + px) * 4;
      const d = imgData.data;
      const v = toGray(d[idx], d[idx + 1], d[idx + 2]) / 255;
      const density = 1 - v;
      const maxR = (cell / 2) * settings.dotSize;
      const r = Math.sqrt(density) * maxR;
      if (r < 0.5) continue;

      shapes.push(svgShape(settings.mode, worldX, worldY, r, cell));
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="white"/>
  <g fill="black">
    ${shapes.join('\n    ')}
  </g>
</svg>`;
}

function svgShape(mode: HalftoneSettings['mode'], x: number, y: number, r: number, cell: number): string {
  switch (mode) {
    case 'dots':
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"/>`;
    case 'lines': {
      const hw = Math.min(r, cell / 2);
      return `<rect x="${(x - cell / 2).toFixed(2)}" y="${(y - hw).toFixed(2)}" width="${cell}" height="${(hw * 2).toFixed(2)}"/>`;
    }
    case 'diamond': {
      const s = r * 1.2;
      return `<polygon points="${x},${y - s} ${x + s},${y} ${x},${y + s} ${x - s},${y}"/>`;
    }
    case 'square': {
      const s = r * 1.1;
      return `<rect x="${(x - s).toFixed(2)}" y="${(y - s).toFixed(2)}" width="${(s * 2).toFixed(2)}" height="${(s * 2).toFixed(2)}"/>`;
    }
    default:
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}"/>`;
  }
}

// ─── Main Public API ──────────────────────────────────────────────────────────

export function renderHalftone(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  settings: HalftoneSettings,
): number {
  const t0 = performance.now();

  if (!settings.cmykMode) {
    renderHalftoneChannel(
      src, dst, settings,
      (r, g, b) => toGray(r, g, b) / 255,
      settings.angle,
      '#000',
    );
  } else {
    renderCMYK(src, dst, settings);
  }

  return Math.round(performance.now() - t0);
}

function renderCMYK(
  src: HTMLCanvasElement,
  dst: HTMLCanvasElement,
  settings: HalftoneSettings,
) {
  const w = src.width, h = src.height;
  dst.width = w; dst.height = h;
  const dstCtx = dst.getContext('2d')!;
  dstCtx.fillStyle = '#fff';
  dstCtx.fillRect(0, 0, w, h);

  const channels: Array<{ key: CMYKChannel; getter: (r: number, g: number, b: number) => number; color: string }> = [
    { key: 'C', getter: (r, g, b) => rgbToCmyk(r, g, b).c, color: '#00FFFF' },
    { key: 'M', getter: (r, g, b) => rgbToCmyk(r, g, b).m, color: '#FF00FF' },
    { key: 'Y', getter: (r, g, b) => rgbToCmyk(r, g, b).y, color: '#FFFF00' },
    { key: 'K', getter: (r, g, b) => rgbToCmyk(r, g, b).k, color: '#000000' },
  ];

  const active = settings.activeChannel;

  if (active !== 'composite') {
    const ch = channels.find(c => c.key === active)!;
    const tmpCanvas = document.createElement('canvas');
    renderHalftoneChannel(src, tmpCanvas, settings, ch.getter, settings.cmykAngles[active as keyof CMYKAngles], '#000');
    dstCtx.drawImage(tmpCanvas, 0, 0);
    return;
  }

  dstCtx.globalCompositeOperation = 'multiply';

  for (const ch of channels) {
    if (!settings.visibleChannels[ch.key]) continue;
    const tmpCanvas = document.createElement('canvas');
    renderHalftoneChannel(
      src, tmpCanvas, settings,
      ch.getter,
      settings.cmykAngles[ch.key as keyof CMYKAngles],
      ch.color,
    );
    const tmpCtx = tmpCanvas.getContext('2d')!;
    tmpCtx.globalCompositeOperation = 'source-over';

    dstCtx.drawImage(tmpCanvas, 0, 0);
  }

  dstCtx.globalCompositeOperation = 'source-over';
}
