/**
 * Pure helpers of the windowed option lists: row model, index math, keyboard target and ARIA
 * values. `star-listbox` and the select family (`star-select`, `star-multi-select`,
 * `star-autocomplete`) use them. They have no DOM access, so unit tests can check them without
 * layout. They are exported because entry points import each other by package name. They are
 * helpers of the library, not a stable extension point.
 */

/** One row of a windowed list. Group headings and options have the same height. */
export type StarWindowRow<T> =
  | { readonly kind: 'group'; readonly key: string; readonly label: string; readonly id: string }
  | {
      readonly kind: 'option';
      readonly key: string;
      readonly option: T;
      /** Index in the visible options (keyboard order). */
      readonly index: number;
      /** Id of the heading row of the group, or null without groups. */
      readonly groupId: string | null;
      /** Index of the heading row of the group, or -1 without groups. */
      readonly groupRow: number;
    };

/** The rows, and for each visible option the index of its row. */
export interface StarWindowLayout<T> {
  readonly rows: readonly StarWindowRow<T>[];
  readonly rowOfOption: readonly number[];
}

/**
 * Flattens headings and options into one list of rows of equal height. `options` must already be
 * in display order (each group together). A heading comes before the first option of each group.
 * The heading id has the form `<idPrefix>-group-<index of the first option of the group>`.
 */
export function starListLayout<T>(
  options: readonly T[],
  groupOf: ((option: T) => string) | null,
  idPrefix: string,
): StarWindowLayout<T> {
  const rows: StarWindowRow<T>[] = [];
  const rowOfOption: number[] = [];
  let current: string | null = null;
  let groupId: string | null = null;
  let groupRow = -1;
  options.forEach((option, index) => {
    if (groupOf) {
      const label = groupOf(option);
      if (index === 0 || label !== current) {
        current = label;
        groupId = `${idPrefix}-group-${index}`;
        groupRow = rows.length;
        rows.push({ kind: 'group', key: `g:${index}`, label, id: groupId });
      }
    }
    rowOfOption.push(rows.length);
    rows.push({ kind: 'option', key: `o:${index}`, option, index, groupId, groupRow });
  });
  return { rows, rowOfOption };
}

/** Number of options a Page up / Page down key moves: the lines in view, minus one for overlap. */
export function starListPageSize(viewportHeight: number, itemSize: number): number {
  const lines = Math.floor(viewportHeight / Math.max(1, itemSize));
  return Math.max(1, lines - 1);
}

export type StarListNavigationKey =
  'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'PageDown' | 'PageUp';

/** Index of the option a navigation key moves to, limited to the list. -1 for an empty list. */
export function starListKeyboardTarget(
  key: StarListNavigationKey,
  active: number,
  count: number,
  page: number,
): number {
  if (count <= 0) return -1;
  const last = count - 1;
  let target: number;
  switch (key) {
    case 'ArrowDown':
      target = active + 1;
      break;
    case 'ArrowUp':
      target = active - 1;
      break;
    case 'Home':
      target = 0;
      break;
    case 'End':
      target = last;
      break;
    case 'PageDown':
      target = (active < 0 ? 0 : active) + page;
      break;
    case 'PageUp':
      target = (active < 0 ? last : active) - page;
      break;
  }
  return Math.min(Math.max(target, 0), last);
}

/** Index of the first option whose label starts with the typed text (compared in lower case). */
export function starListTypeaheadIndex(
  count: number,
  labelAt: (index: number) => string,
  typed: string,
): number {
  for (let i = 0; i < count; i++) {
    if (labelAt(i).toLowerCase().startsWith(typed)) return i;
  }
  return -1;
}

/** First and last row to bring into view for an option: its heading row comes with the first option. */
export function starListRevealRows<T>(
  layout: StarWindowLayout<T>,
  index: number,
): [number, number] {
  const row = layout.rowOfOption[index];
  if (row === undefined) return [0, 0];
  const above = layout.rows[row - 1];
  return [above?.kind === 'group' ? row - 1 : row, row];
}

/**
 * Scroll offset that brings rows `first` to `last` into view with the least movement, or null when
 * they are in view. Rows have the height `itemSize`. `inset` is the space above the first row
 * (the padding of the scroll container): a row below the view is moved by it, and the first row
 * scrolls to the very top so that the padding shows.
 */
export function starListRevealOffset(
  first: number,
  last: number,
  itemSize: number,
  scrollOffset: number,
  viewportHeight: number,
  inset = 0,
): number | null {
  const top = inset + first * itemSize;
  const bottom = inset + (last + 1) * itemSize;
  if (top < scrollOffset) return first === 0 ? 0 : top;
  if (viewportHeight > 0 && bottom > scrollOffset + viewportHeight) return bottom - viewportHeight;
  return null;
}

/** `aria-setsize` and `aria-posinset` of an option, for the whole list. */
export function starListAriaPosition(
  index: number,
  count: number,
): { setsize: number; posinset: number } {
  return { setsize: count, posinset: index + 1 };
}

