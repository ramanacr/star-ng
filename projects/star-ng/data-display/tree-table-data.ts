// Pure data helpers of the tree table: sort siblings, filter with the lenient or strict mode,
// page over the top-level rows, and check states with propagation up and down. They hold no DOM
// or signal state, so they are unit tested without layout. They never change the nodes they get:
// a sort or a filter returns new arrays (and copies of the nodes whose children changed).
// This file is internal and is not exported from the entry point.
import { compareValues, matchesFilter } from '@star-ng/ui/core';

// The check, lock and filter helpers live in the tree entry point and serve both controls.
export { checkStates, filterTree, isLocked, toggleChecked } from '@star-ng/ui/tree';
export type { CheckState, TreeFilterMode, TreeFilterResult } from '@star-ng/ui/tree';

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
