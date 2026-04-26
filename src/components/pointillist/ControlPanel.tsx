'use client';

import { usePointillistStore } from '@/store/pointillist-store';

// ─── Slider ────────────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step = 1, unit = '', hint, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; hint?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-medium text-zinc-300 leading-none">{label}</span>
          {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
        </div>
        <span className="text-[11px] font-mono text-indigo-400 tabular-nums leading-none">
          {Number.isInteger(step) ? value : value.toFixed(1)}{unit}
        </span>
      </div>

      <div className="relative h-4 flex items-center">
        {/* Track */}
        <div className="absolute inset-x-0 h-[3px] rounded-full bg-white/[0.06]" />
        {/* Fill */}
        <div
          className="absolute left-0 h-[3px] rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-none"
          style={{ width: `${pct}%` }}
        />
        {/* Thumb via range input */}
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-4 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3
            [&::-webkit-slider-thumb]:h-3
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-sm
            [&::-webkit-slider-thumb]:ring-1
            [&::-webkit-slider-thumb]:ring-indigo-500/60
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:duration-100
            [&::-webkit-slider-thumb]:hover:scale-[1.3]"
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
    <label className="flex items-center justify-between cursor-pointer select-none group">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[11px] font-medium text-zinc-300">{label}</span>
        {hint && <span className="text-[10px] text-zinc-600">{hint}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-7 h-[15px] rounded-full transition-colors duration-200 flex-shrink-0 ${
          checked ? 'bg-indigo-500' : 'bg-white/10'
        }`}
      >
        <span className={`absolute top-[1.5px] w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[13px]' : 'translate-x-[1.5px]'
        }`} />
      </button>
    </label>
  );
}

// ─── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-zinc-600">{title}</span>
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

// ─── ControlPanel ─────────────────────────────────────────────────────────────

export function ControlPanel() {
  const { settings, setSettings } = usePointillistStore();
  const s = settings;

  return (
    <aside className="w-60 flex flex-col bg-[#0f0f12] border-r border-white/[0.06] flex-shrink-0">

      {/* Header */}
      <div className="px-4 py-3.5 border-b border-white/[0.06] flex-shrink-0">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-zinc-600">Controls</p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 flex flex-col gap-7
        scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">

        {/* Dot */}
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

        {/* Image */}
        <Section title="Image">
          <Slider label="Brightness" value={s.brightness} min={-100} max={100}
            onChange={(v) => setSettings({ brightness: v })} />
          <Slider label="Contrast" value={s.contrast} min={-100} max={100}
            onChange={(v) => setSettings({ contrast: v })} />
          <Slider label="Smoothing" value={s.smoothing} min={0} max={100} unit="%"
            hint="pre-blur"
            onChange={(v) => setSettings({ smoothing: v })} />
        </Section>

        {/* Detail */}
        <Section title="Detail">
          <Slider label="Edge sensitivity" value={s.edgeSensitivity} min={0} max={100} unit="%"
            onChange={(v) => setSettings({ edgeSensitivity: v })} />
        </Section>

        {/* Style */}
        <Section title="Style">

          {/* Color mode */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-zinc-300">Color Mode</span>
            <div className="grid grid-cols-2 gap-1 p-[3px] bg-white/[0.04] rounded-lg border border-white/[0.06]">
              {(['color', 'monochrome'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSettings({ colorMode: m })}
                  className={`py-1.5 rounded-md text-[11px] font-medium capitalize transition-all duration-150 ${
                    s.colorMode === m
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <Toggle label="Invert" hint="flip luminance" checked={s.invert}
            onChange={(v) => setSettings({ invert: v })} />

          {/* Background color */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-300">Background</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 font-mono">{s.backgroundColor}</span>
              <label className="relative w-6 h-6 rounded-md overflow-hidden border border-white/10 cursor-pointer hover:border-indigo-500/60 transition-colors">
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
