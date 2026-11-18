import { Injectable, signal } from '@angular/core';

/**
 * A custom filter match mode: `true` when the cell `value` matches the `filter` value of a rule.
 * `locale` is the `filterLocale` of the table (or `null`).
 */
export type StarFilterFunction = (
  value: unknown,
  filter: unknown,
  locale?: string | null,
) => boolean;

/** A registered match mode with the name that a filter menu shows. */
export interface StarFilterMode {
  readonly name: string;
  readonly label: string;
  readonly fn: StarFilterFunction;
}

/**
 * Custom filter match modes (PrimeNG `FilterService.register`). Register a mode once, for example
 * in an app initializer or a component constructor; the table filter and its filter menu then
 * accept it as a `matchMode` and in a column's `filterMatchModes`.
 *
 * ```ts
 * inject(StarFilterService).register('within7Days', (value) => isWithinDays(value, 7), 'Within 7 days');
 * ```
 */
@Injectable({ providedIn: 'root' })
export class StarFilterService {
  private readonly modes = signal<ReadonlyMap<string, StarFilterMode>>(new Map());

  /** Adds or replaces a match mode. `label` is the text of the filter menu (default: `name`). */
  register(name: string, fn: StarFilterFunction, label: string = name): void {
    this.modes.update((modes) => new Map(modes).set(name, { name, label, fn }));
  }

  /** Removes a match mode. */
  unregister(name: string): void {
    this.modes.update((modes) => {
      const next = new Map(modes);
      next.delete(name);
      return next;
    });
  }

  /** The registered mode, or `undefined`. Reading it in a computed tracks later registrations. */
  get(name: string): StarFilterMode | undefined {
    return this.modes().get(name);
  }
}
