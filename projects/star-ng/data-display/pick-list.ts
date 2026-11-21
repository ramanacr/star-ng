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
  readOption,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarAnnouncer,
  StarEmptyContext,
  StarFilterBy,
  starFilterMatchAny,
  StarFilterMatchMode,
  starFilterTexts,
  StarIconContext,
  StarIconSlotName,
  StarOptionKey,
  starSlot,
  StarSlot,
  starSlotMap,
  StarStyled,
  starViewportWidth,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  StarItemContext,
  StarListFilterContext,
  StarListFilterEvent,
  StarListItemsEvent,
  StarPickListHeaderContext,
  StarPickListSide,
} from './data-display-slots';

type Direction = 'top' | 'up' | 'down' | 'bottom';

/** The reorder buttons of one list. */
const REORDER: readonly { id: Direction; slot: StarIconSlotName; icon: string }[] = [
  { id: 'top', slot: 'moveTop', icon: 'ph-bold ph-caret-double-up' },
  { id: 'up', slot: 'moveUp', icon: 'ph-bold ph-caret-up' },
  { id: 'down', slot: 'moveDown', icon: 'ph-bold ph-caret-down' },
  { id: 'bottom', slot: 'moveBottom', icon: 'ph-bold ph-caret-double-down' },
];

/**
 * `items` with the `picked` ones moved one step or to an end, as a block that keeps its order.
 * @internal
 */
