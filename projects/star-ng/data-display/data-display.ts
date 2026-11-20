import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  Directive,
  forwardRef,
  inject,
  input,
  model,
  signal,
  TemplateRef,
} from '@angular/core';
import {
  optionText,
  readOption,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  StarOptionKey,
  StarPart,
  starSlot,
  StarSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarPaginator } from '@star-ng/ui/paginator';
import { StarItemContext } from './data-display-slots';

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
 *
 * Slots (content children): `starHeader` (content above the layout switch), `starFooter`
 * (content below the items and the paginator) and `starEmpty` (replaces the empty message;
 * `$implicit` is `''`, because the data view has no filter). The item template is
 * `starDataViewItem`. Keep interactive content in your own items and in the header and footer
 * slots: the data view has no keyboard model of its own for them.
 */
@Component({
  selector: 'star-data-view',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet, StarPaginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarDataView) }],
  host: { class: 'star-data-view' },
  template: `
    @if (headerSlot(); as header) {
      <ng-container *ngTemplateOutlet="header" />
    }
    <div starPart="header" class="star-data-view__header">
      <ng-content select="[starDataViewHeader]" />
      <div
        starPart="segmented"
        class="star-segmented star-segmented--sm"
        role="radiogroup"
        [attr.aria-label]="text.layout"
      >
        @for (option of layouts; track option.id) {
          <button
            starPart="item"
            type="button"
            role="radio"
            class="star-segmented__item"
            [class.star-segmented__item--on]="layout() === option.id"
            [attr.aria-checked]="layout() === option.id"
            [attr.aria-label]="option.label"
            (click)="layout.set(option.id)"
          >
            <i starPart="icon" [class]="option.icon" aria-hidden="true"></i>
          </button>
        }
      </div>
    </div>
    <ul
      starPart="items"
      class="star-data-view__items"
      [class.star-data-view__items--grid]="layout() === 'grid'"
    >
      @for (item of pageItems(); track $index; let i = $index) {
        <li starPart="item" class="star-data-view__item">
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
        <li starPart="empty" class="star-table__empty">
          <i starPart="icon" class="ph-bold ph-tray" aria-hidden="true"></i>
          @if (emptySlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: emptyContext" />
          } @else {
            {{ emptyMessage() ?? text.noData }}
          }
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
    @if (footerSlot(); as footer) {
      <ng-container *ngTemplateOutlet="footer" />
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

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  /** The data view has no filter, so the empty slot always gets `''`. */
  protected readonly emptyContext: StarEmptyContext = { $implicit: '' };

  protected readonly pageItems = computed(() =>
    this.paginator() ? this.items().slice(this.first(), this.first() + this.rows()) : this.items(),
  );
}

// ---------------------------------------------------------------- Order list and pick list

/**
 * Order list (PrimeNG `p-orderlist`): reorder items with buttons or Alt + Arrow keys; the moved
 * item keeps focus and a live region announces its new position.
 * `<star-order-list [(value)]="priorities" optionLabel="name" ariaLabel="Queue order" />`
 *
 * Slot (content child): `starItem` replaces the label of an item. The context has `$implicit`
 * (the item), `index` and `selected`. The items are options in a listbox with their own keys, so
 * do not put focusable elements (buttons, links, inputs) in the template.
 */
@Component({
  selector: 'star-order-list',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarOrderList) }],
  host: { class: 'star-order-list' },
  template: `
    <div
      starPart="buttons"
      class="star-order-list__buttons"
      role="group"
      [attr.aria-label]="text.moveSelectedItem"
    >
      @for (action of actions; track action.id) {
        <button
          starPart="iconBtn"
          type="button"
          class="star-select__icon-btn star-order-list__btn"
          [attr.aria-label]="action.label"
          [disabled]="selected() < 0 || !canMove(action.id)"
          (click)="move(action.id)"
        >
          <i starPart="icon" [class]="action.icon" aria-hidden="true"></i>
        </button>
      }
    </div>
    <ul
      starPart="list"
      class="star-listbox star-order-list__list"
      role="listbox"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-describedby]="hintId"
    >
      @for (item of value(); track $index; let i = $index) {
        <li
          starPart="option"
          role="option"
          class="star-listbox__option"
          tabindex="0"
          [attr.aria-selected]="selected() === i"
          [class.star-listbox__option--selected]="selected() === i"
          (click)="selected.set(i)"
          (focus)="selected.set(i)"
          (keydown)="onKeydown($event, i)"
        >
          <i
            starPart="grip"
            class="ph-bold ph-dots-six-vertical star-order-list__grip"
            aria-hidden="true"
          ></i>
          @if (itemSlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: itemContext(item, i)" />
          } @else {
            {{ labelOf(item) }}
          }
        </li>
      }
    </ul>
    <p starPart="srText" class="star-sr-only" [id]="hintId">{{ text.orderListHint }}</p>
    <p starPart="srText" class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class StarOrderList<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly hintId = inject(_IdGenerator).getId('star-order-hint-');
  readonly value = model<readonly T[]>([]);
  readonly optionLabel = input<StarOptionKey<T> | null>(null);
  readonly ariaLabel = input<string | null>(null);

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly itemSlot = starSlot<StarItemContext<T>>(this.slots, this, 'item');

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

  protected itemContext(item: T, index: number): StarItemContext<T> {
    return { $implicit: item, index, selected: this.selected() === index };
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
 *
 * Slot (content child): `starItem` replaces the label of an item in both lists. The context has
 * `$implicit` (the item), `index`, `selected` and `list` (`'source'` or `'target'`). The items are
 * options in a listbox with their own keys, so do not put focusable elements (buttons, links,
 * inputs) in the template.
 */
@Component({
  selector: 'star-pick-list',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarPickList) }],
  host: { class: 'star-pick-list' },
  template: `
    @for (side of sides; track side) {
      @let items = side === 'source' ? source() : target();
      <section starPart="side" class="star-pick-list__side" [attr.aria-labelledby]="ids[side]">
        <h3 starPart="header" class="star-pick-list__header" [id]="ids[side]">
          {{
            side === 'source'
              ? (sourceHeader() ?? text.pickListSource)
              : (targetHeader() ?? text.pickListTarget)
          }}
          <span starPart="badge" class="star-badge star-badge--secondary star-badge--sm">{{
            items.length
          }}</span>
        </h3>
        <div starPart="box" class="star-pick-list__box">
          <ul
            starPart="list"
            class="star-listbox star-pick-list__list"
            role="listbox"
            aria-multiselectable="true"
            [attr.aria-labelledby]="ids[side]"
          >
            @for (item of items; track $index; let i = $index) {
              <li
                starPart="option"
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
                @if (itemSlot(); as custom) {
                  <ng-container *ngTemplateOutlet="custom; context: itemContext(side, item, i)" />
                } @else {
                  {{ labelOf(item) }}
                }
              </li>
            }
          </ul>
          <!-- Outside the listbox: a listbox may contain options and groups only. -->
          @if (!items.length) {
            <div
              starPart="empty"
              class="star-listbox__empty star-pick-list__empty"
              role="presentation"
            >
              {{ text.emptyMessage }}
            </div>
          }
        </div>
      </section>
      @if (side === 'source') {
        <div
          starPart="buttons"
          class="star-pick-list__buttons"
          role="group"
          [attr.aria-label]="text.transfer"
        >
          <button
            starPart="iconBtn"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveSelectedToTarget"
            [disabled]="!picked('source').length"
            (click)="transfer('source', picked('source'))"
          >
            <i
              starPart="icon"
              class="ph-bold ph-caret-right star-icon-mirror"
              aria-hidden="true"
            ></i>
          </button>
          <button
            starPart="iconBtn"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveAllToTarget"
            [disabled]="!source().length"
            (click)="transfer('source', source())"
          >
            <i
              starPart="icon"
              class="ph-bold ph-caret-double-right star-icon-mirror"
              aria-hidden="true"
            ></i>
          </button>
          <button
            starPart="iconBtn"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveSelectedToSource"
            [disabled]="!picked('target').length"
            (click)="transfer('target', picked('target'))"
          >
            <i
              starPart="icon"
              class="ph-bold ph-caret-left star-icon-mirror"
              aria-hidden="true"
            ></i>
          </button>
          <button
            starPart="iconBtn"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text.moveAllToSource"
            [disabled]="!target().length"
            (click)="transfer('target', target())"
          >
            <i
              starPart="icon"
              class="ph-bold ph-caret-double-left star-icon-mirror"
              aria-hidden="true"
            ></i>
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

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly itemSlot = starSlot<StarItemContext<T>>(this.slots, this, 'item');

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
  protected itemContext(side: 'source' | 'target', item: T, index: number): StarItemContext<T> {
    return { $implicit: item, index, selected: this.isPicked(side, item), list: side };
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
