# Changelog

All notable changes to `@star-ng/ui` are in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The version numbers follow [Semantic Versioning](https://semver.org/). In `0.x` versions, the API can change between minor versions.

## [0.1.0] - Unreleased

This is the first release. The release pull request replaces "Unreleased" with the release date.

### Added

- About 90 standalone controls with signal inputs, models and outputs, in more than 50 entry points (`@star-ng/ui/<group>`). All controls use `OnPush` change detection.
- Control groups: buttons; forms (field, input, checkbox, radio, switch, number, password, mask, one-time code, tags, slider, rating, knob, color picker, select button); selection (select, multi-select, cascade select, listbox, autocomplete, tree, tree select); date and time; table; menus; overlays (dialog, confirm, drawer, popover, tooltip, toast); panels and navigation; data display; charts; media (file upload, editor, carousel, galleria, image); utilities.
- Form controls that implement the Signal Forms control interfaces (`[formField]`). They work in Reactive Forms through `SignalFormControl`.
- One set of `--star-*` CSS tokens with a light theme and a dark theme. Compiled CSS and an SCSS entry.
- `StarThemeService` and `StarThemeSwitch` for a system, light or dark choice, and a first-paint script. The script works under a strict Content Security Policy as an external file, with a hash or with a nonce.
- Built-in control text in the injection token `STAR_UI_TEXT`, with German and Spanish packs (`@star-ng/ui/i18n/de`, `@star-ng/ui/i18n/es`), run-time language switching and an optional Transloco entry point (`@star-ng/ui/transloco`).
- Right-to-left support: logical properties, arrow keys that follow the visual direction, and overlays that follow the direction at run time.
- Accessibility work toward WCAG 2.2 level AA: native elements, keyboard patterns, visible focus, live regions, and contrast checks in both themes.
- A docs site with guides and one page per control, with live examples, source and API tables: <https://ramanacr.github.io/star-ng/>.
- Tests: unit tests, end-to-end tests in Chromium, automated axe accessibility scans, a right-to-left sweep, visual tests with baselines made in CI, a print test of the table export, and a consumer smoke test of the packed package.

[0.1.0]: https://github.com/ramanacr/star-ng/releases/tag/v0.1.0
