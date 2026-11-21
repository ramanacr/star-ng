import { booleanAttribute, Directive, input } from '@angular/core';

/**
 * Makes the form controls inside an element fill its width (PrimeNG `p-fluid`):
 * `<form starFluid>…</form>`. Most StarNG form controls fill their container already; this also
 * widens the compact ones (for example `star-cascade-select`). `[starFluid]="false"` turns it off.
 * For the whole application, use `provideStarNg({ fluid: true })`.
 */
@Directive({
  selector: '[starFluid]',
  host: { '[class.star-fluid]': 'starFluid()' },
})
export class StarFluid {
  /** Turns the fluid layout on (default) or off. */
  readonly starFluid = input(true, {
    transform: (value: unknown) => (value === '' ? true : booleanAttribute(value)),
  });
}
