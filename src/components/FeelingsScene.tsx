import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { FireworkAudio } from '../audio/FireworkAudio';
import { COPY } from '../content/copy';
import { FEELINGS, type Feeling } from '../content/feelings';
import { shuffle } from '../content/shuffle';
import type { EngineEvent, SkyEngineApi } from '../engine/types';
import { useEngineEvents } from '../hooks/useEngineEvents';
import { useFocusOnMount } from '../hooks/useFocusOnMount';
import { LaunchShell } from './LaunchShell';

/** How soon the next word rises onto the pad after a launch. */
export const NEXT_SHELL_MS = 550;

interface FeelingsSceneProps {
  engine: SkyEngineApi | null;
  audio: FireworkAudio;
  /** Called once every firework has burst and faded. */
  onAllBurst: () => void;
  /** Injected in tests; a fresh random order otherwise. */
  order?: readonly Feeling[];
}

/**
 * The launch pad holds one firework at a time. A tap sends it up to burst,
 * and moments later the next word takes its place, in a new random order
 * each visit. When the last one has burst, the show begins.
 */
export function FeelingsScene({ engine, audio, onAllBurst, order: given }: FeelingsSceneProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shellRef = useRef<HTMLButtonElement>(null);
  const [order] = useState<readonly Feeling[]>(() => given ?? shuffle(FEELINGS));
  /** How many have left the pad. */
  const [launchedCount, setLaunchedCount] = useState(0);
  /** The current shell has just been tapped and is lifting off. */
  const [liftingOff, setLiftingOff] = useState(false);
  const [burst, setBurst] = useState<ReadonlySet<string>>(() => new Set());
  const [announcement, setAnnouncement] = useState('');
  const nextTimer = useRef<number | null>(null);
  const keepFocus = useRef(false);
  const finished = useRef(false);

  useFocusOnMount(headingRef);

  useEffect(
    () => () => {
      if (nextTimer.current) window.clearTimeout(nextTimer.current);
    },
    [],
  );

  const markBurst = (id: string) => setBurst((current) => (current.has(id) ? current : new Set(current).add(id)));

  useEngineEvents(engine, (event: EngineEvent) => {
    if (event.type !== 'phase' || event.ambient || !event.key) return;
    // MESSAGE is the end of a firework's life: burst, faded, done.
    if (event.phase === 'MESSAGE') markBurst(event.key);
  });

  const current = order[launchedCount];

  const launch = (feeling: Feeling, button: HTMLButtonElement) => {
    // Sound may only start inside a tap, so every launch tap unlocks it.
    void audio.unlock();
    if (liftingOff || feeling !== current) return;

    if (engine) {
      const orb = button.querySelector('.shell__orb') ?? button;
      const rect = orb.getBoundingClientRect();
      const accepted = engine.launch({
        key: feeling.id,
        originX: rect.left + rect.width / 2,
        originY: rect.top + rect.height / 2,
        pattern: feeling.pattern,
        palette: feeling.palette,
      });
      if (!accepted) return;
    } else {
      // No canvas: nothing to watch, so it counts as burst straight away.
      markBurst(feeling.id);
    }

    keepFocus.current = document.activeElement === button;
    setLiftingOff(true);
    const left = order.length - launchedCount - 1;
    setAnnouncement(`${feeling.label}, ${COPY.feelings.launched}. ${left > 0 ? `${left} left.` : ''}`.trim());
    nextTimer.current = window.setTimeout(() => {
      nextTimer.current = null;
      setLiftingOff(false);
      setLaunchedCount((count) => count + 1);
    }, NEXT_SHELL_MS);
  };

  // Keyboard users stay on the pad: focus follows the next word.
  useEffect(() => {
    if (!keepFocus.current || liftingOff) return;
    keepFocus.current = false;
    (shellRef.current ?? headingRef.current)?.focus({ preventScroll: true });
  }, [launchedCount, liftingOff]);

  useEffect(() => {
    if (finished.current || burst.size < order.length) return;
    finished.current = true;
    onAllBurst();
  }, [burst, order.length, onAllBurst]);

  const started = launchedCount > 0 || liftingOff;
  const empty = !current;

  return (
    <section
      className="scene scene--feelings"
      aria-labelledby="feelings-title"
      data-started={started ? '' : undefined}
      data-empty={empty ? '' : undefined}
    >
      <header className="feelings__header">
        <h1 id="feelings-title" ref={headingRef} tabIndex={-1} className="scene-title reveal">
          {COPY.feelings.title}
        </h1>
        <p className="feelings__hint reveal" style={{ '--d': '0.25s' } as CSSProperties}>
          {COPY.feelings.hint}
        </p>
      </header>

      <div className="launchpad">
        <div className="launchpad__ground" aria-hidden="true" />
        <div className="launchpad__slot reveal" style={{ '--d': '0.5s' } as CSSProperties}>
          {current ? (
            <LaunchShell
              key={current.id}
              feeling={current}
              launched={liftingOff}
              onLaunch={launch}
              ref={shellRef}
            />
          ) : null}
        </div>
        <ol className="launchpad__progress" aria-hidden="true">
          {order.map((feeling, index) => (
            <li key={feeling.id} data-done={index < launchedCount + (liftingOff ? 1 : 0) ? '' : undefined} />
          ))}
        </ol>
      </div>

      <p className="visually-hidden" role="status">
        {announcement}
      </p>
    </section>
  );
}
