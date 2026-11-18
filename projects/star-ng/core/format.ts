import { StarFilterMatchMode, starFoldText } from './filter-match';

/**
 * Text helpers of the StarNG pipes (`@star-ng/ui/utility`). They are pure functions without
 * browser globals, so they run on the server too. PrimeNG: none; Material: none.
 */

const BYTE_UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte'] as const;

/**
 * A byte count as text with `Intl.NumberFormat` units: `1.2 MB`, `512 byte`, `3,4 GB` in German.
 * Steps of 1024. `digits` is the maximum number of fraction digits above one kilobyte (default 1).
 * Returns `''` for `null`, `undefined` or a value that is not a finite number.
 */
export function starFormatFileSize(
  bytes: number | null | undefined,
  locale?: string | null,
  digits = 1,
): string {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '';
  let value = Math.abs(bytes);
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(locale || undefined, {
    style: 'unit',
    unit: BYTE_UNITS[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : digits,
  }).format(bytes < 0 ? -value : value);
}

/** A date as a `Date`, a timestamp in milliseconds or an ISO 8601 text. */
export type StarDateInput = Date | number | string;

const SECOND = 1000;
const STEPS: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.348],
  ['month', 12],
  ['year', Infinity],
];

function toTime(value: StarDateInput): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/**
 * The time from `now` to `value` as text with `Intl.RelativeTimeFormat`: "5 minutes ago",
 * "in 2 days", "yesterday" (with `numeric: 'auto'`, the default). The largest unit that is at least
 * one wins. Returns `''` for an empty or invalid date.
 */
export function starFormatRelativeTime(
  value: StarDateInput | null | undefined,
  now: StarDateInput,
  locale?: string | null,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
): string {
  if (value === null || value === undefined || value === '') return '';
  const time = toTime(value);
  const base = toTime(now);
  if (Number.isNaN(time) || Number.isNaN(base)) return '';
  let amount = (time - base) / SECOND;
  let unit: Intl.RelativeTimeFormatUnit = 'second';
  for (const [name, size] of STEPS) {
    unit = name;
    if (Math.abs(amount) < size) break;
    amount /= size;
  }
  return new Intl.RelativeTimeFormat(locale || undefined, options).format(Math.round(amount), unit);
}

/** One part of a highlighted text: `match` is true for a part that matches the query. */
export interface StarTextPart {
  readonly text: string;
  readonly match: boolean;
}

/**
 * Splits `text` into the parts that match `query` and the parts between them, with the compare of
 * `starFilterMatch`: case and accents do not count ("mal" finds "Mál" in "Málaga"). `contains`
 * marks every match; `startsWith`, `endsWith` and `equals` mark at most one; `notContains` marks
 * nothing. An empty query gives the whole text as one part.
 */
export function starTextParts(
  text: string | null | undefined,
  query: string | null | undefined,
  mode: StarFilterMatchMode = 'contains',
  locale?: string | null,
): StarTextPart[] {
  const source = text ?? '';
  const needle = starFoldText((query ?? '').trim(), locale);
  if (!source) return [];
  if (!needle || mode === 'notContains') return [{ text: source, match: false }];

  // Fold one character at a time and keep, for every folded position, the source character.
  let folded = '';
  const startOf: number[] = [];
  const endOf: number[] = [];
  let offset = 0;
  for (const char of Array.from(source)) {
    const piece = starFoldText(char, locale);
    // One entry per UTF-16 unit of the folded piece (`indexOf` works in units).
    startOf.push(...Array<number>(piece.length).fill(offset));
    endOf.push(...Array<number>(piece.length).fill(offset + char.length));
    folded += piece;
    offset += char.length;
  }

  const ranges: [number, number][] = [];
  const add = (at: number) => ranges.push([startOf[at], endOf[at + needle.length - 1]]);
  if (mode === 'contains') {
    let at = folded.indexOf(needle);
    while (at !== -1) {
      add(at);
      at = folded.indexOf(needle, at + needle.length);
    }
  } else if (mode === 'startsWith' && folded.startsWith(needle)) {
    add(0);
  } else if (mode === 'endsWith' && folded.endsWith(needle)) {
    add(folded.length - needle.length);
  } else if (mode === 'equals' && folded === needle) {
    add(0);
  }

  const parts: StarTextPart[] = [];
  let cursor = 0;
  for (const [range, end] of ranges) {
    const start = Math.max(range, cursor);
    if (end <= start) continue;
    if (start > cursor) parts.push({ text: source.slice(cursor, start), match: false });
    parts.push({ text: source.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < source.length) parts.push({ text: source.slice(cursor), match: false });
  return parts;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes the HTML special characters of a text. */
export function starEscapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
}

/**
 * Up to `max` initials of a name, upper case: "Ada Lovelace" gives "AL", "maria.garcia@example.com"
 * gives "MG". The same rule as `star-avatar`.
 */
export function starInitials(name: string | null | undefined, max = 2): string {
  return (name ?? '')
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, Math.max(0, max))
    .map((part) => Array.from(part)[0]?.toUpperCase() ?? '')
    .join('');
}
