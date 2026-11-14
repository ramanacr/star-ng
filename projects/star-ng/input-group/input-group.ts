import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Icon inside a text input (PrimeNG `p-iconfield` + `p-inputicon`). The icon is decoration
 * only: the input still needs a label (`star-field` or `aria-label`).
 *
 * ```html
 * <star-icon-field icon="ph-bold ph-magnifying-glass">
 *   <input starInput type="search" aria-label="Search cases" />
 * </star-icon-field>
 * ```
 */
@Component({
  selector: 'star-icon-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-icon-field',
    '[class.star-icon-field--end]': "iconPosition() === 'end'",
  },
  template: `
    <i [class]="icon() + ' star-icon-field__icon'" aria-hidden="true"></i>
    <ng-content />
  `,
})
export class StarIconField {
  /** Phosphor icon classes, for example `ph-bold ph-magnifying-glass`. */
  readonly icon = input.required<string>();
  readonly iconPosition = input<'start' | 'end'>('start');
}

/**
 * Joins an input with add-ons before or after it (PrimeNG `p-inputgroup`): a unit, a prefix
 * text, an icon or a button. Put `star-input-group-addon` elements, native `starInput` inputs
 * and `star-button` elements inside, in visual order.
 *
 * ```html
 * <star-input-group>
 *   <star-input-group-addon>https://</star-input-group-addon>
 *   <input starInput aria-label="Website" />
 *   <star-button variant="secondary">Check</star-button>
 * </star-input-group>
 * ```
 */
@Component({
  selector: 'star-input-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-input-group', role: 'group', '[attr.aria-label]': 'ariaLabel()' },
  template: `<ng-content />`,
})
export class StarInputGroup {
  readonly ariaLabel = input<string | null>(null);
}

/** Text or icon add-on of `star-input-group`. */
@Component({
  selector: 'star-input-group-addon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-input-group__addon' },
  template: `<ng-content />`,
})
export class StarInputGroupAddon {}
