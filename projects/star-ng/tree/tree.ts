import { _IdGenerator } from '@angular/cdk/a11y';
import type { ListRange } from '@angular/cdk/collections';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterEveryRender,
  afterNextRender,
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarDirectionService,
  StarEmptyContext,
  starFilterMatch,
  starInlineKey,
  starIsRtl,
  StarSlot,
  starSlot,
  starSlotMap,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
import { StarContextMenu, StarMenu, StarMenuItem } from '@star-ng/ui/menu';
import {
  StarTreeDragScope,
  StarTreeDropPosition,
  StarTreeDropValidator,
  StarTreeNodeDropEvent,
  TreeDndController,
  TreeMoveDirection,
} from './tree-dnd';
import {
  ancestorKeys,
  branchKeys,
  checkStates,
  filterTree,
  flattenVisible,
  isLocked,
  navigationTarget,
  nodeFieldText,
  parentsOf,
  rowIndexOf,
  scrollOffsetToReveal,
  stillFocusable,
  subtreeKeys,
  toggleChecked,
  TreeFilterMode,
  TreeRow,
} from './tree-model';
import type { StarNodeContext, StarToggleIconContext } from './tree-slots';

/** Tree data (PrimeNG `TreeNode`). `key` must be unique in the tree. */
export interface StarTreeNode<T = unknown> {
  readonly key: string;
  readonly label: string;
  readonly icon?: string;
  readonly data?: T;
  readonly children?: readonly StarTreeNode<T>[];
  /** `false`: the user cannot select the node, and checkbox propagation keeps its state. */
  readonly selectable?: boolean;
  /** The user cannot select the node, and checkbox propagation keeps its state. */
  readonly disabled?: boolean;
  /**
   * Lazy children (PrimeNG `leaf`): `false` marks a node whose children are not loaded yet. It
   * shows the toggle, and opening it emits `nodeExpand` so that the owner loads the children.
   */
  readonly leaf?: boolean;
  /** The children of this node are loading: the node shows a loading row or icon. */
  readonly loading?: boolean;
  /** `false`: the node cannot be dragged, also when the tree has `draggableNodes`. */
  readonly draggable?: boolean;
  /** `false`: no node can be dropped inside this node (before and after it still work). */
  readonly droppable?: boolean;
}

/** Payload of `nodeExpand`, `nodeCollapse`, `nodeDoubleClick` and `nodeContextMenu`. */
export interface StarTreeNodeEvent<T = unknown> {
  readonly node: StarTreeNode<T>;
  /** The browser event, when the user caused it. */
  readonly originalEvent?: Event;
}

/** Payload of `contextMenuSelect`: the node of the menu and the item the user chose. */
export interface StarTreeContextMenuEvent<T = unknown> {
  readonly node: StarTreeNode<T>;
  readonly item: StarMenuItem;
}

/** How a node shows that its children load: a row under it, or a spinner in its toggle. */
export type StarTreeLoadingMode = 'icon' | 'row';

type VisibleNode = TreeRow<StarTreeNode>;

const NO_KEYS: ReadonlySet<string> = new Set();

/** Keyboard move keys (Ctrl+Shift and an arrow) and their direction; the inline arrows mirror in RTL. */
const MOVE_KEYS: Readonly<Record<string, TreeMoveDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowRight: 'in',
  ArrowLeft: 'out',
};

/**
 * Tree (PrimeNG `p-tree`, Ignite `igx-tree`): expand / collapse, single, multiple or checkbox
 * selection (checkbox mode propagates up and down and shows mixed parents), filter in lenient or
 * strict mode, lazy children, a row context menu, drag and drop with a keyboard alternative, and
 * the WAI-ARIA tree keyboard model (Up / Down, Right opens or enters, Left closes or goes to the
 * parent, Home / End, Enter / Space select, `*` expands siblings).
 *
 * Large trees: `virtualScroll` with `scrollHeight` and `virtualItemSize` renders only the rows in
 * and near the viewport (CDK virtual scrolling). Every row has a fixed height then. Keys, selection
 * and `aria-setsize` / `aria-posinset` work over all open rows, also the ones that are not in the DOM.
 *
 * The tree never changes `nodes`: lazy children, drops and context menu actions are outputs, and
 * the owner updates the data.
 *
 * Value: the selected node keys.
 * `<star-tree [nodes]="departments" selectionMode="checkbox" [(value)]="keys" filter ariaLabel="Departments" />`
 */
