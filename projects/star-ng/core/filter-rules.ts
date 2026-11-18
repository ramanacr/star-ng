import { starFilterMatch, StarFilterMatchMode } from './filter-match';
import { StarFilterFunction } from './filter-service';

/**
 * Filter rule model and matching, shared by `star-table` (column filters) and
 * `star-query-builder`: the old value shapes (text, text list, range) and the rule model of the
 * filter menu (`StarFilterConstraint`, PrimeNG `FilterMetadata[]` with `operator`). Text matching
 * uses `starFilterMatch`. Pure functions, so they run on the server too.
 */

/** Filter control of a column (and value type of a filter rule). */
export type StarColumnFilterType = 'text' | 'select' | 'multiselect' | 'number' | 'date';

/**
 * How a filter rule matches (PrimeNG `FilterMatchMode`). Text: `contains`, `startsWith`,
 * `endsWith`, `equals`, `notContains`. Number: `equals`, `notEquals`, `lt`, `lte`, `gt`, `gte`,
 * `between`. Date: `dateIs`, `dateIsNot`, `dateBefore`, `dateAfter`, `between`. Choice lists:
 * `in`. Any other name is a mode registered with `StarFilterService`.
 */
export type StarTableMatchMode =
  | StarFilterMatchMode
  | 'notEquals'
  | 'lt'
  | 'lte'
  | 'gt'
  | 'gte'
  | 'between'
  | 'dateIs'
  | 'dateIsNot'
  | 'dateBefore'
  | 'dateAfter'
  | 'in'
  | (string & {});

/** The match modes of each filter type, in menu order. The first one is the default. */
export const STAR_TABLE_MATCH_MODES: Readonly<
  Record<StarColumnFilterType, readonly StarTableMatchMode[]>
> = {
  text: ['contains', 'startsWith', 'endsWith', 'equals', 'notContains'],
  number: ['equals', 'notEquals', 'lt', 'lte', 'gt', 'gte', 'between'],
  date: ['dateIs', 'dateIsNot', 'dateBefore', 'dateAfter', 'between'],
  select: ['in'],
  multiselect: ['in'],
};

/** Range of a `'number'` filter (numbers) or a `'date'` filter (`yyyy-mm-dd` text). */
export interface StarRangeFilter {
  readonly min?: number | string | null;
  readonly max?: number | string | null;
}

/** Value of a rule: text, number, `yyyy-mm-dd` date, text list (`in`) or range (`between`). */
export type StarFilterRuleValue = string | number | readonly string[] | StarRangeFilter | null;

/** One rule of a column filter (PrimeNG `FilterMetadata`). */
export interface StarFilterRule {
  readonly matchMode: StarTableMatchMode;
  readonly value: StarFilterRuleValue;
}

/** Rules of a column filter, joined with `and` ("Match all") or `or` ("Match any"). */
export interface StarFilterConstraint {
  readonly operator: 'and' | 'or';
  readonly rules: readonly StarFilterRule[];
}

/**
 * Value of a column filter: text (`'text'`, `'select'`), text list (`'multiselect'`), range
 * (`'number'`, `'date'`), or rules (`StarFilterConstraint`, the filter menu).
 */
export type StarFilterValue = string | readonly string[] | StarRangeFilter | StarFilterConstraint;

/** Column filter values by column `field`. An empty or missing value means "no filter". */
export type StarColumnFilters = Readonly<Record<string, StarFilterValue>>;

/** A cell as the filter sees it: the raw value and the display text. */
export interface StarFilterCell {
  readonly raw: unknown;
  readonly text: string;
}

/** Looks up a custom match mode (`StarFilterService.get`). */
export type StarFilterLookup = (name: string) => StarFilterFunction | undefined;

/** The value is a rule set (`StarFilterConstraint`). */
export function starIsFilterConstraint(value: unknown): value is StarFilterConstraint {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as StarFilterConstraint).rules)
  );
}

/** The value is a range (`{ min, max }`), not a text list or a rule set. */
export function starIsRangeFilter(value: unknown): value is StarRangeFilter {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !starIsFilterConstraint(value)
  );
}

/** A range bound is set (not `null`, `undefined` or `''`). */
export function starHasBound(bound: number | string | null | undefined): bound is number | string {
  return bound !== null && bound !== undefined && bound !== '';
}

/** A rule with a value to match (an empty rule matches every row). */
export function starRuleActive(rule: StarFilterRule): boolean {
  const value = rule.value;
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (starIsRangeFilter(value)) return starHasBound(value.min) || starHasBound(value.max);
  return value.length > 0;
}

/** The filter value filters something. */
export function starIsActiveFilter(value: StarFilterValue | undefined): value is StarFilterValue {
  if (starIsFilterConstraint(value)) return value.rules.some(starRuleActive);
  if (starIsRangeFilter(value)) return starHasBound(value.min) || starHasBound(value.max);
  return !!value && value.length > 0;
}

