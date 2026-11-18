import { InjectionToken } from '@angular/core';

/** Data passed to the content opened by `StarBottomSheet.open()`. */
export const STAR_BOTTOM_SHEET_DATA = new InjectionToken<unknown>('STAR_BOTTOM_SHEET_DATA');

export interface StarBottomSheetConfig<D = unknown> {
  readonly data?: D;
  /** Accessible name of the sheet. Default: the `bottomSheet` UI text. */
  readonly ariaLabel?: string;
  /**
   * Default true: a modal sheet with a backdrop. The rest of the page is inert and Tab stays in
   * the sheet. `false` opens a non-modal sheet: no backdrop, and the page stays usable.
   */
  readonly hasBackdrop?: boolean;
  /** Close on a backdrop click. Default true. */
  readonly closeOnBackdrop?: boolean;
  /** Close on Escape. Default true. */
  readonly closeOnEscape?: boolean;
  /** Extra CSS classes on the sheet element. */
  readonly panelClass?: string | readonly string[];
  /** CSS max-height of the sheet, for example `50dvh`. Default: the window height minus 2rem. */
  readonly maxHeight?: string;
}

/** Context of a template opened with `StarBottomSheet.open(templateRef)`. */
export interface StarBottomSheetContext<D = unknown, R = unknown> {
  /** The `data` of the config (`let-data`). */
  readonly $implicit: D;
  readonly ref: StarBottomSheetRef<R>;
}

/**
 * Handle of an open bottom sheet (Material `MatBottomSheetRef`). The opened component injects it
 * to close itself with a result: `inject(StarBottomSheetRef<Result>).dismiss(result)`.
 */
export class StarBottomSheetRef<R = unknown> {
  private resolve!: (result: R | undefined) => void;
  /** Resolves when the sheet has closed: the result, or `undefined` (Escape, backdrop). */
  readonly closed = new Promise<R | undefined>((resolve) => (this.resolve = resolve));
  private result: R | undefined;
  private done = false;

  constructor(private readonly hide: () => void) {}

  /** Same promise as `closed` (Material name). */
  afterDismissed(): Promise<R | undefined> {
    return this.closed;
  }

  dismiss(result?: R): void {
    if (this.done) return;
    this.result = result;
    this.hide();
  }

  /** Called by the container once the sheet has closed. */
  settle(): void {
    if (this.done) return;
    this.done = true;
    this.resolve(this.result);
  }
}
