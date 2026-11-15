// Builds the docs application for GitHub Pages: `pnpm build:pages [base-href]`.
//
// 1. `ng build docs --base-href <base>`. GitHub serves a project site under a sub-path
//    (`https://<owner>.github.io/<repository>/`), so every URL of the page must resolve against
//    that path. The default is `/star-ng/`. The Pages workflow passes the `base_path` output of
//    `actions/configure-pages` instead, so a fork or a custom domain works as well.
// 2. Copies `index.html` to `404.html` (see `pages-fallback.mjs`).
//
// The base href must start and end with `/`. Output: `dist/docs/browser`.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFallback } from './pages-fallback.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = process.argv[2] ?? process.env.PAGES_BASE_HREF ?? '/star-ng/';
if (!/^\/([\w.~-]+\/)*$/.test(base)) {
  console.error(`build-pages: the base href "${base}" must start and end with "/", e.g. /star-ng/`);
  process.exit(1);
}

const ng = createRequire(import.meta.url).resolve('@angular/cli/bin/ng.js');
const build = spawnSync(process.execPath, [ng, 'build', 'docs', '--base-href', base], {
  cwd: root,
  stdio: 'inherit',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const output = new URL('../dist/docs/browser/', import.meta.url);
writeFallback(fileURLToPath(output));
console.log(`build-pages: built for ${base}, wrote 404.html in ${fileURLToPath(output)}`);
