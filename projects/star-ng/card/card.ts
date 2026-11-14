import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Content card (PrimeNG `p-card`) on the StarNG `.star-card` surface: title, subtitle,
 * header actions, body and footer slots.
 * ```html
 * <star-card header="Open orders" subheader="Last 30 days">
 *   <star-button starCardActions variant="ghost" size="sm">View all</star-button>
 *   …body…
 *   <div starCardFooter>…</div>
 * </star-card>
 * ```
 */
@Component({
  selector: 'star-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-card star-card-cmp' },
  template: `
    <ng-content select="[starCardMedia]" />
    @if (header() || subheader()) {
      <header class="star-card-cmp__header">
        <div>
          @if (header()) {
            <h3 class="star-card-cmp__title">{{ header() }}</h3>
          }
          @if (subheader()) {
            <p class="star-card-cmp__subtitle">{{ subheader() }}</p>
          }
        </div>
        <ng-content select="[starCardActions]" />
      </header>
    }
    <div class="star-card-cmp__body"><ng-content /></div>
    <ng-content select="[starCardFooter]" />
  `,
})
export class StarCard {
  readonly header = input('');
  readonly subheader = input('');
}
