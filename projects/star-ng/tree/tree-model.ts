// Pure helpers of the tree: flattening, sibling position, keyboard targets, selection state and
// the scroll math of windowed rendering. They hold no DOM or signal state, so they are unit
// tested without layout. The entry point exports the row helpers that the tree table reuses
// (`flattenVisible`, `rowIndexOf`, `parentsOf`, `stillFocusable`, `navigationTarget`,
// `scrollOffsetToReveal`) and the check, lock and filter helpers that both share (`checkStates`,
// `toggleChecked`, `isLocked`, `filterTree`). The other helpers stay internal.

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

/** The part of a node that the check and the filter helpers read. `StarTreeNode` fits it. */
export interface LockableNode<N> extends BranchLike<N> {
  /** A disabled node keeps its check state when a parent or a child changes. */
  readonly disabled?: boolean;
  /** `false`: the node keeps its check state when a parent or a child changes. */
  readonly selectable?: boolean;
}

/** The user cannot check or uncheck the node, and propagation does not change it. */
export function isLocked(node: {
  readonly disabled?: boolean;
  readonly selectable?: boolean;
}): boolean {
  return !!node.disabled || node.selectable === false;
}

/** Check state of a node in checkbox mode. */
export type CheckState = boolean | 'mixed';

/**
 * Check state of every node: `true` when its key is selected, or (with `propagateUp`) when all
 * its selectable children are checked; `'mixed'` when it is not, a descendant is selected and
 * `propagateUp` is on; else `false`. Locked children (disabled, `selectable: false`) do not
 * count for the parent. Shared by `star-tree` and `star-tree-table`.
 */
export function checkStates<N extends LockableNode<N>>(
  nodes: readonly N[],
  selected: ReadonlySet<string>,
  propagateUp: boolean,
): Map<string, CheckState> {
  const states = new Map<string, CheckState>();
  // Returns whether the node or a node below it is selected.
  const walk = (node: N): boolean => {
    let below = false;
    let open = 0;
    let checked = 0;
    for (const child of node.children ?? []) {
      below = walk(child) || below;
      if (isLocked(child)) continue;
      open++;
      if (states.get(child.key) === true) checked++;
    }
    const own = selected.has(node.key) || (propagateUp && open > 0 && checked === open);
    states.set(node.key, own ? true : propagateUp && below ? 'mixed' : false);
    return own || below;
  };
  nodes.forEach(walk);
  return states;
}

/**
 * The selection keys after the user checks (`on`) or unchecks a node in checkbox mode.
 * `down`: the descendants follow the node. `up`: each ancestor is checked when all its
 * selectable children are checked, and unchecked otherwise. A locked node (disabled or
 * `selectable: false`) below or above the node keeps its state, and so does its subtree. The
 * order of the keys that stay is kept. Shared by `star-tree` and `star-tree-table`.
 */
export function toggleChecked<N extends LockableNode<N>>(
  nodes: readonly N[],
  key: string,
  on: boolean,
  selection: readonly string[],
  propagate: { readonly up: boolean; readonly down: boolean },
): string[] {
  const index = new Map<string, N>();
  const parents = new Map<string, string | null>();
  const walk = (list: readonly N[], parent: string | null) =>
    list.forEach((node) => {
      index.set(node.key, node);
      parents.set(node.key, parent);
      walk(node.children ?? [], node.key);
    });
  walk(nodes, null);
  const node = index.get(key);
  if (!node) return [...selection];
  const keys = new Set(selection);
  const apply = (target: N) => {
    if (on) keys.add(target.key);
    else keys.delete(target.key);
    if (!propagate.down) return;
    for (const child of target.children ?? []) if (!isLocked(child)) apply(child);
  };
  apply(node);
  if (propagate.up) {
    for (let parent = parents.get(key) ?? null; parent !== null;) {
      const current = index.get(parent);
      if (current && !isLocked(current)) {
        const children = (current.children ?? []).filter((child) => !isLocked(child));
        if (children.length && children.every((child) => keys.has(child.key))) keys.add(parent);
        else keys.delete(parent);
      }
      parent = parents.get(parent) ?? null;
    }
  }
  const kept = selection.filter((k) => keys.has(k));
  const known = new Set(kept);
  return [...kept, ...[...keys].filter((k) => !known.has(k))];
}

/**
 * The filter modes (PrimeNG `filterMode`). `'lenient'`: a matching node shows with its ancestors
 * and all its descendants. `'strict'`: only the matching paths show; a descendant of a match that
 * does not match itself (and has no matching descendant) is hidden.
 */
export type TreeFilterMode = 'lenient' | 'strict';

export interface TreeFilterResult<N> {
  readonly nodes: readonly N[];
  /** Keys of the nodes that show because a descendant matches: they show open. */
  readonly ancestors: ReadonlySet<string>;
  /** Keys of the nodes that match. */
  readonly matches: ReadonlySet<string>;
}

/**
 * Keeps the nodes that match (and their ancestors), in the given filter mode. Shared by
 * `star-tree` and `star-tree-table`.
 */
export function filterTree<N extends BranchLike<N>>(
  nodes: readonly N[],
  match: (node: N) => boolean,
  mode: TreeFilterMode,
): TreeFilterResult<N> {
  const ancestors = new Set<string>();
  const matches = new Set<string>();
  const walk = (list: readonly N[]): N[] =>
    list.flatMap((node) => {
      const own = match(node);
      if (own) matches.add(node.key);
      if (own && mode === 'lenient') return [node];
      const children = walk(node.children ?? []);
      if (children.length) ancestors.add(node.key);
      if (!own && !children.length) return [];
      // A strict match keeps only its matching children; a node without children stays as it is.
      return [node.children ? { ...node, children } : node];
    });
  return { nodes: walk(nodes), ancestors, matches };
}

/** Text of a node field for the filter: `label`, another node property, or a `data` field. */
export function nodeFieldText(node: object, field: string): unknown {
  const own = (node as Record<string, unknown>)[field];
  if (own !== undefined) return own;
  const data = (node as { data?: unknown }).data;
  return data !== null && typeof data === 'object'
    ? (data as Record<string, unknown>)[field]
    : undefined;
}

/** Keys of all ancestors of a node, from the top level down (empty for a root or a missing key). */
export function ancestorKeys(parents: ReadonlyMap<string, string | null>, key: string): string[] {
  const keys: string[] = [];
  for (let parent = parents.get(key) ?? null; parent !== null; parent = parents.get(parent) ?? null)
    keys.unshift(parent);
  return keys;
}

/** Keys of all nodes that have children (for `expandAll`). */
export function branchKeys<N extends BranchLike<N>>(nodes: readonly N[]): string[] {
  const keys: string[] = [];
  const walk = (list: readonly N[]) =>
    list.forEach((node) => {
      if (node.children?.length) {
        keys.push(node.key);
        walk(node.children);
      }
    });
  walk(nodes);
  return keys;
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
