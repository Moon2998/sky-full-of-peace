import type { CSSProperties, Ref } from 'react';
import type { Feeling } from '../content/feelings';
import { PALETTES } from '../engine/palettes';

interface LaunchShellProps {
  feeling: Feeling;
  launched: boolean;
  onLaunch: (feeling: Feeling, button: HTMLButtonElement) => void;
  ref?: Ref<HTMLButtonElement>;
}

/** The firework waiting on the launch pad: its word, and a glowing shell in its tube. */
export function LaunchShell({ feeling, launched, onLaunch, ref }: LaunchShellProps) {
  const palette = PALETTES[feeling.palette];
  const [c1 = palette.spark, c2 = c1] = palette.colors;
  const style = { '--c1': c1, '--c2': c2, '--spark': palette.spark } as CSSProperties;

  return (
    <button
      ref={ref}
      type="button"
      className="shell"
      data-state={launched ? 'launched' : 'ready'}
      style={style}
      disabled={launched}
      onClick={(event) => onLaunch(feeling, event.currentTarget)}
    >
      <span className="shell__label">{feeling.label}</span>
      <span className="shell__stage" aria-hidden="true">
        <span className="shell__halo" />
        <span className="shell__orb">
          <span className="shell__fuse" />
        </span>
        <span className="shell__tube" />
      </span>
    </button>
  );
}
