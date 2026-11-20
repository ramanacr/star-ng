// Guard of the styling hooks (pass-through `pt` and unstyled mode, see the guide "Styling hooks"):
//
// 1. Every public control (a component with a `star-*` element selector, without `@internal`)
//    has the host directive `StarStyled` (inputs `pt` and `unstyled`) and provides
//    `ɵSTAR_PART_HOST` in `viewProviders`.
// 2. Every element of every library template has a part name (the static attribute
//    `data-star-part="..."`, or `starPart="..."` on the top element of an `ng-template`), so a new
//    element cannot miss its hook. Left out: other controls (a tag with a dash), `ng-*` tags, line
//    breaks, and the inner nodes of an `<svg>` without a StarNG class (icon paths, gradients).
import { parseTemplate } from '@angular/compiler';
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
/**
 * Elements without a part on purpose, for speed (one element per data point): the invisible
 * pointer targets of a chart, and the rows and cells of the chart data table (the part `table`
 * styles them with descendant classes). A 5,000-point chart has 30,000 such elements.
 */
const NO_PART = /class="[^"]*\bstar-chart__hit\b/;
const NO_PART_INSIDE = /class="[^"]*\bstar-chart__table\b/;

/** Start tags of a template without a part name. */
function unnamedElements(template) {
  const missing = [];
  const stack = [];
  let quietAt = -1;
  const tag = /<\/?([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  const clean = template.replace(/<!--[\s\S]*?-->/g, '').replace(/\{\{[\s\S]*?\}\}/g, '');
  for (const [whole, name, attrs] of clean.matchAll(tag)) {
    const lower = name.toLowerCase();
    if (whole.startsWith('</')) {
      const at = stack.lastIndexOf(lower);
      if (at >= 0) stack.length = at;
      if (quietAt >= stack.length) quietAt = -1;
      continue;
    }
    const selfClosing = attrs.trimEnd().endsWith('/');
    const inSvg = stack.includes('svg');
    const quiet = quietAt >= 0;
    if (!selfClosing && !VOID.has(lower)) {
      if (!quiet && NO_PART_INSIDE.test(attrs)) quietAt = stack.length;
      stack.push(lower);
    }
    if (quiet || NO_PART.test(attrs)) continue;
    if (name.includes('-') || lower.startsWith('ng') || lower === 'br' || lower === 'wbr') continue;
    if (inSvg && (SVG_SKIP.has(lower) || !/class="[^"]*\bstar-/.test(attrs))) continue;
    // Visually hidden text is not a part: a class could show it or hide it from screen readers.
    if (/class="[^"]*\bstar-sr-only\b/.test(attrs)) continue;
    if (!/(^|\s)(starPart|data-star-part)=/.test(attrs))
      missing.push(`<${name}${attrs.slice(0, 60)}`);
  }
  return missing;
}

/**
 * The parts of a template: name, the StarNG classes and the branch choices on the way to the
 * element (`[block, branch]` of each `@if`, `@switch` and `@for`/`@empty` around it).
 */
function partsOf(template) {
  const parts = [];
  let blocks = 0;
  const visit = (nodes, path) => {
    for (const node of nodes ?? []) {
      const kind = node.constructor.name;
      if (kind === 'Element') {
        const attrs = Object.fromEntries(node.attributes.map((item) => [item.name, item.value]));
        const partName = attrs.starPart ?? attrs['data-star-part'];
        if (partName) {
          const classes = (attrs.class ?? '')
            .split(/\s+/)
            .filter((item) => item.startsWith('star-'));
          parts.push({ name: partName, classes, path, tag: node.name });
        }
        visit(node.children, path);
      } else if (kind === 'IfBlock' || kind === 'SwitchBlock') {
        const id = blocks++;
        (node.branches ?? node.groups ?? node.cases ?? []).forEach((branch, index) =>
          visit(branch.children, [...path, [id, index]]),
        );
      } else if (kind === 'ForLoopBlock') {
        const id = blocks++;
        visit(node.children, [...path, [id, 0]]);
        if (node.empty) visit(node.empty.children, [...path, [id, 1]]);
      } else {
        visit(node.children, path);
      }
    }
  };
  visit(parseTemplate(template, 'template.html', {}).nodes, []);
  return parts;
}

/** `true` when two elements never show together (other branches of one `@if`, `@switch`, `@for`). */
function exclusive(a, b) {
  return a.path.some(([id, branch]) => b.path.some(([other, at]) => other === id && at !== branch));
}

/** The StarNG class that a part name comes from (`trigger` from `star-select__trigger`). */
function sourceClass(part) {
  const kebab = part.name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return part.classes.find((item) => item.endsWith(`__${kebab}`) || item === `star-${kebab}`);
}

/**
 * Part names used twice in one template for elements that can show together, where the name does
 * not come from a StarNG class of each element. Two cells with the class `star-table__cell` are
 * one part; two different icons called `icon` are not.
 */
export function duplicateParts(template) {
  const parts = partsOf(template);
  const found = new Set();
  for (const [index, a] of parts.entries()) {
    for (const b of parts.slice(index + 1)) {
      if (a.name !== b.name || exclusive(a, b)) continue;
      // Both names come from a StarNG class (`star-menubar__item`, `star-mega-menu__item`): one
      // kind of element, one part.
      if (sourceClass(a) && sourceClass(b)) continue;
      found.add(a.name);
    }
  }
  return [...found];
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

test('part names are unique in each control template', () => {
  const found = all.flatMap((item) =>
    duplicateParts(item.template).map((name) => `${item.name} (${item.file}): ${name}`),
  );
  assert.deepEqual(found, []);
});

test('visually hidden text is not a part', () => {
  const found = all.flatMap((item) =>
    [
      ...item.template.matchAll(
        /<[^>]*(?:\bstarPart|data-star-part)="([^"]+)"[^>]*class="[^"]*\bstar-sr-only\b/g,
      ),
    ].map(([, name]) => `${item.name}: ${name}`),
  );
  assert.deepEqual(found, []);
});

test('the duplicate check knows branches and shared classes', () => {
  assert.deepEqual(
    duplicateParts(`@if (a) { <i starPart="icon"></i> } @else { <span starPart="icon"></span> }`),
    [],
  );
  assert.deepEqual(
    duplicateParts(
      `<td starPart="cell" class="star-t__cell"></td><td starPart="cell" class="star-t__cell"></td>`,
    ),
    [],
  );
  assert.deepEqual(duplicateParts(`<i starPart="icon"></i><b><i starPart="icon"></i></b>`), [
    'icon',
  ]);
});

test('the check finds an element without a part', () => {
  assert.deepEqual(unnamedElements('<div starPart="a"><span class="x">1</span></div>'), [
    '<span class="x"',
  ]);
  assert.deepEqual(unnamedElements('<star-button /><ng-container /><svg><path d="M0" /></svg>'), [
    '<svg',
  ]);
});
