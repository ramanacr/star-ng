import { booleanAttribute, Directive, input } from '@angular/core';

/**
 * Makes the form controls inside an element fill its inline size (PrimeNG `p-fluid`):
 * `<form starFluid>…</form>`. It sets `data-star-fluid` on the element; one shared style rule
 * widens the field controls (input, select family, date and time pickers, color picker, input
 * number, mask and tags, password, listbox) and, inside a `form`, `star-button`,
 * `star-select-button` and `star-toggle-button`.
 *
 * `starFluid="false"` (`data-star-fluid="false"`) turns it off for all content below that
 * element, also below an outer fluid root. For the whole application, use
 * `provideStarNg({ fluid: true })`.
 */
@Directive({
  selector: '[starFluid]',
  host: { '[attr.data-star-fluid]': "starFluid() ? '' : 'false'" },
})
export class StarFluid {
  /** Turns the fluid layout on (default) or off. */
  readonly starFluid = input(true, {
    transform: (value: unknown) => (value === '' ? true : booleanAttribute(value)),
  });
}
