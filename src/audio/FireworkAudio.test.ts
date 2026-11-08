import { afterEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext, FakeSfxGraph, FakeVisibilityDocument, type ResumeBehavior } from '../test/fakes';
import { FireworkAudio } from './FireworkAudio';

function setup(behavior: ResumeBehavior = 'run') {
  const ctx = new FakeAudioContext(behavior);
  const graphs: FakeSfxGraph[] = [];
  const doc = new FakeVisibilityDocument();
  const audio = new FireworkAudio({
    createContext: () => ctx,
    createGraph: () => {
      const graph = new FakeSfxGraph();
      graphs.push(graph);
      return graph;
    },
    document: doc.asDocument(),
    resumeTimeoutMs: 30,
  });
  return { audio, ctx, graphs, doc };
}

const burst = { pan: 0, size: 1 };

afterEach(() => {
  vi.useRealTimers();
});

describe('FireworkAudio', () => {
  it('stays silent until a tap unlocks it', () => {
    const { audio, ctx, graphs } = setup();
    audio.play('burst', burst);
    expect(ctx.resumeCalls).toBe(0);
    expect(graphs).toHaveLength(0);
    expect(audio.getState()).toBe('idle');
  });

  it('calls resume() synchronously inside the tap, then plays', async () => {
    const { audio, ctx, graphs } = setup('run');
    const unlocking = audio.unlock();
    expect(ctx.resumeCalls).toBe(1); // still inside the gesture
    await unlocking;
    expect(audio.getState()).toBe('ready');
    audio.play('launch', { pan: -0.4, size: 1, launchSeconds: 1.4 });
    audio.play('burst', { pan: 0.2, size: 1.2, crackle: true });
    expect(graphs[0]!.played.map((p) => p.kind)).toEqual(['launch', 'burst']);
    expect(graphs[0]!.played[1]!.options).toMatchObject({ pan: 0.2, size: 1.2, crackle: true });
  });

  it('builds the sound graph once, however many taps unlock it', async () => {
    const { audio, graphs } = setup('run');
    for (let i = 0; i < 6; i++) await audio.unlock();
    expect(graphs).toHaveLength(1);
  });

  it('handles a rejected resume() and tries again on the next tap', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { audio, ctx, graphs } = setup('reject');
    await audio.unlock();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
    expect(audio.getState()).toBe('blocked');
    audio.play('burst', burst);
    expect(graphs[0]!.played).toHaveLength(0);

    ctx.resumeBehavior = 'run';
    await audio.unlock();
    expect(audio.getState()).toBe('ready');
  });

  it('gives up waiting on a resume() that never settles', async () => {
    const { audio } = setup('hang');
    const started = Date.now();
    await audio.unlock();
    expect(Date.now() - started).toBeLessThan(1000);
    expect(audio.getState()).toBe('blocked');
  });

  it('stays silent when the browser keeps sound suspended', async () => {
    const { audio, graphs } = setup('stay-suspended');
    await audio.unlock();
    audio.play('burst', burst);
    expect(audio.getState()).toBe('blocked');
    expect(graphs[0]!.played).toHaveLength(0);
  });

  it('continues silently without Web Audio', async () => {
    const audio = new FireworkAudio({ createContext: () => null, document: null });
    await expect(audio.unlock()).resolves.toBeUndefined();
    expect(() => audio.play('burst', burst)).not.toThrow();
    expect(audio.getState()).toBe('unavailable');
  });

  it('continues silently when creating the AudioContext throws', async () => {
    const audio = new FireworkAudio({
      createContext: () => {
        throw new Error('blocked');
      },
      document: null,
    });
    await audio.unlock();
    expect(audio.getState()).toBe('unavailable');
  });

  it('never lets a failing sound interrupt the fireworks', async () => {
    const { audio, graphs } = setup('run');
    await audio.unlock();
    graphs[0]!.throwOnPlay = true;
    expect(() => audio.play('burst', burst)).not.toThrow();
  });

  it('pauses while the tab is hidden and resumes when visible', async () => {
    vi.useFakeTimers();
    const { audio, ctx, doc } = setup('run');
    await audio.unlock();
    doc.setVisibility('hidden');
    expect(ctx.state).toBe('suspended');
    doc.setVisibility('visible');
    await vi.advanceTimersByTimeAsync(10);
    expect(ctx.state).toBe('running');
    expect(audio.getState()).toBe('ready');
  });
});
