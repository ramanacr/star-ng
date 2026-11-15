# StarNG

Accessible Angular controls built on signals, Signal Forms and the Angular CDK.
npm package: `star-ng`. Selector prefix: `star-`. CSS token prefix: `--star-`.

- Standalone components with signal inputs, models and outputs. OnPush everywhere.
- Form controls implement the Signal Forms control interfaces (`[formField]`), and work in
  Reactive Forms through `SignalFormControl`.
- One set of CSS tokens with light and dark themes. A product overrides the tokens to get
  its own look.
- One entry point per control group (`star-ng/button`, `star-ng/field`, ...), so an
  application bundles only what it uses.
- Built-in control text in one injection token (`STAR_UI_TEXT`), ready for translation,
  with German and Spanish packs (`star-ng/i18n/de`, `star-ng/i18n/es`).
- Right-to-left layouts (Arabic, Hebrew, Persian, Urdu): set `dir="rtl"` on `<html>`. The styles
  use logical properties, the arrow keys follow the visual direction and overlays follow the
  direction at run time.
- No Angular Material and no other UI kit.

> Status: the control set is complete: about 90 controls in 53 entry points, each with a docs
> page, an API table, unit tests and end-to-end tests. The package is not on npm yet.

Control groups: buttons; forms (field, input, checkbox, radio, switch, number, password, mask,
one-time code, tags, slider, rating, knob, color picker, select button); selection (select,
multi-select, cascade select, listbox, autocomplete, tree, tree select); date and time; table;
menus; overlays (dialog, confirm, drawer, popover, tooltip, toast); panels and navigation; data
display; charts; media (file upload, editor, carousel, galleria, image); utilities.

## Requirements

| Package                                              | Version                                     |
| ---------------------------------------------------- | ------------------------------------------- |
| `@angular/core`, `@angular/common`, `@angular/forms` | 22 or later                                 |
| `@angular/cdk`                                       | 22 or later                                 |
| `@angular/router`                                    | 22 or later (menus with route links)        |
| `@phosphor-icons/web`                                | 2.1 or later (icons that the controls draw) |
| `@jsverse/transloco`                                 | 8 or later, optional (`star-ng/transloco`)  |

## Install

```bash
pnpm add star-ng @angular/cdk @phosphor-icons/web
```

## Include the styles

Add the compiled CSS and the two Phosphor icon weights to the `styles` of your build target
in `angular.json`:

```json
"styles": [
  "@phosphor-icons/web/bold/style.css",
  "@phosphor-icons/web/fill/style.css",
  "star-ng/styles/star-ng.css",
  "src/styles.scss"
]
```

With Sass you can use the SCSS entry instead:

```scss
@use 'star-ng/styles/star-ng';
```

## Use a control

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarButton } from 'star-ng/button';

