// Tests of tools/ci-changes.mjs: `node --test tools/` (or `pnpm test:tools`).
// The table lists a change set and the expected outputs. Short keys: L light, B build_test,
// D docs_build, E e2e (a11y always equals e2e), V visual.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { decide, formatOutputs, parseLabels, parsePaths } from './ci-changes.mjs';

const FULL = 'BDEV';
const PR = 'pull_request';

/** @type {{ name: string, paths: string[], expect: string, event?: string, labels?: string[] }[]} */
const CASES = [
  // --- documentation and meta files: only the light job ---------------------------------
  { name: 'nested markdown', paths: ['projects/docs/notes/guide.md'], expect: 'L' },
  { name: 'markdown in .github', paths: ['.github/PULL_REQUEST_TEMPLATE.md'], expect: 'L' },
  { name: 'meta files', paths: ['.gitignore', '.editorconfig', '.prettierignore'], expect: 'L' },
  { name: '.gitattributes and .prettierrc', paths: ['.gitattributes', '.prettierrc'], expect: 'L' },
  { name: 'issue template', paths: ['.github/ISSUE_TEMPLATE/bug.yml'], expect: 'L' },
  { name: 'CODEOWNERS', paths: ['.github/CODEOWNERS'], expect: 'L' },
  { name: 'other workflow', paths: ['.github/workflows/pages.yml'], expect: 'L' },
  { name: 'release workflow', paths: ['.github/workflows/release.yml'], expect: 'L' },
  {
    name: 'visual-baselines workflow',
    paths: ['.github/workflows/visual-baselines.yml'],
    expect: 'L',
  },
  { name: 'vscode', paths: ['.vscode/extensions.json'], expect: 'L' },
  // root Markdown and LICENSE are packed: check:package checks the README links
  { name: 'README', paths: ['README.md'], expect: 'B' },
  { name: 'LICENSE', paths: ['LICENSE'], expect: 'B' },
  { name: 'CONTRIBUTING and CHANGELOG', paths: ['CONTRIBUTING.md', 'CHANGELOG.md'], expect: 'B' },
  { name: 'root markdown plus .gitignore', paths: ['SECURITY.md', '.gitignore'], expect: 'B' },
  // --- tests and tools: no pixel can change -----------------------------------------------
  {
    name: 'unit test of the library',
    paths: ['projects/star-ng/button/button.spec.ts'],
    expect: 'B',
  },
  { name: 'cross entry unit test', paths: ['projects/star-ng/specs/rtl.spec.ts'], expect: 'B' },
  { name: 'unit test of the docs', paths: ['projects/docs/src/app/app.spec.ts'], expect: 'B' },
  { name: 'tool that is not in the docs build', paths: ['tools/check-package.mjs'], expect: 'B' },
  { name: 'docs data generator', paths: ['tools/gen-docs-data.mjs'], expect: 'B' },
  { name: 'release notes tool', paths: ['tools/release-notes.mjs'], expect: 'B' },
  { name: 'release notes tool test', paths: ['tools/release-notes.test.mjs'], expect: 'B' },
  { name: 'ESLint config', paths: ['eslint.config.js'], expect: 'B' },
  { name: 'Pages test', paths: ['e2e/pages/pages.spec.ts'], expect: 'B' },
  { name: 'Pages config', paths: ['playwright.pages.config.ts'], expect: 'B' },
  { name: 'ci tool test', paths: ['tools/ci-changes.test.mjs'], expect: 'B' },
  { name: 'e2e test', paths: ['e2e/controls-table.spec.ts'], expect: 'BDE' },
  { name: 'e2e helper', paths: ['e2e/support.ts'], expect: 'BDE' },
  { name: 'e2e config', paths: ['playwright.config.ts'], expect: 'BDE' },
  {
    name: 'e2e test and a unit test',
    paths: ['e2e/rtl.spec.ts', 'projects/star-ng/table/table.spec.ts'],
    expect: 'BDE',
  },
  // --- pixels -------------------------------------------------------------------------------
  { name: 'visual test', paths: ['e2e/visual/docs-pages.visual.spec.ts'], expect: 'BDV' },
  {
    name: 'visual baseline image',
    paths: ['e2e/visual/__screenshots__/controls-button-light.png'],
    expect: 'BDV',
  },
  { name: 'visual config', paths: ['playwright.visual.config.ts'], expect: 'BDV' },
  { name: 'library style', paths: ['projects/star-ng/styles/controls/_button.scss'], expect: FULL },
  { name: 'library code', paths: ['projects/star-ng/table/table.ts'], expect: FULL },
  { name: 'library template', paths: ['projects/star-ng/table/table.html'], expect: FULL },
  { name: 'docs page', paths: ['projects/docs/src/app/controls/button.page.ts'], expect: FULL },
  {
    name: 'generated docs data',
    paths: ['projects/docs/src/app/generated/docs-data.ts'],
    expect: FULL,
  },
  { name: 'docs public file', paths: ['projects/docs/public/favicon.svg'], expect: FULL },
  { name: 'docs index.html', paths: ['projects/docs/src/index.html'], expect: FULL },
  { name: 'library tsconfig', paths: ['projects/star-ng/tsconfig.lib.json'], expect: FULL },
  { name: 'ng-package.json', paths: ['projects/star-ng/button/ng-package.json'], expect: FULL },
  {
    name: 'unit test and library code',
    paths: ['projects/star-ng/button/button.spec.ts', 'projects/star-ng/button/button.ts'],
    expect: FULL,
  },
  { name: 'package.json', paths: ['package.json'], expect: FULL },
  { name: 'lockfile', paths: ['pnpm-lock.yaml'], expect: FULL },
  { name: 'workspace file', paths: ['pnpm-workspace.yaml'], expect: FULL },
  { name: 'angular.json', paths: ['angular.json'], expect: FULL },
  { name: 'root tsconfig', paths: ['tsconfig.json'], expect: FULL },
  { name: '.nvmrc', paths: ['.nvmrc'], expect: FULL },
  { name: 'ci.yml', paths: ['.github/workflows/ci.yml'], expect: FULL },
  { name: 'ci.yml with markdown', paths: ['README.md', '.github/workflows/ci.yml'], expect: FULL },
  { name: 'static server', paths: ['tools/pages-serve.mjs'], expect: FULL },
  { name: 'server helper of the configs', paths: ['playwright.server.ts'], expect: FULL },
  { name: 'ci decision tool', paths: ['tools/ci-changes.mjs'], expect: FULL },
  { name: 'ci gate tool', paths: ['tools/ci-gate.mjs'], expect: FULL },
  // --- safety net ---------------------------------------------------------------------------
  { name: 'unknown root file', paths: ['Dockerfile'], expect: FULL },
  { name: 'unknown tool', paths: ['tools/new-tool.mjs'], expect: FULL },
  {
    name: 'unknown tool next to markdown',
    paths: ['README.md', 'tools/new-tool.mjs'],
    expect: FULL,
  },
  { name: 'upper case extension is unknown', paths: ['notes/GUIDE.MD'], expect: FULL },
  {
    name: 'markdown look-alike in a name',
    paths: ['projects/star-ng/table/table.md.ts'],
    expect: FULL,
  },
  { name: 'git-quoted path is unknown', paths: ['"projects/docs/caf\\303\\251.md"'], expect: FULL },
  // --- edge cases ----------------------------------------------------------------------------
  { name: 'empty diff', paths: [], expect: FULL },
  // a rename lists the old and the new path (git diff --no-renames): the old one counts
  {
    name: 'rename of library code to markdown',
    paths: ['projects/star-ng/table/table.ts', 'notes/table.md'],
    expect: FULL,
  },
  { name: 'rename of markdown to markdown', paths: ['notes/old.md', 'notes/new.md'], expect: 'L' },
  {
    name: 'rename of a spec out of the library',
    paths: ['projects/star-ng/button/button.spec.ts', 'e2e/button.spec.ts'],
    expect: 'BDE',
  },
  // a deleted file is listed like a changed file
  { name: 'deleted library file', paths: ['projects/star-ng/table/old-table.ts'], expect: FULL },
  { name: 'deleted markdown file', paths: ['notes/old.md'], expect: 'L' },
  { name: 'deleted root markdown file', paths: ['RELEASING.md'], expect: 'B' },
  { name: 'path with spaces, markdown', paths: ['notes/release notes.md'], expect: 'L' },
  {
    name: 'path with spaces, library',
    paths: ['projects/star-ng/styles/my file.scss'],
    expect: FULL,
  },
  { name: 'duplicate paths', paths: ['README.md', 'README.md'], expect: 'B' },
  // --- events and the label -----------------------------------------------------------------
  { name: 'push to main, markdown only', event: 'push', paths: ['README.md'], expect: FULL },
  { name: 'push with an empty diff', event: 'push', paths: [], expect: FULL },
  { name: 'workflow_dispatch', event: 'workflow_dispatch', paths: ['notes/a.md'], expect: FULL },
  { name: 'schedule', event: 'schedule', paths: [], expect: FULL },
  {
    name: 'label ci:full on a markdown change',
    labels: ['ci:full'],
    paths: ['notes/a.md'],
    expect: FULL,
  },
  {
    name: 'other labels change nothing',
    labels: ['bug', 'docs'],
    paths: ['notes/a.md'],
    expect: 'L',
  },
  { name: 'label is case sensitive', labels: ['CI:FULL'], paths: ['notes/a.md'], expect: 'L' },
];

