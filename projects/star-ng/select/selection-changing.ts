import { OutputEmitterRef } from '@angular/core';

/**
 * Event of `selectionChanging` (Ignite UI combo `selectionChanging`): it fires before the value
 * changes. Call `cancel()` in the handler to keep the old value.
 */
export interface StarSelectionChangingEvent<V> {
  /** The value now. */
  readonly previous: V;
  /** The value after the change. */
  readonly next: V;
  /** Keeps the old value: the change does not happen. */
  cancel(): void;
  /** True after `cancel()`. */
  readonly canceled: boolean;
}

/**
 * Emits `selectionChanging` and returns `true` when no handler called `cancel()`. Handlers run
 * synchronously, so the result is known when `emit` returns.
 */
export function starSelectionChanging<V>(
  emitter: OutputEmitterRef<StarSelectionChangingEvent<V>>,
  previous: V,
  next: V,
): boolean {
  let canceled = false;
  emitter.emit({
    previous,
    next,
    cancel: () => {
      canceled = true;
    },
    get canceled() {
      return canceled;
    },
  });
  return !canceled;
}
