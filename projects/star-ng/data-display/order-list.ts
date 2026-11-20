import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import {
  optionText,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  StarFilterBy,
  starFilterMatchAny,
  StarFilterMatchMode,
  starFilterTexts,
  StarIconContext,
  StarOptionKey,
  starSlot,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  StarItemContext,
  StarListFilterContext,
  StarListFilterEvent,
  StarListItemsEvent,
} from './data-display-slots';

type Direction = 'top' | 'up' | 'down' | 'bottom';

/**
 * Order list (PrimeNG `p-orderlist`): reorder items with buttons, Alt + Arrow keys or (with
 * `dragdrop`) the mouse; the moved item keeps focus and a live region announces its new position.
 * `<star-order-list [(value)]="priorities" optionLabel="name" ariaLabel="Queue order" />`
 *
 * Slots (content children): `starItem` replaces the label of an item (context `$implicit`, `index`,
 * `selected`); `starHeader` the header text; `starListFilter` the filter field; `starEmpty` the
 * empty message (`$implicit` is the filter text, so one template covers PrimeNG `#emptymessage` and
 * `#emptyfiltermessage`); `starIcon="moveUp"` (and `moveTop`, `moveDown`, `moveBottom`) the
 * icons of the buttons. The items are options in a listbox with their own keys, so do not put
 * focusable elements (buttons, links, inputs) in the item template.
 *
 * PrimeNG names that star-ng covers in another way: `listStyle`, `style`, `buttonProps` and the
 * `move*ButtonProps` = `pt` (parts `list`, `moveButton`); `onFocus` and `onBlur` = the native
 * `focusin` and `focusout` events of the host; `onSelectionChange` = `selectionChange` of the
 * `selection` model; `tabindex` and `autoOptionFocus` do not apply (each option is a tab stop of
 * the listbox and takes focus itself); `trackBy` and `dataKey` do not apply (items are compared by
 * identity); `responsive` is deprecated in PrimeNG (the layout stacks with CSS).
 */
