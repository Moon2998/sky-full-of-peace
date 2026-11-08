import { useId } from 'react';

type IconProps = { className?: string };

export function SparkIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2.5c.5 4.6 2.4 7 9 9.5-6.6 2.5-8.5 4.9-9 9.5-.5-4.6-2.4-7-9-9.5 6.6-2.5 8.5-4.9 9-9.5Z"
      />
    </svg>
  );
}

/** A thin line with a small four-point star, used to frame small headings. */
export function Ornament({ className, flip = false }: IconProps & { flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 12"
      className={className}
      aria-hidden="true"
      focusable="false"
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path d="M0 6h36" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.55" />
      <path d="M42 1.5c.3 2.6 1.3 3.8 4.5 4.5-3.2.7-4.2 1.9-4.5 4.5-.3-2.6-1.3-3.8-4.5-4.5 3.2-.7 4.2-1.9 4.5-4.5Z" fill="currentColor" />
    </svg>
  );
}

/** A small line-drawn diya (oil lamp) with a softly flickering flame. */
export function Diya({ className }: IconProps) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}-flame`} cx="50%" cy="68%" r="62%">
          <stop offset="0" stopColor="#fff7df" />
          <stop offset="0.45" stopColor="#ffd27a" />
          <stop offset="1" stopColor="#ff9a4a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${id}-halo`} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffb36b" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="diya__flame">
        <ellipse cx="32" cy="17" rx="14" ry="15" fill={`url(#${id}-halo)`} />
        <path
          d="M32 5c3.8 5.2 5.4 9 5.4 12.6 0 3.4-2.4 5.9-5.4 5.9s-5.4-2.5-5.4-5.9C26.6 14 28.2 10.2 32 5Z"
          fill={`url(#${id}-flame)`}
        />
      </g>
      <path
        d="M9 27.5c4.2 8.6 12.3 12.7 23 12.7s18.8-4.1 23-12.7c-7.9 2.7-15.3 3.6-23 3.6s-15.1-.9-23-3.6Z"
        fill="rgba(230,191,120,0.12)"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M26 40.6 24.3 44h15.4L38 40.6" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
