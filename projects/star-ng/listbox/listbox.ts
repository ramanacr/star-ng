import { _IdGenerator } from '@angular/cdk/a11y';
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
  effect,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
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
  starListAriaPosition,
  starListHeight,
  starListKeyboardTarget,
  starListLayout,
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
import { StarOptionTemplate } from '@star-ng/ui/select';

/**
 * Inline list choice (PrimeNG `p-listbox`): single or `multiple` (checkboxes), filter,
 * option template, WAI-ARIA listbox keyboard (Arrow, Home / End, Space / Enter, typeahead).
 * Value: one value, or an array in `multiple` mode.
 *
 * `<star-listbox [options]="queues" optionLabel="name" optionValue="id" [(value)]="queue" filter ariaLabel="Queue" />`
 */
@Component({
  selector: 'star-listbox',
  imports: [NgTemplateOutlet, CdkVirtualScrollViewport, CdkFixedSizeVirtualScroll, CdkVirtualForOf],
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
    @if (filter()) {
      <div class="star-panel__filter">
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
        [attr.aria-multiselectable]="multiple() || null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-disabled]="disabled() || null"
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
              [class.star-listbox__option--selected]="isSelected(option)"
              [attr.aria-selected]="isSelected(option)"
              [attr.aria-disabled]="isDisabled(option) || null"
              [attr.aria-describedby]="describedBy(row)"
              [attr.aria-setsize]="position.setsize"
              [attr.aria-posinset]="position.posinset"
              (click)="active.set(i); choose(option)"
            >
              @if (multiple()) {
                <span class="star-check__box" aria-hidden="true">
                  @if (isSelected(option)) {
                    <i class="ph-bold ph-check"></i>
                  }
                </span>
              }
              <span class="star-listbox__label">
                @if (optionTemplate(); as custom) {
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
        [attr.aria-multiselectable]="multiple() || null"
        [attr.aria-activedescendant]="activeId()"
        [attr.aria-disabled]="disabled() || null"
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
            [class.star-listbox__option--selected]="isSelected(option)"
            [attr.aria-selected]="isSelected(option)"
            [attr.aria-disabled]="isDisabled(option) || null"
            [attr.aria-describedby]="groupId(i)"
            (click)="active.set(i); choose(option)"
          >
            @if (multiple()) {
              <span class="star-check__box" aria-hidden="true">
                @if (isSelected(option)) {
                  <i class="ph-bold ph-check"></i>
                }
              </span>
            }
            <span class="star-listbox__label">
              @if (optionTemplate(); as custom) {
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
          </li>
        }
      </ul>
    }
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
  protected readonly listId = inject(_IdGenerator).getId('star-listbox-');

  readonly value = model<TValue | readonly TValue[] | null>(null);
  readonly options = input<readonly TOption[]>([]);
  readonly optionLabel = input<StarOptionKey<TOption> | null>(null);
  readonly optionValue = input<StarOptionKey<TOption> | null>(null);
  readonly optionDisabled = input<StarOptionKey<TOption> | null>(null);
  /**
   * Group heading of an option (property name or function). Options with the same heading
   * show together under it, in the order in which the headings first appear.
   */
  readonly optionGroup = input<StarOptionKey<TOption> | null>(null);
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly filter = input(false, { transform: booleanAttribute });
  /** Option fields that the filter searches (one key or a list). Default: the label. PrimeNG `filterBy`. */
  readonly filterBy = input<StarFilterBy<TOption>>(null);
  /** How the filter text must match (default `contains`). PrimeNG `filterMatchMode`. */
  readonly filterMatchMode = input<StarFilterMatchMode>('contains');
  /** Locale of the filter compare (`Intl.Collator`, sensitivity `base`). PrimeNG `filterLocale`. */
  readonly filterLocale = input<string | null>(null);
  /** Height of the list. With `virtualScroll` it is the height of the list, or less for a short list. */
  readonly scrollHeight = input('16rem');
  /**
   * Renders only the rows in and near the view (CDK virtual scroll), for lists of thousands of
   * options. Every row, group headings included, has the height `virtualItemSize` and the text
   * stays on one line. Keys and type-ahead work over all options. Page up and Page down move by
   * the lines in view.
   */
  readonly virtualScroll = input(false, { transform: booleanAttribute });
  /** Row height in pixels with `virtualScroll`. */
  readonly virtualItemSize = input(40);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

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
  protected readonly active = signal(-1);
  private typeahead = '';
  private typeaheadAt = 0;

  protected readonly visible = computed(() => {
    const query = this.query();
    const options = query
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

  constructor() {
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
    return optionText(option, this.optionLabel());
  }
  protected isDisabled(option: TOption): boolean {
    const key = this.optionDisabled();
    return key ? !!readOption(option, key) : false;
  }
  private valueOf(option: TOption): TValue {
    return readOption(option, this.optionValue()) as TValue;
  }
  protected isSelected(option: TOption): boolean {
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
    if (this.multiple()) {
      const current = Array.isArray(this.value()) ? (this.value() as readonly TValue[]) : [];
      this.value.set(
        this.isSelected(option)
          ? current.filter((v) => !Object.is(v, optionValue))
          : [...current, optionValue],
      );
    } else {
      this.value.set(optionValue);
    }
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

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.visible();
    if (!options.length || this.disabled()) return;
    const fromInput = event.target instanceof HTMLInputElement;
    const page = starListPageSize(this.viewport()?.getViewportSize() || 256, this.itemSize());
    const move = (key: StarListNavigationKey | number) => {
      event.preventDefault();
      this.active.set(
        typeof key === 'number'
          ? key
          : starListKeyboardTarget(key, this.active(), options.length, page),
      );
      this.reveal(this.active());
      if (!this.multiple() && !fromInput) {
        const option = options[this.active()];
        if (!this.isDisabled(option)) this.value.set(this.valueOf(option));
      }
    };
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
