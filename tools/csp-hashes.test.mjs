import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  addScriptHashes,
  addToScriptSrc,
  hashPage,
  inlineScripts,
  scriptHash,
} from './csp-hashes.mjs';

const POLICY =
  "default-src 'self'; script-src 'self'; script-src-attr 'unsafe-hashes' 'sha256-x='; object-src 'none'";
const page = (body) =>
  `<html><head><meta http-equiv="Content-Security-Policy" content="${POLICY}" />` +
  `<script src="first-paint.js"></script></head><body>${body}</body></html>`;

test('scriptHash is the base64 SHA-256 of the text with LF line ends', () => {
  const expected = createHash('sha256').update('a\nb', 'utf8').digest('base64');
  assert.equal(scriptHash('a\nb'), `'sha256-${expected}'`);
  assert.equal(scriptHash('a\r\nb'), scriptHash('a\nb'));
});

test('inlineScripts skips scripts with src and data blocks', () => {
  const html = page(
    '<script type="text/javascript" id="c">one()</script><script>two()</script>' +
      '<script id="ng-state" type="application/json">{}</script>',
  );
  assert.deepEqual(inlineScripts(html), ['one()', 'two()']);
});

test('addToScriptSrc changes script-src only and adds each hash once', () => {
  const next = addToScriptSrc(POLICY, ["'sha256-a='", "'sha256-a='"]);
  assert.match(next, /script-src 'self' 'sha256-a=';/);
  assert.match(next, /script-src-attr 'unsafe-hashes' 'sha256-x=';/);
  assert.equal(addToScriptSrc(next, ["'sha256-a='"]), next);
  assert.throws(() => addToScriptSrc("default-src 'self'", ["'sha256-a='"]), /no script-src/);
});

test('hashPage adds the hashes of the inline scripts, never unsafe-inline', () => {
  const html = page(
    '<script id="c">contract()</script><script>window.__jsaction_bootstrap()</script>',
  );
  const next = hashPage(html);
  assert.ok(next.includes(scriptHash('contract()')));
  assert.ok(next.includes(scriptHash('window.__jsaction_bootstrap()')));
  assert.ok(!next.includes('unsafe-inline'));
  assert.equal(hashPage(page('<p>no script</p>')), page('<p>no script</p>'));
  assert.throws(() => hashPage('<body><script>x()</script></body>'), /no CSP <meta>/);
});

test('addScriptHashes writes every HTML file of the folder, including nested ones', () => {
  const folder = mkdtempSync(join(tmpdir(), 'csp-hashes-'));
  try {
    mkdirSync(join(folder, 'controls', 'table'), { recursive: true });
    writeFileSync(join(folder, 'index.csr.html'), page(''));
    writeFileSync(join(folder, 'controls', 'table', 'index.html'), page('<script>t()</script>'));
    assert.equal(addScriptHashes(folder), 1);
    assert.ok(
      readFileSync(join(folder, 'controls', 'table', 'index.html'), 'utf8').includes(
        scriptHash('t()'),
      ),
    );
    assert.equal(readFileSync(join(folder, 'index.csr.html'), 'utf8'), page(''));
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
