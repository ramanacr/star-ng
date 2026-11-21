import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { StarIcon } from '@star-ng/ui/icon';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './icon.page.scss',
  selector: 'docs-icon-page',
  imports: [DOCS, StarIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Icon"
      lead="A Phosphor icon class as a control: a weight, a size, and an accessible name or a decorative mode. PrimeNG uses icon classes (pi pi-check) and has no icon component; the Material equivalent is mat-icon."
      importFrom="import { StarIcon } from '@star-ng/ui/icon';"
    >
      <docs-example
        heading="Decorative icons"
        source="icon/decorative"
        note="Without label the icon is decorative (aria-hidden): the text next to it carries the meaning. The default weight is bold, as in the StarNG controls."
      >
        <p class="docs-output">
          <star-icon name="truck" /> Shipped on 3 March &nbsp;
          <star-icon name="check-circle" weight="fill" [size]="20" /> Paid
        </p>
      </docs-example>

      <docs-example
        heading="Icon with a name"
        source="icon/named"
        note="With label the icon is an image (role img) with that name: use it when no text is next to it. mirror turns an icon with a direction around in a right-to-left page."
      >
        <p class="docs-output">
          <star-icon name="warning" weight="fill" size="1.5rem" label="Warning" />
          <star-icon name="arrow-right" size="1.5rem" label="Next step" mirror />
        </p>
      </docs-example>

      <docs-api [of]="['StarIcon']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class IconPage {
  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The icon comes from the name and weight inputs.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: 'color', description: 'The icon uses currentColor: set the text color of a parent.' },
  ];
}
