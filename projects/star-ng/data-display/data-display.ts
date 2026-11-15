import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterEveryRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  linkedSignal,
  model,
  numberAttribute,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import {
  optionText,
  readOption,
  STAR_UI_TEXT,
  starInlineKey,
  StarOptionKey,
} from '@star-ng/ui/core';
import { StarPaginator } from '@star-ng/ui/paginator';
import {
  flattenVisible,
  navigationTarget,
  parentsOf,
  rowIndexOf,
  StarTreeNode,
  stillFocusable,
  TreeRow,
} from '@star-ng/ui/tree';
import {
  ariaRowCount,
  ariaRowIndex,
  revealRowOffset,
  RowWindow,
  rowWindow,
} from './tree-table-model';

// ---------------------------------------------------------------- Tree table

export interface StarTreeTableColumn {
  readonly field: string;
  readonly header: string;
  readonly width?: string;
  readonly align?: 'start' | 'center' | 'end';
}

type TreeTableNode = StarTreeNode<Record<string, unknown>>;
type TreeTableRow = TreeRow<TreeTableNode>;

/** One rendered row: the row and its `aria-rowindex` (null in the default rendering). */
interface TreeTableEntry {
  readonly row: TreeTableRow;
  readonly aria: number | null;
}

/** Natural height of a tree table row in pixels. */
const TREE_TABLE_ROW_HEIGHT = 53;
/** Rows that render before and after the visible ones in windowed rendering. */
const BUFFER_ROWS = 8;
/** Height of the scroll area before it is measured (the first window of windowed rendering). */
const FALLBACK_VIEWPORT = 600;

/**
 * Tree table (PrimeNG `p-treetable`): hierarchical rows with expand / collapse in a table,
 * `role="treegrid"`, Right / Left on a row expand / collapse, Up / Down, Home and End move between
 * rows. Node `data` holds the column values; the first column shows the tree toggle.
 *
 * Large tables: `virtualScroll` with `scrollHeight` and `virtualItemSize` renders only the rows in
 * and near the viewport. It is still one `<table>`: a spacer row above and one below the rendered
 * rows stand for the others, the header is sticky, and every row has the fixed height
 * `virtualItemSize`. Keys, `aria-rowcount`, `aria-rowindex`, `aria-level`, `aria-setsize` and
 * `aria-posinset` work over all open rows, also the ones that are not in the DOM.
 *
 * `<star-tree-table [nodes]="budget" [columns]="cols" [(expanded)]="open" ariaLabel="Budget" />`
 */
