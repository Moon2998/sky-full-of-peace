import type { Mote } from './ambience';
import { COLOR_TABLE, colorIndex, SKY_COLORS } from './palettes';
import { ParticleKind } from './particles';
import { clamp, type Rng } from './random';
import type { SkySimulation } from './simulation';
import { glintSprite, smokeSprite, softSprite, sparkSprite, starLayer } from './sprites';

const GOLD = colorIndex(SKY_COLORS.gold);
const ROCKET = colorIndex(SKY_COLORS.rocket);

/**
 * Draws the simulation onto two stacked canvases:
 *  - the sky canvas (stars, golden lights, sky glow, smoke), cleared every frame;
 *  - the fireworks canvas, faded a little each frame so stars leave trails.
 */
export class SkyRenderer {
  private readonly starCanvas: HTMLCanvasElement;
  private readonly fxCanvas: HTMLCanvasElement;
  private readonly starCtx: CanvasRenderingContext2D;
  private readonly fxCtx: CanvasRenderingContext2D;
  private readonly rng: Rng;

  private readonly sparks: HTMLCanvasElement[];
  private readonly glows: HTMLCanvasElement[];
  private readonly glint: HTMLCanvasElement;
  private readonly smoke: HTMLCanvasElement;
  private far: HTMLCanvasElement | null = null;
  private near: HTMLCanvasElement | null = null;
  private layerSize = { width: 0, height: 0 };

  private width = 0;
  private height = 0;
  private fxIdleFor = 0;
  private fxClean = true;

  constructor(
    starCanvas: HTMLCanvasElement,
    fxCanvas: HTMLCanvasElement,
    starCtx: CanvasRenderingContext2D,
    fxCtx: CanvasRenderingContext2D,
    rng: Rng,
  ) {
    this.starCanvas = starCanvas;
    this.fxCanvas = fxCanvas;
    this.starCtx = starCtx;
    this.fxCtx = fxCtx;
    this.rng = rng;
    this.sparks = COLOR_TABLE.map((color) => sparkSprite(color));
    this.glows = COLOR_TABLE.map((color) => softSprite(color));
    this.glint = glintSprite();
    this.smoke = smokeSprite(rng);
  }

  resize(width: number, height: number, dpr: number): void {
    this.width = width;
    this.height = height;
    for (const [canvas, ctx] of [
      [this.starCanvas, this.starCtx],
      [this.fxCanvas, this.fxCtx],
    ] as const) {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    this.fxClean = true;

    // Repaint the still star layers only when the size really changes
    // (not for a mobile address bar sliding in and out).
    const changed =
      Math.abs(width - this.layerSize.width) > this.layerSize.width * 0.08 ||
      Math.abs(height - this.layerSize.height) > this.layerSize.height * 0.12;
    if (!this.far || changed) this.paintStarLayers(width, height, dpr);
  }

  private paintStarLayers(width: number, height: number, dpr: number): void {
    const area = width * height;
    // Layers are painted at up to 1.5x density: crisp enough, lighter on memory.
    const scale = Math.min(dpr, 1.5);
    this.far = starLayer(
      width,
      height,
      scale,
      { count: Math.round(clamp(area / 170, 900, 2600)), minRadius: 0.3, maxRadius: 0.85, minAlpha: 0.18, maxAlpha: 0.6, milkyWay: true },
      this.rng,
    );
    this.near = starLayer(
      width,
      height,
      scale,
      { count: Math.round(clamp(area / 900, 200, 600)), minRadius: 0.55, maxRadius: 1.25, minAlpha: 0.35, maxAlpha: 0.85, milkyWay: false },
      this.rng,
    );
    this.layerSize = { width, height };
  }

  render(sim: SkySimulation, dt: number): void {
    this.drawSky(sim);
    this.drawFireworks(sim, dt);
  }

  private tile(ctx: CanvasRenderingContext2D, layer: HTMLCanvasElement, drift: number): void {
    const w = this.width;
    const offset = ((drift % w) + w) % w;
    ctx.drawImage(layer, -offset, 0, w, this.height);
    if (offset > 0) ctx.drawImage(layer, w - offset, 0, w, this.height);
  }

  private drawSky(sim: SkySimulation): void {
    const sky = sim.ambience;
    const ctx = this.starCtx;
    const w = this.width;
    const h = this.height;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);

    if (this.far) {
      ctx.globalAlpha = sky.starIntensity * 0.85;
      this.tile(ctx, this.far, sky.driftFar);
    }
    if (this.near) {
      ctx.globalAlpha = sky.starIntensity;
      this.tile(ctx, this.near, sky.driftNear);
    }

    ctx.globalCompositeOperation = 'lighter';
    const t = sky.time;
    const twinkle = sky.twinkleIntensity * sky.starIntensity;
    for (const star of sky.twinkles) {
      const alpha = star.base * twinkle * (0.55 + 0.45 * Math.sin(star.phase + t * star.speed));
      if (alpha < 0.02) continue;
      const x = (((star.x * w + sky.driftNear) % w) + w) % w;
      const y = star.y * h;
      const r = star.r * 4.2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.sparks[star.color]!, x - r, y - r, r * 2, r * 2);
      if (star.glint) {
        const g = star.r * 9;
        ctx.globalAlpha = alpha * 0.5;
        ctx.drawImage(this.glint, x - g, y - g, g * 2, g * 2);
      }
    }

