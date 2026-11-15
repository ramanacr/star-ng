## Summary

<!-- One or two sentences. What does this pull request change, and why? -->

## What changes for users of the package

<!-- Behavior, API and styles of `@star-ng/ui`. Write "none" if users see no change. -->

- Behavior:
- API (inputs, outputs, models, exports):
- Styles (`--star-*` tokens, classes):

## Test plan

Run the checks that your change touches. See `CONTRIBUTING.md`.

- [ ] `corepack pnpm format:check`
- [ ] `corepack pnpm lint`
- [ ] `corepack pnpm test:ci` (unit tests)
- [ ] `corepack pnpm build:lib` and `corepack pnpm check:package`
- [ ] `corepack pnpm build:docs` and `corepack pnpm e2e` (end-to-end tests)
- [ ] `corepack pnpm e2e:visual` (only when the visual output changes)

CI runs these jobs, based on the files that the pull request changes (`.github/workflows/ci.yml`):

- Markdown outside the root, `.github/` files other than `ci.yml`, editor and format config: `light`.
- Root `*.md`, `LICENSE`, unit tests (`*.spec.ts`), `eslint.config.js`, Pages tests (`e2e/pages/`): `build-test`.
- Build tools (`tools/` except `ci-*` and `pages-serve.mjs`), CI tool tests (`tools/ci-*.test.mjs`): `build-test`.
- `e2e/` (except `e2e/visual/` and `e2e/pages/`) and `playwright.config.ts`: `build-test`, `docs-build`, `e2e`, `e2e-dev`, `a11y`.
- `e2e/visual/` and `playwright.visual.config.ts`: `build-test`, `docs-build`, `visual`.
- Library or docs source (not `*.spec.ts`), styles, dependency and build config (`package.json`, lockfile, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`, `angular.json`, `tsconfig*.json`, `playwright.server.ts`, `tools/pages-serve.mjs`): all jobs.
- `.github/workflows/ci.yml`, `tools/ci-*.mjs`, any file that no rule matches: all jobs.
- Push to `main`, any event that is not a pull request, label `ci:full`, or an empty file list: all jobs.

## Notes for the reviewer

<!-- Design choices, open questions, or the parts that need the closest review. Write "none" if there are none. -->
