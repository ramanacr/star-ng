// Guard of the styling hooks (pass-through `pt` and unstyled mode, see the guide "Styling hooks"):
//
// 1. Every public control (a component with a `star-*` element selector, without `@internal`)
//    has the host directive `StarStyled` (inputs `pt` and `unstyled`) and provides
//    `ɵSTAR_PART_HOST` in `viewProviders`.
// 2. Every element of every library template has a part name (`starPart="..."`), so a new
//    element cannot miss its hook. Left out: other controls (a tag with a dash), `ng-*` tags, line
//    breaks, and the inner nodes of an `<svg>` without a StarNG class (icon paths, gradients).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lib = join(root, 'projects/star-ng');

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, found);
    else if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) found.push(path);
  }
  return found;
}

/** The component decorators of a file: selector, config text, template text, JSDoc. */
function components(file) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const found = [];
  const constants = new Map();
  source.forEachChild((node) => {
    if (ts.isVariableStatement(node)) {
      for (const item of node.declarationList.declarations) {
        if (item.initializer && ts.isNoSubstitutionTemplateLiteral(item.initializer)) {
          constants.set(item.name.getText(), item.initializer.text);
        }
      }
    }
  });
  source.forEachChild((node) => {
    if (!ts.isClassDeclaration(node) || !node.name) return;
    for (const decorator of ts.getDecorators(node) ?? []) {
      const call = decorator.expression;
      if (!ts.isCallExpression(call) || call.expression.getText() !== 'Component') continue;
      const config = call.arguments[0];
      if (!config || !ts.isObjectLiteralExpression(config)) continue;
      const property = (key) =>
        config.properties.find(
          (item) => ts.isPropertyAssignment(item) && item.name.getText() === key,
        )?.initializer;
      const selector = property('selector')?.getText().slice(1, -1) ?? '';
      let template = '';
      const inline = property('template');
      if (inline && ts.isNoSubstitutionTemplateLiteral(inline)) template = inline.text;
      else if (inline && ts.isIdentifier(inline)) template = constants.get(inline.text) ?? '';
      const url = property('templateUrl');
      if (url) template = readFileSync(join(dirname(file), url.getText().slice(1, -1)), 'utf8');
      const docs = ts
        .getJSDocCommentsAndTags(node)
        .map((item) => item.getText())
        .join('\n');
      found.push({
        name: node.name.text,
        selector,
        config: config.getText(),
        template,
        internal: /@internal\b/.test(docs),
      });
    }
  });
  return found;
}

// SVG nodes that only define something (not drawn themselves).
const SVG_SKIP = new Set([
  'defs',
  'stop',
  'lineargradient',
  'radialgradient',
  'clippath',
  'mask',
  'title',
  'desc',
  'pattern',
  'marker',
  'symbol',
  'use',
  'filter',
  'foreignobject',
]);
const VOID = new Set(['input', 'img', 'br', 'hr', 'col', 'source', 'track', 'wbr', 'area']);

/** Start tags of a template without `starPart`. */
function unnamedElements(template) {
  const missing = [];
  const stack = [];
  const tag = /<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  const clean = template.replace(/<!--[\s\S]*?-->/g, '').replace(/\{\{[\s\S]*?\}\}/g, '');
  for (const [whole, name, attrs] of clean.matchAll(tag)) {
    const lower = name.toLowerCase();
    if (whole.startsWith('</')) {
      const at = stack.lastIndexOf(lower);
      if (at >= 0) stack.length = at;
      continue;
    }
    const selfClosing = attrs.trimEnd().endsWith('/');
    const inSvg = stack.includes('svg');
    if (!selfClosing && !VOID.has(lower)) stack.push(lower);
    if (name.includes('-') || lower.startsWith('ng') || lower === 'br' || lower === 'wbr') continue;
    if (inSvg && (SVG_SKIP.has(lower) || !/class="[^"]*\bstar-/.test(attrs))) continue;
    if (!/\bstarPart=/.test(attrs)) missing.push(`<${name}${attrs.slice(0, 60)}`);
  }
  return missing;
}

const all = walk(lib).flatMap((file) =>
  components(file).map((item) => ({ ...item, file: relative(root, file) })),
);

test('the scan finds the controls', () => {
  assert.ok(all.length > 150, `only ${all.length} components found`);
});

test('every public control has the StarStyled host directive and the part host', () => {
  const missing = all
    .filter((item) => /^star-[a-z0-9-]+$/.test(item.selector) && !item.internal)
    .filter((item) => !/\bStarStyled\b/.test(item.config) || !/ɵSTAR_PART_HOST/.test(item.config))
    .map((item) => `${item.name} (${item.file})`);
  assert.deepEqual(missing, []);
});

test('every element of a control template has a part name', () => {
  const missing = all.flatMap((item) =>
    unnamedElements(item.template).map((element) => `${item.name}: ${element}`),
  );
  assert.deepEqual(missing, []);
});

test('the check finds an element without a part', () => {
  assert.deepEqual(unnamedElements('<div starPart="a"><span class="x">1</span></div>'), [
    '<span class="x"',
  ]);
  assert.deepEqual(unnamedElements('<star-button /><ng-container /><svg><path d="M0" /></svg>'), [
    '<svg',
  ]);
});
