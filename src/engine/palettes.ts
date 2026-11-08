export type PaletteId =
  | 'dawn'
  | 'lagoon'
  | 'amethyst'
  | 'rosewater'
  | 'hearth'
  | 'moonmist'
  | 'sunrise'
  | 'aurora'
  | 'champagne'
  | 'ruby'
  | 'emerald'
  | 'sapphire'
  | 'silver';

export interface Palette {
  readonly id: PaletteId;
  /** Main burst colours. The first is also the launch shell's glow. */
  readonly colors: readonly string[];
  /** Pale tint used for cores, trailing embers and glitter. */
  readonly spark: string;
}

/** Vivid, saturated colours, like real pyrotechnic stars. */
export const PALETTES: Readonly<Record<PaletteId, Palette>> = {
  dawn: { id: 'dawn', colors: ['#ff7eb6', '#ffbf63', '#ff9a7a'], spark: '#fff3dc' },
  lagoon: { id: 'lagoon', colors: ['#21f0d2', '#4cc8ff', '#7dffe6'], spark: '#e4fffa' },
  amethyst: { id: 'amethyst', colors: ['#b77cff', '#e0b8ff', '#7f6bff'], spark: '#f1e8ff' },
  rosewater: { id: 'rosewater', colors: ['#ff5fa8', '#ffa8d0', '#ffd6a6'], spark: '#fff0f6' },
  hearth: { id: 'hearth', colors: ['#ffb43c', '#ffd88a', '#ff8a3c'], spark: '#fff0cf' },
  moonmist: { id: 'moonmist', colors: ['#6f9bff', '#b8ccff', '#7ff0ff'], spark: '#eef4ff' },
  sunrise: { id: 'sunrise', colors: ['#ff8a4c', '#ff5f7a', '#ffd86a'], spark: '#fff5df' },
  aurora: { id: 'aurora', colors: ['#ff5fd0', '#9b6bff', '#3fdcff', '#5fffb8'], spark: '#f4f0ff' },
  champagne: { id: 'champagne', colors: ['#ffd27a', '#ffe7b0', '#f0b45a'], spark: '#fff6e2' },
  ruby: { id: 'ruby', colors: ['#ff3d5c', '#ff8070', '#ffc2b0'], spark: '#ffe6e0' },
  emerald: { id: 'emerald', colors: ['#3dff8f', '#a0ffcb', '#7dffe0'], spark: '#e6fff1' },
  sapphire: { id: 'sapphire', colors: ['#3d6bff', '#7fa6ff', '#a07dff'], spark: '#e3ebff' },
  silver: { id: 'silver', colors: ['#e9edff', '#c9d3ff', '#fff4e0'], spark: '#ffffff' },
};

/** Fixed colours used by the sky itself (stars, rockets, golden lights, smoke). */
export const SKY_COLORS = {
  starCool: '#dfe8ff',
  starWarm: '#ffe9c7',
  starLilac: '#e7dcff',
  rocket: '#fff4dc',
  gold: '#f6d58e',
  ember: '#ffcf7a',
  white: '#ffffff',
  smoke: '#8c88b4',
} as const;

/**
 * Every colour the engine can draw, in a stable order, so particles can store
 * a small integer instead of a string and share one glow sprite per colour.
 */
export const COLOR_TABLE: readonly string[] = (() => {
  const all = new Set<string>(Object.values(SKY_COLORS));
  for (const palette of Object.values(PALETTES)) {
    for (const color of palette.colors) all.add(color);
    all.add(palette.spark);
  }
  return [...all];
})();

const COLOR_INDEX = new Map(COLOR_TABLE.map((color, index) => [color, index]));

export function colorIndex(color: string): number {
  const index = COLOR_INDEX.get(color);
  if (index === undefined) throw new Error(`Unknown colour ${color}`);
  return index;
}

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
