import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  forwardRef,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import {
  injectStarControlDefaults,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarIconContext,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
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
 * Content at the start or the end of `star-paginator`:
 * `<ng-template starPaginatorTemplate="start" let-state>…</ng-template>`. The context is the
 * current page state (`first`, `rows`, `page`, `pageCount`). PrimeNG `templateLeft` and
 * `templateRight` (here logical: start and end).
 */
@Directive({
  selector: 'ng-template[starPaginatorTemplate]',
  providers: [{ provide: StarSlot, useExisting: StarPaginatorTemplate }],
})
export class StarPaginatorTemplate extends StarSlot<{ $implicit: StarPageEvent }> {
  readonly name = 'paginator';
  readonly starPaginatorTemplate = input.required<'start' | 'end'>();

  override slotKey(): string {
    return this.starPaginatorTemplate();
  }

  static ngTemplateContextGuard(
    _dir: StarPaginatorTemplate,
    _ctx: unknown,
  ): _ctx is { $implicit: StarPageEvent } {
    return true;
  }
}

/**
 * Paginator (PrimeNG `p-paginator`): `[(first)]` / `[(rows)]`, page links window,
 * first / last buttons, a rows-per-page `star-select` and a "1–10 of 240" report, with an optional
 * jump to a page (a select or a number field).
 *
 * `<star-paginator [totalRecords]="240" [(first)]="first" [(rows)]="rows" />`
 *
 * Slots (content children): `starPaginatorTemplate` with `start` and `end`; `starIcon` with
 * `first`, `previous`, `next` and `last`.
 *
 * PrimeNG names that star-ng covers in another way: `onPageChange` = `pageChange`,
 * `showFirstLastIcon` = `showFirstLast`. Not applicable: `appendTo` and `dropdownScrollHeight`
 * (the selects are `star-select` popups in the top layer).
 */
@Component({
  selector: 'star-paginator',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarSelect, NgTemplateOutlet],
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarPaginator) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-paginator', '[hidden]': '!alwaysShow() && pageCount() <= 1' },
  template: `
    <ng-template #icon let-name="name" let-icon="icon" let-part="part">
      @if (icons().get(name); as custom) {
        <span data-star-part="pageIcon" class="star-paginator__icon" aria-hidden="true">
          <ng-container *ngTemplateOutlet="custom; context: iconContext" />
        </span>
      } @else {
        <i data-star-part="pageIcon" [class]="icon" aria-hidden="true"></i>
      }
    </ng-template>
    @if (templates().get('start'); as custom) {
      <div data-star-part="startPanel" class="star-paginator__start">
        <ng-container *ngTemplateOutlet="custom; context: { $implicit: state() }" />
      </div>
    }
    @if (showCurrentPageReport()) {
      <span data-star-part="reportText" class="star-paginator__report" aria-live="polite">{{
        report()
      }}</span>
    }
    <nav
      data-star-part="pagesPanel"
      class="star-paginator__pages"
      [attr.aria-label]="ariaLabel() ?? text.pagination"
    >
      @if (showFirstLast()) {
        <button
          data-star-part="pageButton"
          type="button"
          class="star-paginator__btn"
          [disabled]="isFirst()"
          [attr.aria-label]="text.firstPage"
          (click)="goTo(0)"
        >
          <ng-container
            *ngTemplateOutlet="
              icon;
              context: { name: 'first', icon: 'ph-bold ph-caret-double-left star-icon-mirror' }
            "
          />
        </button>
      }
      <button
        data-star-part="pageButton"
        type="button"
        class="star-paginator__btn"
        [disabled]="isFirst()"
        [attr.aria-label]="text.previousPage"
        (click)="goTo(page() - 1)"
      >
        <ng-container
          *ngTemplateOutlet="
            icon;
            context: { name: 'previous', icon: 'ph-bold ph-caret-left star-icon-mirror' }
          "
        />
      </button>
      @if (showPageLinks()) {
        @for (link of links(); track link) {
          <button
            data-star-part="pageNumberButton"
            type="button"
            class="star-paginator__btn star-paginator__page"
            [class.star-paginator__page--active]="link === page()"
            [attr.aria-current]="link === page() ? 'page' : null"
            [attr.aria-label]="text.page(link + 1)"
            (click)="goTo(link)"
          >
            {{ number(link + 1) }}
          </button>
        }
      }
      <button
        data-star-part="pageButton"
        type="button"
        class="star-paginator__btn"
        [disabled]="isLast()"
        [attr.aria-label]="text.nextPage"
        (click)="goTo(page() + 1)"
      >
        <ng-container
          *ngTemplateOutlet="
            icon;
            context: { name: 'next', icon: 'ph-bold ph-caret-right star-icon-mirror' }
          "
        />
      </button>
      @if (showFirstLast()) {
        <button
          data-star-part="pageButton"
          type="button"
          class="star-paginator__btn"
          [disabled]="isLast()"
          [attr.aria-label]="text.lastPage"
          (click)="goTo(pageCount() - 1)"
        >
          <ng-container
            *ngTemplateOutlet="
              icon;
              context: { name: 'last', icon: 'ph-bold ph-caret-double-right star-icon-mirror' }
            "
          />
        </button>
      }
    </nav>
    @if (showJumpToPageDropdown()) {
      <span data-star-part="jumpPanel" class="star-paginator__rows">
        <span data-star-part="jumpText" [id]="jumpLabelId">{{ text.goToPage }}</span>
        <star-select
          class="star-paginator__select"
          size="sm"
          [ariaLabelledBy]="jumpLabelId"
          [options]="pageOptions()"
          optionLabel="label"
          optionValue="value"
          [value]="page()"
          (valueChange)="$event !== null && goTo($event)"
        />
      </span>
    }
    @if (showJumpToPageInput()) {
      <label data-star-part="jumpLabel" class="star-paginator__rows">
        {{ text.goToPage }}
        <input
          data-star-part="jumpInput"
          class="star-input star-input--sm star-paginator__jump"
          type="number"
          inputmode="numeric"
          min="1"
          [attr.max]="pageCount()"
          [value]="page() + 1"
          (change)="jump($any($event.target))"
          (keydown.enter)="jump($any($event.target))"
        />
      </label>
    }
    @if (rowsPerPageOptions().length) {
      <span data-star-part="rowsPanel" class="star-paginator__rows">
        <span data-star-part="rowsText" [id]="rowsLabelId">{{ text.rowsPerPage }}</span>
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
    @if (templates().get('end'); as custom) {
      <div data-star-part="endPanel" class="star-paginator__end">
        <ng-container *ngTemplateOutlet="custom; context: { $implicit: state() }" />
      </div>
    }
  `,
})
export class StarPaginator {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  protected readonly rowsId = this.ids.getId('star-paginator-rows-');
  protected readonly rowsLabelId = this.ids.getId('star-paginator-rows-label-');
  protected readonly jumpLabelId = this.ids.getId('star-paginator-jump-label-');
  private readonly defaults = injectStarControlDefaults([]);

