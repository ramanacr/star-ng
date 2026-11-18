// The StarNG catalog: loads `components.json` (made by tools/agent-data.mjs) and answers the
// questions of the MCP tools. Every function here is pure, so the tests call them directly.
import { readFileSync } from 'node:fs';

/** The `components.json` format version that this server reads. */
export const SCHEMA_VERSION = 1;

/** Checks the shape of the data. Returns the data, or throws with the reason. */
export function validateData(data) {
  if (!data || typeof data !== 'object') throw new Error('the data is not an object');
  if (data.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`schemaVersion ${data.schemaVersion} is not ${SCHEMA_VERSION}`);
  }
  for (const key of ['components', 'pages', 'guides', 'setup']) {
    if (!Array.isArray(data[key])) throw new Error(`"${key}" is not an array`);
  }
  if (!data.examples || typeof data.examples !== 'object') throw new Error('"examples" is missing');
  if (typeof data.version !== 'string' || typeof data.site !== 'string') {
    throw new Error('"version" or "site" is missing');
  }
  return data;
}

export function readDataFile(path) {
  return validateData(JSON.parse(readFileSync(path, 'utf8')));
}

const norm = (text) => String(text ?? '').toLowerCase();
const kebab = (name) =>
  name
    .replace(/^Star/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

/** Finds the page of a name: page slug, page title, class name or selector. */
export function findPage(data, name) {
  const wanted = norm(name).trim().replace(/^<|>$/g, '');
  const bySlug = data.pages.find(
    (page) => page.slug === wanted || norm(page.title) === wanted || page.slug === kebab(name),
  );
  if (bySlug) return bySlug;
  const component = findComponent(data, name);
  return component?.page ? data.pages.find((page) => page.slug === component.page) : undefined;
}

/** Finds a class by its name (`StarButton`, `button`) or selector (`star-button`). */
export function findComponent(data, name) {
  const wanted = norm(name).trim().replace(/^<|>$/g, '');
  return (
    data.components.find((item) => norm(item.name) === wanted) ??
    data.components.find((item) => norm(item.name) === `star${wanted.replace(/-/g, '')}`) ??
    data.components.find((item) =>
      item.selector.split(',').some((part) => norm(part.trim()) === wanted),
    )
  );
}

function memberTable(title, members) {
  if (!members.length) return [];
  const cell = (text) => String(text ?? '').replace(/\|/g, '\\|');
  return [
    `${title}:`,
    '',
    '| Name | Type | Default | Description |',
    '| --- | --- | --- | --- |',
    ...members.map(
      (member) =>
        `| \`${member.name}\`${member.required ? ' (required)' : ''} | \`${cell(member.type)}\` | ` +
        `${member.default === null ? '' : `\`${cell(member.default)}\``} | ${cell(member.description)} |`,
    ),
    '',
  ];
}

function componentText(component) {
  return [
    `### ${component.name}`,
    '',
    `Selector: \`${component.selector}\` (${component.kind})`,
    '',
    '```ts',
    component.import,
    '```',
    '',
    ...(component.description ? [component.description, ''] : []),
    ...memberTable('Inputs', component.inputs),
    ...memberTable('Two-way models (use [(name)])', component.models),
    ...memberTable('Outputs', component.outputs),
  ].join('\n');
}

function examplesOf(data, slug) {
  return Object.entries(data.examples).filter(([key]) => key.startsWith(`${slug}/`));
}

/** `list_components`: one line per docs page with its classes. */
export function listComponents(data, { query } = {}) {
  const wanted = norm(query).trim();
  const lines = [];
  for (const page of data.pages) {
    const components = data.components.filter((item) => item.page === page.slug);
    const text = [page.title, page.slug, page.group, ...components.map((item) => item.name)]
      .concat(components.map((item) => item.selector))
      .join(' ');
    if (wanted && !norm(text).includes(wanted)) continue;
    const names = components.map((item) => `${item.name} \`${item.selector}\``).join(', ');
    lines.push(
      `- ${page.title} (page \`${page.slug}\`, ${page.group})${names ? `: ${names}` : ''}`,
    );
  }
  if (!lines.length)
    return `No StarNG control matches "${query}". Call list_components without a query.`;
  return [
    `StarNG ${data.version}: ${lines.length} docs pages. Use get_component with a page or class name for the API.`,
    '',
    ...lines,
  ].join('\n');
}

/** `get_component`: the API of every class of a page (or of one class), plus example keys. */
export function getComponent(data, { name }) {
  const page = findPage(data, name);
  const single = findComponent(data, name);
  const components = page
    ? data.components.filter((item) => item.page === page.slug)
    : single
      ? [single]
      : [];
  if (!components.length && !page) {
    return { error: `No StarNG control "${name}". ${suggestion(data, name)}` };
  }
  const examples = page ? examplesOf(data, page.slug).map(([key]) => `\`${key}\``) : [];
  const lines = [
    `## ${page ? page.title : components[0].name} (StarNG ${data.version})`,
    '',
    ...(page ? [`Docs: ${page.url}`, ''] : []),
    ...components.map(componentText),
  ];
  if (examples.length) {
    lines.push(`Examples (get_examples with "${page.slug}"): ${examples.join(', ')}`);
  }
  return { text: lines.join('\n') };
}

/** `get_examples`: the markup of the examples of a page, or of one example key. */
export function getExamples(data, { name, limit = 5 }) {
  if (data.examples[name]) return { text: fence(name, data.examples[name]) };
  const page = findPage(data, name);
  if (!page) return { error: `No StarNG docs page "${name}". ${suggestion(data, name)}` };
  const examples = examplesOf(data, page.slug);
  if (!examples.length)
    return { text: `The page ${page.title} has no example markup. Docs: ${page.url}` };
  const shown = examples.slice(0, Math.max(1, Math.min(limit, 50)));
  const lines = [
    `## Examples: ${page.title}`,
    '',
    'This is the template markup. The class of the host component imports the StarNG classes ' +
      '(see get_component) and holds the bound fields. CSS classes that start with `docs-` ' +
      'belong to the docs site layout: leave them out.',
    '',
    ...shown.map(([key, code]) => fence(key, code)),
  ];
  if (shown.length < examples.length) {
    lines.push(
      `${examples.length - shown.length} more: ${examples
        .slice(shown.length)
        .map(([key]) => `\`${key}\``)
        .join(', ')}`,
    );
  }
  return { text: lines.join('\n') };
}

function fence(key, code) {
  return `Example \`${key}\`:\n\n\`\`\`html\n${code}\n\`\`\`\n`;
}

/** `search`: pages, classes, members and guides that match all words of the query. */
export function search(data, { query, limit = 10 }) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 'Give a query, for example "date range" or "table export".';
  const hits = [];
  for (const component of data.components) {
    const members = [...component.inputs, ...component.models, ...component.outputs];
    const text = norm(
      [component.name, component.selector, component.description, component.page]
        .concat(members.map((member) => `${member.name} ${member.description}`))
        .join(' '),
    );
    const score = scoreOf(words, text, norm(`${component.name} ${component.selector}`));
    if (score) {
      const summary = component.description ? `: ${component.description.slice(0, 140)}` : '';
      hits.push({
        score,
        line: `- ${component.name} \`${component.selector}\` (page \`${component.page}\`)${summary}`,
      });
    }
  }
  for (const guide of data.guides) {
    const score = scoreOf(words, norm(guide.title), norm(guide.title));
    if (score) hits.push({ score, line: `- Guide: ${guide.title} ${guide.url}` });
  }
  hits.sort((a, b) => b.score - a.score);
  if (!hits.length) return `Nothing in StarNG matches "${query}". Try list_components.`;
  return hits
    .slice(0, Math.max(1, Math.min(limit, 50)))
    .map((hit) => hit.line)
    .join('\n');
}

