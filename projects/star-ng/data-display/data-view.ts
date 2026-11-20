import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  contentChildren,
  Directive,
  effect,
  forwardRef,
  inject,
  input,
  model,
  numberAttribute,
  output,
  signal,
  TemplateRef,
  untracked,
} from '@angular/core';
import {
  compareValues,
  readOption,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarEmptyContext,
  StarFilterBy,
  starFilterMatchAny,
  starFilterTexts,
  StarIconContext,
  StarOptionKey,
  starSlot,
  StarSlot,
  starSlotMap,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { StarPageEvent, StarPaginator } from '@star-ng/ui/paginator';

/** Item template: `<ng-template starDataViewItem let-item let-layout="layout">`. */
@Directive({ selector: 'ng-template[starDataViewItem]' })
export class StarDataViewItem<T = unknown> {
  readonly starDataViewItemOf = input<readonly T[] | null>(null);
  readonly template =
    inject<TemplateRef<{ $implicit: T; layout: 'list' | 'grid'; index: number }>>(TemplateRef);
  static ngTemplateContextGuard<T>(
    _dir: StarDataViewItem<T>,
    _ctx: unknown,
  ): _ctx is { $implicit: T; layout: 'list' | 'grid'; index: number } {
    return true;
  }
}

/** Payload of `lazyLoad`: what the page needs. PrimeNG `onLazyLoad` event. */
export interface StarDataViewLazyLoadEvent {
  /** Index of the first item of the page. */
  readonly first: number;
  /** Items per page. */
  readonly rows: number;
  /** The `sortField`, when it is a field name; `null` otherwise. */
  readonly sortField: string | null;
  readonly sortOrder: 1 | -1;
  /** The filter text (`filter()`). */
  readonly filter: string;
}

/**
 * Data view (PrimeNG `p-dataview`): items in a list or a responsive grid, layout switch, client
 * or lazy pagination, an optional sort and filter, a loading state and an empty state. You design
 * each item with a template.
 *
 * ```html
 * <star-data-view [items]="products" [(layout)]="layout" paginator [rows]="6">
 *   <ng-template starDataViewItem let-p let-layout="layout">…</ng-template>
 * </star-data-view>
 * ```
 *
 * Slots (content children): `starHeader` (content above the layout switch), `starFooter`
 * (content below the items and the paginator), `starEmpty` (replaces the empty message;
 * `$implicit` is the filter text), `starLoading` (replaces the loading indicator),
 * `starPaginatorTemplate` with `start` and `end` (content next to the paginator), and `starIcon`
 * with `list`, `grid` and `loading`. The item template is `starDataViewItem` (it gets `layout`,
 * so one template covers PrimeNG `#list` and `#grid`). Keep interactive content in your own items
 * and in the header and footer slots: the data view has no keyboard model of its own for them.
 *
 * PrimeNG names that star-ng covers in another way: `value` = `items`, `onChangeLayout` =
 * `layoutChange`, `paginatorStyleClass` and `gridStyleClass` = `pt` (parts `pagerPanel`,
 * `itemsList`). Not applicable: `trackBy` (the items are tracked by index),
 * `paginatorDropdownAppendTo` and `paginatorDropdownScrollHeight` (the selects of the paginator
 * are popups in the top layer), `onSort` (the owner sets `sortField` and `sortOrder`, so it knows
 * the change).
 */
@Component({
  selector: 'star-data-view',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet, StarPaginator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarDataView) }],
  host: {
    class: 'star-data-view',
    '[attr.aria-busy]': 'loading() || null',
  },
  template: `
    @if (headerSlot(); as header) {
      <ng-container *ngTemplateOutlet="header" />
    }
    <div data-star-part="header" class="star-data-view__header">
      <ng-content select="[starDataViewHeader]" />
      <div
        data-star-part="segmentedPanel"
        class="star-segmented star-segmented--sm"
        role="radiogroup"
        [attr.aria-label]="text.layout"
      >
        @for (option of layouts; track option.id) {
          <button
            data-star-part="item"
            type="button"
            role="radio"
            class="star-segmented__item"
            [class.star-segmented__item--on]="layout() === option.id"
            [attr.aria-checked]="layout() === option.id"
            [attr.aria-label]="option.label"
            (click)="layout.set(option.id)"
          >
            @if (icons().get(option.id); as custom) {
              <span data-star-part="itemIcon" class="star-data-view__icon" aria-hidden="true">
                <ng-container *ngTemplateOutlet="custom; context: iconContext" />
              </span>
            } @else {
              <i data-star-part="itemIcon" [class]="option.icon" aria-hidden="true"></i>
            }
          </button>
        }
      </div>
    </div>
    @if (showPaginator() && paginatorPosition() !== 'bottom') {
      <ng-container *ngTemplateOutlet="pager" />
    }
    <ul
      data-star-part="itemsList"
      class="star-data-view__items"
      [class.star-data-view__items--grid]="layout() === 'grid'"
    >
      @for (item of pageItems(); track $index; let i = $index) {
        <li data-star-part="item" class="star-data-view__item">
          @if (itemTemplate(); as custom) {
            <ng-container
              *ngTemplateOutlet="
                custom.template;
                context: { $implicit: item, layout: layout(), index: i }
              "
            />
          }
        </li>
      } @empty {
        @if (!loading()) {
          <li data-star-part="emptyItem" class="star-table__empty">
            <i data-star-part="emptyIcon" class="ph-bold ph-tray" aria-hidden="true"></i>
            @if (emptySlot(); as custom) {
              <ng-container *ngTemplateOutlet="custom; context: emptyContext()" />
            } @else {
              {{ emptyMessage() ?? text.noData }}
            }
          </li>
        }
      }
    </ul>
    @if (loading()) {
      <div data-star-part="loadingPanel" class="star-data-view__loading" role="status">
        @if (loadingSlot(); as custom) {
          <ng-container *ngTemplateOutlet="custom" />
        } @else if (icons().get('loading'); as custom) {
          <span data-star-part="loadingIcon" aria-hidden="true">
            <ng-container *ngTemplateOutlet="custom; context: iconContext" />
          </span>
          <span class="star-sr-only">{{ text.loading }}</span>
        } @else {
          <i data-star-part="loadingIcon" [class]="loadingIcon()" aria-hidden="true"></i>
          <span class="star-sr-only">{{ text.loading }}</span>
        }
      </div>
    }
    @if (showPaginator() && paginatorPosition() !== 'top') {
      <ng-container *ngTemplateOutlet="pager" />
    }
    @if (footerSlot(); as footer) {
      <ng-container *ngTemplateOutlet="footer" />
    }
    <ng-template #pager>
      <div data-star-part="pagerPanel" class="star-data-view__pager">
        @if (pagerSlots().get('start'); as custom) {
          <ng-container *ngTemplateOutlet="custom; context: { $implicit: pageState() }" />
        }
        <star-paginator
          [totalRecords]="recordCount()"
          [first]="first()"
          (firstChange)="first.set($event)"
          [rows]="rows()"
          (rowsChange)="rows.set($event)"
          [rowsPerPageOptions]="rowsPerPageOptions()"
          [pageLinkSize]="pageLinks()"
          [showCurrentPageReport]="showCurrentPageReport()"
          [currentPageReportTemplate]="currentPageReportTemplate()"
          [showJumpToPageDropdown]="showJumpToPageDropdown()"
          [showFirstLast]="showFirstLastIcon()"
          [showPageLinks]="showPageLinks()"
          [ariaLabel]="paginatorAriaLabel()"
          (pageChange)="onPage($event)"
        />
        @if (pagerSlots().get('end'); as custom) {
          <ng-container *ngTemplateOutlet="custom; context: { $implicit: pageState() }" />
        }
      </div>
    </ng-template>
  `,
})
export class StarDataView<T = unknown> {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly layouts = [
    { id: 'list' as const, label: this.text.layoutList, icon: 'ph-bold ph-list' },
    { id: 'grid' as const, label: this.text.layoutGrid, icon: 'ph-bold ph-squares-four' },
  ];
  readonly items = input<readonly T[]>([]);
  readonly layout = model<'list' | 'grid'>('list');
  readonly paginator = input(false, { transform: booleanAttribute });
  readonly rows = model(6);
  readonly first = model(0);
  readonly emptyMessage = input<string | null>(null);
  /** Rows-per-page choices of the paginator (default none). PrimeNG `rowsPerPageOptions`. */
  readonly rowsPerPageOptions = input<readonly number[]>([]);
  /** Where the paginator goes: `'bottom'` (default), `'top'` or `'both'`. */
  readonly paginatorPosition = input<'top' | 'bottom' | 'both'>('bottom');
  /** Shows the paginator also when everything fits on one page. PrimeNG `alwaysShowPaginator`. */
  readonly alwaysShowPaginator = input(false, { transform: booleanAttribute });
  /** Number of page links of the paginator (default 5). PrimeNG `pageLinks`. */
  readonly pageLinks = input(5, { transform: numberAttribute });
  /** The "1–6 of 24" report of the paginator (default `true`). */
  readonly showCurrentPageReport = input(true, { transform: booleanAttribute });
  /** Report text with placeholders; see `star-paginator`. */
  readonly currentPageReportTemplate = input<string | null>(null);
  /** A select of every page in the paginator. */
  readonly showJumpToPageDropdown = input(false, { transform: booleanAttribute });
  /** First and last page buttons in the paginator (default `true`). */
  readonly showFirstLastIcon = input(true, { transform: booleanAttribute });
  /**
   * Accessible name of the paginator navigation (default `STAR_UI_TEXT.pagination`). Give each
   * data view on a page its own name, so the navigation landmarks differ.
   */
  readonly paginatorAriaLabel = input<string | null>(null);
  /** Page number buttons in the paginator (default `true`). */
  readonly showPageLinks = input(true, { transform: booleanAttribute });
  /**
   * Lazy mode: `items` is the current page only, `totalRecords` the count of all items, and
   * `lazyLoad` asks for a page: at start (`lazyLoadOnInit`), after a page change, after `filter()`,
   * and once after each change of `sortField` or `sortOrder` (then from the first page).
   */
  readonly lazy = input(false, { transform: booleanAttribute });
  /** Emits `lazyLoad` for the first page at start (default `true`). PrimeNG `lazyLoadOnInit`. */
  readonly lazyLoadOnInit = input(true, { transform: booleanAttribute });
  /** Count of all items in lazy mode. PrimeNG `totalRecords`. */
  readonly totalRecords = input(0, { transform: numberAttribute });
  /** Shows a loading indicator over the items and sets `aria-busy`. */
  readonly loading = input(false, { transform: booleanAttribute });
  /** Icon classes of the loading indicator. */
  readonly loadingIcon = input('ph-bold ph-spinner-gap star-spin');
  /**
   * Field (or function) to sort the items by; `null` keeps the given order. A change of the sort
   * goes back to the first page.
   */
  readonly sortField = input<StarOptionKey<T> | null>(null);
  /** `1` ascending (default), `-1` descending. */
  readonly sortOrder = input<1 | -1>(1);
  /** Fields that `filter()` searches (one key or several). Default: the item itself as text. */
  readonly filterBy = input<StarFilterBy<T>>(null);
  /** Locale of the case and accent folding of the filter. */
  readonly filterLocale = input<string | null>(null);
  /** Emits the page after a page change. PrimeNG `onPage`. */
  readonly pageChange = output<StarPageEvent>();
  /** Lazy mode: emits what the page needs. PrimeNG `onLazyLoad`. */
  readonly lazyLoad = output<StarDataViewLazyLoadEvent>();

