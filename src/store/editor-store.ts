'use client';

import { create } from 'zustand';
import type { HalftoneSettings, ViewMode, BatchItem, Preset, HistoryEntry } from '@/types';

const DEFAULT_SETTINGS: HalftoneSettings = {
  mode: 'dots',
  frequency: 20,
  angle: 45,
  dotSize: 1,
  contrast: 0,
  brightness: 0,
  blur: 0,
  cleanRadius: 0,
  invertOutput: false,
  cmykMode: false,
  cmykAngles: { C: 15, M: 75, Y: 0, K: 45 },
  activeChannel: 'composite',
  visibleChannels: { C: true, M: true, Y: true, K: true, composite: true },
};

const MAX_HISTORY = 20;

interface EditorState {
  settings: HalftoneSettings;
  viewMode: ViewMode;
  sourceImage: HTMLCanvasElement | null;
  renderTimeMs: number;
  zoom: number;
  panX: number;
  panY: number;
  batchItems: BatchItem[];
  presets: Preset[];
  history: HistoryEntry[];
  historyIndex: number;

  setSettings: (patch: Partial<HalftoneSettings>) => void;
  setViewMode: (v: ViewMode) => void;
  setSourceImage: (canvas: HTMLCanvasElement | null) => void;
  setRenderTime: (ms: number) => void;
  setZoom: (z: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;

  addBatchItem: (item: BatchItem) => void;
  updateBatchItem: (id: string, patch: Partial<BatchItem>) => void;
  clearBatch: () => void;

  addPreset: (preset: Preset) => void;
  deletePreset: (id: string) => void;
  loadPreset: (preset: Preset) => void;

  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  viewMode: 'halftone',
  sourceImage: null,
  renderTimeMs: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  batchItems: [],
  presets: [],
  history: [{ settings: DEFAULT_SETTINGS }],
  historyIndex: 0,

  setSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
  },

  setViewMode: (viewMode) => set({ viewMode }),
  setSourceImage: (sourceImage) => set({ sourceImage }),
  setRenderTime: (renderTimeMs) => set({ renderTimeMs }),
  setZoom: (zoom) => set({ zoom: Math.min(8, Math.max(0.1, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),

  addBatchItem: (item) => set((s) => ({ batchItems: [...s.batchItems, item] })),
  updateBatchItem: (id, patch) =>
    set((s) => ({
      batchItems: s.batchItems.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })),
  clearBatch: () => set({ batchItems: [] }),

  addPreset: (preset) => set((s) => ({ presets: [preset, ...s.presets] })),
  deletePreset: (id) => set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
  loadPreset: (preset) => set({ settings: preset.settings }),

  pushHistory: () => {
    const { settings, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ settings: { ...settings } });
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({ historyIndex: newIndex, settings: { ...history[newIndex].settings } });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ historyIndex: newIndex, settings: { ...history[newIndex].settings } });
  },
}));
