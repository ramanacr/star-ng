// Smoke test of an installed @star-ng/mcp, used by .github/workflows/release-mcp.yml.
//   node tools/smoke-mcp.mjs <project-dir>
// <project-dir> holds node_modules/@star-ng/mcp (installed from the packed tarball, or from the
// registry after the publish). The test starts the `star-ng-mcp` bin of that install offline,
// sends `initialize` and two tool calls over stdio, and checks the answers. So it proves that the
// bin, the source files and the bundled data snapshot are all in the package.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node tools/smoke-mcp.mjs <project-dir>');
  process.exit(1);
}
const packageDir = resolve(dir, 'node_modules/@star-ng/mcp');
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const bin = join(packageDir, manifest.bin['star-ng-mcp']);

const child = spawn(process.execPath, [bin], {
  cwd: resolve(dir),
  env: { ...process.env, STAR_NG_MCP_OFFLINE: '1' },
  stdio: ['pipe', 'pipe', 'inherit'],
});
let stdout = '';
child.stdout.on('data', (chunk) => (stdout += chunk));
const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'smoke', version: '1' },
  },
});
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
send({
  jsonrpc: '2.0',
  id: 3,
  method: 'tools/call',
  params: { name: 'get_component', arguments: { name: 'StarButton' } },
});
child.stdin.end();
const [code] = await once(child, 'close');

assert.equal(code, 0, `the server exited with code ${code}`);
const answers = stdout
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line));
assert.equal(answers.length, 3, stdout);
assert.equal(answers[0].result.serverInfo.version, manifest.version);
assert.ok(answers[1].result.tools.length >= 6, 'tools/list lists the tools');
assert.equal(answers[2].result.isError, false, JSON.stringify(answers[2]));
assert.match(
  answers[2].result.content[0].text,
  /import \{ StarButton \} from '@star-ng\/ui\/button';/,
);
console.log(
  `smoke-mcp: @star-ng/mcp ${manifest.version} answered initialize, tools/list (${answers[1].result.tools.length} tools) and get_component.`,
);
