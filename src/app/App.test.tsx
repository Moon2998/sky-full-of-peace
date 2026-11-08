import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FireworkAudio } from '../audio/FireworkAudio';
import { NEXT_SHELL_MS } from '../components/FeelingsScene';
import { COPY } from '../content/copy';
import { FEELINGS } from '../content/feelings';
import { FakeAudioContext, FakeEngine, FakeSfxGraph, type ResumeBehavior } from '../test/fakes';
import { setReducedMotion } from '../test/matchMedia';
import { App, SCENE_EXIT_MS } from './App';

interface Options {
  behavior?: ResumeBehavior;
  withCanvas?: boolean;
}

function renderApp({ behavior = 'run', withCanvas = true }: Options = {}) {
  const ctx = new FakeAudioContext(behavior);
  const graphs: FakeSfxGraph[] = [];
  const audio = new FireworkAudio({
    createContext: () => ctx,
    createGraph: () => {
      const graph = new FakeSfxGraph();
      graphs.push(graph);
      return graph;
    },
    document: null,
    resumeTimeoutMs: 20,
  });
  const engine = new FakeEngine();
  const createEngine = vi.fn(() => (withCanvas ? engine : null));
  const view = render(<App audio={audio} createEngine={createEngine} />);
  return { ...view, audio, ctx, graphs, engine };
}

const wait = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

async function enterSky() {
  fireEvent.click(screen.getByRole('button', { name: COPY.welcome.enter }));
  await wait(SCENE_EXIT_MS.normal + 20);
}

const pad = () => document.querySelector('.launchpad') as HTMLElement;
/** The one firework currently waiting on the pad, if any. */
const currentShell = () => within(pad()).queryByRole('button');
const feelingOf = (button: HTMLElement) => FEELINGS.find((f) => f.label === button.textContent)!;

/** Taps every word as it appears; returns them in the order they came. */
async function launchAll(): Promise<string[]> {
  const seen: string[] = [];
  for (let i = 0; i < FEELINGS.length; i++) {
    const shell = currentShell()!;
    seen.push(shell.textContent!);
    fireEvent.click(shell);
    await wait(NEXT_SHELL_MS + 10);
  }
  return seen;
}

function burstAll(engine: FakeEngine) {
  for (const feeling of FEELINGS) act(() => engine.completeFlight(feeling.id));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Welcome', () => {
  it('opens on the welcome words and "Enter my sky"', () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1, name: COPY.welcome.title })).toBeInTheDocument();
    for (const line of COPY.welcome.lede) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: COPY.welcome.enter })).toBeInTheDocument();
  });

  it('has no music, sound or pause buttons', () => {
    renderApp();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /sound|music|pause|animation/i })).toBeNull();
  });

  it('unlocks firework sound inside the "Enter my sky" tap', async () => {
    const { ctx, audio } = renderApp();
    fireEvent.click(screen.getByRole('button', { name: COPY.welcome.enter }));
    expect(ctx.resumeCalls).toBe(1); // synchronously, within the tap
    await wait(SCENE_EXIT_MS.normal + 20);
    expect(audio.getState()).toBe('ready');
    expect(screen.getByRole('heading', { level: 1, name: COPY.feelings.title })).toHaveFocus();
  });
});

describe('The launch pad', () => {
  it('holds a single firework at a time', async () => {
    renderApp();
    await enterSky();
    const buttons = within(pad()).getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(FEELINGS.map((f) => f.label)).toContain(buttons[0]!.textContent);
    expect(buttons[0]).toHaveAttribute('data-state', 'ready');
    expect(pad().querySelectorAll('.launchpad__progress li')).toHaveLength(FEELINGS.length);
  });

  it('launches the word she taps, and the next word appears moments later', async () => {
    const { engine } = renderApp();
    await enterSky();
    const first = currentShell()!;
    const feeling = feelingOf(first);

    fireEvent.click(first);
    expect(engine.launches).toEqual([
      expect.objectContaining({ key: feeling.id, pattern: feeling.pattern, palette: feeling.palette }),
    ]);
    expect(first).toHaveAttribute('data-state', 'launched');
    expect(first).toBeDisabled();

    // A second tap while it lifts off does nothing.
    fireEvent.click(first);
    expect(engine.launches).toHaveLength(1);

    await wait(NEXT_SHELL_MS + 10);
    const next = currentShell()!;
    expect(next.textContent).not.toBe(first.textContent);
    expect(next).toHaveAttribute('data-state', 'ready');
    expect(pad().querySelectorAll('.launchpad__progress li[data-done]')).toHaveLength(1);
  });

  it('brings every feeling once, in a shuffled order', async () => {
    const { engine } = renderApp();
    await enterSky();
    const seen = await launchAll();
    expect([...seen].sort()).toEqual(FEELINGS.map((f) => f.label).sort());
    expect(engine.launches.map((l) => l.key)).toEqual(seen.map((label) => FEELINGS.find((f) => f.label === label)!.id));
    expect(currentShell()).toBeNull();
  });

  it('lets several fireworks be in the sky together', async () => {
    const { engine } = renderApp();
    await enterSky();
    for (let i = 0; i < 3; i++) {
      fireEvent.click(currentShell()!);
      await wait(NEXT_SHELL_MS + 10);
    }
    expect(engine.launches).toHaveLength(3);
    expect(currentShell()).toHaveAttribute('data-state', 'ready');
  });

  it('shows no message after a burst', async () => {
    const { engine } = renderApp();
    await enterSky();
    const feeling = feelingOf(currentShell()!);
    fireEvent.click(currentShell()!);
    act(() => engine.completeFlight(feeling.id));
    expect(screen.queryByRole('button', { name: /return/i })).toBeNull();
    expect(document.querySelector('.feeling-message')).toBeNull();
  });

  it('plays the launch and blast sounds as each firework flies', async () => {
    const { engine, graphs } = renderApp();
    await enterSky();
    const feeling = feelingOf(currentShell()!);
    fireEvent.click(currentShell()!);
    act(() => engine.advanceTo(feeling.id, 'EXPLOSION'));
    expect(graphs[0]!.played.map((p) => p.kind)).toEqual(['launch', 'burst']);
  });

  it('moves keyboard focus to the next word after a launch', async () => {
    renderApp();
    await enterSky();
    const first = currentShell()!;
    first.focus();
    fireEvent.click(first);
    await wait(NEXT_SHELL_MS + 10);
    expect(currentShell()).toHaveFocus();
    expect(screen.getByRole('status')).toHaveTextContent(COPY.feelings.launched);
  });
});

