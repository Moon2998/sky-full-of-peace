import { describe, expect, it } from 'vitest';
import { FINALE_TIMELINE } from './ambience';
import { seededRng } from './random';
import { SHOW, SHOW_END } from './show';
import { SkySimulation } from './simulation';
import type { EngineEvent, FireworkPhaseEvent, LaunchRequest } from './types';

const FRAME = 1 / 60;

function setup(overrides: { capacity?: number; reducedMotion?: boolean; width?: number; height?: number } = {}) {
  const sim = new SkySimulation({
    width: overrides.width ?? 400,
    height: overrides.height ?? 800,
    reducedMotion: overrides.reducedMotion ?? false,
    capacity: overrides.capacity ?? 6000,
    rng: seededRng(2026),
  });
  const events: EngineEvent[] = [];
  sim.on((event) => events.push(event));
  sim.setScene('feelings');
  return { sim, events };
}

/** A shell sitting on the launch pad near the bottom of the screen. */
const request = (key: string, overrides: Partial<LaunchRequest> = {}): LaunchRequest => ({
  key,
  originX: 120,
  originY: 720,
  pattern: 'peony',
  palette: 'lagoon',
  ...overrides,
});

function run(sim: SkySimulation, seconds: number, onFrame?: () => void) {
  for (let t = 0; t < seconds; t += FRAME) {
    sim.update(FRAME);
    onFrame?.();
  }
}

const phaseEvents = (events: EngineEvent[]) => events.filter((e): e is FireworkPhaseEvent => e.type === 'phase');
const phasesFor = (events: EngineEvent[], key: string) =>
  phaseEvents(events)
    .filter((e) => e.key === key)
    .map((e) => e.phase);

const ALL_PHASES = ['SELECTED', 'IGNITION', 'LAUNCH', 'EXPLOSION', 'FADE', 'MESSAGE'];

