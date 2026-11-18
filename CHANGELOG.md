# Changelog

All notable changes to `@star-ng/ui` are in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The version numbers follow [Semantic Versioning](https://semver.org/). In `0.x` versions, the API can change between minor versions.

## [Unreleased]

### Added

- Overlay badge (`star-overlay-badge`, `@star-ng/ui/badge`): a badge on a corner of any content, with screen-reader text (PrimeNG `p-overlaybadge`).
- Avatar group (`star-avatar-group`, `@star-ng/ui/avatar`): overlapping avatars with a `max` and a "+N" entry (PrimeNG `p-avatargroup`).
- Button group (`star-button-group`, `@star-ng/ui/button`): joins adjacent buttons and split buttons into one bar (PrimeNG `p-buttongroup`).
- In-field label (`star-ifta-label`, `@star-ng/ui/field`): label inside the control box, linked like `star-field` (PrimeNG `p-iftalabel`).
- Drop-down (`star-dropdown`, `star-dropdown-item`, `starDropdownTrigger`, new entry `@star-ng/ui/dropdown`): a listbox that opens from any trigger (Ignite UI `igx-drop-down`).
- Action strip (`star-action-strip`, new entry `@star-ng/ui/action-strip`): icon actions on hover and focus of a row or card, with a "More actions" menu (Ignite UI `igx-action-strip`).
- `STAR_UI_TEXT.moreCount` with German and Spanish texts.
- `star-virtual-scroller` (`@star-ng/ui/virtual-scroller`): windowed list on CDK virtual scrolling with fixed item size, vertical or horizontal, lazy loading (`lazyLoad`), loading and empty slots, `scrollToIndex`, `scrollTo`, `visibleRange`.
- `star-list`, `star-list-item`, `star-list-subheader` (`@star-ng/ui/list`): plain, navigation and action lists with roving-tabindex keyboard support, dense and divider options.
- `star-banner` (`@star-ng/ui/banner`): persistent page notice with severity, icon, actions area, dismiss button and `open` model.
- `star-app-bar` (`@star-ng/ui/app-bar`): top bar with start, title and end areas; static, sticky or fixed; safe-area aware.
- `star-bottom-nav`, `star-bottom-nav-item` (`@star-ng/ui/bottom-nav`): mobile tab bar for buttons or router links with badges and keyboard support.
- UI text `dismiss` (English, German, Spanish).
- Dialog: `draggable` moves `star-dialog` by its header with the pointer, and with Alt + arrow keys on the move button (name "Move dialog"); `keepInViewport` (default true), `rememberPosition` and the output `dragEnd({ x, y })` (PrimeNG `draggable`, `keepInViewport`, `onDragEnd`). UI texts `maximize`, `restore`, `moveDialog` and `resizeDialog` (English, German, Spanish).
- Dialog: `resizable` adds a corner handle (name "Resize dialog") that resizes `star-dialog` with the pointer or with Shift + arrow keys, down to 240 x 160 pixels; output `resizeEnd({ width, height })` (PrimeNG `resizable`, `onResizeEnd`).
- Dialog: `maximizable` adds a Maximize / Restore header button that fills the window; two-way `maximized` model and the outputs `maximize` and `restore` (PrimeNG `maximizable`, `onMaximize`). Escape closes a maximized dialog as before.
- Dialog: `position` places `star-dialog` at the center (default), an edge or a corner (`top`, `bottom`, `start`, `end`, `top-start`, `top-end`, `bottom-start`, `bottom-end`); logical, so it mirrors in right-to-left (PrimeNG `position`). Type `StarDialogPosition`.
- Dialog: `breakpoints` (`{ '<max-width>': '<width>' }`) sets the width of `star-dialog` per window size (PrimeNG `breakpoints`). `blockScroll` (dialog and drawer; default on for a modal, off for a non-modal) and `focusOnShow` (default true) (PrimeNG `blockScroll`, `focusOnShow`). `@star-ng/ui/core` exports `starViewportWidth()` and `starBreakpointValue()`.
- Dialog: `headless` renders only the projected content (no header, no title, no close button; the `[starDialogFooter]` slot stays) (PrimeNG `headless` template). New input `ariaLabelledby` on the dialog and the drawer names the dialog by the id of your own heading.

### Changed

- `StarDialog` and `StarDrawer` now extend the new abstract base class `StarDialogBase` (`@star-ng/ui/dialog`), which holds the shared inputs and outputs. `StarDrawer` no longer extends `StarDialog`; its inputs and outputs do not change.
- The page scroll lock of a dialog and a drawer uses the new class `star-dialog--block-scroll` (CSS `html:has(dialog.star-dialog--block-scroll[open])`) instead of `star-dialog--modal`. A modal still blocks the scroll by default.

### Fixed

- A dialog or drawer with a `header` and `showHeader` false pointed `aria-labelledby` at a title that was not rendered; it now takes the header text as `aria-label`.

## [0.3.1] - 2026-11-18

### Added

- `@star-ng/ui/bottom-sheet`: `StarBottomSheet` opens a component or a template in a sheet at the bottom edge (native `<dialog>`), with `StarBottomSheetRef` (`afterDismissed()`, `closed`, `dismiss()`), `STAR_BOTTOM_SHEET_DATA` and the config `ariaLabel`, `hasBackdrop`, `closeOnBackdrop`, `closeOnEscape`, `panelClass` and `maxHeight`. `openActions()` opens `star-action-sheet`, a list of actions that resolves with the chosen one.
- Confirm popup: `target` also takes an `ElementRef`, `severity: 'danger'` gives the accept button the danger variant, `header` is optional, and the slot `ng-template[starConfirmMessage]` replaces the message of the dialog and the popup.
- `star-popover`: inputs `role` and `ariaLabelledby`, and `data-autofocus` for the first focus.
- UI text `bottomSheet` (English, German, Spanish).

### Fixed

- Confirm popup: it is an `alertdialog` with `aria-modal="false"` named by its message, `defaultFocus` works, Tab stays inside, and the focus returns to the target after an answer.
- The popup of `StarDatePicker` and `StarDateRangePicker` with `showTime` fits in a small window again. At 1366×768 it was about 545px high, opened past the bottom of the window, and Done could not be reached. In a window at least 36rem wide (54rem with several months) the time columns are now at the inline end of the calendar (on the right, or on the left in right-to-left), as high as the calendar, and they scroll inside with the chosen time in view. The start and end times of the range picker are one above the other. Done is in its own row under them. In a narrower window the time columns stay under the calendar. The date and time popups (also `StarTimePicker`) now move into the window when they fit neither below nor above the field, 8px from the edges, and scroll inside when the window is too small for them.

## [0.3.0] - 2026-11-17

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
- Template slots for `StarTreeTable` (`starNode`, `starEmpty`, `starHeader`, `starFooter`) and `StarDataView` (`starEmpty`, `starHeader`, `starFooter`).
- `StarItemTemplate` (`starItem`, with `StarItemContext`): an item slot for `StarOrderList` and `StarPickList`. In the pick list the context also has `list`.
- `StarToastMessageTemplate` (`starToastMessage`): replaces the summary and detail of each toast. The context has the message and `close()`.
- `StarFileTemplate` (`starFile`): replaces one row of the `StarFileUpload` file list. The context has the file, `status`, `remove()`, `index` and `interactive`. The file list also supports `starEmpty`.
- `StarCascadeOptionTemplate` (`starCascadeOption`): replaces the label of each option of `StarCascadeSelect`. The context has `$implicit`, `selected`, `index`, `level` and `hasChildren`.

### Changed

- **Breaking:** `StarField.linkControl` has a new signature: `linkControl(controlId, focus?, destroyRef?)` returns a `boolean` (it was `linkControl(inputId): void`). It accepts `null` or a function for the id, and an optional focus callback. The first control that links wins and later links return `false` (before, the last one won). The link ends when `destroyRef` or the calling injection context is destroyed, or with the new `unlinkControl`. A custom control that calls `linkControl` must use `injectStarFieldLink` or check the result.
- `@phosphor-icons/web` is now an optional peer dependency. The library uses only its CSS classes and does not import it. Install it and add its styles to show the default icons, or load your own CSS for the `ph-*` classes. The install commands and the default look do not change.
- `StarColorPicker`: the default swatches come from the theme. Once after the first render, the control reads `--star-primary`, `--star-accent`, `--star-success`, `--star-warning`, `--star-danger`, `--star-info` and `--star-chart-1` to `--star-chart-12` (the tokens that exist) on its own element, as `#rrggbb`. It does not follow a later theme change. The fixed list stays as the default on the server and when no token gives a color. An explicit `[swatches]` list always wins. The type of `swatches` and the default `value` do not change.
- `StarSelect`, `StarMultiSelect`, `StarAutocomplete` and `StarMultiAutocomplete`: buttons, links and fields in the `starHeader` and `starFooter` of the open panel are now in the tab order. Tab moves into them, Tab after the last one closes the panel, Shift+Tab goes back to the combobox, and Escape closes the panel. Before, Tab closed the panel and this content could not be reached with the keyboard.
- `StarSelect` and `StarMultiSelect` with `virtualScroll`: the `starLoading` row is now counted when the list scrolls.
- `StarListbox`: the empty state renders from one place, and the group heading fallback with `virtualScroll` renders like the one without it. The text does not change.
- `StarTable`: the loading cell has the class `star-table__loading`.
- API docs: a member with an `@internal` JSDoc tag is left out of the API tables. The pass-through template inputs of `StarTree` are tagged `@internal`.

### Fixed

- `StarTable`: the hidden text of the cells (for screen readers) no longer widens the page when the table scrolls sideways in a narrow container.
- The selected day of `star-calendar` and `star-date-picker` uses `--star-primary-fill` for its background, like the buttons do, so the white text on it can reach 4.5:1 in a theme that sets a darker fill.
- `star-galleria`: the stage is dark in the dark theme (it was near white, so the white caption was not readable), and the round arrow buttons keep a dark icon.
- The chip remove button, the tree toggle and the breadcrumb link have a hit area of at least 24 x 24 px. The icon size does not change.
- The panels of `StarSelect`, `StarMultiSelect`, `StarAutocomplete` and `StarTreeSelect` are as wide as the control when the options are short.
- `StarTimePicker` opens a StarNG panel from its clock button instead of the popup of the browser. The panel uses the theme tokens, disables the times outside `min` and `max`, follows `stepMinute` and works with the keyboard and in right-to-left. The new input `hourFormat` sets the clock of the panel; by default it follows the locale.
- `star-input-tags`, `star-autocomplete` and `star-multi-autocomplete` keep the end buttons on the first row. The chips and the input wrap inside the field.
- Five controls no longer open a native browser popup that ignores the theme:
  - `StarDatePicker` and `StarDateRangePicker` with `showTime` show hour and minute columns (and an am / pm column with `hourFormat="12"`) instead of a native time input. The columns are the ones of the `StarTimePicker` panel, follow `stepMinute` and disable the times outside `minDate` and `maxDate`.
  - `StarPaginator` uses a small `star-select` for the rows per page.
  - `StarTable` uses a small `star-select` for a `filter: 'select'` column. "All" is its placeholder, and its clear button removes the filter.
  - `StarTable` uses a `star-select` for an `editor: 'select'` cell. The list opens when the edit starts. A choice saves at once; Escape or closing the list without a choice cancels.
  - `StarColorPicker` opens a StarNG panel from the custom tile instead of the color dialog of the browser: a saturation and brightness area and a hue slider. Both are sliders with value text, work with the keyboard and mirror in right-to-left.
- The label of `star-field` names every StarNG form control in it, and a click on the label focuses the control. Before, many controls had no accessible name. A control with a native input gets the label `for`. A control without one (for example `star-select`, `star-listbox`, `star-radio-group`, `star-tree` and an inline `star-calendar`) gets `aria-labelledby`. The two handles of `star-range-slider` put the label text in their names. An `ariaLabel` or `ariaLabelledBy` that you set wins. These controls also get the hint or error of the field in `aria-describedby`, and most show the field error as `aria-invalid`. New in `@star-ng/ui/field`: `injectStarFieldLink`, `starFieldLabelledBy`, `starJoinIds` and `StarField.labelledBy`.

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

[0.3.1]: https://github.com/ramanacr/star-ng/releases/tag/v0.3.1
[0.3.0]: https://github.com/ramanacr/star-ng/releases/tag/v0.3.0
[0.2.1]: https://github.com/ramanacr/star-ng/releases/tag/v0.2.1
[0.2.0]: https://github.com/ramanacr/star-ng/releases/tag/v0.2.0
[0.1.0]: https://github.com/ramanacr/star-ng/releases/tag/v0.1.0
