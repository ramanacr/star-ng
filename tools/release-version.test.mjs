// Tests of tools/release-version.mjs (`pnpm test:tools`). The tool reads the real package.json
// files, so the tests read the same versions and build the expected tags from them.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const tool = fileURLToPath(new URL('./release-version.mjs', import.meta.url));
const versionOf = (path) =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).version;
const uiVersion = versionOf('projects/star-ng/package.json');
const mcpVersion = versionOf('projects/mcp/package.json');

function run(...args) {
  const env = { ...process.env };
  delete env.GITHUB_OUTPUT;
  return spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', env });
}

test('ui: the default package, tag v<version>', () => {
  const dry = run();
  assert.equal(dry.status, 0, dry.stderr);
  assert.match(dry.stdout, new RegExp(`^version=${uiVersion.replace(/\./g, '\\.')}$`, 'm'));
  assert.equal(run(`v${uiVersion}`).status, 0);
  assert.equal(run('--package', 'ui', `v${uiVersion}`).status, 0);
});

test('mcp: tag mcp-v<version>', () => {
  const result = run('--package', 'mcp', `mcp-v${mcpVersion}`);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`^version=${mcpVersion.replace(/\./g, '\\.')}$`, 'm'));
  assert.match(result.stdout, /^dist_tag=(latest|next)$/m);
});

test('a tag of the other package or another version fails', () => {
  const uiTagForMcp = run('--package', 'mcp', `v${mcpVersion}`);
  assert.equal(uiTagForMcp.status, 1);
  assert.match(
    uiTagForMcp.stderr,
    new RegExp(`expected the tag "mcp-v${mcpVersion.replace(/\./g, '\\.')}"`),
  );
  assert.equal(run(`mcp-v${uiVersion}`).status, 1);
  assert.equal(run('v999.0.0').status, 1);
});

test('an unknown package fails', () => {
  const result = run('--package', 'nope');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unknown package "nope"/);
});
