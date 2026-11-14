// Generates the data that the docs application shows next to each live example:
//
// 1. API: every component and directive of the library with its selector, inputs, models and
//    outputs (name, type, default, description), read from the library source with the
//    TypeScript compiler API.
// 2. Example source: the markup inside each `<docs-example source="page/id">` element of the
//    docs pages, so the code that a page shows is always the code that runs.
//
// Output: projects/docs/src/app/generated/docs-data.ts (committed).
//   node tools/gen-docs-data.mjs          writes the file
//   node tools/gen-docs-data.mjs --check  fails when the file is out of date (used by lint)
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const libRoot = join(root, 'projects/star-ng');
const docsRoot = join(root, 'projects/docs/src/app');
const outFile = join(docsRoot, 'generated/docs-data.ts');

function walk(dir, test, found = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== 'node_modules' && name !== 'generated') walk(path, test, found);
    } else if (test(name)) {
      found.push(path);
    }
  }
  return found;
}

// ---------- API ----------

const SIGNAL_KINDS = { input: 'input', model: 'model', output: 'output' };

function jsDoc(node, source) {
  const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
  const last = ranges.at(-1);
  if (!last) return '';
  const text = source.text.slice(last.pos, last.end);
  if (!text.startsWith('/**')) return '';
  return text
    .replace(/^\/\*\*|\*\/$/g, '')
    .split('\n')
    .map((line) => line.replace(/^\s*\*? ?/, ''))
    .join('\n')
    .trim();
}

