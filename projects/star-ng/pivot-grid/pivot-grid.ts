import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
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
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import {
  injectStarConfig,
  STAR_UI_TEXT,
  starInlineKey,
  starIsRtl,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  starPivot,
  StarPivotColumn,
  StarPivotConfig,
  starPivotFormatValue,
  StarPivotHeader,
  starPivotPathKey,
  StarPivotResult,
  StarPivotRow,
  starPivotToCsv,
} from './engine';
import { StarPivotConfigurator } from './pivot-configurator';
import {
  starPivotClipHeaders,
  StarPivotField,
  starPivotHeaderGrid,
  starPivotWindow,
  starToggleKey,
} from './pivot-layout';

/** Rows above this count render in a window; fewer render all. */
const ROW_WINDOW_THRESHOLD = 60;
/** Columns above this count render in a window. */
const COLUMN_WINDOW_THRESHOLD = 24;
const ROW_OVERSCAN = 6;
const COLUMN_OVERSCAN = 2;

/** The user chose a value cell (click or Enter): the cell and its source records (drill-down). */
export interface StarPivotCellClickEvent<T = unknown> {
  readonly row: StarPivotRow;
  readonly column: StarPivotColumn;
  readonly rowPath: readonly unknown[];
  readonly columnPath: readonly unknown[];
  readonly value: unknown;
  readonly records: readonly T[];
}

/** Options of `toCsv()` and `exportCsv()`. */
export interface StarPivotGridCsvOptions {
  /** Writes the cell texts as they show (default: plain values). */
  readonly formatted?: boolean;
  /** See `StarPivotCsvOptions.escapeFormulas` (default true). */
  readonly escapeFormulas?: boolean;
  readonly delimiter?: string;
}

/** A grid position: `row` < 0 is a header row (`-headerRows` .. -1), `column` -1 the row labels. */
interface Position {
  readonly row: number;
  readonly column: number;
}

/**
 * Pivot table (Ignite UI `igx-pivot-grid`, Kendo `PivotGrid`, Syncfusion Pivot Table, DevExtreme
 * `PivotGrid`, AG Grid pivot mode). It summarizes flat `data` with `config` (rows, columns,
 * values, filters, totals; `starPivot` computes it): multi-level column headers, row labels with
 * indentation and expand buttons, sticky headers, and rows and columns in a window for large
 * results. `showConfigurator` adds a panel where fields move between Rows, Columns, Values and
 * Filters by drag and drop or a move menu, with a member filter per field. `config` is two-way.
 *
 * Keyboard (WAI-ARIA grid, one tab stop): arrow keys, Home / End, Ctrl+Home / Ctrl+End,
 * PageUp / PageDown move between cells and headers; Enter or Space on a member expands or
 * collapses it, Alt+Arrow Right / Down expands and Alt+Arrow Left / Up collapses; Enter on a
 * value cell emits `cellClick`. Excel XML export is not part of it: use `toCsv()`.
 */
