// Generates the files that coding agents (AI assistants) read to use StarNG:
//
//   llms.txt              short index: what StarNG is, setup, links to every guide and control
//   llms-full.txt         full text: setup, then every control with its API and example markup
//   mcp/components.json   the data of the MCP server `@star-ng/mcp` (projects/mcp)
//
// The data comes from the same sources as the docs application: the library source (API, read by
// `gen-docs-data.mjs`), the `<docs-example>` markup of the docs pages, the docs navigation
// (`nav.ts`) and the setup sections of README.md. So the agent files never drift from the docs.
//
//   node tools/agent-data.mjs <out-dir> [--site <url>]
//
// `pnpm build:pages` writes the files into the Pages output (dist/docs/browser), so they are served
// at https://ramanacr.github.io/star-ng/llms.txt and so on. `pnpm mcp:data` writes
// mcp/components.json into projects/mcp/data, the snapshot that the npm package bundles.
// The default site URL is the `homepage` of the library package.
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import { readApi, readExamples } from './gen-docs-data.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Version of the `components.json` format. The MCP server refuses any other version. */
export const SCHEMA_VERSION = 1;

/** The README sections that agents need to set up StarNG, in this order. */
const SETUP_SECTIONS = ['Requirements', 'Install', 'Include the styles', 'Use a control', 'Forms'];

function libraryPackage() {
  return JSON.parse(readFileSync(join(root, 'projects/star-ng/package.json'), 'utf8'));
}

