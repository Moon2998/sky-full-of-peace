import type { PaletteId } from './palettes';
import type { PatternId } from './patterns';

/** One shell in the closing show. Positions are fractions of the screen. */
export interface ShowShot {
  /** Seconds after the show starts that this shell is fired. */
  readonly at: number;
  /** Where it bursts, 0 to 1 across and down the screen. */
  readonly x: number;
  readonly y: number;
  readonly pattern: PatternId;
  readonly palette: PaletteId;
  /** Burst size multiplier (default 1). */
  readonly size?: number;
}

/**
 * The closing show, played once every feeling has burst. It builds from a
 * pair of shells to a rainbow chain, a full barrage, and ends in a slow
 * golden willow that is still falling when the wish appears.
 */
export const SHOW: readonly ShowShot[] = [
  // Opening pair and a golden crown
  { at: 0.0, x: 0.26, y: 0.34, pattern: 'peony', palette: 'rosewater' },
  { at: 0.0, x: 0.74, y: 0.34, pattern: 'peony', palette: 'lagoon' },
  { at: 1.1, x: 0.5, y: 0.25, pattern: 'chrysanthemum', palette: 'champagne', size: 1.15 },

  // Rings and a many-coloured peony
  { at: 2.4, x: 0.3, y: 0.3, pattern: 'ring', palette: 'amethyst' },
  { at: 2.7, x: 0.7, y: 0.28, pattern: 'ring', palette: 'emerald' },
  { at: 3.5, x: 0.5, y: 0.36, pattern: 'peony', palette: 'aurora', size: 1.1 },

  // A fan of crossettes
  { at: 4.7, x: 0.18, y: 0.33, pattern: 'crossette', palette: 'sunrise' },
  { at: 4.9, x: 0.4, y: 0.26, pattern: 'crossette', palette: 'lagoon' },
  { at: 5.1, x: 0.6, y: 0.26, pattern: 'crossette', palette: 'dawn' },
  { at: 5.3, x: 0.82, y: 0.33, pattern: 'crossette', palette: 'amethyst' },

  // A golden palm with glitter
  { at: 6.7, x: 0.5, y: 0.27, pattern: 'palm', palette: 'champagne', size: 1.1 },

  // Rainbow chain, left to right
  { at: 7.9, x: 0.15, y: 0.31, pattern: 'peony', palette: 'ruby' },
  { at: 8.15, x: 0.32, y: 0.24, pattern: 'peony', palette: 'hearth' },
  { at: 8.4, x: 0.5, y: 0.31, pattern: 'peony', palette: 'emerald' },
  { at: 8.65, x: 0.68, y: 0.24, pattern: 'peony', palette: 'sapphire' },
  { at: 8.9, x: 0.85, y: 0.31, pattern: 'peony', palette: 'amethyst' },

  // Double chrysanthemums under a willow
  { at: 10.3, x: 0.3, y: 0.31, pattern: 'chrysanthemum', palette: 'rosewater' },
  { at: 10.3, x: 0.7, y: 0.31, pattern: 'chrysanthemum', palette: 'lagoon' },
  { at: 10.9, x: 0.5, y: 0.22, pattern: 'willow', palette: 'hearth', size: 1.15 },

  // The barrage
  { at: 12.4, x: 0.22, y: 0.28, pattern: 'peony', palette: 'ruby', size: 0.9 },
  { at: 12.6, x: 0.78, y: 0.27, pattern: 'peony', palette: 'sapphire', size: 0.9 },
  { at: 12.8, x: 0.5, y: 0.34, pattern: 'starburst', palette: 'silver', size: 0.95 },
  { at: 13.0, x: 0.35, y: 0.22, pattern: 'ring', palette: 'aurora', size: 0.9 },
  { at: 13.15, x: 0.65, y: 0.22, pattern: 'ring', palette: 'sunrise', size: 0.9 },
  { at: 13.3, x: 0.14, y: 0.36, pattern: 'chrysanthemum', palette: 'emerald', size: 0.85 },
  { at: 13.45, x: 0.86, y: 0.36, pattern: 'chrysanthemum', palette: 'amethyst', size: 0.85 },
  { at: 13.6, x: 0.42, y: 0.3, pattern: 'peony', palette: 'dawn', size: 0.9 },
  { at: 13.75, x: 0.58, y: 0.3, pattern: 'peony', palette: 'moonmist', size: 0.9 },
  { at: 13.9, x: 0.28, y: 0.38, pattern: 'crossette', palette: 'hearth', size: 0.85 },
  { at: 14.05, x: 0.72, y: 0.38, pattern: 'crossette', palette: 'lagoon', size: 0.85 },
  { at: 14.2, x: 0.5, y: 0.2, pattern: 'starburst', palette: 'rosewater', size: 1.0 },

  // Golden willow finale
  { at: 15.2, x: 0.5, y: 0.25, pattern: 'willow', palette: 'champagne', size: 1.35 },
  { at: 15.4, x: 0.2, y: 0.32, pattern: 'willow', palette: 'hearth' },
  { at: 15.4, x: 0.8, y: 0.32, pattern: 'willow', palette: 'hearth' },
];

/** Seconds a show shell takes to climb before it bursts. */
export const SHOW_LAUNCH_SECONDS = 1.3;

/** When the show hands over to the wish (the golden rain is still falling). */
export const SHOW_END = 18.6;
