import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarBadge } from 'star-ng/badge';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-badge-page',
  imports: [DOCS, StarBadge],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Badge"
      lead="A count or a dot. Without a value it renders a dot."
      importFrom="import { StarBadge } from 'star-ng/badge';"
    >
      <docs-example
        heading="Counts"
        source="badge/counts"
        note="ariaLabel says what the count means: a screen reader then reads '4 unread messages'."
      >
        <star-badge [value]="4" ariaLabel="unread messages" />
        <star-badge [value]="128" [max]="99" severity="danger" ariaLabel="open alerts" />
        <star-badge value="New" severity="success" />
      </docs-example>

      <docs-example heading="Severities" source="badge/severities">
        <star-badge [value]="1" />
        <star-badge [value]="2" severity="secondary" />
        <star-badge [value]="3" severity="success" />
        <star-badge [value]="4" severity="info" />
        <star-badge [value]="5" severity="warn" />
        <star-badge [value]="6" severity="danger" />
      </docs-example>

      <docs-example heading="Sizes and dot" source="badge/sizes">
        <star-badge [value]="7" size="sm" />
        <star-badge [value]="7" />
        <star-badge [value]="7" size="lg" />
        <star-badge severity="success" ariaLabel="online" />
      </docs-example>

      <docs-api [of]="['StarBadge']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class BadgePage {
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-tone', description: 'Fill of the badge. Set by the severity.' },
    { name: '--star-on-tone', description: 'Text color on the fill.' },
  ];
}
