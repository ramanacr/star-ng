// The entry points that the docs shell imports at start (core, and utility through the theme
// switch) re-export with `export *` only. A named value re-export (`export { x } from './file'`)
// in such an index made the docs build keep every file of the entry point in the initial bundle
// (1.02 MB against the 1 MB budget before wave K). Type-only re-exports are fine.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHELL_ENTRY_POINTS = ['core', 'utility', 'dialog', 'toast', 'theme-switch', 'theme'];

for (const name of SHELL_ENTRY_POINTS) {
  test(`${name}/index.ts has no named value re-export`, () => {
    const source = readFileSync(join(root, 'projects/star-ng', name, 'index.ts'), 'utf8');
    const named = source.match(/^export\s*\{[^}]*\}\s*from\s*['"][^'"]+['"]/gm) ?? [];
    assert.deepEqual(named, []);
  });
}
