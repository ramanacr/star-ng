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

/** The two lists of `star-pick-list`. */
export type StarPickListSide = 'source' | 'target';

/** Payload of the move, reorder and select outputs of `star-order-list` and `star-pick-list`. */
export interface StarListItemsEvent<T = unknown> {
  /** The items that moved, or the selected items. */
  readonly items: readonly T[];
}

/** Payload of the filter outputs of `star-order-list` and `star-pick-list`. */
export interface StarListFilterEvent<T = unknown> {
  /** The filter text. */
  readonly query: string;
  /** The items that match it. */
  readonly value: readonly T[];
}

/** Context of the `starListFilter` slot. */
export interface StarListFilterContext {
  /** The filter text. */
  readonly $implicit: string;
  /** Only in `star-pick-list`: the list of the filter. */
  readonly list?: StarPickListSide;
  /** Sets the filter text. */
  readonly filter: (query: string) => void;
  /** Clears the filter text. */
  readonly reset: () => void;
}

/**
 * Replaces the filter field of `star-order-list` and `star-pick-list` (shown with `filter`):
 * `<ng-template starListFilter let-query let-filter="filter">…</ng-template>`. Call `filter(text)`
 * from your own field. PrimeNG `#filter`, `#sourcefilter` and `#targetfilter` templates (use
 * `list` to tell the two lists apart).
 */
@Directive({
  selector: 'ng-template[starListFilter]',
  providers: [{ provide: StarSlot, useExisting: StarListFilterTemplate }],
})
export class StarListFilterTemplate extends StarSlot<StarListFilterContext> {
  readonly name = 'listFilter';

  static ngTemplateContextGuard(
    _dir: StarListFilterTemplate,
    _ctx: unknown,
  ): _ctx is StarListFilterContext {
    return true;
  }
}

/** Context of the `starPickListHeader` slot. */
export interface StarPickListHeaderContext {
  /** The list of the header. */
  readonly $implicit: StarPickListSide;
  /** The number of items in the list. */
  readonly count: number;
}

/**
 * Replaces the header text of each list of `star-pick-list`:
 * `<ng-template starPickListHeader let-list let-count="count">…</ng-template>`. The header stays
 * the name of its list. PrimeNG `#sourceheader` and `#targetheader` templates.
 */
@Directive({
  selector: 'ng-template[starPickListHeader]',
  providers: [{ provide: StarSlot, useExisting: StarPickListHeaderTemplate }],
})
export class StarPickListHeaderTemplate extends StarSlot<StarPickListHeaderContext> {
  readonly name = 'pickListHeader';

  static ngTemplateContextGuard(
    _dir: StarPickListHeaderTemplate,
    _ctx: unknown,
  ): _ctx is StarPickListHeaderContext {
    return true;
  }
}
