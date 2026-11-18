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
  readonly clear: string;
  readonly loading: string;
  readonly actions: string;
  readonly moreActions: string;
  readonly bottomSheet: string;
  readonly ofTotal: (index: number, total: number) => string;
  readonly expandItem: (label: string) => string;
  readonly collapseItem: (label: string) => string;
  readonly removeItem: (label: string) => string;
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
  readonly filterBy: (column: string) => string;
  readonly filterAll: string;
  readonly filterMin: (column: string) => string;
  readonly filterMax: (column: string) => string;
  readonly filterMinShort: string;
  readonly filterMaxShort: string;
  readonly expandRow: string;
  readonly collapseRow: string;
  readonly rowDetails: string;
  readonly reorderRows: string;
  readonly sortMultiHint: string;
  readonly terminalCommand: string;
  readonly compareImages: string;
  readonly editCell: (column: string) => string;
  readonly columns: string;
  readonly resizeColumn: (column: string) => string;
  readonly moveColumnEarlier: (column: string) => string;
  readonly moveColumnLater: (column: string) => string;
  readonly layout: string;
  readonly layoutList: string;
  readonly layoutGrid: string;
  // Order list, pick list
  readonly moveSelectedItem: string;
  readonly orderListHint: string;
  readonly moveTop: string;
  readonly moveUp: string;
  readonly moveDown: string;
  readonly moveBottom: string;
  readonly itemPosition: (label: string, position: number, total: number) => string;
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
  readonly dayPeriod: string;
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
}

export const STAR_UI_TEXT_DEFAULTS: StarUiText = {
  close: 'Close',
  clear: 'Clear',
  loading: 'Loading',
  actions: 'Actions',
  moreActions: 'More actions',
  bottomSheet: 'Bottom sheet',
  ofTotal: (index, total) => `${index} of ${total}`,
  expandItem: (label) => `Expand ${label}`,
  collapseItem: (label) => `Collapse ${label}`,
  removeItem: (label) => `Remove ${label}`,
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
  filterBy: (column) => `Filter by ${column}`,
  filterAll: 'All',
  filterMin: (column) => `${column} from`,
  filterMax: (column) => `${column} to`,
  filterMinShort: 'Min',
  filterMaxShort: 'Max',
  expandRow: 'Expand row',
  collapseRow: 'Collapse row',
  rowDetails: 'Details',
  reorderRows: 'Order',
  sortMultiHint: 'Shift + click adds this column to the sort',
  terminalCommand: 'Command',
  compareImages: 'Compare images',
  editCell: (column) => `Edit ${column}`,
  columns: 'Columns',
  resizeColumn: (column) => `Resize ${column}`,
  moveColumnEarlier: (column) => `Move ${column} earlier`,
  moveColumnLater: (column) => `Move ${column} later`,
  layout: 'Layout',
  layoutList: 'List',
  layoutGrid: 'Grid',

  moveSelectedItem: 'Move selected item',
  orderListHint: 'Use Alt and the arrow keys to move the selected item.',
  moveTop: 'Move to top',
  moveUp: 'Move up',
  moveDown: 'Move down',
  moveBottom: 'Move to bottom',
  itemPosition: (label, position, total) => `${label}, position ${position} of ${total}`,
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
  dayPeriod: 'AM or PM',

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
};

/** Parameter names of the function entries, in call order (used for `{{ name }}` in translations). */
export const STAR_UI_TEXT_PARAMS: { readonly [K in keyof StarUiText]?: readonly string[] } = {
  ofTotal: ['index', 'total'],
  expandItem: ['label'],
  collapseItem: ['label'],
  removeItem: ['label'],
  tagAdded: ['label'],
  tagRemoved: ['label'],
  tagInvalid: ['label'],
  tagDuplicate: ['label'],
  tagLimit: ['max'],
  selectedItems: ['count'],
  resultsAvailable: ['count'],
  page: ['page'],
  pageReport: ['first', 'last', 'total'],
  filterBy: ['column'],
  filterMin: ['column'],
  filterMax: ['column'],
  editCell: ['column'],
  resizeColumn: ['column'],
  moveColumnEarlier: ['column'],
  moveColumnLater: ['column'],
  itemPosition: ['label', 'position', 'total'],
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
