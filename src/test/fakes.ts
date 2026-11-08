import type { AudioContextLike } from '../audio/FireworkAudio';
import type { SfxGraph, SoundKind, SoundOptions } from '../audio/sfx';
import { FireworkLifecycle, PHASES, type Phase } from '../engine/lifecycle';
import type { EngineEvent, EngineListener, LaunchRequest, SceneId, SkyEngineApi } from '../engine/types';

/** How the fake AudioContext answers resume(). */
export type ResumeBehavior = 'run' | 'stay-suspended' | 'reject' | 'hang';

export class FakeAudioContext implements AudioContextLike {
  state = 'suspended';
  currentTime = 0;
  resumeBehavior: ResumeBehavior;
  resumeCalls = 0;
  suspendCalls = 0;
  private readonly listeners = new Set<() => void>();

  constructor(resumeBehavior: ResumeBehavior = 'run', initialState = 'suspended') {
    this.resumeBehavior = resumeBehavior;
    this.state = initialState;
  }

  resume(): Promise<void> {
    this.resumeCalls += 1;
    switch (this.resumeBehavior) {
      case 'run':
        this.setState('running');
        return Promise.resolve();
      case 'stay-suspended':
        return Promise.resolve();
      case 'reject':
        return Promise.reject(new DOMException('Playback was not allowed', 'NotAllowedError'));
      case 'hang':
        return new Promise<void>(() => undefined);
    }
  }

  suspend(): Promise<void> {
    this.suspendCalls += 1;
    this.setState('suspended');
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.setState('closed');
    return Promise.resolve();
  }

  setState(state: string): void {
    if (state === this.state) return;
    this.state = state;
    for (const listener of [...this.listeners]) listener();
  }

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.delete(listener);
  }
}

export class FakeSfxGraph implements SfxGraph {
  played: Array<{ kind: SoundKind; options: SoundOptions }> = [];
  disposed = false;
  throwOnPlay = false;

  play(kind: SoundKind, options: SoundOptions): void {
    if (this.throwOnPlay) throw new Error('boom');
    this.played.push({ kind, options });
  }

  dispose(): void {
    this.disposed = true;
  }
}

/** A minimal document for visibility tests. */
export class FakeVisibilityDocument {
  visibilityState: DocumentVisibilityState = 'visible';
  private readonly listeners = new Map<string, Set<EventListener>>();

  addEventListener(type: string, listener: EventListener): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: EventListener): void {
    this.listeners.get(type)?.delete(listener);
  }

  setVisibility(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    for (const listener of [...(this.listeners.get('visibilitychange') ?? [])]) listener(new Event('visibilitychange'));
  }

  asDocument(): Document {
    return this as unknown as Document;
  }
}

/**
 * A stand-in for the canvas engine. It records what the UI asks for and lets
 * tests drive each firework's lifecycle and the end of the show.
 */
export class FakeEngine implements SkyEngineApi {
  scenes: SceneId[] = [];
  reducedMotion: boolean[] = [];
  launches: LaunchRequest[] = [];
  destroyed = false;
  accept = true;
  private readonly listeners = new Set<EngineListener>();
  private readonly lifecycles = new Map<string, { id: number; lifecycle: FireworkLifecycle }>();
  private nextId = 1;

  setScene(scene: SceneId): void {
    this.scenes.push(scene);
  }

  setReducedMotion(reduced: boolean): void {
    this.reducedMotion.push(reduced);
  }

  launch(request: LaunchRequest): boolean {
    if (!this.accept) return false;
    this.launches.push(request);
    const entry = { id: this.nextId++, lifecycle: new FireworkLifecycle() };
    this.lifecycles.set(request.key, entry);
    for (const phase of entry.lifecycle.select()) this.emitPhase(request.key, entry.id, phase);
    return true;
  }

  /** Runs a launched firework through every remaining phase. */
  completeFlight(key: string): void {
    const entry = this.lifecycles.get(key);
    if (!entry) throw new Error(`No firework for ${key}`);
    for (const phase of entry.lifecycle.finish()) this.emitPhase(key, entry.id, phase);
  }

  /** Advances a firework up to (and including) the given phase. */
  advanceTo(key: string, target: Phase): void {
    const entry = this.lifecycles.get(key);
    if (!entry) throw new Error(`No firework for ${key}`);
    while (PHASES.indexOf(entry.lifecycle.phase) < PHASES.indexOf(target)) {
      const entered = entry.lifecycle.advance(entry.lifecycle.duration + 1e-6);
      for (const phase of entered) this.emitPhase(key, entry.id, phase);
    }
  }

  /** A show shell bursting (ambient). */
  showBurst(): void {
    this.emit({
      type: 'phase',
      id: this.nextId++,
      key: null,
      phase: 'EXPLOSION',
      ambient: true,
      pan: 0,
      size: 1,
      launchSeconds: 1.3,
      crackle: false,
    });
  }

  endShow(): void {
    this.emit({ type: 'show-end' });
  }

  on(listener: EngineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  destroy(): void {
    this.destroyed = true;
  }

  private emitPhase(key: string, id: number, phase: Phase): void {
    this.emit({
      type: 'phase',
      id,
      key,
      phase,
      ambient: false,
      pan: 0,
      size: 1,
      launchSeconds: 1.4,
      crackle: false,
    });
  }

  private emit(event: EngineEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}
