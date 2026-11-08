import type { Rng } from './random';
import { SkyRenderer } from './renderer';
import { SkySimulation } from './simulation';
import type { EngineListener, LaunchRequest, SceneId, SkyEngineApi } from './types';

export interface SkyEngineOptions {
  reducedMotion: boolean;
  rng?: Rng;
}

const MAX_DPR = 2;
const DEGRADED_DPR = 1.25;

/**
 * Owns the animation loop. React never re-renders per frame: it only calls
 * these methods and listens for the few firework phase events.
 */
export class SkyEngine implements SkyEngineApi {
  /** Returns null when 2D canvas is unavailable, so the page can carry on without it. */
  static create(
    starCanvas: HTMLCanvasElement,
    fxCanvas: HTMLCanvasElement,
    options: SkyEngineOptions,
  ): SkyEngine | null {
    let starCtx: CanvasRenderingContext2D | null = null;
    let fxCtx: CanvasRenderingContext2D | null = null;
    try {
      starCtx = starCanvas.getContext('2d');
      fxCtx = fxCanvas.getContext('2d');
    } catch {
      return null;
    }
    if (!starCtx || !fxCtx) return null;
    return new SkyEngine(starCanvas, fxCanvas, starCtx, fxCtx, options);
  }

  private readonly starCanvas: HTMLCanvasElement;
  private readonly sim: SkySimulation;
  private readonly renderer: SkyRenderer;

  private raf = 0;
  private resizeRaf = 0;
  private last = 0;
  private destroyed = false;
  private started = false;
  private observer: ResizeObserver | null = null;

  private width = 0;
  private height = 0;
  private dpr = 1;
  private dprCap = MAX_DPR;

  /** Simple adaptive quality: if frames stay slow, draw fewer pixels and stars. */
  private slowFor = 0;
  private frameAverage = 1 / 60;
  private degraded = false;

  private constructor(
    starCanvas: HTMLCanvasElement,
    fxCanvas: HTMLCanvasElement,
    starCtx: CanvasRenderingContext2D,
    fxCtx: CanvasRenderingContext2D,
    options: SkyEngineOptions,
  ) {
    this.starCanvas = starCanvas;
    const rng = options.rng ?? Math.random;
    const { width, height } = this.measure();
    const small = Math.min(width, height) < 640;
    const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4;
    const lowPower = small || cores <= 4;
    this.sim = new SkySimulation({
      width,
      height,
      reducedMotion: options.reducedMotion,
      capacity: lowPower ? 5000 : 9000,
      particleScale: lowPower ? 0.75 : 1,
      rng,
    });
    this.renderer = new SkyRenderer(starCanvas, fxCanvas, starCtx, fxCtx, rng);
  }

  start(): void {
    if (this.started || this.destroyed) return;
    this.started = true;
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.onResize);
      this.observer.observe(this.starCanvas);
    }
    this.applySize();
    this.renderer.render(this.sim, 0);
    this.run();
  }

  setScene(scene: SceneId): void {
    this.sim.setScene(scene);
  }

  setReducedMotion(reduced: boolean): void {
    this.sim.setReducedMotion(reduced);
  }

  launch(request: LaunchRequest): boolean {
    if (this.destroyed) return false;
    return this.sim.launch(request);
  }

  on(listener: EngineListener): () => void {
    return this.sim.on(listener);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.halt();
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.observer?.disconnect();
    this.observer = null;
    this.sim.pool.clear();
    this.renderer.dispose();
  }

  private measure(): { width: number; height: number } {
    const rect = this.starCanvas.getBoundingClientRect();
    return {
      width: Math.round(rect.width) || window.innerWidth || 1,
      height: Math.round(rect.height) || window.innerHeight || 1,
    };
  }

  private shouldRun(): boolean {
    return this.started && !this.destroyed && document.visibilityState !== 'hidden';
  }

  private run(): void {
    if (this.raf || !this.shouldRun()) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private halt(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private readonly tick = (now: number): void => {
    this.raf = 0;
    if (!this.shouldRun()) return;
    const raw = this.last ? (now - this.last) / 1000 : 1 / 60;
    this.last = now;
    // Clamp long gaps (tab switches, slow frames) so physics never jumps.
    const dt = Math.min(Math.max(raw, 0), 0.05);
    this.watchPerformance(raw);
    this.sim.update(dt);
    this.renderer.render(this.sim, dt);
    this.raf = requestAnimationFrame(this.tick);
  };

  private watchPerformance(raw: number): void {
    if (this.degraded || raw <= 0 || raw > 0.25) return;
    this.frameAverage += (raw - this.frameAverage) * 0.05;
    this.slowFor = this.frameAverage > 1 / 32 ? this.slowFor + raw : 0;
    if (this.slowFor > 3) {
      this.degraded = true;
      this.dprCap = DEGRADED_DPR;
      this.sim.particleScale *= 0.65;
      this.applySize();
    }
  }

  private readonly onResize = (): void => {
    if (this.resizeRaf || this.destroyed) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.applySize();
    });
  };

  private readonly onVisibility = (): void => {
    if (document.visibilityState === 'hidden') this.halt();
    else this.run();
  };

  private applySize(): void {
    if (this.destroyed) return;
    const { width, height } = this.measure();
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.sim.resize(width, height);
    this.renderer.resize(width, height, dpr);
    // Keep a picture on screen when the loop is not running.
    if (!this.shouldRun()) this.renderer.render(this.sim, 0);
  }
}
