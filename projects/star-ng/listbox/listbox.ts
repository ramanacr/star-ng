import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  CdkFixedSizeVirtualScroll,
  CdkVirtualForOf,
  CdkVirtualScrollViewport,
} from '@angular/cdk/scrolling';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  DestroyRef,
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  isDevMode,
  model,
  output,
  signal,
  Signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  injectStarControlDefaults,
  optionText,
  readOption,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  StarFilterBy,
  starFilterMatchAny,
  StarFilterMatchMode,
  starFilterTexts,
  StarGroupContext,
  StarLazyRequests,
  starListAriaPosition,
  starListHeight,
  starListKeyboardTarget,
  starListLayout,
  StarListLazyLoadEvent,
  starListLazyRange,
  StarListNavigationKey,
  starListPageSize,
  starListRevealOffset,
  starListRevealRows,
  starListRowRendered,
  starListTypeaheadIndex,
  StarOptionKey,
  StarSlot,
  starSlot,
  StarWindowRow,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
import {
  STAR_SELECT_DEFAULTS,
  StarOptionTemplate,
  StarSelectionChangingEvent,
  ɵstarLazyOptions,
  ɵstarSelectionChanging,
} from '@star-ng/ui/select';
import { StarListboxDropEvent, starListboxDropIndex } from './listbox-dragdrop';

/** Listboxes by list id, so a drop can find the options of the list it came from. */
const DROP_LISTS = new Map<string, { options(): readonly unknown[] }>();

/**
 * Inline list choice (PrimeNG `p-listbox`): single or `multiple` (checkboxes), filter,
 * option template, WAI-ARIA listbox keyboard (Arrow, Home / End, Space / Enter, typeahead).
 * Value: one value, or an array in `multiple` mode.
 *
 * `<star-listbox [options]="queues" optionLabel="name" optionValue="id" [(value)]="queue" filter ariaLabel="Queue" />`
 */
