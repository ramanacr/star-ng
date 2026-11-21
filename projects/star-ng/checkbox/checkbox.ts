import { _IdGenerator } from '@angular/cdk/a11y';
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
import type { FormCheckboxControl } from '@angular/forms/signals';
import {
  STAR_SLOT_HOST,
  StarIconContext,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';

/**
 * Checkbox (PrimeNG `p-checkbox` binary mode). Native `<input type="checkbox">` for full
 * keyboard and screen-reader support, with the StarNG box drawn over it.
 *
 * Signal Forms: `<star-checkbox [formField]="form.terms">I agree</star-checkbox>`
 * Standalone:   `<star-checkbox [(checked)]="agree" [indeterminate]="some">Label</star-checkbox>`
 *
 * Slot: `<ng-template starIcon="check" let-checked>` replaces the check and the dash icon
 * (PrimeNG `#icon` template); `checked` is `true` when checked, `false` when indeterminate.
 */
@Component({
  selector: 'star-checkbox',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarCheckbox) }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-check',
    '[class.star-check--disabled]': 'disabled()',
    '[class.star-check--invalid]': 'showInvalid()',
  },
  template: `
    <label data-star-part="label" class="star-check__label">
      <input
        data-star-part="input"
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
        [attr.aria-labelledby]="ariaLabelledBy()"
        [attr.aria-describedby]="describedBy()"
        (change)="onChange(box)"
        (blur)="touch.emit()"
      />
      <span data-star-part="boxPanel" class="star-check__box" aria-hidden="true">
        @if ((indeterminate() || checked()) && icons().get('check'); as icon) {
          <ng-container *ngTemplateOutlet="icon; context: { $implicit: !indeterminate() }" />
        } @else if (indeterminate()) {
          <i data-star-part="boxIcon" class="ph-bold ph-minus"></i>
        } @else if (checked()) {
          <i data-star-part="boxIcon" class="ph-bold ph-check"></i>
        }
      </span>
      <span data-star-part="text" class="star-check__text"><ng-content /></span>
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
  /** Id of the element that labels the control (`aria-labelledby`). PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  readonly ariaDescribedBy = input<string | null>(null);

  /** Signal Forms touch notification. */
  readonly touch = output<void>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  /** The parent `star-field` when it labels the box: the label points at the input. */
  private readonly field = injectStarFieldLink(this.inputId);
  /** Errors show only after the user has visited the control, or while the field shows one. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );
  /** `ariaDescribedBy` and the hint or error of the parent `star-field`. */
  protected readonly describedBy = computed(() =>
    starJoinIds(this.ariaDescribedBy(), this.field?.describedBy()),
  );

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
