# Contributing to StarNG

All contributions are welcome: code, tests, translations, browser and assistive-technology checks, documentation and bug reports. Each contribution helps. Your GitHub name goes in the release notes of the version that contains your work.

This project follows the [code of conduct](CODE_OF_CONDUCT.md).

This file explains how to work on the StarNG repository: set up, run the checks, add a control, and open a pull request. People who only install the package need the [README](README.md).

## Prerequisites

1. Install Node 22.12.0 or later. The file `.nvmrc` names the version that CI uses (22). The root `package.json` sets `engines.node` to `>=22.12.0`. The published package does not set `engines`, because the requirement belongs to the build tools.
2. Use `corepack pnpm` for every command. The root `package.json` sets the package manager (`packageManager`). Plain `pnpm` is not always on the `PATH`.
3. Install the dependencies: `corepack pnpm install --frozen-lockfile`.
4. For end-to-end tests, install the browser once: `corepack pnpm e2e:install`.

## Repository layout

| Path                             | Content                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `projects/star-ng`               | The library. One folder per entry point.                                                                                             |
| `projects/star-ng/styles`        | The SCSS: tokens, base rules, and one partial per control group in `controls/`.                                                      |
| `projects/star-ng/specs`         | Unit tests that cover more than one entry point.                                                                                     |
| `projects/star-ng/src`           | `public-api.ts`, the root entry point of `@star-ng/ui`.                                                                              |
| `projects/docs`                  | The docs application.                                                                                                                |
| `projects/docs/src/app/guides`   | The guides.                                                                                                                          |
| `projects/docs/src/app/controls` | One docs page per control group.                                                                                                     |
| `e2e`                            | Playwright tests. `e2e/visual` has the visual tests. `e2e/pages` has the Pages tests.                                                |
| `tools`                          | Build tools: compiled CSS, docs data generator, name check, package check, release. CI tools: change detection, gate, static server. |
| `.github/workflows`              | CI, Pages, release and visual baselines.                                                                                             |

## Development commands

| Command                           | What it does                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `corepack pnpm start`             | Serves the docs application on <http://localhost:4200>.                                  |
| `corepack pnpm format`            | Formats all files with Prettier.                                                         |
| `corepack pnpm format:check`      | Checks the format. CI runs it.                                                           |
| `corepack pnpm lint`              | ESLint, docs data check and name check.                                                  |
| `corepack pnpm lint:fix`          | ESLint with automatic fixes.                                                             |
| `corepack pnpm test`              | Unit tests in watch mode.                                                                |
| `corepack pnpm test:ci`           | Unit tests (Vitest, jsdom) with coverage.                                                |
| `corepack pnpm build`             | Builds the package to `dist/star-ng` (with CSS) and the docs.                            |
| `corepack pnpm build:lib`         | Builds only the package and the CSS.                                                     |
| `corepack pnpm build:docs`        | Builds only the docs application, prerenders every page and checks the result.           |
| `corepack pnpm check:prerender`   | Checks that the last docs build has an HTML file for every page.                         |
| `corepack pnpm docs:gen`          | Writes the API and example data of the docs.                                             |
| `corepack pnpm docs:check`        | Fails when the generated docs data is out of date.                                       |
| `corepack pnpm docs:styles`       | Writes the route stylesheet of each docs page and the shell list of `styles.scss`.       |
| `corepack pnpm test:tools`        | Tests of the CI tools (change detection and gate). No browser.                           |
| `corepack pnpm e2e`               | Playwright tests, without the visual tests and the Pages tests.                          |
| `corepack pnpm e2e:a11y`          | Only the axe accessibility scan.                                                         |
| `corepack pnpm e2e:ui`            | Playwright in its interactive UI mode.                                                   |
| `corepack pnpm e2e:visual`        | Visual tests. They skip outside CI (see "Visual tests").                                 |
| `corepack pnpm e2e:visual:update` | Writes baseline images. It refuses to run outside Linux in CI.                           |
| `corepack pnpm e2e:pages`         | Builds the Pages version of the docs, then runs `e2e/pages` against it.                  |
| `corepack pnpm pages:preview`     | Builds the Pages version, then serves it on <http://localhost:4300/star-ng/>.            |
| `corepack pnpm check:package`     | Checks `dist/star-ng`: files, exports, size, names, README links. Run `build:lib` first. |
| `corepack pnpm smoke:consumer`    | Installs the packed package in a temporary Angular app and builds it (about 2 minutes).  |

