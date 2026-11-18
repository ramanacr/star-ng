import { readOption, StarOptionKey } from './options';

/**
 * Text match of the list filters (select family, listbox, autocomplete). A pure helper, so the
 * table and the tree can use it too.
 */

/**
 * How the filter text must match the option text. PrimeNG `filterMatchMode` (the text modes).
 * - `contains`: the text has the query somewhere (default).
 * - `startsWith` / `endsWith`: the text starts or ends with the query.
 * - `equals`: the whole text is the query.
 * - `notContains`: the text does not have the query.
 */
export type StarFilterMatchMode = 'contains' | 'startsWith' | 'endsWith' | 'equals' | 'notContains';

const collators = new Map<string, Intl.Collator>();

/** A cached collator that ignores case and accents (`sensitivity: 'base'`). */
function collatorFor(locale: string): Intl.Collator {
  let collator = collators.get(locale);
  if (!collator) {
    collator = new Intl.Collator(locale, { sensitivity: 'base', usage: 'search' });
    collators.set(locale, collator);
  }
  return collator;
}

/** Removes accents and lowers the case (with the rules of `locale` when it is set). */
function fold(text: string, locale: string | undefined): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase(locale);
}

/**
 * Compares two folded texts of the same length. With a locale, `Intl.Collator` (sensitivity
 * `base`) decides, so letters that the locale treats as equal match.
 */
function same(a: string, b: string, locale: string | undefined): boolean {
  return locale ? collatorFor(locale).compare(a, b) === 0 : a === b;
}

/**
 * True when `value` matches the filter text `query`. The compare ignores case and accents
 * ("Malaga" finds "Málaga"). With `locale`, the case rules of that locale apply, and
 * `Intl.Collator` with sensitivity `base` compares the text. An empty query (after trimming) matches
 * every value, also with `notContains`.
 *
 * ```ts
 * starFilterMatch('Zürich', 'zur');                       // true
 * starFilterMatch('Berlin', 'lin', 'endsWith');           // true
 * starFilterMatch('İstanbul', 'is', 'startsWith', 'tr');  // true
 * ```
 */
export function starFilterMatch(
  value: unknown,
  query: string,
  mode: StarFilterMatchMode = 'contains',
  locale?: string | null,
): boolean {
  const lang = locale || undefined;
  const q = fold(query.trim(), lang);
  if (!q) return true;
  const text = fold(value === null || value === undefined ? '' : String(value), lang);
  switch (mode) {
    case 'equals':
      return text.length === q.length && same(text, q, lang);
    case 'startsWith':
      return same(text.slice(0, q.length), q, lang) && text.length >= q.length;
    case 'endsWith':
      return text.length >= q.length && same(text.slice(text.length - q.length), q, lang);
    case 'notContains':
      return !contains(text, q, lang);
    default:
      return contains(text, q, lang);
  }
}

function contains(text: string, q: string, lang: string | undefined): boolean {
  if (!lang) return text.includes(q);
  for (let i = 0; i + q.length <= text.length; i++) {
    if (same(text.slice(i, i + q.length), q, lang)) return true;
  }
  return false;
}

/**
 * True when one of the texts matches (`notContains`: when none of them has the query). The list
 * controls pass the texts of the `filterBy` fields of an option.
 */
export function starFilterMatchAny(
  values: readonly unknown[],
  query: string,
  mode: StarFilterMatchMode = 'contains',
  locale?: string | null,
): boolean {
  if (mode === 'notContains') return values.every((v) => starFilterMatch(v, query, mode, locale));
  return values.some((v) => starFilterMatch(v, query, mode, locale));
}

/**
 * Fields of an option that a filter searches: one key, several keys, or `null` for the label.
 * PrimeNG `filterBy` (there a comma-separated string).
 */
export type StarFilterBy<T> = StarOptionKey<T> | readonly StarOptionKey<T>[] | null;

/** The texts of an option that a filter searches: the `filterBy` fields, else the label. */
export function starFilterTexts<T>(
  option: T,
  filterBy: StarFilterBy<T> | undefined,
  label: (option: T) => string,
): readonly unknown[] {
  if (filterBy === null || filterBy === undefined) return [label(option)];
  const keys = (Array.isArray(filterBy) ? filterBy : [filterBy]) as readonly StarOptionKey<T>[];
  return keys.map((key) => readOption(option, key));
}
