'use client';

/**
 * MobileLayout — complete mobile experience for Curato Lab Pointillist.
 *
 * Upload surface areas (three, all trigger the same file input):
 *   1. Header  — "+ Add Image" CTA when empty; "Change / Remove" when loaded
 *   2. Empty state — full dashed-border upload card with primary + camera CTA
 *   3. Bottom bar  — single "Add Image" primary button when empty;
 *                    normal 4-tab bar when loaded
 *
 * Three bottom sheets: Controls / Presets / Export
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { usePointillistStore } from '@/store/pointillist-store';
import { usePointillistRenderer } from '@/hooks/usePointillistRenderer';
import { renderPointillistCore } from '@/lib/pointillist-engine';
import { BottomSheet } from './BottomSheet';

const MAX_PX = 2400;

type Sheet = 'controls' | 'presets' | 'export' | null;

// ─── Upload icon ──────────────────────────────────────────────────────────────

function UploadIcon({ size = 36, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}

function CameraIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

// ─── Mobile Slider ────────────────────────────────────────────────────────────

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
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, top: '50%', transform: 'translateY(-50%)', borderRadius: 2, background: '#2a2a2a' }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, top: '50%', transform: 'translateY(-50%)', borderRadius: 2, background: '#ffffff', transition: 'none' }} />
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
        type="button" role="switch" aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{ width: 52, height: 28, borderRadius: 14, background: checked ? '#ffffff' : '#2a2a2a', border: `1.5px solid ${checked ? '#ffffff' : '#3a3a3a'}`, position: 'relative', cursor: 'pointer', transition: 'background 200ms, border-color 200ms', flexShrink: 0 }}
      >
        <span style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: checked ? '#000000' : '#666666', transition: 'transform 200ms, background 200ms', transform: `translateX(${checked ? 26 : 2}px)` }} />
      </button>
    </div>
  );
}

// ─── Sheet section wrapper ────────────────────────────────────────────────────

function SheetSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 18 }}>
      <p style={{ margin: 0, fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: '#444444' }}>{label}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      <div style={{ height: 1, background: '#1a1a1a', marginTop: 4 }} />
    </div>
  );
}

// ─── Controls sheet ───────────────────────────────────────────────────────────

function ControlsContent() {
  const { settings, setSettings } = usePointillistStore();
  const s = settings;
  return (
    <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SheetSection label="Dot">
        <MobileSlider label="Size"       value={s.dotSize}        min={1}    max={20}  unit="px" onChange={(v) => setSettings({ dotSize: v })} />
        <MobileSlider label="Density"    value={s.density}        min={1}    max={100} unit="%"  onChange={(v) => setSettings({ density: v })} />
        <MobileSlider label="Randomness" value={s.randomness}     min={0}    max={100} unit="%"  onChange={(v) => setSettings({ randomness: v })} />
      </SheetSection>
      <SheetSection label="Image">
        <MobileSlider label="Brightness" value={s.brightness}     min={-100} max={100}           onChange={(v) => setSettings({ brightness: v })} />
        <MobileSlider label="Contrast"   value={s.contrast}       min={-100} max={100}           onChange={(v) => setSettings({ contrast: v })} />
        <MobileSlider label="Smoothing"  value={s.smoothing}      min={0}    max={100} unit="%"  onChange={(v) => setSettings({ smoothing: v })} />
      </SheetSection>
      <SheetSection label="Detail">
        <MobileSlider label="Edge Sensitivity" value={s.edgeSensitivity} min={0} max={100} unit="%" onChange={(v) => setSettings({ edgeSensitivity: v })} />
      </SheetSection>
      <SheetSection label="Style">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#aaaaaa' }}>Color Mode</span>
          <div style={{ display: 'flex', padding: 3, gap: 3, background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' }}>
            {(['color', 'monochrome'] as const).map((m) => (
              <button key={m} onClick={() => setSettings({ colorMode: m })}
                style={{ flex: 1, height: 40, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'background 150ms, color 150ms', background: s.colorMode === m ? '#ffffff' : 'transparent', color: s.colorMode === m ? '#000000' : '#555555', textTransform: 'capitalize' }}>
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

// ─── Presets sheet ────────────────────────────────────────────────────────────

function PresetsContent({ onClose }: { onClose: () => void }) {
  const { presets, activePresetId, loadPreset } = usePointillistStore();
  return (
    <div style={{ padding: '8px 16px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SheetSection label="Built-in Presets">
        {presets.slice(0, 6).map((p) => (
          <button key={p.id} onClick={() => { loadPreset(p.id); onClose(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '0 16px', borderRadius: 12, border: `1px solid ${activePresetId === p.id ? '#3a3a3a' : 'transparent'}`, background: activePresetId === p.id ? 'rgba(255,255,255,0.07)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: activePresetId === p.id ? '#ffffff' : '#333333', flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: activePresetId === p.id ? '#ffffff' : '#888888', flex: 1 }}>{p.name}</span>
            {activePresetId === p.id && <span style={{ fontSize: 11, fontWeight: 600, color: '#555555', letterSpacing: '0.08em' }}>ACTIVE</span>}
          </button>
        ))}
      </SheetSection>
      {presets.slice(6).length > 0 && (
        <SheetSection label="Custom Presets">
          {presets.slice(6).map((p) => (
            <button key={p.id} onClick={() => { loadPreset(p.id); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '0 16px', borderRadius: 12, border: `1px solid ${activePresetId === p.id ? '#3a3a3a' : 'transparent'}`, background: activePresetId === p.id ? 'rgba(255,255,255,0.07)' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: activePresetId === p.id ? '#ffffff' : '#333333', flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: activePresetId === p.id ? '#ffffff' : '#888888', flex: 1 }}>{p.name}</span>
            </button>
          ))}
        </SheetSection>
      )}
    </div>
  );
}

// ─── Export sheet ─────────────────────────────────────────────────────────────

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
      const w = sourceImage.width * scale, h = sourceImage.height * scale;
      const src = document.createElement('canvas'); src.width = w; src.height = h;
      src.getContext('2d')!.drawImage(sourceImage, 0, 0, w, h);
      const pixelBuffer = src.getContext('2d')!.getImageData(0, 0, w, h).data.buffer.slice(0);
      const dst = document.createElement('canvas'); dst.width = w; dst.height = h;
      const dstCtx = dst.getContext('2d')!;
      if (bgMode === 'white') { dstCtx.fillStyle = '#ffffff'; dstCtx.fillRect(0, 0, w, h); }
      renderPointillistCore(new Uint8ClampedArray(pixelBuffer), w, h,
        { ...settings, dotSize: settings.dotSize * scale, backgroundColor: bgMode === 'white' ? '#ffffff' : 'transparent' }, dstCtx);
      const filename = `curato-lab-pointillist-${settings.colorMode}-${key}-${bgMode}-${Date.now()}.png`;
      await new Promise<void>((resolve) => {
        dst.toBlob(async (blob) => {
          if (!blob) { resolve(); return; }
          const shareFile = new File([blob], filename, { type: 'image/png' });
          if (scale === 1 && typeof navigator.share === 'function' && navigator.canShare?.({ files: [shareFile] })) {
            try { await navigator.share({ files: [shareFile], title: 'Curato Lab Export' }); resolve(); return; } catch { /* fallthrough */ }
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, 'image/png');
      });
    } finally { setExporting(null); }
  };

  const disabled = !sourceImage;
  return (
    <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <SheetSection label="Background">
        <div style={{ display: 'flex', padding: 3, gap: 3, background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a' }}>
          {(['white', 'transparent'] as const).map((m) => (
            <button key={m} onClick={() => setBgMode(m)}
              style={{ flex: 1, height: 44, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: bgMode === m ? '#ffffff' : 'transparent', color: bgMode === m ? '#000000' : '#555555', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background 150ms, color 150ms' }}>
              {m === 'white'
                ? <><span style={{ width: 12, height: 12, borderRadius: 3, background: '#ffffff', border: '1px solid #aaa', flexShrink: 0 }} />White</>
                : <><span style={{ width: 12, height: 12, borderRadius: 3, border: '1.5px dashed #666', flexShrink: 0 }} />Alpha</>}
            </button>
          ))}
        </div>
      </SheetSection>
      <SheetSection label="Save Image">
        {[{ scale: 1 as const, label: '1× PNG', key: '1x' as const }, { scale: 2 as const, label: '2× PNG', key: '2x' as const }].map(({ scale, label, key }) => (
          <button key={key} onClick={() => runExport(scale)} disabled={disabled || exporting !== null}
            style={{ width: '100%', height: 54, borderRadius: 14, fontSize: 14, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: scale === 1 ? 'none' : '1px solid #2a2a2a', background: scale === 1 ? '#ffffff' : '#1a1a1a', color: scale === 1 ? '#000000' : '#888888', transition: 'opacity 150ms' }}>
            {exporting === key
              ? <><Spinner />Exporting…</>
              : <>↓ {label}{sourceImage && <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.4 }}>{sourceImage.width * scale}×{sourceImage.height * scale}</span>}</>}
          </button>
        ))}
        <p style={{ textAlign: 'center', fontSize: 11, color: '#333333', margin: 0 }}>Re-rendered at full export size</p>
      </SheetSection>
    </div>
  );
}

function Spinner() {
  return (
    <svg style={{ animation: 'spin 1s linear infinite', width: 16, height: 16, flexShrink: 0 }} viewBox="0 0 24 24" fill="none">
      <circle style={{ opacity: 0.2 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5"/>
      <path style={{ opacity: 0.9 }} fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"/>
    </svg>
  );
}

// ─── Bottom action bar (when image loaded) ────────────────────────────────────

function ActionBar({ activeSheet, onPresets, onControls, onExport }: {
  activeSheet: Sheet;
  onPresets:  () => void;
  onControls: () => void;
  onExport:   () => void;
}) {
  const tabs = [
    {
      id: 'presets' as Sheet, label: 'Presets', action: onPresets,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="5" cy="6" r="1" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="19" cy="6" r="1" fill="currentColor" stroke="none"/>
        <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
        <circle cx="5" cy="18" r="1" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="18" r="1.1" fill="currentColor" stroke="none"/>
        <circle cx="19" cy="18" r="1.5" fill="currentColor" stroke="none"/>
      </svg>,
    },
    {
      id: 'controls' as Sheet, label: 'Controls', action: onControls,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="17" x2="20" y2="17"/>
        <circle cx="9" cy="7" r="2.2" fill="#131313" strokeWidth="1.8"/>
        <circle cx="15" cy="12" r="2.2" fill="#131313" strokeWidth="1.8"/>
        <circle cx="9" cy="17" r="2.2" fill="#131313" strokeWidth="1.8"/>
      </svg>,
    },
    {
      id: 'export' as Sheet, label: 'Export', action: onExport,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M8 11l4 4 4-4"/>
        <path d="M5 18h14a2 2 0 002-2v-1"/>
      </svg>,
    },
  ];

  return (
    <div style={{ display: 'flex', alignItems: 'stretch', background: '#111111', borderTop: '1px solid #1e1e1e', paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0 }}>
      {tabs.map((btn) => {
        const isActive = btn.id === activeSheet;
        return (
          <button key={btn.id as string} onClick={btn.action}
            style={{ flex: 1, height: 62, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, border: 'none', background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent', borderTop: `1.5px solid ${isActive ? '#ffffff' : 'transparent'}`, cursor: 'pointer', color: isActive ? '#ffffff' : '#555555', transition: 'color 150ms, background 150ms' }}>
            {btn.icon}
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.04em' }}>{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function MobileLayout() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);   // gallery / any source
  const cameraRef  = useRef<HTMLInputElement>(null);   // direct camera
  const [activeSheet, setActiveSheet] = useState<Sheet>(null);
  const [rendering,   setRendering]   = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
    setUploadError(null);
    const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
    if (!isImage) { setUploadError('Please choose an image file (JPG, PNG, HEIC, WebP).'); return; }

    const reader = new FileReader();
    reader.onerror = () => setUploadError('Could not read file. Please try again.');
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => setUploadError('Could not load image. Try a different file.');
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
    e.target.value = '';
  };

  const openGallery = () => { setUploadError(null); fileRef.current?.click(); };
  const openCamera  = () => { setUploadError(null); cameraRef.current?.click(); };
  const removeImage = () => { setSourceImage(null); setActiveSheet(null); };

  const openSheet  = (s: Sheet) => setActiveSheet((cur) => cur === s ? null : s);
  const closeSheet = () => setActiveSheet(null);

  const hasImage = !!sourceImage;

  return (
    <>
      {/* ── Global styles ──────────────────────────────────────────────────── */}
      <style>{`
        .mobile-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px; height: 24px;
          border-radius: 50%;
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          cursor: pointer;
        }
        .mobile-slider::-moz-range-thumb {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: #ffffff;
          border: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.6);
          cursor: pointer;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* ── Hidden file inputs ─────────────────────────────────────────────── */}
      {/* Gallery / any source */}
      <input ref={fileRef} type="file" accept="image/*,.heic,.heif"
        style={{ display: 'none' }} onChange={onFileChange} />
      {/* Direct camera — capture="environment" opens rear camera on mobile */}
      <input ref={cameraRef} type="file" accept="image/*"
        capture="environment" style={{ display: 'none' }} onChange={onFileChange} />

      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', overflow: 'hidden' }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          height: 56, paddingInline: 16,
          background: '#111111', borderBottom: '1px solid #1e1e1e',
          flexShrink: 0,
          paddingTop: 'env(safe-area-inset-top)',
        }}>
          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg viewBox="0 0 14 14" width="13" height="13" fill="#000000">
                <circle cx="3" cy="3" r="1.55"/><circle cx="7" cy="3" r="1.10"/><circle cx="11" cy="3" r="0.70"/>
                <circle cx="3" cy="7" r="1.10"/><circle cx="7" cy="7" r="1.55"/><circle cx="11" cy="7" r="1.10"/>
                <circle cx="3" cy="11" r="0.70"/><circle cx="7" cy="11" r="1.10"/><circle cx="11" cy="11" r="1.55"/>
              </svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Curato</span>
              <span style={{ fontSize: 16, fontWeight: 300, color: '#555555' }}>Lab</span>
            </div>
          </div>

          {/* Header right: upload CTA or image management */}
          {!hasImage ? (
            /* ── No image: prominent "+ Add Image" button ── */
            <button
              onClick={openGallery}
              style={{
                height: 36, paddingInline: 14,
                borderRadius: 10,
                background: '#ffffff', color: '#000000',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
                letterSpacing: '-0.01em',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Image
            </button>
          ) : (
            /* ── Image loaded: change / remove ── */
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {supportsWorker && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: rendering ? '#ffffff' : '#2a2a2a', transition: 'background 200ms', flexShrink: 0 }} />
              )}
              <button onClick={openGallery}
                style={{ height: 34, paddingInline: 12, borderRadius: 8, background: 'transparent', border: '1px solid #333333', color: '#888888', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Change
              </button>
              <button onClick={removeImage}
                style={{ width: 34, height: 34, borderRadius: 8, background: 'transparent', border: '1px solid #333333', color: '#666666', fontSize: 18, fontWeight: 400, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
                aria-label="Remove image">
                ×
              </button>
            </div>
          )}
        </header>

        {/* ── Main area ──────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* ── EMPTY STATE ──────────────────────────────────────────────────── */}
          {!hasImage && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '24px 20px',
              animation: 'fadeIn 300ms ease',
            }}>
              {/* Upload zone — dashed border, full width, tappable */}
              <div
                onClick={openGallery}
                style={{
                  width: '100%', maxWidth: 360,
                  padding: '36px 24px',
                  borderRadius: 20,
                  border: '2px dashed rgba(255,255,255,0.25)',
                  background: 'rgba(255,255,255,0.02)',
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
                  // Active state via CSS — handled by opacity on tap
                  WebkitTapHighlightColor: 'transparent',
                } as React.CSSProperties}
              >
                {/* Icon container */}
                <div style={{
                  width: 80, height: 80, borderRadius: 20,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid rgba(255,255,255,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <UploadIcon size={36} color="rgba(255,255,255,0.7)" />
                </div>

                {/* Text */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                    Add Image
                  </p>
                  <p style={{ margin: 0, fontSize: 14, color: '#666666', lineHeight: 1.5 }}>
                    Choose a photo or take one now
                  </p>
                </div>

                {/* Primary CTA button */}
                <button
                  onClick={(e) => { e.stopPropagation(); openGallery(); }}
                  style={{
                    width: '100%', height: 52,
                    borderRadius: 14,
                    background: '#ffffff', color: '#000000',
                    border: 'none', cursor: 'pointer',
                    fontSize: 15, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    letterSpacing: '-0.01em',
                  }}
                >
                  <UploadIcon size={18} color="#000000" />
                  Upload Image
                </button>

                {/* Camera button */}
                <button
                  onClick={(e) => { e.stopPropagation(); openCamera(); }}
                  style={{
                    width: '100%', height: 52,
                    borderRadius: 14,
                    background: 'transparent', color: '#cccccc',
                    border: '1.5px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    fontSize: 15, fontWeight: 600,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <CameraIcon size={18} color="#cccccc" />
                  Use Camera
                </button>

                {/* Format badges */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['JPG', 'PNG', 'HEIC', 'WEBP'].map((f) => (
                    <span key={f} style={{ fontSize: 10, fontWeight: 700, color: '#444444', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 4, background: '#161616', border: '1px solid #282828' }}>{f}</span>
                  ))}
                </div>
              </div>

              {/* Error message */}
              {uploadError && (
                <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(200,50,50,0.12)', border: '1px solid rgba(200,50,50,0.25)', maxWidth: 360, width: '100%' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#ff6b6b', textAlign: 'center' }}>{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {/* ── CANVAS (image loaded) ─────────────────────────────────────────── */}
          {hasImage && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, position: 'relative', overflow: 'hidden' }}>
              <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 16px 48px rgba(0,0,0,0.7)' }} />

              {/* Rendering overlay */}
              <div style={{ position: 'absolute', inset: 0, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: rendering ? 'rgba(0,0,0,0.4)' : 'transparent', opacity: rendering ? 1 : 0, pointerEvents: 'none', transition: 'opacity 200ms' }}>
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
            </div>
          )}
        </main>

        {/* ── Bottom area ────────────────────────────────────────────────────── */}
        {!hasImage ? (
          /* ── No image: single sticky "Add Image" CTA ── */
          <div style={{
            padding: '12px 20px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            background: '#111111',
            borderTop: '1px solid #1e1e1e',
            flexShrink: 0,
          }}>
            <button
              onClick={openGallery}
              style={{
                width: '100%', height: 56,
                borderRadius: 16,
                background: '#ffffff', color: '#000000',
                border: 'none', cursor: 'pointer',
                fontSize: 16, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                letterSpacing: '-0.01em',
              }}
            >
              <UploadIcon size={20} color="#000000" />
              Add Image
            </button>
          </div>
        ) : (
          /* ── Image loaded: 3-tab action bar ── */
          <ActionBar
            activeSheet={activeSheet}
            onPresets={() => openSheet('presets')}
            onControls={() => openSheet('controls')}
            onExport={() => openSheet('export')}
          />
        )}

        {/* ── Bottom sheets ──────────────────────────────────────────────────── */}
        <BottomSheet isOpen={activeSheet === 'controls'} onClose={closeSheet} title="Controls" maxHeight="85dvh">
          <ControlsContent />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'presets'} onClose={closeSheet} title="Presets" maxHeight="75dvh">
          <PresetsContent onClose={closeSheet} />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'export'} onClose={closeSheet} title="Export" maxHeight="70dvh">
          <ExportContent sourceImage={sourceImage} />
        </BottomSheet>
      </div>
    </>
  );
}
