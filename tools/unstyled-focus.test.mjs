// Guard of the focus in unstyled mode (WCAG 2.4.7). The unstyled mode turns the design tokens of
// `styles/_unstyled.scss` into the guaranteed-invalid value, so a declaration that reads one of
// them is dropped at computed-value time. In a focus rule (`:focus`, `:focus-visible`), the focus
// indicator (`outline`, `box-shadow`, `border`) may read only the tokens that unstyled mode keeps
// (`--star-accent`, `--star-focus-ring*`) or a token with a fallback, for example
// `var(--star-text, currentColor)`. Other
// declarations of a focus rule (a background, a radius) may go: they do not show the focus.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const styles = join(root, 'projects/star-ng/styles');

/** The tokens that `_unstyled.scss` resets (the Sass list `$star-unstyled-tokens`). */
function resetTokens() {
  const text = readFileSync(join(styles, '_unstyled.scss'), 'utf8');
  const list = /\$star-unstyled-tokens:\s*\(([\s\S]*?)\);/.exec(text)?.[1] ?? '';
  return new Set([...list.matchAll(/'([a-z0-9-]+)'/g)].map((match) => match[1]));
}

/** `[selector, declarations]` of every style rule of the compiled CSS, media rules included. */
function rules(css) {
  const found = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector, body] of clean.matchAll(/([^{}@;]+)\{([^{}]*)\}/g)) {
    found.push([selector.trim(), body]);
  }
  return found;
}

/** `true` when a declaration reads a reset token without a fallback (it is dropped when unstyled). */
function dropped(declaration, tokens) {
  return [...declaration.matchAll(/var\(--star-([a-z0-9-]+)\s*(,)?/g)].some(
    ([, name, fallback]) => tokens.has(name) && !fallback,
  );
}

/**
 * The focus indicators that unstyled mode would drop, as `selector: declaration`: an `outline`,
 * `box-shadow` or `border` declaration of a focus rule that reads a reset token without a fallback
 * (use `var(--star-x, currentColor)`). A rule with `outline: none` is not checked on its own: the
 * inputs show their focus on a wrapper (`:has(:focus-visible)`), which this check covers.
 */
export function focusViolations(css, tokens) {
  const found = [];
  for (const [selector, body] of rules(css)) {
    if (!/:focus(-visible)?(?![-\w])/.test(selector)) continue;
    const declarations = body
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean);
    const indicators = declarations.filter((item) =>
      /^(outline|box-shadow|border(?!-radius))[\w-]*\s*:/.test(item),
    );
    for (const item of indicators) {
      if (dropped(item, tokens)) found.push(`${selector}: ${item}`);
    }
  }
  return found;
}

test('the reset token list is read', () => {
  const tokens = resetTokens();
  assert.ok(tokens.has('primary') && tokens.has('border'));
  assert.ok(!tokens.has('accent') && !tokens.has('focus-ring'));
});

test('no focus rule depends on a token that unstyled mode resets', () => {
  const css = sass.compile(join(styles, 'star-ng.scss'), { style: 'expanded' }).css;
  assert.deepEqual(focusViolations(css, resetTokens()), []);
});

test('the check finds a focus rule with a reset token', () => {
  const tokens = new Set(['border', 'text']);
  const css = `.a:focus-visible { outline: none; box-shadow: inset 0 0 0 1px var(--star-border), var(--star-focus-ring); }
.b:focus-visible { outline: 2px solid var(--star-text, currentColor); background: var(--star-text); }
.c:hover { color: var(--star-text); }
.d:focus { outline: none; background: var(--star-text); }
.e:focus-within { outline: none; }`;
  assert.deepEqual(focusViolations(css, tokens), [
    '.a:focus-visible: box-shadow: inset 0 0 0 1px var(--star-border), var(--star-focus-ring)',
  ]);
});
