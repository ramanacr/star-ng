// Change detection for CI: which job groups does a pull request need?
//
//   git diff -z --name-only --no-renames <base>...<head> | node tools/ci-changes.mjs \
//     --event pull_request --labels '["bug"]' [--output-file FILE] [--summary-file FILE]
//
// The paths come on standard input, separated by NUL (from `git diff -z`) or by new lines.
// The tool prints `name=true|false` lines (the format of $GITHUB_OUTPUT) and a Markdown summary.
// With --output-file and --summary-file it appends them to those files (CI passes
// $GITHUB_OUTPUT and $GITHUB_STEP_SUMMARY). The rules are plain data in RULES below. The
// tests are in `ci-changes.test.mjs` (`pnpm test:tools`). `ci-gate.mjs` uses the same job table.
//
// Safety rules, in this order (a full run needs every job):
//   1. The event is not `pull_request` (push to main and so on): FULL. This is the safety net.
//   2. The pull request has the label `ci:full`: FULL.
//   3. The list of changed files is empty: FULL. A pull request always changes a file, so an
//      empty list means that the diff failed or that the checkout is too shallow.
//   4. Otherwise every changed path is matched against RULES, and the needs of all paths are
//      added up. A path that no rule matches needs EVERYTHING (the last rule), so a new kind
//      of file can never skip a job by accident.
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

/** The label that forces a full run. Documented in CONTRIBUTING.md. */
export const FORCE_LABEL = 'ci:full';

/**
 * The jobs of ci.yml and the output name of `changes` that decides each of them.
 * `ci-gate.mjs` checks every job in this table.
 */
export const JOBS = [
  { job: 'light', output: 'light', title: 'light (format check, name check)' },
  {
    job: 'build-test',
    output: 'build_test',
    title: 'build-test (format, lint, unit tests, build)',
  },
  { job: 'docs-build', output: 'docs_build', title: 'docs-build (production build of the docs)' },
  { job: 'e2e', output: 'e2e', title: 'e2e (2 shards)' },
  { job: 'e2e-dev', output: 'e2e', title: 'e2e-dev (tests that need ng serve)' },
  { job: 'a11y', output: 'a11y', title: 'a11y (2 shards)' },
  { job: 'visual', output: 'visual', title: 'visual (screenshots)' },
];

/**
 * Jobs of ci.yml that run on an output of `changes` but are not (yet) in the needs of
 * `ci-gate`: their result does not block a merge. A job stays here until it is green on a pull
 * request; then it moves to `JOBS` and into the needs of the gate. `ci-gate.test.mjs` checks
 * that each job exists, uses its output, and is NOT in the needs of the gate.
 */
export const ADVISORY_JOBS = [
  {
    job: 'e2e-cross-browser',
    output: 'e2e',
    title: 'e2e-cross-browser (Firefox and WebKit, tag @cross-browser; not in the gate yet)',
  },
];

// The needs of a rule. `build` = the build-test job (it also does the format check and the
// name check, so it makes the `light` job unnecessary). `e2e` = the e2e and a11y jobs (both
// need the docs build). `visual` = the visual job (needs the docs build too).
const NONE = [];
const BUILD = ['build'];
const E2E = ['build', 'e2e'];
const VISUAL = ['build', 'visual'];
const ALL = ['build', 'e2e', 'visual'];

/**
 * The rules. The FIRST rule that matches a path decides it, so a narrow rule must stand before
 * a wide one. `needs: NONE` means: only the `light` job (format check and name check, which
 * read every file in the repository, so a changed Markdown file is still checked).
 * @type {{ name: string, test: RegExp, needs: string[], why: string }[]}
 */
