import { Directive, input } from '@angular/core';
import { StarSlot } from '@star-ng/ui/core';
import type { StarTreeNode } from './tree';

/**
 * Context of `<ng-template starIcon="toggle">` in `star-tree` and `star-tree-select`.
 * The template should have one root element: it is a direct child of the toggle, and the built-in
 * rotation (and the right-to-left mirror) applies to it.
 */
export interface StarToggleIconContext {
  /** The branch is open. */
  readonly $implicit: boolean;
}

/** Context of the node slot. */
export interface StarNodeContext<T = unknown> {
  /** The node. */
  readonly $implicit: StarTreeNode<T>;
  /** Depth of the node, `1` for a root node. */
  readonly level: number;
  /** The node shows its children. */
  readonly expanded: boolean;
  /** The node is selected. */
  readonly selected: boolean;
}

/**
 * Replaces the label of a node in `star-tree` and `star-tree-select`. PrimeNG `#default` node
 * template. The toggle, the checkbox and the node icon stay.
 *
 * The tree owns the keyboard model and the ARIA attributes of the `role="treeitem"` row. Do not
 * add focusable elements (buttons, links, inputs) in this template.
 *
 * The content goes inside the label element. Windowed rendering: with `virtualScroll` every row
 * keeps the fixed height `virtualItemSize`, and the label does not wrap: content that is wider
 * is cut off with an ellipsis.
 */
@Directive({
  selector: 'ng-template[starNode]',
  providers: [{ provide: StarSlot, useExisting: StarNodeTemplate }],
})
export class StarNodeTemplate<T = unknown> extends StarSlot<StarNodeContext<T>> {
  readonly name = 'node';
  /** Optional: pass the nodes array to type `let-node` in strict templates. */
  readonly starNodeOf = input<readonly StarTreeNode<T>[] | null>(null);

  static ngTemplateContextGuard<T>(
    _dir: StarNodeTemplate<T>,
    _ctx: unknown,
  ): _ctx is StarNodeContext<T> {
    return true;
  }
}
