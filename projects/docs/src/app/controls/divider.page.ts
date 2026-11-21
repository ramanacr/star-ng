import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StarDivider } from '@star-ng/ui/layout';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './divider.page.scss',
  selector: 'docs-divider-page',
  imports: [DOCS, StarDivider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Divider"
      lead="A line that separates content. It can carry a label. The PrimeNG equivalent is p-divider."
      importFrom="import { StarDivider } from '@star-ng/ui/layout';"
    >
      <docs-example
        heading="Horizontal"
        source="divider/basic"
        note="The divider has role separator. The align input places the label at the start, the center or the end."
      >
        <div class="docs-stack">
          <p>Sign in with your email.</p>
          <star-divider>or</star-divider>
          <p>Continue with a link.</p>
          <star-divider align="start">Start</star-divider>
          <star-divider align="end" type="dashed">End, dashed</star-divider>
          <star-divider type="dotted" />
        </div>
      </docs-example>

      <docs-example heading="Vertical" source="divider/vertical">
        <div class="docs-row">
          <span>Orders</span>
          <star-divider layout="vertical" />
          <span>Invoices</span>
          <star-divider layout="vertical" type="dashed" />
          <span>Reports</span>
        </div>
      </docs-example>

      <docs-api [of]="['StarDivider']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class DividerPage {
  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description: 'The label in the line. Without content, the line has no gap.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Color of the line.' },
    { name: '--star-text-muted', description: 'Color of the label.' },
  ];
}
