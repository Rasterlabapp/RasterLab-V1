'use client';

import { useState, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { generateSVG } from '@/lib/halftone-engine';
import { renderHalftone } from '@/lib/halftone-engine';
import { exportPDF, type PDFExportOptions } from '@/lib/pdf-export';
import type { Preset, BatchItem } from '@/types';

type Tab = 'presets' | 'batch' | 'export';

export function RightSidebar() {
  const [tab, setTab] = useState<Tab>('presets');

  return (
    <aside className="w-56 bg-zinc-900 border-l border-zinc-800 flex flex-col">
      <div className="flex border-b border-zinc-800">
        {(['presets', 'batch', 'export'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-colors ${
              tab === t ? 'text-white border-b-2 border-indigo-500' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'presets' && <PresetsTab />}
        {tab === 'batch' && <BatchTab />}
        {tab === 'export' && <ExportTab />}
      </div>
    </aside>
  );
}

// ─── Presets ──────────────────────────────────────────────────────────────────

function PresetsTab() {
  const { presets, addPreset, deletePreset, loadPreset, settings } = useEditorStore();
  const [name, setName] = useState('');

  const save = () => {
    if (!name.trim()) return;
    const preset: Preset = {
      id: crypto.randomUUID(),
      name: name.trim(),
      settings: { ...settings },
      createdAt: new Date().toISOString(),
    };
    addPreset(preset);
    setName('');
  };

  return (
    <div className="p-3 flex flex-col gap-3">
      <div className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder="Preset name…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={save}
          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs transition-colors"
        >
          Save
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {presets.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">No presets yet</p>
        )}
        {presets.map((p) => (
          <div key={p.id} className="flex items-center gap-1 group p-1.5 rounded hover:bg-zinc-800">
            <button
              onClick={() => loadPreset(p)}
              className="flex-1 text-left text-xs text-zinc-300 hover:text-white truncate"
            >
              {p.name}
            </button>
            <button
              onClick={() => deletePreset(p.id)}
              className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 text-xs transition-opacity"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Batch ────────────────────────────────────────────────────────────────────

function BatchTab() {
  const {
    batchItems, addBatchItem, updateBatchItem, clearBatch, settings,
    batchProgress, batchRunning, setBatchProgress, setBatchRunning,
  } = useEditorStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const item: BatchItem = {
          id: crypto.randomUUID(),
          file,
          dataUrl: e.target?.result as string,
          status: 'pending',
        };
        addBatchItem(item);
      };
      reader.readAsDataURL(file);
    });
  };

  const runBatch = async () => {
    const pending = batchItems.filter((b) => b.status !== 'done');
    if (pending.length === 0) return;

    setBatchRunning(true);
    setBatchProgress(0);

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      updateBatchItem(item.id, { status: 'processing' });

      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const src = document.createElement('canvas');
          src.width = img.width; src.height = img.height;
          src.getContext('2d')!.drawImage(img, 0, 0);

          const dst = document.createElement('canvas');
          renderHalftone(src, dst, settings);

          updateBatchItem(item.id, { status: 'done', resultUrl: dst.toDataURL('image/png') });
          setBatchProgress(Math.round(((i + 1) / pending.length) * 100));
          resolve();
        };
        img.src = item.dataUrl;
      });
    }

    setBatchRunning(false);
  };

  const downloadAll = () => {
    batchItems.filter((b) => b.status === 'done').forEach((b) => {
      const a = document.createElement('a');
      a.href = b.resultUrl!;
      a.download = `halftone_${b.file.name}`;
      a.click();
    });
  };

  const doneCount = batchItems.filter((b) => b.status === 'done').length;
  const total = batchItems.length;

  return (
    <div className="p-3 flex flex-col gap-3">
      <button
        onClick={() => inputRef.current?.click()}
        className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300 transition-colors"
      >
        + Add Images
      </button>
      <input ref={inputRef} type="file" multiple accept="image/*" className="hidden"
        onChange={(e) => addFiles(e.target.files)} />

      {/* Progress bar */}
      {(batchRunning || (doneCount > 0 && doneCount < total)) && (
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{batchRunning ? 'Processing…' : 'Done'}</span>
            <span>{doneCount}/{total}</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${batchProgress}%` }}
            />
          </div>
          {batchProgress === 100 && !batchRunning && (
            <p className="text-xs text-green-400">✓ All done</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
        {batchItems.map((b) => (
          <div key={b.id} className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              b.status === 'done' ? 'bg-green-500' :
              b.status === 'processing' ? 'bg-yellow-400 animate-pulse' :
              'bg-zinc-600'
            }`} />
            <span className="truncate text-zinc-400 flex-1">{b.file.name}</span>
          </div>
        ))}
        {batchItems.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">No images added</p>
        )}
      </div>

      <div className="flex gap-1">
        <button
          onClick={runBatch}
          disabled={batchItems.length === 0 || batchRunning}
          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-xs text-white transition-colors"
        >
          {batchRunning ? 'Running…' : 'Run Batch'}
        </button>
        <button
          onClick={downloadAll}
          disabled={doneCount === 0}
          className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 rounded text-xs text-zinc-300 transition-colors"
        >
          Download
        </button>
      </div>

      <button onClick={clearBatch} disabled={batchRunning}
        className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors">
        Clear all
      </button>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

