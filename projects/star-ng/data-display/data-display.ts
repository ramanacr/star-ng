import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  Directive,
  inject,
  input,
  model,
  signal,
  TemplateRef,
} from '@angular/core';
import { optionText, readOption, STAR_UI_TEXT, StarOptionKey } from 'star-ng/core';
import { StarPaginator } from 'star-ng/paginator';
import { StarTreeNode } from 'star-ng/tree';

// ---------------------------------------------------------------- Tree table

export interface StarTreeTableColumn {
  readonly field: string;
  readonly header: string;
  readonly width?: string;
  readonly align?: 'start' | 'center' | 'end';
}

interface TreeRow {
  readonly node: StarTreeNode<Record<string, unknown>>;
  readonly level: number;
  readonly setSize: number;
  readonly position: number;
}

/**
 * Tree table (PrimeNG `p-treetable`): hierarchical rows with expand / collapse in a table,
 * `role="treegrid"`, Right / Left on a row expand / collapse, Up / Down move between rows.
 * Node `data` holds the column values; the first column shows the tree toggle.
 *
 * `<star-tree-table [nodes]="budget" [columns]="cols" [(expanded)]="open" ariaLabel="Budget" />`
 */
@Component({
  selector: 'star-tree-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-table star-tree-table' },
  template: `
    <div class="star-table__scroll">
      <table role="treegrid" [attr.aria-label]="ariaLabel()">
        <thead>
          <tr>
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
          @for (row of rows(); track row.node.key) {
            <tr
              class="star-table__row"
              [attr.aria-level]="row.level"
              [attr.aria-setsize]="row.setSize"
              [attr.aria-posinset]="row.position"
              [attr.aria-expanded]="row.node.children?.length ? isOpen(row.node.key) : null"
              [attr.tabindex]="focusKey() === row.node.key ? 0 : -1"
              [attr.data-key]="row.node.key"
              (keydown)="onKeydown($event, row)"
              (focus)="focusKey.set(row.node.key)"
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
        </tbody>
      </table>
    </div>
  `,
})
export class StarTreeTable {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly nodes = input<readonly StarTreeNode<Record<string, unknown>>[]>([]);
  readonly columns = input.required<readonly StarTreeTableColumn[]>();
  readonly expanded = model<readonly string[]>([]);
  readonly ariaLabel = input<string | null>(null);

  protected readonly rows = computed<TreeRow[]>(() => {
    const rows: TreeRow[] = [];
    const open = new Set(this.expanded());
    const walk = (nodes: readonly StarTreeNode<Record<string, unknown>>[], level: number) =>
      nodes.forEach((node, i) => {
        rows.push({ node, level, setSize: nodes.length, position: i + 1 });
        if (node.children?.length && open.has(node.key)) {
          walk(node.children as readonly StarTreeNode<Record<string, unknown>>[], level + 1);
        }
      });
    walk(this.nodes(), 1);
    return rows;
  });
  protected readonly focusKey = signal<string | null>(null);

  protected isOpen(key: string): boolean {
    return this.expanded().includes(key);
  }

  toggle(key: string, open = !this.isOpen(key)): void {
    this.expanded.update((keys) => (open ? [...keys, key] : keys.filter((k) => k !== key)));
  }

  protected onKeydown(event: KeyboardEvent, row: TreeRow): void {
    const rows = this.rows();
    const index = rows.indexOf(row);
    const focus = (target: TreeRow | undefined) => {
      if (!target) return;
      event.preventDefault();
      this.focusKey.set(target.node.key);
      const tr = (event.currentTarget as HTMLElement)
        .closest('tbody')
        ?.querySelector<HTMLElement>(`[data-key="${CSS.escape(target.node.key)}"]`);
      tr?.focus();
    };
    if (event.key === 'ArrowDown') focus(rows[index + 1]);
    else if (event.key === 'ArrowUp') focus(rows[index - 1]);
    else if (event.key === 'ArrowRight' && row.node.children?.length) {
      event.preventDefault();
      this.toggle(row.node.key, true);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      if (row.node.children?.length && this.isOpen(row.node.key)) this.toggle(row.node.key, false);
      else focus([...rows.slice(0, index)].reverse().find((r) => r.level < row.level));
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
        <h4 class="star-pick-list__header" [id]="ids[side]">
          {{
            side === 'source'
              ? (sourceHeader() ?? text.pickListSource)
              : (targetHeader() ?? text.pickListTarget)
          }}
          <span class="star-badge star-badge--secondary star-badge--sm">{{ items.length }}</span>
        </h4>
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
          } @empty {
            <li class="star-listbox__empty" role="presentation">{{ text.emptyMessage }}</li>
          }
        </ul>
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
            <i class="ph-bold ph-caret-right" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveAllToTarget"
            [disabled]="!source().length"
            (click)="transfer('source', source())"
          >
            <i class="ph-bold ph-caret-double-right" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveSelectedToSource"
            [disabled]="!picked('target').length"
            (click)="transfer('target', picked('target'))"
          >
            <i class="ph-bold ph-caret-left" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveAllToSource"
            [disabled]="!target().length"
            (click)="transfer('target', target())"
          >
            <i class="ph-bold ph-caret-double-left" aria-hidden="true"></i>
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
