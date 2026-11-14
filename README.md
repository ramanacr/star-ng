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
- Built-in control text in one injection token (`STAR_UI_TEXT`), ready for translation.
- No Angular Material and no other UI kit.

> Status: the controls are being ported in groups. The docs application lists the controls
> that are available now. The package is not on npm yet.

## Requirements

| Package                                              | Version                                     |
| ---------------------------------------------------- | ------------------------------------------- |
| `@angular/core`, `@angular/common`, `@angular/forms` | 22 or later                                 |
| `@angular/cdk`                                       | 22 or later                                 |
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

The docs application has the guides (getting started, theming and tokens, dark mode, forms,
internationalisation, accessibility) and one page per control with live examples, their
source and an API table.

```bash
corepack pnpm install
corepack pnpm start        # docs application on http://localhost:4200
```

## Repository

| Path               | Content                                                          |
| ------------------ | ---------------------------------------------------------------- |
| `projects/star-ng` | The library. One folder per entry point, `styles/` for the SCSS. |
| `projects/docs`    | The docs application.                                            |
| `e2e`              | Playwright tests. They run against the docs application.         |
| `tools`            | Build tools: compiled CSS, docs data generator, name check.      |

## Development

| Command                  | What it does                                                         |
| ------------------------ | -------------------------------------------------------------------- |
| `corepack pnpm start`    | Serves the docs application.                                         |
| `corepack pnpm lint`     | ESLint, docs data check and name check.                              |
| `corepack pnpm test:ci`  | Unit tests (Vitest, jsdom) with coverage.                            |
| `corepack pnpm build`    | Builds the package to `dist/star-ng` (with CSS) and the docs.        |
| `corepack pnpm e2e`      | Playwright tests (`corepack pnpm e2e:install` once for the browser). |
| `corepack pnpm docs:gen` | Writes the API and example data of the docs after a change.          |

Conventions: Conventional Commits, one feature per pull request, signed commits.

## License

MIT. See [LICENSE](LICENSE).
