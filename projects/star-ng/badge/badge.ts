import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StarSeverity } from '@star-ng/ui/core';

/**
 * Count or dot badge (PrimeNG `p-badge`). Without a value it renders a dot.
 * `<star-badge [value]="unread()" severity="danger" ariaLabel="unread messages" />`
 */
@Component({
  selector: 'star-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-badge star-badge--' + severity() + ' star-badge--' + size()",
    '[class.star-badge--dot]': 'isDot()',
    '[attr.role]': "ariaLabel() ? 'status' : null",
    '[attr.aria-label]': 'fullLabel()',
  },
  template: `
    @if (!isDot()) {
      {{ text() }}
    }
  `,
})
export class StarBadge {
  readonly value = input<string | number | null>(null);
  readonly severity = input<StarSeverity>('primary');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  /** Numbers above this show as "max+". */
  readonly max = input(99);
  /** What the count means, for screen readers (for example "unread messages"). */
  readonly ariaLabel = input<string | null>(null);

  protected readonly isDot = computed(() => this.value() === null || this.value() === '');
  protected readonly text = computed(() => {
    const value = this.value();
    return typeof value === 'number' && value > this.max() ? `${this.max()}+` : `${value ?? ''}`;
  });
  protected readonly fullLabel = computed(() => {
    const label = this.ariaLabel();
    return label ? `${this.text()} ${label}`.trim() : null;
  });
}
