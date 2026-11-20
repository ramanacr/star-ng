import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
  WritableSignal,
} from '@angular/core';
import {
  injectStarConfig,
  STAR_UI_TEXT,
  StarAnnouncer,
  StarClipboard,
  starInlineKey,
} from '@star-ng/ui/core';
import { StarToolbar } from '@star-ng/ui/layout';
import {
  starCellAddress,
  StarCellPosition,
  StarCellRange,
  starColumnName,
  starNormalizeRange,
  starRangeAddress,
  starRangeContains,
} from './formula/address';
import { StarFormulaEngine } from './formula/engine';
import { StarFormulaValue, starIsFormulaError, starNumberText } from './formula/evaluate';
import { starShiftFormula } from './formula/tokenizer';
import {
  StarCellBackground,
  StarCellFormat,
  StarCellNumberFormat,
  starCellsFromRows,
  starCellText,
  starDescribeFormula,
  starFillCells,
  starFormatCellValue,
  starFormatDelimited,
  starParseCellText,
  starParseDelimited,
  starSheetOffsets,
  starSheetWindow,
  StarSpreadsheetCell,
  StarSpreadsheetCells,
  StarSpreadsheetSheet,
  starUsedRange,
} from './sheet-model';

/** Selection of `star-spreadsheet`: the sheet, the active cell and the selected range. */
export interface StarSpreadsheetSelection {
  readonly sheet: string;
  /** Address of the active cell, for example `B3`. */
  readonly active: string;
  readonly range: StarCellRange;
  /** `A1:B5` text of the range (`A1` for one cell). */
  readonly address: string;
}

/** Options of `StarSpreadsheet.toCsv`. */
export interface StarSpreadsheetCsvOptions {
  /** Write formulas instead of their values (default false: the computed values). */
  readonly formulas?: boolean;
  /** Field delimiter (default `,`). */
  readonly delimiter?: string;
  /**
   * Prefix an apostrophe to text that starts with `=`, `+`, `-` or `@` (default true), so a
   * spreadsheet application that opens the file does not run it as a formula (CSV injection).
   * `fromCsv` reads the apostrophe back as text.
   */
  readonly escapeFormulas?: boolean;
}

/** Height of the column header row and width of the row header column, in pixels. */
const HEADER_HEIGHT = 28;
const ROW_HEADER_WIDTH = 48;
const UNDO_LIMIT = 100;
/** Changed cells above which a model change reloads the whole sheet in the engine. */
const RELOAD_LIMIT = 500;

interface Editing {
  readonly row: number;
  readonly col: number;
  readonly text: string;
  /** `enter`: started by typing, the arrow keys commit and move. `edit`: F2, Enter, double click. */
  readonly mode: 'enter' | 'edit';
  readonly source: 'cell' | 'bar';
}

interface UndoEntry {
  readonly index: number;
  readonly cells: StarSpreadsheetCells;
  readonly anchor: StarCellPosition;
  readonly focus: StarCellPosition;
}

/** What the last copy put on the clipboard, so a paste in the same sheet keeps the formulas. */
interface Copied {
  readonly text: string;
  readonly origin: StarCellPosition;
  readonly cells: readonly (readonly (StarSpreadsheetCell | undefined)[])[];
}

const FORMAT_TYPES: readonly StarCellNumberFormat[] = [
  'general',
  'number',
  'percent',
  'currency',
  'date',
];
const BACKGROUNDS: readonly StarCellBackground[] = [
  'accent',
  'success',
  'warning',
  'danger',
  'muted',
];

/**
 * Spreadsheet (Syncfusion `ejs-spreadsheet`, Kendo UI `kendo-spreadsheet`, DevExtreme has none
 * (its DataGrid is not a spreadsheet), Ignite UI `igx-spreadsheet` (Angular wrapper of a
 * licensed engine)): a grid of cells with column letters and row numbers, formulas with their own
 * engine (`starEvaluate`, no `eval`), formats, clipboard, fill handle, undo and redo.
 *
 * - `cells` (one sheet) or `sheets` (named sheets, with tabs) is a two-way model: every edit emits
 *   a new record. A change of the model from outside recalculates only the changed cells and their
 *   dependents.
 * - Rows and columns are windowed: only the cells in view (plus a few) are in the DOM, so
 *   `rows` and `columns` may be large. The header row and the row numbers stay in place.
 * - Keyboard: arrows move, Shift and the arrows select, typing replaces the cell, F2, Enter or a
 *   double click edit it, Enter and Tab commit and move, Escape cancels, Delete clears, Control+C,
 *   X and V copy, cut and paste tab-separated text (Excel and Google Sheets), Control+Z and
 *   Control+Y undo and redo, Control+D and Control+R fill down and right, Control+B and Control+I
 *   format, Alt+Shift and the arrows resize the column or the row of the active cell (8 px steps).
 * - `role="grid"` with `aria-rowcount`, `aria-colcount`, `aria-rowindex` and `aria-colindex`
 *   across the window; the active cell is the `aria-activedescendant` of the grid and is announced
 *   with its address, value and formula ("B3, 42, formula SUM of A1 to A5").
 * - The grid is always left to right, as in other spreadsheets; the toolbar and the sheet tabs
 *   follow the page direction.
 * - Not included: XLSX import and export, charts, merged cells, sorting and filtering. Known
 *   limits: empty function arguments, whole-column ranges (`A:A`) and `#N/A` are not parsed;
 *   Control+arrow moves to the edge of the sheet, not to the edge of the data; a range reader is
 *   found by a scan of all range formulas (fine for thousands of formulas, not tuned for more);
 *   pasted tab-separated text with an unbalanced quote reads to the end of the text.
 *
 * ```html
 * <star-spreadsheet [(cells)]="budget" [rows]="50" [columns]="8" />
 * ```
 */
