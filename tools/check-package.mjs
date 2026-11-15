// Checks the built package in dist/star-ng before it goes to npm. Run after `pnpm build:lib`
// (script `check:package`). It runs in CI on every pull request and in the release workflow, so a
// broken package is found on the pull request and not on release day.
// Usage: node tools/check-package.mjs [package folder]   (default: dist/star-ng)
// Node only, no dependency. Exit code 1 when any check fails; every failure is printed.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(process.argv[2] ?? join(root, 'dist/star-ng'));

// Size limits. Measured on 0.1.0: tarball 0.5 MB, unpacked 2.9 MB, 215 files. The limits leave
// room for growth but fail on a mistake such as a copied `node_modules` or a coverage folder.
const MAX_TARBALL_BYTES = 1.5 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 600;

// Built from parts, so this file does not match its own patterns (same as check-names.mjs).
const FORBIDDEN = [
  new RegExp(['s', 'm', 'x'].join(''), 'i'),
  new RegExp(['sci', 'max'].join(''), 'i'),
];
const BINARY = /\.(png|jpe?g|gif|ico|woff2?|ttf|pdf|zip|tgz)$/i;

const failures = [];
const fail = (message) => failures.push(message);

if (!existsSync(join(dir, 'package.json'))) {
  console.error(`check-package: ${dir} has no package.json. Run \`pnpm build:lib\` first.`);
  process.exit(1);
}

const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));

// 1. Manifest fields.
if (pkg.name !== '@star-ng/ui')
  fail(`package.json: name is "${pkg.name}", expected "@star-ng/ui".`);
if (pkg.private) fail('package.json: "private" is set. npm refuses to publish a private package.');
for (const field of ['version', 'license', 'repository', 'homepage', 'bugs', 'description']) {
  if (!pkg[field]) fail(`package.json: missing "${field}".`);
}
if (!pkg.peerDependencies || Object.keys(pkg.peerDependencies).length === 0) {
  fail('package.json: missing "peerDependencies".');
}
if (pkg.exports === undefined) fail('package.json: missing "exports".');

// 2. Files that must be in the package.
const REQUIRED = [
  'README.md',
  'LICENSE',
  'styles/star-ng.css',
  'styles/star-ng.min.css',
  'styles/star-ng.scss',
  'theme/star-theme-first-paint.js',
];
for (const file of REQUIRED) {
  if (!existsSync(join(dir, file))) fail(`missing file: ${file}`);
}

// 3. Every target of "exports" must exist. A pattern target ("./styles/*") needs a folder with files.
const targets = [];
const collect = (value, path) => {
  if (typeof value === 'string') targets.push({ path, target: value });
  else if (value && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) collect(inner, `${path} > ${key}`);
  }
};
collect(pkg.exports, 'exports');
for (const { path, target } of targets) {
  if (!target.startsWith('./')) {
    fail(`${path}: target "${target}" must start with "./".`);
    continue;
  }
  if (target.includes('*')) {
    const folder = join(dir, target.slice(0, target.indexOf('*')));
    if (!existsSync(folder) || readdirSync(folder).length === 0) {
      fail(`${path}: pattern target "${target}" matches no file.`);
    }
  } else if (!existsSync(join(dir, target))) {
    fail(`${path}: target file "${target}" does not exist.`);
  }
}

// 4. File scan: spec files, spec source maps, forbidden names.
const files = [];
const walk = (folder) => {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const full = join(folder, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(full);
  }
};
walk(dir);

for (const file of files) {
  const name = relative(dir, file).replaceAll('\\', '/');
  if (/\.spec\./.test(name)) fail(`spec file in the package: ${name}`);
  if (BINARY.test(name)) continue;
  const text = readFileSync(file, 'utf8');
  if (name.endsWith('.map')) {
    try {
      const sources = JSON.parse(text).sources ?? [];
      const spec = sources.find((source) => /\.spec\./.test(source));
      if (spec) fail(`${name}: source map of a spec file (${spec}).`);
    } catch {
      fail(`${name}: not valid JSON.`);
    }
  }
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (FORBIDDEN.some((pattern) => pattern.test(line))) {
      fail(`${name}:${index + 1}: forbidden name: ${line.trim().slice(0, 100)}`);
    }
  });
}

// 5. Size, measured on the real tarball content (dry run: nothing is written, no registry call).
let packed;
try {
  const json = execSync('npm pack --dry-run --json --ignore-scripts', {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  packed = JSON.parse(json)[0];
} catch (error) {
  fail(`npm pack --dry-run failed: ${String(error.message).split('\n')[0]}`);
}
if (packed) {
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`;
  console.log(
    `${packed.name}@${packed.version}: ${packed.entryCount} files, tarball ${kb(packed.size)} ` +
      `(limit ${kb(MAX_TARBALL_BYTES)}), unpacked ${kb(packed.unpackedSize)} ` +
      `(limit ${kb(MAX_UNPACKED_BYTES)}).`,
  );
  if (packed.size > MAX_TARBALL_BYTES) fail(`tarball is larger than ${kb(MAX_TARBALL_BYTES)}.`);
  if (packed.unpackedSize > MAX_UNPACKED_BYTES) {
    fail(`unpacked size is larger than ${kb(MAX_UNPACKED_BYTES)}.`);
  }
  if (packed.entryCount > MAX_FILES) fail(`more than ${MAX_FILES} files in the tarball.`);
  for (const file of packed.files.map((entry) => entry.path)) {
    if (/\.spec\./.test(file)) fail(`spec file in the tarball: ${file}`);
  }
  for (const file of ['README.md', 'LICENSE', 'package.json']) {
    if (!packed.files.some((entry) => entry.path === file)) fail(`${file} is not in the tarball.`);
  }
}

if (failures.length) {
  console.error(`check-package: ${failures.length} problem(s) in ${dir}:`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log(
  `check-package: ${files.length} files in the folder, ${targets.length} export targets, ` +
    `${statSync(join(dir, 'package.json')).size} byte manifest. All checks passed.`,
);
