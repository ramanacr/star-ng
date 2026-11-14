// Compiles the library SCSS entry to CSS and puts it in the built package:
//   dist/star-ng/styles/star-ng.css      (readable)
//   dist/star-ng/styles/star-ng.min.css  (compressed)
// Run after `ng build star-ng` (see the `build:lib` script). The SCSS sources are copied
// into the package by ng-packagr (`assets` in projects/star-ng/ng-package.json).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