@Component({
  selector: 'star-spreadsheet',
  imports: [StarToolbar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-spreadsheet',
    '[class.star-spreadsheet--readonly]': 'readonly()',
  },
  template: `
    @if (showToolbar() && !readonly()) {
      <star-toolbar class="star-spreadsheet__toolbar" [ariaLabel]="text.spreadsheetFormatting">
        <ng-container starToolbarStart>
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.undo"
            [disabled]="!canUndo()"
            (click)="undo()"
          >
            <i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.redo"
            [disabled]="!canRedo()"
            (click)="redo()"
          >
            <i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i>
          </button>
          <span class="star-spreadsheet__divider" aria-hidden="true"></span>
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.editorBold"
            [attr.aria-pressed]="!!activeFormat().bold"
            (click)="toggleStyle('bold')"
          >
            <i class="ph-bold ph-text-b" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.editorItalic"
            [attr.aria-pressed]="!!activeFormat().italic"
            (click)="toggleStyle('italic')"
          >
            <i class="ph-bold ph-text-italic" aria-hidden="true"></i>
          </button>
          @for (align of aligns; track align.value) {
            <button
              type="button"
              class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
              [attr.aria-label]="align.label()"
              [attr.aria-pressed]="activeFormat().align === align.value"
              (click)="setAlign(align.value)"
            >
              <i [class]="align.icon" aria-hidden="true"></i>
            </button>
          }
          <span class="star-spreadsheet__divider" aria-hidden="true"></span>
          <select
            class="star-spreadsheet__select"
            [attr.aria-label]="text.spreadsheetNumberFormat"
            (change)="setNumberFormat($any($event.target).value)"
          >
            @for (type of formatTypes; track type) {
              <option [value]="type" [selected]="(activeFormat().type ?? 'general') === type">
                {{ formatLabel(type) }}
              </option>
            }
          </select>
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.spreadsheetFewerDecimals"
            (click)="changeDecimals(-1)"
          >
            <i class="ph-bold ph-arrow-left" aria-hidden="true"></i
            ><span class="star-spreadsheet__decimals" data-glyph=".0" aria-hidden="true"></span>
          </button>
          <button
            type="button"
            class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
            [attr.aria-label]="text.spreadsheetMoreDecimals"
            (click)="changeDecimals(1)"
          >
            <span class="star-spreadsheet__decimals" data-glyph=".00" aria-hidden="true"></span>
          </button>
          <select
            class="star-spreadsheet__select"
            [attr.aria-label]="text.spreadsheetBackground"
            (change)="setBackground($any($event.target).value)"
          >
            <option value="" [selected]="!activeFormat().background">
              {{ text.spreadsheetNoBackground }}
            </option>
            @for (bg of backgrounds; track bg) {
              <option [value]="bg" [selected]="activeFormat().background === bg">
                {{ backgroundLabel(bg) }}
              </option>
            }
          </select>
        </ng-container>
      </star-toolbar>
    }
    @if (showFormulaBar()) {
      <div class="star-spreadsheet__bar">
        <span class="star-spreadsheet__name" aria-hidden="true">{{ activeAddress() }}</span>
        <span class="star-spreadsheet__fx" aria-hidden="true">fx</span>
        <input
          #bar
          class="star-spreadsheet__formula"
          type="text"
          spellcheck="false"
          autocomplete="off"
          [attr.aria-label]="text.spreadsheetFormulaBar + ', ' + activeAddress()"
          [readOnly]="readonly()"
          [value]="barText()"
          (focus)="onBarFocus()"
          (input)="onEditInput($event, 'bar')"
          (keydown)="onEditorKeydown($event)"
          (blur)="onEditorBlur('bar')"
        />
      </div>
    }
    <div
      class="star-spreadsheet__panel"
      [attr.role]="showTabs() ? 'tabpanel' : null"
      [attr.aria-labelledby]="showTabs() ? tabId(sheetIndex()) : null"
    >
      <div
        #viewport
        class="star-spreadsheet__viewport"
        dir="ltr"
        [style.height]="height()"
        (scroll)="onScroll()"
      >
        <div
          #grid
          class="star-spreadsheet__grid"
          role="grid"
          tabindex="0"
          aria-multiselectable="true"
          [attr.aria-label]="ariaLabel() ?? text.spreadsheet"
          [attr.aria-describedby]="hintId"
          [attr.aria-readonly]="readonly() || null"
          [attr.aria-rowcount]="rows() + 1"
          [attr.aria-colcount]="columns() + 1"
          [attr.aria-activedescendant]="activeDescendant()"
          [style.width.px]="totalWidth()"
          [style.height.px]="totalHeight()"
          (keydown)="onGridKeydown($event)"
          (pointerdown)="onGridPointerDown($event)"
          (pointerover)="onGridPointerOver($event)"
          (pointermove)="onGridPointerMove($event)"
          (dblclick)="onGridDblClick($event)"
          (copy)="onCopy($event, false)"
          (cut)="onCopy($event, true)"
          (paste)="onPaste($event)"
        >
          <div
            class="star-spreadsheet__row star-spreadsheet__row--head"
            role="row"
            aria-rowindex="1"
            [style.grid-template-columns]="columnTemplate()"
            [style.padding-left.px]="leadWidth()"
          >
            <div
              class="star-spreadsheet__corner"
              role="gridcell"
              aria-colindex="1"
              data-corner
              [attr.aria-label]="text.selectAll"
            ></div>
            @for (col of visibleColumns(); track col) {
              <div
                class="star-spreadsheet__colhead"
                role="columnheader"
                [attr.aria-colindex]="col + 2"
                [attr.data-colhead]="col"
                [class.star-spreadsheet__colhead--selected]="
                  col >= selection().left && col <= selection().right
                "
              >
                {{ columnName(col) }}
                @if (!readonly()) {
                  <span
                    class="star-spreadsheet__resizer star-spreadsheet__resizer--col"
                    aria-hidden="true"
                    (pointerdown)="startResize($event, 'col', col)"
                    (pointermove)="onResizeMove($event)"
                    (pointerup)="endResize($event)"
                    (pointercancel)="endResize($event)"
                  ></span>
                }
              </div>
            }
          </div>
          <div class="star-spreadsheet__body" [style.padding-top.px]="topHeight()">
            @for (row of visibleRows(); track row) {
              <div
                class="star-spreadsheet__row"
                role="row"
                [attr.aria-rowindex]="row + 2"
                [style.grid-template-columns]="columnTemplate()"
                [style.height.px]="rowHeight(row)"
                [style.padding-left.px]="leadWidth()"
              >
                <div
                  class="star-spreadsheet__rowhead"
                  role="rowheader"
                  aria-colindex="1"
                  [attr.data-rowhead]="row"
                  [class.star-spreadsheet__rowhead--selected]="
                    row >= selection().top && row <= selection().bottom
                  "
                >
                  {{ row + 1 }}
                  @if (!readonly()) {
                    <span
                      class="star-spreadsheet__resizer star-spreadsheet__resizer--row"
                      aria-hidden="true"
                      (pointerdown)="startResize($event, 'row', row)"
                      (pointermove)="onResizeMove($event)"
                      (pointerup)="endResize($event)"
                      (pointercancel)="endResize($event)"
                    ></span>
                  }
                </div>
                @for (col of visibleColumns(); track col) {
                  <div
                    role="gridcell"
                    [id]="cellId(row, col)"
                    [attr.aria-colindex]="col + 2"
                    [attr.aria-selected]="inSelection(row, col)"
                    [attr.data-row]="row"
                    [attr.data-col]="col"
                    [class]="cellClass(row, col)"
                  >
                    @if (isEditingCell(row, col)) {
                      <input
                        #editor
                        class="star-spreadsheet__editor"
                        type="text"
                        spellcheck="false"
                        autocomplete="off"
                        [attr.aria-label]="cellAddress(row, col)"
                        [value]="editing()!.text"
                        (input)="onEditInput($event, 'cell')"
                        (keydown)="onEditorKeydown($event)"
                        (blur)="onEditorBlur('cell')"
                      />
                    } @else {
                      {{ display(row, col) }}
                    }
                  </div>
                }
              </div>
            }
          </div>
          <div
            class="star-spreadsheet__selection"
            aria-hidden="true"
            [style.left.px]="rangeBox(selection()).left"
            [style.top.px]="rangeBox(selection()).top"
            [style.width.px]="rangeBox(selection()).width"
            [style.height.px]="rangeBox(selection()).height"
          >
            @if (!readonly()) {
              <span class="star-spreadsheet__fill" data-fill></span>
            }
          </div>
          @if (fillTarget(); as target) {
            <div
              class="star-spreadsheet__fill-target"
              aria-hidden="true"
              [style.left.px]="rangeBox(target).left"
              [style.top.px]="rangeBox(target).top"
              [style.width.px]="rangeBox(target).width"
              [style.height.px]="rangeBox(target).height"
            ></div>
          }
        </div>
      </div>
    </div>
    @if (showTabs()) {
      <div class="star-spreadsheet__tabs" role="tablist" [attr.aria-label]="text.spreadsheetSheets">
        @for (sheet of sheetList(); track $index; let i = $index) {
          <button
            type="button"
            role="tab"
            class="star-spreadsheet__tab"
            [id]="tabId(i)"
            [attr.aria-selected]="i === sheetIndex()"
            [attr.tabindex]="i === sheetIndex() ? 0 : -1"
            (click)="selectSheet(i)"
            (keydown)="onTabsKeydown($event)"
          >
            {{ sheet.name }}
          </button>
        }
      </div>
    }
    <p class="star-sr-only" [id]="hintId">{{ text.spreadsheetHint }}</p>
  `,
})
export class StarSpreadsheet {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly config = injectStarConfig();
  private readonly announcer = inject(StarAnnouncer);
  private readonly clipboard = inject(StarClipboard);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly ids = inject(_IdGenerator);

