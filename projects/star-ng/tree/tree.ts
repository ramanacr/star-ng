import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { matchesFilter, STAR_UI_TEXT } from 'star-ng/core';

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

interface VisibleNode {
  readonly node: StarTreeNode;
  readonly level: number;
  readonly setSize: number;
  readonly position: number;
  readonly parentKey: string | null;
}

/** All keys below a node (including itself). */
function subtreeKeys(node: StarTreeNode): string[] {
  return [node.key, ...(node.children ?? []).flatMap(subtreeKeys)];
}

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
 * Value: the selected node keys.
 * `<star-tree [nodes]="departments" selectionMode="checkbox" [(value)]="keys" filter ariaLabel="Departments" />`
 */
@Component({
  selector: 'star-tree',
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
    <ul
      #tree
      class="star-tree__list"
      role="tree"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-multiselectable]="
        selectionMode() !== 'single' && selectionMode() !== null ? true : null
      "
      [style.max-height]="scrollHeight()"
    >
      @for (item of visible(); track item.node.key) {
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
          (click)="onClick(item.node, $event)"
          (keydown)="onKeydown($event, item)"
          (focus)="focusKey.set(item.node.key)"
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
      } @empty {
        <li class="star-listbox__empty" role="presentation">{{ text.emptyFilterMessage }}</li>
      }
    </ul>
  `,
})
export class StarTree implements FormValueControl<readonly string[]> {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly value = model<readonly string[]>([]);
  readonly nodes = input<readonly StarTreeNode[]>([]);
  readonly selectionMode = input<'single' | 'multiple' | 'checkbox' | null>(null);
  /** Expanded node keys. */
  readonly expanded = model<readonly string[]>([]);
  readonly filter = input(false, { transform: booleanAttribute });
  readonly scrollHeight = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  readonly nodeSelect = output<StarTreeNode>();

  protected readonly query = signal('');
  private readonly tree = viewChild.required<ElementRef<HTMLUListElement>>('tree');
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

  /** Flattened visible rows; a filter shows every matching branch open. */
  protected readonly visible = computed<VisibleNode[]>(() => {
    const rows: VisibleNode[] = [];
    const open = new Set(this.expanded());
    const filtering = !!this.query();
    const walk = (nodes: readonly StarTreeNode[], level: number, parentKey: string | null) =>
      nodes.forEach((node, i) => {
        rows.push({ node, level, setSize: nodes.length, position: i + 1, parentKey });
        if (node.children?.length && (filtering || open.has(node.key)))
          walk(node.children, level + 1, node.key);
      });
    walk(this.filtered(), 1, null);
    return rows;
  });

  protected readonly focusKey = linkedSignal(() => this.visible()[0]?.node.key ?? null);

  isExpanded(node: StarTreeNode): boolean {
    return !!this.query() || this.expanded().includes(node.key);
  }

  toggle(node: StarTreeNode, open = !this.isExpanded(node)): void {
    this.expanded.update((keys) =>
      open ? [...keys, node.key] : keys.filter((k) => k !== node.key),
    );
  }

  protected isSelected(node: StarTreeNode): boolean {
    return this.value().includes(node.key);
  }

  /** Checkbox mode: true, false or 'mixed' from the leaves below. */
  protected checkState(node: StarTreeNode): boolean | 'mixed' {
    if (!node.children?.length) return this.isSelected(node);
    const leaves = subtreeKeys(node).filter((key) => !this.index().get(key)?.children?.length);
    const count = leaves.filter((key) => this.value().includes(key)).length;
    return count === 0 ? false : count === leaves.length ? true : 'mixed';
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
      const on = this.checkState(node) !== true;
      this.value.update((keys) => {
        const rest = keys.filter((k) => !branch.includes(k));
        const leaves = branch.filter((key) => !this.index().get(key)?.children?.length);
        return on ? [...rest, ...leaves] : rest;
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

  private focusRow(key: string | null | undefined): void {
    if (!key) return;
    this.focusKey.set(key);
    queueMicrotask(() =>
      this.tree()
        .nativeElement.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`)
        ?.focus(),
    );
  }

  protected onKeydown(event: KeyboardEvent, item: VisibleNode): void {
    const rows = this.visible();
    const index = rows.findIndex((row) => row.node.key === item.node.key);
    const hasChildren = !!item.node.children?.length;
    const handled = () => event.preventDefault();
    switch (event.key) {
      case 'ArrowDown':
        handled();
        return this.focusRow(rows[index + 1]?.node.key);
      case 'ArrowUp':
        handled();
        return this.focusRow(rows[index - 1]?.node.key);
      case 'Home':
        handled();
        return this.focusRow(rows[0]?.node.key);
      case 'End':
        handled();
        return this.focusRow(rows.at(-1)?.node.key);
      case 'ArrowRight':
        handled();
        if (hasChildren && !this.isExpanded(item.node)) this.toggle(item.node, true);
        else if (hasChildren) this.focusRow(rows[index + 1]?.node.key);
        return;
      case 'ArrowLeft':
        handled();
        if (hasChildren && this.isExpanded(item.node)) this.toggle(item.node, false);
        else this.focusRow(item.parentKey);
        return;
      case 'Enter':
      case ' ':
        handled();
        if (this.selectionMode()) this.select(item.node);
        else if (hasChildren) this.toggle(item.node);
        return;
      case '*':
        handled();
        rows
          .filter((row) => row.parentKey === item.parentKey && row.node.children?.length)
          .forEach((row) => this.toggle(row.node, true));
        return;
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
