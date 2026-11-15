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
- Root `*.md` and `LICENSE`, unit tests, build tools: `build-test`.
- `e2e/` and `playwright.config.ts`: `build-test`, `docs-build`, `e2e`, `a11y`.
- `e2e/visual/` and `playwright.visual.config.ts`: `build-test`, `docs-build`, `visual`.
- Library or docs source, styles, `package.json`, lockfile, Angular or TypeScript config: all jobs.
- Label `ci:full`: all jobs.

## Notes for the reviewer

<!-- Design choices, open questions, or the parts that need the closest review. Write "none" if there are none. -->
