import { useRef, type CSSProperties } from 'react';
import { COPY } from '../content/copy';
import { useFocusOnMount } from '../hooks/useFocusOnMount';

const delay = (seconds: number) => ({ '--d': `${seconds}s` }) as CSSProperties;

/**
 * The wish arrives line by line while the show's golden rain is still falling.
 * All text is in the page from the start, so screen readers need not wait.
 */
export const FINALE_TEXT_DELAYS = {
  title: 1.2,
  firstLine: 2.5,
  lineGap: 1.35,
  closing: 6.6,
  footer: 8.2,
} as const;

interface FinaleSceneProps {
  onAgain: () => void;
}

export function FinaleScene({ onAgain }: FinaleSceneProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef);
  const { title, titleOrnament, wish, closing, footer, again } = COPY.finale;
  const d = FINALE_TEXT_DELAYS;

  return (
    <section className="scene scene--finale" aria-labelledby="finale-title">
      <div className="finale">
        <h1
          id="finale-title"
          ref={headingRef}
          tabIndex={-1}
          className="finale__title reveal reveal--slow"
          style={delay(d.title)}
        >
          {title}{' '}
          <span className="finale__ornament" aria-hidden="true">
            {titleOrnament}
          </span>
        </h1>
        <div className="finale__wish">
          {wish.map((line, index) => (
            <p key={line} className="reveal reveal--slow" style={delay(d.firstLine + index * d.lineGap)}>
              {line}
            </p>
          ))}
        </div>
        <div className="finale__closing reveal reveal--slow" style={delay(d.closing)}>
          <span className="finale__divider" aria-hidden="true" />
          <p className="finale__closing-text">{closing}</p>
        </div>
        <footer className="finale__footer reveal" style={delay(d.footer)}>
          <p>{footer}</p>
          <button type="button" className="btn btn--link" onClick={onAgain}>
            {again}
          </button>
        </footer>
      </div>
    </section>
  );
}
