'use client';

import { ControlPanel } from './ControlPanel';
import { PreviewCanvas } from './PreviewCanvas';
import { RightPanel } from './RightPanel';
import Link from 'next/link';

export function PointillistApp() {
  return (
    <div className="h-screen flex flex-col bg-[#0d0d0f] overflow-hidden">
      {/* Top bar */}
      <header className="h-11 flex items-center px-5 gap-4 border-b border-white/5 bg-[#111113] flex-shrink-0">
        <Link href="/" className="text-zinc-600 hover:text-zinc-300 transition-colors text-xs">
          ← RasterLab
        </Link>
        <span className="text-white/10">|</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-[8px] text-white leading-none">⬤</span>
          </div>
          <span className="text-sm font-semibold text-white">Pointillist Generator</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 font-medium">
            V2.1
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-600">
          <span>Scroll wheel · Alt+drag to pan not supported · drop an image to start</span>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        <ControlPanel />
        <PreviewCanvas />
        <RightPanel />
      </div>
    </div>
  );
}
