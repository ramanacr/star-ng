import { computed, Directive, inject, InjectionToken, input } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';
import type { StarPageEvent } from '@star-ng/ui/paginator';
import type { StarColumn } from './table';

/** Context of the header cell slot. */
export interface StarHeaderCellContext<T = unknown> {
  /** The column. */
  readonly $implicit: StarColumn<T>;
}

/**
 * Replaces the header label of one column in `star-table`:
 * `<ng-template starHeaderCell="customer" let-column>…</ng-template>`. This is like the column
 * header part of the PrimeNG `#header` template. The PrimeNG template replaces the whole header
 * row. This slot replaces the label of one column only.
 *
 * Only the label text changes. The sort button, the sort icon and rank, the resize handle and
 * `aria-sort` stay. On a sortable column the content goes inside the sort button, so do not add
 * focusable elements (buttons, links, inputs) in this template.
 */
@Directive({
  selector: 'ng-template[starHeaderCell]',
  providers: [{ provide: StarSlot, useExisting: StarHeaderCellTemplate }],
})
export class StarHeaderCellTemplate<T = unknown> extends StarSlot<StarHeaderCellContext<T>> {
  readonly name = 'headerCell';
  /** `field` of the column. */
  readonly starHeaderCell = input.required<string>();
  /** Optional: pass the table rows to type `let-column` in strict templates. */
  readonly starHeaderCellOf = input<readonly T[] | null>(null);

  override slotKey(): string {
    return this.starHeaderCell();
  }

