import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { installMatchMedia, resetMatchMedia } from './matchMedia';

const hasDom = typeof window !== 'undefined';

if (hasDom) {
  installMatchMedia();

  // jsdom has no canvas. Returning null exercises the app's "no canvas" path
  // quietly; engine tests use the pure simulation instead.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => null,
  });
}

afterEach(() => {
  if (!hasDom) return;
  cleanup();
  resetMatchMedia();
});
