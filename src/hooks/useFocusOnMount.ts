import { useEffect, useRef, type RefObject } from 'react';

/** Moves keyboard and screen-reader focus to an element when a scene first appears. */
export function useFocusOnMount(ref: RefObject<HTMLElement | null>, enabled = true): void {
  const shouldFocus = useRef(enabled);
  useEffect(() => {
    if (shouldFocus.current) ref.current?.focus({ preventScroll: true });
  }, [ref]);
}