## Rules for the library

- **Tokens only.** Colors, radius, spacing and fonts come from `--star-*` tokens. Do not write a color value in a control style.
- **Neutral design.** A text control has no `text-transform: uppercase`, no pill radius and no font weight above 600.
- **No brand names.** `tools/check-names.mjs` fails when a tracked file contains a name that must not be in the repository. It runs in `corepack pnpm lint`.
- **Entry points import each other by package name**, for example `@star-ng/ui/core`, never with a relative path across folders.
- **Keep comments that name the PrimeNG equivalent of a control.** They help readers who know PrimeNG.
- **Large templates.** Keep the template inline. When a component template grows past about 500 lines (for example `table/table.html`), put it in a `.html` file next to the component and use `templateUrl`; Prettier formats it with the `angular` parser.
- **Input names.** A new control spells the label reference input `ariaLabelledBy` (as PrimeNG and the select family do). The dialog and the popover keep their released `ariaLabelledby`.
- **Accessibility.** Use native elements first. Every action must work with the keyboard. Every control needs a visible focus.

## Public API scope

An entry point exports only what consumers use:

1. Components, directives, pipes, services, injection tokens and provider functions (`provideStar*`).
2. The types and interfaces of the public inputs, models and outputs.
3. A pure helper only when a docs page or the CHANGELOG offers it to consumers as part of the control contract, for example `starApplyPatches` (diagram), `starKanbanApplyMove`, `starQueryToPredicate`, the RRULE functions, `starEvaluate` and `StarFormulaEngine`, `starProject`, `starEncodeBarcode`, `starEncodeQr`, `starFilterMatch` and the format helpers of `@star-ng/ui/core`.

Every other helper is internal. Do not export it from `index.ts`, or, when another entry point needs it, export it with the `ɵ` prefix (for example `ɵstarLazyOptions`, `ɵstarDayKey`). Specs in the same folder import internal helpers with a relative path. Write explicit export lists for model files, not `export *`. A symbol that was in a released version stays: mark it `@deprecated` and name the replacement.

Exception: the entry points that the docs shell loads at start (the `@star-ng/ui/*` imports of `projects/docs/src/app/app.ts` and the shell files, and the entry points they import, for example `core`, `utility`, `dialog`, `toast`, `theme-switch` and `theme`) re-export values in `index.ts` with `export *` only (`export type { ... }` is fine). A named value re-export there makes the docs build keep every file of the entry point in the initial bundle, which went over its budget before; with `export *`, every exported name of a re-exported file is public API. So in these entry points, an internal helper takes the `ɵ` prefix or goes into a file that `index.ts` does not re-export (for example `utility/key-filter-rules.ts`). `tools/barrels.test.mjs` derives the list from the shell imports, checks the syntax, and compares the public names with `tools/shell-public-api.json`; a new public name needs a deliberate update of that file (`UPDATE_SHELL_API=1 node --test tools/barrels.test.mjs`). Other entry points keep explicit export lists.

## Example data rules

Examples in the docs, tests and comments use neutral, fictional data: orders, invoices, projects, cities. E-mail addresses and host names use `example.com`. Do not use real people, real companies or domain-specific words (for example medical words).

## Add a control

