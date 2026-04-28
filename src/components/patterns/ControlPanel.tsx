'use client';

import { useRef, useCallback } from 'react';
import { usePatternStore }     from '@/store/pattern-store';
import { ENGINE_LIST }         from '@/lib/patterns/index';
import type { EngineId, PatternSettings } from '@/lib/patterns/types';

// ── Design tokens ──────────────────────────────────────────────────────────
const C = {
  bg:       '#0e0e0e',
  border:   '#1e1e1e',
  label:    '#888888',
  value:    '#ffffff',
  track:    '#242424',
  thumb:    '#ffffff',
  accent:   '#ffffff',
};

// ── Slider ─────────────────────────────────────────────────────────────────
interface SliderProps {
  label:   string;
  value:   number;
  min:     number;
  max:     number;
  step?:   number;
  format?: (v: number) => string;
  onChange:(v: number) => void;
}
function Slider({ label, value, min, max, step = 1, format, onChange }: SliderProps) {
  const display = format ? format(value) : String(Math.round(value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 11, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
        <span style={{ fontSize: 12, color: C.value, fontFamily: 'monospace', fontWeight: 600 }}>{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: C.accent, height: 3, cursor: 'pointer' }}
      />
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────
function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 11, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 38, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer',
          background: value ? '#ffffff' : '#2a2a2a',
          position: 'relative', transition: 'background 200ms',
        }}
      >
        <span style={{
          position: 'absolute', top: 3,
          left: value ? 20 : 3,
          width: 14, height: 14, borderRadius: '50%',
          background: value ? '#000000' : '#666666',
          transition: 'left 200ms',
        }} />
      </button>
    </div>
  );
}

