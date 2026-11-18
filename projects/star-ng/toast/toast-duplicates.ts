import type { Signal } from '@angular/core';

/** Duplicate rules of one `star-toast` outlet, read by `StarToastService.show()`. */
export interface StarToastOutletPolicy {
  /** The `key` of the outlet. */
  readonly key: Signal<string | undefined>;
  /** Ignores a message that this outlet showed before, also when it has closed. */
  readonly preventDuplicates: Signal<boolean>;
  /** Ignores a message that this outlet shows now. */
  readonly preventOpenDuplicates: Signal<boolean>;
}

/** Equal severity, summary and detail give an equal signature. */
export function toastSignature(severity: string, summary: string, detail?: string): string {
  return JSON.stringify([severity, summary, detail ?? null]);
}
