# Changelog

All notable changes to `@star-ng/ui` are in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The version numbers follow [Semantic Versioning](https://semver.org/). In `0.x` versions, the API can change between minor versions.

## [Unreleased]

### Added

- Token `--star-primary-text` for text and icons in the primary color on a surface (active tab, selected option, links). It defaults to `--star-primary`, so the default look does not change. A theme with a light primary color can set a darker value, like `--star-primary-fill` for fills.
- Tokens for media: `--star-media-surface`, `--star-scrim-media`, `--star-scrim-media-soft`, `--star-scrim-media-strong`, `--star-on-scrim`, `--star-media-control` and `--star-media-control-text`. The default look does not change.
- `StarTimeField` has the optional properties `min` and `max`.
- The UI text entries `colorArea`, `colorAreaValue`, `hue` and `hueValue`, with German and Spanish texts.
- `@star-ng/ui/core`: `StarSlot`, `STAR_SLOT_HOST`, `starSlot` and `starSlotMap` for template slots, and the shared slot directives `starHeader`, `starFooter`, `starEmpty`, `starLoading`, `starGroup` and `starIcon` (also as `STAR_SLOTS`).
- Template slots for `StarSelect` and `StarMultiSelect`: `starHeader`, `starFooter`, `starEmpty`, `starLoading`, `starGroup` and `starIcon`. `StarSelect` also has `starSelected`, and `StarMultiSelect` also has `starChip`.
- Template slots for `StarListbox`: `starHeader`, `starFooter`, `starEmpty` and `starGroup`.
- Template slots for `StarAutocomplete` and `StarMultiAutocomplete`: `starHeader`, `starFooter`, `starEmpty`, `starLoading` and `starGroup`. `starOption` works as before.
- Template slots for `StarTable`: `starEmpty`, `starLoading`, `starGroup` and `starHeaderCell`, and the `[starTableSummary]` projected content.
- Template slots for `StarTree` and `StarTreeSelect`: `starNode`, `starHeader`, `starFooter`, `starEmpty` and `starIcon="toggle"`.
- Template slots for `StarCalendar`, `StarDatePicker`, `StarDateRangePicker` and `StarMultiDatePicker`: `starDate`, `starHeader` and `starFooter`.
- The guide "Template slots" in the docs.

### Changed

- `StarColorPicker`: the default swatches come from the theme (#59). After the first render, the control reads `--star-primary`, `--star-accent`, `--star-success`, `--star-warning`, `--star-danger`, `--star-info` and `--star-chart-1` to `--star-chart-12` (the tokens that exist) on its own element, as `#rrggbb`. It reads them once and does not follow a later theme change. The fixed list stays as the default on the server and when no token gives a color. An explicit `[swatches]` list always wins. The default `value` does not change.

### Fixed

- `StarTable`: the hidden text of the cells (for screen readers) no longer widens the page when the table scrolls sideways in a narrow container.
- The selected day of `star-calendar` and `star-date-picker` uses `--star-primary-fill` for its background, like the buttons do, so the white text on it can reach 4.5:1 in a theme that sets a darker fill.
- `star-galleria`: the stage is dark in the dark theme (it was near white, so the white caption was not readable), and the round arrow buttons keep a dark icon (#57).
- The chip remove button, the tree toggle and the breadcrumb link have a hit area of at least 24 x 24 px. The icon size does not change.
- The panels of `StarSelect`, `StarMultiSelect`, `StarAutocomplete` and `StarTreeSelect` are as wide as the control when the options are short.
- `StarTimePicker` opens a StarNG panel from its clock button instead of the popup of the browser. The panel uses the theme tokens, disables the times outside `min` and `max`, follows `stepMinute` and works with the keyboard and in right-to-left. The new input `hourFormat` sets the clock of the panel; by default it follows the locale.
- `star-input-tags`, `star-autocomplete` and `star-multi-autocomplete` keep the end buttons on the first row. The chips and the input wrap inside the field.
- Five controls no longer open a native browser popup that ignores the theme (#53):
  - `StarDatePicker` and `StarDateRangePicker` with `showTime` show hour and minute columns (and an am / pm column with `hourFormat="12"`) instead of a native time input. The columns are the ones of the `StarTimePicker` panel, follow `stepMinute` and disable the times outside `minDate` and `maxDate`.
  - `StarPaginator` uses a small `star-select` for the rows per page.
  - `StarTable` uses a small `star-select` for a `filter: 'select'` column. "All" is its placeholder, and its clear button removes the filter.
  - `StarTable` uses a `star-select` for an `editor: 'select'` cell. The list opens when the edit starts. A choice saves at once; Escape or closing the list without a choice cancels.
  - `StarColorPicker` opens a StarNG panel from the custom tile instead of the color dialog of the browser: a saturation and brightness area and a hue slider. Both are sliders with value text, work with the keyboard and mirror in right-to-left.

## [0.2.1] - 2026-11-16

### Fixed

- `StarMenuTrigger` renders on the server. It no longer changes the focus method of its host in the constructor, which the server DOM rejects.
- `StarScrollTop` renders on the server. It no longer uses the global `document`.

## [0.2.0] - 2026-11-15

### Added

- `star-tree-table` can render only the rows in and near the view. Set `virtualScroll` and `scrollHeight`. The input `virtualItemSize` sets the row height in pixels (default 53). This is opt-in. The table stays one table with the `treegrid` role.
- `@star-ng/ui/tree` exports its pure row helpers: `flattenVisible`, `navigationTarget`, `parentsOf`, `rowIndexOf`, `scrollOffsetToReveal` and `stillFocusable`, with the types `BranchLike` and `TreeRow`.
- `@star-ng/ui/core` exports the list window math: `starListLayout`, `starListPageSize`, `starListKeyboardTarget`, `starListTypeaheadIndex`, `starListRevealRows`, `starListRevealOffset`, `starListAriaPosition`, `starListHeight` and `starListRowRendered`, with the types `StarWindowRow`, `StarWindowLayout` and `StarListNavigationKey`.
- Page Up and Page Down move the active option by one page in select, multi-select and autocomplete when `virtualScroll` is on.

### Changed

- `star-tree-table` without `virtualScroll`: Home and End move to the first and the last row. The first row is a Tab stop.
- Type-ahead in select and multi-select accepts a space in the label. A Space inside an active type-ahead does not open the panel and does not toggle an option.
- The print document of the table export aligns a number column to the end when the column sets only `format`.

### Fixed

- Table print works under a strict `style-src` Content Security Policy. The print document uses constructed stylesheets, with no `<style>` element and no `style` attribute.
- The print document takes `lang` and `dir` from the table.
- `aria-activedescendant` and `aria-describedby` in windowed option lists point only to rows that are in the DOM.
- A filter change resets the scroll position of the option list.
- The selected option is fully in view when the panel opens.
- Select all is fast with large lists.
- A list taller than 256 px draws enough rows before the first scroll.

## [0.1.0] - 2026-11-15

This is the first release.

### Added

- The package name on npm is `@star-ng/ui`. Entry points use the form `@star-ng/ui/<group>`.
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

[0.2.1]: https://github.com/ramanacr/star-ng/releases/tag/v0.2.1
[0.2.0]: https://github.com/ramanacr/star-ng/releases/tag/v0.2.0
[0.1.0]: https://github.com/ramanacr/star-ng/releases/tag/v0.1.0