  /** Number of rows (default 100). */
  readonly rows = input(100, { transform: numberAttribute });
  /** Number of columns (default 26, A to Z). */
  readonly columns = input(26, { transform: numberAttribute });
  /** Cells of the sheet when `sheets` is empty. Two-way: each edit emits a new record. */
  readonly cells = model<StarSpreadsheetCells>({});
  /** Named sheets, shown as tabs. When it is not empty it replaces `cells` and `sheetName`. */
  readonly sheets = model<readonly StarSpreadsheetSheet[]>([]);
  /** Index of the shown sheet in `sheets`. */
  readonly activeSheet = model(0);
  /** Name of the sheet when `sheets` is empty (for references such as `Sheet1!A1`). */
  readonly sheetName = input('Sheet1');
  /** Column widths in pixels by column letter, for example `{ A: 160 }`. Resizing writes it. */
  readonly columnWidths = model<Readonly<Record<string, number>>>({});
  /** Row heights in pixels by row number, for example `{ '1': 36 }`. Resizing writes it. */
  readonly rowHeights = model<Readonly<Record<string, number>>>({});
  readonly defaultColumnWidth = input(96, { transform: numberAttribute });
  readonly defaultRowHeight = input(28, { transform: numberAttribute });
  /** No editing: selection, copy and navigation only. */
  readonly readonly = input(false, { transform: booleanAttribute });
  /** Shows the formatting toolbar (default true; hidden when read-only). */
  readonly showToolbar = input(true, { transform: booleanAttribute });
  /** Shows the formula bar with the address and the raw formula of the active cell. */
  readonly showFormulaBar = input(true, { transform: booleanAttribute });
  /** CSS height of the scrolling grid. */
  readonly height = input('24rem');
  /** BCP 47 locale of the number and date formats (default: `provideStarNg` locale, browser). */
  readonly locale = input<string | null>(null);
  /** Name of the grid (default: the UI text `spreadsheet`). */
  readonly ariaLabel = input<string | null>(null);

  /** Emits when the active cell or the selected range changes. */
  readonly selectionChange = output<StarSpreadsheetSelection>();

  /** @internal */
  readonly hintId = this.ids.getId('star-spreadsheet-hint-');
  private readonly idPrefix = this.ids.getId('star-spreadsheet-');

  private readonly viewport = viewChild.required<ElementRef<HTMLElement>>('viewport');
  private readonly grid = viewChild.required<ElementRef<HTMLElement>>('grid');
  private readonly editor = viewChild<ElementRef<HTMLInputElement>>('editor');
  private readonly bar = viewChild<ElementRef<HTMLInputElement>>('bar');

  protected readonly formatTypes = FORMAT_TYPES;
  protected readonly backgrounds = BACKGROUNDS;
  protected readonly aligns = [
    {
      value: 'start' as const,
      icon: 'ph-bold ph-text-align-left',
      label: () => this.text.editorAlignStart,
    },
    {
      value: 'center' as const,
      icon: 'ph-bold ph-text-align-center',
      label: () => this.text.editorAlignCenter,
    },
    {
      value: 'end' as const,
      icon: 'ph-bold ph-text-align-right',
      label: () => this.text.editorAlignEnd,
    },
  ];

  // State ------------------------------------------------------------------------------------

  /** The active cell; also the fixed corner of the selection. */
  protected readonly anchor = signal<StarCellPosition>({ row: 0, col: 0 });
  /** The moving corner of the selection (Shift and the arrows, a drag). */
  protected readonly focusCell = signal<StarCellPosition>({ row: 0, col: 0 });
  protected readonly editing = signal<Editing | null>(null);
  protected readonly fillTarget = signal<StarCellRange | null>(null);
  private readonly scrollTop = signal(0);
  private readonly scrollLeft = signal(0);
  private readonly viewWidth = signal(0);
  private readonly viewHeight = signal(0);
  private readonly undoStack = signal<readonly UndoEntry[]>([]);
  private readonly redoStack = signal<readonly UndoEntry[]>([]);
  private drag: 'select' | 'fill' | null = null;
  private resizing: { kind: 'col' | 'row'; index: number; start: number; size: number } | null =
    null;
  private copied: Copied | null = null;
  /** Removes the document listeners of a running drag (also on destroy). */
  private stopDrag: (() => void) | null = null;
  /** Set while a commit or cancel moves the focus, so the blur does not commit again. */
  private settling = false;

  private readonly engine = new StarFormulaEngine();
  private readonly synced = new Map<string, StarSpreadsheetCells>();
  private version = 0;

  protected readonly selection = computed(() =>
    starNormalizeRange(this.anchor(), this.focusCell()),
  );
  protected readonly activeAddress = computed(() =>
    starCellAddress(this.anchor().row, this.anchor().col),
  );
  protected readonly canUndo = computed(() => this.undoStack().length > 0);
  protected readonly canRedo = computed(() => this.redoStack().length > 0);

  /** The sheets, also when only `cells` is used. */
  protected readonly sheetList = computed<readonly StarSpreadsheetSheet[]>(() =>
    this.sheets().length ? this.sheets() : [{ name: this.sheetName(), cells: this.cells() }],
  );
  protected readonly showTabs = computed(() => this.sheets().length > 0);
  protected readonly sheetIndex = computed(() =>
    Math.min(Math.max(0, this.activeSheet()), this.sheetList().length - 1),
  );
  private readonly currentSheet = computed(() => this.sheetList()[this.sheetIndex()]);
  private readonly currentCells = computed(() => this.currentSheet().cells);

  /** Brings the engine up to date with the model; a new value after each change. */
  private readonly calc = computed(() => {
    const list = this.sheetList();
    const names = new Set(list.map((s) => s.name.toLowerCase()));
    for (const name of this.engine.sheetNames()) {
      if (!names.has(name.toLowerCase())) {
        this.engine.removeSheet(name);
        this.synced.delete(name.toLowerCase());
      }
    }
    for (const sheet of list) {
      const key = sheet.name.toLowerCase();
      const before = this.synced.get(key);
      if (before === sheet.cells) continue;
      if (!before || !this.engine.hasSheet(sheet.name)) {
        this.engine.setSheet(sheet.name, sheet.cells);
      } else {
        const changed = new Set<string>();
        for (const address of new Set([...Object.keys(before), ...Object.keys(sheet.cells)])) {
          const a = before[address];
          const b = sheet.cells[address];
          if (a?.formula !== b?.formula || a?.value !== b?.value) changed.add(address);
        }
        if (changed.size > RELOAD_LIMIT) this.engine.setSheet(sheet.name, sheet.cells);
        else
          for (const address of changed)
            this.engine.setCell(sheet.name, address, sheet.cells[address]);
      }
      this.synced.set(key, sheet.cells);
    }
    return ++this.version;
  });

  private readonly resolvedLocale = computed(
    () => this.locale() ?? this.config.locale ?? undefined,
  );

  // Layout -----------------------------------------------------------------------------------

