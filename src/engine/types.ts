import type { Phase } from './lifecycle';
import type { PaletteId } from './palettes';
import type { PatternId } from './patterns';

/**
 * welcome  – the opening words
 * feelings – the launch pad: she lights each feeling
 * show     – the closing firework show
 * finale   – the calm sky and the wish
 */
export type SceneId = 'welcome' | 'feelings' | 'show' | 'finale';

export interface LaunchRequest {
  /** Identifies what was lit (a feeling id). Echoed back on every event. */
  readonly key: string;
  /** Where the shell sits on the launch pad, in viewport CSS px. */
  readonly originX: number;
  readonly originY: number;
  readonly pattern: PatternId;
  readonly palette: PaletteId;
}

export interface FireworkPhaseEvent {
  readonly type: 'phase';
  readonly id: number;
  /** The request key, or null for show shells. */
  readonly key: string | null;
  readonly phase: Phase;
  /** Shells the engine fires on its own (the show). */
  readonly ambient: boolean;
  /** Stereo position, -1 (left) to 1 (right). */
  readonly pan: number;
  /** Relative shell size, about 0.8 to 1.4. */
  readonly size: number;
  /** How long the climb lasts, seconds (0 when it blooms in place). */
  readonly launchSeconds: number;
  /** True for shells whose stars crackle and glitter. */
  readonly crackle: boolean;
}

export interface ShowEndEvent {
  readonly type: 'show-end';
}

export type EngineEvent = FireworkPhaseEvent | ShowEndEvent;
export type EngineListener = (event: EngineEvent) => void;

/** What the React layer is allowed to do with the sky. */
export interface SkyEngineApi {
  setScene(scene: SceneId): void;
  setReducedMotion(reduced: boolean): void;
  /** Fires a shell from the launch pad. Returns false if it was refused. */
  launch(request: LaunchRequest): boolean;
  on(listener: EngineListener): () => void;
  destroy(): void;
}
