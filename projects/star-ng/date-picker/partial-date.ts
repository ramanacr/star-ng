/**
 * Partial dates: a full date, a month and year, or a year only, for a date that is not known to
 * the day. Pure helpers without Angular: the value type, its precision, a check, a comparison, a
 * tolerant parser and a formatter. `star-partial-date-picker` uses them.
 */
import {
  starFormatPattern,
  starParsePattern,
  starPatternHint,
  starReducePattern,
} from './date-pattern';
import { DEFAULT_DATE_FORMAT } from './date-utils';

/** How much of a date is known: the day, the month (and year), or the year. */
export type StarDatePrecision = 'day' | 'month' | 'year';

/**
 * A date that may be known only to the month or the year. `month` is 1–12. A month and year
 * have `day: null`; a year alone has `month: null` and `day: null`. A `Date` cannot hold an
 * unknown day, so the value is this plain object (it serializes to JSON as it is).
 */
export interface StarPartialDate {
  readonly year: number;
  readonly month: number | null;
  readonly day: number | null;
}

/** Options of `starFormatPartialDate` and `starParsePartialDate`. */
export interface StarPartialDateFormatOptions {
  /**
   * Fixed pattern of a full date (`datePattern`), for example `dd-MMM-yyyy`. A month and year
   * uses the pattern without the day (`MMM-yyyy`), a year the year token alone (`yyyy`). Time
   * tokens are left out. Default: the `Intl` format.
   */
  readonly pattern?: string | null;
  /** BCP 47 locale of the month names and of the order of day, month and year. */
  readonly locale?: string;
  /**
   * `Intl.DateTimeFormat` options of a full date when there is no pattern (default: numeric
   * day, month and year). A month and year keeps the `month` and `year` options.
   */
  readonly format?: Intl.DateTimeFormatOptions | null;
}

/** Options of `starParsePartialDate`. */
export interface StarPartialDateParseOptions extends StarPartialDateFormatOptions {
  /** The precisions that the text may have. Default: all three. */
  readonly precisions?: readonly StarDatePrecision[];
}

/** The precisions from the finest to the coarsest. */
const ORDER: readonly StarDatePrecision[] = ['day', 'month', 'year'];

/** Token letters of a pattern that each precision keeps. */
const LETTERS: Record<StarDatePrecision, string> = { day: 'dMy', month: 'My', year: 'y' };

function daysInMonth(year: number, month: number): number {
  const date = new Date(2000, month, 0);
  date.setFullYear(year, month, 0);
  return date.getDate();
}

/** The precision of a partial date: `'day'`, `'month'` or `'year'`. */
export function starPartialDatePrecision(value: StarPartialDate): StarDatePrecision {
  if (value.month === null || value.month === undefined) return 'year';
  return value.day === null || value.day === undefined ? 'month' : 'day';
}

/**
 * Whether a value is a real partial date: a whole year 1–9999, a month 1–12 or `null`, and a day
 * that the month has (not 31 April, not 29 February outside a leap year) or `null`. A day needs a
 * month.
 */
export function starIsValidPartialDate(value: unknown): value is StarPartialDate {
  if (!value || typeof value !== 'object') return false;
  const { year, month, day } = value as Partial<Record<'year' | 'month' | 'day', unknown>>;
  const whole = (part: unknown, min: number, max: number) =>
    typeof part === 'number' && Number.isInteger(part) && part >= min && part <= max;
  if (!whole(year, 1, 9999)) return false;
  if (month === null || month === undefined) return day === null || day === undefined;
  if (!whole(month, 1, 12)) return false;
  if (day === null || day === undefined) return true;
  return whole(day, 1, daysInMonth(year as number, month as number));
}

/**
 * Compares two partial dates at the coarser precision of the two: negative when `a` is before
 * `b`, `0` when they are the same at that precision, positive when `a` is after `b`. So
 * `2026` and `14-Apr-2026` are the same (0), `Mar-2026` is before `14-Apr-2026`. Use it for a
 * check such as "the end is not before the start".
 */
export function starComparePartialDates(a: StarPartialDate, b: StarPartialDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month === null || b.month === null) return 0;
  if (a.month !== b.month) return a.month - b.month;
  if (a.day === null || b.day === null) return 0;
  return a.day - b.day;
}

/** The partial date of a `Date` at a precision: `14-Apr-2026` at `'month'` is `Apr-2026`. */
export function starPartialDateFromDate(
  date: Date,
  precision: StarDatePrecision = 'day',
): StarPartialDate {
  return {
    year: date.getFullYear(),
    month: precision === 'year' ? null : date.getMonth() + 1,
    day: precision === 'day' ? date.getDate() : null,
  };
}

/**
 * The first day of a partial date as a local `Date`: `Apr-2026` gives 1 April 2026, `2026` gives
 * 1 January 2026. Use it for sorting or a date library, not for display: the day is not known.
 */
export function starPartialDateToDate(value: StarPartialDate): Date {
  const date = new Date(2000, 0, 1);
  date.setFullYear(value.year, (value.month ?? 1) - 1, value.day ?? 1);
  return date;
}

/** Whether a pattern still holds the tokens of a precision (a pattern may lack a day). */
function patternFits(pattern: string, precision: StarDatePrecision): boolean {
  const hint = starPatternHint(starReducePattern(pattern, LETTERS[precision]));
  return [...LETTERS[precision]].every((letter) => hint.includes(letter));
}

