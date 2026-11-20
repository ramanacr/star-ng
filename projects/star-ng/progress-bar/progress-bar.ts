import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

/**
 * Progress bar (PrimeNG `p-progressbar`): determinate value or indeterminate stripe,
 * optional value label, severity color. `role="progressbar"` with `aria-valuenow`.
 *
 * `<star-progress-bar [value]="uploaded()" showValue ariaLabel="Upload" />`
 */
@Component({
  selector: 'star-progress-bar',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'progressbar',
    '[class]': "'star-progress star-progress--' + severity()",
    '[class.star-progress--indeterminate]': 'indeterminate()',
    '[class.star-progress--thin]': "size() === 'sm'",
    '[attr.aria-valuemin]': 'indeterminate() ? null : 0',
    '[attr.aria-valuemax]': 'indeterminate() ? null : 100',
    '[attr.aria-valuenow]': 'indeterminate() ? null : clamped()',
    '[attr.aria-label]': 'ariaLabel()',
  },
  template: `
    <span starPart="track" class="star-progress__track">
      <span
        starPart="fill"
        class="star-progress__fill"
        [style.width.%]="indeterminate() ? null : clamped()"
      ></span>
    </span>
    @if (showValue() && !indeterminate()) {
      <span starPart="value" class="star-progress__value" aria-hidden="true">{{ clamped() }}%</span>
    }
  `,
})
export class StarProgressBar {
  readonly value = input(0);
  readonly indeterminate = input(false, { transform: booleanAttribute });
  readonly showValue = input(false, { transform: booleanAttribute });
  readonly severity = input<'primary' | 'success' | 'warn' | 'danger' | 'info'>('primary');
  readonly size = input<'sm' | 'md'>('md');
  readonly ariaLabel = input<string | null>(null);

  protected readonly clamped = computed(() => Math.round(Math.min(100, Math.max(0, this.value()))));
}
