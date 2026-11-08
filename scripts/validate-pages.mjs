#!/usr/bin/env node
/**
 * Checks that the production build in dist/ will load correctly from its
 * GitHub Pages URL: every file the page references must sit under the
 * configured base path and exist in dist/. Also prints the real file sizes.
 *
 * Usage: BASE_PATH=/my-repo/ node scripts/validate-pages.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

/** Same rules as config/base.ts (kept dependency-free so it runs on plain Node). */
function normalizeBase(raw) {
  const value = String(raw).trim();
  if (value === '' || value === '/') return '/';
  if (value === '.' || value === './') return './';
  let path = /^https?:\/\//i.test(value) ? new URL(value).pathname : value;
  if (!path.startsWith('/')) path = `/${path}`;
  if (!path.endsWith('/')) path = `${path}/`;
  return path.replace(/\/{2,}/g, '/');
}

const base = normalizeBase(process.env.BASE_PATH ?? '/');
const relativeBase = base === './';
const errors = [];
const fail = (message) => errors.push(message);

const isExternal = (url) => /^(?:[a-z]+:)?\/\//i.test(url) || /^(?:data|blob|mailto|tel):/i.test(url) || url.startsWith('#');

/** Maps a URL found in a file to a path inside dist/, or reports why it is wrong. */
function toDistPath(url, fromFile) {
  const clean = url.split(/[?#]/)[0];
  if (clean.startsWith('/')) {
    if (relativeBase) {
      fail(`${fromFile}: "${url}" is absolute, but the build should be fully relative (BASE_PATH=./)`);
      return null;
    }
    if (!clean.startsWith(base)) {
      fail(`${fromFile}: "${url}" is outside the base path "${base}" and would 404 on GitHub Pages`);
      return null;
    }
    return join(dist, clean.slice(base.length));
  }
  const fromDir = posix.dirname(fromFile);
  return join(dist, posix.normalize(posix.join(fromDir, clean)));
}

function checkExists(url, fromFile) {
  const target = toDistPath(url, fromFile);
  if (target && !existsSync(target)) fail(`${fromFile}: "${url}" points to a missing file`);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist/index.html not found. Run "npm run build" first.');
  process.exit(1);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const htmlRefs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
if (htmlRefs.length === 0) fail('index.html references no files');
for (const url of htmlRefs) if (!isExternal(url)) checkExists(url, 'index.html');

if (!/<script type="module"[^>]+src="[^"]+\.js"/.test(html)) fail('index.html has no built module script');
if (html.includes('/src/main.tsx')) fail('index.html still points at the development entry /src/main.tsx');
if (!html.includes('Content-Security-Policy')) fail('index.html is missing its Content-Security-Policy');
if (!html.includes('name="robots" content="noindex')) fail('index.html is missing the noindex robots tag');
for (const url of htmlRefs) if (/^https?:/i.test(url)) fail(`index.html loads an external resource: ${url}`);

const files = walk(dist);
for (const file of files.filter((f) => f.endsWith('.css'))) {
  const rel = posix.normalize(file.slice(dist.length + 1).replaceAll('\\', '/'));
  const css = readFileSync(file, 'utf8');
  for (const match of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
    const url = match[1];
    if (isExternal(url)) {
      if (/^https?:/i.test(url) || url.startsWith('//')) fail(`${rel}: loads an external resource: ${url}`);
      continue;
    }
    checkExists(url, rel);
  }
}

// ---- report ----------------------------------------------------------------

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const rows = files
  .map((file) => {
    const content = readFileSync(file);
    return {
      file: file.slice(dist.length + 1).replaceAll('\\', '/'),
      raw: content.length,
      gzip: /\.(?:js|css|html|svg|json|md)$/.test(file) ? gzipSync(content, { level: 9 }).length : content.length,
    };
  })
  .sort((a, b) => b.raw - a.raw);

const sum = (filter) => rows.filter(filter).reduce((total, row) => total + row.gzip, 0);
const initial = rows.filter((r) => /\.(?:js|css)$/.test(r.file) || r.file === 'index.html');

console.log(`Base path: ${base}`);
console.log(`Checked ${htmlRefs.length} HTML references and the CSS url() references in ${files.length} files.`);
console.log('');
console.log('File sizes (gzip for text files):');
for (const row of rows) console.log(`  ${row.file.padEnd(58)} ${kb(row.raw).padStart(10)} ${kb(row.gzip).padStart(10)}`);
console.log('');
console.log(`Initial HTML + JS + CSS, gzipped: ${kb(initial.reduce((t, r) => t + r.gzip, 0))}`);
console.log(`Fonts (woff2, fetched only when used): ${kb(sum((r) => r.file.endsWith('.woff2')))}`);

if (errors.length) {
  console.error('');
  console.error(`GitHub Pages validation failed (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log('');
console.log('GitHub Pages validation passed.');