function scoreOf(words, text, title) {
  if (!words.every((word) => text.includes(word))) return 0;
  return words.reduce((total, word) => total + (title.includes(word) ? 3 : 1), 0);
}

/** `get_setup`: install, styles, first use and forms, plus the guide links. */
export function getSetup(data, { installedVersion } = {}) {
  const lines = [`# Set up StarNG ${data.version} (\`@star-ng/ui\`)`, ''];
  if (installedVersion && installedVersion !== data.version) {
    lines.push(
      `Note: this project has @star-ng/ui ${installedVersion} installed. This data describes ${data.version}.`,
      '',
    );
  }
  for (const section of data.setup) lines.push(`## ${section.title}`, '', section.markdown, '');
  lines.push('## Guides', '', ...data.guides.map((guide) => `- ${guide.title}: ${guide.url}`));
  return lines.join('\n');
}

// ---------- validate_usage ----------

/** Bindings that Angular or its forms give to any element. They are never reported. */
const COMMON_BINDINGS = new Set([
  'class',
  'style',
  'id',
  'formfield',
  'formcontrol',
  'formcontrolname',
  'formgroup',
  'formgroupname',
  'ngmodel',
  'ngmodelchange',
  'ngclass',
  'ngstyle',
  'click',
  'dblclick',
  'keydown',
  'keyup',
  'focus',
  'blur',
  'focusin',
  'focusout',
  'mouseenter',
  'mouseleave',
  'contextmenu',
  'input',
  'change',
  'submit',
]);

function bindingName(raw) {
  // [(value)], [value], (pressed), bind-x and on-x are not used by StarNG docs; keep the base name.
  return raw
    .replace(/^\[\(|\)\]$/g, '')
    .replace(/^[[(]|[\])]$/g, '')
    .split('.')[0];
}

