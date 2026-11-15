import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-tag-page',
  imports: [DOCS, StarTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Tag"
      lead="A short status label with a severity color and an optional icon."
      importFrom="import { StarTag } from '@star-ng/ui/tag';"
    >
      <docs-example heading="Severities" source="tag/severities">
        <star-tag value="New" />
        <star-tag severity="secondary" value="Draft" />
        <star-tag severity="success" value="Paid" />
        <star-tag severity="info" value="In review" />
        <star-tag severity="warn" value="Due soon" />
        <star-tag severity="danger" value="Overdue" />
      </docs-example>

      <docs-example heading="Icon and rounded" source="tag/icon">
        <star-tag severity="success" icon="ph-bold ph-check" rounded>Shipped</star-tag>
        <star-tag severity="warn" icon="ph-bold ph-clock" rounded>Waiting</star-tag>
      </docs-example>

      <docs-api [of]="['StarTag']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class TagPage {
  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The text, as an alternative to the value input.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-tone', description: 'Text tone of the tag. Set by the severity.' },
    { name: '--star-tone-soft', description: 'Fill of the tag. Set by the severity.' },
  ];
}
