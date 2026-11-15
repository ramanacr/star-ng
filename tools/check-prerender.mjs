// Checks that the docs build prerendered every page: `node tools/check-prerender.mjs [folder]`
// (default `dist/docs/browser`).
//
// The page list is the navigation of the docs application (`projects/docs/src/app/nav.ts`),
// which also builds the routes, plus the home page. So a new page is checked without a change
// here. For each page the build must have written `<path>/index.html` with the title and the
// first-level heading of that page in the HTML source. A page that is missing or was not
// rendered (an empty `<docs-root>`) would be served by GitHub Pages as the 404 fallback.
//
// `pnpm build:docs` and `pnpm build:pages` run this check after the build.
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const navFile = join(root, 'projects/docs/src/app/nav.ts');

/** The route paths of the navigation (`controls/button`, ...), and `''` for the home page. */
export function routesFromNav(source) {
  const paths = [...source.matchAll(/^\s+path: '([^']+)',$/gm)].map((match) => match[1]);
  if (paths.length === 0) {
    throw new Error(
      'check-prerender: no `path: ...` entry found in nav.ts. Did its format change?',
    );
  }
  return ['', ...paths];
}

/** Text of the first element of the tag, without nested tags, or `''`. */
function textOf(html, tag) {
  const match = new RegExp('<' + tag + '[^>]*>([^]*?)</' + tag + '>', 'i').exec(html);
  return match ? match[1].replace(/<[^>]*>/g, '').trim() : '';
}

/** The problems of a build folder: one text per route that has no usable prerendered file. */
export function prerenderProblems(folder, routes) {
  const problems = [];
  for (const route of routes) {
    const file = join(folder, route, 'index.html');
    const name = route === '' ? '/' : `/${route}`;
    if (!existsSync(file)) {
      problems.push(`${name}: ${file} does not exist`);
      continue;
    }
    const html = readFileSync(file, 'utf8');
    if (!textOf(html, 'title')) problems.push(`${name}: no <title> in the HTML source`);
    if (!textOf(html, 'h1')) problems.push(`${name}: no <h1> text in the HTML source`);
  }
  return problems;
}

/** Throws when a page of the navigation has no prerendered file. */
export function checkPrerender(folder, source = readFileSync(navFile, 'utf8')) {
  const routes = routesFromNav(source);
  const problems = prerenderProblems(folder, routes);
  if (problems.length) {
    const shown = problems.slice(0, 10).join('\n  ');
    const more = problems.length > 10 ? `\n  ... and ${problems.length - 10} more` : '';
    throw new Error(
      `check-prerender: ${problems.length} problems in the ${routes.length} pages:\n  ${shown}${more}`,
    );
  }
  return routes.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = resolve(process.argv[2] ?? 'dist/docs/browser');
  try {
    console.log(`check-prerender: ${checkPrerender(folder)} pages are prerendered in ${folder}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
