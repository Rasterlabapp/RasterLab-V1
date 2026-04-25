'use client';

import { useEditorStore } from '@/store/editor-store';

export function StatusBar() {
  const { renderTimeMs, zoom, sourceImage, settings } = useEditorStore();

  return (
    <div className="h-7 bg-zinc-950 border-t border-zinc-800 flex items-center px-4 gap-6 text-xs text-zinc-600">
      {sourceImage && (
        <>
          <span>{sourceImage.width} × {sourceImage.height}px</span>
          <span>|</span>
        </>
      )}
      <span>Zoom {Math.round(zoom * 100)}%</span>
      <span>|</span>
      <span>Mode: {settings.mode}</span>
      {settings.cmykMode && <><span>|</span><span className="text-indigo-400">CMYK</span></>}
      <span className="ml-auto">{renderTimeMs > 0 ? `${renderTimeMs}ms` : '—'}</span>
    </div>
  );
}
