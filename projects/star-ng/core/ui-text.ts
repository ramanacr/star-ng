import { InjectionToken, Provider } from '@angular/core';

/**
 * Built-in texts of the StarNG UI controls (screen-reader labels, empty states, reports).
 * Defaults are English. Override them once at app level:
 * - `provideStarUiTextFromTransloco()` reads them from the active Transloco language (`ui.*` keys)
 *   and updates the controls live when the language changes.
 * - `provideStarUiText({...})` sets fixed texts.
 *
 * Function entries take values (for example a count) and return the full sentence, so word order
 * can change per language. Their parameter names are listed in `STAR_UI_TEXT_PARAMS`.
 */
export interface StarUiText {
  // General
  readonly close: string;
  /** Hides a notice, for example the dismiss button of `star-banner`. */
  readonly dismiss: string;
  readonly clear: string;
  readonly loading: string;
  readonly actions: string;
  readonly moreActions: string;
  readonly bottomSheet: string;
  // Dialog
  readonly maximize: string;
  readonly restore: string;
  readonly moveDialog: string;
  readonly resizeDialog: string;
  readonly ofTotal: (index: number, total: number) => string;
  readonly expandItem: (label: string) => string;
  readonly collapseItem: (label: string) => string;
  readonly removeItem: (label: string) => string;
  /** Label of the "+N" entry for items that are not shown (avatar group). */
  readonly moreCount: (count: number) => string;
  // Tags field
  readonly tagsHint: string;
  readonly tagAdded: (label: string) => string;
  readonly tagRemoved: (label: string) => string;
  readonly tagInvalid: (label: string) => string;
  readonly tagDuplicate: (label: string) => string;
  readonly tagLimit: (max: number) => string;
  readonly notifications: string;
  readonly accept: string;
  readonly reject: string;
  // Select, listbox, autocomplete
  readonly selectPlaceholder: string;
  readonly filterPlaceholder: string;
  readonly emptyMessage: string;
  readonly emptyFilterMessage: string;
  readonly selectAll: string;
  readonly selectedItems: (count: number) => string;
  readonly searching: string;
  readonly showOptions: string;
  /** The row that adds typed text as a new value (multi-select, multiple autocomplete). */
  readonly addCustomValue: (label: string) => string;
  readonly resultsAvailable: (count: number) => string;
  // Table, paginator, data view
  readonly pagination: string;
  readonly firstPage: string;
  readonly previousPage: string;
  readonly nextPage: string;
  readonly lastPage: string;
  readonly page: (page: number) => string;
  readonly rowsPerPage: string;
  readonly pageReport: (first: number, last: number, total: number) => string;
  readonly noData: string;
  readonly selectRow: string;
  readonly selectAllRows: string;
  /** Name of a row check box or radio, with the row text: "Select row Order 1042". */
  readonly selectRowOf: (label: string) => string;
  /** Header check box with `selectionPageOnly`. */
  readonly selectPageRows: string;
  readonly filterBy: (column: string) => string;
  readonly filterAll: string;
  readonly filterMin: (column: string) => string;
  readonly filterMax: (column: string) => string;
  readonly filterMinShort: string;
  readonly filterMaxShort: string;
  /** Filter menu of a table column (`filterDisplay="menu"`). */
  readonly filterMenu: (column: string) => string;
  readonly filterMenuActive: (column: string) => string;
  readonly filterOperator: string;
  readonly matchAll: string;
  readonly matchAny: string;
  readonly matchMode: string;
  readonly filterRule: (index: number) => string;
  readonly addRule: string;
  readonly removeRule: (index: number) => string;
  readonly applyFilter: string;
  readonly matchContains: string;
  readonly matchStartsWith: string;
  readonly matchEndsWith: string;
  readonly matchEquals: string;
  readonly matchNotContains: string;
  readonly matchNotEquals: string;
  readonly matchLt: string;
  readonly matchLte: string;
  readonly matchGt: string;
  readonly matchGte: string;
  readonly matchBetween: string;
  readonly matchDateIs: string;
  readonly matchDateIsNot: string;
  readonly matchDateBefore: string;
  readonly matchDateAfter: string;
  readonly matchIn: string;
  readonly expandRow: string;
  readonly collapseRow: string;
  readonly rowDetails: string;
  readonly reorderRows: string;
  readonly sortMultiHint: string;
  readonly terminalCommand: string;
  readonly compareImages: string;
  readonly editCell: (column: string) => string;
  readonly editRow: string;
  readonly saveRow: string;
  readonly cancelRowEdit: string;
  readonly rowActions: string;
  readonly cellChanged: string;
  readonly rowDeleted: string;
  readonly valueRequired: string;
  readonly valueMin: (min: number) => string;
  readonly valueMax: (max: number) => string;
  readonly valuePattern: string;
  readonly valueNumber: string;
  readonly changeAdded: string;
  readonly editSaved: string;
  readonly editCanceled: string;
  readonly editInvalid: string;
  readonly editUndone: string;
  readonly editRedone: string;
  readonly editsDiscarded: string;
  readonly rowAdded: string;
  readonly rowRemoved: string;
  readonly columns: string;
  readonly resizeColumn: (column: string) => string;
  readonly moveColumnEarlier: (column: string) => string;
  readonly moveColumnLater: (column: string) => string;
  readonly layout: string;
  readonly layoutList: string;
  readonly layoutGrid: string;
  // Tile layout
  /** Hint of a reorderable tile. */
  readonly tileMoveHint: string;
  /** Hint of a resizable tile. */
  readonly tileResizeHint: string;
  /** Announcement after a tile resize. */
  readonly tileSize: (label: string, columns: number, rows: number) => string;
  // Command palette
  readonly commandPalette: string;
  readonly commandPlaceholder: string;
  /** Heading of the recent commands. */
  readonly recentCommands: string;
  /** Default name of the `<nav>` landmark of `star-app-sidebar`. */
  readonly mainNavigation: string;
  // Window
  readonly minimize: string;
  /** Keyboard hint of the title bar of `star-window`. */
  readonly windowHint: string;
  // Order list, pick list
  readonly moveSelectedItem: string;
  readonly orderListHint: string;
  readonly moveTop: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly moveBottom: string;
  readonly itemPosition: (label: string, position: number, total: number) => string;
  // Tree: move a node (drag and drop, Ctrl+Shift+arrow keys)
  readonly treeMoveHint: string;
  readonly treeMovedBefore: (label: string, target: string) => string;
  readonly treeMovedAfter: (label: string, target: string) => string;
  readonly treeMovedInside: (label: string, target: string) => string;
  readonly treeMoveNotAllowed: (label: string) => string;
  readonly transfer: string;
  readonly moveSelectedToTarget: string;
  readonly moveAllToTarget: string;
  readonly moveSelectedToSource: string;
  readonly moveAllToSource: string;
  readonly pickListSource: string;
  readonly pickListTarget: string;
  // Dates
  readonly chooseDate: string;
  readonly chooseMonth: string;
  readonly chooseYear: string;
  readonly previousMonth: string;
  readonly nextMonth: string;
  readonly previousYears: string;
  readonly nextYears: string;
  readonly today: string;
  readonly time: string;
  readonly startTime: string;
  readonly weekNumber: string;
  readonly weekShort: string;
  readonly endTime: string;
  readonly done: string;
  readonly chooseTime: string;
  readonly hour: string;
  readonly minute: string;
  readonly second: string;
  readonly dayPeriod: string;
  /** Kinds of a special date in the calendar (`specialDates`). */
  readonly holiday: string;
  readonly event: string;
  /** A special date without a kind. */
  readonly specialDate: string;
  // Inputs
  readonly increase: string;
  readonly decrease: string;
  readonly showPassword: string;
  readonly hidePassword: string;
  readonly passwordWeak: string;
  readonly passwordFair: string;
  readonly passwordGood: string;
  readonly passwordStrong: string;
  readonly passwordRuleLength: (min: number) => string;
  readonly passwordRuleUpper: string;
  readonly passwordRuleLower: string;
  readonly passwordRuleNumber: string;
  readonly passwordRuleSymbol: string;
  readonly ruleMet: string;
  readonly ruleNotMet: string;
  readonly otpLabel: string;
  readonly otpCharacter: (position: number, total: number) => string;
  readonly ratingLabel: string;
  readonly sliderMinimum: (label: string) => string;
  readonly sliderMaximum: (label: string) => string;
  readonly colorLabel: string;
  readonly customColor: string;
  readonly hexValue: (label: string) => string;
  readonly colorArea: string;
  readonly colorAreaValue: (saturation: number, brightness: number) => string;
  readonly hue: string;
  readonly hueValue: (degrees: number) => string;
  // File upload
  readonly chooseFiles: string;
  readonly dropFiles: string;
  readonly fileMaxSize: (size: string) => string;
  readonly fileUpTo: (count: number) => string;
  readonly uploadingFile: (name: string) => string;
  readonly uploaded: string;
  readonly fileTypeNotAllowed: (name: string) => string;
  readonly fileTooLarge: (name: string, max: string) => string;
  readonly fileLimitReached: (limit: number) => string;
  // Editor
  readonly editorLabel: string;
  readonly editorFormatting: (label: string) => string;
  readonly editorBold: string;
  readonly editorItalic: string;
  readonly editorUnderline: string;
  readonly editorHeading: string;
  readonly editorBulletList: string;
  readonly editorNumberedList: string;
  readonly editorClearFormatting: string;
  readonly editorLink: string;
  readonly editorLinkPrompt: string;
  // Navigation and layout
  readonly breadcrumb: string;
  readonly stepperLabel: string;
  readonly stepCompleted: string;
  readonly resizePanes: string;
  readonly dock: string;
  readonly scrollToTop: string;
  readonly theme: string;
  readonly themeSystem: string;
  readonly themeLight: string;
  readonly themeDark: string;
  // Media
  readonly pauseSlides: string;
  readonly playSlides: string;
  readonly previousSlides: string;
  readonly nextSlides: string;
  readonly galleryLabel: string;
  readonly previousImage: string;
  readonly nextImage: string;
  readonly showImage: (alt: string) => string;
  readonly previewImage: (alt: string) => string;
  readonly zoomIn: string;
  readonly zoomOut: string;
  // Charts and meters
  readonly chartView: string;
  readonly tableView: string;
  readonly chartTotal: string;
  readonly chartOther: string;
  readonly chartCategory: string;
  readonly chartValue: string;
  readonly chartShare: string;
  readonly chartSeries: string;
  readonly chartX: string;
  readonly chartY: string;
  readonly chartTypeBar: string;
  readonly chartTypeStackedBar: string;
  readonly chartTypeLine: string;
  readonly chartTypeArea: string;
  readonly chartTypeDoughnut: string;
  readonly chartTypePie: string;
  readonly chartTypeRadar: string;
  readonly chartTypePolarArea: string;
  readonly chartTypeScatter: string;
  readonly chartDescription: (
    kind: string,
    series: number,
    items: number,
    min: string,
    max: string,
  ) => string;
  readonly meterValue: (value: string, total: number) => string;
  // Signature pad
  /** Default name of the `star-signature-pad` group. */
  readonly signaturePad: string;
  /** Name of the drawing area of `star-signature-pad` while it is empty. */
  readonly signatureArea: string;
  /** Name of the drawing area while it holds a signature. */
  readonly signatureAreaSigned: string;
  readonly signatureHint: string;
  /** Second hint sentence when the pad also takes a typed name (`allowTyped`). */
  readonly signatureTypedHint: string;
  readonly clearSignature: string;
  readonly undo: string;
  /** Mode button: draw the signature. */
  readonly drawSignature: string;
  /** Mode button: type the name instead of drawing. */
  readonly typeSignature: string;
  readonly typeYourName: string;
  readonly signatureCleared: string;
  readonly strokeUndone: string;
  // Mention
  /** Name of the suggestion list of `starMention`. */
  readonly mentionSuggestions: string;
  // Chat
  /** Default name of the message area of `star-chat`. */
  readonly chatMessages: string;
  /** Shown while `star-chat` has no message. */
  readonly chatEmpty: string;
  /** Label and placeholder of the composer field. */
  readonly message: string;
  readonly send: string;
  /** Screen-reader prefix of a message: author and time. */
  readonly messageFrom: (name: string, time: string) => string;
  /** Live announcement of a new message from someone else. */
  readonly newMessage: (name: string, text: string) => string;
  readonly messageSending: string;
  readonly messageSent: string;
  readonly messageNotSent: string;
  /** Typing indicator for one person. */
  readonly isTyping: (name: string) => string;
  /** Typing indicator for several people. `names` is a list such as "Ana and Jonas". */
  readonly areTyping: (names: string) => string;
  // AI prompt
  /** Label of the prompt field of `star-ai-prompt`. */
  readonly aiPrompt: string;
  readonly aiPromptPlaceholder: string;
  /** Name of the group of prompt suggestion chips. */
  readonly promptSuggestions: string;
  readonly generate: string;
  /** Name of the list of responses. */
  readonly aiResponses: string;
  readonly aiGenerating: string;
  readonly aiResponseReady: string;
  readonly aiResponseFailed: string;
  readonly copy: string;
  readonly copied: string;
  readonly retry: string;
  readonly stop: string;
  /** Live announcement when several messages from others arrive at once. */
  readonly newMessages: (count: number) => string;
  /** Visible hint under the prompt field of `star-ai-prompt`. */
  readonly aiPromptShortcutHint: string;
  readonly copyFailed: string;
  // Scheduler
  /** Default name of `star-scheduler`. */
  readonly scheduler: string;
  /** Name of the group of view buttons. */
  readonly schedulerView: string;
  readonly viewDay: string;
  readonly viewWeek: string;
  readonly viewWorkWeek: string;
  readonly viewMonth: string;
  readonly viewAgenda: string;
  readonly viewTimeline: string;
  /** Pages one day, week or month back (scheduler toolbar). */
  readonly previousPeriod: string;
  readonly nextPeriod: string;
  readonly allDay: string;
  /** Button of a month cell with events that are not shown. */
  readonly moreEvents: (count: number) => string;
  readonly noEvents: string;
  /** A time span in an accessible name: "10:00 to 11:00". */
  readonly timeRange: (start: string, end: string) => string;
  /** Marks an occurrence of a recurring event. */
  readonly repeats: string;
  /** Keyboard hint of a movable event or task bar. */
  readonly eventMoveHint: string;
  /** Live announcement after a keyboard move: `when` is the new time span. */
  readonly eventMoved: (label: string, when: string) => string;
  /** Live announcement after a keyboard resize. */
  readonly eventResized: (label: string, when: string) => string;
  /** Live announcement when the owner canceled a change. */
  readonly changeCanceled: string;
  readonly currentTime: string;
  /** Header of the event editor. */
  readonly newEvent: string;
  readonly editEvent: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly resource: string;
  readonly save: string;
  readonly cancel: string;
  readonly deleteEvent: string;
  /** Error of the editor when the end is not after the start. */
  readonly endBeforeStart: string;
  // Gantt
  /** Default name of the task tree grid of `star-gantt`. */
  readonly ganttTasks: string;
  readonly name: string;
  readonly duration: string;
  readonly progress: string;
  readonly durationDays: (count: number) => string;
  readonly percentComplete: (value: number) => string;
  readonly milestone: string;
  readonly summaryTask: string;
  /** Dependency types of a Gantt task: finish to start, start to start, and so on. */
  readonly dependencyFS: string;
  readonly dependencySS: string;
  readonly dependencyFF: string;
  readonly dependencySF: string;
  /** Text summary of the dependencies of a task: `label` lists the tasks and their types. */
  readonly dependsOn: (label: string) => string;
}

