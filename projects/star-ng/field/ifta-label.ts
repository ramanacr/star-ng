import { ChangeDetectionStrategy, Component, forwardRef } from '@angular/core';
import { StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarField } from './field';

/**
 * In-field top-aligned label (PrimeNG `p-iftalabel`): the label sits inside the box of the
 * control, above the value, and stays there. It is a `star-field` with another layout, so it has
 * the same inputs (`label`, `hint`, `error`, `state`, `required`, `for`) and links its label the
 * same way: `starInput`, `star-select`, `star-date-picker`, `star-input-number` and the other
 * StarNG form controls register with it (see `StarField.linkControl`).
 *
 * ```html
 * <star-ifta-label label="Customer name"><input starInput [formField]="form.name" /></star-ifta-label>
 * ```
 *
 * Wrap one control that has a text box: a text input, a select, a date or time picker, an input
 * number, a password, an input mask or an autocomplete.
 */
@Component({
  selector: 'star-ifta-label',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: StarField, useExisting: forwardRef(() => StarIftaLabel) }],
  host: { class: 'star-ifta' },
  template: `
    <div starPart="box" class="star-ifta__box">
      <!-- The label lets the pointer through (CSS), so a click reaches the control below it. -->
      <label starPart="label" class="star-ifta__label" [id]="labelId" [attr.for]="labelFor()">
        {{ label() }}
        @if (isRequired()) {
          <span starPart="required" class="star-field__required" aria-hidden="true">*</span>
        }
      </label>
      <ng-content />
    </div>
    @if (errorText(); as error) {
      <p starPart="error" class="star-field__error" [id]="errorId" role="alert">{{ error }}</p>
    } @else if (hint()) {
      <p starPart="hint" class="star-field__hint" [id]="hintId">{{ hint() }}</p>
    }
  `,
})
export class StarIftaLabel extends StarField {}
