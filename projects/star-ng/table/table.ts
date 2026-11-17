import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  ApplicationRef,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  isDevMode,
  model,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import {
  compareValues,
  matchesFilter,
  readOption,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  StarGroupContext,
  starIsRtl,
  StarOptionKey,
  StarSlot,
  starSlot,
  starSlotMap,
} from '@star-ng/ui/core';
import { StarPaginator } from '@star-ng/ui/paginator';
import { StarPopover } from '@star-ng/ui/popover';
import { StarMultiSelect, StarSelect } from '@star-ng/ui/select';
import { StarSkeleton } from '@star-ng/ui/skeleton';
import {
  buildPrintDocument,
  buildXlsx,
  fitPrintDocument,
  printColumnAlign,
  printContext,
  StarExportCell,
  stylePrintDocument,
} from './table-export';
import type { StarHeaderCellContext } from './table-slots';
import {
  anchorOf,
  anchorShift,
  buildVirtualLayout,
  groupKey,
  HeightChange,
  variableRange,
  VirtualItem,
  VirtualLayout,
} from './virtual-heights';

export interface StarColumn<T> {
  /** Unique column id; also the property read when `value` is not set. */
  readonly field: string;
  readonly header: string;
  /** Cell value accessor (default: `row[field]`). Used for display, sort and filter. */
  readonly value?: (row: T) => unknown;
  /** Display text (default: `String(value)`). */
  readonly format?: (row: T) => string;
  readonly sortable?: boolean;
  readonly width?: string;
  readonly align?: 'start' | 'center' | 'end';
  /**
   * Column filter, shown in a second header row.
   * - `'text'`: the display text contains the query (case- and accent-insensitive).
   * - `'select'`: the display text equals the choice.
   * - `'multiselect'`: the display text is one of the choices (value: text list).
   * - `'number'`: the cell value is in a range (value: `{ min, max }` numbers).
   * - `'date'`: the cell day is in a range (value: `{ min, max }` as `yyyy-mm-dd`).
   */
  readonly filter?: 'text' | 'select' | 'multiselect' | 'number' | 'date';
  /** Choices of a `'select'` or `'multiselect'` filter (default: the distinct display texts in `value`, sorted). */
  readonly filterOptions?: readonly string[];
  /** `false` leaves the column out of every export (CSV, Excel, print). */
  readonly exportable?: boolean;
  /**
   * Cell value in an export. Use it for a column with a custom cell template, where the
   * display text is not what the user sees. A number stays a number in Excel.
   */
  readonly exportValue?: (row: T) => string | number | null | undefined;
  /**
   * Keeps the column in view when the table scrolls sideways. Frozen columns come first.
   * The table measures the frozen columns to position the next one, so `width` is optional.
   */
  readonly frozen?: boolean;
  /** `false`: the user cannot hide the column in the Columns panel. */
  readonly hideable?: boolean;
  /**
   * The user can change the cell in place. The table does not change `value`: it emits
   * `cellEdit`, and the owner stores the new value.
   */
  readonly editable?: boolean | ((row: T) => boolean);
  /** Editor of an editable cell (default `'text'`). `'number'` emits a number or `null`. */
  readonly editor?: 'text' | 'number' | 'select';
  /** Choices of a `'select'` editor. */
  readonly editOptions?: readonly string[];
  /**
   * Footer cell: fixed text, or a function of the filtered rows (all pages), for a total or
   * an average. The table has a footer row when one column has a footer.
   */
  readonly footer?: string | ((rows: readonly T[]) => string);
}

export interface StarCellEditEvent<T> {
  readonly row: T;
  readonly field: string;
  /** New value: text, or a number / `null` for the `'number'` editor. */
  readonly value: string | number | null;
  readonly previous: unknown;
}

/** Range of a `'number'` filter (numbers) or a `'date'` filter (`yyyy-mm-dd` text). */
export interface StarRangeFilter {
  readonly min?: number | string | null;
  readonly max?: number | string | null;
}

/** Text (`'text'`, `'select'`), text list (`'multiselect'`) or range (`'number'`, `'date'`). */
export type StarFilterValue = string | readonly string[] | StarRangeFilter;

/** Column filter values by column `field`. An empty or missing value means "no filter". */
export type StarColumnFilters = Readonly<Record<string, StarFilterValue>>;

