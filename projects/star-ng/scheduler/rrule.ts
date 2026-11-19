/**
 * A small, pure engine for iCalendar recurrence rules (RFC 5545 `RRULE`), used by `star-scheduler`.
 *
 * Supported parts: `FREQ` (`DAILY`, `WEEKLY`, `MONTHLY`, `YEARLY`), `INTERVAL`, `COUNT`, `UNTIL`,
 * `BYDAY` (with ordinals such as `2MO` or `-1FR` in a monthly or yearly rule), `BYMONTHDAY`
 * (negative values count from the end of the month), `BYMONTH` and `WKST`. Other parts (for
 * example `BYSETPOS` or `BYHOUR`) are listed in `unsupported` and are not applied.
 *
 * All dates are local: each occurrence has the wall-clock time of the start, also across a
 * daylight saving change. There is no time-zone conversion.
 *
 * Like other RRULE engines, an occurrence exists only when the rule produces it: a start that
 * does not match the rule (for example a Wednesday start with `BYDAY=MO`) is not an occurrence.
 */

/** Frequencies of a recurrence rule. */
export type StarRruleFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

/** A weekday of `BYDAY`: `day` is 0 (Sunday) to 6; `ordinal` is 0 for "every", else ±1…±53. */
export interface StarRruleWeekday {
  readonly day: number;
  readonly ordinal: number;
}

/** A parsed recurrence rule. */
export interface StarRrule {
  readonly freq: StarRruleFrequency;
  /** Step between periods, 1 or more. */
  readonly interval: number;
  /** Number of occurrences of the whole series, or `null`. */
  readonly count: number | null;
  /** Last moment of the series (inclusive), or `null`. */
  readonly until: Date | null;
  readonly byDay: readonly StarRruleWeekday[];
  /** Days of the month, 1…31 or -31…-1. */
  readonly byMonthDay: readonly number[];
  /** Months, 1…12. */
  readonly byMonth: readonly number[];
  /** First day of the week for `WEEKLY` with `INTERVAL` (0 = Sunday). Default Monday. */
  readonly weekStart: number;
  /** Names of rule parts that the engine does not apply. */
  readonly unsupported: readonly string[];
}

