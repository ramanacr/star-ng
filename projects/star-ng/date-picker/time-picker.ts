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
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';

/**
 * Time picker: a time of day without a date (PrimeNG `p-datepicker timeOnly`). The value is
 * 24-hour `HH:mm` text, or `null`. The control is the native time input in the StarNG input
 * style, so the browser gives the keyboard model, the locale's 12 or 24-hour display and the
 * picker on a phone.
 *
 * `<star-time-picker [formField]="form.callAt" min="08:00" max="18:00" [stepMinute]="15" />`
 */
@Component({
  selector: 'star-time-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-time' },
  template: `
    <input
      #input
      type="time"
      class="star-input"
      [class.star-input--sm]="size() === 'sm'"
      [id]="inputId()"
      [attr.name]="name() || null"
      [value]="value() ?? ''"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [step]="step()"
      [disabled]="disabled()"
      [readOnly]="readonly()"
      [required]="required()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-invalid]="(invalid() && touched()) || null"
      (change)="onChange(input.value)"
      (blur)="touch.emit()"
    />
  `,
})
export class StarTimePicker implements FormValueControl<string | null> {
  /** `HH:mm` in the 24-hour clock, or `null`. */
  readonly value = model<string | null>(null);
  /** Earliest and latest time, `HH:mm`. */
  readonly min = input<string | undefined>(undefined);
  readonly max = input<string | undefined>(undefined);
  readonly stepMinute = input(1);
  readonly size = input<'sm' | 'md'>('md');
  readonly ariaLabel = input<string | null>(null);
  readonly inputId = input(inject(_IdGenerator).getId('star-time-'));
  readonly name = input('');

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected readonly step = computed(() => Math.max(1, this.stepMinute()) * 60);
  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');

  protected onChange(text: string): void {
    // The native input gives `HH:mm` (or `HH:mm:ss`); empty text clears the value.
    const match = /^(\d{2}):(\d{2})/.exec(text);
    this.value.set(match ? `${match[1]}:${match[2]}` : null);
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }
}