@Component({
  selector: 'star-listbox',
  imports: [
    NgTemplateOutlet,
    CdkVirtualScrollViewport,
    CdkFixedSizeVirtualScroll,
    CdkVirtualForOf,
    CdkDropList,
    CdkDrag,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarListbox) }],
  host: {
    class: 'star-listbox-box',
    '[class.star-listbox-box--disabled]': 'disabled()',
    '[class.star-listbox-box--invalid]': 'invalid() && touched()',
  },
  template: `
    @if (headerSlot(); as header) {
      <ng-container *ngTemplateOutlet="header" />
    }
    @if (filter() || checkbox()) {
      <div class="star-panel__filter">
        @if (checkbox()) {
          <button
            type="button"
            class="star-panel__toggle-all"
            role="checkbox"
            [attr.aria-checked]="allState()"
            [attr.aria-label]="text.selectAll"
            [disabled]="disabled()"
            (click)="toggleAll()"
          >
            <span class="star-check__box" aria-hidden="true">
              @if (allState() === 'mixed') {
                <i class="ph-bold ph-minus"></i>
              } @else if (allState() === true) {
                <i class="ph-bold ph-check"></i>
              }
            </span>
          </button>
          @if (!filter()) {
            <span class="star-panel__toggle-label" aria-hidden="true">{{ text.selectAll }}</span>
          }
        }
        @if (filter()) {
          <i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
          <input
            #filterInput
            type="search"
            class="star-input star-input--sm"
            autocomplete="off"
            [attr.aria-label]="text.filterPlaceholder"
            [attr.aria-controls]="listId"
            [placeholder]="text.filterPlaceholder"
            [value]="query()"
            (input)="onFilterInput(filterInput.value)"
            (keydown)="onKeydown($event)"
          />
        }
      </div>
    }
    @if (virtualScroll()) {
      <!-- Virtual scroll: the CDK viewport is the listbox. Group headings and options are rows of one height. -->
      <cdk-virtual-scroll-viewport
        #list
        class="star-listbox star-listbox--virtual star-listbox--viewport"
        role="listbox"
        [id]="listId"
        [itemSize]="itemSize()"
        [minBufferPx]="itemSize() * 4"
        [maxBufferPx]="itemSize() * 8"
        [attr.tabindex]="disabled() ? -1 : 0"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="labelledBy()"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-multiselectable]="isMulti() || null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-disabled]="disabled() || null"
        [attr.aria-busy]="lazyBusy() || null"
        [style.--star-item-size.px]="itemSize()"
        [style.height]="viewportHeight()"
        (keydown)="onKeydown($event)"
        (focus)="onFocus()"
        (blur)="touch.emit()"
      >
        <ng-container *cdkVirtualFor="let row of layout().rows; trackBy: trackRow">
          @if (row.kind === 'group') {
            <div class="star-listbox__group" role="presentation" [id]="row.id">
              @if (groupSlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: groupContext(row.label)" />
              } @else {
                <ng-container>{{ row.label }}</ng-container>
              }
            </div>
          } @else {
            @let option = row.option;
            @let i = row.index;
            @let position = positionOf(i);
            <!-- Keyboard is handled on the listbox via aria-activedescendant. -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <div
              class="star-listbox__option"
              role="option"
              [id]="listId + '-' + i"
              [class.star-listbox__option--active]="active() === i"
              [class.star-listbox__option--loading]="option === undefined"
              [class.star-listbox__option--selected]="isSelected(option)"
              [attr.aria-selected]="checkbox() ? null : isSelected(option)"
              [attr.aria-checked]="checkbox() ? isSelected(option) : null"
              [attr.aria-disabled]="isDisabled(option) || null"
              [attr.aria-describedby]="describedBy(row)"
              [attr.aria-setsize]="position.setsize"
              [attr.aria-posinset]="position.posinset"
              (click)="active.set(i); choose(option)"
              (dblclick)="onOptionDblClick(option, $event)"
            >
              @if (isMulti()) {
                <span class="star-check__box" aria-hidden="true">
                  @if (isSelected(option)) {
                    <i class="ph-bold ph-check"></i>
                  }
                </span>
              }
              <span class="star-listbox__label">
                @if (option === undefined) {
                  <span class="star-skeleton star-listbox__skeleton" aria-hidden="true"></span>
                  <span class="star-sr-only">{{ text.loading }}</span>
                } @else if (optionTemplate(); as custom) {
                  <ng-container
                    *ngTemplateOutlet="
                      custom.template;
                      context: { $implicit: option, selected: isSelected(option), index: i }
                    "
                  />
                } @else {
                  {{ labelOf(option) }}
                }
              </span>
            </div>
          }
        </ng-container>
      </cdk-virtual-scroll-viewport>
    } @else if (dragdrop()) {
      <!-- Drag and drop: the list is a CDK drop list and each option a drag item. No group headings. -->
      <ul
        #list
        cdkDropList
        class="star-listbox star-listbox--dragdrop"
        role="listbox"
        [id]="listId"
        [cdkDropListData]="dropData()"
        [cdkDropListConnectedTo]="connectedIds()"
        [cdkDropListDisabled]="disabled()"
        [attr.tabindex]="disabled() ? -1 : 0"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="labelledBy()"
        [attr.aria-describedby]="dragDescribedBy()"
        [attr.aria-multiselectable]="isMulti() || null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-disabled]="disabled() || null"
        [attr.aria-busy]="lazyBusy() || null"
        [style.max-height]="scrollHeight()"
        (cdkDropListDropped)="onDrop($event)"
        (keydown)="onKeydown($event)"
        (focus)="onFocus()"
        (blur)="touch.emit()"
      >
        @for (option of visible(); track $index; let i = $index) {
          <!-- Keyboard is handled on the listbox via aria-activedescendant; Alt + Arrow keys move. -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li
            cdkDrag
            class="star-listbox__option"
            role="option"
            [cdkDragData]="option"
            [cdkDragDisabled]="disabled() || isDisabled(option)"
            [id]="listId + '-' + i"
            [class.star-listbox__option--active]="active() === i"
            [class.star-listbox__option--loading]="option === undefined"
            [class.star-listbox__option--selected]="isSelected(option)"
            [attr.aria-selected]="checkbox() ? null : isSelected(option)"
            [attr.aria-checked]="checkbox() ? isSelected(option) : null"
            [attr.aria-disabled]="isDisabled(option) || null"
            (click)="active.set(i); choose(option)"
            (dblclick)="onOptionDblClick(option, $event)"
          >
            <i class="ph-bold ph-dots-six-vertical star-listbox__grip" aria-hidden="true"></i>
            <ng-container
              *ngTemplateOutlet="optionBody; context: { $implicit: option, index: i }"
            />
          </li>
        }
      </ul>
      <p class="star-sr-only" [id]="hintId">{{ text.orderListHint }}</p>
      <p class="star-sr-only" aria-live="polite">{{ announcement() }}</p>
    } @else {
      <ul
        #list
        class="star-listbox"
        role="listbox"
        [id]="listId"
        [attr.tabindex]="disabled() ? -1 : 0"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="labelledBy()"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-multiselectable]="isMulti() || null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-disabled]="disabled() || null"
        [attr.aria-busy]="lazyBusy() || null"
        [style.max-height]="scrollHeight()"
        (keydown)="onKeydown($event)"
        (focus)="onFocus()"
        (blur)="touch.emit()"
      >
        @for (option of visible(); track $index; let i = $index) {
          @if (groupHeading(i); as heading) {
            <li class="star-listbox__group" role="presentation" [id]="groupId(i)">
              @if (groupSlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: groupContext(heading)" />
              } @else {
                <ng-container>{{ heading }}</ng-container>
              }
            </li>
          }
          <!-- Keyboard is handled on the listbox via aria-activedescendant. -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li
            class="star-listbox__option"
            role="option"
            [id]="listId + '-' + i"
            [class.star-listbox__option--active]="active() === i"
            [class.star-listbox__option--loading]="option === undefined"
            [class.star-listbox__option--selected]="isSelected(option)"
            [attr.aria-selected]="checkbox() ? null : isSelected(option)"
            [attr.aria-checked]="checkbox() ? isSelected(option) : null"
            [attr.aria-disabled]="isDisabled(option) || null"
            [attr.aria-describedby]="groupId(i)"
            (click)="active.set(i); choose(option)"
            (dblclick)="onOptionDblClick(option, $event)"
          >
            <ng-container
              *ngTemplateOutlet="optionBody; context: { $implicit: option, index: i }"
            />
          </li>
        }
      </ul>
    }
    <ng-template #optionBody let-option let-i="index">
      @if (isMulti()) {
        <span class="star-check__box" aria-hidden="true">
          @if (isSelected(option)) {
            <i class="ph-bold ph-check"></i>
          }
        </span>
      }
      <span class="star-listbox__label">
        @if (option === undefined) {
          <span class="star-skeleton star-listbox__skeleton" aria-hidden="true"></span>
          <span class="star-sr-only">{{ text.loading }}</span>
        } @else if (optionTemplate(); as custom) {
          <ng-container
            *ngTemplateOutlet="
              custom.template;
              context: { $implicit: option, selected: isSelected(option), index: i }
            "
          />
        } @else {
          {{ labelOf(option) }}
        }
      </span>
    </ng-template>
    <!-- Outside the listbox: a listbox may contain options and groups only. -->
    @if (!visible().length) {
      <div class="star-listbox__empty" role="presentation">
        @if (emptySlot(); as custom) {
          <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
        } @else {
          <ng-container>{{ text.emptyFilterMessage }}</ng-container>
        }
      </div>
    }
    @if (footerSlot(); as footer) {
      <ng-container *ngTemplateOutlet="footer" />
    }
  `,
})
export class StarListbox<TOption = unknown, TValue = TOption> implements FormValueControl<
  TValue | readonly TValue[] | null