export const STAR_UI_TEXT_DEFAULTS: StarUiText = {
  close: 'Close',
  dismiss: 'Dismiss',
  clear: 'Clear',
  loading: 'Loading',
  actions: 'Actions',
  moreActions: 'More actions',
  bottomSheet: 'Bottom sheet',
  maximize: 'Maximize',
  restore: 'Restore',
  moveDialog: 'Move dialog',
  resizeDialog: 'Resize dialog',
  ofTotal: (index, total) => `${index} of ${total}`,
  expandItem: (label) => `Expand ${label}`,
  collapseItem: (label) => `Collapse ${label}`,
  removeItem: (label) => `Remove ${label}`,
  moreCount: (count) => `${count} more`,
  tagsHint: 'Press Enter or comma to add. Backspace removes the last item.',
  tagAdded: (label) => `${label} added`,
  tagRemoved: (label) => `${label} removed`,
  tagInvalid: (label) => `${label} is not valid.`,
  tagDuplicate: (label) => `${label} is already added.`,
  tagLimit: (max) => `You can add up to ${max} items.`,
  notifications: 'Notifications',
  accept: 'Confirm',
  reject: 'Cancel',

  selectPlaceholder: 'Select',
  filterPlaceholder: 'Search',
  emptyMessage: 'No options available',
  emptyFilterMessage: 'No results found',
  selectAll: 'Select all',
  selectedItems: (count) => `${count} items selected`,
  searching: 'Searching…',
  showOptions: 'Show options',
  addCustomValue: (label) => `Add “${label}”`,
  resultsAvailable: (count) => (count === 1 ? '1 result available' : `${count} results available`),

  pagination: 'Pagination',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  page: (page) => `Page ${page}`,
  rowsPerPage: 'Rows per page',
  pageReport: (first, last, total) => `${first}–${last} of ${total}`,
  noData: 'No records found',
  selectRow: 'Select row',
  selectAllRows: 'Select all rows',
  selectRowOf: (label) => `Select row ${label}`,
  selectPageRows: 'Select all rows on this page',
  filterBy: (column) => `Filter by ${column}`,
  filterAll: 'All',
  filterMin: (column) => `${column} from`,
  filterMax: (column) => `${column} to`,
  filterMinShort: 'Min',
  filterMaxShort: 'Max',
  filterMenu: (column) => `Filter ${column}`,
  filterMenuActive: (column) => `Filter ${column}, active`,
  filterOperator: 'Combine rules',
  matchAll: 'Match all',
  matchAny: 'Match any',
  matchMode: 'Match mode',
  filterRule: (index) => `Rule ${index}`,
  addRule: 'Add rule',
  removeRule: (index) => `Remove rule ${index}`,
  applyFilter: 'Apply',
  matchContains: 'Contains',
  matchStartsWith: 'Starts with',
  matchEndsWith: 'Ends with',
  matchEquals: 'Equals',
  matchNotContains: 'Does not contain',
  matchNotEquals: 'Not equals',
  matchLt: 'Less than',
  matchLte: 'Less than or equal to',
  matchGt: 'Greater than',
  matchGte: 'Greater than or equal to',
  matchBetween: 'Between',
  matchDateIs: 'Date is',
  matchDateIsNot: 'Date is not',
  matchDateBefore: 'Date is before',
  matchDateAfter: 'Date is after',
  matchIn: 'Is one of',
  expandRow: 'Expand row',
  collapseRow: 'Collapse row',
  rowDetails: 'Details',
  reorderRows: 'Order',
  sortMultiHint: 'Shift + click adds this column to the sort',
  terminalCommand: 'Command',
  compareImages: 'Compare images',
  editCell: (column) => `Edit ${column}`,
  editRow: 'Edit row',
  saveRow: 'Save',
  cancelRowEdit: 'Cancel',
  rowActions: 'Row actions',
  cellChanged: 'changed',
  rowDeleted: 'deleted',
  valueRequired: 'Enter a value.',
  valueMin: (min) => `Enter ${min} or more.`,
  valueMax: (max) => `Enter ${max} or less.`,
  valuePattern: 'Enter the value in the expected format.',
  valueNumber: 'Enter a number.',
  changeAdded: 'Change added.',
  editSaved: 'Changes saved.',
  editCanceled: 'Edit canceled.',
  editInvalid: 'Correct the errors, then save.',
  editUndone: 'Change undone.',
  editRedone: 'Change redone.',
  editsDiscarded: 'Changes discarded.',
  rowAdded: 'Row added.',
  rowRemoved: 'Row deleted.',
  columns: 'Columns',
  resizeColumn: (column) => `Resize ${column}`,
  moveColumnEarlier: (column) => `Move ${column} earlier`,
  moveColumnLater: (column) => `Move ${column} later`,
  layout: 'Layout',
  layoutList: 'List',
  layoutGrid: 'Grid',
  tileMoveHint: 'Press Control and an arrow key to move the tile.',
  tileResizeHint: 'Press Control, Shift and an arrow key to resize the tile.',
  tileSize: (label, columns, rows) =>
    `${label}: ${columns} ${columns === 1 ? 'column' : 'columns'}, ${rows} ${rows === 1 ? 'row' : 'rows'}`,
  commandPalette: 'Command palette',
  commandPlaceholder: 'Type a command or search',
  recentCommands: 'Recent',
  mainNavigation: 'Main navigation',
  minimize: 'Minimize',
  windowHint: 'Alt and the arrow keys move the window. Shift and the arrow keys resize it.',

  moveSelectedItem: 'Move selected item',
  orderListHint: 'Use Alt and the arrow keys to move the selected item.',
  moveTop: 'Move to top',
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveBottom: 'Move to bottom',
  itemPosition: (label, position, total) => `${label}, position ${position} of ${total}`,
  treeMoveHint: 'Use Control, Shift and the arrow keys to move the node.',
  treeMovedBefore: (label, target) => `${label} moved before ${target}`,
  treeMovedAfter: (label, target) => `${label} moved after ${target}`,
  treeMovedInside: (label, target) => `${label} moved into ${target}`,
  treeMoveNotAllowed: (label) => `${label} cannot move there`,
  transfer: 'Transfer',
  moveSelectedToTarget: 'Move selected to target',
  moveAllToTarget: 'Move all to target',
  moveSelectedToSource: 'Move selected to source',
  moveAllToSource: 'Move all to source',
  pickListSource: 'Available',
  pickListTarget: 'Selected',

  chooseDate: 'Choose date',
  chooseMonth: 'Choose month',
  chooseYear: 'Choose year',
  previousMonth: 'Previous month',
  nextMonth: 'Next month',
  previousYears: 'Previous years',
  nextYears: 'Next years',
  today: 'Today',
  time: 'Time',
  startTime: 'Start time',
  weekNumber: 'Week number',
  weekShort: 'Wk',
  endTime: 'End time',
  done: 'Done',
  chooseTime: 'Choose time',
  hour: 'Hour',
  minute: 'Minute',
  second: 'Second',
  dayPeriod: 'AM or PM',
  holiday: 'Holiday',
  event: 'Event',
  specialDate: 'Special date',

  increase: 'Increase',
  decrease: 'Decrease',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  passwordWeak: 'Password strength: weak',
  passwordFair: 'Password strength: fair',
  passwordGood: 'Password strength: good',
  passwordStrong: 'Password strength: strong',
  passwordRuleLength: (min) => `At least ${min} characters`,
  passwordRuleUpper: 'An uppercase letter',
  passwordRuleLower: 'A lowercase letter',
  passwordRuleNumber: 'A number',
  passwordRuleSymbol: 'A symbol',
  ruleMet: 'met',
  ruleNotMet: 'not met',
  otpLabel: 'Verification code',
  otpCharacter: (position, total) => `Character ${position} of ${total}`,
  ratingLabel: 'Rating',
  sliderMinimum: (label) => `${label} minimum`.trim(),
  sliderMaximum: (label) => `${label} maximum`.trim(),
  colorLabel: 'Color',
  customColor: 'Custom color',
  hexValue: (label) => `${label} hex value`,
  colorArea: 'Saturation and brightness',
  colorAreaValue: (saturation, brightness) =>
    `Saturation ${saturation}%, brightness ${brightness}%`,
  hue: 'Hue',
  hueValue: (degrees) => `${degrees} degrees`,

  chooseFiles: 'Choose files',
  dropFiles: 'Drag files here, or',
  fileMaxSize: (size) => `max ${size}`,
  fileUpTo: (count) => `up to ${count} files`,
  uploadingFile: (name) => `Uploading ${name}`,
  uploaded: 'Uploaded',
  fileTypeNotAllowed: (name) => `${name}: this file type is not allowed.`,
  fileTooLarge: (name, max) => `${name}: the file is larger than ${max}.`,
  fileLimitReached: (limit) => `You can add up to ${limit} files.`,

  editorLabel: 'Editor',
  editorFormatting: (label) => `${label} formatting`,
  editorBold: 'Bold',
  editorItalic: 'Italic',
  editorUnderline: 'Underline',
  editorHeading: 'Heading',
  editorBulletList: 'Bulleted list',
  editorNumberedList: 'Numbered list',
  editorClearFormatting: 'Clear formatting',
  editorLink: 'Link',
  editorLinkPrompt: 'Link address (https://…)',

  breadcrumb: 'Breadcrumb',
  stepperLabel: 'Progress',
  stepCompleted: '(completed)',
  resizePanes: 'Resize panes',
  dock: 'Dock',
  scrollToTop: 'Scroll to top',
  theme: 'Theme',
  themeSystem: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',

  pauseSlides: 'Pause slides',
  playSlides: 'Play slides',
  previousSlides: 'Previous slides',
  nextSlides: 'Next slides',
  galleryLabel: 'Gallery',
  previousImage: 'Previous image',
  nextImage: 'Next image',
  showImage: (alt) => `Show ${alt}`,
  previewImage: (alt) => `Preview: ${alt}`,
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',

  chartView: 'Chart',
  tableView: 'Table',
  chartTotal: 'Total',
  chartOther: 'Other',
  chartCategory: 'Category',
  chartValue: 'Value',
  chartShare: 'Share',
  chartSeries: 'Series',
  chartX: 'X',
  chartY: 'Y',
  chartTypeBar: 'Bar chart',
  chartTypeStackedBar: 'Stacked bar chart',
  chartTypeLine: 'Line chart',
  chartTypeArea: 'Area chart',
  chartTypeDoughnut: 'Doughnut chart',
  chartTypePie: 'Pie chart',
  chartTypeRadar: 'Radar chart',
  chartTypePolarArea: 'Polar area chart',
  chartTypeScatter: 'Scatter chart',
  chartDescription: (kind, series, items, min, max) =>
    `${kind} with ${series} series and ${items} ${items === 1 ? 'item' : 'items'}, values from ${min} to ${max}. The same data is in the table.`,
  meterValue: (value, total) => `${value} of ${total}`,
  signaturePad: 'Signature',
  signatureArea: 'Signature drawing area, empty',
  signatureAreaSigned: 'Signature drawing area, signed',
  signatureHint: 'Draw with a mouse, a pen or a finger.',
  signatureTypedHint: 'Or choose Type to type your name.',
  clearSignature: 'Clear signature',
  undo: 'Undo',
  drawSignature: 'Draw',
  typeSignature: 'Type',
  typeYourName: 'Type your name',
  signatureCleared: 'Signature cleared',
  strokeUndone: 'Last stroke removed',
  mentionSuggestions: 'Suggestions',
  chatMessages: 'Messages',
  chatEmpty: 'No messages yet',
  message: 'Message',
  send: 'Send',
  messageFrom: (name, time) => `${name} at ${time}:`,
  newMessage: (name, text) => `New message from ${name}: ${text}`,
  messageSending: 'Sending',
  messageSent: 'Sent',
  messageNotSent: 'Not sent',
  isTyping: (name) => `${name} is typing`,
  areTyping: (names) => `${names} are typing`,
  aiPrompt: 'Prompt',
  aiPromptPlaceholder: 'Ask or describe what you need',
  promptSuggestions: 'Prompt suggestions',
  generate: 'Generate',
  aiResponses: 'Responses',
  aiGenerating: 'Generating',
  aiResponseReady: 'Response ready',
  aiResponseFailed: 'The response failed.',
  copy: 'Copy',
  copied: 'Copied',
  retry: 'Retry',
  stop: 'Stop',
  newMessages: (count) => `${count} new messages`,
  aiPromptShortcutHint: 'Press Control+Enter to send.',
  copyFailed: 'Copy failed',
  scheduler: 'Scheduler',
  schedulerView: 'View',
  viewDay: 'Day',
  viewWeek: 'Week',
  viewWorkWeek: 'Work week',
  viewMonth: 'Month',
  viewAgenda: 'Agenda',
  viewTimeline: 'Timeline',
  previousPeriod: 'Previous',
  nextPeriod: 'Next',
  allDay: 'All day',
  moreEvents: (count) => `+${count} more`,
  noEvents: 'No events',
  timeRange: (start, end) => `${start} to ${end}`,
  repeats: 'Repeats',
  eventMoveHint: 'Alt and the arrow keys move it, Alt, Shift and the arrow keys change its length.',
  eventMoved: (label, when) => `${label} moved to ${when}`,
  eventResized: (label, when) => `${label} now ${when}`,
  changeCanceled: 'Change canceled',
  currentTime: 'Current time',
  newEvent: 'New event',
  editEvent: 'Edit event',
  title: 'Title',
  start: 'Start',
  end: 'End',
  resource: 'Resource',
  save: 'Save',
  cancel: 'Cancel',
  deleteEvent: 'Delete event',
  endBeforeStart: 'The end must be after the start.',
  // Gantt
  ganttTasks: 'Tasks',
  name: 'Name',
  duration: 'Duration',
  progress: 'Progress',
  durationDays: (count) => `${count} ${count === 1 ? 'day' : 'days'}`,
  percentComplete: (value) => `${value} percent`,
  milestone: 'Milestone',
  summaryTask: 'Summary task',
  dependencyFS: 'Finish to start',
  dependencySS: 'Start to start',
  dependencyFF: 'Finish to finish',
  dependencySF: 'Start to finish',
  dependsOn: (label) => `Depends on ${label}`,
};

