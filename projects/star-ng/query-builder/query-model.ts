import { validate, type SchemaPath } from '@angular/forms/signals';
import {
  STAR_TABLE_MATCH_MODES,
  STAR_UI_TEXT_DEFAULTS,
  StarColumnFilterType,
  StarFilterFunction,
  StarFilterRuleValue,
  StarTableMatchMode,
  StarUiText,
  ɵstarHasBound,
  ɵstarIsRangeFilter,
  ɵstarMatchesRule,
  ɵstarRuleActive,
} from '@star-ng/ui/core';

/** Value type of a query field; it decides the match modes and the value editor. */
export type StarQueryFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';

/** A choice of a `'select'` field. */
export interface StarQueryOption {
  readonly label: string;
  readonly value: string;
}

/** A field that a rule can test. */
export interface StarQueryField<T = unknown> {
  /** Key of the field in the model, and the property read when `value` is not set. */
  readonly field: string;
  readonly label: string;
  readonly type: StarQueryFieldType;
  /** Choices of a `'select'` field: texts, or `{ label, value }` pairs. */
  readonly options?: readonly (string | StarQueryOption)[];
  /** Match modes in menu order (default: `STAR_QUERY_MATCH_MODES[type]`). Custom names work too. */
  readonly matchModes?: readonly StarTableMatchMode[];
  /** Reads the value from a row (default: `row[field]`). Used by `starQueryToPredicate`. */
  readonly value?: (row: T) => unknown;
}

/**
 * Value of a rule: text, number, `yyyy-mm-dd` date, text list (`in`), range (`between`) or a
 * boolean (`'boolean'` fields).
 */
export type StarQueryRuleValue = StarFilterRuleValue | boolean;

/** One condition: a field, a match mode and a value. */
export interface StarQueryRule {
  readonly field: string;
  readonly matchMode: StarTableMatchMode;
  readonly value: StarQueryRuleValue;
}

/** Rules and groups joined with `and` (all must match) or `or` (one must match). */
export interface StarQueryGroup {
  readonly operator: 'and' | 'or';
  readonly rules: readonly (StarQueryRule | StarQueryGroup)[];
}

/**
 * Match modes of each field type, in menu order. The first one is the default. Text, number
 * and date use the modes of the table filter (`STAR_TABLE_MATCH_MODES`). On a `'select'` field,
 * `equals` and `notEquals` compare the text like the table filter: case and accents are ignored.
 */
export const STAR_QUERY_MATCH_MODES: Readonly<
  Record<StarQueryFieldType, readonly StarTableMatchMode[]>
> = {
  text: STAR_TABLE_MATCH_MODES.text,
  number: STAR_TABLE_MATCH_MODES.number,
  date: STAR_TABLE_MATCH_MODES.date,
  select: ['equals', 'notEquals', 'in'],
  boolean: ['equals'],
};

/** A custom match mode source: `StarFilterService`, or any object with the same `get`. */
export interface StarQueryModeSource {
  get(name: string): { readonly fn: StarFilterFunction; readonly label?: string } | undefined;
}

/** UI text of each built-in match mode. */
export const STAR_QUERY_MODE_TEXT: Readonly<Record<string, keyof StarUiText>> = {
  contains: 'matchContains',
  startsWith: 'matchStartsWith',
  endsWith: 'matchEndsWith',
  equals: 'matchEquals',
  notContains: 'matchNotContains',
  notEquals: 'matchNotEquals',
  lt: 'matchLt',
  lte: 'matchLte',
  gt: 'matchGt',
  gte: 'matchGte',
  between: 'matchBetween',
  dateIs: 'matchDateIs',
  dateIsNot: 'matchDateIsNot',
  dateBefore: 'matchDateBefore',
  dateAfter: 'matchDateAfter',
  in: 'matchIn',
};

/** True when the item is a group (it has `rules`), not a rule. */
export function starIsQueryGroup(item: StarQueryRule | StarQueryGroup): item is StarQueryGroup {
  return Array.isArray((item as StarQueryGroup).rules);
}

/** The match modes of a field: its `matchModes`, else the modes of its type. */
export function starQueryModesOf(field: StarQueryField<never> | undefined): readonly string[] {
  if (!field) return STAR_QUERY_MATCH_MODES.text;
  return field.matchModes?.length ? field.matchModes : STAR_QUERY_MATCH_MODES[field.type];
}

