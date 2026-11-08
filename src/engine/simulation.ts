import { SkyAmbience } from './ambience';
import { DEFAULT_TIMINGS, FireworkLifecycle, REDUCED_MOTION_TIMINGS, type Phase, type PhaseTimings } from './lifecycle';
import { colorIndex, PALETTES, SKY_COLORS, type Palette } from './palettes';
import { EmitStyle, ParticleKind, ParticlePool } from './particles';
import { createBurst, CRACKLING, type PatternId } from './patterns';
import { between, clamp, lerp, pick, type Rng } from './random';
import { SHOW, SHOW_END, SHOW_LAUNCH_SECONDS, type ShowShot } from './show';
import type { EngineEvent, EngineListener, FireworkPhaseEvent, LaunchRequest, SceneId } from './types';

export interface Firework {
  readonly id: number;
  readonly key: string | null;
  readonly ambient: boolean;
  readonly lifecycle: FireworkLifecycle;
  readonly palette: Palette;
  readonly pattern: PatternId;
  readonly originX: number;
  readonly originY: number;
  readonly startX: number;
  readonly startY: number;
  readonly targetX: number;
  readonly targetY: number;
  /** Rocket head position while climbing, and where it was last frame. */
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  /** Shell size: 1 is a standard shell, up to about 1.4 for the show's finale. */
  readonly size: number;
  /** Fractional particle carry-over so spawn rates are frame-rate independent. */
  carry: number;
}

/** The sky lighting up for a moment around a burst. */
export interface SkyFlash {
  x: number;
  y: number;
  color: number;
  radius: number;
  strength: number;
  age: number;
  life: number;
}

/** A drifting wisp of smoke left behind by a burst. */
export interface SmokePuff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  age: number;
  life: number;
}

export interface SimulationOptions {
  width: number;
  height: number;
  reducedMotion?: boolean;
  /** Hard ceiling on live particles. */
  capacity?: number;
  /** Multiplies particle counts; lowered on small or slow devices. */
  particleScale?: number;
  rng?: Rng;
}

/**
 * How big bursts are. Her fireworks are massive and fill the sky; the show's
 * shells are a little smaller so a barrage still reads clearly.
 */
const CHOSEN_BURST = { speed: 1.15, stars: 1.5, starSize: 1.3, life: 1.15, reach: 0.6 } as const;
const SHOW_BURST = { speed: 0.95, stars: 1.0, starSize: 1.1, life: 1.05, reach: 0.5 } as const;

const MAX_FLASHES = 16;
const MAX_SMOKE = 70;
const ROCKET = colorIndex(SKY_COLORS.rocket);
const EMBER = colorIndex(SKY_COLORS.ember);
const SMOKE_DRIFT = 5; // px/s, a light breeze to the right

/**
 * Everything that moves in the sky, without any drawing. The renderer reads
 * this state each frame; tests drive it directly.
 */
export class SkySimulation {
  width: number;
  height: number;
  reducedMotion: boolean;
  particleScale: number;

  readonly pool: ParticlePool;
  readonly ambience: SkyAmbience;
  fireworks: Firework[] = [];
  flashes: SkyFlash[] = [];
  smoke: SmokePuff[] = [];

  scene: SceneId = 'welcome';
  sceneTime = 0;
  time = 0;

  /** Seconds into the closing show, or -1 when it is not playing. */
  showTime = -1;
  private showIndex = 0;
  private showEnded = false;

  private readonly rng: Rng;
  private readonly listeners = new Set<EngineListener>();
  private nextId = 1;

  constructor(options: SimulationOptions) {
    this.width = Math.max(1, options.width);
    this.height = Math.max(1, options.height);
    this.reducedMotion = options.reducedMotion ?? false;
    this.particleScale = options.particleScale ?? 1;
    this.rng = options.rng ?? Math.random;
    this.pool = new ParticlePool(options.capacity ?? 5000);
    this.ambience = new SkyAmbience(this.width, this.height, this.reducedMotion, this.rng);
  }