  private readonly rowOffsets = computed(() => {
    const heights = this.rowHeights();
    const base = this.defaultRowHeight();
    return starSheetOffsets(this.rows(), (i) => heights[String(i + 1)] ?? base);
  });
  private readonly colOffsets = computed(() => {
    const widths = this.columnWidths();
    const base = this.defaultColumnWidth();
    return starSheetOffsets(this.columns(), (i) => widths[starColumnName(i)] ?? base);
  });
  private readonly rowWindow = computed(() =>
    starSheetWindow(
      this.rowOffsets(),
      this.scrollTop(),
      Math.max(0, (this.viewHeight() || 480) - HEADER_HEIGHT),
      4,
    ),
  );
  private readonly colWindow = computed(() =>
    starSheetWindow(
      this.colOffsets(),
      this.scrollLeft(),
      Math.max(0, (this.viewWidth() || 960) - ROW_HEADER_WIDTH),
      2,
    ),
  );
  protected readonly visibleRows = computed(() => range(this.rowWindow()));
  protected readonly visibleColumns = computed(() => range(this.colWindow()));
  protected readonly leadWidth = computed(() => this.colOffsets()[this.colWindow().start]);
  protected readonly topHeight = computed(() => this.rowOffsets()[this.rowWindow().start]);
  protected readonly totalWidth = computed(
    () => ROW_HEADER_WIDTH + this.colOffsets()[this.columns()],
  );
  protected readonly totalHeight = computed(() => HEADER_HEIGHT + this.rowOffsets()[this.rows()]);
  protected readonly columnTemplate = computed(() => {
    const offsets = this.colOffsets();
    return [
      `${ROW_HEADER_WIDTH}px`,
      ...this.visibleColumns().map((c) => `${offsets[c + 1] - offsets[c]}px`),
    ].join(' ');
  });
  /** Id of the active cell when it is rendered (an id must point at an element). */
  protected readonly activeDescendant = computed(() => {
    const { row, col } = this.anchor();
    const rows = this.rowWindow();
    const cols = this.colWindow();
    if (this.editing()) return null;
    return row >= rows.start && row < rows.end && col >= cols.start && col < cols.end
      ? this.cellId(row, col)
      : null;
  });

  protected readonly activeCell = computed(
    () => this.currentCells()[starCellAddress(this.anchor().row, this.anchor().col)],
  );
  protected readonly activeFormat = computed<StarCellFormat>(() => this.activeCell()?.format ?? {});
  protected readonly barText = computed(() => {
    const editing = this.editing();
    return editing ? editing.text : starCellText(this.activeCell());
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopDrag?.());
    afterNextRender(() => {
      const element = this.viewport().nativeElement;
      const measure = (): void => {
        this.viewWidth.set(element.clientWidth);
        this.viewHeight.set(element.clientHeight);
      };
      measure();
      const view = this.document.defaultView;
      if (view && 'ResizeObserver' in view) {
        const observer = new view.ResizeObserver(measure);
        observer.observe(element);
        this.injector.get(DestroyRef).onDestroy(() => observer.disconnect());
      }
    });
  }

  // Public API -------------------------------------------------------------------------------

  /** The computed value of a cell of the shown sheet (or of `sheet`). */
  value(address: string, sheet?: string): StarFormulaValue {
    this.calc();
    return this.engine.value(sheet ?? this.currentSheet().name, address);
  }

  /** The shown sheet as CSV (RFC 4180): computed values, or formulas with `{ formulas: true }`. */
  toCsv(options: StarSpreadsheetCsvOptions = {}): string {
    const cells = this.currentCells();
    const used = starUsedRange(cells);
    if (!used) return '';
    const rows: string[][] = [];
    for (let r = 0; r <= used.bottom; r++) {
      const row: string[] = [];
      for (let c = 0; c <= used.right; c++) {
        row.push(this.cellExportText(r, c, !!options.formulas, options.escapeFormulas ?? true));
      }
      rows.push(row);
    }
    return starFormatDelimited(rows, options.delimiter ?? ',');
  }

  /**
   * Replaces the cells of the shown sheet with CSV text (RFC 4180). Fields that start with `=`
   * become formulas, numbers and TRUE or FALSE are typed. Can be undone.
   */
  fromCsv(text: string, delimiter = ','): void {
    const cells = starCellsFromRows(starParseDelimited(text, delimiter));
    this.update(() => cells);
  }

  /** All sheets as JSON text: `{ "sheets": [{ "name", "cells" }] }`. */
  toJson(): string {
    return JSON.stringify({
      sheets: this.sheetList().map((s) => ({ name: s.name, cells: s.cells })),
    });
  }

  /** Copies the selected range as tab-separated text through `StarClipboard`. */
  async copySelection(): Promise<boolean> {
    return this.clipboard.copy(this.rememberCopy().text);
  }

  /** Pastes tab-separated text at the active cell, as Control+V does. */
  paste(text: string): void {
    this.pasteText(text);
  }

  undo(): void {
    this.history(this.undoStack, this.redoStack);
  }

  redo(): void {
    this.history(this.redoStack, this.undoStack);
  }

  /** Selects a range (zero-based corners) and makes `from` the active cell. */
  select(from: StarCellPosition, to: StarCellPosition = from): void {
    this.anchor.set(this.clamp(from));
    this.focusCell.set(this.clamp(to));
    this.reveal(this.focusCell());
    this.emitSelection();
  }

  // Template helpers -------------------------------------------------------------------------

  protected columnName(col: number): string {
    return starColumnName(col);
  }

  protected cellAddress(row: number, col: number): string {
    return starCellAddress(row, col);
  }

  protected cellId(row: number, col: number): string {
    return `${this.idPrefix}-${row}-${col}`;
  }

  protected tabId(index: number): string {
    return `${this.idPrefix}-tab-${index}`;
  }

  protected rowHeight(row: number): number {
    const offsets = this.rowOffsets();
    return offsets[row + 1] - offsets[row];
  }

  protected inSelection(row: number, col: number): boolean {
    return starRangeContains(this.selection(), row, col);
  }

  protected isEditingCell(row: number, col: number): boolean {
    const editing = this.editing();
    return !!editing && editing.source === 'cell' && editing.row === row && editing.col === col;
  }

  protected display(row: number, col: number): string {
    this.calc();
    const address = starCellAddress(row, col);
    const value = this.engine.value(this.currentSheet().name, address);
    return starFormatCellValue(value, this.currentCells()[address]?.format, this.resolvedLocale());
  }

