import { describe, expect, it } from 'vitest';
import { PALETTES } from '../engine/palettes';
import { PATTERNS } from '../engine/patterns';
import { COPY } from './copy';
import { FEELINGS } from './feelings';

describe('content', () => {
  it('puts the eight feelings on the launch pad', () => {
    expect(FEELINGS.map((f) => f.label)).toEqual([
      'Heavy days',
      'Worries',
      'Broken trust',
      'Old wounds',
      'Feeling alone',
      'Overthinking',
      'Fear',
      'Disappointment',
    ]);
  });

  it('gives every feeling its own colours and a real burst shape', () => {
    expect(new Set(FEELINGS.map((f) => f.palette)).size).toBe(FEELINGS.length);
    expect(new Set(FEELINGS.map((f) => f.id)).size).toBe(FEELINGS.length);
    for (const feeling of FEELINGS) {
      expect(PALETTES[feeling.palette]).toBeDefined();
      expect(PATTERNS).toContain(feeling.pattern);
    }
    expect(new Set(FEELINGS.map((f) => f.pattern)).size).toBeGreaterThanOrEqual(6);
  });

  it('keeps the welcome and closing words exactly as written', () => {
    expect(COPY.welcome.title).toBe('A Sky Full of Peace');
    expect(COPY.welcome.lede).toEqual([
      'Tonight, there is nothing you need to prove, explain, or carry.',
      'Just take a little moment for yourself.',
    ]);
    expect(COPY.welcome.enter).toBe('Enter my sky');
    expect(COPY.feelings.title).toBe('Some feelings deserve a little space.');
    expect(`${COPY.finale.title} ${COPY.finale.titleOrnament}`).toBe('A wish for you ✨');
    expect(COPY.finale.wish).toEqual([
      'May life become a little softer.',
      'May your heart find peace, your mind find rest, and your days bring you reasons to smile.',
      'May you always have the freedom to choose your own happiness.',
    ]);
    expect(COPY.finale.closing).toBe('You deserve beautiful days.');
    expect(COPY.finale.footer).toBe('A little wish, with no expectations.');
  });

  it('never promises a cure, asks for a reply, or creates an obligation', () => {
    const allText = JSON.stringify({ COPY, FEELINGS }).toLowerCase();
    for (const phrase of ['cure', 'heal', 'therapy', 'reply', 'respond', 'text me', 'call me', 'love you', 'miss you', 'from:', 'yours,']) {
      expect(allText).not.toContain(phrase);
    }
  });
});
