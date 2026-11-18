// Drag and drop of tree nodes: the pure drop rules (position under the pointer, scopes, the
// targets of the keyboard moves) and the shared drag state that lets one tree drop a node from
// another. The tree never changes `nodes`: it emits `nodeDrop` and the owner moves the node.
import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import type { StarTree, StarTreeNode } from './tree';
import { BranchLike, parentsOf } from './tree-model';

/** Where the dragged node goes, relative to the drop node. */
export type StarTreeDropPosition = 'before' | 'after' | 'inside';

/** A drag scope: one name or a list of names. Trees share drops when their scopes meet. */
export type StarTreeDragScope = string | readonly string[] | null;

/**
 * Payload of `nodeDrop` (PrimeNG `onNodeDrop`, Ignite `nodeDrop`). Move `dragNode` in your
 * `nodes`; the tree does not change them.
 */
export interface StarTreeNodeDropEvent<T = unknown> {
  /** The node that moves. */
  readonly dragNode: StarTreeNode<T>;
  /** The node it is dropped on. */
  readonly dropNode: StarTreeNode<T>;
  /** `'before'` or `'after'`: a sibling of `dropNode`. `'inside'`: the last child of `dropNode`. */
  readonly position: StarTreeDropPosition;
  /** The source tree, when the node comes from another tree (cross-tree drop). */
  readonly fromTree?: StarTree;
}

/**
 * Decides whether a drop is allowed (PrimeNG `validateDrop` with `onNodeDrop`'s `accept`).
 * Runs after the built-in rules: a node never drops on itself or into its own subtree.
 */
export type StarTreeDropValidator<T = unknown> = (
  dragNode: StarTreeNode<T>,
  dropNode: StarTreeNode<T>,
  position: StarTreeDropPosition,
) => boolean;

/** A drag in progress, shared by all trees on the page. */
export interface StarTreeActiveDrag {
  readonly node: StarTreeNode;
  /** The tree that the node comes from. */
  readonly source: StarTree;
  readonly scope: StarTreeDragScope;
}

/** The drag in progress. Trees read it to accept drops from another tree. @internal */
@Injectable({ providedIn: 'root' })
export class StarTreeDragState {
  readonly active = signal<StarTreeActiveDrag | null>(null);
}

function scopeList(scope: StarTreeDragScope): readonly string[] {
  if (scope === null || scope === undefined || scope === '') return [];
  return typeof scope === 'string' ? [scope] : scope;
}

/** True when the drag scope and the drop scope share a name. */
export function scopesMatch(drag: StarTreeDragScope, drop: StarTreeDragScope): boolean {
  const target = scopeList(drop);
  return scopeList(drag).some((name) => target.includes(name));
}

/**
 * The drop position from the pointer offset in a row. With `inside`, the top quarter is
 * `'before'`, the bottom quarter is `'after'` and the middle is `'inside'`; without it, the
 * halves are `'before'` and `'after'`.
 */
export function dropPositionAt(
  offset: number,
  height: number,
  inside: boolean,
): StarTreeDropPosition {
  const ratio = height > 0 ? offset / height : 0.5;
  if (!inside) return ratio < 0.5 ? 'before' : 'after';
  if (ratio < 0.25) return 'before';
  if (ratio > 0.75) return 'after';
  return 'inside';
}

/** True when `key` is `ancestor` or below it. */
export function isWithin(
  parents: ReadonlyMap<string, string | null>,
  key: string,
  ancestor: string,
): boolean {
  for (let current: string | null = key; current !== null; current = parents.get(current) ?? null) {
    if (current === ancestor) return true;
  }
  return false;
}

/** A keyboard move: Ctrl+Shift with Arrow up, down, the inline end (`in`) or start (`out`). */
export type TreeMoveDirection = 'up' | 'down' | 'in' | 'out';

/**
 * The drop that a keyboard move means, or null at the edge. `up` / `down`: before the previous
 * or after the next sibling. `in`: into the previous sibling (as its last child). `out`: after
 * the parent, one level up.
 */
export function keyboardDrop<N extends BranchLike<N>>(
  nodes: readonly N[],
  key: string,
  direction: TreeMoveDirection,
): { readonly target: N; readonly position: StarTreeDropPosition } | null {
  const parents = parentsOf(nodes);
  if (!parents.has(key)) return null;
  const index = new Map<string, N>();
  const walk = (list: readonly N[]) =>
    list.forEach((node) => {
      index.set(node.key, node);
      walk(node.children ?? []);
    });
  walk(nodes);
  const parentKey = parents.get(key) ?? null;
  const parent = parentKey === null ? null : (index.get(parentKey) ?? null);
  const siblings = parent ? (parent.children ?? []) : nodes;
  const at = siblings.findIndex((node) => node.key === key);
  switch (direction) {
    case 'up':
      return at > 0 ? { target: siblings[at - 1], position: 'before' } : null;
    case 'down':
      return at >= 0 && at < siblings.length - 1
        ? { target: siblings[at + 1], position: 'after' }
        : null;
    case 'in':
      return at > 0 ? { target: siblings[at - 1], position: 'inside' } : null;
    case 'out':
      return parent ? { target: parent, position: 'after' } : null;
  }
}

/**
 * The data type that marks a tree drag. A drag without it (a file, a text, a link) is never a
 * tree drop, also when an old tree drag did not end cleanly.
 */
export const STAR_TREE_DRAG_TYPE = 'application/x-star-tree';

/** The drag carries the tree data type (read during dragover and drop). */
function isTreeDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.from(types).includes(STAR_TREE_DRAG_TYPE);
}

