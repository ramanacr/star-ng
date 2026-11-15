# Releasing @star-ng/ui

The package `@star-ng/ui` goes to npm when you push a git tag `v<version>` (for example `v0.1.0`).
The workflow `.github/workflows/release.yml` verifies the package, packs it and publishes it.
There is no npm token in the repository: npm Trusted Publishing (OpenID Connect, OIDC) proves to
npm that the run belongs to this repository, and npm adds a provenance attestation.

## One-time setup

Do these steps once, in this order. The order matters: the package name `@star-ng/ui` is
scoped, so the npm organisation `star-ng` must exist before the first publish. The owner created it already. npm can attach a
trusted publisher only to a package that already exists.

0. Note: the npm organisation `star-ng` exists (created by the owner). If it is ever lost, create it
   again on npmjs.com ("Add Organization", name `star-ng`). The free plan allows public packages.
   The account that publishes the placeholder must be an owner or a member with publish rights.

1. Publish a placeholder version by hand. Use an empty folder outside the repository.
   You need an npm account (`ramanacr`) with two-factor authentication.

   ```bash
   mkdir star-ng-ui-placeholder && cd star-ng-ui-placeholder
   cat > package.json <<'JSON'
   {
     "name": "@star-ng/ui",
     "version": "0.0.0-placeholder.0",
     "description": "Placeholder. The first release of StarNG follows.",
     "license": "MIT",
     "repository": { "type": "git", "url": "git+https://github.com/ramanacr/star-ng.git" }
   }
   JSON
   npm login
   npm publish --access public --tag placeholder
   ```

   The flag `--access public` is required: a scoped package is private (restricted) by default.
   The tag `placeholder` keeps `latest` free for the first real release.

2. Attach the trusted publisher. On npmjs.com open the package `@star-ng/ui`, then Settings, then
   Trusted Publisher, then GitHub Actions. Enter:
   - Organization or user: `ramanacr`
   - Repository: `star-ng`
   - Workflow filename: `release.yml`
   - Environment name: `npm`

   In the same Settings page, under Publishing access, choose "Require two-factor
   authentication and disallow tokens". Then no token can publish the package.

3. Create the GitHub environment `npm`: repository Settings, Environments, New environment,
   name `npm`. Optional: add yourself as required reviewer, so each publish waits for your
   approval. If you limit the deployment tags, allow the pattern `v*`.

4. Set the repository variable `NPM_PUBLISH` to `true`: Settings, Secrets and variables,
   Actions, Variables, New repository variable. Or:

   ```bash
   gh variable set NPM_PUBLISH --body true --repo ramanacr/star-ng
   ```

   While this variable is not `true`, a pushed tag runs the checks and the packing, and the
   publish job is skipped.

## Release steps

1. Make a branch. Change `version` in `projects/star-ng/package.json`. This is the only place
   that holds the version. In the same pull request:
   - In `CHANGELOG.md`, replace "Unreleased" in the heading of this version with the release
     date (`YYYY-MM-DD`). For a new version, add a new section above the older ones.
   - First release only (`0.1.0`): in `README.md`, add the npm version badge where the HTML
     comment says so, and delete the "Status" block and that comment. Before the first release,
     the badge would show "package not found".
   - Open the pull request.
2. Merge the pull request when CI is green.
3. Tag the merge commit on `main` and push the tag:

   ```bash
   git switch main && git pull
   git tag v0.1.0
   git push origin v0.1.0
   ```

   The tag must be `v` plus the exact version of `projects/star-ng/package.json`. The workflow
   fails when they differ, or when the tagged commit is not on `main`.

4. Watch the workflow: Actions, "Release" (or `gh run watch`). The job `verify and pack` runs
   lint, unit tests, the library build, the package check, `npm pack` and the consumer smoke
   test (a real Angular application installs the tarball and builds). The job
   `publish to npm` runs next and only publishes the tarball. The job
   `verify published package` runs last. It waits until the registry shows the new version
   (up to 15 minutes), installs it in an empty project and runs `npm audit signatures`.
5. Check the result:
   - Open <https://www.npmjs.com/package/@star-ng/ui>. The page shows the version and the
     "Provenance" badge.
   - `npm view @star-ng/ui dist-tags` shows the expected tag.

## Dist-tags and versions

The workflow takes the dist-tag from the version. You do not choose it.

| Version                      | Dist-tag | Who gets it                         |
| ---------------------------- | -------- | ----------------------------------- |
| `0.1.0`, `0.2.0`, `1.0.0`    | `latest` | `npm install @star-ng/ui`           |
| `0.2.0-rc.1`, `0.2.0-beta.2` | `next`   | `npm install @star-ng/ui@next` only |

- A version with a prerelease part is never `latest`.
- `0.x` tells users that the API can still change. Move to `1.0.0` when the API is stable.
- After a prerelease, release the final version (for example `0.2.0`) with a new tag.

## Dry run

A dry run packs and verifies. It never publishes.

1. Actions, "Release", "Run workflow", choose your branch. Or:
   `gh workflow run release.yml --ref <branch>`.
2. Download the artifact `star-ng-tarball` to inspect the tarball.

To check on your machine, run in this order:

```bash
corepack pnpm build:lib
corepack pnpm check:package
corepack pnpm smoke:consumer
```

`check:package` also runs in CI on every pull request.

## When `verify published package` is red

The job `publish to npm` shows only if the publish worked. If it is green, the version is on
npm. A red `verify published package` does not change that.

1. Open the log. If the message is "Version not in the registry", the registry did not show the
   version in 15 minutes. This is rare. Run `npm view @star-ng/ui@<version> version` by hand.
2. If the command prints the version, the registry was only slow. Re-run only the failed job:
   Actions, open the run, "Re-run failed jobs" (or the "Re-run" button of that job), or
   `gh run rerun <run-id> --job <job-id>`. The job needs no approval and does not publish.
3. If the log shows "no verified provenance attestation" or a signature error, check the
   Trusted Publisher settings on npmjs.com (repository, workflow file name, environment).
4. If the version never appears, see "When a publish fails" below.

A publish can never be repeated for the same version. Do not re-run the job `publish to npm`
after it succeeded. It would fail, because npm rejects an existing version.

## When a publish fails

A version number can never be used again on npm, even after an unpublish. Think before you
publish.

1. Find the failed step in the Actions log.
2. The checks failed, nothing is published (jobs before `publish`, or an error at the start of
   `npm publish`): fix the cause in a pull request. Then delete the tag and tag again:

   ```bash
   git push --delete origin v0.1.0
   git tag -d v0.1.0
   ```

   Make the new tag on the new `main` commit. If the version in `package.json` did not
   change, the same version number is still free.

3. The publish step failed with a network or registry error: check
   `npm view @star-ng/ui versions`. If the version is not listed, use "Re-run failed jobs" in
   Actions. If it is listed, the publish worked. Do not publish it again.
4. The publish worked, but the package is wrong: publish a new version (for example `0.1.1`).
   Mark the bad version with `npm deprecate @star-ng/ui@0.1.0 "Broken, use 0.1.1"`.
5. The job `verify published package` failed after a good publish: see the next section. The
   package itself is already published. Never re-run the job `publish to npm`.
6. Error "OIDC" or "not authorized" in `npm publish`: the trusted publisher on npmjs.com does
   not match this run. The four values must be exactly `ramanacr`, `star-ng`, `release.yml`
   and `npm`. The npm version in the job must be 11.5.1 or later.
