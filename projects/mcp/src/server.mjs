// The MCP server of StarNG over stdio: JSON-RPC 2.0 messages, one per line
// (https://modelcontextprotocol.io/specification, transport "stdio"). It has no dependencies.
//
// Data: the server starts with the snapshot in `data/mcp/components.json` (bundled in the npm
// package). Then it fetches the current data from the docs site once, in the background, and uses it
// when it is valid. Set STAR_NG_MCP_OFFLINE=1 to never fetch, or STAR_NG_MCP_DATA_URL to fetch from
// another address (for example a fork or a local preview).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import {
  getComponent,
  getExamples,
  getSetup,
  listComponents,
  readDataFile,
  search,
  validateData,
  validateUsage,
} from './catalog.mjs';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

export const DEFAULT_DATA_URL = 'https://ramanacr.github.io/star-ng/mcp/components.json';
export const BUNDLED_DATA = new URL('../data/mcp/components.json', import.meta.url);

/** Protocol versions this server speaks, newest first. */
export const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS =
  'StarNG (@star-ng/ui) is a library of accessible Angular controls (signals, Signal Forms, Angular ' +
  'CDK). When you build Angular UI in a project that uses StarNG, use its controls instead of ' +
  'hand-written HTML controls. Call get_setup once for install and styles, then search or ' +
  'list_components to find a control, get_component for its API, get_examples for template markup, ' +
  'and validate_usage to check the markup you wrote. Import each class from its entry point ' +
  '(for example @star-ng/ui/button), never from the package root.';

const NAME_SCHEMA = {
  type: 'string',
  description:
    'A docs page slug (date-picker), a class name (StarDatePicker) or a selector (star-date-picker).',
};

export const TOOLS = [
  {
    name: 'get_setup',
    title: 'Set up StarNG',
    description: 'Install commands, styles, first use, forms and the list of guides of StarNG.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'list_components',
    title: 'List StarNG controls',
    description: 'Every StarNG docs page with its classes and selectors. Optional filter text.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Filter, for example "menu" or "date".' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'search',
    title: 'Search StarNG',
    description:
      'Find StarNG controls, inputs, outputs and guides by words, for example "multiple selection chips".',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to find. Every word must match.' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Maximum results (default 10).',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_component',
    title: 'Get a StarNG control API',
    description:
      'Import line, selector, inputs, two-way models and outputs of a StarNG control (all classes of its docs page), with the docs URL and example keys.',
    inputSchema: {
      type: 'object',
      properties: { name: NAME_SCHEMA },
      required: ['name'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'get_examples',
    title: 'Get StarNG example markup',
    description:
      'The template markup of the live examples of a StarNG docs page, or of one example key (page/id).',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          ...NAME_SCHEMA,
          description: `${NAME_SCHEMA.description} Or an example key, for example date-picker/range.`,
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Maximum examples (default 5).',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: 'validate_usage',
    title: 'Check StarNG markup',
    description:
      'Checks Angular template markup: unknown star-* elements and bindings that no StarNG input or output declares, with suggestions. Lists the imports the markup needs.',
    inputSchema: {
      type: 'object',
      properties: { html: { type: 'string', description: 'Angular template markup.' } },
      required: ['html'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

/** The version of @star-ng/ui in the project the agent works in, or undefined. */
function installedVersion(cwd) {
  const path = join(cwd, 'node_modules/@star-ng/ui/package.json');
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Creates the request handler. `getData` returns the current catalog data.
 * Returns `handle(message)`: the response object, or null for a notification.
 */
export function createHandler({ getData, cwd = process.cwd() }) {
  const tools = {
    get_setup: (data) => ({ text: getSetup(data, { installedVersion: installedVersion(cwd) }) }),
    list_components: (data, args) => ({ text: listComponents(data, args) }),
    search: (data, args) => ({ text: search(data, args) }),
    get_component: (data, args) => getComponent(data, args),
    get_examples: (data, args) => getExamples(data, args),
    validate_usage: (data, args) => validateUsage(data, args),
  };

  return function handle(message) {
    const { id, method, params } = message ?? {};
    const isRequest = id !== undefined && id !== null;
    const reply = (result) => (isRequest ? { jsonrpc: '2.0', id, result } : null);
    const fail = (code, text) =>
      isRequest ? { jsonrpc: '2.0', id, error: { code, message: text } } : null;

    if (message?.jsonrpc !== '2.0' || typeof method !== 'string') {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32600, message: 'Invalid Request' },
      };
    }
    switch (method) {
      case 'initialize': {
        const asked = params?.protocolVersion;
        return reply({
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'star-ng', title: 'StarNG', version: packageJson.version },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping':
        return reply({});
      case 'tools/list':
        return reply({ tools: TOOLS });
      case 'tools/call': {
        const tool = tools[params?.name];
        if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
        const args = params?.arguments ?? {};
        const schema = TOOLS.find((item) => item.name === params.name).inputSchema;
        for (const key of schema.required ?? []) {
          if (typeof args[key] !== 'string' || !args[key].trim()) {
            return reply({
              content: [{ type: 'text', text: `"${key}" is required.` }],
              isError: true,
            });
          }
        }
        try {
          const result = tool(getData(), args);
          return reply({
            content: [{ type: 'text', text: result.error ?? result.text }],
            isError: Boolean(result.error),
          });
        } catch (error) {
          return reply({
            content: [{ type: 'text', text: `Error: ${error.message}` }],
            isError: true,
          });
        }
      }
      default:
        if (method.startsWith('notifications/')) return null;
        return fail(-32601, `Method not found: ${method}`);
    }
  };
}

/** Fetches newer data. Resolves to the data, or null when it is not available or not valid. */
export async function fetchData(url, { timeoutMs = 4000, fetchImpl = globalThis.fetch } = {}) {
  try {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return validateData(await response.json());
  } catch {
    return null;
  }
}

/** Runs the server on stdin and stdout. Logs go to stderr (stdout is the protocol channel). */
export function runServer({
  input = process.stdin,
  output = process.stdout,
  env = process.env,
  log = (text) => process.stderr.write(`[star-ng-mcp] ${text}\n`),
} = {}) {
  let data = readDataFile(BUNDLED_DATA);
  log(`StarNG ${data.version} data loaded from the package`);

  if (env.STAR_NG_MCP_OFFLINE !== '1') {
    const url = env.STAR_NG_MCP_DATA_URL || DEFAULT_DATA_URL;
    fetchData(url).then((fresh) => {
      if (fresh) {
        data = fresh;
        log(`StarNG ${fresh.version} data loaded from ${url}`);
      } else {
        log(`could not load ${url}; using the package data`);
      }
    });
  }

  const handle = createHandler({ getData: () => data });
  const lines = createInterface({ input, crlfDelay: Infinity });
  lines.on('line', (line) => {
    if (!line.trim()) return;
    let response;
    try {
      const message = JSON.parse(line);
      response = Array.isArray(message)
        ? {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32600, message: 'Batches are not supported' },
          }
        : handle(message);
    } catch {
      response = { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } };
    }
    if (response) output.write(`${JSON.stringify(response)}\n`);
  });
  return lines;
}
