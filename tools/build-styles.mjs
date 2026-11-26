// Compiles the library SCSS entry to CSS and puts it in the built package:
//   dist/star-ng/styles/star-ng.css      (readable)
//   dist/star-ng/styles/star-ng.min.css  (compressed)
//   dist/star-ng/styles/themes/<name>.css (each generated theme, see tools/gen-themes.mjs)
// It also copies README.md, LICENSE and THIRD_PARTY_NOTICES.md of the repository root into the
// package: ng-packagr cannot read assets from outside the library folder (so the notices are not
// an `assets` entry of ng-package.json), and npm shows the README on the package page.
// Run after `ng build star-ng` (see the `build:lib` script). The SCSS sources are copied
// into the package by ng-packagr (`assets` in projects/star-ng/ng-package.json).
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'projects/star-ng/styles/star-ng.scss');
const out = join(root, 'dist/star-ng/styles');

if (!existsSync(join(root, 'dist/star-ng/package.json'))) {
  console.error('dist/star-ng does not exist. Run `ng build star-ng` first.');
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const [file, style] of [
  ['star-ng.css', 'expanded'],
  ['star-ng.min.css', 'compressed'],
]) {
  const { css } = sass.compile(entry, { style });
  writeFileSync(join(out, file), css);
  console.log(`${file}: ${(css.length / 1024).toFixed(1)} kB`);
}

const themesIn = join(root, 'projects/star-ng/styles/themes');
const themesOut = join(out, 'themes');
mkdirSync(themesOut, { recursive: true });
for (const file of readdirSync(themesIn).filter((name) => /^_[a-z0-9-]+\.scss$/.test(name))) {
  const name = file.slice(1, -'.scss'.length);
  const { css } = sass.compile(join(themesIn, file), { style: 'expanded' });
  writeFileSync(join(themesOut, `${name}.css`), css);
  console.log(`themes/${name}.css: ${(css.length / 1024).toFixed(1)} kB`);
}

for (const file of ['README.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  copyFileSync(join(root, file), join(root, 'dist/star-ng', file));
  console.log(`${file}: copied from the repository root`);
}
