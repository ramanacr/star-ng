// Tests of the catalog functions on the real StarNG data (`pnpm test:mcp` makes it first).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  findComponent,
  findPage,
  getComponent,
  getExamples,
  getSetup,
  listComponents,
  readDataFile,
  search,
  validateData,
  validateUsage,
} from '../src/catalog.mjs';
import { BUNDLED_DATA } from '../src/server.mjs';

const data = readDataFile(BUNDLED_DATA);

test('the data has components, pages, examples and setup', () => {
  assert.ok(data.components.length > 50);
  assert.ok(data.pages.length > 50);
  assert.ok(Object.keys(data.examples).length > 100);
  assert.deepEqual(
    data.setup.map((section) => section.title),
    ['Requirements', 'Install', 'Include the styles', 'Use a control', 'Forms'],
  );
  assert.ok(data.site.endsWith('/'));
});

test('every component with a page points to a known page', () => {
  const slugs = new Set(data.pages.map((page) => page.slug));
  for (const component of data.components) {
    if (component.page)
      assert.ok(slugs.has(component.page), `${component.name}: ${component.page}`);
    assert.match(component.import, /^import \{ Star\w+ \} from '@star-ng\/ui\/[\w-]+';$/);
  }
  assert.equal(findComponent(data, 'StarButton').page, 'button');
});

test('validateData refuses another schema version and a broken shape', () => {
  assert.throws(() => validateData({ ...data, schemaVersion: 2 }), /schemaVersion/);
  assert.throws(() => validateData({ ...data, components: null }), /components/);
  assert.throws(() => validateData(null), /not an object/);
});

test('names resolve by slug, class name, short name and selector', () => {
  assert.equal(findPage(data, 'date-picker').slug, 'date-picker');
  assert.equal(findPage(data, 'StarDatePicker').slug, 'date-picker');
  assert.equal(findComponent(data, 'star-button').name, 'StarButton');
  assert.equal(findComponent(data, '<star-button>').name, 'StarButton');
  assert.equal(findComponent(data, 'button').name, 'StarButton');
  assert.equal(findComponent(data, 'nothing-like-this'), undefined);
});

test('get_component gives the import, the API and example keys', () => {
  const { text, error } = getComponent(data, { name: 'button' });
  assert.equal(error, undefined);
  assert.match(text, /import \{ StarButton \} from '@star-ng\/ui\/button';/);
  assert.match(text, /Selector: `star-button`/);
  assert.match(text, /Outputs:/);
  assert.match(text, /get_examples with "button"/);
  assert.match(getComponent(data, { name: 'buton' }).error, /Did you mean "button"/);
});

test('get_examples gives markup of a page or of one key, with a limit', () => {
  const page = getExamples(data, { name: 'accordion', limit: 1 });
  assert.match(page.text, /```html\n[\s\S]*<star-accordion /);
  assert.match(page.text, /docs-/);
  assert.match(page.text, /1 more: `accordion\/multiple`/);
  assert.match(
    getExamples(data, { name: 'accordion/multiple' }).text,
    /Example `accordion\/multiple`/,
  );
  assert.ok(getExamples(data, { name: 'nope-nope' }).error);
});

test('list_components filters, search ranks names first', () => {
  assert.match(listComponents(data), /Button \(page `button`/);
  const menus = listComponents(data, { query: 'menu' });
  assert.match(menus, /Mega menu/);
  assert.doesNotMatch(menus, /Accordion/);
  assert.match(listComponents(data, { query: 'zzzz' }), /No StarNG control/);
  const hits = search(data, { query: 'date picker' }).split('\n');
  assert.match(hits[0], /DatePicker/);
  assert.match(search(data, { query: 'qqqq' }), /Nothing in StarNG/);
});

test('get_setup includes install and notes a different installed version', () => {
  assert.match(getSetup(data), /pnpm add @star-ng\/ui/);
  assert.match(getSetup(data, { installedVersion: '0.0.1' }), /0\.0\.1 installed/);
  assert.doesNotMatch(getSetup(data, { installedVersion: data.version }), /installed/);
});

test('validate_usage accepts correct markup and lists imports', () => {
  const result = validateUsage(data, {
    html: '<star-button (pressed)="save()" [disabled]="busy()" class="x">Save</star-button>',
  });
  assert.deepEqual(result.problems, []);
  assert.match(result.text, /import \{ StarButton \} from '@star-ng\/ui\/button';/);
});

test('validate_usage reports unknown elements, bindings, and an input bound as an output', () => {
  const accordion = data.components.find((item) => item.name === 'StarAccordion');
  assert.ok(accordion.models.some((member) => member.name === 'value'));
  const result = validateUsage(data, {
    html: [
      '<star-buton>x</star-buton>',
      '<star-button (pressd)="save()">Save</star-button>',
      '<star-accordion [(value)]="open" (valueChange)="log($event)" (multiple)="x"></star-accordion>',
    ].join('\n'),
  });
  assert.equal(result.problems.length, 3, result.text);
  assert.match(
    result.problems[0],
    /Line 1: <star-buton> is not a StarNG element\. Did you mean <star-button>\?/,
  );
  assert.match(result.problems[1], /Line 2: .*"pressd".*Did you mean "pressed"\?/);
  assert.match(result.problems[2], /Line 3: .*"multiple" is an input, not an output/);
});

test('validate_usage finds no problem in any docs example (no false alarms)', () => {
  const problems = Object.entries(data.examples).flatMap(([key, html]) =>
    validateUsage(data, { html }).problems.map((problem) => `${key}: ${problem}`),
  );
  assert.deepEqual(problems, []);
});

test('inherited inputs are part of the API (StarSelect gets options from its base class)', () => {
  const select = findComponent(data, 'StarSelect');
  assert.ok(select.inputs.some((member) => member.name === 'options'));
});

test('validate_usage knows attribute directives such as the tooltip', () => {
  const tooltip = data.components.find((item) => item.name === 'StarTooltip');
  const attribute = tooltip.selector.match(/\[([\w-]+)\]/)[1];
  const result = validateUsage(data, { html: `<button ${attribute}="Help">?</button>` });
  assert.deepEqual(result.problems, []);
  assert.match(result.text, /StarTooltip/);
});