// ── Segmented ──────────────────────────────────────────────────────────────
function Segmented<T extends string>({ value, options, onChange }: {
  value: T; options: { label: string; value: T }[]; onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, background: '#181818', borderRadius: 7, padding: 2 }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} style={{
          flex: 1, padding: '5px 0', fontSize: 10, fontWeight: 600, borderRadius: 5,
          border: 'none', cursor: 'pointer', letterSpacing: '0.04em',
          background:  value === o.value ? '#ffffff' : 'transparent',
          color:       value === o.value ? '#000000' : '#555555',
          transition: 'background 150ms, color 150ms',
        }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Engine picker ──────────────────────────────────────────────────────────
function EnginePicker({ active, onChange }: { active: EngineId; onChange: (id: EngineId) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
      {ENGINE_LIST.map((e) => {
        const isActive = e.id === active;
        return (
          <button
            key={e.id}
            onClick={() => onChange(e.id)}
            title={e.description}
            style={{
              padding: '8px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
              background:  isActive ? '#ffffff' : '#161616',
              border:      isActive ? '1px solid #ffffff' : '1px solid #242424',
              color:       isActive ? '#000000' : '#666666',
              transition:  'all 150ms',
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '-0.01em', display: 'block' }}>
              {e.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── Per-engine controls ────────────────────────────────────────────────────
function EngineControls({ engine, settings, set }: {
  engine:   EngineId;
  settings: PatternSettings;
  set:      (p: Partial<PatternSettings>) => void;
}) {
  const pct = (v: number) => `${Math.round(v)}%`;
  const px  = (v: number) => `${v.toFixed(1)}px`;
  const f1  = (v: number) => v.toFixed(1);

  switch (engine) {
    case 'serpentines': return (
      <>
        <Slider label="Density"     value={settings.density}     min={10} max={90}  onChange={(v) => set({ density: v })} format={pct} />
        <Slider label="Flow"        value={settings.flow}        min={0}  max={100} onChange={(v) => set({ flow: v })} format={pct} />
        <Slider label="Thickness"   value={settings.thickness}   min={0.5} max={6} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
        <Slider label="Turbulence"  value={settings.turbulence}  min={0}  max={100} onChange={(v) => set({ turbulence: v })} format={pct} />
        <Slider label="Scale"       value={settings.scale}       min={0.5} max={4} step={0.1} onChange={(v) => set({ scale: v })} format={f1} />
      </>
    );
    case 'spirals': return (
      <>
        <Slider label="Spacing"     value={settings.spacing}     min={15} max={80} onChange={(v) => set({ spacing: v })} format={px} />
        <Slider label="Radius"      value={settings.radius}      min={10} max={60} onChange={(v) => set({ radius: v })} format={px} />
        <Slider label="Arms"        value={settings.arms}        min={1}  max={5}  step={1}  onChange={(v) => set({ arms: v })} />
        <Slider label="Wrap"        value={settings.wrap}        min={0.5} max={5} step={0.1} onChange={(v) => set({ wrap: v })} format={f1} />
        <Slider label="Thickness"   value={settings.thickness}   min={0.5} max={4} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11, color: C.label, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Direction</span>
          <Segmented
            value={settings.direction}
            options={[{ label: 'CW', value: 'clockwise' }, { label: 'CCW', value: 'counterclockwise' }, { label: 'Rnd', value: 'random' }]}
            onChange={(v) => set({ direction: v })}
          />
        </div>
      </>
    );
    case 'maze': return (
      <>
        <Slider label="Path Width"  value={settings.pathWidth}   min={2}  max={18} onChange={(v) => set({ pathWidth: v })} format={px} />
        <Slider label="Complexity"  value={settings.complexity}  min={1}  max={100} onChange={(v) => set({ complexity: v })} format={pct} />
        <Slider label="Sharpness"   value={settings.sharpness}   min={0}  max={100} onChange={(v) => set({ sharpness: v })} format={pct} />
      </>
    );
    case 'spots': return (
      <>
        <Slider label="Blob Size"   value={settings.blobSize}    min={3}  max={30} onChange={(v) => set({ blobSize: v })} format={px} />
        <Slider label="Spread"      value={settings.spread}      min={0}  max={100} onChange={(v) => set({ spread: v })} format={pct} />
        <Slider label="Softness"    value={settings.softness}    min={0}  max={100} onChange={(v) => set({ softness: v })} format={pct} />
        <Slider label="Density"     value={settings.density}     min={10} max={90}  onChange={(v) => set({ density: v })} format={pct} />
      </>
    );
    case 'worms': return (
      <>
        <Slider label="Density"     value={settings.density}     min={10} max={90}  onChange={(v) => set({ density: v })} format={pct} />
        <Slider label="Length"      value={settings.length}      min={20} max={200} onChange={(v) => set({ length: v })} />
        <Slider label="Thickness"   value={settings.thickness}   min={0.5} max={6} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
        <Slider label="Motion Curve" value={settings.motionCurve} min={0} max={100} onChange={(v) => set({ motionCurve: v })} format={pct} />
      </>
    );
    case 'fingerprints': return (
      <>
        <Slider label="Ring Spacing" value={settings.ringSpacing} min={3}  max={24} onChange={(v) => set({ ringSpacing: v })} format={px} />
        <Slider label="Distortion"   value={settings.distortion}  min={0}  max={100} onChange={(v) => set({ distortion: v })} format={pct} />
        <Slider label="Density"      value={settings.density}     min={10} max={90}  onChange={(v) => set({ density: v })} format={pct} />
        <Slider label="Thickness"    value={settings.thickness}   min={0.5} max={4} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
      </>
    );
    case 'coral': return (
      <>
        <Slider label="Branching"   value={settings.branching}   min={1}  max={7}  step={1}  onChange={(v) => set({ branching: v })} />
        <Slider label="Thickness"   value={settings.thickness}   min={0.5} max={6} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
        <Slider label="Spread"      value={settings.spread2}     min={0}  max={100} onChange={(v) => set({ spread2: v })} format={pct} />
        <Slider label="Density"     value={settings.density}     min={10} max={90}  onChange={(v) => set({ density: v })} format={pct} />
      </>
    );
    case 'zebra': return (
      <>
        <Slider label="Stripe Width" value={settings.stripeWidth} min={1}  max={20} onChange={(v) => set({ stripeWidth: v })} />
        <Slider label="Bend"         value={settings.bend}        min={0}  max={100} onChange={(v) => set({ bend: v })} format={pct} />
        <Slider label="Contrast"     value={settings.contrast}    min={0}  max={100} onChange={(v) => set({ contrast: v })} format={pct} />
      </>
    );
    case 'bubbles': return (
      <>
        <Slider label="Bubble Size"  value={settings.bubbleSize}  min={4}  max={40} onChange={(v) => set({ bubbleSize: v })} format={px} />
        <Slider label="Packing"      value={settings.packing}     min={20} max={100} onChange={(v) => set({ packing: v })} format={pct} />
        <Slider label="Randomness"   value={settings.randomness}  min={0}  max={100} onChange={(v) => set({ randomness: v })} format={pct} />
        <Slider label="Thickness"    value={settings.thickness}   min={0.5} max={4} step={0.1} onChange={(v) => set({ thickness: v })} format={f1} />
      </>
    );
    case 'noiseGrid': return (
      <>
        <Slider label="Noise Scale"  value={settings.noiseScale}  min={2}  max={40} onChange={(v) => set({ noiseScale: v })} format={px} />
        <Slider label="Contrast"     value={settings.noiseContrast} min={0} max={100} onChange={(v) => set({ noiseContrast: v })} format={pct} />
        <Slider label="Density"      value={settings.density}     min={10} max={90}  onChange={(v) => set({ density: v })} format={pct} />
      </>
    );
  }
}

// ── Upload zone ────────────────────────────────────────────────────────────
function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const onDrop   = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      style={{
        border: '1px dashed #333',
        borderRadius: 8,
        padding: '14px 12px',
        textAlign: 'center',
        cursor: 'pointer',
        color: '#444',
        fontSize: 12,
        transition: 'border-color 150ms',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#555')}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#333')}
    >
      Drop image or click to upload
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.heic,.heif"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export function ControlPanel({ onFileLoad }: { onFileLoad: (f: File) => void }) {
  const { settings, setSettings } = usePatternStore();

  return (
    <aside style={{
      width: 240,
      flexShrink: 0,
      overflowY: 'auto',
      background: C.bg,
      borderRight: `1px solid ${C.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      {/* Upload */}
      <section style={{ padding: '16px 16px 12px' }}>
        <p style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Image</p>
        <UploadZone onFile={onFileLoad} />
      </section>

      <div style={{ height: 1, background: C.border }} />

      {/* Engine picker */}
      <section style={{ padding: '14px 16px 12px' }}>
        <p style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Engine</p>
        <EnginePicker
          active={settings.engine}
          onChange={(id) => setSettings({ engine: id })}
        />
      </section>

      <div style={{ height: 1, background: C.border }} />

      {/* Engine-specific controls */}
      <section style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Controls</p>
        <EngineControls engine={settings.engine} settings={settings} set={setSettings} />
      </section>

      <div style={{ height: 1, background: C.border }} />

      {/* Global */}
      <section style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p style={{ fontSize: 10, color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Global</p>
        <Toggle label="Invert" value={settings.invert} onChange={(v) => setSettings({ invert: v })} />
      </section>
    </aside>
  );
}
