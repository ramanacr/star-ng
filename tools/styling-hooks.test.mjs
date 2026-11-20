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

/** A template constant exported by a file next to `file` (`date-picker.template.ts`). */
function importedTemplate(file, name) {
  for (const sibling of readdirSync(dirname(file))) {
    if (!sibling.endsWith('.ts') || sibling.endsWith('.spec.ts')) continue;
    const text = readFileSync(join(dirname(file), sibling), 'utf8');
    const match = new RegExp('export const ' + name + ' = `([\\s\\S]*?)`;').exec(text);
    if (match) return match[1];
  }
  return '';
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
      else if (inline && ts.isIdentifier(inline)) {
        template = constants.get(inline.text) ?? importedTemplate(file, inline.text);
      }
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
          const glyph = (attrs.class ?? '')
            .split(/\s+/)
            .find((item) => /^ph-(?!bold$|fill$)/.test(item));
          parts.push({ name: partName, classes, path, tag: node.name, glyph });
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
      // A homogeneous group (the buttons of a toolbar, the cells of a column): the same StarNG
      // classes without modifiers, and the same tag when there is no StarNG class.
      const kind = (part) => part.classes.filter((item) => !item.includes('--')).join(' ');
      if (kind(a) === kind(b) && (kind(a) || a.tag === b.tag)) continue;
      found.add(a.name);
    }
  }
  return [...found];
}

/** The closed list of roles: the last word of a part name that does not come from a class. */
const ROLES = new Set([
  'Button',
  'Icon',
  'Label',
  'Input',
  'Option',
  'List',
  'Item',
  'Panel',
  'Header',
  'Cell',
  'Row',
  'Text',
  'Root',
  'Track',
  'Thumb',
  'Handle',
]);
/** Glyph words: a part is named after what it does, not after the shape of its icon. */
const GLYPHS = new Set([
  'caret',
  'chevron',
  'dots',
  'plus',
  'minus',
  'magnifying',
  'pencil',
  'star',
  'eyedropper',
]);
/** Abbreviations: a part name uses whole words. */
const ABBREVIATIONS = new Set([
  'btn',
  'btns',
  'msg',
  'img',
  'desc',
  'sep',
  'sub',
  'fm',
  'col',
  'hdr',
  'colhead',
  'rowhead',
  'th',
  'td',
  'p',
  'pre',
  'thead',
  'tbody',
  'tfoot',
  'num',
  'val',
  'opt',
  'ctrl',
  'src',
  'el',
]);

/** The keys of `STAR_UI_TEXT`: a part is not named after a text. */
const TEXT_KEYS = new Set(
  [...readFileSync(join(lib, 'core/ui-text.ts'), 'utf8').matchAll(/^ {2}readonly (\w+)\??:/gm)].map(
    ([, key]) => key,
  ),
);

/** Words that name a control: a UI text key with one of them is the text of that control. */
const CONTROL_WORDS = new Set([
  'editor',
  'spreadsheet',
  'document',
  'map',
  'signature',
  'diagram',
  'chart',
  'kanban',
  'gantt',
  'scheduler',
  'pivot',
  'ribbon',
  'calendar',
]);

const words = (name) => name.split(/(?=[A-Z])/);
const lower = (word) => word.toLowerCase();

/**
 * The part names of a template that break the naming rule, with the reasons. Every name is
 * `<purpose><Role>` in camelCase with at most three words and a role from the list, or one
 * structural word (listed in the guide "Styling hooks"). No name has an abbreviation, the control
 * name, a glyph word (of the list or of its own icon class), a doubled word or role, or the name
 * of a UI text.
 */
