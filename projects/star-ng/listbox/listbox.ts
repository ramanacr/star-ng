import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { matchesFilter, optionText, readOption, STAR_UI_TEXT, StarOptionKey } from 'star-ng/core';
import { StarOptionTemplate } from 'star-ng/select';

/**
 * Inline list choice (PrimeNG `p-listbox`): single or `multiple` (checkboxes), filter,
 * option template, WAI-ARIA listbox keyboard (Arrow, Home / End, Space / Enter, typeahead).
 * Value: one value, or an array in `multiple` mode.
 *
 * `<star-listbox [options]="queues" optionLabel="name" optionValue="id" [(value)]="queue" filter ariaLabel="Queue" />`
 */
@Component({
  selector: 'star-listbox',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-listbox-box',
    '[class.star-listbox-box--disabled]': 'disabled()',
    '[class.star-listbox-box--invalid]': 'invalid() && touched()',
  },
  template: `
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
          (input)="query.set(filterInput.value); active.set(0)"
          (keydown)="onKeydown($event)"
        />
      </div>
    }
    <ul
      #list
      class="star-listbox"
      role="listbox"
      [id]="listId"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-multiselectable]="multiple() || null"
      [attr.aria-activedescendant]="activeId()"
      [attr.aria-disabled]="disabled() || null"
      [style.max-height]="scrollHeight()"
      (keydown)="onKeydown($event)"
      (focus)="active() < 0 && active.set(firstSelectedOrZero())"
      (blur)="touch.emit()"
    >
      @for (option of visible(); track $index; let i = $index) {
        @if (groupHeading(i); as heading) {
          <li class="star-listbox__group" role="presentation" [id]="groupId(i)">{{ heading }}</li>
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
      } @empty {
        <li class="star-listbox__empty" role="presentation">{{ text.emptyFilterMessage }}</li>
      }
    </ul>
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
  readonly scrollHeight = input('16rem');
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected readonly optionTemplate = contentChild(StarOptionTemplate);
  private readonly list = viewChild.required<ElementRef<HTMLUListElement>>('list');
  protected readonly query = signal('');
  protected readonly active = signal(-1);
  private typeahead = '';
  private typeaheadAt = 0;

  protected readonly visible = computed(() => {
    const options = this.options().filter((option) =>
      matchesFilter(this.labelOf(option), this.query()),
    );
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
  protected readonly activeId = computed(() =>
    this.active() >= 0 && this.active() < this.visible().length
      ? `${this.listId}-${this.active()}`
      : null,
  );

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

  protected onKeydown(event: KeyboardEvent): void {
    const options = this.visible();
    if (!options.length || this.disabled()) return;
    const last = options.length - 1;
    const move = (index: number) => {
      event.preventDefault();
      this.active.set(Math.min(Math.max(index, 0), last));
      queueMicrotask(() =>
        this.list()
          .nativeElement.querySelector(`#${CSS.escape(this.activeId() ?? '')}`)
          ?.scrollIntoView?.({ block: 'nearest' }),
      );
      if (!this.multiple() && !(event.target instanceof HTMLInputElement)) {
        const option = options[this.active()];
        if (!this.isDisabled(option)) this.value.set(this.valueOf(option));
      }
    };
    switch (event.key) {
      case 'ArrowDown':
        return move(this.active() + 1);
      case 'ArrowUp':
        return move(this.active() - 1);
      case 'Home':
        if (event.target instanceof HTMLInputElement) return;
        return move(0);
      case 'End':
        if (event.target instanceof HTMLInputElement) return;
        return move(last);
      case ' ':
      case 'Enter':
        if (event.key === ' ' && event.target instanceof HTMLInputElement) return;
        event.preventDefault();
        if (options[this.active()] !== undefined) this.choose(options[this.active()]);
        return;
      default:
        if (event.key.length === 1 && !(event.target instanceof HTMLInputElement)) {
          const now = Date.now();
          this.typeahead =
            (now - this.typeaheadAt > 500 ? '' : this.typeahead) + event.key.toLowerCase();
          this.typeaheadAt = now;
          const index = options.findIndex((o) =>
            this.labelOf(o).toLowerCase().startsWith(this.typeahead),
          );
          if (index >= 0) move(index);
        }
    }
  }

  focus(): void {
    this.list().nativeElement.focus();
  }
}
