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
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';

/**
 * On/off switch (PrimeNG `p-toggleswitch`). Native checkbox with `role="switch"`, so Space toggles
 * and screen readers announce "on" / "off".
 *
 * `<star-toggle-switch [(checked)]="notify">Email notifications</star-toggle-switch>`
 */
@Component({
  selector: 'star-toggle-switch',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-switch',
    '[class.star-switch--disabled]': 'disabled()',
    '[class.star-switch--invalid]': 'invalid() && touched()',
    '[class.star-switch--sm]': "size() === 'sm'",
  },
  template: `
    <label data-star-part="label" class="star-switch__label">
      <input
        data-star-part="input"
        #box
        type="checkbox"
        role="switch"
        class="star-switch__input"
        [id]="inputId()"
        [attr.name]="name() || null"
        [checked]="checked()"
        [disabled]="disabled()"
        [attr.aria-checked]="checked()"
        [attr.aria-readonly]="readonly() || null"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-describedby]="fieldDescribedBy()"
        (change)="onChange(box)"
        (blur)="touch.emit()"
      />
      <span data-star-part="track" class="star-switch__track" aria-hidden="true"
        ><span data-star-part="thumbnail" class="star-switch__thumb"></span
      ></span>
      @if (hasLabel()) {
        <span data-star-part="text" class="star-switch__text"><ng-content /></span>
      }
    </label>
  `,
})
export class StarToggleSwitch implements FormCheckboxControl {
  readonly checked = model(false);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly size = input<'sm' | 'md'>('md');
  readonly inputId = input(inject(_IdGenerator).getId('star-switch-'));
  /** The parent `star-field` when it labels the switch: the label points at the input. */
  private readonly field = injectStarFieldLink(this.inputId);
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  readonly ariaLabel = input<string | null>(null);
  /** Set false when the switch has no visible label (then set `ariaLabel`). */
  readonly hasLabel = input(true, { transform: booleanAttribute });

  readonly touch = output<void>();

  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');

  protected onChange(box: HTMLInputElement): void {
    if (this.readonly()) {
      box.checked = this.checked();
      return;
    }
    this.checked.set(box.checked);
  }

  focus(options?: FocusOptions): void {
    this.box().nativeElement.focus(options);
  }
}
