import { colorIndex, SKY_COLORS } from './palettes';
import { between, clamp, pick, type Rng } from './random';
import type { SceneId } from './types';

export interface TwinkleStar {
  /** 0 to 1 across the viewport. */
  x: number;
  y: number;
  r: number;
  base: number;
  phase: number;
  /** Radians per second; kept slow (well under 1 Hz). */
  speed: number;
  color: number;
  glint: boolean;
}

export interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  base: number;
  phase: number;
  speed: number;
}

interface SceneLook {
  stars: number;
  twinkle: number;
  dust: number;
}

const LOOKS: Readonly<Record<SceneId, SceneLook>> = {
  welcome: { stars: 0.95, twinkle: 0.85, dust: 0.8 },
  feelings: { stars: 0.85, twinkle: 0.75, dust: 0.45 },
  // Darker during the show so the fireworks glow brighter.
  show: { stars: 0.65, twinkle: 0.55, dust: 0.15 },
  finale: { stars: 1, twinkle: 1, dust: 0.55 },
};

/** Finale timing, in seconds after the wish scene begins. */
export const FINALE_TIMELINE = {
  /** Golden lights begin to drift in. */
  lightsStart: 1.2,
} as const;

const approach = (current: number, target: number, dt: number, tau: number): number =>
  current + (target - current) * (1 - Math.exp(-dt / tau));

/**
 * The calm part of the sky: twinkling stars, drifting golden dust, and the
 * golden lights that gather around the final wish. Pure state.
 */
export class SkyAmbience {
  width: number;
  height: number;
  reducedMotion: boolean;
  private readonly rng: Rng;

  scene: SceneId = 'welcome';
  sceneTime = 0;
  time = 0;

  twinkles: TwinkleStar[] = [];
  dust: Mote[] = [];
  lights: Mote[] = [];

  /** Current brightness levels, eased towards each scene's look. */
  starIntensity = 0;
  twinkleIntensity = 0;
  dustAlpha = 0;
  lightsAlpha = 0;

  /** Horizontal drift of the two star layers, px. */
  driftFar = 0;
  driftNear = 0;

  constructor(width: number, height: number, reducedMotion: boolean, rng: Rng) {
    this.width = width;
    this.height = height;
    this.reducedMotion = reducedMotion;
    this.rng = rng;
    this.populate();
  }

  private populate(): void {
    const rng = this.rng;
    const area = this.width * this.height;
    const twinkleCount = Math.round(clamp(area / 6500, 50, 170));
    const starColors = [SKY_COLORS.starCool, SKY_COLORS.starCool, SKY_COLORS.starWarm, SKY_COLORS.starLilac].map(
      colorIndex,
    );
    this.twinkles = Array.from({ length: twinkleCount }, () => {
      const r = between(rng, 0.7, 1.65);
      return {
        x: rng(),
        y: rng() ** 1.25, // slightly denser towards the top
        r,
        base: between(rng, 0.45, 1),
        phase: rng() * Math.PI * 2,
        speed: between(rng, 0.35, 1.4),
        color: pick(rng, starColors),
        glint: r > 1.5 && rng() < 0.6,
      };
    });

    const dustCount = Math.round(clamp(area / 24000, 16, 44));
    this.dust = Array.from({ length: dustCount }, () => this.makeMote(0.7, 1.6, 3, 10, rng() * this.height));

    const lightCount = Math.round(clamp(area / 15000, 26, 80));
    this.lights = Array.from({ length: lightCount }, () => this.makeMote(1.3, 3.1, 6, 15, rng() * this.height));
  }

  private makeMote(rMin: number, rMax: number, vMin: number, vMax: number, y: number): Mote {
    const rng = this.rng;
    return {
      x: rng() * this.width,
      y,
      vx: between(rng, -3, 3),
      vy: -between(rng, vMin, vMax),
      r: between(rng, rMin, rMax),
      base: between(rng, 0.3, 0.85),
      phase: rng() * Math.PI * 2,
      speed: between(rng, 0.2, 0.55),
    };
  }

  resize(width: number, height: number): void {
    const sx = width / (this.width || width);
    const sy = height / (this.height || height);
    this.width = width;
    this.height = height;
    for (const list of [this.dust, this.lights]) {
      for (const m of list) {
        m.x *= sx;
        m.y *= sy;
      }
    }
  }

  setScene(scene: SceneId): void {
    if (scene === this.scene) return;
    this.scene = scene;
    this.sceneTime = 0;
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  update(dt: number): void {
    this.time += dt;
    this.sceneTime += dt;
    const look = LOOKS[this.scene];
    const finale = this.scene === 'finale';

    this.starIntensity = approach(this.starIntensity, look.stars, dt, finale ? 1.4 : 0.9);
    this.twinkleIntensity = approach(this.twinkleIntensity, look.twinkle, dt, 1.1);
    this.dustAlpha = approach(this.dustAlpha, look.dust, dt, 1.4);
    const lightsTarget = finale && this.sceneTime >= FINALE_TIMELINE.lightsStart ? 1 : 0;
    this.lightsAlpha = approach(this.lightsAlpha, lightsTarget, dt, lightsTarget ? 1.8 : 0.8);

    if (!this.reducedMotion) {
      this.driftFar += 1.1 * dt;
      this.driftNear += 2.4 * dt;
    }

    this.moveMotes(this.dust, dt);
    if (this.lightsAlpha > 0.001) this.moveMotes(this.lights, dt);
  }

  private moveMotes(list: Mote[], dt: number): void {
    if (this.reducedMotion) return; // they stay put and only breathe
    const h = this.height;
    const w = this.width;
    for (const m of list) {
      m.x += (m.vx + Math.sin(this.time * m.speed + m.phase) * 6) * dt;
      m.y += m.vy * dt;
      if (m.y < -24) {
        m.y = h + 24;
        m.x = this.rng() * w;
      }
      if (m.x < -24) m.x = w + 24;
      else if (m.x > w + 24) m.x = -24;
    }
  }
}
