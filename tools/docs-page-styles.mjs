// Route-level CSS of the docs application.
//
// The docs shell loads only the critical CSS globally (`projects/docs/src/styles.scss`): tokens,
// base rules, unstyled mode, the docs layout, and the partials of the controls that the shell
// itself renders on every page. Every page component loads the partials of the controls it shows
// through its own stylesheet (`<page>.scss` next to the page, `ViewEncapsulation.None`). Angular
// puts that CSS in the lazy chunk of the route, and the prerender writes it into the HTML of the
// page, so a page never paints without its styles.
//
// This tool derives the partials of each page from the class names and element names that can
// render there (the strings of the source files, without comments):
//   1. The page file and the docs files it imports (example components, dialogs, demo data).
//   2. The library files that declare the controls those files import, with their own imports (a
//      table imports the paginator, a date picker the select): templates, host classes, class
//      strings. An imported type or interface renders nothing and does not count.
// A partial is needed when one of its selectors can match: every `star-*` class and element name
// of the selector (outside `:not()`, `:is()`, `:where()`, `:has()` and attribute brackets) is in
// that vocabulary. A string such as `'star-tag--'` + severity counts as a prefix. The shell list
// is the same rule applied to `app.ts`.
//
// The cascade is the cascade of `star-ng.css` followed by the docs layout, by construction:
//   - Every list follows the order in which Sass emits the partials in `star-ng.css`
//     (dependencies first).
//   - A page stylesheet comes after the global one. It repeats every shell partial that
//     `star-ng.css` emits after the first partial of the page, and it ends with the docs layout
//     (`_docs-layout.scss`), so each rule keeps its place relative to the others.
//   - `_unstyled.scss` stays global: its rules have zero specificity or are on `:root`, and no
//     control rule ties with them (the test checks this).
//   - A page with its own component styles keeps them in a child component (`<name>Content`),
//     whose styles Angular adds after the route styles.
//
//   node tools/docs-page-styles.mjs           writes the page stylesheets and the shell list
//   node tools/docs-page-styles.mjs --check   fails when a written file is out of date
//
// `tools/docs-page-styles.test.mjs` checks the coverage of every page and the cascade order.
import { existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import ts from 'typescript';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(root, 'projects/star-ng/styles');
const libDir = join(root, 'projects/star-ng');
const appDir = join(root, 'projects/docs/src/app');
/** Shell stylesheet of the docs: the generated block between the two marker lines is checked. */
export const shellStylesFile = join(root, 'projects/docs/src/styles.scss');
const SHELL_BEGIN = '// <docs-page-styles shell>';
const SHELL_END = '// </docs-page-styles shell>';
/** Partials that are not controls: always global, in this order around the control partials. */
const BASE_FIRST = ['tokens', 'base'];
const BASE_LAST = ['unstyled'];

const posix = (path) => path.split('\\').join('/');

/** `@use` targets of an SCSS file that are modules of the library styles (no `sass:` modules). */
function scssUses(file) {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(/^@use '([^']+)'/gm)]
    .map((m) => m[1])
    .filter((target) => !target.startsWith('sass:'));
}

function partialFile(name) {
  const parts = name.split('/');
  parts[parts.length - 1] = `_${parts.at(-1)}.scss`;
  return join(stylesDir, ...parts);
}

/**
 * The library partials in the order of the compiled `star-ng.css`. Sass emits the CSS of a module
 * the first time it is used, after the CSS of its own dependencies: `controls/input-number` uses
 * `select`, so the select rules come before the input-number rules, and before `select-button`.
 */
let emission = null;
export function emissionOrder() {
  if (emission) return emission;
  const entries = scssUses(join(stylesDir, 'star-ng.scss'));
  const known = new Set(entries);
  const order = [];
  const deps = new Map();
  const visit = (name) => {
    if (order.includes(name)) return;
    const own = scssUses(partialFile(name))
      .map((target) => posix(relative(stylesDir, resolve(dirname(partialFile(name)), target))))
      .filter((target) => known.has(target));
    deps.set(name, own);
    for (const dep of own) visit(dep);
    order.push(name);
  };
  for (const entry of entries) visit(entry);
  emission = { order, deps };
  return emission;
}

const compileCache = new Map();
function compileUse(names) {
  const key = names.join(',');
  if (!compileCache.has(key)) {
    const source = names.map((name) => `@use '${name}';`).join('\n');
    compileCache.set(
      key,
      sass.compileString(source, { loadPaths: [stylesDir], style: 'compressed' }).css,
    );
  }
  return compileCache.get(key);
}

/** Every complex selector of a compiled `@use` list. */
function selectorsOf(names) {
  return selectorLists(compileUse(names)).flatMap(splitList);
}

