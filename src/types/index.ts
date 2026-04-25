export type HalftoneMode =
  | 'dots'
  | 'lines'
  | 'crosshatch'
  | 'diamond'
  | 'square'
  | 'stochastic'
  | 'pattern';

export type ViewMode = 'halftone' | 'grayscale' | 'original';
export type CMYKChannel = 'C' | 'M' | 'Y' | 'K' | 'composite';

export interface CMYKAngles {
  C: number;
  M: number;
  Y: number;
  K: number;
}

export interface HalftoneSettings {
  mode: HalftoneMode;
  frequency: number; // lines per inch equivalent (2–80)
  angle: number; // degrees
  dotSize: number; // 0–2 multiplier
  contrast: number; // -100 to 100
  brightness: number; // -100 to 100
  blur: number; // 0–10
  cleanRadius: number; // 0–5
  invertOutput: boolean;
  cmykMode: boolean;
  cmykAngles: CMYKAngles;
  activeChannel: CMYKChannel;
  visibleChannels: Record<CMYKChannel, boolean>;
}

export interface BatchItem {
  id: string;
  file: File;
  dataUrl: string;
  status: 'pending' | 'processing' | 'done';
  resultUrl?: string;
}

export interface Preset {
  id: string;
  name: string;
  settings: HalftoneSettings;
  createdAt: string;
  userId?: string;
}

export interface HistoryEntry {
  settings: HalftoneSettings;
}
