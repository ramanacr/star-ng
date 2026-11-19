/** A column of `star-kanban`. */
export interface StarKanbanColumn {
  /** Value of `columnKey` for the items of this column. */
  readonly key: string;
  readonly title: string;
  /** Work-in-progress limit: more items show a warning; `enforceLimits` blocks drops at the limit. */
  readonly limit?: number;
}

/** A swimlane (row) of `star-kanban`. */
export interface StarKanbanSwimlane {
  /** Value of `swimlaneKey` for the items of this lane. */
  readonly key: string;
  readonly title: string;
}

/** Reads a value from an item: a property name or a function. */
export type StarKanbanAccessor<T, R> = string | ((item: T) => R);

/**
 * Payload of `itemMove`. The board does not change `items`: apply the move in the handler (for
 * example with `starKanbanApplyMove`), or call `cancel()` to refuse it.
 */
export interface StarKanbanMove<T> {
  readonly item: T;
  readonly fromColumn: string;
  readonly toColumn: string;
  /** Index in the source cell (column and lane), in the board order. */
  readonly fromIndex: number;
  /** Index in the target cell, in the board order after the move. */
  readonly toIndex: number;
  /** Target swimlane key (`null` without swimlanes). */
  readonly swimlane: string | null;
  /** Source swimlane key (`null` without swimlanes). */
  readonly fromSwimlane: string | null;
  /** How the move was made. */
  readonly source: 'pointer' | 'keyboard';
  /** Refuses the move; the board announces that it was cancelled. */
  cancel(): void;
  readonly canceled: boolean;
}

/** Reads `accessor` of an item. */
export function starKanbanRead<T, R>(item: T, accessor: StarKanbanAccessor<T, R>): R {
  return typeof accessor === 'function'
    ? accessor(item)
    : ((item as Record<string, unknown>)[accessor] as R);
}

/** Field names that `starKanbanApplyMove` writes. */
export interface StarKanbanFields {
  /** Field of the column key. */
  readonly column: string;
  /** Number field of the order in a cell; rewritten 0, 1, 2 … in the changed cells. */
  readonly order?: string;
  /** Field of the swimlane key. */
  readonly swimlane?: string;
}

/**
 * Applies a move to a copy of `items`: the moved item gets the new column (and lane), and the
 * `order` field of the source and target cells is numbered again from 0. Items that do not change
 * keep their identity. Without an `order` field the moved item goes to its place in the array.
 *
 * ```ts
 * onMove(move: StarKanbanMove<Task>) {
 *   this.tasks.update((tasks) => starKanbanApplyMove(tasks, move, { column: 'status', order: 'rank' }));
 * }
 * ```
 */
export function starKanbanApplyMove<T extends object>(
  items: readonly T[],
  move: StarKanbanMove<T>,
  fields: StarKanbanFields,
): T[] {
  const read = (item: T, field: string) => (item as Record<string, unknown>)[field];
  const lane = (item: T) => (fields.swimlane ? read(item, fields.swimlane) : null);
  const inCell = (item: T, column: string, swimlane: string | null) =>
    read(item, fields.column) === column && (!fields.swimlane || lane(item) === swimlane);
  const sorted = (list: T[]) =>
    fields.order
      ? list.sort((a, b) => Number(read(a, fields.order!)) - Number(read(b, fields.order!)))
      : list;

  const moved = {
    ...move.item,
    [fields.column]: move.toColumn,
    ...(fields.swimlane ? { [fields.swimlane]: move.swimlane } : {}),
  } as T;
  const target = sorted(
    items.filter((item) => item !== move.item && inCell(item, move.toColumn, move.swimlane)),
  );
  const index = Math.max(0, Math.min(move.toIndex, target.length));
  target.splice(index, 0, moved);

  const changes = new Map<T, T>([[move.item, moved]]);
  if (fields.order) {
    const order = fields.order;
    const renumber = (cell: T[]) =>
      cell.forEach((item, position) => {
        const current = changes.get(item) ?? item;
        if (read(current, order) !== position) {
          changes.set(item === moved ? move.item : item, { ...current, [order]: position });
        }
      });
    renumber(target);
    const sameCell =
      move.fromColumn === move.toColumn &&
      (!fields.swimlane || move.fromSwimlane === move.swimlane);
    if (!sameCell) {
      renumber(
        sorted(
          items.filter(
            (item) => item !== move.item && inCell(item, move.fromColumn, move.fromSwimlane),
          ),
        ),
      );
    }
    return items.map((item) => changes.get(item) ?? item);
  }

  // No order field: put the item before the item that now follows it in the target cell.
  const rest = items.filter((item) => item !== move.item);
  const next = target[index + 1];
  const at = next ? rest.indexOf(next) : -1;
  if (at < 0) {
    const previous = target[index - 1];
    const after = previous ? rest.indexOf(previous) + 1 : rest.length;
    rest.splice(after, 0, moved);
  } else {
    rest.splice(at, 0, moved);
  }
  return rest;
}
