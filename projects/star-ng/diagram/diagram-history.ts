// Patches and the undo / redo stack of `star-diagram`. The diagram never changes its inputs: it
// emits patches, the owner applies them (for example with `starApplyPatches`), and the diagram
// keeps the applied patches so that `undo()` and `redo()` can emit their inverse.

/**
 * One change of a node or an edge list: an item added, an item removed, or some fields of an
 * item changed (`before` holds the old values of the fields in `after`).
 */
export type StarDiagramPatch<T extends { readonly id: string }> =
  | { readonly type: 'add'; readonly item: T }
  | { readonly type: 'remove'; readonly item: T }
  | {
      readonly type: 'update';
      readonly id: string;
      readonly before: Partial<T>;
      readonly after: Partial<T>;
    };

/** The patches of one user action. */
export interface StarDiagramTransaction<N extends { id: string }, E extends { id: string }> {
  readonly nodes: readonly StarDiagramPatch<N>[];
  readonly edges: readonly StarDiagramPatch<E>[];
}

/** A copy of `list` with the patches applied in order. */
export function starApplyPatches<T extends { readonly id: string }>(
  list: readonly T[],
  patches: readonly StarDiagramPatch<T>[],
): T[] {
  let out = [...list];
  for (const patch of patches) {
    if (patch.type === 'add') out.push(patch.item);
    else if (patch.type === 'remove') out = out.filter((item) => item.id !== patch.item.id);
    else out = out.map((item) => (item.id === patch.id ? { ...item, ...patch.after } : item));
  }
  return out;
}

/** The patches that undo `patches` (in reverse order). */
export function starInvertPatches<T extends { readonly id: string }>(
  patches: readonly StarDiagramPatch<T>[],
): StarDiagramPatch<T>[] {
  return [...patches].reverse().map((patch) => {
    if (patch.type === 'add') return { type: 'remove', item: patch.item };
    if (patch.type === 'remove') return { type: 'add', item: patch.item };
    return { type: 'update', id: patch.id, before: patch.after, after: patch.before };
  });
}

/** Undo and redo stacks of transactions. */
export class StarDiagramHistory<
  N extends { id: string } = { id: string },
  E extends { id: string } = { id: string },
> {
  private readonly done: StarDiagramTransaction<N, E>[] = [];
  private readonly undone: StarDiagramTransaction<N, E>[] = [];

  constructor(private readonly limit = 100) {}

  /** Records an applied transaction. A new action clears the redo stack. */
  push(transaction: StarDiagramTransaction<N, E>): void {
    this.done.push(transaction);
    if (this.done.length > this.limit) this.done.shift();
    this.undone.length = 0;
  }

  canUndo(): boolean {
    return this.done.length > 0;
  }

  canRedo(): boolean {
    return this.undone.length > 0;
  }

  /** The transaction that `undo` reverts next. */
  peekUndo(): StarDiagramTransaction<N, E> | null {
    return this.done.at(-1) ?? null;
  }

  /** The transaction that `redo` applies next. */
  peekRedo(): StarDiagramTransaction<N, E> | null {
    return this.undone.at(-1) ?? null;
  }

  /** The owner applied the inverse of `peekUndo()`. */
  commitUndo(): void {
    const tx = this.done.pop();
    if (tx) this.undone.push(tx);
  }

  /** The owner applied `peekRedo()` again. */
  commitRedo(): void {
    const tx = this.undone.pop();
    if (tx) this.done.push(tx);
  }

  clear(): void {
    this.done.length = 0;
    this.undone.length = 0;
  }
}
