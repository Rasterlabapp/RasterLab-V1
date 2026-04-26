'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { renderPointillist } from '@/lib/pointillist-engine';

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const srcRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  const [rendering, setRendering] = useState(false);

  const { settings, sourceImage, setSourceImage, setRenderTime } = usePointillistStore();

  // Keep a stable ref to latest settings for use inside rAF
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // ── rAF render loop ────────────────────────────────────────────────────
  const scheduleRender = useCallback(() => {
    if (rafRef.current !== null) return; // already queued

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;

      const src = srcRef.current;
      const dst = canvasRef.current;
      if (!src || !dst) return;

      setRendering(true);
      // Yield to browser paint, then render (keeps UI responsive)
      setTimeout(() => {
        const ms = renderPointillist(src, dst, settingsRef.current);
        setRenderTime(ms);
        setRendering(false);
      }, 0);
    });
  }, [setRenderTime]);

  // Mark dirty + schedule whenever settings change
  useEffect(() => {
    if (!srcRef.current) return;
    dirtyRef.current = true;
    scheduleRender();
  }, [settings, scheduleRender]);

  // When sourceImage changes, store it and trigger render
  useEffect(() => {
    srcRef.current = sourceImage;
    if (!sourceImage) return;
    dirtyRef.current = true;
    scheduleRender();
  }, [sourceImage, scheduleRender]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Drop / upload ─────────────────────────────────────────────────────
  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Downscale very large images for performance (max 1200px wide)
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }

        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        setSourceImage(canvas);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    loadFile(e.dataTransfer.files[0]);
  };

  return (
    <main className="flex-1 flex flex-col bg-[#0d0d0f] overflow-hidden relative">

      {/* Top hint bar */}
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
              <p className="text-xs text-zinc-600 mt-1">JPG, PNG, WebP — auto-scaled to 1200px</p>
            </div>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }} />
          </label>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
        <div className="relative" style={{ display: sourceImage ? 'block' : 'none' }}>
          <canvas
            ref={canvasRef}
            className="block max-w-full max-h-full rounded-lg shadow-2xl shadow-black/60"
            style={{ imageRendering: 'auto' }}
          />
          {/* Rendering overlay */}
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
              <div className="flex items-center gap-2 bg-zinc-900/90 px-3 py-1.5 rounded-full border border-white/10">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs text-zinc-300">Rendering…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom status bar */}
      {sourceImage && <StatusBar />}
    </main>
  );
}

function StatusBar() {
  const { renderTimeMs, sourceImage, settings } = usePointillistStore();
  return (
    <div className="h-8 border-t border-white/5 flex items-center px-5 gap-5 text-[11px] text-zinc-600 bg-[#0d0d0f] flex-shrink-0">
      {sourceImage && <span className="text-zinc-500">{sourceImage.width} × {sourceImage.height}px</span>}
      <span>·</span>
      <span>{settings.colorMode}</span>
      <span>·</span>
      <span>dot {settings.dotSize}px · density {settings.density}%</span>
      <span className="ml-auto text-zinc-600">{renderTimeMs > 0 ? `${renderTimeMs}ms` : '—'}</span>
    </div>
  );
}
