import { Directive, input } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';

/** Context of the item slot of `star-order-list` and `star-pick-list`. */
export interface StarItemContext<T = unknown> {
  /** The item. */
  readonly $implicit: T;
  /** Position of the item in its list, starting at `0`. */
  readonly index: number;
  /** The item is selected. */
  readonly selected: boolean;
  /**
   * Only in `star-pick-list`: the list that holds the item (`let-list="list"`). `undefined` in
   * `star-order-list`.
   */
  readonly list?: 'source' | 'target';
}

/**
 * Replaces the label of an item in `star-order-list` and `star-pick-list`:
 * `<ng-template starItem let-item let-index="index">…</ng-template>`. PrimeNG `#item` template.
 * The item row, its `role="option"`, the keys and (in the order list) the grip icon stay.
 *
 * Each list is a listbox with its own keyboard model: every row takes the keys (arrows, Alt +
 * arrows, Enter, Space) and the click. Do not add focusable elements (buttons, links, inputs) in
 * this template.
 *
 * In `star-pick-list` the same template renders the items of both lists. Use `list` in the
 * context to tell them apart.
 */
@Directive({
  selector: 'ng-template[starItem]',
  providers: [{ provide: StarSlot, useExisting: StarItemTemplate }],
})
export class StarItemTemplate<T = unknown> extends StarSlot<StarItemContext<T>> {
  readonly name = 'item';
  /** Optional: pass the items array to type `let-item` in strict templates. */
  readonly starItemOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarItemTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarItemContext<T> {
    return true;
  }
}
