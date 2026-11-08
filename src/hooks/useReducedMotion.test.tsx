import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setReducedMotion } from '../test/matchMedia';
import { useReducedMotion } from './useReducedMotion';

describe('useReducedMotion', () => {
  it('follows the prefers-reduced-motion setting, live', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    act(() => setReducedMotion(true));
    expect(result.current).toBe(true);
    act(() => setReducedMotion(false));
    expect(result.current).toBe(false);
  });

  it('starts true when the device already asks for less motion', () => {
    setReducedMotion(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });
});
