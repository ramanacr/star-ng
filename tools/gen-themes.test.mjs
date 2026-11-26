// Tests of the generated themes (tools/gen-themes.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import * as sass from 'sass';
import { loadFactory, renderThemes, THEMES } from './gen-themes.mjs';

test('every theme file is up to date and compiles', async () => {
  const files = await renderThemes();
  assert.equal(files.size, THEMES.length);
  for (const [file, content] of files) {
    assert.equal(readFileSync(file, 'utf8'), content, `${file} is stale: run themes:gen`);
    const { css } = sass.compile(file);
    assert.match(css, /backdrop-filter: blur\(var\(--star-glass-blur\)\)/);
  }
});

test('every theme passes its contrast checks and keeps the clear surface translucent', async () => {
  const { starCreateTheme } = await loadFactory();
  for (const options of THEMES) {
    const theme = starCreateTheme(options);
    assert.deepEqual(
      theme.contrast.filter((check) => !check.pass),
      [],
    );
    assert.ok(theme.alpha.clear.light < 0.8, `clear light opacity ${theme.alpha.clear.light}`);
    assert.ok(theme.alpha.clear.dark < 0.8, `clear dark opacity ${theme.alpha.clear.dark}`);
  }
});

test('theme names are neutral', () => {
  for (const { name } of THEMES) assert.match(name, /^[a-z][a-z0-9-]*$/);
  assert.ok(!THEMES.some(({ name }) => /liquid/i.test(name)));
});
