'use client';

import { ControlPanel } from './ControlPanel';
import { PreviewCanvas } from './PreviewCanvas';
import { RightPanel } from './RightPanel';
import Link from 'next/link';

export function PointillistApp() {
  return (
    <div className="h-screen flex flex-col bg-[#0a0a0c] overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="h-12 flex items-center px-5 gap-3 border-b border-white/[0.06] bg-[#0f0f12]/95 backdrop-blur-sm flex-shrink-0">

        {/* Back nav */}
        <Link
          href="/"
          className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 hover:text-zinc-200 transition-colors duration-150 group"
        >
          <svg className="w-3 h-3 transition-transform duration-150 group-hover:-translate-x-0.5" viewBox="0 0 12 12" fill="currentColor">
            <path d="M7.5 2L3.5 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
          RasterLab
        </Link>

        <span className="w-px h-4 bg-white/[0.08]" />

        {/* App identity */}
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/40 flex-shrink-0">
            <span className="text-[9px] text-white leading-none select-none">⬤</span>
          </div>
          <span className="text-[13px] font-semibold text-white tracking-tight">Pointillist</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium leading-none">
            v2
          </span>
        </div>

        {/* Hint */}
        <p className="ml-auto text-[11px] text-zinc-600 hidden lg:block select-none">
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