@Component({
  selector: 'star-order-list',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarOrderList) }],
  host: {
    class: 'star-order-list',
    '[class.star-order-list--controls-end]': "controlsPosition() === 'end'",
    '[class.star-order-list--disabled]': 'disabled()',
  },
  template: `
    <div
      data-star-part="buttonsPanel"
      class="star-order-list__buttons"
      role="group"
      [attr.aria-label]="text.moveSelectedItem"
    >
      @for (action of actions; track action.id) {
        <button
          data-star-part="moveButton"
          type="button"
          class="star-select__icon-btn star-order-list__btn"
          [attr.aria-label]="action.label"
          [disabled]="disabled() || selected() < 0 || !canMove(action.id)"
          (click)="move(action.id)"
        >
          @if (icons().get(action.slot); as icon) {
            <span data-star-part="moveIcon" class="star-order-list__icon" aria-hidden="true">
              <ng-container *ngTemplateOutlet="icon; context: iconContext" />
            </span>
          } @else {
            <i data-star-part="moveIcon" [class]="action.icon" aria-hidden="true"></i>
          }
        </button>
      }
    </div>
    <div data-star-part="boxPanel" class="star-order-list__box">
      @if (headerSlot() || header()) {
        <div data-star-part="header" class="star-order-list__header" [id]="headerId">
          @if (headerSlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom" />
          } @else {
            {{ header() }}
          }
        </div>
      }
      @if (filter()) {
        <div data-star-part="filterPanel" class="star-order-list__filter">
          @if (filterSlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: filterContext()" />
          } @else {
            <input
              data-star-part="filterInput"
              class="star-input star-input--sm"
              type="search"
              [value]="query()"
              [disabled]="disabled()"
              [attr.placeholder]="filterPlaceholder() ?? text.filterPlaceholder"
              [attr.aria-label]="ariaFilterLabel() ?? text.filterPlaceholder"
              (input)="setQuery($any($event.target).value)"
            />
          }
        </div>
      }
      <div data-star-part="listPanel" class="star-order-list__frame">
        <ul
          data-star-part="list"
          class="star-listbox star-order-list__list"
          role="listbox"
          [class.star-order-list__list--striped]="stripedRows()"
          [style.max-height]="scrollHeight()"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="ariaLabelledBy() ?? (header() || headerSlot() ? headerId : null)"
          [attr.aria-describedby]="hintId"
          [attr.aria-disabled]="disabled() || null"
          (dragover)="onDragOver($event)"
          (drop)="onDrop($event, value().length)"
        >
          @for (entry of visible(); track entry.index) {
            <li
              data-star-part="option"
              role="option"
              class="star-listbox__option"
              [attr.tabindex]="disabled() ? -1 : 0"
              [attr.aria-selected]="selected() === entry.index"
              [attr.draggable]="dragdrop() && !disabled() ? 'true' : null"
              [class.star-listbox__option--selected]="selected() === entry.index"
              [class.star-order-list__option--dragging]="dragging() === entry.index"
              (click)="select(entry.index)"
              (focus)="select(entry.index)"
              (keydown)="onKeydown($event, entry.index)"
              (dragstart)="onDragStart($event, entry.index)"
              (dragend)="dragging.set(-1)"
              (drop)="$event.stopPropagation(); onDrop($event, entry.index)"
            >
              <i
                data-star-part="dragHandle"
                class="ph-bold ph-dots-six-vertical star-order-list__grip"
                aria-hidden="true"
              ></i>
              @if (itemSlot(); as custom) {
                <ng-container
                  *ngTemplateOutlet="custom; context: itemContext(entry.item, entry.index)"
                />
              } @else {
                {{ labelOf(entry.item) }}
              }
            </li>
          }
        </ul>
        <!-- Outside the listbox: a listbox may contain options and groups only. -->
        @if (!visible().length) {
          <div
            data-star-part="emptyPanel"
            class="star-listbox__empty star-order-list__empty"
            role="presentation"
          >
            @if (emptySlot(); as custom) {
              <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
            } @else {
              {{ query() ? text.emptyFilterMessage : text.emptyMessage }}
            }
          </div>
        }
      </div>
    </div>
    <p class="star-sr-only" [id]="hintId">{{ text.orderListHint }}</p>
    <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
})
export class StarOrderList<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly idGen = inject(_IdGenerator);
  protected readonly hintId = this.idGen.getId('star-order-hint-');
  protected readonly headerId = this.idGen.getId('star-order-header-');
  readonly value = model<readonly T[]>([]);
  readonly optionLabel = input<StarOptionKey<T> | null>(null);
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that names the list. Default: the header, when there is one. */
  readonly ariaLabelledBy = input<string | null>(null);
  /**
   * The selected item, as a one-item array (or empty). The order list selects one item at a time.
   * PrimeNG `selection` and `onSelectionChange` (`selectionChange`).
   */
  readonly selection = model<readonly T[]>([]);
  /** Text of the header above the list. PrimeNG `header`. A `starHeader` slot replaces it. */
  readonly header = input<string | null>(null);
  /** Shows a filter field above the list. PrimeNG shows it when `filterBy` is set. */
  readonly filter = input(false, { transform: booleanAttribute });
  /** The fields that the filter searches (one key or several); default: the label. */
  readonly filterBy = input<StarFilterBy<T>>(null);
  /** How the filter text matches. PrimeNG `filterMatchMode`. */
  readonly filterMatchMode = input<StarFilterMatchMode>('contains');
  /** Locale of the case and accent folding of the filter. PrimeNG `filterLocale`. */
  readonly filterLocale = input<string | null>(null);
  /** Placeholder of the filter field (default `STAR_UI_TEXT.filterPlaceholder`). */
  readonly filterPlaceholder = input<string | null>(null);
  /** Accessible name of the filter field (default `STAR_UI_TEXT.filterPlaceholder`). */
  readonly ariaFilterLabel = input<string | null>(null);
  /** Turns off the buttons, the keys, the filter and the drag. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Every second item has a tinted background. */
  readonly stripedRows = input(false, { transform: booleanAttribute });
  /** CSS `max-height` of the list, for example `'20rem'` (default `16rem`). */
  readonly scrollHeight = input<string | null>(null);
  /** Reorder by drag and drop with the mouse, next to the buttons and the keys. */
  readonly dragdrop = input(false, { transform: booleanAttribute });
  /** Side of the move buttons: `'start'` (default) or `'end'`. PrimeNG `controlsPosition`. */
  readonly controlsPosition = input<'start' | 'end'>('start');
  /** Emits the moved item after each move. PrimeNG `onReorder`. */
  readonly reorder = output<StarListItemsEvent<T>>();
  /** Emits the filter text and the matching items. PrimeNG `onFilterEvent`. */
  readonly listFilter = output<StarListFilterEvent<T>>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly itemSlot = starSlot<StarItemContext<T>>(this.slots, this, 'item');
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly filterSlot = starSlot<StarListFilterContext>(this.slots, this, 'listFilter');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  /** The index that the user selected last (the selection model may point elsewhere). */
  private readonly picked = signal(-1);
  /** Index of the selected item, `-1` when none. */
  protected readonly selected = computed(() => {
    const index = this.picked();
    const items = this.value();
    const chosen = this.selection();
    if (!chosen.length) return -1;
    if (index >= 0 && items[index] === chosen[0]) return index;
    return items.indexOf(chosen[0]);
  });
  protected readonly query = signal('');
  protected readonly dragging = signal(-1);
  protected readonly announcement = signal('');
  protected readonly actions = [
    { id: 'top', slot: 'moveTop', label: this.text.moveTop, icon: 'ph-bold ph-caret-double-up' },
    { id: 'up', slot: 'moveUp', label: this.text.moveUp, icon: 'ph-bold ph-caret-up' },
    { id: 'down', slot: 'moveDown', label: this.text.moveDown, icon: 'ph-bold ph-caret-down' },
    {
      id: 'bottom',
      slot: 'moveBottom',
      label: this.text.moveBottom,
      icon: 'ph-bold ph-caret-double-down',
    },
  ] as const;

  /** The items that pass the filter, with their index in `value`. */
  protected readonly visible = computed(() => {
    const query = this.query();
    const items = this.value().map((item, index) => ({ item, index }));
    if (!this.filter() || !query.trim()) return items;
    return items.filter(({ item }) =>
      starFilterMatchAny(
        starFilterTexts(item, this.filterBy(), (option) => this.labelOf(option)),
        query,
        this.filterMatchMode(),
        this.filterLocale(),
      ),
    );
  });

  protected readonly filterContext = computed<StarListFilterContext>(() => ({
    $implicit: this.query(),
    filter: (query: string) => this.setQuery(query),
    reset: () => this.setQuery(''),
  }));
  protected readonly emptyContext = computed<StarEmptyContext>(() => ({ $implicit: this.query() }));

  protected labelOf(item: T): string {
    return optionText(item, this.optionLabel());
  }

  protected itemContext(item: T, index: number): StarItemContext<T> {
    return { $implicit: item, index, selected: this.selected() === index };
  }

  protected select(index: number): void {
    if (this.disabled()) return;
    this.picked.set(index);
    const item = this.value()[index];
    if (this.selection().length !== 1 || this.selection()[0] !== item) this.selection.set([item]);
  }

  protected setQuery(query: string): void {
    this.query.set(query);
    this.listFilter.emit({ query, value: this.visible().map((entry) => entry.item) });
  }

  protected canMove(direction: Direction): boolean {
    const i = this.selected();
    return direction === 'top' || direction === 'up' ? i > 0 : i < this.value().length - 1;
  }

  move(direction: Direction): void {
    const from = this.selected();
    if (this.disabled() || from < 0 || !this.canMove(direction)) return;
    const last = this.value().length - 1;
    this.moveTo(from, { top: 0, up: from - 1, down: from + 1, bottom: last }[direction]);
  }

  /** Moves the item at `from` to the index `to` and selects it there. */
  private moveTo(from: number, to: number): void {
    const items = [...this.value()];
    const [item] = items.splice(from, 1);
    items.splice(to, 0, item);
    this.value.set(items);
    this.picked.set(to);
    this.selection.set([item]);
    this.announcement.set(this.text.itemPosition(this.labelOf(item), to + 1, items.length));
    this.reorder.emit({ items: [item] });
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (this.disabled()) return;
    const list = (event.currentTarget as HTMLElement).parentElement!;
    const focusAt = (position: number) =>
      queueMicrotask(() => (list.children[position] as HTMLElement | undefined)?.focus());
    const positions = this.visible().map((entry) => entry.index);
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      this.select(index);
      this.move(event.key === 'ArrowUp' ? 'up' : 'down');
      focusAt(
        this.visible()
          .map((entry) => entry.index)
          .indexOf(this.selected()),
      );
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      const at = positions.indexOf(index);
      focusAt(Math.min(Math.max(at + (event.key === 'ArrowUp' ? -1 : 1), 0), positions.length - 1));
    }
  }

  protected onDragStart(event: DragEvent, index: number): void {
    if (!this.dragdrop() || this.disabled()) return;
    this.dragging.set(index);
    event.dataTransfer?.setData('text/plain', this.labelOf(this.value()[index]));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(event: DragEvent): void {
    if (this.dragging() >= 0) event.preventDefault();
  }

  /** A drop on an item puts the dragged item at the place of that item; on the list, last. */
  protected onDrop(event: DragEvent, index: number): void {
    const from = this.dragging();
    this.dragging.set(-1);
    if (from < 0) return;
    event.preventDefault();
    const to = Math.min(index, this.value().length - 1);
    if (to !== from) this.moveTo(from, to);
  }
}
