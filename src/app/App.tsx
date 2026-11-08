import { useCallback, useEffect, useRef, useState } from 'react';
import type { FireworkAudio } from '../audio/FireworkAudio';
import { FeelingsScene } from '../components/FeelingsScene';
import { FinaleScene } from '../components/FinaleScene';
import { ShowScene } from '../components/ShowScene';
import { createSkyEngine, SkyCanvas, type EngineFactory } from '../components/SkyCanvas';
import { WelcomeScene } from '../components/WelcomeScene';
import type { EngineEvent, SceneId, SkyEngineApi } from '../engine/types';
import { useEngineEvents } from '../hooks/useEngineEvents';
import { useReducedMotion } from '../hooks/useReducedMotion';

/** How long a scene takes to fade out before the next one appears. */
export const SCENE_EXIT_MS = { normal: 750, reduced: 250 } as const;

export interface AppProps {
  audio: FireworkAudio;
  /** Injected in tests; defaults to the real canvas engine. */
  createEngine?: EngineFactory;
}

/**
 * Welcome → launch pad → closing show → the wish.
 * Connects the scenes to the sky engine and to the firework sounds.
 */
export function App({ audio, createEngine = createSkyEngine }: AppProps) {
  const reducedMotion = useReducedMotion();
  const [scene, setScene] = useState<SceneId>('welcome');
  const [leaving, setLeaving] = useState(false);
  const [engine, setEngine] = useState<SkyEngineApi | null>(null);
  /** Changes each time the launch pad is set up again, so it starts fresh. */
  const [round, setRound] = useState(0);
  const transition = useRef<number | null>(null);

  useEffect(() => engine?.setScene(scene), [engine, scene]);
  useEffect(() => engine?.setReducedMotion(reducedMotion), [engine, reducedMotion]);
  useEffect(
    () => () => {
      if (transition.current) window.clearTimeout(transition.current);
    },
    [],
  );

  const goTo = useCallback(
    (next: SceneId) => {
      if (transition.current) return; // already on the way
      const wait = reducedMotion ? SCENE_EXIT_MS.reduced : SCENE_EXIT_MS.normal;
      setLeaving(true);
      transition.current = window.setTimeout(() => {
        transition.current = null;
        setLeaving(false);
        setScene(next);
      }, wait);
    },
    [reducedMotion],
  );

  useEngineEvents(engine, (event: EngineEvent) => {
    if (event.type === 'show-end') {
      goTo('finale');
      return;
    }
    // Only the launch and the blast make a sound. Her fireworks boom deepest.
    const level = event.ambient ? 0.7 : 1;
    const size = event.ambient ? event.size : event.size * 1.25;
    if (event.phase === 'LAUNCH' && event.launchSeconds > 0) {
      audio.play('launch', { pan: event.pan, size, launchSeconds: event.launchSeconds, level });
    } else if (event.phase === 'EXPLOSION') {
      audio.play('burst', { pan: event.pan, size, crackle: event.crackle, level });
    }
  });

  const enterSky = () => {
    // Inside the tap itself: browsers only allow sound to start here.
    void audio.unlock();
    goTo('feelings');
  };

  const allBurst = useCallback(() => {
    // The show needs the sky; without a canvas, go straight to the wish.
    if (engine) setScene('show');
    else goTo('finale');
  }, [engine, goTo]);

  const lightAgain = () => {
    void audio.unlock();
    setRound((value) => value + 1);
    goTo('feelings');
  };

  return (
    <div className="app" data-scene={scene} data-reduced-motion={reducedMotion ? '' : undefined}>
      <div className="backdrop" aria-hidden="true">
        <div className="backdrop__veil" />
        <div className="backdrop__horizon" />
        <div className="backdrop__warmth" />
      </div>
      <SkyCanvas createEngine={createEngine} reducedMotion={reducedMotion} onEngine={setEngine} />
      <main className="stage" data-leaving={leaving ? '' : undefined} inert={leaving}>
        {scene === 'welcome' ? <WelcomeScene onEnter={enterSky} /> : null}
        {scene === 'feelings' ? (
          <FeelingsScene key={round} engine={engine} audio={audio} onAllBurst={allBurst} />
        ) : null}
        {scene === 'show' ? <ShowScene /> : null}
        {scene === 'finale' ? <FinaleScene onAgain={lightAgain} /> : null}
      </main>
    </div>
  );
}
