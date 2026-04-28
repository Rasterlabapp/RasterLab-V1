/// <reference lib="webworker" />

/**
 * Pattern Engines Web Worker
 *
 * Protocol:
 *   IN  { type:'render', renderId, pixels, width, height, settings }
 *   OUT { type:'done',   renderId, bitmap, ms }
 *   OUT { type:'error',  renderId, message }
 */

import { renderPattern, type PatternSettings } from '@/lib/patterns/index';

self.onmessage = (e: MessageEvent) => {
  const { type, renderId, pixels, width, height, settings } = e.data as {
    type:     string;
    renderId: number;
    pixels:   Uint8ClampedArray;
    width:    number;
    height:   number;
    settings: PatternSettings;
  };

  if (type !== 'render') return;

  try {
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D;

    const t0 = performance.now();
    renderPattern({ ctx, pixels, width, height, settings });
    const ms = performance.now() - t0;

    const bitmap = offscreen.transferToImageBitmap();

    (self as unknown as Worker).postMessage(
      { type: 'done', renderId, bitmap, ms },
      [bitmap] as unknown as Transferable[],
    );
  } catch (err) {
    (self as unknown as Worker).postMessage({
      type: 'error',
      renderId,
      message: String(err),
    });
  }
};
