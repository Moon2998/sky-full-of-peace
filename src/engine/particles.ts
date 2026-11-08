/** What a particle does besides flying and fading. */
export const ParticleKind = {
  /** A plain glowing star. */
  Spark: 0,
  /** A short-lived trailing ember. */
  Ember: 1,
  /** A star that sheds embers or glitter behind it (chrysanthemum, willow, palm). */
  Emitter: 2,
  /** A large, soft bloom of light at the heart of a burst. */
  Glow: 3,
  /** A star that breaks into four smaller stars part-way through its life (crossette). */
  Splitter: 4,
} as const;
export type ParticleKind = (typeof ParticleKind)[keyof typeof ParticleKind];

/** What an emitter sheds. */
export const EmitStyle = {
  /** Warm embers that fall away behind the star. */
  Trail: 0,
  /** Tiny shimmering points that hang in the air (brocade, kamuro). */
  Glitter: 1,
} as const;
export type EmitStyle = (typeof EmitStyle)[keyof typeof EmitStyle];

export interface ParticleInit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds. */
  life: number;
  /** Core radius in CSS pixels. */
  size: number;
  /** Index into COLOR_TABLE. */
  color: number;
  kind: ParticleKind;
  /** Exponential air drag per second. */
  drag: number;
  /** Downward acceleration in px/s². */
  gravity: number;
  /** Peak opacity, 0 to 1. */
  alpha: number;
  /** 0 = steady, 1 = gentle shimmer near the end of life. */
  twinkle: number;
  /** Colour the star changes to (real colour-changing stars). Defaults to `color`. */
  color2?: number;
  /** Fraction of life remaining at which it changes colour (0 = never). */
  changeAt?: number;
  /** Splitters: fraction of life remaining at which it breaks apart. */
  splitAt?: number;
  /** Emitters: seconds between embers. */
  emitEvery?: number;
  /** Emitters: ember lifetime in seconds. */
  emitLife?: number;
  /** Emitters: ember colour index. */
  emitColor?: number;
  /** Emitters: trailing embers or glitter. */
  emitStyle?: EmitStyle;
  /** Random phase for shimmer, 0 to 2π. */
  phase?: number;
}

/**
 * A fixed-size particle store (struct of arrays).
 *
 * Live particles are packed into [0, count). Removing one swaps the last live
 * particle into its slot, so nothing is allocated or shifted per frame and the
 * total can never grow past `capacity`.
 */
export class ParticlePool {
  readonly capacity: number;
  count = 0;

  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly life: Float32Array;
  readonly maxLife: Float32Array;
  readonly size: Float32Array;
  readonly drag: Float32Array;
  readonly gravity: Float32Array;
  readonly alpha: Float32Array;
  readonly twinkle: Float32Array;
  readonly phase: Float32Array;
  readonly changeAt: Float32Array;
  readonly splitAt: Float32Array;
  readonly emitTimer: Float32Array;
  readonly emitEvery: Float32Array;
  readonly emitLife: Float32Array;
  readonly emitColor: Uint16Array;
  readonly color: Uint16Array;
  readonly color2: Uint16Array;
  readonly kind: Uint8Array;
  readonly emitStyle: Uint8Array;

  /** How many spawns were refused because the pool was full. */
  dropped = 0;

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('ParticlePool capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.size = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.twinkle = new Float32Array(capacity);
    this.phase = new Float32Array(capacity);
    this.changeAt = new Float32Array(capacity);
    this.splitAt = new Float32Array(capacity);
    this.emitTimer = new Float32Array(capacity);
    this.emitEvery = new Float32Array(capacity);
    this.emitLife = new Float32Array(capacity);
    this.emitColor = new Uint16Array(capacity);
    this.color = new Uint16Array(capacity);
    this.color2 = new Uint16Array(capacity);
    this.kind = new Uint8Array(capacity);
    this.emitStyle = new Uint8Array(capacity);
  }

  get isFull(): boolean {
    return this.count >= this.capacity;
  }

  /** Adds a particle. Returns its index, or -1 if the pool is full. */
  spawn(p: ParticleInit): number {
    if (this.count >= this.capacity) {
      this.dropped += 1;
      return -1;
    }
    const i = this.count++;
    this.x[i] = p.x;
    this.y[i] = p.y;
    this.vx[i] = p.vx;
    this.vy[i] = p.vy;
    this.life[i] = p.life;
    this.maxLife[i] = p.life;
    this.size[i] = p.size;
    this.drag[i] = p.drag;
    this.gravity[i] = p.gravity;
    this.alpha[i] = p.alpha;
    this.twinkle[i] = p.twinkle;
    this.phase[i] = p.phase ?? 0;
    this.color[i] = p.color;
    this.color2[i] = p.color2 ?? p.color;
    this.changeAt[i] = p.changeAt ?? 0;
    this.splitAt[i] = p.splitAt ?? 0;
    this.kind[i] = p.kind;
    this.emitEvery[i] = p.emitEvery ?? 0;
    this.emitLife[i] = p.emitLife ?? 0;
    this.emitColor[i] = p.emitColor ?? p.color;
    this.emitStyle[i] = p.emitStyle ?? EmitStyle.Trail;
    this.emitTimer[i] = p.emitEvery ? p.emitEvery * 0.5 : 0;
    return i;
  }

  /** Removes particle i by moving the last live particle into its slot. */
  remove(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.x[i] = this.x[last]!;
    this.y[i] = this.y[last]!;
    this.vx[i] = this.vx[last]!;
    this.vy[i] = this.vy[last]!;
    this.life[i] = this.life[last]!;
    this.maxLife[i] = this.maxLife[last]!;
    this.size[i] = this.size[last]!;
    this.drag[i] = this.drag[last]!;
    this.gravity[i] = this.gravity[last]!;
    this.alpha[i] = this.alpha[last]!;
    this.twinkle[i] = this.twinkle[last]!;
    this.phase[i] = this.phase[last]!;
    this.changeAt[i] = this.changeAt[last]!;
    this.splitAt[i] = this.splitAt[last]!;
    this.emitTimer[i] = this.emitTimer[last]!;
    this.emitEvery[i] = this.emitEvery[last]!;
    this.emitLife[i] = this.emitLife[last]!;
    this.emitColor[i] = this.emitColor[last]!;
    this.color[i] = this.color[last]!;
    this.color2[i] = this.color2[last]!;
    this.kind[i] = this.kind[last]!;
    this.emitStyle[i] = this.emitStyle[last]!;
  }

  clear(): void {
    this.count = 0;
  }
}
