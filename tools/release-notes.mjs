// Release notes for the GitHub release (.github/workflows/release.yml, job `github-release`).
// Usage: node tools/release-notes.mjs <version> [changelog]
//   version    The version without the `v`, for example 0.3.0.
//   changelog  Path of the changelog. Default: CHANGELOG.md in the repository root.
// It prints the lines of the section `## [<version>]` of the changelog: the lines after that
// heading, up to the next `## [` heading. The heading itself is not printed. Leading and trailing
// blank lines are removed. It fails (exit code 1) when the section is missing or has no text.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Returns the notes of `version` in `changelog` (the text of the file). Throws if none. */
export function releaseNotes(changelog, version) {
  const lines = changelog.split(/\r?\n/);
  const heading = `## [${version}]`;
  // The heading is `## [0.3.0] - 2026-11-17`. `## [0.3.0-rc.1]` must not match `## [0.3.0]`.
  const start = lines.findIndex((line) => line === heading || line.startsWith(`${heading} `));
  if (start === -1) {
    throw new Error(`CHANGELOG.md has no section "${heading}".`);
  }
  let end = lines.findIndex((line, index) => index > start && line.startsWith('## ['));
  if (end === -1) {
    end = lines.length;
  }
  const notes = lines
    .slice(start + 1, end)
    .join('\n')
    .trim();
  if (notes === '') {
    throw new Error(`The section "${heading}" of CHANGELOG.md is empty.`);
  }
  return notes;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = process.argv[2];
  if (!version) {
    console.error('Usage: node tools/release-notes.mjs <version> [changelog]');
    process.exit(1);
  }
  try {
    const file = process.argv[3] ?? join(root, 'CHANGELOG.md');
    process.stdout.write(`${releaseNotes(readFileSync(file, 'utf8'), version)}\n`);
  } catch (error) {
    console.error(`release-notes: ${error.message}`);
    process.exit(1);
  }
}
