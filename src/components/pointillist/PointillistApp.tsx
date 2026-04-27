'use client';

import { ControlPanel } from './ControlPanel';
import { PreviewCanvas } from './PreviewCanvas';
import { RightPanel } from './RightPanel';
import Link from 'next/link';

export function PointillistApp() {
  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#0a0a0a' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────────── */}
      <header
        className="h-12 flex items-center px-5 gap-4 flex-shrink-0"
        style={{ background: '#111111', borderBottom: '1px solid #1e1e1e' }}
      >
        {/* Back nav */}
        <Link
          href="/"
          className="flex items-center gap-1.5 transition-colors duration-150 group"
          style={{ color: '#555555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#cccccc')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555555')}
        >
          <svg
            className="w-3.5 h-3.5 transition-transform duration-150 group-hover:-translate-x-0.5"
            viewBox="0 0 12 12" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M7.5 2L3.5 6l4 4" />
          </svg>
          <span className="text-[12px] font-medium">RasterLab</span>
        </Link>

        {/* Divider */}
        <span className="w-px h-4" style={{ background: '#282828' }} />

        {/* App identity */}
        <div className="flex items-center gap-2.5">
          {/* Icon — monochrome dot grid */}
          <div
            className="w-[22px] h-[22px] rounded-[5px] flex items-center justify-center flex-shrink-0"
            style={{ background: '#ffffff' }}
          >
            <svg viewBox="0 0 14 14" width="12" height="12" fill="#000000">
              <circle cx="3" cy="3" r="1.5"/>
              <circle cx="7" cy="3" r="1.1"/>
              <circle cx="11" cy="3" r="0.8"/>
              <circle cx="3" cy="7" r="1.1"/>
              <circle cx="7" cy="7" r="1.5"/>
              <circle cx="11" cy="7" r="1.1"/>
              <circle cx="3" cy="11" r="0.8"/>
              <circle cx="7" cy="11" r="1.1"/>
              <circle cx="11" cy="11" r="1.5"/>
            </svg>
          </div>
          <span className="text-[14px] font-bold tracking-tight text-white">Pointillist</span>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-semibold leading-none"
            style={{ background: '#1e1e1e', color: '#666666', border: '1px solid #2a2a2a' }}
          >
            v2
          </span>
        </div>

        {/* Hint */}
        <p className="ml-auto text-[11px] hidden lg:block select-none" style={{ color: '#3a3a3a' }}>
          Drop an image to begin · adjust controls live
        </p>
      </header>

      {/* ── Three-column layout ───────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <ControlPanel />
        <PreviewCanvas />
        <RightPanel />
      </div>
    </div>
  );
}
