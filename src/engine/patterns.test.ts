import { describe, expect, it } from 'vitest';
import { COLOR_TABLE, PALETTES } from './palettes';
import { ParticleKind } from './particles';
import { createBurst, CRACKLING, PATTERNS, type BurstOptions, type PatternId } from './patterns';
import { seededRng } from './random';

const options = (overrides: Partial<BurstOptions> = {}): BurstOptions => ({
  x: 200,
  y: 200,
  speed: 300,
  unit: 400,
  palette: PALETTES.aurora,
  countScale: 1,
  alphaScale: 1,
  reducedMotion: false,
  rng: seededRng(42),
  ...overrides,
});

const maxSpeed = (pattern: PatternId, o: BurstOptions) =>
  Math.max(...createBurst(pattern, o).map((p) => Math.hypot(p.vx, p.vy)));

describe('explosion patterns', () => {
  it.each(PATTERNS)('%s produces a valid, bounded burst', (pattern) => {
    const burst = createBurst(pattern, options());
    expect(burst.length).toBeGreaterThanOrEqual(30);
    expect(burst.length).toBeLessThan(400);
    for (const p of burst) {
      expect(Number.isFinite(p.vx) && Number.isFinite(p.vy)).toBe(true);
      expect(p.life).toBeGreaterThan(0);
      expect(p.size).toBeGreaterThan(0);
      expect(p.alpha).toBeGreaterThan(0);
      expect(p.alpha).toBeLessThanOrEqual(1);
      for (const color of [p.color, p.color2 ?? p.color, p.emitColor ?? p.color]) {
        expect(color).toBeGreaterThanOrEqual(0);
        expect(color).toBeLessThan(COLOR_TABLE.length);
      }
    }
  });

  it('is deterministic for the same seed', () => {
    const a = createBurst('peony', options({ rng: seededRng(7) }));
    const b = createBurst('peony', options({ rng: seededRng(7) }));
    expect(a).toEqual(b);
  });

  it('gives every pattern its own shape', () => {
    const shapes = PATTERNS.map((pattern) => {
      const burst = createBurst(pattern, options());
      const kinds = [...new Set(burst.map((p) => p.kind))].sort().join('');
      const meanLife = burst.reduce((sum, p) => sum + p.life, 0) / burst.length;
      return `${burst.length}:${kinds}:${meanLife.toFixed(2)}`;
    });
    expect(new Set(shapes).size).toBe(PATTERNS.length);
  });

  it('peonies have colour-changing stars and a contrasting core', () => {
    const burst = createBurst('peony', options());
    expect(burst.some((p) => (p.changeAt ?? 0) > 0 && p.color2 !== undefined && p.color2 !== p.color)).toBe(true);
    const speeds = burst.filter((p) => p.kind === ParticleKind.Spark).map((p) => Math.hypot(p.vx, p.vy));
    expect(Math.min(...speeds)).toBeLessThan(Math.max(...speeds) * 0.6);
  });

  it('trailing patterns shed embers; crossettes split', () => {
    const kinds = (pattern: PatternId) => new Set(createBurst(pattern, options()).map((p) => p.kind));
    for (const pattern of ['willow', 'chrysanthemum', 'palm'] as const) {
      expect(kinds(pattern).has(ParticleKind.Emitter)).toBe(true);
    }
    expect(kinds('crossette').has(ParticleKind.Splitter)).toBe(true);
    expect(kinds('peony').has(ParticleKind.Emitter)).toBe(false);
  });

  it('marks the crackling patterns for sound', () => {
    expect(CRACKLING.has('willow')).toBe(true);
    expect(CRACKLING.has('peony')).toBe(false);
  });

  it('draws the heart with its point at the bottom', () => {
    const outline = createBurst('heart', options()).filter((p) => p.kind === ParticleKind.Spark && p.size > 1.45);
    const down = Math.max(...outline.map((p) => p.vy));
    const up = Math.min(...outline.map((p) => p.vy));
    expect(down).toBeGreaterThan(Math.abs(up));
  });

  it('flattens a ring into an ellipse', () => {
    const ringStars = createBurst('ring', options()).filter((p) => p.kind === ParticleKind.Spark);
    const speeds = ringStars.map((p) => Math.hypot(p.vx, p.vy));
    // Outer ring stars all leave at nearly full speed in a flat circle.
    expect(speeds.filter((s) => s > 250).length).toBeGreaterThan(50);
  });

  it('scales star counts with quality', () => {
    const full = createBurst('peony', options()).length;
    const reduced = createBurst('peony', options({ countScale: 0.5 })).length;
    expect(reduced).toBeLessThan(full * 0.6);
  });

  it.each(PATTERNS)('%s is calmer with reduced motion: slower, steady, nothing trails or splits', (pattern) => {
    const calm = createBurst(pattern, options({ reducedMotion: true }));
    expect(calm.every((p) => p.kind !== ParticleKind.Emitter && p.kind !== ParticleKind.Splitter)).toBe(true);
    expect(calm.every((p) => p.twinkle === 0)).toBe(true);
    expect(maxSpeed(pattern, options({ reducedMotion: true }))).toBeLessThan(maxSpeed(pattern, options()) * 0.5);
  });
});
