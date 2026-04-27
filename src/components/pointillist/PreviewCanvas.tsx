'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { usePointillistRenderer } from '@/hooks/usePointillistRenderer';

const MAX_PX = 3000;

export function PreviewCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);

  const { settings, sourceImage, setSourceImage, setRenderTime } = usePointillistStore();

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

  // ── File loading ─────────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width  > MAX_PX) { height = Math.round(height * MAX_PX / width);  width  = MAX_PX; }
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
    <main
      className="flex-1 flex flex-col overflow-hidden relative min-w-0"
      style={{ background: '#0a0a0a' }}
    >

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!sourceImage && (
        <label
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center cursor-pointer select-none"
        >
          {/* Subtle radial */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)' }}
          />

          {/* Drop card */}
          <div
            className="relative flex flex-col items-center gap-7 px-12 py-10 rounded-2xl transition-all duration-250"
            style={{
              background: dragOver ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
              border:     `1px solid ${dragOver ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {/* Upload icon */}
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-250"
              style={{
                background: dragOver ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
                border:     `1px solid ${dragOver ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              <svg
                viewBox="0 0 32 32"
                className="w-7 h-7"
                style={{ color: dragOver ? '#cccccc' : '#444444' }}
                fill="none" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <rect x="4" y="4" width="24" height="24" rx="4" />
                <circle cx="11" cy="11" r="2.5" />
                <path d="M4 21l7-7 5 5 4-4 8 8" />
              </svg>
            </div>

            {/* Text */}
            <div className="text-center flex flex-col gap-2">
              <p
                className="text-[14px] font-semibold"
                style={{ color: dragOver ? '#ffffff' : '#888888' }}
              >
                {dragOver ? 'Release to load image' : 'Drop an image here'}
              </p>
              <p className="text-[12px]" style={{ color: '#444444' }}>
                or{' '}
                <span style={{ color: '#777777', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  browse files
                </span>
                {' '}· JPG, PNG, WebP up to {MAX_PX}px
              </p>
            </div>

            {/* Worker badge */}
            {supportsWorker && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] font-medium" style={{ color: '#555555' }}>
                  Worker renderer active
                </span>
              </div>
            )}
          </div>

          {/* Keyboard hint */}
          <p className="mt-6 text-[11px]" style={{ color: '#2e2e2e' }}>
            Ctrl+V to paste from clipboard
          </p>

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
        className="flex-1 min-h-0 flex items-center justify-center p-8 overflow-hidden"
      >
        <div
          className="relative h-full w-full flex items-center justify-center"
          style={{ display: sourceImage ? 'flex' : 'none' }}
        >
          <canvas
            ref={canvasRef}
            className="rounded-xl"
            style={{
              display:        'block',
              maxWidth:       '100%',
              maxHeight:      '100%',
              imageRendering: 'auto',
              boxShadow:      '0 0 0 1px rgba(255,255,255,0.07), 0 28px 70px rgba(0,0,0,0.75)',
            }}
          />

          {/* Rendering overlay */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-xl pointer-events-none transition-opacity duration-200"
            style={{ opacity: rendering ? 1 : 0 }}
          >
            <div className="absolute inset-0 rounded-xl" style={{ background: 'rgba(0,0,0,0.4)' }} />
            <div
              className="relative flex items-center gap-2.5 px-4 py-2.5 rounded-full"
              style={{
                background: 'rgba(17,17,17,0.95)',
                border:     '1px solid rgba(255,255,255,0.1)',
                boxShadow:  '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              <svg className="animate-spin w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-15" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/>
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/>
              </svg>
              <span className="text-[12px] font-medium text-white">Rendering…</span>
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
    <div
      className="h-8 flex items-center px-5 gap-3 flex-shrink-0 select-none"
      style={{ borderTop: '1px solid #181818', background: '#0d0d0d' }}
    >
      {sourceImage && (
        <span className="text-[11px] tabular-nums" style={{ color: '#555555' }}>
          {sourceImage.width} × {sourceImage.height}px
        </span>
      )}
      <Dot />
      <span className="text-[11px] capitalize" style={{ color: '#444444' }}>{settings.colorMode}</span>
      <Dot />
      <span className="text-[11px]" style={{ color: '#444444' }}>dot {settings.dotSize}px</span>
      <Dot />
      <span className="text-[11px]" style={{ color: '#444444' }}>density {settings.density}%</span>
      {supportsWorker && (
        <>
          <Dot />
          <span className="flex items-center gap-1.5 text-[11px]" style={{ color: '#333333' }}>
            <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ background: '#333333' }} />
            worker
          </span>
        </>
      )}
      <span className="ml-auto text-[11px] tabular-nums" style={{ color: '#444444' }}>
        {renderTimeMs > 0 ? `${renderTimeMs} ms` : '—'}
      </span>
    </div>
  );
}

function Dot() {
  return (
    <span
      className="w-[3px] h-[3px] rounded-full flex-shrink-0 inline-block"
      style={{ background: '#252525' }}
    />
  );
}