/** Local calendar day of a cell value as `yyyy-mm-dd`, or `''` when it is not a date. */
export function starDayKey(value: unknown): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (value === null || value === undefined || Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Modes that only compare numbers (without a column type). */
const NUMBER_ONLY = new Set<string>(['lt', 'lte', 'gt', 'gte', 'between']);
const BUILT_IN = new Set<string>([
  ...STAR_TABLE_MATCH_MODES.text,
  ...STAR_TABLE_MATCH_MODES.number,
  ...STAR_TABLE_MATCH_MODES.date,
  'in',
]);

function amountOf(value: unknown): number {
  return value === null || value === undefined || value === '' ? NaN : Number(value);
}

function inRange(
  value: number | string,
  range: StarRangeFilter,
  toBound: (b: number | string) => number | string,
): boolean {
  return (
    (!starHasBound(range.min) || value >= toBound(range.min)) &&
    (!starHasBound(range.max) || value <= toBound(range.max))
  );
}

function matchNumber(raw: unknown, mode: string, value: StarFilterRuleValue): boolean {
  const amount = amountOf(raw);
  if (Number.isNaN(amount)) return false;
  if (mode === 'between') return starIsRangeFilter(value) && inRange(amount, value, Number);
  const target = Number(value);
  switch (mode) {
    case 'notEquals':
      return amount !== target;
    case 'lt':
      return amount < target;
    case 'lte':
      return amount <= target;
    case 'gt':
      return amount > target;
    case 'gte':
      return amount >= target;
    default:
      return amount === target;
  }
}

function matchDate(raw: unknown, mode: string, value: StarFilterRuleValue): boolean {
  const day = starDayKey(raw);
  if (!day) return false;
  if (mode === 'between') return starIsRangeFilter(value) && inRange(day, value, starDayKey);
  const target = starDayKey(value);
  switch (mode) {
    case 'dateIsNot':
      return day !== target;
    case 'dateBefore':
      return day < target;
    case 'dateAfter':
      return day > target;
    default:
      return day === target;
  }
}

/**
 * True when a cell matches one rule. An inactive rule (no value) matches. A mode that is not
 * built in comes from `custom` (`StarFilterService`); an unknown mode matches every row.
 */
export function starMatchesRule(
  cell: StarFilterCell,
  type: StarColumnFilterType | undefined,
  rule: StarFilterRule,
  locale: string | null = null,
  custom?: StarFilterLookup,
): boolean {
  if (!starRuleActive(rule)) return true;
  const { matchMode: mode, value } = rule;
  if (!BUILT_IN.has(mode)) {
    const fn = custom?.(mode);
    return fn ? fn(cell.raw, value, locale) : true;
  }
  if (mode === 'in') {
    return Array.isArray(value) ? value.includes(cell.text) : cell.text === String(value);
  }
  if (type === 'number') return matchNumber(cell.raw, mode, value);
  if (type === 'date' || mode.startsWith('date')) return matchDate(cell.raw, mode, value);
  if (NUMBER_ONLY.has(mode) || typeof value === 'number') return matchNumber(cell.raw, mode, value);
  if (mode === 'notEquals') return !starFilterMatch(cell.text, String(value), 'equals', locale);
  return starFilterMatch(cell.text, String(value), mode as StarFilterMatchMode, locale);
}

/**
 * True when a cell matches a column filter value. Old shapes keep their meaning: a range matches
 * numbers or days between the bounds, a text list matches one of its texts, a text equals the
 * cell for a `'select'` column and else matches with `mode` (default `contains`).
 */
export function starMatchesFilter(
  cell: StarFilterCell,
  type: StarColumnFilterType | undefined,
  value: StarFilterValue,
  mode: StarTableMatchMode | undefined,
  locale: string | null = null,
  custom?: StarFilterLookup,
): boolean {
  if (starIsFilterConstraint(value)) {
    const rules = value.rules.filter(starRuleActive);
    if (!rules.length) return true;
    const test = (rule: StarFilterRule) => starMatchesRule(cell, type, rule, locale, custom);
    return value.operator === 'or' ? rules.some(test) : rules.every(test);
  }
  if (starIsRangeFilter(value)) {
    return type === 'date'
      ? matchDate(cell.raw, 'between', value)
      : matchNumber(cell.raw, 'between', value);
  }
  if (typeof value !== 'string') return value.includes(cell.text);
  if (type === 'select') return cell.text === value;
  // A text without a column mode keeps its old meaning on every column: the display text
  // contains it (also on a number or date column).
  if (!mode) return starFilterMatch(cell.text, value, 'contains', locale);
  return starMatchesRule(cell, type, { matchMode: mode, value }, locale, custom);
}
