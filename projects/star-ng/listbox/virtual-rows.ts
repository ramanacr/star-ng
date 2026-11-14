/**
 * Pure helpers of the virtual list in `star-listbox`: row model, index math, keyboard target and
 * ARIA values. They have no DOM access, so unit tests can check them without layout.
 */

/** One row of the virtual list. Group headings and options have the same height. */
export type ListboxRow<T> =
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
export interface ListboxLayout<T> {
  readonly rows: readonly ListboxRow<T>[];
  readonly rowOfOption: readonly number[];
}

/**
 * Flattens headings and options into one list of rows of equal height. `options` must already be
 * in display order (each group together). A heading comes before the first option of each group.
 * The heading id has the form `<idPrefix>-group-<index of the first option of the group>`.
 */
export function buildLayout<T>(
  options: readonly T[],
  groupOf: ((option: T) => string) | null,
  idPrefix: string,
): ListboxLayout<T> {
  const rows: ListboxRow<T>[] = [];
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
export function pageSize(viewportHeight: number, itemSize: number): number {
  const lines = Math.floor(viewportHeight / Math.max(1, itemSize));
  return Math.max(1, lines - 1);
}

export type ListNavigationKey = 'ArrowDown' | 'ArrowUp' | 'Home' | 'End' | 'PageDown' | 'PageUp';

/** Index of the option a navigation key moves to, limited to the list. -1 for an empty list. */
export function keyboardTarget(
  key: ListNavigationKey,
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
export function typeaheadIndex(
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
export function revealRows<T>(layout: ListboxLayout<T>, index: number): [number, number] {
  const row = layout.rowOfOption[index];
  if (row === undefined) return [0, 0];
  const above = layout.rows[row - 1];
  return [above?.kind === 'group' ? row - 1 : row, row];
}

/**
 * Scroll offset that brings rows `first` to `last` into view with the least movement, or null when
 * they are in view. Rows have the height `itemSize`.
 */
export function revealOffset(
  first: number,
  last: number,
  itemSize: number,
  scrollOffset: number,
  viewportHeight: number,
): number | null {
  const top = first * itemSize;
  const bottom = (last + 1) * itemSize;
  if (top < scrollOffset) return top;
  if (viewportHeight > 0 && bottom > scrollOffset + viewportHeight) return bottom - viewportHeight;
  return null;
}

/** `aria-setsize` and `aria-posinset` of an option, for the whole list. */
export function ariaPosition(index: number, count: number): { setsize: number; posinset: number } {
  return { setsize: count, posinset: index + 1 };
}

/** CSS height of the list: `scrollHeight` at most, and no taller than the rows need. */
export function listHeight(scrollHeight: string, rowCount: number, itemSize: number): string {
  return `min(${scrollHeight}, ${rowCount * Math.max(1, itemSize)}px)`;
}

/** True when a row is inside the rendered range `[start, end)`. */
export function isRowRendered(row: number, range: { start: number; end: number }): boolean {
  return row >= range.start && row < range.end;
}
