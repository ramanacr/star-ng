import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  resource,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  readOption,
  STAR_SLOT_HOST,
  StarPart,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
  ɵstarKeyed,
  ɵstarLeaveWithClass,
  type StarEmptyContext,
  type StarOptionKey,
} from '@star-ng/ui/core';
import {
  StarOptionListBase,
  StarSelectionChangingEvent,
  ɵstarSelectionChanging,
} from '@star-ng/ui/select';

export interface StarAutoCompleteSearch {
  readonly query: string;
}

/**
 * Loads the suggestions for a typed text (see `suggestionLoader`). `abortSignal` aborts when the
 * user types again before the load ends.
 */
export type StarAutoCompleteLoader<TOption> = (
  query: string,
  abortSignal: AbortSignal,
) => Promise<readonly TOption[]> | readonly TOption[];

/** Context of the leading and trailing slots of the autocomplete controls. */
export interface StarAutoCompleteAddonContext {
  /** The typed text. */
  readonly $implicit: string;
  /** The control is disabled. */
  readonly disabled: boolean;
  /** The control is read-only. */
  readonly readonly: boolean;
}

/**
 * Content before the input, inside the box of the autocomplete, for example a decorative icon:
 * `<ng-template starAutoCompleteLeading><i class="ph-bold ph-sparkle" aria-hidden="true"></i></ng-template>`.
 * It sits at the inline start, centred on the first row.
 */
@Directive({
  selector: 'ng-template[starAutoCompleteLeading]',
  providers: [{ provide: StarSlot, useExisting: StarAutoCompleteLeadingTemplate }],
})
export class StarAutoCompleteLeadingTemplate extends StarSlot<StarAutoCompleteAddonContext> {
  readonly name = 'autoCompleteLeading';

  static ngTemplateContextGuard(
    _dir: StarAutoCompleteLeadingTemplate,
    _ctx: unknown,
  ): _ctx is StarAutoCompleteAddonContext {
    return true;
  }
}

/**
 * Content after the input and the clear and dropdown buttons, inside the box of the autocomplete,
 * for example a key hint or a Search button:
 * `<ng-template starAutoCompleteTrailing><kbd>/</kbd></ng-template>`. When focus moves into it, the
 * suggestion panel closes.
 */
@Directive({
  selector: 'ng-template[starAutoCompleteTrailing]',
  providers: [{ provide: StarSlot, useExisting: StarAutoCompleteTrailingTemplate }],
})
export class StarAutoCompleteTrailingTemplate extends StarSlot<StarAutoCompleteAddonContext> {
  readonly name = 'autoCompleteTrailing';

  static ngTemplateContextGuard(
    _dir: StarAutoCompleteTrailingTemplate,
    _ctx: unknown,
  ): _ctx is StarAutoCompleteAddonContext {
    return true;
  }
}

interface Chip<TValue> {
  readonly value: TValue;
  readonly label: string;
}

/**
 * Shared behaviour of the autocomplete controls (WAI-ARIA combobox with list autocomplete):
 * local filtering of `options`, or server search through `(completeMethod)` + `[suggestions]` with a
 * debounce, minimum query length, loading state, match highlighting, dropdown button and a
 * screen-reader result count.
 */
@Directive()
export abstract class StarAutoCompleteBase<TOption, TValue> extends StarOptionListBase<
  TOption,
  TValue