/** Options of `starExpandRrule`. */
export interface StarRruleExpandOptions {
  /** Length of one occurrence in milliseconds: an occurrence that still runs at the range start is kept. */
  readonly duration?: number;
  /** Days without an occurrence (EXDATE). An exception removes the occurrence on its local day. */
  readonly exceptions?: readonly Date[];
  /** Largest number of occurrences returned. Default 1000. */
  readonly limit?: number;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const FREQUENCIES: readonly StarRruleFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const KNOWN = new Set([
  'FREQ',
  'INTERVAL',
  'COUNT',
  'UNTIL',
  'BYDAY',
  'BYMONTHDAY',
  'BYMONTH',
  'WKST',
]);
const DAY_MS = 86_400_000;
/** Periods walked at most, so a rule that never matches cannot loop forever. */
const MAX_PERIODS = 50_000;

const positiveInt = (text: string): number | null =>
  /^\d+$/.test(text) && Number(text) > 0 ? Number(text) : null;

function parseList<T>(text: string, read: (part: string) => T | null): T[] | null {
  const values: T[] = [];
  for (const part of text.split(',')) {
    const value = read(part.trim());
    if (value === null) return null;
    values.push(value);
  }
  return values;
}

function parseWeekday(text: string): StarRruleWeekday | null {
  const match = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(text);
  if (!match) return null;
  const ordinal = match[1] ? Number(match[1]) : 0;
  if (Math.abs(ordinal) > 53 || (match[1] && ordinal === 0)) return null;
  return { day: DAYS.indexOf(match[2]), ordinal };
}

function parseUntil(text: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(text);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  if (match[4] === undefined) return new Date(y, m, d, 23, 59, 59, 999);
  const [h, min, s] = [Number(match[4]), Number(match[5]), Number(match[6])];
  return match[7] ? new Date(Date.UTC(y, m, d, h, min, s)) : new Date(y, m, d, h, min, s);
}

/**
 * Reads RRULE text, with or without the `RRULE:` prefix. Returns `null` when `FREQ` is missing
 * or not supported, or when a supported part has an invalid value.
 */
export function starParseRrule(text: string | null | undefined): StarRrule | null {
  const source = (text ?? '').trim().replace(/^RRULE:/i, '');
  if (!source) return null;
  let freq: StarRruleFrequency | null = null;
  let interval = 1;
  let count: number | null = null;
  let until: Date | null = null;
  let byDay: StarRruleWeekday[] = [];
  let byMonthDay: number[] = [];
  let byMonth: number[] = [];
  let weekStart = 1;
  const unsupported: string[] = [];
  for (const part of source.split(';')) {
    if (!part.trim()) continue;
    const [rawKey, rawValue = ''] = part.split('=');
    const key = rawKey.trim().toUpperCase();
    const value = rawValue.trim().toUpperCase();
    if (!KNOWN.has(key)) {
      unsupported.push(key);
      continue;
    }
    switch (key) {
      case 'FREQ':
        freq = FREQUENCIES.find((f) => f === value) ?? null;
        if (!freq) return null;
        break;
      case 'INTERVAL': {
        const n = positiveInt(value);
        if (n === null) return null;
        interval = n;
        break;
      }
      case 'COUNT': {
        const n = positiveInt(value);
        if (n === null) return null;
        count = n;
        break;
      }
      case 'UNTIL':
        until = parseUntil(value);
        if (!until) return null;
        break;
      case 'BYDAY': {
        const days = parseList(value, parseWeekday);
        if (!days) return null;
        byDay = days;
        break;
      }
      case 'BYMONTHDAY': {
        const days = parseList(value, (v) =>
          /^[+-]?\d{1,2}$/.test(v) && Number(v) !== 0 && Math.abs(Number(v)) <= 31
            ? Number(v)
            : null,
        );
        if (!days) return null;
        byMonthDay = days;
        break;
      }
      case 'BYMONTH': {
        const months = parseList(value, (v) => {
          const n = positiveInt(v);
          return n !== null && n <= 12 ? n : null;
        });
        if (!months) return null;
        byMonth = months;
        break;
      }
      case 'WKST': {
        const day = DAYS.indexOf(value);
        if (day < 0) return null;
        weekStart = day;
        break;
      }
    }
  }
  if (!freq) return null;
  return { freq, interval, count, until, byDay, byMonthDay, byMonth, weekStart, unsupported };
}

function untilText(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  );
}

/** Writes a rule as RRULE text (without the `RRULE:` prefix). `UNTIL` is written in UTC. */
export function starFormatRrule(rule: StarRrule): string {
  const parts = [`FREQ=${rule.freq}`];
  if (rule.interval !== 1) parts.push(`INTERVAL=${rule.interval}`);
  if (rule.count !== null) parts.push(`COUNT=${rule.count}`);
  if (rule.until) parts.push(`UNTIL=${untilText(rule.until)}`);
  if (rule.byDay.length) {
    parts.push(`BYDAY=${rule.byDay.map((d) => `${d.ordinal || ''}${DAYS[d.day]}`).join(',')}`);
  }
  if (rule.byMonthDay.length) parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  if (rule.byMonth.length) parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  if (rule.weekStart !== 1) parts.push(`WKST=${DAYS[rule.weekStart]}`);
  return parts.join(';');
}

const daysInMonth = (year: number, month: number): number => new Date(year, month + 1, 0).getDate();

/** Local day number (days since 1970-01-01 of the local calendar), stable across DST. */
const dayNumber = (y: number, m: number, d: number): number => Date.UTC(y, m, d) / DAY_MS;

/** Calendar date of a local day number. */
function fromDayNumber(n: number): [number, number, number] {
  const date = new Date(n * DAY_MS);
  return [date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()];
}

