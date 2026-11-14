import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarRating } from 'star-ng/rating';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-rating-page',
  imports: [DOCS, StarRating],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Rating"
      lead="A star rating built as a native radio group, so the arrow keys change the rating."
      importFrom="import { StarRating } from 'star-ng/rating';"
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

      <docs-api [of]="['StarRating']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class RatingPage {
  protected readonly score = signal<number | null>(3);
  protected readonly detail = signal<number | null>(7);

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-warning', description: 'Color of a filled star.' },
    { name: '--star-border-strong', description: 'Color of an empty star.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow keys', description: 'Raise or lower the rating by one star.' },
    { name: 'Tab', description: 'Moves focus into and out of the rating.' },
  ];
}
