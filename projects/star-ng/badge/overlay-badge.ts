import { _IdGenerator } from '@angular/cdk/a11y';
import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { StarSeverity } from '@star-ng/ui/core';
import { StarBadge } from './badge';

/** Elements that take the focus with Tab. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Adds or removes one id in the `aria-describedby` list of an element, keeping the others. */
function setDescribedBy(element: Element, id: string, on: boolean): void {
  const ids = (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  const next = on ? [...new Set([...ids, id])] : ids.filter((entry) => entry !== id);
  if (next.length) element.setAttribute('aria-describedby', next.join(' '));
  else element.removeAttribute('aria-describedby');
}

/** Corner of `star-overlay-badge`. `start` and `end` follow the text direction. */
export type StarOverlayBadgePosition = 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start';

/**
 * Overlay badge (PrimeNG `p-overlaybadge`): puts a `star-badge` on a corner of any content, for
 * example an icon button or an avatar. The badge is hidden from screen readers; `ariaLabel` adds
 * visually hidden text (for example "4 unread messages"). When the content has a focusable
 * element (an icon button), the text becomes its `aria-describedby` description, so a user who
 * reaches the button with Tab hears the count. Otherwise the text is read after the content.
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
      <span class="star-sr-only star-overlay-badge__text" [id]="descriptionId">{{ text }}</span>
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

  /** Id of the visually hidden text. */
  readonly descriptionId = inject(_IdGenerator).getId('star-overlay-badge-');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  /** The focusable element of the content that has the description, if any. */
  private described: Element | null = null;

  constructor() {
    // Browser only: afterRenderEffect does not run on the server.
    afterRenderEffect({
      write: () => {
        const text = this.description();
        const target = text ? this.focusableContent() : null;
        if (this.described && this.described !== target) {
          setDescribedBy(this.described, this.descriptionId, false);
        }
        this.described = target;
        if (target) setDescribedBy(target, this.descriptionId, true);
        // With a focusable target the text is its description: the copy leaves the reading
        // order, so it is not read twice. A hidden element still gives a description.
        const span = this.host.querySelector('.star-overlay-badge__text');
        if (target) span?.setAttribute('aria-hidden', 'true');
        else span?.removeAttribute('aria-hidden');
      },
    });
    inject(DestroyRef).onDestroy(() => {
      if (this.described) setDescribedBy(this.described, this.descriptionId, false);
    });
  }

  /** The first focusable element of the projected content (not the badge or the text). */
  private focusableContent(): Element | null {
    for (const element of this.host.querySelectorAll(FOCUSABLE)) {
      if (!element.closest('.star-overlay-badge__badge, .star-overlay-badge__text')) return element;
    }
    return null;
  }

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
