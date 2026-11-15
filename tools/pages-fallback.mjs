// Single-page-application fallback for GitHub Pages.
//
// GitHub Pages has no rewrite rules. A direct request for a route such as
// `/star-ng/controls/button` has no file, so GitHub answers with the `404.html` of the site.
// When `404.html` is a copy of `index.html`, the browser loads the application, the router reads
// the address and shows the page. The HTTP status of that response is still 404.
//
// Usage: `node tools/pages-fallback.mjs [output-folder]` (default `dist/docs/browser`).
import { copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Copies `index.html` to `404.html` in the folder. Returns the path of `404.html`. */
export function writeFallback(folder) {
  const index = join(folder, 'index.html');
  if (!existsSync(index)) throw new Error(`pages-fallback: ${index} does not exist. Build first.`);
  const target = join(folder, '404.html');
  copyFileSync(index, target);
  return target;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = resolve(process.argv[2] ?? 'dist/docs/browser');
  console.log(`pages-fallback: wrote ${writeFallback(folder)}`);
}