1. Create the folder `projects/star-ng/<name>/` with the component file `<name>.ts`.
2. Add `index.ts` in the folder. It exports the public symbols with named exports (see "Public API scope"). `export * from './<name>';` is only for a file that has nothing internal. An entry point that the docs shell loads at start uses `export *` only (see the exception in "Public API scope").
3. Add `ng-package.json` in the folder. Copy it from another entry point, for example `projects/star-ng/button/ng-package.json`.
4. Add the entry point to `projects/star-ng/src/public-api.ts`, in alphabetical order.
5. Add the style partial `projects/star-ng/styles/controls/_<name>.scss`. Add `@use 'controls/<name>';` to `projects/star-ng/styles/star-ng.scss`.
6. Add the docs page `projects/docs/src/app/controls/<name>.page.ts`. Each example is a `<docs-example source="<name>/<id>">` element, so the code that the page shows is the code that runs.
7. Add the page to `DOCS_NAV` in `projects/docs/src/app/nav.ts`. The side navigation, its search and the routes come from this list.
8. Run `corepack pnpm docs:gen`. Commit the changed file `projects/docs/src/app/generated/docs-data.ts`. `corepack pnpm lint` fails when it is out of date.
9. Run `corepack pnpm docs:styles`. It writes `<name>.page.scss` next to the page: the library partials of the controls on the page (see "Docs styles per route"). Load it in the route component with `styleUrl` and `encapsulation: ViewEncapsulation.None`. `corepack pnpm lint` fails when it is out of date.
10. Add tests (see "Test layers"). A new docs page gets visual baselines from CI.
11. Run `corepack pnpm format`, `corepack pnpm lint`, `corepack pnpm test:ci`, `corepack pnpm build:lib` and `corepack pnpm check:package`.

## Docs styles per route

The docs load the library CSS per route, as they load the page JavaScript. The package does not change: consumers still import `star-ng.css` or single partials.

- `projects/docs/src/styles.scss` is the critical CSS: tokens, base rules, unstyled mode, the partials of the controls that the shell renders on every page (header, toast, confirm dialog), and the docs layout (`_docs-layout.scss`).
- Each page has a generated `<page>.scss`: the partials of its controls. The route component loads it with `styleUrl` and `encapsulation: ViewEncapsulation.None`. Angular puts it in the lazy chunk of the route, and the prerender writes it into the HTML of the page.
- `tools/docs-page-styles.mjs` (`corepack pnpm docs:styles`) finds the controls of a page in the page file, in the docs files that it imports (example components, dialogs) and in the library files of the imported controls. It keeps the cascade of `star-ng.css`: the partials keep the order of `star-ng.css`, a page stylesheet repeats the shell partials that come after its first partial, and it ends with the docs layout.
- A page with its own component styles keeps them in a child component (`<Name>Content`), so they come after the route styles.
- The build counts a route stylesheet as a component style. So the `anyComponentStyle` budget in `angular.json` is 120 kB (warning) and 150 kB (error): the largest route stylesheet (the file manager page) is about 115 kB. The initial budgets do not change.
- `tools/docs-page-styles.test.mjs` (`corepack pnpm test:tools`) checks that each page has its partials and that the order is kept.

## The docs data generator

`tools/gen-docs-data.mjs` reads the library source with the TypeScript compiler API. It writes, for every component and directive, the selector and the inputs, models and outputs (name, type, default, description). A class that extends a base class (for example `StarSelect` and `StarOptionListBase`) also gets the members of the base class, marked "inherited from" in the API table; the shared helper is `tools/api-inheritance.mjs`, which `tools/agent-data.mjs` uses too. It also copies the markup of each `<docs-example>` element. The output is `projects/docs/src/app/generated/docs-data.ts`. The file is committed. Write the descriptions as JSDoc comments on the inputs.

## Test layers

| Layer                   | Where                                         | What it checks                                                                                          |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Unit                    | `*.spec.ts` next to the code, `specs/`        | Roles, states, keyboard handling and logic of each control (Vitest, jsdom).                             |
| End-to-end              | `e2e/*.spec.ts`                               | The docs pages in Chromium, with keyboard and pointer.                                                  |
| Accessibility           | `e2e/a11y.spec.ts`                            | An axe scan of every docs page in both themes and of opened states. A new page or state needs an entry. |
| Right-to-left           | `e2e/rtl.spec.ts`, `e2e/rtl-controls.spec.ts` | A sweep that opens every page with `dir="rtl"`, and control-specific checks.                            |
| Visual                  | `e2e/visual`                                  | A screenshot of every docs page in both themes.                                                         |
| Print                   | `e2e/table-print.spec.ts`                     | The table print export, with the print engine of Chromium.                                              |
| Content Security Policy | `e2e/csp.spec.ts`                             | The first-paint script under strict policies.                                                           |
| Pages                   | `e2e/pages`                                   | The sub-path build, as GitHub Pages serves it.                                                          |

