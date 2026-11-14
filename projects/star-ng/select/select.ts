import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, model } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { StarOptionListBase } from './option-list-base';

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
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-select',
    '[class.star-select--open]': 'open()',
    '[class.star-select--disabled]': 'disabled()',
    '[class.star-select--invalid]': 'showInvalid()',
    '[class.star-select--sm]': "size() === 'sm'",
  },
  template: `
    <div class="star-select__control" cdkOverlayOrigin #origin="cdkOverlayOrigin">
      <div
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
        [attr.aria-labelledby]="ariaLabelledBy()"
        [attr.aria-required]="required() || null"
        [attr.aria-invalid]="showInvalid() || null"
        [attr.aria-disabled]="disabled() || null"
        [attr.aria-readonly]="readonly() || null"
        (click)="toggle()"
        (keydown)="onKeydown($event)"
        (blur)="onTriggerBlur()"
      >
        @if (selectedOption(); as option) {
          <span class="star-select__value">{{ labelOf(option) }}</span>
        } @else {
          <span class="star-select__placeholder">{{
            placeholder() ?? text.selectPlaceholder
          }}</span>
        }
      </div>
      @if (showClear() && selectedOption() !== undefined && interactive()) {
        <button
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="text.clear"
          (click)="clear()"
        >
          <i class="ph-bold ph-x" aria-hidden="true"></i>
        </button>
      }
      @if (loading()) {
        <i
          class="ph-bold ph-spinner-gap star-spin star-select__caret"
          [attr.aria-label]="text.loading"
        ></i>
      } @else {
        <i class="ph-bold ph-caret-down star-select__caret" aria-hidden="true"></i>
      }
    </div>

    <ng-template
      cdkConnectedOverlay
      cdkConnectedOverlayUsePopover="inline"
      cdkConnectedOverlayMatchWidth
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      (attach)="onPanelAttached()"
      (detach)="closePanel(false)"
      (overlayOutsideClick)="onOutsideClick($event)"
    >
      <div class="star-panel" (mousedown)="onPanelMousedown($event)">
        @if (filter()) {
          <div class="star-panel__filter">
            <i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
            <input
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
          class="star-listbox"
          role="listbox"
          [id]="listId"
          [class.star-listbox--virtual]="virtualScroll()"
          [style.--star-item-size.px]="virtualScroll() ? virtualItemSize() : null"
          [style.max-height]="scrollHeight()"
          [attr.aria-label]="ariaLabel()"
          [attr.aria-labelledby]="ariaLabelledBy()"
          (scroll)="onListScroll($event)"
        >
          @if (virtualWindow().before) {
            <li
              class="star-listbox__spacer"
              role="presentation"
              [style.height.px]="virtualWindow().before"
            ></li>
          }
          @for (row of renderedRows(); track row.key) {
            @if (row.kind === 'group') {
              <li class="star-listbox__group" role="presentation" [id]="row.id">{{ row.label }}</li>
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
                [class.star-listbox__option--selected]="isSelected(option)"
                [attr.aria-selected]="isSelected(option)"
                [attr.aria-disabled]="isDisabled(option) || null"
                [attr.aria-describedby]="row.groupId"
                [attr.aria-setsize]="virtualScroll() ? visibleOptions().length : null"
                [attr.aria-posinset]="virtualScroll() ? i + 1 : null"
                (click)="onOptionClick(option, i)"
                (mousemove)="isDisabled(option) || activeIndex.set(i)"
              >
                <span class="star-listbox__label">
                  @if (optionTemplate(); as custom) {
                    <ng-container
                      *ngTemplateOutlet="custom.template; context: optionContext(option, i)"
                    />
                  } @else {
                    {{ labelOf(option) }}
                  }
                </span>
                @if (isSelected(option)) {
                  <i class="ph-bold ph-check star-listbox__check" aria-hidden="true"></i>
                }
              </li>
            }
          } @empty {
            <li class="star-listbox__empty" role="presentation">{{ emptyText() }}</li>
          }
          @if (virtualWindow().after) {
            <li
              class="star-listbox__spacer"
              role="presentation"
              [style.height.px]="virtualWindow().after"
            ></li>
          }
        </ul>
      </div>
    </ng-template>
  `,
})
export class StarSelect<TOption = unknown, TValue = TOption>
  extends StarOptionListBase<TOption, TValue>
  implements FormValueControl<TValue | null>
{
  readonly value = model<TValue | null>(null);

  protected readonly closeOnChoose = true;

  /** The option that matches the current value, or `undefined`. */
  protected readonly selectedOption = computed(() => {
    const value = this.value();
    if (value === null) return undefined;
    return this.options().find((option) => this.equals(this.valueOf(option), value));
  });

  protected isSelected(option: TOption): boolean {
    const value = this.value();
    return value !== null && this.equals(this.valueOf(option), value);
  }

  protected choose(option: TOption): void {
    this.value.set(this.valueOf(option));
  }

  protected initialActiveIndex(): number {
    const index = this.visibleOptions().findIndex((option) => this.isSelected(option));
    return index >= 0 ? index : this.firstEnabledFrom(0, 1);
  }

  clear(): void {
    this.value.set(null);
    this.focus();
  }
}
