/**
 * Text helpers of the date pickers: the time part of the input text. The time is in the
 * 24-hour or the 12-hour clock, with or without seconds.
 */

/** `Intl.DateTimeFormat` options of the time part of the input text. */
export function starTimeFormat(
  hourFormat: '12' | '24',
  seconds: boolean,
): Intl.DateTimeFormatOptions {
  return {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds ? { second: '2-digit' } : {}),
    hourCycle: hourFormat === '12' ? 'h12' : 'h23',
  };
}

/**
 * Text of a date with its time. `Intl` does not take time fields together with `dateStyle` or
 * `timeStyle` (it throws), so such options format the date alone, and the time is added after a
 * comma, in the 12-hour or the 24-hour clock.
 */
export function starFormatDateTime(
  date: Date | null,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
  hourFormat: '12' | '24',
  seconds: boolean,
): string {
  if (!date) return '';
  const time = starTimeFormat(hourFormat, seconds);
  if (!options.dateStyle && !options.timeStyle) {
    return new Intl.DateTimeFormat(locale, { ...options, ...time }).format(date);
  }
  // The time is always the part of the time fields, so `timeStyle` is dropped.
  const dateOptions: Intl.DateTimeFormatOptions = { ...options, timeStyle: undefined };
  const day = new Intl.DateTimeFormat(locale, dateOptions).format(date);
  return `${day}, ${new Intl.DateTimeFormat(locale, time).format(date)}`;
}

/** The calendar day of `date` at the given local time. */
export function starAtTime(date: Date, hours: number, minutes: number, seconds = 0): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, seconds);
}

/** `HH:mm` (or `HH:mm:ss` with `seconds`) of a date, or `''` without a date. */
export function starTimeOf(date: Date | null | undefined, seconds = false): string {
  if (!date) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  const text = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return seconds ? `${text}:${pad(date.getSeconds())}` : text;
}

/** `date` at the `HH:mm` or `HH:mm:ss` time, or `null` when either is missing. */
export function starWithTime(date: Date | null | undefined, time: string): Date | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(time);
  return date && match
    ? starAtTime(date, Number(match[1]), Number(match[2]), Number(match[3] ?? 0))
    : null;
}

/** The parts of a typed date and time. */
export interface StarTypedDateTime {
  /** The text before the time. */
  readonly date: string;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
}

/**
 * Splits `<date> hh:mm[:ss]` or `<date>, hh:mm[:ss] am` into the date text and the time.
 * `null`: the text has no time. `undefined`: the time is not valid.
 */
export function starSplitDateTime(text: string): StarTypedDateTime | null | undefined {
  const match = /^(.*?)[,\s]+(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?(?:\s*([ap])\.?\s?m?\.?)?$/i.exec(
    text.trim(),
  );
  if (!match) return null;
  let hours = Number(match[2]);
  const minutes = Number(match[3]);
  const seconds = Number(match[4] ?? 0);
  const meridiem = match[5]?.toLowerCase();
  if (meridiem) {
    if (hours < 1 || hours > 12) return undefined;
    hours = (hours % 12) + (meridiem === 'p' ? 12 : 0);
  }
  if (hours > 23 || minutes > 59 || seconds > 59) return undefined;
  return { date: match[1], hours, minutes, seconds };
}

/**
 * ISO text of a date for the `dataType: 'string'` value: `yyyy-mm-dd`, or
 * `yyyy-mm-ddTHH:mm` (`yyyy-mm-ddTHH:mm:ss` with `seconds`) with `time`. Local time, no zone.
 */
export function starIsoText(date: Date, time = false, seconds = false): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return time ? `${day}T${starTimeOf(date, seconds)}` : day;
}

/**
 * The date of ISO text, a `Date` as it is, or `null` for text that is not such a date.
 *
 * Accepted text: `yyyy-mm-dd`, `yyyy-mm-ddTHH:mm`, `yyyy-mm-ddTHH:mm:ss`, with optional
 * fractional seconds (`.5`, `.123`) and an optional zone (`Z`, `+01:00`, `-05:30`); a space may
 * stand for the `T`. Text without a zone is a local date and time. Text with a zone (for example
 * the output of `Date.prototype.toISOString`) is that instant, shown in local time.
 */
export function starParseIso(value: Date | string | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const match =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?(Z|[+-]\d{2}:\d{2})?$/i.exec(
      value ?? '',
    );
  if (!match) return null;
  const [year, month, day, hours, minutes, seconds] = match
    .slice(1, 7)
    .map((part) => Number(part ?? 0));
  const fraction = match[7] ?? '';
  const zone = match[8];
  // A zone needs a time, and the parts must be a real date and time.
  if (zone && match[4] === undefined) return null;
  if (month < 1 || month > 12 || hours > 23 || minutes > 59 || seconds > 59) return null;
  const local = new Date(year, month - 1, day);
  if (local.getFullYear() !== year || local.getMonth() !== month - 1 || local.getDate() !== day) {
    return null;
  }
  if (zone) {
    const instant = new Date(value as string);
    return Number.isNaN(instant.getTime()) ? null : instant;
  }
  const milliseconds = Math.round(Number(`0.${fraction || '0'}`) * 1000);
  return new Date(year, month - 1, day, hours, minutes, seconds, milliseconds);
}

