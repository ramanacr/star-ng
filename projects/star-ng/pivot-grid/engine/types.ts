/** Built-in aggregates of a pivot value. */
export type StarPivotAggregate = 'sum' | 'count' | 'avg' | 'min' | 'max' | 'distinctCount';

/**
 * A custom aggregate: it gets the values of the field and the source records of one cell, and
 * returns the cell value (`null` for an empty cell).
 */
export type StarPivotAggregateFn<T = unknown> = (
  values: readonly unknown[],
  records: readonly T[],
) => unknown;

/** A level of a date hierarchy. */
export type StarPivotDateLevel = 'year' | 'quarter' | 'month';

/**
 * Member order of a dimension: by label (default, natural order: `2` before `10`) or by the grand
 * total of a value (`value`: index in `values`). Members without a value (blank) come last.
 */
export interface StarPivotSort {
  readonly by?: 'label' | 'value';
  /** Index in `values` when `by` is `'value'` (default 0). */
  readonly value?: number;
  readonly order?: 'asc' | 'desc';
}

/** A field on the rows or the columns of a pivot. */
export interface StarPivotDimension<T = unknown> {
  /** The record field; also the id of the dimension. */
  readonly field: string;
  /** Name in the headers and the configurator (default: the field). */
  readonly label?: string;
  /** Reads the member value of a record (default: `record[field]`). */
  readonly value?: (record: T) => unknown;
  /**
   * Member label (default: the value as text; a date in the locale). Not used by the levels of a
   * date hierarchy: they show the year, the quarter (`quarterLabel`) and the short month name.
   */
  readonly format?: (value: unknown) => string;
  /**
   * Splits a date field into levels: `true` is year > quarter > month, or a list of levels in
   * this order. A value can be a `Date`, a timestamp or an ISO date text (`2025-03-31` is a local
   * date).
   */
  readonly dateHierarchy?: boolean | readonly StarPivotDateLevel[];
  readonly sort?: StarPivotSort;
}

/** A measure of a pivot: a field and how its values combine in a cell. */
export interface StarPivotValue<T = unknown> {
  readonly field: string;
  /** Name in the value header (default: the field). */
  readonly label?: string;
  /** Reads the value of a record (default: `record[field]`). */
  readonly value?: (record: T) => unknown;
  /**
   * `'sum'` (default), `'count'` (records), `'avg'`, `'min'`, `'max'` (numbers and number texts),
   * `'distinctCount'` (distinct values that are not blank) or a function.
   */
  readonly aggregate?: StarPivotAggregate | StarPivotAggregateFn<T>;
  /** Cell text: `Intl.NumberFormat` options or a function (default: the locale number format). */
  readonly format?: Intl.NumberFormatOptions | ((value: unknown) => string);
}

/** Member filter of a field: the records whose value is in `include` (when set) and not in `exclude`. */
export interface StarPivotFilter<T = unknown> {
  readonly field: string;
  /**
   * Reads the value of a record (default: the `value` accessor of a dimension or value with this
   * field, else `record[field]`).
   */
  readonly value?: (record: T) => unknown;
  readonly include?: readonly unknown[];
  readonly exclude?: readonly unknown[];
}

/** What a pivot shows. Every list is in display order. */
export interface StarPivotConfig<T = unknown> {
  readonly rows: readonly StarPivotDimension<T>[];
  readonly columns: readonly StarPivotDimension<T>[];
  readonly values: readonly StarPivotValue<T>[];
  /** Fields that filter the records. A field can filter and be on an axis at the same time. */
  readonly filters?: readonly StarPivotFilter<T>[];
  /** A grand total row at the end (default true). */
  readonly rowGrandTotals?: boolean;
  /** Parent rows show the subtotal of their children (default true). */
  readonly rowSubtotals?: boolean;
  /** Grand total columns at the end (default true). */
  readonly columnGrandTotals?: boolean;
  /** A subtotal column after the children of each expanded column member (default true). */
  readonly columnSubtotals?: boolean;
  /** Path keys (`starPivotPathKey`) of the collapsed row members. */
  readonly collapsedRows?: readonly string[];
  /** Path keys (`starPivotPathKey`) of the collapsed column members. */
  readonly collapsedColumns?: readonly string[];
  /** Text of a cell without records (default empty). */
  readonly emptyText?: string;
  /**
   * IANA time zone of the date hierarchy buckets, for example `'UTC'` or `'Europe/Berlin'`.
   * Default: the local time zone of the runtime. A server render (SSR) and the browser can be in
   * different zones, so an instant near a month or quarter boundary can land in another bucket:
   * set a zone when the data holds instants (timestamps, `Date`, date-time texts). A date-only
   * text (`2025-03-31`) is a calendar date in every zone.
   */
  readonly timeZone?: string;
}

