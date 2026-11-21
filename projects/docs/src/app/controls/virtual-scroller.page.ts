import {
  ChangeDetectionStrategy,
  Component,
  computed,
  resource,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarSkeleton } from '@star-ng/ui/skeleton';
import {
  StarVirtualItemTemplate,
  StarVirtualRange,
  StarVirtualScroller,
} from '@star-ng/ui/virtual-scroller';
import { DOCS, DocsRow } from '../shared/docs';

interface Order {
  readonly number: string;
  readonly city: string;
  readonly total: number;
}

const CITIES = ['Lisbon', 'Porto', 'Valencia', 'Lyon', 'Ghent', 'Turin', 'Graz', 'Malmo'];

function order(index: number): Order {
  return {
    number: `ORD-${String(index + 1).padStart(5, '0')}`,
    city: CITIES[index % CITIES.length],
    total: 20 + ((index * 37) % 480),
  };
}

const PAGE_SIZE = 50;
const TOTAL = 10_000;

/** A fake server: one page of orders after a short delay. No network request is made. */
function fetchOrderPage(page: number, abortSignal: AbortSignal): Promise<readonly Order[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const first = page * PAGE_SIZE;
      const count = Math.min(PAGE_SIZE, TOTAL - first);
      resolve(Array.from({ length: count }, (_, i) => order(first + i)));
    }, 400);
    abortSignal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(abortSignal.reason);
    });
  });
}

@Component({
  selector: 'docs-virtual-scroller-page-content',
  imports: [DOCS, StarVirtualScroller, StarVirtualItemTemplate, StarButton, StarSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Virtual scroller"
      lead="A list that renders only the items in and near the view, so thousands of items stay fast. Every item has the same size. It is built on the virtual scrolling of the Angular CDK. The PrimeNG equivalent is p-scroller."
      importFrom="import { StarVirtualScroller, StarVirtualItemTemplate } from '@star-ng/ui/virtual-scroller';"
    >
      <docs-example
        heading="10,000 orders"
        source="virtual-scroller/basic"
        [script]="basicScript"
        note="The item slot receives the item and its index, count, first, last, even and odd. The list can take focus, so the arrow keys and Page Up / Page Down scroll it. scrollToIndex() and scrollTo() scroll from code; visibleRange() is a signal with the items in view."
      >
        <div class="docs-stack">
          <star-virtual-scroller
            #orderList
            [items]="orders"
            [itemSize]="44"
            scrollHeight="18rem"
            ariaLabel="Orders"
          >
            <ng-template starVirtualItem [starVirtualItemOf]="orders" let-order>
              <span class="docs-scroller-row">
                <strong>{{ order.number }}</strong>
                <span>{{ order.city }}</span>
                <span>{{ order.total }} EUR</span>
              </span>
            </ng-template>
          </star-virtual-scroller>
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="orderList.scrollToIndex(0)">
              First order
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="orderList.scrollToIndex(4999)">
              Order 5,000
            </star-button>
            <star-button
              size="sm"
              variant="secondary"
              (pressed)="orderList.scrollToIndex(orders.length - 1)"
            >
              Last order
            </star-button>
          </div>
          @let inView = orderList.visibleRange();
          @if (inView.last > 0) {
            <p class="docs-output">In view: orders {{ inView.first + 1 }} to {{ inView.last }}.</p>
          }
        </div>
      </docs-example>

      <docs-example
        heading="Horizontal"
        source="virtual-scroller/horizontal"
        note="With orientation horizontal, itemSize is the width of an item. The viewport needs a height too."
      >
        <star-virtual-scroller
          [items]="cities"
          [itemSize]="120"
          orientation="horizontal"
          scrollHeight="4rem"
          ariaLabel="Cities"
        />
      </docs-example>

      <docs-example
        heading="Lazy loading with resource()"
        source="virtual-scroller/lazy"
        [script]="lazyScript"
        note="With lazy, the scroller emits lazyLoad with the rendered range. The page loads the missing pages with resource() (here from a local generator with a short delay) and shows a placeholder until a page arrives. Pass an array of the full length with placeholders: with an empty items array the viewport does not render, so no range is emitted."
      >
        <star-virtual-scroller
          [items]="lazyOrders()"
          [itemSize]="44"
          scrollHeight="18rem"
          lazy
          [loading]="page.isLoading()"
          ariaLabel="Orders, loaded on demand"
          (lazyLoad)="range.set($event)"
        >
          <ng-template starVirtualItem [starVirtualItemOf]="lazyOrders()" let-order>
            @if (order) {
              <span class="docs-scroller-row">
                <strong>{{ order.number }}</strong>
                <span>{{ order.city }}</span>
                <span>{{ order.total }} EUR</span>
              </span>
            } @else {
              <star-skeleton width="70%" height="0.875rem" />
            }
          </ng-template>
        </star-virtual-scroller>
      </docs-example>

      <docs-api
        [of]="[
          'StarVirtualScroller',
          'StarVirtualItemTemplate',
          'StarVirtualLoaderTemplate',
          'StarVirtualContentTemplate',
        ]"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
  styles: `
    .docs-scroller-row {
      display: flex;
      gap: 1rem;
      inline-size: 100%;
    }
    .docs-scroller-row > :last-child {
      margin-inline-start: auto;
    }
  `,
})
export class VirtualScrollerPageContent {
  protected readonly orders: readonly Order[] = Array.from({ length: TOTAL }, (_, i) => order(i));
  protected readonly cities = Array.from(
    { length: 500 },
    (_, i) => `${CITIES[i % CITIES.length]} ${Math.floor(i / CITIES.length) + 1}`,
  );

