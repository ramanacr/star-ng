/**
 * Pure helpers of the table virtual scroll with rows of different heights: a prefix-sum tree of
 * item heights, the rendered range, scroll anchoring and the list of items (group headings and
 * rows). They have no DOM access, so unit tests can check them without layout.
 */

/**
 * Heights of a list of items in a Fenwick tree (binary indexed tree): the offset of an item and the
 * item at an offset take O(log n), a height change takes O(log n), and building takes O(n).
 */
export class HeightTree {
  private readonly heights: Float64Array;
  private readonly sums: Float64Array;
  /** Highest power of two that is not larger than the size, for the binary search. */
  private readonly topBit: number;

  constructor(heights: ArrayLike<number>) {
    const count = heights.length;
    this.heights = new Float64Array(count);
    this.sums = new Float64Array(count + 1);
    for (let i = 0; i < count; i++) {
      const height = Math.max(0, heights[i] || 0);
      this.heights[i] = height;
      this.sums[i + 1] += height;
      const parent = i + 1 + ((i + 1) & -(i + 1));
      if (parent <= count) this.sums[parent] += this.sums[i + 1];
    }
    let bit = 1;
    while (bit * 2 <= count) bit *= 2;
    this.topBit = count ? bit : 0;
  }

  get size(): number {
    return this.heights.length;
  }

  /** Height of all items. */
  get total(): number {
    return this.offsetOf(this.size);
  }

  get(index: number): number {
    return this.heights[index] ?? 0;
  }

  /** Sets the height of one item and returns the difference to the old height. */
  set(index: number, height: number): number {
    const delta = Math.max(0, height) - this.heights[index];
    if (!delta) return 0;
    this.heights[index] += delta;
    for (let i = index + 1; i <= this.size; i += i & -i) this.sums[i] += delta;
    return delta;
  }

  /** Sum of the heights of the items before `index`: the offset of the item from the top. */
  offsetOf(index: number): number {
    let sum = 0;
    for (let i = Math.min(index, this.size); i > 0; i -= i & -i) sum += this.sums[i];
    return sum;
  }

  /**
   * Index of the item at a pixel offset: an offset on a border belongs to the item that starts
   * there, and items without height are skipped. Clamped to the list; -1 for an empty list.
   */
  indexAt(offset: number): number {
    if (!this.size) return -1;
    let index = 0;
    let rest = Math.max(0, offset);
    for (let bit = this.topBit; bit > 0; bit >>= 1) {
      const next = index + bit;
      if (next <= this.size && this.sums[next] <= rest) {
        index = next;
        rest -= this.sums[next];
      }
    }
    return Math.min(index, this.size - 1);
  }
}

/** Rendered items `[start, end)`, the first item in view, and the heights of the spacer rows. */
export interface VariableRange {
  readonly start: number;
  readonly end: number;
  readonly first: number;
  readonly before: number;
  readonly after: number;
}

/**
 * Items to render for a scroll offset `top` (from the top of the first item) and a viewport
 * height: the items in view plus `buffer` items above and below.
 */
export function variableRange(
  tree: HeightTree,
  top: number,
  viewport: number,
  buffer: number,
): VariableRange {
  const count = tree.size;
  if (!count) return { start: 0, end: 0, first: 0, before: 0, after: 0 };
  const from = Math.max(0, top);
  const first = tree.indexAt(from);
  // The last pixel line in view, so an item that starts just below the view is left out.
  const last = tree.indexAt(from + Math.max(1, viewport) - 1);
  const start = Math.max(0, first - buffer);
  const end = Math.min(count, last + 1 + buffer);
  return {
    start,
    end,
    first,
    before: tree.offsetOf(start),
    after: tree.total - tree.offsetOf(end),
  };
}

/** A measured height that differs from the height the tree had. */
export interface HeightChange {
  readonly index: number;
  readonly from: number;
  readonly to: number;
}

/**
 * Scroll offset change that keeps the anchor item (the first item in view) where it is on the
 * screen: the sum of the height changes of the items above it. Changes of the anchor item and of
 * the items below it move nothing above, so they do not count.
 */
export function anchorShift(changes: readonly HeightChange[], anchor: number): number {
  let shift = 0;
  for (const change of changes) if (change.index < anchor) shift += change.to - change.from;
  return shift;
}

/** The item at the top of the view, and how many of its pixels are above the top. */
export function anchorOf(
  tree: HeightTree,
  top: number,
): { readonly index: number; readonly inside: number } | null {
  const index = tree.indexAt(top);
  if (index < 0) return null;
  return { index, inside: Math.max(0, top) - tree.offsetOf(index) };
}

/** One item of the virtual list: a group heading row, or a data row with its detail row. */
export type VirtualItem<T> =
  | {
      readonly kind: 'group';
      readonly key: string;
      readonly label: string;
      /** Rows of the group on the page, also when the group is closed. */
      readonly count: number;
      readonly collapsed: boolean;
      /** Position of the row among the body rows, from 0. */
      readonly aria: number;
    }
  | {
      readonly kind: 'row';
      readonly key: unknown;
      readonly row: T;
      /** Index of the row on the page. */
      readonly index: number;
      /** The row shows its detail row, which comes right after it. */
      readonly expanded: boolean;
      readonly aria: number;
    };

export interface VirtualLayoutOptions<T> {
  /** Group heading of a row, or null without groups. */
  readonly groupOf: ((row: T) => string) | null;
  readonly isCollapsed: (label: string) => boolean;
  readonly isExpanded: (row: T) => boolean;
  readonly keyOf: (row: T) => unknown;
  /** Measured or estimated height of an item. */
  readonly heightOf: (item: VirtualItem<T>) => number;
}

export interface VirtualLayout<T> {
  readonly items: readonly VirtualItem<T>[];
  readonly tree: HeightTree;
  /** Number of body rows (headings, rows and detail rows), for `aria-rowcount`. */
  readonly bodyRows: number;
  readonly indexOfKey: ReadonlyMap<unknown, number>;
}

/** Key of a group heading item. The prefix keeps it apart from row keys. */
export function groupKey(label: string): string {
  return `\u0000group\u0000${label}`;
}

/**
 * Flattens the rows of the page into items: a heading before each group, then the rows of the
 * group unless it is closed (rows of a closed group take no space). `rows` must keep each group
 * together.
 */
export function buildVirtualLayout<T>(
  rows: readonly T[],
  options: VirtualLayoutOptions<T>,
): VirtualLayout<T> {
  const items: VirtualItem<T>[] = [];
  const counts: number[] = [];
  let aria = 0;
  let label: string | null = null;
  let collapsed = false;
  rows.forEach((row, index) => {
    if (options.groupOf) {
      const group = options.groupOf(row);
      if (index === 0 || group !== label) {
        label = group;
        collapsed = options.isCollapsed(group);
        counts.push(0);
        items.push({
          kind: 'group',
          key: groupKey(group),
          label: group,
          count: 0,
          collapsed,
          aria,
        });
        aria++;
      }
      counts[counts.length - 1]++;
      if (collapsed) return;
    }
    const expanded = options.isExpanded(row);
    items.push({ kind: 'row', key: options.keyOf(row), row, index, expanded, aria });
    aria += expanded ? 2 : 1;
  });
  let group = 0;
  const indexOfKey = new Map<unknown, number>();
  const heights = new Float64Array(items.length);
  items.forEach((item, index) => {
    if (item.kind === 'group') items[index] = { ...item, count: counts[group++] };
    indexOfKey.set(item.key, index);
    heights[index] = options.heightOf(items[index]);
  });
  return { items, tree: new HeightTree(heights), bodyRows: aria, indexOfKey };
}
