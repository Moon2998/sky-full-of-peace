import { colorIndex, SKY_COLORS, type Palette } from './palettes';
import { EmitStyle, ParticleKind, type ParticleInit } from './particles';
import { between, pick, type Rng } from './random';

export type PatternId =
  | 'peony'
  | 'chrysanthemum'
  | 'willow'
  | 'starburst'
  | 'heart'
  | 'ring'
  | 'crossette'
  | 'palm';

export const PATTERNS: readonly PatternId[] = [
  'peony',
  'chrysanthemum',
  'willow',
  'starburst',
  'heart',
  'ring',
  'crossette',
  'palm',
];

/** Patterns whose stars crackle and glitter, so the sound can follow. */
export const CRACKLING: ReadonlySet<PatternId> = new Set(['chrysanthemum', 'willow', 'palm', 'crossette']);

export interface BurstOptions {
  x: number;
  y: number;
  /** Launch speed for the outermost stars, px/s. */
  speed: number;
  /** Viewport scale unit in px, used for gravity. */
  unit: number;
  palette: Palette;
  /** Multiplies particle counts (quality, shell size). */
  countScale: number;
  /** Multiplies brightness. */
  alphaScale: number;
  /** Multiplies every star's size (bigger shells have bigger stars). Default 1. */
  sizeScale?: number;
  /** Multiplies every star's lifetime. Default 1. */
  lifeScale?: number;
  reducedMotion: boolean;
  rng: Rng;
}

type Burst = ParticleInit[];

/** A uniform direction on a sphere, projected flat: real shells have depth. */
function sphereDirection(rng: Rng): [number, number] {
  const z = rng() * 2 - 1;
  const theta = rng() * Math.PI * 2;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(theta), r * Math.sin(theta)];
}

function count(base: number, opts: BurstOptions): number {
  const motion = opts.reducedMotion ? 0.5 : 1;
  return Math.max(6, Math.round(base * opts.countScale * motion));
}

function star(
  opts: BurstOptions,
  dx: number,
  dy: number,
  speed: number,
  fields: Omit<ParticleInit, 'x' | 'y' | 'vx' | 'vy'>,
): ParticleInit {
  return { x: opts.x, y: opts.y, vx: dx * speed, vy: dy * speed, ...fields };
}

function bloom(opts: BurstOptions, color: string, radius: number, alpha: number): ParticleInit {
  return {
    x: opts.x,
    y: opts.y,
    vx: 0,
    vy: 0,
    life: 0.75,
    size: radius,
    color: colorIndex(color),
    kind: ParticleKind.Glow,
    drag: 0,
    gravity: 0,
    alpha: alpha * opts.alphaScale,
    twinkle: 0,
  };
}

/** Two different colours from the palette. */
function twoColours(rng: Rng, palette: Palette): [string, string] {
  const first = pick(rng, palette.colors);
  const others = palette.colors.filter((c) => c !== first);
  return [first, others.length ? pick(rng, others) : palette.spark];
}

/** A small inner sphere of contrasting stars (the "pistil" of a double-layer shell). */
function pistil(opts: BurstOptions, color: string, n: number, speed: number): Burst {
  const out: Burst = [];
  for (let i = 0; i < count(n, opts); i++) {
    const [dx, dy] = sphereDirection(opts.rng);
    out.push(
      star(opts, dx, dy, opts.speed * speed * between(opts.rng, 0.9, 1.05), {
        life: between(opts.rng, 1.05, 1.4),
        size: between(opts.rng, 1.2, 1.6),
        color: colorIndex(color),
        kind: ParticleKind.Spark,
        drag: 2.1,
        gravity: opts.unit * 0.12,
        alpha: 0.9 * opts.alphaScale,
        twinkle: 0.3,
        phase: opts.rng() * Math.PI * 2,
      }),
    );
  }
  return out;
}

function peony(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  const [primary, secondary] = twoColours(rng, palette);
  const out: Burst = [];
  for (let i = 0; i < count(170, opts); i++) {
    const [dx, dy] = sphereDirection(rng);
    const changes = rng() < 0.4;
    out.push(
      star(opts, dx, dy, opts.speed * between(rng, 0.92, 1.04), {
        life: between(rng, 1.5, 2.1),
        size: between(rng, 1.6, 2.3),
        color: colorIndex(rng() < 0.72 ? primary : secondary),
        color2: changes ? colorIndex(secondary) : undefined,
        changeAt: changes ? 0.45 : 0,
        kind: ParticleKind.Spark,
        drag: 1.9,
        gravity: unit * 0.17,
        alpha: opts.alphaScale,
        twinkle: 0.45,
        phase: rng() * Math.PI * 2,
      }),
    );
  }
  out.push(...pistil(opts, palette.spark, 46, 0.45));
  out.push(bloom(opts, primary, unit * 0.07, 0.5));
  return out;
}

