// Tests of tools/check-prerender.mjs: `node --test tools/` (or `pnpm test:tools`).
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { checkPrerender, prerenderProblems, routesFromNav } from './check-prerender.mjs';

// One `path:` entry per line, as `nav.ts` has them.
const NAV = `
  {
    label: 'Button',
    path: 'controls/button',
  },
  {
    label: 'Theming',
    path: 'guides/theming',
  },
`;

function page(title, heading) {
  return `<html><head><title>${title}</title></head><body><docs-root><h1>${heading}</h1></docs-root></body></html>`;
}

function build(files) {
  const folder = mkdtempSync(join(tmpdir(), 'check-prerender-'));
  for (const [path, html] of Object.entries(files)) {
    const file = join(folder, path);
    mkdirSync(join(file, '..'), { recursive: true });
    writeFileSync(file, html);
  }
  return folder;
}

test('the routes are the home page and every path of the navigation', () => {
  assert.deepEqual(routesFromNav(NAV), ['', 'controls/button', 'guides/theming']);
});

test('a navigation without a path entry is an error, not an empty list', () => {
  assert.throws(() => routesFromNav('export const x = 1;'), /no `path: \.\.\.` entry/);
});

test('the real navigation lists the home page, the guides and the controls', () => {
  const routes = routesFromNav(
    readFileSync(new URL('../projects/docs/src/app/nav.ts', import.meta.url), 'utf8'),
  );
  assert.equal(routes[0], '');
  assert.ok(routes.some((route) => route.startsWith('guides/')));
  assert.ok(routes.filter((route) => route.startsWith('controls/')).length >= 80);
});

test('a folder with a prerendered file for every route has no problem', () => {
  const folder = build({
    'index.html': page('StarNG', 'StarNG'),
    'controls/button/index.html': page('Button · StarNG', 'Button'),
    'guides/theming/index.html': page('Theming · StarNG', 'Theming'),
  });
  try {
    assert.equal(checkPrerender(folder, NAV), 3);
  } finally {
    rmSync(folder, { recursive: true });
  }
});

test('a missing file, an empty heading and a missing title are reported by route', () => {
  const folder = build({
    'index.html':
      '<html><head><title>StarNG</title></head><body><docs-root></docs-root></body></html>',
    'controls/button/index.html': '<html><head></head><body><h1>Button</h1></body></html>',
  });
  try {
    const problems = prerenderProblems(folder, ['', 'controls/button', 'guides/theming']);
    assert.equal(problems.length, 3);
    assert.match(problems[0], /^\/: no <h1> text/);
    assert.match(problems[1], /^\/controls\/button: no <title>/);
    assert.match(problems[2], /^\/guides\/theming: .*does not exist/);
    assert.throws(() => checkPrerender(folder, NAV), /3 problems in the 3 pages/);
  } finally {
    rmSync(folder, { recursive: true });
  }
});