function ExportTab() {
  const { sourceImage, settings, dpi, setDpi } = useEditorStore();
  const [pdfOptions, setPdfOptions] = useState<PDFExportOptions>({
    dpi: 300,
    colorMode: 'rgb',
    pageSize: 'fit',
    title: 'RasterLab Halftone',
    includeBleed: true,
    cropMarks: true,
  });
  const [exporting, setExporting] = useState(false);

  const patchPdf = (patch: Partial<PDFExportOptions>) =>
    setPdfOptions((o) => ({ ...o, ...patch }));

  const exportPng = () => {
    if (!sourceImage) return;
    const dst = document.createElement('canvas');
    renderHalftone(sourceImage, dst, settings);
    const a = document.createElement('a');
    a.href = dst.toDataURL('image/png');
    a.download = 'rasterlab-halftone.png';
    a.click();
  };

  const exportSvg = () => {
    if (!sourceImage) return;
    const svg = generateSVG(sourceImage, settings);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rasterlab-halftone.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportChannelPlate = (channel: 'C' | 'M' | 'Y' | 'K') => {
    if (!sourceImage) return;
    const dst = document.createElement('canvas');
    renderHalftone(sourceImage, dst, { ...settings, cmykMode: true, activeChannel: channel });
    const a = document.createElement('a');
    a.href = dst.toDataURL('image/png');
    a.download = `rasterlab-${channel}-plate.png`;
    a.click();
  };

  const handleExportPDF = async () => {
    if (!sourceImage || exporting) return;
    setExporting(true);
    try {
      await exportPDF(sourceImage, settings, { ...pdfOptions, dpi });
    } finally {
      setExporting(false);
    }
  };

  const disabled = !sourceImage;

  return (
    <div className="p-3 flex flex-col gap-2">

      {/* Raster */}
      <SectionLabel>Raster</SectionLabel>
      <ExportBtn label="Export PNG" onClick={exportPng} disabled={disabled} />

      {/* Vector */}
      <SectionLabel>Vector</SectionLabel>
      <ExportBtn label="Export SVG" onClick={exportSvg} disabled={disabled} />

      {/* PDF */}
      <SectionLabel>Print PDF</SectionLabel>

      {/* DPI picker */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Resolution</span>
        <select
          value={dpi}
          onChange={(e) => { const v = Number(e.target.value); setDpi(v); patchPdf({ dpi: v }); }}
          className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          {[72, 150, 300, 600].map((d) => (
            <option key={d} value={d}>{d} dpi</option>
          ))}
        </select>
      </div>

      {/* Page size */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400">Page size</span>
        <select
          value={pdfOptions.pageSize}
          onChange={(e) => patchPdf({ pageSize: e.target.value as PDFExportOptions['pageSize'] })}
          className="bg-zinc-800 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500"
        >
          <option value="fit">Fit to image</option>
          <option value="a4">A4</option>
          <option value="letter">US Letter</option>
          <option value="tabloid">Tabloid</option>
        </select>
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-1.5 mt-1">
        <Toggle
          label="Crop marks"
          checked={pdfOptions.cropMarks}
          onChange={(v) => patchPdf({ cropMarks: v })}
        />
        <Toggle
          label="3mm bleed"
          checked={pdfOptions.includeBleed}
          onChange={(v) => patchPdf({ includeBleed: v })}
        />
      </div>

      <button
        onClick={handleExportPDF}
        disabled={disabled || exporting}
        className="w-full py-2 mt-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs text-white font-medium transition-colors"
      >
        {exporting ? 'Generating PDF…' : '↓ Export Print PDF'}
      </button>

      {/* CMYK Plates */}
      <SectionLabel>CMYK Plates</SectionLabel>
      {(['C', 'M', 'Y', 'K'] as const).map((ch) => (
        <ExportBtn key={ch} label={`${ch} Plate`} onClick={() => exportChannelPlate(ch)} disabled={disabled} />
      ))}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider mt-2 mb-0.5">{children}</p>
  );
}

function ExportBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed rounded text-xs text-zinc-300 transition-colors text-left px-3"
    >
      ↓ {label}
    </button>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-indigo-500"
      />
      <span className="text-xs text-zinc-400">{label}</span>
    </label>
  );
}
