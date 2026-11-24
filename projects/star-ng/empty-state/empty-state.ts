import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarIcon } from '@star-ng/ui/icon';

/** Why the area is empty. Sets the default icon and its tone. */
export type StarEmptyStateVariant = 'empty' | 'no-results' | 'error' | 'success';

/** `sm` in a card or a panel, `md` in a table or a list, `lg` for a whole page area. */
export type StarEmptyStateSize = 'sm' | 'md' | 'lg';

/** Level of the title heading. `null` renders the title as plain text (no heading). */
export type StarEmptyStateHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6 | null;

const ICONS: Record<StarEmptyStateVariant, string> = {
  empty: 'tray',
  'no-results': 'magnifying-glass',
  error: 'warning-circle',
  success: 'check-circle',
};

/**
 * Empty state: what a list, a table, a panel or a page area shows when it has nothing to show.
 * An icon in a tile (or an image), a title, a description and actions. PrimeNG has no empty
 * state control; the table, the data view and the list of StarNG use it as their default empty
 * template, so the look is the same everywhere.
 *
 * ```html
 * <star-empty-state variant="no-results" title="No orders found"
 *   description="No orders match the search criteria.">
 *   <star-button starEmptyStateActions variant="secondary" size="sm">Clear criteria</star-button>
 * </star-empty-state>
 * ```
 *
 * Slots: `[starEmptyStateImage]` replaces the icon tile with an image or an illustration;
 * `[starEmptyStateActions]` holds buttons or links; the default content goes under the
 * description. The title is a heading (`headingLevel`, default 3). With `status`, the host is a
 * polite live region (`role="status"`), for an empty state that replaces loading content.
 */
@Component({
  selector: 'star-empty-state',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': "'star-empty-state star-empty-state--' + variant() + ' star-empty-state--' + size()",
    '[attr.role]': "status() ? 'status' : null",
    // `title` is an input: the attribute would show as a tooltip over the whole area.
    '[attr.title]': 'null',
  },
  template: `
    <div data-star-part="graphic" class="star-empty-state__graphic">
      <ng-content select="[starEmptyStateImage]">
        @if (iconName(); as name) {
          <span data-star-part="iconPanel" class="star-empty-state__tile">
            <star-icon [name]="name" />
          </span>
        }
      </ng-content>
    </div>
    @if (title()) {
      @switch (headingLevel()) {
        @case (1) {
          <h1 data-star-part="title" class="star-empty-state__title">{{ title() }}</h1>
        }
        @case (2) {
          <h2 data-star-part="title" class="star-empty-state__title">{{ title() }}</h2>
        }
        @case (3) {
          <h3 data-star-part="title" class="star-empty-state__title">{{ title() }}</h3>
        }
        @case (4) {
          <h4 data-star-part="title" class="star-empty-state__title">{{ title() }}</h4>
        }
        @case (5) {
          <h5 data-star-part="title" class="star-empty-state__title">{{ title() }}</h5>
        }
        @case (6) {
          <h6 data-star-part="title" class="star-empty-state__title">{{ title() }}</h6>
        }
        @default {
          <p data-star-part="title" class="star-empty-state__title">{{ title() }}</p>
        }
      }
    }
    @if (description()) {
      <p data-star-part="description" class="star-empty-state__description">
        {{ description() }}
      </p>
    }
    <div data-star-part="content" class="star-empty-state__content"><ng-content /></div>
    <div data-star-part="actionList" class="star-empty-state__actions">
      <ng-content select="[starEmptyStateActions]" />
      @if (retryable()) {
        <button
          data-star-part="retryButton"
          type="button"
          class="star-btn star-btn--secondary star-btn--sm"
          (click)="retry.emit()"
        >
          <i data-star-part="retryIcon" class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i>
          {{ text.retry }}
        </button>
      }
    </div>
  `,
})
export class StarEmptyState {
  protected readonly text = inject(STAR_UI_TEXT);

  /** Why the area is empty: sets the default icon and the tone of the icon tile. */
  readonly variant = input<StarEmptyStateVariant>('empty');
  /** `sm` in a card or a panel, `md` (default) in a table or a list, `lg` for a page area. */
  readonly size = input<StarEmptyStateSize>('md');
  /**
   * Phosphor icon name, for example `tray` or `ph-tray`. Default: the icon of the variant.
   * `''` or `null` shows no icon. An `[starEmptyStateImage]` element replaces the icon.
   */
  readonly icon = input<string | null | undefined>(undefined);
  /** Title text. */
  readonly title = input('');
  /** Description text under the title. */
  readonly description = input('');
  /**
   * Level of the title heading (1 to 6). Choose the level that fits the outline of the page.
   * `null` renders the title as plain text, for example inside a table cell.
   */
  readonly headingLevel = input<StarEmptyStateHeadingLevel>(3);
  /**
   * Makes the host a polite live region (`role="status"`). Use it when the empty state replaces
   * loading content, so screen readers announce it.
   */
  readonly status = input(false, { transform: booleanAttribute });
  /** Shows a built-in retry button (text `retry` of `STAR_UI_TEXT`), for the `error` variant. */
  readonly retryable = input(false, { transform: booleanAttribute });

  /** Emits when the user presses the built-in retry button. */
  readonly retry = output<void>();

  protected readonly iconName = computed(() => {
    const icon = this.icon();
    return icon === undefined ? ICONS[this.variant()] : icon || null;
  });
}