    this.drawMotes(ctx, sky.dust, sky.dustAlpha, t, 5, false);
    this.drawMotes(ctx, sky.lights, sky.lightsAlpha, t, 7, true);

    // Sky glow around each fresh burst: the night lights up for a moment.
    for (const flash of sim.flashes) {
      const k = 1 - flash.age / flash.life;
      const alpha = flash.strength * k * k;
      if (alpha < 0.005) continue;
      const r = flash.radius * (1 + 0.15 * (1 - k));
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.glows[flash.color]!, flash.x - r, flash.y - r, r * 2, r * 2);
    }

    // Smoke drifts above the stars and below the fireworks.
    ctx.globalCompositeOperation = 'source-over';
    for (const puff of sim.smoke) {
      const p = puff.age / puff.life;
      const alpha = puff.alpha * Math.min(1, p / 0.12) * (1 - p);
      if (alpha < 0.004) continue;
      ctx.globalAlpha = alpha;
      ctx.drawImage(this.smoke, puff.x - puff.r, puff.y - puff.r, puff.r * 2, puff.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  private drawMotes(
    ctx: CanvasRenderingContext2D,
    motes: readonly Mote[],
    layerAlpha: number,
    t: number,
    glow: number,
    withCore: boolean,
  ): void {
    if (layerAlpha < 0.01) return;
    const soft = this.glows[GOLD]!;
    const core = this.sparks[GOLD]!;
    for (const m of motes) {
      const alpha = m.base * layerAlpha * (0.6 + 0.4 * Math.sin(t * m.speed * 2 + m.phase));
      if (alpha < 0.01) continue;
      const r = m.r * glow;
      ctx.globalAlpha = alpha * 0.7;
      ctx.drawImage(soft, m.x - r, m.y - r, r * 2, r * 2);
      if (withCore) {
        const c = m.r * 2.6;
        ctx.globalAlpha = alpha;
        ctx.drawImage(core, m.x - c, m.y - c, c * 2, c * 2);
      }
    }
  }

  private drawFireworks(sim: SkySimulation, dt: number): void {
    const ctx = this.fxCtx;
    const w = this.width;
    const h = this.height;
    const pool = sim.pool;

    if (pool.count === 0 && sim.fireworks.length === 0) {
      // Once everything has faded, wipe the last faint trail pixels clean.
      this.fxIdleFor += dt;
      if (!this.fxClean && this.fxIdleFor > 0.6) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.clearRect(0, 0, w, h);
        this.fxClean = true;
      }
      return;
    }
    this.fxIdleFor = 0;
    this.fxClean = false;

    // Fade what was drawn last frame: this is what paints the trails.
    const perFrame = sim.reducedMotion ? 0.4 : 0.17;
    const fade = 1 - Math.pow(1 - perFrame, clamp(dt, 1 / 240, 0.05) * 60);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(0,0,0,${fade.toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'lighter';
    const t = sim.time;

    // Motion streaks: fast stars are drawn as short lines from where they
    // were a moment ago, so trails read as smooth strokes, not dotted dashes.
    // Batched by colour: one stroke call per colour per frame.
    const streaks = new Map<number, Path2D>();
    const step = clamp(dt, 1 / 240, 0.05) * 1.3;
    for (let i = 0; i < pool.count; i++) {
      const kind = pool.kind[i];
      if (kind === ParticleKind.Glow || kind === ParticleKind.Ember) continue;
      const lifeRatio = pool.life[i]! / pool.maxLife[i]!;
      if (lifeRatio < 0.35) continue;
      const vx = pool.vx[i]!;
      const vy = pool.vy[i]!;
      if (Math.abs(vx) + Math.abs(vy) < 90) continue;
      const changeAt = pool.changeAt[i]!;
      const color = changeAt > 0 && lifeRatio <= changeAt ? pool.color2[i]! : pool.color[i]!;
      let path = streaks.get(color);
      if (!path) {
        path = new Path2D();
        streaks.set(color, path);
      }
      const x = pool.x[i]!;
      const y = pool.y[i]!;
      path.moveTo(x - vx * step, y - vy * step);
      path.lineTo(x, y);
    }
    if (streaks.size) {
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.7;
      ctx.globalAlpha = 0.55;
      for (const [color, path] of streaks) {
        ctx.strokeStyle = COLOR_TABLE[color] ?? SKY_COLORS.rocket;
        ctx.stroke(path);
      }
    }

    for (let i = 0; i < pool.count; i++) {
      const lifeRatio = pool.life[i]! / pool.maxLife[i]!;
      const x = pool.x[i]!;
      const y = pool.y[i]!;
      let alpha = pool.alpha[i]!;
      const changeAt = pool.changeAt[i]!;
      const color = changeAt > 0 && lifeRatio <= changeAt ? pool.color2[i]! : pool.color[i]!;

      if (pool.kind[i] === ParticleKind.Glow) {
        // A soft bloom that swells and fades: never a hard flash.
        const age = 1 - lifeRatio;
        alpha *= age < 0.18 ? age / 0.18 : (1 - (age - 0.18) / 0.82) ** 2;
        const r = pool.size[i]! * (1 + age * 0.7);
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.drawImage(this.glows[color]!, x - r, y - r, r * 2, r * 2);
        continue;
      }

      alpha *= Math.min(1, lifeRatio / 0.4) ** 1.3;
      const twinkle = pool.twinkle[i]!;
      if (twinkle > 0 && lifeRatio < 0.5) {
        // About 1.7 Hz and out of phase between stars: a shimmer, not a strobe.
        alpha *= 1 - twinkle * 0.5 * (0.5 + 0.5 * Math.sin(pool.phase[i]! + t * 11));
      }
      if (alpha < 0.01) continue;
      // Stars are a touch larger and hotter in the first moment after the break.
      const birth = lifeRatio > 0.9 ? 1 + (lifeRatio - 0.9) * 3 : 1;
      const r = pool.size[i]! * 4 * (0.6 + 0.4 * lifeRatio) * birth;
      ctx.globalAlpha = alpha > 1 ? 1 : alpha;
      ctx.drawImage(this.sparks[color]!, x - r, y - r, r * 2, r * 2);
    }

    for (const f of sim.fireworks) {
      if (f.lifecycle.phase !== 'LAUNCH') continue;
      // A continuous streak from last frame's position: with the trail fade
      // this becomes a smooth, tapering comet tail.
      ctx.globalAlpha = f.ambient ? 0.35 : 0.45;
      ctx.strokeStyle = 'rgb(255,236,204)';
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(f.prevX, f.prevY);
      ctx.lineTo(f.x, f.y);
      ctx.stroke();

      const r = 9;
      const tint = colorIndex(f.palette.colors[0] ?? SKY_COLORS.rocket);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(this.glows[tint]!, f.x - r * 2.4, f.y - r * 2.4, r * 4.8, r * 4.8);
      ctx.globalAlpha = 0.95;
      ctx.drawImage(this.sparks[ROCKET]!, f.x - r, f.y - r, r * 2, r * 2);
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  dispose(): void {
    for (const canvas of [this.far, this.near]) {
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    this.far = null;
    this.near = null;
  }
}
