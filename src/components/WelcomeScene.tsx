import type { CSSProperties } from 'react';
import { COPY } from '../content/copy';
import { Diya, Ornament, SparkIcon } from './Icons';

const delay = (seconds: number) => ({ '--d': `${seconds}s` }) as CSSProperties;

interface WelcomeSceneProps {
  onEnter: () => void;
}

export function WelcomeScene({ onEnter }: WelcomeSceneProps) {
  const { eyebrow, title, lede, enter } = COPY.welcome;
  return (
    <section className="scene scene--welcome" aria-labelledby="welcome-title">
      <div className="welcome">
        <Diya className="diya reveal" />
        <p className="eyebrow reveal" style={delay(0.35)}>
          <Ornament className="eyebrow__ornament" />
          <span>{eyebrow}</span>
          <Ornament className="eyebrow__ornament" flip />
        </p>
        <h1 id="welcome-title" className="welcome__title reveal reveal--title" style={delay(0.7)}>
          <span className="welcome__title-text">{title}</span>
        </h1>
        <p className="welcome__lede reveal" style={delay(1.7)}>
          {lede.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>
        <div className="welcome__actions reveal" style={delay(2.6)}>
          <button type="button" className="btn btn--primary" onClick={onEnter}>
            <SparkIcon className="btn__icon" />
            <span>{enter}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
