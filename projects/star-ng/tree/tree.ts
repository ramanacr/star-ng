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
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  numberAttribute,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { matchesFilter, STAR_UI_TEXT } from 'star-ng/core';
import {
  checkStates,
  flattenVisible,
  navigationTarget,
  parentsOf,
  rowIndexOf,
  scrollOffsetToReveal,
  stillFocusable,
  subtreeKeys,
  TreeRow,
} from './tree-model';

/** Tree data (PrimeNG `TreeNode`). `key` must be unique in the tree. */
export interface StarTreeNode<T = unknown> {
  readonly key: string;
  readonly label: string;
  readonly icon?: string;
  readonly data?: T;
  readonly children?: readonly StarTreeNode<T>[];
  readonly selectable?: boolean;
  readonly disabled?: boolean;
}

type VisibleNode = TreeRow<StarTreeNode>;

/** Keeps nodes that match the query or have a matching descendant. */
function filterNodes(nodes: readonly StarTreeNode[], query: string): StarTreeNode[] {
  if (!query) return [...nodes];
  return nodes.flatMap((node) => {
    const children = filterNodes(node.children ?? [], query);
    return matchesFilter(node.label, query) || children.length ? [{ ...node, children }] : [];
  });
}

/**
 * Tree (PrimeNG `p-tree`): expand / collapse, single, multiple or checkbox selection (checkbox
 * mode selects whole branches and shows mixed parents), filter, and the WAI-ARIA tree keyboard
 * model (Up / Down, Right opens or enters, Left closes or goes to the parent, Home / End,
 * Enter / Space select, `*` expands siblings).
 *
 * Large trees: `virtualScroll` with `scrollHeight` and `virtualItemSize` renders only the rows in
 * and near the viewport (CDK virtual scrolling). Every row has a fixed height then. Keys, selection
 * and `aria-setsize` / `aria-posinset` work over all open rows, also the ones that are not in the DOM.
 *
 * Value: the selected node keys.
 * `<star-tree [nodes]="departments" selectionMode="checkbox" [(value)]="keys" filter ariaLabel="Departments" />`
 */
