import { Directive, input } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';
import type { StarOptionContext } from './option-list-base';

/** Context of the selected slot. */
export interface StarSelectedContext<T> {
  /** The chosen option. */
  readonly $implicit: T;
}

/**
 * Replaces the label in the closed trigger of `star-select` when a value is chosen.
 * The placeholder still shows when nothing is chosen. PrimeNG `#selecteditem` template.
 *
 * The content goes inside the combobox, which owns focus and the keyboard. Do not add focusable
 * elements (buttons, links, inputs) in this template.
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
  /**
   * `true` when the control is neither disabled nor read-only. Show a remove button only then,
   * like the default chip.
   */
  readonly interactive: boolean;
  /**
   * Removes this option from the value. Call it from a button with `tabindex="-1"`.
   * It does nothing when `interactive` is `false`.
   */
  readonly remove: () => void;
}

/**
 * Replaces a chip of `star-multi-select` with `display="chip"`. PrimeNG `#chip` template (one chip).
 *
 * The chip is drawn inside the combobox, which handles Enter and Space. A button inside a chip
 * must have `tabindex="-1"`, like the default chip, and an accessible name. Keyboard users remove
 * a value in the panel: move to the option and press Enter or Space.
 */
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

/** Context of the cascade option slot. It extends the context of `starOption`. */
export interface StarCascadeOptionContext<T> extends StarOptionContext<T> {
  /** The option of this menu entry. */
  readonly $implicit: T;
  /** The option is the chosen leaf. A parent option is never selected. */
  readonly selected: boolean;
  /** Position of the option among its siblings, from `0`. */
  readonly index: number;
  /** Depth of the option: `1` for a top-level option, `2` for its children, and so on. */
  readonly level: number;
  /** The option opens a submenu. A leaf has no children. */
  readonly hasChildren: boolean;
}

/**
 * Replaces the label of each option in the menu of `star-cascade-select`, for parents and leaves.
 * PrimeNG `#option` template of `p-cascadeselect`. The context extends the one of `starOption`
 * (`$implicit`, `selected`, `index`) with `level` and `hasChildren`.
 *
 * The check icon of the chosen leaf and the submenu arrow stay outside the template.
 *
 * Each option is a menu item (`role="menuitem"`), and the menu owns focus and the keyboard. Do not
 * add focusable elements (buttons, links, inputs) in this template. The text in the template is
 * the accessible name of the item, so it must contain the option text.
 */
@Directive({
  selector: 'ng-template[starCascadeOption]',
  providers: [{ provide: StarSlot, useExisting: StarCascadeOptionTemplate }],
})
export class StarCascadeOptionTemplate<T = unknown> extends StarSlot<StarCascadeOptionContext<T>> {
  readonly name = 'option';
  /** Optional: pass the options array to type `let-option` in strict templates. */
  readonly starCascadeOptionOf = input<readonly T[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarCascadeOptionTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarCascadeOptionContext<T> {
    return true;
  }
}
