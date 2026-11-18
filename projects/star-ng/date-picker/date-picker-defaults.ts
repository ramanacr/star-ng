import { InjectionToken, Provider } from '@angular/core';

/**
 * App-wide defaults of `star-date-picker`, `star-date-range-picker` and `star-multi-date-picker`
 * (Material `MAT_DATE_LOCALE` and the datepicker options). Only the inputs that apps commonly set
 * once:
 *
 * - `locale`: BCP 47 locale of names and formats (wins over `locale` of `provideStarNg`).
 * - `size`: `sm` or `md`.
 * - `firstDayOfWeek`: 0 = Sunday.
 * - `hourFormat`: `'24'` or `'12'` for the typed time.
 * - `showButtonBar`: the Today and Clear bar.
 * - `showWeek`: ISO 8601 week numbers.
 *
 * Precedence: input in the template, then this token, then `provideStarNg`, then the built-in default.
 */
export interface StarDatePickerDefaults {
  readonly locale?: string;
  readonly size?: 'sm' | 'md';
  readonly firstDayOfWeek?: number;
  readonly hourFormat?: '24' | '12';
  readonly showButtonBar?: boolean;
  readonly showWeek?: boolean;
}

/** Defaults of the date pickers. Set it with `provideStarDatePickerDefaults`. */
export const STAR_DATE_PICKER_DEFAULTS = new InjectionToken<StarDatePickerDefaults>(
  'STAR_DATE_PICKER_DEFAULTS',
  { providedIn: 'root', factory: () => ({}) },
);

/** Sets the defaults of the date pickers: `provideStarDatePickerDefaults({ firstDayOfWeek: 1 })`. */
export function provideStarDatePickerDefaults(defaults: StarDatePickerDefaults): Provider {
  return { provide: STAR_DATE_PICKER_DEFAULTS, useValue: defaults };
}
