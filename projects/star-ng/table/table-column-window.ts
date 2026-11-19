/**
 * Column virtualization of `star-table` (`virtualColumns`): only the columns in view, plus a
 * buffer, are rendered; spacer cells keep the width of the columns left out, so the scroll width
 * stays the same. Pinned columns are always rendered. Ignite UI column virtualization, AG Grid
 * column virtualisation (`suppressColumnVirtualisation` off). Pure helpers, no DOM.
 */

/** Columns rendered on each side of the columns in view. */
export const COLUMN_BUFFER = 2;
/** Width of the scroll area before the first measure. */
export const COLUMN_FALLBACK_VIEWPORT = 960;

/** The rendered columns and the spacers around the unpinned columns in view. */
export interface StarColumnWindow<C> {
  /** Start pins, the unpinned columns in the window, end pins, in display order. */
  readonly columns: readonly C[];
  /** First rendered unpinned column: a spacer of `before` pixels goes before it (or `null`). */
  readonly first: C | null;
  /** Last rendered unpinned column: a spacer of `after` pixels goes after it (or `null`). */
  readonly last: C | null;
  readonly before: number;
  readonly after: number;
}

export interface StarColumnWindowInput<C> {
  /** Visible columns in display order: start pins first, end pins last. */
  readonly columns: readonly C[];
  readonly isPinned: (column: C) => boolean;
  /** Width of a column in pixels. */
  readonly widthOf: (column: C) => number;
  /** Horizontal scroll offset of the scroll area (positive, also in right-to-left). */
  readonly scroll: number;
  /** Width of the scroll area. */
  readonly viewport: number;
  /** Width of the cells before and after the columns (selection, expander, actions). */
  readonly fixed: number;
  readonly buffer?: number;
}

/**
 * The window of unpinned columns that are in view. The unpinned columns start after the fixed
 * cells and the start pins, so their visible part is the viewport minus all pinned widths.
 */
export function columnWindow<C>(input: StarColumnWindowInput<C>): StarColumnWindow<C> {
  const { columns, isPinned, widthOf } = input;
  const buffer = input.buffer ?? COLUMN_BUFFER;
  const middle: C[] = [];
  const start: C[] = [];
  const end: C[] = [];
  let pinned = 0;
  for (const column of columns) {
    if (!isPinned(column)) {
      middle.push(column);
      continue;
    }
    pinned += widthOf(column);
    (middle.length ? end : start).push(column);
  }
  if (!middle.length) return { columns, first: null, last: null, before: 0, after: 0 };
  const offsets = [0];
  for (const column of middle) offsets.push(offsets[offsets.length - 1] + widthOf(column));
  const total = offsets[offsets.length - 1];
  const view = Math.max(1, input.viewport - pinned - input.fixed);
  const from = Math.min(Math.max(0, input.scroll), Math.max(0, total - view));
  // The first column whose end is after the start of the view, the last that starts before its end.
  let first = 0;
  while (first < middle.length - 1 && offsets[first + 1] <= from) first++;
  let last = first;
  while (last < middle.length - 1 && offsets[last + 1] < from + view) last++;
  const low = Math.max(0, first - buffer);
  const high = Math.min(middle.length - 1, last + buffer);
  const before = offsets[low];
  const after = total - offsets[high + 1];
  return {
    columns: [...start, ...middle.slice(low, high + 1), ...end],
    first: before > 0 ? middle[low] : null,
    last: after > 0 ? middle[high] : null,
    before,
    after,
  };
}

/**
 * Width in pixels of a CSS width: `px`, or `rem` / `em` at 16 pixels. Other units (percent,
 * `ch`, `calc()`) give `null`.
 */
export function cssPixels(width: string | null | undefined): number | null {
  const match = /^\s*(\d+(?:\.\d+)?)(px|rem|em)\s*$/.exec(width ?? '');
  if (!match) return null;
  const value = Number(match[1]);
  return match[2] === 'px' ? value : value * 16;
}
