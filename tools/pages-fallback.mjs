// Single-page-application fallback for GitHub Pages.
//
// The production build prerenders every route to its own `index.html` (for example
// `controls/button/index.html`), so a request for a known page is answered with the status 200.
// A request for any other path has no file, so GitHub answers with the `404.html` of the site
// (status 404, no rewrite). `404.html` is a copy of the client-rendered shell `index.csr.html`
// that the build writes next to the prerendered pages: the browser loads the application, the
// router reads the address and shows the page (an unknown address goes to the home page). The
// shell has no page content, so an unknown address never shows the content of a wrong page.
// When a build has no `index.csr.html` (no prerender), `index.html` is the shell.
//
// Usage: `node tools/pages-fallback.mjs [output-folder]` (default `dist/docs/browser`).
import { copyFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Copies the client-rendered shell to `404.html` in the folder. Returns the path of `404.html`. */
export function writeFallback(folder) {
  const csr = join(folder, 'index.csr.html');
  const index = join(folder, 'index.html');
  const shell = existsSync(csr) ? csr : index;
  if (!existsSync(shell)) throw new Error(`pages-fallback: ${shell} does not exist. Build first.`);
  const target = join(folder, '404.html');
  copyFileSync(shell, target);
  return target;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = resolve(process.argv[2] ?? 'dist/docs/browser');
  console.log(`pages-fallback: wrote ${writeFallback(folder)}`);
}
