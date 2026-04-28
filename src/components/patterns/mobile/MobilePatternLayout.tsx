'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { usePatternStore }    from '@/store/pattern-store';
import { usePatternRenderer } from '@/hooks/usePatternRenderer';
import { BottomSheet }        from '../../pointillist/mobile/BottomSheet';
import { ENGINE_LIST, renderPattern, BUILTIN_PRESETS } from '@/lib/patterns/index';
import type { EngineId, PatternSettings } from '@/lib/patterns/types';
import { clamp } from '@/lib/patterns/utils';

// ── Design tokens ─────────────────────────────────────────────────────────
const BG   = '#0a0a0a';
const CARD = '#131313';
const BORDER = '#1e1e1e';

// ── Image loader ──────────────────────────────────────────────────────────
function loadFile(file: File): Promise<HTMLCanvasElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d')!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url); res(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(); };
    img.src = url;
  });
}

// ── Mobile slider ─────────────────────────────────────────────────────────
function MSlider({ label, value, min, max, step = 1, format, onChange }: {
  label: string; value: number; min: number; max: number; step?: number;
  format?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: '10px 20px', borderBottom: `1px solid ${BORDER}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#aaa' }}>{label}</span>
        <span style={{ fontSize: 13, color: '#fff', fontFamily: 'monospace', fontWeight: 600 }}>
          {format ? format(value) : Math.round(value)}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#fff', height: 4, cursor: 'pointer' }}
      />
    </div>
  );
}

// ── Engine row ────────────────────────────────────────────────────────────
function EngineRow({ engine, active, onSelect }: { engine: typeof ENGINE_LIST[0]; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      style={{
        width: '100%', padding: '16px 20px', textAlign: 'left',
        background: active ? '#1a1a1a' : 'none',
        border: 'none', borderBottom: `1px solid ${BORDER}`,
        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: active ? '#ffffff' : '#333',
      }} />
      <div>
        <p style={{ fontSize: 15, fontWeight: 700, color: active ? '#fff' : '#aaa' }}>{engine.label}</p>
        <p style={{ fontSize: 11, color: '#444', marginTop: 2 }}>{engine.description}</p>
      </div>
    </button>
  );
}

// ── Controls for active engine (mobile) ──────────────────────────────────
function MobileControls({ settings, set }: { settings: PatternSettings; set: (p: Partial<PatternSettings>) => void }) {
  const p  = (v: number) => `${Math.round(v)}%`;
  const px = (v: number) => `${v.toFixed(1)}px`;
  const f1 = (v: number) => v.toFixed(1);

  switch (settings.engine) {
    case 'serpentines': return (<>
      <MSlider label="Density"    value={settings.density}    min={10} max={90}  onChange={(v) => set({ density: v })} format={p} />
      <MSlider label="Flow"       value={settings.flow}       min={0}  max={100} onChange={(v) => set({ flow: v })} format={p} />
      <MSlider label="Thickness"  value={settings.thickness}  min={0.5} max={6} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
      <MSlider label="Turbulence" value={settings.turbulence} min={0}  max={100} onChange={(v) => set({ turbulence: v })} format={p} />
      <MSlider label="Scale"      value={settings.scale}      min={0.5} max={4} step={0.1} onChange={(v) => set({ scale: v })} format={f1} />
    </>);
    case 'spirals': return (<>
      <MSlider label="Spacing"   value={settings.spacing}   min={15} max={80} onChange={(v) => set({ spacing: v })} format={px} />
      <MSlider label="Radius"    value={settings.radius}    min={10} max={60} onChange={(v) => set({ radius: v })} format={px} />
      <MSlider label="Arms"      value={settings.arms}      min={1}  max={5} step={1} onChange={(v) => set({ arms: v })} />
      <MSlider label="Wrap"      value={settings.wrap}      min={0.5} max={5} step={0.1} onChange={(v) => set({ wrap: v })} format={f1} />
      <MSlider label="Thickness" value={settings.thickness} min={0.5} max={4} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
    </>);
    case 'maze': return (<>
      <MSlider label="Path Width"  value={settings.pathWidth}  min={2} max={18} onChange={(v) => set({ pathWidth: v })} format={px} />
      <MSlider label="Complexity"  value={settings.complexity} min={1} max={100} onChange={(v) => set({ complexity: v })} format={p} />
      <MSlider label="Sharpness"   value={settings.sharpness}  min={0} max={100} onChange={(v) => set({ sharpness: v })} format={p} />
    </>);
    case 'spots': return (<>
      <MSlider label="Blob Size" value={settings.blobSize} min={3} max={30} onChange={(v) => set({ blobSize: v })} format={px} />
      <MSlider label="Spread"    value={settings.spread}   min={0} max={100} onChange={(v) => set({ spread: v })} format={p} />
      <MSlider label="Softness"  value={settings.softness} min={0} max={100} onChange={(v) => set({ softness: v })} format={p} />
      <MSlider label="Density"   value={settings.density}  min={10} max={90} onChange={(v) => set({ density: v })} format={p} />
    </>);
    case 'worms': return (<>
      <MSlider label="Density"      value={settings.density}      min={10} max={90} onChange={(v) => set({ density: v })} format={p} />
      <MSlider label="Length"       value={settings.length}       min={20} max={200} onChange={(v) => set({ length: v })} />
      <MSlider label="Thickness"    value={settings.thickness}    min={0.5} max={6} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
      <MSlider label="Motion Curve" value={settings.motionCurve}  min={0} max={100} onChange={(v) => set({ motionCurve: v })} format={p} />
    </>);
    case 'fingerprints': return (<>
      <MSlider label="Ring Spacing" value={settings.ringSpacing} min={3} max={24} onChange={(v) => set({ ringSpacing: v })} format={px} />
      <MSlider label="Distortion"   value={settings.distortion}  min={0} max={100} onChange={(v) => set({ distortion: v })} format={p} />
      <MSlider label="Density"      value={settings.density}     min={10} max={90} onChange={(v) => set({ density: v })} format={p} />
      <MSlider label="Thickness"    value={settings.thickness}   min={0.5} max={4} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
    </>);
    case 'coral': return (<>
      <MSlider label="Branching"  value={settings.branching}  min={1} max={7} step={1} onChange={(v) => set({ branching: v })} />
      <MSlider label="Thickness"  value={settings.thickness}  min={0.5} max={6} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
      <MSlider label="Spread"     value={settings.spread2}    min={0} max={100} onChange={(v) => set({ spread2: v })} format={p} />
      <MSlider label="Density"    value={settings.density}    min={10} max={90} onChange={(v) => set({ density: v })} format={p} />
    </>);
    case 'zebra': return (<>
      <MSlider label="Stripe Width" value={settings.stripeWidth} min={1} max={20} onChange={(v) => set({ stripeWidth: v })} />
      <MSlider label="Bend"         value={settings.bend}        min={0} max={100} onChange={(v) => set({ bend: v })} format={p} />
      <MSlider label="Contrast"     value={settings.contrast}    min={0} max={100} onChange={(v) => set({ contrast: v })} format={p} />
    </>);
    case 'bubbles': return (<>
      <MSlider label="Bubble Size" value={settings.bubbleSize} min={4} max={40} onChange={(v) => set({ bubbleSize: v })} format={px} />
      <MSlider label="Packing"     value={settings.packing}    min={20} max={100} onChange={(v) => set({ packing: v })} format={p} />
      <MSlider label="Randomness"  value={settings.randomness} min={0} max={100} onChange={(v) => set({ randomness: v })} format={p} />
      <MSlider label="Thickness"   value={settings.thickness}  min={0.5} max={4} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
    </>);
    case 'noiseGrid': return (<>
      <MSlider label="Noise Scale" value={settings.noiseScale}    min={2}  max={40} onChange={(v) => set({ noiseScale: v })} format={px} />
      <MSlider label="Contrast"    value={settings.noiseContrast} min={0}  max={100} onChange={(v) => set({ noiseContrast: v })} format={p} />
      <MSlider label="Density"     value={settings.density}       min={10} max={90} onChange={(v) => set({ density: v })} format={p} />
    </>);
  }
}

// ── Main layout ───────────────────────────────────────────────────────────
export function MobilePatternLayout() {
  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);
  const cameraRef      = useRef<HTMLInputElement>(null);

  const [sheet, setSheet]       = useState<'engine' | 'controls' | 'export' | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const { settings, setSettings, setSourceImage, sourceImage, loadPreset, presets, activePresetId } = usePatternStore();

  const { scheduleRender } = usePatternRenderer(canvasRef, {
    onRenderStart: () => setRendering(true),
    onRenderDone:  () => setRendering(false),
    onRenderError: () => setRendering(false),
  });

  useEffect(() => {
    if (sourceImage) scheduleRender(sourceImage, settings);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImage, settings]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const canvas = await loadFile(file);
      setSourceImage(canvas);
    } catch {
      setError('Could not load image. Please try another file.');
    }
  }, [setSourceImage]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  };

  const engineLabel = ENGINE_LIST.find((e) => e.id === settings.engine)?.label ?? settings.engine;

  // Export PNG
  const exportPNG = (scale: number) => {
    if (!sourceImage) return;
    const w = sourceImage.width * scale;
    const h = sourceImage.height * scale;
    const scaledSrc = document.createElement('canvas');
    scaledSrc.width = w; scaledSrc.height = h;
    scaledSrc.getContext('2d')!.drawImage(sourceImage, 0, 0, w, h);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d')!;
    const pixels = scaledSrc.getContext('2d')!.getImageData(0, 0, w, h).data as unknown as Uint8ClampedArray;
    renderPattern({ ctx, pixels, width: w, height: h, settings });
    const png = out.toDataURL('image/png');

    if (navigator.share) {
      out.toBlob((blob) => {
        if (!blob) return;
        navigator.share({ files: [new File([blob], `curato-patterns-${settings.engine}.png`, { type: 'image/png' })] })
          .catch(() => fallbackDownload(png));
      });
    } else {
      fallbackDownload(png);
    }
  };

  const fallbackDownload = (dataUrl: string) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `curato-lab-patterns-${settings.engine}-${Date.now()}.png`;
    a.click();
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: BG, overflow: 'hidden' }}>

      {/* Header */}
      <header style={{
        height: 52,
        paddingTop: 'env(safe-area-inset-top)',
        background: '#111111',
        borderBottom: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center',
        padding: '0 16px',
        gap: 10, flexShrink: 0,
      }}>
        {/* Wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 14 14" width="12" height="12" fill="#000">
              <circle cx="3" cy="3" r="1.55"/><circle cx="7" cy="3" r="1.1"/>
              <circle cx="11" cy="3" r="0.7"/><circle cx="3" cy="7" r="1.1"/>
              <circle cx="7" cy="7" r="1.55"/><circle cx="11" cy="7" r="1.1"/>
              <circle cx="3" cy="11" r="0.7"/><circle cx="7" cy="11" r="1.1"/>
              <circle cx="11" cy="11" r="1.55"/>
            </svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Curato</span>
          <span style={{ fontSize: 14, fontWeight: 300, color: '#555' }}>Lab</span>
          <span style={{ fontSize: 10, color: '#444', marginLeft: 2 }}>· Patterns</span>
        </div>

        {/* Header actions */}
        {sourceImage ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => fileRef.current?.click()}
              style={{ background: '#1e1e1e', border: '1px solid #2a2a2a', color: '#aaa', borderRadius: 7, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
            >Change</button>
            <button
              onClick={() => { setSourceImage(null); }}
              style={{ background: 'none', border: '1px solid #2a2a2a', color: '#555', borderRadius: 7, padding: '6px 10px', fontSize: 16, lineHeight: 1, cursor: 'pointer' }}
            >×</button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            style={{ background: '#ffffff', color: '#000', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >+ Add Image</button>
        )}
      </header>

      {/* Canvas area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', padding: 12 }}>
        {sourceImage ? (
          <>
            <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }} />
            {rendering && (
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                background: '#111', border: '1px solid #2a2a2a', borderRadius: 20,
                padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                <span style={{ fontSize: 11, color: '#888' }}>Rendering…</span>
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div style={{
            width: '90%', maxWidth: 340,
            border: '2px dashed rgba(255,255,255,0.12)',
            borderRadius: 16, padding: '40px 24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
            animation: 'fadeIn 300ms ease',
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>Add Image</p>
              <p style={{ fontSize: 13, color: '#555', marginTop: 6 }}>Upload a photo to generate patterns</p>
            </div>
            {error && (
              <div style={{ background: 'rgba(200,50,50,0.12)', border: '1px solid rgba(200,50,50,0.3)', borderRadius: 8, padding: '10px 14px', width: '100%' }}>
                <p style={{ fontSize: 12, color: '#e88', textAlign: 'center' }}>{error}</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
              <button onClick={() => fileRef.current?.click()} style={{
                height: 52, borderRadius: 12, background: '#fff', color: '#000',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
              }}>Upload Image</button>
              <button onClick={() => cameraRef.current?.click()} style={{
                height: 52, borderRadius: 12, background: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#888', fontSize: 15, cursor: 'pointer',
              }}>Use Camera</button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{
        flexShrink: 0,
        background: '#111',
        borderTop: `1px solid ${BORDER}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {sourceImage ? (
          <div style={{ display: 'flex', height: 56 }}>
            {[
              { key: 'engine',   label: engineLabel },
              { key: 'controls', label: 'Controls' },
              { key: 'export',   label: 'Export' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setSheet(sheet === key as typeof sheet ? null : key as typeof sheet)}
                style={{
                  flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                  color: sheet === key ? '#fff' : '#555',
                  borderTop: sheet === key ? '2px solid #fff' : '2px solid transparent',
                  transition: 'all 150ms', textTransform: 'uppercase',
                }}
              >{label}</button>
            ))}
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', height: 56,
              background: '#fff', color: '#000',
              border: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer',
            }}
          >Add Image</button>
        )}
      </div>

      {/* ── Bottom sheets ──────────────────────────────────────────── */}

      {/* Engine picker sheet */}
      <BottomSheet isOpen={sheet === 'engine'} onClose={() => setSheet(null)} title="Pattern Engine" maxHeight="75dvh">
        {ENGINE_LIST.map((engine) => (
          <EngineRow
            key={engine.id}
            engine={engine}
            active={settings.engine === engine.id}
            onSelect={() => { setSettings({ engine: engine.id as EngineId }); setSheet(null); }}
          />
        ))}
      </BottomSheet>

      {/* Controls sheet */}
      <BottomSheet isOpen={sheet === 'controls'} onClose={() => setSheet(null)} title={`${engineLabel} Controls`} maxHeight="85dvh">
        <MobileControls settings={settings} set={setSettings} />
        {/* Invert toggle */}
        <div style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#aaa' }}>Invert</span>
          <button
            onClick={() => setSettings({ invert: !settings.invert })}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
              background: settings.invert ? '#fff' : '#2a2a2a',
              position: 'relative', transition: 'background 200ms',
            }}
          >
            <span style={{
              position: 'absolute', top: 4,
              left: settings.invert ? 22 : 4,
              width: 16, height: 16, borderRadius: '50%',
              background: settings.invert ? '#000' : '#666',
              transition: 'left 200ms',
            }} />
          </button>
        </div>

        {/* Presets quick-load */}
        <div style={{ padding: '12px 20px 4px', borderTop: `1px solid ${BORDER}` }}>
          <p style={{ fontSize: 10, color: '#444', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Presets</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12 }}>
            {presets.filter((p) => p.engine === settings.engine).map((p) => (
              <button
                key={p.id}
                onClick={() => loadPreset(p.id)}
                style={{
                  padding: '10px 12px', borderRadius: 8, textAlign: 'left',
                  background: p.id === activePresetId ? '#1e1e1e' : '#161616',
                  border: `1px solid ${p.id === activePresetId ? '#333' : '#1e1e1e'}`,
                  color: p.id === activePresetId ? '#fff' : '#888',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >{p.name}</button>
            ))}
          </div>
        </div>
      </BottomSheet>

      {/* Export sheet */}
      <BottomSheet isOpen={sheet === 'export'} onClose={() => setSheet(null)} title="Export" maxHeight="50dvh">
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[{ label: 'Export 1× PNG', scale: 1 }, { label: 'Export 2× PNG', scale: 2 }, { label: 'Export 4× PNG', scale: 4 }].map(({ label, scale }, i) => (
            <button
              key={scale}
              onClick={() => exportPNG(scale)}
              disabled={!sourceImage}
              style={{
                height: 52, borderRadius: 12,
                background: i === 0 ? '#ffffff' : '#161616',
                border:     i === 0 ? 'none' : '1px solid #242424',
                color:      i === 0 ? '#000' : '#666',
                fontSize: 15, fontWeight: 700,
                cursor: sourceImage ? 'pointer' : 'not-allowed',
                opacity: sourceImage ? 1 : 0.4,
              }}
            >{label}</button>
          ))}
        </div>
      </BottomSheet>

      {/* Hidden file inputs */}
      <input ref={fileRef}   type="file" accept="image/*,.heic,.heif" style={{ display: 'none' }} onChange={onInputChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onInputChange} />

      <style>{`
        @keyframes pulse   { 0%,100%{opacity:.2} 50%{opacity:1} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
      `}</style>
    </div>
  );
}
