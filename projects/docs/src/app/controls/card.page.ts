import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarCard } from '@star-ng/ui/card';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './card.page.scss',
  selector: 'docs-card-page',
  imports: [DOCS, StarCard, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Card"
      lead="A content surface with a title, a subtitle, header actions, a body and a footer. The PrimeNG equivalent is p-card."
      importFrom="import { StarCard } from '@star-ng/ui/card';"
    >
      <docs-example heading="Title, actions and footer" source="card/basic">
        <div class="docs-stack">
          <star-card header="Open orders" subheader="Last 30 days">
            <star-button starCardActions variant="ghost" size="sm">View all</star-button>
            <p>Forty-two orders are open. Nine are late.</p>
            <div starCardFooter class="docs-row">
              <star-button size="sm">Export</star-button>
              <star-button size="sm" variant="secondary">Filter</star-button>
            </div>
          </star-card>
        </div>
      </docs-example>

      <docs-example
        heading="Body only"
        source="card/plain"
        note="Without header and subheader, the card has no header bar."
      >
        <div class="docs-stack">
          <star-card>
            <p>A card with only a body.</p>
          </star-card>
        </div>
      </docs-example>

      <docs-api [of]="['StarCard']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class CardPage {
  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The body.' },
    { name: '[starCardMedia]', description: 'Media (an image) above the header.' },
    { name: '[starCardActions]', description: 'Actions at the end of the header.' },
    { name: '[starCardFooter]', description: 'The footer, with a line above it.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the card.' },
    {
      name: '--star-border',
      description: 'Outline of the card (mixed with the surface) and the line above the footer.',
    },
    { name: '--star-radius-xl', description: 'Corner radius.' },
    { name: '--star-shadow-card', description: 'Shadow of the card.' },
  ];
}
