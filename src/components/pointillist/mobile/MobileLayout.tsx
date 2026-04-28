'use client';

/**
 * MobileLayout — complete mobile experience for Curato Lab Pointillist.
 *
 * Structure:
 *   ┌──────────────────────┐
 *   │  Curato Lab  header  │  sticky, 52px
 *   ├──────────────────────┤
 *   │                      │
 *   │   Preview canvas     │  flex-1, centered
 *   │                      │
 *   ├──────────────────────┤
 *   │ Upload Effects Ctrl ↓│  sticky bottom bar, 64px + safe-area
 *   └──────────────────────┘
 *
 * Three bottom sheets (slide-up drawers):
 *   Controls — touch-friendly sliders for all rendering settings
 *   Presets  — built-in and custom presets
 *   Export   — PNG download + Web Share API
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { usePointillistRenderer } from '@/hooks/usePointillistRenderer';
import { renderPointillistCore } from '@/lib/pointillist-engine';
import { BottomSheet } from './BottomSheet';

const MAX_PX = 2400; // safe ceiling for mobile RAM

type Sheet = 'controls' | 'presets' | 'export' | null;

// ─── Mobile Slider ────────────────────────────────────────────────────────────
// 44px minimum touch target, large thumb, high-contrast value

function MobileSlider({
  label, value, min, max, step = 1, unit = '', onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  const pct     = ((value - min) / (max - min)) * 100;
  const display = Number.isInteger(step) ? value : value.toFixed(1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#aaaaaa' }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#ffffff' }}>
          {display}{unit}
        </span>
      </div>

      <div style={{ position: 'relative', height: 44, display: 'flex', alignItems: 'center' }}>
        {/* Track bg */}
        <div style={{ position: 'absolute', inset: '0 0', height: 4, top: '50%', transform: 'translateY(-50%)', borderRadius: 2, background: '#2a2a2a' }} />
        {/* Fill */}
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, top: '50%', transform: 'translateY(-50%)', borderRadius: 2, background: '#ffffff', transition: 'none' }} />
        {/* Input */}
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'relative', width: '100%', height: 44, appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', margin: 0 } as React.CSSProperties}
          className="mobile-slider"
        />
      </div>
    </div>
  );
}

// ─── Mobile Toggle ────────────────────────────────────────────────────────────

function MobileToggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#aaaaaa' }}>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          width:      52,
          height:     28,
          borderRadius: 14,
          background:  checked ? '#ffffff' : '#2a2a2a',
          border:      `1.5px solid ${checked ? '#ffffff' : '#3a3a3a'}`,
          position:   'relative',
          cursor:     'pointer',
          transition: 'background 200ms, border-color 200ms',
          flexShrink: 0,
        }}
      >
        <span style={{
          position:   'absolute',
          top:        2,
          width:      20,
          height:     20,
          borderRadius: '50%',
          background:  checked ? '#000000' : '#666666',
          transition: 'transform 200ms, background 200ms',
          transform:  `translateX(${checked ? 26 : 2}px)`,
        }} />
      </button>
    </div>
  );
}

// ─── Controls sheet content ───────────────────────────────────────────────────

