import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkMenuTrigger } from '@angular/cdk/menu';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  ElementRef,
  forwardRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  injectStarControlDefaults,
  optionText,
  readOption,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarDirectionService,
  StarOptionKey,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
import { STAR_MENU_POSITIONS, StarMenu, StarMenuInDialog, StarMenuItem } from '@star-ng/ui/menu';
import { STAR_SELECT_DEFAULTS } from './select-defaults';
import type { StarCascadeOptionContext } from './select-slots';

interface Leaf<TOption, TValue> {
  readonly option: TOption;
  readonly value: TValue;
  /** Labels from the top level to the leaf. */
  readonly path: readonly string[];
}

/** One entry of the cascade menu: the menu item and the data of its option. */
interface CascadeItem<TOption> extends StarMenuItem {
  readonly option: TOption;
  /** Depth: 1 for a top-level option. */
  readonly level: number;
  /** Position among the siblings. */
  readonly index: number;
  readonly selected: boolean;
  readonly hasChildren: boolean;
  readonly items?: readonly CascadeItem<TOption>[];
}

/**
 * Cascade select (PrimeNG `p-cascadeselect`): choose one leaf of nested options, for example
 * country → state → city. The popup is a menu with submenus (CDK Menu: arrow keys, typeahead,
 * Escape). The value is the leaf (`optionValue`, or the whole option).
 *
 * ```html
 * <star-cascade-select [options]="countries" optionLabel="name" optionChildren="children"
 *                     optionValue="code" [(value)]="city" showPath />
 * ```
 *
 * Slot: `ng-template[starCascadeOption]` replaces the label of each menu entry
 * (`StarCascadeOptionTemplate`).
 */
@Component({
  selector: 'star-cascade-select',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [CdkMenuTrigger, NgTemplateOutlet, StarMenu, StarMenuInDialog],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarCascadeSelect) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-select star-cascade',
    '[class.star-select--disabled]': 'disabled()',
    '[class.star-select--invalid]': 'showInvalid()',
    '[class.star-select--sm]': "size() === 'sm'",
  },
  template: `
    <div data-star-part="controlPanel" class="star-select__control">
      <button
        data-star-part="triggerButton"
        #trigger="cdkMenuTriggerFor"
        #button
        type="button"
        class="star-select__trigger star-cascade__trigger"
        [id]="inputId()"
        [cdkMenuTriggerFor]="menu.template()"
        [cdkMenuTriggerData]="{ $implicit: menuItems() }"
        [cdkMenuPosition]="positions"
        [disabled]="disabled() || readonly()"
        [attr.aria-label]="triggerName()"
        [attr.aria-labelledby]="labelledBy()"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-invalid]="showInvalid() || null"
        (cdkMenuClosed)="touch.emit()"
      >
        @if (selected(); as leaf) {
          <span data-star-part="valueText" class="star-select__value">{{ display(leaf) }}</span>
        } @else {
          <span data-star-part="placeholderText" class="star-select__placeholder">{{
            placeholder() ?? text.selectPlaceholder
          }}</span>
        }
      </button>
      @if (showClear() && selected() && !disabled() && !readonly()) {
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
      <i
        data-star-part="dropdownIcon"
        class="ph-bold ph-caret-down star-select__caret"
        aria-hidden="true"
      ></i>
    </div>
    <star-menu
      #menu
      [ariaLabel]="ariaLabel() ?? (field?.label() || null)"
      [itemTemplate]="optionSlot() ? optionItem : null"
    />
    <ng-template #optionItem let-item>
      <ng-container *ngTemplateOutlet="optionSlot(); context: optionContext(item)" />
    </ng-template>
  `,
})
export class StarCascadeSelect<
  TOption,
  TValue = TOption,