  /** Scale unit for burst size and gravity, so bursts fit any screen. */
  get unit(): number {
    return Math.min(this.width, this.height * 0.8);
  }

  /** About how far the outermost stars of a shell of this size travel. */
  burstRadius(size: number, ambient = false): number {
    return this.unit * (ambient ? SHOW_BURST.reach : CHOSEN_BURST.reach) * size;
  }

  on(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  resize(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.ambience.resize(this.width, this.height);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
    this.ambience.setReducedMotion(reduced);
  }

  setScene(scene: SceneId): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.sceneTime = 0;
    this.ambience.setScene(scene);
    if (scene === 'show') {
      this.showTime = 0;
      this.showIndex = 0;
      this.showEnded = false;
    } else {
      this.showTime = -1;
    }
  }

  /** Number of chosen (not show) fireworks still on their way. */
  get chosenInFlight(): number {
    return this.fireworks.filter((f) => !f.ambient && f.lifecycle.inFlight).length;
  }

  /** Fires a shell from the launch pad. Any number may be in the air at once. */
  launch(request: LaunchRequest): boolean {
    if (this.scene !== 'feelings') return false;
    if (this.fireworks.some((f) => f.key === request.key && f.lifecycle.inFlight)) return false;

    const { width: w, height: h, rng } = this;
    const size = between(rng, 1, 1.15);
    const radius = this.burstRadius(size);
    // Every shell starts from the same pad, so spread the bursts across the sky.
    const targetX = w * between(rng, 0.25, 0.75);
    const lowest = radius * 0.68 + 8;
    const targetY = clamp(h * between(rng, 0.2, 0.34), lowest, Math.max(lowest, h * 0.45));
    const climb = Math.max(0, request.originY - targetY);
    const launchSeconds = this.reducedMotion ? 0 : clamp(0.75 + (climb / h) * 1.15, 1.05, 1.8);
    const timings: PhaseTimings = this.reducedMotion
      ? REDUCED_MOTION_TIMINGS
      : { ...DEFAULT_TIMINGS, launch: launchSeconds };

    const firework: Firework = {
      id: this.nextId++,
      key: request.key,
      ambient: false,
      lifecycle: new FireworkLifecycle(timings),
      palette: PALETTES[request.palette],
      pattern: request.pattern,
      originX: request.originX,
      originY: request.originY,
      startX: request.originX,
      startY: request.originY,
      targetX,
      targetY,
      x: request.originX,
      y: request.originY,
      prevX: request.originX,
      prevY: request.originY,
      size,
      carry: 0,
    };
    this.fireworks.push(firework);
    for (const phase of firework.lifecycle.select()) this.enter(firework, phase);
    return true;
  }

  update(dt: number): void {
    if (!(dt > 0)) return;
    this.time += dt;
    this.sceneTime += dt;
    this.updateShow(dt);
    this.updateFireworks(dt);
    this.updateParticles(dt);
    this.updateAtmosphere(dt);
    this.ambience.update(dt);
  }

  // ---- the closing show ------------------------------------------------------

  private updateShow(dt: number): void {
    if (this.showTime < 0) return;
    this.showTime += dt;
    while (this.showIndex < SHOW.length && SHOW[this.showIndex]!.at <= this.showTime) {
      const shot = SHOW[this.showIndex]!;
      // Reduced motion: a shorter, gentler show.
      if (!this.reducedMotion || this.showIndex % 2 === 0) this.fireShowShot(shot);
      this.showIndex += 1;
    }
    if (!this.showEnded && this.showTime >= SHOW_END) {
      this.showEnded = true;
      this.emitEvent({ type: 'show-end' });
    }
  }