function ControlsContent() {
  const { settings, setSettings } = usePointillistStore();
  const s = settings;

  return (
    <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>

      <SheetSection label="Dot">
        <MobileSlider label="Size"      value={s.dotSize}    min={1}    max={20}  unit="px" onChange={(v) => setSettings({ dotSize: v })} />
        <MobileSlider label="Density"   value={s.density}    min={1}    max={100} unit="%" onChange={(v) => setSettings({ density: v })} />
        <MobileSlider label="Randomness" value={s.randomness} min={0}    max={100} unit="%" onChange={(v) => setSettings({ randomness: v })} />
      </SheetSection>

      <SheetSection label="Image">
        <MobileSlider label="Brightness" value={s.brightness} min={-100} max={100} onChange={(v) => setSettings({ brightness: v })} />
        <MobileSlider label="Contrast"   value={s.contrast}   min={-100} max={100} onChange={(v) => setSettings({ contrast: v })} />
        <MobileSlider label="Smoothing"  value={s.smoothing}  min={0}    max={100} unit="%" onChange={(v) => setSettings({ smoothing: v })} />
      </SheetSection>

      <SheetSection label="Detail">
        <MobileSlider label="Edge Sensitivity" value={s.edgeSensitivity} min={0} max={100} unit="%" onChange={(v) => setSettings({ edgeSensitivity: v })} />
      </SheetSection>

      <SheetSection label="Style">
        {/* Color mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#aaaaaa' }}>Color Mode</span>
          <div style={{ display: 'flex', padding: 3, gap: 3, background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' }}>
            {(['color', 'monochrome'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSettings({ colorMode: m })}
                style={{
                  flex:         1,
                  height:       40,
                  borderRadius: 8,
                  fontSize:     13,
                  fontWeight:   600,
                  cursor:       'pointer',
                  border:       'none',
                  transition:   'background 150ms, color 150ms',
                  background:   s.colorMode === m ? '#ffffff' : 'transparent',
                  color:        s.colorMode === m ? '#000000' : '#555555',
                  textTransform: 'capitalize',
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <MobileToggle label="Invert" checked={s.invert} onChange={(v) => setSettings({ invert: v })} />
      </SheetSection>
    </div>
  );
}

// ─── Presets sheet content ────────────────────────────────────────────────────

function PresetsContent({ onClose }: { onClose: () => void }) {
  const { presets, activePresetId, loadPreset } = usePointillistStore();

  return (
    <div style={{ padding: '8px 16px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SheetSection label="Built-in Presets">
        {presets.slice(0, 6).map((p) => (
          <button
            key={p.id}
            onClick={() => { loadPreset(p.id); onClose(); }}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          12,
              width:        '100%',
              minHeight:    52,
              padding:      '0 16px',
              borderRadius: 12,
              border:       `1px solid ${activePresetId === p.id ? '#3a3a3a' : 'transparent'}`,
              background:   activePresetId === p.id ? 'rgba(255,255,255,0.07)' : 'transparent',
              cursor:       'pointer',
              textAlign:    'left',
            }}
          >
            <span style={{
              width:        8,
              height:       8,
              borderRadius: '50%',
              background:   activePresetId === p.id ? '#ffffff' : '#333333',
              flexShrink:   0,
            }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: activePresetId === p.id ? '#ffffff' : '#888888', flex: 1 }}>
              {p.name}
            </span>
            {activePresetId === p.id && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#555555', letterSpacing: '0.08em' }}>ACTIVE</span>
            )}
          </button>
        ))}
      </SheetSection>

      {presets.slice(6).length > 0 && (
        <SheetSection label="Custom Presets">
          {presets.slice(6).map((p) => (
            <button
              key={p.id}
              onClick={() => { loadPreset(p.id); onClose(); }}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        12,
                width:      '100%',
                minHeight:  52,
                padding:    '0 16px',
                borderRadius: 12,
                border:     `1px solid ${activePresetId === p.id ? '#3a3a3a' : 'transparent'}`,
                background: activePresetId === p.id ? 'rgba(255,255,255,0.07)' : 'transparent',
                cursor:     'pointer',
                textAlign:  'left',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: activePresetId === p.id ? '#ffffff' : '#333333', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: activePresetId === p.id ? '#ffffff' : '#888888', flex: 1 }}>{p.name}</span>
            </button>
          ))}
        </SheetSection>
      )}
    </div>
  );
}

// ─── Export sheet content ─────────────────────────────────────────────────────

function ExportContent({ sourceImage }: { sourceImage: HTMLCanvasElement | null }) {
  const { settings } = usePointillistStore();
  const [bgMode,    setBgMode]    = useState<'white' | 'transparent'>('white');
  const [exporting, setExporting] = useState<null | '1x' | '2x'>(null);

  const runExport = async (scale: 1 | 2) => {
    if (!sourceImage || exporting) return;
    const key = scale === 1 ? '1x' : '2x';
    setExporting(key);
    await new Promise<void>((r) => setTimeout(r, 16));

    try {
      const w = sourceImage.width  * scale;
      const h = sourceImage.height * scale;
      const src = document.createElement('canvas');
      src.width = w; src.height = h;
      src.getContext('2d')!.drawImage(sourceImage, 0, 0, w, h);

      const pixelBuffer = src.getContext('2d')!.getImageData(0, 0, w, h).data.buffer.slice(0);
      const dst  = document.createElement('canvas');
      dst.width  = w; dst.height = h;
      const dstCtx = dst.getContext('2d')!;
      if (bgMode === 'white') { dstCtx.fillStyle = '#ffffff'; dstCtx.fillRect(0, 0, w, h); }

      renderPointillistCore(
        new Uint8ClampedArray(pixelBuffer), w, h,
        { ...settings, dotSize: settings.dotSize * scale, backgroundColor: bgMode === 'white' ? '#ffffff' : 'transparent' },
        dstCtx,
      );

      const filename = `curato-lab-pointillist-${settings.colorMode}-${key}-${bgMode}-${Date.now()}.png`;

      await new Promise<void>((resolve) => {
        dst.toBlob(async (blob) => {
          if (!blob) { resolve(); return; }

          // Try Web Share API (mobile native share sheet)
          const shareFile = new File([blob], filename, { type: 'image/png' });
          if (
            scale === 1 &&
            typeof navigator.share === 'function' &&
            navigator.canShare?.({ files: [shareFile] })
          ) {
            try {
              await navigator.share({ files: [shareFile], title: 'Curato Lab Export' });
              resolve(); return;
            } catch { /* user cancelled or share failed — fall through to download */ }
          }

          // Fallback: anchor download
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href     = url;
          a.download = filename;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, 'image/png');
      });
    } finally {
      setExporting(null);
    }
  };

  const disabled = !sourceImage;

  return (
    <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Background */}
      <SheetSection label="Background">
        <div style={{ display: 'flex', padding: 3, gap: 3, background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          {(['white', 'transparent'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setBgMode(m)}
              style={{
                flex:         1,
                height:       44,
                borderRadius: 8,
                fontSize:     13,
                fontWeight:   600,
                cursor:       'pointer',
                border:       'none',
                background:   bgMode === m ? '#ffffff' : 'transparent',
                color:        bgMode === m ? '#000000' : '#555555',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                gap:          8,
                transition:   'background 150ms, color 150ms',
              }}
            >
              {m === 'white' ? (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: 3, background: '#ffffff', border: '1px solid #aaa', flexShrink: 0 }} />
                  White
                </>
              ) : (
                <>
                  <span style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px dashed #666', flexShrink: 0 }} />
                  Alpha
                </>
              )}
            </button>
          ))}
        </div>
      </SheetSection>

      {/* Download */}
      <SheetSection label="Save Image">
        <ExportBtn
          label="1× PNG"
          sub={sourceImage ? `${sourceImage.width}×${sourceImage.height}` : undefined}
          loading={exporting === '1x'}
          disabled={disabled || exporting !== null}
          primary
          onClick={() => runExport(1)}
        />
        <ExportBtn
          label="2× PNG"
          sub={sourceImage ? `${sourceImage.width * 2}×${sourceImage.height * 2}` : undefined}
          loading={exporting === '2x'}
          disabled={disabled || exporting !== null}
          onClick={() => runExport(2)}
        />
        <p style={{ textAlign: 'center', fontSize: 11, color: '#333333', margin: 0 }}>
          Re-rendered at full export size
        </p>
      </SheetSection>
    </div>
  );
}

