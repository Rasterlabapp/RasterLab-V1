'use client';

import { useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { renderPointillistCore } from '@/lib/pointillist-engine';

type Tab = 'presets' | 'export';
type BgMode = 'white' | 'transparent';

// ─── RightPanel shell ─────────────────────────────────────────────────────────

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('presets');

  return (
    <aside className="w-52 flex flex-col bg-[#0f0f12] border-l border-white/[0.06] flex-shrink-0">

      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        {(['presets', 'export'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[10px] font-bold tracking-[0.1em] uppercase transition-all duration-150 relative ${
              tab === t ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'
            }`}
          >
            {t}
            {tab === t && (
              <span className="absolute bottom-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {tab === 'presets' && <PresetsTab />}
        {tab === 'export'  && <ExportTab />}
      </div>
    </aside>
  );
}

// ─── Presets tab ──────────────────────────────────────────────────────────────

const PRESET_ICONS: Record<string, string> = {
  impressionist: '🎨',
  seurat:        '⬤',
  stipple:       '✦',
  coarse:        '◉',
  'edge-only':   '◌',
  neon:          '✺',
};

function PresetsTab() {
  const { presets, activePresetId, loadPreset, addPreset, deletePreset } =
    usePointillistStore();
  const [newName, setNewName] = useState('');
  const [saving,  setSaving]  = useState(false);

  const save = () => {
    if (!newName.trim()) return;
    addPreset(newName.trim());
    setNewName('');
    setSaving(false);
  };

  const builtIn = presets.slice(0, 6);
  const custom  = presets.slice(6);

  return (
    <div className="p-3 flex flex-col gap-5">

      {/* Built-in */}
      <div className="flex flex-col gap-0.5">
        <SectionLabel>Built-in</SectionLabel>
        {builtIn.map((p) => (
          <PresetRow
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
        <div className="flex flex-col gap-0.5">
          <SectionLabel>Custom</SectionLabel>
          {custom.map((p) => (
            <PresetRow
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
      <div className="border-t border-white/[0.05] pt-4">
        {saving ? (
          <div className="flex gap-1.5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setSaving(false); }}
              placeholder="Preset name…"
              autoFocus
              className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
            />
            <button
              onClick={save}
              className="w-7 h-7 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex-shrink-0 flex items-center justify-center transition-colors"
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="w-full py-2 border border-dashed border-white/[0.08] hover:border-indigo-500/40 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-300 transition-all duration-150"
          >
            + Save current as preset
          </button>
        )}
      </div>
    </div>
  );
}

function PresetRow({ icon, name, active, onLoad, onDelete }: {
  icon: string; name: string; active: boolean;
  onLoad: () => void; onDelete?: () => void;
}) {
  return (
    <div
      onClick={onLoad}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all duration-150 ${
        active
          ? 'bg-indigo-600/[0.15] border border-indigo-500/25'
          : 'border border-transparent hover:bg-white/[0.04]'
      }`}
    >
      <span className={`text-xs flex-shrink-0 w-4 text-center ${active ? 'text-indigo-400' : 'text-zinc-600'}`}>
        {icon}
      </span>
      <span className={`flex-1 text-[11px] font-medium truncate ${active ? 'text-white' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
        {name}
      </span>
      {active && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />}
      {onDelete && !active && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs w-4 text-center transition-all duration-100"
          title="Delete preset"
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── Export tab ───────────────────────────────────────────────────────────────

function ExportTab() {
  const { sourceImage, settings } = usePointillistStore();
  const [bgMode,   setBgMode]   = useState<BgMode>('white');
  const [exporting, setExporting] = useState<null | '1x' | '2x'>(null);

  const runExport = async (scale: 1 | 2) => {
    if (!sourceImage || exporting) return;
    setExporting(scale === 1 ? '1x' : '2x');
    await new Promise<void>((r) => setTimeout(r, 16)); // yield to paint spinner

    try {
      const w = sourceImage.width  * scale;
      const h = sourceImage.height * scale;

      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = w; srcCanvas.height = h;
      srcCanvas.getContext('2d')!.drawImage(sourceImage, 0, 0, w, h);

      const pixelBuffer = srcCanvas.getContext('2d')!
        .getImageData(0, 0, w, h).data.buffer.slice(0);
      const pixels = new Uint8ClampedArray(pixelBuffer);

      const dst = document.createElement('canvas');
      dst.width = w; dst.height = h;
      const dstCtx = dst.getContext('2d')!;

      if (bgMode === 'white') {
        dstCtx.fillStyle = '#ffffff';
        dstCtx.fillRect(0, 0, w, h);
      }

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
    <div className="p-3 flex flex-col gap-5">

      {/* Background */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Background</SectionLabel>
        <div className="grid grid-cols-2 gap-1 p-[3px] bg-white/[0.04] rounded-lg border border-white/[0.06]">
          {(['white', 'transparent'] as BgMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setBgMode(m)}
              className={`py-1.5 rounded-md text-[10px] font-semibold transition-all duration-150 flex items-center justify-center gap-1.5 ${
                bgMode === m
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {m === 'white' ? (
                <><span className="w-2.5 h-2.5 rounded-sm bg-white border border-zinc-400/60 inline-block flex-shrink-0" />White</>
              ) : (
                <><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-zinc-400/60 inline-block flex-shrink-0" />Alpha</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Download PNG</SectionLabel>

        {/* 1× */}
        <ExportButton
          label="1×"
          dims={sourceImage ? `${sourceImage.width}×${sourceImage.height}` : null}
          loading={exporting === '1x'}
          disabled={disabled || exporting !== null}
          primary
          onClick={() => runExport(1)}
        />

        {/* 2× */}
        <ExportButton
          label="2×"
          dims={sourceImage ? `${sourceImage.width * 2}×${sourceImage.height * 2}` : null}
          loading={exporting === '2x'}
          disabled={disabled || exporting !== null}
          onClick={() => runExport(2)}
        />

        <p className="text-[10px] text-zinc-700 text-center">
          Re-rendered at export size
        </p>
      </div>

      {/* Summary */}
      {sourceImage && (
        <div className="border-t border-white/[0.05] pt-4 flex flex-col gap-2">
          <SectionLabel>Settings</SectionLabel>
          {[
            ['Mode',     settings.colorMode],
            ['Dot',      `${settings.dotSize}px`],
            ['Density',  `${settings.density}%`],
            ['Random',   `${settings.randomness}%`],
            ['Edge',     `${settings.edgeSensitivity}%`],
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

// ─── Shared primitives ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold tracking-[0.12em] uppercase text-zinc-600 px-1 mb-0.5">{children}</p>
  );
}

function ExportButton({ label, dims, loading, disabled, primary, onClick }: {
  label: string; dims: string | null; loading: boolean;
  disabled: boolean; primary?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-2.5 rounded-xl text-[11px] font-semibold transition-all duration-150 flex items-center justify-center gap-2
        disabled:opacity-30 disabled:cursor-not-allowed ${
        primary
          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-900/40'
          : 'bg-white/[0.06] hover:bg-white/[0.10] text-zinc-200 border border-white/[0.06]'
      }`}
    >
      {loading ? (
        <>
          <Spinner />
          <span>Exporting…</span>
        </>
      ) : (
        <>
          <span>↓ {label} PNG</span>
          {dims && <span className="opacity-40 font-normal text-[9px] tabular-nums">{dims}</span>}
        </>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/>
    </svg>
  );
}
