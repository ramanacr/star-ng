import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { STAR_SLOTS } from '@star-ng/ui/core';
import { StarDataView, StarDataViewItem } from '@star-ng/ui/data-display';
import { DOCS, DocsRow } from '../shared/docs';

interface Product {
  readonly name: string;
  readonly category: string;
  readonly price: number;
}

@Component({
  selector: 'docs-data-view-page',
  imports: [DOCS, StarDataView, StarDataViewItem, StarButton, STAR_SLOTS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Data view"
      lead="Items in a list or in a responsive grid, with a layout switch, client paging and an empty state. You design each item with a template. The PrimeNG equivalent is p-dataview."
      importFrom="import { StarDataView, StarDataViewItem } from '@star-ng/ui/data-display';"
    >
      <docs-example
        heading="List and grid layout"
        source="data-view/layouts"
        [script]="layoutScript"
        note="The item template gets the item, the layout (list or grid) and the index. layout is a two-way model. The two buttons in the header switch it."
      >
        <div class="docs-stack">
          <star-data-view [items]="products" [(layout)]="layout">
            <ng-template starDataViewItem [starDataViewItemOf]="products" let-p let-mode="layout">
              <strong>{{ p.name }}</strong>
              <div>{{ p.category }} · {{ '$' + p.price }}</div>
              @if (mode === 'grid') {
                <small>Grid card</small>
              }
            </ng-template>
          </star-data-view>
          <p class="docs-output" role="status">Layout: {{ layout() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Paging"
        source="data-view/paging"
        [script]="pagingScript"
        note="With paginator set, the view shows rows items from first. The paginator appears only when there are more items than rows. first and rows are two-way models."
      >
        <div class="docs-stack">
          <star-data-view [items]="products" paginator [rows]="4" [(first)]="first">
            <ng-template starDataViewItem [starDataViewItemOf]="products" let-p>
              <strong>{{ p.name }}</strong>
              <div>{{ p.category }} · {{ '$' + p.price }}</div>
            </ng-template>
          </star-data-view>
          <p class="docs-output" role="status">First item on the page: {{ first() + 1 }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Sorting by the page"
        source="data-view/sorting"
        [script]="sortingScript"
        note="You can sort the items before you pass them in, as here, or set sortField and sortOrder (next example). The header slot (starDataViewHeader) is a good place for the sort control."
      >
        <star-data-view [items]="sorted()">
          <div starDataViewHeader>
            <star-button size="sm" variant="secondary" (click)="sortBy.set('name')">
              Sort by name
            </star-button>
            <star-button size="sm" variant="secondary" (click)="sortBy.set('price')">
              Sort by price
            </star-button>
          </div>
          <ng-template starDataViewItem [starDataViewItemOf]="sorted()" let-p>
            <strong>{{ p.name }}</strong>
            <div>{{ '$' + p.price }}</div>
          </ng-template>
        </star-data-view>
      </docs-example>

      <docs-example
        heading="Empty state"
        source="data-view/empty"
        note="Without items the view shows the emptyMessage. The default text comes from the noData text of STAR_UI_TEXT."
      >
        <star-data-view [items]="[]" emptyMessage="No products match this filter.">
          <ng-template starDataViewItem let-item>{{ item }}</ng-template>
        </star-data-view>
      </docs-example>

      <docs-example
        heading="Header, footer and empty slots"
        source="data-view/slots"
        [script]="slotsScript"
        note="starHeader and starFooter add content above the layout switch and below the items. starEmpty replaces the empty message and gets the filter text (empty without filter()). Use the slots for content that is not interactive, or for your own controls with their own labels. They do not change the item template."
      >
        <div class="docs-stack">
          <star-data-view [items]="products.slice(0, 3)">
            <ng-template starHeader>
              <p class="docs-output">Today's picks</p>
            </ng-template>
            <ng-template starDataViewItem [starDataViewItemOf]="products" let-p>
              <strong>{{ p.name }}</strong>
              <div>{{ '$' + p.price }}</div>
            </ng-template>
            <ng-template starFooter>
              <p class="docs-output">Prices include tax.</p>
            </ng-template>
          </star-data-view>
          <star-data-view [items]="[]">
            <ng-template starDataViewItem let-item>{{ item }}</ng-template>
            <ng-template starEmpty let-text>
              <span style="color: var(--star-text-muted)">Nothing to show yet.</span>
            </ng-template>
          </star-data-view>
        </div>
      </docs-example>

      <docs-example
        heading="Sort field, filter, paginator options and loading"
        source="data-view/options"
        [script]="optionsScript"
        note="sortField and sortOrder (1 or -1) sort the items. filter(text) keeps the items whose filterBy fields contain the text (case and accents ignored) and goes back to the first page. paginatorPosition puts the paginator at the top, the bottom or both; rowsPerPageOptions, pageLinks, currentPageReportTemplate, showJumpToPageDropdown, showFirstLastIcon and showPageLinks go to the paginator; alwaysShowPaginator shows it on one page too. loading shows an indicator and sets aria-busy (starLoading replaces it). In lazy mode, items is the current page, totalRecords the count, and lazyLoad asks for a page."
      >
        <star-data-view
          #catalog
          [items]="products"
          paginator
          [rows]="3"
          [rowsPerPageOptions]="[3, 6]"
          paginatorPosition="both"
          sortField="price"
          [sortOrder]="priceOrder()"
          filterBy="name"
          [loading]="busy()"
        >
          <div starDataViewHeader class="docs-row">
            <label class="docs-row">
              Find
              <input
                class="star-input star-input--sm"
                type="search"
                (input)="catalog.filter($any($event.target).value)"
              />
            </label>
            <star-button
              size="sm"
              variant="secondary"
              (click)="priceOrder.set(priceOrder() === 1 ? -1 : 1)"
            >
              Price {{ priceOrder() === 1 ? 'low to high' : 'high to low' }}
            </star-button>
            <star-button size="sm" variant="secondary" (click)="busy.set(!busy())">
              {{ busy() ? 'Stop loading' : 'Show loading' }}
            </star-button>
          </div>
          <ng-template starDataViewItem [starDataViewItemOf]="products" let-p>
            <strong>{{ p.name }}</strong>
            <div>{{ '$' + p.price }}</div>
          </ng-template>
        </star-data-view>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-dataview names that StarNG gives in another way: value is items;
        onChangeLayout is layoutChange; onPage is pageChange; the list and grid templates are the
        one starDataViewItem template (it gets layout); emptymessage is starEmpty; paginatorleft and
        paginatorright are starPaginatorTemplate with start and end; loadingicon, listicon and
        gridicon are starIcon with loading, list and grid; paginatorStyleClass and gridStyleClass
        are the pass-through pt. Not needed: trackBy (the items are tracked by index),
        paginatorDropdownAppendTo and paginatorDropdownScrollHeight (the paginator selects are
        popups in the top layer) and onSort (you set sortField and sortOrder, so you know the
        change).
      </p>

      <docs-api
        [of]="['StarDataView', 'StarDataViewItem']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class DataViewPage {
  protected readonly products: readonly Product[] = [
    { name: 'Desk lamp', category: 'Lighting', price: 24 },
    { name: 'Notebook', category: 'Paper', price: 6 },
    { name: 'Water bottle', category: 'Kitchen', price: 12 },
    { name: 'Backpack', category: 'Travel', price: 58 },
    { name: 'Wall clock', category: 'Home', price: 19 },
    { name: 'Plant pot', category: 'Garden', price: 9 },
    { name: 'Floor mat', category: 'Home', price: 31 },
    { name: 'Pen set', category: 'Paper', price: 14 },
    { name: 'Coffee mug', category: 'Kitchen', price: 8 },
    { name: 'Umbrella', category: 'Travel', price: 17 },
  ];

  protected readonly layout = signal<'list' | 'grid'>('list');
  protected readonly first = signal(0);
  protected readonly sortBy = signal<'name' | 'price'>('name');
  protected readonly priceOrder = signal<1 | -1>(1);
  protected readonly busy = signal(false);
  protected readonly optionsScript = `readonly priceOrder = signal<1 | -1>(1);
readonly busy = signal(false);
// products as above; #catalog is a template reference to the data view.`;
  protected readonly sorted = computed(() =>
    [...this.products.slice(0, 5)].sort((a, b) =>
      this.sortBy() === 'name' ? a.name.localeCompare(b.name) : a.price - b.price,
    ),
  );

  protected readonly layoutScript = `interface Product { name: string; category: string; price: number }
readonly products: readonly Product[] = [
  { name: 'Desk lamp', category: 'Lighting', price: 24 },
  { name: 'Notebook', category: 'Paper', price: 6 },
];
readonly layout = signal<'list' | 'grid'>('list');`;
  protected readonly pagingScript = `readonly first = signal(0);`;
  protected readonly sortingScript = `readonly sortBy = signal<'name' | 'price'>('name');
readonly sorted = computed(() =>
  [...this.products.slice(0, 5)].sort((a, b) =>
    this.sortBy() === 'name' ? a.name.localeCompare(b.name) : a.price - b.price,
  ),
);`;

  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core' in the component imports.
readonly products: readonly Product[] = [ /* as above */ ];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template starDataViewItem',
      description:
        'The markup of one item. The context has $implicit (the item), layout (list or grid) and index. Set starDataViewItemOf to the items to type the item.',
    },
    {
      name: '[starDataViewHeader]',
      description: 'Content at the start of the header, before the layout switch.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content above the header row with the layout switch.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content below the items and the paginator.',
    },
    {
      name: 'ng-template[starEmpty]',
      description:
        'Content child. Replaces the empty message (emptyMessage and the default text). $implicit is the filter text (empty without filter()).',
    },
    {
      name: 'ng-template[starLoading]',
      description: 'Content child. Replaces the loading indicator. PrimeNG loadingicon.',
    },
    {
      name: 'ng-template[starPaginatorTemplate]',
      description:
        'Content child. "start" or "end" adds content next to the paginator; it gets the page state. PrimeNG paginatorleft and paginatorright.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. "list", "grid" or "loading" replaces that icon. PrimeNG listicon, gridicon and loadingicon.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Border of an item.' },
    { name: '--star-radius-lg', description: 'Corner radius of an item.' },
    { name: '--star-surface', description: 'Background of an item.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'Moves between the two layout buttons, the controls in your items and the paginator.',
    },
    { name: 'Enter / Space', description: 'On a layout button: switches to that layout.' },
  ];
}