  static ngTemplateContextGuard<T>(
    _dir: StarHeaderCellTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarHeaderCellContext<T> {
    return true;
  }
}

/** Context of the row edit actions slot. */
export interface StarRowEditActionsContext<T = unknown> {
  /** The row in edit. */
  readonly $implicit: T;
  /** The row in edit. */
  readonly row: T;
  /** Saves the row (blocked while a value is not valid). */
  readonly save: () => void;
  /** Cancels the edit of the row. */
  readonly cancel: () => void;
  /** `true` when all editors of the row hold valid values. */
  readonly valid: boolean;
}

/**
 * Replaces the Save and Cancel buttons of a row in edit (`editMode="row"`):
 * `<ng-template starRowEditActions let-save="save" let-cancel="cancel" let-valid="valid">…</ng-template>`.
 * PrimeNG `pSaveEditableRow` / `pCancelEditableRow` buttons. The content goes in the actions
 * cell of the row. Enter in an editor still saves and Escape still cancels.
 */
@Directive({
  selector: 'ng-template[starRowEditActions]',
  providers: [{ provide: StarSlot, useExisting: StarRowEditActionsTemplate }],
})
export class StarRowEditActionsTemplate<T = unknown> extends StarSlot<
  StarRowEditActionsContext<T>
> {
  readonly name = 'rowEditActions';
  /** Optional: pass the table rows to type `let-row` in strict templates. */
  readonly starRowEditActionsOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarRowEditActionsTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarRowEditActionsContext<T> {
    return true;
  }
}

/** Context of the `starRow` slot. */
export interface StarRowSlotContext<T = unknown> {
  /** The row. */
  readonly $implicit: T;
  /** The row. */
  readonly row: T;
  /** Index of the row in the rows of the page (`-1` for a pinned row). */
  readonly index: number;
  /** The rendered data columns, in display order. Write one `<td starTableCell>` per column. */
  readonly columns: readonly StarColumn<T>[];
  /** The row is selected. */
  readonly selected: boolean;
  /** The detail row of the row is open. */
  readonly expanded: boolean;
  /** The row is in row edit. */
  readonly editing: boolean;
  /** The row is pinned: `'top'`, `'bottom'` or `null`. */
  readonly pinned: 'top' | 'bottom' | null;
}

/**
 * Replaces the data cells of each body row: `<ng-template starRow let-row let-columns="columns">`
 * with one `<td [starTableCell]="column.field" [starTableCellRow]="row">` per column. PrimeNG
 * `#body` template. The table keeps the `<tr>` (its keys, selection, row click and context menu),
 * the lead cells (reorder, expander, selection) and the row actions cell, so the grid semantics of
 * cell navigation stay. `starTableCell` gives each cell its grid attributes (`data-field`, the
 * roving `tabindex`, `aria-colindex`, `aria-selected`). The table does not draw the editors of
 * the cells in this template.
 */
@Directive({
  selector: 'ng-template[starRow]',
  providers: [{ provide: StarSlot, useExisting: StarRowTemplate }],
})
export class StarRowTemplate<T = unknown> extends StarSlot<StarRowSlotContext<T>> {
  readonly name = 'row';
  /** Optional: pass the table rows to type `let-row` in strict templates. */
  readonly starRowOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarRowTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarRowSlotContext<T> {
    return true;
  }
}

/** Grid state of one body cell, for `starTableCell`. Internal. */
export interface ɵStarTableCellState {
  readonly field: string | null;
  readonly tabindex: number | null;
  readonly colindex: number | null;
  readonly selected: boolean | null;
  readonly columnSelected: boolean;
  readonly label: string | null;
  /** Column index for the cell keys of the tree table (`data-col`), else `null`. */
  readonly col?: number | null;
}

/** What `starTableCell` reads from its table. Internal. */
export interface ɵStarTableCellHost {
  ɵcellState(row: unknown, field: string): ɵStarTableCellState;
}

/** The table of a `starTableCell`. Internal. */
export const ɵSTAR_TABLE_CELL_HOST = new InjectionToken<ɵStarTableCellHost>(
  'ɵSTAR_TABLE_CELL_HOST',
);

/**
 * A data cell of a `starRow` template: `<td [starTableCell]="column.field" [starTableCellRow]="row">`.
 * It sets the grid attributes that the built-in cells have, so cell navigation, cell selection,
 * the context menu and paste work in the custom row.
 */
@Directive({
  selector: 'td[starTableCell]',
  host: {
    'data-star-part': 'rowCell',
    '[attr.data-field]': 'state().field',
    '[attr.tabindex]': 'state().tabindex',
    '[attr.aria-colindex]': 'state().colindex',
    '[attr.aria-selected]': 'state().selected',
    '[attr.data-label]': 'state().label',
    '[attr.data-col]': 'state().col ?? null',
    '[class.star-table__cell--selected]': 'state().selected === true',
    '[class.star-table__cell--col-selected]': 'state().columnSelected',
  },
})
export class StarTableCell {
  private readonly table = inject(ɵSTAR_TABLE_CELL_HOST);
  /** `field` of the column of the cell. */
  readonly starTableCell = input.required<string>();
  /** The row of the cell. */
  readonly starTableCellRow = input.required<unknown>();
  protected readonly state = computed(() =>
    this.table.ɵcellState(this.starTableCellRow(), this.starTableCell()),
  );
}

/** Context of the `starFooterRow` slot. */
export interface StarFooterRowContext<T = unknown> {
  /** The rendered data columns, in display order. */
  readonly $implicit: readonly StarColumn<T>[];
  /** The rendered data columns. */
  readonly columns: readonly StarColumn<T>[];
  /** The filtered rows of all pages, in sort order (in lazy mode: the loaded rows). */
  readonly rows: readonly T[];
}

/**
 * Replaces the data cells of the footer row: `<ng-template starFooterRow let-columns let-rows="rows">`
 * with `<td>` cells (one per column, or one with `colspan`). PrimeNG `#footer` template. The table
 * keeps the `<tfoot>` row and its lead and trail cells; the row shows also when no column has a
 * `footer` or a `summary`.
 */
@Directive({
  selector: 'ng-template[starFooterRow]',
  providers: [{ provide: StarSlot, useExisting: StarFooterRowTemplate }],
})
export class StarFooterRowTemplate<T = unknown> extends StarSlot<StarFooterRowContext<T>> {
  readonly name = 'footerRow';
  /** Optional: pass the table rows to type the context in strict templates. */
  readonly starFooterRowOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarFooterRowTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarFooterRowContext<T> {
    return true;
  }
}

/** Context of the `starGroupFooter` slot. */
export interface StarGroupFooterContext<T = unknown> {
  /** Group label. */
  readonly $implicit: string;
  /** The rows of the group (all pages; in lazy mode, the loaded rows). */
  readonly rows: readonly T[];
  /** The rendered data columns, in display order. */
  readonly columns: readonly StarColumn<T>[];
}

/**
 * A footer row below each group of `groupBy`: `<ng-template starGroupFooter let-label let-rows="rows">`
 * with `<td>` cells. PrimeNG `#groupfooter` template. Without it, `groupSummary` draws the summary
 * cells; with it, the template replaces them.
 */
@Directive({
  selector: 'ng-template[starGroupFooter]',
  providers: [{ provide: StarSlot, useExisting: StarGroupFooterTemplate }],
})
export class StarGroupFooterTemplate<T = unknown> extends StarSlot<StarGroupFooterContext<T>> {
  readonly name = 'groupFooter';
  /** Optional: pass the table rows to type `let-rows` in strict templates. */
  readonly starGroupFooterOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarGroupFooterTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarGroupFooterContext<T> {
    return true;
  }
}

/** Context of the paginator start and end slots: the page state. */
export interface StarTablePaginatorContext {
  readonly $implicit: StarPageEvent;
}

/**
 * Content at the start of the table paginator: `<ng-template starPaginatorStart let-state>`.
 * PrimeNG `#paginatorleft` template (here logical: start).
 */
@Directive({
  selector: 'ng-template[starPaginatorStart]',
  providers: [{ provide: StarSlot, useExisting: StarPaginatorStartTemplate }],
})
export class StarPaginatorStartTemplate extends StarSlot<StarTablePaginatorContext> {
  readonly name = 'paginatorStart';

  static ngTemplateContextGuard(
    _dir: StarPaginatorStartTemplate,
    _ctx: unknown,
  ): _ctx is StarTablePaginatorContext {
    return true;
  }
}

/**
 * Content at the end of the table paginator: `<ng-template starPaginatorEnd let-state>`.
 * PrimeNG `#paginatorright` template (here logical: end).
 */
@Directive({
  selector: 'ng-template[starPaginatorEnd]',
  providers: [{ provide: StarSlot, useExisting: StarPaginatorEndTemplate }],
})
export class StarPaginatorEndTemplate extends StarSlot<StarTablePaginatorContext> {
  readonly name = 'paginatorEnd';

  static ngTemplateContextGuard(
    _dir: StarPaginatorEndTemplate,
    _ctx: unknown,
  ): _ctx is StarTablePaginatorContext {
    return true;
  }
}