/**
 * The selectors that a partial adds itself, without those of the partials it uses. A partial that
 * extends a rule of another (`@extend` of the select icon button) adds its selectors to that rule:
 * they count for the partial that extends.
 */
function ownSelectors(name, deps) {
  const all = selectorsOf([name]);
  const own = deps.get(name) ?? [];
  if (!own.length) return all;
  const before = new Set(selectorsOf(own));
  return all.filter((selector) => !before.has(selector));
}

/** Selector lists of a compressed stylesheet (at-rule preludes left out). */
function selectorLists(css) {
  const lists = [];
  for (const m of css.matchAll(/([^{};]+)\{/g)) {
    const prelude = m[1].trim();
    if (!prelude || prelude.startsWith('@')) continue;
    lists.push(prelude);
  }
  return lists;
}

/** Splits a selector list at the commas outside brackets and parentheses. */
function splitList(list) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ',' && depth === 0) {
      out.push(list.slice(start, i));
      start = i + 1;
    }
  }
  out.push(list.slice(start));
  return out.map((s) => s.trim()).filter(Boolean);
}

/** Removes `[...]` and the argument of every functional pseudo-class. */
function stripOptional(selector) {
  let out = '';
  let depth = 0;
  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (c === '[' || c === '(') depth++;
    if (depth === 0) out += c;
    if (c === ']' || c === ')') depth--;
  }
  return out;
}

/**
 * The `star-*` classes and element names that a selector needs. An empty list means the selector
 * needs no control vocabulary (`:root`, `[data-star-unstyled]`, `0%`): it never pulls a partial in.
 */
export function requiredTokens(selector) {
  const plain = stripOptional(selector);
  const tokens = new Set();
  for (const m of plain.matchAll(/(^|[\s>+~.])(star-[a-z0-9_-]+)/g)) tokens.add(m[2]);
  return [...tokens];
}

const partialCache = new Map();
/** Each partial with the token lists of its selectors. */
export function partials() {
  if (partialCache.size) return partialCache;
  const { order, deps } = emissionOrder();
  for (const name of order) {
    const selectors = ownSelectors(name, deps)
      .map(requiredTokens)
      .filter((tokens) => tokens.length);
    partialCache.set(name, { name, deps: deps.get(name) ?? [], selectors });
  }
  return partialCache;
}

/** Strings of a TypeScript file (templates, host bindings, class names), without its comments. */
function stringsOf(path, text) {
  if (path.endsWith('.html')) return [text];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
  const out = [];
  const visit = (node) => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      out.push(node.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/**
 * `star-*` words of a source file: class names, element names, class prefixes. Only the strings
 * count (a template is a string), without HTML comments: a comment that names a control does not
 * render it.
 */
function words(path, text) {
  const set = new Set();
  for (const string of stringsOf(path, text)) {
    for (const word of string.replace(/<!--[^]*?-->/g, '').match(/star-[a-z0-9_-]*/g) ?? []) {
      set.add(word);
    }
  }
  return set;
}

function resolveTs(from, target) {
  const base = resolve(dirname(from), target);
  for (const path of [base, `${base}.ts`, join(base, 'index.ts')]) {
    if (existsSync(path) && /\.(ts|html)$/.test(path)) return path;
  }
  throw new Error(`${relative(root, from)}: cannot resolve ${target}`);
}

const fileCache = new Map();
/**
 * Words and imports of a source file. An import of a library entry point keeps the imported
 * names, so only the files that declare them count (`StarSpeedDial` of `@star-ng/ui/utility`
 * renders the speed dial, not every utility control).
 */
function parseFile(path) {
  if (fileCache.has(path)) return fileCache.get(path);
  const text = readFileSync(path, 'utf8');
  const info = { text, words: words(path, text), files: [], entries: [], exports: [] };
  fileCache.set(path, info);
  if (path.endsWith('.html')) return info;
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false);
  for (const statement of source.statements) {
    const isImport = ts.isImportDeclaration(statement);
    if (!isImport && !ts.isExportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier;
    if (!specifier || !ts.isStringLiteral(specifier)) continue;
    let names = null;
    if (isImport) {
      const bindings = statement.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) {
        names = bindings.elements.map((e) => (e.propertyName ?? e.name).text);
      }
    } else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      names = statement.exportClause.elements.map((e) => (e.propertyName ?? e.name).text);
    }
    const target = specifier.text;
    if (target.startsWith('.')) {
      const file = resolveTs(path, target);
      if (posix(relative(appDir, file)).startsWith('generated/')) continue;
      info.files.push(file);
      if (!isImport) info.exports.push({ file, names });
    } else if (target.startsWith('@star-ng/ui/')) {
      info.entries.push({ entry: target.slice('@star-ng/ui/'.length), names });
    } else if (target === '@star-ng/ui') {
      throw new Error(`${relative(root, path)}: import an entry point, not @star-ng/ui`);
    }
  }
  for (const m of text.matchAll(/templateUrl: '([^']+)'/g)) info.files.push(resolveTs(path, m[1]));
  return info;
}