describe('fireworks from the launch pad', () => {
  it('reports each lifecycle phase once, in order, then lets the firework go', () => {
    const { sim, events } = setup();
    expect(sim.launch(request('worries'))).toBe(true);
    expect(phasesFor(events, 'worries')).toEqual(['SELECTED']);
    run(sim, 5);
    expect(phasesFor(events, 'worries')).toEqual(ALL_PHASES);
    expect(sim.fireworks).toHaveLength(0);
  });

  it('rises from the shell that was tapped and bursts high in the sky', () => {
    const { sim } = setup();
    sim.launch(request('fear', { originX: 300, originY: 740 }));
    const firework = sim.fireworks[0]!;
    expect(firework.startX).toBe(300);
    expect(firework.startY).toBe(740);
    expect(firework.targetY).toBeLessThan(sim.height * 0.5);
    // Massive, but the top of the burst stays near the top of the screen.
    expect(firework.targetY).toBeGreaterThanOrEqual(sim.burstRadius(firework.size) * 0.68);
    run(sim, 0.16 + firework.lifecycle.timings.launch * 0.5);
    expect(firework.lifecycle.phase).toBe('LAUNCH');
    expect(firework.y).toBeLessThan(firework.startY);
    expect(firework.y).toBeGreaterThan(firework.targetY);
  });

  it('bursts big: hundreds of stars reaching far across the sky', () => {
    const { sim } = setup();
    sim.launch(request('heavy-days'));
    const { targetX } = sim.fireworks[0]!;
    let countAtBurst = 0;
    sim.on((e) => {
      if (e.type === 'phase' && e.phase === 'EXPLOSION') countAtBurst = sim.pool.count;
    });
    run(sim, 2.8);
    expect(countAtBurst).toBeGreaterThan(300);
    let reach = 0;
    for (let i = 0; i < sim.pool.count; i++) reach = Math.max(reach, Math.abs(sim.pool.x[i]! - targetX));
    // Massive: the stars spread across most of the screen.
    expect(reach).toBeGreaterThan(sim.unit * 0.4);
  });

  it('lets her light all eight at once, and every one bursts', () => {
    const { sim, events } = setup();
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    keys.forEach((key, i) => expect(sim.launch(request(key, { originX: 40 + i * 45 }))).toBe(true));
    expect(sim.chosenInFlight).toBe(8);
    run(sim, 5);
    for (const key of keys) expect(phasesFor(events, key)).toEqual(ALL_PHASES);
  });

  it('refuses a second launch of a firework that is still in the air', () => {
    const { sim } = setup();
    expect(sim.launch(request('worries'))).toBe(true);
    run(sim, 0.4);
    expect(sim.launch(request('worries'))).toBe(false);
  });

  it('only launches from the launch pad scene', () => {
    const { sim } = setup();
    sim.setScene('finale');
    expect(sim.launch(request('worries'))).toBe(false);
    sim.setScene('welcome');
    expect(sim.launch(request('worries'))).toBe(false);
  });

  it('lights up the sky briefly and leaves drifting smoke, both bounded', () => {
    const { sim } = setup();
    for (let i = 0; i < 8; i++) sim.launch(request(`k${i}`));
    let maxFlashes = 0;
    let maxSmoke = 0;
    run(sim, 3, () => {
      maxFlashes = Math.max(maxFlashes, sim.flashes.length);
      maxSmoke = Math.max(maxSmoke, sim.smoke.length);
    });
    expect(maxFlashes).toBeGreaterThan(0);
    expect(maxFlashes).toBeLessThanOrEqual(16);
    expect(maxSmoke).toBeGreaterThan(0);
    expect(maxSmoke).toBeLessThanOrEqual(70);
    run(sim, 12);
    expect(sim.flashes).toHaveLength(0);
    expect(sim.smoke).toHaveLength(0);
  });

  it('keeps live particles within the pool limit under stress, then frees them all', () => {
    const { sim } = setup({ capacity: 500 });
    let peak = 0;
    for (const [i, pattern] of (['willow', 'chrysanthemum', 'palm', 'crossette', 'heart', 'ring', 'starburst', 'peony'] as const).entries()) {
      sim.launch(request(`k${i}`, { pattern }));
    }
    run(sim, 6, () => {
      peak = Math.max(peak, sim.pool.count);
    });
    expect(peak).toBeLessThanOrEqual(500);
    expect(sim.pool.dropped).toBeGreaterThan(0);
    run(sim, 12);
    expect(sim.pool.count).toBe(0);
    expect(sim.fireworks).toHaveLength(0);
  });

  it('sends size, stereo position, climb time and crackle with each event', () => {
    const { sim, events } = setup();
    sim.launch(request('a', { originX: -500, pattern: 'willow' }));
    sim.launch(request('b', { originX: 5000 }));
    run(sim, 4);
    for (const event of phaseEvents(events)) {
      expect(event.pan).toBeGreaterThanOrEqual(-1);
      expect(event.pan).toBeLessThanOrEqual(1);
      expect(event.size).toBeGreaterThan(0.5);
      expect(event.launchSeconds).toBeGreaterThan(0.9);
    }
    expect(phaseEvents(events).find((e) => e.key === 'a')?.crackle).toBe(true);
    expect(phaseEvents(events).find((e) => e.key === 'b')?.crackle).toBe(false);
  });

  it('crossette stars split into four part-way through their life', () => {
    const { sim } = setup();
    sim.launch(request('broken-trust', { pattern: 'crossette' }));
    let atBurst = 0;
    let most = 0;
    sim.on((e) => {
      if (e.type === 'phase' && e.phase === 'EXPLOSION') atBurst = sim.pool.count;
    });
    run(sim, 3.5, () => {
      if (atBurst) most = Math.max(most, sim.pool.count);
    });
    expect(atBurst).toBeGreaterThan(0);
    expect(most).toBeGreaterThan(atBurst * 1.8);
  });
});

