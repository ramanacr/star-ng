import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import type { FormCheckboxControl, FormValueControl } from '@angular/forms/signals';
import { optionText, readOption, StarOptionKey } from 'star-ng/core';

/**
 * Segmented choice (PrimeNG `p-selectbutton`). Single mode is a radio group (Arrow keys move and
 * select); `multiple` mode is a group of toggle buttons (`aria-pressed`).
 *
 * `<star-select-button [options]="views" optionLabel="label" optionValue="id" [(value)]="view" ariaLabel="View" />`
 */
@Component({
  selector: 'star-select-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-segmented',
    '[attr.role]': "multiple() ? 'group' : 'radiogroup'",
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-disabled]': 'disabled() || null',
    '[class.star-segmented--invalid]': 'invalid() && touched()',
    '[class.star-segmented--sm]': "size() === 'sm'",
  },
  template: `
    @for (option of options(); track $index; let i = $index) {
      <button
        type="button"
        class="star-segmented__item"
        [attr.role]="multiple() ? null : 'radio'"
        [attr.aria-checked]="multiple() ? null : isSelected(option)"
        [attr.aria-pressed]="multiple() ? isSelected(option) : null"
        [attr.tabindex]="tabIndexFor(i)"
        [class.star-segmented__item--on]="isSelected(option)"
        [disabled]="disabled() || isDisabled(option)"
        (click)="toggle(option)"
        (keydown)="onKeydown($event, i)"
        (blur)="touch.emit()"
      >
        @if (iconOf(option); as icon) {
          <i [class]="icon" aria-hidden="true"></i>
        }
        <span>{{ labelOf(option) }}</span>
      </button>
    }
  `,
})
export class StarSelectButton<TOption = unknown, TValue = TOption> implements FormValueControl<
  TValue | readonly TValue[] | null
> {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly value = model<TValue | readonly TValue[] | null>(null);
  readonly options = input<readonly TOption[]>([]);
  readonly optionLabel = input<StarOptionKey<TOption> | null>(null);
  readonly optionValue = input<StarOptionKey<TOption> | null>(null);
  readonly optionIcon = input<StarOptionKey<TOption> | null>(null);
  readonly optionDisabled = input<StarOptionKey<TOption> | null>(null);
  readonly multiple = input(false, { transform: booleanAttribute });
  /** Single mode: clicking the selected item clears it. */
  readonly allowEmpty = input(true, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('md');
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  private readonly selectedIndex = computed(() =>
    this.options().findIndex((option) => this.isSelected(option)),
  );

  protected labelOf(option: TOption): string {
    return optionText(option, this.optionLabel());
  }
  protected iconOf(option: TOption): string | null {
    const key = this.optionIcon();
    return key ? ((readOption(option, key) as string) ?? null) : null;
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

  /** Roving tabindex in single mode: the selected (or first) item is the tab stop. */
  protected tabIndexFor(index: number): number {
    if (this.multiple()) return 0;
    const selected = this.selectedIndex();
    return index === (selected >= 0 ? selected : 0) ? 0 : -1;
  }

  protected toggle(option: TOption): void {
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
      this.value.set(this.isSelected(option) && this.allowEmpty() ? null : optionValue);
    }
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    if (this.multiple()) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const options = this.options();
    for (let i = 1; i <= options.length; i++) {
      const next = (index + step * i + options.length) % options.length;
      if (!this.isDisabled(options[next])) {
        this.value.set(this.valueOf(options[next]));
        this.host.nativeElement.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
        return;
      }
    }
  }
}

/**
 * Two-state button (PrimeNG `p-togglebutton`): `aria-pressed`, on / off labels and icons.
 * `<star-toggle-button [(checked)]="starred" onLabel="Starred" offLabel="Star" onIcon="ph-fill ph-star" offIcon="ph-bold ph-star" />`
 */
@Component({
  selector: 'star-toggle-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-toggle-btn-host' },
  template: `
    <button
      type="button"
      class="star-segmented__item star-toggle-btn"
      [class.star-segmented__item--on]="checked()"
      [attr.aria-pressed]="checked()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="disabled()"
      (click)="!readonly() && checked.set(!checked())"
      (blur)="touch.emit()"
    >
      @if (checked() ? onIcon() : offIcon(); as icon) {
        <i [class]="icon" aria-hidden="true"></i>
      }
      <span>{{ checked() ? onLabel() : offLabel() }}</span>
    </button>
  `,
})
export class StarToggleButton implements FormCheckboxControl {
  readonly checked = model(false);
  readonly onLabel = input('On');
  readonly offLabel = input('Off');
  readonly onIcon = input<string | null>(null);
  readonly offIcon = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
}
