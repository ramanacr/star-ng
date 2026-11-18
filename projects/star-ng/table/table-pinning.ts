import { Directive, input } from '@angular/core';

/**
 * Column pinning of `star-table`: the side of each column, the display order (start-pinned
 * columns first, end-pinned columns last) and the sticky offset of each pinned cell. PrimeNG
 * `pFrozenColumn` with `alignFrozen`, Ignite UI `pinned` / `pinningConfig`, AG Grid
 * `pinned: 'left' | 'right'`. The helpers are pure (no DOM), except `measureHeaderCells`.
 */

/** Side of a pinned column: the inline start (left in a left-to-right page) or the inline end. */
export type StarPinSide = 'start' | 'end';

/**
 * Pins by column `field`, set by the user or the owner. A field that is in the map wins over the
 * column definition: `null` unpins a column that `pinned` or `frozen` pins.
 */
export type StarColumnPins = Readonly<Record<string, StarPinSide | null>>;

/** `columnPin` output: the user (or `pinColumn()`) pinned or unpinned a column. */
export interface StarColumnPinEvent {
  readonly field: string;
  /** New side, or `null` when the column is not pinned now. */
  readonly side: StarPinSide | null;
}

/** The column properties that decide the pin side. */
export interface StarPinnable {
  readonly field: string;
  readonly pinned?: StarPinSide | null;
  readonly frozen?: boolean;
}

/** Side of a column: the runtime pin, else `pinned`, else `frozen` (an alias of `'start'`). */
export function pinSideOf(column: StarPinnable, pins: StarColumnPins): StarPinSide | null {
  if (Object.prototype.hasOwnProperty.call(pins, column.field)) return pins[column.field] ?? null;
  return column.pinned ?? (column.frozen ? 'start' : null);
}

const SIDE_RANK = { start: 0, none: 1, end: 2 } as const;

/**
 * Display order: start-pinned columns, then the other columns, then end-pinned columns. Inside
 * each part the columns follow `order` (fields); columns that are not in `order` keep their place
 * after it, in definition order.
 */
export function orderColumns<C extends StarPinnable>(
  columns: readonly C[],
  order: readonly string[],
  sideOf: (column: C) => StarPinSide | null,
): C[] {
  const position = new Map(order.map((field, index) => [field, index]));
  return columns
    .map((column, index) => ({
      column,
      side: SIDE_RANK[sideOf(column) ?? 'none'],
      rank: position.get(column.field) ?? order.length + index,
    }))
    .sort((a, b) => a.side - b.side || a.rank - b.rank)
    .map(({ column }) => column);
}

/** Where a pinned cell sticks. */
export interface StarPinPlacement {
  readonly side: StarPinSide;
  /** Distance from the edge of its side (`inset-inline-start` or `inset-inline-end`). */
  readonly offset: string;
  /** The last start column or the first end column: it draws the separator shadow. */
  readonly edge: boolean;
}

/**
 * Sticky placement of each pinned column of `columns` (visible, in display order), by field. The
 * offset of a column is `base` (the width of the selection, expander and reorder columns at the
 * start, of the row actions column at the end) plus the widths of the pinned columns between it
 * and the edge. Measured widths give pixels; before the first measure (or without layout) the
 * offset is a `calc()` of the declared widths.
 */
export function pinPlacements<C extends { readonly field: string }>(
  columns: readonly C[],
  sideOf: (column: C) => StarPinSide | null,
  measured: Readonly<Record<string, number>>,
  declared: (column: C) => string | null,
  base: { readonly start: number; readonly end: number } = { start: 0, end: 0 },
): ReadonlyMap<string, StarPinPlacement> {
  const placements = new Map<string, StarPinPlacement>();
  for (const side of ['start', 'end'] as const) {
    const pinned = columns.filter((column) => sideOf(column) === side);
    if (side === 'end') pinned.reverse();
    const start = side === 'start' ? base.start : base.end;
    const parts: string[] = [];
    let pixels = start;
    let allMeasured = true;
    pinned.forEach((column, index) => {
      const offset = allMeasured
        ? `${Math.round(pixels * 100) / 100}px`
        : `calc(${(start > 0 ? [`${start}px`, ...parts] : parts).join(' + ')})`;
      placements.set(column.field, { side, offset, edge: index === pinned.length - 1 });
      parts.push(declared(column) ?? '0px');
      const width = measured[column.field];
      if (width) pixels += width;
      else allMeasured = false;
    });
  }
  return placements;
}