// ─── Shared sheet primitives ──────────────────────────────────────────────────

function SheetSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 18 }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#444444' }}>
        {label}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      <div style={{ height: 1, background: '#1a1a1a', marginTop: 4 }} />
    </div>
  );
}

function ExportBtn({ label, sub, loading, disabled, primary, onClick }: {
  label: string; sub?: string; loading: boolean; disabled: boolean; primary?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width:          '100%',
        height:         54,
        borderRadius:   14,
        fontSize:       14,
        fontWeight:     700,
        cursor:         disabled ? 'not-allowed' : 'pointer',
        opacity:        disabled ? 0.25 : 1,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
        border:         primary ? 'none' : '1px solid #2a2a2a',
        background:     primary ? '#ffffff' : '#1a1a1a',
        color:          primary ? '#000000' : '#888888',
        transition:     'opacity 150ms',
      }}
    >
      {loading ? (
        <>
          <svg style={{ animation: 'spin 1s linear infinite', width: 16, height: 16, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
            <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/>
            <path style={{ opacity: 0.9 }} fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/>
          </svg>
          Exporting…
        </>
      ) : (
        <>
          ↓ {label}
          {sub && <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.4 }}>{sub}</span>}
        </>
      )}
    </button>
  );
}

// ─── Bottom action bar ────────────────────────────────────────────────────────

interface ActionBarProps {
  activeSheet:  Sheet;
  hasImage:     boolean;
  onUpload:     () => void;
  onPresets:    () => void;
  onControls:   () => void;
  onExport:     () => void;
}

