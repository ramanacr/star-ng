import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';

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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-card star-card-cmp' },
  template: `
    <ng-content select="[starCardMedia]" />
    @if (header() || subheader()) {
      <header data-star-part="header" class="star-card-cmp__header">
        <div data-star-part="heading">
          @if (header()) {
            <h3 data-star-part="title" class="star-card-cmp__title">{{ header() }}</h3>
          }
          @if (subheader()) {
            <p data-star-part="subtitle" class="star-card-cmp__subtitle">{{ subheader() }}</p>
          }
        </div>
        <ng-content select="[starCardActions]" />
      </header>
    }
    <div data-star-part="body" class="star-card-cmp__body"><ng-content /></div>
    <ng-content select="[starCardFooter]" />
  `,
})
export class StarCard {
  readonly header = input('');
  readonly subheader = input('');
}
