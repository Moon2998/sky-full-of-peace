/**
 * The life of one firework:
 *
 *   IDLE → SELECTED → IGNITION → LAUNCH → EXPLOSION → FADE → MESSAGE
 *
 * Pure and time-driven, so it can be tested without a canvas. The engine
 * advances it every frame with the elapsed time; the UI listens to the
 * transitions it reports.
 */
export const PHASES = ['IDLE', 'SELECTED', 'IGNITION', 'LAUNCH', 'EXPLOSION', 'FADE', 'MESSAGE'] as const;
export type Phase = (typeof PHASES)[number];

/** Seconds spent in each timed phase. A zero duration is passed straight through. */
export interface PhaseTimings {
  readonly selected: number;
  readonly ignition: number;
  readonly launch: number;
  readonly explosion: number;
  readonly fade: number;
}

/**
 * A tap sends the shell up almost at once: a short ignition puff, then the
 * climb. The engine sets `launch` per firework from how far it has to rise.
 */
export const DEFAULT_TIMINGS: PhaseTimings = {
  selected: 0.04,
  ignition: 0.12,
  launch: 1.45,
  explosion: 0.7,
  fade: 0.9,
};

/** Reduced motion: no rising rocket, the burst simply blooms in place. */
export const REDUCED_MOTION_TIMINGS: PhaseTimings = {
  selected: 0.1,
  ignition: 0.3,
  launch: 0,
  explosion: 0.6,
  fade: 0.8,
};

function durationOf(phase: Phase, timings: PhaseTimings): number {
  switch (phase) {
    case 'SELECTED':
      return timings.selected;
    case 'IGNITION':
      return timings.ignition;
    case 'LAUNCH':
      return timings.launch;
    case 'EXPLOSION':
      return timings.explosion;
    case 'FADE':
      return timings.fade;
    default:
      return Number.POSITIVE_INFINITY; // IDLE and MESSAGE wait.
  }
}

function nextPhase(phase: Phase): Phase {
  const index = PHASES.indexOf(phase);
  return PHASES[Math.min(index + 1, PHASES.length - 1)] ?? 'MESSAGE';
}

export class FireworkLifecycle {
  private current: Phase;
  private elapsed = 0;
  readonly timings: PhaseTimings;

  constructor(timings: PhaseTimings = DEFAULT_TIMINGS, start: Phase = 'IDLE') {
    this.timings = timings;
    this.current = start;
  }

  get phase(): Phase {
    return this.current;
  }

  /** Seconds spent in the current phase. */
  get time(): number {
    return this.elapsed;
  }

  get duration(): number {
    return durationOf(this.current, this.timings);
  }

  /** 0 to 1 through the current timed phase. */
  get progress(): number {
    const d = this.duration;
    if (!Number.isFinite(d)) return 0;
    if (d <= 0) return 1;
    return Math.min(1, this.elapsed / d);
  }

  /** True while the firework is on its way (selected until fully faded). */
  get inFlight(): boolean {
    return this.current !== 'IDLE' && this.current !== 'MESSAGE';
  }

  /**
   * Starts the sequence. Allowed from IDLE, or from MESSAGE to light the same
   * firework again. Returns the phases entered (empty if refused).
   */
  select(): Phase[] {
    if (this.inFlight) return [];
    this.current = 'SELECTED';
    this.elapsed = 0;
    return ['SELECTED'];
  }

  /** Moves time forward. Returns every phase entered, in order. */
  advance(dt: number): Phase[] {
    const entered: Phase[] = [];
    if (!this.inFlight || !(dt >= 0)) return entered;
    this.elapsed += dt;
    // Loop: a large step (or zero-length phase) can cross several phases.
    for (let guard = 0; guard < PHASES.length; guard++) {
      const d = durationOf(this.current, this.timings);
      if (!Number.isFinite(d) || this.elapsed < d) break;
      this.elapsed -= d;
      this.current = nextPhase(this.current);
      entered.push(this.current);
      if (this.current === 'MESSAGE') {
        this.elapsed = 0;
        break;
      }
    }
    return entered;
  }

  /** Jumps straight to MESSAGE, reporting every phase passed on the way. */
  finish(): Phase[] {
    const entered: Phase[] = [];
    if (this.current === 'IDLE') entered.push(...this.select());
    while (this.current !== 'MESSAGE') {
      this.current = nextPhase(this.current);
      entered.push(this.current);
    }
    this.elapsed = 0;
    return entered;
  }
}