/** Resolves a month day (negative from the end) for a month, or `null` when the month lacks it. */
function monthDay(value: number, year: number, month: number): number | null {
  const length = daysInMonth(year, month);
  const day = value > 0 ? value : length + value + 1;
  return day >= 1 && day <= length ? day : null;
}

/** Day numbers of the weekdays of `byDay` within [first, last] (inclusive), with ordinals. */
function weekdaysIn(byDay: readonly StarRruleWeekday[], first: number, last: number): number[] {
  const days: number[] = [];
  for (const { day, ordinal } of byDay) {
    // 1970-01-01 (day 0) was a Thursday (4).
    const firstMatch = first + ((day - ((first + 4) % 7) + 7) % 7);
    const matches: number[] = [];
    for (let n = firstMatch; n <= last; n += 7) matches.push(n);
    if (ordinal === 0) days.push(...matches);
    else {
      const picked = ordinal > 0 ? matches[ordinal - 1] : matches[matches.length + ordinal];
      if (picked !== undefined) days.push(picked);
    }
  }
  return days;
}

/** Candidate day numbers of one period, before the start, COUNT and UNTIL are applied. */
function periodDays(rule: StarRrule, start: Date, period: number): number[] {
  const startDay = dayNumber(start.getFullYear(), start.getMonth(), start.getDate());
  const weekdayOk = (n: number) =>
    !rule.byDay.length || rule.byDay.some((d) => d.day === (n + 4) % 7);
  const monthOk = (n: number) =>
    !rule.byMonth.length || rule.byMonth.includes(fromDayNumber(n)[1] + 1);
  const monthDayOk = (n: number) => {
    if (!rule.byMonthDay.length) return true;
    const [y, m, d] = fromDayNumber(n);
    return rule.byMonthDay.some((value) => monthDay(value, y, m) === d);
  };
  let days: number[];
  switch (rule.freq) {
    case 'DAILY':
      days = [startDay + period].filter((n) => weekdayOk(n) && monthDayOk(n));
      break;
    case 'WEEKLY': {
      const weekFirst = startDay - ((((startDay + 4) % 7) - rule.weekStart + 7) % 7) + period * 7;
      days = rule.byDay.length
        ? weekdaysIn(
            rule.byDay.map((d) => ({ day: d.day, ordinal: 0 })),
            weekFirst,
            weekFirst + 6,
          )
        : [startDay + period * 7];
      break;
    }
    case 'MONTHLY': {
      const total = start.getFullYear() * 12 + start.getMonth() + period;
      const [y, m] = [Math.floor(total / 12), total % 12];
      days = monthCandidates(rule, start, y, m, true);
      break;
    }
    case 'YEARLY': {
      const y = start.getFullYear() + period;
      if (rule.byDay.some((d) => d.ordinal !== 0) && !rule.byMonth.length) {
        // Ordinal weekdays of the whole year, for example the 20th Monday.
        days = weekdaysIn(rule.byDay, dayNumber(y, 0, 1), dayNumber(y, 11, 31)).filter(monthDayOk);
      } else if (!rule.byDay.length && !rule.byMonthDay.length) {
        const months = rule.byMonth.length ? rule.byMonth.map((m) => m - 1) : [start.getMonth()];
        days = months
          .filter((m) => start.getDate() <= daysInMonth(y, m))
          .map((m) => dayNumber(y, m, start.getDate()));
      } else {
        const months = rule.byMonth.length
          ? rule.byMonth.map((m) => m - 1)
          : Array.from({ length: 12 }, (_, m) => m);
        days = months.flatMap((m) => monthCandidates(rule, start, y, m, false));
      }
      break;
    }
  }
  return [...new Set(days.filter(monthOk))].sort((a, b) => a - b);
}

