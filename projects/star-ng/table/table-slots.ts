import { Directive, input } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';
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