/** Parameter names of the function entries, in call order (used for `{{ name }}` in translations). */
export const STAR_UI_TEXT_PARAMS: { readonly [K in keyof StarUiText]?: readonly string[] } = {
  ofTotal: ['index', 'total'],
  expandItem: ['label'],
  collapseItem: ['label'],
  removeItem: ['label'],
  moreCount: ['count'],
  tagAdded: ['label'],
  tagRemoved: ['label'],
  tagInvalid: ['label'],
  tagDuplicate: ['label'],
  tagLimit: ['max'],
  selectedItems: ['count'],
  resultsAvailable: ['count'],
  addCustomValue: ['label'],
  page: ['page'],
  pageReport: ['first', 'last', 'total'],
  filterBy: ['column'],
  selectRowOf: ['label'],
  filterMin: ['column'],
  filterMax: ['column'],
  filterMenu: ['column'],
  filterMenuActive: ['column'],
  filterRule: ['index'],
  removeRule: ['index'],
  editCell: ['column'],
  valueMin: ['min'],
  valueMax: ['max'],
  resizeColumn: ['column'],
  moveColumnEarlier: ['column'],
  moveColumnLater: ['column'],
  itemPosition: ['label', 'position', 'total'],
  treeMovedBefore: ['label', 'target'],
  treeMovedAfter: ['label', 'target'],
  treeMovedInside: ['label', 'target'],
  treeMoveNotAllowed: ['label'],
  tileSize: ['label', 'columns', 'rows'],
  passwordRuleLength: ['min'],
  otpCharacter: ['position', 'total'],
  sliderMinimum: ['label'],
  sliderMaximum: ['label'],
  hexValue: ['label'],
  colorAreaValue: ['saturation', 'brightness'],
  hueValue: ['degrees'],
  fileMaxSize: ['size'],
  fileUpTo: ['count'],
  uploadingFile: ['name'],
  fileTypeNotAllowed: ['name'],
  fileTooLarge: ['name', 'max'],
  fileLimitReached: ['limit'],
  editorFormatting: ['label'],
  showImage: ['alt'],
  previewImage: ['alt'],
  meterValue: ['value', 'total'],
  chartDescription: ['kind', 'series', 'items', 'min', 'max'],
  messageFrom: ['name', 'time'],
  newMessage: ['name', 'text'],
  isTyping: ['name'],
  areTyping: ['names'],
  newMessages: ['count'],
  moreEvents: ['count'],
  timeRange: ['start', 'end'],
  eventMoved: ['label', 'when'],
  eventResized: ['label', 'when'],
  durationDays: ['count'],
  percentComplete: ['value'],
  dependsOn: ['label'],
};

