'use client';

/**
 * usePointillistRenderer
 *
 * Manages the full rendering pipeline:
 *   1. Worker lifecycle — spawned once; restarted on preemption (see §3)
 *   2. 150 ms debounce on slider changes; image changes are immediate
 *   3. Preemptive restart: when the worker is busy and a new render fires,
 *      the old worker is terminated immediately and a fresh one is started.
 *      This means sliders never stall waiting for a superseded render to
 *      finish — the new settings take effect within one render cycle.
 *   4. Stale-drop: render IDs are checked on 'done' so a result from a
 *      previous render cycle is discarded without touching the canvas.
 *   5. OffscreenCanvas capability check + main-thread fallback.
 *
 * ── Why terminate-and-restart over a queue ───────────────────────────────────
 * Workers execute JS synchronously inside their thread. A busy worker cannot
 * be interrupted cooperatively — it will finish its full Poisson + render pass
 * before reading the next message.  Terminating is the only way to stop it.
 * After termination the new worker starts fresh with zero wait.
 */

import { useEffect, useRef, useCallback } from 'react';
import { extractPixels, renderPointillist } from '@/lib/pointillist-engine';
import type { PointillistSettings } from '@/lib/pointillist-engine';

const DEBOUNCE_MS = 150;

// OffscreenCanvas + Worker are available in all modern browsers.
// This check prevents SSR crashes and gracefully handles old browsers.
const supportsWorker =
  typeof window !== 'undefined' &&
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined';

interface RenderRequest {
  pixels:      Uint8ClampedArray;
  pixelBuffer: ArrayBuffer;        // same buffer — transferred zero-copy
  width:       number;
  height:      number;
  settings:    PointillistSettings;
}

interface RendererOptions {
  onRenderStart?: () => void;
  onRenderDone?:  (ms: number) => void;
  onRenderError?: (msg: string) => void;
}

export function usePointillistRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: RendererOptions = {},
) {
  const workerRef   = useRef<Worker | null>(null);
  const renderIdRef = useRef(0);      // monotonically increasing; used for stale-drop
  const busyRef     = useRef(false);  // true while a render is in-flight
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef  = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  // ── Worker factory ──────────────────────────────────────────────────────────
  // Extracted so we can call it both on mount and on preemptive restart.
  const spawnWorker = useCallback((): Worker => {
    const w = new Worker(
      new URL('../workers/pointillist.worker.ts', import.meta.url),
      { type: 'module' },
    );

    w.onmessage = (e: MessageEvent) => {
      const { type, renderId, bitmap, ms, message } = e.data;

      if (type === 'error') {
        console.error('[PointillistWorker]', message);
        busyRef.current = false;
        optionsRef.current.onRenderError?.(message);
        return;
      }

      if (type !== 'done') return;

      busyRef.current = false;

      // Stale-drop: discard results superseded by a later render ID.
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
        bitmap.close(); // discard — free GPU memory immediately
      }
    };

    w.onerror = (ev) => {
      console.error('[PointillistWorker error]', ev);
      busyRef.current = false;
    };

    return w;
  }, [canvasRef]);

  // ── Worker mount / unmount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!supportsWorker) return;
    workerRef.current = spawnWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  // spawnWorker is stable (useCallback with no deps that change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Send to worker ──────────────────────────────────────────────────────────
  const sendToWorker = useCallback((req: RenderRequest) => {
    const worker = workerRef.current;
    if (!worker) return;

    const renderId = ++renderIdRef.current;
    busyRef.current = true;
    optionsRef.current.onRenderStart?.();

    // Transfer the pixel buffer — zero-copy; no serialisation overhead
    worker.postMessage(
      {
        type:     'render',
        renderId,
        pixels:   req.pixels,
        width:    req.width,
        height:   req.height,
        settings: req.settings,
      },
      [req.pixelBuffer],
    );
  }, []);

  // ── Fallback: render on main thread (no Worker / no OffscreenCanvas) ────────
  const renderMainThread = useCallback((req: RenderRequest) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    optionsRef.current.onRenderStart?.();

    // setTimeout(0) yields the paint frame so the UI doesn't freeze
    setTimeout(() => {
      const tmpSrc    = document.createElement('canvas');
      tmpSrc.width    = req.width;
      tmpSrc.height   = req.height;
      const tmpCtx    = tmpSrc.getContext('2d')!;
      tmpCtx.putImageData(
        new ImageData(new Uint8ClampedArray(req.pixelBuffer.slice(0)), req.width, req.height),
        0, 0,
      );
      canvas.width  = req.width;
      canvas.height = req.height;
      const ms = renderPointillist(tmpSrc, canvas, req.settings);
      optionsRef.current.onRenderDone?.(ms);
    }, 0);
  }, [canvasRef]);

  // ── Build a RenderRequest from the source canvas ────────────────────────────
  const buildRequest = (
    sourceImage: HTMLCanvasElement,
    settings:    PointillistSettings,
  ): RenderRequest => {
    const pixelBuffer = sourceImage
      .getContext('2d')!
      .getImageData(0, 0, sourceImage.width, sourceImage.height)
      .data.buffer
      .slice(0); // defensive copy — keeps the source canvas intact

    return {
      pixels:      new Uint8ClampedArray(pixelBuffer),
      pixelBuffer,
      width:       sourceImage.width,
      height:      sourceImage.height,
      settings:    { ...settings },
    };
  };

  // ── Public: schedule a render ───────────────────────────────────────────────
  const scheduleRender = useCallback((
    sourceImage: HTMLCanvasElement | null,
    settings:    PointillistSettings,
    immediate    = false,
  ) => {
    if (!sourceImage) return;

    // Always cancel an in-flight debounce timer
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const fire = () => {
      const req = buildRequest(sourceImage, settings);

      if (supportsWorker) {
        // ── Preemptive restart ──────────────────────────────────────────────
        // If the worker is still churning through a previous render, terminate
        // it immediately and spawn a fresh one.  The old result will never
        // arrive (terminated workers produce no further messages), so there is
        // no stale-drop risk — we simply start the new render right away.
        if (busyRef.current) {
          workerRef.current?.terminate();
          workerRef.current = spawnWorker();
          busyRef.current = false;
        }
        sendToWorker(req);
      } else {
        renderMainThread(req);
      }
    };

    if (immediate) {
      fire();
    } else {
      debounceRef.current = setTimeout(fire, DEBOUNCE_MS);
    }
  // spawnWorker is stable; sendToWorker / renderMainThread are stable callbacks
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendToWorker, renderMainThread, spawnWorker]);

  return { scheduleRender, supportsWorker };
}
