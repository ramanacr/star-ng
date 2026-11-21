import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  readOption,
  STAR_SLOT_HOST,
  starFilterMatchAny,
  starListKeyboardTarget,
  starListPageSize,
  StarOptionKey,
  StarPart,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarOptionListBase } from '@star-ng/ui/select';

/** One column of `star-multi-column-combobox`. */
export interface StarComboboxColumn<T = unknown> {
  /** Property of the row shown in the column, or a function that reads it. */
  readonly field: StarOptionKey<T>;
  /** Text of the header cell. */
  readonly header: string;
  /** CSS width of the column, for example `8rem` or `30%`. Default: an equal share of the rest. */
  readonly width?: string;
}

/** Context of the `ng-template[starColumnCell]` slot. */
export interface StarColumnCellContext<T = unknown> {
  /** The row (`let-row`). */
  readonly $implicit: T;
  /** The row again (`let-row="row"`). */
  readonly row: T;
  /** The column (`let-column="column"`). */
  readonly column: StarComboboxColumn<T>;
  /** Index of the column. */
  readonly index: number;
}

/**
 * Content of each cell of `star-multi-column-combobox`:
 * `<ng-template starColumnCell let-row let-column="column">`. Switch on `column.field` for
 * per-column content. Do not put focusable elements in it: the focus stays in the text field.
 */
@Directive({
  selector: 'ng-template[starColumnCell]',
  providers: [{ provide: StarSlot, useExisting: StarColumnCellTemplate }],
})
export class StarColumnCellTemplate extends StarSlot<StarColumnCellContext> {
  readonly name = 'columnCell';

  static ngTemplateContextGuard(
    _dir: StarColumnCellTemplate,
    _ctx: unknown,
  ): _ctx is StarColumnCellContext {
    return true;
  }
}

/** Width of a column without `width`. */
const AUTO_WIDTH = 'minmax(0, 1fr)';
/** Row height for Page up / Page down without `virtualScroll`. */
const ROW_GUESS = 40;

/**
 * Multi-column combobox (Kendo UI `MultiColumnComboBox`, Ignite UI `igx-combo` with an item
 * template of columns): a text field over a grid-like listbox. Each option shows one cell per
 * column under a header row. Typing filters the rows over every column (`filterFields`, accent and
 * case insensitive with `starFilterMatch`), Enter chooses the active row.
 *
 * It builds on the shared option list of the select family, so `optionLabel`, `optionValue`,
 * `optionDisabled`, `virtualScroll`, `lazy`, `loading`, `showClear` and the `starHeader`,
 * `starFooter`, `starEmpty` and `starLoading` slots work as in `star-select`.
 *
 * Accessibility: the field is a `combobox` with `aria-autocomplete="list"`; the active option is
 * named by `aria-activedescendant`. The header row is `role="presentation"`: the options read as
 * their cells, separated by commas. Alt+Arrow down or Arrow down opens, the arrows, Home, End,
 * Page up and Page down move while open, Enter chooses, Escape closes.
 *
 * ```html
 * <star-multi-column-combobox [options]="people" [columns]="columns"
 *   optionLabel="name" optionValue="id" [formField]="form.person" />
 * ```
 */
