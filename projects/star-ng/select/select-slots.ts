import { Directive, input } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';

/** Context of the selected slot. */
export interface StarSelectedContext<T> {
  /** The chosen option. */
  readonly $implicit: T;
}

/**
 * Replaces the label in the closed trigger of `star-select` when a value is chosen.
 * The placeholder still shows when nothing is chosen. PrimeNG `#selecteditem` template.
 */
@Directive({
  selector: 'ng-template[starSelected]',
  providers: [{ provide: StarSlot, useExisting: StarSelectedTemplate }],
})
export class StarSelectedTemplate<T = unknown> extends StarSlot<StarSelectedContext<T>> {
  readonly name = 'selected';
  /** Optional: pass the options array to type `let-option` in strict templates. */
  readonly starSelectedOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarSelectedTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarSelectedContext<T> {
    return true;
  }
}

/** Context of the chip slot. */
export interface StarChipContext<T> {
  /** The chosen option. */
  readonly $implicit: T;
  /** Removes this option from the value. */
  readonly remove: () => void;
}

/** Replaces a chip of `star-multi-select` with `display="chip"`. PrimeNG `#selecteditems` template. */
@Directive({
  selector: 'ng-template[starChip]',
  providers: [{ provide: StarSlot, useExisting: StarChipTemplate }],
})
export class StarChipTemplate<T = unknown> extends StarSlot<StarChipContext<T>> {
  readonly name = 'chip';
  /** Optional: pass the options array to type `let-option` in strict templates. */
  readonly starChipOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarChipTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarChipContext<T> {
    return true;
  }
}
