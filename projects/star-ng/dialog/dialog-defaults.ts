import { InjectionToken, Provider } from '@angular/core';
import type { StarDialogSize } from './dialog-base';

/**
 * Order of the two buttons of the confirm dialog and popup. `reject-first` (default): reject, then
 * accept. `accept-first`: accept, then reject. The DOM order changes, so the Tab order follows.
 */
export type StarConfirmButtonOrder = 'reject-first' | 'accept-first';

/**
 * App-wide defaults of `star-dialog` and `star-drawer` (both extend `StarDialogBase`). Material
 * `MAT_DIALOG_DEFAULT_OPTIONS`; PrimeNG: none. Only the inputs that apps commonly set once:
 *
 * - `size`: width step of a dialog (no effect on a drawer).
 * - `closable`: shows the close button.
 * - `closeOnEscape`: Escape closes.
 * - `dismissableMask`: a click on the backdrop closes.
 * - `confirmButtonOrder`: order of the buttons of `star-confirm-host` (dialog and popup). The
 *   `buttonOrder` option of `StarConfirmService.ask()` wins over it.
 *
 * Precedence: input in the template, then this token, then the built-in default.
 */
export interface StarDialogDefaults {
  readonly size?: StarDialogSize;
  readonly closable?: boolean;
  readonly closeOnEscape?: boolean;
  readonly dismissableMask?: boolean;
  readonly confirmButtonOrder?: StarConfirmButtonOrder;
}

/** Defaults of dialogs and drawers. Set it with `provideStarDialogDefaults`. */
export const STAR_DIALOG_DEFAULTS = new InjectionToken<StarDialogDefaults>('STAR_DIALOG_DEFAULTS', {
  providedIn: 'root',
  factory: () => ({}),
});

/** Sets the defaults of dialogs and drawers: `provideStarDialogDefaults({ dismissableMask: true })`. */
export function provideStarDialogDefaults(defaults: StarDialogDefaults): Provider {
  return { provide: STAR_DIALOG_DEFAULTS, useValue: defaults };
}