export const RULES = [
  // --- CI itself --------------------------------------------------------------------------
  {
    name: 'ci.yml',
    test: /^\.github\/workflows\/ci\.yml$/,
    needs: ALL,
    why: 'the CI definition: a change must be proven by a full run',
  },
  {
    name: 'ci tool tests',
    test: /^tools\/ci-[^/]+\.test\.mjs$/,
    needs: BUILD,
    why: 'the tool tests run in build-test (pnpm test:tools)',
  },
  {
    name: 'ci tools',
    test: /^tools\/ci-[^/]+\.mjs$/,
    needs: ALL,
    why: 'the code that decides what runs: prove it with a full run',
  },
  // --- Files that CI never runs ------------------------------------------------------------
  {
    name: 'other workflows',
    test: /^\.github\/workflows\//,
    needs: NONE,
    why: 'pages, release and visual-baselines run on other events; no CI job can test them',
  },
  {
    name: '.github meta',
    test: /^\.github\/(?!workflows\/)/,
    needs: NONE,
    why: 'issue and pull request templates, CODEOWNERS, FUNDING, dependabot: no build input',
  },
  {
    name: 'editor settings',
    test: /^\.vscode\//,
    needs: NONE,
    why: 'editor settings, no build input',
  },
  // The packed README (the root README.md and LICENSE are copied into the package) has its
  // relative links checked by `check:package` in build-test, and every root Markdown file can
  // be a link target. So a root Markdown file or LICENSE needs `build-test`, not only `light`.
  {
    name: 'root markdown, LICENSE',
    test: /^([^/]+\.md|LICENSE)$/,
    needs: BUILD,
    why: 'README.md and LICENSE are packed, and check:package checks the README links',
  },
  {
    name: 'markdown',
    test: /\.md$/,
    needs: NONE,
    why: 'documentation: not a build input (format check and name check read it)',
  },
  {
    name: 'repository meta files',
    test: /^\.(gitignore|gitattributes|editorconfig|prettierignore|prettierrc)$/,
    needs: NONE,
    why: 'only the format check and name check read these (the light job checks every file)',
  },
  // --- Unit tests and tools that no browser job reads --------------------------------------
  {
    name: 'unit tests',
    test: /^projects\/(star-ng|docs)\/.*\.spec\.ts$/,
    needs: BUILD,
    why: 'Vitest specs: not part of the library, docs build or any page',
  },
  {
    name: 'build tools',
    test: /^tools\/(agent-data|build-pages|build-styles|check-names|check-package|gen-docs-data|pages-fallback|release-notes|release-version|smoke-consumer|smoke-mcp|visual-update)(\.test)?\.mjs$/,
    needs: BUILD,
    why: 'a changed generator output shows as a change in projects/docs (a full run); the rest do not touch the docs build',
  },
  {
    name: 'mcp server',
    test: /^projects\/mcp\//,
    needs: BUILD,
    why: 'the MCP server is tested in build-test (pnpm test:mcp); no page uses it',
  },
  {
    name: 'pages tests',
    test: /^(e2e\/pages\/|playwright\.pages\.config\.ts$)/,
    needs: BUILD,
    why: 'CI runs no Pages test (the Pages workflow publishes the site)',
  },
  {
    name: 'lint config',
    test: /^eslint\.config\.js$/,
    needs: BUILD,
    why: 'only lint reads it',
  },
  // --- Browser tests -----------------------------------------------------------------------
  {
    name: 'visual tests',
    test: /^(e2e\/visual\/|playwright\.visual\.config\.ts$)/,
    needs: VISUAL,
    why: 'screenshots and their baselines: only the visual job reads them',
  },
  {
    name: 'e2e tests',
    test: /^(e2e\/|playwright\.config\.ts$)/,
    needs: E2E,
    why: 'end-to-end and axe tests: pixels do not change',
  },
  // --- Everything that can change the page --------------------------------------------------
  // Spec files are matched above. The rest of `projects/` is source, styles, public files, a
  // tsconfig or a package manifest: it can change pixels.
  {
    name: 'library and docs',
    test: /^projects\//,
    needs: ALL,
    why: 'library code and styles, docs application, generated docs data',
  },
  {
    name: 'dependencies and build config',
    test: /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|angular\.json|tsconfig[^/]*\.json|\.nvmrc|\.npmrc|playwright\.server\.ts|tools\/pages-serve\.mjs)$/,
    needs: ALL,
    why: 'versions, compiler, Node, workspace, and the static server of the browser jobs',
  },
  // --- The safety net ---------------------------------------------------------------------
  {
    name: 'unknown file',
    test: /./s,
    needs: ALL,
    why: 'no rule knows this path, so it may change anything',
  },
];