@Component({
  selector: 'star-tree',
  imports: [CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-tree' },
  template: `
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
        [attr.aria-expanded]="item.node.children?.length ? isExpanded(item.node) : null"
        [attr.aria-selected]="
          selectionMode() && selectionMode() !== 'checkbox' ? isSelected(item.node) : null
        "
        [attr.aria-checked]="selectionMode() === 'checkbox' ? checkState(item.node) : null"
        [attr.aria-disabled]="item.node.disabled || null"
        [attr.tabindex]="focusKey() === item.node.key ? 0 : -1"
        [class.star-tree__item--selected]="isSelected(item.node)"
        [style.--star-tree-level]="item.level - 1"
        [style.height.px]="showViewport() ? virtualItemSize() : null"
        (click)="onClick(item.node, $event)"
        (keydown)="onKeydown($event, item)"
        (focus)="onRowFocus(item.node.key)"
      >
        @if (item.node.children?.length) {
          <span
            class="star-tree__toggle"
            aria-hidden="true"
            (click)="$event.stopPropagation(); toggle(item.node)"
          >
            <i class="ph-bold ph-caret-right"></i>
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
        <span class="star-tree__label">{{ item.node.label }}</span>
      </li>
    </ng-template>
    @if (showViewport()) {
      <cdk-virtual-scroll-viewport
        #viewport
        class="star-tree__viewport"
        role="tree"
        [itemSize]="virtualItemSize()"
        [attr.aria-label]="ariaLabel()"
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
          <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: item }" />
        </ng-template>
      </cdk-virtual-scroll-viewport>
    } @else {
      <ul
        #tree
        class="star-tree__list"
        role="tree"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-multiselectable]="multiselectable()"
        [style.max-height]="scrollHeight()"
      >
        @for (item of visible(); track item.node.key) {
          <ng-container [ngTemplateOutlet]="row" [ngTemplateOutletContext]="{ $implicit: item }" />
        } @empty {
          <li class="star-listbox__empty" role="presentation">{{ text.emptyFilterMessage }}</li>
        }
      </ul>
    }
  `,
})
export class StarTree implements FormValueControl<readonly string[]> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  readonly value = model<readonly string[]>([]);
  readonly nodes = input<readonly StarTreeNode[]>([]);
  readonly selectionMode = input<'single' | 'multiple' | 'checkbox' | null>(null);
  /** Expanded node keys. */
  readonly expanded = model<readonly string[]>([]);
  readonly filter = input(false, { transform: booleanAttribute });
  /** Maximum height of the tree (a CSS length, for example `16rem`). The tree scrolls inside it. */
  readonly scrollHeight = input<string | null>(null);
  /**
   * Windowed rendering for large trees (CDK virtual scrolling): only the rows in and near the
   * viewport are in the DOM. Needs `scrollHeight`, and every row gets the fixed height
   * `virtualItemSize`. Without `scrollHeight` the tree renders all rows as usual.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Row height in pixels in windowed rendering. Keep it equal to the real height of a row. */
  readonly virtualItemSize = input(34, { transform: numberAttribute });
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  readonly nodeSelect = output<StarTreeNode>();

  protected readonly query = signal('');
  private readonly viewport = viewChild(CdkVirtualScrollViewport);
  private readonly filtered = computed(() => filterNodes(this.nodes(), this.query()));

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

  /** Flattened visible rows; a filter shows every matching branch open. */
  protected readonly visible = computed<VisibleNode[]>(() =>
    flattenVisible(this.filtered(), this.openKeys(), !!this.query()),
  );
  private readonly rowIndex = computed(() => rowIndexOf(this.visible()));

  /** Check state of each node of the (filtered) tree; empty outside checkbox mode. */
  private readonly checkMap = computed(() =>
    this.selectionMode() === 'checkbox'
      ? checkStates(this.filtered(), this.selectedKeys(), (key) => this.isLeaf(key))
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

  isExpanded(node: StarTreeNode): boolean {
    return !!this.query() || this.openKeys().has(node.key);
  }

  toggle(node: StarTreeNode, open = !this.isExpanded(node)): void {
    this.expanded.update((keys) => {
      if (!open) return keys.filter((k) => k !== node.key);
      return keys.includes(node.key) ? keys : [...keys, node.key];
    });
  }

  protected isSelected(node: StarTreeNode): boolean {
    return this.selectedKeys().has(node.key);
  }

  /** Checkbox mode: true, false or 'mixed' from the leaves below. */
  protected checkState(node: StarTreeNode): boolean | 'mixed' {
    const known = this.checkMap().get(node.key);
    if (known !== undefined) return known;
    if (!node.children?.length) return this.isSelected(node);
    return (
      checkStates([node], this.selectedKeys(), (key) => this.isLeaf(key)).get(node.key) ?? false
    );
  }

  select(node: StarTreeNode): void {
    const mode = this.selectionMode();
    if (!mode || this.disabled() || node.disabled || node.selectable === false) return;
    if (mode === 'single') {
      this.value.set([node.key]);
    } else if (mode === 'multiple') {
      this.value.update((keys) =>
        keys.includes(node.key) ? keys.filter((k) => k !== node.key) : [...keys, node.key],
      );
    } else {
      // Checkbox: the whole branch follows the clicked node; parents are derived.
      const branch = subtreeKeys(node);
      const inBranch = new Set(branch);
      const on = this.checkState(node) !== true;
      this.value.update((keys) => {
        const rest = keys.filter((k) => !inBranch.has(k));
        return on ? [...rest, ...branch.filter((key) => this.isLeaf(key))] : rest;
      });
    }
    this.nodeSelect.emit(node);
  }

  protected onClick(node: StarTreeNode, event: MouseEvent): void {
    this.focusKey.set(node.key);
    (event.currentTarget as HTMLElement).focus();
    if (this.selectionMode()) this.select(node);
    else if (node.children?.length) this.toggle(node);
  }

  protected onRowFocus(key: string): void {
    this.focusKey.set(key);
    this.pendingFocus = null;
    this.parked = false;
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
    row.focus({ preventScroll: this.windowed() });
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
    const hasChildren = !!item.node.children?.length;
    const expanded = hasChildren && this.isExpanded(item.node);
    const target = () => navigationTarget(rows, index, event.key, { hasChildren, expanded });
    const handled = () => event.preventDefault();
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        handled();
        return this.focusRow(target());
      case 'ArrowRight':
        handled();
        if (hasChildren && !expanded) this.toggle(item.node, true);
        else this.focusRow(target());
        return;
      case 'ArrowLeft':
        handled();
        if (expanded) this.toggle(item.node, false);
        else this.focusRow(target());
        return;
      case 'Enter':
      case ' ':
        handled();
        if (this.selectionMode()) this.select(item.node);
        else if (hasChildren) this.toggle(item.node);
        return;
      case '*': {
        handled();
        const siblings = rows
          .filter((r) => r.parentKey === item.parentKey && r.node.children?.length)
          .map((r) => r.node.key);
        this.expanded.update((keys) => {
          const open = new Set(keys);
          const added = siblings.filter((key) => !open.has(key));
          return added.length ? [...keys, ...added] : keys;
        });
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
 * `<star-tree-select [nodes]="departments" selectionMode="checkbox" [(value)]="keys" placeholder="Department" />`
 */
@Component({
  selector: 'star-tree-select',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, StarTree],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-select star-tree-select',
    '[class.star-select--open]': 'open()',
    '[class.star-select--disabled]': 'disabled()',
    '[class.star-select--invalid]': 'invalid() && touched()',
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
        [attr.aria-label]="ariaLabel()"
        (click)="open.set(!open())"
        (keydown.arrowdown)="$event.preventDefault(); open.set(true)"
        (blur)="!open() && touch.emit()"
      >
        @if (summary()) {
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
        <star-tree
          #panelTree
          [nodes]="nodes()"
          [selectionMode]="selectionMode()"
          [(value)]="value"
          [(expanded)]="expanded"
          [filter]="filter()"
          scrollHeight="18rem"
          [virtualScroll]="virtualScroll()"
          [virtualItemSize]="virtualItemSize()"
          [ariaLabel]="ariaLabel()"
          (nodeSelect)="selectionMode() === 'single' && close(true)"
        />
      </div>
    </ng-template>
  `,
})
export class StarTreeSelect implements FormValueControl<readonly string[]> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly inputId = inject(_IdGenerator).getId('star-tree-select-');
  protected readonly positions = POSITIONS;

  readonly value = model<readonly string[]>([]);
  readonly nodes = input<readonly StarTreeNode[]>([]);
  readonly selectionMode = input<'single' | 'multiple' | 'checkbox'>('single');
  readonly expanded = model<readonly string[]>([]);
  readonly filter = input(false, { transform: booleanAttribute });
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
