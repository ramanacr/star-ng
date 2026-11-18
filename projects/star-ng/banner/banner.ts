import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

export type StarBannerSeverity = 'info' | 'success' | 'warn' | 'danger';

const ICONS: Record<StarBannerSeverity, string> = {
  info: 'ph-fill ph-info',
  success: 'ph-fill ph-check-circle',
  warn: 'ph-fill ph-warning',
  danger: 'ph-fill ph-warning-circle',
};

/**
 * Banner (Ignite `igx-banner`, the Material banner pattern): a persistent notice for the whole
 * page, under the app bar. It stays until the user dismisses it or the application closes it.
 * It is not a toast: use `star-toast` for short messages that go away on their own.
 *
 * ```html
 * <star-banner severity="warn" dismissible [(open)]="showNotice">
 *   The export service is slow today.
 *   <star-button starBannerActions variant="ghost" size="sm">Details</star-button>
 * </star-banner>
 * ```
 *
 * The banner is a `status` live region (`alert` for `danger`). The dismiss button is the last
 * control of the banner.
 */
@Component({
  selector: 'star-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-banner star-banner--' + severity()",
    '[attr.role]': "severity() === 'danger' ? 'alert' : 'status'",
    '[hidden]': '!open()',
  },
  template: `
    @if (open()) {
      <div class="star-banner__inner">
        @if (iconClass(); as iconClass) {
          <i class="star-banner__icon" [class]="iconClass" aria-hidden="true"></i>
        }
        <div class="star-banner__text"><ng-content /></div>
        <div class="star-banner__actions">
          <ng-content select="[starBannerActions]" />
          @if (dismissible()) {
            <button
              type="button"
              class="star-btn star-btn--ghost star-btn--icon star-banner__dismiss"
              [attr.aria-label]="text.dismiss"
              (click)="dismiss()"
            >
              <i class="ph-bold ph-x" aria-hidden="true"></i>
            </button>
          }
        </div>
      </div>
    }
  `,
})
export class StarBanner {
  protected readonly text = inject(STAR_UI_TEXT);

  /** Color and default icon. */
  readonly severity = input<StarBannerSeverity>('info');
  /**
   * Phosphor icon class, for example `ph-fill ph-cloud-warning`. Default: the icon of the
   * severity. `''` or `null` shows no icon.
   */
  readonly icon = input<string | null | undefined>(undefined);
  /** Shows a dismiss button. */
  readonly dismissible = input(false, { transform: booleanAttribute });
  /** Whether the banner is shown. The dismiss button sets it to `false`. */
  readonly open = model(true);

  /** Emits when the user dismisses the banner with its button. */
  readonly dismissed = output<void>();

  protected readonly iconClass = computed(() => {
    const icon = this.icon();
    return icon === undefined ? ICONS[this.severity()] : icon || null;
  });

  /** Hides the banner and emits `dismissed`. */
  dismiss(): void {
    this.open.set(false);
    this.dismissed.emit();
  }
}
