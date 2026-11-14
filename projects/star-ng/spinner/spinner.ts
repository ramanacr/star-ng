import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { STAR_UI_TEXT } from 'star-ng/core';

/**
 * Indeterminate progress spinner (PrimeNG `p-progressspinner`), SVG stroke in the primary color.
 * `<star-spinner size="2rem" />`
 */
@Component({
  selector: 'star-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-spinner',
    role: 'progressbar',
    '[attr.aria-label]': 'ariaLabel() ?? text.loading',
    '[style.width]': 'size()',
    '[style.height]': 'size()',
  },
  template: `
    <svg viewBox="0 0 50 50" aria-hidden="true">
      <circle
        class="star-spinner__track"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        [attr.stroke-width]="strokeWidth()"
      />
      <circle
        class="star-spinner__arc"
        cx="25"
        cy="25"
        r="20"
        fill="none"
        [attr.stroke-width]="strokeWidth()"
      />
    </svg>
  `,
})
export class StarSpinner {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly size = input('2.5rem');
  readonly strokeWidth = input(4);
  readonly ariaLabel = input<string | null>(null);
}
