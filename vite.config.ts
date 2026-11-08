import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolveBase } from './config/base.ts';

/**
 * Adds a strict Content-Security-Policy to the production HTML only.
 * The dev server needs inline scripts for hot reload, so it is skipped there.
 * Everything the page loads is same-origin; nothing calls out to the network.
 */
function contentSecurityPolicy(): Plugin {
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');

  return {
    name: 'sky-content-security-policy',
    apply: 'build',
    transformIndexHtml(html) {
      // Right after <meta charset>, before anything the policy governs.
      const tag = `<meta http-equiv="Content-Security-Policy" content="${policy}" />`;
      return html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1\n    ${tag}`);
    },
  };
}

export default defineConfig({
  base: resolveBase(process.env),
  plugins: [react(), contentSecurityPolicy()],
  build: {
    sourcemap: false,
    assetsInlineLimit: 4096,
  },
});
