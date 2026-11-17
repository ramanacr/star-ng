import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';
import { StarSeverity } from '@star-ng/ui/core';
import { StarBadge } from './badge';

/** Corner of `star-overlay-badge`. `start` and `end` follow the text direction. */
export type StarOverlayBadgePosition = 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start';

/**
 * Overlay badge (PrimeNG `p-overlaybadge`): puts a `star-badge` on a corner of any content, for
 * example an icon button or an avatar. The badge is hidden from screen readers; `ariaLabel` adds
 * visually hidden text after the content (for example "4 unread messages").
 *
 * ```html
 * <star-overlay-badge [value]="unread()" severity="danger" ariaLabel="unread messages">
 *   <star-button variant="secondary" iconOnly leadingIcon="ph-bold ph-bell" ariaLabel="Inbox" />
 * </star-overlay-badge>
 * ```
 */
@Component({
  selector: 'star-overlay-badge',
  imports: [StarBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': "'star-overlay-badge star-overlay-badge--' + position()" },
  template: `
    <ng-content />
    <star-badge
      class="star-overlay-badge__badge"
      aria-hidden="true"
      [value]="isDot() ? null : value()"
      [severity]="severity()"
      [size]="size()"
      [max]="max()"
    />
    @if (description(); as text) {
      <span class="star-sr-only">{{ text }}</span>
    }
  `,
})
export class StarOverlayBadge {
  /** Count or short text. Without a value (or with `dot`) the badge is a dot. */
  readonly value = input<string | number | null>(null);
  readonly severity = input<StarSeverity>('primary');
  readonly size = input<'sm' | 'md' | 'lg'>('sm');
  /** Numbers above this show as "max+". */
  readonly max = input(99);
  /** Shows a dot without the value. */
  readonly dot = input(false, { transform: booleanAttribute });
  /** Corner of the badge. `start` and `end` follow the text direction. */
  readonly position = input<StarOverlayBadgePosition>('top-end');
  /**
   * What the badge means, for screen readers (for example "unread messages"). The value is put
   * in front of it. Without it the badge is decoration only.
   */
  readonly ariaLabel = input<string | null>(null);

  protected readonly isDot = computed(() => {
    const value = this.value();
    return this.dot() || value === null || value === '';
  });
  /** The visually hidden text: the shown value and the label. */
  protected readonly description = computed(() => {
    const label = this.ariaLabel();
    if (!label) return null;
    if (this.isDot()) return label;
    const value = this.value();
    const max = this.max();
    const text = typeof value === 'number' && value > max ? `${max}+` : `${value}`;
    return `${text} ${label}`;
  });
}