> {
  /** Leave motion of the panel (`animate.leave`); a re-open ends it at once. */
  protected readonly leavePanel = ɵstarLeaveWithClass('star-panel--leaving');
  /** Server results. When set, the control shows these instead of filtering `options`. */
  readonly suggestions = input<readonly TOption[] | null>(null);
  readonly minQueryLength = input(1);
  /** Debounce in ms before `(completeMethod)` fires. */
  readonly delay = input(300);
  /** Shows a button that lists all options (local) or searches with an empty query. */
  readonly dropdown = input(false, { transform: booleanAttribute });
  /** Highlights the first result, so Enter picks it. */
  readonly autoHighlight = input(false, { transform: booleanAttribute });
  readonly showEmptyMessage = input(true, { transform: booleanAttribute });
  /**
   * Opens the panel when the field gets focus (or a click while it has focus), when the text is at
   * least `minQueryLength` long. With `[minQueryLength]="0"` an empty field shows all options (or
   * the `suggestions` for an empty `completeMethod` query) at once. Default `false`.
   */
  readonly openOnFocus = input(false, { transform: booleanAttribute });
  /**
   * Icon of each option: a property name or a function that gives Phosphor icon classes, for example
   * `ph-bold ph-clock`. The icon is decorative (`aria-hidden`) and shows before the label, also with
   * a `starOption` template.
   */
  readonly optionIcon = input<StarOptionKey<TOption> | null>(null);

  /**
   * Loads the suggestions itself, as an alternative to `(completeMethod)` + `[suggestions]`. The
   * control calls the function with the debounced text (at the time `completeMethod` fires, which
   * still fires) through Angular `resource()`: it shows the loading row while the promise is open,
   * aborts an older load when the user types again, and shows the result. When the promise
   * rejects, the list shows the text `searchFailed` (`STAR_UI_TEXT`) instead of the empty text;
   * the next search runs the loader again, also for the same text. A search for the same text
   * as the last successful one keeps that result and does not call the loader. A set
   * `suggestions` input wins over the loaded list. Default `null` (no loader).
   */
  readonly suggestionLoader = input<StarAutoCompleteLoader<TOption> | null>(null);

  /** Fires (debounced) when the user types; load `suggestions` in reply (PrimeNG `completeMethod`). */
  readonly completeMethod = output<StarAutoCompleteSearch>();
  /** An option was chosen (also from typed text). PrimeNG `onSelect`. */
  readonly optionSelect = output<TOption>();
  /** A value was removed by the user: a chip, Backspace, or the clear of a single value. PrimeNG `onUnselect`. */
  readonly optionUnselect = output<TValue>();

  protected readonly closeOnChoose = true;
  protected abstract readonly isMultiple: boolean;
  protected readonly control = viewChild.required<ElementRef<HTMLElement>>('control');

  protected readonly leadingSlot = starSlot<StarAutoCompleteAddonContext>(
    this.slots,
    this,
    'autoCompleteLeading',
  );
  protected readonly trailingSlot = starSlot<StarAutoCompleteAddonContext>(
    this.slots,
    this,
    'autoCompleteTrailing',
  );
  protected readonly addonContext = computed<StarAutoCompleteAddonContext>(() => ({
    $implicit: this.query(),
    disabled: this.disabled(),
    readonly: this.readonly(),
  }));
  /** True while `closePanel` runs: focus it gives back to the field must not open the panel again. */
  private closing = false;

  /** Options the user picked, so labels survive when the result list changes. */
  protected readonly known = signal<readonly TOption[]>([]);
  private readonly showAll = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected abstract queryFromValue(): string;
  /** True when chosen options leave the result list (multiple mode with `unique`). */
  protected hidesChosen(): boolean {
    return this.isMultiple;
  }
  /** Typed text. Resets to the selected label when the value changes. */
  protected readonly query = linkedSignal(() => this.queryFromValue());

  /** The text of the last search (`completeMethod`), or `null` before the first search. */
  private readonly searched = signal<string | null>(null);
  private readonly loaded = resource({
    params: () => {
      const loader = this.suggestionLoader();
      const query = this.searched();
      return loader && query !== null ? { loader, query } : undefined;
    },
    loader: async ({ params, abortSignal }) => params.loader(params.query, abortSignal),
  });
  /** The `suggestions` input, else the result of `suggestionLoader`, else `null` (local mode). */
  protected readonly remote = computed<readonly TOption[] | null>(() => {
    const given = this.suggestions();
    if (given || !this.suggestionLoader()) return given;
    return this.loaded.hasValue() ? this.loaded.value() : [];
  });

  protected override busy(): boolean {
    return this.loading() || this.loaded.isLoading();
  }

  /** The `suggestionLoader` failed for the last search (and no `suggestions` input is set). */
  protected readonly loadFailed = computed(
    () => !this.suggestions() && !!this.suggestionLoader() && this.loaded.status() === 'error',
  );

  protected override readonly visibleOptions = computed(() => {
    const remote = this.remote();
    const query = this.query();
    const candidates =
      remote ??
      (this.showAll() || !query || this.lazy()
        ? this.options()
        : this.options().filter((option) => this.matchesQuery(option, query)));
    return this.groupedOrder(
      this.hidesChosen() ? candidates.filter((option) => !this.isSelected(option)) : candidates,
    );
  });

  protected readonly queryLongEnough = computed(
    () => this.showAll() || this.query().length >= this.minQueryLength(),
  );

  protected readonly panelVisible = computed(
    () =>
      this.open() &&
      this.queryLongEnough() &&
      (this.visibleOptions().length > 0 ||
        this.customRow() !== null ||
        this.busy() ||
        this.loadFailed() ||
        this.showEmptyMessage()),
  );

  protected readonly liveText = computed(() => {
    if (!this.panelVisible()) return '';
    if (this.busy()) return this.text.searching;
    if (this.loadFailed()) return this.text.searchFailed;
    const count = this.visibleOptions().length;
    return count ? this.text.resultsAvailable(count) : this.emptyText();
  });

  constructor() {
    super();
    // The trigger is a native input: the field label points at it with \`for\`.
    this.linkField();
    inject(DestroyRef).onDestroy(() => clearTimeout(this.searchTimer));
    // New results: show them from the top and highlight the first one (autoHighlight) or nothing.
    // With `lazy`, loaded pages replace placeholders: the list stays where it is until the text
    // changes.
    let lastQuery: string | null = null;
    effect(() => {
      this.visibleOptions();
      const query = this.lazy() ? this.query() : null;
      untracked(() => {
        const sameQuery = query !== null && query === lastQuery;
        lastQuery = query;
        if (this.lazy() && sameQuery) return;
        this.resetScroll();
        this.activeIndex.set(this.autoHighlight() ? this.firstEnabledFrom(0, 1) : -1);
      });
    });
  }

  /** With `lazy`, the request has the typed text. */
  protected override lazyFilterText(): string {
    return this.query();
  }

  protected initialActiveIndex(): number {
    return this.autoHighlight() ? this.firstEnabledFrom(0, 1) : -1;
  }

  /** Finds the option behind a stored value, for labels. */
  protected optionForValue(value: TValue): TOption | undefined {
    const pools = [this.known(), this.remote() ?? [], this.options()];
    for (const pool of pools) {
      const match = pool.find((option) => this.equals(this.valueOf(option), value));
      if (match !== undefined) return match;
    }
    return undefined;
  }

  protected labelForValue(value: TValue): string {
    const option = this.optionForValue(value);
    if (option !== undefined) return this.labelOf(option);
    // A typed text that became a value (`allowCustomValues`) is its own label.
    if (typeof value === 'string') return value;
    return this.optionValue() === null ? this.labelOf(value as unknown as TOption) : String(value);
  }

  /** Icon classes of an option (`optionIcon`), or `null`. */
  protected iconOf(option: TOption): string | null {
    const key = this.optionIcon();
    if (!key || option === undefined) return null;
    const icon = readOption(option, key);
    return typeof icon === 'string' && icon ? icon : null;
  }

  protected remember(option: TOption): void {
    this.known.update((known) => (known.includes(option) ? known : [...known, option]));
  }

  protected onQuery(text: string): void {
    this.query.set(text);
    this.showAll.set(false);
    clearTimeout(this.searchTimer);
    if (text.length < this.minQueryLength()) {
      this.closePanel(false);
      return;
    }
    this.openPanel();
    this.searchTimer = setTimeout(() => this.search(text), this.delay());
  }

  /** `openOnFocus`: focus (or a click) on the field opens the panel and searches at once. */
  protected onInputFocus(): void {
    if (!this.openOnFocus() || this.closing || this.open() || !this.interactive()) return;
    const text = this.query();
    if (text.length < this.minQueryLength()) return;
    clearTimeout(this.searchTimer);
    this.search(text);
    this.openPanel();
  }

  override closePanel(focusTrigger = true): void {
    this.closing = true;
    try {
      super.closePanel(focusTrigger);
    } finally {
      this.closing = false;
    }
  }

  /** Focus moved into the trailing slot (for example a button): the panel closes. */
  protected onAddonFocusin(): void {
    if (this.open()) this.dismiss();
  }

  /** Starts a search: `completeMethod`, and the `suggestionLoader` when one is set. */
  private search(query: string): void {
    // The same text after a failed load: the params do not change, so reload explicitly.
    if (this.searched() === query && this.loaded.status() === 'error') this.loaded.reload();
    this.searched.set(query);
    this.completeMethod.emit({ query });
  }

  protected showAllOptions(): void {
    if (!this.interactive()) return;
    if (this.panelVisible()) {
      this.closePanel();
      return;
    }
    this.showAll.set(true);
    this.search('');
    this.openPanel();
    this.focus();
  }

  protected override onOutsideClick(event: MouseEvent): void {
    if (this.control().nativeElement.contains(event.target as Node)) return;
    // Focus that left the panel for an element outside has closed it already.
    if (!this.open()) return;
    this.dismiss();
  }

  protected override dismiss(): void {
    this.closePanel(false);
    this.onBlurCommit();
    this.touch.emit();
  }

  protected onInputBlur(): void {
    if (this.panelVisible()) return;
    this.onBlurCommit();
    this.touch.emit();
  }

  /** Called on blur: subclasses apply force-selection rules. */
  protected abstract onBlurCommit(): void;

  protected override onKeydown(event: KeyboardEvent): void {
    // Home / End move the caret in the text field; Enter on a closed list submits the form.
    if (event.key === 'Home' || event.key === 'End') return;
    if (event.key === 'Enter' && !this.panelVisible()) return;
    if (event.key === 'ArrowDown' && !this.open() && !this.queryLongEnough()) return;
    super.onKeydown(event);
  }

  /**
   * Sets the field text. Also writes the DOM: the `[value]` binding does not update when the
   * signal returns to the value it last rendered (typed text in between is not a signal write).
   */
  protected setText(text: string): void {
    this.query.set(text);
    (this.trigger().nativeElement as HTMLInputElement).value = text;
  }

  /** Splits a label around the typed text for `<mark>` highlighting. */
  protected highlight(label: string): readonly [string, string, string] {
    const query = this.query().trim();
    const index = query ? label.toLocaleLowerCase().indexOf(query.toLocaleLowerCase()) : -1;
    if (index < 0) return [label, '', ''];
    return [
      label.slice(0, index),
      label.slice(index, index + query.length),
      label.slice(index + query.length),
    ];
  }

  /** The empty slot gets the typed text: the autocomplete has no separate filter field. */
  protected override emptyContext(): StarEmptyContext {
    return { $implicit: this.query() };
  }

  protected chips(): readonly Chip<TValue>[] {
    return [];
  }
  /** `@for` entries of the chips, keyed by the value, or its occurrence when it repeats. */
  protected readonly chipEntries = computed(() => {
    const chips = this.chips();
    return ɵstarKeyed(chips.map((chip) => chip.value)).map((entry, i) => ({
      key: entry.key,
      item: chips[i],
    }));
  });
}

