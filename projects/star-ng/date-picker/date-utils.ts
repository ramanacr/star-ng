/**
 * Date helpers for the calendar controls. All values are local calendar days (time 00:00).
 * Formatting and parsing use `Intl`, so the order of day / month / year follows the locale.
 */

export interface StarDateRange {
  readonly start: Date | null;
  readonly end: Date | null;
}

/** Same calendar day at local midnight. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Adds months and clamps the day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

export function sameDay(a: Date | null | undefined, b: Date | null | undefined): boolean {
  return (
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

/** Negative when `a` is an earlier day than `b`, 0 on the same day. */
export function compareDays(a: Date, b: Date): number {
  return startOfDay(a).getTime() - startOfDay(b).getTime();
}

/** `yyyy-mm-dd`, stable key for DOM lookups and tracking. */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** First day of the week for a locale (0 = Sunday), from `Intl.Locale` week info when available. */
export function localeFirstDay(locale?: string): number {
  try {
    const intlLocale = new Intl.Locale(
      locale ?? (typeof navigator === 'undefined' ? 'en-US' : navigator.language),
    ) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
    return info ? info.firstDay % 7 : 1;
  } catch {
    return 1;
  }
}

/** 6 x 7 days covering the month of `month`, starting on `firstDay`. */
export function monthGrid(month: Date, firstDay: number): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() - firstDay + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  );
}

export const DEFAULT_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

export function formatDate(
  date: Date | null,
  locale: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  return date ? new Intl.DateTimeFormat(locale, options).format(date) : '';
}

/** Placeholder such as `dd/mm/yyyy` or `mm/dd/yyyy` for the locale's numeric date order. */
export function formatHint(locale: string | undefined): string {
  return new Intl.DateTimeFormat(locale, DEFAULT_DATE_FORMAT)
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

/**
 * Parses typed text. Accepts ISO `yyyy-mm-dd` and the locale's numeric order with any
 * separators (`22/11/2026`, `22.11.26`, `11-22-2026` in en-US). Returns null when invalid.
 */
export function parseDate(text: string, locale: string | undefined): Date | null {
  const value = text.trim();
  if (!value) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  const numbers = iso
    ? [iso[1], iso[2], iso[3]].map(Number)
    : value.split(/\D+/).filter(Boolean).map(Number);
  if (numbers.length !== 3) return null;

  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    [year, month, day] = numbers;
  } else {
    const order: string[] = new Intl.DateTimeFormat(locale, DEFAULT_DATE_FORMAT)
      .formatToParts(new Date(2026, 10, 22))
      .map((part): string => part.type)
      .filter((type) => type === 'day' || type === 'month' || type === 'year');
    const read = (type: string) => numbers[order.indexOf(type)];
    year = read('year');
    month = read('month');
    day = read('day');
    if (year < 100) year += 2000;
  }
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}
