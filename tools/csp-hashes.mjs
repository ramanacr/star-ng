// Adds the hash of every inline script of a prerendered docs page to the Content Security Policy
// of that page: `node tools/csp-hashes.mjs [folder]` (default `dist/docs/browser`).
//
// The docs use incremental hydration, which turns on event replay. The prerender writes two
// inline scripts into each page that has event listeners: the event contract
// (`<script id="ng-event-dispatch-contract">`, the same text on every page) and one call
// `window.__jsaction_bootstrap(...)` with the event names of that page. The policy of
// `projects/docs/src/index.html` allows scripts from `'self'` only, so the browser would block
// both, and no event that the visitor sends before hydration would be replayed.
//
// Angular's `autoCsp` option cannot do this: the builder refuses it together with prerendering
// ("Cannot set both SSR and auto-CSP at the same time", Angular 22.2), and a nonce needs a
// server that answers each request. So this step runs after `ng build docs` (`build`,
// `build:docs`, `build:pages`): for each HTML file it reads the inline scripts, computes their
// SHA-256 hashes and adds them to the `script-src` directive of the `<meta>` policy of that file.
// `'unsafe-inline'` is never added; any other inline script stays blocked. A file without an
// inline script (the client shell `index.csr.html`) does not change.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const META = /(<meta\s+http-equiv="Content-Security-Policy"\s+content=")([^"]*)(")/i;
const INLINE_SCRIPT = /<script((?![^>]*\ssrc=)[^>]*)>([^]*?)<\/script>/gi;
/** A `type` that the browser does not run (data such as the `ng-state` JSON) needs no hash. */
const RUNS = /^(|module|(text|application)\/(java|ecma)script)$/i;

/**
 * The CSP source of a script text, for example `'sha256-...'`, as the browser computes it. The
 * HTML parser turns CR LF and CR into LF before the browser hashes the text, so this does too.
 */
export function scriptHash(text) {
  const normalized = text.replace(/\r\n?/g, '\n');
  return `'sha256-${createHash('sha256').update(normalized, 'utf8').digest('base64')}'`;
}

/**
 * The texts of the inline scripts (no `src`) of an HTML document that the browser runs, in
 * document order. A data block (`type="application/json"`) is skipped.
 */
export function inlineScripts(html) {
  return [...html.matchAll(INLINE_SCRIPT)]
    .filter((match) => RUNS.test(/\stype="([^"]*)"/i.exec(match[1])?.[1]?.trim() ?? ''))
    .map((match) => match[2]);
}

/**
 * Adds the hashes to the `script-src` directive of a policy text. The `script-src-attr` and
 * `script-src-elem` directives do not change. Throws when the policy has no `script-src`.
 */
export function addToScriptSrc(policy, hashes) {
  const directives = policy.split(';');
  const index = directives.findIndex((part) => /^\s*script-src\s/.test(part));
  if (index < 0) throw new Error(`csp-hashes: the policy has no script-src directive: ${policy}`);
  const sources = directives[index].trim().split(/\s+/);
  for (const hash of hashes) if (!sources.includes(hash)) sources.push(hash);
  const leading = /^\s*/.exec(directives[index])[0];
  directives[index] = leading + sources.join(' ');
  return directives.join(';');
}

/** The HTML with the hashes of its inline scripts in its policy. Unchanged without a script. */
export function hashPage(html) {
  const hashes = [...new Set(inlineScripts(html).map(scriptHash))];
  if (hashes.length === 0) return html;
  const meta = META.exec(html);
  if (!meta) throw new Error('csp-hashes: an HTML file with an inline script has no CSP <meta>');
  return html.replace(
    META,
    (_, start, policy, end) => start + addToScriptSrc(policy, hashes) + end,
  );
}

function htmlFiles(folder) {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Writes the hashes into every HTML file of the folder. Returns the number of changed files. */
export function addScriptHashes(folder) {
  let changed = 0;
  for (const file of htmlFiles(folder)) {
    const html = readFileSync(file, 'utf8');
    const next = hashPage(html);
    if (next !== html) {
      writeFileSync(file, next);
      changed++;
    }
  }
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const folder = resolve(process.argv[2] ?? 'dist/docs/browser');
  try {
    const changed = addScriptHashes(folder);
    console.log(`csp-hashes: added inline script hashes to ${changed} HTML files in ${folder}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