/**
 * The file that declares an exported name, following `export ... from` re-exports, and the kind
 * of declaration (`class`, `const`, `interface`...).
 */
function declaringFile(path, name, seen = new Set()) {
  if (seen.has(path)) return null;
  seen.add(path);
  const info = parseFile(path);
  // Names are identifiers (letters, digits, _, $ and the ɵ prefix): escape $ only.
  const declared = new RegExp(
    String.raw`export\s+(?:declare\s+)?(?:abstract\s+)?(class|function|const|let|enum|interface|type)\s+` +
      name.replaceAll('$', String.raw`\$`) +
      String.raw`\b`,
  ).exec(info.text);
  if (declared) return { file: path, kind: declared[1] };
  for (const re of info.exports) {
    if (re.names && !re.names.includes(name)) continue;
    const found = declaringFile(re.file, name, seen);
    if (found) return found;
  }
  return null;
}

/**
 * Files of a library entry point that an import uses: the files that declare the imported values
 * (a type or an interface renders nothing), or the whole entry point when a name is not found.
 */
function entryFiles(entry, names) {
  const index = join(libDir, entry, 'index.ts');
  if (!existsSync(index)) throw new Error(`unknown entry point @star-ng/ui/${entry}`);
  const all = () => parseFile(index).exports.map((re) => re.file);
  if (!names) return all();
  const files = [];
  for (const name of names) {
    const found = declaringFile(index, name);
    if (!found) return all();
    if (found.kind !== 'interface' && found.kind !== 'type') files.push(found.file);
  }
  return files;
}

/**
 * The vocabulary of a docs file: its words, and the words of every file it renders through its
 * static imports: docs files (example components, dialogs; not the generated API and example
 * data, which the page shows as text) and the library files that declare the imported controls,
 * with their own imports (a table imports the paginator, a date picker the select).
 */
const vocabularyCache = new Map();
export function vocabulary(file) {
  if (vocabularyCache.has(file)) return vocabularyCache.get(file);
  const vocab = new Set();
  const files = [];
  const entries = new Set();
  const seen = new Set();
  const visit = (path) => {
    if (seen.has(path)) return;
    seen.add(path);
    files.push(path);
    const info = parseFile(path);
    for (const word of info.words) vocab.add(word);
    for (const dep of info.files) visit(dep);
    for (const { entry, names } of info.entries) {
      entries.add(entry);
      for (const dep of entryFiles(entry, names)) visit(dep);
    }
  };
  visit(file);
  const result = { vocab, files, entries: [...entries].sort() };
  vocabularyCache.set(file, result);
  return result;
}

function covers(vocab, prefixes, token) {
  if (vocab.has(token)) return true;
  return prefixes.some((prefix) => token.startsWith(prefix));
}

/** The control partials that a vocabulary needs, in the emission order. */
export function neededPartials(vocab) {
  const prefixes = [...vocab].filter((word) => word.endsWith('-') && word.length > 'star-'.length);
  const needed = [];
  for (const partial of partials().values()) {
    if (BASE_FIRST.includes(partial.name) || BASE_LAST.includes(partial.name)) continue;
    if (partial.selectors.some((tokens) => tokens.every((t) => covers(vocab, prefixes, t)))) {
      needed.push(partial.name);
    }
  }
  return needed;
}

/** The docs pages: every file that a route of the docs loads (`import('./...')`). */
export function pageFiles() {
  const files = new Set();
  for (const source of ['nav.ts', 'app.routes.ts']) {
    const text = readFileSync(join(appDir, source), 'utf8');
    for (const m of text.matchAll(/import\('(\.\/[^']+)'\)/g)) {
      files.add(resolveTs(join(appDir, source), m[1]));
    }
  }
  return [...files].sort();
}

/** A set of partials with every partial they use, in the emission order. */
export function withDeps(names) {
  const { order, deps } = emissionOrder();
  const set = new Set();
  const add = (name) => {
    if (set.has(name)) return;
    set.add(name);
    for (const dep of deps.get(name) ?? []) add(dep);
  };
  names.forEach(add);
  return order.filter((name) => set.has(name));
}

/** Global control partials: the ones that the shell (`app.ts`) renders on every page. */
let shellCache = null;
export function shellPartials() {
  shellCache ??= withDeps(neededPartials(vocabulary(join(appDir, 'app.ts')).vocab));
  return shellCache;
}

