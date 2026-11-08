import { createSfxGraph, type SfxGraph, type SoundKind, type SoundOptions } from './sfx';

/**
 *  idle        – nothing has asked for sound yet
 *  ready       – the audio context is running; sounds will play
 *  blocked     – the browser has not allowed sound yet; the next tap retries
 *  unavailable – no Web Audio support; everything continues silently
 */
export type SoundState = 'idle' | 'ready' | 'blocked' | 'unavailable';

/** The parts of AudioContext this relies on (lets tests use a fake). */
export interface AudioContextLike {
  readonly state: string;
  readonly currentTime: number;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close?(): Promise<void>;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

export interface FireworkAudioOptions {
  createContext?: () => AudioContextLike | null;
  createGraph?: (ctx: AudioContextLike) => SfxGraph;
  /** Document whose visibility pauses sound while the tab is hidden. */
  document?: Document | null;
  /** How long to wait for resume() before treating sound as blocked. */
  resumeTimeoutMs?: number;
}

function defaultContext(): AudioContextLike | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor({ latencyHint: 'interactive' });
  } catch {
    return new Ctor();
  }
}

/** Resolves when `promise` settles or after `ms`, whichever comes first. Never rejects. */
function settleWithin(promise: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    promise.then(done, done);
  });
}

/**
 * Plays the firework launch and blast sounds. Browsers only allow sound after
 * a tap, so `unlock()` is called inside "Enter my sky" and every launch tap.
 * It never throws: if sound is unavailable the fireworks simply stay silent.
 */
export class FireworkAudio {
  private state: SoundState = 'idle';
  private ctx: AudioContextLike | null = null;
  private graph: SfxGraph | null = null;
  private unsupported = false;
  private hiddenSuspended = false;
  private disposed = false;
  private readonly options: FireworkAudioOptions;
  private readonly doc: Document | null;

  constructor(options: FireworkAudioOptions = {}) {
    this.options = options;
    this.doc = options.document === undefined ? (typeof document === 'undefined' ? null : document) : options.document;
    this.doc?.addEventListener('visibilitychange', this.onVisibility);
  }

  getState(): SoundState {
    return this.state;
  }

  /**
   * Starts the audio context. Call it directly inside a tap or key press:
   * resume() runs synchronously within that gesture. Safe to call often.
   */
  unlock(): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const ctx = this.ensureContext();
    if (!ctx || !this.ensureGraph()) return Promise.resolve();
    if (ctx.state === 'running') {
      this.state = 'ready';
      return Promise.resolve();
    }
    return this.resume(ctx);
  }

  play(kind: SoundKind, options: SoundOptions): void {
    if (this.state !== 'ready' || !this.graph || this.ctx?.state !== 'running') return;
    try {
      this.graph.play(kind, options);
    } catch {
      // A failed sound must never interrupt the fireworks.
    }
  }

  dispose(): void {
    this.disposed = true;
    this.doc?.removeEventListener('visibilitychange', this.onVisibility);
    this.graph?.dispose();
    this.graph = null;
    if (this.ctx) {
      this.ctx.removeEventListener('statechange', this.onStateChange);
      void this.ctx.close?.().catch(() => undefined);
    }
    this.ctx = null;
  }

  private ensureContext(): AudioContextLike | null {
    if (this.ctx) return this.ctx;
    if (this.unsupported) return null;
    let ctx: AudioContextLike | null = null;
    try {
      ctx = (this.options.createContext ?? defaultContext)();
    } catch {
      ctx = null;
    }
    if (!ctx) {
      this.unsupported = true;
      this.state = 'unavailable';
      return null;
    }
    ctx.addEventListener('statechange', this.onStateChange);
    this.ctx = ctx;
    return ctx;
  }

  private ensureGraph(): SfxGraph | null {
    if (this.graph || !this.ctx) return this.graph;
    try {
      const create = this.options.createGraph ?? ((ctx: AudioContextLike) => createSfxGraph(ctx as unknown as AudioContext));
      this.graph = create(this.ctx);
    } catch {
      this.graph = null;
      this.unsupported = true;
      this.state = 'unavailable';
    }
    return this.graph;
  }

  private async resume(ctx: AudioContextLike): Promise<void> {
    let attempt: Promise<void>;
    try {
      attempt = ctx.resume();
    } catch {
      this.state = 'blocked';
      return;
    }
    await settleWithin(attempt, this.options.resumeTimeoutMs ?? 1200);
    this.sync();
  }

  private sync(): void {
    if (!this.ctx || this.unsupported) return;
    if (this.ctx.state === 'running') this.state = 'ready';
    else if (!this.hiddenSuspended) this.state = 'blocked';
  }

  private readonly onStateChange = (): void => {
    this.sync();
  };

  private readonly onVisibility = (): void => {
    const ctx = this.ctx;
    if (!ctx || !this.doc || this.disposed) return;
    if (this.doc.visibilityState === 'hidden') {
      if (ctx.state === 'running') {
        this.hiddenSuspended = true;
        ctx.suspend().catch(() => undefined);
      }
      return;
    }
    if (!this.hiddenSuspended) return;
    this.hiddenSuspended = false;
    void this.resume(ctx);
  };
}