@Component({
  selector: 'star-tree-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-table star-tree-table',
    '[class.star-table--sticky]': '!!scrollHeight()',
    '[class.star-table--virtual]': 'windowed()',
    '[style.--star-table-row-height.px]': 'windowed() ? virtualItemSize() : null',
  },
  template: `
    <div
      #scroller
      class="star-table__scroll"
      [attr.role]="windowed() ? 'group' : null"
      [attr.aria-label]="windowed() ? ariaLabel() : null"
      [attr.tabindex]="windowed() ? (activeRendered() ? -1 : 0) : null"
      [style.max-height]="scrollHeight()"
      (scroll)="syncScroll()"
      (focus)="onScrollerFocus()"
      (blur)="parked = false"
      (keydown)="onScrollerKeydown($event)"
    >
      <table
        role="treegrid"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-rowcount]="windowed() ? ariaRowCount(rows().length) : null"
      >
        <thead #header>
          <tr [attr.aria-rowindex]="windowed() ? 1 : null">
            @for (column of columns(); track column.field) {
              <th
                scope="col"
                [style.width]="column.width"
                [class]="'star-table__th star-table__cell--' + (column.align ?? 'start')"
              >
                {{ column.header }}
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (window().before > 0) {
            <tr class="star-table__spacer" aria-hidden="true">
              <td [attr.colspan]="columns().length" [style.height.px]="window().before"></td>
            </tr>
          }
          @for (entry of entries(); track entry.row.node.key) {
            @let row = entry.row;
            <tr
              class="star-table__row"
              [attr.aria-rowindex]="entry.aria"
              [attr.aria-level]="row.level"
              [attr.aria-setsize]="row.setSize"
              [attr.aria-posinset]="row.position"
              [attr.aria-expanded]="row.node.children?.length ? isOpen(row.node.key) : null"
              [attr.tabindex]="focusKey() === row.node.key ? 0 : -1"
              [attr.data-key]="row.node.key"
              (keydown)="onKeydown($event, row)"
              (focusin)="onRowFocus($event, row.node.key)"
            >
              @for (column of columns(); track column.field; let first = $first) {
                <td [class]="'star-table__cell--' + (column.align ?? 'start')">
                  @if (first) {
                    <span class="star-tree-table__first" [style.--star-tree-level]="row.level - 1">
                      @if (row.node.children?.length) {
                        <button
                          type="button"
                          class="star-tree__toggle star-tree-table__toggle"
                          tabindex="-1"
                          [attr.aria-label]="
                            isOpen(row.node.key)
                              ? text.collapseItem(row.node.label)
                              : text.expandItem(row.node.label)
                          "
                          (click)="toggle(row.node.key)"
                        >
                          <i class="ph-bold ph-caret-right" aria-hidden="true"></i>
                        </button>
                      } @else {
                        <span class="star-tree__toggle star-tree__toggle--leaf"></span>
                      }
                      {{ row.node.data?.[column.field] ?? row.node.label }}
                    </span>
                  } @else {
                    {{ row.node.data?.[column.field] }}
                  }
                </td>
              }
            </tr>
          }
          @if (window().after > 0) {
            <tr class="star-table__spacer" aria-hidden="true">
              <td [attr.colspan]="columns().length" [style.height.px]="window().after"></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class StarTreeTable {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly doc = inject(DOCUMENT);
  readonly nodes = input<readonly TreeTableNode[]>([]);
  readonly columns = input.required<readonly StarTreeTableColumn[]>();
  readonly expanded = model<readonly string[]>([]);
  readonly ariaLabel = input<string | null>(null);
  /**
   * Maximum height of the table (a CSS length, for example `20rem`). The table scrolls inside it
   * and the header stays at the top.
   */
  readonly scrollHeight = input<string | null>(null);
  /**
   * Windowed rendering for large tables: only the rows in and near the viewport are in the DOM.
   * Needs `scrollHeight`, and every row gets the fixed height `virtualItemSize` with its text on
   * one line. Without `scrollHeight` the table renders all rows as usual.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /**
   * Row height in pixels in windowed rendering. The default is the natural height of a row of
   * this table.
   */
  readonly virtualItemSize = input(TREE_TABLE_ROW_HEIGHT, { transform: numberAttribute });

  private readonly scroller = viewChild<ElementRef<HTMLElement>>('scroller');
  private readonly header = viewChild<ElementRef<HTMLElement>>('header');

  private readonly openKeys = computed(() => new Set(this.expanded()));
  private readonly parents = computed(() => parentsOf(this.nodes()));
  /** The rows whose parents are open, in order. The sibling numbers come from the data. */
  protected readonly rows = computed<TreeTableRow[]>(() =>
    flattenVisible(this.nodes(), this.openKeys()),
  );
  private readonly rowIndex = computed(() => rowIndexOf(this.rows()));

  /**
   * The active row (the one with `tabindex` 0). It stays a row after the rows change, and it is
   * kept in state, not read from the DOM: in windowed rendering its element may not exist.
   */
  protected readonly focusKey = linkedSignal<readonly TreeTableRow[], string | null>({
    source: this.rows,
    computation: (rows, previous) =>
      stillFocusable(previous?.value, this.rowIndex(), this.parents(), rows[0]?.node.key ?? null),
  });

  // ---- windowed rendering ----
  protected readonly windowed = computed(
    () => this.virtualScroll() && !!this.scrollHeight() && this.virtualItemSize() > 0,
  );
  private readonly scrollTop = signal(0);
  private readonly viewportHeight = signal(0);
  /** The rows that are in the DOM. Without windowed rendering: all of them. */
  protected readonly window = computed<RowWindow>(
    () => {
      if (!this.windowed()) return { start: 0, end: this.rows().length, before: 0, after: 0 };
      return rowWindow(
        this.rows().length,
        this.virtualItemSize(),
        this.scrollTop(),
        this.viewportHeight() || FALLBACK_VIEWPORT,
        BUFFER_ROWS,
      );
    },
    // A scroll of a few pixels does not change the window: skip the work after it.
    {
      equal: (a, b) =>
        a.start === b.start && a.end === b.end && a.before === b.before && a.after === b.after,
    },
  );
  protected readonly entries = computed<TreeTableEntry[]>(() => {
    const rows = this.rows();
    if (!this.windowed()) return rows.map((row) => ({ row, aria: null }));
    const { start, end } = this.window();
    return rows.slice(start, end).map((row, i) => ({ row, aria: ariaRowIndex(start + i) }));
  });
  /** The active row is in the DOM. If it is not, the scroll area takes the Tab stop. */
  protected readonly activeRendered = computed(() => {
    const index = this.rowIndex().get(this.focusKey() ?? '');
    const { start, end } = this.window();
    return index !== undefined && index >= start && index < end;
  });
  protected readonly ariaRowCount = ariaRowCount;
  /** Row to focus as soon as its element exists (it may need scrolling in first). */
  private pendingFocus: string | null = null;
  /** The focus waits on the scroll area because the focused row left the DOM. */
  protected parked = false;

  constructor() {
    // The rows or the window change (a scroll, a branch closes, new nodes) and the focused row
    // may leave the DOM. This effect runs before the template updates, while the row is still there.
    effect(() => {
      const window = this.window();
      this.rowIndex();
      untracked(() => {
        if (this.windowed()) this.parkFocus(window);
      });
    });
    // The scroll area changes its height with the rows (up to `scrollHeight`) and with the page.
    effect((onCleanup) => {
      const scroller = this.scroller()?.nativeElement;
      if (!this.windowed() || !scroller || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => this.syncScroll());
      observer.observe(scroller);
      onCleanup(() => observer.disconnect());
    });
    afterEveryRender({ read: () => this.syncScroll() });
    afterEveryRender(() => {
      this.applyPendingFocus();
      if (this.parked) this.restoreParkedFocus();
    });
    if (isDevMode()) {
      effect(() => {
        if (this.virtualScroll() && !this.scrollHeight()) {
          console.warn(
            'star-tree-table: virtualScroll needs scrollHeight. Without it the table renders all rows.',
          );
        }
      });
    }
  }

  protected isOpen(key: string): boolean {
    return this.openKeys().has(key);
  }

  toggle(key: string, open = !this.isOpen(key)): void {
    this.expanded.update((keys) => {
      if (!open) return keys.filter((k) => k !== key);
      return keys.includes(key) ? keys : [...keys, key];
    });
  }

  /** Reads the scroll position and the height of the scroll area (windowed rendering). */
  protected syncScroll(): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller || !this.windowed()) return;
    this.scrollTop.set(scroller.scrollTop);
    if (scroller.clientHeight) this.viewportHeight.set(scroller.clientHeight);
  }

  protected onRowFocus(event: FocusEvent, key: string): void {
    this.focusKey.set(key);
    this.pendingFocus = null;
    this.parked = false;
    // A row that the keyboard or a click focuses may sit under the sticky header.
    if (event.target === event.currentTarget && this.windowed()) this.revealRow(key);
  }

  /**
   * Moves the focus to a row. The row becomes the active row at once. In windowed rendering the
   * row is scrolled into the window first, and the focus is applied after its element renders.
   */
  private focusRow(key: string | null | undefined): void {
    if (!key) return;
    this.focusKey.set(key);
    this.pendingFocus = key;
    if (this.windowed()) this.revealRow(key);
    queueMicrotask(() => this.applyPendingFocus());
  }

  /** Scrolls a row fully into view, below the sticky header, with the least movement. */
  private revealRow(key: string): void {
    const scroller = this.scroller()?.nativeElement;
    const index = this.rowIndex().get(key);
    if (!scroller || index === undefined) return;
    const offset = revealRowOffset(
      index,
      this.virtualItemSize(),
      scroller.scrollTop,
      scroller.clientHeight,
      this.header()?.nativeElement.offsetHeight ?? 0,
    );
    if (offset === null) return;
    scroller.scrollTop = offset;
    this.syncScroll();
  }

  private rowElement(key: string): HTMLElement | null {
    return (
      this.scroller()?.nativeElement.querySelector<HTMLElement>(
        `tbody > tr[data-key="${CSS.escape(key)}"]`,
      ) ?? null
    );
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
   * the focused row leaves the window, the focus moves to the scroll area; the keys still work
   * there, and the focus returns to the row when it renders again.
   */
  private parkFocus(window: RowWindow): void {
    const scroller = this.scroller()?.nativeElement;
    const active = this.doc.activeElement;
    if (!scroller || !active || active === scroller || !scroller.contains(active)) return;
    const key = active.closest<HTMLElement>('tbody > tr[data-key]')?.dataset['key'];
    const index = key === undefined ? undefined : this.rowIndex().get(key);
    if (index !== undefined && index >= window.start && index < window.end) return;
    this.parked = true;
    scroller.focus({ preventScroll: true });
  }

  private restoreParkedFocus(): void {
    const scroller = this.scroller()?.nativeElement;
    if (!scroller || this.doc.activeElement !== scroller) {
      this.parked = false;
      return;
    }
    const key = this.focusKey();
    if (key === null) return;
    this.rowElement(key)?.focus({ preventScroll: true });
  }

  /** Tab into the scroll area (no row has the Tab stop): the focus goes to the active row. */
  protected onScrollerFocus(): void {
    if (this.windowed() && !this.parked) this.focusRow(this.focusKey());
  }

  /** Keys on the scroll area itself (the focus is parked there): they act on the active row. */
  protected onScrollerKeydown(event: KeyboardEvent): void {
    if (!this.windowed() || event.target !== event.currentTarget) return;
    const row = this.rows()[this.rowIndex().get(this.focusKey() ?? '') ?? -1];
    if (row) this.onKeydown(event, row);
  }

  protected onKeydown(event: KeyboardEvent, row: TreeTableRow): void {
    const rows = this.rows();
    // A key that arrives before the last move has rendered (a held key, a far scroll) continues
    // from the row that the last move aimed at, not from the row that still has the DOM focus.
    const item =
      this.pendingFocus === null
        ? row
        : (rows[this.rowIndex().get(this.pendingFocus) ?? -1] ?? row);
    const index = this.rowIndex().get(item.node.key) ?? -1;
    const hasChildren = !!item.node.children?.length;
    const expanded = hasChildren && this.isOpen(item.node.key);
    // Arrow right opens a branch and Arrow left closes it; the two swap in right-to-left.
    const key = starInlineKey(event);
    const move = (target: string | null) => {
      if (target === null) return;
      event.preventDefault();
      this.focusRow(target);
    };
    switch (key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'Home':
      case 'End':
        return move(navigationTarget(rows, index, key, { hasChildren, expanded }));
      case 'ArrowRight':
        if (hasChildren) {
          event.preventDefault();
          if (!expanded) this.toggle(item.node.key, true);
        }
        return;
      case 'ArrowLeft':
        event.preventDefault();
        if (expanded) this.toggle(item.node.key, false);
        else move(item.parentKey);
        return;
    }
  }
}

// ---------------------------------------------------------------- Data view

/** Item template: `<ng-template starDataViewItem let-item let-layout="layout">`. */
@Directive({ selector: 'ng-template[starDataViewItem]' })
export class StarDataViewItem<T = unknown> {
  readonly starDataViewItemOf = input<readonly T[] | null>(null);
  readonly template =
    inject<TemplateRef<{ $implicit: T; layout: 'list' | 'grid'; index: number }>>(TemplateRef);
  static ngTemplateContextGuard<T>(
    _dir: StarDataViewItem<T>,
    _ctx: unknown,
  ): _ctx is { $implicit: T; layout: 'list' | 'grid'; index: number } {
    return true;
  }
}

/**
 * Data view (PrimeNG `p-dataview`): items in a list or a responsive grid, layout switch,
 * client pagination and an empty state. It does not sort: sort the items before you pass them in.
 * You design each item with a template.
 *
 * ```html
 * <star-data-view [items]="products" [(layout)]="layout" paginator [rows]="6">
 *   <ng-template starDataViewItem let-p let-layout="layout">…</ng-template>
 * </star-data-view>
 * ```
 */
@Component({
  selector: 'star-data-view',
  imports: [NgTemplateOutlet, StarPaginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-data-view' },
  template: `
    <div class="star-data-view__header">
      <ng-content select="[starDataViewHeader]" />
      <div
        class="star-segmented star-segmented--sm"
        role="radiogroup"
        [attr.aria-label]="text.layout"
      >
        @for (option of layouts; track option.id) {
          <button
            type="button"
            role="radio"
            class="star-segmented__item"
            [class.star-segmented__item--on]="layout() === option.id"
            [attr.aria-checked]="layout() === option.id"
            [attr.aria-label]="option.label"
            (click)="layout.set(option.id)"
          >
            <i [class]="option.icon" aria-hidden="true"></i>
          </button>
        }
      </div>
    </div>
    <ul class="star-data-view__items" [class.star-data-view__items--grid]="layout() === 'grid'">
      @for (item of pageItems(); track $index; let i = $index) {
        <li class="star-data-view__item">
          @if (itemTemplate(); as custom) {
            <ng-container
              *ngTemplateOutlet="
                custom.template;
                context: { $implicit: item, layout: layout(), index: i }
              "
            />
          }
        </li>
      } @empty {
        <li class="star-table__empty">
          <i class="ph-bold ph-tray" aria-hidden="true"></i>
          {{ emptyMessage() ?? text.noData }}
        </li>
      }
    </ul>
    @if (paginator() && items().length > rows()) {
      <star-paginator
        [totalRecords]="items().length"
        [(first)]="first"
        [(rows)]="rows"
        [rowsPerPageOptions]="[]"
      />
    }
  `,
})
export class StarDataView<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly layouts = [
    { id: 'list' as const, label: this.text.layoutList, icon: 'ph-bold ph-list' },
    { id: 'grid' as const, label: this.text.layoutGrid, icon: 'ph-bold ph-squares-four' },
  ];
  readonly items = input<readonly T[]>([]);
  readonly layout = model<'list' | 'grid'>('list');
  readonly paginator = input(false, { transform: booleanAttribute });
  readonly rows = model(6);
  readonly first = model(0);
  readonly emptyMessage = input<string | null>(null);
  protected readonly itemTemplate = contentChild(StarDataViewItem);

  protected readonly pageItems = computed(() =>
    this.paginator() ? this.items().slice(this.first(), this.first() + this.rows()) : this.items(),
  );
}

// ---------------------------------------------------------------- Order list and pick list

/**
 * Order list (PrimeNG `p-orderlist`): reorder items with buttons or Alt + Arrow keys; the moved
 * item keeps focus and a live region announces its new position.
 * `<star-order-list [(value)]="priorities" optionLabel="name" ariaLabel="Queue order" />`
 */
@Component({
  selector: 'star-order-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-order-list' },
  template: `
    <div class="star-order-list__buttons" role="group" [attr.aria-label]="text.moveSelectedItem">
      @for (action of actions; track action.id) {
        <button
          type="button"
          class="star-select__icon-btn star-order-list__btn"
          [attr.aria-label]="action.label"
          [disabled]="selected() < 0 || !canMove(action.id)"
          (click)="move(action.id)"
        >
          <i [class]="action.icon" aria-hidden="true"></i>
        </button>
      }
    </div>
    <ul
      class="star-listbox star-order-list__list"
      role="listbox"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-describedby]="hintId"
    >
      @for (item of value(); track $index; let i = $index) {
        <li
          role="option"
          class="star-listbox__option"
          tabindex="0"
          [attr.aria-selected]="selected() === i"
          [class.star-listbox__option--selected]="selected() === i"
          (click)="selected.set(i)"
          (focus)="selected.set(i)"
          (keydown)="onKeydown($event, i)"
        >
          <i class="ph-bold ph-dots-six-vertical star-order-list__grip" aria-hidden="true"></i>
          {{ labelOf(item) }}
        </li>
      }
    </ul>
    <p class="star-sr-only" [id]="hintId">{{ text.orderListHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class StarOrderList<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly hintId = inject(_IdGenerator).getId('star-order-hint-');
  readonly value = model<readonly T[]>([]);
  readonly optionLabel = input<StarOptionKey<T> | null>(null);
  readonly ariaLabel = input<string | null>(null);

  protected readonly selected = signal(-1);
  protected readonly announcement = signal('');
  protected readonly actions = [
    { id: 'top' as const, label: this.text.moveTop, icon: 'ph-bold ph-caret-double-up' },
    { id: 'up' as const, label: this.text.moveUp, icon: 'ph-bold ph-caret-up' },
    { id: 'down' as const, label: this.text.moveDown, icon: 'ph-bold ph-caret-down' },
    { id: 'bottom' as const, label: this.text.moveBottom, icon: 'ph-bold ph-caret-double-down' },
  ];

  protected labelOf(item: T): string {
    return optionText(item, this.optionLabel());
  }

  protected canMove(direction: 'top' | 'up' | 'down' | 'bottom'): boolean {
    const i = this.selected();
    return direction === 'top' || direction === 'up' ? i > 0 : i < this.value().length - 1;
  }

  move(direction: 'top' | 'up' | 'down' | 'bottom'): void {
    const from = this.selected();
    if (from < 0 || !this.canMove(direction)) return;
    const last = this.value().length - 1;
    const to = { top: 0, up: from - 1, down: from + 1, bottom: last }[direction];
    const items = [...this.value()];
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    this.value.set(items);
    this.selected.set(to);
    this.announcement.set(this.text.itemPosition(this.labelOf(item), to + 1, items.length));
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const list = (event.currentTarget as HTMLElement).parentElement!;
    const focusAt = (i: number) =>
      queueMicrotask(() => (list.children[i] as HTMLElement | undefined)?.focus());
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.selected.set(index);
      this.move(event.key === 'ArrowUp' ? 'up' : 'down');
      focusAt(this.selected());
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusAt(
        Math.min(Math.max(index + (event.key === 'ArrowUp' ? -1 : 1), 0), this.value().length - 1),
      );
    }
  }
}