@Component({
  selector: 'star-tree',
  imports: [
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    NgTemplateOutlet,
    StarContextMenu,
    StarMenu,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarTree) }],
  host: {
    class: 'star-tree',
    '(dragstart)': 'dnd.dragStart($event)',
    '(dragover)': 'dnd.dragOver($event)',
    '(dragleave)': 'dnd.dragLeave($event)',
    '(drop)': 'dnd.drop($event)',
    '(dragend)': 'dnd.dragEnd()',
  },
  template: `
    @if (headerSlot(); as header) {
      <ng-container *ngTemplateOutlet="header" />
    }
    @if (filter()) {
      <div class="star-panel__filter">
        <i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
        <input
          #filterInput
          type="search"
          class="star-input star-input--sm"
          autocomplete="off"
          [attr.aria-label]="text.filterPlaceholder"
          [placeholder]="text.filterPlaceholder"
          [value]="query()"
          (input)="query.set(filterInput.value)"
        />
      </div>
    }
    <ng-template #row let-item>
      <li
        class="star-tree__item"
        role="treeitem"
        [attr.data-key]="item.node.key"
        [attr.aria-level]="item.level"
        [attr.aria-setsize]="item.setSize"
        [attr.aria-posinset]="item.position"
        [attr.aria-expanded]="isBranch(item.node) ? isExpanded(item.node) : null"
        [attr.aria-selected]="
          selectionMode() && selectionMode() !== 'checkbox' ? isSelected(item.node) : null
        "
        [attr.aria-checked]="selectionMode() === 'checkbox' ? checkState(item.node) : null"
        [attr.aria-disabled]="item.node.disabled || null"
        [attr.aria-busy]="item.node.loading || null"
        [attr.draggable]="dnd.canDrag(item.node) ? 'true' : null"
        [attr.tabindex]="focusKey() === item.node.key ? 0 : -1"
        [class.star-tree__item--selected]="isSelected(item.node)"
        [class.star-tree__item--dragging]="dnd.dragKey() === item.node.key"
        [class.star-tree__item--drop-before]="dropAt(item.node.key) === 'before'"
        [class.star-tree__item--drop-after]="dropAt(item.node.key) === 'after'"
        [class.star-tree__item--drop-inside]="dropAt(item.node.key) === 'inside'"
        [style.--star-tree-level]="item.level - 1"
        [style.height.px]="showViewport() ? virtualItemSize() : null"
        (click)="onClick(item.node, $event)"
        (dblclick)="nodeDoubleClick.emit({ node: item.node, originalEvent: $event })"
        (contextmenu)="onContextMenu(item.node, $event)"
        (keydown)="onKeydown($event, item)"
        (focus)="onRowFocus(item.node.key)"
      >
        @if (isBranch(item.node)) {
          <span
            class="star-tree__toggle"
            aria-hidden="true"
            (click)="$event.stopPropagation(); onToggleClick(item.node, $event)"
          >
            @if (item.node.loading && loadingIcon()) {
              <i class="ph-bold ph-spinner-gap star-spin"></i>
            } @else if (toggleIcon(); as icon) {
              <ng-container
                *ngTemplateOutlet="icon; context: { $implicit: isExpanded(item.node) }"
              />
            } @else {
              <i class="ph-bold ph-caret-right"></i>
            }
          </span>
        } @else {
          <span class="star-tree__toggle star-tree__toggle--leaf" aria-hidden="true"></span>
        }
        @if (selectionMode() === 'checkbox') {
          <span
            class="star-check__box star-tree__check"
            aria-hidden="true"
            [class.star-tree__check--on]="checkState(item.node) !== false"
          >
            @if (checkState(item.node) === 'mixed') {
              <i class="ph-bold ph-minus"></i>
            } @else if (checkState(item.node) === true) {
              <i class="ph-bold ph-check"></i>
            }
          </span>
        }
        @if (item.node.icon) {
          <i class="star-tree__icon" [class]="item.node.icon" aria-hidden="true"></i>
        }
        <span class="star-tree__label">
          @if (nodeSlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: nodeContext(item)" />
          } @else {
            <ng-container>{{ item.node.label }}</ng-container>
          }
        </span>
      </li>
      @if (item.node.loading && !loadingIcon() && isExpanded(item.node)) {
        <li class="star-tree__loading" role="presentation" [style.--star-tree-level]="item.level">
          <span class="star-tree__toggle star-tree__toggle--leaf" aria-hidden="true"></span>
          <i class="ph-bold ph-spinner-gap star-spin" aria-hidden="true"></i>
          {{ text.loading }}
        </li>
      }
    </ng-template>
    <ng-template #body>
      @if (showViewport()) {
        <cdk-virtual-scroll-viewport
          #viewport
          class="star-tree__viewport"
          role="tree"
          [itemSize]="virtualItemSize()"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="labelledBy()"
          [attr.aria-describedby]="moveHintId()"
          [attr.aria-multiselectable]="multiselectable()"
          [attr.tabindex]="activeRendered() ? -1 : 0"
          [style.height]="viewportHeight()"
          (focus)="onViewportFocus()"
          (blur)="parked = false"
          (keydown)="onViewportKeydown($event)"
        >
          <ng-template
            cdkVirtualFor
            let-item
            [cdkVirtualForOf]="visible()"
            [cdkVirtualForTrackBy]="trackRow"
          >
            <ng-container
              [ngTemplateOutlet]="row"
              [ngTemplateOutletContext]="{ $implicit: item }"
            />
          </ng-template>
        </cdk-virtual-scroll-viewport>
      } @else {
        <ul
          #tree
          class="star-tree__list"
          role="tree"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="labelledBy()"
          [attr.aria-describedby]="moveHintId()"
          [attr.aria-multiselectable]="multiselectable()"
          [style.max-height]="scrollHeight()"
        >
          @for (item of visible(); track item.node.key) {
            <ng-container
              [ngTemplateOutlet]="row"
              [ngTemplateOutletContext]="{ $implicit: item }"
            />
          } @empty {
            <li class="star-listbox__empty" role="presentation">
              @if (emptySlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
              } @else {
                <ng-container>{{ text.emptyFilterMessage }}</ng-container>
              }
            </li>
          }
        </ul>
      }
    </ng-template>
    @if (contextMenu().length) {
      <div class="star-tree__body" [starContextMenu]="rowMenu" (menuClosed)="onMenuClosed()">
        <ng-container *ngTemplateOutlet="body" />
      </div>
    } @else {
      <ng-container *ngTemplateOutlet="body" />
    }
    <star-menu
      #rowMenu
      [items]="contextMenu()"
      [ariaLabel]="text.actions"
      (itemClick)="onMenuItem($event)"
    />
    @if (moveHintId(); as hintId) {
      <p class="star-sr-only" [id]="hintId">{{ text.treeMoveHint }}</p>
    }
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
    @if (footerSlot(); as footer) {
      <ng-container *ngTemplateOutlet="footer" />
    }
  `,
})
export class StarTree implements FormValueControl<readonly string[]> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly hintId = inject(_IdGenerator).getId('star-tree-hint-');
  readonly value = model<readonly string[]>([]);
  readonly nodes = input<readonly StarTreeNode[]>([]);
  readonly selectionMode = input<'single' | 'multiple' | 'checkbox' | null>(null);
  /** Expanded node keys. */
  readonly expanded = model<readonly string[]>([]);
  readonly filter = input(false, { transform: booleanAttribute });
  /**
   * How the filter keeps nodes (PrimeNG `filterMode`). `'strict'` (the default): only the
   * matching paths show, and a match shows only its matching descendants. `'lenient'`: a match
   * shows with all its descendants. Both show the ancestors of a match open.
   */
  readonly filterMode = input<TreeFilterMode>('strict');
  /**
   * The node fields that the filter searches (PrimeNG `filterBy`): `label` (the default), another
   * node property, or a field of `data`. One field or a list.
   */
  readonly filterBy = input<string | readonly string[]>('label');
  /**
   * Locale of the filter compare (PrimeNG `filterLocale`), for example `de`. Case and accents never
   * count; with a locale, the compare follows the letters of that language.
   */
  readonly filterLocale = input<string | null>(null);
  /** Maximum height of the tree (a CSS length, for example `16rem`). The tree scrolls inside it. */
  readonly scrollHeight = input<string | null>(null);
  /**
   * Windowed rendering for large trees (CDK virtual scrolling): only the rows in and near the
   * viewport are in the DOM. Needs `scrollHeight`, and every row gets the fixed height
   * `virtualItemSize`. Without `scrollHeight` the tree renders all rows as usual.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Row height in pixels in windowed rendering. Keep it equal to the real row height. */
  readonly virtualItemSize = input(34, { transform: numberAttribute });
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  /**
   * Checkbox mode (PrimeNG `propagateSelectionUp`): a parent is checked when all its selectable
   * children are checked, and mixed when some are. Locked nodes (`disabled`, `selectable: false`)
   * do not count and keep their state.
   */
  readonly propagateSelectionUp = input(true, { transform: booleanAttribute });
  /**
   * Checkbox mode (PrimeNG `propagateSelectionDown`): checking a node checks its descendants,
   * except locked nodes and their subtrees. With both propagations on, `value` holds the leaf keys
   * (and locked keys); parents are derived.
   */
  readonly propagateSelectionDown = input(true, { transform: booleanAttribute });
  /**
   * Lazy children: `'row'` (the default) shows a loading row under an open node whose `loading`
   * is true; `'icon'` shows a spinner in its toggle. With `virtualScroll` the icon always shows,
   * because every row has the same height.
   */
  readonly loadingMode = input<StarTreeLoadingMode>('row');
  /**
   * Items of the node context menu (PrimeNG `contextMenu`): right click, Shift+F10 or the context
   * menu key on a node. Empty: no menu, and the browser menu shows.
   */
  readonly contextMenu = input<readonly StarMenuItem[]>([]);
  /**
   * The user can drag nodes (PrimeNG `draggableNodes`, Ignite drag and drop). With
   * `droppableNodes`, Ctrl+Shift and the arrow keys move the focused node too. A node with
   * `draggable: false` or `disabled` stays.
   */
  readonly draggableNodes = input(false, { transform: booleanAttribute });
  /** The tree accepts drops (PrimeNG `droppableNodes`). */
  readonly droppableNodes = input(false, { transform: booleanAttribute });
  /** Scope of the nodes dragged from this tree (PrimeNG `draggableScope`), for cross-tree drops. */
  readonly draggableScope = input<StarTreeDragScope>(null);
  /** Scopes this tree accepts from other trees (PrimeNG `droppableScope`). */
  readonly droppableScope = input<StarTreeDragScope>(null);
  /** Extra rule for drops (PrimeNG `validateDrop`); return false to refuse a drop. */
  readonly validateDrop = input<StarTreeDropValidator | null>(null);
  /**
   * Set by `star-tree-select`. In your own markup, use the `starNode` slot.
   *
   * @internal
   */
  readonly nodeTemplate = input<TemplateRef<StarNodeContext> | null>(null);
  /**
   * Set by `star-tree-select`. In your own markup, use the `starEmpty` slot.
   *
   * @internal
   */
  readonly emptyTemplate = input<TemplateRef<StarEmptyContext> | null>(null);
  /**
   * Set by `star-tree-select`. In your own markup, use `<ng-template starIcon="toggle">`.
   *
   * @internal
   */
  readonly toggleIconTemplate = input<TemplateRef<StarToggleIconContext> | null>(null);
  readonly touch = output<void>();
  /** The user selected or checked a node (PrimeNG `onNodeSelect`). */
  readonly nodeSelect = output<StarTreeNode>();
  /** The user unselected or unchecked a node (PrimeNG `onNodeUnselect`). */
  readonly nodeUnselect = output<StarTreeNode>();
  /** The user opened a node (PrimeNG `onNodeExpand`). For a lazy node, load its children here. */
  readonly nodeExpand = output<StarTreeNodeEvent>();
  /** The user closed a node (PrimeNG `onNodeCollapse`). */
  readonly nodeCollapse = output<StarTreeNodeEvent>();
  /** Double click on a node (PrimeNG `onNodeDoubleClick`). */
  readonly nodeDoubleClick = output<StarTreeNodeEvent>();
  /** Right click, Shift+F10 or the context menu key on a node (PrimeNG `onNodeContextMenuSelect`). */
  readonly nodeContextMenu = output<StarTreeNodeEvent>();
  /** The user chose an item of the node context menu. */
  readonly contextMenuSelect = output<StarTreeContextMenuEvent>();
  /** A node was dropped, by pointer or keyboard (PrimeNG `onNodeDrop`). Move it in `nodes`. */
  readonly nodeDrop = output<StarTreeNodeDropEvent>();

  protected readonly query = signal('');
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  private readonly ownNodeSlot = starSlot<StarNodeContext>(this.slots, this, 'node');
  private readonly ownEmptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  private readonly ownIconSlots = starSlotMap<StarToggleIconContext>(this.slots, this, 'icon');
  /** Own `starNode` slot first, then the `nodeTemplate` input. */
  protected readonly nodeSlot = computed(() => this.ownNodeSlot() ?? this.nodeTemplate());
  protected readonly emptySlot = computed(() => this.ownEmptySlot() ?? this.emptyTemplate());
  protected readonly toggleIcon = computed(
    () => this.ownIconSlots().get('toggle') ?? this.toggleIconTemplate(),
  );
  protected readonly emptyContext = computed<StarEmptyContext>(() => ({ $implicit: this.query() }));
  private readonly viewport = viewChild(CdkVirtualScrollViewport);
  /**
   * The parent `star-field` when it labels the tree (a `ul` tree is not labelable). Inside a tree
   * select the select owns the label, so this is `null` there.
   */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));

  private readonly filterFields = computed(() => {
    const by = this.filterBy();
    return typeof by === 'string' ? [by] : by;
  });
  /** The nodes that the filter keeps, and the ancestors of the matches (they show open). */
  private readonly filtered = computed(() => {
    const query = this.query();
    if (!query.trim()) return { nodes: this.nodes(), ancestors: NO_KEYS };
    const fields = this.filterFields();
    const locale = this.filterLocale();
    return filterTree(
      this.nodes(),
      (node) =>
        fields.some((field) =>
          starFilterMatch(nodeFieldText(node, field), query, 'contains', locale),
        ),
      this.filterMode(),
    );
  });

  private readonly index = computed(() => {
    const map = new Map<string, StarTreeNode>();
    const walk = (nodes: readonly StarTreeNode[]) =>
      nodes.forEach((node) => {
        map.set(node.key, node);
        walk(node.children ?? []);
      });
    walk(this.nodes());
    return map;
  });
  private readonly parents = computed(() => parentsOf(this.nodes()));
  private readonly openKeys = computed(() => new Set(this.expanded()));
  private readonly selectedKeys = computed(() => new Set(this.value()));
  /** The open keys of the rows: the expanded keys, and while filtering the ancestors of matches. */
  private readonly shownOpen = computed(() => {
    const ancestors = this.filtered().ancestors;
    if (!ancestors.size) return this.openKeys();
    return new Set([...this.openKeys(), ...ancestors]);
  });

  /** Flattened visible rows; a filter shows every branch with a match open. */
  protected readonly visible = computed<VisibleNode[]>(() =>
    flattenVisible(this.filtered().nodes, this.shownOpen()),
  );
  private readonly rowIndex = computed(() => rowIndexOf(this.visible()));

  /** Check state of each node (from the full data); empty outside checkbox mode. */
  private readonly checkMap = computed(() =>
    this.selectionMode() === 'checkbox'
      ? checkStates(this.nodes(), this.selectedKeys(), this.propagateSelectionUp())
      : new Map<string, boolean | 'mixed'>(),
  );

  /**
   * The active row (the one with `tabindex` 0). It stays a row after the rows change, and it
   * is kept in state, not read from the DOM: in windowed rendering its element may not exist.
   */
  protected readonly focusKey = linkedSignal<readonly VisibleNode[], string | null>({
    source: this.visible,
    computation: (rows, previous) =>
      stillFocusable(previous?.value, this.rowIndex(), this.parents(), rows[0]?.node.key ?? null),
  });

  // ---- windowed rendering ----
  protected readonly windowed = computed(
    () => this.virtualScroll() && !!this.scrollHeight() && this.virtualItemSize() > 0,
  );
  /** The windowed viewport shows when there are rows; the empty message needs the plain list. */
  protected readonly showViewport = computed(() => this.windowed() && this.visible().length > 0);
  /** Height of the viewport: as high as the rows, at most `scrollHeight`. */
  protected readonly viewportHeight = computed(
    () => `min(${this.visible().length * this.virtualItemSize()}px, ${this.scrollHeight()})`,
  );
  /** Rows that are in the DOM now: indexes `start` up to (not including) `end`. */
  private readonly range = signal<ListRange>({ start: 0, end: 0 });
  /** The active row is in the DOM. If it is not, the viewport takes the Tab stop. */
  protected readonly activeRendered = computed(() => {
    const index = this.rowIndex().get(this.focusKey() ?? '');
    const { start, end } = this.range();
    return index !== undefined && index >= start && index < end;
  });
  protected readonly multiselectable = computed(() =>
    this.selectionMode() !== 'single' && this.selectionMode() !== null ? true : null,
  );
  /** Row to focus as soon as its element exists (it may need scrolling in first). */
  private pendingFocus: string | null = null;
  /** The focus waits on the viewport because the focused row left the DOM. */
  protected parked = false;

  protected readonly trackRow = (_: number, row: VisibleNode) => row.node.key;

  // ---- lazy children ----
  /** The loading state shows in the toggle (`loadingMode` icon, or windowed rendering). */
  protected readonly loadingIcon = computed(
    () => this.loadingMode() === 'icon' || this.showViewport(),
  );

  // ---- drag and drop ----
  protected readonly dnd = new TreeDndController({
    owner: this,
    element: this.host.nativeElement,
    draggable: () => this.draggableNodes() && !this.disabled(),
    droppable: () => this.droppableNodes() && !this.disabled(),
    dragScope: () => this.draggableScope(),
    dropScope: () => this.droppableScope(),
    validate: () => this.validateDrop(),
    node: (key) => this.index().get(key),
    parents: () => this.parents(),
    drop: (event) => this.nodeDrop.emit(event),
  });
  /** The keyboard moves are on: the tree is draggable and droppable. */
  private readonly keyboardMoves = computed(
    () => this.draggableNodes() && this.droppableNodes() && !this.disabled(),
  );
  /** Id of the hidden hint that names the move keys (only while the keyboard moves are on). */
  protected readonly moveHintId = computed(() => (this.keyboardMoves() ? this.hintId : null));
  /** Text of the polite live region (keyboard moves). */
  protected readonly announcement = signal('');

  // ---- context menu ----
  private menuNode: StarTreeNode | null = null;

  constructor() {
    effect((onCleanup) => {
      const viewport = this.viewport();
      if (!viewport) {
        this.range.set({ start: 0, end: 0 });
        return;
      }
      this.range.set({ ...viewport.getRenderedRange() });
      // The range is emitted before the DOM changes: the focused row is still there.
      const subscription = viewport.renderedRangeStream.subscribe((range) => {
        this.parkFocus(range);
        this.range.set({ ...range });
      });
      onCleanup(() => subscription.unsubscribe());
    });
    // The rows change (a branch opens above the focused row, a filter, new nodes) and the focused
    // row may leave the window without a scroll. This effect runs before the template updates.
    effect(() => {
      this.visible();
      untracked(() => {
        const viewport = this.viewport();
        if (viewport) this.parkFocus(viewport.getRenderedRange());
      });
    });
    // The viewport measures its height once; it must measure again when the rows change it.
    afterRenderEffect(() => {
      this.viewportHeight();
      this.viewport()?.checkViewportSize();
    });
    afterEveryRender(() => {
      this.applyPendingFocus();
      if (this.parked) this.restoreParkedFocus();
    });
  }

  protected nodeContext(item: VisibleNode): StarNodeContext {
    return {
      $implicit: item.node,
      level: item.level,
      expanded: this.isExpanded(item.node),
      selected: this.isSelected(item.node),
    };
  }

  /** The node has children, or lazy children that are not loaded yet (`leaf: false`). */
  protected isBranch(node: StarTreeNode): boolean {
    return !!node.children?.length || node.leaf === false;
  }

  isExpanded(node: StarTreeNode): boolean {
    return this.shownOpen().has(node.key);
  }

  toggle(node: StarTreeNode, open = !this.isExpanded(node)): void {
    this.expanded.update((keys) => {
      if (!open) return keys.includes(node.key) ? keys.filter((k) => k !== node.key) : keys;
      return keys.includes(node.key) ? keys : [...keys, node.key];
    });
  }

  /** A user toggle: changes the expanded keys and emits `nodeExpand` or `nodeCollapse`. */
  private userToggle(node: StarTreeNode, open: boolean, originalEvent?: Event): void {
    const was = this.openKeys().has(node.key);
    this.toggle(node, open);
    if (was === open) return;
    (open ? this.nodeExpand : this.nodeCollapse).emit({ node, originalEvent });
  }

  protected onToggleClick(node: StarTreeNode, event: MouseEvent): void {
    this.userToggle(node, !this.isExpanded(node), event);
  }

  // ---- API ----

  /** Opens every branch that has children (PrimeNG `expandAll`). Lazy nodes stay closed. */
  expandAll(): void {
    const all = branchKeys(this.nodes());
    this.expanded.update((keys) => {
      const open = new Set(keys);
      const added = all.filter((key) => !open.has(key));
      return added.length ? [...keys, ...added] : keys;
    });
  }

  /** Closes every branch (PrimeNG `collapseAll`). */
  collapseAll(): void {
    if (this.expanded().length) this.expanded.set([]);
  }

  /** Opens all ancestors of a node, so that its row shows (Ignite `expandToNode`). */
  expandPath(key: string): void {
    const path = ancestorKeys(this.parents(), key);
    if (!path.length) return;
    this.expanded.update((keys) => {
      const open = new Set(keys);
      const added = path.filter((k) => !open.has(k));
      return added.length ? [...keys, ...added] : keys;
    });
  }

  /**
   * Opens the ancestors of a node and scrolls its row into view (PrimeNG `scrollToVirtualIndex`,
   * by key). The focus does not move; the row becomes the Tab stop of the tree.
   */
  scrollToNode(key: string): void {
    if (!this.index().has(key)) return;
    this.expandPath(key);
    afterNextRender(
      () => {
        if (!this.rowIndex().has(key)) return;
        this.focusKey.set(key);
        if (this.showViewport()) {
          this.revealRow(key);
        } else {
          this.rowElement(key)?.scrollIntoView?.({ block: 'nearest' });
        }
      },
      { injector: this.injector },
    );
  }

  protected isSelected(node: StarTreeNode): boolean {
    return this.selectedKeys().has(node.key);
  }

  /** Checkbox mode: true, false or 'mixed'. */
  protected checkState(node: StarTreeNode): boolean | 'mixed' {
    return this.checkMap().get(node.key) ?? this.isSelected(node);
  }

  /** The drop position shown on a row, if any. */
  protected dropAt(key: string): StarTreeDropPosition | null {
    const indicator = this.dnd.indicator();
    return indicator?.key === key ? indicator.position : null;
  }

  select(node: StarTreeNode): void {
    const mode = this.selectionMode();
    if (!mode || this.disabled() || isLocked(node)) return;
    let on = true;
    if (mode === 'single') {
      this.value.set([node.key]);
    } else if (mode === 'multiple') {
      on = !this.value().includes(node.key);
      this.value.update((keys) => (on ? [...keys, node.key] : keys.filter((k) => k !== node.key)));
    } else {
      const before = this.checkState(node);
      on = before !== true;
      const up = this.propagateSelectionUp();
      const down = this.propagateSelectionDown();
      let next = toggleChecked(this.nodes(), node.key, on, this.value(), { up, down });
      if (up && down) {
        // Both propagations: the value holds leaves (and locked keys); parents are derived. A
        // node whose children are all locked counts as a leaf: nothing below it can carry it.
        const touched = new Set([...subtreeKeys(node), ...ancestorKeys(this.parents(), node.key)]);
        next = next.filter(
          (key) => !touched.has(key) || this.isValueLeaf(key) || this.isLockedKey(key),
        );
      }
      this.value.set(next);
      // Only a real change of the node's check state is an event.
      if (this.checkState(node) === before) return;
    }
    (on ? this.nodeSelect : this.nodeUnselect).emit(node);
  }

  /** A node without children, or whose children are all locked (checkbox value form). */
  private isValueLeaf(key: string): boolean {
    const children = this.index().get(key)?.children ?? [];
    return children.every((child) => isLocked(child));
  }

  private isLockedKey(key: string): boolean {
    const node = this.index().get(key);
    return !!node && isLocked(node);
  }

  protected onClick(node: StarTreeNode, event: MouseEvent): void {
    this.focusKey.set(node.key);
    (event.currentTarget as HTMLElement).focus();
    if (this.selectionMode()) this.select(node);
    else if (this.isBranch(node)) this.userToggle(node, !this.isExpanded(node), event);
  }

  protected onRowFocus(key: string): void {
    this.focusKey.set(key);
    this.pendingFocus = null;
    this.parked = false;
  }

  // ---- context menu ----

  protected onContextMenu(node: StarTreeNode, event: MouseEvent): void {
    this.focusKey.set(node.key);
    this.nodeContextMenu.emit({ node, originalEvent: event });
    if (this.contextMenu().length) this.menuNode = node;
  }

  protected onMenuItem(item: StarMenuItem): void {
    const node = this.menuNode;
    if (node) this.contextMenuSelect.emit({ node, item });
  }

  /** The menu closed: the focus goes back to the row when it has nowhere else to be. */
  protected onMenuClosed(): void {
    setTimeout(() => {
      const active = this.doc.activeElement;
      if (!active || active === this.doc.body) this.focusRow(this.focusKey());
    });
  }

  /** Shift+F10 or the context menu key: opens the menu at the row, as a right click does. */
  private openMenuFromKey(key: string): void {
    const row = this.rowElement(key);
    if (!row) return;
    const rect = row.getBoundingClientRect();
    row.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 0,
        clientX: starIsRtl(row) ? rect.right - 16 : rect.left + 16,
        clientY: rect.bottom,
      }),
    );
  }

  // ---- keyboard moves ----

  /** Ctrl+Shift and an arrow: emits `nodeDrop` for the move and announces it. */
  private moveByKey(node: StarTreeNode, direction: TreeMoveDirection): void {
    const move = this.dnd.keyboardMove(this.nodes(), node, direction);
    if (!move) return;
    if (!move.allowed) {
      this.announce(this.text.treeMoveNotAllowed(node.label));
      return;
    }
    const { dropNode, position } = move.event;
    // The node goes into the previous sibling: open it so the node stays in view.
    if (position === 'inside') this.toggle(dropNode, true);
    this.nodeDrop.emit(move.event);
    const say =
      position === 'before'
        ? this.text.treeMovedBefore
        : position === 'after'
          ? this.text.treeMovedAfter
          : this.text.treeMovedInside;
    this.announce(say(node.label, dropNode.label));
    // The row keeps the focus after the owner moves it (it renders again at the new place).
    this.focusKey.set(node.key);
    this.pendingFocus = node.key;
  }

  private announce(message: string): void {
    // A repeated message must still be read: clear first, then set.
    this.announcement.set('');
    queueMicrotask(() => this.announcement.set(message));
  }

  /**
   * Moves the focus to a row. The row becomes the active row at once. In windowed rendering the
   * row is scrolled into the window first, and the focus is applied after its element renders.
   */
  private focusRow(key: string | null | undefined): void {
    if (!key) return;
    this.focusKey.set(key);
    this.pendingFocus = key;
    if (this.showViewport()) this.revealRow(key);
    queueMicrotask(() => this.applyPendingFocus());
  }

  /** Scrolls a row into the window with the least movement (`scrollToIndex` puts it on top). */
  private revealRow(key: string): void {
    const viewport = this.viewport();
    const index = this.rowIndex().get(key);
    if (!viewport || index === undefined) return;
    const offset = scrollOffsetToReveal(
      index,
      this.virtualItemSize(),
      viewport.measureScrollOffset(),
      viewport.getViewportSize(),
    );
    if (offset !== null) viewport.scrollToOffset(offset);
  }

  private rowElement(key: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  }

  private applyPendingFocus(): void {
    const key = this.pendingFocus;
    if (key === null) return;
    if (!this.rowIndex().has(key)) {
      this.pendingFocus = null;
      return;
    }
    const row = this.rowElement(key);
    if (!row) return; // not rendered yet: the next render calls this again
    this.pendingFocus = null;
    if (this.doc.activeElement !== row) row.focus({ preventScroll: this.windowed() });
  }

  /**
   * The browser drops the focus to the page body when the focused element leaves the DOM. Before
   * the focused row scrolls out of the window, the focus moves to the viewport; the keys still
   * work there, and the focus returns to the row when it renders again.
   */
  private parkFocus(range: ListRange): void {
    const viewport = this.viewport()?.elementRef.nativeElement;
    const active = this.doc.activeElement;
    if (!viewport || !active || active === viewport || !viewport.contains(active)) return;
    const key = active.closest<HTMLElement>('[data-key]')?.dataset['key'];
    const index = key === undefined ? undefined : this.rowIndex().get(key);
    if (index !== undefined && index >= range.start && index < range.end) return;
    this.parked = true;
    viewport.focus({ preventScroll: true });
  }

  private restoreParkedFocus(): void {
    const viewport = this.viewport()?.elementRef.nativeElement;
    if (!viewport || this.doc.activeElement !== viewport) {
      this.parked = false;
      return;
    }
    const key = this.focusKey();
    if (key === null) return;
    this.rowElement(key)?.focus({ preventScroll: true });
  }

  /** Tab into the viewport (no row has the Tab stop): the focus goes to the active row. */
  protected onViewportFocus(): void {
    if (!this.parked) this.focusRow(this.focusKey());
  }

  /** Keys on the viewport itself (the focus is parked there): they act on the active row. */
  protected onViewportKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    const row = this.visible()[this.rowIndex().get(this.focusKey() ?? '') ?? -1];
    if (row) this.onKeydown(event, row);
  }

  protected onKeydown(event: KeyboardEvent, row: VisibleNode): void {
    const rows = this.visible();
    // A key that arrives before the last move has rendered (a held key, a far scroll) continues
    // from the row that the last move aimed at, not from the row that still has the DOM focus.
    const item =
      this.pendingFocus === null
        ? row
        : (rows[this.rowIndex().get(this.pendingFocus) ?? -1] ?? row);
    const index = this.rowIndex().get(item.node.key) ?? -1;
    const hasChildren = this.isBranch(item.node);
    const expanded = hasChildren && this.isExpanded(item.node);
    // Arrow right opens a branch and Arrow left closes it (WAI-ARIA tree pattern). In
    // right-to-left the arrows swap: the branch opens toward the left.
    const key = starInlineKey(event);
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && MOVE_KEYS[key]) {
      if (!this.keyboardMoves()) return;
      event.preventDefault();
      this.moveByKey(item.node, MOVE_KEYS[key]);
      return;
    }
    if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
      if (!this.contextMenu().length) return;
      event.preventDefault();
      this.openMenuFromKey(item.node.key);
      return;
    }
    const target = () => navigationTarget(rows, index, key, { hasChildren, expanded });
    const handled = () => event.preventDefault();
    switch (key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        handled();
        return this.focusRow(target());
      case 'ArrowRight':
        handled();
        if (hasChildren && !expanded) this.userToggle(item.node, true, event);
        // An open lazy node without children yet has no child to enter.
        else if (item.node.children?.length || !hasChildren) this.focusRow(target());
        return;
      case 'ArrowLeft':
        handled();
        if (expanded) this.userToggle(item.node, false, event);
        else this.focusRow(target());
        return;
      case 'Enter':
      case ' ':
        handled();
        if (this.selectionMode()) this.select(item.node);
        else if (hasChildren) this.userToggle(item.node, !expanded, event);
        return;
      case '*': {
        handled();
        const siblings = rows
          .filter((r) => r.parentKey === item.parentKey && this.isBranch(r.node))
          .map((r) => r.node);
        const open = this.openKeys();
        for (const sibling of siblings) {
          if (!open.has(sibling.key)) this.userToggle(sibling, true, event);
        }
        return;
      }
    }
  }

  /** Label of a node key (used by `star-tree-select`). */
  labelFor(key: string): string {
    return this.index().get(key)?.label ?? key;
  }

  /** Keys of leaves only, for checkbox summaries. */
  isLeaf(key: string): boolean {
    return !this.index().get(key)?.children?.length;
  }

  focus(): void {
    this.focusRow(this.focusKey());
  }
}

const POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
];

/**
 * Tree select (PrimeNG `p-treeselect`): a select field whose panel is an `star-tree`.
 * Value: selected node keys (one key in `single` mode).
 *
 * The panel tree gets the filter (`filterMode`, `filterBy`, `filterLocale`), lazy children
 * (`leaf: false`, `nodeExpand`, `loadingMode`), checkbox propagation and the slots of the select.
 *
 * `<star-tree-select [nodes]="departments" selectionMode="checkbox" [(value)]="keys" placeholder="Department" />`
 */
@Component({
  selector: 'star-tree-select',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet, StarTree],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarTreeSelect) }],
  host: {
    class: 'star-select star-tree-select',
    '[class.star-select--open]': 'open()',
    '[class.star-select--disabled]': 'disabled()',
    '[class.star-select--invalid]': 'showInvalid()',
  },
  template: `
    <div class="star-select__control" cdkOverlayOrigin #origin="cdkOverlayOrigin">
      <button
        #trigger
        type="button"
        class="star-select__trigger star-tree-select__trigger"
        aria-haspopup="tree"
        [id]="inputId"
        [disabled]="disabled()"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="triggerName()"
        [attr.aria-labelledby]="labelledBy()"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-invalid]="showInvalid() || null"
        (click)="open.set(!open())"
        (keydown.arrowdown)="$event.preventDefault(); open.set(true)"
        (blur)="!open() && touch.emit()"
      >
        @if (chips(); as list) {
          <span class="star-select__chips">
            @for (label of list; track $index) {
              <!-- A space between the chips keeps the visible text equal to the name. -->
              {{ $first ? '' : ' ' }}<span class="star-chip star-chip--sm">{{ label }}</span>
            }
          </span>
        } @else if (summary()) {
          <span class="star-select__value">{{ summary() }}</span>
        } @else {
          <span class="star-select__placeholder">{{
            placeholder() ?? text.selectPlaceholder
          }}</span>
        }
      </button>
      @if (showClear() && value().length && !disabled()) {
        <button
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="text.clear"
          (click)="value.set([])"
        >
          <i class="ph-bold ph-x" aria-hidden="true"></i>
        </button>
      }
      <i class="ph-bold ph-caret-down star-select__caret" aria-hidden="true"></i>
    </div>
    <ng-template
      cdkConnectedOverlay
      cdkConnectedOverlayUsePopover="inline"
      [cdkConnectedOverlayMinWidth]="origin.elementRef.nativeElement.offsetWidth"
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (attach)="panelTree()?.focus()"
      (detach)="close()"
      (overlayOutsideClick)="onOutside($event)"
      (overlayKeydown)="$event.key === 'Escape' && close(true)"
    >
      <div class="star-panel star-tree-select__panel">
        @if (headerSlot(); as header) {
          <ng-container *ngTemplateOutlet="header" />
        }
        <star-tree
          #panelTree
          [nodes]="nodes()"
          [selectionMode]="selectionMode()"
          [(value)]="value"
          [(expanded)]="expanded"
          [filter]="filter()"
          [filterMode]="filterMode()"
          [filterBy]="filterBy()"
          [filterLocale]="filterLocale()"
          [propagateSelectionUp]="propagateSelectionUp()"
          [propagateSelectionDown]="propagateSelectionDown()"
          [loadingMode]="loadingMode()"
          scrollHeight="18rem"
          [virtualScroll]="virtualScroll()"
          [virtualItemSize]="virtualItemSize()"
          [ariaLabel]="ariaLabel() ?? (field?.label() || null)"
          [nodeTemplate]="nodeSlot()"
          [emptyTemplate]="emptySlot()"
          [toggleIconTemplate]="toggleIcon()"
          (nodeSelect)="onNodeSelect($event)"
          (nodeUnselect)="nodeUnselect.emit($event)"
          (nodeExpand)="nodeExpand.emit($event)"
          (nodeCollapse)="nodeCollapse.emit($event)"
        />
        @if (footerSlot(); as footer) {
          <ng-container *ngTemplateOutlet="footer" />
        }
      </div>
    </ng-template>
  `,
})
export class StarTreeSelect implements FormValueControl<readonly string[]> {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly inputId = inject(_IdGenerator).getId('star-tree-select-');
  /**
   * The parent `star-field` when it labels this control. A label `for` a button would click it
   * (and open the panel), so the trigger takes its name with aria-labelledby, and a click on the
   * label only focuses it.
   */
  protected readonly field = injectStarFieldLink(
    () => this.inputId,
    () => this.focus(),
  );
  protected readonly positions = POSITIONS;