@Component({
  selector: 'app-orders',
  imports: [StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<star-button leadingIcon="ph-bold ph-plus" (pressed)="create()"
    >New order</star-button
  >`,
})
export class Orders {
  create(): void {}
}
```

## Language packs

The built-in text of the controls (screen-reader labels, empty states, page reports) is English.
Each included language is a separate entry point, so an application bundles only what it
imports. The packs are not exported from `star-ng`. The `locale` inputs of the controls set the
number and date formats: they do not depend on the pack.

```ts
import { provideStarUiText } from 'star-ng/core';
import { STAR_UI_TEXT_DE } from 'star-ng/i18n/de';

providers: [provideStarUiText(STAR_UI_TEXT_DE)];
```

To switch the language at run time without a library, use
`provideStarUiTextFromSignal(() => packs[language()])`. The docs have a guide for it, for your
own pack and for Transloco.

## Theme

Override tokens after the StarNG styles. Light values go on `:root`, dark values on
`[data-theme='dark']`:

```css
:root {
  --star-primary: #0f766e;
  --star-primary-hover: #115e59;
  --star-primary-soft: #ccfbf1;
}
[data-theme='dark'] {
  --star-primary: #2dd4bf;
}
```

`StarThemeService` (`star-ng/theme`) is an optional helper for a system / light / dark
choice. The docs have a guide for it and for the first-paint script.

## Documentation

The documentation site is at <https://ramanacr.github.io/star-ng/>. It has the guides (getting
started, theming and tokens, dark mode, forms, internationalisation, right-to-left,
accessibility) and one page per control with live examples, their source and an API table. See
"Documentation site" below for how it is published.

To run the docs application locally:

```bash
corepack pnpm install
corepack pnpm start        # docs application on http://localhost:4200
```

## Documentation site

The docs application is published to GitHub Pages at <https://ramanacr.github.io/star-ng/>, a
project site under the sub-path `/star-ng/`.

**Deployment.** The workflow `.github/workflows/pages.yml` runs on every push to `main`, and by
hand (Actions, "Pages", "Run workflow"). It builds the docs with `pnpm build:pages`, uploads
`dist/docs/browser` and deploys it. It does not run the tests: the CI workflow does that on the
pull request. The base path comes from `actions/configure-pages`, so a fork publishes under its
own repository name without a change.

**One-time repository setting.** Settings, Pages, Source: **GitHub Actions**. Without it the
deploy job fails.

**Deep links.** GitHub Pages cannot rewrite URLs. A direct request for a route such as
`/star-ng/controls/button` has no file, so GitHub answers with `404.html`. `pnpm build:pages`
makes `404.html` a copy of `index.html`, so the application starts and shows the page. The
HTTP status of such a response is **404**, not 200: the page works for people, but a crawler or a
link checker sees a 404. Links inside the site (the navigation) are normal router links and
have no such problem. The router uses path URLs, not hash URLs.

**Shared browser storage.** Every project site of an owner shares the origin
`ramanacr.github.io`, so `localStorage` is shared as well. The docs use the keys `star-theme`
and `star-direction`. Another site on that origin that uses one of these names sees the same value.

**Preview the sub-path build locally.**

| Command                       | What it does                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `corepack pnpm build:pages`   | `ng build docs --base-href /star-ng/`, then `404.html` (optional argument: base). |
| `corepack pnpm pages:preview` | Builds, then serves `dist/docs/browser` at <http://localhost:4300/star-ng/>.      |
| `corepack pnpm e2e:pages`     | Builds, then runs `e2e/pages` against that server (not part of `pnpm e2e`).       |

The server `tools/pages-serve.mjs` mimics GitHub Pages: files only under `/star-ng/`, and
`404.html` with the status 404 for any other path below it.

## Repository

| Path               | Content                                                                             |
| ------------------ | ----------------------------------------------------------------------------------- |
| `projects/star-ng` | The library. One folder per entry point, `styles/` for the SCSS.                    |
| `projects/docs`    | The docs application.                                                               |
| `e2e`              | Playwright tests, including the axe accessibility scan.                             |
| `tools`            | Build tools: compiled CSS, docs data generator, name check, Pages build and server. |

## Development

| Command                  | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `corepack pnpm start`    | Serves the docs application.                                         |
| `corepack pnpm lint`     | ESLint, docs data check and name check.                              |
| `corepack pnpm test:ci`  | Unit tests (Vitest, jsdom) with coverage.                            |
| `corepack pnpm build`    | Builds the package to `dist/star-ng` (with CSS) and the docs.        |
| `corepack pnpm e2e`      | Playwright tests (`corepack pnpm e2e:install` once for the browser). |
| `corepack pnpm e2e:a11y` | Only the axe accessibility scan of every docs page and its states.   |
| `corepack pnpm docs:gen` | Writes the API and example data of the docs after a change.          |

Conventions: Conventional Commits, one feature per pull request, merge after green CI.

## Visual regression tests

`e2e/visual` takes a screenshot of the `main` area of every docs page, in the light and in
the dark theme (tall pages are cut in slices of 4000 px). CI compares them with the images
in `e2e/visual/__screenshots__`. The test fixes the clock, seeds `Math.random` and waits for
fonts and images, so a page only differs when the library changed.

**Why baselines come from CI.** Fonts and text rendering differ per operating system, so an
image from Windows or macOS never matches. The tests skip on your machine, and the update
script refuses to run there. Only Linux in CI makes baselines.

**Update baselines** (new page, or a change that you want):

1. Run the workflow "Visual baselines" (Actions tab, input: your branch). The `visual` job
   of a normal CI run also uploads the baselines that are still missing.
2. In the repository root: `gh run download <run id> -n visual-baselines`. The files land in
   `e2e/visual/__screenshots__`.
3. Review the images, then commit them.

**Look at a failure.** The `visual` job uploads the artifact `visual-report`. Unzip it and
open `playwright-report-visual/index.html`: each failed page shows the expected image, the
actual image and the diff. A missing baseline fails the job too (the message says how to
commit it).

To debug in a Linux container with the CI fonts, set `VISUAL_ALLOW_LOCAL=1`
(`corepack pnpm e2e:visual`). Never commit images made that way.

## License

MIT. See [LICENSE](LICENSE).