describe('The show and the wish', () => {
  it('starts the show only once every feeling has burst', async () => {
    const { engine } = renderApp();
    await enterSky();
    await launchAll();
    for (const feeling of FEELINGS.slice(0, 7)) act(() => engine.completeFlight(feeling.id));
    await wait(0);
    expect(engine.scenes.at(-1)).toBe('feelings');

    act(() => engine.completeFlight(FEELINGS[7]!.id));
    await wait(0);
    expect(engine.scenes.at(-1)).toBe('show');
    expect(screen.getByRole('heading', { level: 1, name: COPY.show.title })).toBeInTheDocument();
  });

  it('ends the show with the wish', async () => {
    const { engine, graphs } = renderApp();
    await enterSky();
    await launchAll();
    burstAll(engine);
    await wait(0);
    act(() => engine.showBurst());
    expect(graphs[0]!.played.at(-1)?.kind).toBe('burst');

    act(() => engine.endShow());
    await wait(SCENE_EXIT_MS.normal + 20);
    expect(engine.scenes.at(-1)).toBe('finale');
    expect(screen.getByRole('heading', { level: 1, name: COPY.finale.title })).toHaveFocus();
    for (const line of COPY.finale.wish) expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByText(COPY.finale.closing)).toBeInTheDocument();
    expect(screen.getByText(COPY.finale.footer)).toBeInTheDocument();
  });

  it('can light the sky again with a fresh launch pad', async () => {
    const { engine } = renderApp();
    await enterSky();
    await launchAll();
    burstAll(engine);
    await wait(0);
    act(() => engine.endShow());
    await wait(SCENE_EXIT_MS.normal + 20);

    fireEvent.click(screen.getByRole('button', { name: COPY.finale.again }));
    await wait(SCENE_EXIT_MS.normal + 20);
    expect(currentShell()).toHaveAttribute('data-state', 'ready');
    expect(pad().querySelectorAll('.launchpad__progress li[data-done]')).toHaveLength(0);
  });

  it('goes straight to the wish when no canvas is available', async () => {
    renderApp({ withCanvas: false });
    await enterSky();
    await launchAll();
    await wait(SCENE_EXIT_MS.normal + 20);
    expect(screen.getByRole('heading', { level: 1, name: COPY.finale.title })).toBeInTheDocument();
  });

  it('asks nothing of her: no links, forms or reply fields anywhere', async () => {
    const { container, engine } = renderApp();
    const check = () => expect(container.querySelectorAll('a, form, input, textarea, select')).toHaveLength(0);
    check();
    await enterSky();
    check();
    await launchAll();
    burstAll(engine);
    await wait(0);
    check();
    act(() => engine.endShow());
    await wait(SCENE_EXIT_MS.normal + 20);
    check();
  });
});

describe('Accessibility and robustness', () => {
  it('passes reduced motion to the engine and shortens transitions', async () => {
    setReducedMotion(true);
    const { engine } = renderApp();
    expect(engine.reducedMotion).toContain(true);
    fireEvent.click(screen.getByRole('button', { name: COPY.welcome.enter }));
    await wait(SCENE_EXIT_MS.reduced + 20);
    expect(screen.getByRole('heading', { level: 1, name: COPY.feelings.title })).toBeInTheDocument();
  });

  it('reacts when reduced motion is switched on mid-visit', () => {
    const { engine } = renderApp();
    expect(engine.reducedMotion.at(-1)).toBe(false);
    act(() => setReducedMotion(true));
    expect(engine.reducedMotion.at(-1)).toBe(true);
  });

  it('works silently when sound is blocked', async () => {
    const { audio, engine } = renderApp({ behavior: 'stay-suspended' });
    await enterSky();
    fireEvent.click(currentShell()!);
    expect(engine.launches).toHaveLength(1);
    expect(audio.getState()).toBe('blocked');
  });

  it('keeps the canvas hidden from assistive technology', () => {
    const { container } = renderApp();
    const sky = container.querySelector('.sky');
    expect(sky).toHaveAttribute('aria-hidden', 'true');
    expect(sky?.querySelectorAll('canvas')).toHaveLength(2);
  });

  it('cleans up the engine when unmounted', () => {
    const { engine, unmount } = renderApp();
    unmount();
    expect(engine.destroyed).toBe(true);
  });
});
