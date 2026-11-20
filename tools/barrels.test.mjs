// Guard of the entry points that the docs shell loads at start (the shell imports, and the
// entry points that those import, transitively). Two rules:
//
// 1. Their `index.ts` re-exports values with `export *` only. A named value re-export
//    (`export { x } from './file'`, or `import { x } ...; export { x };`) made the docs build keep
//    every file of the entry point in the initial bundle (1.02 MB against the 1 MB budget before
//    wave K). Type-only re-exports (`export type { ... }`) are erased and allowed.
// 2. Because of `export *`, every exported name of a re-exported file is public API. The public
//    names (all names without the `ɵ` prefix) must match the checked-in snapshot
//    `tools/shell-public-api.json`. A new public name needs a deliberate snapshot update:
//    `UPDATE_SHELL_API=1 node --test tools/barrels.test.mjs`. An internal helper takes the `ɵ`
//    prefix, or lives in a file that `index.ts` does not re-export (see CONTRIBUTING.md,
//    "Public API scope").
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(root, 'projects/star-ng');
const snapshotFile = join(root, 'tools/shell-public-api.json');
// The files of the docs shell that the application loads at start (routes load pages lazily).
const SHELL_FILES = [
  'projects/docs/src/main.ts',
  'projects/docs/src/app/app.ts',
  'projects/docs/src/app/app.config.ts',
  'projects/docs/src/app/app.routes.ts',
  'projects/docs/src/app/nav.ts',
];

/** Entry points (`@star-ng/ui/<name>`) that a source file imports as values. */
function entryImports(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const names = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
    const spec = statement.moduleSpecifier;
    if (!spec || !ts.isStringLiteral(spec)) continue;
    const match = /^@star-ng\/ui\/([\w-]+)$/.exec(spec.text);
    if (!match) continue;
    if (ts.isImportDeclaration(statement) && statement.importClause?.isTypeOnly) continue;
    if (ts.isExportDeclaration(statement) && statement.isTypeOnly) continue;
    names.push(match[1]);
  }
  return names;
}

/** The entry points that the shell reaches at start, sorted. */
function shellEntryPoints() {
  const seen = new Set();
  const queue = SHELL_FILES.flatMap((file) => entryImports(join(root, file)));
  while (queue.length) {
    const name = queue.shift();
    if (seen.has(name)) continue;
    seen.add(name);
    const folder = join(lib, name);
    for (const file of readdirSync(folder)) {
      if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
        queue.push(...entryImports(join(folder, file)));
      }
    }
  }
  return [...seen].sort();
}

/** Named value re-exports in an index file, as source text. */
function namedValueReExports(file) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);
  const bad = [];
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
    const clause = statement.exportClause;
    if (!clause) continue; // export * from './file'
    if (ts.isNamespaceExport(clause)) {
      bad.push(statement.getText(source));
      continue;
    }
    if (clause.elements.every((element) => element.isTypeOnly)) continue;
    bad.push(statement.getText(source));
  }
  return bad;
}

const entries = shellEntryPoints();

test('the docs shell reaches the core entry point (the list is derived from the shell imports)', () => {
  assert.ok(entries.includes('core'), `found: ${entries.join(', ')}`);
});

for (const name of entries) {
  test(`${name}/index.ts re-exports values with export * only`, () => {
    const bad = namedValueReExports(join(lib, name, 'index.ts'));
    assert.deepEqual(
      bad,
      [],
      `${name}/index.ts: use \`export *\` only (\`export type { ... }\` is fine). A named value ` +
        're-export puts every file of the entry point into the docs initial bundle. Give an ' +
        'internal helper the ɵ prefix, or move it to a file that index.ts does not re-export ' +
        '(CONTRIBUTING.md, "Public API scope").',
    );
  });
}

test('the public names of the shell entry points match tools/shell-public-api.json', () => {
  const config = ts.parseJsonConfigFileContent(
    ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile).config,
    ts.sys,
    root,
  );
  const files = entries.map((name) => join(lib, name, 'index.ts'));
  const program = ts.createProgram(files, { ...config.options, noEmit: true });
  const checker = program.getTypeChecker();
  const actual = {};
  for (const [index, name] of entries.entries()) {
    const module = checker.getSymbolAtLocation(program.getSourceFile(files[index]));
    actual[name] = module
      ? checker
          .getExportsOfModule(module)
          .map((symbol) => symbol.getName())
          .filter((exported) => !exported.startsWith('ɵ'))
          .sort()
      : [];
  }
  if (process.env['UPDATE_SHELL_API']) {
    writeFileSync(snapshotFile, `${JSON.stringify(actual, null, 2)}\n`);
  }
  const expected = JSON.parse(readFileSync(snapshotFile, 'utf8'));
  assert.deepEqual(
    actual,
    expected,
    'The public API of an entry point that the docs shell loads changed. Its index.ts uses ' +
      '`export *` (a named re-export would put the whole entry point into the docs initial ' +
      'bundle), so every exported name of a re-exported file is public. If the new name is ' +
      'meant to be public, update the snapshot: UPDATE_SHELL_API=1 node --test ' +
      'tools/barrels.test.mjs. If it is internal, give it the ɵ prefix or move it to a file ' +
      'that index.ts does not re-export.',
  );
});
