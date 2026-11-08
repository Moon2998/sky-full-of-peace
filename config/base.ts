/**
 * Works out the public base path Vite should build with.
 *
 * Order of precedence:
 *   1. BASE_PATH — set explicitly, or by the deploy workflow from
 *      actions/configure-pages (it is "/<repo>" for project sites and ""
 *      for user sites or custom domains).
 *   2. GITHUB_REPOSITORY when building inside GitHub Actions without
 *      BASE_PATH ("owner/repo" -> "/repo/", "owner/owner.github.io" -> "/").
 *   3. "/" for local development and custom-domain root deployments.
 *
 * Use BASE_PATH="./" for a fully relative build that works from any folder.
 */
export type BaseEnv = Readonly<Record<string, string | undefined>>;

export function normalizeBase(raw: string): string {
  const value = raw.trim();
  if (value === '' || value === '/') return '/';
  if (value === '.' || value === './') return './';

  let path = value;
  if (/^https?:\/\//i.test(path)) {
    path = new URL(path).pathname;
  }
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  return path.replace(/\/{2,}/g, '/');
}

export function resolveBase(env: BaseEnv): string {
  if (env.BASE_PATH !== undefined) {
    return normalizeBase(env.BASE_PATH);
  }

  const repository = env.GITHUB_REPOSITORY;
  if (env.GITHUB_ACTIONS === 'true' && repository && repository.includes('/')) {
    const [owner = '', repo = ''] = repository.split('/');
    if (repo.toLowerCase() === `${owner.toLowerCase()}.github.io`) return '/';
    return normalizeBase(repo);
  }

  return '/';
}
