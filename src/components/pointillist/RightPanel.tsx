'use client';

import { useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { renderPointillistCore } from '@/lib/pointillist-engine';

type Tab    = 'presets' | 'export';
type BgMode = 'white' | 'transparent';

// ─── RightPanel shell ─────────────────────────────────────────────────────────

export function RightPanel() {
  const [tab, setTab] = useState<Tab>('presets');

  return (
    <aside
      className="w-56 flex flex-col flex-shrink-0"
      style={{ background: '#111111', borderLeft: '1px solid #1e1e1e' }}
    >
      {/* Tab bar */}
      <div
        className="flex flex-shrink-0"
        style={{ borderBottom: '1px solid #1e1e1e' }}
      >
        {(['presets', 'export'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 h-11 relative transition-colors duration-150"
            style={{
              color: tab === t ? '#ffffff' : '#444444',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
            onMouseEnter={(e) => {
              if (tab !== t) (e.currentTarget as HTMLButtonElement).style.color = '#888888';
            }}
            onMouseLeave={(e) => {
              if (tab !== t) (e.currentTarget as HTMLButtonElement).style.color = '#444444';
            }}
          >
            {t}
            {tab === t && (
              <span
                className="absolute bottom-0 inset-x-0 h-[1.5px] rounded-full"
                style={{ background: '#ffffff' }}
              />
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
  impressionist: '⬤',
  seurat:        '⬤',
  stipple:       '⬤',
  coarse:        '⬤',
  'edge-only':   '⬤',
  neon:          '⬤',
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
    <div className="p-4 flex flex-col gap-6">

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
      <div className="pt-1" style={{ borderTop: '1px solid #1a1a1a' }}>
        {saving ? (
          <div className="flex gap-2 pt-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter')  save();
                if (e.key === 'Escape') setSaving(false);
              }}
              placeholder="Preset name…"
              autoFocus
              className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[12px] text-white focus:outline-none transition-colors"
              style={{
                background: '#1a1a1a',
                border:     '1px solid #333333',
              }}
            />
            <button
              onClick={save}
              className="w-8 h-8 rounded-lg text-sm font-bold flex-shrink-0 flex items-center justify-center transition-colors"
              style={{ background: '#ffffff', color: '#000000' }}
            >
              ✓
            </button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="w-full mt-4 py-2.5 rounded-lg text-[11px] font-medium transition-all duration-150"
            style={{
              border: '1px dashed #2a2a2a',
              color:  '#444444',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#555555';
              (e.currentTarget as HTMLButtonElement).style.color = '#888888';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#2a2a2a';
              (e.currentTarget as HTMLButtonElement).style.color = '#444444';
            }}
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
      className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150"
      style={{
        background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
        border:     `1px solid ${active ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)';
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent';
      }}
    >
      {/* Dot indicator */}
      <span
        className="flex-shrink-0 w-[5px] h-[5px] rounded-full"
        style={{ background: active ? '#ffffff' : '#333333' }}
      />
      <span
        className="flex-1 text-[12px] font-medium truncate"
        style={{ color: active ? '#ffffff' : '#666666' }}
      >
        {name}
      </span>
      {onDelete && !active && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-[14px] w-5 text-center transition-all duration-100"
          style={{ color: '#555555' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#cc4444')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#555555')}
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
  const [bgMode,    setBgMode]    = useState<BgMode>('white');
  const [exporting, setExporting] = useState<null | '1x' | '2x'>(null);

  const runExport = async (scale: 1 | 2) => {
    if (!sourceImage || exporting) return;
    setExporting(scale === 1 ? '1x' : '2x');
    await new Promise<void>((r) => setTimeout(r, 16));

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
            const a   = document.createElement('a');
            a.href     = url;
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
    <div className="p-4 flex flex-col gap-6">

      {/* Background */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Background</SectionLabel>
        <div
          className="flex p-[3px] rounded-lg gap-[3px]"
          style={{ background: '#161616', border: '1px solid #282828' }}
        >
          {(['white', 'transparent'] as BgMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setBgMode(m)}
              className="flex-1 py-2 rounded-md text-[11px] font-semibold transition-all duration-150 flex items-center justify-center gap-1.5"
              style={
                bgMode === m
                  ? { background: '#ffffff', color: '#000000' }
                  : { color: '#555555' }
              }
              onMouseEnter={(e) => {
                if (bgMode !== m) (e.currentTarget as HTMLButtonElement).style.color = '#aaaaaa';
              }}
              onMouseLeave={(e) => {
                if (bgMode !== m) (e.currentTarget as HTMLButtonElement).style.color = '#555555';
              }}
            >
              {m === 'white' ? (
                <>
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0"
                    style={{ background: '#ffffff', border: '1px solid #aaaaaa' }}
                  />
                  White
                </>
              ) : (
                <>
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0"
                    style={{ border: '1px dashed #666666' }}
                  />
                  Alpha
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Download */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Download PNG</SectionLabel>

        <ExportButton
          label="1×"
          dims={sourceImage ? `${sourceImage.width}×${sourceImage.height}` : null}
          loading={exporting === '1x'}
          disabled={disabled || exporting !== null}
          primary
          onClick={() => runExport(1)}
        />

        <ExportButton
          label="2×"
          dims={sourceImage ? `${sourceImage.width * 2}×${sourceImage.height * 2}` : null}
          loading={exporting === '2x'}
          disabled={disabled || exporting !== null}
          onClick={() => runExport(2)}
        />

        <p className="text-[10px] text-center" style={{ color: '#333333' }}>
          Re-rendered at export size
        </p>
      </div>

      {/* Settings summary */}
      {sourceImage && (
        <div className="flex flex-col gap-3" style={{ borderTop: '1px solid #1a1a1a', paddingTop: 20 }}>
          <SectionLabel>Current Settings</SectionLabel>
          {[
            ['Mode',     settings.colorMode],
            ['Dot',      `${settings.dotSize}px`],
            ['Density',  `${settings.density}%`],
            ['Random',   `${settings.randomness}%`],
            ['Edge',     `${settings.edgeSensitivity}%`],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: '#444444' }}>{k}</span>
              <span className="text-[11px] font-mono font-medium" style={{ color: '#777777' }}>{v}</span>
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
    <p
      className="text-[10px] font-bold tracking-[0.13em] uppercase"
      style={{ color: '#444444' }}
    >
      {children}
    </p>
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
      className="w-full py-3 rounded-xl text-[12px] font-semibold transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-25 disabled:cursor-not-allowed"
      style={
        primary
          ? { background: '#ffffff', color: '#000000' }
          : { background: '#1a1a1a', color: '#888888', border: '1px solid #2a2a2a' }
      }
      onMouseEnter={(e) => {
        if (disabled) return;
        const btn = e.currentTarget as HTMLButtonElement;
        if (primary) { btn.style.background = '#e0e0e0'; }
        else         { btn.style.background = '#222222'; btn.style.color = '#aaaaaa'; }
      }}
      onMouseLeave={(e) => {
        if (disabled) return;
        const btn = e.currentTarget as HTMLButtonElement;
        if (primary) { btn.style.background = '#ffffff'; }
        else         { btn.style.background = '#1a1a1a'; btn.style.color = '#888888'; }
      }}
    >
      {loading ? (
        <>
          <Spinner />
          <span>Exporting…</span>
        </>
      ) : (
        <>
          <span>↓ {label} PNG</span>
          {dims && (
            <span className="font-normal text-[10px] tabular-nums" style={{ opacity: 0.4 }}>
              {dims}
            </span>
          )}
        </>
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
      <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/>
    </svg>
  );
}
