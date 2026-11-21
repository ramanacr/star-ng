import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarRating } from '@star-ng/ui/rating';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './rating.page.scss',
  selector: 'docs-rating-page',
  imports: [DOCS, StarRating, StarIconTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Rating"
      lead="A star rating built as a native radio group, so the arrow keys change the rating."
      importFrom="import { StarRating } from '@star-ng/ui/rating';"
    >
      <docs-example heading="Basic" source="rating/basic">
        <star-rating [(value)]="score" ariaLabel="Service rating" />
        <p class="docs-output" role="status">Rating: {{ score() ?? 'none' }}</p>
      </docs-example>

      <docs-example heading="Ten stars" source="rating/count">
        <star-rating [(value)]="detail" [count]="10" ariaLabel="Detailed rating" />
      </docs-example>

      <docs-example heading="Read-only and disabled" source="rating/states">
        <star-rating [value]="4" readonly ariaLabel="Average rating" />
        <star-rating [value]="2" disabled ariaLabel="Closed rating" />
      </docs-example>

      <docs-example
        heading="Cancel and custom icons"
        source="rating/cancel"
        note="cancel adds a first option that clears the rating. starIcon on, off and cancel replace the filled star, the empty star and the clear icon."
      >
        <star-rating [(value)]="hearts" cancel ariaLabel="Delivery">
          <ng-template starIcon="on"><i class="ph-fill ph-heart"></i></ng-template>
          <ng-template starIcon="off"><i class="ph-bold ph-heart"></i></ng-template>
        </star-rating>
        <p class="docs-output" role="status">Rating: {{ hearts() ?? 'none' }}</p>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The first star is on the right in a right-to-left page. The arrow keys follow the visual
        direction: Arrow left selects the next star. See the Right-to-left guide.
      </p>

      <docs-example
        heading="Half stars, vertical"
        source="rating/half"
        note="allowHalf gives each star two options, so the arrow keys step by 0.5 and each option reads, for example, 3.5 of 5. orientation vertical stacks the stars."
      >
        <div class="docs-row">
          <star-rating [(value)]="halfScore" allowHalf ariaLabel="Half stars" />
          <star-rating [(value)]="halfScore" orientation="vertical" ariaLabel="Vertical rating" />
        </div>
        <p class="docs-output" role="status">Rating: {{ halfScore() ?? 'none' }}</p>
      </docs-example>

      <docs-api [of]="['StarRating']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class RatingPage {
  protected readonly halfScore = signal<number | null>(3.5);
  protected readonly score = signal<number | null>(3);
  protected readonly detail = signal<number | null>(7);
  protected readonly hearts = signal<number | null>(2);

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-warning', description: 'Color of a filled star.' },
    { name: '--star-border-strong', description: 'Color of an empty star.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow keys', description: 'Raise or lower the rating by one star.' },
    { name: 'Tab', description: 'Moves focus into and out of the rating.' },
  ];
}
