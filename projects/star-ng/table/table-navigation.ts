/**
 * Cell navigation of `star-table` (WAI-ARIA grid pattern): the key map and the scroll math. Pure
 * helpers, no DOM. Ignite UI grid keyboard navigation, AG Grid cell navigation.
 */

/** A cell of the table: the row key (`dataKey` value, else the row object) and the column field. */
export interface StarTableCellRef {
  readonly rowKey: unknown;
  readonly field: string;
}

/** Where `scrollToRow` puts the row in the view (default `'nearest'`: the least scroll). */
export type StarScrollAlign = 'start' | 'center' | 'end' | 'nearest';

/** Options of `scrollToRow` and `scrollToColumn`. */
export interface StarScrollOptions {
  readonly align?: StarScrollAlign;
}

/** A cell by position: index in the navigable rows and in the visible columns. */
export interface StarCellPoint {
  readonly row: number;
  readonly col: number;
}

/** The parts of a key event that the key map reads. `key` is in inline terms (`starInlineKey`). */
export interface StarNavKey {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/**
 * The cell that a key moves to, or `null` when the key does not move (it is not a navigation
 * key). At an edge the key returns the same cell: it is still handled.
 *
 * - Arrow keys: one cell (Left / Right in inline terms, so right-to-left is mirrored by the caller).
 * - Home / End: first / last cell of the row; with Ctrl (or Cmd): first / last cell of the grid.
 * - PageUp / PageDown: `page` rows up or down.
 */
export function cellNavigationTarget(
  event: StarNavKey,
  from: StarCellPoint,
  rows: number,
  cols: number,
  page: number,
): StarCellPoint | null {
  if (rows <= 0 || cols <= 0) return null;
  const clampRow = (row: number) => Math.min(rows - 1, Math.max(0, row));
  const clampCol = (col: number) => Math.min(cols - 1, Math.max(0, col));
  const ctrl = event.ctrlKey || event.metaKey;
  const step = Math.max(1, Math.floor(page));
  switch (event.key) {
    case 'ArrowUp':
      return { row: clampRow(from.row - 1), col: clampCol(from.col) };
    case 'ArrowDown':
      return { row: clampRow(from.row + 1), col: clampCol(from.col) };
    case 'ArrowLeft':
      return { row: clampRow(from.row), col: clampCol(from.col - 1) };
    case 'ArrowRight':
      return { row: clampRow(from.row), col: clampCol(from.col + 1) };
    case 'Home':
      return { row: ctrl ? 0 : clampRow(from.row), col: 0 };
    case 'End':
      return { row: ctrl ? rows - 1 : clampRow(from.row), col: cols - 1 };
    case 'PageUp':
      return { row: clampRow(from.row - step), col: clampCol(from.col) };
    case 'PageDown':
      return { row: clampRow(from.row + step), col: clampCol(from.col) };
    default:
      return null;
  }
}

/**
 * The scroll offset that shows the span `[start, start + size)` in a view of `view` pixels that
 * is now at `current`. `nearest` moves the least (nothing when the span is in view); a span larger
 * than the view aligns its start.
 */
export function alignedOffset(
  start: number,
  size: number,
  view: number,
  current: number,
  align: StarScrollAlign = 'nearest',
): number {
  const end = start + size;
  let offset: number;
  if (align === 'start') offset = start;
  else if (align === 'end') offset = end - view;
  else if (align === 'center') offset = start + size / 2 - view / 2;
  else if (start < current || size > view) offset = start;
  else if (end > current + view) offset = end - view;
  else offset = current;
  return Math.max(0, offset);
}

/**
 * Scroll offset (positive, also in right-to-left) that shows an unpinned column with
 * `virtualColumns`. `widths` are the widths of the unpinned visible columns in display order and
 * `view` the width that they share (the scroll area minus the pinned and the lead columns).
 */
export function columnScrollOffset(
  widths: readonly number[],
  index: number,
  scroll: number,
  view: number,
  align: StarScrollAlign = 'nearest',
): number {
  let start = 0;
  for (let i = 0; i < index && i < widths.length; i++) start += widths[i];
  return alignedOffset(start, widths[index] ?? 0, Math.max(1, view), scroll, align);
}

/**
 * Index of the row to focus for a vertical move into rows with merged cells (`rowspan`): a row
 * that a merged cell above covers (`spanAt` gives 0) is skipped in the move direction; when the
 * move runs out of rows, the merged cell that covers it is used.
 */
export function uncoveredRow(
  target: number,
  step: number,
  rows: number,
  spanAt: (row: number) => number,
): number {
  if (spanAt(target) !== 0) return target;
  if (step > 0) {
    for (let row = target + 1; row < rows; row++) if (spanAt(row) !== 0) return row;
  }
  for (let row = target - 1; row >= 0; row--) if (spanAt(row) !== 0) return row;
  return target;
}

/**
 * How far to scroll so that an item at `start` (from the start of the view) with `size` shows in a
 * view of `view` pixels: positive scrolls toward the end. `nearest` scrolls the least (0 when the
 * item is in view; an item larger than the view aligns its start).
 */
export function revealDelta(
  start: number,
  size: number,
  view: number,
  align: StarScrollAlign = 'nearest',
): number {
  if (align === 'start') return start;
  if (align === 'end') return start + size - view;
  if (align === 'center') return start + size / 2 - view / 2;
  if (start < 0 || size > view) return start;
  if (start + size > view) return start + size - view;
  return 0;
}