describe('reduced motion', () => {
  it('blooms in place without a rising rocket, with slower stars', () => {
    const calm = setup({ reducedMotion: true });
    const lively = setup();
    for (const { sim } of [calm, lively]) sim.launch(request('worries'));

    let launchTime = -1;
    let burstTime = -2;
    calm.sim.on((e) => {
      if (e.type !== 'phase') return;
      if (e.phase === 'LAUNCH') launchTime = calm.sim.time;
      if (e.phase === 'EXPLOSION') burstTime = calm.sim.time;
    });
    const fastest = (sim: SkySimulation) => {
      let max = 0;
      for (let i = 0; i < sim.pool.count; i++) max = Math.max(max, Math.hypot(sim.pool.vx[i]!, sim.pool.vy[i]!));
      return max;
    };
    let calmMax = 0;
    let livelyMax = 0;
    for (let t = 0; t < 3.5; t += FRAME) {
      calm.sim.update(FRAME);
      lively.sim.update(FRAME);
      if (burstTime > 0) calmMax = Math.max(calmMax, fastest(calm.sim));
      livelyMax = Math.max(livelyMax, fastest(lively.sim));
    }
    expect(burstTime).toBe(launchTime);
    expect(calmMax).toBeLessThan(livelyMax * 0.5);
  });

  it('plays a shorter show with the same ending', () => {
    const calm = setup({ reducedMotion: true });
    calm.sim.setScene('show');
    run(calm.sim, SHOW_END + 0.2);
    const bursts = phaseEvents(calm.events).filter((e) => e.phase === 'EXPLOSION').length;
    expect(bursts).toBe(Math.ceil(SHOW.length / 2));
    expect(calm.events.some((e) => e.type === 'show-end')).toBe(true);
  });
});

describe('the closing show', () => {
  it('fires every shell in the programme, then announces its end once', () => {
    const { sim, events } = setup();
    sim.setScene('show');
    run(sim, SHOW_END - 0.5);
    expect(events.some((e) => e.type === 'show-end')).toBe(false);
    run(sim, 1.5);
    const bursts = phaseEvents(events).filter((e) => e.ambient && e.phase === 'EXPLOSION');
    expect(bursts).toHaveLength(SHOW.length);
    expect(events.filter((e) => e.type === 'show-end')).toHaveLength(1);
    run(sim, 5);
    expect(events.filter((e) => e.type === 'show-end')).toHaveLength(1);
  });

  it('uses every burst shape and many colours', () => {
    expect(new Set(SHOW.map((s) => s.pattern)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(SHOW.map((s) => s.palette)).size).toBeGreaterThanOrEqual(10);
    expect(SHOW.every((s, i) => i === 0 || s.at >= SHOW[i - 1]!.at)).toBe(true);
  });

  it('never fills the pool past its limit, even in the barrage', () => {
    const { sim } = setup({ capacity: 3000 });
    sim.setScene('show');
    let peak = 0;
    run(sim, SHOW_END, () => {
      peak = Math.max(peak, sim.pool.count);
    });
    expect(peak).toBeLessThanOrEqual(3000);
  });

  it('stops when the scene changes', () => {
    const { sim, events } = setup();
    sim.setScene('show');
    run(sim, 2);
    sim.setScene('finale');
    const before = phaseEvents(events).filter((e) => e.phase === 'LAUNCH').length;
    run(sim, 10);
    expect(phaseEvents(events).filter((e) => e.phase === 'LAUNCH').length).toBe(before);
    expect(events.some((e) => e.type === 'show-end')).toBe(false);
  });
});

describe('the wish', () => {
  it('brightens the stars and brings in golden lights, letting the last sparks fall', () => {
    const { sim } = setup();
    sim.setScene('show');
    run(sim, 4);
    const starsDuringShow = sim.ambience.starIntensity;
    sim.setScene('finale');
    expect(sim.launch(request('y'))).toBe(false);
    run(sim, FINALE_TIMELINE.lightsStart - 0.2);
    expect(sim.ambience.lightsAlpha).toBeLessThan(0.02);
    run(sim, 6);
    expect(sim.ambience.starIntensity).toBeGreaterThan(starsDuringShow);
    expect(sim.ambience.lightsAlpha).toBeGreaterThan(0.8);
    run(sim, 10);
    expect(sim.pool.count).toBe(0);
  });

  it('keeps golden lights still with reduced motion', () => {
    const { sim } = setup({ reducedMotion: true });
    sim.setScene('finale');
    run(sim, 3);
    const lights = sim.ambience.lights.map((m) => [m.x, m.y]);
    run(sim, 3);
    expect(sim.ambience.lights.map((m) => [m.x, m.y])).toEqual(lights);
    expect(sim.ambience.driftFar).toBe(0);
  });
});