  readonly value = model<readonly string[]>([]);
  readonly nodes = input<readonly StarTreeNode[]>([]);
  readonly selectionMode = input<'single' | 'multiple' | 'checkbox'>('single');
  readonly expanded = model<readonly string[]>([]);
  readonly filter = input(false, { transform: booleanAttribute });
  /** Filter mode of the panel tree (PrimeNG `filterMode`, see `star-tree`). */
  readonly filterMode = input<TreeFilterMode>('strict');
  /** Node fields that the filter searches (PrimeNG `filterBy`, see `star-tree`). */
  readonly filterBy = input<string | readonly string[]>('label');
  /** Locale of the filter compare (PrimeNG `filterLocale`). */
  readonly filterLocale = input<string | null>(null);
  /** Checkbox mode: parents follow their children (PrimeNG `propagateSelectionUp`). */
  readonly propagateSelectionUp = input(true, { transform: booleanAttribute });
  /** Checkbox mode: children follow their parent (PrimeNG `propagateSelectionDown`). */
  readonly propagateSelectionDown = input(true, { transform: booleanAttribute });
  /** How a lazy node shows that its children load (see `star-tree`). */
  readonly loadingMode = input<StarTreeLoadingMode>('row');
  /**
   * How the trigger shows a multiple or checkbox value (PrimeNG `display`): `'comma'` (the
   * default) joins the labels, `'chip'` shows a chip per label. Past `maxSelectedLabels` both
   * show the count.
   */
  readonly display = input<'comma' | 'chip'>('comma');
  /** Windowed rendering of the panel tree (see `star-tree`). The panel is 18rem high. */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Row height in pixels in windowed rendering. */
  readonly virtualItemSize = input(34, { transform: numberAttribute });
  readonly showClear = input(false, { transform: booleanAttribute });
  readonly placeholder = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly maxSelectedLabels = input(3);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  /** The user selected a node in the panel (PrimeNG `onNodeSelect`). */
  readonly nodeSelect = output<StarTreeNode>();
  /** The user unselected a node in the panel (PrimeNG `onNodeUnselect`). */
  readonly nodeUnselect = output<StarTreeNode>();
  /** The user opened a node in the panel. For a lazy node, load its children here. */
  readonly nodeExpand = output<StarTreeNodeEvent>();
  /** The user closed a node in the panel. */
  readonly nodeCollapse = output<StarTreeNodeEvent>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly nodeSlot = starSlot<StarNodeContext>(this.slots, this, 'node');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  private readonly iconSlots = starSlotMap<StarToggleIconContext>(this.slots, this, 'icon');
  protected readonly toggleIcon = computed(() => this.iconSlots().get('toggle') ?? null);

