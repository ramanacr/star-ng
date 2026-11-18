// Builds the docs application for GitHub Pages: `pnpm build:pages [base-href]`.
//
// 1. `ng build docs --base-href <base>`. GitHub serves a project site under a sub-path
//    (`https://<owner>.github.io/<repository>/`), so every URL of the page must resolve against
//    that path. The default is `/star-ng/`. The Pages workflow passes the `base_path` output of
//    `actions/configure-pages` instead, so a fork or a custom domain works as well.
//    The production build prerenders every docs page to `<route>/index.html`, so GitHub answers a
//    known address with the status 200 and the content of the page in the HTML source.
// 2. Checks that every page of the navigation was prerendered (see `check-prerender.mjs`).
// 3. Copies the client-rendered shell `index.csr.html` to `404.html` (see `pages-fallback.mjs`):
//    the answer for an address that is no page.
//
// 4. Writes the files for coding agents (see `agent-data.mjs`): `llms.txt`, `llms-full.txt` and
//    `mcp/components.json`, the data that the MCP server `@star-ng/mcp` fetches. Their links are
//    absolute, so they need the site URL: PAGES_SITE_URL (the Pages workflow passes the
//    `base_url` of `actions/configure-pages`), else the `homepage` of the library package.
//
// The base href must start and end with `/`. Output: `dist/docs/browser`.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeAgentData } from './agent-data.mjs';
import { checkPrerender } from './check-prerender.mjs';
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
const pages = checkPrerender(fileURLToPath(output));
writeFallback(fileURLToPath(output));
const site = process.env.PAGES_SITE_URL
  ? `${process.env.PAGES_SITE_URL.replace(/\/+$/, '')}/`
  : undefined;
const agentData = writeAgentData(fileURLToPath(output), site ? { site } : {});
console.log(
  `build-pages: wrote llms.txt, llms-full.txt and mcp/components.json for ${agentData.site}`,
);
console.log(
  `build-pages: built for ${base}, ${pages} pages prerendered, wrote 404.html in ${fileURLToPath(output)}`,
);