/** First paragraph of a doc comment, on one line, without code blocks. */
function summary(doc) {
  return doc
    .split(/\n\s*\n|```/)[0]
    .replace(/\s+/g, ' ')
    .trim();
}

function decoratorOf(node) {
  for (const decorator of ts.getDecorators(node) ?? []) {
    const call = decorator.expression;
    if (!ts.isCallExpression(call)) continue;
    const name = call.expression.getText();
    if (name !== 'Component' && name !== 'Directive') continue;
    const config = call.arguments[0];
    let selector = '';
    if (config && ts.isObjectLiteralExpression(config)) {
      for (const property of config.properties) {
        if (ts.isPropertyAssignment(property) && property.name.getText() === 'selector') {
          selector = property.initializer.getText().slice(1, -1);
        }
      }
    }
    return { kind: name.toLowerCase(), selector };
  }
  return null;
}

function inferType(expression) {
  if (!expression) return 'unknown';
  if (ts.isStringLiteralLike(expression)) return 'string';
  if (ts.isNumericLiteral(expression)) return 'number';
  if (expression.kind === ts.SyntaxKind.TrueKeyword) return 'boolean';
  if (expression.kind === ts.SyntaxKind.FalseKeyword) return 'boolean';
  if (expression.kind === ts.SyntaxKind.NullKeyword) return 'null';
  if (ts.isArrayLiteralExpression(expression)) return 'unknown[]';
  return 'unknown';
}

function signalMember(member, source) {
  if (!ts.isPropertyDeclaration(member) || !member.initializer) return null;
  const modifiers = (ts.getModifiers(member) ?? []).map((modifier) => modifier.kind);
  if (
    modifiers.includes(ts.SyntaxKind.PrivateKeyword) ||
    modifiers.includes(ts.SyntaxKind.ProtectedKeyword)
  ) {
    return null;
  }
  const call = member.initializer;
  if (!ts.isCallExpression(call)) return null;
  const callee = call.expression.getText();
  const [base, variant] = callee.split('.');
  const kind = SIGNAL_KINDS[base];
  if (!kind || (variant && variant !== 'required')) return null;

  const required = variant === 'required';
  const typeArgument = call.typeArguments?.[0]?.getText();
  const [first, second] = call.arguments;
  const options = required ? first : second;
  let alias = null;
  let transform = null;
  if (options && ts.isObjectLiteralExpression(options)) {
    for (const property of options.properties) {
      if (!ts.isPropertyAssignment(property)) continue;
      if (property.name.getText() === 'alias') alias = property.initializer.getText().slice(1, -1);
      if (property.name.getText() === 'transform') transform = property.initializer.getText();
    }
  }
  let type = typeArgument;
  if (!type && transform === 'booleanAttribute') type = 'boolean';
  if (!type && transform === 'numberAttribute') type = 'number';
  if (!type && kind === 'output') type = 'void';
  if (!type) type = required ? 'unknown' : inferType(first);

  let defaultText = kind === 'output' || required || !first ? null : first.getText();
  // An id from the CDK id generator: a string, unique per instance.
  if (defaultText && defaultText.includes('.getId(')) {
    if (!typeArgument) type = 'string';
    defaultText = '(generated id)';
  }
  return {
    kind,
    name: alias ?? member.name.getText(),
    type: type.replace(/\s+/g, ' '),
    default: defaultText && defaultText.length <= 60 ? defaultText.replace(/\s+/g, ' ') : null,
    required,
    description: summary(jsDoc(member, source)),
  };
}

function readApi() {
  const api = {};
  const files = walk(libRoot, (name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'));
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const entry = relative(libRoot, file).split(/[\\/]/)[0];
    source.forEachChild((node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const decorator = decoratorOf(node);
      if (!decorator) return;
      const members = node.members.map((member) => signalMember(member, source)).filter(Boolean);
      api[node.name.text] = {
        kind: decorator.kind,
        selector: decorator.selector,
        entry: `star-ng/${entry}`,
        description: summary(jsDoc(node, source)),
        inputs: members.filter((member) => member.kind === 'input').map(strip),
        models: members.filter((member) => member.kind === 'model').map(strip),
        outputs: members.filter((member) => member.kind === 'output').map(strip),
      };
    });
  }
  return Object.fromEntries(Object.entries(api).sort(([a], [b]) => a.localeCompare(b)));
}

function strip({ kind: _kind, ...member }) {
  return member;
}

// ---------- Example source ----------

function dedent(text) {
  const lines = text
    .replace(/^\s*\n/, '')
    .replace(/\s+$/, '')
    .split('\n');
  const indent = Math.min(
    ...lines.filter((line) => line.trim()).map((line) => line.match(/^ */)[0].length),
  );
  return lines.map((line) => line.slice(indent)).join('\n');
}

function readExamples() {
  const examples = {};
  const pattern = /<docs-example\b[^>]*\bsource="([^"]+)"[^>]*>([\s\S]*?)<\/docs-example>/g;
  for (const file of walk(docsRoot, (name) => /\.(page|guide)\.ts$/.test(name))) {
    const text = readFileSync(file, 'utf8');
    for (const [, key, body] of text.matchAll(pattern)) {
      if (examples[key]) throw new Error(`Duplicate example source key "${key}" in ${file}`);
      // Template text is inside a TypeScript template literal: undo its escapes.
      examples[key] = dedent(body.replace(/\\`/g, '`').replace(/\\\$\{/g, '${'));
    }
  }
  return Object.fromEntries(Object.entries(examples).sort(([a], [b]) => a.localeCompare(b)));
}

// ---------- Output ----------

const content = `// Generated by tools/gen-docs-data.mjs. Do not edit; run \`pnpm docs:gen\`.
export interface DocsApiMember {
  readonly name: string;
  readonly type: string;
  readonly default: string | null;
  readonly required: boolean;
  readonly description: string;
}

export interface DocsApiEntry {
  readonly kind: 'component' | 'directive';
  readonly selector: string;
  readonly entry: string;
  readonly description: string;
  readonly inputs: readonly DocsApiMember[];
  readonly models: readonly DocsApiMember[];
  readonly outputs: readonly DocsApiMember[];
}

export const DOCS_API: Readonly<Record<string, DocsApiEntry>> = ${JSON.stringify(readApi(), null, 2)};

export const DOCS_EXAMPLES: Readonly<Record<string, string>> = ${JSON.stringify(readExamples(), null, 2)};
`;

if (process.argv.includes('--check')) {
  const current = existsSync(outFile) ? readFileSync(outFile, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== content) {
    console.error('docs-data.ts is out of date. Run `pnpm docs:gen` and commit the result.');
    process.exit(1);
  }
  console.log('docs-data.ts is up to date.');
} else {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, content);
  console.log(`wrote ${relative(root, outFile)}`);
}