/** CSS height of the list: `scrollHeight` at most, and no taller than the rows need. */
export function starListHeight(scrollHeight: string, rowCount: number, itemSize: number): string {
  return `min(${scrollHeight}, ${rowCount * Math.max(1, itemSize)}px)`;
}

/** True when a row is inside the rendered range `[start, end)`. */
export function starListRowRendered(row: number, range: { start: number; end: number }): boolean {
  return row >= range.start && row < range.end;
}

/**
 * Event of `lazyLoad` on the list controls (PrimeNG `onLazyLoad`): the control needs the options
 * from index `first` to `last` (both included), for the filter text `filter`. Load them and put
 * them into the `options` array at the same indexes. Until then the array holds `undefined` there:
 * the control shows a loading row for each one.
 */
export interface StarListLazyLoadEvent {
  readonly first: number;
  readonly last: number;
  readonly filter: string;
}

/**
 * Options of the rows in the rendered range `[start, end)`: the first and the last option index,
 * and whether one of them is not loaded yet (`isMissing`). `null` when the range has no option.
 */
export function starListLazyRange<T>(
  layout: StarWindowLayout<T>,
  range: { start: number; end: number },
  isMissing: (option: T) => boolean,
): { first: number; last: number; missing: boolean } | null {
  let first = -1;
  let last = -1;
  let missing = false;
  const end = Math.min(range.end, layout.rows.length);
  for (let i = Math.max(0, range.start); i < end; i++) {
    const row = layout.rows[i];
    if (row.kind !== 'option') continue;
    if (first < 0) first = row.index;
    last = row.index;
    if (isMissing(row.option)) missing = true;
  }
  return first < 0 ? null : { first, last, missing };
}

/**
 * Decides when a lazy list asks for options. It remembers the index ranges it asked for, per filter
 * text, as sorted and merged intervals: it asks only for rows in view that are not loaded and were
 * not asked for before, so smooth scrolling does not repeat a request. A new filter text forgets the
 * ranges and asks for the rows in view from index 0 (also for the first request). Without rendered
 * options (an empty array) it asks for the first `pageSize` options.
 *
 * A range that failed to load is asked for again after `reset()` (the rows in view), or when the
 * length of the options array changes for the same filter (the owner set new placeholders).
 */
export class StarLazyRequests {
  private filter: string | null = null;
  private length = -1;
  /** True after `reset()`: the next request is for the rows in view, not from index 0. */
  private retry = false;
  /** Requested ranges, sorted by start, merged when they touch or overlap. */
  private requested: [number, number][] = [];

  /** Forgets the filter and every requested range, so the next call asks for the rows in view. */
  reset(): void {
    this.filter = null;
    this.length = -1;
    this.requested = [];
    this.retry = true;
  }

  /** Number of stored intervals (merged). */
  get rangeCount(): number {
    return this.requested.length;
  }

  next(
    range: { first: number; last: number; missing: boolean } | null,
    filter: string,
    pageSize: number,
    length = -1,
  ): StarListLazyLoadEvent | null {
    if (filter === this.filter && length !== this.length && this.length >= 0) {
      // Same filter, new array length: the owner replaced the options; ask again.
      this.requested = [];
    }
    this.length = length;
    if (filter !== this.filter) {
      const retry = this.retry;
      this.filter = filter;
      this.retry = false;
      this.requested = [];
      if (!retry) {
        // A new filter starts at the top of the list.
        const size = range ? range.last - range.first + 1 : Math.max(1, pageSize);
        this.add(0, size - 1);
        return { first: 0, last: size - 1, filter };
      }
    }
    if (!range) {
      if (this.requested.length) return null;
      const last = Math.max(1, pageSize) - 1;
      this.add(0, last);
      return { first: 0, last, filter };
    }
    if (!range.missing) return null;
    let first = -1;
    let last = -1;
    for (let i = range.first; i <= range.last; i++) {
      if (this.covered(i)) continue;
      if (first < 0) first = i;
      last = i;
    }
    if (first < 0) return null;
    this.add(first, last);
    return { first, last, filter };
  }

  /** Binary search in the merged intervals. */
  private covered(index: number): boolean {
    let lo = 0;
    let hi = this.requested.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const [a, b] = this.requested[mid];
      if (index < a) hi = mid - 1;
      else if (index > b) lo = mid + 1;
      else return true;
    }
    return false;
  }

  /** Adds `[first, last]` and merges intervals that overlap or touch. */
  private add(first: number, last: number): void {
    const all = [...this.requested, [first, last] as [number, number]].sort((x, y) => x[0] - y[0]);
    const merged: [number, number][] = [];
    for (const [a, b] of all) {
      const top = merged[merged.length - 1];
      if (top && a <= top[1] + 1) top[1] = Math.max(top[1], b);
      else merged.push([a, b]);
    }
    this.requested = merged;
  }
}
