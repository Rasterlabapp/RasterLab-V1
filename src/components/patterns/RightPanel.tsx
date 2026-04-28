'use client';

import { useState, useRef } from 'react';
import { usePatternStore }   from '@/store/pattern-store';
import { ENGINE_LIST, renderPattern } from '@/lib/patterns/index';
import type { PatternPreset }  from '@/lib/patterns/index';

const C = {
  bg:     '#0e0e0e',
  border: '#1e1e1e',
  label:  '#888888',
};

// ── Preset card ─────────────────────────────────────────────────────────────
function PresetCard({
  preset, active, onLoad, onDelete,
}: {
  preset: PatternPreset;
  active: boolean;
  onLoad: () => void;
  onDelete?: () => void;
}) {
  const engineLabel = ENGINE_LIST.find((e) => e.id === preset.engine)?.label ?? preset.engine;
  return (
    <div
      onClick={onLoad}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        cursor: 'pointer',
        background:  active ? '#1a1a1a' : '#141414',
        border:      active ? '1px solid #333' : '1px solid #1c1c1c',
        transition:  'all 150ms',
        display:     'flex',
        alignItems:  'center',
        gap:         10,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = '#2a2a2a'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = '#1c1c1c'; }}
    >
      {/* Active dot */}
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: active ? '#ffffff' : '#333',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: active ? '#fff' : '#aaa', letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {preset.name}
        </p>
        <p style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{engineLabel}</p>
      </div>
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 2 }}
          title="Delete preset"
        >×</button>
      )}
    </div>
  );
}

// ── Export helpers ───────────────────────────────────────────────────────────
function exportPNG(sourceImage: HTMLCanvasElement | null, settings: ReturnType<typeof usePatternStore.getState>['settings'], scale: number) {
  if (!sourceImage) return;
  const w = sourceImage.width  * scale;
  const h = sourceImage.height * scale;

  // Scale source image to export resolution
  const scaledSrc = document.createElement('canvas');
  scaledSrc.width  = w;
  scaledSrc.height = h;
  scaledSrc.getContext('2d')!.drawImage(sourceImage, 0, 0, w, h);

  // Re-render at export size
  const out  = document.createElement('canvas');
  out.width  = w;
  out.height = h;
  const ctx  = out.getContext('2d')!;
  const pixels = scaledSrc.getContext('2d')!.getImageData(0, 0, w, h).data as unknown as Uint8ClampedArray;

  renderPattern({ ctx, pixels, width: w, height: h, settings });

  const link = document.createElement('a');
  link.href     = out.toDataURL('image/png');
  link.download = `curato-lab-patterns-${settings.engine}-${scale}x-${Date.now()}.png`;
  link.click();
}

// ── Main component ───────────────────────────────────────────────────────────
export function RightPanel() {
  const [tab, setTab] = useState<'presets' | 'export'>('presets');
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  const {
    presets, activePresetId, loadPreset, addPreset, deletePreset,
    sourceImage, settings, renderTimeMs,
  } = usePatternStore();

  const builtinIds = new Set(['editorial-maze','luxury-spiral','brutalist-worms','fashion-zebra','organic-coral','retro-fingerprint','poster-spots']);

  const handleSave = () => {
    const name = saveName.trim();
    if (!name) return;
    addPreset(name);
    setSaveName('');
    setSaveOpen(false);
  };

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      background: C.bg,
      borderLeft: `1px solid ${C.border}`,
    }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {(['presets', 'export'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '12px 0',
              fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              background: 'none', border: 'none', cursor: 'pointer',
              color:       tab === t ? '#ffffff' : '#444',
              borderBottom: tab === t ? '2px solid #ffffff' : '2px solid transparent',
              transition: 'all 150ms',
            }}
          >{t}</button>
        ))}
      </div>

      {/* Presets tab */}
      {tab === 'presets' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {presets.map((p) => (
              <PresetCard
                key={p.id}
                preset={p}
                active={p.id === activePresetId}
                onLoad={() => loadPreset(p.id)}
                onDelete={builtinIds.has(p.id) ? undefined : () => deletePreset(p.id)}
              />
            ))}
          </div>

          {/* Save current as preset */}
          <div style={{ marginTop: 16 }}>
            {saveOpen ? (
              <div style={{ display: 'flex', gap: 5 }}>
                <input
                  ref={nameRef}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setSaveOpen(false); }}
                  placeholder="Preset name"
                  autoFocus
                  style={{
                    flex: 1, background: '#141414', border: '1px solid #2a2a2a',
                    borderRadius: 6, color: '#fff', fontSize: 12, padding: '6px 9px',
                    outline: 'none',
                  }}
                />
                <button onClick={handleSave} style={{
                  background: '#ffffff', color: '#000', border: 'none',
                  borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                }}>Save</button>
              </div>
            ) : (
              <button
                onClick={() => setSaveOpen(true)}
                style={{
                  width: '100%', padding: '8px', borderRadius: 7,
                  background: 'none', border: '1px dashed #2a2a2a',
                  color: '#444', fontSize: 11, cursor: 'pointer',
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#666'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#444'; }}
              >
                + Save current as preset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Export tab */}
      {tab === 'export' && (
        <div style={{ flex: 1, padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Render info */}
          {renderTimeMs > 0 && (
            <p style={{ fontSize: 10, color: '#333', letterSpacing: '0.04em' }}>
              Last render: {renderTimeMs.toFixed(0)} ms
            </p>
          )}

          <p style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>Export PNG</p>

          {(['1x', '2x', '4x'] as const).map((label, i) => {
            const scale = [1, 2, 4][i];
            return (
              <button
                key={label}
                onClick={() => exportPNG(sourceImage, settings, scale)}
                disabled={!sourceImage}
                style={{
                  width: '100%', padding: '10px',
                  borderRadius: 7,
                  border: i === 0 ? 'none' : '1px solid #242424',
                  background: i === 0 ? '#ffffff' : '#161616',
                  color:      i === 0 ? '#000000' : '#666666',
                  fontSize: 12, fontWeight: 700,
                  cursor: sourceImage ? 'pointer' : 'not-allowed',
                  opacity: sourceImage ? 1 : 0.4,
                  letterSpacing: '0.02em',
                  transition: 'opacity 150ms',
                }}
              >
                Export {label}
              </button>
            );
          })}

          <div style={{ height: 1, background: C.border, margin: '4px 0' }} />

          <p style={{ fontSize: 10, color: '#333', lineHeight: 1.5 }}>
            Exports a crisp black-and-white PNG at the selected resolution multiplier.
          </p>
        </div>
      )}
    </aside>
  );
}
