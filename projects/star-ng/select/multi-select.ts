import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
  output,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_SLOT_HOST, starSlot } from '@star-ng/ui/core';
import { StarOptionListBase } from './option-list-base';
import { StarChipContext } from './select-slots';
import { starSelectionChanging, StarSelectionChangingEvent } from './selection-changing';

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
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMultiSelect) }],
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
        @if (selectedCount() === 0) {
          <span class="star-select__placeholder">{{
            placeholder() ?? text.selectPlaceholder
          }}</span>
        } @else if (collapsed()) {
          <span class="star-select__value">{{ text.selectedItems(selectedCount()) }}</span>
        } @else if (display() === 'chip') {
          <span class="star-select__chips">
            @for (option of selectedOptions(); track $index) {
              @if (chipSlot(); as custom) {
                <!-- The slot owns its buttons: a click on one must not toggle the panel. -->
                <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
                <span (click)="onChipSlotClick($event)">
                  <ng-container *ngTemplateOutlet="custom; context: chipContext(option)" />
                </span>
              } @else {
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
            }
            @for (custom of customValues(); track $index) {
              <span class="star-chip star-chip--sm">
                {{ custom }}
                @if (interactive()) {
                  <button
                    type="button"
                    class="star-chip__remove"
                    tabindex="-1"
                    [attr.aria-label]="text.removeItem(custom + '')"
                    (click)="$event.stopPropagation(); removeValue(custom)"
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
      @if (showClear() && selectedCount() && interactive()) {
        <button
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="text.clear"
          (click)="clear()"
        >
          @if (iconSlot('clear'); as icon) {
            <span aria-hidden="true"><ng-container *ngTemplateOutlet="icon" /></span>
          } @else {
            <i class="ph-bold ph-x" aria-hidden="true"></i>
          }
        </button>
      }
      @if (loading()) {
        <i
          class="ph-bold ph-spinner-gap star-spin star-select__caret"
          role="img"
          [attr.aria-label]="text.loading"
        ></i>
      } @else {
        @if (iconSlot('dropdown'); as icon) {
          <span class="star-select__caret" aria-hidden="true"
            ><ng-container *ngTemplateOutlet="icon"
          /></span>
        } @else {
          <i class="ph-bold ph-caret-down star-select__caret" aria-hidden="true"></i>
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
        class="star-panel"
        [class]="panelClasses()"
        [style]="panelStyle()"
        (mousedown)="onPanelMousedown($event)"
        (keydown)="onPanelKeydown($event)"
        (focusin)="onPanelFocusin($event)"
        (focusout)="onPanelFocusout($event)"
      >
        @if (headerSlot(); as header) {
          <ng-container *ngTemplateOutlet="header" />
        }
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
              @if (iconSlot('filter'); as icon) {
                <span aria-hidden="true"><ng-container *ngTemplateOutlet="icon" /></span>
              } @else {
                <i class="ph-bold ph-magnifying-glass" aria-hidden="true"></i>
              }
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
            <li
              class="star-listbox__spacer"
              role="presentation"
              [style.height.px]="virtualWindow().before"
            ></li>
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
                [class.star-listbox__option--selected]="isSelected(option)"
                [attr.aria-selected]="isSelected(option)"
                [attr.aria-disabled]="isDisabled(option) || null"
                [attr.aria-describedby]="describedBy(row)"
                [attr.aria-setsize]="virtualScroll() ? visibleOptions().length : null"
                [attr.aria-posinset]="virtualScroll() ? i + 1 : null"
                (click)="onOptionClick(option, i)"
                (mousemove)="onOptionHover(i)"
              >
                <span class="star-check__box" aria-hidden="true">
                  @if (isSelected(option)) {
                    @if (iconSlot('check'); as icon) {
                      <ng-container *ngTemplateOutlet="icon" />
                    } @else {
                      <i class="ph-bold ph-check"></i>
                    }
                  }
                </span>
                <span class="star-listbox__label">
                  @if (option === undefined) {
                    <span class="star-skeleton star-listbox__skeleton" aria-hidden="true"></span>
                    <span class="star-sr-only">{{ text.loading }}</span>
                  } @else if (optionTemplate(); as custom) {
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
            @if (!loadingRow() && customRow() === null) {
              <li class="star-listbox__empty" role="presentation">
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
              class="star-listbox__spacer"
              role="presentation"
              [style.height.px]="virtualWindow().after"
            ></li>
          }
          @if (customRow(); as custom) {
            <!-- Keyboard is handled on the combobox via aria-activedescendant (WAI-ARIA combobox pattern). -->
            <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
            <li
              class="star-listbox__option star-listbox__option--add"
              role="option"
              aria-selected="false"
              [id]="addRowId"
              [class.star-listbox__option--active]="isAddRow(activeIndex())"
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
  /**
   * With `filter`: a row "Add “text”" at the end of the list adds the filter text as a new value
   * (a string) when no option has that label. `customValueAdd` fires; add a matching option to
   * `options` there, else the chip shows the text. Ignite UI combo `allowCustomValues`.
   */
  readonly allowCustomValues = input(false, { transform: booleanAttribute });
  /** With `allowCustomValues`: the text that became a new value. Ignite UI combo `addition`. */
  readonly customValueAdd = output<string>();
  /**
   * Fires before the value changes by a user action. Call `cancel()` on the event to keep the old
   * value. Ignite UI combo `selectionChanging`.
   */
  readonly selectionChanging = output<StarSelectionChangingEvent<readonly TValue[]>>();

  protected readonly closeOnChoose = false;

  constructor() {
    super();
    // The trigger is a `div`, not a labelable element: the field label names it with
    // aria-labelledby, and a click on the label focuses it.
    this.linkField(() => this.focus());
  }

  protected readonly chipSlot = starSlot<StarChipContext<TOption>>(this.slots, this, 'chip');

  protected chipContext(option: TOption): StarChipContext<TOption> {
    return {
      $implicit: option,
      interactive: this.interactive(),
      // Disabled or read-only: no change to the value, as the default chip has no remove button.
      remove: () => {
        if (this.interactive()) this.remove(option);
      },
    };
  }

  /** A click on a button or link inside a chip slot must not toggle the panel. */
  protected onChipSlotClick(event: MouseEvent): void {
    if ((event.target as Element).closest('button, a, [role=button]')) event.stopPropagation();
  }

  protected readonly selectedOptions = computed(() =>
    this.options().filter((option) => option !== undefined && this.isSelected(option)),
  );
  /** With `allowCustomValues`: values that no option has (added texts), shown as their text. */
  protected readonly customValues = computed<readonly TValue[]>(() => {
    if (!this.allowCustomValues()) return [];
    const known = this.selectedOptions().map((option) => this.valueOf(option));
    return this.value().filter((value) => !known.some((v) => this.equals(v, value)));
  });
  protected readonly selectedCount = computed(
    () => this.selectedOptions().length + this.customValues().length,
  );
  protected readonly collapsed = computed(() => this.selectedCount() > this.maxSelectedLabels());
  protected readonly selectedLabels = computed(() =>
    [
      ...this.selectedOptions().map((option) => this.labelOf(option)),
      ...this.customValues().map(String),
    ].join(', '),
  );

  protected override customRowText(): string | null {
    const text = this.filterValue().trim();
    if (!this.allowCustomValues() || !this.filter() || !text) return null;
    const lower = text.toLocaleLowerCase();
    const taken =
      this.options().some(
        (option) => option !== undefined && this.labelOf(option).toLocaleLowerCase() === lower,
      ) || this.value().some((value) => String(value).toLocaleLowerCase() === lower);
    return taken ? null : text;
  }

  protected override addCustom(text: string): void {
    const limit = this.selectionLimit();
    if (!this.interactive() || (limit > 0 && this.value().length >= limit)) return;
    if (!this.changeWith((values) => [...values, text as unknown as TValue])) return;
    this.customValueAdd.emit(text);
    // The filter starts again, so the next text can be typed.
    this.clearFilterText();
  }

  removeValue(value: TValue): void {
    this.changeWith((values) => values.filter((v) => !this.equals(v, value)));
  }

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

  /**
   * The chosen values in a `Set`, for the default `compareWith`. A lookup then costs one step and
   * not one scan of the value: with 10,000 chosen options a scan per option took seconds.
   */
  private readonly chosenSet = computed(() =>
    this.compareWith() === Object.is ? new Set<TValue>(this.value()) : null,
  );

  protected isSelected(option: TOption): boolean {
    if (option === undefined) return false;
    const optionValue = this.valueOf(option);
    const chosen = this.chosenSet();
    return chosen
      ? chosen.has(optionValue)
      : this.value().some((value) => this.equals(value, optionValue));
  }

  protected choose(option: TOption): void {
    if (this.isSelected(option)) {
      this.remove(option);
      return;
    }
    const limit = this.selectionLimit();
    if (limit > 0 && this.value().length >= limit) return;
    this.changeWith((values) => [...values, this.valueOf(option)]);
  }

  /**
   * Sets the value to `update(value)` after `selectionChanging`, and returns `false` when a
   * handler cancelled.
   */
  private changeWith(update: (values: readonly TValue[]) => readonly TValue[]): boolean {
    const previous = this.value();
    const next = update(previous);
    if (next.length === previous.length && next.every((v, i) => Object.is(v, previous[i]))) {
      return true;
    }
    if (!starSelectionChanging(this.selectionChanging, previous, next)) return false;
    this.value.set(next);
    return true;
  }

  protected initialActiveIndex(): number {
    return this.autoOptionFocus() ? this.firstEnabledFrom(0, 1) : -1;
  }

  remove(option: TOption): void {
    const optionValue = this.valueOf(option);
    this.changeWith((values) => values.filter((value) => !this.equals(value, optionValue)));
  }

  protected toggleAll(): void {
    const options = this.selectableVisible();
    if (this.allState() === true) {
      const visibleValues = options.map((option) => this.valueOf(option));
      const visibleSet = this.compareWith() === Object.is ? new Set<TValue>(visibleValues) : null;
      this.changeWith((values) =>
        values.filter((value) =>
          visibleSet
            ? !visibleSet.has(value)
            : !visibleValues.some((visible) => this.equals(visible, value)),
        ),
      );
      return;
    }
    const additions = options
      .filter((option) => !this.isSelected(option))
      .map((option) => this.valueOf(option));
    this.changeWith((values) => [...values, ...additions]);
  }

  clear(): void {
    if (!this.changeWith(() => [])) return;
    this.focus();
  }
}