  private fireShowShot(shot: ShowShot): void {
    const { width: w, height: h, rng } = this;
    const size = shot.size ?? 1;
    const radius = this.burstRadius(size, true);
    const targetX = clamp(shot.x * w, w * 0.08, w * 0.92);
    const targetY = Math.max(shot.y * h, radius * 0.6 + 8);
    const startX = clamp(targetX + between(rng, -0.04, 0.04) * w, 0, w);
    const timings: PhaseTimings = this.reducedMotion
      ? { ...REDUCED_MOTION_TIMINGS, launch: 0 }
      : { ...DEFAULT_TIMINGS, launch: SHOW_LAUNCH_SECONDS, explosion: 0.6, fade: 0.8 };
    const firework: Firework = {
      id: this.nextId++,
      key: null,
      ambient: true,
      lifecycle: new FireworkLifecycle(timings, 'LAUNCH'),
      palette: PALETTES[shot.palette],
      pattern: shot.pattern,
      originX: startX,
      originY: h + 8,
      startX,
      startY: h + 8,
      targetX,
      targetY,
      x: startX,
      y: h + 8,
      prevX: startX,
      prevY: h + 8,
      size,
      carry: 0,
    };
    this.fireworks.push(firework);
    this.enter(firework, 'LAUNCH');
  }

  // ---- fireworks -------------------------------------------------------------

  private updateFireworks(dt: number): void {
    for (let i = 0; i < this.fireworks.length; ) {
      const firework = this.fireworks[i]!;
      for (const phase of firework.lifecycle.advance(dt)) this.enter(firework, phase);
      if (firework.lifecycle.phase === 'LAUNCH') this.rise(firework);
      if (firework.lifecycle.phase === 'MESSAGE') this.fireworks.splice(i, 1);
      else i++;
    }
  }

  private enter(firework: Firework, phase: Phase): void {
    if (phase === 'IGNITION') {
      this.liftOff(firework);
    } else if (phase === 'LAUNCH') {
      firework.x = firework.prevX = firework.startX;
      firework.y = firework.prevY = firework.startY;
      firework.carry = 0;
    } else if (phase === 'EXPLOSION') {
      firework.x = firework.targetX;
      firework.y = firework.targetY;
      this.explode(firework);
    }
    this.emitPhase(firework, phase);
  }

  private emitPhase(firework: Firework, phase: Phase): void {
    const event: FireworkPhaseEvent = {
      type: 'phase',
      id: firework.id,
      key: firework.key,
      phase,
      ambient: firework.ambient,
      pan: clamp((firework.targetX / this.width) * 2 - 1, -1, 1) * 0.75,
      size: firework.size,
      launchSeconds: firework.lifecycle.timings.launch,
      crackle: CRACKLING.has(firework.pattern),
    };
    this.emitEvent(event);
  }

