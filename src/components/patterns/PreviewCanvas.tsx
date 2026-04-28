'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePatternStore }      from '@/store/pattern-store';
import { usePatternRenderer }   from '@/hooks/usePatternRenderer';

export function PreviewCanvas() {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);

  const sourceImage  = usePatternStore((s) => s.sourceImage);
  const settings     = usePatternStore((s) => s.settings);
  const setRenderTime = usePatternStore((s) => s.setRenderTime);

  const { scheduleRender } = usePatternRenderer(canvasRef, {
    onRenderStart: () => setRendering(true),
    onRenderDone:  (ms) => { setRendering(false); setRenderTime(ms); },
    onRenderError: () => setRendering(false),
  });

  // Re-render whenever source image or settings change
  useEffect(() => {
    if (sourceImage) scheduleRender(sourceImage, settings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImage, settings]);

  return (
    <main style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a0a0a',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          maxWidth:  '90%',
          maxHeight: '90%',
          objectFit: 'contain',
          display:   sourceImage ? 'block' : 'none',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 28px 70px rgba(0,0,0,0.8)',
          borderRadius: 2,
        }}
      />

      {/* Empty state */}
      {!sourceImage && (
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: '#141414', border: '1px solid #242424',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1" y="4" width="20" height="14" rx="2" stroke="#333" strokeWidth="1.5"/>
              <circle cx="8" cy="9" r="1.5" fill="#333"/>
              <path d="M1 14l5-4 4 3 3-3 8 5" stroke="#333" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, color: '#333', fontWeight: 500 }}>Upload an image to begin</p>
          <p style={{ fontSize: 11, color: '#222', marginTop: 4 }}>Use the panel on the left</p>
        </div>
      )}

      {/* Rendering indicator */}
      {rendering && sourceImage && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#111', border: '1px solid #2a2a2a',
          borderRadius: 20, padding: '5px 14px',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#ffffff',
            animation: 'pulse 1s ease-in-out infinite',
          }} />
          <span style={{ fontSize: 11, color: '#888', letterSpacing: '0.04em' }}>Rendering…</span>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:.2} 50%{opacity:1} }`}</style>
    </main>
  );
}
