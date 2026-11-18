// Pure helpers of the windowed tree table: which rows are in the DOM and where the row that a
// key targets must scroll. They hold no DOM or signal state, so they are unit tested without
// layout. The row flattening and the key targets come from `@star-ng/ui/tree`. This file is
// internal and is not exported from the entry point.
import { scrollOffsetToReveal } from '@star-ng/ui/tree';

/** The rows in the DOM and the height of the two spacer rows that stand for the others. */
export interface RowWindow {
  /** Index of the first rendered row. */
  readonly start: number;
  /** Index after the last rendered row. */
  readonly end: number;
  /** Height in pixels of the rows before `start`. */
  readonly before: number;
  /** Height in pixels of the rows from `end` on. */
  readonly after: number;
}

/**
 * The window of rows around the scroll position, for rows of one fixed height. `bufferRows` extra
 * rows render before and after the visible ones. `scrollTop` and `viewportSize` are the scroll
 * area of the table (the header is part of both); the window is wider than the visible rows by
 * the height of the sticky header, which keeps the math independent of the header size.
 */
export function rowWindow(
  count: number,
  itemSize: number,
  scrollTop: number,
  viewportSize: number,
  bufferRows: number,
): RowWindow {
  if (count <= 0 || itemSize <= 0) return { start: 0, end: 0, before: 0, after: 0 };
  const visible = Math.ceil(Math.max(0, viewportSize) / itemSize) + 1;
  // A scroll position past the end (the rows got fewer) shows the last rows, like the browser.
  const first = Math.min(
    Math.max(0, Math.floor(Math.max(0, scrollTop) / itemSize)),
    Math.max(0, count - visible),
  );
  const start = Math.max(0, first - bufferRows);
  const end = Math.min(count, first + visible + bufferRows);
  return { start, end, before: start * itemSize, after: (count - end) * itemSize };
}

/**
 * Scroll position that brings a row fully into view, below the sticky header, with the least
 * movement; null when the row is already fully visible. `headerSize` is the height of the sticky
 * header: it covers the top of the scroll area, so the rows see a viewport that is that much lower.
 */
export function revealRowOffset(
  index: number,
  itemSize: number,
  scrollTop: number,
  viewportSize: number,
  headerSize: number,
): number | null {
  return scrollOffsetToReveal(
    index,
    itemSize,
    scrollTop,
    Math.max(itemSize, viewportSize - headerSize),
  );
}

/**
 * `aria-rowindex` of the row at an index of the visible rows. The header rows come first (one
 * by default, two with a filter row), so the first body row is `headerRows + 1`.
 */
export function ariaRowIndex(index: number, headerRows = 1): number {
  return index + headerRows + 1;
}

/** `aria-rowcount`: the visible rows and the header rows. */
export function ariaRowCount(rowCount: number, headerRows = 1): number {
  return rowCount + headerRows;
}
