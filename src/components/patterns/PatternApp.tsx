'use client';

import { useCallback }       from 'react';
import Link                  from 'next/link';
import { ControlPanel }      from './ControlPanel';
import { PreviewCanvas }     from './PreviewCanvas';
import { RightPanel }        from './RightPanel';
import { MobilePatternLayout } from './mobile/MobilePatternLayout';
import { usePatternStore }   from '@/store/pattern-store';
import { useIsMobile }       from '@/hooks/useIsMobile';

// ── Image loader ──────────────────────────────────────────────────────────
function loadImageToCanvas(file: File): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

export function PatternApp() {
  const isMobile      = useIsMobile(768);
  const setSourceImage = usePatternStore((s) => s.setSourceImage);

  const handleFile = useCallback(async (file: File) => {
    try {
      const canvas = await loadImageToCanvas(file);
      setSourceImage(canvas);
    } catch {
      console.error('Failed to load image');
    }
  }, [setSourceImage]);

  if (isMobile) return <MobilePatternLayout />;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0a' }}>

      {/* Header */}
      <header
        className="h-12 flex items-center px-5 gap-4 flex-shrink-0"
        style={{ background: '#111111', borderBottom: '1px solid #1e1e1e' }}
      >
        <Link href="/" className="flex items-center gap-3 group" style={{ textDecoration: 'none' }}>
          <div
            className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center flex-shrink-0 transition-opacity duration-150 group-hover:opacity-80"
            style={{ background: '#ffffff' }}
          >
            <svg viewBox="0 0 14 14" width="13" height="13" fill="#000000">
              <circle cx="3"  cy="3"  r="1.55"/>
              <circle cx="7"  cy="3"  r="1.10"/>
              <circle cx="11" cy="3"  r="0.70"/>
              <circle cx="3"  cy="7"  r="1.10"/>
              <circle cx="7"  cy="7"  r="1.55"/>
              <circle cx="11" cy="7"  r="1.10"/>
              <circle cx="3"  cy="11" r="0.70"/>
              <circle cx="7"  cy="11" r="1.10"/>
              <circle cx="11" cy="11" r="1.55"/>
            </svg>
          </div>
          <div className="flex items-baseline gap-[3px]">
            <span className="text-[15px] font-bold" style={{ color: '#ffffff', letterSpacing: '-0.01em' }}>Curato</span>
            <span className="text-[15px] font-light" style={{ color: '#666666', letterSpacing: '0.01em' }}>Lab</span>
          </div>
        </Link>

        <span className="w-px h-5" style={{ background: '#242424' }} />

        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium" style={{ color: '#888888' }}>Pattern Engines</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-bold leading-none tracking-wide"
            style={{ background: '#1a1a1a', color: '#484848', border: '1px solid #262626' }}
          >
            GEN
          </span>
        </div>

        <p className="ml-auto text-[11px] hidden lg:block select-none" style={{ color: '#303030' }}>
          Precision tools for visual creators
        </p>
      </header>

      {/* Three-column workspace */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <ControlPanel onFileLoad={handleFile} />
        <PreviewCanvas />
        <RightPanel />
      </div>
    </div>
  );
}
