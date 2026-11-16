import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';
import { StarSelect } from '@star-ng/ui/select';

export interface StarPageEvent {
  /** Index of the first record on the page (0-based). */
  readonly first: number;
  readonly rows: number;
  /** Page index (0-based). */
  readonly page: number;
  readonly pageCount: number;
}

/**
 * Paginator (PrimeNG `p-paginator`): `[(first)]` / `[(rows)]`, page links window,
 * first / last buttons, a rows-per-page `star-select` and a "1–10 of 240" report.
 *
 * `<star-paginator [totalRecords]="240" [(first)]="first" [(rows)]="rows" />`
 */
@Component({
  selector: 'star-paginator',
  imports: [StarSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-paginator' },
  template: `
    @if (showCurrentPageReport()) {
      <span class="star-paginator__report" aria-live="polite">{{ report() }}</span>
    }
    <nav class="star-paginator__pages" [attr.aria-label]="ariaLabel() ?? text.pagination">
      @if (showFirstLast()) {
        <button
          type="button"
          class="star-paginator__btn"
          [disabled]="isFirst()"
          [attr.aria-label]="text.firstPage"
          (click)="goTo(0)"
        >
          <i class="ph-bold ph-caret-double-left star-icon-mirror" aria-hidden="true"></i>
        </button>
      }
      <button
        type="button"
        class="star-paginator__btn"
        [disabled]="isFirst()"
        [attr.aria-label]="text.previousPage"
        (click)="goTo(page() - 1)"
      >
        <i class="ph-bold ph-caret-left star-icon-mirror" aria-hidden="true"></i>
      </button>
      @for (link of links(); track link) {
        <button
          type="button"
          class="star-paginator__btn star-paginator__page"
          [class.star-paginator__page--active]="link === page()"
          [attr.aria-current]="link === page() ? 'page' : null"
          [attr.aria-label]="text.page(link + 1)"
          (click)="goTo(link)"
        >
          {{ link + 1 }}
        </button>
      }
      <button
        type="button"
        class="star-paginator__btn"
        [disabled]="isLast()"
        [attr.aria-label]="text.nextPage"
        (click)="goTo(page() + 1)"
      >
        <i class="ph-bold ph-caret-right star-icon-mirror" aria-hidden="true"></i>
      </button>
      @if (showFirstLast()) {
        <button
          type="button"
          class="star-paginator__btn"
          [disabled]="isLast()"
          [attr.aria-label]="text.lastPage"
          (click)="goTo(pageCount() - 1)"
        >
          <i class="ph-bold ph-caret-double-right star-icon-mirror" aria-hidden="true"></i>
        </button>
      }
    </nav>
    @if (rowsPerPageOptions().length) {
      <span class="star-paginator__rows">
        <span [id]="rowsLabelId">{{ text.rowsPerPage }}</span>
        <star-select
          class="star-paginator__select"
          size="sm"
          [inputId]="rowsId"
          [ariaLabelledBy]="rowsLabelId"
          [options]="rowsPerPageOptions()"
          [value]="rows()"
          (valueChange)="$event !== null && changeRows($event)"
        />
      </span>
    }
  `,
})
export class StarPaginator {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  protected readonly rowsId = this.ids.getId('star-paginator-rows-');
  protected readonly rowsLabelId = this.ids.getId('star-paginator-rows-label-');

  readonly totalRecords = input(0);
  readonly first = model(0);
  readonly rows = model(10);
  readonly rowsPerPageOptions = input<readonly number[]>([10, 25, 50]);
  /** Number of page links shown around the current page. */
  readonly pageLinkSize = input(5);
  readonly showCurrentPageReport = input(true, { transform: booleanAttribute });
  readonly showFirstLast = input(true, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);

  readonly pageChange = output<StarPageEvent>();

  readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.totalRecords() / Math.max(1, this.rows()))),
  );
  readonly page = computed(() =>
    Math.min(Math.floor(this.first() / Math.max(1, this.rows())), this.pageCount() - 1),
  );
  protected readonly isFirst = computed(() => this.page() === 0);
  protected readonly isLast = computed(() => this.page() >= this.pageCount() - 1);

  protected readonly links = computed(() => {
    const count = this.pageCount();
    const size = Math.min(this.pageLinkSize(), count);
    let start = Math.max(0, this.page() - Math.floor(size / 2));
    start = Math.min(start, count - size);
    return Array.from({ length: size }, (_, i) => start + i);
  });

  protected readonly report = computed(() => {
    const total = this.totalRecords();
    if (!total) return this.text.pageReport(0, 0, 0);
    const first = this.page() * this.rows();
    return this.text.pageReport(first + 1, Math.min(first + this.rows(), total), total);
  });

  goTo(page: number): void {
    const target = Math.min(Math.max(page, 0), this.pageCount() - 1);
    if (target === this.page()) return;
    this.first.set(target * this.rows());
    this.emit();
  }

  protected changeRows(rows: number): void {
    if (rows === this.rows()) return;
    // Keep the first visible record on screen.
    const first = Math.floor(this.first() / rows) * rows;
    this.rows.set(rows);
    this.first.set(first);
    this.emit();
  }

  private emit(): void {
    this.pageChange.emit({
      first: this.first(),
      rows: this.rows(),
      page: this.page(),
      pageCount: this.pageCount(),
    });
  }
}
