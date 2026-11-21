// Tests of the Phosphor icon subset of the docs (tools/docs-icons.mjs): the generated stylesheet
// is up to date, every used name is a Phosphor icon, and the scan finds the weight of a name.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  iconsOfString,
  outFile,
  packageDir,
  packageWeight,
  root,
  subsetText,
  unknownIcons,
  usedIcons,
} from './docs-icons.mjs';

const used = usedIcons();

test('the subset stylesheet is up to date', () => {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8') : null;
  assert.equal(current, subsetText(used), 'run node tools/docs-icons.mjs');
});

test('the docs load the subset, not the package stylesheets', () => {
  const angular = JSON.parse(readFileSync(join(root, 'angular.json'), 'utf8'));
  const styles = angular.projects.docs.architect.build.options.styles;
  assert.ok(styles.includes('projects/docs/src/generated/phosphor-subset.css'), styles.join());
  assert.deepEqual(
    styles.filter((s) => s.includes('@phosphor-icons/web')),
    [],
  );
});

test('every scanned name is a Phosphor icon', () => {
  assert.deepEqual(unknownIcons(used), []);
  assert.ok(used.get('bold').size > 150, `${used.get('bold').size} bold icons`);
  // Icons that the library renders by default: the select caret, the toast and banner icons.
  assert.ok(used.get('bold').has('caret-down'));
  assert.ok(used.get('fill').has('check-circle'));
  assert.ok(used.get('fill').has('warning-circle'));
});

test('a typo name fails', () => {
  const typo = new Map([['bold', new Map([['chek', 'x.ts']])]]);
  assert.deepEqual(unknownIcons(typo), ['bold ph-chek (x.ts)']);
  assert.throws(() => subsetText(typo), /Phosphor has no icon:\n {2}bold ph-chek \(x\.ts\)/);
});

test('the weight of a name is the weight class in the same quoted value', () => {
  assert.deepEqual(iconsOfString(`[class]="on ? 'ph-fill ph-funnel' : 'ph-bold ph-funnel'"`), [
    ['fill', 'funnel'],
    ['bold', 'funnel'],
  ]);
  assert.deepEqual(iconsOfString('class="ph-bold" [class.ph-caret-down]="open"'), [
    ['bold', 'caret-down'],
  ]);
  assert.deepEqual(iconsOfString('ph-x-circle'), [['bold', 'x-circle']]);
  // `ph-${name}` and the bare `ph-` prefix are no icon names.
  assert.deepEqual(iconsOfString('the ph- prefix is optional'), []);
});

test('star-icon names count with their weight', () => {
  assert.deepEqual(
    iconsOfString('<star-icon name="truck" /> <star-icon name="ph-warning" weight="fill" />'),
    [
      ['bold', 'truck'],
      ['fill', 'warning'],
    ],
  );
  assert.ok(used.get('bold').has('truck'), 'icon page: <star-icon name="truck">');
  assert.ok(used.get('fill').has('warning'), 'icon page: <star-icon name="warning" weight="fill">');
});

test('the subset keeps the font faces of the package with the WOFF2 file', () => {
  const text = readFileSync(outFile, 'utf8');
  for (const weight of used.keys()) {
    const { base, icons } = packageWeight(weight);
    assert.ok(text.includes(base), `.ph-${weight} base rule`);
    const title = weight[0].toUpperCase() + weight.slice(1);
    const font = join(packageDir, weight, `Phosphor-${title}.woff2`);
    assert.ok(existsSync(font), font);
    assert.match(
      text,
      new RegExp(
        String.raw`src: url\("\.\./\.\./\.\./\.\./node_modules/@phosphor-icons/web/src/${weight}/Phosphor-${title}\.woff2"\) format\("woff2"\);`,
      ),
    );
    for (const name of used.get(weight).keys()) assert.ok(text.includes(icons.get(name)), name);
    // Only the used icons: the subset is much smaller than the package.
    assert.ok(used.get(weight).size < icons.size / 4, `${weight}: ${used.get(weight).size}`);
  }
  // Weights that the docs do not use stay out.
  assert.deepEqual([...used.keys()], ['bold', 'fill']);
});