/** Control partials that a page renders and the shell does not load. */
export function pagePartials(pageFile, shell = shellPartials()) {
  return withDeps(neededPartials(vocabulary(pageFile).vocab)).filter((n) => !shell.includes(n));
}

/**
 * The partials of a page stylesheet, in the emission order: the partials of the page, and every
 * shell partial that `star-ng.css` emits after the first of them. A page stylesheet comes after
 * the global one, so a shell partial that it does not repeat stays before all of its partials, as
 * in `star-ng.css`; a repeated one keeps its place among them. The cascade of the library is the
 * cascade of `star-ng.css`.
 */
export function pageSheetPartials(pageFile, shell = shellPartials()) {
  const own = pagePartials(pageFile, shell);
  if (!own.length) return [];
  const { order } = emissionOrder();
  // Sass emits the dependencies of a page partial in the page stylesheet as well.
  const emitted = withDeps(own);
  const first = Math.min(...emitted.map((name) => order.indexOf(name)));
  return withDeps([...emitted, ...shell.filter((name) => order.indexOf(name) > first)]);
}

/** The stylesheet of a page component: `select.page.ts` → `select.page.scss`. */
export function pageStylesFile(pageFile) {
  return pageFile.replace(/\.ts$/, '.scss');
}

function useLine(fromFile, target) {
  return `@use '${posix(relative(dirname(fromFile), target))}';`;
}

/** The docs layout partial (`projects/docs/src/_docs-layout.scss`). */
const layoutFile = join(root, 'projects/docs/src/docs-layout');

/** Text of a page stylesheet, or `null` for a page that the global stylesheet covers. */
export function pageStylesText(pageFile, shell = shellPartials()) {
  const names = pageSheetPartials(pageFile, shell);
  if (!names.length) return null;
  return [
    '// Route styles of this page. Generated by tools/docs-page-styles.mjs: do not edit; run the',
    '// tool after a change of the controls on the page.',
    '// 1. The partials of the controls on the page, with the shell partials that star-ng.css emits',
    '//    after the first of them, in the order of star-ng.css.',
    '// 2. The docs layout again: in styles.scss it comes after the library.',
    ...names.map((name) => useLine(pageFile, join(stylesDir, name))),
    useLine(pageFile, layoutFile),
    '',
  ].join('\n');
}

export function shellBlockText(shell = shellPartials()) {
  return [
    SHELL_BEGIN,
    '// Critical CSS, generated by tools/docs-page-styles.mjs: tokens, base rules, the controls that',
    '// the shell renders on every page (header, toast, confirm dialog), unstyled mode. Each page',
    '// loads the partials of its own controls (`<page>.scss`).',
    ...[...BASE_FIRST, ...shell, ...BASE_LAST].map((n) =>
      useLine(shellStylesFile, join(stylesDir, n)),
    ),
    SHELL_END,
  ].join('\n');
}

/** Replaces the generated block of `styles.scss`. */
export function shellStylesText(current, shell = shellPartials()) {
  const start = current.indexOf(SHELL_BEGIN);
  const end = current.indexOf(SHELL_END);
  if (start < 0 || end < start) throw new Error(`styles.scss has no ${SHELL_BEGIN} block`);
  return current.slice(0, start) + shellBlockText(shell) + current.slice(end + SHELL_END.length);
}

/** Every file that the tool writes, with its expected text (`null`: the file must not exist). */
export function expectedFiles() {
  const shell = shellPartials();
  const files = [[shellStylesFile, shellStylesText(readFileSync(shellStylesFile, 'utf8'), shell)]];
  for (const page of pageFiles()) files.push([pageStylesFile(page), pageStylesText(page, shell)]);
  // A generated stylesheet whose page is gone (renamed, removed) must go as well.
  const known = new Set(files.map(([file]) => file));
  for (const file of generatedSheets()) if (!known.has(file)) files.push([file, null]);
  return files;
}

/** First line of every generated page stylesheet. */
const GENERATED_MARK = '// Route styles of this page. Generated by tools/docs-page-styles.mjs';

/** Every stylesheet under `projects/docs/src/app` that this tool generated. */
export function generatedSheets(dir = appDir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...generatedSheets(path));
    else if (
      entry.name.endsWith('.scss') &&
      readFileSync(path, 'utf8').startsWith(GENERATED_MARK)
    ) {
      out.push(path);
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const stale = [];
  for (const [file, text] of expectedFiles()) {
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current === text) continue;
    if (check) stale.push(posix(relative(root, file)));
    else if (text === null) unlinkSync(file);
    else writeFileSync(file, text);
  }
  if (check && stale.length) {
    console.error(`Out of date (run node tools/docs-page-styles.mjs):\n  ${stale.join('\n  ')}`);
    process.exit(1);
  }
  console.log(check ? 'docs page styles: up to date' : 'docs page styles: written');
}
