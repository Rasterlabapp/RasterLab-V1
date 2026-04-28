// ──────────────────────────────────────────────────────────────────────────────
// Pattern Engines — main dispatcher + default settings
// ──────────────────────────────────────────────────────────────────────────────

export type { EngineId, PatternSettings, PatternCtx, EngineRenderArgs } from './types';

import { renderSerpentines } from './serpentines';
import { renderSpirals }     from './spirals';
import { renderMaze }        from './maze';
import { renderSpots }       from './spots';
import { renderWorms }       from './worms';
import { renderFingerprints} from './fingerprints';
import { renderCoral }       from './coral';
import { renderZebra }       from './zebra';
import { renderBubbles }     from './bubbles';
import { renderNoiseGrid }   from './noiseGrid';

import type { EngineRenderArgs, PatternSettings, EngineId } from './types';

// ── Engine meta ──────────────────────────────────────────────────────────────

export interface EngineMeta {
  id:          EngineId;
  label:       string;
  description: string;
}

export const ENGINE_LIST: EngineMeta[] = [
  { id: 'serpentines',  label: 'Serpentines',  description: 'Flowing wave lines modulated by brightness' },
  { id: 'spirals',      label: 'Spirals',      description: 'Archimedean spiral clusters at dark zones'  },
  { id: 'maze',         label: 'Maze',         description: 'Recursive labyrinth with density mapping'   },
  { id: 'spots',        label: 'Spots',        description: 'Jittered blobs scaled by image darkness'    },
  { id: 'worms',        label: 'Worms',        description: 'Organic random-walk agents on dark areas'   },
  { id: 'fingerprints', label: 'Fingerprints', description: 'Distorted concentric ridge lines'           },
  { id: 'coral',        label: 'Coral',        description: 'Recursive branching porous structures'      },
  { id: 'zebra',        label: 'Zebra',        description: 'Luminosity-driven contour stripe bands'     },
  { id: 'bubbles',      label: 'Bubbles',      description: 'Packed circle outlines in dark regions'     },
  { id: 'noiseGrid',    label: 'Noise Grid',   description: 'Granular structured texture per cell'       },
];

// ── Dispatcher ───────────────────────────────────────────────────────────────

export function renderPattern(args: EngineRenderArgs): void {
  switch (args.settings.engine) {
    case 'serpentines':  return renderSerpentines(args);
    case 'spirals':      return renderSpirals(args);
    case 'maze':         return renderMaze(args);
    case 'spots':        return renderSpots(args);
    case 'worms':        return renderWorms(args);
    case 'fingerprints': return renderFingerprints(args);
    case 'coral':        return renderCoral(args);
    case 'zebra':        return renderZebra(args);
    case 'bubbles':      return renderBubbles(args);
    case 'noiseGrid':    return renderNoiseGrid(args);
  }
}

// ── Default settings ─────────────────────────────────────────────────────────

export const DEFAULT_PATTERN: PatternSettings = {
  engine: 'serpentines',
  invert: false,

  // Serpentines
  density:      50,
  flow:         65,
  thickness:    1.5,
  turbulence:   40,
  scale:        1.2,

  // Spirals
  spacing:      40,
  radius:       28,
  arms:         2,
  wrap:         2.5,
  direction:    'random',

  // Maze
  pathWidth:    5,
  complexity:   55,
  sharpness:    40,

  // Spots
  blobSize:     10,
  spread:       60,
  softness:     20,

  // Worms
  length:       80,
  motionCurve:  55,

  // Fingerprints
  ringSpacing:  10,
  distortion:   45,

  // Coral
  branching:    4,
  spread2:      50,

  // Zebra
  stripeWidth:  5,
  bend:         35,
  contrast:     40,

  // Bubbles
  bubbleSize:   14,
  packing:      70,
  randomness:   40,

  // Noise Grid
  noiseScale:   8,
  noiseContrast:50,
};

// ── Built-in presets ─────────────────────────────────────────────────────────

export interface PatternPreset {
  id:       string;
  name:     string;
  engine:   EngineId;
  settings: PatternSettings;
}

export const BUILTIN_PRESETS: PatternPreset[] = [
  {
    id: 'editorial-maze',
    name: 'Editorial Maze',
    engine: 'maze',
    settings: { ...DEFAULT_PATTERN, engine: 'maze', pathWidth: 3, complexity: 72, sharpness: 65 },
  },
  {
    id: 'luxury-spiral',
    name: 'Luxury Spiral',
    engine: 'spirals',
    settings: { ...DEFAULT_PATTERN, engine: 'spirals', spacing: 32, radius: 22, arms: 3, wrap: 3, direction: 'clockwise', thickness: 0.8 },
  },
  {
    id: 'brutalist-worms',
    name: 'Brutalist Worms',
    engine: 'worms',
    settings: { ...DEFAULT_PATTERN, engine: 'worms', density: 75, length: 140, thickness: 2.5, motionCurve: 30 },
  },
  {
    id: 'fashion-zebra',
    name: 'Fashion Zebra',
    engine: 'zebra',
    settings: { ...DEFAULT_PATTERN, engine: 'zebra', stripeWidth: 4, bend: 55, contrast: 55 },
  },
  {
    id: 'organic-coral',
    name: 'Organic Coral',
    engine: 'coral',
    settings: { ...DEFAULT_PATTERN, engine: 'coral', branching: 5, spread2: 65, thickness: 1.2, density: 60 },
  },
  {
    id: 'retro-fingerprint',
    name: 'Retro Fingerprint',
    engine: 'fingerprints',
    settings: { ...DEFAULT_PATTERN, engine: 'fingerprints', ringSpacing: 7, distortion: 60, thickness: 1.0, density: 55 },
  },
  {
    id: 'poster-spots',
    name: 'Poster Spots',
    engine: 'spots',
    settings: { ...DEFAULT_PATTERN, engine: 'spots', blobSize: 14, spread: 45, softness: 10, density: 60 },
  },
];