  protected cellClass(row: number, col: number): string {
    this.calc();
    const address = starCellAddress(row, col);
    const cell = this.currentCells()[address];
    const format = cell?.format;
    const value = this.engine.value(this.currentSheet().name, address);
    const align =
      format?.align ??
      (typeof value === 'number' ? 'end' : typeof value === 'boolean' ? 'center' : 'start');
    const anchor = this.anchor();
    return [
      'star-spreadsheet__cell',
      `star-spreadsheet__cell--${align}`,
      format?.bold ? 'star-spreadsheet__cell--bold' : '',
      format?.italic ? 'star-spreadsheet__cell--italic' : '',
      format?.background ? `star-spreadsheet__cell--bg-${format.background}` : '',
      starIsFormulaError(value) ? 'star-spreadsheet__cell--error' : '',
      anchor.row === row && anchor.col === col ? 'star-spreadsheet__cell--active' : '',
      this.inSelection(row, col) ? 'star-spreadsheet__cell--selected' : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** Position and size of a range in grid pixels. */
  protected rangeBox(r: StarCellRange): {
    left: number;
    top: number;
    width: number;
    height: number;
  } {
    const cols = this.colOffsets();
    const rows = this.rowOffsets();
    return {
      left: ROW_HEADER_WIDTH + cols[r.left],
      top: HEADER_HEIGHT + rows[r.top],
      width: cols[r.right + 1] - cols[r.left],
      height: rows[r.bottom + 1] - rows[r.top],
    };
  }

  protected formatLabel(type: StarCellNumberFormat): string {
    const t = this.text;
    return {
      general: t.spreadsheetFormatGeneral,
      number: t.spreadsheetFormatNumber,
      percent: t.spreadsheetFormatPercent,
      currency: t.spreadsheetFormatCurrency,
      date: t.spreadsheetFormatDate,
    }[type];
  }

  protected backgroundLabel(bg: StarCellBackground): string {
    const t = this.text;
    return {
      accent: t.colorBlue,
      success: t.colorGreen,
      warning: t.colorAmber,
      danger: t.colorRed,
      muted: t.colorGrey,
    }[bg];
  }

  // Scrolling --------------------------------------------------------------------------------

  protected onScroll(): void {
    const element = this.viewport().nativeElement;
    this.scrollTop.set(element.scrollTop);
    this.scrollLeft.set(element.scrollLeft);
  }

  /** Scrolls the cell into view (below the header row, right of the row numbers). */
  private reveal(pos: StarCellPosition): void {
    const element = this.viewport().nativeElement;
    const rows = this.rowOffsets();
    const cols = this.colOffsets();
    const viewH = Math.max(0, (element.clientHeight || this.viewHeight()) - HEADER_HEIGHT);
    const viewW = Math.max(0, (element.clientWidth || this.viewWidth()) - ROW_HEADER_WIDTH);
    let top = element.scrollTop;
    let left = element.scrollLeft;
    if (rows[pos.row] < top) top = rows[pos.row];
    else if (viewH && rows[pos.row + 1] > top + viewH) top = rows[pos.row + 1] - viewH;
    if (cols[pos.col] < left) left = cols[pos.col];
    else if (viewW && cols[pos.col + 1] > left + viewW) left = cols[pos.col + 1] - viewW;
    if (top !== element.scrollTop) element.scrollTop = top;
    if (left !== element.scrollLeft) element.scrollLeft = left;
    // Update the window now: the scroll event comes later, and the active cell must render.
    this.scrollTop.set(top);
    this.scrollLeft.set(left);
  }

  // Selection and keyboard -------------------------------------------------------------------

  private clamp(pos: StarCellPosition): StarCellPosition {
    return {
      row: Math.min(Math.max(0, pos.row), this.rows() - 1),
      col: Math.min(Math.max(0, pos.col), this.columns() - 1),
    };
  }

  private moveTo(pos: StarCellPosition, extend: boolean): void {
    const target = this.clamp(pos);
    if (extend) this.focusCell.set(target);
    else {
      this.anchor.set(target);
      this.focusCell.set(target);
    }
    this.reveal(target);
    this.emitSelection();
    if (extend) {
      this.announcer.announce(
        this.text.spreadsheetSelected(this.rangeSpeech(this.selection())),
        'polite',
      );
    } else this.announceActive();
  }

  private rangeSpeech(r: StarCellRange): string {
    const from = starCellAddress(r.top, r.left);
    const to = starCellAddress(r.bottom, r.right);
    return from === to ? from : this.text.spreadsheetRange(from, to);
  }

  private emitSelection(): void {
    const sel = this.selection();
    this.selectionChange.emit({
      sheet: this.currentSheet().name,
      active: this.activeAddress(),
      range: sel,
      address: starRangeAddress(sel),
    });
  }

  /** Announces the active cell: address, value and formula. */
  private announceActive(): void {
    const { row, col } = this.anchor();
    const cell = this.currentCells()[starCellAddress(row, col)];
    const shown = this.display(row, col);
    const formula = cell?.formula
      ? starDescribeFormula(cell.formula, {
          call: (name, args) => this.text.spreadsheetFunction(name, args),
          range: (from, to) => this.text.spreadsheetRange(from, to),
        })
      : '';
    this.announcer.announce(
      this.text.spreadsheetCellInfo(
        starCellAddress(row, col),
        shown === '' ? this.text.spreadsheetBlank : shown,
        formula,
      ),
      'polite',
    );
  }

  protected onGridKeydown(event: KeyboardEvent): void {
    if (event.target !== this.grid().nativeElement) return;
    const editing = this.editing();
    if (editing) {
      // Keys typed before the cell editor has the focus (fast typing) still go into the edit.
      if (editing.source !== 'cell') return;
      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        this.editing.set({ ...editing, text: editing.text + event.key });
      } else this.onEditorKeydown(event);
      return;
    }
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const anchor = this.anchor();
    const focus = shift ? this.focusCell() : anchor;
    const key = event.key;
    const editable = !this.readonly();
    const done = (): void => event.preventDefault();

    if (ctrl && !event.altKey) {
      switch (key.toLowerCase()) {
        case 'z':
          if (editable && shift) this.redo();
          else if (editable) this.undo();
          return done();
        case 'y':
          if (editable) this.redo();
          return done();
        case 'a':
          this.anchor.set({ row: 0, col: 0 });
          this.focusCell.set({ row: this.rows() - 1, col: this.columns() - 1 });
          this.emitSelection();
          return done();
        case 'b':
          if (editable) this.toggleStyle('bold');
          return done();
        case 'i':
          if (editable) this.toggleStyle('italic');
          return done();
        case 'd':
          if (editable) this.fillFromEdge('down');
          return done();
        case 'r':
          if (editable) this.fillFromEdge('right');
          return done();
        case ' ':
          this.anchor.set({ row: 0, col: anchor.col });
          this.focusCell.set({ row: this.rows() - 1, col: this.selection().right });
          this.emitSelection();
          return done();
        case 'home':
          this.moveTo({ row: 0, col: 0 }, shift);
          return done();
        case 'end': {
          const used = starUsedRange(this.currentCells());
          this.moveTo({ row: used?.bottom ?? 0, col: used?.right ?? 0 }, shift);
          return done();
        }
        case 'arrowup':
          this.moveTo({ row: 0, col: focus.col }, shift);
          return done();
        case 'arrowdown':
          this.moveTo({ row: this.rows() - 1, col: focus.col }, shift);
          return done();
        case 'arrowleft':
          this.moveTo({ row: focus.row, col: 0 }, shift);
          return done();
        case 'arrowright':
          this.moveTo({ row: focus.row, col: this.columns() - 1 }, shift);
          return done();
      }
      return;
    }
    if (event.altKey && shift && key.startsWith('Arrow')) {
      if (editable) this.resizeByKey(key);
      return done();
    }
    if (event.altKey) return;
    const page = Math.max(1, this.visibleRows().length - 9);
    switch (key) {
      case 'ArrowUp':
        this.moveTo({ row: focus.row - 1, col: focus.col }, shift);
        return done();
      case 'ArrowDown':
        this.moveTo({ row: focus.row + 1, col: focus.col }, shift);
        return done();
      case 'ArrowLeft':
        this.moveTo({ row: focus.row, col: focus.col - 1 }, shift);
        return done();
      case 'ArrowRight':
        this.moveTo({ row: focus.row, col: focus.col + 1 }, shift);
        return done();
      case 'Home':
        this.moveTo({ row: focus.row, col: 0 }, shift);
        return done();
      case 'End':
        this.moveTo({ row: focus.row, col: this.columns() - 1 }, shift);
        return done();
      case 'PageDown':
        this.moveTo({ row: focus.row + page, col: focus.col }, shift);
        return done();
      case 'PageUp':
        this.moveTo({ row: focus.row - page, col: focus.col }, shift);
        return done();
      case 'Tab': {
        const col = anchor.col + (shift ? -1 : 1);
        if (col < 0 || col >= this.columns()) return; // leave the grid
        this.moveTo({ row: anchor.row, col }, false);
        return done();
      }
      case 'Enter':
      case 'F2':
        if (editable) this.startEdit('edit');
        return done();
      case 'Delete':
      case 'Backspace':
        if (editable) this.clearSelection();
        return done();
      case 'Escape': {
        // Consume the key only when it clears something; otherwise it goes on, for example to
        // close a modal dialog around the spreadsheet.
        const cell = this.focusCell();
        const changed = !!this.fillTarget() || cell.row !== anchor.row || cell.col !== anchor.col;
        if (this.fillTarget()) this.fillTarget.set(null);
        this.focusCell.set(anchor);
        if (changed) done();
        return;
      }
      case ' ':
        if (shift) {
          this.anchor.set({ row: anchor.row, col: 0 });
          this.focusCell.set({ row: this.selection().bottom, col: this.columns() - 1 });
          this.emitSelection();
          return done();
        }
        break;
    }
    if (editable && key.length === 1 && !ctrl) {
      this.startEdit('enter', key);
      done();
    }
  }

  // Pointer ----------------------------------------------------------------------------------

  private cellFrom(target: EventTarget | null): StarCellPosition | null {
    const element = (target as Element | null)?.closest?.('[data-row]');
    if (!element) return null;
    return {
      row: Number(element.getAttribute('data-row')),
      col: Number(element.getAttribute('data-col')),
    };
  }

  protected onGridPointerDown(event: PointerEvent): void {
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (target.closest('.star-spreadsheet__editor, .star-spreadsheet__resizer')) return;
    if (this.editing()) this.commit(null, false);
    const grid = this.grid().nativeElement;
    if (target.closest('[data-fill]')) {
      event.preventDefault();
      grid.focus({ preventScroll: true });
      this.drag = 'fill';
      this.capture(event);
      this.listenPointerUp();
      return;
    }
    const colHead = target.closest('[data-colhead]');
    const rowHead = target.closest('[data-rowhead]');
    let handled = true;
    if (target.closest('[data-corner]')) {
      this.anchor.set({ row: 0, col: 0 });
      this.focusCell.set({ row: this.rows() - 1, col: this.columns() - 1 });
    } else if (colHead) {
      const col = Number(colHead.getAttribute('data-colhead'));
      if (!event.shiftKey) this.anchor.set({ row: 0, col });
      this.focusCell.set({ row: this.rows() - 1, col });
    } else if (rowHead) {
      const row = Number(rowHead.getAttribute('data-rowhead'));
      if (!event.shiftKey) this.anchor.set({ row, col: 0 });
      this.focusCell.set({ row, col: this.columns() - 1 });
    } else {
      const cell = this.cellFrom(target);
      if (!cell) handled = false;
      else {
        // A touch on a selected cell drags (those cells have touch-action: none); a touch on
        // another cell selects it and leaves the finger free to scroll the sheet.
        const drags = event.pointerType !== 'touch' || this.inSelection(cell.row, cell.col);
        if (event.shiftKey) this.focusCell.set(cell);
        else {
          this.anchor.set(cell);
          this.focusCell.set(cell);
        }
        if (drags) {
          this.drag = 'select';
          this.capture(event);
          this.listenPointerUp();
        }
      }
    }
    if (!handled) return;
    event.preventDefault();
    grid.focus({ preventScroll: true });
    this.emitSelection();
    this.announceActive();
  }

  /** Keeps the pointer events on the grid during a drag, also outside the window. */
  private capture(event: PointerEvent): void {
    try {
      this.grid().nativeElement.setPointerCapture?.(event.pointerId);
    } catch {
      // No active pointer with that id (synthetic events): pointerover still tracks the drag.
    }
  }

  /** With pointer capture the grid gets every move: find the cell under the pointer. */
  protected onGridPointerMove(event: PointerEvent): void {
    if (!this.drag) return;
    const grid = this.grid().nativeElement;
    if (!grid.hasPointerCapture?.(event.pointerId)) return;
    this.dragOver(this.document.elementFromPoint?.(event.clientX, event.clientY) ?? null);
  }

  protected onGridPointerOver(event: PointerEvent): void {
    this.dragOver(event.target as Element | null);
  }

  private dragOver(target: Element | null): void {
    if (!this.drag) return;
    const cell = this.cellFrom(target);
    if (!cell) return;
    if (this.drag === 'select') {
      this.focusCell.set(cell);
      return;
    }
    const s = this.selection();
    const below = cell.row - s.bottom;
    const above = s.top - cell.row;
    const after = cell.col - s.right;
    const before = s.left - cell.col;
    const vertical = Math.max(below, above);
    const horizontal = Math.max(after, before);
    if (vertical <= 0 && horizontal <= 0) this.fillTarget.set(null);
    else if (vertical >= horizontal) {
      this.fillTarget.set(below > 0 ? { ...s, bottom: cell.row } : { ...s, top: cell.row });
    } else {
      this.fillTarget.set(after > 0 ? { ...s, right: cell.col } : { ...s, left: cell.col });
    }
  }

  private listenPointerUp(): void {
    this.stopDrag?.();
    const remove = (): void => {
      this.document.removeEventListener('pointerup', up);
      this.document.removeEventListener('pointercancel', up);
      this.stopDrag = null;
    };
    const up = (event: Event): void => {
      remove();
      const id = (event as PointerEvent).pointerId;
      const grid = this.grid().nativeElement;
      if (id !== undefined && grid.hasPointerCapture?.(id)) grid.releasePointerCapture(id);
      const mode = this.drag;
      this.drag = null;
      if (mode === 'fill') {
        const target = this.fillTarget();
        this.fillTarget.set(null);
        if (target) this.fill(this.selection(), target);
      } else if (mode === 'select') this.emitSelection();
    };
    this.document.addEventListener('pointerup', up);
    this.document.addEventListener('pointercancel', up);
    this.stopDrag = () => {
      remove();
      this.drag = null;
    };
  }

  protected onGridDblClick(event: MouseEvent): void {
    if (this.readonly() || !this.cellFrom(event.target)) return;
    this.startEdit('edit');
  }

  protected startResize(event: PointerEvent, kind: 'col' | 'row', index: number): void {
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget as HTMLElement;
    element.setPointerCapture?.(event.pointerId);
    const size =
      kind === 'col'
        ? this.colOffsets()[index + 1] - this.colOffsets()[index]
        : this.rowHeight(index);
    this.resizing = { kind, index, start: kind === 'col' ? event.clientX : event.clientY, size };
  }

  protected onResizeMove(event: PointerEvent): void {
    const r = this.resizing;
    if (!r) return;
    const delta = (r.kind === 'col' ? event.clientX : event.clientY) - r.start;
    const size = Math.round(Math.max(r.kind === 'col' ? 24 : 16, r.size + delta));
    if (r.kind === 'col') {
      this.columnWidths.update((w) => ({ ...w, [starColumnName(r.index)]: size }));
    } else {
      this.rowHeights.update((h) => ({ ...h, [String(r.index + 1)]: size }));
    }
  }

  /** Alt+Shift+arrow: the column (left, right) or the row (up, down) of the active cell, by 8 px. */
  private resizeByKey(key: string): void {
    const { row, col } = this.anchor();
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const offsets = this.colOffsets();
      const size = Math.max(24, offsets[col + 1] - offsets[col] + (key === 'ArrowRight' ? 8 : -8));
      const name = starColumnName(col);
      this.columnWidths.update((w) => ({ ...w, [name]: size }));
      this.announcer.announce(this.text.spreadsheetColumnWidth(name, size), 'polite');
    } else {
      const size = Math.max(16, this.rowHeight(row) + (key === 'ArrowDown' ? 8 : -8));
      this.rowHeights.update((h) => ({ ...h, [String(row + 1)]: size }));
      this.announcer.announce(this.text.spreadsheetRowHeight(row + 1, size), 'polite');
    }
  }

