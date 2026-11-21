import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { countIn, featureCounts, PATTERNS, render } from './feature-counts.mjs';

const guide = readFileSync(
  new URL('../projects/docs/src/app/guides/angular-features.guide.ts', import.meta.url),
  'utf8',
);

test('the committed counts file is up to date', () => {
  const committed = readFileSync(
    new URL('../projects/docs/src/app/generated/feature-counts.ts', import.meta.url),
    'utf8',
  ).replace(/\r\n/g, '\n');
  assert.equal(committed, render(featureCounts()), 'run corepack pnpm docs:gen');
});

test('every count token of the guide exists', () => {
  const counts = featureCounts();
  const tokens = [...guide.matchAll(/\{(lib|docs):(\w+)\}|\{(pages|specFiles)\}/g)];
  assert.ok(tokens.length > 30);
  for (const [token, side, key, total] of tokens) {
    if (total) assert.equal(typeof counts[total], 'number', token);
    else assert.ok(counts[side][key], `${token} is not a key of tools/feature-counts.mjs`);
  }
});

test('declaration patterns do not count reads', () => {
  const text = `readonly value = model<string>('');
readonly size = input(0);
readonly label = input.required<string>();
show() { return this.model() + this.input(); }`;
  assert.equal(text.match(PATTERNS.model).length, 1);
  assert.equal(text.match(PATTERNS.input).length, 1);
  assert.equal(text.match(PATTERNS.inputRequired).length, 1);
  assert.deepEqual(countIn([]).input, { uses: 0, files: 0 });
});
