// Phosphor icon subset of the docs application.
//
// The package stylesheets of `@phosphor-icons/web` (one per weight) hold an `@font-face`, a base
// rule (`.ph-bold`) and one `:before` rule per icon: more than 1,500 icons, about 75 kB per weight.
// The docs use a few hundred of them. This tool writes one stylesheet for the docs with the
// `@font-face` rule and the base rule of each weight that the docs use, and only the `:before`
// rules of the icons that can render. The rules are read from the package CSS at the time the tool
// runs: nothing is copied by hand. The package does not change for consumers: they still load
// `@phosphor-icons/web` as documented.
//
// The used icons come from the strings of the library and docs sources (templates, host bindings,
// class strings, generated docs data), without comments and without spec files:
//   1. Every `ph-<name>` class. Its weight is the `ph-<weight>` class in the same quoted value
//      (`'ph-fill ph-funnel'`); a name without a weight next to it counts for the default weight.
//   2. The `name` of every `<star-icon>` with its `weight` (`StarIcon` builds `ph-${name}` at run
//      time; default weight bold).
//   3. `[class.ph-<name>]` bindings, with the weight class of the same element.
//   4. `EXTRA`: bound names that are built from data the scan cannot see; a bound
//      `<star-icon [name]>` that is not a literal and has no entry fails the tool.
// A name that the package does not have is an error (a typo in a source file).
//
//   node tools/docs-icons.mjs           writes the subset stylesheet
//   node tools/docs-icons.mjs --check   fails when the stylesheet is out of date
//
// `tools/docs-icons.test.mjs` checks the output and the names.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
/** The generated stylesheet that `angular.json` (docs `styles`) loads. */
export const outFile = join(root, 'projects/docs/src/generated/phosphor-subset.css');
export const packageDir = join(root, 'node_modules/@phosphor-icons/web/src');
/** Source folders that are scanned (spec files are left out). */
export const sourceDirs = [join(root, 'projects/star-ng'), join(root, 'projects/docs/src')];
/** Weights of the package; `regular` uses the class `ph`, the others `ph-<weight>`. */
export const WEIGHTS = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];
/** The weight of a name that has no weight class next to it (the default of `StarIcon`). */
export const DEFAULT_WEIGHT = 'bold';
/**
 * Bound icon names that the scan cannot read (`<star-icon [name]="icon">`), with the names they
 * can take: `{ file, expression, weight, names }`, `file` relative to the repository, and
 * `expression` as the scan reports it (`[name]="icon"`). Add an entry, with a comment, only
 * when a page builds the icon name at run time from data. A bound name that has no entry fails
 * the tool.
 */
export const EXTRA = [
  // The empty state draws the default icon of its variant, or the Phosphor name of its `icon`
  // input. The docs pages pass `icon` with the `ph-` prefix, so the scan finds those names.
  {
    file: 'projects/star-ng/empty-state/empty-state.ts',
    expression: '[name]="name"',
    weight: 'bold',
    names: ['tray', 'magnifying-glass', 'warning-circle', 'check-circle'],
  },
];

const posix = (path) => path.split('\\').join('/');
const WEIGHT_CLASS = new Map(WEIGHTS.map((w) => [w === 'regular' ? 'ph' : `ph-${w}`, w]));

