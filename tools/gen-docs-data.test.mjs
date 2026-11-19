// Tests of the inherited members in the docs API data (`gen-docs-data.mjs`, `api-inheritance.mjs`).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withInheritedMembers } from './api-inheritance.mjs';
import { readDocsApi } from './gen-docs-data.mjs';

const member = (name, extra = {}) => ({
  name,
  type: 'string',
  default: null,
  required: false,
  description: '',
  ...extra,
});
const entry = (inputs, outputs = []) => ({
  kind: 'component',
  selector: '',
  entry: '',
  description: '',
  inputs,
  models: [],
  outputs,
});

test('withInheritedMembers marks members of the base classes with the declaring class', () => {
  const api = {
    Base: entry([member('a'), member('b')], [member('changed')]),
    Middle: entry([member('c')]),
    Leaf: entry([member('b', { description: 'own' })]),
  };
  const bases = { Middle: 'Base', Leaf: 'Middle' };
  const resolved = withInheritedMembers(api, bases, { markInherited: true });
  assert.deepEqual(
    resolved.Leaf.inputs.map((m) => [m.name, m.inheritedFrom ?? null, m.description]),
    [
      ['a', 'Base', ''],
      ['c', 'Middle', ''],
      ['b', null, 'own'],
    ],
  );
  assert.equal(resolved.Leaf.outputs[0].inheritedFrom, 'Base');
  // Without the option the data has no extra key (the agent data keeps its format).
  const plain = withInheritedMembers(api, bases);
  assert.equal('inheritedFrom' in plain.Leaf.inputs[0], false);
});

test('the docs API has the inherited inputs of the select family, date pickers and dialogs', () => {
  const api = readDocsApi();
  const input = (name, input) => api[name].inputs.find((m) => m.name === input);
  assert.equal(input('StarSelect', 'options')?.inheritedFrom, 'StarOptionListBase');
  assert.equal(input('StarMultiSelect', 'filterMatchMode')?.inheritedFrom, 'StarOptionListBase');
  assert.equal(input('StarDatePicker', 'locale')?.inheritedFrom, 'StarDateInputBase');
  assert.equal(input('StarDateRangePicker', 'minDate')?.inheritedFrom, 'StarDateInputBase');
  assert.equal(input('StarDialog', 'modal')?.inheritedFrom, 'StarDialogBase');
  assert.equal(input('StarDrawer', 'header')?.inheritedFrom, 'StarDialogBase');
  assert.equal(
    api.StarDrawer.models.find((m) => m.name === 'visible')?.inheritedFrom,
    'StarDialogBase',
  );
  // An own member has no `inheritedFrom`.
  assert.equal(input('StarSelect', 'editable')?.inheritedFrom, undefined);
});

test('a `??` input default shows the built-in fallback, not the configured expression', () => {
  const api = readDocsApi();
  const input = (name, input) => api[name].inputs.find((m) => m.name === input);
  assert.equal(input('StarSelect', 'filterMatchMode')?.default, "'contains'");
  assert.equal(input('StarSelect', 'showClear')?.default, 'false');
  assert.equal(input('StarSelect', 'showClear')?.type, 'boolean');
  assert.equal(input('StarInput', 'size')?.default, "'md'");
  assert.equal(input('StarTable', 'rowsPerPageOptions')?.default, '[10, 25, 50]');
  assert.equal(input('StarTable', 'filterLocale')?.default, 'null');
  assert.equal(input('StarDatePicker', 'locale')?.default, 'undefined');
});