### Visual tests

`e2e/visual` takes a screenshot of the `main` area of every docs page, in the light and the dark theme. CI compares them with the images in `e2e/visual/__screenshots__`. Fonts and text rendering differ per operating system, so only Linux in CI makes baselines. The tests skip on your machine, and `e2e:visual:update` refuses to run there.

To update baselines (new page, or a change that you want):

1. Run the workflow "Visual baselines" (Actions tab, input: your branch). The `visual` job of a normal CI run also uploads the baselines that are still missing. Both use the production build of the docs, served as static files.
2. In the repository root, run `gh run download <run id> -n visual-baselines`. The files go to `e2e/visual/__screenshots__`.
3. Review the images, then commit them.

When a visual test fails, the `visual` job uploads the artifact `visual-report`. Unzip it and open `playwright-report-visual/index.html`. Each failed page shows the expected image, the actual image and the diff.

To debug in a Linux container with the CI fonts, set `VISUAL_ALLOW_LOCAL=1` (then `corepack pnpm e2e:visual`). Never commit images made that way.

## Documentation site

The workflow `.github/workflows/pages.yml` runs on every push to `main`, and by hand (Actions, "Pages", "Run workflow"). It builds the docs with `corepack pnpm build:pages`, uploads `dist/docs/browser` and deploys it to <https://ramanacr.github.io/star-ng/>. It does not run the tests: the CI workflow does that on the pull request. The base path comes from `actions/configure-pages`, so a fork publishes under its own repository name.

One-time repository setting: Settings, Pages, Source: **GitHub Actions**. Without it, the deploy job fails.

- **Every page is prerendered, so a deep link answers with status 200.** The production build of the docs writes one HTML file per route, for example `controls/button/index.html`, with the title, the heading and the text of the page in the HTML source. GitHub Pages serves it for `/star-ng/controls/button` through a redirect to `/star-ng/controls/button/`. The router accepts the address with the final slash and shows it without. The build needs no server: `outputMode: "static"` and one server route `**` with `RenderMode.Prerender` (`projects/docs/src/app/app.routes.server.ts`). The builder reads the list of routes from the router config, so a new page in `nav.ts` is prerendered without a change. After the build, `tools/check-prerender.mjs` (run by `build:docs` and `build:pages`) fails when a page of `nav.ts` has no HTML file with a title and a heading.
- **The browser reuses the prerendered page.** The app uses `provideClientHydration` (without incremental hydration: that adds an inline script, which the Content Security Policy does not allow). Code that runs while a page is rendered must not use `window`, `document`, `localStorage` or `matchMedia` directly. Inject `DOCUMENT` or check `isPlatformBrowser`, and put code that measures the page in `afterNextRender`. A browser global that runs during the render makes the build fail for that route.
- **An address that is no page answers with status 404.** `build:pages` copies the client-rendered shell `index.csr.html` to `404.html`. The shell has no page content: the application starts, and the router sends an unknown address to the home page.
- **`localStorage` is shared on the `github.io` origin.** Every project site of an owner uses the origin `ramanacr.github.io`. The docs use the keys `star-theme` and `star-direction`. Another site on that origin that uses one of these names sees the same value.
- **Local preview.** Run `corepack pnpm pages:preview` and open <http://localhost:4300/star-ng/>. The server `tools/pages-serve.mjs` mimics GitHub Pages: files only under `/star-ng/`, a redirect from a folder address to the one with the final slash, and `404.html` with status 404 for any other path below it. `corepack pnpm e2e:pages` runs `e2e/pages` against it.

## Continuous integration

The workflow `.github/workflows/ci.yml` runs only the jobs that a change can affect. The job `ci-gate` is the one required check. It always runs.

