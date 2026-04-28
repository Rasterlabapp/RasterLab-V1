'use client';

/**
 * usePatternRenderer
 *
 * Mirrors the preemptive-restart pattern from usePointillistRenderer:
 *   - 200 ms debounce on control changes
 *   - Image changes render immediately
 *   - Busy worker is terminated and restarted on new render
 *   - Stale-drop via monotonic render ID
 *   - Main-thread fallback when Worker / OffscreenCanvas unavailable
 */

import { useEffect, useRef, useCallback } from 'react';
import { renderPattern }       from '@/lib/patterns/index';
import type { PatternSettings } from '@/lib/patterns/index';

const DEBOUNCE_MS = 200;

const supportsWorker =
  typeof window !== 'undefined' &&
  typeof Worker !== 'undefined' &&
  typeof OffscreenCanvas !== 'undefined';

interface RenderRequest {
  pixels:      Uint8ClampedArray;
  pixelBuffer: ArrayBuffer;
  width:       number;
  height:      number;
  settings:    PatternSettings;
}

interface Options {
  onRenderStart?: () => void;
  onRenderDone?:  (ms: number) => void;
  onRenderError?: (msg: string) => void;
}

export function usePatternRenderer(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: Options = {},
) {
  const workerRef   = useRef<Worker | null>(null);
  const renderIdRef = useRef(0);
  const busyRef     = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef  = useRef(options);
  useEffect(() => { optionsRef.current = options; });

  const spawnWorker = useCallback((): Worker => {
    const w = new Worker(
      new URL('../workers/pattern.worker.ts', import.meta.url),
      { type: 'module' },
    );

    w.onmessage = (e: MessageEvent) => {
      const { type, renderId, bitmap, ms, message } = e.data;

      if (type === 'error') {
        console.error('[PatternWorker]', message);
        busyRef.current = false;
        optionsRef.current.onRenderError?.(message);
        return;
      }
      if (type !== 'done') return;

      busyRef.current = false;

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
        bitmap.close();
      }
    };

    w.onerror = () => { busyRef.current = false; };
    return w;
  }, [canvasRef]);

  useEffect(() => {
    if (!supportsWorker) return;
    workerRef.current = spawnWorker();
    return () => { workerRef.current?.terminate(); workerRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendToWorker = useCallback((req: RenderRequest) => {
    const worker = workerRef.current;
    if (!worker) return;
    const renderId = ++renderIdRef.current;
    busyRef.current = true;
    optionsRef.current.onRenderStart?.();
    worker.postMessage(
      { type: 'render', renderId, pixels: req.pixels, width: req.width, height: req.height, settings: req.settings },
      [req.pixelBuffer],
    );
  }, []);

  const renderMainThread = useCallback((req: RenderRequest) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    optionsRef.current.onRenderStart?.();
    setTimeout(() => {
      canvas.width  = req.width;
      canvas.height = req.height;
      const ctx = canvas.getContext('2d')!;
      const t0  = performance.now();
      renderPattern({ ctx, pixels: req.pixels, width: req.width, height: req.height, settings: req.settings });
      optionsRef.current.onRenderDone?.(performance.now() - t0);
    }, 0);
  }, [canvasRef]);

  const buildRequest = (src: HTMLCanvasElement, settings: PatternSettings): RenderRequest => {
    const pixelBuffer = src.getContext('2d')!
      .getImageData(0, 0, src.width, src.height)
      .data.buffer.slice(0);
    return {
      pixels:      new Uint8ClampedArray(pixelBuffer),
      pixelBuffer,
      width:       src.width,
      height:      src.height,
      settings:    { ...settings },
    };
  };

  const scheduleRender = useCallback((
    sourceImage: HTMLCanvasElement | null,
    settings:    PatternSettings,
    immediate    = false,
  ) => {
    if (!sourceImage) return;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }

    const fire = () => {
      const req = buildRequest(sourceImage, settings);
      if (supportsWorker) {
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

    if (immediate) fire();
    else debounceRef.current = setTimeout(fire, DEBOUNCE_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendToWorker, renderMainThread, spawnWorker]);

  return { scheduleRender, supportsWorker };
}