/** The pages of the docs navigation: `{ group, label, path }`, in navigation order. */
export function readNav(text = readFileSync(join(root, 'projects/docs/src/app/nav.ts'), 'utf8')) {
  const pages = [];
  let group = '';
  const pattern = /label: '((?:[^'\\]|\\.)*)',\s*(?:path: '([^']+)'|items:)/g;
  for (const [, label, path] of text.matchAll(pattern)) {
    const plain = label.replace(/\\'/g, "'");
    if (path) pages.push({ group, label: plain, path });
    else group = plain;
  }
  return pages;
}

/** The `## <title>` sections of README.md that SETUP_SECTIONS names, as Markdown. */
export function readSetup(text = readFileSync(join(root, 'README.md'), 'utf8')) {
  const sections = new Map();
  for (const part of text.replace(/\r\n/g, '\n').split(/^## /m).slice(1)) {
    const newline = part.indexOf('\n');
    sections.set(part.slice(0, newline).trim(), part.slice(newline + 1).trim());
  }
  return SETUP_SECTIONS.map((title) => {
    const body = sections.get(title);
    if (body === undefined) throw new Error(`README.md has no section "## ${title}"`);
    return { title, markdown: body };
  });
}

/**
 * How a selector shows in markup: `star-button` for an element, `starTooltip` for an attribute.
 * A selector list (`a, b`) gives several patterns.
 */
function selectorPatterns(selector) {
  const patterns = [];
  for (const part of selector.split(',').map((item) => item.trim())) {
    const element = part.match(/^([a-z][\w-]*)/);
    const attributes = [...part.matchAll(/\[([\w-]+)\]/g)].map((match) => match[1]);
    if (attributes.length) {
      for (const attribute of attributes) patterns.push(new RegExp(`[\\s\\[(]${attribute}\\b`));
    } else if (element) {
      patterns.push(new RegExp(`<${element[1]}[\\s>/]`));
    }
  }
  return patterns;
}

/**
 * The docs page of each class: the page whose examples use its selector most often. A class
 * that no example uses gets the page of another class of the same entry point, or none.
 */
function pagesOf(api, examples, pagePaths) {
  const page = {};
  for (const [name, entry] of Object.entries(api)) {
    const patterns = selectorPatterns(entry.selector);
    const counts = new Map();
    for (const [key, code] of Object.entries(examples)) {
      if (!patterns.some((pattern) => pattern.test(code))) continue;
      const slug = key.split('/')[0];
      counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
    // 1. A page named like the class (StarSplitButton: split-button). 2. The page of its entry
    // point (@star-ng/ui/button: button) when an example there uses it. 3. The page with most uses.
    const own = name
      .replace(/^Star/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase();
    const entrySlug = entry.entry.split('/').at(-1);
    const best = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
    const choice = pagePaths.has(`controls/${own}`)
      ? own
      : counts.has(entrySlug)
        ? entrySlug
        : best;
    if (choice && pagePaths.has(`controls/${choice}`)) page[name] = choice;
  }
  for (const [name, entry] of Object.entries(api)) {
    if (page[name]) continue;
    const sibling = Object.keys(api).find(
      (other) => page[other] && api[other].entry === entry.entry,
    );
    page[name] = sibling ? page[sibling] : null;
  }
  return page;
}

/** `{ Class: BaseClass }` for every library class that extends another class. */
export function readBaseClasses(dir = join(root, 'projects/star-ng')) {
  const bases = {};
  const visit = (path) => {
    for (const name of readdirSync(path)) {
      const child = join(path, name);
      if (statSync(child).isDirectory()) {
        if (name !== 'node_modules') visit(child);
        continue;
      }
      if (!name.endsWith('.ts') || name.endsWith('.spec.ts')) continue;
      const source = ts.createSourceFile(
        child,
        readFileSync(child, 'utf8'),
        ts.ScriptTarget.Latest,
      );
      source.forEachChild((node) => {
        if (!ts.isClassDeclaration(node) || !node.name) return;
        const clause = node.heritageClauses?.find(
          (item) => item.token === ts.SyntaxKind.ExtendsKeyword,
        );
        const base = clause?.types[0]?.expression;
        if (base && ts.isIdentifier(base)) bases[node.name.text] = base.text;
      });
    }
  };
  visit(dir);
  return bases;
}

/**
 * The extractor reads only the members that a class declares. A control such as `StarSelect`
 * gets most inputs from its base class (`StarOptionListBase`). Adds the inherited inputs, models
 * and outputs; a member that the class declares again wins.
 */
export function withInheritedMembers(api, bases) {
  const resolved = {};
  const membersOf = (name, kind, seen = new Set()) => {
    if (!api[name] || seen.has(name)) return [];
    seen.add(name);
    const own = api[name][kind];
    const inherited = bases[name] ? membersOf(bases[name], kind, seen) : [];
    const names = new Set(own.map((member) => member.name));
    return [...inherited.filter((member) => !names.has(member.name)), ...own];
  };
  for (const [name, entry] of Object.entries(api)) {
    resolved[name] = {
      ...entry,
      inputs: membersOf(name, 'inputs'),
      models: membersOf(name, 'models'),
      outputs: membersOf(name, 'outputs'),
    };
  }
  return resolved;
}

/** Builds the agent data in memory. `site` is the absolute docs URL and ends with `/`. */
export function buildAgentData({
  site = libraryPackage().homepage,
  api = withInheritedMembers(readApi(), readBaseClasses()),
  examples = readExamples(),
  nav = readNav(),
  setup = readSetup(),
  version = libraryPackage().version,
} = {}) {
  if (!/^https?:\/\/.+\/$/.test(site)) throw new Error(`The site URL "${site}" must end with "/"`);
  const pagePaths = new Map(nav.map((page) => [page.path, page]));
  const pageOf = pagesOf(api, examples, pagePaths);

  const components = Object.entries(api).map(([name, entry]) => {
    const slug = pageOf[name];
    return {
      name,
      kind: entry.kind,
      selector: entry.selector,
      import: `import { ${name} } from '${entry.entry}';`,
      entry: entry.entry,
      description: entry.description,
      page: slug,
      docs: slug ? `${site}controls/${slug}` : null,
      inputs: entry.inputs,
      models: entry.models,
      outputs: entry.outputs,
    };
  });

  const data = {
    schemaVersion: SCHEMA_VERSION,
    package: '@star-ng/ui',
    version,
    site,
    setup,
    guides: nav
      .filter((page) => page.path.startsWith('guides/'))
      .map((page) => ({ title: page.label, url: `${site}${page.path}` })),
    pages: nav
      .filter((page) => page.path.startsWith('controls/'))
      .map((page) => ({
        slug: page.path.slice('controls/'.length),
        title: page.label,
        group: page.group,
        url: `${site}${page.path}`,
      })),
    components,
    examples,
  };
  return { data, llms: llmsTxt(data), llmsFull: llmsFullTxt(data) };
}

const INTRO =
  'StarNG (`@star-ng/ui`) is a library of accessible Angular controls built on signals, Signal ' +
  'Forms and the Angular CDK. Selector prefix `star-`, CSS token prefix `--star-`. Import each ' +
  'control from its entry point (for example `@star-ng/ui/button`), never from the package root.';

function llmsTxt(data) {
  const lines = [`# StarNG`, '', `> ${INTRO}`, ''];
  lines.push(
    `Version ${data.version}. Full text for agents: ${data.site}llms-full.txt. ` +
      'MCP server: `npx -y @star-ng/mcp`.',
    '',
    '## Guides',
    '',
  );
  for (const guide of data.guides) lines.push(`- [${guide.title}](${guide.url})`);
  lines.push('', '## Controls', '');
  for (const page of data.pages) {
    const names = data.components
      .filter((item) => item.page === page.slug)
      .map((item) => item.name);
    const detail = names.length ? `: ${names.map((name) => `\`${name}\``).join(', ')}` : '';
    lines.push(`- [${page.title}](${page.url})${detail}`);
  }
  lines.push('', '## Optional', '', `- [Full text](${data.site}llms-full.txt)`, '');
  return lines.join('\n');
}

function memberTable(title, members) {
  if (!members.length) return [];
  const cell = (text) => String(text ?? '').replace(/\|/g, '\\|');
  const rows = members.map(
    (member) =>
      `| \`${member.name}\`${member.required ? ' (required)' : ''} | \`${cell(member.type)}\` | ` +
      `${member.default === null ? '' : `\`${cell(member.default)}\``} | ${cell(member.description)} |`,
  );
  return [
    `${title}:`,
    '',
    '| Name | Type | Default | Description |',
    '| --- | --- | --- | --- |',
    ...rows,
    '',
  ];
}

/** API and description of one component as Markdown. */
function componentMarkdown(component) {
  const lines = [`### ${component.name}`, ''];
  lines.push(
    `Selector: \`${component.selector}\` (${component.kind}). \`${component.import}\``,
    '',
  );
  if (component.description) lines.push(component.description, '');
  lines.push(...memberTable('Inputs', component.inputs));
  lines.push(...memberTable('Two-way models', component.models));
  lines.push(...memberTable('Outputs', component.outputs));
  return lines;
}

function llmsFullTxt(data) {
  const lines = [`# StarNG ${data.version}`, '', `> ${INTRO}`, '', `Docs: ${data.site}`, ''];
  for (const section of data.setup) lines.push(`## ${section.title}`, '', section.markdown, '');
  lines.push('## Controls', '');
  for (const page of data.pages) {
    const components = data.components.filter((item) => item.page === page.slug);
    const examples = Object.entries(data.examples).filter(([key]) =>
      key.startsWith(`${page.slug}/`),
    );
    if (!components.length && !examples.length) continue;
    lines.push(`## ${page.title}`, '', `Docs page: ${page.url}`, '');
    for (const component of components) lines.push(...componentMarkdown(component));
    for (const [key, code] of examples)
      lines.push(`Example \`${key}\`:`, '', '```html', code, '```', '');
  }
  return lines.join('\n');
}

/** Writes llms.txt, llms-full.txt and mcp/components.json into `outDir`. */
export function writeAgentData(outDir, options) {
  const { data, llms, llmsFull } = buildAgentData(options);
  mkdirSync(join(outDir, 'mcp'), { recursive: true });
  writeFileSync(join(outDir, 'llms.txt'), llms);
  writeFileSync(join(outDir, 'llms-full.txt'), llmsFull);
  writeFileSync(join(outDir, 'mcp/components.json'), `${JSON.stringify(data)}\n`);
  return data;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { site: { type: 'string' } },
  });
  if (positionals.length !== 1) {
    console.error('usage: node tools/agent-data.mjs <out-dir> [--site <url>]');
    process.exit(1);
  }
  const data = writeAgentData(resolve(positionals[0]), values.site ? { site: values.site } : {});
  const unmapped = data.components.filter((item) => !item.page).map((item) => item.name);
  console.log(
    `agent-data: ${data.components.length} classes, ${Object.keys(data.examples).length} examples, ` +
      `${data.pages.length} pages written to ${positionals[0]} for ${data.site}` +
      (unmapped.length ? ` (no docs page: ${unmapped.join(', ')})` : ''),
  );
}
