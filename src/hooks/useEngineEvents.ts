import { useEffect, useRef } from 'react';
import type { EngineListener, SkyEngineApi } from '../engine/types';

/**
 * Listens to firework phase events. The latest callback is always used,
 * without re-subscribing on every render.
 */
export function useEngineEvents(engine: SkyEngineApi | null, listener: EngineListener): void {
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    if (!engine) return undefined;
    return engine.on((event) => latest.current(event));
  }, [engine]);
}