1. The job `changes` lists the files of the pull request (`base...head`). The script `tools/ci-changes.mjs` reads that list and decides which jobs are needed. The rules are in the `RULES` table of the script. The summary of the run shows what runs and why.
2. The job `docs-build` builds the docs application once, in the production configuration. The jobs `e2e`, `a11y` and `visual` download that build and serve it as static files (`tools/pages-serve.mjs --spa`). No job starts `ng serve`.
3. The job `ci-gate` (`tools/ci-gate.mjs`) passes when every needed job succeeded. A skipped job is a pass only when `changes` said that the job was not needed. A needed job that was skipped, cancelled or failed fails the gate. A failed `changes` job fails the gate too.

| What changed                                                                                                                                                                                                   | Jobs that run                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Push to `main`, any event that is not a pull request, label `ci:full`, `ci.yml`, an empty or unknown change list                                                                                               | Everything                                           |
| Only Markdown outside the repository root, `.gitignore`, `.editorconfig`, `.prettierignore`, `.prettierrc`, `.gitattributes`, `.github/` files that are not `ci.yml`, `.vscode/`                               | `light` (format check, name check)                   |
| Root `*.md`, `LICENSE` (the package contains `README.md` and `LICENSE`, and `check:package` checks the README links)                                                                                           | `build-test`                                         |
| Unit tests (`*.spec.ts` in `projects/`), CI tool tests (`tools/ci-*.test.mjs`), other build tools in `tools/` (not `ci-*` and not `pages-serve.mjs`), `eslint.config.js`, Pages tests                          | `build-test`                                         |
| End-to-end tests and their config (`e2e/` except `e2e/visual/` and `e2e/pages/`, `playwright.config.ts`)                                                                                                       | `build-test`, `docs-build`, `e2e`, `e2e-dev`, `a11y` |
| Visual tests and baselines (`e2e/visual/`, `playwright.visual.config.ts`)                                                                                                                                      | `build-test`, `docs-build`, `visual`                 |
| Library or docs source, styles, `package.json`, the lockfile, `pnpm-workspace.yaml`, `.npmrc`, `.nvmrc`, `angular.json`, `tsconfig*.json`, `playwright.server.ts`, the static server (`tools/pages-serve.mjs`) | Everything                                           |

A path that no rule knows needs everything, so a new kind of file never skips a job by accident. A renamed file counts with its old and its new path.

**Force a full run.** Add the label `ci:full` to the pull request. CI starts again with every job needed. Use it when you doubt the change detection. Removing the label starts CI again as well. Adding or removing any other label starts no work: CI skips every job. A pull request that is opened with the label runs CI twice, one run after the other, and no run is cancelled.

**Change the rules.** Edit `RULES` in `tools/ci-changes.mjs` and add a row to the table in `tools/ci-changes.test.mjs`. Run `corepack pnpm test:tools`. A change to the CI tools or to `ci.yml` runs everything.

**Run the browser tests like CI.** Build the docs, then point Playwright at the folder:

```sh
corepack pnpm build:docs
E2E_STATIC_DIR=dist/docs/browser corepack pnpm e2e
```

Without `E2E_STATIC_DIR`, Playwright starts `ng serve docs` (development build, fast rebuilds, no prerender: `e2e/docs-prerender.spec.ts` skips itself there). `E2E_BASE_URL` runs the tests against a deployed site. The tests must pass against both servers. A test that needs a development build (for example `window.ng`) has the tag `@dev` in its title and calls `needsDevBuild()` from `e2e/support.ts`. The static run skips it. The CI job `e2e-dev` runs the `@dev` tests against `ng serve`. Do not use the tag for a test that only needs a fix.

## Commits and pull requests

1. Make a branch from `main`.
2. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages, for example `feat: add the tabs control` or `fix(table): keep the focus after a sort`.
3. Keep one feature or fix in one pull request.
4. Run the checks of the section "Development commands" that your change touches. CI runs the jobs that your change can affect (see "Continuous integration"): format, lint, unit tests, the library build, the package check, the docs build, the end-to-end tests, the accessibility scan and the visual tests.
5. Open the pull request. It merges after green CI.

Commits in this repository are not signed.

## Releases

The maintainer publishes releases. See [RELEASING.md](RELEASING.md). Report a security problem as [SECURITY.md](SECURITY.md) describes, not in a public issue.
