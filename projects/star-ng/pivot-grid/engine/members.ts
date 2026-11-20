import type {
  StarPivotDateLevel,
  StarPivotDimension,
  StarPivotLevel,
  StarPivotMember,
  StarPivotOptions,
} from './types';

declare const ngDevMode: boolean | undefined;

const DATE_LEVELS: readonly StarPivotDateLevel[] = ['year', 'quarter', 'month'];
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Reads a field of a record (no path syntax: `a.b` is one key). */
export function readField(record: unknown, field: string): unknown {
  return record !== null && typeof record === 'object'
    ? (record as Record<string, unknown>)[field]
    : undefined;
}

/** A blank member: no value or an empty text. */
export function isBlank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

/**
 * A text key of a member value: equal values get equal keys, and values of different types do not
 * collide (`1` and `'1'`). Dates compare by time. The filter lists use it.
 */
export function starPivotMemberKey(value: unknown): string {
  if (isBlank(value)) return '_';
  if (value instanceof Date) return `d:${value.getTime()}`;
  switch (typeof value) {
    case 'string':
      return `s:${value}`;
    case 'number':
      return `n:${String(value)}`;
    case 'boolean':
      return `b:${value}`;
    case 'object':
    case 'function':
      return `o:${objectId(value as object)}`;
    default:
      return `x:${String(value)}`;
  }
}

/** A stable number per object, so different objects are different members. */
const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;
function objectId(value: object): number {
  let id = objectIds.get(value);
  if (id === undefined) {
    id = nextObjectId++;
    objectIds.set(value, id);
  }
  return id;
}

/**
 * The key of a member path, for `collapsedRows` and `collapsedColumns`: the JSON text of the
 * member values from the first level down, for example `starPivotPathKey(['North', 'Desk'])`.
 */
export function starPivotPathKey(path: readonly unknown[]): string {
  return JSON.stringify(
    path.map((value) =>
      value === undefined
        ? null
        : typeof value === 'number' && !Number.isFinite(value)
          ? // JSON writes NaN and Infinity as null: keep them apart from a blank member.
            { n: String(value) }
          : typeof value === 'object' && value !== null && !(value instanceof Date)
            ? { o: objectId(value) }
            : value,
    ),
  );
}

/** A date from a `Date`, a timestamp or a date text; `null` when it is not a valid date. */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return Number.isFinite(value) ? new Date(value) : null;
  if (typeof value === 'string') {
    const iso = ISO_DATE.exec(value);
    // A date-only ISO text is a local date (the Date parser reads it as UTC).
    const date = iso ? new Date(+iso[1], +iso[2] - 1, +iso[3]) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

const collators = new Map<string, Intl.Collator>();
/** A cached natural-order collator. */
export function collator(locale: string | undefined): Intl.Collator {
  const key = locale ?? '';
  let found = collators.get(key);
  if (!found) {
    found = new Intl.Collator(locale, { numeric: true });
    collators.set(key, found);
  }
  return found;
}

const monthNames = new Map<string, readonly string[]>();
function monthName(month: number, locale: string | undefined): string {
  const key = locale ?? '';
  let names = monthNames.get(key);
  if (!names) {
    const format = new Intl.DateTimeFormat(locale, { month: 'short' });
    names = Array.from({ length: 12 }, (_, m) => format.format(new Date(2000, m, 1)));
    monthNames.set(key, names);
  }
  return names[month - 1];
}

/** Year and month of a date in a time zone (`undefined`: the runtime zone). */
interface DateParts {
  readonly year: number;
  readonly month: number;
}

/**
 * An ISO date or date-time text without `Z` or an offset: a wall time, the same in every zone.
 * Year and month come from the text.
 */
const ISO_WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;

/** The format of each zone; `null`: the zone is not valid (the runtime zone is used). */
const zoneFormats = new Map<string, Intl.DateTimeFormat | null>();

function zoneFormat(timeZone: string): Intl.DateTimeFormat | null {
  let format = zoneFormats.get(timeZone);
  if (format === undefined) {
    try {
      format = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: 'numeric' });
    } catch {
      format = null;
      if (typeof ngDevMode === 'undefined' || ngDevMode) {
        console.warn(
          `star-pivot-grid: the time zone "${timeZone}" is not valid; the runtime zone is used.`,
        );
      }
    }
    zoneFormats.set(timeZone, format);
  }
  return format;
}

function partsOf(value: unknown, timeZone: string | undefined): DateParts | null {
  // A date or date-time text without an offset is a wall time: the same in every zone.
  if (typeof value === 'string') {
    const wall = ISO_WALL_TIME.exec(value);
    if (wall) {
      const month = +wall[2];
      const day = +wall[3];
      // Out of range (`2025-13-45`): not a date, as the Date parser says too.
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      return { year: +wall[1], month };
    }
  }
  const date = toDate(value);
  if (!date) return null;
  const format = timeZone ? zoneFormat(timeZone) : null;
  if (!format) return { year: date.getFullYear(), month: date.getMonth() + 1 };
  let year = 0;
  let month = 0;
  for (const part of format.formatToParts(date)) {
    if (part.type === 'year') year = Number(part.value);
    if (part.type === 'month') month = Number(part.value);
  }
  return { year, month };
}