const KEYS = { L: 'light', B: 'build_test', D: 'docs_build', E: 'e2e', V: 'visual' };

/** Expected outputs from a short code, for example `BDE`. */
function expected(code) {
  const on = new Set(code);
  const outputs = Object.fromEntries(
    Object.entries(KEYS).map(([letter, key]) => [key, String(on.has(letter))]),
  );
  outputs.a11y = outputs.e2e;
  return outputs;
}

for (const { name, paths, expect, event = PR, labels = [] } of CASES) {
  test(`${name}: ${expect}`, () => {
    const result = decide({ event, paths, labels });
    assert.deepEqual(result.outputs, expected(expect), JSON.stringify(paths));
  });
}

test('light runs exactly when build-test does not', () => {
  for (const { paths, event = PR, labels = [] } of CASES) {
    const { outputs } = decide({ event, paths, labels });
    assert.notEqual(outputs.light, outputs.build_test);
  }
});

test('a browser job always has the docs build, and no browser job runs without it', () => {
  for (const { paths, event = PR, labels = [] } of CASES) {
    const { outputs } = decide({ event, paths, labels });
    const browser = outputs.e2e === 'true' || outputs.a11y === 'true' || outputs.visual === 'true';
    assert.equal(outputs.docs_build, String(browser));
  }
});

