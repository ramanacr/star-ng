# Changelog

All notable changes to `@star-ng/ui` are in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The version numbers follow [Semantic Versioning](https://semver.org/). In `0.x` versions, the API can change between minor versions.

## [Unreleased]

### Added

#### Action strip

- Action strip (`star-action-strip`, new entry `@star-ng/ui/action-strip`): icon actions on hover and focus of a row or card, with a "More actions" menu (Ignite UI `igx-action-strip`).

#### App bar

- `star-app-bar` (`@star-ng/ui/app-bar`): top bar with start, title and end areas; static, sticky or fixed; safe-area aware.

#### App sidebar

- App sidebar (`star-app-sidebar`, `star-app-sidebar-header`, `star-app-sidebar-section`, `star-app-sidebar-item`, `star-app-sidebar-footer`, new entry `@star-ng/ui/app-sidebar`): the main navigation as a `<nav>` landmark, with router links (`aria-current="page"`), badges, nested items, a `collapsed` model (icons with tooltips), an `overlay` mode that uses a drawer below a breakpoint, and roving focus with the arrow keys (PrimeNG 22 `p-sidebar`). UI text `mainNavigation` (English, German, Spanish).

#### Avatar

- Avatar group (`star-avatar-group`, `@star-ng/ui/avatar`): overlapping avatars with a `max` and a "+N" entry (PrimeNG `p-avatargroup`).
- `STAR_UI_TEXT.moreCount` with German and Spanish texts.

#### Badge

- Overlay badge (`star-overlay-badge`, `@star-ng/ui/badge`): a badge on a corner of any content, with screen-reader text (PrimeNG `p-overlaybadge`).

#### Banner

- `star-banner` (`@star-ng/ui/banner`): persistent page notice with severity, icon, actions area, dismiss button and `open` model.
- UI text `dismiss` (English, German, Spanish).

#### Barcode

- Barcode (`star-barcode`, new entry `@star-ng/ui/barcode`): Code 128 (automatic code set A, B and C switching, modulo 103 check character), EAN-13 and UPC-A (check digit added or validated) and Code 39, encoded from the ISO/IEC standards and drawn as SVG rectangles with the standard quiet zones; `showText`, `barHeight`, `moduleWidth`, an `invalid` output and a visible error state (`STAR_UI_TEXT.barcodeInvalid`, with German and Spanish texts). The pure `starEncodeBarcode(value, type)` returns the bar widths for printing. New tokens `--star-code-dark` and `--star-code-light` (Kendo UI `kendo-barcode`).

#### Bottom nav

- `star-bottom-nav`, `star-bottom-nav-item` (`@star-ng/ui/bottom-nav`): mobile tab bar for buttons or router links with badges and keyboard support.

#### Breadcrumb

- `star-breadcrumb`: an item with `command` and no link renders as a button.

#### Button

- Button group (`star-button-group`, `@star-ng/ui/button`): joins adjacent buttons and split buttons into one bar (PrimeNG `p-buttongroup`).

#### Chart

- Chart: `starChartSvgDocument`, `starChartPng` and `starChartViewBox` are public (`@star-ng/ui/chart`), with a `prepare` option for the copy; the diagram export uses them.
- Chart: data points get keyboard focus (one tab stop; Arrow Right and Arrow Left along a series, Arrow Down and Arrow Up between series, Home and End) with an accessible name per point, the tooltip shows on hover and on focus, `ng-template[starChartTooltip]` replaces its content, and the output `pointSelect({ seriesIndex, index, value })` fires on a click or on Enter or Space (PrimeNG `onDataSelect`, Chart.js tooltip callbacks). `STAR_UI_TEXT.chartPoints`, `chartPointsHint` and `chartPointLabel` with German and Spanish texts.
- Chart: the legend toggles series (buttons with `aria-pressed`; `hiddenSeries` model; colors and markers stay with their series; the table keeps every series) and `legendPosition` (`top`, `bottom`, `start`, `end`). `STAR_UI_TEXT.chartLegend` with German and Spanish texts (Chart.js legend `onClick` and `position`).
- Chart: `valueFormat` (`Intl.NumberFormat` options for the axis, the tooltip, the table and the point names), `min`, `max` and `stepSize` for the value axis, `horizontal` bar and stacked bar charts, and combo charts: a series can set `type` (`bar` or `line`) and `axis` (`primary` or `secondary`, a second value axis at the end of the plot, titled with its series names, which the legend marks with `STAR_UI_TEXT.chartSecondaryAxis`). (Chart.js `indexAxis`, `yAxisID`, scale `min`, `max`, `ticks.stepSize`).
- Chart: `exportSvg()` (a stand-alone SVG document of the plot with resolved token colors and the title) and `exportPng(scale)` (a PNG `Blob` through a canvas); both browser only: `''` and `null` on the server (Chart.js `toBase64Image`).
- Chart: responsive labels. The SVG keeps its view box; in a narrow container (width from a `ResizeObserver`, browser only) the axis text grows back to stay readable and the category labels thin out.

#### Chat

- Chat and AI prompt (`star-chat`, `star-ai-prompt`, `star-markdown-lite`, `StarChatMessageTemplate`, new entry `@star-ng/ui/chat`): a message list with own messages at the end, author groups, day separators, a composer (Enter sends, Shift+Enter adds a line, `send`), a typing indicator, `loadMore` at the top with a kept scroll position, in-place streaming with a polite announcement once a message from others is `sent`, and a Markdown subset rendered as text (bold, italic, code, code blocks, safe links with `rel="noopener noreferrer"`, no raw HTML); and a prompt panel with suggestion chips, `promptRequest`, responses with Copy, Retry (`retry`) and Stop (`stop`) while streaming. No network or model call (Kendo UI Chat and AIPrompt). UI texts `chatMessages`, `chatEmpty`, `message`, `send`, `messageFrom`, `newMessage`, `newMessages`, `messageSending`, `messageSent`, `messageNotSent`, `isTyping`, `areTyping`, `aiPrompt`, `aiPromptPlaceholder`, `promptSuggestions`, `generate`, `aiResponses`, `aiGenerating`, `aiResponseReady`, `aiResponseFailed`, `aiPromptShortcutHint`, `copy`, `copied`, `copyFailed`, `retry` and `stop` (English, German, Spanish).

#### Color picker

- Eye dropper button in `star-color-picker` (`@star-ng/ui/knob`): picks a color from the screen with the `EyeDropper` API of the browser; hidden when the browser has no such API (PrimeNG `p-inputcolor-eyedropper`). New output `changed` emits the color that the user chose. UI text `eyeDropper` (English, German, Spanish).

#### Command palette

- Command palette (`star-command-palette`, `StarCommandTemplate`, new entry `@star-ng/ui/command-palette`): a modal search over commands on a native `<dialog>`, opened with a global `hotkey` (default Control+K or Command+K), with ranked accent-insensitive filtering, groups, recent commands, `commandRun`, and the `starCommand`, `starEmpty` and `starLoading` slots (PrimeNG `p-commandmenu`). UI texts `commandPalette`, `commandPlaceholder` and `recentCommands` (English, German, Spanish).

#### Core and configuration

- Global configuration: `provideStarNg(config)` and `STAR_CONFIG` in `@star-ng/ui/core` (input variant, size, overlay `appendTo` and `zIndexBase`, `filterMatchMode`, `reducedMotion`, `locale`, UI texts, direction, theme storage key) and the signal-based `StarConfigService` (`config()`, `update()`). `reducedMotion: 'always'` applies the reduced-motion rules of the system setting (ripple, carousel autoplay, smooth scroll and the CSS transitions) through `starPrefersReducedMotion` and the Sass mixin `star-reduced-motion`. Precedence: input, then per-control default token, then `provideStarNg`, then the built-in default (PrimeNG `providePrimeNG`).
- Per-control default tokens (Material `MAT_*_DEFAULT_OPTIONS`): `STAR_SELECT_DEFAULTS` / `provideStarSelectDefaults`, `STAR_DATE_PICKER_DEFAULTS` / `provideStarDatePickerDefaults`, `STAR_TABLE_DEFAULTS` / `provideStarTableDefaults` (also `filterMatchMode` of the global filter and `filterLocale`, which read `provideStarNg` too), `STAR_DIALOG_DEFAULTS` / `provideStarDialogDefaults` (dialog, drawer and `StarDialogService.open()`), `STAR_TOAST_DEFAULTS` / `provideStarToastDefaults`. New type `StarToastPosition`.
- `StarAnnouncer` (`@star-ng/ui/core`): screen-reader announcements through the CDK `LiveAnnouncer`, with de-duplication per source: `announce(message, politeness?, { source })` drops the same text from the same source within `STAR_ANNOUNCER_DEDUPE_MS`; a message without a source is always announced.
- `StarClipboard` (`@star-ng/ui/core`): copies text with the async `navigator.clipboard` and falls back to the CDK `Clipboard`; does nothing on the server. `starCopy` directive (`@star-ng/ui/utility`): copies on click, emits `copied(success)` and announces it. UI texts `copied` and `copyFailed` (English, German, Spanish).
- `StarFilterService` (`@star-ng/ui/core`): `register(name, fn, label)` adds a custom match mode for the table filters (PrimeNG `FilterService.register`).

#### Date and time pickers

- Date and time pickers: seconds and steps. `showSeconds`, `stepHour` and `stepSecond` (next to `stepMinute`) on `star-time-picker` and on `star-date-picker` / `star-date-range-picker` with `showTime`; the time panel gets a second column, and the text and the value include the seconds (PrimeNG `showSeconds`, `stepHour`, `stepSecond`).
- UI text `second` (English, German, Spanish).
- Date pickers: `displayFormat` (text without the focus) and `inputFormat` (text while editing, read in the order of that format, with the locale's month names) next to the shared `dateFormat` (Ignite UI `displayFormat` / `inputFormat`); `parseDate` takes an optional format.
- Date pickers: `keepInvalid` keeps typed text that is not a date, marks the field invalid and empties the value (PrimeNG `keepInvalid`).
- Date pickers: `dataType: 'date' | 'string'`; with `'string'` the value is local ISO text (`yyyy-mm-dd`, `yyyy-mm-ddTHH:mm[:ss]` with `showTime`); the pickers also read fractional seconds and a zone (`Z`, `+01:00`) in a given value. The pickers and `StarDateRange` take a type parameter that defaults to `Date` (PrimeNG `dataType`).
- Calendar and date pickers: `showOtherMonths` (default `true`) shows or empties the days of the month before and after; `selectOtherMonths` (default `true`) makes them choosable or disabled (PrimeNG `showOtherMonths`, `selectOtherMonths`).
- Calendar and date pickers: `specialDates` (`StarSpecialDate`: `date`, `label`, `kind`) marks days with a token-styled dot and adds the kind and label to the accessible name of the day; the `starDate` context gets `special` (Ignite UI `specialDates`).
- UI text `holiday`, `event` and `specialDate` (English, German, Spanish).
- Calendar and date pickers: `monthChange` (`{ month, year }`, month 1–12), `yearChange` (`{ year }`) and `viewChange` (`'day' | 'month' | 'year'`) on navigation; the date pickers also emit `todayClick` (today's date) and `clearClick` (PrimeNG `onMonthChange`, `onYearChange`, `onTodayClick`, `onClearClick`).
- Date pickers: `touchUI` opens the popup as a centered modal sheet in a native `<dialog>` with larger days, and `breakpoint` (a CSS length, for example `'640px'`) does so only on a window that is not wider; the page does not scroll under the sheet, and the keyboard model stays (PrimeNG `touchUI`, `breakpoint`).
- Date pickers with `showTime`: `minTime` / `maxTime` limit the time of every day (`HH:mm` or `HH:mm:ss`), together with `minDate` / `maxDate`. `star-time-picker` keeps its `min` / `max` for the same purpose; its 12-hour clock works with seconds.

#### Diagram

- Diagram (`star-diagram`, `ng-template[starDiagramNode]`, new entry `@star-ng/ui/diagram`; Syncfusion and Kendo UI Diagram, DevExtreme dxDiagram): SVG canvas of nodes (`rect`, `rounded`, `ellipse`, `diamond`, ports) and edges (`straight` or `orthogonal` routing around nodes, arrows, labels); select by click, Shift and marquee; drag with snap to `gridSize`; resize handles; connect from a port; pan (Space and drag, middle mouse) and zoom (Control and wheel, buttons, `zoom` model, `fitToContent()`); cancelable `nodesPatch` and `edgesPatch` outputs (the diagram never changes its inputs, so there is no `[(nodes)]` binding); `undo()` and `redo()` (Control+Z, Control+Y) of the applied patches; keyboard: roving nodes, Arrow to the nearest node, Alt+Arrow moves, Shift+Alt+Arrow resizes, Enter edits the label, Delete, Control+A (announced); `role="application"` only while focused, hidden lists of nodes and connections; `exportSvg()` and `exportPng()`. Pure helpers `starApplyPatches`, `starLayoutTree` and `starLayoutGrid`. New `STAR_UI_TEXT` keys (`diagram*`, `zoomToFit`, `redo`) with German and Spanish texts.
- Diagram: `clearHistory()` forgets the undo and redo stacks; the optional `documentKey` input clears them when it changes (another document).

#### Dialog

- Dialog: `draggable` moves `star-dialog` by its header with the pointer, and with Alt + arrow keys on the move button (name "Move dialog"); `keepInViewport` (default true), `rememberPosition` and the output `dragEnd({ x, y })` (PrimeNG `draggable`, `keepInViewport`, `onDragEnd`). UI texts `maximize`, `restore`, `moveDialog` and `resizeDialog` (English, German, Spanish).
- Dialog: `resizable` adds a corner handle (name "Resize dialog") that resizes `star-dialog` with the pointer or with Shift + arrow keys, down to 240 x 160 pixels; output `resizeEnd({ width, height })` (PrimeNG `resizable`, `onResizeEnd`).
- Dialog: `maximizable` adds a Maximize / Restore header button that fills the window; two-way `maximized` model and the outputs `maximize` and `restore` (PrimeNG `maximizable`, `onMaximize`). Escape closes a maximized dialog as before.
- Dialog: `position` places `star-dialog` at the center (default), an edge or a corner (`top`, `bottom`, `start`, `end`, `top-start`, `top-end`, `bottom-start`, `bottom-end`); logical, so it mirrors in right-to-left (PrimeNG `position`). Type `StarDialogPosition`.
- Dialog: `breakpoints` (`{ '<max-width>': '<width>' }`) sets the width of `star-dialog` per window size (PrimeNG `breakpoints`). `blockScroll` (dialog and drawer; default on for a modal, off for a non-modal) and `focusOnShow` (default true) (PrimeNG `blockScroll`, `focusOnShow`). `@star-ng/ui/core` exports `starViewportWidth()` and `starBreakpointValue()`.
- Dialog: `headless` renders only the projected content (no header, no title, no close button; the `[starDialogFooter]` slot stays) (PrimeNG `headless` template). New input `ariaLabelledby` on the dialog and the drawer names the dialog by the id of your own heading.
- `StarDialogConfig` (`StarDialogService.open`): `position`, `draggable`, `resizable`, `maximizable`, `keepInViewport`, `breakpoints`, `blockScroll` and `focusOnShow`.

#### Docs

- Docs: the API tables list the inherited inputs, models and outputs of a control, marked "inherited from" the base class (select family, autocomplete, date pickers, dialog and drawer). `tools/gen-docs-data.mjs` and `tools/agent-data.mjs` share `tools/api-inheritance.mjs`.
- Docs: pages "Action sheet" (`StarActionSheet`) and "Bottom sheet container" (`StarBottomSheetContainer`) with examples.
- Docs: guide "Configuration" (`provideStarNg`, the default tokens, precedence, `StarConfigService`, `StarAnnouncer`, `StarClipboard` and `starCopy`, the pipes and `starKeyFilter`).
- Docs: page "Table interaction" with examples for cell navigation, range selection, the context menu, copy and paste, search highlight and the scroll API.
- Docs: section "Overlays and stacking" in the guide "Configuration": the popups are in the top layer of the browser (native popovers and `showModal()`), so `appendTo` and `zIndex` are not needed for stacking; `overlay.appendTo` only chooses the place in the DOM, and `overlay.zIndexBase` applies to the surfaces outside the top layer (windows, non-modal dialogs, drawers and sheets, the full-screen editor).

#### Document viewer

- Document viewer (`star-document-viewer`, `ng-template[starDocumentError]`, `@star-ng/ui/document-viewer`): a viewer shell for paged documents behind a renderer interface, `StarDocumentRenderer` (`load` and `renderPage` with an optional `AbortSignal`, optional `textContent`, `dispose`), provided with `STAR_DOCUMENT_RENDERER` or the `renderer` input. No PDF engine and no new dependency. The recommended engine is PDF Viewer Native (`pdfviewer-embed`); its adapter becomes possible when its headless rendering API ships ([pdf-viewer#185](https://github.com/ramanacr/pdf-viewer/issues/185)). Until then the JSDoc and the docs page show a PDF.js (`pdfjs-dist`) adapter as an interim alternative; an application that wants a complete viewer with annotations and forms can embed `View.previewFile` of `pdfviewer-embed` directly. Toolbar with previous and next page, a page number field ("3 of 12"), zoom (fit width, fit page, presets, Control+plus and minus, Control and the mouse wheel), rotation, a lazy thumbnails sidebar, continuous and single-page modes, full screen, and the `download` and `print` outputs. Search (Control+F) with result counts and jumps to the pages when the renderer gives text. Only the visible pages plus one have a canvas, sized by `devicePixelRatio`; pages that leave the view free it; a skeleton per page and an error state. The page area is a region named with `title`; each page is an image, or a document with a hidden text layer; page changes are announced; Page Up, Page Down, Home and End navigate (PDF.js viewer, Syncfusion PDF Viewer, Kendo UI PDFViewer).
- UI texts `documentToolbar`, `documentDefaultTitle`, `documentPageOf`, `documentPageInput`, `documentPageCount`, `documentZoom`, `documentFitWidth`, `documentFitPage`, `documentRotate`, `documentThumbnails`, `documentSinglePage`, `fullScreen`, `documentDownload`, `documentPrint`, `documentSearch`, `previousResult`, `nextResult`, `noResults`, `documentSearchResults`, `documentLoadError` and `documentPageError` (English, German, Spanish).

#### Drag and drop

- `starDraggable` and `starDroppable` (new entry `@star-ng/ui/drag-drop`): generic drag and drop with a data payload, scopes, a drag handle, a drag image, drop effects, an accept rule and the outputs `dragStart`, `dragEnd`, `dragEnter`, `dragLeave` and `dropped` (PrimeNG `pDraggable` / `pDroppable`, Ignite UI `igxDrag` / `igxDrop`). The mouse uses the native drag of the browser, touch starts with a long press, and the keyboard picks up with Space, moves between the drop zones with the arrow keys (mirrored in right-to-left), drops with Space and cancels with Escape, with announcements through `StarAnnouncer`. UI texts `dragHint`, `dragPickedUp`, `dragOver`, `dragDropped`, `dragCanceled` and `dragNoTarget` (English, German, Spanish).

#### Drawer

- Drawer: `fullScreen` covers the window and `dismissible` closes `star-drawer` on a backdrop click (PrimeNG `fullScreen`, `dismissible`). `modal=false` (no backdrop, native `show()`), `blockScroll`, `shown` / `hidden` and the logical positions `start`, `end`, `top`, `bottom` are documented and tested.

#### Dropdown

- Drop-down (`star-dropdown`, `star-dropdown-item`, `starDropdownTrigger`, new entry `@star-ng/ui/dropdown`): a listbox that opens from any trigger (Ignite UI `igx-drop-down`).

#### Editor

- Editor: configurable toolbar `toolbar` (command names with `'|'` between groups; `STAR_EDITOR_FULL_TOOLBAR`) with the new commands `strikeThrough`, `code` (inline), `blockquote`, `formatBlock` (paragraph and heading 1 to 3 select), `justifyLeft`, `justifyCenter`, `justifyRight` (logical start, center and end, stored as the classes `star-text-center` and `star-text-end`), `undo` and `redo`. The toolbar is a WAI-ARIA toolbar with a roving tabindex and `aria-pressed` from a selection walk. The link button opens a link form (insert, edit, remove; safe addresses only, `rel="noopener noreferrer"` for a new tab) instead of the browser prompt. Public `exec(command, value?)` and `isActive(command)`. New `STAR_UI_TEXT` editor entries with German and Spanish texts (PrimeNG toolbar formats).
- Editor: `format` (`html` or `text`: the value is plain text, one line per paragraph), `maxLength` (counts the text; typing stops at the limit, a counter under the area describes it, a live message gives the characters left near the end; a signal form `maxLength` rule sets it), and the read-only editor turns off every toolbar control. `STAR_UI_TEXT.editorCharacterCount` and `editorCharactersLeft` with German and Spanish texts.
- Editor: paste. `pasteAsText` inserts only the plain text; otherwise pasted HTML is sanitized with the existing `DomSanitizer` (no scripts, style elements and attributes, or event handlers). A paste that would pass `maxLength` is cut to fit as text. A drop is handled like a paste. Links with a `target` (pasted, typed or set in the model) get `target="_blank"` with `rel="noopener noreferrer"`.
- Editor: toolbar slot `ng-template[starEditorToolbar]` replaces the toolbar; its context has `exec(command, value?)`, `isActive(command)` and `disabled` (PrimeNG `#header` template of `p-editor`).
- Editor formatting (`star-editor`; Aurora RTE features): commands `subscript`, `superscript`, `textColor` and `highlight` (a color panel with theme palette tokens, no color and a custom color), `fontSize` (a select of size steps), `justifyFull`, `checklist` (`ul.star-checklist` with `data-checked`, click the box or Ctrl+Enter), `indent` and `outdent` (nested lists with Tab and Shift+Tab in a list item, indentation steps outside lists), `horizontalRule`; lists, clear formatting and the new commands change the DOM directly, and `undo` and `redo` (Ctrl+Z, Ctrl+Y, the Edit menu) use an own history of every change; toolbar groups that do not fit go into a "More actions" panel. New `STAR_UI_TEXT` keys (`editorSubscript`, `editorSuperscript`, `editorTextColor`, `editorHighlight`, `editorNoColor`, `editorFontSize`, `editorSize*`, `editorJustify`, `editorIndent`, `editorOutdent`, `editorChecklist`, `editorHorizontalRule`) with German and Spanish texts.
- Editor paste and security (`star-editor`; Aurora RTE rules): `sanitize` input with an owner allow-list (`StarEditorSanitizeConfig`: elements, attributes per element, URL protocols, embed hosts; `STAR_EDITOR_SANITIZE_DEFAULTS`); paste cleanup for Microsoft Word (list paragraphs become nested lists, Office markup goes), Google Docs (formats from styles, no wrapper) and web pages (structure stays, fonts, sizes, default colors and classes go); Ctrl+Shift+V pastes plain text once. The sanitizer keeps only the classes of the editor plus the `classes` of the allow-list, `width` and `height` styles only on images, tables, cells, columns and frames, checks every address attribute (`cite`, `srcset`, `longdesc` …) and removes `ping`; a protocol-relative address needs `https:`.
- Editor images and embeds (`star-editor`): `image` command and panel (address or file, required alternative text or decorative, caption as `figure` and `figcaption`, width; edits the selected image); `upload` input (`StarEditorUpload`) stores a chosen file, else a `data:` address; a selected image has a resize handle (pointer drag, or a width slider with the arrow keys); `embed` command for a video or page whose player is on the `embedHosts` of the allow-list (YouTube and Vimeo pages become players; sandboxed `iframe` with a required title). New `STAR_UI_TEXT` keys (`editorImage*`, `editorAltText`, `editorAltRequired`, `editorDecorative`, `editorCaption`, `editorResizeImage`, `editorEmbed*`) with German and Spanish texts.
- Editor HTML source view (`star-editor`, `source` command; Aurora RTE source mode): the value as indented HTML (one block per line, inline content unchanged), read back after a 300 ms pause with the sanitizer and the legacy tag migration; an error names an element that is not closed and a note says when markup was removed or changed. New `STAR_UI_TEXT` keys `editorSource`, `editorSourceChanged`, `editorSourceUnclosed` with German and Spanish texts.
- Editor tables (`star-editor`, `table` command; Aurora RTE table maths): insert panel (rows, columns, header row of `th scope="col"`, pointer size picker), properties panel (borders, alignment, as classes), Tab and Shift+Tab between cells, a table context menu (`star-menu`, right click, Shift+F10, context menu key) to insert and delete rows and columns, merge with the next cell or the cell below, split, toggle the header row and delete the table; column resize by dragging the cell edge or Alt+Shift+Arrow keys (`colgroup` widths). New `STAR_UI_TEXT` keys (`editorTable`, `editorRows`, `editorHeaderRow`, `editorRow*`, `editorColumn*`, `editorDelete*`, `editorMerge*`, `editorSplitCell`, `editorTableProperties`, `editorBorders*`, `editorTableAlign`) with German and Spanish texts.
- Editor productivity (`star-editor`; Aurora RTE find and replace, counts and input rules): `find` command, Ctrl+F and Ctrl+H (match case, whole words, next and previous, replace, replace all, matches with the CSS Custom Highlight API, a status of the match count); `showCount` input (words and characters, next to the `maxLength` counter); `fullScreen` command (Escape leaves); `shortcuts` command (a dialog of the keyboard shortcuts); `markdownShortcuts` input (`# `, `## `, `### `, `> `, `- `, `1. `, `[] ` and `**text**`). New `STAR_UI_TEXT` keys (`editorFind*`, `editorReplace*`, `editorMatchCase`, `editorWholeWord`, `editorMatchCount`, `editorWordCount`, `editorShortcuts`, `editorPastePlain`, `editorCheckItem`, `editorNextCell`, `editorTableMenu`, `editorColumnWidth`, `editorMarkdownHint`) with German and Spanish texts. The docs name the parts that are out of scope (collaboration, track changes, comments, document model) and point to Aurora RTE.
- Editor accessibility check (`star-editor`, `accessibility` command; Aurora RTE accessibility inspector): images without alternative text, links without text, skipped heading levels, tables without header cells and custom text colors under 4.5:1, each with Go to and a one-click Fix. New `STAR_UI_TEXT` keys (`editorAccessibility`, `editorIssue*`, `editorGoTo`, `editorFix`) with German and Spanish texts.

#### Field

- In-field label (`star-ifta-label`, `@star-ng/ui/field`): label inside the control box, linked like `star-field` (PrimeNG `p-iftalabel`).

#### File manager

- File manager (`star-file-manager`, new entry `@star-ng/ui/file-manager`; Kendo UI and Syncfusion FileManager, DevExtreme dxFileManager): folder tree (`star-tree`, lazy folders with a provider), breadcrumb, toolbar, search, details view (`star-table`, sortable, folders first) and large icons view (multi-select listbox), optional details pane; `items` or a `StarFileProvider` read through `resource()`; cancelable outputs `open`, `rename`, `delete` (after a confirmation dialog), `move`, `copy`, `createFolder`, `upload` (`star-file-upload`), `download`; the component never changes `items`; drag and drop onto folders with Control+X, Control+C and Control+V as the keyboard alternative (announced); Shift/Control selection and Control+A; context menu (right click, Shift+F10, context menu key). Sizes with the `starFileSize` pipe. New `STAR_UI_TEXT` keys (file manager texts and the general `open`, `rename`, `delete`, `cut`, `paste`, `cancel`, `create`, `search`, `upload`, `download`) with German and Spanish texts.
- File manager: `error` output (`StarFileErrorEvent`) for failed provider calls, an announced error state with a retry button for a failed listing, and `STAR_UI_TEXT` keys `fileLoadError` and `fileOperationError` with German and Spanish texts. `refresh()` replaces the folder lists one by one instead of clearing them.

#### Gantt

- Gantt chart (`star-gantt`, new entry `@star-ng/ui/gantt`): a task tree grid (name, start, end, duration, progress) and an SVG timeline in one scroll area, with a `day`, `week` or `month` scale, shaded weekends and a today line in the browser; tasks with an exclusive `end`, `progress`, `parentId`, `dependencies` (FS, SS, FF, SF) drawn as orthogonal arrows, `milestone` diamonds and summary tasks that span their children and collapse (`collapsed` model); drag to move, resize and change the progress with a cancelable `taskChange` (the Gantt never changes `tasks`), `taskSelect`; tree grid keyboard with Alt+arrow moves by one scale unit, Alt+Shift+arrow resizes and Alt+Up/Down progress, live announcements, mirrored in right-to-left; rows named like their bars with a text summary of the dependencies, and row virtualization for 1,000 tasks and more (Kendo UI, Syncfusion and DevExtreme Gantt). UI texts `ganttTasks`, `name`, `duration`, `progress`, `durationDays`, `percentComplete`, `milestone`, `summaryTask`, `dependencyFS`, `dependencySS`, `dependencyFF`, `dependencySF` and `dependsOn` (English, German, Spanish).

#### Gauge

- Linear and radial gauges (`star-linear-gauge`, `star-radial-gauge`, new entry `@star-ng/ui/gauge`): a value on an SVG scale with `ranges` (chart palette slots or `success`, `warning`, `danger`), `ticks`, `labels` with `Intl.NumberFormat` options and `locale`, a `needle`, `bar` or `marker` pointer and `animate` (off with reduced motion). Linear: `orientation`, mirrored in right-to-left. Radial: `startAngle`, `endAngle`, `arcWidth`. A read-only `meter`; with `interactive` a `slider` with keyboard, pointer drag and Signal Forms support (Kendo UI `kendo-lineargauge` / `kendo-radialgauge`, Ignite UI `igx-linear-gauge` / `igx-radial-gauge`).

#### Hierarchical grid

- Hierarchical grid (`star-hierarchical-grid`, `star-row-island`, new entry `@star-ng/ui/hierarchical-grid`; Ignite UI igx-hierarchical-grid, Kendo UI Grid hierarchy, Syncfusion hierarchy grid, DevExtreme master-detail, AG Grid master/detail): a root `star-table` whose rows expand into child grids, one per row island and level; every child grid is a `star-table` with cell navigation configured from its island (columns with their sort, filter and edit settings, `paginator`, `rows`, `selectionMode`, `editMode`, `filterDisplay`). Child rows come from a field (`key`) or a loader (`childData(parent, abortSignal)`: array, promise or observable, through `resource()`; aborted when no longer needed) with a loading row and an error row with Retry (the focus follows the load). Each grid keeps the state of its child grids (loaded rows, expanded rows, page, selection) per parent row key, so a detail row that renders again (collapse and expand, sort, the virtual window) loads nothing; it loads again when `childData` or the parent row object changes, or after `reloadChildren(row?)`; the state goes when its parent row or its island leaves. The expand button has `aria-controls` to the child grids. `expandedRows` (two-way), `expandAll()`, `collapseAll()`, cancelable `rowExpand` and `rowCollapse`, `childGridCreated`, root `virtualScroll` with measured child heights. Keyboard as Ignite UI: Alt+Arrow Down / Right expands, Alt+Arrow Up / Left collapses, Arrow Down on an expanded row goes into the child grid, Ctrl+Arrow Up or Escape goes back to the parent row; each level is its own named grid ("Orders of …") with its own `aria-rowindex` (no `aria-level` on rows: valid only in a treegrid). New `STAR_UI_TEXT` keys (`hierarchical*`) with German and Spanish texts.

#### Image editor

- Image editor (`star-image-editor`, new entry `@star-ng/ui/image-editor`): crop with free or fixed ratios (1:1, 4:3, 16:9) and handles, rotation by 90° and by any angle, horizontal and vertical flip, resize with a locked aspect ratio, colour adjustments (brightness, contrast, saturation, grayscale, sepia) through the canvas `filter` with a pixel fallback, and annotations (pen, rectangle, ellipse, arrow, text) in the chart palette colours, with undo and redo (`canUndo`, `canRedo`, Control+Z, Control+Y), reset and zoom to fit or 100 %. Edits are a list of operations that is replayed on the source image (non-destructive); the view canvas is scaled by `devicePixelRatio`. Only `data:image/`, `blob:` and same-origin sources are drawn (canvas taint rule). `exportImage({ type, quality })` resolves to a `Blob` or `null` (server, refused canvas), `toDataUrl()` gives a data URL and the `value` model holds a PNG data URL, encoded asynchronously after each committed edit (150 ms after the last edit); the view renders at screen resolution, once per animation frame, and the geometry tools wait while the crop or resize panel is open. The tools are a WAI-ARIA toolbar, the crop box moves with the arrow keys and resizes with Shift and the arrow keys with announced sizes, the image has a text description of the edits, and the annotations are a list box (Syncfusion `ejs-imageeditor`, Kendo UI ImageEditor).
- UI texts `imageEditor`, `imageTools`, `imageCanvas`, `imageEmpty`, `imageDescription`, `imageNoEdits`, `imageEditList`, `imageEditCrop`, `imageEditRotate`, `imageEditFlipHorizontal`, `imageEditFlipVertical`, `imageEditResize`, `imageEditAdjust`, `imageEditAnnotations`, `imageCrop`, `imageRotate`, `imageRotateLeft`, `imageRotateRight`, `imageFlipHorizontal`, `imageFlipVertical`, `imageResize`, `imageAdjust`, `imageAnnotate`, `imageReset`, `imageResetDone`, `imageZoomFit`, `imageZoomActual`, `apply`, `cancel`, `imageApplied`, `imageAspectRatio`, `imageAspectFree`, `imageCropArea`, `imageCropHint`, `imageAngle`, `imageWidth`, `imageHeight`, `imageKeepRatio`, `imageBrightness`, `imageContrast`, `imageSaturation`, `imageGrayscale`, `imageSepia`, `imageShape`, `imagePen`, `imageRectangle`, `imageEllipse`, `imageArrow`, `imageText`, `imageStrokeWidth`, `imageColor`, `imageAnnotationText`, `imageAddAnnotation`, `imageAnnotations`, `imageAnnotationsEmpty`, `imageAnnotationItem`, `imageDeleteAnnotation`, `imageAnnotationDeleted` and `imageAnnotateHint` (English, German, Spanish). The editor reuses `undo`, `redo`, `editUndone`, `editRedone`, `colorLabel` and `close`.

#### Input and input number

- `starInput` and `star-input-number`: `variant` `outlined` or `filled` (PrimeNG `variant`). The input, input number, select family, listbox, date and time pickers, calendar, tree, tree select, table, chart, file upload and timeline read their `size`, `inputVariant`, `appendTo`, `filterMatchMode` and `locale` defaults from `provideStarNg`.

#### Kanban

- Kanban board (`star-kanban`, `ng-template[starKanbanCard]`, `ng-template[starKanbanHeader]`, new entry `@star-ng/ui/kanban`): columns of cards with optional swimlanes, work-in-progress limits (warning state, `enforceLimits` blocks drops) and collapsible columns. Cards move with CDK drag and drop and with the keyboard (Space picks up, arrow keys move, Space drops, Escape cancels) with live announcements. `itemMove` reports each move and can be cancelled; the board never changes `items`, and `starKanbanApplyMove()` applies a move for the owner (Syncfusion `ejs-kanban`, Kendo UI TaskBoard).
- UI texts `kanbanColumnLabel`, `kanbanColumnLimit`, `kanbanCardHint`, `kanbanPickedUp`, `kanbanMoved`, `kanbanDropped`, `kanbanCanceled` and `kanbanLimitReached` (English, German, Spanish).

#### List

- `star-list`, `star-list-item`, `star-list-subheader` (`@star-ng/ui/list`): plain, navigation and action lists with roving-tabindex keyboard support, dense and divider options.

#### Map

- Map (`star-map`, `ng-template[starMapMarker]`, `ng-template[starMapTooltip]`, new entry `@star-ng/ui/map`): an SVG map of layers. A `shape` layer draws a GeoJSON `FeatureCollection` (polygons with holes, multi-polygons, lines and points) and colours it by equal-interval value classes with a legend (choropleth); a `marker` layer places markers from the slot or a pin; a `bubble` layer sizes circles by value; an optional `tile` layer shows the visible tiles of an address template that the owner gives, with the required attribution, in the browser only. Web Mercator and equirectangular projections (`starProject`, `starUnproject`). Drag to pan, Control and the wheel or a pinch to zoom, zoom and reset buttons, `zoom` and `center` models (`null` fits the data), `minZoom` and `maxZoom`, `selection` model with `selectionMode` (`single`, `multiple`, `none`; keys default to `<layer id>:<feature id or index>`), and the outputs `shapeClick` and `markerClick`. The features are one tab stop with arrow keys in reading order, Enter or Space selects, Shift and the arrow keys pan and plus and minus zoom; the map area has `role="application"` only while focused, with a hint; a data table lists every feature (`table`). Button zoom animations stop with reduced motion (DevExtreme `dxVectorMap`, Kendo UI Map, Ignite UI `igx-geographic-map`, Syncfusion `ejs-maps`).
- UI texts `map`, `mapHint`, `mapResetView`, `mapFeature`, `mapLayer`, `mapLegend`, `mapRange`, `mapFeatureValue` and `mapZoomLevel` (English, German, Spanish); the map reuses `missingData`. The map reuses `zoomIn`, `zoomOut`, `tableView` and `chartValue`.

#### Mention

- Mention (`starMention`, `StarMentionItemTemplate`, new entry `@star-ng/ui/mention`): a directive for `textarea` and `input` that opens suggestions at the caret after a trigger (`triggers`, default `@`), from an array or a function that returns an array or a promise, with `optionLabel`, `filterMatchMode`, `aria-activedescendant` on the field, Enter or Tab to insert `trigger + label + ' '` as plain text, Escape to close, the outputs `mentionSearch` and `mentionSelect`, the read-only `mentions` signal and the `starMentionItem` slot (Syncfusion Mention). UI text `mentionSuggestions` (English, German, Spanish).

#### Multi-column combobox

- Multi-column combobox (`star-multi-column-combobox`, `StarColumnCellTemplate`, new entry `@star-ng/ui/multi-column-combobox`): an editable combobox over a grid-like listbox with a header row (`columns: { field, header, width? }[]`), filtering over every column with `starFilterMatch` (`filterFields`, `filterMatchMode`), arrows, Home, End, Page up, Page down, Enter, Escape and Alt+Arrow down, `aria-activedescendant`, virtual scroll for large data, and the `starColumnCell`, `starEmpty`, `starLoading`, `starHeader` and `starFooter` slots. It extends `StarOptionListBase` without changing it (Kendo UI MultiColumnComboBox, Ignite UI `igx-combo` with columns).

#### Pivot grid

- Pivot grid (`star-pivot-grid`, new entry `@star-ng/ui/pivot-grid`; Ignite UI igx-pivot-grid, Kendo UI PivotGrid, Syncfusion Pivot Table, DevExtreme dxPivotGrid, AG Grid pivot mode): pure engine `starPivot(data, config)` (row and column dimensions with a year > quarter > month date hierarchy, `sum`, `count`, `avg`, `min`, `max`, `distinctCount` or a custom aggregate, include and exclude member filters, member sort by label or by a value, grand totals and subtotals per axis, collapsed members, empty-cell text, drill-down records; no `eval`; `timeZone` for the date buckets) and `starPivotPathKey` (key of `collapsedRows` / `collapsedColumns`). The grid has multi-level sticky column headers (`aria-colindex`, `aria-colspan`), indented row headers with `aria-expanded`, labelled totals, row and column windowing, one-tab-stop cell navigation (arrows, Home, End, Ctrl+Home, Ctrl+End, PageUp, PageDown; Enter or Space and Alt+arrows expand and collapse), `cellClick` with the source records, `expandAll()`, `collapseAll()`, `toCsv()` and `exportCsv()` (RFC 4180; text that starts with `= + - @`, a tab or a carriage return is escaped, number cells never) and a two-way `config`. `showConfigurator` adds a panel: fields move between Rows, Columns, Values and Filters by CDK drag and drop or a move menu (announced), with an aggregate select per value and a member filter popover with search per field. Excel XML export is out of scope. New `STAR_UI_TEXT` keys (`pivot*`, `expandAll`, `collapseAll`) with German and Spanish texts.

#### QR code

- QR code (`star-qr-code`, new entry `@star-ng/ui/qr-code`): QR Code model 2 encoded from ISO/IEC 18004 without a library (automatic version 1 to 40, numeric, alphanumeric or UTF-8 byte mode with ECI, mask chosen by the penalty rules), `errorCorrection` L, M, Q or H, a quiet zone of 4 modules, `size`, `foreground` and `background`, and an optional centre `image` that forces level H. The dark modules are one SVG path. Label "QR code: value" (`STAR_UI_TEXT.qrCodeLabel`, `qrCodeTooLong`, with German and Spanish texts). The pure `starEncodeQr(value, options)` returns the module matrix (Kendo UI `kendo-qrcode`).

#### Query builder

- Query builder (`star-query-builder`, `ng-template[starQueryValue]`, new entry `@star-ng/ui/query-builder`): nested rule groups joined with "and" or "or" (up to `maxDepth`), a value editor per field type (text, number, date, select, boolean, two editors for `between`) and custom editors. `starQueryToPredicate()` filters rows with the match modes of the table filter and custom `StarFilterService` modes; `starQueryToText()` gives a summary; `starQueryComplete()` is a Signal Forms rule for incomplete rules. Delete removes a focused rule (Control+Z restores it), Alt and the up or down arrow move it (Ignite UI `igx-query-builder`, Syncfusion `ejs-querybuilder`, Kendo UI `kendo-filter`).
- UI texts `queryGroupAll`, `queryGroupAny`, `queryField`, `queryValue`, `addGroup`, `removeGroup`, `queryRuleHint`, `queryRuleRemoved`, `queryRuleRestored`, `queryTrue`, `queryFalse`, `queryAnd`, `queryOr`, `queryEmpty`, `queryRuleSummary`, `queryRange` and `queryIncomplete` (English, German, Spanish).

#### Ribbon

- Ribbon (`star-ribbon`, `star-ribbon-tab`, `star-ribbon-group`, `star-ribbon-backstage`, `ng-template[starRibbonItem]`, new entry `@star-ng/ui/ribbon`; Kendo UI and Syncfusion Ribbon): tabs of command groups with large and small buttons, toggle buttons, split buttons, dropdown menus, button groups and custom items; `command` output; groups get small, then collapse to a flyout button when the ribbon is narrow (`refit()`); `collapsed` model; backstage view; WAI-ARIA tab list and one toolbar per group; KeyTips with Alt or F10 (`keyTip`, automatic assignment, `globalKeyTips`). `STAR_UI_TEXT` keys `ribbon`, `ribbonFile`, `ribbonCollapse`, `ribbonExpand`, `ribbonKeyTipsHint`, `ribbonKeyTipsShown`, `ribbonGroupOptions`, `ribbonSplitMenu` with German and Spanish texts.

#### Scheduler

- Scheduler (`star-scheduler`, `StarSchedulerEventTemplate`, new entry `@star-ng/ui/scheduler`): `day`, `week`, `work-week`, `month`, `agenda` and `timeline-day` views (resources as rows) with a toolbar (Today, Previous, Next, view switch, locale range title), events with `allDay`, `resourceId`, `color` (chart palette 1–8), `readonly` and an RRULE `recurrence` with `exceptions`, side-by-side layout of overlapping events, an all-day row, "+N more" in month cells with a popover list, `slotSelect`, `eventSelect`, drag to move and resize snapped to `slotMinutes` with a cancelable `eventChange` (the scheduler never changes `events`), an optional editor dialog (`editor`, `editorSave`, `eventDelete`), the `starSchedulerEvent` slot, `workDayStart` / `workDayEnd`, a current-time line in the browser, grid keyboard navigation and Alt+arrow moves (Alt+Shift+arrow resizes) with live announcements, mirrored in right-to-left. Events are shown in the local time of the browser (Kendo UI Scheduler, Syncfusion Schedule, DevExtreme Scheduler). A pure RFC 5545 RRULE engine: `starParseRrule`, `starExpandRrule` and `starFormatRrule` (FREQ DAILY, WEEKLY, MONTHLY, YEARLY, INTERVAL, COUNT, UNTIL, BYDAY with ordinals, BYMONTHDAY, BYMONTH, WKST). UI texts `scheduler`, `schedulerView`, `viewDay`, `viewWeek`, `viewWorkWeek`, `viewMonth`, `viewAgenda`, `viewTimeline`, `previousPeriod`, `nextPeriod`, `allDay`, `moreEvents`, `noEvents`, `timeRange`, `repeats`, `eventMoveHint`, `eventMoved`, `eventResized`, `changeCanceled`, `currentTime`, `newEvent`, `editEvent`, `title`, `start`, `end`, `resource`, `save`, `cancel`, `deleteEvent` and `endBeforeStart` (English, German, Spanish).

#### Select, autocomplete and listbox

- Select, multi-select and autocomplete: `filterBy`, `filterMatchMode`, `filterLocale` and `resetFilterOnHide`; listbox: `filterBy`, `filterMatchMode` and `filterLocale`. New helper `starFilterMatch` in `@star-ng/ui/core`.
- Select, multi-select, autocomplete and listbox: lazy loading (`lazy`, `lazyLoad` with `StarListLazyLoadEvent`, `resetLazy()` to ask again after a failed load). Options that are not loaded are `undefined` in the array, show as skeleton rows, are skipped by the keyboard, and the list has `aria-busy`.
- Select: `editable` with `allowCustomValue` and `customValue`. Multi-select and multiple autocomplete: `allowCustomValues` with an "Add “text”" row and `customValueAdd`.
- Select, multi-select, autocomplete, multiple autocomplete and listbox: cancelable `selectionChanging` (`previous`, `next`, `cancel()`).
- Select, multi-select and autocomplete: `focusOnHover` and `autoOptionFocus`; select: `selectOnFocus`.
- Select, multi-select and autocomplete: `panelClass`, `panelStyle` and `appendTo`.
- Listbox: `checkbox` mode with a tri-state "Select all", drag and drop between listboxes (`dragdrop`, `dropListData`, `connectedTo`, `dropped`, Alt + Arrow keys), and `optionDblClick`.
- Autocomplete: `forceSelection`, `optionSelect` and `optionUnselect`. Multiple autocomplete: token entry with `separator`, `addOnTab`, `addOnBlur` and `unique`.
- `STAR_UI_TEXT.addCustomValue` with German and Spanish texts.

#### Signature pad

- Signature pad (`star-signature-pad`, new entry `@star-ng/ui/signature-pad`): pointer drawing (mouse, pen with pressure, touch) on a high-DPI canvas with quadratic smoothing, a PNG or SVG data URL value (`valueFormat`), `clear()` and `undo()`, `strokeColor`, `strokeWidth` and `backgroundColor` on screen (the ink follows the theme), `exportColor` (default black) and `exportBackground` for the stored value, `readonly`, `disabled`, `required` through the forms, and a typed-name mode for keyboard users (`allowTyped`), with live announcements (Kendo UI SignaturePad). UI texts `signaturePad`, `signatureArea`, `signatureAreaSigned`, `signatureHint`, `signatureTypedHint`, `clearSignature`, `undo`, `drawSignature`, `typeSignature`, `typeYourName`, `signatureCleared` and `strokeUndone` (English, German, Spanish).

#### Sparkline

- Sparkline (`star-sparkline`, new entry `@star-ng/ui/sparkline`): a tiny inline chart (`line`, `area`, `bar`, `win-loss`) for text and table cells, with `highlight` markers, `referenceLine`, `min`/`max`, a chart palette `color` slot and a summary label from `STAR_UI_TEXT` (`sparklineSummary`, `sparklineTrendUp`, `sparklineTrendDown`, `sparklineTrendFlat`, `sparklineWinLoss`, `missingData`, with German and Spanish texts) (Kendo UI `kendo-sparkline`).

#### Spreadsheet

- Formula engine (`@star-ng/ui/spreadsheet`): `starEvaluate()` evaluates a formula without `eval` or `Function` (numbers, text, booleans, `A1`, `$A$1`, `A1:B5`, `Sheet2!A1`, the operators `+ - * / ^ & = <> < > <= >=`, unary minus and `%` with Excel precedence, and SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, NOT, ROUND, ABS, CONCAT, LEN, UPPER, LOWER, TODAY and DATE). `StarFormulaEngine` keeps a dependency graph over sheets, recalculates only the dependents of a changed cell in dependency order and marks cycles `#CIRC!`; the other errors are `#DIV/0!`, `#REF!`, `#NAME?`, `#VALUE!`, `#NUM!` and `#ERROR!` (syntax).
- Spreadsheet (`star-spreadsheet`, `@star-ng/ui/spreadsheet`): a grid with column letters and row numbers, `rows` and `columns` (default 100 × 26) with row and column windowing and a fixed header row and column, a two-way `cells` model (`{ value?, formula?, format? }` by `A1` address) or named `sheets` with tabs and cross-sheet formulas. Typing replaces a cell; F2, Enter or a double click edit it in place; Enter and Tab commit and move; Escape cancels; a formula bar shows the raw formula. Range selection with Shift and the arrow keys, a drag, or a row or column header; Control+C, X and V copy, cut and paste tab-separated text (Excel and Google Sheets), and a paste of its own copy keeps the formulas with moved references; Delete clears; a fill handle and Control+D and Control+R fill with moved relative references; undo and redo. Formats: number, percent, currency and date through `Intl` and the locale, bold, italic, alignment and a background from the palette tokens; column width and row height resize (`columnWidths`, `rowHeights`) with the pointer or Alt+Shift and the arrow keys (8 px steps, announced). `toCsv()` (with `escapeFormulas`, default true, against CSV formula injection), `fromCsv()` (RFC 4180) and `toJson()`; no XLSX. `role="grid"` with `aria-rowcount`, `aria-colcount`, `aria-rowindex` and `aria-colindex` across the window, and the active cell announced with its address, value and formula ("B3, 42, formula SUM of A1 to A5") (Syncfusion Spreadsheet, Kendo UI Spreadsheet, Ignite UI `igx-spreadsheet`).
- UI texts `spreadsheet`, `spreadsheetHint`, `spreadsheetSelectAll`, `spreadsheetFormulaBar`, `spreadsheetFormatting`, `spreadsheetSheets`, `spreadsheetCellInfo`, `spreadsheetBlank`, `spreadsheetFunction`, `spreadsheetRange`, `spreadsheetSelected`, `spreadsheetEditing`, `spreadsheetCleared`, `spreadsheetFilled`, `spreadsheetPasted`, `spreadsheetColumnWidth`, `spreadsheetRowHeight`, `spreadsheetNumberFormat`, `spreadsheetFormatGeneral`, `spreadsheetFormatNumber`, `spreadsheetFormatPercent`, `spreadsheetFormatCurrency`, `spreadsheetFormatDate`, `spreadsheetMoreDecimals`, `spreadsheetFewerDecimals`, `spreadsheetBackground`, `spreadsheetNoBackground` and `colorBlue`, `colorGreen`, `colorAmber`, `colorRed`, `colorGrey` (English, German, Spanish).

#### Table

- Table: edit lifecycle events `editInit` and `editCancel` for cell edit (`cellEdit` unchanged).
- Table: row edit mode (`editMode="row"`, two-way `editingRowKeys`, `rowEditInit` / `rowEditSave` / `rowEditCancel`, F2, Enter, Escape) and the `starRowEditActions` slot.
- Table: column validation (`required`, `min`, `max`, `pattern`, `validators`) with messages linked by `aria-describedby`; saves are blocked while invalid.
- Table: batch edit (`batchEdit`, `pendingChanges`, `commitEdits` / `batchSave`, `discardEdits`, `undo` / `redo` with Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z), with changed-cell and deleted-row marks.
- Table: `addRow()` / `deleteRow()` with `rowAdd` / `rowDelete`.
- Table: `STAR_UI_TEXT` keys of row edit, validation and batch edit, with German and Spanish texts.
- Table: selection depth: `metaKeySelection` (click, Ctrl / Cmd + click, Shift + click; rows as one tab stop with Arrow keys, Space, Shift + Space and Shift + Arrow), `selectionPageOnly` (default `true`, the page-only header check box of before; `false` selects the whole filter result on all pages), `rowSelectable`, two-way `selectionKeys` and `selectAll`, `rowLabel`, outputs `rowSelect`, `rowUnselect`, `headerCheckboxToggle` and the cancelable `selectionChanging`. Row check boxes and radios are named with the row ("Select row ORD-1001").
- `STAR_UI_TEXT.selectRowOf` and `selectPageRows` with German and Spanish texts.
- Table: filter rules. `StarFilterValue` also takes `StarFilterConstraint` (`operator` `and` / `or`, `rules` of `StarFilterRule` with `matchMode` and `value`); the old text, text list and range values work as before. Match modes: text `contains`, `startsWith`, `endsWith`, `equals`, `notContains`; number `equals`, `notEquals`, `lt`, `lte`, `gt`, `gte`, `between`; date `dateIs`, `dateIsNot`, `dateBefore`, `dateAfter`, `between`; lists `in`. Column `filterMatchModes` and `filterMatchMode`; table `filterLocale`, `globalFilterFields`, `globalFilterMatchMode` and the `filter` output (`filters`, `filteredValue`).
- Table: filter menu (`filterDisplay="menu"`, PrimeNG `p-columnFilter` menu): a filter button in each header cell ("Filter Status, active", `aria-haspopup="dialog"`, `aria-expanded`) opens a labelled dialog with a focus trap, the match mode, the value field(s) of the filter type, "Match all" / "Match any", "Add rule" (`filterMaxRules`), Clear and Apply (`showApplyButton`; without it every change applies at once).
- `STAR_UI_TEXT` entries for the filter menu and the match mode names, with German and Spanish texts.
- Table: column pinning at both edges (PrimeNG `alignFrozen`, Ignite UI column pinning, AG Grid `pinned: 'left' | 'right'`). Column `pinned: 'start' | 'end'` (`frozen: true` stays as an alias of `'start'`), two-way `pinnedColumns` (field to side, `null` unpins), `pinnableColumns` (Pin to start, Pin to end and Unpin buttons in the Columns panel), `pinColumn(field, side)` and the `columnPin` output. End pins stick to the inline end; a shadow marks the inner edge of each pinned area and mirrors in right-to-left. While any column is pinned, the selection, expander and reorder columns stick at the start too; with end pins the row actions column sticks at the end. Pinned columns move within their side only. `stateKey` saves the pins.
- UI texts `pinColumnStart`, `pinColumnEnd` and `unpinColumn` (English, German, Spanish).
- Table: column groups (`columnGroups`, `StarColumnGroup` `{ header, children }` with nested groups; PrimeNG header column groups, Ignite UI `igx-column-group`, AG Grid `ColGroupDef`). Extra header rows with `colspan` / `rowspan`, `scope="colgroup"` on group headers and a `headers` attribute on body cells. Columns of a group stay together and move within their group; a hidden column shrinks its group; a group header sticks when all its columns are pinned on one side. Slot `ng-template[starColumnGroupHeader]` (`StarColumnGroupHeaderTemplate`, one group by `header` or all groups).
- Table: column summaries (Ignite UI summaries, AG Grid `aggFunc`). Column `summary` (`'sum'`, `'avg'`, `'min'`, `'max'`, `'count'` or a function of the rows) and `summaryFormat` (`Intl.NumberFormat` options with the new table `locale`) fill a summary row in the footer over all filtered rows, with the label of a built-in summary. With `groupBy`, `groupSummary` adds a summary row below each group (also with virtual scroll). The column `footer` wins over the summary in the footer row. Lazy mode takes the footer values from the new `summaries` input. New types `StarColumnSummary` and `StarSummaryKind`.
- UI texts `summarySum`, `summaryAverage`, `summaryMinimum`, `summaryMaximum` and `summaryCount` (English, German, Spanish).
- Table: `rowGroupMode` (`'subheader'`, the default heading rows, or `'rowspan'`; PrimeNG `rowGroupMode`). With `'rowspan'` the cells of the `groupBy` column and of columns with the new `mergeCells` merge over consecutive rows with the same text (`rowspan`), within a group and never across an open detail row. Selection, keyboard and edit stay per row. With `virtualScroll` the table keeps heading rows (`'subheader'`).
- Table: column virtualization (`virtualColumns`, `virtualColumnWidth`; Ignite UI and AG Grid column virtualization). Only the columns in view plus 2 on each side render, with spacer cells for the others; pinned columns always render. Header, body, footer, summary rows and column groups stay aligned, and it works together with `virtualScroll`. The table gets `aria-colcount` and the cells `aria-colindex`.
- Table: cell navigation (`cellNavigation`; automatic when a column is `editable` or `selectionMode` is a cell mode): the WAI-ARIA grid pattern with `role="grid"` and one roving tab stop. Arrow keys move one cell (mirrored in right-to-left), Home / End go to the row ends, Ctrl+Home / Ctrl+End to the grid corners, PageUp / PageDown by the rows in view; Enter or F2 edits an editable cell and Escape returns to it. The keys reach pinned columns, skip rows that a merged cell covers, and render a virtual column or row before the focus moves. `activeCell` signal and `activeCellChange` output (Ignite UI keyboard navigation, AG Grid cell navigation). The logic is in the new base class `StarTableInteraction`.
- Table: cell and range selection: `selectionMode` `'cell'` and `'range'` with the two-way `cellSelection` model (`StarTableCellRef[]`, `{ rowKey, field }`). Click or Space selects, Shift + click and Shift + Arrow stretch a range from the anchor, Ctrl / Cmd + click adds or removes a cell; `aria-selected`, `aria-multiselectable` and a selection fill that differs from the focus ring, also on pinned columns (AG Grid and Ignite UI `cellSelection`).
- Table: context menu (`contextMenu`: `StarMenuItem[]` or a function of the row and the column; `contextMenuDefaults` with the built-in items `copy`, `copyWithHeaders`, `pinStart`, `pinEnd`, `unpin`, `sortAsc`, `sortDesc`, `hideColumn` and `export`; two-way `contextMenuSelection`; `contextMenuSelect` output with the row, the column and the item). It opens on a right click, Shift+F10 or the context menu key and gives the focus back to the cell (PrimeNG `contextMenu`, `contextMenuSelection`, `onContextMenuSelect`). Types `StarTableContextMenuEvent`, `StarTableMenuDefault`, `StarTableMenuItems`.
- Table: clipboard. Ctrl+C copies the cell range, the selected rows or the focused cell as tab-separated text (`copyHeaders`, `copyToClipboard({ headers })`, through `StarClipboard`); with `pasteEditable`, Ctrl+V pastes tab-separated text into the editable cells through the column rules and the edit events (`cellEdit`, `rowEditSave` in row mode, one undo step with `batchEdit`), and `beforePaste` can cancel (AG Grid clipboard). Both are announced. Types `StarTableCopyOptions`, `StarTablePasteCell`, `StarTablePasteEvent`.
- Table: search highlight (`searchText`, two-way, apart from `globalFilter`): `<mark>` around the matches, case- and accent-insensitive with `filterLocale`; `searchMatches` signal (count and active index), `findNext()`, `findPrevious()` with wrap and `clearSearch()` (Ignite UI names). The active match scrolls into view on any page and in virtual rows and columns. A cell template opts in with the new `highlight(text)` function of `StarCellContext`. Types `StarTableSearchMatches`, `StarTableTextPart`.
- Table: keyboard and scroll API: `focusCell(rowKey, field)`, `navigateTo(rowIndex, field)`, `scrollToRow(rowKeyOrIndex, { align })` and `scrollToColumn(field, { align })` (`'nearest'`, `'start'`, `'center'`, `'end'`; `StarScrollOptions`, `StarScrollAlign`). They open the page of a client paginator, render virtual rows and columns first and scroll smoothly unless motion is reduced.
- UI texts `copiedCells`, `pastedCells`, `skippedCells`, `copyWithHeaders`, `sortAscending`, `sortDescending`, `hideColumn` and `exportCsv` (English, German, Spanish).
- Table: `StarTablePasteEvent` (the `beforePaste` payload) has `readonly canceled: boolean` next to `cancel()`, like the other cancelable events. Code that builds this object itself must add the member.

#### Tabs

- Tabs: `scrollable` keeps the tabs on one line with previous and next scroll buttons (pointer only, shown when the tabs overflow) and scrolls the selected tab into view (PrimeNG `scrollable`, Material pagination).
- Tabs: `closable` on `star-tab` shows a close button, and the Delete key closes the focused tab. The output `tabClose({ value, index, cancel() })` lets the owner remove the tab or keep it; the selection and the focus move to the neighbour tab. `STAR_UI_TEXT.tabClose` and `tabCloseHint` with German and Spanish texts (PrimeNG `closable`, `onClose`). The close buttons on the tabs are for the pointer; a named close button for the selected tab follows the tab list for screen readers and voice control.
- Tabs: `lazy` (default `true`: `starTabContent` renders on the first activation; `false` renders every template at once) and `cache` (default `true`: rendered panels stay alive, hidden; `false` destroys the content of a tab that is not active) (PrimeNG `lazy`, `cache`, Material `preserveContent`).
- Tabs: `orientation` (`horizontal` or `vertical`, with `aria-orientation`; Arrow Up and Arrow Down move in a vertical list, Arrow Left and Arrow Right stay mirrored in right-to-left) and `alignment` (`start`, `center`, `end`, `stretch`).
- Tabs: `reorderable` lets the user drag a tab to a new place (CDK drag-drop) or move the focused tab with Control+Shift and an arrow key (mirrored in right-to-left), with a live announcement of the new position. The output `tabReorder({ previousIndex, currentIndex })` lets the owner reorder its list. `STAR_UI_TEXT.tabReorderHint` with German and Spanish texts.
- Tabs: header slot `ng-template[starTabHeader]` (context: `$implicit` and `tab`, `active`, `index`) for custom tab labels, for one tab or for all (PrimeNG `p-tab` content, Material `mat-tab-label`).

#### Tile layout

- Tile layout (`star-tile-layout`, `star-tile`, new entry `@star-ng/ui/tile-layout`): a CSS grid of tiles with column and row spans, reorder by drag and drop or Control and the arrow keys (`order` model), resize by Control, Shift and the arrow keys or a corner handle (`tileResize`), and container-query breakpoints (Material `mat-grid-list`, Kendo UI TileLayout). UI texts `tileMoveHint`, `tileResizeHint` and `tileSize` (English, German, Spanish).

#### Toast

- Toast: `star-toast` inputs `preventDuplicates` (ignores a message the outlet showed before, also after it closed) and `preventOpenDuplicates` (ignores a copy of a visible message), `breakpoints` (`{ '<max-width>': { ...styles } }`: full width at the bottom on a narrow window) and the output `closed({ message, reason })` with the reason `timeout`, `close` or `clear` (PrimeNG `preventDuplicates`, `preventOpenDuplicates`, `breakpoints`, `onClose`). `StarToastService.closed` reports every close.

#### Tree

- Tree: drag and drop (`draggableNodes`, `droppableNodes`, `draggableScope`, `droppableScope`, `validateDrop`, `nodeDrop` with `before`, `after`, `inside` and `fromTree`). Ctrl+Shift and the arrow keys move the focused node, with a live announcement. The tree never changes `nodes`.
- Tree: lazy children (`leaf: false`, `loading`, `loadingMode` row or icon, `nodeExpand`, `nodeCollapse`).
- Tree: `filterMode` lenient or strict, `filterBy` and `filterLocale`.
- Tree: checkbox `propagateSelectionUp` / `propagateSelectionDown`; locked nodes (`disabled`, `selectable: false`) keep their state.
- Tree: `nodeUnselect`, `nodeDoubleClick`, `nodeContextMenu`, and a node context menu (`contextMenu`, `contextMenuSelect`) with right click, Shift+F10 and the context menu key.
- Tree: methods `expandAll`, `collapseAll`, `expandPath` and `scrollToNode`.
- UI texts `treeMoveHint`, `treeMovedBefore`, `treeMovedAfter`, `treeMovedInside`, `treeMoveNotAllowed` (English, German, Spanish).

#### Tree select

- Tree select: `filterMode`, `filterBy`, `filterLocale`, `propagateSelectionUp`, `propagateSelectionDown`, `loadingMode`, lazy children, `display` comma or chip, and the outputs `nodeSelect`, `nodeUnselect`, `nodeExpand`, `nodeCollapse`.

#### Tree table

- Tree table: sorting (`sortable` columns, `sortField`, `sortOrder`, `multiSort`, `sortMeta`); siblings sort within their parent.
- Tree table: global and column filters (`globalFilter`, `filter`, `filters`, `filterMode` lenient or strict).
- Tree table: paging over the top-level rows (`paginator`, `rows`, `first`).
- Tree table: selection (`selectionMode` single, multiple or checkbox with `propagateSelectionUp` / `propagateSelectionDown`, `selection` keys, `nodeSelect`, `nodeUnselect`).
- Tree table: lazy children (`lazy`, `leaf: false`, `loading`, `nodeExpand`, `nodeCollapse`).
- Tree table: frozen, resizable and reorderable columns (`columnWidths`, `columnOrder`).
- Tree table: cell edit (`editable`, `editor`, `cellEdit`) with treegrid cell navigation (`cellNavigation`).
- Tree table: row context menu (`contextMenu`, `contextMenuSelect`) with right click, Shift+F10 and the context menu key.

#### Utility

- Pipes in `@star-ng/ui/utility` (pure, server safe, locale from the argument or `provideStarNg`): `starFileSize`, `starRelativeTime` (with `StarClock` and `provideStarClock` in `@star-ng/ui/core` for the current time), `starHighlight` (escaped text with `<mark>` around the matches, accent-insensitive like `starFilterMatch`) and `starInitials`; `STAR_PIPES` imports all four. Helpers `starFormatFileSize`, `starFormatRelativeTime`, `starTextParts`, `starEscapeHtml`, `starInitials` and `starFoldText` in `@star-ng/ui/core`.
- Key filter `starKeyFilter` (`@star-ng/ui/utility`, PrimeNG `pKeyFilter`): presets `int`, `num`, `money`, `hex`, `alpha`, `alphanum`, `email` or a `RegExp`; blocks keys and filters paste and drop (up to `maxlength`, also on `type="email"` and `type="number"`), never interrupts IME composition; `validateOnly` sets an error instead (`valid()`, `validChange`, native validation message, forms error `starKeyFilter`). UI text `keyFilterInvalid` (English, German, Spanish).

#### Virtual scroller

- `star-virtual-scroller` (`@star-ng/ui/virtual-scroller`): windowed list on CDK virtual scrolling with fixed item size, vertical or horizontal, lazy loading (`lazyLoad`), loading and empty slots, `scrollToIndex`, `scrollTo`, `visibleRange`.

#### Window

- Window (`star-window`, `StarWindowService`, new entry `@star-ng/ui/window`): a floating, non-modal window on a native `<dialog>` opened with `show()`, with drag and resize (pointer, Alt and Shift with the arrow keys), minimize, maximize and restore (`state` model, `stateChange`), `position` and `size` models, a window stack that brings the focused window to the front, `keepInViewport`, `closeOnEscape` and `closed` (Kendo UI Window). UI texts `minimize`, `maximize`, `restore` and `windowHint` (English, German, Spanish). The window layer follows `--star-z-index-base` (`provideStarNg({ overlay: { zIndexBase } })`), so menus and select panels opened in a window stay on top.

### Changed

- Table: the sticky header (`stickyHeader`) has `z-index: 2`, so pinned body cells scroll under it.
- Table: a table with `frozen` columns now also keeps the selection, expander and reorder columns at the start while it scrolls sideways (before, they scrolled away under the frozen columns), and the last frozen column has a separator shadow.
- Tabs: each tab button is now inside a wrapper element (`span.star-tabs__item`, which also holds the close button of a closable tab), and the tab list is inside `div.star-tabs__nav`. Styles or tests that select `.star-tabs__list > .star-tabs__tab` must use `.star-tabs__list .star-tabs__tab`.
- Editor: `star-editor` now declares `maxLength` (the `FormValueControl` input), so a Signal Forms field with a `maxLength` rule now sets it: the editor shows a counter and stops typing at the limit. The editor counts the characters of text; the form rule counts the length of the value, which is HTML with `format="html"` (tags included). Keep the rule for the stored size, or use `format="text"` when both must count the same.
- Table: the selection check boxes and radios now name their row ("Select row ORD-1001", from the first visible column or `rowLabel`), and the header check box of a paginated table with `selectionPageOnly` is named "Select all rows on this page". Tests that match the old name "Select row" exactly must change.
- Table: `StarFilterValue` also includes `StarFilterConstraint`. Code that narrows a filter value with `typeof value === 'object'` or `Array.isArray` must also handle the rule object (it has `operator` and `rules`).
- Tree table: the component moved to its own file `data-display/tree-table.ts`; the import path `@star-ng/ui/data-display` does not change.
- Tree: `nodeSelect` no longer fires when a node turns off in multiple or checkbox mode; `nodeUnselect` fires instead. To react to every change, listen to `nodeUnselect` or `valueChange`.
- Tree: in checkbox mode, a parent key in `value` shows the parent checked, and a click on a branch also checks its descendants that a filter hides.
- `StarDialog` and `StarDrawer` now extend the new abstract base class `StarDialogBase` (`@star-ng/ui/dialog`), which holds the shared inputs and outputs. `StarDrawer` no longer extends `StarDialog`; its inputs and outputs do not change.
- The page scroll lock of a dialog and a drawer uses the new class `star-dialog--block-scroll` (CSS `html:has(dialog.star-dialog--block-scroll[open])`) instead of `star-dialog--modal`. A modal still blocks the scroll by default.
- `starViewportWidth(when?)` takes an optional condition; `star-dialog` and `star-toast` add the window resize listener only while `breakpoints` is set.
- Table: a table with an `editable` column now uses cell navigation by default: it is a `role="grid"` with one tab stop, its cells are `gridcell`s, and the edit buttons of the cells other than the active one have `tabindex="-1"` (the arrow keys move between them). The selection, expander, reorder and row action cells are grid cells too: their controls have `tabindex="-1"`, Space on the selection cell toggles the row, Enter or F2 moves the focus into the controls and Escape or F2 back (F2 on the row action cell edits the row), and `activeCell` reports them as `$select`, `$expander`, `$reorder` and `$actions`. A grid with `selectionMode="multiple"` is `aria-multiselectable`. Tests that find such a table with the role `table` or its cells with the role `cell` must use `grid` and `gridcell`. Set `cellNavigation="false"` to keep the old tab order.
- Table: `selectionMode` moved to the base class `StarTableInteraction` and its type adds `'cell'` and `'range'`; the row selection modes work as before.
- Table: the editor text parse moved to `parseEditorText` in `table-editing.ts`, and `StarEditBatch` has `changeRows()` (several rows as one undo step).
- Tree table: the context menu key check and the keyboard open of the menu use the shared core helpers `ɵstarIsContextMenuKey` and `ɵstarOpenContextMenu` (internal); the behaviour does not change.
- Editor: the HTML sanitizer is now the allow-list sanitizer of the editor (rules from Aurora RTE) instead of the Angular `DomSanitizer`: safe inline styles stay (colors, font size, alignment, indentation, widths), an unsafe URL is removed instead of getting the `unsafe:` prefix, `id` and `name` go (DOM clobbering), and legacy `<font>`, `<center>`, `<strike>` and `align` become current markup. Undo and redo no longer use the browser history.
- UI texts (unreleased, renamed to generic keys because the editor uses them too): `spreadsheetBackgroundAccent`, `…Success`, `…Warning`, `…Danger`, `…Muted` are now `colorBlue`, `colorGreen`, `colorAmber`, `colorRed`, `colorGrey`; `documentFullScreen`, `documentPreviousResult`, `documentNextResult`, `documentNoResults` are now `fullScreen`, `previousResult`, `nextResult`, `noResults`.
- Editor: link targets in values set through the model are rewritten (security hardening). A link with `target="_blank"` gets `rel="noopener noreferrer"`, and `_self`, `_parent` and `_top` lose the `target`. Migration: a value read back from the editor can differ from the value written; compare or store the value that the editor gives back.
- Internal refactors with no API change (shared helpers of the table, tree table and tree).
- Table: the Apply button of the filter menu and the Save and Cancel buttons of row edit use the shared UI texts `apply`, `save` and `cancel` (no separate table keys).

### Deprecated

- `formatFileSize` (`@star-ng/ui/file-upload`): use `starFormatFileSize` from `@star-ng/ui/core` (or the `starFileSize` pipe). File upload uses the core helper now.
- Table: the copy and paste, the body context menu and the search highlight of `StarTableInteraction` moved to focused internal helper files (`table-interaction-clipboard.ts`, `table-interaction-menu.ts`, `table-interaction-search.ts`); the public API and the behaviour do not change.
- Table docs: the interaction page and the `cellNavigation` description say that a control which a custom row action or lead template adds without a row or edit change keeps its tab stop; give it `tabindex="-1"`.

### Fixed

- Table: a Shift move into a lead cell no longer leaves a stale range target behind (internal state only).
- Window: a window that is minimized or maximized from code while `minimizable` or `maximizable` is off now shows its restore button, so the user can bring it back. After the restore the button goes and the focus moves to the title bar.
- Image editor: after an enlarging resize the preview was blurry, because the cached base was drawn at the view scale of the larger output and then stretched. The base scale now includes the resize enlargement (at most 2x the view per side, and never above the natural size); the export did not change.
- Menu: `starMenuTrigger` on a wrapper (a custom element such as `<star-button>`) now gives the host `role="none"` already in the first render (also in the server render and before hydration), and the host carries no `aria-haspopup` / `aria-expanded` (the inner button has them), so assistive technology never meets a button around a button. A plain element such as `<div tabindex="0">` keeps its button role, and so does a custom element without a button inside.
- Signature pad, AI prompt, app sidebar (submenu chevron) and command palette (search icon): the built-in icons used the regular Phosphor weight (`ph`), which the docs and most apps do not load, so they did not show. They now use the bold weight (`ph-bold`) like the other controls. The docs examples and JSDoc examples of the app sidebar, bottom navigation, command palette and list use `ph-bold` too.
- A dialog or drawer with a `header` and `showHeader` false pointed `aria-labelledby` at a title that was not rendered; it now takes the header text as `aria-label`.
- A non-modal dialog or drawer (native `show()`, not in the top layer) stacks above sticky page headers (`z-index: 999`, below the CDK overlay container), as a non-modal bottom sheet does.
- Dialog: a close or a destroy in the middle of a pointer drag or resize stops the tracking; the dialog no longer reopens at the dragged position or emits `dragEnd` / `resizeEnd` after the close. Moves of another pointer are ignored.
- Dialog: `keepInViewport` clamps to the page area without the scrollbar (`documentElement.clientWidth` / `clientHeight`), and a remembered position and size (`rememberPosition`) come back inside the window on reopen.
- Pivot grid: in a narrow configurator the area names ("Columns") were clipped and the fields ran out of the panel. The two area columns now shrink, a name wraps, and the Values area uses the full width.
- Tabs: when the last tab that can take the focus closes from the keyboard or its close button, the focus moves to the tab list instead of the page body.
- Mention: the result count ("2 results available", "No results found") goes to the shared live region (`StarAnnouncer`); the region inside the suggestion panel was created with its first text, so screen readers could miss it.

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