/** Candidate days of one month of a monthly or yearly rule. */
function monthCandidates(
  rule: StarRrule,
  start: Date,
  y: number,
  m: number,
  defaultToStartDay: boolean,
): number[] {
  const first = dayNumber(y, m, 1);
  const last = first + daysInMonth(y, m) - 1;
  if (!rule.byDay.length && !rule.byMonthDay.length) {
    const day = monthDay(start.getDate(), y, m);
    return defaultToStartDay && day !== null && day === start.getDate() ? [first + day - 1] : [];
  }
  const fromMonthDays = rule.byMonthDay
    .map((value) => monthDay(value, y, m))
    .filter((d): d is number => d !== null)
    .map((d) => first + d - 1);
  if (!rule.byDay.length) return fromMonthDays;
  const fromWeekdays = weekdaysIn(rule.byDay, first, last);
  return rule.byMonthDay.length
    ? fromWeekdays.filter((n) => fromMonthDays.includes(n))
    : fromWeekdays;
}

/** Number of whole periods between the start and `date`, used to skip ahead without COUNT. */
function periodsBefore(rule: StarRrule, start: Date, date: Date): number {
  switch (rule.freq) {
    case 'DAILY':
      return Math.floor(
        dayNumber(date.getFullYear(), date.getMonth(), date.getDate()) -
          dayNumber(start.getFullYear(), start.getMonth(), start.getDate()),
      );
    case 'WEEKLY':
      return Math.floor(
        (dayNumber(date.getFullYear(), date.getMonth(), date.getDate()) -
          dayNumber(start.getFullYear(), start.getMonth(), start.getDate())) /
          7,
      );
    case 'MONTHLY':
      return (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth();
    case 'YEARLY':
      return date.getFullYear() - start.getFullYear();
  }
}

/**
 * Start dates of the occurrences of a rule in a range (`start` inclusive, `end` exclusive), in
 * date order. `start` is the first moment of the series (DTSTART). `COUNT` counts from the start
 * of the series, and exceptions remove occurrences after `COUNT` is applied (as EXDATE does).
 * Invalid rule text gives no occurrence.
 */
export function starExpandRrule(
  rule: string | StarRrule,
  start: Date,
  range: { readonly start: Date; readonly end: Date },
  options: StarRruleExpandOptions = {},
): Date[] {
  const parsed = typeof rule === 'string' ? starParseRrule(rule) : rule;
  if (!parsed || Number.isNaN(start.getTime())) return [];
  const duration = Math.max(0, options.duration ?? 0);
  const limit = options.limit ?? 1000;
  const excluded = new Set(
    (options.exceptions ?? []).map((d) => dayNumber(d.getFullYear(), d.getMonth(), d.getDate())),
  );
  const rangeStart = range.start.getTime();
  const from = rangeStart - duration;
  const to = range.end.getTime();
  const result: Date[] = [];
  let produced = 0;
  // Without COUNT, the periods before the range cannot matter: start shortly before it.
  let period = 0;
  if (parsed.count === null) {
    const skip = periodsBefore(parsed, start, new Date(from)) - 1;
    if (skip > 0) period = Math.floor(skip / parsed.interval) * parsed.interval;
  }
  for (let walked = 0; walked < MAX_PERIODS; walked++, period += parsed.interval) {
    for (const n of periodDays(parsed, start, period)) {
      const [y, m, d] = fromDayNumber(n);
      const date = new Date(
        y,
        m,
        d,
        start.getHours(),
        start.getMinutes(),
        start.getSeconds(),
        start.getMilliseconds(),
      );
      const time = date.getTime();
      if (time < start.getTime()) continue;
      if (parsed.until && time > parsed.until.getTime()) return result;
      if (time >= to) return result;
      produced++;
      if (duration > 0 ? time + duration > rangeStart : time >= rangeStart) {
        if (!excluded.has(n)) {
          result.push(date);
          if (result.length >= limit) return result;
        }
      }
      if (parsed.count !== null && produced >= parsed.count) return result;
    }
  }
  return result;
}