test('mode: full for the safety net, selective otherwise', () => {
  assert.equal(decide({ event: 'push', paths: ['a.md'] }).mode, 'full');
  assert.equal(decide({ event: PR, paths: ['a.md'] }).mode, 'selective');
  assert.equal(decide({ event: PR, paths: [] }).mode, 'full');
  assert.equal(decide({ event: PR, paths: ['a.md'], labels: ['ci:full'] }).mode, 'full');
});

test('the output lines have the GITHUB_OUTPUT format', () => {
  const text = formatOutputs(decide({ event: PR, paths: ['e2e/rtl.spec.ts'] }));
  assert.equal(
    text,
    [
      'light=false',
      'build_test=true',
      'docs_build=true',
      'e2e=true',
      'a11y=true',
      'visual=false',
      'mode=selective',
    ].join('\n'),
  );
});

test('parsePaths: new lines, NUL, spaces, ./ prefix, empty input', () => {
  assert.deepEqual(parsePaths('a.md\nb c.md\n'), ['a.md', 'b c.md']);
  assert.deepEqual(parsePaths('a.md\r\nb.md\r\n'), ['a.md', 'b.md']);
  assert.deepEqual(parsePaths('a b.md\0dir/c\nd.md\0'), ['a b.md', 'dir/c\nd.md']);
  assert.deepEqual(parsePaths('./a.md\n./a.md\n'), ['a.md']);
  assert.deepEqual(parsePaths(''), []);
  assert.deepEqual(parsePaths('\n\n'), []);
});

test('parseLabels: JSON array, comma list, empty', () => {
  assert.deepEqual(parseLabels('["bug","ci:full"]'), ['bug', 'ci:full']);
  assert.deepEqual(parseLabels('bug, ci:full'), ['bug', 'ci:full']);
  assert.deepEqual(parseLabels(''), []);
  assert.deepEqual(parseLabels('[]'), []);
});

test('command line: reads NUL separated paths from stdin and writes the output file format', () => {
  const tool = fileURLToPath(new URL('./ci-changes.mjs', import.meta.url));
  const run = (input, ...args) =>
    spawnSync(process.execPath, [tool, '--event', 'pull_request', ...args], {
      input,
      encoding: 'utf8',
    });
  const docs = run('notes/release notes.md\0.gitignore\0');
  assert.equal(docs.status, 0, docs.stderr);
  assert.match(docs.stdout, /^light=true$/m);
  assert.match(docs.stdout, /^visual=false$/m);
  const forced = run('notes/a.md\0', '--labels', '["ci:full"]');
  assert.match(forced.stdout, /^visual=true$/m);
  assert.match(forced.stdout, /^mode=full$/m);
  const missing = spawnSync(process.execPath, [tool], {
    input: '',
    encoding: 'utf8',
    env: { ...process.env, GITHUB_EVENT_NAME: '' },
  });
  assert.equal(missing.status, 2);
});