  private emitEvent(event: EngineEvent): void {
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        console.error('Sky listener failed', error);
      }
    }
  }

  /** The lift charge: a spray of sparks and a puff of smoke from the shell's tube. */
  private liftOff(firework: Firework): void {
    const u = this.unit;
    const rng = this.rng;
    const calm = this.reducedMotion;
    for (let i = 0; i < 16; i++) {
      const angle = -Math.PI / 2 + between(rng, -0.6, 0.6);
      const speed = u * between(rng, 0.12, 0.3) * (calm ? 0.25 : 1);
      this.pool.spawn({
        x: firework.originX,
        y: firework.originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: between(rng, 0.35, 0.7),
        size: between(rng, 0.9, 1.3),
        color: rng() < 0.5 ? EMBER : colorIndex(pick(rng, firework.palette.colors)),
        kind: ParticleKind.Ember,
        drag: 3,
        gravity: u * 0.25,
        alpha: 0.9,
        twinkle: 0,
      });
    }
    this.addSmoke(firework.originX, firework.originY - 6, u * 0.05, 1, 2.5, 0.07);
  }

  /** The shell climbs, slowing like a real one, shedding a sparkling tail. */
  private rise(firework: Firework): void {
    const p = firework.lifecycle.progress;
    const eased = 1 - (1 - p) * (1 - p);
    const prevX = firework.x;
    const prevY = firework.y;
    firework.prevX = prevX;
    firework.prevY = prevY;
    firework.x = lerp(firework.startX, firework.targetX, eased) + Math.sin(p * Math.PI * 3) * 1.4;
    firework.y = lerp(firework.startY, firework.targetY, eased);

    const spacing = firework.ambient ? 4 : 2.4;
    firework.carry += Math.hypot(firework.x - prevX, firework.y - prevY) / spacing;
    const steps = Math.floor(firework.carry);
    firework.carry -= steps;
    const u = this.unit;
    const rng = this.rng;
    for (let s = 0; s < steps; s++) {
      const t = (s + 1) / (steps + 1);
      this.pool.spawn({
        x: lerp(prevX, firework.x, t) + between(rng, -0.8, 0.8),
        y: lerp(prevY, firework.y, t),
        vx: between(rng, -1, 1) * u * 0.025,
        vy: between(rng, 0.02, 0.09) * u,
        life: between(rng, 0.3, 0.7),
        size: between(rng, 0.9, 1.4),
        color: rng() < 0.65 ? ROCKET : EMBER,
        kind: ParticleKind.Ember,
        drag: 2.5,
        gravity: u * 0.16,
        alpha: 0.85,
        twinkle: rng() < 0.3 ? 1 : 0,
        phase: rng() * Math.PI * 2,
      });
    }
  }

  private explode(firework: Firework): void {
    const u = this.unit;
    const look = firework.ambient ? SHOW_BURST : CHOSEN_BURST;
    const burst = createBurst(firework.pattern, {
      x: firework.targetX,
      y: firework.targetY,
      speed: u * look.speed * firework.size,
      unit: u,
      palette: firework.palette,
      countScale: this.particleScale * look.stars * Math.min(1.25, firework.size),
      alphaScale: 1,
      sizeScale: look.starSize,
      lifeScale: look.life,
      reducedMotion: this.reducedMotion,
      rng: this.rng,
    });
    for (const particle of burst) {
      if (this.pool.spawn(particle) < 0) break;
    }

    // The sky lights up for a moment: soft, never a hard flash.
    this.flashes.push({
      x: firework.targetX,
      y: firework.targetY,
      color: colorIndex(firework.palette.colors[0] ?? SKY_COLORS.rocket),
      radius: u * (firework.ambient ? 1.2 : 1.5) * firework.size,
      strength: (this.reducedMotion ? 0.06 : firework.ambient ? 0.13 : 0.16) * Math.min(1.2, firework.size),
      age: 0,
      life: 0.7,
    });
    if (this.flashes.length > MAX_FLASHES) this.flashes.shift();

    const rng = this.rng;
    const spread = look.reach / 0.41;
    for (let i = 0; i < 5; i++) {
      this.addSmoke(
        firework.targetX + between(rng, -0.16, 0.16) * u * firework.size * spread,
        firework.targetY + between(rng, -0.1, 0.18) * u * firework.size * spread,
        u * between(rng, 0.12, 0.22) * firework.size * spread,
        between(rng, 5, 8),
        between(rng, 0.035, 0.06),
        0,
      );
    }
  }

  private addSmoke(x: number, y: number, r: number, life: number, alpha: number, rise: number): void {
    const still = this.reducedMotion;
    this.smoke.push({
      x,
      y,
      vx: still ? 0 : between(this.rng, 0.4, 1.2) * SMOKE_DRIFT,
      vy: still ? 0 : between(this.rng, -3, 1) - rise * 10,
      r,
      alpha,
      age: 0,
      life,
    });
    if (this.smoke.length > MAX_SMOKE) this.smoke.shift();
  }

  private updateAtmosphere(dt: number): void {
    for (const flash of this.flashes) flash.age += dt;
    this.flashes = this.flashes.filter((flash) => flash.age < flash.life);
    for (const puff of this.smoke) {
      puff.age += dt;
      puff.x += puff.vx * dt;
      puff.y += puff.vy * dt;
      puff.r += dt * 3; // smoke spreads as it drifts
    }
    this.smoke = this.smoke.filter((puff) => puff.age < puff.life);
  }

  // ---- particles ---------------------------------------------------------------

  private updateParticles(dt: number): void {
    const pool = this.pool;
    const finale = this.scene === 'finale';
    const decay = finale ? 1.25 : 1;
    const u = this.unit;
    const rng = this.rng;
    for (let i = 0; i < pool.count; ) {
      const life = pool.life[i]! - dt * decay;
      if (life <= 0) {
        pool.remove(i);
        continue;
      }
      pool.life[i] = life;
      const kind = pool.kind[i];
      if (kind === ParticleKind.Glow) {
        i++;
        continue;
      }

      const damping = Math.exp(-pool.drag[i]! * dt);
      const vx = pool.vx[i]! * damping;
      const vy = pool.vy[i]! * damping + pool.gravity[i]! * dt;
      pool.vx[i] = vx;
      pool.vy[i] = vy;
      pool.x[i] = pool.x[i]! + vx * dt;
      pool.y[i] = pool.y[i]! + vy * dt;

      if (kind === ParticleKind.Splitter && life <= pool.maxLife[i]! * pool.splitAt[i]!) {
        this.split(i, vx, vy);
        pool.remove(i);
        continue;
      }

      if (kind === ParticleKind.Emitter && !finale) {
        let timer = pool.emitTimer[i]! - dt;
        if (timer <= 0) {
          timer += Math.max(pool.emitEvery[i]!, 0.016);
          if (life > pool.maxLife[i]! * 0.15 && !pool.isFull) {
            const glitter = pool.emitStyle[i] === EmitStyle.Glitter;
            pool.spawn({
              x: pool.x[i]! + (glitter ? between(rng, -2, 2) : 0),
              y: pool.y[i]! + (glitter ? between(rng, -2, 2) : 0),
              vx: vx * (glitter ? 0.02 : 0.06),
              vy: vy * (glitter ? 0.02 : 0.06) + u * (glitter ? 0.004 : 0.01),
              life: pool.emitLife[i]! * between(rng, 0.8, 1.2),
              size: pool.size[i]! * (glitter ? 0.55 : 0.72),
              color: pool.emitColor[i]!,
              kind: ParticleKind.Ember,
              drag: glitter ? 3.5 : 3,
              gravity: u * (glitter ? 0.04 : 0.11),
              alpha: pool.alpha[i]! * (glitter ? 0.9 : 0.7),
              twinkle: glitter ? 1 : 0,
              phase: rng() * Math.PI * 2,
            });
          }
        }
        pool.emitTimer[i] = timer;
      }
      i++;
    }
  }

  /** A crossette star breaks into a cross of four smaller stars. */
  private split(i: number, vx: number, vy: number): void {
    const pool = this.pool;
    const u = this.unit;
    const rng = this.rng;
    const heading = Math.atan2(vy, vx) + Math.PI / 4;
    const speed = Math.hypot(vx, vy) * 0.45 + u * 0.16;
    for (let k = 0; k < 4; k++) {
      const a = heading + (k * Math.PI) / 2;
      pool.spawn({
        x: pool.x[i]!,
        y: pool.y[i]!,
        vx: vx * 0.3 + Math.cos(a) * speed,
        vy: vy * 0.3 + Math.sin(a) * speed,
        life: between(rng, 0.85, 1.1),
        size: pool.size[i]! * 0.72,
        color: pool.emitColor[i]!,
        color2: pool.color[i]!,
        changeAt: 0.5,
        kind: ParticleKind.Spark,
        drag: 2,
        gravity: u * 0.14,
        alpha: pool.alpha[i]!,
        twinkle: 0.5,
        phase: rng() * Math.PI * 2,
      });
    }
  }
}