/** The value type of a picker: `Date` objects or ISO text (`dataType`). */
export type StarDateDataType = 'date' | 'string';

/**
 * A date as a value of the model: the date itself, or local ISO text for `dataType: 'string'`
 * (with the time when `time`, and the seconds when `seconds`).
 */
export function starFromDate(
  date: Date,
  dataType: StarDateDataType,
  time: boolean,
  seconds: boolean,
): Date | string {
  return dataType === 'string' ? starIsoText(date, time, seconds) : date;
}

/** The limits of a date and time: `minDate` / `maxDate` and the daily `minTime` / `maxTime`. */
export interface StarTimeLimits {
  readonly minDate: Date | null;
  readonly maxDate: Date | null;
  readonly minTime: string | null;
  readonly maxTime: string | null;
}

/** Seconds after midnight of `HH:mm[:ss]` text, or `null`. */
function secondsOfText(text: string | null | undefined): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(text ?? '');
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3] ?? 0) : null;
}

/** `date` moved into `minTime` … `maxTime` of its day, then into `minDate` … `maxDate`. */
export function starClampTime(date: Date, limits: StarTimeLimits): Date {
  const time = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const low = secondsOfText(limits.minTime);
  const high = secondsOfText(limits.maxTime);
  const at = (seconds: number) =>
    starAtTime(date, Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60);
  let next = date;
  if (low !== null && time < low) next = at(low);
  else if (high !== null && time > high) next = at(high);
  if (limits.minDate && next.getTime() < limits.minDate.getTime()) return new Date(limits.minDate);
  if (limits.maxDate && next.getTime() > limits.maxDate.getTime()) return new Date(limits.maxDate);
  return next;
}

/**
 * Earliest and latest time of the day of `date`: `minTime` / `maxTime`, and the time of
 * `minDate` / `maxDate` when it is that day (the later minimum and the earlier maximum).
 */
export function starDayTimeLimits(
  date: Date | null | undefined,
  limits: StarTimeLimits,
  seconds: boolean,
): { min?: string; max?: string } {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const later = (a: string | undefined, b: string | undefined) =>
    (secondsOfText(a) ?? -1) >= (secondsOfText(b) ?? -1) ? a : b;
  const earlier = (a: string | undefined, b: string | undefined) =>
    (secondsOfText(a) ?? Infinity) <= (secondsOfText(b) ?? Infinity) ? a : b;
  const { minDate, maxDate } = limits;
  return {
    min: later(
      limits.minTime ?? undefined,
      date && minDate && sameDay(date, minDate) ? starTimeOf(minDate, seconds) : undefined,
    ),
    max: earlier(
      limits.maxTime ?? undefined,
      date && maxDate && sameDay(date, maxDate) ? starTimeOf(maxDate, seconds) : undefined,
    ),
  };
}

/**
 * The first day of a typed month (`mm/yyyy`, `yyyy-mm`) or year (`yyyy`), for `view="month"` or
 * `view="year"`. `undefined` when the text is not such a period, or when no part of it is inside
 * `minDate` … `maxDate`.
 */
export function starParsePeriod(
  text: string,
  view: 'month' | 'year',
  minDate: Date | null,
  maxDate: Date | null,
): Date | undefined {
  const year = /^(\d{4})$/.exec(text);
  const month = /^(\d{1,2})[/.\- ](\d{4})$/.exec(text);
  const iso = /^(\d{4})-(\d{1,2})$/.exec(text);
  let first: Date | null = null;
  if (view === 'year' && year) first = new Date(Number(year[1]), 0, 1);
  else if (view === 'month' && month && Number(month[1]) >= 1 && Number(month[1]) <= 12)
    first = new Date(Number(month[2]), Number(month[1]) - 1, 1);
  else if (view === 'month' && iso && Number(iso[2]) >= 1 && Number(iso[2]) <= 12)
    first = new Date(Number(iso[1]), Number(iso[2]) - 1, 1);
  if (!first || Number.isNaN(first.getTime())) return undefined;
  const last =
    view === 'year'
      ? new Date(first.getFullYear(), 11, 31)
      : new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const startOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (minDate && last.getTime() < startOf(minDate).getTime()) return undefined;
  if (maxDate && first.getTime() > startOf(maxDate).getTime()) return undefined;
  return first;
}

/**
 * `date` at the time of day of `now`, rounded down to the steps `[hour, minute, second]`. A
 * second step of 0 sets the seconds to 0.
 */
export function starAtStepTime(date: Date, now: Date, steps: readonly number[]): Date {
  const down = (value: number, step: number) => value - (value % Math.max(1, Math.floor(step)));
  const [hour, minute, second] = steps;
  return starAtTime(
    date,
    down(now.getHours(), hour),
    down(now.getMinutes(), minute),
    second ? down(now.getSeconds(), second) : 0,
  );
}

/** Both ends of a range, mapped (`null` stays `null` for the range). */
export function starMapRange<A, B>(
  range: { readonly start: A | null; readonly end: A | null } | null,
  map: (day: A | null) => B | null,
): { readonly start: B | null; readonly end: B | null } | null {
  return range ? { start: map(range.start), end: map(range.end) } : null;
}

/** The days of a list of `Date`s or ISO text; entries that are not dates are left out. */
export function starDates(values: readonly (Date | string)[]): Date[] {
  return values.map((value) => starParseIso(value)).filter((day): day is Date => day !== null);
}
