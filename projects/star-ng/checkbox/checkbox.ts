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
import type { FormCheckboxControl } from '@angular/forms/signals';

/**
 * Checkbox (PrimeNG `p-checkbox` binary mode). Native `<input type="checkbox">` for full
 * keyboard and screen-reader support, with the StarNG box drawn over it.
 *
 * Signal Forms: `<star-checkbox [formField]="form.terms">I agree</star-checkbox>`
 * Standalone:   `<star-checkbox [(checked)]="agree" [indeterminate]="some">Label</star-checkbox>`
 */
@Component({
  selector: 'star-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-check',
    '[class.star-check--disabled]': 'disabled()',
    '[class.star-check--invalid]': 'showInvalid()',
  },
  template: `
    <label class="star-check__label">
      <input
        #box
        type="checkbox"
        class="star-check__input"
        [id]="inputId()"
        [attr.name]="name() || null"
        [checked]="checked()"
        [indeterminate]="indeterminate()"
        [disabled]="disabled()"
        [required]="required()"
        [attr.aria-invalid]="showInvalid() || null"
        [attr.aria-readonly]="readonly() || null"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-describedby]="ariaDescribedBy()"
        (change)="onChange(box)"
        (blur)="touch.emit()"
      />
      <span class="star-check__box" aria-hidden="true">
        @if (indeterminate()) {
          <i class="ph-bold ph-minus"></i>
        } @else if (checked()) {
          <i class="ph-bold ph-check"></i>
        }
      </span>
      <span class="star-check__text"><ng-content /></span>
    </label>
  `,
})
export class StarCheckbox implements FormCheckboxControl {
  readonly checked = model(false);
  /** Mixed state ("some selected"). Cleared when the user toggles the box. */
  readonly indeterminate = model(false);

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly inputId = input(inject(_IdGenerator).getId('star-checkbox-'));
  readonly ariaLabel = input<string | null>(null);
  readonly ariaDescribedBy = input<string | null>(null);

  /** Signal Forms touch notification. */
  readonly touch = output<void>();

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  /** Errors show only after the user has visited the control. */
  protected readonly showInvalid = computed(() => this.invalid() && this.touched());

  protected onChange(box: HTMLInputElement): void {
    if (this.readonly()) {
      box.checked = this.checked();
      box.indeterminate = this.indeterminate();
      return;
    }
    this.indeterminate.set(false);
    this.checked.set(box.checked);
  }

  focus(options?: FocusOptions): void {
    this.box().nativeElement.focus(options);
  }
}
