import { InjectionToken, Provider } from '@angular/core';
import type { StarFilterMatchMode } from '@star-ng/ui/core';

/**
 * App-wide defaults of the select family: `star-select`, `star-multi-select`, the autocompletes,
 * `star-cascade-select` (size, `showClear`) and `star-listbox` (filter, `scrollHeight`). Material
 * `MAT_SELECT_CONFIG`; PrimeNG has no per-control token. Only the inputs that apps commonly set
 * once:
 *
 * - `appendTo`: `self` or `body` (PrimeNG `appendTo`).
 * - `size`: `sm` or `md`.
 * - `filterMatchMode`: how the filter text matches.
 * - `filterLocale`: locale of the filter compare.
 * - `scrollHeight`: height of the option list, for example `20rem`.
 * - `showClear`: shows the clear button.
 *
 * Precedence: input in the template, then this token, then `provideStarNg`, then the built-in default.
 */
export interface StarSelectDefaults {
  readonly appendTo?: 'self' | 'body';
  readonly size?: 'sm' | 'md';
  readonly filterMatchMode?: StarFilterMatchMode;
  readonly filterLocale?: string | null;
  readonly scrollHeight?: string;
  readonly showClear?: boolean;
}

/** Defaults of the select family. Set it with `provideStarSelectDefaults`. */
export const STAR_SELECT_DEFAULTS = new InjectionToken<StarSelectDefaults>('STAR_SELECT_DEFAULTS', {
  providedIn: 'root',
  factory: () => ({}),
});

/**
 * Sets the defaults of the select family, at application level or in the providers of a
 * component (then only for the controls inside it).
 *
 * ```ts
 * providers: [provideStarSelectDefaults({ appendTo: 'body', filterMatchMode: 'startsWith' })]
 * ```
 */
export function provideStarSelectDefaults(defaults: StarSelectDefaults): Provider {
  return { provide: STAR_SELECT_DEFAULTS, useValue: defaults };
}
