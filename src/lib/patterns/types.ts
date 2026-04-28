// ──────────────────────────────────────────────────────────────────────────────
// Pattern Engines — shared types
// ──────────────────────────────────────────────────────────────────────────────

export type EngineId =
  | 'serpentines'
  | 'spirals'
  | 'maze'
  | 'spots'
  | 'worms'
  | 'fingerprints'
  | 'coral'
  | 'zebra'
  | 'bubbles'
  | 'noiseGrid';

export interface PatternSettings {
  engine: EngineId;
  invert: boolean;

  // ── Serpentines ──────────────────────────────────
  density:     number;   // 10–90   — line count
  flow:        number;   // 0–100   — wave amplitude
  thickness:   number;   // 0.5–6   — stroke width
  turbulence:  number;   // 0–100   — noise perturbation
  scale:       number;   // 0.5–4   — wave frequency

  // ── Spirals ──────────────────────────────────────
  spacing:     number;   // 15–80   — grid spacing between spiral centers
  radius:      number;   // 10–60   — max spiral radius
  arms:        number;   // 1–5     — arms per spiral
  wrap:        number;   // 0.5–5   — turns per arm
  direction:   'clockwise' | 'counterclockwise' | 'random';

  // ── Maze ─────────────────────────────────────────
  pathWidth:   number;   // 2–18    — wall stroke width
  complexity:  number;   // 1–100   — cell resolution
  sharpness:   number;   // 0–100   — brightness threshold snap

  // ── Spots ────────────────────────────────────────
  blobSize:    number;   // 3–30    — max spot radius
  spread:      number;   // 0–100   — position jitter
  softness:    number;   // 0–100   — edge blur (0 = crisp)

  // ── Worms ────────────────────────────────────────
  length:      number;   // 20–200  — steps per worm
  motionCurve: number;   // 0–100   — angular variation

  // ── Fingerprints ─────────────────────────────────
  ringSpacing: number;   // 3–24    — pixels between rings
  distortion:  number;   // 0–100   — wave distortion

  // ── Coral ────────────────────────────────────────
  branching:   number;   // 1–7     — branch factor
  spread2:     number;   // 0–100   — branch spread angle

  // ── Zebra ────────────────────────────────────────
  stripeWidth: number;   // 1–20    — stripe period (fraction of luma range)
  bend:        number;   // 0–100   — horizontal distortion
  contrast:    number;   // 0–100   — luma exaggeration

  // ── Bubbles ──────────────────────────────────────
  bubbleSize:  number;   // 4–40    — max bubble diameter
  packing:     number;   // 20–100  — grid tightness
  randomness:  number;   // 0–100   — position jitter

  // ── Noise Grid ───────────────────────────────────
  noiseScale:  number;   // 2–40    — cell size in px
  noiseContrast: number; // 0–100   — fill threshold sharpness
}

export type PatternCtx =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

export interface EngineRenderArgs {
  ctx:      PatternCtx;
  pixels:   Uint8ClampedArray;
  width:    number;
  height:   number;
  settings: PatternSettings;
}