export const STAR_UI_TEXT = new InjectionToken<StarUiText>('STAR_UI_TEXT', {
  providedIn: 'root',
  factory: () => STAR_UI_TEXT_DEFAULTS,
});

/** Overrides some or all built-in control texts with fixed values. */
export function provideStarUiText(overrides: Partial<StarUiText>): Provider {
  return { provide: STAR_UI_TEXT, useValue: { ...STAR_UI_TEXT_DEFAULTS, ...overrides } };
}

/**
 * Builds a `StarUiText` whose entries read `source()` on every access. When `source` reads a
 * signal, every OnPush control that renders a built-in text updates when that signal changes.
 * Entries that `source()` does not return fall back to the English default.
 *
 * Use it in a factory when the signal lives in a service:
 * `{ provide: STAR_UI_TEXT, useFactory: () => starUiTextFromSignal(inject(Language).text) }`.
 */
export function starUiTextFromSignal(source: () => Partial<StarUiText>): StarUiText {
  const text = {} as Record<string, unknown>;
  for (const name of Object.keys(STAR_UI_TEXT_DEFAULTS) as (keyof StarUiText)[]) {
    if (typeof STAR_UI_TEXT_DEFAULTS[name] === 'function') {
      text[name] = (...args: unknown[]) => {
        const entry = (source()[name] ?? STAR_UI_TEXT_DEFAULTS[name]) as (
          ...a: unknown[]
        ) => string;
        return entry(...args);
      };
    } else {
      Object.defineProperty(text, name, {
        enumerable: true,
        get: () => source()[name] ?? STAR_UI_TEXT_DEFAULTS[name],
      });
    }
  }
  return text as unknown as StarUiText;
}

/**
 * Provides the control texts from a function that reads a signal, so the language can change at
 * run time without a translation library:
 *
 * ```ts
 * const language = signal<'en' | 'de'>('en');
 * provideStarUiTextFromSignal(() => (language() === 'de' ? STAR_UI_TEXT_DE : STAR_UI_TEXT_DEFAULTS));
 * ```
 *
 * Do not spread a pack with getters into an object (`{ ...text }`): that reads every getter once and
 * freezes the result. Pass a function, as shown above.
 */
export function provideStarUiTextFromSignal(source: () => Partial<StarUiText>): Provider {
  return { provide: STAR_UI_TEXT, useFactory: () => starUiTextFromSignal(source) };
}
