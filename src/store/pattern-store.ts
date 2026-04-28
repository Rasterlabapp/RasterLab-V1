'use client';

import { create } from 'zustand';
import {
  DEFAULT_PATTERN,
  BUILTIN_PRESETS,
  type PatternSettings,
  type PatternPreset,
} from '@/lib/patterns/index';

interface PatternState {
  settings:      PatternSettings;
  sourceImage:   HTMLCanvasElement | null;
  renderTimeMs:  number;
  presets:       PatternPreset[];
  activePresetId: string | null;

  setSettings:    (patch: Partial<PatternSettings>) => void;
  setSourceImage: (canvas: HTMLCanvasElement | null) => void;
  setRenderTime:  (ms: number) => void;
  loadPreset:     (id: string) => void;
  addPreset:      (name: string) => void;
  deletePreset:   (id: string) => void;
}

export const usePatternStore = create<PatternState>((set, get) => ({
  settings:       { ...DEFAULT_PATTERN },
  sourceImage:    null,
  renderTimeMs:   0,
  presets:        BUILTIN_PRESETS,
  activePresetId: null,

  setSettings: (patch) =>
    set((s) => ({ settings: { ...s.settings, ...patch }, activePresetId: null })),

  setSourceImage: (sourceImage) => set({ sourceImage }),
  setRenderTime:  (renderTimeMs) => set({ renderTimeMs }),

  loadPreset: (id) => {
    const preset = get().presets.find((p) => p.id === id);
    if (preset) set({ settings: { ...preset.settings }, activePresetId: id });
  },

  addPreset: (name) => {
    const { settings } = get();
    const preset: PatternPreset = {
      id:       crypto.randomUUID(),
      name,
      engine:   settings.engine,
      settings: { ...settings },
    };
    set((s) => ({ presets: [...s.presets, preset] }));
  },

  deletePreset: (id) =>
    set((s) => ({ presets: s.presets.filter((p) => p.id !== id) })),
}));
