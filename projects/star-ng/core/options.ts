/**
 * How a list control reads a property from an option: a property name or an accessor function.
 * Same idea as PrimeNG `optionLabel` / `optionValue` / `optionDisabled`, but type safe.
 */
export type StarOptionKey<T, R = unknown> = (keyof T & string) | ((option: T) => R);

export type StarSeverity = 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger';

export type StarSize = 'sm' | 'md' | 'lg';

export function readOption<T, R>(option: T, key: StarOptionKey<T, R> | null | undefined): unknown {
  if (key === null || key === undefined) return option;
  if (typeof key === 'function') return key(option);
  return option !== null && typeof option === 'object'
    ? (option as Record<string, unknown>)[key]
    : undefined;
}

/** Text shown for an option. Falls back to the option itself for primitive options. */
export function optionText<T>(option: T, key: StarOptionKey<T> | null | undefined): string {
  const value = readOption(option, key ?? null);
  return value === null || value === undefined ? '' : String(value);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Locale-aware compare used by sorting: numbers and dates numerically, text with Intl.Collator. */
export function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined;
  const bEmpty = b === null || b === undefined;
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return -1;
  if (bEmpty) return 1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return collator.compare(String(a), String(b));
}

/** Case- and accent-insensitive "contains" match used by filters. */
export function matchesFilter(text: string, query: string): boolean {
  if (!query) return true;
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLocaleLowerCase();
  return normalize(text).includes(normalize(query.trim()));
}
