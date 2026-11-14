import { _IdGenerator } from '@angular/cdk/a11y';
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
import type { FormValueControl } from '@angular/forms/signals';

/**
 * Radio group (PrimeNG `p-radiobutton` used as a group). The group owns the value; each
 * `star-radio` is a native radio input, so arrow keys move and select natively.
 *
 * ```html
 * <star-radio-group [formField]="form.priority" ariaLabel="Priority">
 *   <star-radio value="low">Low</star-radio>
 *   <star-radio value="high">High</star-radio>
 * </star-radio-group>
 * ```
 */
@Component({
  selector: 'star-radio-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-radio-group',
    role: 'radiogroup',
    '[class.star-radio-group--horizontal]': "orientation() === 'horizontal'",
    '[attr.aria-label]': 'ariaLabel()',
    '[attr.aria-labelledby]': 'ariaLabelledBy()',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-invalid]': 'showInvalid() || null',
    '[attr.aria-disabled]': 'disabled() || null',
  },
  template: `<ng-content />`,
})
export class StarRadioGroup<T = unknown> implements FormValueControl<T | null> {
  readonly value = model<T | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
  readonly ariaLabel = input<string | null>(null);
  readonly ariaLabelledBy = input<string | null>(null);

  readonly touch = output<void>();

  private readonly fallbackName = inject(_IdGenerator).getId('star-radio-group-');
  readonly groupName = computed(() => this.name() || this.fallbackName);
  protected readonly showInvalid = computed(() => this.invalid() && this.touched());
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  isSelected(value: T): boolean {
    return Object.is(this.value(), value);
  }

  select(value: T): void {
    if (this.disabled() || this.readonly()) return;
    this.value.set(value);
  }

  focus(options?: FocusOptions): void {
    const inputs = [
      ...this.host.nativeElement.querySelectorAll<HTMLInputElement>('input[type=radio]'),
    ];
    (inputs.find((radio) => radio.checked) ?? inputs.find((radio) => !radio.disabled))?.focus(
      options,
    );
  }
}

@Component({
  selector: 'star-radio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-radio',
    '[class.star-radio--disabled]': 'isDisabled()',
  },
  template: `
    <label class="star-radio__label">
      <input
        #radio
        type="radio"
        class="star-radio__input"
        [id]="inputId()"
        [name]="group.groupName()"
        [checked]="checked()"
        [disabled]="isDisabled()"
        [required]="group.required()"
        (change)="onChange(radio)"
        (blur)="group.touch.emit()"
      />
      <span class="star-radio__dot" aria-hidden="true"></span>
      <span class="star-radio__text"><ng-content /></span>
    </label>
  `,
})
export class StarRadio<T = unknown> {
  protected readonly group = inject<StarRadioGroup<T>>(StarRadioGroup);

  readonly value = input.required<T>();
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly inputId = input(inject(_IdGenerator).getId('star-radio-'));

  protected readonly checked = computed(() => this.group.isSelected(this.value()));
  protected readonly isDisabled = computed(() => this.disabled() || this.group.disabled());

  protected onChange(radio: HTMLInputElement): void {
    if (this.group.readonly()) {
      radio.checked = this.checked();
      return;
    }
    if (radio.checked) this.group.select(this.value());
  }
}
