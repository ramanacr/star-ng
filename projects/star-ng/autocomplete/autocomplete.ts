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
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_SLOT_HOST, type StarEmptyContext } from '@star-ng/ui/core';
import {
  StarOptionListBase,
  starSelectionChanging,
  StarSelectionChangingEvent,
} from '@star-ng/ui/select';

export interface StarAutoCompleteSearch {
  readonly query: string;
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

  /** Fires (debounced) when the user types; load `suggestions` in reply (PrimeNG `completeMethod`). */
  readonly completeMethod = output<StarAutoCompleteSearch>();

  protected readonly closeOnChoose = true;
  protected abstract readonly isMultiple: boolean;
  protected readonly control = viewChild.required<ElementRef<HTMLElement>>('control');

  /** Options the user picked, so labels survive when the result list changes. */
  protected readonly known = signal<readonly TOption[]>([]);
  private readonly showAll = signal(false);
  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  protected abstract queryFromValue(): string;
  /** Typed text. Resets to the selected label when the value changes. */
  protected readonly query = linkedSignal(() => this.queryFromValue());

  protected override readonly visibleOptions = computed(() => {
    const remote = this.suggestions();
    const query = this.query();
    const candidates =
      remote ??
      (this.showAll() || !query || this.lazy()
        ? this.options()
        : this.options().filter((option) => this.matchesQuery(option, query)));
    return this.groupedOrder(
      this.isMultiple ? candidates.filter((option) => !this.isSelected(option)) : candidates,
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
        this.loading() ||
        this.showEmptyMessage()),
  );

  protected readonly liveText = computed(() => {
    if (!this.panelVisible()) return '';
    if (this.loading()) return this.text.searching;
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
    const pools = [this.known(), this.suggestions() ?? [], this.options()];
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
    this.searchTimer = setTimeout(() => this.completeMethod.emit({ query: text }), this.delay());
  }

  protected showAllOptions(): void {
    if (!this.interactive()) return;
    if (this.panelVisible()) {
      this.closePanel();
      return;
    }
    this.showAll.set(true);
    this.completeMethod.emit({ query: '' });
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
}

const TEMPLATE = `
  <div #control class="star-select__control star-ac__control" cdkOverlayOrigin #origin="cdkOverlayOrigin">
    <div class="star-ac__main">
      @if (isMultiple) {
        @for (chip of chips(); track $index) {
          <span class="star-chip star-chip--sm">
            {{ chip.label }}
            @if (interactive()) {
              <button
                type="button"
                class="star-chip__remove"
                tabindex="-1"
                [attr.aria-label]="text.removeItem(chip.label)"
                (click)="removeValue(chip.value)"
              >
                <i class="ph-bold ph-x" aria-hidden="true"></i>
              </button>
            }
          </span>
        }
      }
      <input
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
        [attr.aria-invalid]="showInvalid() || null"
        [attr.aria-expanded]="panelVisible()"
        [attr.aria-controls]="panelVisible() ? listId : null"
        [attr.aria-activedescendant]="panelVisible() ? activeId() : null"
        (input)="onQuery(trigger.value)"
        (keydown)="onKeydown($event)"
        (blur)="onInputBlur()"
      />
    </div>
    @if (loading()) {
      <i class="ph-bold ph-spinner-gap star-spin star-select__caret" aria-hidden="true"></i>
    }
    @if (showClear() && hasValue() && interactive()) {
      <button type="button" class="star-select__icon-btn" [attr.aria-label]="text.clear" (click)="clear()">
        <i class="ph-bold ph-x" aria-hidden="true"></i>
      </button>
    }
    @if (dropdown()) {
      <button
        type="button"
        class="star-select__icon-btn"
        tabindex="-1"
        [attr.aria-label]="text.showOptions"
        [disabled]="!interactive()"
        (click)="showAllOptions()"
      >
        <i class="ph-bold ph-caret-down" aria-hidden="true"></i>
      </button>
    }
  </div>
  <span class="star-sr-only" aria-live="polite">{{ liveText() }}</span>

  <ng-template
    cdkConnectedOverlay
    cdkConnectedOverlayUsePopover="inline"
    cdkConnectedOverlayMatchWidth
    [cdkConnectedOverlayOrigin]="origin"
    [cdkConnectedOverlayOpen]="panelVisible()"
    [cdkConnectedOverlayPositions]="positions"
    (attach)="onPanelAttached()"
    (detach)="closePanel(false)"
    (overlayOutsideClick)="onOutsideClick($event)"
  >
    <!-- The panel handles keys and focus that bubble up from its header and footer. -->
    <div
      class="star-panel"
      (mousedown)="onPanelMousedown($event)"
      (keydown)="onPanelKeydown($event)"
      (focusin)="onPanelFocusin($event)"
      (focusout)="onPanelFocusout($event)"
    >
      @if (headerSlot(); as header) {
        <ng-container *ngTemplateOutlet="header" />
      }
      <ul
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
          <li class="star-listbox__empty" role="presentation">
            <ng-container *ngTemplateOutlet="loader" />
          </li>
        }
        @if (virtualWindow().before) {
          <li class="star-listbox__spacer" role="presentation" [style.height.px]="virtualWindow().before"></li>
        }
        @for (row of renderedRows(); track row.key) {
          @if (row.kind === 'group') {
            <li class="star-listbox__group" role="presentation" [id]="row.id">
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
          <li
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
            <span class="star-listbox__label">
              @if (option === undefined) {
                <span class="star-skeleton star-listbox__skeleton" aria-hidden="true"></span>
                <span class="star-sr-only">{{ text.loading }}</span>
              } @else if (optionTemplate(); as custom) {
                <ng-container *ngTemplateOutlet="custom.template; context: optionContext(option, i)" />
              } @else {
                @let parts = highlight(labelOf(option));
                {{ parts[0] }}<mark class="star-ac__match">{{ parts[1] }}</mark>{{ parts[2] }}
              }
            </span>
          </li>
          }
        } @empty {
          @if (!loadingRow() && customRow() === null) {
            <li class="star-listbox__empty" role="presentation">
              @if (emptySlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
              } @else {
                <ng-container>{{ loading() ? text.searching : emptyText() }}</ng-container>
              }
            </li>
          }
        }
        @if (virtualWindow().after) {
          <li class="star-listbox__spacer" role="presentation" [style.height.px]="virtualWindow().after"></li>
        }
        @if (customRow(); as custom) {
          <!-- Keyboard is handled on the combobox via aria-activedescendant (WAI-ARIA combobox pattern). -->
          <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
          <li
            class="star-listbox__option star-listbox__option--add"
            role="option"
            [id]="addRowId"
            [class.star-listbox__option--active]="isAddRow(activeIndex())"
            [attr.aria-selected]="isAddRow(activeIndex())"
            (click)="addCustom(custom)"
            (mousemove)="onOptionHover(visibleOptions().length)"
          >
            <i class="ph-bold ph-plus" aria-hidden="true"></i>
            <span class="star-listbox__label">{{ text.addCustomValue(custom) }}</span>
          </li>
        }
      </ul>
      @if (footerSlot(); as footer) {
        <ng-container *ngTemplateOutlet="footer" />
      }
    </div>
  </ng-template>
`;

const HOST = {
  class: 'star-select star-ac',
  '[class.star-select--open]': 'panelVisible()',
  '[class.star-select--disabled]': 'disabled()',
  '[class.star-select--invalid]': 'showInvalid()',
  '[class.star-select--sm]': "size() === 'sm'",
};

/**
 * Autocomplete (PrimeNG `p-autocomplete`). Local mode filters `options`; server mode listens
 * to `(completeMethod)` and shows `[suggestions]`. Only listed options can be chosen
 * (force selection): unmatched text reverts on blur, an exact label match is taken.
 *
 * ```html
 * <star-autocomplete [suggestions]="results()" (completeMethod)="find($event.query)" [loading]="busy()"
 *                   optionLabel="name" [formField]="form.assignee" />
 * ```
 */
@Component({
  selector: 'star-autocomplete',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
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
  readonly selected = output<TOption>();
  /**
   * Fires before the value changes by a user action. Call `cancel()` on the event to keep the old
   * value. Ignite UI combo `selectionChanging`.
   */
  readonly selectionChanging = output<StarSelectionChangingEvent<TValue | null>>();

  protected readonly isMultiple = false;
  protected readonly hasValue = computed(() => this.value() !== null || !!this.query());

  protected queryFromValue(): string {
    const value = this.value();
    return value === null ? '' : this.labelForValue(value);
  }

  protected isSelected(option: TOption): boolean {
    const value = this.value();
    return value !== null && this.equals(this.valueOf(option), value);
  }

  protected choose(option: TOption): void {
    this.remember(option);
    if (!this.change(this.valueOf(option))) {
      this.setText(this.queryFromValue());
      return;
    }
    this.setText(this.labelOf(option));
    this.selected.emit(option);
  }

  /** Sets the value after `selectionChanging`; `false` when a handler cancelled. */
  private change(next: TValue | null): boolean {
    const previous = this.value();
    const same =
      previous === next || (previous !== null && next !== null && this.equals(previous, next));
    if (same) return true;
    if (!starSelectionChanging(this.selectionChanging, previous, next)) return false;
    this.value.set(next);
    return true;
  }

  protected onBlurCommit(): void {
    const text = this.query().trim();
    if (!text) {
      if (!this.change(null)) this.setText(this.queryFromValue());
      return;
    }
    if (text === this.queryFromValue()) return;
    const exact = this.visibleOptions().find(
      (option) =>
        !this.isDisabled(option) &&
        this.labelOf(option).toLocaleLowerCase() === text.toLocaleLowerCase(),
    );
    if (exact !== undefined) this.choose(exact);
    else this.setText(this.queryFromValue());
  }

  /** Single mode shows no chips; kept so both components share one template. */
  protected removeValue(_value: TValue): void {
    this.clear();
  }

  clear(): void {
    if (!this.change(null)) return;
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
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
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

  protected readonly isMultiple = true;
  protected readonly hasValue = computed(() => this.value().length > 0);

  protected queryFromValue(): string {
    return '';
  }

  protected override chips(): readonly Chip<TValue>[] {
    return this.value().map((value) => ({ value, label: this.labelForValue(value) }));
  }

  protected isSelected(option: TOption): boolean {
    const optionValue = this.valueOf(option);
    return this.value().some((value) => this.equals(value, optionValue));
  }

  protected choose(option: TOption): void {
    const limit = this.selectionLimit();
    if (this.isSelected(option) || (limit > 0 && this.value().length >= limit)) return;
    this.remember(option);
    if (!this.changeWith((values) => [...values, this.valueOf(option)])) return;
    this.setText('');
  }

  protected onBlurCommit(): void {
    this.setText('');
  }

  protected override customRowText(): string | null {
    const text = this.query().trim();
    if (!this.allowCustomValues() || !text) return null;
    const lower = text.toLocaleLowerCase();
    const taken =
      [...(this.suggestions() ?? []), ...this.options()].some(
        (option) => option !== undefined && this.labelOf(option).toLocaleLowerCase() === lower,
      ) || this.value().some((value) => this.labelForValue(value).toLocaleLowerCase() === lower);
    return taken ? null : text;
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
      this.changeWith((values) => values.slice(0, -1));
      return;
    }
    super.onKeydown(event);
  }

  protected removeValue(value: TValue): void {
    this.changeWith((values) => values.filter((v) => !this.equals(v, value)));
    this.focus();
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
    if (!starSelectionChanging(this.selectionChanging, previous, next)) return false;
    this.value.set(next);
    return true;
  }
}