function ActionBar({ activeSheet, hasImage, onUpload, onPresets, onControls, onExport }: ActionBarProps) {
  const buttons: { id: Sheet | 'upload'; label: string; icon: React.ReactNode; action: () => void; alwaysOn?: boolean }[] = [
    {
      id: 'upload', label: 'Upload', alwaysOn: true,
      action: onUpload,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      ),
    },
    {
      id: 'presets', label: 'Presets',
      action: onPresets,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5"  cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="5"  cy="6"  r="1"   fill="currentColor" stroke="none"/>
          <circle cx="12" cy="6"  r="1.5" fill="currentColor" stroke="none"/>
          <circle cx="19" cy="6"  r="1"   fill="currentColor" stroke="none"/>
          <circle cx="5"  cy="18" r="1"   fill="currentColor" stroke="none"/>
          <circle cx="12" cy="18" r="1"   fill="currentColor" stroke="none"/>
          <circle cx="19" cy="18" r="1.5" fill="currentColor" stroke="none"/>
        </svg>
      ),
    },
    {
      id: 'controls', label: 'Controls',
      action: onControls,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="4" y1="7"  x2="20" y2="7"/>
          <line x1="4" y1="12" x2="20" y2="12"/>
          <line x1="4" y1="17" x2="20" y2="17"/>
          <circle cx="9"  cy="7"  r="2.2" fill="#131313" strokeWidth="1.8"/>
          <circle cx="15" cy="12" r="2.2" fill="#131313" strokeWidth="1.8"/>
          <circle cx="9"  cy="17" r="2.2" fill="#131313" strokeWidth="1.8"/>
        </svg>
      ),
    },
    {
      id: 'export', label: 'Export',
      action: onExport,
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M8 11l4 4 4-4"/>
          <path d="M5 18h14a2 2 0 002-2v-1"/>
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        display:         'flex',
        alignItems:      'stretch',
        background:      '#111111',
        borderTop:       '1px solid #1e1e1e',
        paddingBottom:   'env(safe-area-inset-bottom)',
        flexShrink:      0,
      }}
    >
      {buttons.map((btn) => {
        const isActive = btn.id === activeSheet;
        const isDisabled = !btn.alwaysOn && !hasImage;
        return (
          <button
            key={btn.id}
            onClick={isDisabled ? undefined : btn.action}
            style={{
              flex:           1,
              height:         62,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            5,
              border:         'none',
              background:     isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderTop:      isActive ? '1.5px solid #ffffff' : '1.5px solid transparent',
              cursor:         isDisabled ? 'default' : 'pointer',
              color:          isDisabled ? '#2a2a2a' : isActive ? '#ffffff' : '#555555',
              transition:     'color 150ms, background 150ms',
            }}
          >
            {btn.icon}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>
              {btn.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function MobileLayout() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const [activeSheet, setActiveSheet] = useState<Sheet>(null);
  const [rendering, setRendering]     = useState(false);

  const { settings, sourceImage, setSourceImage, setRenderTime } = usePointillistStore();

  const { scheduleRender, supportsWorker } = usePointillistRenderer(canvasRef, {
    onRenderStart: () => setRendering(true),
    onRenderDone:  (ms) => { setRenderTime(ms); setRendering(false); },
    onRenderError: () => setRendering(false),
  });

  const sourceImageRef = useRef(sourceImage);
  useEffect(() => { sourceImageRef.current = sourceImage; }, [sourceImage]);

  useEffect(() => {
    scheduleRender(sourceImageRef.current, settings, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  useEffect(() => {
    if (!sourceImage) return;
    scheduleRender(sourceImage, settings, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceImage]);

  // ── File loading ────────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/') && !file.name.match(/\.(heic|heif)$/i)) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width  > MAX_PX) { height = Math.round(height * MAX_PX / width);  width  = MAX_PX; }
        if (height > MAX_PX) { width  = Math.round(width  * MAX_PX / height); height = MAX_PX; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
        setSourceImage(canvas);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [setSourceImage]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = ''; // reset so same file can be re-selected
  };

  const openSheet  = (s: Sheet) => setActiveSheet(s);
  const closeSheet = () => setActiveSheet(null);

  return (
    <>
      {/* Global style for mobile slider thumb */}
      <style>{`
        .mobile-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          cursor: pointer;
        }
        .mobile-slider::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #ffffff;
          border: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          cursor: pointer;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      <div style={{
        height:        '100dvh',
        display:       'flex',
        flexDirection: 'column',
        background:    '#0a0a0a',
        overflow:      'hidden',
        position:      'relative',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          height:         52,
          paddingInline:  20,
          background:     '#111111',
          borderBottom:   '1px solid #1e1e1e',
          flexShrink:     0,
          paddingTop:     'env(safe-area-inset-top)',
        }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Logomark */}
            <div style={{ width: 26, height: 26, borderRadius: 6, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 14 14" width="13" height="13" fill="#000000">
                <circle cx="3"  cy="3"  r="1.55"/>
                <circle cx="7"  cy="3"  r="1.10"/>
                <circle cx="11" cy="3"  r="0.70"/>
                <circle cx="3"  cy="7"  r="1.10"/>
                <circle cx="7"  cy="7"  r="1.55"/>
                <circle cx="11" cy="7"  r="1.10"/>
                <circle cx="3"  cy="11" r="0.70"/>
                <circle cx="7"  cy="11" r="1.10"/>
                <circle cx="11" cy="11" r="1.55"/>
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Curato</span>
              <span style={{ fontSize: 16, fontWeight: 300, color: '#555555', letterSpacing: '0.01em' }}>Lab</span>
            </div>
          </div>

          {/* Status chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {supportsWorker && (
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: rendering ? '#ffffff' : '#333333', transition: 'background 200ms' }} />
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: '#444444', letterSpacing: '0.05em' }}>
              POINTILLIST
            </span>
          </div>
        </header>

        {/* ── Canvas area ─────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden', position: 'relative' }}>

          {/* Empty state — tap to upload */}
          {!sourceImage && (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                gap:            20,
                padding:        '40px 32px',
                borderRadius:   20,
                border:         '1px solid rgba(255,255,255,0.1)',
                background:     'rgba(255,255,255,0.02)',
                cursor:         'pointer',
                width:          '100%',
                maxWidth:       320,
              }}
            >
              {/* Icon */}
              <div style={{ width: 72, height: 72, borderRadius: 18, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>

              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#ffffff' }}>
                  Open a photo
                </p>
                <p style={{ margin: 0, fontSize: 13, color: '#555555', lineHeight: 1.5 }}>
                  Tap to choose from your library<br />or take a new photo
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {['JPG', 'PNG', 'HEIC', 'WEBP'].map((f) => (
                  <span key={f} style={{ fontSize: 10, fontWeight: 700, color: '#444444', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 4, background: '#1a1a1a', border: '1px solid #282828' }}>{f}</span>
                ))}
              </div>
            </button>
          )}

          {/* Canvas */}
          {sourceImage && (
            <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <canvas
                ref={canvasRef}
                style={{
                  display:        'block',
                  maxWidth:       '100%',
                  maxHeight:      '100%',
                  borderRadius:   12,
                  boxShadow:      '0 0 0 1px rgba(255,255,255,0.07), 0 16px 48px rgba(0,0,0,0.7)',
                }}
              />

              {/* Rendering overlay */}
              <div style={{
                position:       'absolute',
                inset:          0,
                borderRadius:   12,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                background:     rendering ? 'rgba(0,0,0,0.4)' : 'transparent',
                opacity:        rendering ? 1 : 0,
                pointerEvents:  'none',
                transition:     'opacity 200ms',
              }}>
                {rendering && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 24, background: 'rgba(17,17,17,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <svg style={{ animation: 'spin 1s linear infinite', width: 14, height: 14, color: '#ffffff' }} viewBox="0 0 24 24" fill="none">
                      <circle style={{ opacity: 0.15 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/>
                      <path style={{ opacity: 0.9 }} fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/>
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#ffffff' }}>Rendering…</span>
                  </div>
                )}
              </div>

              {/* Tap to replace */}
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  position:   'absolute',
                  top:        10,
                  right:      10,
                  height:     32,
                  paddingInline: 12,
                  borderRadius: 8,
                  background: 'rgba(17,17,17,0.85)',
                  border:     '1px solid rgba(255,255,255,0.1)',
                  color:      '#888888',
                  fontSize:   11,
                  fontWeight: 600,
                  cursor:     'pointer',
                  display:    'flex',
                  alignItems: 'center',
                  gap:        5,
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                Replace
              </button>
            </div>
          )}
        </main>

        {/* ── Bottom action bar ──────────────────────────────────────────────── */}
        <ActionBar
          activeSheet={activeSheet}
          hasImage={!!sourceImage}
          onUpload={() => fileRef.current?.click()}
          onPresets={() => openSheet(activeSheet === 'presets' ? null : 'presets')}
          onControls={() => openSheet(activeSheet === 'controls' ? null : 'controls')}
          onExport={() => openSheet(activeSheet === 'export' ? null : 'export')}
        />

        {/* ── Bottom sheets ──────────────────────────────────────────────────── */}
        <BottomSheet
          isOpen={activeSheet === 'controls'}
          onClose={closeSheet}
          title="Controls"
          maxHeight="85dvh"
        >
          <ControlsContent />
        </BottomSheet>

        <BottomSheet
          isOpen={activeSheet === 'presets'}
          onClose={closeSheet}
          title="Presets"
          maxHeight="75dvh"
        >
          <PresetsContent onClose={closeSheet} />
        </BottomSheet>

        <BottomSheet
          isOpen={activeSheet === 'export'}
          onClose={closeSheet}
          title="Export"
          maxHeight="70dvh"
        >
          <ExportContent sourceImage={sourceImage} />
        </BottomSheet>
      </div>
    </>
  );
}
