'use client';

import { usePointillistStore } from '@/store/pointillist-store';

// ─── Design tokens ────────────────────────────────────────────────────────────
//  bg-panel   #111111   panel surface
//  border     #282828   dividers and outlines
//  text-hi    #ffffff   primary / value text
//  text-mid   #999999   labels
//  text-lo    #555555   section titles, muted metadata
//  surface    #1a1a1a   inset backgrounds, hover
//  surface-hi #222222   stronger inset / active fill

// ─── Slider ────────────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step = 1, unit = '', hint, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; hint?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = Number.isInteger(step) ? value : value.toFixed(1);
  return (
    <div className="flex flex-col gap-2">
      {/* Label row */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-medium leading-none" style={{ color: '#aaaaaa' }}>{label}</span>
          {hint && <span className="text-[10px] leading-none" style={{ color: '#444444' }}>{hint}</span>}
        </div>
        <span className="text-[13px] font-mono font-semibold tabular-nums leading-none text-white">
          {display}{unit}
        </span>
      </div>

      {/* Track */}
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-[3px] rounded-full" style={{ background: '#242424' }} />
        <div
          className="absolute left-0 h-[3px] rounded-full transition-none"
          style={{ width: `${pct}%`, background: '#ffffff' }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-5 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-[15px]
            [&::-webkit-slider-thumb]:h-[15px]
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-0
            [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(0,0,0,0.8)]
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:duration-100
            [&::-webkit-slider-thumb]:hover:scale-[1.2]
            [&::-webkit-slider-thumb]:active:scale-[1.1]"
        />
      </div>
    </div>
  );
}

// ─── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none group gap-3">
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-medium" style={{ color: '#aaaaaa' }}>{label}</span>
        {hint && <span className="text-[10px]" style={{ color: '#444444' }}>{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 transition-colors duration-200"
        style={{
          width: 34, height: 18,
          borderRadius: 9,
          background: checked ? '#ffffff' : '#2a2a2a',
          border: `1.5px solid ${checked ? '#ffffff' : '#3a3a3a'}`,
        }}
      >
        <span
          className="absolute top-[1px] w-[13px] h-[13px] rounded-full transition-transform duration-200"
          style={{
            background: checked ? '#000000' : '#666666',
            transform: `translateX(${checked ? 17 : 2}px)`,
          }}
        />
      </button>
    </label>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span
          className="text-[10px] font-bold tracking-[0.14em] uppercase leading-none flex-shrink-0"
          style={{ color: '#555555' }}
        >
          {title}
        </span>
        <div className="flex-1 h-px" style={{ background: '#1e1e1e' }} />
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}

// ─── Segmented control ────────────────────────────────────────────────────────

function SegmentedControl<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="flex p-[3px] rounded-lg gap-[3px]"
      style={{ background: '#161616', border: '1px solid #282828' }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="flex-1 py-[7px] rounded-md text-[11px] font-semibold transition-all duration-150"
          style={
            value === opt.value
              ? { background: '#ffffff', color: '#000000' }
              : { color: '#555555' }
          }
          onMouseEnter={(e) => {
            if (value !== opt.value) (e.currentTarget as HTMLButtonElement).style.color = '#aaaaaa';
          }}
          onMouseLeave={(e) => {
            if (value !== opt.value) (e.currentTarget as HTMLButtonElement).style.color = '#555555';
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── ControlPanel ─────────────────────────────────────────────────────────────

export function ControlPanel() {
  const { settings, setSettings } = usePointillistStore();
  const s = settings;

  return (
    <aside
      className="w-64 flex flex-col flex-shrink-0"
      style={{ background: '#111111', borderRight: '1px solid #1e1e1e' }}
    >
      {/* Header */}
      <div
        className="px-5 h-11 flex items-center flex-shrink-0"
        style={{ borderBottom: '1px solid #1e1e1e' }}
      >
        <p
          className="text-[11px] font-bold tracking-[0.14em] uppercase"
          style={{ color: '#444444' }}
        >
          Controls
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-6 flex flex-col gap-8
        scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

        <Section title="Dot">
          <Slider label="Size" value={s.dotSize} min={1} max={20} unit="px"
            hint="base radius"
            onChange={(v) => setSettings({ dotSize: v })} />
          <Slider label="Density" value={s.density} min={1} max={100} unit="%"
            onChange={(v) => setSettings({ density: v })} />
          <Slider label="Randomness" value={s.randomness} min={0} max={100} unit="%"
            hint="jitter"
            onChange={(v) => setSettings({ randomness: v })} />
        </Section>

        <Section title="Image">
          <Slider label="Brightness" value={s.brightness} min={-100} max={100}
            onChange={(v) => setSettings({ brightness: v })} />
          <Slider label="Contrast" value={s.contrast} min={-100} max={100}
            onChange={(v) => setSettings({ contrast: v })} />
          <Slider label="Smoothing" value={s.smoothing} min={0} max={100} unit="%"
            hint="pre-blur"
            onChange={(v) => setSettings({ smoothing: v })} />
        </Section>

        <Section title="Detail">
          <Slider label="Edge Sensitivity" value={s.edgeSensitivity} min={0} max={100} unit="%"
            onChange={(v) => setSettings({ edgeSensitivity: v })} />
        </Section>

        <Section title="Style">

          {/* Color mode */}
          <div className="flex flex-col gap-2.5">
            <span className="text-[12px] font-medium" style={{ color: '#aaaaaa' }}>Color Mode</span>
            <SegmentedControl
              options={[
                { value: 'color',      label: 'Color' },
                { value: 'monochrome', label: 'Mono' },
              ]}
              value={s.colorMode}
              onChange={(v) => setSettings({ colorMode: v })}
            />
          </div>

          <Toggle label="Invert" hint="flip luminance" checked={s.invert}
            onChange={(v) => setSettings({ invert: v })} />

          {/* Background color */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium" style={{ color: '#aaaaaa' }}>Background</span>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-mono tabular-nums" style={{ color: '#555555' }}>
                {s.backgroundColor}
              </span>
              <label
                className="relative flex-shrink-0 cursor-pointer"
                style={{
                  width: 24, height: 24,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1.5px solid #333333',
                }}
              >
                <div className="absolute inset-0" style={{ background: s.backgroundColor }} />
                <input
                  type="color"
                  value={s.backgroundColor}
                  onChange={(e) => setSettings({ backgroundColor: e.target.value })}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
            </div>
          </div>

        </Section>
      </div>
    </aside>
  );
}