  protected endResize(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.resizing = null;
  }

  // Editing ----------------------------------------------------------------------------------

  private startEdit(mode: 'enter' | 'edit', text?: string): void {
    const { row, col } = this.anchor();
    this.focusCell.set(this.anchor());
    this.reveal({ row, col });
    this.editing.set({
      row,
      col,
      text: text ?? starCellText(this.activeCell()),
      mode,
      source: 'cell',
    });
    this.announcer.announce(this.text.spreadsheetEditing(starCellAddress(row, col)), 'polite');
    afterNextRender(
      () => {
        const input = this.editor()?.nativeElement;
        if (!input) return;
        input.focus();
        const end = input.value.length;
        input.setSelectionRange(end, end);
      },
      { injector: this.injector },
    );
  }

  protected onBarFocus(): void {
    if (this.readonly() || this.editing()) return;
    const { row, col } = this.anchor();
    this.editing.set({
      row,
      col,
      text: starCellText(this.activeCell()),
      mode: 'edit',
      source: 'bar',
    });
  }

  protected onEditInput(event: Event, source: 'cell' | 'bar'): void {
    const text = (event.target as HTMLInputElement).value;
    this.editing.update((e) => (e ? { ...e, text, source } : e));
  }

  protected onEditorKeydown(event: KeyboardEvent): void {
    const editing = this.editing();
    if (!editing) return;
    event.stopPropagation();
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.commit([event.shiftKey ? -1 : 1, 0]);
        return;
      case 'Tab':
        event.preventDefault();
        this.commit([0, event.shiftKey ? -1 : 1]);
        return;
      case 'Escape':
        event.preventDefault();
        this.cancel();
        return;
    }
    if (editing.mode === 'enter' && editing.source === 'cell') {
      const move = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      }[event.key] as [number, number] | undefined;
      if (move) {
        event.preventDefault();
        this.commit(move);
      }
    }
  }

  protected onEditorBlur(source: 'cell' | 'bar'): void {
    if (this.settling) return;
    const editing = this.editing();
    if (editing && editing.source === source) this.commit(null, false);
  }

  /** Writes the edited text, optionally moves, and gives the focus back to the grid. */
  private commit(move: [number, number] | null, focusGrid = true): void {
    const editing = this.editing();
    if (!editing) return;
    this.settling = true;
    this.editing.set(null);
    this.writeCell(editing.row, editing.col, editing.text);
    if (move) this.moveTo({ row: editing.row + move[0], col: editing.col + move[1] }, false);
    if (focusGrid) this.grid().nativeElement.focus({ preventScroll: true });
    this.settling = false;
  }

  private cancel(): void {
    this.settling = true;
    this.editing.set(null);
    this.grid().nativeElement.focus({ preventScroll: true });
    this.settling = false;
    this.announceActive();
  }

  private writeCell(row: number, col: number, text: string): void {
    const address = starCellAddress(row, col);
    this.update((cells) => {
      const old = cells[address];
      if (starCellText(old) === text) return cells;
      const parsed = starParseCellText(text);
      const next = { ...cells };
      if (parsed || old?.format)
        next[address] = { ...parsed, ...(old?.format ? { format: old.format } : {}) };
      else delete next[address];
      return next;
    });
  }

  /** Applies a change to the cells of the shown sheet, with an undo entry. */
  private update(change: (cells: StarSpreadsheetCells) => StarSpreadsheetCells): void {
    if (this.readonly()) return;
    const index = this.sheetIndex();
    const before = untracked(this.currentCells);
    const after = change(before);
    if (after === before) return;
    this.undoStack.update((stack) =>
      [...stack, { index, cells: before, anchor: this.anchor(), focus: this.focusCell() }].slice(
        -UNDO_LIMIT,
      ),
    );
    this.redoStack.set([]);
    this.apply(index, after);
  }

  private apply(index: number, cells: StarSpreadsheetCells): void {
    if (this.sheets().length) {
      this.sheets.update((sheets) => sheets.map((s, i) => (i === index ? { ...s, cells } : s)));
    } else this.cells.set(cells);
  }

  private history(
    from: WritableSignal<readonly UndoEntry[]>,
    to: WritableSignal<readonly UndoEntry[]>,
  ): void {
    const stack = from();
    const entry = stack[stack.length - 1];
    if (!entry || this.readonly()) return;
    const current = this.sheetList()[entry.index]?.cells ?? {};
    from.set(stack.slice(0, -1));
    to.update((s) => [
      ...s,
      { index: entry.index, cells: current, anchor: this.anchor(), focus: this.focusCell() },
    ]);
    this.apply(entry.index, entry.cells);
    if (this.sheets().length) this.activeSheet.set(entry.index);
    this.anchor.set(this.clamp(entry.anchor));
    this.focusCell.set(this.clamp(entry.focus));
    this.announcer.announce(
      from === this.undoStack ? this.text.editUndone : this.text.editRedone,
      'polite',
    );
  }

  private clearSelection(): void {
    const sel = this.selection();
    this.update((cells) => {
      let next: Record<string, StarSpreadsheetCell> | null = null;
      for (const address of Object.keys(cells)) {
        const cell = cells[address];
        if (!this.inRange(address, sel) || (cell.value === undefined && !cell.formula)) continue;
        next ??= { ...cells };
        if (cell.format) next[address] = { format: cell.format };
        else delete next[address];
      }
      return next ?? cells;
    });
    this.announcer.announce(this.text.spreadsheetCleared(this.rangeSpeech(sel)), 'polite');
  }

  private inRange(address: string, r: StarCellRange): boolean {
    const match = /^([A-Z]+)(\d+)$/.exec(address);
    if (!match) return false;
    let col = 0;
    for (const ch of match[1]) col = col * 26 + ch.charCodeAt(0) - 64;
    return starRangeContains(r, Number(match[2]) - 1, col - 1);
  }

  // Formats ----------------------------------------------------------------------------------

  private formatSelection(change: (format: StarCellFormat) => StarCellFormat): void {
    const sel = this.selection();
    this.update((cells) => {
      const next = { ...cells };
      for (let r = sel.top; r <= sel.bottom; r++) {
        for (let c = sel.left; c <= sel.right; c++) {
          const address = starCellAddress(r, c);
          const cell = next[address];
          const format = clean(change(cell?.format ?? {}));
          const rest = { ...cell };
          delete (rest as { format?: StarCellFormat }).format;
          if (format) next[address] = { ...rest, format };
          else if (rest.value !== undefined || rest.formula) next[address] = rest;
          else delete next[address];
        }
      }
      return next;
    });
  }

  protected toggleStyle(style: 'bold' | 'italic'): void {
    const on = !this.activeFormat()[style];
    this.formatSelection((f) => ({ ...f, [style]: on || undefined }));
  }

  protected setAlign(align: 'start' | 'center' | 'end'): void {
    const same = this.activeFormat().align === align;
    this.formatSelection((f) => ({ ...f, align: same ? undefined : align }));
  }

  protected setNumberFormat(type: StarCellNumberFormat): void {
    this.formatSelection((f) => ({
      ...f,
      type: type === 'general' ? undefined : type,
      decimals: undefined,
    }));
    this.grid().nativeElement.focus({ preventScroll: true });
  }

  protected changeDecimals(step: number): void {
    this.formatSelection((f) => {
      const type = f.type && f.type !== 'general' && f.type !== 'date' ? f.type : 'number';
      const base = f.decimals ?? (type === 'percent' ? 0 : 2);
      return { ...f, type, decimals: Math.min(10, Math.max(0, base + step)) };
    });
  }

  protected setBackground(value: string): void {
    const background = (BACKGROUNDS as readonly string[]).includes(value)
      ? (value as StarCellBackground)
      : undefined;
    this.formatSelection((f) => ({ ...f, background }));
    this.grid().nativeElement.focus({ preventScroll: true });
  }

  // Fill -------------------------------------------------------------------------------------

  private fill(source: StarCellRange, target: StarCellRange): void {
    if (this.readonly()) return;
    this.update((cells) => starFillCells(cells, source, target));
    this.anchor.set({ row: target.top, col: target.left });
    this.focusCell.set({ row: target.bottom, col: target.right });
    this.emitSelection();
    this.announcer.announce(this.text.spreadsheetFilled(this.rangeSpeech(target)), 'polite');
  }

  /** Control+D and Control+R: copy the first row (or column) of the selection over the rest. */
  private fillFromEdge(direction: 'down' | 'right'): void {
    const s = this.selection();
    if (direction === 'down') {
      const top = s.top === s.bottom ? Math.max(0, s.top - 1) : s.top;
      this.fill({ ...s, top, bottom: top }, { ...s, top });
    } else {
      const left = s.left === s.right ? Math.max(0, s.left - 1) : s.left;
      this.fill({ ...s, left, right: left }, { ...s, left });
    }
  }

  // Clipboard --------------------------------------------------------------------------------

  private cellExportText(row: number, col: number, formulas: boolean, escape = false): string {
    const address = starCellAddress(row, col);
    const cell = this.currentCells()[address];
    // Text that starts like a formula gets an apostrophe; text that already starts with one gets
    // another, so fromCsv reads the original text back.
    const guard = (text: string): string => (escape && /^[=+\-@']/.test(text) ? `'${text}` : text);
    if (formulas) {
      if (cell?.formula) return cell.formula;
      const text = starCellText(cell);
      return typeof cell?.value === 'string' && !text.startsWith("'") ? guard(text) : text;
    }
    const value = this.value(address);
    if (value === null) return '';
    if (typeof value === 'number') return starNumberText(value);
    if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
    return guard(String(value));
  }

  private rememberCopy(): Copied {
    const sel = this.selection();
    const rows: string[][] = [];
    const cells: (StarSpreadsheetCell | undefined)[][] = [];
    const all = this.currentCells();
    for (let r = sel.top; r <= sel.bottom; r++) {
      const row: string[] = [];
      const inputs: (StarSpreadsheetCell | undefined)[] = [];
      for (let c = sel.left; c <= sel.right; c++) {
        row.push(this.cellExportText(r, c, false));
        inputs.push(all[starCellAddress(r, c)]);
      }
      rows.push(row);
      cells.push(inputs);
    }
    this.copied = {
      text: starFormatDelimited(rows, '\t'),
      origin: { row: sel.top, col: sel.left },
      cells,
    };
    return this.copied;
  }

  protected onCopy(event: ClipboardEvent, cut: boolean): void {
    if (this.editing() || event.target !== this.grid().nativeElement) return;
    const copied = this.rememberCopy();
    event.clipboardData?.setData('text/plain', copied.text);
    event.preventDefault();
    if (cut && !this.readonly()) this.clearSelection();
    else this.announcer.announce(this.text.copied, 'polite');
  }

  protected onPaste(event: ClipboardEvent): void {
    if (this.editing() || event.target !== this.grid().nativeElement || this.readonly()) return;
    const text = event.clipboardData?.getData('text/plain') ?? '';
    event.preventDefault();
    this.pasteText(text);
  }

  private pasteText(text: string): void {
    if (this.readonly()) return;
    const sel = this.selection();
    const origin = { row: sel.top, col: sel.left };
    const internal = this.copied && this.copied.text === text ? this.copied : null;
    const grid = internal
      ? internal.cells
      : starParseDelimited(text, '\t').map((row) =>
          row.map((field) => starParseCellText(field) ?? undefined),
        );
    if (!grid.length) return;
    const height = grid.length;
    const width = Math.max(...grid.map((r) => r.length));
    // One value into a bigger selection fills it, as in Excel.
    const single = height === 1 && width === 1;
    const bottom = single ? sel.bottom : Math.min(this.rows() - 1, origin.row + height - 1);
    const right = single ? sel.right : Math.min(this.columns() - 1, origin.col + width - 1);
    this.update((cells) => {
      const next = { ...cells };
      for (let r = origin.row; r <= bottom; r++) {
        for (let c = origin.col; c <= right; c++) {
          const sr = (r - origin.row) % height;
          const sc = (c - origin.col) % width;
          const source = grid[sr]?.[sc];
          const address = starCellAddress(r, c);
          const keep = cells[address]?.format;
          if (!source) {
            if (keep && !internal) next[address] = { format: keep };
            else delete next[address];
            continue;
          }
          let cell: StarSpreadsheetCell = internal ? { ...source } : { ...source, format: keep };
          if (internal && cell.formula) {
            cell = {
              ...cell,
              formula: starShiftFormula(
                cell.formula,
                r - (internal.origin.row + sr),
                c - (internal.origin.col + sc),
              ),
            };
          }
          if (!cell.format) delete (cell as { format?: StarCellFormat }).format;
          next[address] = cell;
        }
      }
      return next;
    });
    const pasted = { top: origin.row, left: origin.col, bottom, right };
    this.anchor.set(origin);
    this.focusCell.set({ row: bottom, col: right });
    this.emitSelection();
    this.announcer.announce(this.text.spreadsheetPasted(this.rangeSpeech(pasted)), 'polite');
  }

  // Sheets -----------------------------------------------------------------------------------

  protected selectSheet(index: number): void {
    if (this.editing()) this.commit(null, false);
    this.activeSheet.set(index);
    this.anchor.set({ row: 0, col: 0 });
    this.focusCell.set({ row: 0, col: 0 });
  }

  protected onTabsKeydown(event: KeyboardEvent): void {
    const count = this.sheetList().length;
    const index = this.sheetIndex();
    const key = starInlineKey(event, (event.currentTarget as Element).parentElement);
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: count - 1 }[key];
    if (target === undefined) return;
    event.preventDefault();
    const next = (target + count) % count;
    this.selectSheet(next);
    afterNextRender(
      () => (this.document.getElementById(this.tabId(next)) as HTMLElement | null)?.focus(),
      { injector: this.injector },
    );
  }
}

function range(window: { start: number; end: number }): number[] {
  const out: number[] = [];
  for (let i = window.start; i < window.end; i++) out.push(i);
  return out;
}

/** The format without `undefined` and `false` entries, or undefined when nothing is left. */
function clean(format: StarCellFormat): StarCellFormat | undefined {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(format)) {
    if (value !== undefined && value !== false) out[key] = value;
  }
  return Object.keys(out).length ? (out as StarCellFormat) : undefined;
}
