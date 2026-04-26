'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { usePointillistRenderer } from '@/hooks/usePointillistRenderer';

// Max source dimension — large enough for print-quality output
const MAX_PX = 3000;

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);

  const {
    settings, sourceImage,
    setSourceImage, setRenderTime,
  } = usePointillistStore();

  // ── Worker-backed renderer hook ─────────────────────────────────────────
  const { scheduleRender, supportsWorker } = usePointillistRenderer(canvasRef, {
    onRenderStart: () => setRendering(true),
    onRenderDone:  (ms) => { setRenderTime(ms); setRendering(false); },
    onRenderError: () => setRendering(false),
  });

  // ── Re-render when settings change (debounced 250 ms) ─────────────────
  // Using a ref for sourceImage avoids stale closures while the store updates.
  const sourceImageRef = useRef(sourceImage);
  useEffect(() => { sourceImageRef.current = sourceImage; }, [sourceImage]);

  useEffect(() => {
    scheduleRender(sourceImageRef.current, settings, false /* debounced */);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]); // only settings in deps — scheduleRender is stable

  // ── Re-render immediately when a new image is loaded ───────────────────
  useEffect(() => {
    if (!sourceImage) return;
    scheduleRender(sourceImage, settings, true /* immediate */);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImage]);

  // ── File loading ────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_PX)  { height = Math.round(height * MAX_PX / width);  width = MAX_PX; }
        if (height > MAX_PX) { width  = Math.round(width  * MAX_PX / height); height = MAX_PX; }

        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        setSourceImage(canvas);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [setSourceImage]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  return (
    <main className="flex-1 flex flex-col bg-[#0d0d0f] overflow-hidden relative">

      {/* Drop zone (shown when no image) */}
      {!sourceImage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-10">
          <label
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="group flex flex-col items-center gap-4 cursor-pointer"
          >
            <div className="w-28 h-28 rounded-3xl border-2 border-dashed border-zinc-700 group-hover:border-indigo-500 transition-colors flex flex-col items-center justify-center gap-2 bg-zinc-900/40 group-hover:bg-zinc-900/80">
              <span className="text-3xl text-zinc-500 group-hover:text-indigo-400 transition-colors">⬤</span>
              <span className="text-xs text-zinc-600 group-hover:text-zinc-400">upload</span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-zinc-300">Drop an image to begin</p>
              <p className="text-xs text-zinc-600 mt-1">
                JPG · PNG · WebP — up to {MAX_PX}px
                {supportsWorker && <span className="ml-1 text-indigo-500">⚡ GPU worker</span>}
              </p>
            </div>
            <input
              type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }}
            />
          </label>
        </div>
      )}

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
        <div className="relative" style={{ display: sourceImage ? 'block' : 'none' }}>
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-full rounded-lg shadow-2xl shadow-black/60"
            style={{ imageRendering: 'auto' }}
          />

          {/* Rendering indicator */}
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/25 rounded-lg pointer-events-none">
              <div className="flex items-center gap-2 bg-zinc-900/90 px-3 py-1.5 rounded-full border border-white/10">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs text-zinc-300">
                  {supportsWorker ? 'Worker rendering…' : 'Rendering…'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {sourceImage && <StatusBar supportsWorker={supportsWorker} />}
    </main>
  );
}

function StatusBar({ supportsWorker }: { supportsWorker: boolean }) {
  const { renderTimeMs, sourceImage, settings } = usePointillistStore();
  return (
    <div className="h-8 border-t border-white/5 flex items-center px-5 gap-4 text-[11px] text-zinc-600 bg-[#0d0d0f] flex-shrink-0">
      {sourceImage && (
        <span className="text-zinc-500">{sourceImage.width} × {sourceImage.height}px</span>
      )}
      <span>·</span>
      <span>{settings.colorMode}</span>
      <span>·</span>
      <span>dot {settings.dotSize}px · density {settings.density}%</span>
      {supportsWorker && (
        <>
          <span>·</span>
          <span className="text-indigo-500/70">⚡ worker</span>
        </>
      )}
      <span className="ml-auto tabular-nums">
        {renderTimeMs > 0 ? `${renderTimeMs}ms` : '—'}
      </span>
    </div>
  );
}
