// Pure data helpers of the tree table: sort siblings, filter with the lenient or strict mode,
// page over the top-level rows, and check states with propagation up and down. They hold no DOM
// or signal state, so they are unit tested without layout. They never change the nodes they get:
// a sort or a filter returns new arrays (and copies of the nodes whose children changed).
// This file is internal and is not exported from the entry point.
import { compareValues, matchesFilter } from '@star-ng/ui/core';

/** The part of a tree table node that the helpers read. `StarTreeTableNode` fits it. */
export interface DataNode<N> {
  readonly key: string;
  readonly label: string;
  readonly data?: Readonly<Record<string, unknown>>;
  readonly children?: readonly N[];
  /** A disabled node keeps its check state when a parent or a child changes. */
  readonly disabled?: boolean;
  /** `false`: the node keeps its check state when a parent or a child changes. */
  readonly selectable?: boolean;
}

/** The user cannot check or uncheck the node, and propagation does not change it. */
export function isLocked(node: DataNode<unknown>): boolean {
  return !!node.disabled || node.selectable === false;
}

/** One sort column (the shape of `StarSortState` from `@star-ng/ui/table`). */
export interface SortRule {
  readonly field: string | null;
  readonly order: 1 | -1;
}

/**
 * Sorts the siblings of every level by the sort rules, in priority order. A child stays under its
 * parent, so the hierarchy is kept. Without a rule the nodes come back as they are.
 */
export function sortTree<N extends DataNode<N>>(
  nodes: readonly N[],
  sorts: readonly SortRule[],
): readonly N[] {
  const rules = sorts.filter((sort): sort is { field: string; order: 1 | -1 } => !!sort.field);
  if (!rules.length) return nodes;
  const walk = (list: readonly N[]): N[] =>
    [...list]
      .sort((a, b) => {
        for (const { field, order } of rules) {
          const result = compareValues(a.data?.[field], b.data?.[field]);
          if (result) return order * result;
        }
        return 0;
      })
      .map((node) => (node.children?.length ? { ...node, children: walk(node.children) } : node));
  return walk(nodes);
}

/** Text of a cell as the table shows it: the data value, or the label in the first column. */
export function cellText(node: DataNode<unknown>, field: string, first: boolean): string {
  const value = node.data?.[field];
  if (value === null || value === undefined) return first ? node.label : '';
  return String(value);
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

/** Keeps the nodes that match (and their ancestors), in the given filter mode. */
export function filterTree<N extends DataNode<N>>(
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

/**
 * A node matches when its text in some column contains the global query (empty: any node) and
 * its text in each filtered column contains that column query. Case- and accent-insensitive.
 */
export function nodeMatches(
  node: DataNode<unknown>,
  fields: readonly string[],
  global: string,
  columns: readonly { readonly field: string; readonly query: string }[],
): boolean {
  const first = fields[0];
  const text = (field: string) => cellText(node, field, field === first);
  if (global && !fields.some((field) => matchesFilter(text(field), global))) return false;
  return columns.every(({ field, query }) => matchesFilter(text(field), query));
}

/** The top-level nodes of one page. A `first` past the end shows the last page. */
export function pageRoots<N>(nodes: readonly N[], first: number, rows: number): readonly N[] {
  if (rows <= 0) return nodes;
  const start = Math.max(0, Math.min(first, Math.max(0, nodes.length - 1)));
  const page = start - (start % rows);
  return nodes.slice(page, page + rows);
}

/** Check state of a node in checkbox mode. */
export type CheckState = boolean | 'mixed';

/**
 * Check state of every node: `true` when its key is selected, or (with `propagateUp`) when all
 * its selectable children are checked; `'mixed'` when it is not, a descendant is selected and
 * `propagateUp` is on; else `false`. Locked children (disabled, `selectable: false`) do not
 * count for the parent.
 */
export function checkStates<N extends DataNode<N>>(
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
 * order of the keys that stay is kept.
 */
export function toggleChecked<N extends DataNode<N>>(
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

/** Columns in display order: frozen columns first, then the `order` fields, then the rest. */
export function orderColumns<C extends { readonly field: string; readonly frozen?: boolean }>(
  columns: readonly C[],
  order: readonly string[],
): C[] {
  const rank = (column: C, index: number) => {
    const position = order.indexOf(column.field);
    return (column.frozen ? 0 : 1e6) + (position < 0 ? order.length + index : position);
  };
  return columns
    .map((column, index) => ({ column, rank: rank(column, index) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ column }) => column);
}

/**
 * The field order after a column moves to the place of another column. Null when the move is
 * not allowed: a frozen column does not move, and no column moves into the frozen columns.
 */
export function moveColumnOrder<C extends { readonly field: string; readonly frozen?: boolean }>(
  ordered: readonly C[],
  field: string,
  target: string,
): string[] | null {
  const fields = ordered.map((column) => column.field);
  const from = fields.indexOf(field);
  const to = fields.indexOf(target);
  if (from < 0 || to < 0 || from === to || ordered[from].frozen || ordered[to].frozen) return null;
  fields.splice(to, 0, ...fields.splice(from, 1));
  return fields;
}
