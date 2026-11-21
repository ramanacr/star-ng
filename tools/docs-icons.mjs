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
//   3. `EXTRA`: names that are built from data the scan cannot see (none today).
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
 * Icons that render from data the scan cannot see, as `weight: [names]`. Add a name here, with a
 * comment, only when a page builds the icon name at run time from data (none today).
 */
export const EXTRA = {};

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

/**
 * The icons of one string, as `[weight, name]` pairs. A string is split at its quotes, so every
 * attribute value and every quoted class string in a template is one unit: `ph-fill` and
 * `ph-funnel` in `'ph-fill ph-funnel'` belong together, and not to the `ph-bold` of the next
 * attribute.
 */
export function iconsOfString(string) {
  const pairs = [];
  // A `<star-icon>` tag counts below, with its own weight attribute.
  const STAR_ICON = /<star-icon\b([^>]*)>/g;
  for (const unit of string.replace(STAR_ICON, '').split(/["'`]/)) {
    const tokens = unit.match(/(?<![\w-])ph(?:-[a-z0-9]+)*(?![\w-])/g) ?? [];
    const weights = tokens.filter((t) => WEIGHT_CLASS.has(t)).map((t) => WEIGHT_CLASS.get(t));
    const names = tokens.filter((t) => !WEIGHT_CLASS.has(t)).map((t) => t.slice(3));
    for (const name of names) {
      for (const weight of weights.length ? weights : [DEFAULT_WEIGHT]) pairs.push([weight, name]);
    }
  }
  // `<star-icon name="truck" weight="fill" />`: the name has no `ph-` prefix.
  for (const m of string.matchAll(STAR_ICON)) {
    const attrs = m[1];
    const name = /(?:^|\s)name="([^"]+)"/.exec(attrs)?.[1];
    if (!name) continue;
    const weight = /(?:^|\s)weight="([^"]+)"/.exec(attrs)?.[1] ?? DEFAULT_WEIGHT;
    pairs.push([weight, name.trim().replace(/^ph-/, '')]);
  }
  return pairs;
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
  for (const dir of dirs) {
    for (const file of sourceFiles(dir)) {
      const where = posix(relative(root, file));
      for (const string of stringsOf(file, readFileSync(file, 'utf8'))) {
        for (const [weight, name] of iconsOfString(string)) add(used, weight, name, where);
      }
    }
  }
  for (const [weight, names] of Object.entries(extra)) {
    for (const name of names) add(used, weight, name, 'tools/docs-icons.mjs (EXTRA)');
  }
  const sorted = new Map();
  for (const weight of WEIGHTS.filter((w) => used.has(w))) {
    sorted.set(weight, new Map([...used.get(weight)].sort(([a], [b]) => (a < b ? -1 : 1))));
  }
  for (const weight of used.keys()) {
    if (!WEIGHTS.includes(weight)) throw new Error(`unknown Phosphor weight: ${weight}`);
  }
  return sorted;
}

/** Title case of a weight, as in the package file names (`Phosphor-Bold`). */
const title = (weight) => weight[0].toUpperCase() + weight.slice(1);

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
  const font = posix(
    relative(dirname(outFile), join(packageDir, weight, `Phosphor-${title(weight)}.woff2`)),
  );
  const src = /src:[^;]*;/.exec(fontFace)?.[0];
  if (!src || !src.includes(`Phosphor-${title(weight)}.woff2`)) {
    throw new Error(`@font-face of ${weight} has no WOFF2 source`);
  }
  return fontFace.replace(src, `src: url("${font}") format("woff2");`);
}

/** Text of the subset stylesheet. */
export function subsetText(used = usedIcons()) {
  const unknown = unknownIcons(used);
  if (unknown.length) throw new Error(`Phosphor has no icon:\n  ${unknown.join('\n  ')}`);
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
