'use client';

import { useState, useRef } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { renderPointillist } from '@/lib/pointillist-engine';

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

function ExportTab() {
  const { sourceImage, settings } = usePointillistStore();
  const [scale, setScale] = useState(1);
  const [exporting, setExporting] = useState(false);

  const exportPNG = async () => {
    if (!sourceImage || exporting) return;
    setExporting(true);

    // Render at higher resolution if scale > 1
    const scaledSrc = document.createElement('canvas');
    scaledSrc.width = sourceImage.width * scale;
    scaledSrc.height = sourceImage.height * scale;
    scaledSrc.getContext('2d')!.drawImage(sourceImage, 0, 0, scaledSrc.width, scaledSrc.height);

    const dst = document.createElement('canvas');
    await new Promise<void>((r) => setTimeout(r, 0)); // yield
    renderPointillist(scaledSrc, dst, { ...settings, dotSize: settings.dotSize * scale });

    dst.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pointillist-${settings.colorMode}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
      setExporting(false);
    }, 'image/png');
  };

  const disabled = !sourceImage;

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Resolution</span>
        <div className="grid grid-cols-3 gap-1">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => setScale(s)}
              className={`py-2 rounded-lg text-xs font-medium transition-all ${
                scale === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        {sourceImage && (
          <p className="text-[10px] text-zinc-600 text-center">
            {sourceImage.width * scale} × {sourceImage.height * scale}px
          </p>
        )}
      </div>

      <div className="border-t border-white/5 pt-4 flex flex-col gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Format</span>

        <button
          onClick={exportPNG}
          disabled={disabled || exporting}
          className="w-full py-2.5 rounded-xl text-xs font-semibold transition-all duration-150
            bg-gradient-to-r from-indigo-600 to-purple-600
            hover:from-indigo-500 hover:to-purple-500
            disabled:opacity-30 disabled:cursor-not-allowed
            text-white shadow-lg shadow-indigo-900/40"
        >
          {exporting ? 'Exporting…' : '↓ Export PNG'}
        </button>

        <p className="text-[10px] text-zinc-700 text-center mt-1">
          Rendered fresh at export resolution
        </p>
      </div>

      {/* Export info */}
      {sourceImage && (
        <div className="border-t border-white/5 pt-4 flex flex-col gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mb-1">Summary</span>
          {[
            ['Mode', settings.colorMode],
            ['Dot size', `${settings.dotSize}px`],
            ['Density', `${settings.density}%`],
            ['Randomness', `${settings.randomness}%`],
            ['Edge sens.', `${settings.edgeSensitivity}%`],
            ['Background', settings.backgroundColor],
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
