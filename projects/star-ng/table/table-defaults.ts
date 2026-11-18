import { InjectionToken, Provider } from '@angular/core';
import type { StarFilterMatchMode } from '@star-ng/ui/core';

/**
 * App-wide defaults of `star-table` (the Material pattern of `MAT_*_DEFAULT_OPTIONS`). Only the
 * inputs that apps commonly set once:
 *
 * - `size`: row density, `sm` or `md`.
 * - `striped`: alternate row background.
 * - `stickyHeader`: the header stays in view while the table scrolls.
 * - `rowsPerPageOptions`: the choices of the paginator.
 * - `filterMatchMode`: how the global filter text matches (`globalFilterMatchMode`).
 * - `filterLocale`: locale of the text filters.
 *
 * Precedence: input in the template, then this token, then `provideStarNg`, then the built-in default.
 */
export interface StarTableDefaults {
  readonly size?: 'sm' | 'md';
  readonly striped?: boolean;
  readonly stickyHeader?: boolean;
  readonly rowsPerPageOptions?: readonly number[];
  readonly filterMatchMode?: StarFilterMatchMode;
  readonly filterLocale?: string;
}

/** Defaults of the table. Set it with `provideStarTableDefaults`. */
export const STAR_TABLE_DEFAULTS = new InjectionToken<StarTableDefaults>('STAR_TABLE_DEFAULTS', {
  providedIn: 'root',
  factory: () => ({}),
});

/** Sets the defaults of the table: `provideStarTableDefaults({ size: 'sm', striped: true })`. */
export function provideStarTableDefaults(defaults: StarTableDefaults): Provider {
  return { provide: STAR_TABLE_DEFAULTS, useValue: defaults };
}
