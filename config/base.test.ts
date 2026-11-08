// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { normalizeBase, resolveBase } from './base';

describe('normalizeBase', () => {
  it.each([
    ['', '/'],
    ['/', '/'],
    ['./', './'],
    ['.', './'],
    ['/a-sky-full-of-peace', '/a-sky-full-of-peace/'],
    ['a-sky-full-of-peace', '/a-sky-full-of-peace/'],
    ['/a-sky-full-of-peace/', '/a-sky-full-of-peace/'],
    ['//nested//path', '/nested/path/'],
    ['https://example.github.io/my-repo', '/my-repo/'],
    ['https://www.example.com', '/'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeBase(input)).toBe(expected);
  });
});

describe('resolveBase', () => {
  it('defaults to root for local builds', () => {
    expect(resolveBase({})).toBe('/');
  });

  it('uses configure-pages output for a project site', () => {
    // The workflow passes "${{ steps.pages.outputs.base_path }}/"
    expect(resolveBase({ BASE_PATH: '/a-sky-full-of-peace/' })).toBe('/a-sky-full-of-peace/');
  });

  it('uses root when configure-pages reports a custom domain or user site', () => {
    expect(resolveBase({ BASE_PATH: '/' })).toBe('/');
    expect(resolveBase({ BASE_PATH: '' })).toBe('/');
  });

  it('lets BASE_PATH win over the repository name', () => {
    expect(
      resolveBase({ BASE_PATH: '/', GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'someone/sky' }),
    ).toBe('/');
  });

  it('falls back to the repository name inside GitHub Actions', () => {
    expect(resolveBase({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'someone/sky' })).toBe('/sky/');
  });

  it('treats <owner>.github.io repositories as root sites', () => {
    expect(
      resolveBase({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'Someone/someone.github.io' }),
    ).toBe('/');
  });

  it('ignores GITHUB_REPOSITORY outside Actions', () => {
    expect(resolveBase({ GITHUB_REPOSITORY: 'someone/sky' })).toBe('/');
  });
});
