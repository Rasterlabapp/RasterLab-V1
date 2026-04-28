'use client';

/**
 * MobileEditor — mobile layout for the Halftone editor.
 *
 * Structure:
 *   ┌──────────────────────┐  56px header
 *   │  Curato Lab  [+Add]  │
 *   ├──────────────────────┤
 *   │                      │
 *   │   Canvas / empty     │  flex-1
 *   │                      │
 *   ├──────────────────────┤
 *   │  [Add Image] CTA     │  when no image
 *   │  [Mode][Ctrl][Export]│  when image loaded
 *   └──────────────────────┘  safe-area aware
 *
 * Three bottom sheets:
 *   Mode    — 7 halftone mode buttons
 *   Controls — sliders (frequency, angle, dot size, brightness, contrast…)
 *   Export  — PNG download
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { renderHalftone } from '@/lib/halftone-engine';
import { BottomSheet } from '../../pointillist/mobile/BottomSheet';
import type { HalftoneMode } from '@/types';

type Sheet = 'mode' | 'controls' | 'export' | null;

const MAX_PX = 2400;

// ─── Icons ────────────────────────────────────────────────────────────────────

function UploadIcon({ size = 20, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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

function MobileSlider({ label, value, min, max, step = 1, unit = '', onChange }: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  const pct     = ((value - min) / (max - min)) * 100;
  const display = Number.isInteger(step) ? value : value.toFixed(1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: '#aaaaaa' }}>{label}</span>
        <span style={{ fontSize: 15, fontWeight: 700, fontFamily: 'monospace', color: '#ffffff' }}>{display}{unit}</span>
      </div>
      <div style={{ position: 'relative', height: 44, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 4, top: '50%', transform: 'translateY(-50%)', borderRadius: 2, background: '#2a2a2a' }} />
        <div style={{ position: 'absolute', left: 0, width: `${pct}%`, height: 4, top: '50%', transform: 'translateY(-50%)', borderRadius: 2, background: '#ffffff', transition: 'none' }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ position: 'relative', width: '100%', height: 44, appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', margin: 0 } as React.CSSProperties}
          className="mobile-slider" />
      </div>
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

// ─── Mode sheet ───────────────────────────────────────────────────────────────

const MODES: { label: string; value: HalftoneMode; desc: string }[] = [
  { label: 'Dots',       value: 'dots',       desc: 'Classic circular halftone' },
  { label: 'Lines',      value: 'lines',      desc: 'Parallel line screen' },
  { label: 'Crosshatch', value: 'crosshatch', desc: 'Intersecting line grid' },
  { label: 'Diamond',    value: 'diamond',    desc: 'Diamond-shaped cells' },
  { label: 'Square',     value: 'square',     desc: 'Square pixel grid' },
  { label: 'Stochastic', value: 'stochastic', desc: 'Random FM screening' },
  { label: 'Pattern',    value: 'pattern',    desc: 'Geometric pattern fill' },
];

function ModeContent({ onClose }: { onClose: () => void }) {
  const { settings, setSettings, pushHistory } = useEditorStore();
  return (
    <div style={{ padding: '8px 16px 32px' }}>
      <SheetSection label="Halftone Mode">
        {MODES.map((m) => (
          <button key={m.value}
            onClick={() => { setSettings({ mode: m.value }); pushHistory(); onClose(); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              width: '100%', minHeight: 56, padding: '0 16px',
              borderRadius: 12,
              border: `1px solid ${settings.mode === m.value ? '#3a3a3a' : 'transparent'}`,
              background: settings.mode === m.value ? 'rgba(255,255,255,0.07)' : 'transparent',
              cursor: 'pointer', textAlign: 'left',
            }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: settings.mode === m.value ? '#ffffff' : '#333333', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: settings.mode === m.value ? '#ffffff' : '#888888' }}>{m.label}</p>
              <p style={{ margin: 0, fontSize: 11, color: '#444444', marginTop: 1 }}>{m.desc}</p>
            </div>
            {settings.mode === m.value && <span style={{ fontSize: 11, fontWeight: 600, color: '#555555', letterSpacing: '0.08em' }}>ACTIVE</span>}
          </button>
        ))}
      </SheetSection>
    </div>
  );
}

// ─── Controls sheet ───────────────────────────────────────────────────────────

function ControlsContent() {
  const { settings, setSettings } = useEditorStore();
  const s = settings;
  return (
    <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SheetSection label="Halftone">
        <MobileSlider label="Frequency" value={s.frequency} min={2}    max={80}  unit=" lpi" onChange={(v) => setSettings({ frequency: v })} />
        <MobileSlider label="Angle"     value={s.angle}     min={0}    max={180} unit="°"    onChange={(v) => setSettings({ angle: v })} />
        <MobileSlider label="Dot Size"  value={s.dotSize}   min={0.2}  max={2}   step={0.1}  onChange={(v) => setSettings({ dotSize: v })} />
      </SheetSection>
      <SheetSection label="Image">
        <MobileSlider label="Brightness"    value={s.brightness}   min={-100} max={100}         onChange={(v) => setSettings({ brightness: v })} />
        <MobileSlider label="Contrast"      value={s.contrast}     min={-100} max={100}         onChange={(v) => setSettings({ contrast: v })} />
        <MobileSlider label="Blur"          value={s.blur}         min={0}    max={10}  step={0.5} unit="px" onChange={(v) => setSettings({ blur: v })} />
        <MobileSlider label="Clean Radius"  value={s.cleanRadius}  min={0}    max={5}            onChange={(v) => setSettings({ cleanRadius: v })} />
      </SheetSection>
      <SheetSection label="Output">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: '#aaaaaa' }}>Invert Output</span>
          <button type="button" role="switch" aria-checked={s.invertOutput}
            onClick={() => setSettings({ invertOutput: !s.invertOutput })}
            style={{ width: 52, height: 28, borderRadius: 14, background: s.invertOutput ? '#ffffff' : '#2a2a2a', border: `1.5px solid ${s.invertOutput ? '#ffffff' : '#3a3a3a'}`, position: 'relative', cursor: 'pointer', transition: 'background 200ms', flexShrink: 0 }}>
            <span style={{ position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: s.invertOutput ? '#000000' : '#666666', transition: 'transform 200ms', transform: `translateX(${s.invertOutput ? 26 : 2}px)` }} />
          </button>
        </div>
      </SheetSection>
    </div>
  );
}

// ─── Export sheet ─────────────────────────────────────────────────────────────

function ExportContent({ sourceImage }: { sourceImage: HTMLCanvasElement | null }) {
  const { settings } = useEditorStore();
  const [exporting, setExporting] = useState(false);

  const exportPng = async () => {
    if (!sourceImage || exporting) return;
    setExporting(true);
    await new Promise<void>((r) => setTimeout(r, 16));
    try {
      const dst = document.createElement('canvas');
      renderHalftone(sourceImage, dst, settings);
      const filename = `curato-lab-halftone-${settings.mode}-${Date.now()}.png`;
      await new Promise<void>((resolve) => {
        dst.toBlob(async (blob) => {
          if (!blob) { resolve(); return; }
          const shareFile = new File([blob], filename, { type: 'image/png' });
          if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [shareFile] })) {
            try { await navigator.share({ files: [shareFile], title: 'Curato Lab Export' }); resolve(); return; } catch { /* fallthrough */ }
          }
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          resolve();
        }, 'image/png');
      });
    } finally { setExporting(false); }
  };

  return (
    <div style={{ padding: '8px 20px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <SheetSection label="Download">
        <button onClick={exportPng} disabled={!sourceImage || exporting}
          style={{ width: '100%', height: 56, borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: !sourceImage ? 'not-allowed' : 'pointer', opacity: !sourceImage ? 0.25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', background: '#ffffff', color: '#000000' }}>
          {exporting
            ? <><Spinner />Exporting…</>
            : <>↓ Export PNG{sourceImage && <span style={{ fontSize: 10, fontWeight: 400, opacity: 0.4 }}>{sourceImage.width}×{sourceImage.height}</span>}</>}
        </button>
        <p style={{ textAlign: 'center', fontSize: 11, color: '#333333', margin: 0 }}>
          {settings.mode} · {settings.frequency} lpi
        </p>
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

// ─── View mode pill selector ──────────────────────────────────────────────────

function ViewModePills() {
  const { viewMode, setViewMode } = useEditorStore();
  const modes = [
    { value: 'halftone',  label: 'Halftone' },
    { value: 'grayscale', label: 'Gray' },
    { value: 'original',  label: 'Original' },
  ] as const;
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {modes.map((m) => (
        <button key={m.value} onClick={() => setViewMode(m.value)}
          style={{ height: 30, paddingInline: 10, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'background 150ms, color 150ms', background: viewMode === m.value ? '#ffffff' : '#1e1e1e', color: viewMode === m.value ? '#000000' : '#555555' }}>
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Bottom action bar (when image loaded) ────────────────────────────────────

function ActionBar({ activeSheet, onMode, onControls, onExport }: {
  activeSheet: Sheet; onMode: () => void; onControls: () => void; onExport: () => void;
}) {
  const { settings } = useEditorStore();
  const tabs = [
    {
      id: 'mode' as Sheet, label: settings.mode.charAt(0).toUpperCase() + settings.mode.slice(1), action: onMode,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="3"/>
      </svg>,
    },
    {
      id: 'controls' as Sheet, label: 'Controls', action: onControls,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>
        <circle cx="9" cy="7" r="2.2" fill="#131313" strokeWidth="1.8"/>
        <circle cx="15" cy="12" r="2.2" fill="#131313" strokeWidth="1.8"/>
        <circle cx="9" cy="17" r="2.2" fill="#131313" strokeWidth="1.8"/>
      </svg>,
    },
    {
      id: 'export' as Sheet, label: 'Export', action: onExport,
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 18h14a2 2 0 002-2v-1"/>
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

export function MobileEditor() {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const cameraRef  = useRef<HTMLInputElement>(null);
  const [activeSheet, setActiveSheet] = useState<Sheet>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { settings, viewMode, sourceImage, setSourceImage, setRenderTime } = useEditorStore();

  // ── Render halftone to canvas ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sourceImage) return;
    const ctx = canvas.getContext('2d')!;
    canvas.width  = sourceImage.width;
    canvas.height = sourceImage.height;

    if (viewMode === 'original') {
      ctx.drawImage(sourceImage, 0, 0);
      return;
    }
    if (viewMode === 'grayscale') {
      ctx.drawImage(sourceImage, 0, 0);
      const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = id.data;
      for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        d[i] = d[i + 1] = d[i + 2] = g;
      }
      ctx.putImageData(id, 0, 0);
      return;
    }
    const ms = renderHalftone(sourceImage, canvas, settings);
    setRenderTime(ms);
  }, [settings, viewMode, sourceImage, setRenderTime]);

  // ── File loading ─────────────────────────────────────────────────────────
  const loadFile = useCallback((file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) {
      setUploadError('Please choose an image file (JPG, PNG, HEIC, WebP).');
      return;
    }
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
      <style>{`
        .mobile-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 24px; height: 24px; border-radius: 50%;
          background: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.6); cursor: pointer;
        }
        .mobile-slider::-moz-range-thumb {
          width: 24px; height: 24px; border-radius: 50%;
          background: #ffffff; border: none; box-shadow: 0 2px 8px rgba(0,0,0,0.6); cursor: pointer;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      `}</style>

      {/* Hidden file inputs */}
      <input ref={fileRef}   type="file" accept="image/*,.heic,.heif" style={{ display: 'none' }} onChange={onFileChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFileChange} />

      <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0a0a0a', overflow: 'hidden' }}>

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, paddingInline: 16, background: '#111111', borderBottom: '1px solid #1e1e1e', flexShrink: 0, paddingTop: 'env(safe-area-inset-top)' }}>

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

          {/* Right: view pills when image loaded; + Add when empty */}
          {hasImage ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ViewModePills />
              <button onClick={removeImage}
                style={{ width: 30, height: 30, borderRadius: 7, background: 'transparent', border: '1px solid #333333', color: '#666666', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                aria-label="Remove image">×</button>
            </div>
          ) : (
            <button onClick={openGallery}
              style={{ height: 36, paddingInline: 14, borderRadius: 10, background: '#ffffff', color: '#000000', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Image
            </button>
          )}
        </header>

        {/* ── Main ──────────────────────────────────────────────────────────── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

          {/* Empty state */}
          {!hasImage && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 20px', animation: 'fadeIn 300ms ease' }}>
              <div onClick={openGallery}
                style={{ width: '100%', maxWidth: 360, padding: '36px 24px', borderRadius: 20, border: '2px dashed rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, WebkitTapHighlightColor: 'transparent' } as React.CSSProperties}>

                <div style={{ width: 80, height: 80, borderRadius: 20, background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UploadIcon size={36} color="rgba(255,255,255,0.7)" />
                </div>

                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>Add Image</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#666666', lineHeight: 1.5 }}>Choose a photo or take one now</p>
                </div>

                <button onClick={(e) => { e.stopPropagation(); openGallery(); }}
                  style={{ width: '100%', height: 52, borderRadius: 14, background: '#ffffff', color: '#000000', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <UploadIcon size={18} color="#000000" />
                  Upload Image
                </button>

                <button onClick={(e) => { e.stopPropagation(); openCamera(); }}
                  style={{ width: '100%', height: 52, borderRadius: 14, background: 'transparent', color: '#cccccc', border: '1.5px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <CameraIcon size={18} color="#cccccc" />
                  Use Camera
                </button>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['JPG', 'PNG', 'HEIC', 'WEBP'].map((f) => (
                    <span key={f} style={{ fontSize: 10, fontWeight: 700, color: '#444444', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 4, background: '#161616', border: '1px solid #282828' }}>{f}</span>
                  ))}
                </div>
              </div>

              {uploadError && (
                <div style={{ marginTop: 16, padding: '10px 16px', borderRadius: 10, background: 'rgba(200,50,50,0.12)', border: '1px solid rgba(200,50,50,0.25)', maxWidth: 360, width: '100%' }}>
                  <p style={{ margin: 0, fontSize: 13, color: '#ff6b6b', textAlign: 'center' }}>{uploadError}</p>
                </div>
              )}
            </div>
          )}

          {/* Canvas */}
          {hasImage && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' }}>
              <canvas ref={canvasRef}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', borderRadius: 12, boxShadow: '0 0 0 1px rgba(255,255,255,0.07), 0 16px 48px rgba(0,0,0,0.7)' }} />
            </div>
          )}
        </main>

        {/* ── Bottom area ────────────────────────────────────────────────────── */}
        {!hasImage ? (
          <div style={{ padding: '12px 20px', paddingBottom: 'max(12px, env(safe-area-inset-bottom))', background: '#111111', borderTop: '1px solid #1e1e1e', flexShrink: 0 }}>
            <button onClick={openGallery}
              style={{ width: '100%', height: 56, borderRadius: 16, background: '#ffffff', color: '#000000', border: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, letterSpacing: '-0.01em' }}>
              <UploadIcon size={20} color="#000000" />
              Add Image
            </button>
          </div>
        ) : (
          <ActionBar
            activeSheet={activeSheet}
            onMode={() => openSheet('mode')}
            onControls={() => openSheet('controls')}
            onExport={() => openSheet('export')}
          />
        )}

        {/* ── Sheets ────────────────────────────────────────────────────────── */}
        <BottomSheet isOpen={activeSheet === 'mode'} onClose={closeSheet} title="Halftone Mode" maxHeight="80dvh">
          <ModeContent onClose={closeSheet} />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'controls'} onClose={closeSheet} title="Controls" maxHeight="85dvh">
          <ControlsContent />
        </BottomSheet>

        <BottomSheet isOpen={activeSheet === 'export'} onClose={closeSheet} title="Export" maxHeight="55dvh">
          <ExportContent sourceImage={sourceImage} />
        </BottomSheet>
      </div>
    </>
  );
}
