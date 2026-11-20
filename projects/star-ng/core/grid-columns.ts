import { starIsRtl } from './direction';

/**
 * Sort, column width and edit helpers shared by the data grids (`star-table`, `star-tree-table`).
 * They are internal (`ɵ` names): the entry points use them, applications do not. They hold no
 * signal state.
 */

/** One sort column: the shape of `StarSortState` from `@star-ng/ui/table`. */
export interface ɵStarSortRule {
  readonly field: string | null;
  readonly order: 1 | -1;
}

/** Smallest width, in pixels, that the user can give a column. */
export const ɵSTAR_MIN_COLUMN_WIDTH = 48;
/** `aria-valuemax` of a resize handle. The column width itself has no upper limit. */
const MAX_COLUMN_WIDTH_HINT = 2000;
/** Step of a resize with the arrow keys, in pixels. */
const RESIZE_STEP = 16;

/**
 * The sort columns in priority order: `sortMeta` with `multiSort` (when it has a column), else
 * the single `sortField` / `sortOrder` (none without a field).
 */
export function ɵstarSortRules(
  multiSort: boolean,
  meta: readonly ɵStarSortRule[],
  field: string | null,
  order: 1 | -1,
): readonly ɵStarSortRule[] {
  if (multiSort && meta.length) return meta;
  return field ? [{ field, order }] : [];
}

/**
 * The sort after the user sorts by a column. The column gets ascending order, or the other order
 * when it is already a sort column. `add` (Shift with `multiSort`) adds the column to the sort;
 * else it is the only sort column. `meta` is the new `sortMeta` (empty without `multiSort`);
 * `first` is the new `sortField` / `sortOrder`.
 */
export function ɵstarNextSort(
  sorts: readonly ɵStarSortRule[],
  field: string,
  multiSort: boolean,
  add: boolean,
): { readonly meta: readonly ɵStarSortRule[]; readonly first: ɵStarSortRule } {
  const current = sorts.find((sort) => sort.field === field);
  const order: 1 | -1 = current ? (current.order === 1 ? -1 : 1) : 1;
  let meta: readonly ɵStarSortRule[];
  if (multiSort && add) {
    meta = current
      ? sorts.map((sort) => (sort.field === field ? { ...sort, order } : sort))
      : [...sorts, { field, order }];
  } else {
    meta = multiSort ? [{ field, order }] : [];
  }
  return { meta, first: multiSort ? meta[0] : { field, order } };
}

/** `aria-sort` of a column header. It goes on one column only: the first sort column. */
export function ɵstarAriaSort(
  sortable: boolean | undefined,
  sorts: readonly ɵStarSortRule[],
  field: string,
): string | null {
  if (!sortable) return null;
  const first = sorts[0];
  if (first?.field !== field) return 'none';
  return first.order === 1 ? 'ascending' : 'descending';
}

/** Icon classes of the sort button of a column. */
export function ɵstarSortIcon(sorts: readonly ɵStarSortRule[], field: string): string {
  const sort = sorts.find((item) => item.field === field);
  if (!sort) return 'ph-bold ph-arrows-down-up star-table__sort-idle';
  return sort.order === 1 ? 'ph-bold ph-sort-ascending' : 'ph-bold ph-sort-descending';
}

/** Position of a column in a sort by two or more columns, else `null`. */
export function ɵstarSortRank(sorts: readonly ɵStarSortRule[], field: string): number | null {
  if (sorts.length < 2) return null;
  const index = sorts.findIndex((sort) => sort.field === field);
  return index < 0 ? null : index + 1;
}

/** A column width that the user set, in whole pixels, never below the smallest width. */
export function ɵstarClampColumnWidth(width: number): number {
  return Math.max(ɵSTAR_MIN_COLUMN_WIDTH, Math.round(width));
}

/** `aria-valuemax` of a resize handle whose column is `now` pixels wide. */
export function ɵstarResizeMax(now: number | null): number {
  return Math.max(MAX_COLUMN_WIDTH_HINT, now ?? 0);
}

/**
 * Starts a pointer resize on a column resize handle (`event.currentTarget`, inside the header
 * cell). `width` gets each new width (not yet clamped); `end` runs when the pointer is released.
 * Returns false (and does nothing) when the handle is not in a header cell.
 */
export function ɵstarStartColumnResize(
  event: PointerEvent,
  width: (pixels: number) => void,
  end: () => void,
): boolean {
  const handle = event.currentTarget as HTMLElement;
  const header = handle.closest('th');
  if (!header) return false;
  event.preventDefault();
  event.stopPropagation();
  const direction = starIsRtl(header) ? -1 : 1;
  const startWidth = header.offsetWidth;
  const startX = event.clientX;
  handle.setPointerCapture?.(event.pointerId);
  const move = (moveEvent: PointerEvent) =>
    width(startWidth + direction * (moveEvent.clientX - startX));
  const stop = () => {
    end();
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', stop);
    handle.removeEventListener('pointercancel', stop);
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
  return true;
}

/**
 * Arrow Right or Arrow Left on a resize handle (`event.currentTarget`): the new width (not yet
 * clamped), or null for another key. The arrows swap in right-to-left. `current` is the width the
 * user set; without one the rendered width of the header cell is the start.
 */
export function ɵstarResizeByKey(event: KeyboardEvent, current: number | undefined): number | null {
  const step =
    event.key === 'ArrowRight' ? RESIZE_STEP : event.key === 'ArrowLeft' ? -RESIZE_STEP : 0;
  if (!step) return null;
  event.preventDefault();
  const header = (event.currentTarget as HTMLElement).closest('th');
  const direction = starIsRtl(header) ? -1 : 1;
  return (current ?? header?.offsetWidth ?? 0) + direction * step;
}

/** Two width maps are the same within half a pixel. */
export function ɵstarSameWidths(
  next: Readonly<Record<string, number>>,
  current: Readonly<Record<string, number>>,
): boolean {
  return (
    Object.keys(next).length === Object.keys(current).length &&
    Object.entries(next).every(([field, width]) => Math.abs((current[field] ?? -1) - width) < 0.5)
  );
}

/**
 * Sticky offsets of columns that stick to one edge, in order from that edge. The offset of a
 * column is `base` plus the widths of the columns before it. Measured widths give pixels; before
 * the first measure (or without layout) the offset is a `calc()` of the declared widths.
 */
export function ɵstarStickyOffsets<C extends { readonly field: string }>(
  columns: readonly C[],
  measured: Readonly<Record<string, number>>,
  declared: (column: C) => string | null,
  base = 0,
): string[] {
  const parts: string[] = [];
  let pixels = base;
  let allMeasured = true;
  return columns.map((column) => {
    const offset = allMeasured
      ? `${Math.round(pixels * 100) / 100}px`
      : `calc(${(base > 0 ? [`${base}px`, ...parts] : parts).join(' + ')})`;
    parts.push(declared(column) ?? '0px');
    const width = measured[column.field];
    if (width) pixels += width;
    else allMeasured = false;
    return offset;
  });
}

/** Text in a cell editor: the raw value, or empty for a missing value. */
export function ɵstarEditText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

/** An edit leaves the cell as it was: the same value, or empty text for a missing value. */
export function ɵstarUnchangedEdit(value: unknown, previous: unknown): boolean {
  return Object.is(value, previous) || (value === '' && (previous ?? '') === '');
}
