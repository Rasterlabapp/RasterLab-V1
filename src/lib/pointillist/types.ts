// Shared settings type — imported by all engine modules and the worker
export interface PointillistSettings {
  dotSize:         number;   // 1–20  base radius in image pixels
  density:         number;   // 1–100 coverage %
  randomness:      number;   // 0–100 post-placement jitter %
  contrast:        number;   // -100 to 100
  brightness:      number;   // -100 to 100
  edgeSensitivity: number;   // 0–100 edge detail boost %
  smoothing:       number;   // 0–100 pre-blur %
  invert:          boolean;
  colorMode:       'color' | 'monochrome';
  backgroundColor: string;
}

export const DEFAULT_POINTILLIST: PointillistSettings = {
  dotSize:         4,
  density:         60,
  randomness:      30,
  contrast:        10,
  brightness:      0,
  edgeSensitivity: 40,
  smoothing:       20,
  invert:          false,
  colorMode:       'color',
  backgroundColor: '#0a0a0a',
};