function isRange(value: StarFilterValue | undefined): value is StarRangeFilter {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasBound(bound: number | string | null | undefined): bound is number | string {
  return bound !== null && bound !== undefined && bound !== '';
}

function isActiveFilter(value: StarFilterValue | undefined): value is StarFilterValue {
  if (isRange(value)) return hasBound(value.min) || hasBound(value.max);
  return !!value && value.length > 0;
}

/** Local calendar day of a cell value as `yyyy-mm-dd`, or `''` when it is not a date. */
function dayKey(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (value === null || value === undefined || Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export interface StarExportOptions<T = unknown> {
  /** File name without extension (default `export`). */
  readonly fileName?: string;
  /** Export the selected rows only (default: all filtered rows, in the current sort order). */
  readonly selectionOnly?: boolean;
  /**
   * Rows to export instead of the table rows. Use it in lazy mode, where the table holds one
   * page: load all rows from the server and pass them here.
   */
  readonly rows?: readonly T[];
  /** Sheet name (Excel) or heading (print). Default: the table `ariaLabel`. */
  readonly title?: string;
}

export interface StarCsvOptions<T = unknown> extends StarExportOptions<T> {
  /** Field separator (default `,`). */
  readonly separator?: string;
}

/** Rows rendered above and below the rows in view, so a fast scroll shows no gap. */
const VIRTUAL_BUFFER_ROWS = 5;
/** Viewport height in pixels before the first scroll event gives the real height. */
const VIRTUAL_FALLBACK_VIEWPORT = 480;
/** Smallest measured height change, in pixels, that updates the height of a row. */
const MEASURE_TOLERANCE = 0.1;
/** Elements that take the focus with Tab, for keyboard moves between rendered rows. */
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** One line of the table body: a spacer, a group heading, or a row with its detail row. */
type BodyEntry<T> =
  | { readonly kind: 'spacer'; readonly key: string; readonly height: number }
  | {
      readonly kind: 'group';
      readonly key: string;
      readonly label: string;
      readonly count: number;
      /** `aria-rowindex`, or null without virtual scroll. */
      readonly aria: number | null;
      /** Index in the virtual list (`data-vi`), or null without virtual scroll. */
      readonly item: number | null;
    }
  | {
      readonly kind: 'row';
      readonly key: unknown;
      readonly row: T;
      readonly index: number;
      readonly aria: number | null;
      readonly item: number | null;
    };

/** Smallest width, in pixels, that the user can give a column. */
const MIN_COLUMN_WIDTH = 48;
/** `aria-valuemax` of a resize handle. The column width itself has no upper limit. */
const MAX_COLUMN_WIDTH_HINT = 2000;

export type StarSortOrder = 1 | -1;

export interface StarSortState {
  readonly field: string | null;
  readonly order: StarSortOrder;
}

export interface StarLazyLoadEvent extends StarSortState {
  readonly first: number;
  readonly rows: number;
  readonly filter: string;
  readonly filters: StarColumnFilters;
  /** All sort columns in priority order (one entry without `multiSort`). */
  readonly sorts: readonly StarSortState[];
}

/** The user asked to move a row. The table does not change `value`: the owner moves the row. */
export interface StarRowReorderEvent<T> {
  readonly row: T;
  /** Index of the row in `value` now, and the index it must get. */
  readonly from: number;
  readonly to: number;
}

/** What `stateKey` stores in the browser. */
interface StarTableState {
  sortField?: string | null;
  sortOrder?: StarSortOrder;
  sortMeta?: readonly StarSortState[];
  filters?: StarColumnFilters;
  columnOrder?: readonly string[];
  hiddenColumns?: readonly string[];
  columnWidths?: Readonly<Record<string, number>>;
  rows?: number;
  collapsedGroups?: readonly string[];
}

export interface StarCellContext<T> {
  readonly $implicit: T;
  readonly value: unknown;
  readonly index: number;
}

/** Custom cell: `<ng-template starCell="status" let-row let-value="value">…</ng-template>`. */
@Directive({ selector: 'ng-template[starCell]' })
export class StarCellTemplate<T = unknown> {
  readonly starCell = input.required<string>();
  /** Optional: pass the table rows to type `let-row` in strict templates. */
  readonly starCellOf = input<readonly T[] | null>(null);
  readonly template = inject<TemplateRef<StarCellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: StarCellTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarCellContext<T> {
    return true;
  }
}

export interface StarRowContext<T> {
  readonly $implicit: T;
  readonly index: number;
}

/**
 * Detail content of an expanded row. When the table has this template, each row gets an
 * expand button: `<ng-template starRowExpansion let-row>…</ng-template>`.
 */
@Directive({ selector: 'ng-template[starRowExpansion]' })
export class StarRowExpansionTemplate<T = unknown> {
  /** Optional: pass the table rows to type `let-row` in strict templates. */
  readonly starRowExpansionOf = input<readonly T[] | null>(null);
  readonly template = inject<TemplateRef<StarRowContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _dir: StarRowExpansionTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarRowContext<T> {
    return true;
  }
}

/**
 * Data table (PrimeNG `p-table` essentials): typed columns, custom cell templates, sorting,
 * global filter, column filters, CSV / Excel / print export, client or lazy (server) pagination, single / multiple row selection with
 * checkboxes, row expansion, inline cell edit, column resize / reorder / hide / freeze, virtual scroll, row groups, multi-column sort,
 * footer row, row reorder, saved state, loading skeleton, empty state, sticky header and row click.
 *
 * Slots (content children): `starCell`, `starRowExpansion`, `starHeaderCell` (header label of one
 * column), `starEmpty` (empty message; `$implicit` is the `globalFilter` text, `''` when none),
 * `starLoading` (replaces the skeleton rows with one row and one cell over all columns while
 * `loading` is true) and `starGroup` (replaces the label and the row count of a group heading
 * together; the context has both, and the toggle button and its `aria-expanded` stay; `count` is
 * the rows of that group on the current page; the content goes inside the toggle button, so do
 * not add focusable elements). Content
 * with `starTableCaption` goes above the table. Content with `starTableSummary` goes directly
 * below the scroll area of the table and above the paginator.
 *
 * ```html
 * <star-table [value]="rows()" [columns]="columns" dataKey="id" selectionMode="multiple"
 *            [(selection)]="selected" paginator [rows]="10" [globalFilter]="query()">
 *   <ng-template starCell="status" let-row><star-tag [value]="row.status" /></ng-template>
 * </star-table>
 * ```
 */
@Component({
  selector: 'star-table',
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarTable) }],
  imports: [
    NgTemplateOutlet,
    StarButton,
    StarCheckbox,
    StarMultiSelect,
    StarPaginator,
    StarSelect,
    StarPopover,
    StarSkeleton,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-table',
    '[class.star-table--striped]': 'striped()',
    '[class.star-table--sm]': "size() === 'sm'",
    '[class.star-table--sticky]': 'stickyHeader()',
    '[class.star-table--virtual]': 'virtualScroll()',
    '[class.star-table--variable]': 'variableHeights()',
    '[class.star-table--stack]': "responsiveLayout() === 'stack'",
    '[style.--star-table-row-height.px]': 'virtualScroll() ? virtualRowHeight() : null',
    // Virtual scroll: the focused row stays rendered, and Tab reaches rows out of the window.
    '(focusin)': 'onBodyFocusIn($event)',
    '(focusout)': 'onBodyFocusOut($event)',
    '(keydown)': 'onBodyKeydown($event)',
  },
  template: `
    <ng-content select="[starTableCaption]" />
    @if (columnToggle()) {
      <div class="star-table__tools">
        <star-button
          size="sm"
          variant="secondary"
          leadingIcon="ph-bold ph-columns"
          (pressed)="columnsPanel.toggle($event)"
        >
          {{ text.columns }}
        </star-button>
        <star-popover #columnsPanel [ariaLabel]="text.columns">
          <ul class="star-table__columns">
            @for (
              column of orderedColumns();
              track column.field;
              let first = $first;
              let last = $last
            ) {
              <li>
                <star-checkbox
                  [checked]="!isHidden(column)"
                  [disabled]="!canHide(column)"
                  (checkedChange)="setColumnVisible(column, $event)"
                >
                  {{ column.header }}
                </star-checkbox>
                @if (reorderableColumns()) {
                  <span class="star-table__columns-move">
                    <button
                      type="button"
                      class="star-table__toggle"
                      [disabled]="first"
                      [attr.data-move]="moveKey(column, -1)"
                      [attr.aria-label]="text.moveColumnEarlier(column.header)"
                      (click)="moveColumnBy(column, -1)"
                    >
                      <i class="ph-bold ph-arrow-up" aria-hidden="true"></i>
                    </button>
                    <button
                      type="button"
                      class="star-table__toggle"
                      [disabled]="last"
                      [attr.data-move]="moveKey(column, 1)"
                      [attr.aria-label]="text.moveColumnLater(column.header)"
                      (click)="moveColumnBy(column, 1)"
                    >
                      <i class="ph-bold ph-arrow-down" aria-hidden="true"></i>
                    </button>
                  </span>
                }
              </li>
            }
          </ul>
        </star-popover>
      </div>
    }
    <div
      #scroller
      class="star-table__scroll"
      [attr.role]="scrollable() ? 'group' : null"
      [attr.aria-label]="scrollable() ? ariaLabel() : null"
      [attr.tabindex]="scrollable() ? 0 : null"
      [style.max-height]="scrollHeight()"
      (scroll)="onScroll($event)"
    >
      <table
        [attr.aria-label]="ariaLabel()"
        [attr.aria-busy]="loading() || null"
        [attr.aria-rowcount]="ariaRowCount()"
      >
        <thead>
          <tr [attr.aria-rowindex]="virtualScroll() ? 1 : null">
            @if (reorderableRows()) {
              <th class="star-table__reorder" scope="col">
                <span class="star-sr-only">{{ text.reorderRows }}</span>
              </th>
            }
            @if (expandable()) {
              <th class="star-table__expander" scope="col">
                <span class="star-sr-only">{{ text.rowDetails }}</span>
              </th>
            }
            @if (selectionMode() === 'multiple') {
              <th class="star-table__select" scope="col">
                <star-checkbox
                  [checked]="pageState() === true"
                  [indeterminate]="pageState() === 'mixed'"
                  [ariaLabel]="text.selectAllRows"
                  [disabled]="!pageRows().length"
                  (checkedChange)="togglePage($event)"
                />
              </th>
            } @else if (selectionMode() === 'single') {
              <th class="star-table__select" scope="col">
                <span class="star-sr-only">{{ text.selectRow }}</span>
              </th>
            }
            @for (column of visibleColumns(); track column.field) {
              <th
                scope="col"
                [style.width]="widthOf(column)"
                [style.min-width]="resizedWidth(column)"
                [style.max-width]="resizedWidth(column)"
                [style.inset-inline-start]="frozenOffset(column)"
                [attr.data-field]="column.field"
                [class]="'star-table__th star-table__cell--' + (column.align ?? 'start')"
                [class.star-table__cell--frozen]="column.frozen"
                [class.star-table__th--drop]="dropField() === column.field"
                [attr.aria-sort]="ariaSort(column)"
                [attr.draggable]="reorderableColumns() ? 'true' : null"
                (dragstart)="onDragStart(column, $event)"
                (dragover)="onDragOver(column, $event)"
                (drop)="onDrop(column, $event)"
                (dragend)="endDrag()"
              >
                @if (column.sortable) {
                  <button
                    type="button"
                    class="star-table__sort"
                    [attr.title]="multiSort() ? text.sortMultiHint : null"
                    (click)="sortBy(column, $event)"
                  >
                    <ng-container *ngTemplateOutlet="headerLabel; context: { $implicit: column }" />
                    <i [class]="sortIcon(column)" aria-hidden="true"></i>
                    @if (sortRank(column); as rank) {
                      <span class="star-table__sort-rank">{{ rank }}</span>
                    }
                  </button>
                } @else {
                  <ng-container *ngTemplateOutlet="headerLabel; context: { $implicit: column }" />
                }
                @if (resizableColumns()) {
                  <span
                    class="star-table__resizer"
                    role="separator"
                    aria-orientation="vertical"
                    tabindex="0"
                    [attr.aria-label]="text.resizeColumn(column.header)"
                    [attr.aria-valuenow]="resizeNow(column)"
                    [attr.aria-valuemin]="minColumnWidth"
                    [attr.aria-valuemax]="resizeMax(column)"
                    (pointerdown)="startResize(column, $event)"
                    (keydown)="onResizeKey(column, $event)"
                  ></span>
                }
              </th>
            }
          </tr>
          @if (hasColumnFilters()) {
            <tr class="star-table__filters" [attr.aria-rowindex]="virtualScroll() ? 2 : null">
              @if (reorderableRows()) {
                <td class="star-table__reorder"></td>
              }
              @if (expandable()) {
                <td class="star-table__expander"></td>
              }
              @if (selectionMode()) {
                <td class="star-table__select"></td>
              }
              @for (column of visibleColumns(); track column.field) {
                <td
                  [class.star-table__cell--frozen]="column.frozen"
                  [style.inset-inline-start]="frozenOffset(column)"
                  [attr.data-label]="column.filter ? column.header : null"
                >
                  @if (column.filter === 'select') {
                    <star-select
                      class="star-table__filter"
                      size="sm"
                      showClear
                      [options]="filterChoices(column)"
                      [value]="filterValue(column.field) || null"
                      [placeholder]="text.filterAll"
                      [ariaLabel]="text.filterBy(column.header)"
                      (valueChange)="setFilter(column.field, $event ?? '')"
                    />
                  } @else if (column.filter === 'text') {
                    <input
                      type="search"
                      class="star-input star-input--sm star-table__filter"
                      [attr.aria-label]="text.filterBy(column.header)"
                      [value]="filterValue(column.field)"
                      (input)="setFilter(column.field, $any($event.target).value)"
                    />
                  } @else if (column.filter === 'multiselect') {
                    <star-multi-select
                      class="star-table__filter"
                      size="sm"
                      [options]="filterChoices(column)"
                      [value]="filterList(column.field)"
                      [placeholder]="text.filterAll"
                      [ariaLabel]="text.filterBy(column.header)"
                      (valueChange)="setFilter(column.field, $event)"
                    />
                  } @else if (column.filter === 'number' || column.filter === 'date') {
                    <span class="star-table__filter-range">
                      <input
                        class="star-input star-input--sm star-table__filter"
                        [type]="column.filter"
                        [attr.aria-label]="text.filterMin(column.header)"
                        [attr.placeholder]="column.filter === 'number' ? text.filterMinShort : null"
                        [value]="filterBound(column.field, 'min')"
                        (input)="setBound(column, 'min', $any($event.target).value)"
                      />
                      <input
                        class="star-input star-input--sm star-table__filter"
                        [type]="column.filter"
                        [attr.aria-label]="text.filterMax(column.header)"
                        [attr.placeholder]="column.filter === 'number' ? text.filterMaxShort : null"
                        [value]="filterBound(column.field, 'max')"
                        (input)="setBound(column, 'max', $any($event.target).value)"
                      />
                    </span>
                  }
                </td>
              }
            </tr>
          }
        </thead>
        <tbody #body>
          @if (loading() && loadingSlot(); as loader) {
            <tr>
              <td [attr.colspan]="colspan()">
                <ng-container *ngTemplateOutlet="loader" />
              </td>
            </tr>
          } @else if (loading()) {
            @for (row of skeletonRows(); track row) {
              <tr class="star-table__row">
                @if (reorderableRows()) {
                  <td class="star-table__reorder"></td>
                }
                @if (expandable()) {
                  <td class="star-table__expander"></td>
                }
                @if (selectionMode()) {
                  <td class="star-table__select"><star-skeleton size="1.25rem" /></td>
                }
                @for (column of visibleColumns(); track column.field) {
                  <td><star-skeleton height="0.875rem" [width]="row % 2 ? '70%' : '90%'" /></td>
                }
              </tr>
            }
          } @else {
            @for (entry of bodyEntries(); track entry.key) {
              @if (entry.kind === 'spacer') {
                <tr class="star-table__spacer" aria-hidden="true">
                  <td [attr.colspan]="colspan()" [style.height.px]="entry.height"></td>
                </tr>
              } @else if (entry.kind === 'group') {
                @let group = entry;
                <tr
                  class="star-table__group"
                  [attr.aria-rowindex]="group.aria"
                  [attr.data-vi]="group.item"
                >
                  <th [attr.colspan]="colspan()" scope="colgroup">
                    <button
                      type="button"
                      class="star-table__group-toggle"
                      [attr.aria-expanded]="!isGroupCollapsed(group.label)"
                      (click)="toggleGroup(group.label)"
                    >
                      <i class="ph-bold ph-caret-down" aria-hidden="true"></i>
                      @if (groupSlot(); as custom) {
                        <ng-container
                          *ngTemplateOutlet="
                            custom;
                            context: { $implicit: group.label, count: group.count }
                          "
                        />
                      } @else {
                        {{ group.label }}
                        <span class="star-table__group-count">{{ group.count }}</span>
                      }
                    </button>
                  </th>
                </tr>
              } @else {
                @let row = entry.row;
                @let i = entry.index;
                <tr
                  [attr.aria-rowindex]="entry.aria"
                  [attr.data-vi]="entry.item"
                  [hidden]="isRowCollapsed(row)"
                  class="star-table__row"
                  [class.star-table__row--alt]="i % 2 === 1"
                  [class.star-table__row--selected]="isSelected(row)"
                  [class.star-table__row--clickable]="clickable()"
                  [class.star-table__row--expanded]="expandable() && isExpanded(row)"
                  [attr.aria-selected]="selectionMode() ? isSelected(row) : null"
                  (click)="onRowClick(row, $event)"
                >
                  @if (reorderableRows()) {
                    <td class="star-table__reorder">
                      <button
                        type="button"
                        class="star-table__toggle"
                        [disabled]="!canMoveRow(row, -1)"
                        [attr.aria-label]="text.moveUp"
                        (click)="moveRow(row, -1)"
                      >
                        <i class="ph-bold ph-arrow-up" aria-hidden="true"></i>
                      </button>
                      <button
                        type="button"
                        class="star-table__toggle"
                        [disabled]="!canMoveRow(row, 1)"
                        [attr.aria-label]="text.moveDown"
                        (click)="moveRow(row, 1)"
                      >
                        <i class="ph-bold ph-arrow-down" aria-hidden="true"></i>
                      </button>
                    </td>
                  }
                  @if (expandable()) {
                    <td class="star-table__expander">
                      <button
                        type="button"
                        class="star-table__toggle"
                        [attr.aria-expanded]="isExpanded(row)"
                        [attr.aria-controls]="isExpanded(row) ? detailId(i) : null"
                        [attr.aria-label]="isExpanded(row) ? text.collapseRow : text.expandRow"
                        (click)="toggleExpansion(row)"
                      >
                        <i class="ph-bold ph-caret-right" aria-hidden="true"></i>
                      </button>
                    </td>
                  }
                  @if (selectionMode() === 'multiple') {
                    <td class="star-table__select">
                      <star-checkbox
                        [checked]="isSelected(row)"
                        [ariaLabel]="text.selectRow"
                        (checkedChange)="toggleRow(row)"
                        (click)="$event.stopPropagation()"
                      />
                    </td>
                  } @else if (selectionMode() === 'single') {
                    <td class="star-table__select">
                      <input
                        type="radio"
                        class="star-table__radio"
                        [name]="radioName"
                        [checked]="isSelected(row)"
                        [attr.aria-label]="text.selectRow"
                        (change)="selectOnly(row)"
                        (click)="$event.stopPropagation()"
                      />
                    </td>
                  }
                  @for (column of visibleColumns(); track column.field) {
                    <td
                      [class]="'star-table__cell--' + (column.align ?? 'start')"
                      [class.star-table__cell--frozen]="column.frozen"
                      [style.inset-inline-start]="frozenOffset(column)"
                      [attr.data-label]="column.header"
                    >
                      @if (isEditing(row, column)) {
                        @if (column.editor === 'select') {
                          <!-- A choice commits at once; Escape or closing the list cancels. -->
                          <star-select
                            #selectEditor
                            class="star-table__editor"
                            size="sm"
                            [options]="column.editOptions ?? []"
                            [value]="cellText(row, column)"
                            [ariaLabel]="text.editCell(column.header)"
                            (valueChange)="commitEdit(row, column, $event ?? '')"
                            (closed)="onEditorClosed(row, column)"
                            (keydown.escape)="cancelEdit($event)"
                          />
                        } @else {
                          <input
                            class="star-input star-input--sm star-table__editor"
                            [type]="column.editor === 'number' ? 'number' : 'text'"
                            [attr.aria-label]="text.editCell(column.header)"
                            [value]="editText(row, column)"
                            (blur)="commitEdit(row, column, $any($event.target).value)"
                            (keydown.enter)="commitEdit(row, column, $any($event.target).value)"
                            (keydown.escape)="cancelEdit($event)"
                          />
                        }
                      } @else if (isEditable(row, column)) {
                        <button
                          type="button"
                          class="star-table__edit"
                          [attr.data-edit]="editKey(row, column)"
                          (click)="startEdit(row, column)"
                        >
                          <!-- The name is the action and the visible value (WCAG 2.5.3). -->
                          <span class="star-sr-only">{{ text.editCell(column.header) }}: </span>
                          <span class="star-table__edit-value">
                            <ng-container
                              *ngTemplateOutlet="
                                cell;
                                context: { $implicit: row, column, index: i }
                              "
                            />
                          </span>
                          <i class="ph-bold ph-pencil-simple" aria-hidden="true"></i>
                        </button>
                      } @else {
                        <ng-container
                          *ngTemplateOutlet="cell; context: { $implicit: row, column, index: i }"
                        />
                      }
                    </td>
                  }
                </tr>
                @if (expansionTemplate(); as detail) {
                  @if (isExpanded(row) && !isRowCollapsed(row)) {
                    <tr
                      class="star-table__expansion"
                      [id]="detailId(i)"
                      [attr.aria-rowindex]="entry.aria === null ? null : entry.aria + 1"
                      [attr.data-vi]="entry.item"
                    >
                      <td [attr.colspan]="colspan()">
                        <ng-container
                          *ngTemplateOutlet="detail; context: { $implicit: row, index: i }"
                        />
                      </td>
                    </tr>
                  }
                }
              }
            } @empty {
              <tr>
                <td class="star-table__empty" [attr.colspan]="colspan()">
                  <i class="ph-bold ph-tray" aria-hidden="true"></i>
                  @if (emptySlot(); as custom) {
                    <ng-container
                      *ngTemplateOutlet="custom; context: { $implicit: globalFilter() }"
                    />
                  } @else {
                    {{ emptyMessage() ?? text.noData }}
                  }
                </td>
              </tr>
            }
          }
        </tbody>
        @if (hasFooter()) {
          <tfoot>
            <tr
              class="star-table__footer"
              [attr.aria-rowindex]="virtualScroll() ? ariaRowCount() : null"
            >
              @if (reorderableRows()) {
                <td class="star-table__reorder"></td>
              }
              @if (expandable()) {
                <td class="star-table__expander"></td>
              }
              @if (selectionMode()) {
                <td class="star-table__select"></td>
              }
              @for (column of visibleColumns(); track column.field) {
                <td
                  [class]="'star-table__cell--' + (column.align ?? 'start')"
                  [attr.data-label]="footerText(column) ? column.header : null"
                >
                  {{ footerText(column) }}
                </td>
              }
            </tr>
          </tfoot>
        }
      </table>
    </div>
    <ng-content select="[starTableSummary]" />
    <ng-template #headerLabel let-column>
      @if (headerCellSlots().get(column.field); as custom) {
        <ng-container *ngTemplateOutlet="custom; context: { $implicit: column }" />
      } @else {
        {{ column.header }}
      }
    </ng-template>
    <ng-template #cell let-row let-column="column" let-i="index">
      @if (cellTemplate(column.field); as custom) {
        <ng-container
          *ngTemplateOutlet="
            custom;
            context: { $implicit: row, value: cellValue(row, column), index: i }
          "
        />
      } @else {
        {{ cellText(row, column) }}
      }
    </ng-template>
    @if (paginator()) {
      <star-paginator
        [ariaLabel]="ariaLabel() ? text.pagination + ': ' + ariaLabel() : null"
        [totalRecords]="total()"
        [(first)]="first"
        [(rows)]="rows"
        [rowsPerPageOptions]="rowsPerPageOptions()"
        (pageChange)="emitLazy()"
      />
    }
  `,
})
export class StarTable<T> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly appRef = inject(ApplicationRef);

  readonly value = input.required<readonly T[]>();
  readonly columns = input.required<readonly StarColumn<T>[]>();
  /** Row identity for tracking and selection (default: the row object). */
  readonly dataKey = input<StarOptionKey<T> | null>(null);
  readonly loading = input(false, { transform: booleanAttribute });
  readonly emptyMessage = input<string | null>(null);
  readonly striped = input(false, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('md');
  readonly stickyHeader = input(false, { transform: booleanAttribute });
  readonly scrollHeight = input<string | null>(null);
  /**
   * Layout when the table is narrower than 40rem (a phone). `'scroll'`: the table scrolls
   * sideways. `'stack'`: each row is a block with one line per column, "label: value"; the
   * sortable headers stay as a row of buttons. With `virtualScroll`, `'stack'` turns on rows of
   * different heights.
   */
  readonly responsiveLayout = input<'scroll' | 'stack'>('scroll');
  /**
   * Renders only the rows in view (plus 5 above and below), for long lists. Needs
   * `scrollHeight`. Rows have one fixed height (`virtualRowHeight`, text on one line) unless
   * `virtualRowHeights` turns on rows of different heights.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /**
   * Row height in pixels with `virtualScroll`. With rows of different heights it is the
   * estimated height of a row that was not measured yet.
   */
  readonly virtualRowHeight = input(48);
  /**
   * Row heights with `virtualScroll`. `'auto'`: one fixed height, unless the table has row
   * expansion, `groupBy` or the stacked layout, which need rows of different heights.
   * `'variable'`: rows of different heights always, for cell text on more than one line. The
   * table measures each rendered row and keeps the heights.
   */
  readonly virtualRowHeights = input<'auto' | 'variable'>('auto');
  readonly ariaLabel = input<string | null>(null);

  readonly paginator = input(false, { transform: booleanAttribute });
  readonly first = model(0);
  readonly rows = model(10);
  readonly rowsPerPageOptions = input<readonly number[]>([10, 25, 50]);

  readonly sortField = model<string | null>(null);
  readonly sortOrder = model<StarSortOrder>(1);
  /** Case- and accent-insensitive text search over all columns. */
  readonly globalFilter = input('');
  /** Column filter values by column `field` (columns with `filter` set). Two-way. */
  readonly filters = model<StarColumnFilters>({});

  /** Server mode: the table only renders `value`; it emits `lazyLoad` for every change. */
  readonly lazy = input(false, { transform: booleanAttribute });
  /** Total rows on the server (lazy mode). */
  readonly totalRecords = input(0);

  readonly selectionMode = input<'single' | 'multiple' | null>(null);
  readonly selection = model<readonly T[]>([]);

  /**
   * Keys (`dataKey`) of the expanded rows. Two-way. Rows expand only when the table has an
   * `starRowExpansion` template.
   */
  readonly expandedKeys = model<readonly unknown[]>([]);
  /** `'single'`: opening a row closes the other rows. */
  readonly rowExpandMode = input<'single' | 'multiple'>('multiple');

  /** Shows a Columns button: the user can hide columns (and move them, with `reorderableColumns`). */
  readonly columnToggle = input(false, { transform: booleanAttribute });
  /** The user can move a column: drag its header, or use the Columns panel. */
  readonly reorderableColumns = input(false, { transform: booleanAttribute });
  /** The user can change a column width: drag the header edge, or use the arrow keys on it. */
  readonly resizableColumns = input(false, { transform: booleanAttribute });
  /** Column `field`s in display order. Columns not in the list keep their place after it. Two-way. */
  readonly columnOrder = model<readonly string[]>([]);
  /** `field`s of the hidden columns. Two-way. */
  readonly hiddenColumns = model<readonly string[]>([]);
  /** Column widths in pixels by `field`, set by the user. Two-way. */
  readonly columnWidths = model<Readonly<Record<string, number>>>({});

  /**
   * Sort by more than one column: Shift + click (or Shift + Enter) on a header adds it as the
   * next sort column. A plain click sorts by that column only.
   */
  readonly multiSort = input(false, { transform: booleanAttribute });
  /** Sort columns in priority order with `multiSort`. Two-way. */
  readonly sortMeta = model<readonly StarSortState[]>([]);
  /**
   * Group heading of a row (property name or function). Rows with the same heading show
   * together under it, in the order in which the headings first appear after sorting.
   * With `virtualScroll`, the rows of a closed group take no space.
   */
  readonly groupBy = input<StarOptionKey<T> | null>(null);
  /** Headings of the closed groups. Two-way. */
  readonly collapsedGroups = model<readonly string[]>([]);
  /**
   * Adds "Move up" / "Move down" buttons to each row. The buttons work while the table shows
   * `value` in its own order (no sort, no filter, no groups).
   */
  readonly reorderableRows = input(false, { transform: booleanAttribute });
  /**
   * Remembers sort, filters, column order, hidden columns, column widths, page size and
   * closed groups in the browser under this key, and restores them on the next visit.
   */
  readonly stateKey = input<string | null>(null);
  readonly stateStorage = input<'local' | 'session'>('local');

  readonly rowClick = output<T>();
  readonly rowReorder = output<StarRowReorderEvent<T>>();
  /** The user changed an editable cell (see `StarColumn.editable`). */
  readonly cellEdit = output<StarCellEditEvent<T>>();
  readonly lazyLoad = output<StarLazyLoadEvent>();

  /** The cell in edit mode: `<row key>|<field>` text, or `null`. */
  private readonly editing = signal<string | null>(null);
  private readonly cellTemplates = contentChildren(StarCellTemplate);
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly loadingSlot = starSlot<object>(this.slots, this, 'loading');
  protected readonly groupSlot = starSlot<StarGroupContext>(this.slots, this, 'group');
  protected readonly headerCellSlots = starSlotMap<StarHeaderCellContext<T>>(
    this.slots,
    this,
    'headerCell',
  );
  private readonly expansion = contentChild(StarRowExpansionTemplate);
  protected readonly expansionTemplate = computed(
    () => (this.expansion()?.template as TemplateRef<StarRowContext<T>> | undefined) ?? null,
  );
  protected readonly expandable = computed(() => !!this.expansion());
  protected readonly radioName = `star-table-${Math.random().toString(36).slice(2)}`;
  protected readonly clickable = computed(() => this.selectionMode() === 'single');

  /** All columns in display order: frozen columns first, then `columnOrder`. */
  protected readonly orderedColumns = computed(() => {
    const order = this.columnOrder();
    const rank = (column: StarColumn<T>, index: number) => {
      const position = order.indexOf(column.field);
      return (column.frozen ? 0 : 1e6) + (position < 0 ? order.length + index : position);
    };
    return this.columns()
      .map((column, index) => ({ column, rank: rank(column, index) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ column }) => column);
  });

  protected readonly visibleColumns = computed(() => {
    const hidden = this.hiddenColumns();
    return this.orderedColumns().filter((column) => !hidden.includes(column.field));
  });

  protected readonly dragField = signal<string | null>(null);
  protected readonly dropField = signal<string | null>(null);
  private resizing = false;

  protected readonly hasColumnFilters = computed(() =>
    this.visibleColumns().some((column) => column.filter),
  );

  /** Columns that have a filter value now, with that value. */
  private readonly activeFilters = computed(() => {
    const filters = this.filters();
    return this.columns().flatMap((column) => {
      const query = filters[column.field];
      return column.filter && isActiveFilter(query) ? [{ column, query }] : [];
    });
  });

  private readonly filtered = computed(() => {
    if (this.lazy()) return this.value();
    const query = this.globalFilter();
    const active = this.activeFilters();
    if (!query && !active.length) return this.value();
    return this.value().filter(
      (row) =>
        (!query ||
          this.columns().some((column) => matchesFilter(this.cellText(row, column), query))) &&
        active.every(({ column, query: value }) => this.matchesColumnFilter(row, column, value)),
    );
  });

  /** Sort columns in priority order. */
  private readonly sorts = computed<readonly StarSortState[]>(() => {
    const meta = this.sortMeta();
    if (this.multiSort() && meta.length) return meta;
    const field = this.sortField();
    return field ? [{ field, order: this.sortOrder() }] : [];
  });

  private readonly sorted = computed(() => {
    let rows = this.filtered();
    if (this.lazy()) return rows;
    const sorts = this.sorts().flatMap((sort) => {
      const column = this.columns().find((c) => c.field === sort.field);
      return column ? [{ column, order: sort.order }] : [];
    });
    if (sorts.length) {
      rows = [...rows].sort((a, b) => {
        for (const { column, order } of sorts) {
          const result = compareValues(this.cellValue(a, column), this.cellValue(b, column));
          if (result) return order * result;
        }
        return 0;
      });
    }
    if (!this.groupBy()) return rows;
    // Keep each group together, in the order in which the groups first appear.
    const rank = new Map<string, number>();
    for (const row of rows) {
      const group = this.groupOf(row);
      if (!rank.has(group)) rank.set(group, rank.size);
    }
    return rows
      .map((row, index) => ({ row, index, rank: rank.get(this.groupOf(row)) ?? 0 }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ row }) => row);
  });

  /** First row index of each group on the page, with the heading and the row count. */
  private readonly groupStarts = computed(() => {
    const starts = new Map<number, { label: string; count: number }>();
    if (!this.groupBy()) return starts;
    let current: { label: string; count: number } | null = null;
    this.pageRows().forEach((row, index) => {
      const label = this.groupOf(row);
      if (!current || current.label !== label) {
        current = { label, count: 0 };
        starts.set(index, current);
      }
      current.count++;
    });
    return starts;
  });

  protected readonly hasFooter = computed(() =>
    this.visibleColumns().some((column) => column.footer !== undefined),
  );

  /** Rows can move while the table shows `value` in its own order. */
  private readonly rowOrderIsOwn = computed(
    () =>
      !this.lazy() &&
      !this.sorts().length &&
      !this.globalFilter() &&
      !this.activeFilters().length &&
      !this.groupBy(),
  );
  private restoredKey: string | null = null;

  protected readonly total = computed(() =>
    this.lazy() ? this.totalRecords() : this.filtered().length,
  );

  protected readonly pageRows = computed(() => {
    const rows = this.sorted();
    if (this.lazy() || !this.paginator()) return rows;
    return rows.slice(this.first(), this.first() + this.rows());
  });

  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(0);
  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  /** The choice editor of the cell in edit (one cell at a time). */
  private readonly selectEditor = viewChild('selectEditor', { read: StarSelect });

  /**
   * Rows of different heights: on with `virtualRowHeights="variable"`, and with the features that
   * cannot have one fixed height (row expansion, groups, stacked layout).
   */
  protected readonly variableHeights = computed(
    () =>
      this.virtualScroll() &&
      (this.virtualRowHeights() === 'variable' ||
        this.expandable() ||
        !!this.groupBy() ||
        this.responsiveLayout() === 'stack'),
  );

  /** Header rows: the column headings, and the filter row when there is one. */
  private readonly headerRows = computed(() => (this.hasColumnFilters() ? 2 : 1));

  /** `aria-rowcount` with virtual scroll: header, body (headings, rows, detail rows) and footer. */
  protected readonly ariaRowCount = computed(() => {
    if (!this.virtualScroll()) return null;
    const body = this.layout()?.bodyRows ?? this.pageRows().length;
    return this.headerRows() + body + (this.hasFooter() ? 1 : 0);
  });

  /** Expanded row keys, for a fast look-up per row. */
  private readonly expandedSet = computed(() => new Set(this.expandedKeys()));

  /**
   * Measured heights by row key (`dataKey` value, else the row object). A row with its detail
   * row open has its own entry, so closing it again needs no new measure. Group headings use
   * their item key. The maps are not signals: `measured` counts their changes.
   */
  private readonly rowHeights = new Map<unknown, number>();
  private readonly expandedHeights = new Map<unknown, number>();
  /** Counts up when a measured height changes the height tree. */
  private readonly measured = signal(0);
  /** Counts up when the measured heights are no longer valid (the table width changed). */
  private readonly heightEpoch = signal(0);
  /** Top of the table body in the scroll area (below the sticky header), in pixels. */
  private readonly bodyOffset = signal(0);

  /** Items (group headings and rows) and their heights, with rows of different heights. */
  private readonly layout = computed<VirtualLayout<T> | null>(() => {
    if (!this.variableHeights() || this.loading()) return null;
    const rows = this.pageRows();
    const grouped = !!this.groupBy();
    const collapsed = new Set(this.collapsedGroups());
    const expandable = this.expandable();
    const expanded = this.expandedSet();
    const estimate = Math.max(1, this.virtualRowHeight());
    this.heightEpoch();
    return untracked(() => {
      // Keys of rows that left the data would stay in the maps forever: drop them now and then.
      if (this.rowHeights.size + this.expandedHeights.size > 4 * rows.length + 1000) {
        this.rowHeights.clear();
        this.expandedHeights.clear();
      }
      return buildVirtualLayout(rows, {
        groupOf: grouped ? (row) => this.groupOf(row) : null,
        isCollapsed: (label) => collapsed.has(label),
        isExpanded: (row) => expandable && expanded.has(this.trackKey(row)),
        keyOf: (row) => this.trackKey(row),
        heightOf: (item) => this.estimateOf(item, estimate),
      });
    });
  });

  /** Measured height of an item, else the estimate (a row with its detail: two rows). */
  private estimateOf(item: VirtualItem<T>, estimate: number): number {
    if (item.kind === 'group') return this.rowHeights.get(item.key) ?? estimate;
    if (!item.expanded) return this.rowHeights.get(item.key) ?? estimate;
    return (
      this.expandedHeights.get(item.key) ?? (this.rowHeights.get(item.key) ?? estimate) + estimate
    );
  }

  /** Last layout and scroll offset of `variableWindow`, to keep the view on a layout change. */
  private anchorMemo: { layout: VirtualLayout<T>; rows: readonly T[]; top: number } | null = null;
  /** Scroll offset that the next render must apply (see `variableWindow`). */
  private pendingScroll: number | null = null;

  /** Rendered items with rows of different heights. */
  private readonly variableWindow = computed(() => {
    const layout = this.layout();
    if (!layout) return null;
    this.measured();
    const rows = this.pageRows();
    let top = Math.max(0, this.scrollTop() - this.bodyOffset());
    // The items changed but not the rows nor the scroll offset (a group closed, a row opened
    // from code, the width changed): keep the item at the top of the view where it was.
    const memo = this.anchorMemo;
    if (memo && memo.layout !== layout && memo.rows === rows && memo.top === top) {
      const anchor = anchorOf(memo.layout.tree, top);
      const key = anchor ? memo.layout.items[anchor.index]?.key : undefined;
      const index = anchor ? layout.indexOfKey.get(key) : undefined;
      if (anchor && index !== undefined) {
        const kept = layout.tree.offsetOf(index) + anchor.inside;
        if (Math.abs(kept - top) > 0.5) {
          top = kept;
          this.pendingScroll = kept + untracked(this.bodyOffset);
        }
      }
    }
    this.anchorMemo = { layout, rows, top };
    const viewport = this.viewportHeight() || VIRTUAL_FALLBACK_VIEWPORT;
    return { layout, ...variableRange(layout.tree, top, viewport, VIRTUAL_BUFFER_ROWS) };
  });

  /** Key of the row (or heading) that has the focus, kept rendered outside the window. */
  private readonly focusedKey = signal<{ readonly key: unknown } | null>(null);

  /** Index of the focused item in the virtual list, or -1. */
  private readonly focusedIndex = computed(() => {
    const focused = this.focusedKey();
    if (!focused || !this.virtualScroll()) return -1;
    const layout = this.layout();
    if (layout) return layout.indexOfKey.get(focused.key) ?? -1;
    return this.pageRows().findIndex((row) => Object.is(this.trackKey(row), focused.key));
  });

  /** The lines of the body: spacers, group headings and rows, in display order. */
  protected readonly bodyEntries = computed<readonly BodyEntry<T>[]>(() => {
    const rows = this.pageRows();
    if (!this.virtualScroll()) {
      const entries: BodyEntry<T>[] = [];
      const starts = this.groupStarts();
      rows.forEach((row, index) => {
        const group = starts.get(index);
        if (group) {
          entries.push({
            kind: 'group',
            key: groupKey(group.label),
            ...group,
            aria: null,
            item: null,
          });
        }
        entries.push({ kind: 'row', key: this.trackKey(row), row, index, aria: null, item: null });
      });
      return entries;
    }
    const header = this.headerRows();
    const focused = this.focusedIndex();
    const variable = this.variableWindow();
    if (variable) {
      const { layout } = variable;
      return this.windowEntries(
        variable,
        focused,
        layout.tree.total,
        (i) => layout.tree.offsetOf(i),
        (i) => {
          const item = layout.items[i];
          const aria = header + item.aria + 1;
          return item.kind === 'group'
            ? { kind: 'group', key: item.key, label: item.label, count: item.count, aria, item: i }
            : { kind: 'row', key: item.key, row: item.row, index: item.index, aria, item: i };
        },
      );
    }
    const height = Math.max(1, this.virtualRowHeight());
    const window = this.virtualWindow();
    return this.windowEntries(
      window,
      focused,
      rows.length * height,
      (i) => i * height,
      (i) => ({
        kind: 'row',
        key: this.trackKey(rows[i]),
        row: rows[i],
        index: i,
        aria: header + i + 1,
        item: i,
      }),
    );
  });

  /**
   * Entries of the window `[start, end)` and of the focused item outside it, with a spacer for
   * each gap, so the body keeps the full height.
   */
  private windowEntries(
    window: { readonly start: number; readonly end: number },
    focused: number,
    total: number,
    offsetOf: (index: number) => number,
    entryAt: (index: number) => BodyEntry<T>,
  ): BodyEntry<T>[] {
    const indexes: number[] = [];
    if (focused >= 0 && focused < window.start) indexes.push(focused);
    for (let i = window.start; i < window.end; i++) indexes.push(i);
    if (focused >= window.end) indexes.push(focused);
    const entries: BodyEntry<T>[] = [];
    let cursor = 0;
    let spacers = 0;
    const spacer = (height: number) => {
      if (height > 0.01) entries.push({ kind: 'spacer', key: `\u0000spacer${spacers++}`, height });
    };
    for (const index of indexes) {
      spacer(offsetOf(index) - offsetOf(cursor));
      entries.push(entryAt(index));
      cursor = index + 1;
    }
    if (indexes.length) spacer(total - offsetOf(cursor));
    return entries;
  }

  /** First rendered row and the heights of the rows left out before and after the window. */
  protected readonly virtualWindow = computed(() => {
    const count = this.pageRows().length;
    if (!this.virtualScroll() || this.loading() || this.variableHeights())
      return { start: 0, end: count, before: 0, after: 0 };
    const height = Math.max(1, this.virtualRowHeight());
    const viewport = this.viewportHeight() || VIRTUAL_FALLBACK_VIEWPORT;
    const visible = Math.ceil(viewport / height);
    const first = Math.min(Math.floor(this.scrollTop() / height), Math.max(0, count - visible));
    const start = Math.max(0, first - VIRTUAL_BUFFER_ROWS);
    const end = Math.min(count, first + visible + VIRTUAL_BUFFER_ROWS);
    return { start, end, before: start * height, after: (count - end) * height };
  });

  protected onScroll(event: Event): void {
    if (!this.virtualScroll()) return;
    const viewport = event.target as HTMLElement;
    this.scrollTop.set(viewport.scrollTop);
    this.viewportHeight.set(viewport.clientHeight);
  }

  /** Rendered rows that the ResizeObserver watches (rows of different heights only). */
  private readonly observedRows = new Set<Element>();
  private rowObserver: ResizeObserver | null = null;

  /**
   * Measures the rendered items, stores their heights, and moves the scroll offset by the change
   * of the items above the first item in view, so the rows in view do not move (scroll
   * anchoring). Runs after a render and when the ResizeObserver reports a row size change.
   */
  private measureRendered(): void {
    const layout = untracked(this.layout);
    const scroller = this.scroller()?.nativeElement;
    const body = this.body()?.nativeElement;
    // A hidden table (display: none, a closed tab) has no layout: keep the heights it has.
    if (!layout || !scroller || !body || !scroller.isConnected || !scroller.clientHeight) return;
    if (this.pendingScroll !== null) {
      scroller.scrollTop = this.pendingScroll;
      this.pendingScroll = null;
    }
    const area = scroller.getBoundingClientRect();
    const offset =
      body.getBoundingClientRect().top - area.top - scroller.clientTop + scroller.scrollTop;
    const heights = new Map<number, number>();
    for (const row of Array.from(body.children) as HTMLElement[]) {
      const item = row.dataset['vi'];
      if (item === undefined) continue;
      heights.set(
        Number(item),
        (heights.get(Number(item)) ?? 0) + row.getBoundingClientRect().height,
      );
    }
    const { tree, items } = layout;
    const anchor = tree.indexAt(scroller.scrollTop - offset);
    const changes: HeightChange[] = [];
    for (const [index, height] of heights) {
      const item = items[index];
      if (!item || height <= 0) continue;
      const from = tree.get(index);
      if (Math.abs(height - from) < MEASURE_TOLERANCE) continue;
      tree.set(index, height);
      changes.push({ index, from, to: height });
      (item.kind === 'row' && item.expanded ? this.expandedHeights : this.rowHeights).set(
        item.key,
        height,
      );
    }
    const shift = anchorShift(changes, anchor);
    if (Math.abs(shift) >= 0.5) scroller.scrollTop += shift;
    this.bodyOffset.set(offset);
    this.viewportHeight.set(scroller.clientHeight);
    this.scrollTop.set(scroller.scrollTop);
    if (changes.length) this.measured.update((count) => count + 1);
    this.observeRows(body);
  }

  /** Watches the rendered rows and the body for size changes (content, fonts, images). */
  private observeRows(body: HTMLElement): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.rowObserver ??= new ResizeObserver(() => this.measureRendered());
    const rows = new Set<Element>([
      body,
      ...Array.from(body.querySelectorAll(':scope > tr[data-vi]')),
    ]);
    for (const row of this.observedRows) {
      if (!rows.has(row)) {
        this.rowObserver.unobserve(row);
        this.observedRows.delete(row);
      }
    }
    for (const row of rows) {
      if (!this.observedRows.has(row)) {
        this.rowObserver.observe(row);
        this.observedRows.add(row);
      }
    }
  }

  /** Index in the virtual list of the item that holds an element, or -1. */
  private itemOf(element: Element | null): number {
    const row = element?.closest<HTMLElement>('tr[data-vi]');
    return row && this.body()?.nativeElement.contains(row) ? Number(row.dataset['vi']) : -1;
  }

  /** Key of an item of the virtual list. */
  private keyOfItem(index: number): unknown {
    const layout = this.layout();
    if (layout) return layout.items[index]?.key;
    const row = this.pageRows()[index];
    return row === undefined ? undefined : this.trackKey(row);
  }

  protected onBodyFocusIn(event: FocusEvent): void {
    if (!this.virtualScroll()) return;
    const index = this.itemOf(event.target as Element);
    if (index < 0) return;
    const key = this.keyOfItem(index);
    if (!Object.is(this.focusedKey()?.key, key)) this.focusedKey.set({ key });
    // The browser scrolled the focused element into view: render the rows around it now, so the
    // next Tab finds the next row.
    const scroller = this.scroller()?.nativeElement;
    if (scroller) {
      this.scrollTop.set(scroller.scrollTop);
      if (scroller.clientHeight) this.viewportHeight.set(scroller.clientHeight);
    }
  }

  protected onBodyFocusOut(event: FocusEvent): void {
    if (!this.virtualScroll()) return;
    const body = this.body()?.nativeElement;
    const next = event.relatedTarget as Node | null;
    if (!body || (next && body.contains(next))) return;
    // The focus left the body (not only the window of the browser): the row may leave the DOM.
    setTimeout(() => {
      if (!body.contains(this.document.activeElement)) this.focusedKey.set(null);
    });
  }

  /**
   * Tab and Shift + Tab from a row to a row that is not rendered (the focused row is kept
   * outside the window): scroll that row in, then focus its first (or last) control.
   */
  protected onBodyKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.virtualScroll() || event.defaultPrevented) return;
    const body = this.body()?.nativeElement;
    const index = this.itemOf(event.target as Element);
    if (!body || index < 0) return;
    const step = event.shiftKey ? -1 : 1;
    const target = index + step;
    const count = this.layout()?.items.length ?? this.pageRows().length;
    if (target < 0 || target >= count || body.querySelector(`:scope > tr[data-vi="${target}"]`)) {
      return;
    }
    const own = this.focusablesOf(body, index);
    const position = own.indexOf(event.target as HTMLElement);
    if (position < 0 || (step === 1 ? position < own.length - 1 : position > 0)) return;
    event.preventDefault();
    this.revealItem(target);
    afterNextRender(
      () => {
        // The first row after (or before) the focused one that has a control.
        for (let i = target; i >= 0 && i < count; i += step) {
          const controls = this.focusablesOf(body, i);
          if (!body.querySelector(`:scope > tr[data-vi="${i}"]`)) break;
          if (controls.length) {
            (step === 1 ? controls[0] : controls[controls.length - 1]).focus();
            return;
          }
        }
      },
      { injector: this.injector },
    );
    // Render now, not at the next scheduled change detection: the row is rendered and focused
    // before this key event ends. On a slow device the next Tab can arrive before a scheduled
    // render, and it would then start from the old row, so one Tab would be lost or repeated.
    this.appRef.tick();
  }

  private focusablesOf(body: HTMLElement, index: number): HTMLElement[] {
    return Array.from(
      body.querySelectorAll<HTMLElement>(`:scope > tr[data-vi="${index}"]`),
    ).flatMap((row) => Array.from(row.querySelectorAll<HTMLElement>(FOCUSABLE)));
  }

  /** Scrolls an item of the virtual list to the middle of the view. */
  private revealItem(index: number): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller) return;
    const layout = this.layout();
    const offset = layout
      ? layout.tree.offsetOf(index)
      : index * Math.max(1, this.virtualRowHeight());
    scroller.scrollTop = Math.max(0, this.bodyOffset() + offset - scroller.clientHeight / 2);
    this.scrollTop.set(scroller.scrollTop);
    if (scroller.clientHeight) this.viewportHeight.set(scroller.clientHeight);
  }

  protected readonly skeletonRows = computed(() =>
    Array.from({ length: Math.min(this.rows(), 8) }, (_, i) => i),
  );
  protected readonly colspan = computed(
    () =>
      this.visibleColumns().length +
      (this.selectionMode() ? 1 : 0) +
      (this.expandable() ? 1 : 0) +
      (this.reorderableRows() ? 1 : 0),
  );

  /** Selection state of the rows on the current page, for the header checkbox. */
  protected readonly pageState = computed<boolean | 'mixed'>(() => {
    const rows = this.pageRows();
    const count = rows.filter((row) => this.isSelected(row)).length;
    if (!rows.length || count === 0) return false;
    return count === rows.length ? true : 'mixed';
  });

  constructor() {
    // A new filter goes back to page 1. Lazy tables also load the first page on init.
    effect(() => {
      this.globalFilter();
      this.filters();
      untracked(() => {
        this.first.set(0);
        this.emitLazy();
      });
    });
    afterRenderEffect({ read: () => this.measureFrozen() });
    // Rows of different heights: measure the rendered rows after each render of the body.
    afterRenderEffect(() => {
      this.bodyEntries();
      this.expandedKeys();
      if (this.variableHeights()) untracked(() => this.measureRendered());
    });
    const destroyRef = inject(DestroyRef);
    if (typeof ResizeObserver !== 'undefined') {
      let width: number | null = null;
      const observer = new ResizeObserver((entries) => {
        this.resized.update((count) => count + 1);
        // A new width wraps text differently (or stacks the rows): the measured heights are
        // estimates again. The rendered rows are measured again right away.
        const next = Math.round(entries[entries.length - 1].contentRect.width);
        if (width !== null && next !== width && untracked(this.variableHeights)) {
          this.rowHeights.clear();
          this.expandedHeights.clear();
          this.heightEpoch.update((count) => count + 1);
        }
        width = next;
      });
      observer.observe(this.host.nativeElement);
      destroyRef.onDestroy(() => observer.disconnect());
    }
    destroyRef.onDestroy(() => this.rowObserver?.disconnect());
    if (isDevMode()) {
      effect(() => {
        if (this.virtualScroll() && !this.scrollHeight()) {
          console.warn(
            'star-table: virtualScroll needs scrollHeight. Without it the table does not scroll inside its own area, and rows after the first window are not rendered.',
          );
        }
        if (this.virtualRowHeights() === 'variable' && !this.virtualScroll()) {
          console.warn('star-table: virtualRowHeights has no effect without virtualScroll.');
        }
      });
    }
    // Saved state: restore once per key, then save every change.
    effect(() => {
      const key = this.stateKey();
      if (!key) return;
      if (this.restoredKey !== key) {
        this.restoredKey = key;
        untracked(() => this.restoreState(key));
      }
      const state: StarTableState = {
        sortField: this.sortField(),
        sortOrder: this.sortOrder(),
        sortMeta: this.sortMeta(),
        filters: this.filters(),
        columnOrder: this.columnOrder(),
        hiddenColumns: this.hiddenColumns(),
        columnWidths: this.columnWidths(),
        rows: this.rows(),
        collapsedGroups: this.collapsedGroups(),
      };
      try {
        this.storage()?.setItem(key, JSON.stringify(state));
      } catch {
        // Storage can be full or blocked: the table then works without saved state.
      }
    });
  }

  private storage(): Storage | null {
    const view = this.document.defaultView;
    try {
      return (
        (this.stateStorage() === 'session' ? view?.sessionStorage : view?.localStorage) ?? null
      );
    } catch {
      return null;
    }
  }

  private restoreState(key: string): void {
    let state: StarTableState;
    try {
      state = JSON.parse(this.storage()?.getItem(key) ?? 'null') as StarTableState;
    } catch {
      return;
    }
    if (!state || typeof state !== 'object') return;
    if (state.sortField !== undefined) this.sortField.set(state.sortField);
    if (state.sortOrder === 1 || state.sortOrder === -1) this.sortOrder.set(state.sortOrder);
    if (Array.isArray(state.sortMeta)) this.sortMeta.set(state.sortMeta);
    if (state.filters && typeof state.filters === 'object') this.filters.set(state.filters);
    if (Array.isArray(state.columnOrder)) this.columnOrder.set(state.columnOrder);
    if (Array.isArray(state.hiddenColumns)) this.hiddenColumns.set(state.hiddenColumns);
    if (state.columnWidths && typeof state.columnWidths === 'object') {
      this.columnWidths.set(state.columnWidths);
    }
    if (typeof state.rows === 'number' && state.rows > 0) this.rows.set(state.rows);
    if (Array.isArray(state.collapsedGroups)) this.collapsedGroups.set(state.collapsedGroups);
  }

  /** Removes the saved state of this table (`stateKey`). The current view does not change. */
  clearState(): void {
    const key = this.stateKey();
    if (key) this.storage()?.removeItem(key);
  }

  protected groupOf(row: T): string {
    const key = this.groupBy();
    const group = key ? readOption(row, key) : null;
    return group === null || group === undefined ? '' : String(group);
  }

  protected isGroupCollapsed(label: string): boolean {
    return this.collapsedGroups().includes(label);
  }

  protected isRowCollapsed(row: T): boolean {
    return !!this.groupBy() && this.isGroupCollapsed(this.groupOf(row));
  }

  protected toggleGroup(label: string): void {
    this.collapsedGroups.update((groups) =>
      groups.includes(label) ? groups.filter((group) => group !== label) : [...groups, label],
    );
  }

  protected footerText(column: StarColumn<T>): string {
    const footer = column.footer;
    if (footer === undefined) return '';
    return typeof footer === 'function' ? footer(this.sorted()) : footer;
  }

  protected canMoveRow(row: T, step: 1 | -1): boolean {
    if (!this.rowOrderIsOwn()) return false;
    const to = this.value().indexOf(row) + step;
    return to >= 0 && to < this.value().length;
  }

  protected moveRow(row: T, step: 1 | -1): void {
    if (!this.canMoveRow(row, step)) return;
    const from = this.value().indexOf(row);
    this.rowReorder.emit({ row, from, to: from + step });
  }

  protected trackKey(row: T): unknown {
    return readOption(row, this.dataKey());
  }

  protected cellTemplate(field: string): TemplateRef<StarCellContext<T>> | null {
    return this.cellTemplates().find((t) => t.starCell() === field)?.template ?? null;
  }

  protected cellValue(row: T, column: StarColumn<T>): unknown {
    return column.value
      ? column.value(row)
      : (row as Record<string, unknown> | null)?.[column.field];
  }

  protected cellText(row: T, column: StarColumn<T>): string {
    if (column.format) return column.format(row);
    const value = this.cellValue(row, column);
    return value === null || value === undefined ? '' : String(value);
  }

  protected isHidden(column: StarColumn<T>): boolean {
    return this.hiddenColumns().includes(column.field);
  }

  /** A column can hide unless it is locked or it is the last visible column. */
  protected canHide(column: StarColumn<T>): boolean {
    if (column.hideable === false) return false;
    return this.isHidden(column) || this.visibleColumns().length > 1;
  }

  protected setColumnVisible(column: StarColumn<T>, visible: boolean): void {
    this.hiddenColumns.update((hidden) =>
      visible ? hidden.filter((field) => field !== column.field) : [...hidden, column.field],
    );
  }

  /** Moves a column to the place of another column. */
  moveColumn(field: string, targetField: string): void {
    const fields = this.orderedColumns().map((column) => column.field);
    const from = fields.indexOf(field);
    const to = fields.indexOf(targetField);
    if (from < 0 || to < 0 || from === to) return;
    fields.splice(to, 0, ...fields.splice(from, 1));
    this.columnOrder.set(fields);
  }

  protected moveColumnBy(column: StarColumn<T>, delta: 1 | -1): void {
    const fields = this.orderedColumns().map((item) => item.field);
    const target = fields[fields.indexOf(column.field) + delta];
    if (!target) return;
    this.moveColumn(column.field, target);
    // The list in the Columns panel moves the button in the DOM, which drops the focus (and a
    // button at the end of the list becomes disabled). Keep the focus in the panel: on the same
    // button, or on the one for the other direction when that one is now disabled.
    this.focusMoveButton(column, delta);
  }

  /** Identifies a move button of the Columns panel, for `focusMoveButton`. */
  protected moveKey(column: StarColumn<T>, delta: 1 | -1): string {
    return `${this.radioName}|${column.field}|${delta}`;
  }

  private focusMoveButton(column: StarColumn<T>, delta: 1 | -1): void {
    afterNextRender(
      () => {
        // The panel is in the overlay container, not inside the table element.
        const button = (step: 1 | -1) =>
          this.document.querySelector<HTMLButtonElement>(
            `[data-move="${CSS.escape(this.moveKey(column, step))}"]`,
          );
        const same = button(delta);
        (same && !same.disabled ? same : button(delta === 1 ? -1 : 1))?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onDragStart(column: StarColumn<T>, event: DragEvent): void {
    if (this.resizing || !this.reorderableColumns()) {
      event.preventDefault();
      return;
    }
    this.dragField.set(column.field);
    event.dataTransfer?.setData('text/plain', column.field);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(column: StarColumn<T>, event: DragEvent): void {
    const field = this.dragField();
    if (!field || field === column.field) return;
    event.preventDefault();
    this.dropField.set(column.field);
  }

  protected onDrop(column: StarColumn<T>, event: DragEvent): void {
    const field = this.dragField();
    if (!field) return;
    event.preventDefault();
    this.moveColumn(field, column.field);
    this.endDrag();
  }

  protected endDrag(): void {
    this.dragField.set(null);
    this.dropField.set(null);
  }

  protected widthOf(column: StarColumn<T>): string | null {
    return this.resizedWidth(column) ?? column.width ?? null;
  }

  protected resizedWidth(column: StarColumn<T>): string | null {
    const width = this.columnWidths()[column.field];
    return width ? `${width}px` : null;
  }

  /** Rendered width in pixels of each frozen header cell, by column `field`. */
  private readonly frozenWidths = signal<Readonly<Record<string, number>>>({});
  /** Rendered width in pixels of each header cell, by column `field` (resizable tables only). */
  private readonly headerWidths = signal<Readonly<Record<string, number>>>({});
  /** The scroll area has content outside its box, so it must take the focus to scroll by key. */
  protected readonly scrollable = signal(false);
  protected readonly minColumnWidth = MIN_COLUMN_WIDTH;

  /** `aria-valuenow` of a resize handle: the width of the column in pixels. */
  protected resizeNow(column: StarColumn<T>): number | null {
    const width = this.columnWidths()[column.field] ?? this.headerWidths()[column.field];
    return width === undefined ? null : Math.round(width);
  }

  protected resizeMax(column: StarColumn<T>): number {
    return Math.max(MAX_COLUMN_WIDTH_HINT, this.resizeNow(column) ?? 0);
  }
  /** Counts up when the table element changes size, so the frozen columns are measured again. */
  private readonly resized = signal(0);

  /** Measures the frozen header cells after a render that can change their width. */
  private measureFrozen(): void {
    const frozen = this.visibleColumns().filter((column) => column.frozen);
    // Read what can change a width, so the effect runs again when it does.
    this.columnWidths();
    this.value();
    this.size();
    this.resized();
    const scroller = this.scroller()?.nativeElement;
    if (scroller) {
      this.scrollable.set(
        scroller.scrollWidth > scroller.clientWidth + 1 ||
          scroller.scrollHeight > scroller.clientHeight + 1,
      );
    }
    const resizable = this.resizableColumns();
    if (!frozen.length && !resizable) return;
    const widths: Record<string, number> = {};
    const all: Record<string, number> = {};
    for (const cell of this.host.nativeElement.querySelectorAll<HTMLElement>(
      'thead th[data-field]',
    )) {
      const field = cell.dataset['field'];
      if (!field) continue;
      const width = cell.getBoundingClientRect().width;
      all[field] = width;
      if (frozen.some((column) => column.field === field)) widths[field] = width;
    }
    const sameWidths = (
      next: Readonly<Record<string, number>>,
      current: Readonly<Record<string, number>>,
    ) =>
      Object.keys(next).length === Object.keys(current).length &&
      Object.entries(next).every(
        ([field, width]) => Math.abs((current[field] ?? -1) - width) < 0.5,
      );
    if (!sameWidths(widths, untracked(this.frozenWidths))) this.frozenWidths.set(widths);
    if (resizable && !sameWidths(all, untracked(this.headerWidths))) this.headerWidths.set(all);
  }

  /**
   * Offset of a frozen column: the widths of the frozen columns before it. Uses the measured
   * widths; before the first measure (and where layout is not available) the declared widths.
   */
  protected frozenOffset(column: StarColumn<T>): string | null {
    if (!column.frozen) return null;
    const measured = this.frozenWidths();
    const before: string[] = [];
    let pixels = 0;
    let allMeasured = true;
    for (const item of this.visibleColumns()) {
      if (item === column) break;
      if (!item.frozen) continue;
      before.push(this.widthOf(item) ?? '0px');
      const width = measured[item.field];
      if (width) pixels += width;
      else allMeasured = false;
    }
    if (!before.length) return '0px';
    return allMeasured ? `${Math.round(pixels * 100) / 100}px` : `calc(${before.join(' + ')})`;
  }

  private setWidth(column: StarColumn<T>, width: number): void {
    const next = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
    this.columnWidths.update((widths) => ({ ...widths, [column.field]: next }));
  }

  protected startResize(column: StarColumn<T>, event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    const header = handle.closest('th');
    if (!header) return;
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    const direction = starIsRtl(header) ? -1 : 1;
    const startWidth = header.offsetWidth;
    const startX = event.clientX;
    handle.setPointerCapture?.(event.pointerId);
    const move = (moveEvent: PointerEvent) =>
      this.setWidth(column, startWidth + direction * (moveEvent.clientX - startX));
    const stop = () => {
      this.resizing = false;
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }

  protected onResizeKey(column: StarColumn<T>, event: KeyboardEvent): void {
    const step = event.key === 'ArrowRight' ? 16 : event.key === 'ArrowLeft' ? -16 : 0;
    if (!step) return;
    event.preventDefault();
    const header = (event.currentTarget as HTMLElement).closest('th');
    const direction = starIsRtl(header) ? -1 : 1;
    this.setWidth(
      column,
      (this.columnWidths()[column.field] ?? header?.offsetWidth ?? 0) + direction * step,
    );
  }

  protected editKey(row: T, column: StarColumn<T>): string {
    return `${String(this.trackKey(row))}|${column.field}`;
  }

  protected isEditable(row: T, column: StarColumn<T>): boolean {
    return typeof column.editable === 'function' ? column.editable(row) : !!column.editable;
  }

  protected isEditing(row: T, column: StarColumn<T>): boolean {
    return this.editing() === this.editKey(row, column);
  }

  /** Text in the editor: the raw value, so a formatted cell (date, currency) edits its data. */
  protected editText(row: T, column: StarColumn<T>): string {
    const value = this.cellValue(row, column);
    return value === null || value === undefined ? '' : String(value);
  }

  protected startEdit(row: T, column: StarColumn<T>): void {
    this.editing.set(this.editKey(row, column));
    if (column.editor !== 'select') {
      this.focusAfterRender('.star-table__editor', true);
      return;
    }
    // A choice editor opens its list at once, with the focus on the field.
    afterNextRender(
      () => {
        const editor = this.selectEditor();
        editor?.focus();
        editor?.openPanel();
      },
      { injector: this.injector },
    );
  }

  /**
   * The list of a choice editor closed. A choice has already committed (and closed the editor);
   * else the edit ends without a change. The focus goes back to the cell only when it is still
   * on the editor, so Tab or a click elsewhere keeps the focus where the user moved it.
   */
  protected onEditorClosed(row: T, column: StarColumn<T>): void {
    if (!this.isEditing(row, column)) return;
    const editor = this.host.nativeElement.querySelector('.star-table__editor');
    const focused = this.document.activeElement;
    if (editor && focused && editor.contains(focused)) this.closeEditor(row, column);
    else this.editing.set(null);
  }

  protected commitEdit(row: T, column: StarColumn<T>, text: string): void {
    // Enter removes the editor, which also fires `blur`: only the first event commits.
    if (!this.isEditing(row, column)) return;
    const previous = this.cellValue(row, column);
    const value = column.editor === 'number' ? (text.trim() === '' ? null : Number(text)) : text;
    this.closeEditor(row, column);
    if (typeof value === 'number' && Number.isNaN(value)) return;
    if (Object.is(value, previous) || (value === '' && (previous ?? '') === '')) return;
    this.cellEdit.emit({ row, field: column.field, value, previous });
  }

  protected cancelEdit(event: Event): void {
    event.stopPropagation();
    const key = this.editing();
    this.editing.set(null);
    if (key) this.focusAfterRender(`[data-edit="${CSS.escape(key)}"]`);
  }

  private closeEditor(row: T, column: StarColumn<T>): void {
    const key = this.editKey(row, column);
    this.editing.set(null);
    this.focusAfterRender(`[data-edit="${CSS.escape(key)}"]`);
  }

  private focusAfterRender(selector: string, select = false): void {
    afterNextRender(
      () => {
        const target = this.host.nativeElement.querySelector<HTMLElement>(selector);
        target?.focus();
        if (select && target instanceof HTMLInputElement && target.type === 'text') target.select();
      },
      { injector: this.injector },
    );
  }

  protected isExpanded(row: T): boolean {
    return this.expandedSet().has(this.trackKey(row));
  }

  protected detailId(index: number): string {
    return `${this.radioName}-detail-${index}`;
  }

  /** Opens or closes the detail of one row. */
  toggleExpansion(row: T): void {
    const key = this.trackKey(row);
    if (this.isExpanded(row)) {
      this.expandedKeys.update((keys) => keys.filter((expanded) => !Object.is(expanded, key)));
    } else {
      this.expandedKeys.update((keys) =>
        this.rowExpandMode() === 'single' ? [key] : [...keys, key],
      );
    }
  }

  /** Opens the detail of every row on the current page. */
  expandAll(): void {
    this.expandedKeys.set(this.pageRows().map((row) => this.trackKey(row)));
  }

  /** Closes every row detail. */
  collapseAll(): void {
    this.expandedKeys.set([]);
  }

  private matchesColumnFilter(row: T, column: StarColumn<T>, value: StarFilterValue): boolean {
    if (isRange(value)) {
      const raw = this.cellValue(row, column);
      if (column.filter === 'date') {
        const day = dayKey(raw);
        return (
          !!day &&
          (!hasBound(value.min) || day >= String(value.min)) &&
          (!hasBound(value.max) || day <= String(value.max))
        );
      }
      const amount = raw === null || raw === undefined || raw === '' ? NaN : Number(raw);
      return (
        !Number.isNaN(amount) &&
        (!hasBound(value.min) || amount >= Number(value.min)) &&
        (!hasBound(value.max) || amount <= Number(value.max))
      );
    }
    const text = this.cellText(row, column);
    if (typeof value !== 'string') return value.includes(text);
    return column.filter === 'select' ? text === value : matchesFilter(text, value);
  }

  protected filterValue(field: string): string {
    const value = this.filters()[field];
    return typeof value === 'string' ? value : '';
  }

  protected filterList(field: string): readonly string[] {
    const value = this.filters()[field];
    return Array.isArray(value) ? value : [];
  }

  protected filterBound(field: string, bound: 'min' | 'max'): string {
    const value = this.filters()[field];
    const side = isRange(value) ? value[bound] : null;
    return hasBound(side) ? String(side) : '';
  }

  protected setBound(column: StarColumn<T>, bound: 'min' | 'max', text: string): void {
    const current = this.filters()[column.field];
    const side = text === '' ? null : column.filter === 'number' ? Number(text) : text;
    this.setFilter(column.field, { ...(isRange(current) ? current : {}), [bound]: side });
  }

  protected filterChoices(column: StarColumn<T>): readonly string[] {
    if (column.filterOptions) return column.filterOptions;
    const texts = new Set(this.value().map((row) => this.cellText(row, column)));
    texts.delete('');
    return [...texts].sort((a, b) => compareValues(a, b));
  }

  protected setFilter(field: string, value: StarFilterValue): void {
    this.filters.update((filters) => ({ ...filters, [field]: value }));
  }

  /** Removes every column filter. */
  clearFilters(): void {
    this.filters.set({});
  }

  /** Columns and rows of an export: visible columns in display order, without `exportable: false`. */
  private exportData(options: StarExportOptions<T>): {
    readonly columns: readonly StarColumn<T>[];
    readonly rows: readonly T[];
  } {
    return {
      columns: this.visibleColumns().filter((column) => column.exportable !== false),
      rows: options.rows ?? (options.selectionOnly ? this.selection() : this.sorted()),
    };
  }

  /** Export text of a cell: `exportValue`, else the display text (`format` / `value`). */
  private exportText(row: T, column: StarColumn<T>): string {
    return column.exportValue ? String(column.exportValue(row) ?? '') : this.cellText(row, column);
  }

  /** A number cell stays a number in a spreadsheet when the column has no text format. */
  private exportCell(row: T, column: StarColumn<T>): StarExportCell {
    const custom = column.exportValue?.(row);
    if (typeof custom === 'number') return custom;
    const value = this.cellValue(row, column);
    return !column.exportValue && !column.format && typeof value === 'number'
      ? value
      : this.exportText(row, column);
  }

  /**
   * CSV text of the table: a header row, then the filtered rows in the current sort order
   * (all pages), or the selected rows, with the visible columns in display order. Cells use
   * the column `exportValue`, else the display text (`format` / `value`); custom cell
   * templates are not exported. In lazy mode only the loaded rows are available: pass all
   * rows with `options.rows`.
   *
   * Text that a spreadsheet would read as a formula (it starts with `=`, `+`, `-` or `@`)
   * gets a leading apostrophe, so exported user data cannot run as a formula.
   */
  toCsv(options: StarCsvOptions<T> = {}): string {
    const separator = options.separator ?? ',';
    const { columns, rows } = this.exportData(options);
    const escape = (text: string) =>
      text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    const cell = (row: T, column: StarColumn<T>) => {
      const value = this.exportCell(row, column);
      const text = String(value);
      return escape(typeof value !== 'number' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text);
    };
    return [
      columns.map((column) => escape(column.header)).join(separator),
      ...rows.map((row) => columns.map((column) => cell(row, column)).join(separator)),
    ].join('\r\n');
  }

  /** Downloads `toCsv()` as `<fileName>.csv` (UTF-8 with a byte order mark, for Excel). */
  exportCsv(options: StarCsvOptions<T> = {}): void {
    this.download(
      new Blob(['﻿', this.toCsv(options)], { type: 'text/csv;charset=utf-8' }),
      `${options.fileName ?? 'export'}.csv`,
    );
  }

  /**
   * Excel workbook (`.xlsx`) bytes of the table: same columns and rows as `toCsv()`. Number
   * cells stay numbers; text cells are plain text, never formulas.
   */
  toXlsx(options: StarExportOptions<T> = {}): Uint8Array {
    const { columns, rows } = this.exportData(options);
    return buildXlsx(
      columns.map((column) => column.header),
      rows.map((row) => columns.map((column) => this.exportCell(row, column))),
      options.title ?? this.ariaLabel() ?? undefined,
    );
  }

  /** Downloads `toXlsx()` as `<fileName>.xlsx`. */
  exportExcel(options: StarExportOptions<T> = {}): void {
    const bytes = this.toXlsx(options);
    this.download(
      new Blob([bytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${options.fileName ?? 'export'}.xlsx`,
    );
  }

  /**
   * Opens the browser print dialog with a plain table of the same columns and rows. The user
   * can print it or choose "Save as PDF". The table always fits the paper the user chooses: a
   * table that is too wide wraps its text, then gets smaller text (down to 6 pt), and last breaks
   * long words inside a cell. No column is cut off.
   */
  print(options: StarExportOptions<T> = {}): void {
    const { columns, rows } = this.exportData(options);
    const frame = this.document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = buildPrintDocument(
      options.title ?? this.ariaLabel() ?? '',
      columns.map((column) => column.header),
      rows.map((row) => columns.map((column) => this.exportCell(row, column))),
      {
        // The column definition decides the alignment, not the type of the formatted text.
        align: columns.map((column) =>
          printColumnAlign(
            column.align,
            rows.map((row) => {
              const cell = this.exportCell(row, column);
              return typeof cell === 'number' ? cell : this.cellValue(row, column);
            }),
          ),
        ),
        ...printContext(this.host.nativeElement, this.document),
      },
    );
    frame.addEventListener('load', () => {
      const view = frame.contentWindow;
      if (!view) return;
      // The document has no style element and no style attribute, so that a policy without
      // 'unsafe-inline' in style-src does not unstyle it: the styles are constructed sheets.
      stylePrintDocument(view.document);
      // The paper is not known yet. The table gets the rules that wrap it, shrink its text or
      // break its words when the paper is too narrow, so that no column is cut off.
      fitPrintDocument(view.document);
      view.addEventListener('afterprint', () => frame.remove());
      view.focus();
      view.print();
    });
    this.document.body.append(frame);
  }

  private download(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  /** Sorts by a column. With `multiSort`, `event.shiftKey` adds the column to the sort. */
  sortBy(column: StarColumn<T>, event?: MouseEvent | KeyboardEvent): void {
    const current = this.sorts().find((sort) => sort.field === column.field);
    const order: StarSortOrder = current ? (current.order === 1 ? -1 : 1) : 1;
    if (this.multiSort() && event?.shiftKey) {
      const sorts = this.sorts();
      this.sortMeta.set(
        current
          ? sorts.map((sort) => (sort.field === column.field ? { ...sort, order } : sort))
          : [...sorts, { field: column.field, order }],
      );
    } else {
      this.sortMeta.set(this.multiSort() ? [{ field: column.field, order }] : []);
    }
    // `sortField` / `sortOrder` always hold the first sort column.
    const first = this.multiSort() ? this.sortMeta()[0] : { field: column.field, order };
    this.sortField.set(first.field);
    this.sortOrder.set(first.order);
    this.first.set(0);
    this.emitLazy();
  }

  private sortOf(column: StarColumn<T>): StarSortState | undefined {
    return this.sorts().find((sort) => sort.field === column.field);
  }

  /** `aria-sort` goes on one column only: the first sort column. */
  protected ariaSort(column: StarColumn<T>): string | null {
    if (!column.sortable) return null;
    const first = this.sorts()[0];
    if (first?.field !== column.field) return 'none';
    return first.order === 1 ? 'ascending' : 'descending';
  }

  protected sortIcon(column: StarColumn<T>): string {
    const sort = this.sortOf(column);
    if (!sort) return 'ph-bold ph-arrows-down-up star-table__sort-idle';
    return sort.order === 1 ? 'ph-bold ph-sort-ascending' : 'ph-bold ph-sort-descending';
  }

  /** Position of a column in a sort by two or more columns, else `null`. */
  protected sortRank(column: StarColumn<T>): number | null {
    const sorts = this.sorts();
    if (sorts.length < 2) return null;
    const index = sorts.findIndex((sort) => sort.field === column.field);
    return index < 0 ? null : index + 1;
  }

  /** Keys of the selected rows: a look-up per row stays fast with 50,000 selected rows. */
  private readonly selectedKeys = computed(
    () => new Set(this.selection().map((row) => this.trackKey(row))),
  );

  protected isSelected(row: T): boolean {
    return this.selectedKeys().has(this.trackKey(row));
  }

  protected toggleRow(row: T): void {
    const key = this.trackKey(row);
    this.selection.update((selection) =>
      this.isSelected(row)
        ? selection.filter((selected) => !Object.is(this.trackKey(selected), key))
        : [...selection, row],
    );
  }

  protected selectOnly(row: T): void {
    this.selection.set([row]);
  }

  protected togglePage(checked: boolean): void {
    const page = this.pageRows();
    const keys = new Set(page.map((row) => this.trackKey(row)));
    this.selection.update((selection) => {
      const others = selection.filter((row) => !keys.has(this.trackKey(row)));
      return checked ? [...others, ...page] : others;
    });
  }

  protected onRowClick(row: T, event: MouseEvent): void {
    // A click on a control, or in the list of a choice editor, is not a click on the row.
    const control = 'button, a, input, select, textarea, .star-table__editor';
    if ((event.target as HTMLElement).closest(control)) return;
    if (this.selectionMode() === 'single') this.selectOnly(row);
    this.rowClick.emit(row);
  }

  protected emitLazy(): void {
    if (!this.lazy()) return;
    this.lazyLoad.emit({
      first: this.first(),
      rows: this.rows(),
      field: this.sortField(),
      order: this.sortOrder(),
      filter: this.globalFilter(),
      filters: this.filters(),
      sorts: this.sorts(),
    });
  }
}