/** One level of an axis, with its member reader. */
export interface AxisLevel<T> extends StarPivotLevel {
  /** The member of a record: its sort value (`raw`) and its key. */
  member(record: T): { readonly raw: unknown; readonly key: string };
  labelOf(raw: unknown): string;
  readonly dimension: StarPivotDimension<T>;
}

/** The levels of the dimensions of one axis (a date hierarchy gives several levels). */
export function axisLevels<T>(
  dimensions: readonly StarPivotDimension<T>[],
  options: StarPivotOptions & { readonly timeZone?: string },
): AxisLevel<T>[] {
  const levels: AxisLevel<T>[] = [];
  const blank = options.blankLabel ?? '(blank)';
  for (const dimension of dimensions) {
    const read = dimension.value ?? ((record: T) => readField(record, dimension.field));
    const name = dimension.label ?? dimension.field;
    const parts =
      dimension.dateHierarchy === true
        ? DATE_LEVELS
        : Array.isArray(dimension.dateHierarchy)
          ? DATE_LEVELS.filter((part) =>
              (dimension.dateHierarchy as readonly StarPivotDateLevel[]).includes(part),
            )
          : null;
    if (!parts?.length) {
      const labelOf = (raw: unknown): string =>
        isBlank(raw) ? blank : dimension.format ? dimension.format(raw) : plainLabel(raw, options);
      levels.push({
        field: dimension.field,
        label: name,
        part: null,
        dimension,
        labelOf,
        member: (record) => {
          const raw = read(record);
          return { raw: isBlank(raw) ? null : raw, key: memberKey(raw) };
        },
      });
      continue;
    }
    for (const part of parts) {
      levels.push({
        field: dimension.field,
        label: parts.length > 1 ? `${name} (${part})` : name,
        part,
        dimension,
        labelOf: (raw) => (raw === null ? blank : datePartLabel(part, raw as number, options)),
        member: (record) => {
          const date = partsOf(read(record), options.timeZone);
          if (!date) return { raw: null, key: '_' };
          const raw =
            part === 'year'
              ? date.year
              : part === 'quarter'
                ? Math.floor((date.month - 1) / 3) + 1
                : date.month;
          return { raw, key: `n:${raw}` };
        },
      });
    }
  }
  return levels;
}

function datePartLabel(part: StarPivotDateLevel, raw: number, options: StarPivotOptions): string {
  if (part === 'year') return String(raw);
  if (part === 'quarter') return options.quarterLabel ? options.quarterLabel(raw) : `Q${raw}`;
  return monthName(raw, options.locale);
}

function plainLabel(raw: unknown, options: StarPivotOptions): string {
  if (raw instanceof Date) return new Intl.DateTimeFormat(options.locale).format(raw);
  return String(raw);
}

/** Natural order of two member values (numbers by size, dates by time, texts by the collator). */
export function compareMembers(
  a: { readonly raw: unknown; readonly label: string },
  b: { readonly raw: unknown; readonly label: string },
  locale: string | undefined,
): number {
  if (a.raw === null || b.raw === null) return a.raw === b.raw ? 0 : a.raw === null ? 1 : -1;
  if (typeof a.raw === 'number' && typeof b.raw === 'number') return a.raw - b.raw;
  if (a.raw instanceof Date && b.raw instanceof Date) return a.raw.getTime() - b.raw.getTime();
  return collator(locale).compare(a.label, b.label);
}

/**
 * The distinct members of a field in natural order, for a filter list. The values are the raw
 * field values (a date hierarchy is not applied: a filter matches the field value).
 */
export function starPivotMembers<T>(
  data: readonly T[],
  dimension: Pick<StarPivotDimension<T>, 'field' | 'value' | 'format'>,
  options: StarPivotOptions = {},
): StarPivotMember[] {
  const read = dimension.value ?? ((record: T) => readField(record, dimension.field));
  const seen = new Map<string, StarPivotMember>();
  const blank = options.blankLabel ?? '(blank)';
  for (const record of data) {
    const value = read(record);
    const key = memberKey(value);
    if (seen.has(key)) continue;
    const label = isBlank(value)
      ? blank
      : dimension.format
        ? dimension.format(value)
        : plainLabel(value, options);
    seen.set(key, { key, value: isBlank(value) ? null : value, label });
  }
  return [...seen.values()].sort((a, b) =>
    compareMembers(
      { raw: a.value, label: a.label },
      { raw: b.value, label: b.label },
      options.locale,
    ),
  );
}

/** Short name inside the engine. */
export const memberKey = starPivotMemberKey;
