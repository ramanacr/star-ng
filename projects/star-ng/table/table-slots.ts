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