function chrysanthemum(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  // Classic chrysanthemum: coloured stars dragging golden spark tails.
  const ember = colorIndex(SKY_COLORS.ember);
  const out: Burst = [];
  for (let i = 0; i < count(150, opts); i++) {
    const [dx, dy] = sphereDirection(rng);
    out.push(
      star(opts, dx, dy, opts.speed * between(rng, 0.94, 1.04), {
        life: between(rng, 1.7, 2.3),
        size: between(rng, 1.3, 1.9),
        color: colorIndex(pick(rng, palette.colors)),
        color2: ember,
        changeAt: 0.22,
        kind: ParticleKind.Emitter,
        drag: 1.8,
        gravity: unit * 0.13,
        alpha: 0.95 * opts.alphaScale,
        twinkle: 0.35,
        phase: rng() * Math.PI * 2,
        emitEvery: 0.05,
        emitLife: 0.45,
        emitColor: ember,
        emitStyle: i % 5 === 0 ? EmitStyle.Glitter : EmitStyle.Trail,
      }),
    );
  }
  out.push(bloom(opts, palette.spark, unit * 0.06, 0.45));
  return out;
}

/** Kamuro / golden willow: long trails that hang and fall like golden rain. */
function willow(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  const trail = colorIndex(palette.colors[0] ?? palette.spark);
  const out: Burst = [];
  for (let i = 0; i < count(95, opts); i++) {
    const [dx, dy] = sphereDirection(rng);
    out.push(
      star(opts, dx, dy, opts.speed * between(rng, 0.74, 0.86), {
        life: between(rng, 3.1, 3.9),
        size: between(rng, 1.4, 1.8),
        color: colorIndex(pick(rng, palette.colors)),
        kind: ParticleKind.Emitter,
        drag: 2.3,
        gravity: unit * 0.21,
        alpha: 0.95 * opts.alphaScale,
        twinkle: 0.3,
        phase: rng() * Math.PI * 2,
        emitEvery: 0.085,
        emitLife: 1.25,
        emitColor: trail,
        emitStyle: i % 4 === 0 ? EmitStyle.Glitter : EmitStyle.Trail,
      }),
    );
  }
  out.push(bloom(opts, palette.spark, unit * 0.07, 0.42));
  return out;
}

function starburst(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  const out: Burst = [];
  const rays = 12 + Math.floor(rng() * 4);
  const perRay = opts.reducedMotion ? 4 : 8;
  const offset = rng() * Math.PI * 2;
  for (let r = 0; r < rays; r++) {
    const angle = offset + (r / rays) * Math.PI * 2;
    const color = colorIndex(palette.colors[r % palette.colors.length] ?? palette.spark);
    for (let j = 0; j < perRay; j++) {
      const a = angle + between(rng, -0.022, 0.022);
      const t = j / (perRay - 1);
      out.push(
        star(opts, Math.cos(a), Math.sin(a), opts.speed * (0.28 + 0.78 * t), {
          life: between(rng, 1.2, 1.65),
          size: 1.25 + 0.8 * t,
          color,
          kind: ParticleKind.Spark,
          drag: 2.0,
          gravity: unit * 0.11,
          alpha: (0.6 + 0.4 * t) * opts.alphaScale,
          twinkle: 0.25,
          phase: rng() * Math.PI * 2,
        }),
      );
    }
  }
  for (let i = 0; i < count(36, opts); i++) {
    const [dx, dy] = sphereDirection(rng);
    out.push(
      star(opts, dx, dy, opts.speed * between(rng, 0.2, 0.6), {
        life: between(rng, 1.6, 2.1),
        size: 1.1,
        color: colorIndex(palette.spark),
        kind: ParticleKind.Spark,
        drag: 2.2,
        gravity: unit * 0.08,
        alpha: 0.85 * opts.alphaScale,
        twinkle: 1,
        phase: rng() * Math.PI * 2,
      }),
    );
  }
  out.push(bloom(opts, palette.colors[0] ?? palette.spark, unit * 0.075, 0.5));
  return out;
}

/** An abstract heart: stars follow the parametric heart curve, loosened by jitter. */
function heart(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  const out: Burst = [];
  const n = count(110, opts);
  const rotation = between(rng, -0.18, 0.18);
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    const nx = hx / 17;
    const ny = hy / 17;
    out.push(
      star(opts, nx * cos - ny * sin, nx * sin + ny * cos, opts.speed * 0.95 * between(rng, 0.96, 1.04), {
        life: between(rng, 1.8, 2.2),
        size: between(rng, 1.5, 2.1),
        color: colorIndex(palette.colors[i % palette.colors.length] ?? palette.spark),
        kind: ParticleKind.Spark,
        drag: 1.8,
        gravity: unit * 0.06,
        alpha: opts.alphaScale,
        twinkle: 0.4,
        phase: rng() * Math.PI * 2,
      }),
    );
  }
  out.push(...pistil(opts, palette.spark, 34, 0.32));
  out.push(bloom(opts, palette.colors[0] ?? palette.spark, unit * 0.065, 0.45));
  return out;
}