/** The menu text of a match mode: the UI text, the registered label, else the name. */
export function starQueryModeLabel(
  mode: string,
  text: StarUiText,
  service?: StarQueryModeSource | null,
): string {
  const key = STAR_QUERY_MODE_TEXT[mode];
  if (key) return text[key] as string;
  return service?.get(mode)?.label || mode;
}

/** The empty value of a new rule: `true` for a boolean, else `null`. */
export function starQueryEmptyValue(field: StarQueryField<never> | undefined): StarQueryRuleValue {
  return field?.type === 'boolean' ? true : null;
}

/** A new rule for a field: its first match mode and an empty value. */
export function starQueryNewRule(field: StarQueryField<never> | undefined): StarQueryRule {
  return {
    field: field?.field ?? '',
    matchMode: starQueryModesOf(field)[0],
    value: starQueryEmptyValue(field),
  };
}

/** The `{ label, value }` pairs of a `'select'` field. */
export function starQueryOptions(field: StarQueryField<never> | undefined): StarQueryOption[] {
  return (field?.options ?? []).map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option,
  );
}

/**
 * True when a rule can be tested: its field is known and it has a value (both bounds for
 * `between`, at least one choice for `in`).
 */
export function starQueryRuleComplete(
  rule: StarQueryRule,
  field: StarQueryField<never> | undefined,
): boolean {
  if (!field || !rule.matchMode) return false;
  const value = rule.value;
  if (typeof value === 'boolean') return field.type === 'boolean';
  if (rule.matchMode === 'between') {
    return ɵstarIsRangeFilter(value) && ɵstarHasBound(value.min) && ɵstarHasBound(value.max);
  }
  return ɵstarRuleActive({ matchMode: rule.matchMode, value });
}

/** Number of incomplete rules in a query, nested groups included. */
export function starQueryIncompleteCount(
  query: StarQueryGroup,
  fields: readonly StarQueryField<never>[],
): number {
  return query.rules.reduce(
    (count, item) =>
      count +
      (starIsQueryGroup(item)
        ? starQueryIncompleteCount(item, fields)
        : starQueryRuleComplete(
              item,
              fields.find((f) => f.field === item.field),
            )
          ? 0
          : 1),
    0,
  );
}

/** A boolean cell value; the texts `'false'`, `'0'` and `''` (any case) are false. */
function asBoolean(raw: unknown): boolean {
  if (typeof raw === 'string') return !['false', '0', ''].includes(raw.trim().toLowerCase());
  return Boolean(raw);
}

/**
 * A row predicate for a query, with the match logic of the table filter
 * (`ɵstarMatchesRule`): text modes ignore case and accents, number modes compare numbers, date
 * modes compare calendar days, `in` tests a list of choices. A mode that is not built in comes
 * from `service` (`StarFilterService`). An incomplete rule (no value, only one bound of `between`,
 * no choice for `in`, an unknown field) and an empty group match every row.
 *
 * ```ts
 * readonly rows = computed(() => orders.filter(starQueryToPredicate(this.query(), fields)));
 * ```
 */
export function starQueryToPredicate<T>(
  query: StarQueryGroup,
  fields: readonly StarQueryField<T>[],
  service?: StarQueryModeSource | null,
  locale: string | null = null,
): (row: T) => boolean {
  const byKey = new Map(fields.map((field) => [field.field, field]));
  const lookup = (name: string) => service?.get(name)?.fn;

  const testRule = (row: T, rule: StarQueryRule): boolean => {
    const field = byKey.get(rule.field);
    if (!field) return true;
    const raw = field.value
      ? field.value(row)
      : (row as Record<string, unknown> | null)?.[field.field];
    if (field.type === 'boolean' && typeof rule.value === 'boolean') {
      if (rule.matchMode === 'equals') return asBoolean(raw) === rule.value;
      if (rule.matchMode === 'notEquals') return asBoolean(raw) !== rule.value;
      const fn = lookup(rule.matchMode);
      return fn ? fn(raw, rule.value, locale) : true;
    }
    const text = raw === null || raw === undefined ? '' : String(raw);
    const type: StarColumnFilterType | undefined =
      field.type === 'boolean' ? undefined : field.type;
    return ɵstarMatchesRule(
      { raw, text },
      type,
      { matchMode: rule.matchMode, value: rule.value as StarFilterRuleValue },
      locale,
      lookup,
    );
  };

  /** `null` when the group has nothing to test (it matches every row). */
  const testGroup = (row: T, group: StarQueryGroup): boolean | null => {
    let any = false;
    let result = group.operator === 'and';
    for (const item of group.rules) {
      let match: boolean | null;
      if (starIsQueryGroup(item)) match = testGroup(row, item);
      else if (!starQueryRuleComplete(item, byKey.get(item.field))) match = null;
      else match = testRule(row, item);
      if (match === null) continue;
      any = true;
      if (group.operator === 'and' && !match) return false;
      if (group.operator === 'or' && match) result = true;
    }
    return any ? result : null;
  };

  return (row: T) => testGroup(row, query) ?? true;
}

