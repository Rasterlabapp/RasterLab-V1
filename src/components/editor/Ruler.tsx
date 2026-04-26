'use client';

import { useRef, useEffect } from 'react';
import { useEditorStore } from '@/store/editor-store';

const RULER_SIZE = 20; // px thickness

interface RulerProps {
  orientation: 'horizontal' | 'vertical';
  length: number; // canvas display width or height
}

function drawRuler(
  canvas: HTMLCanvasElement,
  orientation: 'horizontal' | 'vertical',
  length: number,
  zoom: number,
  pan: number,
  dpi: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isH = orientation === 'horizontal';
  canvas.width = isH ? length : RULER_SIZE;
  canvas.height = isH ? RULER_SIZE : length;

  ctx.fillStyle = '#18181b'; // zinc-900
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#52525b'; // zinc-600
  ctx.fillStyle = '#71717a';   // zinc-500
  ctx.font = '9px ui-monospace, monospace';
  ctx.textAlign = 'center';

  // How many screen px = 1 real px
  const pxPerUnit = zoom;
  // How many units fit between major ticks (nice multiples)
  const unitsPerTick = pickTickInterval(dpi, zoom);
  const screenPerTick = unitsPerTick * pxPerUnit;

  // Starting offset from pan
  const offset = pan % screenPerTick;
  const startUnit = -Math.floor(pan / pxPerUnit / unitsPerTick) * unitsPerTick;

  for (let i = 0; i * screenPerTick - offset < length + screenPerTick; i++) {
    const screenPos = i * screenPerTick - offset;
    const unit = startUnit + i * unitsPerTick;
    const label = unitLabel(unit, dpi);

    ctx.beginPath();
    if (isH) {
      ctx.moveTo(screenPos, RULER_SIZE);
      ctx.lineTo(screenPos, RULER_SIZE * 0.3);
      ctx.stroke();
      ctx.save();
      ctx.translate(screenPos + 2, 9);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    } else {
      ctx.moveTo(RULER_SIZE, screenPos);
      ctx.lineTo(RULER_SIZE * 0.3, screenPos);
      ctx.stroke();
      ctx.save();
      ctx.translate(9, screenPos + 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // Minor ticks (4 subdivisions)
    for (let m = 1; m < 4; m++) {
      const minorPos = screenPos + (m / 4) * screenPerTick;
      ctx.beginPath();
      if (isH) {
        ctx.moveTo(minorPos, RULER_SIZE);
        ctx.lineTo(minorPos, RULER_SIZE * 0.6);
      } else {
        ctx.moveTo(RULER_SIZE, minorPos);
        ctx.lineTo(RULER_SIZE * 0.6, minorPos);
      }
      ctx.stroke();
    }
  }
}

function pickTickInterval(dpi: number, zoom: number): number {
  // Target ~60px between major ticks on screen
  const targetScreenGap = 60;
  const pxPerScreen = zoom;
  // How many image pixels per major tick
  const rawPx = targetScreenGap / pxPerScreen;
  // Round to a nice number
  const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
  return nice.find((n) => n >= rawPx) ?? 1000;
}

function unitLabel(px: number, dpi: number): string {
  // Show inches when >= 72 dpi-worth of image pixels
  const inches = px / dpi;
  if (Math.abs(px) >= dpi) return `${inches.toFixed(1)}"`;
  return `${px}`;
}

export function Ruler({ orientation, length }: RulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { zoom, panX, panY, dpi } = useEditorStore();
  const pan = orientation === 'horizontal' ? panX : panY;

  useEffect(() => {
    if (canvasRef.current) {
      drawRuler(canvasRef.current, orientation, length, zoom, pan, dpi);
    }
  }, [orientation, length, zoom, pan, dpi]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: orientation === 'horizontal' ? length : RULER_SIZE,
        height: orientation === 'horizontal' ? RULER_SIZE : length,
        imageRendering: 'pixelated',
      }}
    />
  );
}

export function RulerCorner() {
  return (
    <div
      style={{ width: RULER_SIZE, height: RULER_SIZE, flexShrink: 0 }}
      className="bg-zinc-900 border-r border-b border-zinc-800"
    />
  );
}

export { RULER_SIZE };
