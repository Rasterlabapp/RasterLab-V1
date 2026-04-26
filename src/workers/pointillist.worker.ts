/// <reference lib="webworker" />

/**
 * Pointillist Web Worker
 *
 * Runs the entire rendering pipeline off the main thread.
 * Uses OffscreenCanvas for drawing — result returned as ImageBitmap
 * (zero-copy Transferable back to the main thread).
 *
 * Message protocol:
 *   IN  { type:'render', renderId, pixels, width, height, settings }
 *   OUT { type:'done',   renderId, bitmap, ms }
 *   OUT { type:'error',  renderId, message }
 */

import { renderPointillistCore, type PointillistSettings } from '@/lib/pointillist-engine';

self.onmessage = (e: MessageEvent) => {
  const { type, renderId, pixels, width, height, settings } = e.data as {
    type: string;
    renderId: number;
    pixels: Uint8ClampedArray;
    width: number;
    height: number;
    settings: PointillistSettings;
  };

  if (type !== 'render') return;

  try {
    // Create OffscreenCanvas as the render target
    const offscreen = new OffscreenCanvas(width, height);
    const ctx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D;

    // pixels is already a mutable copy (transferred from main thread)
    const ms = renderPointillistCore(pixels, width, height, settings, ctx);

    // transferToImageBitmap() is zero-copy — no pixel data is re-read
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