const TEMPLATE = `
  <div data-star-part="controlPanel" #control class="star-select__control star-ac__control" cdkOverlayOrigin #origin="cdkOverlayOrigin">
    @if (leadingSlot(); as leading) {
      <div data-star-part="leadingPanel" class="star-ac__addon star-ac__addon--leading">
        <ng-container *ngTemplateOutlet="leading; context: addonContext()" />
      </div>
    }
    <div data-star-part="mainPanel" class="star-ac__main">
      @if (isMultiple) {
        @for (entry of chipEntries(); track entry.key) {
          @let chip = entry.item;
          <span data-star-part="chipPanel" class="star-chip star-chip--sm" animate.leave="star-chip--leaving">
            {{ chip.label }}
            @if (interactive()) {
              <button data-star-part="removeButton"
                type="button"
                class="star-chip__remove"
                tabindex="-1"
                [attr.aria-label]="text.removeItem(chip.label)"
                (click)="removeChip($index)"
              >
                <i data-star-part="removeIcon" class="ph-bold ph-x" aria-hidden="true"></i>
              </button>
            }
          </span>
        }
      }
      <input data-star-part="input"
        #trigger
        type="text"
        class="star-ac__input"
        role="combobox"
        aria-autocomplete="list"
        autocomplete="off"
        [id]="inputId()"
        [attr.name]="name() || null"
        [value]="query()"
        [attr.placeholder]="placeholder()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="ariaLabelledBy()"
        [attr.aria-required]="required() || null"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-busy]="fieldBusy()"
        [attr.aria-invalid]="showInvalid() || null"
        [attr.aria-expanded]="panelVisible()"
        [attr.aria-controls]="panelVisible() ? listId : null"
        [attr.aria-activedescendant]="panelVisible() ? activeId() : null"
        (input)="onQuery(trigger.value)"
        (keydown)="onKeydown($event)"
        (focus)="onInputFocus()"
        (click)="onInputFocus()"
        (blur)="onInputBlur()"
      />
    </div>
    @if (busy()) {
      <i data-star-part="loadingIcon" class="ph-bold ph-spinner-gap star-spin star-select__caret" aria-hidden="true"></i>
    }
    @if (showClear() && hasValue() && interactive()) {
      <button data-star-part="clearButton" type="button" class="star-select__icon-btn" [attr.aria-label]="text.clear" (click)="clear()">
        <i data-star-part="clearIcon" class="ph-bold ph-x" aria-hidden="true"></i>
      </button>
    }
    @if (dropdown()) {
      <button data-star-part="clearButton"
        type="button"
        class="star-select__icon-btn"
        tabindex="-1"
        [attr.aria-label]="text.showOptions"
        [disabled]="!interactive()"
        (click)="showAllOptions()"
      >
        <i data-star-part="dropdownIcon" class="ph-bold ph-caret-down" aria-hidden="true"></i>
      </button>
    }
    @if (trailingSlot(); as trailing) {
      <div data-star-part="trailingPanel" class="star-ac__addon star-ac__addon--trailing" (focusin)="onAddonFocusin()">
        <ng-container *ngTemplateOutlet="trailing; context: addonContext()" />
      </div>
    }
  </div>
  <span class="star-sr-only" aria-live="polite">{{ liveText() }}</span>

  <ng-template
    cdkConnectedOverlay
    [cdkConnectedOverlayUsePopover]="popoverLocation()"
    cdkConnectedOverlayMatchWidth
    [cdkConnectedOverlayOrigin]="origin"
    [cdkConnectedOverlayOpen]="panelVisible()"
    [cdkConnectedOverlayPositions]="positions"
    (attach)="onPanelAttached()"
    (detach)="closePanel(false)"
    (overlayOutsideClick)="onOutsideClick($event)"
  >
    <!-- The panel handles keys and focus that bubble up from its header and footer. -->
    <div starPart="panel"
      class="star-panel"
      [class]="panelClasses()"
      (animate.leave)="leavePanel($event)"
      [style]="panelStyle()"
      (mousedown)="onPanelMousedown($event)"
      (keydown)="onPanelKeydown($event)"
      (focusin)="onPanelFocusin($event)"
      (focusout)="onPanelFocusout($event)"
    >
      @if (headerSlot(); as header) {
        <div data-star-part="headerSlotPanel" class="star-panel__header">
          <ng-container *ngTemplateOutlet="header" />
        </div>
      }
      <ul data-star-part="optionList"
        class="star-listbox"
        role="listbox"
        [id]="listId"
        [class.star-listbox--virtual]="virtualScroll()"
        [style.--star-item-size.px]="virtualScroll() ? virtualItemSize() : null"
        [style.max-height]="scrollHeight()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-labelledby]="labelledBy()"
        [attr.aria-busy]="lazyBusy() || null"
        (scroll)="onListScroll($event)"
      >
        @if (loadingRow(); as loader) {
          <li data-star-part="emptyItem" class="star-listbox__empty" role="presentation">
            <ng-container *ngTemplateOutlet="loader" />
          </li>
        }
        @if (virtualWindow().before) {
          <li data-star-part="spacerItem" class="star-listbox__spacer" role="presentation" [style.height.px]="virtualWindow().before"></li>
        }
        @for (row of renderedRows(); track row.key) {
          @if (row.kind === 'group') {
            <li data-star-part="groupItem" class="star-listbox__group" role="presentation" [id]="row.id">
              @if (groupSlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: groupContext(row.label)" />
              } @else {
                <ng-container>{{ row.label }}</ng-container>
              }
            </li>
          } @else {
          @let option = row.option;
          @let i = row.index;
          <!-- Keyboard is handled on the combobox via aria-activedescendant (WAI-ARIA combobox pattern). -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li data-star-part="option"
            class="star-listbox__option"
            role="option"
            [id]="optionId(i)"
            [class.star-listbox__option--active]="activeIndex() === i"
            [class.star-listbox__option--loading]="option === undefined"
            [attr.aria-selected]="activeIndex() === i"
            [attr.aria-disabled]="isDisabled(option) || null"
            [attr.aria-describedby]="describedBy(row)"
            [attr.aria-setsize]="virtualScroll() ? visibleOptions().length : null"
            [attr.aria-posinset]="virtualScroll() ? i + 1 : null"
            (click)="onOptionClick(option, i)"
            (mousemove)="onOptionHover(i)"
          >
            @if (iconOf(option); as icon) {
              <i data-star-part="optionIcon" [class]="icon + ' star-ac__option-icon'" aria-hidden="true"></i>
            }
            <span data-star-part="label" class="star-listbox__label">
              @if (option === undefined) {
                <span data-star-part="skeletonText" class="star-skeleton star-listbox__skeleton" aria-hidden="true"></span>
                <span class="star-sr-only">{{ text.loading }}</span>
              } @else if (optionTemplate(); as custom) {
                <ng-container *ngTemplateOutlet="custom.template; context: optionContext(option, i)" />
              } @else {
                @let parts = highlight(labelOf(option));
                {{ parts[0] }}<mark data-star-part="matchText" class="star-ac__match">{{ parts[1] }}</mark>{{ parts[2] }}
              }
            </span>
          </li>
          }
        } @empty {
          @if (!loadingRow() && customRow() === null) {
            <li data-star-part="emptyItem" class="star-listbox__empty" role="presentation">
              @if (loadFailed() && !busy()) {
                {{ text.searchFailed }}
              } @else if (emptySlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
              } @else {
                <ng-container>{{ busy() ? text.searching : emptyText() }}</ng-container>
              }
            </li>
          }
        }
        @if (virtualWindow().after) {
          <li data-star-part="spacerItem" class="star-listbox__spacer" role="presentation" [style.height.px]="virtualWindow().after"></li>
        }
        @if (customRow(); as custom) {
          <!-- Keyboard is handled on the combobox via aria-activedescendant (WAI-ARIA combobox pattern). -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li data-star-part="option"
            class="star-listbox__option star-listbox__option--add"
            role="option"
            [id]="addRowId"
            [class.star-listbox__option--active]="isAddRow(activeIndex())"
            [attr.aria-selected]="isAddRow(activeIndex())"
            (click)="addCustom(custom)"
            (mousemove)="onOptionHover(visibleOptions().length)"
          >
            <i data-star-part="optionIcon" class="ph-bold ph-plus" aria-hidden="true"></i>
            <span data-star-part="label" class="star-listbox__label">{{ text.addCustomValue(custom) }}</span>
          </li>
        }
      </ul>
      @if (footerSlot(); as footer) {
        <div data-star-part="footerSlotPanel" class="star-panel__footer">
          <ng-container *ngTemplateOutlet="footer" />
        </div>
      }
    </div>
  </ng-template>
`;

