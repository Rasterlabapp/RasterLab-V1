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
        {/* Wordmark — Curato Lab */}
        <Link href="/" className="flex items-center gap-3 group" style={{ textDecoration: 'none' }}>
          {/* Logomark: dot grid in white square */}
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

          {/* Wordmark */}
          <div className="flex items-baseline gap-[3px]">
            <span
              className="text-[15px] font-bold tracking-[-0.01em] transition-colors duration-150"
              style={{ color: '#ffffff', letterSpacing: '-0.01em' }}
            >
              Curato
            </span>
            <span
              className="text-[15px] font-light tracking-[0.01em] transition-colors duration-150"
              style={{ color: '#666666' }}
            >
              Lab
            </span>
          </div>
        </Link>

        {/* Divider */}
        <span className="w-px h-5" style={{ background: '#242424' }} />

        {/* Tool name */}
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium" style={{ color: '#888888' }}>Pointillist</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded font-bold leading-none tracking-wide"
            style={{ background: '#1a1a1a', color: '#484848', border: '1px solid #262626' }}
          >
            GEN
          </span>
        </div>

        {/* Tagline */}
        <p className="ml-auto text-[11px] hidden lg:block select-none" style={{ color: '#303030' }}>
          Precision tools for visual creators
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
