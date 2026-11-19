import { InjectionToken, Provider } from '@angular/core';

/** Corner of the screen of a `star-toast` outlet. */
export type StarToastPosition =
  | 'top-right'
  | 'top-left'
  | 'top-start'
  | 'top-end'
  | 'top-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'bottom-start'
  | 'bottom-end'
  | 'bottom-center';

/**
 * App-wide defaults of toasts (Material `MAT_SNACK_BAR_DEFAULT_OPTIONS`; PrimeNG: none). Only the options that
 * apps commonly set once:
 *
 * - `position`: corner of the `star-toast` outlet.
 * - `stackLimit`: messages shown at once per outlet.
 * - `life`: milliseconds before a message closes, when `show()` sets no `life` (built-in 5000).
 *
 * Precedence: input or `show()` option, then this token, then the built-in default.
 */
export interface StarToastDefaults {
  readonly position?: StarToastPosition;
  readonly stackLimit?: number;
  readonly life?: number;
}

/** Defaults of toasts. Set it with `provideStarToastDefaults`. */
export const STAR_TOAST_DEFAULTS = new InjectionToken<StarToastDefaults>('STAR_TOAST_DEFAULTS', {
  providedIn: 'root',
  factory: () => ({}),
});

/** Sets the defaults of toasts: `provideStarToastDefaults({ position: 'bottom-end', life: 4000 })`. */
export function provideStarToastDefaults(defaults: StarToastDefaults): Provider {
  return { provide: STAR_TOAST_DEFAULTS, useValue: defaults };
}
