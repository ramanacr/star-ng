import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  linkedSignal,
  model,
  output,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_SLOT_HOST, StarPart, starSlot, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarOptionListBase } from './option-list-base';
import { StarSelectedContext } from './select-slots';
import { starSelectionChanging, StarSelectionChangingEvent } from './selection-changing';

/**
 * Single-choice dropdown (PrimeNG `p-select`): typed options, `optionLabel` / `optionValue` /
 * `optionDisabled`, filter, clear button, loading state, typeahead and full keyboard support
 * (WAI-ARIA select-only combobox). The panel is a native popover, so it also works inside
 * modal `star-dialog`s.
 *
 * ```html
 * <star-select [options]="countries" optionLabel="name" optionValue="code"
 *             [formField]="form.country" filter showClear placeholder="Country" />
 * ```
 */
@Component({
  selector: 'star-select',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarSelect) }],
  host: {
    class: 'star-select',
    '[class.star-select--open]': 'open()',
    '[class.star-select--disabled]': 'disabled()',
    '[class.star-select--invalid]': 'showInvalid()',
    '[class.star-select--sm]': "size() === 'sm'",
  },
  template: `
    <div
      data-star-part="controlPanel"
      class="star-select__control"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
    >
      @if (editable()) {
        <input
          data-star-part="triggerInput"
          #trigger
          type="text"
          class="star-select__trigger star-select__input"
          role="combobox"
          aria-autocomplete="list"
          autocomplete="off"
          [id]="inputId()"
          [attr.name]="name() || null"
          [value]="editText()"
          [disabled]="disabled()"
          [readOnly]="readonly()"
          [attr.placeholder]="placeholder() ?? text.selectPlaceholder"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="open() ? listId : null"
          [attr.aria-activedescendant]="activeId()"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="labelledBy()"
          [attr.aria-required]="required() || null"
          [attr.aria-describedby]="fieldDescribedBy()"
          [attr.aria-invalid]="showInvalid() || null"
          (click)="openPanel()"
          (input)="onEditInput(trigger.value)"
          (keydown)="onEditKeydown($event)"
          (blur)="onEditBlur()"
        />
      } @else {
        <div
          data-star-part="triggerPanel"
          #trigger
          class="star-select__trigger"
          role="combobox"
          aria-haspopup="listbox"
          [id]="inputId()"
          [attr.tabindex]="disabled() ? -1 : 0"
          [attr.aria-expanded]="open()"
          [attr.aria-controls]="open() ? listId : null"
          [attr.aria-activedescendant]="activeId()"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="labelledBy()"
          [attr.aria-required]="required() || null"
          [attr.aria-describedby]="fieldDescribedBy()"
          [attr.aria-invalid]="showInvalid() || null"
          [attr.aria-disabled]="disabled() || null"
          [attr.aria-readonly]="readonly() || null"
          (click)="toggle()"
          (keydown)="onKeydown($event)"
          (blur)="onTriggerBlur()"
        >
          @if (selectedOption(); as option) {
            <span data-star-part="valuePanel" class="star-select__value">
              @if (selectedSlot(); as custom) {
                <ng-container *ngTemplateOutlet="custom; context: { $implicit: option }" />
              } @else {
                <ng-container>{{ labelOf(option) }}</ng-container>
              }
            </span>
          } @else {
            <span data-star-part="placeholderText" class="star-select__placeholder">{{
              placeholder() ?? text.selectPlaceholder
            }}</span>
          }
        </div>
      }
      @if (showClear() && hasValue() && interactive()) {
        <button
          data-star-part="clearButton"
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="text.clear"
          (click)="clear()"
        >
          @if (iconSlot('clear'); as icon) {
            <span data-star-part="clearIcon" aria-hidden="true"
              ><ng-container *ngTemplateOutlet="icon"
            /></span>
          } @else {
            <i data-star-part="clearIcon" class="ph-bold ph-x" aria-hidden="true"></i>
          }
        </button>
      }
      @if (loading()) {
        <i
          data-star-part="dropdownIcon"
          class="ph-bold ph-spinner-gap star-spin star-select__caret"
          role="img"
          [attr.aria-label]="text.loading"
        ></i>
      } @else {
        @if (iconSlot('dropdown'); as icon) {
          <span data-star-part="dropdownIcon" class="star-select__caret" aria-hidden="true"
            ><ng-container *ngTemplateOutlet="icon"
          /></span>
        } @else {
          <i
            data-star-part="dropdownIcon"
            class="ph-bold ph-caret-down star-select__caret"
            aria-hidden="true"
          ></i>
        }
      }
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayUsePopover]="popoverLocation()"
      cdkConnectedOverlayMatchWidth
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (attach)="onPanelAttached()"
      (detach)="closePanel(false)"
      (overlayOutsideClick)="onOutsideClick($event)"
    >
      <!-- The panel handles keys and focus that bubble up from its header and footer. -->
      <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
      <div
        starPart="panel"
        class="star-panel"
        [class]="panelClasses()"
        [style]="panelStyle()"
        (mousedown)="onPanelMousedown($event)"
        (keydown)="onPanelKeydown($event)"
        (focusin)="onPanelFocusin($event)"
        (focusout)="onPanelFocusout($event)"
      >
        @if (headerSlot(); as header) {
          <div data-star-part="panelHeader" class="star-panel__header">
            <ng-container *ngTemplateOutlet="header" />
          </div>
        }
        @if (filter() && !editable()) {
          <div data-star-part="filterPanel" class="star-panel__filter">
            @if (iconSlot('filter'); as icon) {
              <span data-star-part="filterIcon" aria-hidden="true"
                ><ng-container *ngTemplateOutlet="icon"
              /></span>
            } @else {
              <i
                data-star-part="filterIcon"
                class="ph-bold ph-magnifying-glass"
                aria-hidden="true"
              ></i>
            }
            <input
              data-star-part="input"
              #filterInput
              type="text"
              class="star-input star-input--sm"
              role="searchbox"
              autocomplete="off"
              [value]="filterValue()"
              [attr.placeholder]="filterPlaceholder() ?? text.filterPlaceholder"
              [attr.aria-label]="filterPlaceholder() ?? text.filterPlaceholder"
              [attr.aria-controls]="listId"
              [attr.aria-activedescendant]="activeId()"
              (input)="onFilterInput(filterInput.value)"
              (keydown)="onKeydown($event)"
            />
          </div>
        }
        <ul
          data-star-part="optionList"
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
            <li
              data-star-part="spacerItem"
              class="star-listbox__spacer"
              role="presentation"
              [style.height.px]="virtualWindow().before"
            ></li>
          }
          @for (row of renderedRows(); track row.key) {
            @if (row.kind === 'group') {
              <li
                data-star-part="groupItem"
                class="star-listbox__group"
                role="presentation"
                [id]="row.id"
              >
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
                data-star-part="option"
                class="star-listbox__option"
                role="option"
                [id]="optionId(i)"
                [class.star-listbox__option--active]="activeIndex() === i"
                [class.star-listbox__option--loading]="option === undefined"
                [class.star-listbox__option--selected]="isSelected(option)"
                [attr.aria-selected]="isSelected(option)"
                [attr.aria-disabled]="isDisabled(option) || null"
                [attr.aria-describedby]="describedBy(row)"
                [attr.aria-setsize]="virtualScroll() ? visibleOptions().length : null"
                [attr.aria-posinset]="virtualScroll() ? i + 1 : null"
                (click)="onOptionClick(option, i)"
                (mousemove)="onOptionHover(i)"
              >
                <span data-star-part="label" class="star-listbox__label">
                  @if (option === undefined) {
                    <span
                      data-star-part="skeletonText"
                      class="star-skeleton star-listbox__skeleton"
                      aria-hidden="true"
                    ></span>
                    <span class="star-sr-only">{{ text.loading }}</span>
                  } @else if (optionTemplate(); as custom) {
                    <ng-container
                      *ngTemplateOutlet="custom.template; context: optionContext(option, i)"
                    />
                  } @else {
                    {{ labelOf(option) }}
                  }
                </span>
                @if (isSelected(option)) {
                  @if (iconSlot('check'); as icon) {
                    <span
                      data-star-part="selectedIcon"
                      class="star-listbox__check"
                      aria-hidden="true"
                      ><ng-container *ngTemplateOutlet="icon"
                    /></span>
                  } @else {
                    <i
                      data-star-part="selectedIcon"
                      class="ph-bold ph-check star-listbox__check"
                      aria-hidden="true"
                    ></i>
                  }
                }
              </li>
            }
          } @empty {
            @if (!loadingRow()) {
              <li data-star-part="emptyItem" class="star-listbox__empty" role="presentation">
                @if (emptySlot(); as custom) {
                  <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
                } @else {
                  <ng-container>{{ emptyText() }}</ng-container>
                }
              </li>
            }
          }
          @if (virtualWindow().after) {
            <li
              data-star-part="spacerItem"
              class="star-listbox__spacer"
              role="presentation"
              [style.height.px]="virtualWindow().after"
            ></li>
          }
        </ul>
        @if (footerSlot(); as footer) {
          <div data-star-part="panelFooter" class="star-panel__footer">
            <ng-container *ngTemplateOutlet="footer" />
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class StarSelect<TOption = unknown, TValue = TOption>
  extends StarOptionListBase<TOption, TValue>
  implements FormValueControl<TValue | null>
{
  readonly value = model<TValue | null>(null);
  /**
   * A combobox with a text field (PrimeNG `editable`): the typed text filters the options, and an
   * exact label chooses its option on Enter or blur. Other text becomes the value with
   * `allowCustomValue`, else the text goes back to the label of the value.
   */
  readonly editable = input(false, { transform: booleanAttribute });
  /**
   * With `editable`: typed text that is no option label becomes the value (as a string) on Enter or
   * blur, and `customValue` fires. Ignite UI combo `allowCustomValues` for one value.
   */
  readonly allowCustomValue = input(false, { transform: booleanAttribute });
  /** With `editable` and `allowCustomValue`: the typed text that became the value. */
  readonly customValue = output<string>();
  /**
   * Moving the active option with the keys also chooses it, and the panel stays open (default
   * `false`). PrimeNG `selectOnFocus`. Only on `star-select`: the multi-select toggles options and
   * the autocomplete would rewrite the typed text.
   */
  readonly selectOnFocus = input(false, { transform: booleanAttribute });
  /**
   * Fires before the value changes by a user action. Call `cancel()` on the event to keep the old
   * value. Ignite UI combo `selectionChanging`.
   */
  readonly selectionChanging = output<StarSelectionChangingEvent<TValue | null>>();

  protected readonly closeOnChoose = true;

  constructor() {
    super();
    // The trigger is a `div`, not a labelable element: the field label names it with
    // aria-labelledby, and a click on the label focuses it.
    this.linkField(() => this.focus());
  }

  protected readonly selectedSlot = starSlot<StarSelectedContext<TOption>>(
    this.slots,
    this,
    'selected',
  );

  /** The option that matches the current value, or `undefined`. */
  protected readonly selectedOption = computed(() => {
    const value = this.value();
    if (value === null) return undefined;
    return this.options().find(
      (option) => option !== undefined && this.equals(this.valueOf(option), value),
    );
  });

  /** True when there is a value to clear: an option, or a custom text of the editable select. */
  protected readonly hasValue = computed(
    () => this.selectedOption() !== undefined || (this.editable() && this.value() !== null),
  );

  /** Text of the value: the option label, or the custom text. */
  private readonly valueText = computed(() => {
    const option = this.selectedOption();
    if (option !== undefined) return this.labelOf(option);
    const value = this.value();
    return value === null || !this.allowCustomValue() ? '' : String(value);
  });

  /** Text of the editable field. Goes back to the text of the value when the value changes. */
  protected readonly editText = linkedSignal(() => this.valueText());

  protected override selectsOnFocus(): boolean {
    return this.selectOnFocus();
  }

  protected override filterOn(): boolean {
    return this.filter() || this.editable();
  }

  /** Sets the field text, in the signal and in the DOM (see the autocomplete `setText`). */
  private setEditText(text: string): void {
    this.editText.set(text);
    const field = this.trigger().nativeElement;
    if (field instanceof HTMLInputElement) field.value = text;
  }

  protected onEditInput(text: string): void {
    this.editText.set(text);
    this.openPanel();
    this.onFilterInput(text);
  }

  protected onEditKeydown(event: KeyboardEvent): void {
    // Home and End move the caret in the text field.
    if (event.key === 'Home' || event.key === 'End') return;
    if (event.key === 'Enter' && (!this.open() || this.activeIndex() < 0)) {
      event.preventDefault();
      this.commitEdit();
      this.closePanel();
      return;
    }
    this.onKeydown(event);
  }

  protected onEditBlur(): void {
    if (this.open()) return;
    this.commitEdit();
    this.touch.emit();
  }

  protected override dismiss(): void {
    super.dismiss();
    if (this.editable()) this.commitEdit();
  }

  /**
   * Applies the typed text: an exact option label chooses the option, an empty text clears the
   * value, other text becomes the value with `allowCustomValue`, or goes back to the value text.
   */
  private commitEdit(): void {
    if (!this.editable() || !this.interactive()) return;
    const text = this.editText().trim();
    if (text === this.valueText()) return;
    if (!text) {
      this.setEditText(this.change(null) ? '' : this.valueText());
      return;
    }
    const lower = text.toLocaleLowerCase();
    const exact = this.options().find(
      (option) =>
        option !== undefined &&
        !this.isDisabled(option) &&
        this.labelOf(option).toLocaleLowerCase() === lower,
    );
    if (exact !== undefined) {
      this.choose(exact);
    } else if (this.allowCustomValue() && this.change(text as unknown as TValue)) {
      this.customValue.emit(text);
      this.setEditText(text);
    } else {
      this.setEditText(this.valueText());
    }
  }

  protected isSelected(option: TOption): boolean {
    const value = this.value();
    return option !== undefined && value !== null && this.equals(this.valueOf(option), value);
  }

  protected choose(option: TOption): void {
    const changed = this.change(this.valueOf(option));
    if (this.editable()) this.setEditText(changed ? this.labelOf(option) : this.valueText());
  }

  /**
   * Sets the value after `selectionChanging`, and returns `false` when a handler cancelled. The
   * same value again fires no event.
   */
  private change(next: TValue | null): boolean {
    const previous = this.value();
    const same =
      previous === next || (previous !== null && next !== null && this.equals(previous, next));
    if (same) return true;
    if (!starSelectionChanging(this.selectionChanging, previous, next)) return false;
    this.value.set(next);
    return true;
  }

  protected initialActiveIndex(): number {
    const index = this.visibleOptions().findIndex((option) => this.isSelected(option));
    if (index >= 0) return index;
    return this.autoOptionFocus() ? this.firstEnabledFrom(0, 1) : -1;
  }

  clear(): void {
    if (!this.change(null)) return;
    if (this.editable()) this.setEditText('');
    this.focus();
  }
}