  protected readonly open = signal(false);
  protected readonly panelTree = viewChild<StarTree>('panelTree');
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  private readonly labels = computed(() => {
    const map = new Map<string, string>();
    const walk = (nodes: readonly StarTreeNode[]) =>
      nodes.forEach((n) => {
        map.set(n.key, n.label);
        walk(n.children ?? []);
      });
    walk(this.nodes());
    return map;
  });

  protected readonly summary = computed(() => {
    const keys = this.value();
    if (keys.length > this.maxSelectedLabels()) return this.text.selectedItems(keys.length);
    return keys.map((key) => this.labels().get(key) ?? key).join(', ');
  });

  /**
   * Accessible name of the trigger button: the label and the text on the button, so the visible
   * text is part of the name (WCAG 2.5.3). `null` without `ariaLabel`: a `star-field` label then
   * names the button.
   */
  protected readonly triggerName = computed(() => {
    const label = this.ariaLabel();
    if (!label) return null;
    // Chips show the labels without commas: the name follows the visible text (WCAG 2.5.3).
    const shown = this.chips()?.join(' ') ?? this.summary();
    return `${label}: ${shown || (this.placeholder() ?? this.text.selectPlaceholder)}`;
  });

  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );
  /**
   * `aria-labelledby` without `ariaLabel`: the `star-field` label and the button itself, so the
   * name is the label and the text on the button (WCAG 2.5.3).
   */
  protected readonly labelledBy = computed(() => {
    const label = starFieldLabelledBy(this.field, this.ariaLabel());
    return label ? `${label} ${this.inputId}` : null;
  });
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  /** Chip labels of the trigger (`display` chip, multiple or checkbox), or null. */
  protected readonly chips = computed(() => {
    const keys = this.value();
    if (this.display() !== 'chip' || this.selectionMode() === 'single') return null;
    if (!keys.length || keys.length > this.maxSelectedLabels()) return null;
    return keys.map((key) => this.labels().get(key) ?? key);
  });

  protected onNodeSelect(node: StarTreeNode): void {
    this.nodeSelect.emit(node);
    if (this.selectionMode() === 'single') this.close(true);
  }

  protected close(focus = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (focus) this.trigger().nativeElement.focus();
  }

  protected onOutside(event: MouseEvent): void {
    if (this.trigger().nativeElement.contains(event.target as Node)) return;
    this.close();
    this.touch.emit();
  }

  focus(): void {
    this.trigger().nativeElement.focus();
  }
}
