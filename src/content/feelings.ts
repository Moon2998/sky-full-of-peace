import type { PaletteId } from '../engine/palettes';
import type { PatternId } from '../engine/patterns';

export interface Feeling {
  /** Stable id, also used as the firework key. */
  readonly id: string;
  /** The word on the launch pad. */
  readonly label: string;
  /** What it becomes in the sky. */
  readonly pattern: PatternId;
  /** The colours it glows and bursts in. */
  readonly palette: PaletteId;
}

/**
 * The eight heavy things waiting on the launch pad. Each one she taps rises
 * and bursts into its own colours and shape, then is gone from the pad.
 */
export const FEELINGS: readonly Feeling[] = [
  { id: 'heavy-days', label: 'Heavy days', pattern: 'peony', palette: 'dawn' },
  { id: 'worries', label: 'Worries', pattern: 'chrysanthemum', palette: 'lagoon' },
  { id: 'broken-trust', label: 'Broken trust', pattern: 'crossette', palette: 'amethyst' },
  { id: 'old-wounds', label: 'Old wounds', pattern: 'heart', palette: 'rosewater' },
  { id: 'feeling-alone', label: 'Feeling alone', pattern: 'willow', palette: 'hearth' },
  { id: 'overthinking', label: 'Overthinking', pattern: 'ring', palette: 'moonmist' },
  { id: 'fear', label: 'Fear', pattern: 'starburst', palette: 'sunrise' },
  { id: 'disappointment', label: 'Disappointment', pattern: 'peony', palette: 'aurora' },
];
