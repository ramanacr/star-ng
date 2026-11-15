import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarSpinner } from '@star-ng/ui/spinner';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-spinner-page',
  imports: [DOCS, StarSpinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Spinner"
      lead="Shows that work is in progress when the duration is not known."
      importFrom="import { StarSpinner } from '@star-ng/ui/spinner';"
    >
      <docs-example heading="Sizes" source="spinner/sizes">
        <star-spinner size="1.25rem" [strokeWidth]="6" />
        <star-spinner />
        <star-spinner size="4rem" [strokeWidth]="3" />
      </docs-example>

      <docs-example
        heading="Accessible name"
        source="spinner/label"
        note="The default name is the 'loading' text of STAR_UI_TEXT. Set ariaLabel to say what loads."
      >
        <star-spinner ariaLabel="Loading orders" />
      </docs-example>

      <docs-api [of]="['StarSpinner']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class SpinnerPage {
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Color of the moving arc.' },
    { name: '--star-border', description: 'Color of the track.' },
  ];
}
