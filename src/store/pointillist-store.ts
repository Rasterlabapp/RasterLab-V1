'use client';

import { create } from 'zustand';
import { DEFAULT_POINTILLIST, type PointillistSettings } from '@/lib/pointillist-engine';

export interface PointillistPreset {
  id: string;
  name: string;
  settings: PointillistSettings;
}

const BUILT_IN_PRESETS: PointillistPreset[] = [
  {
    id: 'impressionist',
    name: 'Impressionist',
    settings: { ...DEFAULT_POINTILLIST, dotSize: 6, density: 55, randomness: 45, colorMode: 'color', edgeSensitivity: 25 },
  },
  {
    id: 'seurat',
    name: 'Seurat Classic',
    settings: { ...DEFAULT_POINTILLIST, dotSize: 4, density: 70, randomness: 15, colorMode: 'color', edgeSensitivity: 30, smoothing: 30 },
  },
  {
    id: 'stipple',
    name: 'Ink Stipple',
    settings: { ...DEFAULT_POINTILLIST, dotSize: 3, density: 75, randomness: 20, colorMode: 'monochrome', edgeSensitivity: 65, contrast: 25, backgroundColor: '#ffffff' },
  },
  {
    id: 'coarse',
    name: 'Coarse Grain',
    settings: { ...DEFAULT_POINTILLIST, dotSize: 12, density: 35, randomness: 60, colorMode: 'color', edgeSensitivity: 15, smoothing: 40 },
  },
  {
    id: 'edge-only',
    name: 'Edge Emphasis',
    settings: { ...DEFAULT_POINTILLIST, dotSize: 3, density: 50, randomness: 10, colorMode: 'monochrome', edgeSensitivity: 100, contrast: 40, backgroundColor: '#ffffff' },
  },
  {
    id: 'neon',
    name: 'Neon Glow',
    settings: { ...DEFAULT_POINTILLIST, dotSize: 5, density: 60, randomness: 35, colorMode: 'color', edgeSensitivity: 50, invert: true, backgroundColor: '#000000', contrast: 20 },
  },
];

interface PointillistState {
  settings: PointillistSettings;
  sourceImage: HTMLCanvasElement | null;
  renderTimeMs: number;
  presets: PointillistPreset[];
  activePresetId: string | null;

  setSettings: (patch: Partial<PointillistSettings>) => void;
  setSourceImage: (canvas: HTMLCanvasElement | null) => void;
  setRenderTime: (ms: number) => void;
  addPreset: (name: string) => void;
  deletePreset: (id: string) => void;
  loadPreset: (id: string) => void;
}

export const usePointillistStore = create<PointillistState>((set, get) => ({
  settings: { ...DEFAULT_POINTILLIST },
  sourceImage: null,
  renderTimeMs: 0,
  presets: BUILT_IN_PRESETS,
  activePresetId: null,

  setSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch }, activePresetId: null })),

  setSourceImage: (sourceImage) => set({ sourceImage }),
  setRenderTime: (renderTimeMs) => set({ renderTimeMs }),

  addPreset: (name) => {
    const { settings } = get();
    const preset: PointillistPreset = {
      id: crypto.randomUUID(),
      name,
      settings: { ...settings },
    };
    set((s) => ({ presets: [...s.presets, preset] }));
  },

  deletePreset: (id) =>
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),

  loadPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (preset) set({ settings: { ...preset.settings }, activePresetId: id });
  },
}));