/** A ring seen at an angle, with a small contrasting core. */
function ring(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  const [primary, secondary] = twoColours(rng, palette);
  const out: Burst = [];
  const n = count(100, opts);
  const tilt = between(rng, 0.35, 0.95);
  const turn = rng() * Math.PI;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a);
    const y = Math.sin(a) * tilt;
    out.push(
      star(opts, x * cos - y * sin, x * sin + y * cos, opts.speed * between(rng, 0.97, 1.02), {
        life: between(rng, 1.6, 2.0),
        size: between(rng, 1.6, 2.1),
        color: colorIndex(primary),
        kind: ParticleKind.Spark,
        drag: 1.9,
        gravity: unit * 0.12,
        alpha: opts.alphaScale,
        twinkle: 0.4,
        phase: rng() * Math.PI * 2,
      }),
    );
  }
  out.push(...pistil(opts, secondary, 40, 0.38));
  out.push(bloom(opts, primary, unit * 0.06, 0.45));
  return out;
}

/** Crossette: a few bright stars that each break into a cross of four. */
function crossette(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  const out: Burst = [];
  const n = count(30, opts);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + between(rng, -0.08, 0.08);
    const lift = between(rng, 0.75, 1);
    out.push(
      star(opts, Math.cos(a) * lift, Math.sin(a) * lift, opts.speed * 0.8, {
        life: between(rng, 1.5, 1.7),
        size: 2.1,
        color: colorIndex(pick(rng, palette.colors)),
        kind: ParticleKind.Splitter,
        splitAt: 0.6,
        drag: 1.6,
        gravity: unit * 0.12,
        alpha: opts.alphaScale,
        twinkle: 0,
        phase: rng() * Math.PI * 2,
        emitColor: colorIndex(palette.spark),
      }),
    );
  }
  out.push(bloom(opts, palette.spark, unit * 0.06, 0.45));
  return out;
}

/** Palm: thick golden comets that arc out and droop like fronds. */
function palm(opts: BurstOptions): Burst {
  const { rng, palette, unit } = opts;
  const out: Burst = [];
  const fronds = 9;
  const offset = rng() * Math.PI * 2;
  const trail = colorIndex(palette.colors[0] ?? SKY_COLORS.ember);
  for (let i = 0; i < fronds; i++) {
    const a = offset + (i / fronds) * Math.PI * 2;
    out.push(
      star(opts, Math.cos(a), Math.sin(a) * 0.85 - 0.25, opts.speed * between(rng, 0.85, 0.95), {
        life: between(rng, 2.0, 2.3),
        size: 2.6,
        color: colorIndex(palette.spark),
        kind: ParticleKind.Emitter,
        drag: 1.3,
        gravity: unit * 0.3,
        alpha: opts.alphaScale,
        twinkle: 0,
        emitEvery: 0.018,
        emitLife: 0.75,
        emitColor: trail,
        emitStyle: EmitStyle.Trail,
      }),
    );
  }
  for (let i = 0; i < count(44, opts); i++) {
    const [dx, dy] = sphereDirection(rng);
    out.push(
      star(opts, dx, dy, opts.speed * between(rng, 0.25, 0.55), {
        life: between(rng, 1.6, 2.1),
        size: 1.2,
        color: colorIndex(pick(rng, palette.colors)),
        kind: ParticleKind.Emitter,
        drag: 2.0,
        gravity: unit * 0.1,
        alpha: 0.9 * opts.alphaScale,
        twinkle: 0.6,
        phase: rng() * Math.PI * 2,
        emitEvery: 0.07,
        emitLife: 0.35,
        emitColor: colorIndex(SKY_COLORS.white),
        emitStyle: EmitStyle.Glitter,
      }),
    );
  }
  out.push(bloom(opts, palette.colors[0] ?? palette.spark, unit * 0.07, 0.5));
  return out;
}

const GENERATORS: Readonly<Record<PatternId, (opts: BurstOptions) => Burst>> = {
  peony,
  chrysanthemum,
  willow,
  starburst,
  heart,
  ring,
  crossette,
  palm,
};

/**
 * Builds the stars for one explosion. Pure: same options and seed give the
 * same burst. With reduced motion the burst is smaller, slower and steadier,
 * and nothing trails, splits or shimmers.
 */
export function createBurst(pattern: PatternId, opts: BurstOptions): Burst {
  const burst = GENERATORS[pattern](opts);
  const sizeScale = opts.sizeScale ?? 1;
  const lifeScale = opts.lifeScale ?? 1;
  if (sizeScale !== 1 || lifeScale !== 1) {
    for (const p of burst) {
      p.size *= sizeScale;
      p.life *= lifeScale;
      if (p.emitLife) p.emitLife *= lifeScale;
    }
  }
  if (!opts.reducedMotion) return burst;
  for (const p of burst) {
    p.vx *= 0.32;
    p.vy *= 0.32;
    p.gravity *= 0.15;
    p.life *= 1.25;
    p.twinkle = 0;
    if (p.kind === ParticleKind.Emitter || p.kind === ParticleKind.Splitter) {
      p.kind = ParticleKind.Spark;
      p.splitAt = 0;
    }
  }
  return burst;
}
