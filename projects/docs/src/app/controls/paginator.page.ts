import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { StarPageEvent, StarPaginator } from 'star-ng/paginator';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-paginator-page',
  imports: [DOCS, StarPaginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Paginator"
      lead="Page links, first, previous, next and last buttons, a rows-per-page select and a range report. The PrimeNG equivalent is p-paginator."
      importFrom="import { StarPaginator } from 'star-ng/paginator';"
    >
      <docs-example
        heading="Pages of a list"
        source="paginator/basic"
        [script]="basicScript"
        note="The first and rows models hold the position. The paginator does not slice data: the page decides which records to show."
      >
        <div class="docs-stack">
          <star-paginator
            [totalRecords]="95"
            [(first)]="first"
            [(rows)]="rows"
            (pageChange)="last.set($event)"
          />
          <p class="docs-output" role="status">
            Showing {{ shown() }}. Last event: page {{ last() ? last()!.page + 1 : '-' }}.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Compact"
        source="paginator/compact"
        note="Hide the report, the first and last buttons or the rows select. pageLinkSize sets how many page links show."
      >
        <star-paginator
          [totalRecords]="60"
          [rowsPerPageOptions]="[]"
          [showCurrentPageReport]="false"
          [showFirstLast]="false"
          [pageLinkSize]="3"
        />
      </docs-example>

      <docs-api [of]="['StarPaginator']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class PaginatorPage {
  protected readonly first = signal(0);
  protected readonly rows = signal(10);
  protected readonly last = signal<StarPageEvent | null>(null);
  protected readonly shown = computed(
    () => `records ${this.first() + 1} to ${Math.min(this.first() + this.rows(), 95)}`,
  );

  protected readonly basicScript = `readonly first = signal(0);
readonly rows = signal(10);
readonly last = signal<StarPageEvent | null>(null);
readonly shown = computed(
  () => \`records \${this.first() + 1} to \${Math.min(this.first() + this.rows(), 95)}\`,
);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary-fill', description: 'Fill of the active page.' },
    { name: '--star-primary-hover', description: 'Fill of the active page on hover.' },
    { name: '--star-surface-muted', description: 'Fill of a button on hover.' },
    { name: '--star-text-muted', description: 'Color of the report and the rows label.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'Moves the focus through the buttons and the rows select. A disabled button is skipped.',
    },
    { name: 'Enter / Space', description: 'Goes to the page of the focused button.' },
  ];
}
