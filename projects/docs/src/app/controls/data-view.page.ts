import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarDataView, StarDataViewItem } from '@star-ng/ui/data-display';
import { DOCS, DocsRow } from '../shared/docs';

interface Product {
  readonly name: string;
  readonly category: string;
  readonly price: number;
}

@Component({
  selector: 'docs-data-view-page',
  imports: [DOCS, StarDataView, StarDataViewItem, StarButton],
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
        note="The data view does not sort. Sort the items before you pass them in. The header slot (starDataViewHeader) is a good place for the sort control."
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
