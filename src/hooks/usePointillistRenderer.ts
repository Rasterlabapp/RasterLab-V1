'use client';

/**
 * usePointillistRenderer
 *
 * Manages the full rendering pipeline:
 *   1. Worker lifecycle (create once, terminate on unmount)
 *   2. 250ms debounce on slider changes (image changes are immediate)
 *   3. Render-ID stale-drop: if settings change while worker is busy,
 *      the old result is silently discarded when it arrives
 *   4. Pending queue: if a new render is requested while the worker
 *      is busy, the latest request is queued and fired on completion
 *   5. OffscreenCanvas capability check + main-thread fallback
 */

import { useEffect, useRef, useCallback } from 'react';
import { extractPixels, renderPointillist } from '@/lib/pointillist-engine';
import type { PointillistSettings } from '@/lib/pointillist-engine';

const DEBOUNCE_MS = 250;

// OffscreenCanvas + Worker are available in all modern browsers.
// This check prevents SSR crashes and gracefully handles old browsers.
const supportsWorker =
  typeof window !== 'undefined' &&
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined';

interface RenderRequest {
  pixels: Uint8ClampedArray;
  pixelBuffer: ArrayBuffer; // same buffer, pre-sliced for transfer
  width: number;
  height: number;
  settings: PointillistSettings;
  immediate: boolean;       // skip debounce (image change)
}

interface RendererOptions {
  onRenderStart?: () => void;
  onRenderDone?: (ms: number) => void;
  onRenderError?: (msg: string) => void;
}

export function usePointillistRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: RendererOptions = {},
) {
  const workerRef    = useRef<Worker | null>(null);
  const renderIdRef  = useRef(0);               // monotonically increasing
  const busyRef      = useRef(false);           // worker currently processing
  const pendingRef   = useRef<RenderRequest | null>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef   = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  // ── Worker setup ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!supportsWorker) return;

    const worker = new Worker(
      new URL('../workers/pointillist.worker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      const { type, renderId, bitmap, ms, message } = e.data;

      if (type === 'error') {
        console.error('[PointillistWorker]', message);
        busyRef.current = false;
        optionsRef.current.onRenderError?.(message);
        drainPending();
        return;
      }

      if (type !== 'done') return;

      busyRef.current = false;

      // Stale-drop: discard results from superseded renders
      if (renderId === renderIdRef.current) {
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width  = bitmap.width;
          canvas.height = bitmap.height;
          canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
        }
        bitmap.close();
        optionsRef.current.onRenderDone?.(ms);
      } else {
        bitmap.close(); // discard stale bitmap — no GC pressure
      }

      drainPending();
    };

    worker.onerror = (e) => {
      console.error('[PointillistWorker error]', e);
      busyRef.current = false;
      drainPending();
    };

    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  // ── Send to worker ───────────────────────────────────────────────────────
  const sendToWorker = useCallback((req: RenderRequest) => {
    const worker = workerRef.current;
    if (!worker) return;

    const renderId = ++renderIdRef.current;
    busyRef.current = true;
    optionsRef.current.onRenderStart?.();

    // Transfer the pixel buffer — zero-copy, no serialisation overhead
    worker.postMessage(
      {
        type: 'render',
        renderId,
        pixels: req.pixels,
        width: req.width,
        height: req.height,
        settings: req.settings,
      },
      [req.pixelBuffer], // transfer the underlying ArrayBuffer
    );
  }, []);

  // ── Fallback: render on main thread (no Worker / no OffscreenCanvas) ────
  const renderMainThread = useCallback((req: RenderRequest) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    optionsRef.current.onRenderStart?.();

    // setTimeout(0) yields the paint frame so the UI doesn't freeze
    setTimeout(() => {
      // Reconstruct a temporary canvas from the pixel buffer
      const tmpSrc = document.createElement('canvas');
      tmpSrc.width = req.width; tmpSrc.height = req.height;
      const tmpCtx = tmpSrc.getContext('2d')!;
      tmpCtx.putImageData(new ImageData(new Uint8ClampedArray(req.pixelBuffer.slice(0)), req.width, req.height), 0, 0);

      canvas.width  = req.width;
      canvas.height = req.height;
      const ms = renderPointillist(tmpSrc, canvas, req.settings);
      optionsRef.current.onRenderDone?.(ms);
    }, 0);
  }, [canvasRef]);

  // ── Drain pending queue ──────────────────────────────────────────────────
  const drainPending = useCallback(() => {
    if (!pendingRef.current) return;
    const req = pendingRef.current;
    pendingRef.current = null;
    if (supportsWorker) {
      sendToWorker(req);
    } else {
      renderMainThread(req);
    }
  }, [sendToWorker, renderMainThread]);

  // ── Public: schedule a render ────────────────────────────────────────────
  const scheduleRender = useCallback((
    sourceImage: HTMLCanvasElement | null,
    settings: PointillistSettings,
    immediate = false,
  ) => {
    if (!sourceImage) return;

    // Always cancel any pending debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const fire = () => {
      // Extract pixels on the main thread (fast, synchronous)
      const pixelBuffer = sourceImage
        .getContext('2d')!
        .getImageData(0, 0, sourceImage.width, sourceImage.height)
        .data.buffer
        .slice(0); // copy so we can transfer without detaching the source

      const req: RenderRequest = {
        pixels: new Uint8ClampedArray(pixelBuffer),
        pixelBuffer,
        width: sourceImage.width,
        height: sourceImage.height,
        settings: { ...settings },
        immediate,
      };

      if (supportsWorker) {
        if (busyRef.current) {
          // Worker busy — queue this request; previous pending is discarded
          pendingRef.current = req;
        } else {
          sendToWorker(req);
        }
      } else {
        renderMainThread(req);
      }
    };

    if (immediate) {
      fire();
    } else {
      debounceRef.current = setTimeout(fire, DEBOUNCE_MS);
    }
  }, [sendToWorker, renderMainThread]);

  return { scheduleRender, supportsWorker };
}
