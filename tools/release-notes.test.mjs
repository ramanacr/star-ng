// Tests of tools/release-notes.mjs: `node --test tools/` (or `pnpm test:tools`).
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { releaseNotes } from './release-notes.mjs';

const CHANGELOG = `# Changelog

Intro text.

## [0.3.0] - 2026-11-17

### Added

- New token.

### Fixed

- A bug.

## [0.3.0-rc.1] - 2026-11-16

- Candidate.

## [0.2.0] - 2026-11-15

- Old.

## [0.1.0] - 2026-11-14

## [0.0.9] - 2026-11-13

- Last line, no final heading.
`;

test('returns the section without the heading', () => {
  assert.equal(
    releaseNotes(CHANGELOG, '0.3.0'),
    '### Added\n\n- New token.\n\n### Fixed\n\n- A bug.',
  );
});

test('stops at the next version heading, and does not confuse a prerelease', () => {
  assert.equal(releaseNotes(CHANGELOG, '0.3.0-rc.1'), '- Candidate.');
  assert.equal(releaseNotes(CHANGELOG, '0.2.0'), '- Old.');
});

test('works for the last section and for CRLF line ends', () => {
  assert.equal(releaseNotes(CHANGELOG, '0.0.9'), '- Last line, no final heading.');
  assert.equal(releaseNotes(CHANGELOG.replace(/\n/g, '\r\n'), '0.2.0'), '- Old.');
});

test('fails when the section is missing', () => {
  assert.throws(() => releaseNotes(CHANGELOG, '9.9.9'), /no section "## \[9\.9\.9\]"/);
  assert.throws(() => releaseNotes(CHANGELOG, '0.3'), /no section/);
});

test('fails when the section is empty', () => {
  assert.throws(() => releaseNotes(CHANGELOG, '0.1.0'), /is empty/);
});

test('command line: prints the notes, exits 1 on a problem', () => {
  const script = fileURLToPath(new URL('./release-notes.mjs', import.meta.url));
  const folder = mkdtempSync(join(tmpdir(), 'release-notes-'));
  try {
    const file = join(folder, 'CHANGELOG.md');
    writeFileSync(file, CHANGELOG);
    assert.equal(execFileSync('node', [script, '0.2.0', file], { encoding: 'utf8' }), '- Old.\n');
    const missing = spawnSync('node', [script, '9.9.9', file], { encoding: 'utf8' });
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /no section/);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 1);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