  protected readonly itemTemplate = contentChild(StarDataViewItem);
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly emptySlot = starSlot<StarEmptyContext>(this.slots, this, 'empty');
  protected readonly loadingSlot = starSlot<object>(this.slots, this, 'loading');
  protected readonly pagerSlots = starSlotMap<{ $implicit: StarPageEvent }>(
    this.slots,
    this,
    'paginator',
  );
  protected readonly icons = starSlotMap<StarIconContext>(this.slots, this, 'icon');
  protected readonly iconContext: StarIconContext = {};

  private readonly query = signal('');
  protected readonly emptyContext = computed<StarEmptyContext>(() => ({ $implicit: this.query() }));

  /** The items after the filter and the sort (client mode). */
  private readonly prepared = computed(() => {
    let items = [...this.items()];
    if (this.lazy()) return items;
    const query = this.query();
    if (query.trim()) {
      items = items.filter((item) =>
        starFilterMatchAny(
          starFilterTexts(item, this.filterBy(), (value) => String(value ?? '')),
          query,
          'contains',
          this.filterLocale(),
        ),
      );
    }
    const field = this.sortField();
    if (field !== null) {
      const order = this.sortOrder();
      items.sort((a, b) => order * compareValues(readOption(a, field), readOption(b, field)));
    }
    return items;
  });
  protected readonly recordCount = computed(() =>
    this.lazy() ? this.totalRecords() : this.prepared().length,
  );
  protected readonly showPaginator = computed(
    () => this.paginator() && (this.alwaysShowPaginator() || this.recordCount() > this.rows()),
  );
  protected readonly pageItems = computed(() => {
    const items = this.prepared();
    if (this.lazy() || !this.paginator()) return items;
    return items.slice(this.first(), this.first() + this.rows());
  });
  protected readonly pageState = computed<StarPageEvent>(() => ({
    first: this.first(),
    rows: this.rows(),
    page: Math.floor(this.first() / Math.max(1, this.rows())),
    pageCount: Math.max(1, Math.ceil(this.recordCount() / Math.max(1, this.rows()))),
  }));

