// Consumer smoke test: proves that the PACKED package works for a real Angular application.
// It copies the fixture tools/fixtures/consumer to a temp folder OUTSIDE the repository, installs
// the tarball into it (with the Angular versions of this workspace), and runs a production build.
// The fixture imports `star-ng/button`, `star-ng/core` and `star-ng/i18n/de`, uses <star-button>,
// and includes `star-ng/styles/star-ng.css` and the first-paint script through angular.json.
// A failure means that an entry point, a typing, a peer dependency range or a style export does
// not resolve for a consumer, which no test inside this repository can show.
// Usage: node tools/smoke-consumer.mjs [path to star-ng-<version>.tgz]
//   Without an argument the script packs dist/star-ng itself (run `pnpm build:lib` first).
//   SMOKE_KEEP=1 keeps the temp folder. SMOKE_DIR=<path> chooses its parent folder.
import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const started = Date.now();
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = join(root, 'tools/fixtures/consumer');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const step = (message) =>
  console.log(`\n[smoke ${((Date.now() - started) / 1000).toFixed(0)}s] ${message}`);
const die = (message) => {
  console.error(`\nsmoke-consumer FAILED: ${message}`);
  process.exit(1);
};

// How to run pnpm: the program that started this script when it is pnpm, else `pnpm` on PATH.
const execPath = process.env['npm_execpath'];
const pnpm = (args, cwd, env = {}) => {
  // pnpm 12 is a native program; an older pnpm is a JavaScript file that node must start.
  const fromScript = Boolean(execPath && /pnpm/i.test(execPath));
  const isScript = fromScript && /\.[cm]?js$/i.test(execPath);
  const [command, prefix] = isScript
    ? [process.execPath, [execPath]]
    : [fromScript ? execPath : 'pnpm', []];
  const result = spawnSync(command, [...prefix, ...args], {
    cwd,
    encoding: 'utf8',
    shell: command === 'pnpm' && process.platform === 'win32',
    env: { ...process.env, NG_CLI_ANALYTICS: 'false', CI: 'true', ...env },
  });
  return { ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
};

// 1. The tarball.
let tarball = process.argv[2] ? resolve(process.argv[2]) : '';
if (!tarball) {
  const dist = join(root, 'dist/star-ng');
  if (!existsSync(join(dist, 'package.json')))
    die('dist/star-ng does not exist. Run `pnpm build:lib`.');
  const packDir = mkdtempSync(join(tmpdir(), 'star-ng-pack-'));
  step('Packing dist/star-ng');
  const json = execFileSync(
    npmCommand,
    ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir],
    {
      cwd: dist,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
  );
  tarball = join(packDir, JSON.parse(json)[0].filename);
}
if (!existsSync(tarball)) die(`tarball not found: ${tarball}`);

// 2. The temp project, outside the repository.
const parent = process.env['SMOKE_DIR'] ? resolve(process.env['SMOKE_DIR']) : tmpdir();
mkdirSync(parent, { recursive: true });
const app = mkdtempSync(join(parent, 'star-ng-consumer-'));
if (resolve(app).startsWith(resolve(root))) die('the temp folder is inside the repository.');
cpSync(fixture, app, {
  recursive: true,
  filter: (file) => !file.endsWith('package.template.json'),
});

// The workspace's own Angular versions (exact), so the install is fast and the test is the same
// on every machine. The versions come from node_modules, not from the ranges in package.json.
const installed = (name) =>
  JSON.parse(readFileSync(join(root, 'node_modules', name, 'package.json'), 'utf8')).version;
const dependencies = {};
for (const name of [
  '@angular/cdk',
  '@angular/common',
  '@angular/compiler',
  '@angular/core',
  '@angular/forms',
  '@angular/platform-browser',
  '@angular/router',
  '@phosphor-icons/web',
  'rxjs',
  'tslib',
]) {
  dependencies[name] = installed(name);
}
const devDependencies = {};
for (const name of ['@angular/build', '@angular/cli', '@angular/compiler-cli', 'typescript']) {
  devDependencies[name] = installed(name);
}
writeFileSync(
  join(app, 'package.json'),
  JSON.stringify(
    {
      name: 'star-ng-consumer-smoke',
      version: '0.0.0',
      private: true,
      dependencies: { ...dependencies, 'star-ng': `file:${tarball.replaceAll('\\', '/')}` },
      devDependencies,
    },
    null,
    2,
  ),
);
// Same build-script policy as the workspace: no install scripts are needed for a build.
writeFileSync(
  join(app, 'pnpm-workspace.yaml'),
  "packages:\n  - '.'\nallowBuilds:\n  '@parcel/watcher': false\n  esbuild: false\n  lmdb: false\n  msgpackr-extract: false\n",
);

try {
  // 3. Install. An unmet or invalid peer dependency of star-ng is a failure.
  step(`Installing star-ng from ${tarball} into ${app}`);
  const install = pnpm(['install', '--no-frozen-lockfile', '--prefer-offline'], app);
  if (install.status !== 0) die(`pnpm install failed:\n${install.output.slice(-3000)}`);
  const peerIssue = install.output
    .split('\n')
    .filter((line) => /peer/i.test(line) && /(unmet|missing|invalid|incompatible)/i.test(line));
  if (peerIssue.length) die(`peer dependency problem reported by pnpm:\n${peerIssue.join('\n')}`);
  const consumerStarNg = join(app, 'node_modules/star-ng/package.json');
  if (!existsSync(consumerStarNg)) die('star-ng is not in the temp project node_modules.');

  // 4. Production build with strict templates and full library type checking.
  step('Building the consumer application (production)');
  const build = pnpm(['exec', 'ng', 'build', '--configuration', 'production'], app);
  console.log(build.output.split('\n').slice(-25).join('\n'));
  if (build.status !== 0) die('ng build failed.');

  // 5. The output holds what the fixture asked for.
  const out = join(app, 'dist/consumer/browser');
  const files = readdirSync(out);
  const css = files.filter((file) => file.endsWith('.css'));
  const cssText = css.map((file) => readFileSync(join(out, file), 'utf8')).join('\n');
  if (!cssText.includes('.star-btn'))
    die('the built CSS has no .star-btn rule (star-ng.css is not included).');
  if (!cssText.includes('--star-')) die('the built CSS has no --star- token.');
  if (!files.includes('star-theme-first-paint.js'))
    die('star-theme-first-paint.js is not in the build output.');
  if (!readFileSync(join(out, 'index.html'), 'utf8').includes('star-theme-first-paint.js')) {
    die('index.html does not load the first-paint script.');
  }
  const jsText = files
    .filter((file) => file.endsWith('.js') && file !== 'star-theme-first-paint.js')
    .map((file) => readFileSync(join(out, file), 'utf8'))
    .join('\n');
  if (!jsText.includes('Schlie')) die('the German texts (STAR_UI_TEXT_DE) are not in the bundle.');
  if (!jsText.includes('star-button')) die('the star-button component is not in the bundle.');
  console.log('Output: styles, first-paint script, German texts and star-button are present.');
} finally {
  if (process.env['SMOKE_KEEP'] === '1') console.log(`\nKept: ${app}`);
  else rmSync(app, { recursive: true, force: true });
}

console.log(`\nsmoke-consumer: passed in ${((Date.now() - started) / 1000).toFixed(0)} s.`);
