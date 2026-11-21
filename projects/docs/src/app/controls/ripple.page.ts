import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StarRipple } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './ripple.page.scss',
  selector: 'docs-ripple-page',
  imports: [DOCS, StarRipple],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Ripple"
      lead="A directive that draws a short ink circle from the point of a press. It is decoration only: it adds no element that a screen reader reads, and it does nothing when the user asks for reduced motion."
      importFrom="import { StarRipple } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="On buttons"
        source="ripple/basic"
        note="Add starRipple to any element. The ink uses the text color of the element. Press a button to see it."
      >
        <button type="button" class="star-btn star-btn--secondary star-btn--md" starRipple>
          Save
        </button>
        <button type="button" class="star-btn star-btn--primary star-btn--md" starRipple>
          Submit order
        </button>
      </docs-example>

      <docs-api [of]="['StarRipple']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class RipplePage {
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-duration-slow', description: 'Duration of the ink animation.' },
    { name: 'currentColor', description: 'Color of the ink: the text color of the element.' },
  ];
}