@Component({
  selector: 'star-multi-column-combobox',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMultiColumnCombobox) }],
  host: {
    class: 'star-select star-mcc',
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
        [attr.placeholder]="placeholder()"
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
      @if (showClear() && selectedOption() !== undefined && interactive()) {
        <button
          data-star-part="clearButton"
          type="button"
          class="star-select__icon-btn"
          [attr.aria-label]="text.clear"
          (click)="clear()"
        >
          <i data-star-part="clearIcon" class="ph-bold ph-x" aria-hidden="true"></i>
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
        <!-- The field opens the list by keys; the caret is a pointer shortcut. -->
        <i
          data-star-part="dropdownIcon"
          class="ph-bold ph-caret-down star-select__caret star-mcc__caret"
          aria-hidden="true"
          (mousedown)="$event.preventDefault()"
          (click)="toggleFromCaret()"
        ></i>
      }
    </div>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayUsePopover]="popoverLocation()"
      cdkConnectedOverlayMatchWidth
      [cdkConnectedOverlayMinWidth]="panelMinWidth()"
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
        class="star-panel star-mcc__panel"
        [class]="panelClasses()"
        [style]="panelStyle()"
        [style.--star-mcc-columns]="gridColumns()"
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
        <div data-star-part="header" class="star-mcc__header" role="presentation">
          @for (column of columns(); track $index) {
            <span data-star-part="head" class="star-mcc__head">{{ column.header }}</span>
          }
        </div>
        <ul
          data-star-part="list"
          class="star-listbox star-mcc__list"
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
                {{ row.label }}
              </li>
            } @else {
              @let option = row.option;
              @let i = row.index;
              <!-- Keyboard is handled on the combobox via aria-activedescendant (WAI-ARIA combobox pattern). -->
              <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
              <li
                data-star-part="option"
                class="star-listbox__option star-mcc__row"
                role="option"
                [id]="optionId(i)"
                [class.star-listbox__option--active]="activeIndex() === i"
                [class.star-listbox__option--loading]="option === undefined"
                [class.star-listbox__option--selected]="isSelected(option)"
                [attr.aria-selected]="isSelected(option)"
                [attr.aria-disabled]="isDisabled(option) || null"
                [attr.aria-setsize]="virtualScroll() ? visibleOptions().length : null"
                [attr.aria-posinset]="virtualScroll() ? i + 1 : null"
                (click)="onOptionClick(option, i)"
                (mousemove)="onOptionHover(i)"
              >
                @if (option === undefined) {
                  <span
                    data-star-part="skeletonText"
                    class="star-skeleton star-listbox__skeleton"
                    aria-hidden="true"
                  ></span>
                  <span class="star-sr-only">{{ text.loading }}</span>
                } @else {
                  @for (column of columns(); track $index; let c = $index, last = $last) {
                    <span data-star-part="cell" class="star-mcc__cell">
                      @if (cellTemplate(); as custom) {
                        <ng-container
                          *ngTemplateOutlet="
                            custom;
                            context: { $implicit: option, row: option, column: column, index: c }
                          "
                        />
                      } @else {
                        {{ cellText(option, column) }}
                      }
                    </span>
                    @if (!last) {
                      <span class="star-sr-only">, </span>
                    }
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
export class StarMultiColumnCombobox<TOption = unknown, TValue = TOption>
  extends StarOptionListBase<TOption, TValue>
  implements FormValueControl<TValue | null>
{
  private readonly doc = inject(DOCUMENT);

  readonly value = model<TValue | null>(null);
  /** The columns: `{ field, header, width? }`. */
  readonly columns = input<readonly StarComboboxColumn<TOption>[]>([]);
  /**
   * Fields the typed text searches. `null` (default): `filterBy` when it is set, else every column
   * field. Kendo UI `filterable` searches the text field only; this searches what the user sees.
   */
  readonly filterFields = input<readonly StarOptionKey<TOption>[] | null>(null);
  /** Minimum width of the panel (CSS length or pixels). The panel is at least as wide as the field. */
  readonly panelMinWidth = input<string | number>('20rem');

  protected readonly closeOnChoose = true;
  protected readonly cellTemplate = starSlot<StarColumnCellContext<TOption>>(
    this.slots,
    this,
    'columnCell',
  );

  /** `grid-template-columns` of the header and the rows. */
  protected readonly gridColumns = computed(() =>
    this.columns()
      .map((column) => column.width || AUTO_WIDTH)
      .join(' '),
  );

  /** The option that matches the current value, or `undefined`. */
  protected readonly selectedOption = computed(() => {
    const value = this.value();
    if (value === null) return undefined;
    return this.options().find(
      (option) => option !== undefined && this.equals(this.valueOf(option), value),
    );
  });

  private readonly valueText = computed(() => {
    const option = this.selectedOption();
    return option === undefined ? '' : this.labelOf(option);
  });

  /** Text of the field. Goes back to the label of the value when the value changes. */
  protected readonly editText = linkedSignal(() => this.valueText());

  constructor() {
    super();
    this.linkField();
    // Page moves without virtual scrolling: keep the active row in view.
    afterRenderEffect(() => {
      const id = this.activeId();
      if (!id || this.virtualScroll()) return;
      this.doc.getElementById(id)?.scrollIntoView?.({ block: 'nearest' });
    });
  }

  protected cellText(option: TOption, column: StarComboboxColumn<TOption>): string {
    const value = readOption(option, column.field);
    return value === null || value === undefined ? '' : String(value);
  }

  protected override filterOn(): boolean {
    return true;
  }

  protected override matchesQuery(option: TOption, query: string): boolean {
    const fields = this.filterFields();
    if (!fields && this.filterBy()) return super.matchesQuery(option, query);
    const keys = fields ?? this.columns().map((column) => column.field);
    return starFilterMatchAny(
      keys.map((key) => readOption(option, key)),
      query,
      this.filterMatchMode(),
      this.filterLocale(),
    );
  }

  protected toggleFromCaret(): void {
    if (!this.interactive()) return;
    this.toggle();
    this.focus();
  }

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
    if ((event.key === 'PageDown' || event.key === 'PageUp') && !this.virtualScroll()) {
      if (!this.open()) return;
      event.preventDefault();
      this.movePageWithoutWindow(event.key === 'PageDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && (!this.open() || this.activeIndex() < 0)) {
      // Enter that changes nothing goes on to the form (submit).
      if (this.commitEdit()) event.preventDefault();
      this.closePanel();
      return;
    }
    this.onKeydown(event);
  }

  /** Page up / Page down over a list that renders every row. */
  private movePageWithoutWindow(step: 1 | -1): void {
    const count = this.visibleOptions().length;
    if (!count) return;
    const list = this.doc.getElementById(this.listId);
    const row = list?.querySelector<HTMLElement>('[role=option]')?.offsetHeight || ROW_GUESS;
    const target = starListKeyboardTarget(
      step === 1 ? 'PageDown' : 'PageUp',
      this.activeIndex(),
      count,
      starListPageSize(list?.clientHeight || ROW_GUESS * 10, row),
    );
    const next = this.firstEnabledFrom(target, step);
    const found = next >= 0 ? next : this.firstEnabledFrom(target, step === 1 ? -1 : 1);
    if (found >= 0) this.activeIndex.set(found);
  }

  protected onEditBlur(): void {
    if (this.open()) return;
    this.commitEdit();
    this.touch.emit();
  }

  protected override dismiss(): void {
    super.dismiss();
    this.commitEdit();
  }

  /**
   * Applies the typed text: an exact label chooses its row, an empty text clears the value, other
   * text goes back to the label of the value. Returns `true` when the value changed.
   */
  private commitEdit(): boolean {
    if (!this.interactive()) return false;
    const text = this.editText().trim();
    if (text === this.valueText()) return false;
    const before = this.value();
    if (!text) {
      this.value.set(null);
      this.setEditText('');
      return before !== null;
    }
    const lower = text.toLocaleLowerCase();
    const exact = this.options().find(
      (option) =>
        option !== undefined &&
        !this.isDisabled(option) &&
        this.labelOf(option).toLocaleLowerCase() === lower,
    );
    if (exact !== undefined) this.choose(exact);
    else this.setEditText(this.valueText());
    return this.value() !== before;
  }

  protected isSelected(option: TOption): boolean {
    const value = this.value();
    return option !== undefined && value !== null && this.equals(this.valueOf(option), value);
  }

  protected choose(option: TOption): void {
    this.value.set(this.valueOf(option));
    this.setEditText(this.labelOf(option));
  }

  protected initialActiveIndex(): number {
    const index = this.visibleOptions().findIndex((option) => this.isSelected(option));
    if (index >= 0) return index;
    return this.autoOptionFocus() ? this.firstEnabledFrom(0, 1) : -1;
  }

  /** Empties the value and the field. */
  clear(): void {
    this.value.set(null);
    this.setEditText('');
    this.focus();
  }
}
