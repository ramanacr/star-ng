// Tests of the compiled StarNG CSS: the reduced-motion rules of `provideStarNg`.
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { css } = sass.compile(join(root, 'projects/star-ng/styles/star-ng.scss'));

test('every prefers-reduced-motion block has a data-star-motion="reduced" twin', () => {
  const media = css.match(/@media \(prefers-reduced-motion: reduce\)/g) ?? [];
  const twins = css.match(/:root\[data-star-motion=reduced\] [^{]+\{/g) ?? [];
  assert.ok(media.length > 10);
  // A media block can hold several rules; each rule gets its own twin.
  assert.ok(twins.length >= media.length, `${twins.length} twins for ${media.length} blocks`);
  assert.match(css, /:root\[data-star-motion=reduced\] \.star-panel/);
  assert.match(css, /:root\[data-star-motion=reduced\] \.star-skeleton::after/);
});

test('reducedMotion: "always" has no blanket rule, so spinners keep turning', () => {
  assert.doesNotMatch(css, /\[class\*=['"]?star-/);
  assert.doesNotMatch(css, /data-star-motion=reduced\] \.star-spinner/);
});

test('the window layer follows the overlay base and has a floor above the app bar', () => {
  const rule = css.match(/\.star-window \{[^}]*\}/)?.[0] ?? '';
  const zIndex = rule.match(/z-index: ([^;]+);/)?.[1] ?? '';
  // Floor: the app bar is z-index 20; the window stack order keeps the windows in order.
  assert.match(zIndex, /^max\((calc\()?20 \+ var\(--star-window-order, 1\)\)?, min\(/);
  // Cap one below the overlay container, which follows provideStarNg({ overlay: { zIndexBase } }).
  assert.match(zIndex, /min\((calc\()?var\(--star-z-index-base, 1000\) - 1\)?, /);
  assert.match(css, /\.star-app-bar \{[^}]*z-index: 20;/);
});