  readonly totalRecords = input(0);
  readonly first = model(0);
  readonly rows = model(10);
  readonly rowsPerPageOptions = input<readonly number[]>([10, 25, 50]);
  /** Number of page links shown around the current page. */
  readonly pageLinkSize = input(5);
  readonly showCurrentPageReport = input(true, { transform: booleanAttribute });
  readonly showFirstLast = input(true, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
  /** Shows the paginator also when there is only one page (default `true`). PrimeNG `alwaysShow`. */
  readonly alwaysShow = input(true, { transform: booleanAttribute });
  /** The page number buttons (default `true`). PrimeNG `showPageLinks`. */
  readonly showPageLinks = input(true, { transform: booleanAttribute });
  /** A select of every page next to the buttons. PrimeNG `showJumpToPageDropdown`. */
  readonly showJumpToPageDropdown = input(false, { transform: booleanAttribute });
  /** A number field that goes to the typed page on Enter or change. PrimeNG `showJumpToPageInput`. */
  readonly showJumpToPageInput = input(false, { transform: booleanAttribute });
  /**
   * Text of the report with the placeholders `{currentPage}`, `{totalPages}`, `{first}`, `{last}`,
   * `{rows}` and `{totalRecords}`, for example `'Page {currentPage} of {totalPages}'`. Default:
   * `STAR_UI_TEXT.pageReport`. PrimeNG `currentPageReportTemplate`.
   */
  readonly currentPageReportTemplate = input<string | null>(null);
  /** Locale of the numbers. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);

  readonly pageChange = output<StarPageEvent>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly templates = starSlotMap<{ $implicit: StarPageEvent }>(
    this.slots,
    this,
    'paginator',
  );
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};
  private readonly format = computed(() => new Intl.NumberFormat(this.locale()));
  protected number(value: number): string {
    return this.format().format(value);
  }
  /** The page state, for the start and end slots. */
  protected readonly state = computed<StarPageEvent>(() => ({
    first: this.first(),
    rows: this.rows(),
    page: this.page(),
    pageCount: this.pageCount(),
  }));
  protected readonly pageOptions = computed(() =>
    Array.from({ length: this.pageCount() }, (_, i) => ({ label: this.number(i + 1), value: i })),
  );

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
    const start = this.page() * this.rows();
    const first = total ? start + 1 : 0;
    const last = total ? Math.min(start + this.rows(), total) : 0;
    const template = this.currentPageReportTemplate();
    if (!template) return this.text.pageReport(first, last, total);
    const n = (value: number) => this.number(value);
    const values: Record<string, string> = {
      currentPage: n(total ? this.page() + 1 : 0),
      totalPages: n(total ? this.pageCount() : 0),
      first: n(first),
      last: n(last),
      rows: n(this.rows()),
      totalRecords: n(total),
    };
    return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
  });

  /** Goes to the page number (from 1) in a jump field. */
  protected jump(field: HTMLInputElement): void {
    const value = Math.round(Number(field.value));
    if (Number.isFinite(value) && value >= 1) this.goTo(value - 1);
    field.value = String(this.page() + 1);
  }

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