/** Rendered widths of the header cells. */
export interface StarHeaderWidths {
  /** Column header cells, by field. */
  readonly columns: Readonly<Record<string, number>>;
  /** Offsets of the reorder, expander and selection columns at the start, by kind. */
  readonly lead: Readonly<Record<string, number>>;
  /** Width of all start columns (reorder, expander, selection): the base of the start pins. */
  readonly start: number;
  /** Width of the row actions column at the end: the base of the end pins. */
  readonly end: number;
}

/** Measures the header cells of a table element (`th[data-field]`, `th[data-lead]`). */
export function measureHeaderCells(host: HTMLElement): StarHeaderWidths {
  const columns: Record<string, number> = {};
  for (const cell of host.querySelectorAll<HTMLElement>('thead th[data-field]')) {
    const field = cell.dataset['field'];
    if (field) columns[field] = cell.getBoundingClientRect().width;
  }
  const lead: Record<string, number> = {};
  let start = 0;
  for (const cell of host.querySelectorAll<HTMLElement>('thead th[data-lead]')) {
    lead[cell.dataset['lead']!] = start;
    start += cell.getBoundingClientRect().width;
  }
  const actions = host.querySelector<HTMLElement>('thead th.star-table__row-actions');
  return { columns, lead, start, end: actions?.getBoundingClientRect().width ?? 0 };
}

/** Two width maps are the same within half a pixel. */
export function sameWidths(
  next: Readonly<Record<string, number>>,
  current: Readonly<Record<string, number>>,
): boolean {
  return (
    Object.keys(next).length === Object.keys(current).length &&
    Object.entries(next).every(([field, width]) => Math.abs((current[field] ?? -1) - width) < 0.5)
  );
}

/**
 * Makes a cell of a pinned column sticky: the side class, the offset and the separator shadow.
 * Internal part of `star-table`.
 */
@Directive({
  selector: '[starTablePin]',
  host: {
    '[class.star-table__cell--frozen]': "starTablePin()?.side === 'start'",
    '[class.star-table__cell--pinned-end]': "starTablePin()?.side === 'end'",
    '[class.star-table__cell--pin-edge]': '!!starTablePin()?.edge',
    '[style.inset-inline-start]':
      "starTablePin()?.side === 'start' ? starTablePin()?.offset : null",
    '[style.inset-inline-end]': "starTablePin()?.side === 'end' ? starTablePin()?.offset : null",
  },
})
export class StarTablePinCell {
  readonly starTablePin = input<StarPinPlacement | null | undefined>(null);
}

/** No measure yet. */
export const NO_WIDTHS: StarHeaderWidths = { columns: {}, lead: {}, start: 0, end: 0 };

/** Two measures are the same within half a pixel. */
export function sameHeaderWidths(next: StarHeaderWidths, current: StarHeaderWidths): boolean {
  return (
    sameWidths(next.columns, current.columns) &&
    sameWidths(next.lead, current.lead) &&
    Math.abs(next.start - current.start) < 0.5 &&
    Math.abs(next.end - current.end) < 0.5
  );
}

/** The pin buttons of a column in the Columns panel. */
export const PIN_ACTIONS = [
  { side: 'start', key: 'start', label: 'pinColumnStart', icon: 'ph-bold ph-arrow-line-left' },
  { side: 'end', key: 'end', label: 'pinColumnEnd', icon: 'ph-bold ph-arrow-line-right' },
  { side: null, key: 'unpin', label: 'unpinColumn', icon: 'ph-bold ph-push-pin-slash' },
] as const;

/**
 * Placement of a cell that spans columns (a column group header): pinned when all its columns are
 * pinned on one side, at the offset of the column next to the edge of that side.
 */
export function spanPlacement(
  placements: readonly (StarPinPlacement | null)[],
): StarPinPlacement | null {
  const first = placements[0];
  if (!first || placements.some((placement) => placement?.side !== first.side)) return null;
  const outer = first.side === 'start' ? first : placements[placements.length - 1]!;
  return {
    side: first.side,
    offset: outer.offset,
    edge: placements.some((placement) => placement!.edge),
  };
}
