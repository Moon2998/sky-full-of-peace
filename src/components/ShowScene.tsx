import { useRef } from 'react';
import { COPY } from '../content/copy';
import { useFocusOnMount } from '../hooks/useFocusOnMount';

/** The closing show belongs to the sky: the page itself stays empty. */
export function ShowScene() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useFocusOnMount(headingRef);
  return (
    <section className="scene scene--show" aria-labelledby="show-title">
      <h1 id="show-title" ref={headingRef} tabIndex={-1} className="visually-hidden">
        {COPY.show.title}
      </h1>
      <p className="visually-hidden" role="status">
        {COPY.show.status}
      </p>
    </section>
  );
}