  /** The sort of the last run of the sort effect (`undefined` before the first run). */
  private lastSort: { field: StarOptionKey<T> | null; order: 1 | -1 } | undefined;
  /** The first render is done: a lazy sort change may ask for data. */
  private started = false;

  constructor() {
    afterNextRender(() => {
      this.started = true;
      if (this.lazy() && this.lazyLoadOnInit()) this.emitLazy();
    });
    // A change of `sortField` or `sortOrder` goes back to the first page; in lazy mode it asks
    // for that page once. The first run only records the initial sort (no request on init).
    effect(() => {
      const sort = { field: this.sortField(), order: this.sortOrder() };
      untracked(() => {
        const last = this.lastSort;
        this.lastSort = sort;
        if (!last || (last.field === sort.field && last.order === sort.order)) return;
        this.first.set(0);
        if (this.lazy() && this.started) this.emitLazy();
      });
    });
  }

  /** Filters the items by `filterBy` (contains, case and accents ignored). PrimeNG `filter()`. */
  filter(value: string): void {
    this.query.set(value);
    this.first.set(0);
    if (this.lazy()) this.emitLazy();
  }

  protected onPage(event: StarPageEvent): void {
    this.pageChange.emit(event);
    if (this.lazy()) this.emitLazy();
  }

  private emitLazy(): void {
    const field = this.sortField();
    this.lazyLoad.emit({
      first: this.first(),
      rows: this.rows(),
      sortField: typeof field === 'string' ? field : null,
      sortOrder: this.sortOrder(),
      filter: this.query(),
    });
  }
}
