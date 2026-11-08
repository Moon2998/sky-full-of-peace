import { useEffect, useRef } from 'react';
import { SkyEngine } from '../engine/SkyEngine';
import type { SkyEngineApi } from '../engine/types';

export type EngineFactory = (
  starCanvas: HTMLCanvasElement,
  fxCanvas: HTMLCanvasElement,
  options: { reducedMotion: boolean },
) => SkyEngineApi | null;

export const createSkyEngine: EngineFactory = (starCanvas, fxCanvas, options) => {
  const engine = SkyEngine.create(starCanvas, fxCanvas, options);
  engine?.start();
  return engine;
};

interface SkyCanvasProps {
  createEngine: EngineFactory;
  reducedMotion: boolean;
  onEngine: (engine: SkyEngineApi | null) => void;
}

/**
 * Hosts the two sky canvases and owns the engine's lifetime. The engine runs
 * its own animation loop; React only mounts and unmounts it.
 */
export function SkyCanvas({ createEngine, reducedMotion, onEngine }: SkyCanvasProps) {
  const starRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const initialReducedMotion = useRef(reducedMotion);

  useEffect(() => {
    const star = starRef.current;
    const fx = fxRef.current;
    if (!star || !fx) return undefined;
    const engine = createEngine(star, fx, { reducedMotion: initialReducedMotion.current });
    onEngine(engine);
    return () => {
      engine?.destroy();
      onEngine(null);
    };
  }, [createEngine, onEngine]);

  return (
    <div className="sky" aria-hidden="true">
      <canvas ref={starRef} className="sky__layer" />
      <canvas ref={fxRef} className="sky__layer" />
    </div>
  );
}
