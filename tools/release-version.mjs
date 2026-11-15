// Release version check for the release workflow (.github/workflows/release.yml).
// Usage: node tools/release-version.mjs [tag]
//   tag  The git tag of the release run, for example v0.1.0. Leave it out in a dry run: the
//        version of projects/star-ng/package.json is used.
// It fails when the version is not valid semver, or when the tag is not `v` plus that version.
// It prints `version` and `dist_tag`, and appends them to $GITHUB_OUTPUT when that is set.
// Dist-tag policy: a version with a prerelease part (0.2.0-rc.1, 0.2.0-beta.2) is published
// with the dist-tag `next`, never `latest`. Every other version is published as `latest`.
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = join(root, 'projects/star-ng/package.json');
const tag = process.argv[2] ?? '';

// The official semver.org expression.
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

const fail = (message) => {
  console.error(`::error title=Release version::${message}`);
  process.exit(1);
};

const version = JSON.parse(readFileSync(manifest, 'utf8')).version;
const match = typeof version === 'string' ? SEMVER.exec(version) : null;
if (!match) fail(`The version "${version}" in projects/star-ng/package.json is not valid semver.`);
if (tag && tag !== `v${version}`) {
  fail(
    `The tag is "${tag}", but projects/star-ng/package.json has version "${version}" ` +
      `(expected the tag "v${version}"). Delete the tag, fix the version in a pull request, ` +
      `merge it, and tag the merge commit.`,
  );
}

const distTag = match[4] ? 'next' : 'latest';
console.log(`version=${version}`);
console.log(`dist_tag=${distTag}`);
if (process.env['GITHUB_OUTPUT']) {
  appendFileSync(process.env['GITHUB_OUTPUT'], `version=${version}\ndist_tag=${distTag}\n`);
}
