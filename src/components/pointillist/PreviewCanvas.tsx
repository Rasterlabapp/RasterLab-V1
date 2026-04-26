'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { usePointillistRenderer } from '@/hooks/usePointillistRenderer';

const MAX_PX = 3000;

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [dragOver, setDragOver]   = useState(false);

  const { settings, sourceImage, setSourceImage, setRenderTime } = usePointillistStore();

  // ── Worker-backed renderer ──────────────────────────────────────────────────
  const { scheduleRender, supportsWorker } = usePointillistRenderer(canvasRef, {
    onRenderStart: () => setRendering(true),
    onRenderDone:  (ms) => { setRenderTime(ms); setRendering(false); },
    onRenderError: () => setRendering(false),
  });

  const sourceImageRef = useRef(sourceImage);
  useEffect(() => { sourceImageRef.current = sourceImage; }, [sourceImage]);

  useEffect(() => {
    scheduleRender(sourceImageRef.current, settings, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if (!sourceImage) return;
    scheduleRender(sourceImage, settings, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImage]);

  // ── File loading ────────────────────────────────────────────────────────────
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
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  return (
    <main className="flex-1 flex flex-col bg-[#0a0a0c] overflow-hidden relative min-w-0">

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!sourceImage && (
        <label
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer select-none"
        >
          {/* Radial ambient glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)' }} />

          {/* Drop card */}
          <div className={`relative flex flex-col items-center gap-6 px-10 py-10 rounded-2xl border transition-all duration-300 ${
            dragOver
              ? 'border-indigo-500/60 bg-indigo-500/[0.06] shadow-xl shadow-indigo-900/20'
              : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.14] hover:bg-white/[0.04]'
          }`}>

            {/* Icon */}
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              dragOver
                ? 'bg-indigo-500/20 border border-indigo-500/40 shadow-lg shadow-indigo-900/30'
                : 'bg-white/[0.04] border border-white/[0.08]'
            }`}>
              <svg
                viewBox="0 0 32 32"
                className={`w-7 h-7 transition-colors duration-300 ${dragOver ? 'text-indigo-400' : 'text-zinc-500'}`}
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              >
                <rect x="4" y="4" width="24" height="24" rx="4" />
                <circle cx="11" cy="11" r="2.5" />
                <path d="M4 21l7-7 5 5 4-4 8 8" />
              </svg>
            </div>

            {/* Text */}
            <div className="text-center flex flex-col gap-1.5">
              <p className={`text-sm font-semibold transition-colors duration-200 ${dragOver ? 'text-indigo-300' : 'text-zinc-200'}`}>
                {dragOver ? 'Release to load image' : 'Drop an image here'}
              </p>
              <p className="text-[11px] text-zinc-600">
                or <span className="text-zinc-400 underline underline-offset-2 decoration-zinc-600">browse files</span>
                {' '}· JPG, PNG, WebP up to {MAX_PX}px
              </p>
            </div>

            {/* Worker badge */}
            {supportsWorker && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/[0.08] border border-indigo-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-[10px] font-medium text-indigo-400">Worker renderer active</span>
              </div>
            )}
          </div>

          {/* Keyboard hint */}
          <p className="mt-5 text-[10px] text-zinc-700">Ctrl+V to paste from clipboard</p>

          <input
            type="file" accept="image/*" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) loadFile(e.target.files[0]); }}
          />
        </label>
      )}

      {/* ── Canvas area ──────────────────────────────────────────────────────── */}
      <div
        onDrop={sourceImage ? onDrop : undefined}
        onDragOver={sourceImage ? (e) => e.preventDefault() : undefined}
        className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-hidden"
      >
        {/* Wrapper carries explicit h-full/w-full so max-h/max-w on canvas work */}
        <div
          className="relative h-full w-full flex items-center justify-center"
          style={{ display: sourceImage ? 'flex' : 'none' }}
        >
          <canvas
            ref={canvasRef}
            className="rounded-xl shadow-2xl shadow-black/70"
            style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', imageRendering: 'auto' }}
          />

          {/* Rendering overlay */}
          <div className={`absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-200 pointer-events-none ${
            rendering ? 'opacity-100' : 'opacity-0'
          }`}>
            <div className="absolute inset-0 bg-black/30 rounded-xl" />
            <div className="relative flex items-center gap-2 bg-[#0f0f12]/90 backdrop-blur-sm px-3.5 py-2 rounded-full border border-white/[0.08] shadow-xl">
              <svg className="animate-spin w-3 h-3 text-indigo-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/>
              </svg>
              <span className="text-[11px] font-medium text-zinc-300">
                {supportsWorker ? 'Rendering…' : 'Rendering…'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────────── */}
      {sourceImage && <StatusBar supportsWorker={supportsWorker} />}
    </main>
  );
}

function StatusBar({ supportsWorker }: { supportsWorker: boolean }) {
  const { renderTimeMs, sourceImage, settings } = usePointillistStore();
  return (
    <div className="h-8 border-t border-white/[0.05] flex items-center px-4 gap-3 text-[10px] text-zinc-600 bg-[#0f0f12] flex-shrink-0 select-none">
      {sourceImage && (
        <span className="text-zinc-500 tabular-nums">{sourceImage.width} × {sourceImage.height}px</span>
      )}
      <Dot />
      <span className="capitalize">{settings.colorMode}</span>
      <Dot />
      <span>dot {settings.dotSize}px</span>
      <Dot />
      <span>density {settings.density}%</span>
      {supportsWorker && (
        <>
          <Dot />
          <span className="flex items-center gap-1 text-indigo-500/60">
            <span className="w-1 h-1 rounded-full bg-indigo-500/60 inline-block" />
            worker
          </span>
        </>
      )}
      <span className="ml-auto tabular-nums text-zinc-600">
        {renderTimeMs > 0 ? `${renderTimeMs} ms` : '—'}
      </span>
    </div>
  );
}

function Dot() {
  return <span className="w-[3px] h-[3px] rounded-full bg-white/10 flex-shrink-0 inline-block" />;
}