/** Splits standard input into paths: NUL separated when it has a NUL, else one per line. */
export function parsePaths(text) {
  const separator = text.includes('\0') ? '\0' : '\n';
  const paths = text
    .split(separator)
    .map((line) => (separator === '\n' ? line.replace(/\r$/, '') : line))
    .map((line) => line.replace(/^\.\//, ''))
    .filter((line) => line !== '');
  return [...new Set(paths)];
}

/** The rule that decides a path. */
export function ruleFor(path) {
  return RULES.find((rule) => rule.test.test(path));
}

/** Parses the labels option: a JSON array of names, or a comma separated list. */
export function parseLabels(text) {
  if (!text || text.trim() === 'null') return [];
  const trimmed = text.trim();
  if (trimmed.startsWith('[')) {
    const value = JSON.parse(trimmed);
    if (!Array.isArray(value)) throw new Error('--labels must be a JSON array');
    return value.map(String);
  }
  return trimmed
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean);
}

/**
 * Decides what a change needs.
 * @param {{ event: string, paths: string[], labels?: string[] }} input
 * @returns {{ mode: 'full'|'selective', reason: string, outputs: Record<string,'true'|'false'>,
 *   triggers: Record<string,string[]>, matched: Map<string, {rule: object, files: string[]}> }}
 */
export function decide({ event, paths, labels = [] }) {
  const matched = new Map();
  const triggers = { build: [], e2e: [], visual: [] };
  let full = null;
  if (event !== 'pull_request') {
    full = `the event is "${event}", not a pull request: everything runs (safety net)`;
  } else if (labels.includes(FORCE_LABEL)) {
    full = `the pull request has the label "${FORCE_LABEL}"`;
  } else if (paths.length === 0) {
    full = 'the list of changed files is empty (a failed or shallow diff?): everything runs';
  }

  for (const path of paths) {
    const rule = ruleFor(path);
    const entry = matched.get(rule.name) ?? { rule, files: [] };
    entry.files.push(path);
    matched.set(rule.name, entry);
    for (const need of rule.needs) triggers[need].push(path);
  }

  const needs = full
    ? { build: true, e2e: true, visual: true }
    : {
        build: triggers.build.length > 0,
        e2e: triggers.e2e.length > 0,
        visual: triggers.visual.length > 0,
      };
  const browser = needs.e2e || needs.visual;
  const flags = {
    light: !needs.build,
    build_test: needs.build,
    docs_build: browser,
    e2e: needs.e2e,
    a11y: needs.e2e,
    visual: needs.visual,
  };
  const outputs = Object.fromEntries(Object.entries(flags).map(([key, on]) => [key, String(on)]));
  return {
    mode: full ? 'full' : 'selective',
    reason: full ?? 'the jobs follow the changed paths',
    outputs,
    triggers,
    matched,
  };
}

/** The `name=value` lines of $GITHUB_OUTPUT. */
export function formatOutputs(result) {
  return Object.entries(result.outputs)
    .map(([key, value]) => `${key}=${value}`)
    .concat(`mode=${result.mode}`)
    .join('\n');
}

const code = (text) => `\`${text.replaceAll('`', "'")}\``;

/** The Markdown job summary: what runs, and why. */
export function formatSummary(result, { event, paths }) {
  const lines = [];
  lines.push('## CI plan', '');
  lines.push(`- Event: ${code(event)}, changed files: ${paths.length}`);
  lines.push(`- Mode: **${result.mode}**. ${result.reason}.`, '');
  lines.push('| Job | Runs | Why |', '| --- | --- | --- |');
  const needOf = {
    light: 'build',
    build_test: 'build',
    docs_build: null,
    e2e: 'e2e',
    a11y: 'e2e',
    visual: 'visual',
  };
  for (const { output, title } of JOBS) {
    const runs = result.outputs[output] === 'true';
    let why;
    if (result.mode === 'full') why = 'full run';
    else if (output === 'light')
      why = runs ? 'only documentation and meta files changed' : 'build-test does the same checks';
    else if (output === 'docs_build')
      why = runs ? 'a browser job needs the production build' : 'no browser job runs';
    else if (runs)
      why = `for ${code(result.triggers[needOf[output]][0])}${result.triggers[needOf[output]].length > 1 ? ` and ${result.triggers[needOf[output]].length - 1} more` : ''}`;
    else why = 'no changed file can affect it';
    lines.push(`| ${title} | ${runs ? 'yes' : 'no (skipped)'} | ${why} |`);
  }
  if (result.matched.size > 0) {
    lines.push(
      '',
      '### Changed files by rule',
      '',
      '| Rule | Files | Needs | Example |',
      '| --- | --- | --- | --- |',
    );
    for (const { rule, files } of result.matched.values()) {
      const needs = rule.needs.length ? rule.needs.join(', ') : 'light only';
      lines.push(`| ${rule.name} | ${files.length} | ${needs} | ${code(files[0])} |`);
    }
  }
  return lines.join('\n') + '\n';
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const { values } = parseArgs({
    options: {
      event: { type: 'string', default: process.env.GITHUB_EVENT_NAME ?? '' },
      labels: { type: 'string', default: '' },
      'paths-file': { type: 'string' },
      'output-file': { type: 'string' },
      'summary-file': { type: 'string' },
    },
  });
  if (!values.event) {
    console.error('ci-changes: --event is required (or GITHUB_EVENT_NAME).');
    process.exit(2);
  }
  const text = values['paths-file']
    ? readFileSync(values['paths-file'], 'utf8')
    : await readStdin();
  const paths = parsePaths(text);
  const result = decide({ event: values.event, paths, labels: parseLabels(values.labels) });
  const outputs = formatOutputs(result) + '\n';
  const summary = formatSummary(result, { event: values.event, paths });
  if (values['output-file']) appendFileSync(values['output-file'], outputs);
  else process.stdout.write(outputs);
  if (values['summary-file']) appendFileSync(values['summary-file'], summary);
  else process.stdout.write('\n' + summary);
  // The log shows the plan as well, whatever the files are.
  if (values['output-file']) process.stdout.write(outputs + '\n' + summary);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ci-changes: ${error.message}`);
    process.exit(1);
  });
}
