// Tests of the Phosphor icon subset of the docs (tools/docs-icons.mjs): the generated stylesheet
// is up to date, every used name is a Phosphor icon, and the scan finds the weight of a name.
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import {
  iconsOfString,
  outFile,
  packageDir,
  packageWeight,
  root,
  scanString,
  subsetText,
  unknownIcons,
  usedIcons,
  WEIGHTS,
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

test('every scanned name is a Phosphor icon, and every bound name is resolved', () => {
  assert.deepEqual(unknownIcons(used), []);
  assert.deepEqual(used.unresolved, []);
  assert.ok(used.get('bold').size > 150, `${used.get('bold').size} bold icons`);
  // Icons that the library renders by default: the select caret, the toast and banner icons.
  assert.ok(used.get('bold').has('caret-down'));
  assert.ok(used.get('fill').has('check-circle'));
  assert.ok(used.get('fill').has('warning-circle'));
  // The chat status icon (`class="... ph-bold" [class.ph-clock]`).
  assert.ok(used.get('bold').has('clock'));
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
  assert.deepEqual(iconsOfString('ph-x-circle'), [['bold', 'x-circle']]);
  // `ph-${name}` and the bare `ph-` prefix are no icon names.
  assert.deepEqual(iconsOfString('the ph- prefix is optional'), []);
});

test('a class binding takes the weight class of its element', () => {
  assert.deepEqual(iconsOfString('<i class="ph-bold" [class.ph-caret-down]="open"></i>'), [
    ['bold', 'caret-down'],
  ]);
  assert.deepEqual(iconsOfString('<i class="ph-fill" [class.ph-star]="on"></i>'), [
    ['fill', 'star'],
  ]);
  // Regular weight (`ph`): reported as regular, so its font face and rules are emitted.
  assert.deepEqual(
    iconsOfString('<i class="star-chat__status ph" [class.ph-clock]="a" (click)="b > 1"></i>'),
    [['regular', 'clock']],
  );
});

test('icon inputs of other controls count: <star-icon-field> is not <star-icon>', () => {
  assert.deepEqual(
    iconsOfString('<star-icon-field icon="ph-bold ph-envelope-simple" iconPosition="end">'),
    [['bold', 'envelope-simple']],
  );
  assert.deepEqual(iconsOfString(`<star-button leadingIcon='ph-fill ph-heart'>`), [
    ['fill', 'heart'],
  ]);
});

test('star-icon names count with their weight: static, single-quoted and bound literals', () => {
  assert.deepEqual(
    iconsOfString('<star-icon name="truck" /> <star-icon name="ph-warning" weight="fill" />'),
    [
      ['bold', 'truck'],
      ['fill', 'warning'],
    ],
  );
  assert.deepEqual(iconsOfString(`<star-icon name='x-circle' weight='fill' />`), [
    ['fill', 'x-circle'],
  ]);
  assert.deepEqual(iconsOfString(`<star-icon [name]="'truck'" [weight]="'fill'" />`), [
    ['fill', 'truck'],
  ]);
  assert.ok(used.get('bold').has('truck'), 'icon page: <star-icon name="truck">');
  assert.ok(used.get('fill').has('warning'), 'icon page: <star-icon name="warning" weight="fill">');
});

test('a bound star-icon name that is no literal fails, unless EXTRA lists it', () => {
  assert.deepEqual(scanString('<star-icon [name]="icon()" />'), {
    pairs: [],
    unresolved: [{ expression: '[name]="icon()"' }],
  });
  const dir = mkdtempSync(join(tmpdir(), 'docs-icons-'));
  try {
    const file = join(dir, 'page.html');
    writeFileSync(file, '<star-icon [name]="icon()" weight="fill" />\n');
    const where = relative(root, file).split('\\').join('/');
    const open = usedIcons([dir], []);
    assert.deepEqual(open.unresolved, [`${where}: [name]="icon()"`]);
    assert.throws(() => subsetText(open), /no literal \(add them to EXTRA\):\n {2}.*icon\(\)/);
    const listed = usedIcons(
      [dir],
      [{ file: where, expression: '[name]="icon()"', weight: 'fill', names: ['truck'] }],
    );
    assert.deepEqual(listed.unresolved, []);
    assert.ok(listed.get('fill').has('truck'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the subset keeps the font faces of the package with the WOFF2 file', () => {
  const text = readFileSync(outFile, 'utf8');
  for (const weight of used.keys()) {
    const { base, icons, fontFace } = packageWeight(weight);
    assert.ok(text.includes(base), `.ph-${weight} base rule`);
    const file = /url\("\.\/([^"]+\.woff2)"\)/.exec(fontFace)[1];
    assert.ok(existsSync(join(packageDir, weight, file)), file);
    assert.ok(
      text.includes(
        `src: url("../../../../node_modules/@phosphor-icons/web/src/${weight}/${file}") format("woff2");`,
      ),
      `${weight}: ${file}`,
    );
    for (const name of used.get(weight).keys()) assert.ok(text.includes(icons.get(name)), name);
    // Only the used icons: the subset is much smaller than the package.
    assert.ok(used.get(weight).size < icons.size / 4, `${weight}: ${used.get(weight).size}`);
  }
  // Only used weights are emitted: one font face per used weight, none for the others.
  const faces = [...text.matchAll(/font-family: "([^"]+)";\n {2}src:/g)].map((m) => m[1]);
  assert.equal(faces.length, used.size);
  for (const weight of WEIGHTS) {
    assert.equal(text.includes(`/* ${weight}: `), used.has(weight), weight);
  }
});