/** Strings of a source file, without comments: every string of a TS file, an HTML file whole. */
export function stringsOf(path, text) {
  if (path.endsWith('.html')) return [text.replace(/<!--[^]*?-->/g, '')];
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
      out.push(node.text.replace(/<!--[^]*?-->/g, ''));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** Adds a name to the set of a weight. */
function add(used, weight, name, where) {
  if (!used.has(weight)) used.set(weight, new Map());
  const names = used.get(weight);
  if (!names.has(name)) names.set(name, where);
}

/** A start tag: its name and attributes (a `>` inside a quoted value does not end it). */
const TAG = /<([a-z][a-z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
/** An attribute with a quoted value: `name="v"`, `name='v'`, `[name]="expr"`, `[class.x]="e"`. */
const ATTR = /(^|\s)([[(]?[\w.:@-]+[\])]?)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

/** The string of a bound expression that is a plain literal (`'truck'`), else `null`. */
function literalOf(expression) {
  return /^\s*(['"])([^'"]*)\1\s*$/.exec(expression)?.[2] ?? null;
}

/** The attributes of a tag, by name (`name`, `[name]`, `[class.ph-x]`), with their raw text. */
function attributesOf(text) {
  const out = [];
  for (const m of text.matchAll(ATTR)) {
    out.push({ key: m[2], value: m[3] ?? m[4] ?? '', raw: m[0] });
  }
  return out;
}

/**
 * The icons of one string, as `[weight, name]` pairs, and the bound icon names that are not
 * literals (`unresolved`: `{ expression }`). Three passes:
 *   1. `<star-icon>` tags (exactly that element, not `<star-icon-field>`): `name` and `weight`,
 *      static (`name="truck"`, `name='truck'`) or bound to a literal (`[name]="'truck'"`). A bound
 *      name or weight that is not a literal is unresolved.
 *   2. Class bindings `[class.ph-<name>]` on any tag: the weight is the weight class of the
 *      static `class` attribute of the same tag (`class="ph-bold"`, `class="ph"` for regular).
 *   3. Every other text: the string is split at its quotes, so every attribute value and every
 *      quoted class string in a template is one unit; `ph-fill` and `ph-funnel` in
 *      `'ph-fill ph-funnel'` belong together, and not to the `ph-bold` of the next attribute.
 *      This pass reads `icon="ph-bold ph-envelope-simple"` on any control.
 * A name without a weight next to it counts for the default weight.
 */
export function scanString(string) {
  const pairs = [];
  const unresolved = [];
  const rest = string.replace(TAG, (tag, element, text) => {
    const attrs = attributesOf(text);
    if (element === 'star-icon') {
      const read = (key) => {
        const plain = attrs.find((a) => a.key === key);
        if (plain) return plain.value;
        const bound = attrs.find((a) => a.key === `[${key}]`);
        if (!bound) return undefined;
        const value = literalOf(bound.value);
        if (value === null) unresolved.push({ expression: `[${key}]="${bound.value}"` });
        return value;
      };
      const name = read('name');
      const weight = read('weight') ?? DEFAULT_WEIGHT;
      if (name && weight) pairs.push([weight, name.trim().replace(/^ph-/, '')]);
      return '';
    }
    const bindings = attrs.filter((a) => /^\[class\.ph-[a-z0-9-]+\]$/.test(a.key));
    if (!bindings.length) return tag;
    const classes = (attrs.find((a) => a.key === 'class')?.value ?? '').split(/\s+/);
    const weights = classes.filter((c) => WEIGHT_CLASS.has(c)).map((c) => WEIGHT_CLASS.get(c));
    for (const binding of bindings) {
      const name = binding.key.slice('[class.ph-'.length, -1);
      for (const weight of weights.length ? weights : [DEFAULT_WEIGHT]) pairs.push([weight, name]);
    }
    let kept = tag;
    for (const binding of bindings) kept = kept.replace(binding.raw, ' ');
    return kept;
  });
  for (const unit of rest.split(/["'`]/)) {
    const tokens = unit.match(/(?<![\w-])ph(?:-[a-z0-9]+)*(?![\w-])/g) ?? [];
    const weights = tokens.filter((t) => WEIGHT_CLASS.has(t)).map((t) => WEIGHT_CLASS.get(t));
    const names = tokens.filter((t) => !WEIGHT_CLASS.has(t)).map((t) => t.slice(3));
    for (const name of names) {
      for (const weight of weights.length ? weights : [DEFAULT_WEIGHT]) pairs.push([weight, name]);
    }
  }
  return { pairs, unresolved };
}

/** The `[weight, name]` pairs of one string (see `scanString`). */
export function iconsOfString(string) {
  return scanString(string).pairs;
}

/** Source files of a folder: `.ts` and `.html`, without spec files. */
export function sourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') out.push(...sourceFiles(path));
    } else if (/\.(ts|html)$/.test(entry.name) && !/\.spec\.ts$/.test(entry.name)) {
      out.push(path);
    }
  }
  return out.sort();
}

/**
 * The used icons: a map weight → map name → the first file that uses it. Weights and names are
 * sorted.
 */
export function usedIcons(dirs = sourceDirs, extra = EXTRA) {
  const used = new Map();
  const unresolved = [];
  for (const dir of dirs) {
    for (const file of sourceFiles(dir)) {
      const where = posix(relative(root, file));
      for (const string of stringsOf(file, readFileSync(file, 'utf8'))) {
        const found = scanString(string);
        for (const [weight, name] of found.pairs) add(used, weight, name, where);
        for (const { expression } of found.unresolved) {
          const entry = extra.find((e) => e.file === where && e.expression === expression);
          if (!entry) unresolved.push(`${where}: ${expression}`);
          else for (const name of entry.names) add(used, entry.weight, name, `${where} (EXTRA)`);
        }
      }
    }
  }
  const sorted = new Map();
  for (const weight of WEIGHTS.filter((w) => used.has(w))) {
    sorted.set(weight, new Map([...used.get(weight)].sort(([a], [b]) => (a < b ? -1 : 1))));
  }
  for (const weight of used.keys()) {
    if (!WEIGHTS.includes(weight)) throw new Error(`unknown Phosphor weight: ${weight}`);
  }
  /** Bound icon names that are no literal and have no `EXTRA` entry. */
  sorted.unresolved = unresolved;
  return sorted;
}

/**
 * The package stylesheet of a weight, parsed: its `@font-face` rule, the base rule of the weight
 * class and the `:before` rule of every icon.
 */
const packageCache = new Map();
export function packageWeight(weight) {
  if (packageCache.has(weight)) return packageCache.get(weight);
  const file = join(packageDir, weight, 'style.css');
  const css = readFileSync(file, 'utf8');
  const cls = weight === 'regular' ? 'ph' : `ph-${weight}`;
  const fontFace = /@font-face\s*\{[^}]*\}/.exec(css)?.[0];
  const base = new RegExp(String.raw`(^|\n)\.${cls}\s*\{[^}]*\}`).exec(css)?.[0].trim();
  if (!fontFace || !base) throw new Error(`${file}: no @font-face or .${cls} rule`);
  const icons = new Map();
  const re = new RegExp(String.raw`\.${cls}\.ph-([a-z0-9-]+):before\s*\{[^}]*\}`, 'g');
  for (const m of css.matchAll(re)) icons.set(m[1], m[0]);
  // A leading licence comment, if a later version of the package adds one, stays with the rules.
  const licence = /^\s*(\/\*[^]*?\*\/)/.exec(css)?.[1] ?? null;
  const parsed = { file, cls, fontFace, base, icons, licence };
  packageCache.set(weight, parsed);
  return parsed;
}

/** Names that the package does not have, as `weight ph-name (file)` lines. */
export function unknownIcons(used = usedIcons()) {
  const unknown = [];
  for (const [weight, names] of used) {
    const { icons } = packageWeight(weight);
    for (const [name, where] of names) {
      if (!icons.has(name)) unknown.push(`${weight} ph-${name} (${where})`);
    }
  }
  return unknown;
}

/**
 * The `@font-face` rule with the package font as a URL relative to the generated file. Only the
 * WOFF2 source stays: every browser that the docs support loads it, and the build then copies one
 * font file per weight instead of four.
 */
function fontFaceRule(weight, fontFace) {
  const src = /src:[^;]*;/.exec(fontFace)?.[0];
  // The file name comes from the package rule (`Phosphor-Bold.woff2`, `Phosphor.woff2` for regular).
  const file = src && /url\("\.\/([^"]+\.woff2)"\)/.exec(src)?.[1];
  if (!file) throw new Error(`@font-face of ${weight} has no WOFF2 source`);
  const font = posix(relative(dirname(outFile), join(packageDir, weight, file)));
  return fontFace.replace(src, `src: url("${font}") format("woff2");`);
}

/** Text of the subset stylesheet. */
export function subsetText(used = usedIcons()) {
  const unknown = unknownIcons(used);
  if (unknown.length) throw new Error(`Phosphor has no icon:\n  ${unknown.join('\n  ')}`);
  if (used.unresolved?.length) {
    throw new Error(
      `Bound icon names that are no literal (add them to EXTRA):\n  ${used.unresolved.join('\n  ')}`,
    );
  }
  const out = [
    '/*',
    ' * Phosphor icon subset of the docs. Generated by tools/docs-icons.mjs: do not edit; run',
    ' * `corepack pnpm docs:icons` after a change of the icons in the library or the docs.',
    ' * Rules and fonts: @phosphor-icons/web (MIT licence, see THIRD_PARTY_NOTICES.md).',
    ' */',
  ];
  for (const [weight, names] of used) {
    const pkg = packageWeight(weight);
    out.push('');
    out.push(`/* ${weight}: ${names.size} of ${pkg.icons.size} icons */`);
    if (pkg.licence) out.push(pkg.licence);
    out.push(fontFaceRule(weight, pkg.fontFace), '', pkg.base, '');
    for (const name of names.keys()) out.push(pkg.icons.get(name));
  }
  return `${out.join('\n')}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const text = subsetText();
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : null;
  if (current !== text) {
    if (check) {
      console.error(
        `Out of date (run node tools/docs-icons.mjs):\n  ${posix(relative(root, outFile))}`,
      );
      process.exit(1);
    }
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, text);
  }
  const counts = [...usedIcons()].map(([w, names]) => `${w} ${names.size}`).join(', ');
  console.log(`docs icons: ${check ? 'up to date' : 'written'} (${counts})`);
}