@Component({
  selector: 'star-pivot-grid',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, StarPivotConfigurator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-pivot',
    '[class.star-pivot--configurator]': 'showConfigurator()',
    '[style.--star-pivot-row-height.px]': 'rowHeight()',
    '(keydown)': 'onKeydown($event)',
    '(focusin)': 'onFocusIn($event)',
    '(click)': 'onClick($event)',
  },
  template: `
    @if (showConfigurator()) {
      <star-pivot-configurator
        class="star-pivot__configurator"
        [config]="config()"
        [fields]="allFields()"
        [data]="data()"
        [locale]="lang()"
        (configChange)="config.set($event)"
      />
    }
    <div starPart="main" class="star-pivot__main">
      @if (expandableAny()) {
        <div starPart="tools" class="star-pivot__tools">
          <button
            starPart="button"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm"
            (click)="expandAll()"
          >
            <i starPart="icon" class="ph-bold ph-arrows-out-simple" aria-hidden="true"></i>
            {{ text.expandAll }}
          </button>
          <button
            starPart="button"
            type="button"
            class="star-btn star-btn--ghost star-btn--sm"
            (click)="collapseAll()"
          >
            <i starPart="icon" class="ph-bold ph-arrows-in-simple" aria-hidden="true"></i>
            {{ text.collapseAll }}
          </button>
        </div>
      }
      <div
        starPart="scroller"
        #scroller
        class="star-pivot__scroller"
        [style.max-height]="height()"
        (scroll)="onScroll()"
      >
        <table
          starPart="table"
          class="star-pivot__table"
          role="grid"
          aria-readonly="true"
          [attr.aria-label]="ariaLabel() ?? text.pivotGrid"
          [attr.aria-describedby]="id + '-hint'"
          [attr.aria-rowcount]="headerCount() + result().rows.length"
          [attr.aria-colcount]="result().columns.length + 1"
          [style.width.px]="tableWidth()"
        >
          <colgroup starPart="columns">
            <col starPart="column" [style.width.px]="rowHeaderWidth()" />
            @if (columnWindow().before) {
              <col starPart="column" [style.width.px]="columnWindow().before" />
            }
            @for (c of renderedColumns(); track c) {
              <col starPart="column" [style.width.px]="columnWidth()" />
            }
            @if (columnWindow().after) {
              <col starPart="column" [style.width.px]="columnWindow().after" />
            }
          </colgroup>
          <thead starPart="thead">
            @for (cells of clippedHeaders(); track $index; let h = $index) {
              <tr starPart="headerRow" class="star-pivot__header-row" [attr.aria-rowindex]="h + 1">
                @if (h === 0) {
                  <th
                    starPart="corner"
                    class="star-pivot__corner"
                    scope="col"
                    [attr.rowspan]="headerCount() > 1 ? headerCount() : null"
                    aria-colindex="1"
                    [attr.data-pos]="-headerCount() + ':-1'"
                    [attr.tabindex]="tabIndex(-headerCount() + ':-1')"
                  >
                    {{ cornerLabel() }}
                  </th>
                  @if (columnWindow().before) {
                    <th
                      starPart="spacer"
                      class="star-pivot__spacer"
                      aria-hidden="true"
                      [attr.rowspan]="headerCount() > 1 ? headerCount() : null"
                    ></th>
                  }
                }
                @for (item of cells; track item.cell.key) {
                  @let cell = item.cell;
                  @let pos = cell.row - headerCount() + ':' + cell.column;
                  <th
                    starPart="head"
                    scope="col"
                    class="star-pivot__head"
                    [class]="'star-pivot__head--' + cell.kind"
                    [style.top.px]="cell.row * rowHeight()"
                    [attr.colspan]="item.span > 1 ? item.span : null"
                    [attr.rowspan]="cell.rowSpan > 1 ? cell.rowSpan : null"
                    [attr.aria-colindex]="cell.column + 2"
                    [attr.aria-colspan]="cell.colSpan > 1 ? cell.colSpan : null"
                    [attr.aria-expanded]="cell.expandable ? cell.expanded : null"
                    [attr.data-pos]="pos"
                    [attr.tabindex]="tabIndex(pos)"
                  >
                    <span starPart="headContent" class="star-pivot__head-content">
                      @if (cell.expandable) {
                        <span
                          starPart="toggle"
                          class="star-pivot__toggle"
                          [class.star-pivot__toggle--open]="cell.expanded"
                          aria-hidden="true"
                          ><i starPart="icon" class="ph-bold ph-caret-right star-icon-mirror"></i
                        ></span>
                      }
                      <span starPart="text" class="star-pivot__text">{{ headerLabel(cell) }}</span>
                    </span>
                  </th>
                }
                @if (h === 0 && columnWindow().after) {
                  <th
                    starPart="spacer"
                    class="star-pivot__spacer"
                    aria-hidden="true"
                    [attr.rowspan]="headerCount() > 1 ? headerCount() : null"
                  ></th>
                }
              </tr>
            }
          </thead>
          <tbody starPart="tbody">
            @if (rowWindow().before) {
              <tr starPart="spacerRow" class="star-pivot__spacer-row" aria-hidden="true">
                <td
                  starPart="cell"
                  [attr.colspan]="renderedSpan()"
                  [style.height.px]="rowWindow().before"
                ></td>
              </tr>
            }
            @for (r of renderedRows(); track result().rows[r].key) {
              @let row = result().rows[r];
              <tr
                starPart="row"
                class="star-pivot__row"
                [class.star-pivot__row--total]="row.kind === 'total'"
                [class.star-pivot__row--parent]="row.expandable"
                [attr.aria-rowindex]="headerCount() + r + 1"
              >
                <th
                  starPart="rowHead"
                  scope="row"
                  role="rowheader"
                  class="star-pivot__row-head"
                  [style.--star-pivot-level]="row.level"
                  [attr.aria-expanded]="row.expandable ? row.expanded : null"
                  [attr.data-pos]="r + ':-1'"
                  [attr.tabindex]="tabIndex(r + ':-1')"
                >
                  <span starPart="headContent" class="star-pivot__head-content">
                    @if (row.expandable) {
                      <span
                        starPart="toggle"
                        class="star-pivot__toggle"
                        [class.star-pivot__toggle--open]="row.expanded"
                        aria-hidden="true"
                        ><i starPart="icon" class="ph-bold ph-caret-right star-icon-mirror"></i
                      ></span>
                    } @else if (row.kind === 'member') {
                      <span
                        starPart="toggleSpace"
                        class="star-pivot__toggle-space"
                        aria-hidden="true"
                      ></span>
                    }
                    <span starPart="text" class="star-pivot__text">{{ rowLabel(row) }}</span>
                  </span>
                </th>
                @if (columnWindow().before) {
                  <td starPart="spacer" class="star-pivot__spacer" aria-hidden="true"></td>
                }
                @for (c of renderedColumns(); track c) {
                  @let pos = r + ':' + c;
                  <td
                    starPart="cell"
                    class="star-pivot__cell"
                    [class.star-pivot__cell--total]="result().columns[c].kind !== 'member'"
                    [attr.aria-colindex]="c + 2"
                    [attr.data-pos]="pos"
                    [attr.tabindex]="tabIndex(pos)"
                  >
                    {{ cellText(r, c) }}
                  </td>
                }
                @if (columnWindow().after) {
                  <td starPart="spacer" class="star-pivot__spacer" aria-hidden="true"></td>
                }
              </tr>
            }
            @if (rowWindow().after) {
              <tr starPart="spacerRow" class="star-pivot__spacer-row" aria-hidden="true">
                <td
                  starPart="cell"
                  [attr.colspan]="renderedSpan()"
                  [style.height.px]="rowWindow().after"
                ></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p starPart="srText" class="star-sr-only" [id]="id + '-hint'">{{ text.pivotHint }}</p>
    </div>
  `,
})
export class StarPivotGrid<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly starConfig = injectStarConfig();
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly id = inject(_IdGenerator).getId('star-pivot-');

  /** The flat source records. */
  readonly data = input.required<readonly T[]>();
  /** Rows, columns, values, filters, totals and collapsed members. Two-way. */
  readonly config = model.required<StarPivotConfig<T>>();
  /**
   * Fields that the configurator offers (default: the fields of `config`). A field keeps its
   * label, date hierarchy, member format and default aggregate when it moves.
   */
  readonly fields = input<readonly StarPivotField<T>[]>([]);
  /** Shows the configurator panel. */
  readonly showConfigurator = input(false, { transform: booleanAttribute });
  /** BCP 47 locale of the labels and numbers (default: `provideStarNg` locale, browser). */
  readonly locale = input<string | null>(null);
  /** Maximum height of the table (CSS length); the headers stay in view while it scrolls. */
  readonly height = input<string | null>('32rem');
  /** Height of each row in pixels (rows render in a window above 60 rows). */
  readonly rowHeight = input(36, { transform: numberAttribute });
  /** Width of each value column in pixels. */
  readonly columnWidth = input(120, { transform: numberAttribute });
  /** Width of the row label column in pixels. */
  readonly rowHeaderWidth = input(220, { transform: numberAttribute });
  /** Name of the table (default: "Pivot table"). */
  readonly ariaLabel = input<string | null>(null);
  /** A value cell was chosen (click or Enter): its paths, value and source records. */
  readonly cellClick = output<StarPivotCellClickEvent<T>>();

  protected readonly lang = computed(() => this.locale() ?? this.starConfig.locale ?? undefined);

  /** The computed pivot. */
  readonly result = computed<StarPivotResult<T>>(() =>
    starPivot(this.data(), this.config(), {
      locale: this.lang(),
      blankLabel: this.text.pivotBlank,
      quarterLabel: (quarter) => this.text.pivotQuarter(quarter),
    }),
  );

  protected readonly allFields = computed<readonly StarPivotField<T>[]>(() => {
    const given = this.fields();
    if (given.length) return given;
    const config = this.config();
    const seen = new Map<string, StarPivotField<T>>();
    for (const item of [...config.rows, ...config.columns]) {
      seen.set(item.field, {
        field: item.field,
        label: item.label,
        value: item.value,
        dateHierarchy: item.dateHierarchy,
        format: item.format,
      });
    }
    for (const item of config.values) {
      if (!seen.has(item.field)) {
        seen.set(item.field, { field: item.field, label: item.label, value: item.value });
      }
    }
    for (const item of config.filters ?? []) {
      if (!seen.has(item.field)) seen.set(item.field, { field: item.field });
    }
    return [...seen.values()];
  });

  protected readonly headerCount = computed(() => this.result().headerRows.length);
  protected readonly expandableAny = computed(
    () =>
      this.result().rows.some((row) => row.expandable) ||
      this.result().headerRows.some((row) => row.some((cell) => cell.expandable)),
  );
  private readonly headerGrid = computed(() =>
    starPivotHeaderGrid(this.result().headerRows, this.result().columns.length),
  );

  // ---------------------------------------------------------------- windowing

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly scrollTop = signal(0);
  private readonly scrollStart = signal(0);
  private readonly viewHeight = signal(0);
  private readonly viewWidth = signal(0);

  protected readonly rowWindow = computed(() =>
    starPivotWindow(
      this.result().rows.length,
      this.rowHeight(),
      this.scrollTop(),
      this.viewHeight() - this.headerCount() * this.rowHeight(),
      ROW_OVERSCAN,
      ROW_WINDOW_THRESHOLD,
    ),
  );
  protected readonly columnWindow = computed(() =>
    starPivotWindow(
      this.result().columns.length,
      this.columnWidth(),
      this.scrollStart(),
      this.viewWidth() - this.rowHeaderWidth(),
      COLUMN_OVERSCAN,
      COLUMN_WINDOW_THRESHOLD,
    ),
  );
  protected readonly renderedRows = computed(() => {
    const { start, end } = this.rowWindow();
    return Array.from({ length: end - start }, (_, i) => start + i);
  });
  protected readonly renderedColumns = computed(() => {
    const { start, end } = this.columnWindow();
    return Array.from({ length: end - start }, (_, i) => start + i);
  });
  protected readonly clippedHeaders = computed(() => {
    const { start, end } = this.columnWindow();
    return this.result().headerRows.map((cells) => starPivotClipHeaders(cells, start, end));
  });
  /** Cells of a body row as rendered (for the spacer rows). */
  protected readonly renderedSpan = computed(() => {
    const window = this.columnWindow();
    return 1 + this.renderedColumns().length + (window.before ? 1 : 0) + (window.after ? 1 : 0);
  });
  protected readonly tableWidth = computed(
    () => this.rowHeaderWidth() + this.result().columns.length * this.columnWidth(),
  );

  constructor() {
    afterNextRender(() => this.measure());
    if (this.browser) {
      const view = this.document.defaultView;
      if (view && typeof view.ResizeObserver === 'function') {
        const observer = new view.ResizeObserver(() => this.measure());
        afterNextRender(() => {
          const element = this.scroller()?.nativeElement;
          if (element) observer.observe(element);
        });
        inject(DestroyRef).onDestroy(() => observer.disconnect());
      }
    }
  }

  private measure(): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    this.viewHeight.set(element.clientHeight);
    this.viewWidth.set(element.clientWidth);
  }

  protected onScroll(): void {
    const element = this.scroller()?.nativeElement;
    if (!element) return;
    this.scrollTop.set(element.scrollTop);
    this.scrollStart.set(Math.abs(element.scrollLeft));
    this.measure();
  }

  // ---------------------------------------------------------------- labels

  protected cornerLabel(): string {
    const levels = this.result().rowLevels;
    return levels.length ? levels.map((level) => level.label).join(' / ') : this.text.pivotRows;
  }

  protected headerLabel(cell: StarPivotHeader): string {
    if (cell.kind === 'total') return this.text.pivotGrandTotal;
    if (cell.kind === 'subtotal') return this.text.pivotTotalOf(cell.label);
    return cell.label;
  }

  protected rowLabel(row: StarPivotRow): string {
    return row.kind === 'total' ? this.text.pivotGrandTotal : row.label;
  }

  /** The text of a value cell. */
  protected cellText(row: number, column: number): string {
    const result = this.result();
    if (!result.rows[row]?.hasValues) return '';
    const value = result.values[result.columns[column].valueIndex];
    return starPivotFormatValue(
      result.cells[row][column],
      value,
      this.lang(),
      this.config().emptyText ?? '',
    );
  }

  // ---------------------------------------------------------------- expand and collapse

  /** Expands or collapses a row member by its path. */
  toggleRow(path: readonly unknown[]): void {
    const key = starPivotPathKey(path);
    this.config.update((config) => ({
      ...config,
      collapsedRows: starToggleKey(config.collapsedRows ?? [], key),
    }));
  }

  /** Expands or collapses a column member by its path. */
  toggleColumn(path: readonly unknown[]): void {
    const key = starPivotPathKey(path);
    this.config.update((config) => ({
      ...config,
      collapsedColumns: starToggleKey(config.collapsedColumns ?? [], key),
    }));
  }

  /** Expands every row and column member. */
  expandAll(): void {
    this.config.update((config) => ({ ...config, collapsedRows: [], collapsedColumns: [] }));
  }

  /** Collapses the top-level row and column members. */
  collapseAll(): void {
    const result = this.result();
    const rows = result.rows.filter((row) => row.expandable && row.level === 0);
    const columns = (result.headerRows[0] ?? []).filter(
      (cell) => cell.kind === 'member' && cell.expandable,
    );
    this.config.update((config) => ({
      ...config,
      collapsedRows: [...new Set([...(config.collapsedRows ?? []), ...rows.map((row) => row.key)])],
      collapsedColumns: [
        ...new Set([
          ...(config.collapsedColumns ?? []),
          ...columns.map((cell) => starPivotPathKey(cell.path)),
        ]),
      ],
    }));
  }

  // ---------------------------------------------------------------- export

  /** The visible pivot as CSV (RFC 4180; text that starts with `= + - @` is escaped). */
  toCsv(options: StarPivotGridCsvOptions = {}): string {
    const result = this.result();
    const lang = this.lang();
    const emptyText = this.config().emptyText ?? '';
    return starPivotToCsv(result, {
      corner: this.cornerLabel(),
      total: this.text.pivotGrandTotal,
      subtotal: (label) => this.text.pivotTotalOf(label),
      escapeFormulas: options.escapeFormulas,
      delimiter: options.delimiter,
      format: options.formatted
        ? (value, column) =>
            starPivotFormatValue(value, result.values[column.valueIndex], lang, emptyText)
        : undefined,
    });
  }

  /** Downloads `toCsv()` as `<fileName>.csv` (UTF-8 with a byte order mark, for Excel). */
  exportCsv(fileName = 'pivot', options: StarPivotGridCsvOptions = {}): void {
    if (!this.browser) return;
    const view = this.document.defaultView;
    const blob = new Blob(['﻿', this.toCsv(options)], { type: 'text/csv;charset=utf-8' });
    const url = view?.URL.createObjectURL(blob);
    if (!url) return;
    const link = this.document.createElement('a');
    link.href = url;
    link.download = `${fileName}.csv`;
    link.style.display = 'none';
    this.document.body.appendChild(link);
    link.click();
    link.remove();
    view?.setTimeout(() => view.URL.revokeObjectURL(url), 0);
  }

  // ---------------------------------------------------------------- focus and keyboard

  private readonly active = signal<Position>({ row: 0, column: -1 });

  /** The active position, kept inside the grid. */
  private readonly activePos = computed<Position>(() => {
    const { row, column } = this.active();
    const result = this.result();
    return {
      row: Math.max(-this.headerCount(), Math.min(row, result.rows.length - 1)),
      column: Math.max(-1, Math.min(column, result.columns.length - 1)),
    };
  });

  /** The `data-pos` of the cell at a position (a header cell that spans it, the corner). */
  private posKey(position: Position): string {
    const count = this.headerCount();
    if (position.row >= 0) return `${position.row}:${position.column}`;
    if (position.column < 0) return `${-count}:-1`;
    const cell = this.headerGrid()[position.row + count]?.[position.column];
    return cell ? `${cell.row - count}:${cell.column}` : `${-count}:-1`;
  }

  protected tabIndex(pos: string): 0 | -1 {
    return this.posKey(this.activePos()) === pos ? 0 : -1;
  }

  private positionOf(target: EventTarget | null): { position: Position; cell: HTMLElement } | null {
    const cell = (target as Element | null)?.closest?.<HTMLElement>('[data-pos]');
    const table = this.scroller()?.nativeElement.querySelector('table');
    if (!cell || !table?.contains(cell)) return null;
    const [row, column] = (cell.getAttribute('data-pos') ?? '').split(':').map(Number);
    return { position: { row, column }, cell };
  }

  protected onFocusIn(event: FocusEvent): void {
    const found = this.positionOf(event.target);
    if (!found) return;
    const current = this.activePos();
    // A header cell keeps the column of the last move when it spans it.
    if (this.posKey(current) === this.posKey(found.position)) return;
    this.active.set(found.position);
  }

  protected onClick(event: MouseEvent): void {
    const found = this.positionOf(event.target);
    if (!found) return;
    const { row, column } = found.position;
    // The caret of a member: the pointer way to expand or collapse (the keys act on the cell).
    if ((event.target as Element).closest('.star-pivot__toggle')) {
      const result = this.result();
      if (row >= 0 && column < 0 && result.rows[row]?.expandable) {
        this.toggleRow(result.rows[row].path);
      } else if (row < 0 && column >= 0) {
        const cell = this.headerGrid()[row + this.headerCount()]?.[column];
        if (cell?.expandable) this.toggleColumn(cell.path);
      }
      return;
    }
    if (row >= 0 && column >= 0) this.emitCell(row, column);
  }

  private emitCell(row: number, column: number): void {
    const result = this.result();
    const pivotRow = result.rows[row];
    const pivotColumn = result.columns[column];
    // A parent row without subtotals shows no values: nothing to drill into.
    if (!pivotRow || !pivotColumn || !pivotRow.hasValues) return;
    this.cellClick.emit({
      row: pivotRow,
      column: pivotColumn,
      rowPath: pivotRow.path,
      columnPath: pivotColumn.path,
      value: result.cells[row][column],
      records: result.records(row, column),
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const found = this.positionOf(event.target);
    if (!found) return;
    const count = this.headerCount();
    const result = this.result();
    const current = this.activePos();
    const here = this.posKey(current) === this.posKey(found.position) ? current : found.position;
    const header =
      here.row < 0 && here.column >= 0
        ? this.headerGrid()[here.row + count]?.[here.column]
        : undefined;
    const rowItem = here.row >= 0 && here.column < 0 ? result.rows[here.row] : undefined;
    const key = starInlineKey(event, found.cell);

    if (event.altKey) {
      const open = key === 'ArrowRight' || key === 'ArrowDown';
      const close = key === 'ArrowLeft' || key === 'ArrowUp';
      if (!open && !close) return;
      if (rowItem?.expandable && rowItem.expanded !== open) {
        event.preventDefault();
        this.toggleRow(rowItem.path);
      } else if (header?.expandable && header.expanded !== open) {
        event.preventDefault();
        this.toggleColumn(header.path);
      }
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      if (rowItem?.expandable) {
        event.preventDefault();
        this.toggleRow(rowItem.path);
      } else if (header?.expandable) {
        event.preventDefault();
        this.toggleColumn(header.path);
      } else if (event.key === 'Enter' && here.row >= 0 && here.column >= 0) {
        event.preventDefault();
        this.emitCell(here.row, here.column);
      }
      return;
    }

    const lastRow = result.rows.length - 1;
    const lastColumn = result.columns.length - 1;
    const ctrl = event.ctrlKey || event.metaKey;
    let next: Position | null = null;
    switch (key) {
      case 'ArrowRight':
        next = {
          row: here.row,
          column: Math.min(lastColumn, header ? header.column + header.colSpan : here.column + 1),
        };
        break;
      case 'ArrowLeft':
        next = { row: here.row, column: Math.max(-1, (header ? header.column : here.column) - 1) };
        break;
      case 'ArrowDown': {
        const below = header
          ? header.row + header.rowSpan - count
          : here.column < 0 && here.row < 0
            ? 0
            : here.row + 1;
        next = { row: Math.min(lastRow, below), column: here.column };
        break;
      }
      case 'ArrowUp':
        next = {
          row: Math.max(
            -count,
            here.row >= 0 ? here.row - 1 : header ? header.row - count - 1 : here.row,
          ),
          column: here.column,
        };
        break;
      case 'Home':
        next = ctrl ? { row: -count, column: -1 } : { row: here.row, column: -1 };
        break;
      case 'End':
        next = ctrl ? { row: lastRow, column: lastColumn } : { row: here.row, column: lastColumn };
        break;
      case 'PageDown':
        next = {
          row: Math.min(lastRow, Math.max(0, here.row) + this.pageRows()),
          column: here.column,
        };
        break;
      case 'PageUp':
        next = { row: Math.max(0, here.row - this.pageRows()), column: here.column };
        break;
    }
    if (!next) return;
    event.preventDefault();
    this.focusPosition(next);
  }

  private pageRows(): number {
    const view = this.viewHeight() - this.headerCount() * this.rowHeight();
    return view > 0 ? Math.max(1, Math.floor(view / this.rowHeight()) - 1) : 10;
  }

  /**
   * Moves the focus to a value cell (`row` and `column` indexes of `result()`), a row label
   * (`column` -1) or a header (`row` < 0). Scrolls it into view first.
   */
  focusPosition(position: Position): void {
    this.active.set(position);
    if (!this.browser) return;
    this.reveal(position);
    const pos = this.posKey(this.activePos());
    const focus = (): boolean => {
      const element = this.scroller()?.nativeElement.querySelector<HTMLElement>(
        `[data-pos="${pos}"]`,
      );
      element?.focus({ preventScroll: true });
      return !!element;
    };
    if (!focus()) afterNextRender(() => focus(), { injector: this.injector });
  }

  private reveal(position: Position): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller) return;
    const head = this.headerCount() * this.rowHeight();
    if (position.row >= 0) {
      const top = position.row * this.rowHeight();
      const view = scroller.clientHeight - head;
      if (top < scroller.scrollTop) scroller.scrollTop = top;
      else if (view > 0 && top + this.rowHeight() > scroller.scrollTop + view) {
        scroller.scrollTop = top + this.rowHeight() - view;
      }
    }
    if (position.column >= 0) {
      const start = position.column * this.columnWidth();
      const view = scroller.clientWidth - this.rowHeaderWidth();
      const rtl = starIsRtl(scroller);
      const current = Math.abs(scroller.scrollLeft);
      let goal = current;
      if (start < current) goal = start;
      else if (view > 0 && start + this.columnWidth() > current + view) {
        goal = start + this.columnWidth() - view;
      }
      if (goal !== current) scroller.scrollLeft = rtl ? -goal : goal;
    }
    this.onScroll();
  }
}