> implements FormValueControl<TValue | null> {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly defaults = injectStarControlDefaults(['sm', 'md'], inject(STAR_SELECT_DEFAULTS));
  protected readonly positions = STAR_MENU_POSITIONS;
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  readonly value = model<TValue | null>(null);
  readonly options = input<readonly TOption[]>([]);
  readonly optionLabel = input<StarOptionKey<TOption> | null>(null);
  /** Value stored in the form, read from the leaf. Omit to store the whole leaf option. */
  readonly optionValue = input<StarOptionKey<TOption> | null>(null);
  /** Property (or function) with the child options. An option without children is a leaf. */
  readonly optionChildren = input<StarOptionKey<TOption, readonly TOption[] | null | undefined>>(
    'children' as StarOptionKey<TOption, readonly TOption[] | null | undefined>,
  );
  readonly optionDisabled = input<StarOptionKey<TOption> | null>(null);
  readonly compareWith = input<(a: TValue, b: TValue) => boolean>(Object.is);
  readonly placeholder = input<string | null>(null);
  /** Show the whole path ("Germany / Bavaria / Munich") instead of the leaf label. */
  readonly showPath = input(false, { transform: booleanAttribute });
  readonly showClear = input(this.defaults.showClear ?? false, { transform: booleanAttribute });
  /** Size. Default: `size` of `provideStarNg` (`small` or `medium`), else `md`. */
  readonly size = input<'sm' | 'md'>(this.defaults.size ?? 'md');
  readonly ariaLabel = input<string | null>(null);
  readonly inputId = input(inject(_IdGenerator).getId('star-cascade-'));
  /**
   * The parent `star-field` when it labels this control. A label `for` a button would click it
   * (and open the menu), so the trigger takes its name with aria-labelledby, and a click on the
   * label only focuses it.
   */
  protected readonly field = injectStarFieldLink(this.inputId, () => this.focus());

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  /** The user chose a leaf. */
  readonly optionSelect = output<TOption>();

  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );
  /**
   * `aria-labelledby` without `ariaLabel`: the `star-field` label and the button itself, so the
   * name is the label and the text on the button (WCAG 2.5.3).
   */
  protected readonly labelledBy = computed(() => {
    const label = starFieldLabelledBy(this.field, this.ariaLabel());
    return label ? `${label} ${this.inputId()}` : null;
  });
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  focus(options?: FocusOptions): void {
    this.button().nativeElement.focus(options);
  }

  private childrenOf(option: TOption): readonly TOption[] {
    const children = readOption(option, this.optionChildren());
    return Array.isArray(children) ? (children as readonly TOption[]) : [];
  }

  private labelOf(option: TOption): string {
    return optionText(option, this.optionLabel() ?? null);
  }

  /** Every leaf with its path, in display order. */
  private readonly leaves = computed(() => {
    const out: Leaf<TOption, TValue>[] = [];
    const walk = (options: readonly TOption[], path: readonly string[]) => {
      for (const option of options) {
        const next = [...path, this.labelOf(option)];
        const children = this.childrenOf(option);
        if (children.length) walk(children, next);
        else {
          out.push({
            option,
            value: readOption(option, this.optionValue()) as TValue,
            path: next,
          });
        }
      }
    };
    walk(this.options(), []);
    return out;
  });

  protected readonly selected = computed(() => {
    const value = this.value();
    if (value === null || value === undefined) return null;
    return this.leaves().find((leaf) => this.compareWith()(leaf.value, value)) ?? null;
  });

  protected readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly optionSlot = starSlot<StarCascadeOptionContext<TOption>>(
    this.slots,
    this,
    'option',
  );

  /** Context of the option slot for one menu entry. The entries are the `CascadeItem`s of `menuItems`. */
  protected optionContext(item: StarMenuItem): StarCascadeOptionContext<TOption> {
    const entry = item as CascadeItem<TOption>;
    return {
      $implicit: entry.option,
      selected: entry.selected,
      index: entry.index,
      level: entry.level,
      hasChildren: entry.hasChildren,
    };
  }

  /** The options as menu items: a parent opens a submenu, a leaf sets the value. */
  protected readonly menuItems = computed<readonly CascadeItem<TOption>[]>(() => {
    const disabledKey = this.optionDisabled();
    const selected = this.selected()?.option;
    const build = (options: readonly TOption[], level: number): CascadeItem<TOption>[] =>
      options.map((option, index) => {
        const children = this.childrenOf(option);
        const hasChildren = children.length > 0;
        const disabled = disabledKey ? !!readOption(option, disabledKey) : false;
        const chosen = !hasChildren && option === selected;
        const entry = { option, level, index, hasChildren, selected: chosen };
        return hasChildren
          ? { ...entry, label: this.labelOf(option), disabled, items: build(children, level + 1) }
          : {
              ...entry,
              label: this.labelOf(option),
              disabled,
              icon: chosen ? 'ph-bold ph-check' : undefined,
              command: () => this.choose(option),
            };
      });
    return build(this.options(), 1);
  });

  /**
   * Accessible name of the trigger button: the label and the text on the button, so the visible
   * text is part of the name (WCAG 2.5.3). `null` without `ariaLabel`: a `star-field` label then
   * names the button.
   */
  protected readonly triggerName = computed(() => {
    const label = this.ariaLabel();
    if (!label) return null;
    const leaf = this.selected();
    return `${label}: ${leaf ? this.display(leaf) : (this.placeholder() ?? this.text.selectPlaceholder)}`;
  });

  protected display(leaf: Leaf<TOption, TValue>): string {
    return this.showPath() ? leaf.path.join(' / ') : (leaf.path.at(-1) ?? '');
  }

  private choose(option: TOption): void {
    this.value.set(readOption(option, this.optionValue()) as TValue);
    this.optionSelect.emit(option);
  }

  clear(): void {
    this.value.set(null);
  }
}
