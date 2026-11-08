import { describe, expect, it } from 'vitest';
import { seededRng } from '../engine/random';
import { FEELINGS } from './feelings';
import { shuffle } from './shuffle';

describe('shuffle', () => {
  it('keeps every feeling exactly once', () => {
    const shuffled = shuffle(FEELINGS);
    expect(shuffled).toHaveLength(FEELINGS.length);
    expect(new Set(shuffled)).toEqual(new Set(FEELINGS));
  });

  it('does not change the original list', () => {
    const before = [...FEELINGS];
    shuffle(FEELINGS);
    expect(FEELINGS).toEqual(before);
  });

  it('gives different orders on different visits', () => {
    const rng = seededRng(5);
    const orders = new Set(Array.from({ length: 20 }, () => shuffle(FEELINGS, rng).map((f) => f.id).join()));
    expect(orders.size).toBeGreaterThan(15);
  });
});
