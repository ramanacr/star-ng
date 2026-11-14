// Pure helpers of the tree: flattening, sibling position, keyboard targets, selection state and
// the scroll math of windowed rendering. They hold no DOM or signal state, so they are unit
// tested without layout. This file is internal and is not exported from the entry point.

/** The part of a tree node that the helpers read. `StarTreeNode` fits it. */
export interface BranchLike<N> {
  readonly key: string;
  readonly children?: readonly N[];
}

/** One visible row of the flattened tree. */
export interface TreeRow<N> {
  readonly node: N;
  /** Depth of the node, starting at 1 (`aria-level`). */
  readonly level: number;
  /** Number of siblings, the node included (`aria-setsize`). */
  readonly setSize: number;
  /** Position among the siblings, starting at 1 (`aria-posinset`). */
  readonly position: number;
  readonly parentKey: string | null;
}

/**
 * Flattens the nodes whose parents are open into rows. The sibling numbers come from the data,
 * so they stay right for rows that are not in the DOM. `openAll` shows every branch open (filter).
 */
export function flattenVisible<N extends BranchLike<N>>(
  nodes: readonly N[],
  open: ReadonlySet<string>,
  openAll = false,
): TreeRow<N>[] {
  const rows: TreeRow<N>[] = [];
  const walk = (list: readonly N[], level: number, parentKey: string | null) => {
    const setSize = list.length;
    list.forEach((node, i) => {
      rows.push({ node, level, setSize, position: i + 1, parentKey });
      if (node.children?.length && (openAll || open.has(node.key))) {
        walk(node.children, level + 1, node.key);
      }
    });
  };
  walk(nodes, 1, null);
  return rows;
}

/** Row index of each key. */
export function rowIndexOf<N extends BranchLike<N>>(
  rows: readonly TreeRow<N>[],
): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row, i) => map.set(row.node.key, i));
  return map;
}

/** All keys below a node (including itself). */
export function subtreeKeys<N extends BranchLike<N>>(node: N): string[] {
  const keys: string[] = [];
  const walk = (current: N) => {
    keys.push(current.key);
    current.children?.forEach(walk);
  };
  walk(node);
  return keys;
}

/** Parent key of every node (null at the top). */
export function parentsOf<N extends BranchLike<N>>(
  nodes: readonly N[],
): Map<string, string | null> {
  const map = new Map<string, string | null>();
  const walk = (list: readonly N[], parent: string | null) =>
    list.forEach((node) => {
      map.set(node.key, parent);
      if (node.children) walk(node.children, node.key);
    });
  walk(nodes, null);
  return map;
}

/**
 * The key that keeps the focus after the rows changed: the previous key if it is still a row,
 * else its nearest ancestor that is a row, else the first row.
 */
export function stillFocusable(
  previous: string | null | undefined,
  rowIndex: ReadonlyMap<string, number>,
  parents: ReadonlyMap<string, string | null>,
  firstKey: string | null,
): string | null {
  let key = previous ?? null;
  while (key !== null) {
    if (rowIndex.has(key)) return key;
    key = parents.get(key) ?? null;
  }
  return firstKey;
}

/**
 * The row that a navigation key moves to, or null when the key does not move (or there is no
 * target). Arrow right on a closed branch and arrow left on an open branch toggle it: they have
 * no target.
 */
export function navigationTarget<N extends BranchLike<N>>(
  rows: readonly TreeRow<N>[],
  index: number,
  key: string,
  state: { hasChildren: boolean; expanded: boolean },
): string | null {
  const row = rows[index];
  if (!row) return null;
  switch (key) {
    case 'ArrowDown':
      return rows[index + 1]?.node.key ?? null;
    case 'ArrowUp':
      return rows[index - 1]?.node.key ?? null;
    case 'Home':
      return rows[0]?.node.key ?? null;
    case 'End':
      return rows.at(-1)?.node.key ?? null;
    case 'ArrowRight':
      return state.hasChildren && state.expanded ? (rows[index + 1]?.node.key ?? null) : null;
    case 'ArrowLeft':
      return state.hasChildren && state.expanded ? null : row.parentKey;
    default:
      return null;
  }
}

/** Check state of one node: true, false or 'mixed' from the leaves below it. */
export type CheckState = boolean | 'mixed';

/**
 * Check state of every node of a tree in one pass (checkbox mode). A node with children is
 * `true` when all leaves below it are selected, `'mixed'` when some are. `isLeaf` tells, by key,
 * what counts as a leaf (the filter copies a node and may cut its children).
 */
export function checkStates<N extends BranchLike<N>>(
  nodes: readonly N[],
  selected: ReadonlySet<string>,
  isLeaf: (key: string) => boolean,
): Map<string, CheckState> {
  const states = new Map<string, CheckState>();
  const walk = (node: N): { leaves: number; checked: number } => {
    if (!node.children?.length) {
      states.set(node.key, selected.has(node.key));
      const leaf = isLeaf(node.key);
      return { leaves: leaf ? 1 : 0, checked: leaf && selected.has(node.key) ? 1 : 0 };
    }
    let leaves = 0;
    let checked = 0;
    for (const child of node.children) {
      const part = walk(child);
      leaves += part.leaves;
      checked += part.checked;
    }
    states.set(node.key, checked === 0 ? false : checked === leaves ? true : 'mixed');
    return { leaves, checked };
  };
  nodes.forEach(walk);
  return states;
}

/**
 * Scroll offset that brings a fixed-size row fully into view with the least movement, or null
 * when the row is already fully visible.
 */
export function scrollOffsetToReveal(
  index: number,
  itemSize: number,
  scrollOffset: number,
  viewportSize: number,
): number | null {
  const top = index * itemSize;
  const bottom = top + itemSize;
  if (top < scrollOffset) return top;
  if (bottom > scrollOffset + viewportSize) return Math.max(0, bottom - viewportSize);
  return null;
}