/** What a tree gives its drag-and-drop controller. */
export interface TreeDndHost {
  /** The tree itself: the source of a drag, and `fromTree` of a cross-tree drop. */
  readonly owner: StarTree;
  readonly element: HTMLElement;
  readonly draggable: () => boolean;
  readonly droppable: () => boolean;
  readonly dragScope: () => StarTreeDragScope;
  readonly dropScope: () => StarTreeDragScope;
  readonly validate: () => StarTreeDropValidator | null;
  /** The node of a key in the full data (not the filtered copy). */
  readonly node: (key: string) => StarTreeNode | undefined;
  readonly parents: () => ReadonlyMap<string, string | null>;
  readonly drop: (event: StarTreeNodeDropEvent) => void;
}

/** The drop line or box that a row shows while a node is dragged over it. */
export interface TreeDropIndicator {
  readonly key: string;
  readonly position: StarTreeDropPosition;
}

/**
 * Pointer drag and drop of one tree (native HTML drag events, delegated from the tree host), and
 * the drop rules that the keyboard moves share. Create it in an injection context.
 */
export class TreeDndController {
  private readonly state = inject(StarTreeDragState);
  /** The row under the pointer and where the node would go. */
  readonly indicator = signal<TreeDropIndicator | null>(null);
  /** Key of the node of this tree that is dragged now. */
  readonly dragKey = computed(() => {
    const drag = this.state.active();
    return drag && drag.source === this.host.owner ? drag.node.key : null;
  });

  constructor(private readonly host: TreeDndHost) {
    // A drag that ends anywhere (a drop on another tree, Escape) clears the indicator here.
    effect(() => {
      if (!this.state.active()) untracked(() => this.indicator.set(null));
    });
    // The source tree goes away during its drag: no dragend will come.
    inject(DestroyRef).onDestroy(() => {
      if (this.state.active()?.source === this.host.owner) this.state.active.set(null);
    });
  }

  /** The user can drag the node: the tree allows drags and the node is not disabled. */
  canDrag(node: StarTreeNode): boolean {
    return this.host.draggable() && node.draggable !== false && !node.disabled;
  }

  /**
   * The drop is allowed: the tree accepts drops, a drop from another tree has a matching scope,
   * a node never goes into its own subtree, `inside` needs a droppable node, then `validateDrop`.
   */
  allowed(drag: StarTreeActiveDrag, target: StarTreeNode, position: StarTreeDropPosition): boolean {
    if (!this.host.droppable()) return false;
    if (drag.source === this.host.owner) {
      if (isWithin(this.host.parents(), target.key, drag.node.key)) return false;
    } else if (!scopesMatch(drag.scope, this.host.dropScope())) {
      return false;
    }
    if (position === 'inside' && target.droppable === false) return false;
    const validate = this.host.validate();
    return !validate || validate(drag.node, target, position);
  }

  /** The keyboard move of a node of this tree: the drop, and whether the rules allow it. */
  keyboardMove(
    nodes: readonly StarTreeNode[],
    node: StarTreeNode,
    direction: TreeMoveDirection,
  ): { readonly event: StarTreeNodeDropEvent; readonly allowed: boolean } | null {
    if (!this.canDrag(node)) return null;
    const drop = keyboardDrop(nodes, node.key, direction);
    if (!drop) return null;
    const drag: StarTreeActiveDrag = {
      node,
      source: this.host.owner,
      scope: this.host.dragScope(),
    };
    return {
      event: { dragNode: node, dropNode: drop.target, position: drop.position },
      allowed: this.allowed(drag, drop.target, drop.position),
    };
  }

  private row(target: EventTarget | null): { element: HTMLElement; node: StarTreeNode } | null {
    const element = (target as Element | null)?.closest?.<HTMLElement>('[data-key]');
    if (!element || !this.host.element.contains(element)) return null;
    const node = this.host.node(element.dataset['key'] ?? '');
    return node ? { element, node } : null;
  }

  dragStart(event: DragEvent): void {
    // A new drag begins: a tree drag that did not end cleanly (its row left the DOM, Escape)
    // is over.
    if (this.state.active()) this.state.active.set(null);
    const row = this.row(event.target);
    if (!row || !this.canDrag(row.node)) return;
    this.state.active.set({
      node: row.node,
      source: this.host.owner,
      scope: this.host.dragScope(),
    });
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(STAR_TREE_DRAG_TYPE, row.node.key);
      event.dataTransfer.setData('text/plain', row.node.label);
    }
  }

  dragOver(event: DragEvent): void {
    const drag = isTreeDrag(event) ? this.state.active() : null;
    const row = this.row(event.target);
    if (!drag || !row) {
      this.indicator.set(null);
      return;
    }
    const rect = row.element.getBoundingClientRect();
    const inside = this.allowed(drag, row.node, 'inside');
    const position = dropPositionAt(event.clientY - rect.top, rect.height, inside);
    if (!this.allowed(drag, row.node, position)) {
      this.indicator.set(null);
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    const current = this.indicator();
    if (current?.key !== row.node.key || current.position !== position) {
      this.indicator.set({ key: row.node.key, position });
    }
  }

  dragLeave(event: DragEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.host.element.contains(next)) this.indicator.set(null);
  }

  drop(event: DragEvent): void {
    const drag = isTreeDrag(event) ? this.state.active() : null;
    const indicator = this.indicator();
    const target = indicator && this.host.node(indicator.key);
    if (!drag || !indicator || !target) return;
    event.preventDefault();
    this.indicator.set(null);
    this.state.active.set(null);
    this.host.drop({
      dragNode: drag.node,
      dropNode: target,
      position: indicator.position,
      ...(drag.source === this.host.owner ? {} : { fromTree: drag.source }),
    });
  }

  dragEnd(): void {
    this.state.active.set(null);
    this.indicator.set(null);
  }
}
