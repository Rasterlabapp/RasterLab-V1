'use client';

import Link from 'next/link';
import { useEditorStore } from '@/store/editor-store';
import type { ViewMode } from '@/types';

const VIEW_MODES: { label: string; value: ViewMode }[] = [
  { label: 'Halftone', value: 'halftone' },
  { label: 'Grayscale', value: 'grayscale' },
  { label: 'Original', value: 'original' },
];

export function Toolbar() {
  const { viewMode, setViewMode, zoom, setZoom, resetView, undo, redo, historyIndex, history, showRuler, setShowRuler } =
    useEditorStore();

  return (
    <div className="flex items-center gap-4 px-4 h-11 bg-zinc-900 border-b border-zinc-800 text-sm">
      <span className="font-bold text-white tracking-tight mr-2">Curato Lab</span>
      <Link
        href="/pointillist"
        className="px-2.5 py-1 rounded text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Pointillist Generator"
      >
        ⬤ Pointillist
      </Link>
      <Link
        href="/patterns"
        className="px-2.5 py-1 rounded text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
        title="Pattern Engines"
      >
        ▦ Patterns
      </Link>
      <span className="text-zinc-600">|</span>

      {/* View mode */}
      <div className="flex gap-1">
        {VIEW_MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => setViewMode(m.value)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === m.value
                ? 'bg-indigo-600 text-white'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <span className="text-zinc-600">|</span>

      {/* Undo / Redo */}
      <button
        onClick={undo}
        disabled={historyIndex <= 0}
        className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Undo (Ctrl+Z)"
      >
        ↩ Undo
      </button>
      <button
        onClick={redo}
        disabled={historyIndex >= history.length - 1}
        className="px-2 py-1 rounded text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Redo (Ctrl+Y)"
      >
        ↪ Redo
      </button>

      <span className="text-zinc-600">|</span>

      {/* Zoom */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <button
          onClick={() => setZoom(zoom / 1.25)}
          className="w-6 h-6 rounded hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-center"
        >−</button>
        <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button
          onClick={() => setZoom(zoom * 1.25)}
          className="w-6 h-6 rounded hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-center"
        >+</button>
        <button
          onClick={resetView}
          className="px-2 py-0.5 rounded hover:bg-zinc-800 hover:text-white transition-colors"
        >Fit</button>
      </div>

      <span className="text-zinc-600">|</span>

      {/* Ruler toggle */}
      <button
        onClick={() => setShowRuler(!showRuler)}
        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
          showRuler
            ? 'bg-zinc-700 text-white'
            : 'text-zinc-500 hover:text-white hover:bg-zinc-800'
        }`}
        title="Toggle ruler"
      >
        ⊞ Ruler
      </button>
    </div>
  );
}
