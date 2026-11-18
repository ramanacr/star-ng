// Tests of the MCP protocol layer: the request handler, the data fetch, and a real stdio session.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readDataFile } from '../src/catalog.mjs';
import {
  BUNDLED_DATA,
  createHandler,
  fetchData,
  PROTOCOL_VERSIONS,
  TOOLS,
} from '../src/server.mjs';

const data = readDataFile(BUNDLED_DATA);
const handle = createHandler({
  getData: () => data,
  cwd: fileURLToPath(new URL('.', import.meta.url)),
});
const call = (name, args, id = 1) =>
  handle({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

test('initialize answers the asked protocol version, or the newest one', () => {
  const known = handle({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-03-26' },
  });
  assert.equal(known.result.protocolVersion, '2025-03-26');
  assert.equal(known.result.serverInfo.name, 'star-ng');
  assert.ok(known.result.capabilities.tools);
  assert.match(known.result.instructions, /StarNG/);
  const unknown = handle({
    jsonrpc: '2.0',
    id: 2,
    method: 'initialize',
    params: { protocolVersion: '1999-01-01' },
  });
  assert.equal(unknown.result.protocolVersion, PROTOCOL_VERSIONS[0]);
});

test('tools/list gives every tool with a schema; notifications get no answer', () => {
  const list = handle({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
  assert.deepEqual(
    list.result.tools.map((tool) => tool.name),
    TOOLS.map((tool) => tool.name),
  );
  for (const tool of list.result.tools) assert.equal(tool.inputSchema.type, 'object');
  assert.equal(handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.deepEqual(handle({ jsonrpc: '2.0', id: 4, method: 'ping' }).result, {});
});

test('errors: unknown method, unknown tool, missing argument, invalid request', () => {
  assert.equal(handle({ jsonrpc: '2.0', id: 5, method: 'resources/list' }).error.code, -32601);
  assert.equal(call('no_such_tool', {}).error.code, -32602);
  const missing = call('get_component', {});
  assert.equal(missing.result.isError, true);
  assert.match(missing.result.content[0].text, /"name" is required/);
  assert.equal(handle({ id: 6, method: 'ping' }).error.code, -32600);
});

test('tools/call returns text content; a not-found name is a tool error', () => {
  const found = call('get_component', { name: 'StarButton' });
  assert.equal(found.result.isError, false);
  assert.match(found.result.content[0].text, /@star-ng\/ui\/button/);
  assert.equal(call('get_component', { name: 'nothing-here-at-all' }).result.isError, true);
  assert.match(call('get_setup', {}).result.content[0].text, /Include the styles/);
});

test('fetchData uses valid data and refuses a failed or invalid answer', async () => {
  const ok = async () => ({ ok: true, json: async () => data });
  assert.equal((await fetchData('x', { fetchImpl: ok })).version, data.version);
  const notFound = async () => ({ ok: false });
  assert.equal(await fetchData('x', { fetchImpl: notFound }), null);
  const wrong = async () => ({ ok: true, json: async () => ({ schemaVersion: 99 }) });
  assert.equal(await fetchData('x', { fetchImpl: wrong }), null);
  const down = async () => {
    throw new Error('offline');
  };
  assert.equal(await fetchData('x', { fetchImpl: down }), null);
});

test('stdio session: the bin answers initialize and tools/call line by line', async () => {
  const bin = fileURLToPath(new URL('../bin/star-ng-mcp.mjs', import.meta.url));
  const child = spawn(process.execPath, [bin], {
    env: { ...process.env, STAR_NG_MCP_OFFLINE: '1' },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const messages = [];
  let buffer = '';
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      messages.push(JSON.parse(buffer.slice(0, index)));
      buffer = buffer.slice(index + 1);
    }
  });
  const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    },
  });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'search', arguments: { query: 'tooltip' } },
  });
  child.stdin.write('not json\n');
  child.stdin.end();
  await once(child, 'close');
  assert.equal(messages.length, 3, JSON.stringify(messages));
  assert.equal(messages[0].result.protocolVersion, '2025-06-18');
  assert.match(messages[1].result.content[0].text, /StarTooltip/);
  assert.equal(messages[2].error.code, -32700);
});