const HOST = {
  class: 'star-select star-ac',
  '[class.star-select--open]': 'panelVisible()',
  '[class.star-select--disabled]': 'disabled()',
  '[class.star-select--invalid]': 'showInvalid()',
  // `size` (from StarOptionListBase): `star-select--sm` shares the small rules of the select
  // family, `star-ac--sm` is the hook of the autocomplete-only rules (input, chips, icon field).
  '[class.star-select--sm]': "size() === 'sm'",
  '[class.star-ac--sm]': "size() === 'sm'",
};

/**
 * Autocomplete (PrimeNG `p-autocomplete`). Local mode filters `options`; server mode listens
 * to `(completeMethod)` and shows `[suggestions]`. Only listed options can be chosen: on blur an
 * exact label match is taken, and other text reverts to the label of the value (or clears it with
 * `forceSelection`).
 *
 * ```html
 * <star-autocomplete [suggestions]="results()" (completeMethod)="find($event.query)" [loading]="busy()"
 *                   optionLabel="name" [formField]="form.assignee" />
 * ```
 */
@Component({
  selector: 'star-autocomplete',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarAutoComplete) }],
  host: HOST,
  template: TEMPLATE,
})
export class StarAutoComplete<TOption = unknown, TValue = TOption>
  extends StarAutoCompleteBase<TOption, TValue>
  implements FormValueControl<TValue | null>
{
  readonly value = model<TValue | null>(null);
  /** An option was chosen. Same as `optionSelect` (kept for compatibility). */
  readonly selected = output<TOption>();
  /**
   * On blur, text that is no option label clears the text and the value (PrimeNG
   * `forceSelection`). Default `false`: the text goes back to the label of the value.
   */
  readonly forceSelection = input(false, { transform: booleanAttribute });
  /**
   * Fires before the value changes by a user action. Call `cancel()` on the event to keep the old
   * value. Ignite UI combo `selectionChanging`.
   */
  readonly selectionChanging = output<StarSelectionChangingEvent<TValue | null>>();
  /**
   * Free-text search mode: the value is the typed text (a string), and the options only help to
   * fill it in. Typing sets the value (without `selectionChanging`); choosing an option sets the
   * value to the label of the option and emits `optionSelect`. Blur keeps the text (`forceSelection`
   * does not apply). Enter with no highlighted option emits `submitted` and does not choose an
   * option; it is not cancelled, so a surrounding form still submits. Clear sets the value to `''`.
   * Default `false`.
   */
  readonly freeText = input(false, { transform: booleanAttribute });
  /**
   * `freeText`: the user submitted the typed text, with Enter while no option is highlighted, or
   * through `submit()` (for example a Search button in the `starAutoCompleteTrailing` slot). Does not
   * fire for blank text.
   */
  readonly submitted = output<string>();

  protected readonly isMultiple = false;
  protected readonly hasValue = computed(() => {
    const value = this.value();
    return (value !== null && !(this.freeText() && value === '')) || !!this.query();
  });

  protected queryFromValue(): string {
    const value = this.value();
    if (value === null) return '';
    return this.freeText() ? String(value) : this.labelForValue(value);
  }

  /** `freeText`: the typed text is the value. */
  protected override onQuery(text: string): void {
    super.onQuery(text);
    if (this.freeText()) this.value.set(text as TValue);
  }

  /**
   * Emits `submitted` with the typed text and closes the panel. Does nothing for blank text or when
   * the control is disabled or read-only.
   */
  submit(): void {
    const text = this.query();
    if (!this.interactive() || !text.trim()) return;
    this.closePanel(false);
    this.submitted.emit(text);
  }

  protected override onKeydown(event: KeyboardEvent): void {
    if (
      this.freeText() &&
      event.key === 'Enter' &&
      !event.isComposing &&
      !(this.panelVisible() && this.activeIndex() >= 0)
    ) {
      this.submit();
      return;
    }
    super.onKeydown(event);
  }

  protected isSelected(option: TOption): boolean {
    const value = this.value();
    return option !== undefined && value !== null && this.equals(this.valueOf(option), value);
  }

  protected choose(option: TOption): void {
    this.remember(option);
    const next = this.freeText() ? (this.labelOf(option) as TValue) : this.valueOf(option);
    if (!this.change(next)) {
      this.setText(this.queryFromValue());
      return;
    }
    this.setText(this.labelOf(option));
    this.selected.emit(option);
    this.optionSelect.emit(option);
  }

  /** Sets the value after `selectionChanging`; `false` when a handler cancelled. */
  private change(next: TValue | null): boolean {
    const previous = this.value();
    const same =
      previous === next || (previous !== null && next !== null && this.equals(previous, next));
    if (same) return true;
    if (!ɵstarSelectionChanging(this.selectionChanging, previous, next)) return false;
    this.value.set(next);
    return true;
  }

  protected onBlurCommit(): void {
    // Free text: the typed text is the value already.
    if (this.freeText()) return;
    const text = this.query().trim();
    if (!text) {
      const previous = this.value();
      if (!this.change(null)) this.setText(this.queryFromValue());
      else if (previous !== null) this.optionUnselect.emit(previous);
      return;
    }
    if (text === this.queryFromValue()) return;
    const exact = this.visibleOptions().find(
      (option) =>
        !this.isDisabled(option) &&
        this.labelOf(option).toLocaleLowerCase() === text.toLocaleLowerCase(),
    );
    if (exact !== undefined) this.choose(exact);
    else if (this.forceSelection()) this.clearOnBlur();
    else this.setText(this.queryFromValue());
  }

  /** `forceSelection`: clears the text and the value, as an empty field does. */
  private clearOnBlur(): void {
    const previous = this.value();
    if (!this.change(null)) {
      this.setText(this.queryFromValue());
      return;
    }
    this.setText('');
    if (previous !== null) this.optionUnselect.emit(previous);
  }

  /** Single mode shows no chips; kept so both components share one template. */
  protected removeChip(_index: number): void {
    this.clear();
  }

  clear(): void {
    const previous = this.value();
    const free = this.freeText();
    if (!this.change(free ? ('' as TValue) : null)) return;
    if (previous !== null && !free) this.optionUnselect.emit(previous);
    this.setText('');
    this.focus();
  }
}

