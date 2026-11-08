/**
 * Every visible sentence in the experience lives here, so the words can be
 * changed without touching any component or animation code.
 */
export const COPY = {
  welcome: {
    eyebrow: 'Happy Diwali',
    title: 'A Sky Full of Peace',
    lede: [
      'Tonight, there is nothing you need to prove, explain, or carry.',
      'Just take a little moment for yourself.',
    ],
    enter: 'Enter my sky',
  },
  feelings: {
    title: 'Some feelings deserve a little space.',
    hint: 'Tap it. Watch it rise, and turn into light.',
    /** Screen readers hear this after each launch. */
    launched: 'rising into the sky',
  },
  show: {
    title: 'A firework show',
    status: 'Every one of them is light now. A firework show fills the sky.',
  },
  finale: {
    title: 'A wish for you',
    titleOrnament: '✨',
    wish: [
      'May life become a little softer.',
      'May your heart find peace, your mind find rest, and your days bring you reasons to smile.',
      'May you always have the freedom to choose your own happiness.',
    ],
    closing: 'You deserve beautiful days.',
    footer: 'A little wish, with no expectations.',
    again: 'Light the sky again',
  },
} as const;
