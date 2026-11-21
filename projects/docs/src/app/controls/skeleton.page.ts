import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarSkeleton } from '@star-ng/ui/skeleton';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './skeleton.page.scss',
  selector: 'docs-skeleton-page',
  imports: [DOCS, StarSkeleton, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Skeleton"
      lead="A placeholder shape that shows where content will appear while it loads. It is hidden from screen readers. The PrimeNG equivalent is p-skeleton."
      importFrom="import { StarSkeleton } from '@star-ng/ui/skeleton';"
    >
      <docs-example
        heading="Shapes"
        source="skeleton/basic"
        note="A skeleton has no meaning for a screen reader. Tell the user about the loading state with a status text near it."
      >
        <div class="docs-row">
          <star-skeleton shape="circle" size="3rem" />
          <div class="docs-stack">
            <star-skeleton width="60%" height="1rem" />
            <star-skeleton width="90%" height="0.75rem" />
            <star-skeleton width="40%" height="0.75rem" animation="none" />
          </div>
        </div>
      </docs-example>

      <docs-example
        heading="Loading state"
        source="skeleton/loading"
        [script]="loadingScript"
        note="Show the skeleton while the data loads, then the content."
      >
        <div class="docs-stack">
          @if (loading()) {
            <star-skeleton height="1.25rem" width="50%" />
            <star-skeleton height="0.75rem" />
          } @else {
            <strong>Orchard Supply</strong>
            <span>12 items, ships on Friday.</span>
          }
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="loading.set(!loading())">
              {{ loading() ? 'Show content' : 'Show skeleton' }}
            </star-button>
          </div>
        </div>
      </docs-example>

      <docs-api [of]="['StarSkeleton']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class SkeletonPage {
  protected readonly loading = signal(true);

  protected readonly loadingScript = `readonly loading = signal(true);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Fill of the placeholder.' },
    { name: '--star-radius-sm', description: 'Corner radius of a rectangle.' },
  ];
}