export function ɵstarReorderPicked<T>(
  items: readonly T[],
  picked: readonly T[],
  direction: Direction,
): T[] {
  const on = new Set(picked);
  if (direction === 'top' || direction === 'bottom') {
    const chosen = items.filter((item) => on.has(item));
    const rest = items.filter((item) => !on.has(item));
    return direction === 'top' ? [...chosen, ...rest] : [...rest, ...chosen];
  }
  const out = [...items];
  const step = direction === 'up' ? -1 : 1;
  const order = out.map((_, i) => i);
  if (step > 0) order.reverse();
  for (const i of order) {
    const j = i + step;
    if (!on.has(out[i]) || j < 0 || j >= out.length || on.has(out[j])) continue;
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Pick list (PrimeNG `p-picklist`): move items between a source and a target list.
 * Double-click or Enter moves one item; buttons move the selection or every shown item; with
 * `dragdrop` the mouse drags items between the lists and inside a list.
 * `<star-pick-list [(source)]="available" [(target)]="assigned" optionLabel="name" sourceHeader="Available" targetHeader="Assigned" />`
 *
 * Slots (content children): `starItem` replaces the label of an item in both lists (context
 * `$implicit`, `index`, `selected` and `list`, so it covers PrimeNG `#sourceitem` and
 * `#targetitem`); `starPickListHeader` the header text (`$implicit` is the list, `count`);
 * `starListFilter` the filter field (with `list`); `starEmpty` the empty message (`$implicit` is the
 * filter text, `list` the list); `starIcon` with `moveToTarget`, `moveAllToTarget`, `moveToSource`,
 * `moveAllToSource`, `moveUp`, `moveTop`, `moveDown`, `moveBottom` the icons of the buttons. The
 * items are options in a listbox with their own keys, so do not put focusable elements (buttons,
 * links, inputs) in the item template.
 *
 * PrimeNG names that star-ng covers in another way: `style`, `sourceStyle`, `targetStyle`,
 * `buttonProps` and the `move*Props` = `pt` (parts `sidePanel`, `list`, `transferButton`,
 * `reorderButton`); the button `*AriaLabel` inputs = `STAR_UI_TEXT` (`moveSelectedToTarget` …);
 * `sourceAriaLabel` and `targetAriaLabel` = the headers, which name the lists; `onFocus` and
 * `onBlur` = the native `focusin` and `focusout` events of the host. Not applicable: `tabindex`
 * and `autoOptionFocus` (each option is a tab stop and takes focus itself), `trackBy`,
 * `sourceTrackBy`, `targetTrackBy` and `dataKey` (items are compared by identity), `responsive`
 * (deprecated in PrimeNG; use `breakpoint`).
 */
@Component({
  selector: 'star-pick-list',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarPickList) }],
  host: {
    class: 'star-pick-list',
    '[class.star-pick-list--breakpoint]': 'breakpoint() !== null',
    '[class.star-pick-list--stacked]': 'stacked()',
    '[class.star-pick-list--disabled]': 'disabled()',
  },
  template: `
    <ng-template #iconTpl let-slot="slot" let-icon="icon" let-part="part">
      @if (icons().get(slot); as custom) {
        <span data-star-part="moveIcon" class="star-pick-list__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        @if (part === 'moveAllIcon') {
          <i data-star-part="moveAllIcon" [class]="icon" aria-hidden="true"></i>
        } @else {
          <i data-star-part="moveIcon" [class]="icon" aria-hidden="true"></i>
        }
      }
    </ng-template>
    @for (side of sides; track side) {
      @let items = side === 'source' ? source() : target();
      @let shown = visible()[side];
      <section
        data-star-part="sidePanel"
        class="star-pick-list__side"
        [attr.aria-labelledby]="ids[side]"
      >
        <h3 data-star-part="header" class="star-pick-list__header" [id]="ids[side]">
          @if (headerSlot(); as custom) {
            <ng-container *ngTemplateOutlet="custom; context: headerContext(side, items.length)" />
          } @else {
            {{
              side === 'source'
                ? (sourceHeader() ?? text.pickListSource)
                : (targetHeader() ?? text.pickListTarget)
            }}
          }
          <span
            data-star-part="badgeText"
            class="star-badge star-badge--secondary star-badge--sm"
            >{{ items.length }}</span
          >
        </h3>
        @if (showFilter(side)) {
          <div data-star-part="filterPanel" class="star-pick-list__filter">
            @if (filterSlot(); as custom) {
              <ng-container *ngTemplateOutlet="custom; context: filterContext(side)" />
            } @else {
              <input
                data-star-part="filterInput"
                class="star-input star-input--sm"
                type="search"
                [value]="queries()[side]"
                [disabled]="disabled()"
                [attr.placeholder]="filterPlaceholderOf(side)"
                [attr.aria-label]="filterLabelOf(side)"
                [attr.aria-describedby]="ids[side]"
                (input)="setQuery(side, $any($event.target).value)"
              />
            }
          </div>
        }
        <div data-star-part="bodyPanel" class="star-pick-list__body">
          @if (side === 'target' && showTargetControls()) {
            <ng-container *ngTemplateOutlet="reorderTpl; context: { $implicit: side }" />
          }
          <div data-star-part="boxPanel" class="star-pick-list__box">
            <ul
              data-star-part="list"
              class="star-listbox star-pick-list__list"
              role="listbox"
              aria-multiselectable="true"
              [class.star-pick-list__list--striped]="stripedRows()"
              [style.max-height]="scrollHeight()"
              [attr.aria-labelledby]="ids[side]"
              [attr.aria-disabled]="disabled() || null"
              (dragover)="onDragOver($event)"
              (drop)="onDrop($event, side, null)"
            >
              @for (entry of shown; track entry.index) {
                @let off = isOptionDisabled(side, entry.item);
                <li
                  data-star-part="option"
                  role="option"
                  class="star-listbox__option"
                  [attr.tabindex]="disabled() ? -1 : 0"
                  [attr.aria-selected]="isPicked(side, entry.item)"
                  [attr.aria-disabled]="off || null"
                  [attr.draggable]="dragdrop() && !disabled() && !off ? 'true' : null"
                  [class.star-listbox__option--selected]="isPicked(side, entry.item)"
                  [class.star-listbox__option--disabled]="off"
                  (click)="onClick($event, side, entry.item)"
                  (dblclick)="transferOne(side, entry.item)"
                  (keydown.enter)="transferOne(side, entry.item)"
                  (keydown.space)="$event.preventDefault(); pick(side, entry.item)"
                  (keydown)="onKeydown($event)"
                  (dragstart)="onDragStart($event, side, entry.item)"
                  (dragend)="drag = null"
                  (drop)="$event.stopPropagation(); onDrop($event, side, entry.item)"
                >
                  @if (itemSlot(); as custom) {
                    <ng-container
                      *ngTemplateOutlet="
                        custom;
                        context: itemContext(side, entry.item, entry.index)
                      "
                    />
                  } @else {
                    {{ labelOf(entry.item) }}
                  }
                </li>
              }
            </ul>
            <!-- Outside the listbox: a listbox may contain options and groups only. -->
            @if (!shown.length) {
              <div
                data-star-part="emptyPanel"
                class="star-listbox__empty star-pick-list__empty"
                role="presentation"
              >
                @if (emptySlot(); as custom) {
                  <ng-container *ngTemplateOutlet="custom; context: emptyContext(side)" />
                } @else {
                  {{
                    queries()[side] && items.length ? text.emptyFilterMessage : text.emptyMessage
                  }}
                }
              </div>
            }
          </div>
          @if (side === 'source' && showSourceControls()) {
            <ng-container *ngTemplateOutlet="reorderTpl; context: { $implicit: side }" />
          }
        </div>
      </section>
      @if (side === 'source') {
        <div
          data-star-part="buttonsPanel"
          class="star-pick-list__buttons"
          role="group"
          [attr.aria-label]="text.transfer"
        >
          @for (button of transferButtons; track button.slot) {
            <button
              data-star-part="transferButton"
              type="button"
              class="star-select__icon-btn"
              [attr.aria-label]="text[button.label]"
              [disabled]="disabled() || !movable(button.from, button.all).length"
              (click)="transfer(button.from, movable(button.from, button.all), button.all)"
            >
              <ng-container
                *ngTemplateOutlet="
                  iconTpl;
                  context: {
                    slot: button.slot,
                    icon: button.icon,
                    part: button.all ? 'moveAllIcon' : 'moveIcon',
                  }
                "
              />
            </button>
          }
        </div>
      }
    }
    <ng-template #reorderTpl let-side>
      <div
        data-star-part="reorderPanel"
        class="star-pick-list__reorder"
        role="group"
        [attr.aria-label]="text.moveSelectedItem"
      >
        @for (button of reorderButtons; track button.id) {
          <button
            data-star-part="reorderButton"
            type="button"
            class="star-select__icon-btn"
            [attr.aria-label]="text[button.label]"
            [disabled]="disabled() || !picked(side).length"
            (click)="reorderSide(side, button.id)"
          >
            <ng-container
              *ngTemplateOutlet="
                iconTpl;
                context: { slot: button.slot, icon: button.icon, part: 'moveIcon' }
              "
            />
          </button>
        }
      </div>
    </ng-template>
  `,
})
export class StarPickList<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly announcer = inject(StarAnnouncer);
  private readonly idGen = inject(_IdGenerator);
  protected readonly ids = {
    source: this.idGen.getId('star-pick-src-'),
    target: this.idGen.getId('star-pick-tgt-'),
  };
  protected readonly sides = ['source', 'target'] as const;
  protected readonly transferButtons = [
    {
      from: 'source',
      all: false,
      slot: 'moveToTarget',
      label: 'moveSelectedToTarget',
      icon: 'ph-bold ph-caret-right star-icon-mirror',
    },
    {
      from: 'source',
      all: true,
      slot: 'moveAllToTarget',
      label: 'moveAllToTarget',
      icon: 'ph-bold ph-caret-double-right star-icon-mirror',
    },
    {
      from: 'target',
      all: false,
      slot: 'moveToSource',
      label: 'moveSelectedToSource',
      icon: 'ph-bold ph-caret-left star-icon-mirror',
    },
    {
      from: 'target',
      all: true,
      slot: 'moveAllToSource',
      label: 'moveAllToSource',
      icon: 'ph-bold ph-caret-double-left star-icon-mirror',
    },
  ] as const;
  protected readonly reorderButtons = REORDER.map((button) => ({
    ...button,
    label: ({ top: 'moveTop', up: 'moveUp', down: 'moveDown', bottom: 'moveBottom' } as const)[
      button.id
    ],
  }));

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly itemSlot = starSlot<StarItemContext<T>>(this.slots, this, 'item');
  protected readonly headerSlot = starSlot<StarPickListHeaderContext>(
    this.slots,
    this,
    'pickListHeader',
  );
  protected readonly filterSlot = starSlot<StarListFilterContext>(this.slots, this, 'listFilter');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  readonly source = model<readonly T[]>([]);
  readonly target = model<readonly T[]>([]);
  readonly optionLabel = input<StarOptionKey<T> | null>(null);
  readonly sourceHeader = input<string | null>(null);
  readonly targetHeader = input<string | null>(null);
  /** Shows a filter field above each list. PrimeNG shows them when `filterBy` is set. */
  readonly filter = input(false, { transform: booleanAttribute });
  /** With `filter`: shows the filter of the source list (default `true`). */
  readonly showSourceFilter = input(true, { transform: booleanAttribute });
  /** With `filter`: shows the filter of the target list (default `true`). */
  readonly showTargetFilter = input(true, { transform: booleanAttribute });
  /** The fields that the filters search (one key or several); default: the label. */
  readonly filterBy = input<StarFilterBy<T>>(null);
  /** How the filter text matches. PrimeNG `filterMatchMode`. */
  readonly filterMatchMode = input<StarFilterMatchMode>('contains');
  /** Locale of the case and accent folding of the filters. PrimeNG `filterLocale`. */
  readonly filterLocale = input<string | null>(null);
  /** Placeholder of the source filter (default `STAR_UI_TEXT.filterPlaceholder`). */
  readonly sourceFilterPlaceholder = input<string | null>(null);
  /** Placeholder of the target filter (default `STAR_UI_TEXT.filterPlaceholder`). */
  readonly targetFilterPlaceholder = input<string | null>(null);
  /** Accessible name of the source filter (default: its placeholder). */
  readonly ariaSourceFilterLabel = input<string | null>(null);
  /** Accessible name of the target filter (default: its placeholder). */
  readonly ariaTargetFilterLabel = input<string | null>(null);
  /** Turns off the lists, the buttons, the filters and the drag. */
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Every second item has a tinted background. */
  readonly stripedRows = input(false, { transform: booleanAttribute });
  /** CSS `max-height` of the lists, for example `'20rem'` (default `16rem`). */
  readonly scrollHeight = input<string | null>(null);
  /**
   * A click selects only the clicked item; Ctrl or Cmd and a click adds or removes it. Without it
   * (default), each click adds or removes the item. Space always adds or removes.
   */
  readonly metaKeySelection = input(false, { transform: booleanAttribute });
  /** The moved items stay selected in the list they went to. */
  readonly keepSelection = input(false, { transform: booleanAttribute });
  /** Items of the source list that cannot be selected or moved. */
  readonly sourceOptionDisabled = input<((item: T) => boolean) | null>(null);
  /** Items of the target list that cannot be selected or moved. */
  readonly targetOptionDisabled = input<((item: T) => boolean) | null>(null);
  /** Buttons that reorder the selected items of the source list (default `false`). */
  readonly showSourceControls = input(false, { transform: booleanAttribute });
  /** Buttons that reorder the selected items of the target list (default `false`). */
  readonly showTargetControls = input(false, { transform: booleanAttribute });
  /**
   * Move items with the mouse: between the lists and to another place in a list. It uses the
   * native drag and drop of the browser, so it does not work with touch; the keys and the buttons
   * do the same on every device.
   */
  readonly dragdrop = input(false, { transform: booleanAttribute });
  /**
   * Window width at or under which the lists stack (for example `'960px'`). Default: the style
   * sheet stacks them under 640px.
   */
  readonly breakpoint = input<string | null>(null);

  /** Emits the items that moved from the source to the target (selected, double-click, drag). */
  readonly moveToTarget = output<StarListItemsEvent<T>>();
  /** Emits the items that "Move all to target" moved. */
  readonly moveAllToTarget = output<StarListItemsEvent<T>>();
  /** Emits the items that moved from the target to the source (selected, double-click, drag). */
  readonly moveToSource = output<StarListItemsEvent<T>>();
  /** Emits the items that "Move all to source" moved. */
  readonly moveAllToSource = output<StarListItemsEvent<T>>();
  /** Emits the items that moved inside the source list. */
  readonly sourceReorder = output<StarListItemsEvent<T>>();
  /** Emits the items that moved inside the target list. */
  readonly targetReorder = output<StarListItemsEvent<T>>();
  /** Emits the selected items of the source list when they change. */
  readonly sourceSelect = output<StarListItemsEvent<T>>();
  /** Emits the selected items of the target list when they change. */
  readonly targetSelect = output<StarListItemsEvent<T>>();
  /** Emits the filter text of the source list and its matching items. */
  readonly sourceFilter = output<StarListFilterEvent<T>>();
  /** Emits the filter text of the target list and its matching items. */
  readonly targetFilter = output<StarListFilterEvent<T>>();

  private readonly selection = signal<{ source: readonly T[]; target: readonly T[] }>({
    source: [],
    target: [],
  });
  protected readonly queries = signal<Record<StarPickListSide, string>>({ source: '', target: '' });
  /** The items being dragged and their list. */
  protected drag: { side: StarPickListSide; items: readonly T[] } | null = null;

  private readonly width = starViewportWidth(() => this.breakpoint() !== null);
  protected readonly stacked = computed(() => {
    const breakpoint = this.breakpoint();
    const width = this.width();
    if (breakpoint === null || width === null) return false;
    const max = Number.parseFloat(breakpoint) * (/r?em\s*$/.test(breakpoint) ? 16 : 1);
    return width <= max;
  });

  /** The shown items of each list (after the filter), with their index in the list. */
  protected readonly visible = computed(() => ({
    source: this.shownOf('source', this.source()),
    target: this.shownOf('target', this.target()),
  }));

  private shownOf(side: StarPickListSide, items: readonly T[]): { item: T; index: number }[] {
    const query = this.queries()[side];
    const entries = items.map((item, index) => ({ item, index }));
    if (!this.showFilter(side) || !query.trim()) return entries;
    return entries.filter(({ item }) =>
      starFilterMatchAny(
        starFilterTexts(item, this.filterBy(), (option) => this.labelOf(option)),
        query,
        this.filterMatchMode(),
        this.filterLocale(),
      ),
    );
  }

  protected showFilter(side: StarPickListSide): boolean {
    return this.filter() && (side === 'source' ? this.showSourceFilter() : this.showTargetFilter());
  }
  protected filterPlaceholderOf(side: StarPickListSide): string {
    return (
      (side === 'source' ? this.sourceFilterPlaceholder() : this.targetFilterPlaceholder()) ??
      this.text.filterPlaceholder
    );
  }
  protected filterLabelOf(side: StarPickListSide): string {
    return (
      (side === 'source' ? this.ariaSourceFilterLabel() : this.ariaTargetFilterLabel()) ??
      this.filterPlaceholderOf(side)
    );
  }
  protected setQuery(side: StarPickListSide, query: string): void {
    this.queries.update((queries) => ({ ...queries, [side]: query }));
    const event = { query, value: this.visible()[side].map((entry) => entry.item) };
    (side === 'source' ? this.sourceFilter : this.targetFilter).emit(event);
  }
  protected filterContext(side: StarPickListSide): StarListFilterContext {
    return {
      $implicit: this.queries()[side],
      list: side,
      filter: (query: string) => this.setQuery(side, query),
      reset: () => this.setQuery(side, ''),
    };
  }
  protected headerContext(side: StarPickListSide, count: number): StarPickListHeaderContext {
    return { $implicit: side, count };
  }
  protected emptyContext(side: StarPickListSide): StarEmptyContext {
    return { $implicit: this.queries()[side], list: side };
  }

  protected labelOf(item: T): string {
    return optionText(item, this.optionLabel());
  }
  protected itemContext(side: StarPickListSide, item: T, index: number): StarItemContext<T> {
    return { $implicit: item, index, selected: this.isPicked(side, item), list: side };
  }
  protected isOptionDisabled(side: StarPickListSide, item: T): boolean {
    const test = side === 'source' ? this.sourceOptionDisabled() : this.targetOptionDisabled();
    return test ? test(item) : false;
  }
  protected picked(side: StarPickListSide): readonly T[] {
    return this.selection()[side];
  }
  protected isPicked(side: StarPickListSide, item: T): boolean {
    return this.selection()[side].includes(item);
  }
  /**
   * The items that a transfer button moves: the selected items, or every item, that the filter
   * shows (a hidden selected item stays).
   */
  protected movable(side: StarPickListSide, all: boolean): readonly T[] {
    const shown = this.visible()[side].map((entry) => entry.item);
    if (!all) return shown.filter((item) => this.isPicked(side, item));
    return shown.filter((item) => !this.isOptionDisabled(side, item));
  }

  private setPicked(side: StarPickListSide, items: readonly T[]): void {
    this.selection.update((sel) => ({ ...sel, [side]: items }));
    this.emitSelect(side, items);
  }

  private emitSelect(side: StarPickListSide, items: readonly T[]): void {
    (side === 'source' ? this.sourceSelect : this.targetSelect).emit({ items });
  }

  protected pick(side: StarPickListSide, item: T): void {
    if (this.disabled() || this.isOptionDisabled(side, item)) return;
    const current = this.selection()[side];
    this.setPicked(
      side,
      current.includes(item) ? current.filter((i) => i !== item) : [...current, item],
    );
  }

  protected onClick(event: MouseEvent, side: StarPickListSide, item: T): void {
    if (!this.metaKeySelection() || event.ctrlKey || event.metaKey) {
      this.pick(side, item);
      return;
    }
    if (this.disabled() || this.isOptionDisabled(side, item)) return;
    this.setPicked(side, [item]);
  }

  protected transferOne(side: StarPickListSide, item: T): void {
    if (this.disabled() || this.isOptionDisabled(side, item)) return;
    this.transfer(side, [item]);
  }

  /**
   * Moves `items` from the list `from` to the end of the other list (or before `before`).
   * `all` marks a "Move all" button for the outputs.
   */
  transfer(from: StarPickListSide, items: readonly T[], all = false, before?: T | null): void {
    if (!items.length) return;
    const moving = new Set(items);
    const to: StarPickListSide = from === 'source' ? 'target' : 'source';
    const [fromModel, toModel] =
      from === 'source' ? [this.source, this.target] : [this.target, this.source];
    fromModel.update((list) => list.filter((item) => !moving.has(item)));
    toModel.update((list) => {
      const at = before === null || before === undefined ? -1 : list.indexOf(before);
      return at < 0 ? [...list, ...items] : [...list.slice(0, at), ...items, ...list.slice(at)];
    });
    const prior = this.selection();
    const fromPicked = prior[from].filter((item) => !moving.has(item));
    const toPicked = this.keepSelection() ? [...prior[to], ...items] : prior[to];
    this.selection.set({ ...prior, [from]: fromPicked, [to]: toPicked } as typeof prior);
    const event = { items };
    if (from === 'source') (all ? this.moveAllToTarget : this.moveToTarget).emit(event);
    else (all ? this.moveAllToSource : this.moveToSource).emit(event);
    // The selection of a list changed: report it like a change by the user.
    if (fromPicked.length !== prior[from].length) this.emitSelect(from, fromPicked);
    if (toPicked !== prior[to]) this.emitSelect(to, toPicked);
    const list =
      to === 'target'
        ? (this.targetHeader() ?? this.text.pickListTarget)
        : (this.sourceHeader() ?? this.text.pickListSource);
    void this.announcer.announce(this.text.itemsMoved(items.length, list));
  }

  /** Moves the selected items of one list up, down, to the top or to the bottom. */
  protected reorderSide(side: StarPickListSide, direction: Direction): void {
    const picked = this.picked(side);
    if (this.disabled() || !picked.length) return;
    const list = side === 'source' ? this.source : this.target;
    const next = ɵstarReorderPicked(list(), picked, direction);
    list.set(next);
    (side === 'source' ? this.sourceReorder : this.targetReorder).emit({ items: picked });
    const first = next.find((item) => picked.includes(item))!;
    void this.announcer.announce(
      this.text.itemPosition(this.labelOf(first), next.indexOf(first) + 1, next.length),
    );
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const current = event.currentTarget as HTMLElement;
    const next =
      event.key === 'ArrowUp' ? current.previousElementSibling : current.nextElementSibling;
    (next as HTMLElement | null)?.focus();
  }

  protected onDragStart(event: DragEvent, side: StarPickListSide, item: T): void {
    if (!this.dragdrop() || this.disabled() || this.isOptionDisabled(side, item)) return;
    const picked = this.picked(side);
    this.drag = { side, items: picked.includes(item) ? picked : [item] };
    event.dataTransfer?.setData('text/plain', this.labelOf(item));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  protected onDragOver(event: DragEvent): void {
    if (this.drag) event.preventDefault();
  }

  /** A drop on an item puts the dragged items before it; a drop on a list puts them last. */
  protected onDrop(event: DragEvent, side: StarPickListSide, before: T | null): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag || this.disabled()) return;
    event.preventDefault();
    if (drag.side !== side) {
      this.transfer(drag.side, drag.items, false, before);
      return;
    }
    if (before !== null && drag.items.includes(before)) return;
    const list = side === 'source' ? this.source : this.target;
    const moving = new Set(drag.items);
    const rest = list().filter((item) => !moving.has(item));
    const at = before === null ? rest.length : rest.indexOf(before);
    list.set([...rest.slice(0, at), ...drag.items, ...rest.slice(at)]);
    (side === 'source' ? this.sourceReorder : this.targetReorder).emit({ items: drag.items });
  }

  /** Reads a value with an optional key (exposed for custom templates). */
  read(item: T, key: StarOptionKey<T>): unknown {
    return readOption(item, key);
  }
}