/**
 * Multiple-value autocomplete (PrimeNG `p-autocomplete [multiple]`): chosen items become
 * removable chips, Backspace in an empty field removes the last chip, chosen options leave
 * the result list.
 */
@Component({
  selector: 'star-multi-autocomplete',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMultiAutoComplete) }],
  host: { ...HOST, class: 'star-select star-ac star-ac--multi' },
  template: TEMPLATE,
})
export class StarMultiAutoComplete<TOption = unknown, TValue = TOption>
  extends StarAutoCompleteBase<TOption, TValue>
  implements FormValueControl<readonly TValue[]>
{
  readonly value = model<readonly TValue[]>([]);
  /** Maximum number of chips (0 = no limit). */
  readonly selectionLimit = input(0);
  /**
   * A row "Add “text”" at the end of the list adds the typed text as a new value (a string) when no
   * option has that label. `customValueAdd` fires. Ignite UI combo `allowCustomValues`.
   */
  readonly allowCustomValues = input(false, { transform: booleanAttribute });
  /** With `allowCustomValues`: the text that became a new value. Ignite UI combo `addition`. */
  readonly customValueAdd = output<string>();
  /**
   * Fires before the value changes by a user action. Call `cancel()` on the event to keep the old
   * value. Ignite UI combo `selectionChanging`.
   */
  readonly selectionChanging = output<StarSelectionChangingEvent<readonly TValue[]>>();
  /**
   * A value appears once (default `true`): chosen options leave the list. Off: an option can be
   * chosen again. PrimeNG `unique`.
   */
  readonly unique = input(true, { transform: booleanAttribute });
  /**
   * Typed text becomes a chip when the field loses focus (PrimeNG `addOnBlur`). The text must be an
   * option label, or any text with `allowCustomValues`.
   */
  readonly addOnBlur = input(false, { transform: booleanAttribute });
  /** Typed text becomes a chip on Tab; focus then stays in the field (PrimeNG `addOnTab`). */
  readonly addOnTab = input(false, { transform: booleanAttribute });
  /**
   * Text or pattern that ends a chip while typing, for example `','` or `/[,;]/` (PrimeNG
   * `separator`). Typed or pasted text is split there; each part becomes a chip as with `addOnBlur`.
   */
  readonly separator = input<string | RegExp | null>(null);

  protected readonly isMultiple = true;
  protected readonly hasValue = computed(() => this.value().length > 0);

  protected queryFromValue(): string {
    return '';
  }

  protected override chips(): readonly Chip<TValue>[] {
    return this.value().map((value) => ({ value, label: this.labelForValue(value) }));
  }

  protected isSelected(option: TOption): boolean {
    if (option === undefined) return false;
    const optionValue = this.valueOf(option);
    return this.value().some((value) => this.equals(value, optionValue));
  }

  protected override hidesChosen(): boolean {
    return this.unique();
  }

  protected choose(option: TOption): void {
    const limit = this.selectionLimit();
    if ((this.unique() && this.isSelected(option)) || (limit > 0 && this.value().length >= limit)) {
      return;
    }
    this.remember(option);
    if (!this.changeWith((values) => [...values, this.valueOf(option)])) return;
    this.setText('');
    this.optionSelect.emit(option);
  }

  protected onBlurCommit(): void {
    if (this.addOnBlur()) this.addToken(this.query());
    this.setText('');
  }

  /**
   * Makes a chip from typed text: the option with that label (case does not count), or the text
   * itself with `allowCustomValues`. Returns `true` when a chip was added.
   */
  private addToken(raw: string): boolean {
    const text = raw.trim();
    if (!text || !this.interactive()) return false;
    const lower = text.toLocaleLowerCase();
    const option = [...(this.remote() ?? []), ...this.options()].find(
      (o) =>
        o !== undefined && !this.isDisabled(o) && this.labelOf(o).toLocaleLowerCase() === lower,
    );
    const before = this.value().length;
    if (option !== undefined) this.choose(option);
    else if (this.allowCustomValues() && !this.customTaken(text)) this.addCustom(text);
    return this.value().length > before;
  }

  /** With `separator`: each finished part of the text becomes a chip; the rest stays typed. */
  protected override onQuery(text: string): void {
    const separator = this.separator();
    const parts = separator === null || separator === '' ? [text] : text.split(separator);
    if (parts.length > 1) {
      const rest = parts.pop() ?? '';
      for (const part of parts) this.addToken(part);
      this.setText(rest);
      text = rest;
    }
    super.onQuery(text);
  }

  protected override customRowText(): string | null {
    const text = this.query().trim();
    return this.allowCustomValues() && text && !this.customTaken(text) ? text : null;
  }

  /** True when an option has the text as label, or (with `unique`) a chip has it. */
  private customTaken(text: string): boolean {
    const lower = text.toLocaleLowerCase();
    return (
      [...(this.remote() ?? []), ...this.options()].some(
        (option) => option !== undefined && this.labelOf(option).toLocaleLowerCase() === lower,
      ) ||
      (this.unique() &&
        this.value().some((value) => this.labelForValue(value).toLocaleLowerCase() === lower))
    );
  }

  protected override addCustom(text: string): void {
    const limit = this.selectionLimit();
    if (!this.interactive() || (limit > 0 && this.value().length >= limit)) return;
    if (!this.changeWith((values) => [...values, text as unknown as TValue])) return;
    this.customValueAdd.emit(text);
    this.setText('');
  }

  protected override onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.query() && this.value().length && this.interactive()) {
      this.removeChip(this.value().length - 1, false);
      return;
    }
    if (
      event.key === 'Tab' &&
      !event.shiftKey &&
      this.addOnTab() &&
      this.activeIndex() < 0 &&
      this.addToken(this.query())
    ) {
      // The chip is added and focus stays in the field for the next one.
      event.preventDefault();
      this.closePanel(false);
      return;
    }
    super.onKeydown(event);
  }

  /** Removes the chip at `index` (a value can be there twice when `unique` is off). */
  protected removeChip(index: number, focus = true): void {
    const value = this.value()[index];
    if (value === undefined) return;
    if (!this.changeWith((values) => values.filter((_, i) => i !== index))) return;
    this.optionUnselect.emit(value);
    if (focus) this.focus();
  }

  clear(): void {
    if (this.value().length && !this.changeWith(() => [])) return;
    this.setText('');
    this.focus();
  }

  /** Sets the value to `update(value)` after `selectionChanging`; `false` when a handler cancelled. */
  private changeWith(update: (values: readonly TValue[]) => readonly TValue[]): boolean {
    const previous = this.value();
    const next = update(previous);
    if (!ɵstarSelectionChanging(this.selectionChanging, previous, next)) return false;
    this.value.set(next);
    return true;
  }
}