/**
 * Pick list (PrimeNG `p-picklist`): move items between a source and a target list.
 * Double-click or Enter moves one item; buttons move the selection or everything.
 * `<star-pick-list [(source)]="available" [(target)]="assigned" optionLabel="name" sourceHeader="Available" targetHeader="Assigned" />`
 */
@Component({
  selector: 'star-pick-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-pick-list' },
  template: `
    @for (side of sides; track side) {
      @let items = side === 'source' ? source() : target();
      <section class="star-pick-list__side" [attr.aria-labelledby]="ids[side]">
        <h3 class="star-pick-list__header" [id]="ids[side]">
          {{
            side === 'source'
              ? (sourceHeader() ?? text.pickListSource)
              : (targetHeader() ?? text.pickListTarget)
          }}
          <span class="star-badge star-badge--secondary star-badge--sm">{{ items.length }}</span>
        </h3>
        <div class="star-pick-list__box">
          <ul
            class="star-listbox star-pick-list__list"
            role="listbox"
            aria-multiselectable="true"
            [attr.aria-labelledby]="ids[side]"
          >
            @for (item of items; track $index; let i = $index) {
              <li
                role="option"
                class="star-listbox__option"
                tabindex="0"
                [attr.aria-selected]="isPicked(side, item)"
                [class.star-listbox__option--selected]="isPicked(side, item)"
                (click)="pick(side, item)"
                (dblclick)="transfer(side, [item])"
                (keydown.enter)="transfer(side, [item])"
                (keydown.space)="$event.preventDefault(); pick(side, item)"
              >
                {{ labelOf(item) }}
              </li>
            }
          </ul>
          <!-- Outside the listbox: a listbox may contain options and groups only. -->
          @if (!items.length) {
            <div class="star-listbox__empty star-pick-list__empty" role="presentation">
              {{ text.emptyMessage }}
            </div>
          }
        </div>
      </section>
      @if (side === 'source') {
        <div class="star-pick-list__buttons" role="group" [attr.aria-label]="text.transfer">
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveSelectedToTarget"
            [disabled]="!picked('source').length"
            (click)="transfer('source', picked('source'))"
          >
            <i class="ph-bold ph-caret-right star-icon-mirror" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveAllToTarget"
            [disabled]="!source().length"
            (click)="transfer('source', source())"
          >
            <i class="ph-bold ph-caret-double-right star-icon-mirror" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveSelectedToSource"
            [disabled]="!picked('target').length"
            (click)="transfer('target', picked('target'))"
          >
            <i class="ph-bold ph-caret-left star-icon-mirror" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveAllToSource"
            [disabled]="!target().length"
            (click)="transfer('target', target())"
          >
            <i class="ph-bold ph-caret-double-left star-icon-mirror" aria-hidden="true"></i>
          </button>
        </div>
      }
    }
  `,
})
export class StarPickList<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly idGen = inject(_IdGenerator);
  protected readonly ids = {
    source: this.idGen.getId('star-pick-src-'),
    target: this.idGen.getId('star-pick-tgt-'),
  };
  protected readonly sides = ['source', 'target'] as const;

  readonly source = model<readonly T[]>([]);
  readonly target = model<readonly T[]>([]);
  readonly optionLabel = input<StarOptionKey<T> | null>(null);
  readonly sourceHeader = input<string | null>(null);
  readonly targetHeader = input<string | null>(null);

  private readonly selection = signal<{ source: readonly T[]; target: readonly T[] }>({
    source: [],
    target: [],
  });

  protected labelOf(item: T): string {
    return optionText(item, this.optionLabel());
  }
  protected picked(side: 'source' | 'target'): readonly T[] {
    return this.selection()[side];
  }
  protected isPicked(side: 'source' | 'target', item: T): boolean {
    return this.selection()[side].includes(item);
  }
  protected pick(side: 'source' | 'target', item: T): void {
    this.selection.update((sel) => ({
      ...sel,
      [side]: sel[side].includes(item) ? sel[side].filter((i) => i !== item) : [...sel[side], item],
    }));
  }

  transfer(from: 'source' | 'target', items: readonly T[]): void {
    if (!items.length) return;
    const moving = new Set(items);
    const [fromModel, toModel] =
      from === 'source' ? [this.source, this.target] : [this.target, this.source];
    fromModel.update((list) => list.filter((item) => !moving.has(item)));
    toModel.update((list) => [...list, ...items]);
    this.selection.update((sel) => ({ ...sel, [from]: [] }));
  }

  /** Reads a value with an optional key (exposed for custom templates). */
  read(item: T, key: StarOptionKey<T>): unknown {
    return readOption(item, key);
  }
}
