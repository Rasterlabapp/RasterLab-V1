'use client';

import { usePointillistStore } from '@/store/pointillist-store';

// ─── Primitives ───────────────────────────────────────────────────────────────

function Slider({
  label, value, min, max, step = 1, unit = '',
  hint, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; hint?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="group flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium text-zinc-300">{label}</span>
          {hint && <span className="ml-1.5 text-[10px] text-zinc-600">{hint}</span>}
        </div>
        <span className="text-[11px] font-mono text-indigo-400 tabular-nums">
          {Number.isInteger(step) ? value : value.toFixed(1)}{unit}
        </span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-zinc-800" />
        <div
          className="absolute left-0 h-1 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full h-5 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-3.5
            [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-indigo-500
            [&::-webkit-slider-thumb]:transition-transform
            [&::-webkit-slider-thumb]:hover:scale-125"
        />
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: {
  label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer select-none">
      <div>
        <span className="text-[11px] font-medium text-zinc-300">{label}</span>
        {hint && <span className="ml-1.5 text-[10px] text-zinc-600">{hint}</span>}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4 rounded-full transition-colors duration-200 ${
          checked ? 'bg-indigo-500' : 'bg-zinc-700'
        }`}
      >
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`} />
      </div>
    </label>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500">{title}</span>
        <div className="flex-1 h-px bg-zinc-800" />
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function ControlPanel() {
  const { settings, setSettings } = usePointillistStore();
  const s = settings;

  return (
    <aside className="w-64 flex flex-col bg-[#111113] border-r border-white/5 overflow-y-auto">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xs">⬤</div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Pointillist</p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Generator</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 flex flex-col gap-6 overflow-y-auto">

        {/* Dot */}
        <Section title="Dot">
          <Slider label="Dot Size" value={s.dotSize} min={1} max={20} unit="px"
            hint="base radius"
            onChange={(v) => setSettings({ dotSize: v })} />
          <Slider label="Density" value={s.density} min={1} max={100} unit="%"
            hint="coverage"
            onChange={(v) => setSettings({ density: v })} />
          <Slider label="Randomness" value={s.randomness} min={0} max={100} unit="%"
            hint="position jitter"
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
          <Slider label="Edge Sensitivity" value={s.edgeSensitivity} min={0} max={100} unit="%"
            hint="Sobel boost"
            onChange={(v) => setSettings({ edgeSensitivity: v })} />
        </Section>

        {/* Style */}
        <Section title="Style">
          <Toggle label="Invert" hint="flip darkness" checked={s.invert}
            onChange={(v) => setSettings({ invert: v })} />

          {/* Color mode */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-zinc-300">Color Mode</span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900 rounded-lg">
              {(['color', 'monochrome'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setSettings({ colorMode: m })}
                  className={`py-1.5 rounded-md text-[11px] font-medium capitalize transition-all duration-150 ${
                    s.colorMode === m
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Background color */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-300">Background</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-600 font-mono">{s.backgroundColor}</span>
              <label className="relative w-7 h-7 rounded-md overflow-hidden border border-white/10 cursor-pointer hover:border-indigo-500 transition-colors">
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