/** The pattern of one precision, from the pattern of a full date. */
function reduced(pattern: string, precision: StarDatePrecision): string {
  return starReducePattern(pattern, LETTERS[precision]);
}

/**
 * The parse pattern of the locale: its numeric order of day, month and year (`dd/MMM/yyyy` for
 * en-GB). `MMM` reads a month name or a month number.
 */
function localePattern(
  locale: string | undefined,
  format: Intl.DateTimeFormatOptions | null | undefined,
): string {
  return new Intl.DateTimeFormat(locale, {
    year: format?.year ?? 'numeric',
    month: format?.month ?? '2-digit',
    day: format?.day ?? '2-digit',
  })
    .formatToParts(new Date(2026, 10, 22))
    .map((part) => {
      if (part.type === 'day') return 'dd';
      if (part.type === 'month') return 'MMM';
      if (part.type === 'year') return 'yyyy';
      return /[\p{L}']/u.test(part.value) ? `'${part.value.replace(/'/g, "''")}'` : part.value;
    })
    .join('');
}

const ISO_PATTERN = 'yyyy-MM-dd';

/**
 * Reads typed text as a partial date, or returns `null` when the text is none of the allowed
 * forms or not a real date. The finest form wins: with `dd-MMM-yyyy`, `14-Apr-2026` is a day,
 * `MAR-2026` a month and year, `1981` a year.
 *
 * The forms are the pattern (or, without one, the locale's order of day, month and year) and its
 * shorter forms without the day and without the month, then ISO `yyyy-mm-dd`, `yyyy-mm` and
 * `yyyy`. The reading is as tolerant as typed text of `star-date-picker`: any case, the short or
 * long month name or its number, and any of the separators space, `-`, `/`, `.`, `,`. A year
 * alone is typed with three or four digits.
 */
export function starParsePartialDate(
  text: string,
  options: StarPartialDateParseOptions = {},
): StarPartialDate | null {
  const value = text.trim();
  if (!value) return null;
  const allowed = options.precisions ?? ORDER;
  const pattern = options.pattern || localePattern(options.locale, options.format);
  // A year alone needs three or more digits: `14` is not read as the year 2014.
  const longYear = /\d{3}/.test(value);
  for (const base of [pattern, ISO_PATTERN]) {
    for (const precision of ORDER) {
      if (!allowed.includes(precision) || !patternFits(base, precision)) continue;
      if (precision === 'year' && !longYear) continue;
      const date = starParsePattern(value, reduced(base, precision), options.locale);
      if (!date) continue;
      const result = starPartialDateFromDate(date, precision);
      if (starIsValidPartialDate(result)) return result;
    }
  }
  return null;
}

/** `Intl` options of a precision, from the options of a full date. */
function intlOptions(
  format: Intl.DateTimeFormatOptions | null | undefined,
  precision: StarDatePrecision,
): Intl.DateTimeFormatOptions {
  const options = format ?? DEFAULT_DATE_FORMAT;
  if (precision === 'year') return { year: 'numeric' };
  const style = options.dateStyle;
  const month: Intl.DateTimeFormatOptions['month'] = style
    ? style === 'short'
      ? '2-digit'
      : style === 'medium'
        ? 'short'
        : 'long'
    : (options.month ?? '2-digit');
  if (precision === 'month') return { year: 'numeric', month };
  if (style) return { dateStyle: style };
  return { year: options.year ?? 'numeric', month, day: options.day ?? '2-digit' };
}

/**
 * Text of a partial date with only its known parts: `14-Apr-2026`, `Apr-2026` or `2026` for the
 * pattern `dd-MMM-yyyy`; `14/04/2026`, `04/2026` or `2026` in en-GB without a pattern. Never an
 * invented day. `''` for `null` or a value that is not a real partial date.
 */
export function starFormatPartialDate(
  value: StarPartialDate | null | undefined,
  options: StarPartialDateFormatOptions = {},
): string {
  if (!starIsValidPartialDate(value)) return '';
  const precision = starPartialDatePrecision(value);
  const date = starPartialDateToDate(value);
  if (options.pattern && patternFits(options.pattern, precision)) {
    return starFormatPattern(date, reduced(options.pattern, precision), options.locale);
  }
  return new Intl.DateTimeFormat(options.locale, intlOptions(options.format, precision)).format(
    date,
  );
}

/**
 * Placeholder of one precision: the reduced pattern (`MMM-yyyy`), or the locale's numeric order
 * (`mm/yyyy`). Internal.
 */
export function starPartialDateHint(
  precision: StarDatePrecision,
  options: StarPartialDateFormatOptions = {},
): string {
  if (options.pattern && patternFits(options.pattern, precision)) {
    return starPatternHint(reduced(options.pattern, precision));
  }
  return new Intl.DateTimeFormat(options.locale, intlOptions(DEFAULT_DATE_FORMAT, precision))
    .formatToParts(new Date(2026, 10, 22))
    .map((part) =>
      part.type === 'day'
        ? 'dd'
        : part.type === 'month'
          ? 'mm'
          : part.type === 'year'
            ? 'yyyy'
            : part.value,
    )
    .join('');
}