/** The value of a rule as text for the summary. */
function valueText(
  rule: StarQueryRule,
  field: StarQueryField<never>,
  text: StarUiText,
  list: (items: readonly string[]) => string,
): string {
  const value = rule.value;
  if (typeof value === 'boolean') return value ? text.queryTrue : text.queryFalse;
  const choice = (item: string) =>
    starQueryOptions(field).find((option) => option.value === item)?.label ?? item;
  if (Array.isArray(value)) return list(value.map(choice));
  if (ɵstarIsRangeFilter(value)) {
    // Only complete rules reach the summary; a missing bound is never printed.
    if (!ɵstarHasBound(value.min) || !ɵstarHasBound(value.max)) return '';
    return text.queryRange(String(value.min), String(value.max));
  }
  return field.type === 'select' ? choice(String(value)) : String(value);
}

/**
 * A readable summary of a query, for example
 * "Customer contains an and (Status is one of Open, Paid or Total between 10 and 20)".
 * Incomplete rules (see `starQueryRuleComplete`) and empty groups are left out; an empty query
 * gives `uiText.queryEmpty`.
 * The values are printed as they are stored (`100`, `2026-03-01`), not formatted for a locale;
 * choice values print their option label.
 * `service` gives the names of custom match modes.
 */
export function starQueryToText(
  query: StarQueryGroup,
  fields: readonly StarQueryField<never>[],
  uiText: StarUiText,
  service?: StarQueryModeSource | null,
): string {
  const byKey = new Map(fields.map((field) => [field.field, field]));
  const list = (items: readonly string[]) => items.join(', ');

  const groupText = (group: StarQueryGroup, nested: boolean): string => {
    const parts: string[] = [];
    for (const item of group.rules) {
      if (starIsQueryGroup(item)) {
        const inner = groupText(item, true);
        if (inner) parts.push(inner);
        continue;
      }
      const field = byKey.get(item.field);
      if (!field || !starQueryRuleComplete(item, field)) continue;
      parts.push(
        uiText.queryRuleSummary(
          field.label,
          starQueryModeLabel(item.matchMode, uiText, service),
          valueText(item, field, uiText, list),
        ),
      );
    }
    if (!parts.length) return '';
    const joined = parts.join(` ${group.operator === 'or' ? uiText.queryOr : uiText.queryAnd} `);
    return nested && parts.length > 1 ? `(${joined})` : joined;
  };

  return groupText(query, false) || uiText.queryEmpty;
}

/** Options of `starQueryComplete`. */
export interface StarQueryCompleteOptions {
  /**
   * Error message, or a function that reads it when the rule runs (for a language that changes
   * at run time): `{ message: () => text.queryIncomplete }` with `text = inject(STAR_UI_TEXT)`.
   * Default: the English `queryIncomplete` text.
   */
  readonly message?: string | (() => string);
}

/**
 * Signal Forms rule: the query is invalid while a rule has no value (error kind
 * `'incompleteQuery'`). Use it in the schema of a `form()` or of a `SignalFormControl`:
 *
 * ```ts
 * readonly filter = form(signal(query), (path) => starQueryComplete(path, () => this.fields));
 * ```
 */
export function starQueryComplete(
  path: SchemaPath<StarQueryGroup>,
  fields: readonly StarQueryField<never>[] | (() => readonly StarQueryField<never>[]),
  options: StarQueryCompleteOptions = {},
): void {
  validate(path, ({ value }) => {
    const list = typeof fields === 'function' ? fields() : fields;
    return starQueryIncompleteCount(value(), list) > 0
      ? {
          kind: 'incompleteQuery',
          message:
            (typeof options.message === 'function' ? options.message() : options.message) ??
            STAR_UI_TEXT_DEFAULTS.queryIncomplete,
        }
      : undefined;
  });
}
