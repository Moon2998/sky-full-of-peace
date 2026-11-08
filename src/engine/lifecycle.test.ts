import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMINGS, FireworkLifecycle, PHASES, REDUCED_MOTION_TIMINGS, type Phase } from './lifecycle';

function runToEnd(lifecycle: FireworkLifecycle, step = 1 / 60): { entered: Phase[]; seconds: number } {
  const entered: Phase[] = [];
  let seconds = 0;
  for (let i = 0; i < 10_000 && lifecycle.phase !== 'MESSAGE'; i++) {
    entered.push(...lifecycle.advance(step));
    seconds += step;
  }
  return { entered, seconds };
}

describe('FireworkLifecycle', () => {
  it('declares the phases in the required order', () => {
    expect(PHASES).toEqual(['IDLE', 'SELECTED', 'IGNITION', 'LAUNCH', 'EXPLOSION', 'FADE', 'MESSAGE']);
  });

  it('waits in IDLE until selected', () => {
    const lifecycle = new FireworkLifecycle();
    expect(lifecycle.phase).toBe('IDLE');
    expect(lifecycle.advance(10)).toEqual([]);
    expect(lifecycle.phase).toBe('IDLE');
  });

  it('runs IDLE → SELECTED → IGNITION → LAUNCH → EXPLOSION → FADE → MESSAGE in order', () => {
    const lifecycle = new FireworkLifecycle();
    expect(lifecycle.select()).toEqual(['SELECTED']);
    const { entered, seconds } = runToEnd(lifecycle);
    expect(entered).toEqual(['IGNITION', 'LAUNCH', 'EXPLOSION', 'FADE', 'MESSAGE']);
    const total =
      DEFAULT_TIMINGS.selected +
      DEFAULT_TIMINGS.ignition +
      DEFAULT_TIMINGS.launch +
      DEFAULT_TIMINGS.explosion +
      DEFAULT_TIMINGS.fade;
    expect(seconds).toBeGreaterThanOrEqual(total - 1e-6);
    expect(seconds).toBeLessThan(total + 2 / 60);
  });

  it('reports every phase crossed by one large time step, in order', () => {
    const lifecycle = new FireworkLifecycle();
    lifecycle.select();
    expect(lifecycle.advance(100)).toEqual(['IGNITION', 'LAUNCH', 'EXPLOSION', 'FADE', 'MESSAGE']);
  });

  it('passes straight through a zero-length launch under reduced motion', () => {
    const lifecycle = new FireworkLifecycle(REDUCED_MOTION_TIMINGS);
    lifecycle.select();
    lifecycle.advance(REDUCED_MOTION_TIMINGS.selected);
    expect(lifecycle.phase).toBe('IGNITION');
    const entered = lifecycle.advance(REDUCED_MOTION_TIMINGS.ignition);
    expect(entered).toEqual(['LAUNCH', 'EXPLOSION']);
  });

  it('refuses to restart while in flight, and can be lit again after its message', () => {
    const lifecycle = new FireworkLifecycle();
    lifecycle.select();
    lifecycle.advance(0.3);
    expect(lifecycle.inFlight).toBe(true);
    expect(lifecycle.select()).toEqual([]);
    runToEnd(lifecycle);
    expect(lifecycle.inFlight).toBe(false);
    expect(lifecycle.select()).toEqual(['SELECTED']);
    expect(runToEnd(lifecycle).entered).toEqual(['IGNITION', 'LAUNCH', 'EXPLOSION', 'FADE', 'MESSAGE']);
  });

  it('ignores negative or invalid time steps', () => {
    const lifecycle = new FireworkLifecycle();
    lifecycle.select();
    expect(lifecycle.advance(-1)).toEqual([]);
    expect(lifecycle.advance(Number.NaN)).toEqual([]);
    expect(lifecycle.phase).toBe('SELECTED');
  });

  it('can jump straight to MESSAGE, reporting each phase on the way', () => {
    const lifecycle = new FireworkLifecycle();
    expect(lifecycle.finish()).toEqual(['SELECTED', 'IGNITION', 'LAUNCH', 'EXPLOSION', 'FADE', 'MESSAGE']);
    expect(lifecycle.phase).toBe('MESSAGE');
  });

  it('reports progress through the current phase', () => {
    const lifecycle = new FireworkLifecycle();
    lifecycle.select();
    lifecycle.advance(DEFAULT_TIMINGS.selected + DEFAULT_TIMINGS.ignition / 2);
    expect(lifecycle.phase).toBe('IGNITION');
    expect(lifecycle.progress).toBeCloseTo(0.5, 5);
  });
});
