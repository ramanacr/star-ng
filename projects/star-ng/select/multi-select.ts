import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { StarOptionListBase } from './option-list-base';

/**
 * Multiple-choice dropdown (PrimeNG `p-multiselect`): checkbox list, "select all", filter,
 * chip or comma display, `maxSelectedLabels`, `selectionLimit` and clear. Same keyboard model
 * as `star-select`; Enter / Space toggle the active option and keep the panel open.
 *
 * `<star-multi-select [options]="tags" optionLabel="name" optionValue="id" [(value)]="ids" display="chip" filter />`
 */
@Component({
  selector: 'star-multi-select',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-select star-select--multi',
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
        @if (selectedOptions().length === 0) {
          <span class="star-select__placeholder">{{
            placeholder() ?? text.selectPlaceholder
          }}</span>
        } @else if (collapsed()) {
          <span class="star-select__value">{{ text.selectedItems(selectedOptions().length) }}</span>
        } @else if (display() === 'chip') {
          <span class="star-select__chips">
            @for (option of selectedOptions(); track $index) {
              <span class="star-chip star-chip--sm">
                {{ labelOf(option) }}
                @if (interactive()) {
                  <button
                    type="button"
                    class="star-chip__remove"
                    tabindex="-1"
                    [attr.aria-label]="text.removeItem(labelOf(option))"
                    (click)="$event.stopPropagation(); remove(option)"
                  >
                    <i class="ph-bold ph-x" aria-hidden="true"></i>
                  </button>
                }
              </span>
            }
          </span>
        } @else {
          <span class="star-select__value">{{ selectedLabels() }}</span>
        }
      </div>
      @if (showClear() && selectedOptions().length && interactive()) {
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
        @if (showToggleAll() || filter()) {
          <div class="star-panel__filter">
            @if (showToggleAll() && !selectionLimit()) {
              <button
                type="button"
                class="star-panel__toggle-all"
                role="checkbox"
                tabindex="-1"
                [attr.aria-checked]="allState()"
                [attr.aria-label]="text.selectAll"
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
            }
            @if (filter()) {
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
            } @else {
              <span class="star-panel__toggle-label">{{ text.selectAll }}</span>
            }
          </div>
        }
        <ul
          class="star-listbox"
          role="listbox"
          aria-multiselectable="true"
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
                <span class="star-check__box" aria-hidden="true">
                  @if (isSelected(option)) {
                    <i class="ph-bold ph-check"></i>
                  }
                </span>
                <span class="star-listbox__label">
                  @if (optionTemplate(); as custom) {
                    <ng-container
                      *ngTemplateOutlet="custom.template; context: optionContext(option, i)"
                    />
                  } @else {
                    {{ labelOf(option) }}
                  }
                </span>
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
export class StarMultiSelect<TOption = unknown, TValue = TOption>
  extends StarOptionListBase<TOption, TValue>
  implements FormValueControl<readonly TValue[]>
{
  readonly value = model<readonly TValue[]>([]);
  /** `comma`: "A, B, C". `chip`: removable chips. */
  readonly display = input<'comma' | 'chip'>('comma');
  /** Above this count the trigger shows "{n} items selected". */
  readonly maxSelectedLabels = input(3);
  /** Maximum number of selected items (0 = no limit). Hides "select all". */
  readonly selectionLimit = input(0);
  readonly showToggleAll = input(true);

  protected readonly closeOnChoose = false;

  protected readonly selectedOptions = computed(() =>
    this.options().filter((option) => this.isSelected(option)),
  );
  protected readonly collapsed = computed(
    () => this.selectedOptions().length > this.maxSelectedLabels(),
  );
  protected readonly selectedLabels = computed(() =>
    this.selectedOptions()
      .map((option) => this.labelOf(option))
      .join(', '),
  );

  private readonly selectableVisible = computed(() =>
    this.visibleOptions().filter((option) => !this.isDisabled(option)),
  );

  /** `true`, `false` or `'mixed'` for the "select all" box (over visible, enabled options). */
  protected readonly allState = computed<boolean | 'mixed'>(() => {
    const options = this.selectableVisible();
    const selected = options.filter((option) => this.isSelected(option)).length;
    if (!options.length || selected === 0) return false;
    return selected === options.length ? true : 'mixed';
  });

  protected isSelected(option: TOption): boolean {
    const optionValue = this.valueOf(option);
    return this.value().some((value) => this.equals(value, optionValue));
  }

  protected choose(option: TOption): void {
    if (this.isSelected(option)) {
      this.remove(option);
      return;
    }
    const limit = this.selectionLimit();
    if (limit > 0 && this.value().length >= limit) return;
    this.value.update((values) => [...values, this.valueOf(option)]);
  }

  protected initialActiveIndex(): number {
    return this.firstEnabledFrom(0, 1);
  }

  remove(option: TOption): void {
    const optionValue = this.valueOf(option);
    this.value.update((values) => values.filter((value) => !this.equals(value, optionValue)));
  }

  protected toggleAll(): void {
    const options = this.selectableVisible();
    if (this.allState() === true) {
      const visibleValues = options.map((option) => this.valueOf(option));
      this.value.update((values) =>
        values.filter((value) => !visibleValues.some((visible) => this.equals(visible, value))),
      );
      return;
    }
    const additions = options
      .filter((option) => !this.isSelected(option))
      .map((option) => this.valueOf(option));
    this.value.update((values) => [...values, ...additions]);
  }

  clear(): void {
    this.value.set([]);
    this.focus();
  }
}