export function badNames(template, block) {
  const found = new Set();
  for (const part of partsOf(template)) {
    const parts = words(part.name);
    const reasons = [];
    if (parts.length > 3) reasons.push('more than 3 words');
    for (let index = 1; index < parts.length; index++) {
      if (lower(parts[index]) === lower(parts[index - 1])) reasons.push('doubled word');
      if (index === parts.length - 1 && ROLES.has(parts[index]) && ROLES.has(parts[index - 1])) {
        if (parts[index - 1] !== 'Header') reasons.push('doubled role');
      }
    }
    if (parts.length > 1 && !ROLES.has(parts.at(-1))) reasons.push('role not in the list');
    if (parts.some((word) => ABBREVIATIONS.has(lower(word)))) reasons.push('abbreviation');
    if (
      block &&
      (part.name === block ||
        (part.name.startsWith(block) && /^[A-Z]/.test(part.name.slice(block.length))))
    ) {
      reasons.push('control name');
    }
    // A shape word, or the full name of the element's own icon when it has several words
    // (`magnifyingGlassPlusIcon`). A one-word icon that also says the purpose (`copyIcon` with
    // `ph-copy`) is allowed.
    const glyph = (part.glyph ?? '').replace(/^ph-/, '').split('-');
    const glyphName =
      glyph.length > 1
        ? glyph.map((word, at) => (at ? word[0].toUpperCase() + word.slice(1) : word)).join('')
        : '';
    if (
      parts.some((word) => GLYPHS.has(lower(word))) ||
      (glyphName && part.name.startsWith(glyphName))
    ) {
      reasons.push('glyph name');
    }
    // The name is not the key of a UI text, and its purpose is not a UI text key that names a
    // control (`editorBoldButton` from `text.editorBold`, `drawSignatureButton`). A purpose that
    // only happens to match a key (`zoomInButton`, `firstPageIcon`) is fine.
    const purpose = ROLES.has(parts.at(-1)) ? parts.slice(0, -1) : parts;
    const purposeName = purpose.map((word, at) => (at ? word : lower(word))).join('');
    const namesControl = purpose.some((word) => CONTROL_WORDS.has(lower(word)));
    if (TEXT_KEYS.has(part.name) || (namesControl && TEXT_KEYS.has(purposeName))) {
      reasons.push('UI text key');
    }
    if (reasons.length) found.add(`${part.name} (${[...new Set(reasons)].join(', ')})`);
  }
  return [...found];
}

/** The name of a control in camelCase, from its selector: `star-ribbon-group` gives `ribbonGroup`. */
function controlName(selector) {
  if (!/^star-[a-z0-9-]+$/.test(selector)) return '';
  return selector.slice(5).replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase());
}

/** The block of a control: the most frequent `star-<block>__` class of its template. */
function blockOf(template) {
  const counts = {};
  for (const [, block] of template.matchAll(/\bstar-([a-z0-9-]+)__/g)) {
    counts[block] = (counts[block] ?? 0) + 1;
  }
  const block = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return block?.split('-')[0];
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

test('part names follow the naming rule', () => {
  const found = all.flatMap((item) =>
    badNames(item.template, controlName(item.selector)).map((name) => `${item.name}: ${name}`),
  );
  assert.deepEqual(found, []);
});

test('the guide lists every single-word part name', () => {
  const guide = readFileSync(
    join(root, 'projects/docs/src/app/guides/styling-hooks.guide.ts'),
    'utf8',
  );
  const block = /<p class="docs-part-words">([\s\S]*?)<\/p>/.exec(guide)?.[1] ?? '';
  const listed = new Set([...block.matchAll(/<code>([a-z]+)<\/code>/g)].map(([, word]) => word));
  const used = new Set(
    all.flatMap((item) =>
      partsOf(item.template)
        .map((part) => part.name)
        .filter((name) => /^[a-z]+$/.test(name) && name !== 'root'),
    ),
  );
  assert.deepEqual(
    [...used].filter((word) => !listed.has(word)).sort(),
    [],
    'single-word part names missing from the guide "Styling hooks"',
  );
  assert.deepEqual(
    [...listed].filter((word) => !used.has(word)).sort(),
    [],
    'words in the guide list that no template uses',
  );
});

test('the naming check finds bad names', () => {
  assert.deepEqual(
    badNames(
      `<button data-star-part="spreadsheetFewerDecimalsButton"></button>
       <i data-star-part="magnifyingGlassPlusIcon" class="ph-bold ph-magnifying-glass-plus"></i>
       <span data-star-part="moreCountTextText"></span>
       <button data-star-part="restoreButtonIcon"></button>
       <div data-star-part="rowSection"></div>
       <button data-star-part="drawSignatureButton"></button>
       <button data-star-part="zoomInButton"></button>
       <div data-star-part="trigger" class="star-select__trigger"></div>`,
      'spreadsheet',
    ),
    [
      'spreadsheetFewerDecimalsButton (more than 3 words, control name, UI text key)',
      'magnifyingGlassPlusIcon (more than 3 words, glyph name)',
      'moreCountTextText (more than 3 words, doubled word, doubled role)',
      'restoreButtonIcon (doubled role)',
      'rowSection (role not in the list)',
      'drawSignatureButton (UI text key)',
    ],
  );
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
  assert.deepEqual(duplicateParts(`<i starPart="icon"></i><b><span starPart="icon"></span></b>`), [
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
