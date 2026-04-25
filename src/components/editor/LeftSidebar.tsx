'use client';

import { useEditorStore } from '@/store/editor-store';
import { Slider } from './Slider';
import type { HalftoneMode, CMYKChannel } from '@/types';

const MODES: { label: string; value: HalftoneMode }[] = [
  { label: 'Dots', value: 'dots' },
  { label: 'Lines', value: 'lines' },
  { label: 'Crosshatch', value: 'crosshatch' },
  { label: 'Diamond', value: 'diamond' },
  { label: 'Square', value: 'square' },
  { label: 'Stochastic', value: 'stochastic' },
  { label: 'Pattern', value: 'pattern' },
];

const CMYK_CHANNELS: { key: CMYKChannel; label: string; color: string }[] = [
  { key: 'composite', label: 'Composite', color: '#ffffff' },
  { key: 'C', label: 'Cyan', color: '#00FFFF' },
  { key: 'M', label: 'Magenta', color: '#FF00FF' },
  { key: 'Y', label: 'Yellow', color: '#FFFF00' },
  { key: 'K', label: 'Key (Black)', color: '#aaaaaa' },
];

export function LeftSidebar() {
  const { settings, setSettings, pushHistory } = useEditorStore();

  const update = (patch: Parameters<typeof setSettings>[0]) => {
    setSettings(patch);
  };

  const commit = () => pushHistory();

  return (
    <aside className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto">
      {/* Mode selector */}
      <Section title="Mode">
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => { update({ mode: m.value }); commit(); }}
              className={`py-1.5 rounded text-xs font-medium transition-colors ${
                settings.mode === m.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </Section>

      {/* Halftone params */}
      <Section title="Halftone">
        <Slider label="Frequency" value={settings.frequency} min={2} max={80} unit=" lpi"
          onChange={(v) => update({ frequency: v })} />
        <Slider label="Angle" value={settings.angle} min={0} max={180} unit="°"
          onChange={(v) => update({ angle: v })} />
        <Slider label="Dot Size" value={settings.dotSize} min={0.2} max={2} step={0.1}
          onChange={(v) => update({ dotSize: v })} />
        <button onMouseUp={commit} className="hidden" />
      </Section>

      {/* Image adjustments */}
      <Section title="Image">
        <Slider label="Brightness" value={settings.brightness} min={-100} max={100}
          onChange={(v) => update({ brightness: v })} />
        <Slider label="Contrast" value={settings.contrast} min={-100} max={100}
          onChange={(v) => update({ contrast: v })} />
        <Slider label="Blur" value={settings.blur} min={0} max={10} step={0.5} unit="px"
          onChange={(v) => update({ blur: v })} />
        <Slider label="Clean Radius" value={settings.cleanRadius} min={0} max={5}
          onChange={(v) => update({ cleanRadius: v })} />
        <label className="flex items-center gap-2 cursor-pointer mt-1">
          <input
            type="checkbox"
            checked={settings.invertOutput}
            onChange={(e) => { update({ invertOutput: e.target.checked }); commit(); }}
            className="accent-indigo-500"
          />
          <span className="text-xs text-zinc-400">Invert Output</span>
        </label>
      </Section>

      {/* CMYK */}
      <Section title="CMYK Separation">
        <label className="flex items-center gap-2 cursor-pointer mb-2">
          <input
            type="checkbox"
            checked={settings.cmykMode}
            onChange={(e) => { update({ cmykMode: e.target.checked }); commit(); }}
            className="accent-indigo-500"
          />
          <span className="text-xs text-zinc-400">Enable CMYK Mode</span>
        </label>

        {settings.cmykMode && (
          <>
            <p className="text-xs text-zinc-500 mb-2">Channel View</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {CMYK_CHANNELS.map((ch) => (
                <button
                  key={ch.key}
                  onClick={() => update({ activeChannel: ch.key })}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors border ${
                    settings.activeChannel === ch.key
                      ? 'border-indigo-500 text-white bg-zinc-800'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                  }`}
                  style={settings.activeChannel === ch.key ? { color: ch.color } : {}}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Per-channel angles */}
            <p className="text-xs text-zinc-500 mb-1">Screen Angles</p>
            {(['C', 'M', 'Y', 'K'] as const).map((ch) => (
              <Slider
                key={ch}
                label={`${ch}`}
                value={settings.cmykAngles[ch]}
                min={0}
                max={180}
                unit="°"
                onChange={(v) =>
                  update({ cmykAngles: { ...settings.cmykAngles, [ch]: v } })
                }
              />
            ))}

            {/* Channel visibility (composite only) */}
            {settings.activeChannel === 'composite' && (
              <>
                <p className="text-xs text-zinc-500 mt-2 mb-1">Visibility</p>
                <div className="flex gap-2">
                  {(['C', 'M', 'Y', 'K'] as const).map((ch) => (
                    <label key={ch} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.visibleChannels[ch]}
                        onChange={(e) =>
                          update({
                            visibleChannels: {
                              ...settings.visibleChannels,
                              [ch]: e.target.checked,
                            },
                          })
                        }
                        className="accent-indigo-500"
                      />
                      <span className="text-xs text-zinc-400">{ch}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-zinc-800">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{title}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}