  // Lazy example: the rendered range, the pages loaded so far, and the first page in the range that is missing.
  protected readonly range = signal<StarVirtualRange>({ first: 0, last: 0 });
  private readonly loaded = signal<ReadonlyMap<number, readonly Order[]>>(new Map());
  private readonly missingPage = computed(() => {
    const { first, last } = this.range();
    for (let page = Math.floor(first / PAGE_SIZE); page * PAGE_SIZE < last; page++) {
      if (!this.loaded().has(page)) return page;
    }
    return null;
  });
  protected readonly page = resource({
    params: () => {
      const page = this.missingPage();
      return page === null ? undefined : { page };
    },
    loader: async ({ params, abortSignal }) => {
      const rows = await fetchOrderPage(params.page, abortSignal);
      this.loaded.update((pages) => new Map(pages).set(params.page, rows));
      return rows;
    },
  });
  protected readonly lazyOrders = computed(() => {
    const loaded = this.loaded();
    return Array.from(
      { length: TOTAL },
      (_, i) => loaded.get(Math.floor(i / PAGE_SIZE))?.[i % PAGE_SIZE] ?? null,
    );
  });

  protected readonly basicScript = `readonly orders: Order[] = /* 10,000 orders */;`;

  protected readonly lazyScript = `const PAGE_SIZE = 50;
const TOTAL = 10_000;

readonly range = signal<StarVirtualRange>({ first: 0, last: 0 });
private readonly loaded = signal<ReadonlyMap<number, readonly Order[]>>(new Map());

// The first page in the rendered range that is not loaded yet.
private readonly missingPage = computed(() => {
  const { first, last } = this.range();
  for (let page = Math.floor(first / PAGE_SIZE); page * PAGE_SIZE < last; page++) {
    if (!this.loaded().has(page)) return page;
  }
  return null;
});

// Loads the missing page; a new missing page cancels the old request.
readonly page = resource({
  params: () => {
    const page = this.missingPage();
    return page === null ? undefined : { page };
  },
  loader: async ({ params, abortSignal }) => {
    const rows = await fetchOrderPage(params.page, abortSignal);
    this.loaded.update((pages) => new Map(pages).set(params.page, rows));
    return rows;
  },
});

// One entry per order; null until its page has loaded.
readonly lazyOrders = computed(() =>
  Array.from({ length: TOTAL }, (_, i) => this.loaded().get(Math.floor(i / PAGE_SIZE))?.[i % PAGE_SIZE] ?? null),
);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starVirtualLoader]',
      description:
        'Content child. A placeholder in place of each rendered item while loading is on (let-index, let-count). PrimeNG #loader.',
    },
    {
      name: 'ng-template[starVirtualContent]',
      description:
        'Content child. Draws the rendered items in one template (let-items, let-first, let-count, let-itemSize), placed at the offset of the first one. PrimeNG #content.',
    },
    {
      name: 'ng-template[starVirtualItem]',
      description:
        'One item. Context: $implicit (the item), index, count, first, last, even, odd. Optional [starVirtualItemOf]="items" types the item. Do not put focusable elements here: an item that scrolls out of view leaves the DOM.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Shown when items is empty. Default: "No records found".',
    },
    {
      name: 'ng-template[starLoading]',
      description: 'Shown while loading is true, over the items. Default: a spinner.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-scroller-item-size', description: 'Set from itemSize. Size of each item.' },
    { name: '--star-surface', description: 'Background of the viewport.' },
    { name: '--star-border', description: 'Outline of the viewport.' },
    { name: '--star-focus-ring', description: 'Focus ring of the viewport.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves the focus to the viewport.' },
    {
      name: 'Arrow keys / Page Up / Page Down / Home / End',
      description: 'Scroll the focused viewport (browser behavior).',
    },
  ];
}

/**
 * Route component of the page. It loads the route styles (`virtual-scroller.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-virtual-scroller-page',
  imports: [VirtualScrollerPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './virtual-scroller.page.scss',
  template: '<docs-virtual-scroller-page-content />',
})
export class VirtualScrollerPage {}