/** Elements and their attributes in Angular template markup, by a small tag scanner. */
function scanTags(html) {
  const tags = [];
  const tagPattern =
    /<([a-zA-Z][\w-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>/g;
  for (const match of html.matchAll(tagPattern)) {
    const attributes = [
      ...match[2].matchAll(/\s+([^\s=>/]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g),
    ].map((item) => item[1]);
    const line = html.slice(0, match.index).split('\n').length;
    tags.push({ tag: match[1], attributes, line });
  }
  return tags;
}

function closest(word, candidates) {
  let best = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(word.toLowerCase(), candidate.toLowerCase());
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best && bestDistance <= Math.max(2, Math.floor(word.length / 3)) ? best : null;
}

function editDistance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

/** The classes whose selector matches an element with these attributes. */
function matchingComponents(data, tag, attributes) {
  const names = new Set(attributes.map((attribute) => norm(bindingName(attribute))));
  return data.components.filter((component) =>
    component.selector.split(',').some((part) => {
      const selector = part.trim();
      const element = selector.match(/^([a-z][\w-]*)/)?.[1];
      const required = [...selector.matchAll(/\[([\w-]+)\]/g)].map((item) => norm(item[1]));
      if (element && element !== 'ng-template' && element !== norm(tag)) return false;
      if (element === 'ng-template' && norm(tag) !== 'ng-template') return false;
      if (!element && !required.length) return false;
      return required.every((name) => names.has(name));
    }),
  );
}

/**
 * `validate_usage`: checks StarNG elements and their bindings in template markup.
 * Reports an unknown `star-*` element, and a bound input or output (`[x]`, `(x)`, `[(x)]`) that
 * no StarNG class on that element declares. Lists the imports that the markup needs.
 */
export function validateUsage(data, { html }) {
  const problems = [];
  const imports = new Map();
  const elementNames = data.components.flatMap((component) =>
    component.selector
      .split(',')
      .map((part) => part.trim().match(/^(star-[\w-]*)/)?.[1])
      .filter(Boolean),
  );
  for (const { tag, attributes, line } of scanTags(html)) {
    const lower = norm(tag);
    const components = matchingComponents(data, tag, attributes);
    if (lower.startsWith('star-') && !components.some((item) => item.selector.includes(lower))) {
      const near = closest(lower, elementNames);
      problems.push(
        `Line ${line}: <${tag}> is not a StarNG element.${near ? ` Did you mean <${near}>?` : ''}`,
      );
      continue;
    }
    if (!components.length) continue;
    for (const component of components) imports.set(component.name, component.import);
    if (!lower.startsWith('star-')) continue;
    const known = new Map();
    for (const component of components) {
      for (const member of [...component.inputs, ...component.models])
        known.set(norm(member.name), 'input');
      for (const member of component.models) known.set(`${norm(member.name)}change`, 'output');
      for (const member of component.outputs) known.set(norm(member.name), 'output');
      for (const part of component.selector.split(',')) {
        for (const item of part.matchAll(/\[([\w-]+)\]/g)) known.set(norm(item[1]), 'selector');
      }
    }
    for (const attribute of attributes) {
      if (!/^[[(]/.test(attribute)) continue;
      const name = bindingName(attribute);
      const lowerName = norm(name);
      if (/^(attr|class|style)$/.test(lowerName) || attribute.includes('.')) continue;
      if (COMMON_BINDINGS.has(lowerName) || lowerName.startsWith('aria')) continue;
      if (known.has(lowerName)) {
        const kind = known.get(lowerName);
        if (attribute.startsWith('(') && !attribute.startsWith('([') && kind === 'input') {
          problems.push(
            `Line ${line}: <${tag}> ${attribute}: "${name}" is an input, not an output.`,
          );
        }
        continue;
      }
      const near = closest(
        name,
        [...known.keys()].map((key) => originalName(components, key) ?? key),
      );
      problems.push(
        `Line ${line}: <${tag}> has no input or output "${name}" (${components.map((item) => item.name).join(', ')}).` +
          (near ? ` Did you mean "${near}"?` : ''),
      );
    }
  }
  const lines = [
    problems.length ? `${problems.length} problem(s):` : 'No problem found in the StarNG usage.',
  ];
  lines.push(...problems.map((problem) => `- ${problem}`));
  if (imports.size) {
    lines.push(
      '',
      'Add these imports and put the classes in the `imports` of the component:',
      '',
      '```ts',
    );
    lines.push(...[...imports.values()].sort());
    lines.push('```');
  }
  return { text: lines.join('\n'), problems };
}

function originalName(components, lowerName) {
  for (const component of components) {
    for (const member of [...component.inputs, ...component.models, ...component.outputs]) {
      if (norm(member.name) === lowerName) return member.name;
    }
  }
  return null;
}

function suggestion(data, name) {
  const near = closest(
    String(name),
    data.pages.map((page) => page.slug).concat(data.components.map((item) => item.name)),
  );
  return near ? `Did you mean "${near}"?` : 'Call list_components or search.';
}