/** Options of `starPivot` that are not part of the config. */
export interface StarPivotOptions {
  /** Locale of the labels, the order and the number formats (default: the runtime locale). */
  readonly locale?: string;
  /** Label of a member without a value (default `(blank)`). */
  readonly blankLabel?: string;
  /** Label of a quarter of a date hierarchy (default `Q1` … `Q4`). */
  readonly quarterLabel?: (quarter: number) => string;
}

/** A row of the pivot result: a member (with its level) or the grand total. */
export interface StarPivotRow {
  /** `starPivotPathKey(path)`; unique among the rows. */
  readonly key: string;
  /** Member values from the first level down (`[]` for the grand total). */
  readonly path: readonly unknown[];
  readonly labels: readonly string[];
  /** Label of the member (`''` for the grand total). */
  readonly label: string;
  /** Level of the member, 0 at the top. */
  readonly level: number;
  readonly kind: 'member' | 'total';
  /** The member has children (it is not on the last level). */
  readonly expandable: boolean;
  readonly expanded: boolean;
  /** The row shows values (false for an expanded parent when subtotals are off). */
  readonly hasValues: boolean;
}

/** A leaf column of the pivot result: one value of a column member, subtotal or grand total. */
export interface StarPivotColumn {
  /** Unique among the columns. */
  readonly key: string;
  readonly path: readonly unknown[];
  readonly labels: readonly string[];
  /** Label of the member (`''` for the grand total). */
  readonly label: string;
  readonly level: number;
  readonly kind: 'member' | 'subtotal' | 'total';
  /** Index of the value in `values` (-1 when there are no values). */
  readonly valueIndex: number;
}

/** A cell of the column headers. `row`, `column`, `rowSpan` and `colSpan` place it in the grid. */
export interface StarPivotHeader {
  readonly key: string;
  readonly path: readonly unknown[];
  /** Member label, value label, or `''` for the grand total. */
  readonly label: string;
  readonly kind: 'member' | 'subtotal' | 'total' | 'value';
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly colSpan: number;
  readonly level: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
  /** Index in `values` of a value header, else -1. */
  readonly valueIndex: number;
}

/** A level of an axis (a dimension, or one part of a date hierarchy). */
export interface StarPivotLevel {
  readonly field: string;
  readonly label: string;
  /** The date part, or `null` for a plain dimension. */
  readonly part: StarPivotDateLevel | null;
}

/** The computed pivot table. */
export interface StarPivotResult<T = unknown> {
  readonly rows: readonly StarPivotRow[];
  readonly columns: readonly StarPivotColumn[];
  readonly headerRows: readonly (readonly StarPivotHeader[])[];
  readonly rowLevels: readonly StarPivotLevel[];
  readonly columnLevels: readonly StarPivotLevel[];
  /** Cell values by row and column; `null` when the cell has no records or no values. */
  readonly cells: readonly (readonly unknown[])[];
  /** Records after the filters. */
  readonly recordCount: number;
  readonly values: readonly StarPivotValue<T>[];
  /** The source records of a cell (drill-down). */
  records(row: number, column: number): readonly T[];
}

/** A distinct member of a field (for a filter list). `key` is unique. */
export interface StarPivotMember {
  readonly key: string;
  readonly value: unknown;
  readonly label: string;
}
