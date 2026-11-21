import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarPageEvent, StarPaginator, StarPaginatorTemplate } from '@star-ng/ui/paginator';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './paginator.page.scss',
  selector: 'docs-paginator-page',
  imports: [DOCS, StarPaginator, StarPaginatorTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Paginator"
      lead="Page links, first, previous, next and last buttons, a rows-per-page select (a small star-select, not the native select of the browser) and a range report. The PrimeNG equivalent is p-paginator."
      importFrom="import { StarPaginator } from '@star-ng/ui/paginator';"
    >
      <docs-example
        heading="Pages of a list"
        source="paginator/basic"
        [script]="basicScript"
        note="The first and rows models hold the position. The paginator does not slice data: the page decides which records to show."
      >
        <div class="docs-stack">
          <star-paginator
            ariaLabel="Pagination of the list"
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
          ariaLabel="Pagination of the compact list"
          [totalRecords]="60"
          [rowsPerPageOptions]="[]"
          [showCurrentPageReport]="false"
          [showFirstLast]="false"
          [pageLinkSize]="3"
        />
      </docs-example>

      <docs-example
        heading="Jump to a page and report text"
        source="paginator/jump"
        [script]="jumpScript"
        note="showJumpToPageInput adds a number field (Enter or a change goes to the page) and showJumpToPageDropdown a select of every page. currentPageReportTemplate sets the report text with {currentPage}, {totalPages}, {first}, {last}, {rows} and {totalRecords}; the numbers use locale. showPageLinks hides the page buttons, and alwaysShow off hides the paginator when there is only one page. starPaginatorTemplate with start or end adds content at that side; it gets the page state."
      >
        <star-paginator
          [totalRecords]="12000"
          [(first)]="jumpFirst"
          [rows]="20"
          [rowsPerPageOptions]="[]"
          [showPageLinks]="false"
          showJumpToPageInput
          currentPageReportTemplate="Page {currentPage} of {totalPages} ({totalRecords} orders)"
          ariaLabel="Order pages"
        >
          <ng-template starPaginatorTemplate="end" let-state>
            <span class="docs-output">Orders {{ state.first + 1 }} and on</span>
          </ng-template>
        </star-paginator>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-paginator names that StarNG gives in another way: onPageChange is pageChange,
        showFirstLastIcon is showFirstLast, templateLeft and templateRight are starPaginatorTemplate
        with start and end, and the page link icon templates are starIcon with first, previous, next
        and last, dropdownItemTemplate and jumpToPageItemTemplate are starPaginatorOption with rows
        and jump, and dropdownicon is starIcon with dropdown (the arrow of both selects). Not
        needed: appendTo and dropdownScrollHeight (the selects are star-select popups in the top
        layer).
      </p>

      <h2>Right-to-left</h2>
      <p>
        The first, previous, next and last arrows turn around in a right-to-left page, so they point
        the way the pages run. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarPaginator', 'StarPaginatorTemplate', 'StarPaginatorOption']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class PaginatorPage {
  protected readonly first = signal(0);
  protected readonly jumpFirst = signal(0);
  protected readonly jumpScript = `readonly jumpFirst = signal(0);`;
  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starPaginatorTemplate]',
      description:
        'Content child. "start" or "end" adds content at that side. $implicit is the page state (first, rows, page, pageCount). PrimeNG templateLeft and templateRight.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. "first", "previous", "next" or "last" replaces the icon of that button; "dropdown" replaces the arrow of the rows and jump selects. PrimeNG firstpagelinkicon, the other link icons and dropdownicon.',
    },
    {
      name: 'ng-template[starPaginatorOption]',
      description:
        'Content child. "rows" replaces the options of the rows-per-page select, "jump" the options of the page select. $implicit is the rows count or the page number (from 1); label, selected and index. PrimeNG dropdownItemTemplate and jumpToPageItemTemplate.',
    },
  ];
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
