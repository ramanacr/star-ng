import type { StarUiText } from '@star-ng/ui/core';

/**
 * Column summaries of `star-table`: a summary row in the footer over all filtered rows, and a
 * summary row below each group with `groupBy`. Ignite UI column summaries (`hasSummary`,
 * `summaries`), AG Grid aggregation (`aggFunc`), PrimeNG group footer. The helpers are pure.
 */

/** Built-in summaries. */
export type StarSummaryKind = 'sum' | 'avg' | 'min' | 'max' | 'count';

/** A built-in summary, or a function of the rows that returns the value. */
export type StarColumnSummary<T> = StarSummaryKind | ((rows: readonly T[]) => unknown);

/** A summary cell: the label of a built-in summary, and the formatted value. */
export interface StarSummaryCell {
  readonly label: string | null;
  readonly text: string;
}

/** The column properties that a summary uses. */
export interface StarSummaryColumn<T> {
  readonly summary?: StarColumnSummary<T>;
  readonly summaryFormat?: Intl.NumberFormatOptions;
}

const isEmpty = (value: unknown) => value === null || value === undefined || value === '';

/**
 * Value of a built-in summary over cell values. `count`: the values that are not empty (`null`,
 * `undefined`, `''`). `sum` and `avg`: the finite numbers (`null` without numbers). `min` and
 * `max`: the smallest and largest number, or date when the values are dates.
 */
export function summarize(values: readonly unknown[], kind: StarSummaryKind): unknown {
  if (kind === 'count') return values.filter((value) => !isEmpty(value)).length;
  const dates = values.filter((value): value is Date => value instanceof Date);
  if ((kind === 'min' || kind === 'max') && dates.length && !values.some(isNumber)) {
    const times = dates.map((date) => date.getTime()).filter(Number.isFinite);
    if (!times.length) return null;
    return new Date(kind === 'min' ? Math.min(...times) : Math.max(...times));
  }
  const numbers = values.filter(isNumber);
  if (!numbers.length) return null;
  switch (kind) {
    case 'sum':
      return numbers.reduce((total, value) => total + value, 0);
    case 'avg':
      return numbers.reduce((total, value) => total + value, 0) / numbers.length;
    case 'min':
      return numbers.reduce((low, value) => (value < low ? value : low));
    case 'max':
      return numbers.reduce((high, value) => (value > high ? value : high));
  }
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * Display text of a summary value: a number with `Intl.NumberFormat` (`locale`, `format`), a date
 * with the medium date style of the locale, `''` for no value, else the text of the value.
 */
export function summaryText(
  value: unknown,
  format: Intl.NumberFormatOptions | undefined,
  locale: string | null,
): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    const key = `${locale ?? ''}|${JSON.stringify(format ?? {})}`;
    let formatter = numberFormats.get(key);
    if (!formatter) {
      formatter = new Intl.NumberFormat(locale ?? undefined, format);
      numberFormats.set(key, formatter);
    }
    return formatter.format(value);
  }
  if (value instanceof Date) {
    const key = locale ?? '';
    let formatter = dateFormats.get(key);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat(locale ?? undefined, { dateStyle: 'medium' });
      dateFormats.set(key, formatter);
    }
    return Number.isFinite(value.getTime()) ? formatter.format(value) : '';
  }
  return String(value);
}

/** Label of a built-in summary ("Sum", "Average" ...). */
export function summaryLabel(kind: StarSummaryKind, text: StarUiText): string {
  switch (kind) {
    case 'sum':
      return text.summarySum;
    case 'avg':
      return text.summaryAverage;
    case 'min':
      return text.summaryMinimum;
    case 'max':
      return text.summaryMaximum;
    case 'count':
      return text.summaryCount;
  }
}

/**
 * Summary cell of a column over rows: the label of a built-in summary and the formatted value.
 * `valueOf` reads the cell value of a row. `null` when the column has no summary.
 */
export function summaryCell<T>(
  column: StarSummaryColumn<T>,
  rows: readonly T[],
  valueOf: (row: T) => unknown,
  text: StarUiText,
  locale: string | null,
): StarSummaryCell | null {
  const summary = column.summary;
  if (!summary) return null;
  if (typeof summary === 'function') {
    return { label: null, text: summaryText(summary(rows), column.summaryFormat, locale) };
  }
  return {
    label: summaryLabel(summary, text),
    text: summaryText(summarize(rows.map(valueOf), summary), column.summaryFormat, locale),
  };
}

/**
 * Summary cell of a column in lazy mode: the owner gives the value (`summaries`), and the table
 * formats it with the label of a built-in summary.
 */
export function suppliedSummaryCell<T>(
  column: StarSummaryColumn<T>,
  value: unknown,
  text: StarUiText,
  locale: string | null,
): StarSummaryCell | null {
  const summary = column.summary;
  if (!summary) return null;
  return {
    label: typeof summary === 'function' ? null : summaryLabel(summary, text),
    text: summaryText(value, column.summaryFormat, locale),
  };
}