> {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly defaults = injectStarControlDefaults([], inject(STAR_SELECT_DEFAULTS));
  protected readonly listId = inject(_IdGenerator).getId('star-listbox-');
  protected readonly hintId = inject(_IdGenerator).getId('star-listbox-hint-');
  /** Id of the list element: pass the listbox in `connectedTo` of another listbox to connect them. */
  get dropListId(): string {
    return this.listId;
  }

  readonly value = model<TValue | readonly TValue[] | null>(null);
  /**
   * The options. With `lazy`, an entry may be `undefined` while it is not loaded: the list shows a
   * loading row for it, and the keyboard skips it.
   */
  readonly options = input<readonly TOption[], readonly (TOption | undefined)[]>([], {
    transform: ɵstarLazyOptions,
  });
  readonly optionLabel = input<StarOptionKey<TOption> | null>(null);
  readonly optionValue = input<StarOptionKey<TOption> | null>(null);
  readonly optionDisabled = input<StarOptionKey<TOption> | null>(null);
  /**
   * Group heading of an option (property name or function). Options with the same heading
   * show together under it, in the order in which the headings first appear.
   */
  readonly optionGroup = input<StarOptionKey<TOption> | null>(null);
  readonly multiple = input(false, { transform: booleanAttribute });
  /**
   * A check box in each option and a "Select all" box (tri-state) above the list. Implies
   * `multiple`. The options have `aria-checked`. PrimeNG `checkbox`.
   */
  readonly checkbox = input(false, { transform: booleanAttribute });
  /**
   * Reorders options by drag and drop (CDK drag-drop), also into another listbox in
   * `connectedTo` (or in the same `cdkDropListGroup`). Alt + Arrow up / down moves the active
   * option with the keyboard. The listbox does not change `options`: handle `dropped`. Not with
   * `virtualScroll`; group headings do not show. PrimeNG `dragdrop`.
   */
  readonly dragdrop = input(false, { transform: booleanAttribute });
  /** With `dragdrop`: data that names this list in `dropped` (`from` / `to`). Default: the listbox. */
  readonly dropListData = input<unknown>(null);
  /** With `dragdrop`: other listboxes that take options from this one (template references). */
  readonly connectedTo = input<readonly { readonly dropListId: string }[]>([]);
  readonly filter = input(false, { transform: booleanAttribute });
  /** Option fields that the filter searches (one key or a list). Default: the label. PrimeNG `filterBy`. */
  readonly filterBy = input<StarFilterBy<TOption>>(null);
  /** How the filter text must match (default `contains`, or `filterMatchMode` of `provideStarNg`). PrimeNG `filterMatchMode`. */
  readonly filterMatchMode = input<StarFilterMatchMode>(
    this.defaults.filterMatchMode ?? 'contains',
  );
  /** Locale of the filter compare (`Intl.Collator`, sensitivity `base`). Default: `locale` of `provideStarNg`. PrimeNG `filterLocale`. */
  readonly filterLocale = input<string | null>(
    this.defaults.filterLocale ?? this.defaults.locale ?? null,
  );
  /** Height of the list. With `virtualScroll` it is the height of the list, or less for a short list. */
  readonly scrollHeight = input(this.defaults.scrollHeight ?? '16rem');
  /**
   * Renders only the rows in and near the view (CDK virtual scroll), for lists of thousands of
   * options. Every row, group headings included, has the height `virtualItemSize` and the text
   * stays on one line. Keys and type-ahead work over all options. Page up and Page down move by
   * the lines in view.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Row height in pixels with `virtualScroll`. */
  readonly virtualItemSize = input(40);
  /**
   * Loads the options on demand (PrimeNG `lazy` with `onLazyLoad`). Use it with `virtualScroll`
   * and an `options` array of the full length, with `undefined` for the options that are not
   * loaded. The list emits `lazyLoad` when the rows in view need such options, and when the filter
   * text changes (the filter then does not filter in the browser).
   */
  readonly lazy = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  /**
   * With `lazy`: the options from `first` to `last` are needed for the filter text `filter`. PrimeNG
   * `onLazyLoad`. Each range is asked for once per filter text; treat the event as idempotent. A
   * range that failed to load is asked for again after `resetLazy()`, or when the owner sets new
   * placeholders with a different array length.
   */
  readonly lazyLoad = output<StarListLazyLoadEvent>();
  /** With `dragdrop`: an option was dropped on this list, or moved with Alt + Arrow keys. PrimeNG `onDrop`. */
  readonly dropped = output<StarListboxDropEvent<TOption>>();
  /** An option was double-clicked. PrimeNG `onDblClick`. */
  readonly optionDblClick = output<{
    readonly option: TOption;
    readonly originalEvent: MouseEvent;
  }>();
  /**
   * Fires before the value changes by a user action. Call `cancel()` on the event to keep the old
   * value. Ignite UI `selectionChanging`.
   */
  readonly selectionChanging =
    output<StarSelectionChangingEvent<TValue | readonly TValue[] | null>>();

  protected readonly optionTemplate = contentChild(StarOptionTemplate);
  /** All slot directives written inside this control. The picks below filter them by host. */
  protected readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly groupSlot = starSlot<StarGroupContext>(this.slots, this, 'group');
  private readonly list = viewChild<unknown, ElementRef<HTMLElement>>('list', { read: ElementRef });
  private readonly viewport = viewChild(CdkVirtualScrollViewport);
  /** The parent `star-field` when it labels the list (a `ul` listbox is not labelable). */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() => starFieldLabelledBy(this.field, this.ariaLabel()));
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  private readonly injector = inject(Injector);
  protected readonly query = signal('');
  /** Live text after a keyboard move (`dragdrop`). */
  protected readonly announcement = signal('');
  /** Several values: `multiple` or `checkbox`. */
  protected readonly isMulti = computed(() => this.multiple() || this.checkbox());

  // ---- Checkbox mode ----

  private readonly selectableVisible = computed(() =>
    this.visible().filter((option) => !this.isDisabled(option)),
  );

  /** `true`, `false` or `'mixed'` for the "Select all" box (over the shown, enabled options). */
  protected readonly allState = computed<boolean | 'mixed'>(() => {
    const options = this.selectableVisible();
    const selected = options.filter((option) => this.isSelected(option)).length;
    if (!options.length || selected === 0) return false;
    return selected === options.length ? true : 'mixed';
  });

  /** Selects all shown, enabled options, or clears them when all are selected. */
  protected toggleAll(): void {
    if (this.disabled()) return;
    const current = Array.isArray(this.value()) ? (this.value() as readonly TValue[]) : [];
    const shown = this.selectableVisible().map((option) => this.valueOf(option));
    const next =
      this.allState() === true
        ? current.filter((value) => !shown.some((v) => Object.is(v, value)))
        : [...current, ...shown.filter((v) => !current.some((value) => Object.is(v, value)))];
    this.change(next);
  }

  // ---- Drag and drop ----

  protected readonly dropData: Signal<unknown> = computed(
    (): unknown => this.dropListData() ?? this,
  );
  protected readonly connectedIds = computed(() => this.connectedTo().map((l) => l.dropListId));
  protected readonly dragDescribedBy = computed(() =>
    starJoinIds(this.fieldDescribedBy(), this.hintId),
  );

  protected onDrop(event: CdkDragDrop<unknown, unknown, TOption>): void {
    const sameList = event.previousContainer === event.container;
    const item = event.item.data;
    // The source listbox, to give the index in its options (not in its shown, filtered options).
    const sourceOptions = DROP_LISTS.get(event.previousContainer.id)?.options();
    const previousIndex = sourceOptions?.indexOf(item) ?? -1;
    this.dropped.emit({
      item,
      from: event.previousContainer.data,
      to: event.container.data,
      previousIndex: previousIndex >= 0 ? previousIndex : event.previousIndex,
      index: starListboxDropIndex(this.options(), this.visible(), event.currentIndex, sameList),
    });
  }

  /** Alt + Arrow up / down with `dragdrop`: moves the active option one place. */
  private moveByKey(step: 1 | -1): void {
    const options = this.visible();
    const from = this.active();
    const to = from + step;
    const item = options[from];
    if (item === undefined || to < 0 || to >= options.length || this.isDisabled(item)) return;
    const all = this.options();
    this.dropped.emit({
      item,
      from: this.dropData(),
      to: this.dropData(),
      previousIndex: all.indexOf(item),
      index: all.indexOf(options[to]),
    });
    this.active.set(to);
    this.reveal(to);
    this.announcement.set(this.text.itemPosition(this.labelOf(item), to + 1, options.length));
  }

  protected onOptionDblClick(option: TOption, originalEvent: MouseEvent): void {
    if (option === undefined || this.disabled()) return;
    this.optionDblClick.emit({ option, originalEvent });
  }
  protected readonly active = signal(-1);
  private typeahead = '';
  private typeaheadAt = 0;

  protected readonly visible = computed(() => {
    const query = this.query();
    const options =
      query && !this.lazy()
        ? this.options().filter((option) =>
            starFilterMatchAny(
              starFilterTexts(option, this.filterBy(), (o) => this.labelOf(o)),
              query,
              this.filterMatchMode(),
              this.filterLocale(),
            ),
          )
        : this.options();
    if (!this.optionGroup()) return options;
    // Keep each group together, in the order in which the groups first appear.
    const order = new Map<string, number>();
    for (const option of options) {
      const group = this.groupOf(option);
      if (!order.has(group)) order.set(group, order.size);
    }
    return options
      .map((option, index) => ({ option, index, rank: order.get(this.groupOf(option)) ?? 0 }))
      .sort((a, b) => a.rank - b.rank || a.index - b.index)
      .map(({ option }) => option);
  });

  /** Number of visible options in each group, by group label. */
  private readonly groupCounts = computed(() => {
    const counts = new Map<string, number>();
    if (!this.optionGroup()) return counts;
    for (const option of this.visible()) {
      const group = this.groupOf(option);
      counts.set(group, (counts.get(group) ?? 0) + 1);
    }
    return counts;
  });

  protected groupContext(label: string): StarGroupContext {
    return { $implicit: label, count: this.groupCounts().get(label) ?? 0 };
  }

  protected emptyContext(): StarEmptyContext {
    return { $implicit: this.query() };
  }

  protected groupOf(option: TOption): string {
    // An option that a `lazy` list has not loaded yet is `undefined`: accessor functions must not see it.
    if (option === undefined) return '';
    const key = this.optionGroup();
    const group = key ? readOption(option, key) : null;
    return group === null || group === undefined ? '' : String(group);
  }

  /** Heading to show before the option at an index: the first option of each group. */
  protected groupHeading(index: number): string | null {
    if (!this.optionGroup()) return null;
    const options = this.visible();
    const group = this.groupOf(options[index]);
    return index === 0 || this.groupOf(options[index - 1]) !== group ? group : null;
  }

  protected groupId(index: number): string | null {
    if (!this.optionGroup()) return null;
    const options = this.visible();
    let first = index;
    while (first > 0 && this.groupOf(options[first - 1]) === this.groupOf(options[index])) first--;
    return `${this.listId}-group-${first}`;
  }

  // ---- Virtual scroll ----

  protected readonly itemSize = computed(() => Math.max(1, this.virtualItemSize()));

  /** Group headings and options in one list of rows of equal height. */
  protected readonly layout = computed(() =>
    starListLayout(
      this.visible(),
      this.optionGroup() ? (option) => this.groupOf(option) : null,
      this.listId,
    ),
  );

  protected readonly viewportHeight = computed(() =>
    starListHeight(this.scrollHeight(), this.layout().rows.length, this.itemSize()),
  );

  /** Rows that are in the DOM now: `[start, end)`, reported by the CDK viewport. */
  private readonly renderedRange = signal({ start: 0, end: 0 });

  protected readonly trackRow = (_index: number, row: StarWindowRow<TOption>): string => row.key;

  protected positionOf(index: number): { setsize: number; posinset: number } {
    return starListAriaPosition(index, this.visible().length);
  }

  /** The heading of the group, only while its row is in the DOM (the id must exist). */
  protected describedBy(row: Extract<StarWindowRow<TOption>, { kind: 'option' }>): string | null {
    return row.groupId !== null && starListRowRendered(row.groupRow, this.renderedRange())
      ? row.groupId
      : null;
  }

  /** `aria-activedescendant` only names an option that is in the DOM. */
  protected readonly activeId = computed(() => {
    const index = this.active();
    if (index < 0 || index >= this.visible().length) return null;
    if (this.virtualScroll()) {
      const row = this.layout().rowOfOption[index];
      if (row === undefined || !starListRowRendered(row, this.renderedRange())) return null;
    }
    return `${this.listId}-${index}`;
  });

  /** True while a rendered row is an option that is not loaded yet (`aria-busy` of the list). */
  protected readonly lazyBusy = computed(() => {
    if (!this.lazy()) return false;
    const range = this.virtualScroll()
      ? this.renderedRange()
      : { start: 0, end: this.layout().rows.length };
    return !!starListLazyRange(this.layout(), range, (option) => option === undefined)?.missing;
  });

  private readonly lazyRequests = new StarLazyRequests();

  /** Changes on `resetLazy()`, so the lazy request effect runs again. */
  private readonly lazyEpoch = signal(0);

  /**
   * With `lazy`: forgets the ranges that `lazyLoad` asked for and asks again for the rows in view.
   * Call it to retry after a load failed. PrimeNG has no equivalent (it asks on every scroll).
   */
  resetLazy(): void {
    this.lazyRequests.reset();
    this.lazyEpoch.update((epoch) => epoch + 1);
  }

  constructor() {
    DROP_LISTS.set(this.listId, this);
    effect(() => {
      if (isDevMode() && this.dragdrop() && this.virtualScroll()) {
        console.warn(
          'star-listbox: dragdrop does not work with virtualScroll; drag and drop is ignored.',
        );
      }
    });
    inject(DestroyRef).onDestroy(() => DROP_LISTS.delete(this.listId));
    // `lazy`: ask for the options of the rendered rows that are not loaded, and for a new filter.
    effect(() => {
      this.lazyEpoch();
      if (!this.lazy()) return;
      const length = this.options().length;
      const layout = this.layout();
      const range = this.virtualScroll()
        ? this.renderedRange()
        : { start: 0, end: layout.rows.length };
      const lazyRange = starListLazyRange(layout, range, (option) => option === undefined);
      const query = this.query();
      const page = Math.ceil(256 / this.itemSize()) + 4;
      untracked(() => {
        const event = this.lazyRequests.next(lazyRange, query, page, length);
        if (event) this.lazyLoad.emit(event);
      });
    });
    effect((onCleanup) => {
      const viewport = this.viewport();
      if (!viewport) return;
      const element = viewport.getElementRef().nativeElement;
      this.renderedRange.set(viewport.getRenderedRange());
      // The range is read after the rows have been drawn, so the ids it allows exist.
      const range = viewport.renderedRangeStream.subscribe((next) =>
        afterNextRender(() => this.renderedRange.set({ ...next }), { injector: this.injector }),
      );
      afterNextRender(
        () =>
          element
            .querySelector('.cdk-virtual-scroll-content-wrapper')
            ?.setAttribute('role', 'presentation'),
        { injector: this.injector },
      );
      // The viewport measures its height once; a new height (filter, hidden parent) needs a new measure.
      const observer =
        typeof ResizeObserver === 'undefined'
          ? null
          : new ResizeObserver(() => viewport.checkViewportSize());
      observer?.observe(element);
      onCleanup(() => {
        range.unsubscribe();
        observer?.disconnect();
      });
    });
  }

  protected labelOf(option: TOption): string {
    if (option === undefined) return '';
    return optionText(option, this.optionLabel());
  }
  /** Disabled options, and options that are not loaded yet (`lazy`), cannot be chosen. */
  protected isDisabled(option: TOption): boolean {
    if (option === undefined) return true;
    const key = this.optionDisabled();
    return key ? !!readOption(option, key) : false;
  }
  private valueOf(option: TOption): TValue {
    if (option === undefined) return undefined as TValue;
    return readOption(option, this.optionValue()) as TValue;
  }
  protected isSelected(option: TOption): boolean {
    if (option === undefined) return false;
    const value = this.value();
    const optionValue = this.valueOf(option);
    return Array.isArray(value)
      ? value.some((v) => Object.is(v, optionValue))
      : Object.is(value, optionValue);
  }
  protected firstSelectedOrZero(): number {
    return Math.max(
      0,
      this.visible().findIndex((option) => this.isSelected(option)),
    );
  }

  protected choose(option: TOption): void {
    if (this.disabled() || this.isDisabled(option)) return;
    const optionValue = this.valueOf(option);
    if (this.isMulti()) {
      const current = Array.isArray(this.value()) ? (this.value() as readonly TValue[]) : [];
      this.change(
        this.isSelected(option)
          ? current.filter((v) => !Object.is(v, optionValue))
          : [...current, optionValue],
      );
    } else {
      this.change(optionValue);
    }
  }

  /**
   * Sets the value after `selectionChanging`, and returns `false` when a handler cancelled. The same
   * single value again fires no event.
   */
  private change(next: TValue | readonly TValue[] | null): boolean {
    const previous = this.value();
    if (Object.is(previous, next)) return true;
    if (!ɵstarSelectionChanging(this.selectionChanging, previous, next)) return false;
    this.value.set(next);
    return true;
  }

  protected onFilterInput(text: string): void {
    this.query.set(text);
    this.active.set(0);
    // The shorter list starts at its top.
    this.viewport()?.scrollToOffset(0);
  }

  protected onFocus(): void {
    if (this.active() >= 0) return;
    this.active.set(this.firstSelectedOrZero());
    if (this.virtualScroll()) this.reveal(this.active());
  }

  /**
   * Brings the active option into view. With `virtualScroll` the option may not be in the DOM yet:
   * the viewport scrolls to it (least movement, heading row included) and then renders it.
   */
  private reveal(index: number): void {
    if (!this.virtualScroll()) {
      queueMicrotask(() =>
        this.list()
          ?.nativeElement.querySelector(`#${CSS.escape(this.activeId() ?? '')}`)
          ?.scrollIntoView?.({ block: 'nearest' }),
      );
      return;
    }
    const viewport = this.viewport();
    if (!viewport) return;
    const [first, last] = starListRevealRows(this.layout(), index);
    const offset = starListRevealOffset(
      first,
      last,
      this.itemSize(),
      viewport.measureScrollOffset(),
      viewport.getViewportSize(),
    );
    if (offset !== null) viewport.scrollToOffset(offset);
  }

  /** First loaded option from `start` in the direction `step` (then back), or -1. */
  private loadedFrom(options: readonly TOption[], start: number, step: 1 | -1): number {
    for (const dir of [step, -step]) {
      for (let i = start; i >= 0 && i < options.length; i += dir) {
        if (options[i] !== undefined) return i;
      }
    }
    return -1;
  }

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.visible();
    if (!options.length || this.disabled()) return;
    const fromInput = event.target instanceof HTMLInputElement;
    const page = starListPageSize(this.viewport()?.getViewportSize() || 256, this.itemSize());
    const move = (key: StarListNavigationKey | number) => {
      event.preventDefault();
      const target =
        typeof key === 'number'
          ? key
          : starListKeyboardTarget(key, this.active(), options.length, page);
      // Options that are not loaded yet (`lazy`) are skipped in the direction of the key.
      const step = key === 'ArrowUp' || key === 'PageUp' || key === 'End' ? -1 : 1;
      const loaded = this.loadedFrom(options, target, step);
      if (loaded < 0) return;
      this.active.set(loaded);
      this.reveal(this.active());
      if (!this.isMulti() && !fromInput) {
        const option = options[this.active()];
        if (!this.isDisabled(option)) this.change(this.valueOf(option));
      }
    };
    if (
      this.dragdrop() &&
      event.altKey &&
      !fromInput &&
      (event.key === 'ArrowUp' || event.key === 'ArrowDown')
    ) {
      event.preventDefault();
      this.moveByKey(event.key === 'ArrowUp' ? -1 : 1);
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        return move(event.key);
      case 'Home':
      case 'End':
        if (fromInput) return;
        return move(event.key);
      case 'PageDown':
      case 'PageUp':
        // Without `virtualScroll` the browser scrolls the list by a page.
        if (fromInput || !this.virtualScroll()) return;
        return move(event.key);
      case ' ':
      case 'Enter':
        if (event.key === ' ' && fromInput) return;
        event.preventDefault();
        if (options[this.active()] !== undefined) this.choose(options[this.active()]);
        return;
      default:
        if (event.key.length === 1 && !fromInput) {
          const now = Date.now();
          this.typeahead =
            (now - this.typeaheadAt > 500 ? '' : this.typeahead) + event.key.toLowerCase();
          this.typeaheadAt = now;
          // Over all options, also those that are not in the DOM.
          const index = starListTypeaheadIndex(
            options.length,
            (i) => this.labelOf(options[i]),
            this.typeahead,
          );
          if (index >= 0) move(index);
        }
    }
  }

  focus(): void {
    this.list()?.nativeElement.focus();
  }
}
