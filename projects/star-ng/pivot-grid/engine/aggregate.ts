import { isBlank, memberKey, readField } from './members';
import type { StarPivotValue } from './types';

/** A number from a number or a number text; `null` otherwise. */
function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  return null;
}

/**
 * The value of one cell: the aggregate of `value` over the records with the indexes `indexes`.
 * A cell without records is `null`.
 */
export function aggregateCell<T>(
  value: StarPivotValue<T>,
  data: readonly T[],
  indexes: readonly number[],
): unknown {
  if (!indexes.length) return null;
  const read = value.value ?? ((record: T) => readField(record, value.field));
  const aggregate = value.aggregate ?? 'sum';
  if (typeof aggregate === 'function') {
    const records = indexes.map((index) => data[index]);
    return aggregate(
      records.map((record) => read(record)),
      records,
    );
  }
  if (aggregate === 'count') return indexes.length;
  if (aggregate === 'distinctCount') {
    const keys = new Set<string>();
    for (const index of indexes) {
      const item = read(data[index]);
      if (!isBlank(item)) keys.add(memberKey(item));
    }
    return keys.size;
  }
  let count = 0;
  let sum = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const index of indexes) {
    const number = toNumber(read(data[index]));
    if (number === null) continue;
    count++;
    sum += number;
    if (number < min) min = number;
    if (number > max) max = number;
  }
  if (!count) return null;
  switch (aggregate) {
    case 'avg':
      return sum / count;
    case 'min':
      return min;
    case 'max':
      return max;
    default:
      return sum;
  }
}

const formats = new Map<string, Intl.NumberFormat>();

/**
 * The text of a cell value: the `format` of the value (a function or `Intl.NumberFormat` options),
 * the locale number format for a number, the text of any other value, `emptyText` for `null`.
 */
export function starPivotFormatValue<T>(
  cell: unknown,
  value: StarPivotValue<T> | undefined,
  locale?: string,
  emptyText = '',
): string {
  if (cell === null || cell === undefined) return emptyText;
  const format = value?.format;
  if (typeof format === 'function') return format(cell);
  if (typeof cell !== 'number') return String(cell);
  const key = `${locale ?? ''}\u0000${format ? JSON.stringify(format) : ''}`;
  let number = formats.get(key);
  if (!number) {
    try {
      number = new Intl.NumberFormat(locale, format);
    } catch {
      number = new Intl.NumberFormat(locale);
    }
    if (formats.size > 200) formats.clear();
    formats.set(key, number);
  }
  return number.format(cell);
}
