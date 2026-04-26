'use client';

import { useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { renderPointillistCore } from '@/lib/pointillist-engine';

type Tab = 'presets' | 'export';

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('presets');

  return (
    <aside className="w-56 flex flex-col bg-[#111113] border-l border-white/5">
      {/* Tab bar */}
      <div className="flex border-b border-white/5 flex-shrink-0">
        {(['presets', 'export'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[11px] font-semibold capitalize tracking-wide transition-colors ${
              tab === t
                ? 'text-white border-b-2 border-indigo-500'
                : 'text-zinc-600 hover:text-zinc-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === 'presets' && <PresetsTab />}
        {tab === 'export' && <ExportTab />}
      </div>
    </aside>
  );
}

// ─── Presets ─────────────────────────────────────────────────────────────────

const PRESET_ICONS: Record<string, string> = {
  impressionist: '🎨',
  seurat: '⬤',
  stipple: '✦',
  coarse: '◉',
  'edge-only': '◌',
  neon: '✺',
};

function PresetsTab() {
  const { presets, activePresetId, loadPreset, addPreset, deletePreset, settings } =
    usePointillistStore();
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = () => {
    if (!newName.trim()) return;
    addPreset(newName.trim());
    setNewName('');
    setSaving(false);
  };

  const builtIn = presets.filter((p) => !p.id.includes('-') || p.id.length < 20);
  const custom = presets.filter((p) => p.id.length >= 20);

  return (
    <div className="p-4 flex flex-col gap-4">

      {/* Built-in */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Built-in</span>
        {presets.slice(0, 6).map((p) => (
          <PresetCard
            key={p.id}
            icon={PRESET_ICONS[p.id] ?? '⬤'}
            name={p.name}
            active={activePresetId === p.id}
            onLoad={() => loadPreset(p.id)}
          />
        ))}
      </div>

      {/* Custom */}
      {custom.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Custom</span>
          {custom.map((p) => (
            <PresetCard
              key={p.id}
              icon="◈"
              name={p.name}
              active={activePresetId === p.id}
              onLoad={() => loadPreset(p.id)}
              onDelete={() => deletePreset(p.id)}
            />
          ))}
        </div>
      )}

      {/* Save current */}
      <div className="border-t border-white/5 pt-4">
        {saving ? (
          <div className="flex gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="Preset name…"
              autoFocus
              className="flex-1 bg-zinc-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
            <button
              onClick={save}
              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium"
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="w-full py-2 border border-dashed border-white/10 hover:border-indigo-500/50 rounded-lg text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            + Save current as preset
          </button>
        )}
      </div>
    </div>
  );
}

function PresetCard({
  icon, name, active, onLoad, onDelete,
}: {
  icon: string; name: string; active: boolean;
  onLoad: () => void; onDelete?: () => void;
}) {
  return (
    <div
      onClick={onLoad}
      className={`group flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
        active
          ? 'bg-indigo-600/20 border border-indigo-500/30'
          : 'hover:bg-white/5 border border-transparent'
      }`}
    >
      <span className={`text-sm flex-shrink-0 ${active ? 'text-indigo-400' : 'text-zinc-500'}`}>
        {icon}
      </span>
      <span className={`flex-1 text-xs font-medium truncate ${active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
        {name}
      </span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

type BgMode = 'white' | 'transparent';

function ExportTab() {
  const { sourceImage, settings } = usePointillistStore();
  const [bgMode, setBgMode] = useState<BgMode>('white');
  const [exporting, setExporting] = useState<null | '1x' | '2x'>(null);

  const runExport = async (scale: 1 | 2) => {
    if (!sourceImage || exporting) return;
    const key = scale === 1 ? '1x' : '2x';
    setExporting(key);

    // Yield to let the UI update (spinner visible) before heavy work
    await new Promise<void>((r) => setTimeout(r, 16));

    try {
      const w = sourceImage.width  * scale;
      const h = sourceImage.height * scale;

      // Scale source pixels
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w; srcCanvas.height = h;
      srcCanvas.getContext('2d')!.drawImage(sourceImage, 0, 0, w, h);
      const pixelBuffer = srcCanvas
        .getContext('2d')!
        .getImageData(0, 0, w, h)
        .data.buffer.slice(0);
      const pixels = new Uint8ClampedArray(pixelBuffer);

      // Render into an OffscreenCanvas (off the main thread would need a dedicated
      // worker message, so we use the synchronous core directly here — the export
      // path is a one-shot, not the preview loop)
      const dst = document.createElement('canvas');
      dst.width = w; dst.height = h;
      const dstCtx = dst.getContext('2d')!;

      // Background
      if (bgMode === 'white') {
        dstCtx.fillStyle = '#ffffff';
        dstCtx.fillRect(0, 0, w, h);
      }
      // globalCompositeOperation stays 'source-over' — transparent areas remain transparent

      renderPointillistCore(
        pixels, w, h,
        { ...settings, dotSize: settings.dotSize * scale, backgroundColor: bgMode === 'white' ? '#ffffff' : 'transparent' },
        dstCtx,
      );

      await new Promise<void>((resolve) => {
        dst.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pointillist-${settings.colorMode}-${scale}x-${bgMode}-${Date.now()}.png`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }
          resolve();
        }, 'image/png');
      });
    } finally {
      setExporting(null);
    }
  };

  const disabled = !sourceImage;

  return (
    <div className="p-4 flex flex-col gap-5">

      {/* Background toggle */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Background</span>
        <div className="grid grid-cols-2 gap-1">
          {(['white', 'transparent'] as BgMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setBgMode(m)}
              className={`py-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                bgMode === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {m === 'white' ? (
                <>
                  <span className="w-3 h-3 rounded-sm bg-white border border-zinc-500 inline-block" />
                  White
                </>
              ) : (
                <>
                  <span className="w-3 h-3 rounded-sm border border-dashed border-zinc-400 inline-block" />
                  Alpha
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Export buttons */}
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Download PNG</span>

        {/* 1× */}
        <button
          onClick={() => runExport(1)}
          disabled={disabled || exporting !== null}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-150
            bg-gradient-to-r from-indigo-600 to-purple-600
            hover:from-indigo-500 hover:to-purple-500
            disabled:opacity-30 disabled:cursor-not-allowed
            text-white shadow-lg shadow-indigo-900/40 flex items-center justify-center gap-2"
        >
          {exporting === '1x' ? (
            <><Spinner />Exporting…</>
          ) : (
            <>↓ 1× PNG{sourceImage && <span className="opacity-60 font-normal">{' '}({sourceImage.width}×{sourceImage.height})</span>}</>
          )}
        </button>

        {/* 2× */}
        <button
          onClick={() => runExport(2)}
          disabled={disabled || exporting !== null}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-150
            bg-zinc-800 hover:bg-zinc-700
            disabled:opacity-30 disabled:cursor-not-allowed
            text-zinc-200 flex items-center justify-center gap-2"
        >
          {exporting === '2x' ? (
            <><Spinner />Exporting…</>
          ) : (
            <>↓ 2× PNG{sourceImage && <span className="opacity-50 font-normal">{' '}({sourceImage.width * 2}×{sourceImage.height * 2})</span>}</>
          )}
        </button>

        <p className="text-[10px] text-zinc-700 text-center mt-0.5">
          Rendered fresh at export size
        </p>
      </div>

      {/* Settings summary */}
      {sourceImage && (
        <div className="border-t border-white/5 pt-4 flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Summary</span>
          {[
            ['Mode', settings.colorMode],
            ['Dot size', `${settings.dotSize}px`],
            ['Density', `${settings.density}%`],
            ['Randomness', `${settings.randomness}%`],
            ['Edge sens.', `${settings.edgeSensitivity}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-600">{k}</span>
              <span className="text-[10px] font-mono text-zinc-400">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-3 h-3 text-white" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}
