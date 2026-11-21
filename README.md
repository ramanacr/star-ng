<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="projects/docs/public/brand/starng-logo-dark.svg" />
    <img src="projects/docs/public/brand/starng-logo.svg" alt="StarNG" height="64" />
  </picture>
</p>

# StarNG

[![npm version](https://img.shields.io/npm/v/@star-ng/ui)](https://www.npmjs.com/package/@star-ng/ui)
[![CI](https://github.com/ramanacr/star-ng/actions/workflows/ci.yml/badge.svg)](https://github.com/ramanacr/star-ng/actions/workflows/ci.yml)
[![Docs](https://img.shields.io/badge/docs-ramanacr.github.io%2Fstar--ng-blue)](https://ramanacr.github.io/star-ng/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Socket Badge](https://badge.socket.dev/npm/package/@star-ng/ui)](https://socket.dev/npm/package/@star-ng/ui)

StarNG is a library of accessible Angular controls. It uses signals, Signal Forms and the Angular CDK. The npm package is `@star-ng/ui`. The selector prefix is `star-` and the CSS token prefix is `--star-`. Each control group is one entry point, for example `@star-ng/ui/button`, so an application bundles only what it imports. The library does not use Angular Material or another UI kit.

> Status: `@star-ng/ui` has `0.x` versions. The API can change between minor versions (see "Versioning and stability").

## What is in the package

About 90 controls in more than 50 entry points. Each control has a docs page with live examples and an API table.

Control groups: buttons; forms (field, input, checkbox, radio, switch, number, password, mask, one-time code, tags, slider, rating, knob, color picker, select button); selection (select, multi-select, cascade select, listbox, autocomplete, tree, tree select); date and time; table; menus; overlays (dialog, confirm, drawer, popover, tooltip, toast); panels and navigation; data display and charts; media (file upload, editor, carousel, galleria, image); utilities.

## Requirements

| Package                                              | Version                                        |
| ---------------------------------------------------- | ---------------------------------------------- |
| `@angular/core`, `@angular/common`, `@angular/forms` | 22 or later                                    |
| `@angular/cdk`                                       | 22 or later                                    |
| `@angular/router`                                    | 22 or later                                    |
| `@phosphor-icons/web`                                | 2.1 or later, optional (default icons)         |
| `rxjs`                                               | 7.8 or later                                   |
| `@jsverse/transloco`                                 | 8 or later, optional (`@star-ng/ui/transloco`) |

### Change detection

The controls use signals and `OnPush`, and need no `zone.js`. They work in a zoneless application (the Angular default) and in an application that still uses `provideZoneChangeDetection`. The tests of the library run zoneless.

## Install

Use one of these commands.

```bash
pnpm add @star-ng/ui @angular/cdk @phosphor-icons/web
npm install @star-ng/ui @angular/cdk @phosphor-icons/web
yarn add @star-ng/ui @angular/cdk @phosphor-icons/web
```

## Include the styles

Add the compiled CSS and two Phosphor icon weights to the `styles` of your build target in `angular.json`:

```json
"styles": [
  "@phosphor-icons/web/bold/style.css",
  "@phosphor-icons/web/fill/style.css",
  "@star-ng/ui/styles/star-ng.css",
  "src/styles.scss"
]
```

With Sass, you can use the SCSS entry instead: `@use '@star-ng/ui/styles/star-ng';`.

## Use a control

Import a control from its entry point, not from the package root.

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';

@Component({
  selector: 'app-orders',
  imports: [StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<star-button (pressed)="create()">New order</star-button>`,
})
export class Orders {
  create(): void {}
}
```

The query model has its own entry point, `@star-ng/ui/query-builder/model`. It holds `starQueryToPredicate`, `starQueryToText`, `starQueryComplete` and the query types, and it does not load the query builder component. Import from it when you only need to turn a query into a row test. `@star-ng/ui/query-builder` exports the same names, so existing imports keep working.

## Forms

1. Form controls implement the Signal Forms control interfaces. Bind them with `[formField]`.
2. Without a form, use two-way binding, for example `[(checked)]` or `[(value)]`.
3. In Reactive Forms, use `SignalFormControl` from `@angular/forms/signals/compat`.

See the [forms guide](https://ramanacr.github.io/star-ng/guides/forms).

## Theme and dark mode

Override the `--star-*` tokens after the StarNG styles. Put light values on `:root` and dark values on `[data-theme='dark']`.

```css
:root {
  --star-primary: #0f766e;
}
[data-theme='dark'] {
  --star-primary: #2dd4bf;
}
```

`StarThemeService` (`@star-ng/ui/theme`) is an optional helper for a system, light or dark choice. A first-paint script avoids a flash of the wrong theme. See the guides [theming and tokens](https://ramanacr.github.io/star-ng/guides/theming) and [dark mode](https://ramanacr.github.io/star-ng/guides/dark-mode).

## Language packs

The built-in text of the controls is English. The German and Spanish packs are separate entry points. The `locale` inputs of the controls set number and date formats. They do not depend on the pack.

```ts
import { provideStarUiText } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';

providers: [provideStarUiText(STAR_UI_TEXT_DE)];
```

A language model wrote the German and Spanish packs. Native speakers did not review them. See the [internationalisation guide](https://ramanacr.github.io/star-ng/guides/i18n) for run-time switching, your own pack and Transloco.

## Right-to-left

Set `dir="rtl"` on `<html>`. The styles use logical properties, the arrow keys follow the visual direction, and overlays follow the direction at run time. See the [right-to-left guide](https://ramanacr.github.io/star-ng/guides/right-to-left).

## Browser support

The tests run in Chromium only (Playwright). Firefox and Safari are not tested. The library uses these modern CSS and platform features. Check them against your browser targets.

- `:has()` and `:dir()`
- container queries
- `@starting-style`
- `field-sizing`
- `color-mix()`
- logical properties
- the native `<dialog>` element and popover behavior (through the Angular CDK)

## Accessibility

The target is WCAG 2.2 level AA. CI runs an automated axe scan on every docs page in the light and dark themes, and on 65 opened states. Unit tests and keyboard tests cover roles, states and key handling.

Not tested: screen-reader output, zoom and reflow, forced-colors mode. An automated scan finds only some problems. Your application must also name every control and set the page language. See the [accessibility guide](https://ramanacr.github.io/star-ng/guides/accessibility).

## Use with AI coding agents

StarNG gives coding agents (Claude Code, Cursor, Copilot, Codex and others) its setup, API and example markup in two ways:

1. Plain text on the docs site: [llms.txt](https://ramanacr.github.io/star-ng/llms.txt) is a short index, and [llms-full.txt](https://ramanacr.github.io/star-ng/llms-full.txt) has the API of every control and all example markup.
2. The MCP server [`@star-ng/mcp`](https://github.com/ramanacr/star-ng/tree/main/projects/mcp). It runs on your computer and has tools to search controls, read their API and examples, and check the StarNG markup that the agent writes. For Claude Code:

   ```bash
   claude mcp add star-ng -- npx -y @star-ng/mcp
   ```

## Versioning and stability

The package follows semantic versioning. In `0.x` versions, the API can change between minor versions. Read the [changelog](CHANGELOG.md) before you update. The dist-tag `latest` is for releases. The dist-tag `next` is for prereleases.

## Known limits

- Chromium is the only tested browser.
- The German and Spanish text packs have no native-speaker review.
- There are no screen-reader, zoom, reflow or forced-colors tests.
- The editor and the file upload do not protect your server. See [SECURITY.md](SECURITY.md).

## Community

Contributions are welcome and appreciated.

- Start with issues that have the label [help wanted](https://github.com/ramanacr/star-ng/labels/help%20wanted) or `good first issue`.
- Four requests are open now:
  - [Review of the German text pack by a native speaker](https://github.com/ramanacr/star-ng/issues/33)
  - [Review of the Spanish text pack by a native speaker](https://github.com/ramanacr/star-ng/issues/34)
  - [A check in Firefox and Safari](https://github.com/ramanacr/star-ng/issues/35)
  - [A check with a screen reader](https://github.com/ramanacr/star-ng/issues/36)
- Ask questions and share ideas in [GitHub Discussions](https://github.com/ramanacr/star-ng/discussions).
- Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before you start.
- To support the project, use the Sponsor button on the repository page when it is shown.

## Trademarks

PrimeNG, Angular Material, Ignite UI, Kendo UI, Syncfusion, DevExtreme and AG Grid are trademarks of their respective owners. StarNG has no affiliation with these owners, and they do not endorse it. This README, the docs and the API comments name these products only to show which StarNG API does the same job.

## Third-party notices

[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) lists the code that StarNG adapted from other projects and the licences of the third-party assets that the docs site bundles. The package contains this file.

## Links

- [Documentation site](https://ramanacr.github.io/star-ng/)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Releasing](RELEASING.md)
- [Security](SECURITY.md)
- [License (MIT)](LICENSE)
