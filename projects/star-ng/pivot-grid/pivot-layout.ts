import type {
  StarPivotAggregate,
  StarPivotConfig,
  StarPivotDateLevel,
  StarPivotDimension,
  StarPivotHeader,
  StarPivotValue,
} from './engine';

/** An area of the pivot configurator. `null` is the list of unused fields. */
export type StarPivotArea = 'rows' | 'columns' | 'values' | 'filters';

/** A field that the configurator offers. */
export interface StarPivotField<T = unknown> {
  readonly field: string;
  readonly label?: string;
  /** Used when the field goes to Rows or Columns. */
  readonly dateHierarchy?: boolean | readonly StarPivotDateLevel[];
  /** Member label, used when the field goes to Rows or Columns. */
  readonly format?: (value: unknown) => string;
  /** Aggregate when the field goes to Values (default `'sum'`). */
  readonly aggregate?: StarPivotAggregate;
  /** Cell format when the field goes to Values. */
  readonly valueFormat?: StarPivotValue<T>['format'];
}

/** The fields of each configurator area, in order. A field shows in one area only. */
export interface StarPivotAreas {
  readonly rows: readonly string[];
  readonly columns: readonly string[];
  readonly values: readonly string[];
  readonly filters: readonly string[];
}

/**
 * The configurator areas of a config: the row and column dimensions, the values, and the filters
 * whose field is not on Rows, Columns or Values (a filter of an axis field shows on its chip).
 */
export function starPivotAreas<T>(config: StarPivotConfig<T>): StarPivotAreas {
  const rows = config.rows.map((item) => item.field);
  const columns = config.columns.map((item) => item.field);
  const values = config.values.map((item) => item.field);
  const used = new Set([...rows, ...columns, ...values]);
  const filters = (config.filters ?? [])
    .map((item) => item.field)
    .filter((field) => !used.has(field));
  return { rows, columns, values, filters };
}

/** The area of a field, or `null` when it is unused. */
export function starPivotAreaOf<T>(
  config: StarPivotConfig<T>,
  field: string,
): StarPivotArea | null {
  const areas = starPivotAreas(config);
  for (const area of ['rows', 'columns', 'values', 'filters'] as const) {
    if (areas[area].includes(field)) return area;
  }
  return null;
}

function insert<V>(list: readonly V[], item: V, index: number | undefined): V[] {
  const copy = [...list];
  const at = index === undefined ? copy.length : Math.max(0, Math.min(index, copy.length));
  copy.splice(at, 0, item);
  return copy;
}

/**
 * Moves a field to an area (`null`: out of the pivot) at `index` (default: the end) and returns
 * the new config. A dimension keeps its settings between Rows and Columns; a field taken out of
 * the pivot also loses its member filter. The record filters of a field stay when it moves
 * between areas.
 */
export function starPivotMoveField<T>(
  config: StarPivotConfig<T>,
  field: StarPivotField<T>,
  to: StarPivotArea | null,
  index?: number,
): StarPivotConfig<T> {
  const name = field.field;
  const from = starPivotAreaOf(config, name);
  const dimension: StarPivotDimension<T> = config.rows.find((item) => item.field === name) ??
    config.columns.find((item) => item.field === name) ?? {
      field: name,
      ...(field.label !== undefined ? { label: field.label } : {}),
      ...(field.dateHierarchy !== undefined ? { dateHierarchy: field.dateHierarchy } : {}),
      ...(field.format ? { format: field.format } : {}),
    };
  const value: StarPivotValue<T> = config.values.find((item) => item.field === name) ?? {
    field: name,
    aggregate: field.aggregate ?? 'sum',
    ...(field.label !== undefined ? { label: field.label } : {}),
    ...(field.valueFormat ? { format: field.valueFormat } : {}),
  };
  let rows = config.rows.filter((item) => item.field !== name);
  let columns = config.columns.filter((item) => item.field !== name);
  let values = config.values.filter((item) => item.field !== name);
  let filters = [...(config.filters ?? [])];
  if (to === null) filters = filters.filter((item) => item.field !== name);
  if (to === 'rows') rows = insert(rows, dimension, index);
  if (to === 'columns') columns = insert(columns, dimension, index);
  if (to === 'values') values = insert(values, value, index);
  if (to === 'filters') {
    const existing = filters.find((item) => item.field === name) ?? { field: name };
    filters = filters.filter((item) => item.field !== name);
    // The index counts the filter chips of the Filters area only.
    const shown = starPivotAreas({ ...config, rows, columns, values, filters }).filters;
    const before = index === undefined ? undefined : shown[index];
    const at = before === undefined ? filters.length : filters.findIndex((f) => f.field === before);
    filters = insert(filters, existing, at);
  }
  const moved = from !== to;
  return {
    ...config,
    rows,
    columns,
    values,
    filters,
    // A dimension that leaves an axis takes its collapsed members along: the paths change.
    ...(moved && (from === 'rows' || to === 'rows') ? { collapsedRows: [] } : {}),
    ...(moved && (from === 'columns' || to === 'columns') ? { collapsedColumns: [] } : {}),
  };
}

/** Adds or removes a key in a list. */
export function starToggleKey(keys: readonly string[], key: string): string[] {
  return keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key];
}

/** A range of rows or columns to render, with the pixel sizes of the parts before and after. */
export interface StarPivotWindow {
  readonly start: number;
  readonly end: number;
  readonly before: number;
  readonly after: number;
}

/**
 * The items of a windowed axis to render: all of them up to `threshold` items or without a known
 * viewport size (server, first render), else the items in view plus `overscan` on each side.
 */
export function starPivotWindow(
  count: number,
  size: number,
  scroll: number,
  viewport: number,
  overscan: number,
  threshold: number,
): StarPivotWindow {
  if (count <= threshold || viewport <= 0 || size <= 0) {
    return { start: 0, end: count, before: 0, after: 0 };
  }
  const first = Math.floor(Math.max(0, scroll) / size);
  const start = Math.max(0, Math.min(count - 1, first - overscan));
  const end = Math.min(count, first + Math.ceil(viewport / size) + overscan + 1);
  return { start, end, before: start * size, after: (count - end) * size };
}

/** A header cell cut to the rendered columns: its rendered span. */
export interface StarPivotClippedHeader {
  readonly cell: StarPivotHeader;
  readonly span: number;
}

/** The header cells of one header row that touch the rendered columns `[start, end)`. */
export function starPivotClipHeaders(
  cells: readonly StarPivotHeader[],
  start: number,
  end: number,
): StarPivotClippedHeader[] {
  const clipped: StarPivotClippedHeader[] = [];
  for (const cell of cells) {
    const from = Math.max(cell.column, start);
    const to = Math.min(cell.column + cell.colSpan, end);
    if (to > from) clipped.push({ cell, span: to - from });
  }
  return clipped;
}

/**
 * The header cell that covers each header row and column (a cell with a row span covers the rows
 * below it). `grid[row][column]`; `undefined` where no cell is.
 */
export function starPivotHeaderGrid(
  rows: readonly (readonly StarPivotHeader[])[],
  columnCount: number,
): (StarPivotHeader | undefined)[][] {
  const grid = rows.map(() => new Array<StarPivotHeader | undefined>(columnCount));
  for (const row of rows) {
    for (const cell of row) {
      for (let r = cell.row; r < cell.row + cell.rowSpan && r < rows.length; r++) {
        for (let c = cell.column; c < cell.column + cell.colSpan && c < columnCount; c++) {
          grid[r][c] = cell;
        }
      }
    }
  }
  return grid;
}
