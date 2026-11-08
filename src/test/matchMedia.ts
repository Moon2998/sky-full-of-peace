/** A controllable window.matchMedia for jsdom, which does not provide one. */

type Listener = (event: { matches: boolean; media: string }) => void;

let reducedMotion = false;
const lists = new Set<FakeMediaQueryList>();

class FakeMediaQueryList {
  readonly media: string;
  onchange: Listener | null = null;
  private readonly listeners = new Set<Listener>();

  constructor(media: string) {
    this.media = media;
  }

  get matches(): boolean {
    return this.media.includes('prefers-reduced-motion') ? reducedMotion : false;
  }

  addEventListener(_type: 'change', listener: Listener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: Listener): void {
    this.listeners.delete(listener);
  }

  addListener(listener: Listener): void {
    this.listeners.add(listener);
  }

  removeListener(listener: Listener): void {
    this.listeners.delete(listener);
  }

  notify(): void {
    const event = { matches: this.matches, media: this.media };
    for (const listener of [...this.listeners]) listener(event);
    this.onchange?.(event);
  }
}

export function installMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string) => {
      const list = new FakeMediaQueryList(media);
      lists.add(list);
      return list;
    },
  });
}

/** Simulates the visitor switching "reduce motion" on or off in their OS. */
export function setReducedMotion(value: boolean): void {
  reducedMotion = value;
  for (const list of [...lists]) list.notify();
}

export function resetMatchMedia(): void {
  reducedMotion = false;
  lists.clear();
}
