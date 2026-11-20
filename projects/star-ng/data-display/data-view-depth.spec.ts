import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarIconTemplate, StarLoadingTemplate } from '@star-ng/ui/core';
import { StarPageEvent, StarPaginatorTemplate } from '@star-ng/ui/paginator';
import { StarDataView, StarDataViewItem, StarDataViewLazyLoadEvent } from './data-view';

interface Product {
  readonly name: string;
  readonly price: number;
}

const PRODUCTS: readonly Product[] = [
  { name: 'Lamp', price: 30 },
  { name: 'Desk', price: 120 },
  { name: 'Chair', price: 80 },
  { name: 'Shelf', price: 60 },
  { name: 'Rug', price: 45 },
];

@Component({
  imports: [
    StarDataView,
    StarDataViewItem,
    StarLoadingTemplate,
    StarIconTemplate,
    StarPaginatorTemplate,
  ],
  template: `
    <star-data-view
      #view
      [items]="items()"
      paginator
      [(first)]="first"
      [rows]="2"
      [sortField]="sortField()"
      [sortOrder]="sortOrder()"
      filterBy="name"
      [lazy]="lazy()"
      [totalRecords]="40"
      [loading]="loading()"
      [paginatorPosition]="position()"
      [alwaysShowPaginator]="always()"
      [rowsPerPageOptions]="[2, 4]"
      (pageChange)="pages.push($event)"
      (lazyLoad)="loads.push($event)"
    >
      <ng-template starDataViewItem [starDataViewItemOf]="items()" let-p
        ><span class="name">{{ p.name }}</span></ng-template
      >
      @if (slots()) {
        <ng-template starLoading><b class="own-loading">Wait</b></ng-template>
        <ng-template starIcon="grid"><b class="own-grid">G</b></ng-template>
        <ng-template starPaginatorTemplate="start" let-state
          ><b class="own-start">{{ state.page }}</b></ng-template
        >
      }
    </star-data-view>
  `,
})
class Host {
  readonly items = signal<readonly Product[]>(PRODUCTS);
  readonly first = signal(0);
  readonly sortField = signal<'name' | 'price' | null>(null);
  readonly sortOrder = signal<1 | -1>(1);
  readonly lazy = signal(false);
  readonly loading = signal(false);
  readonly position = signal<'top' | 'bottom' | 'both'>('bottom');
  readonly always = signal(false);
  readonly slots = signal(false);
  readonly pages: StarPageEvent[] = [];
  readonly loads: StarDataViewLazyLoadEvent[] = [];
}

async function setup(change?: (host: Host) => void) {
  const fixture = TestBed.createComponent(Host);
  change?.(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const view = fixture.debugElement.children[0].componentInstance as StarDataView<Product>;
  const names = () => [...el.querySelectorAll('.name')].map((n) => n.textContent);
  return { el, host: fixture.componentInstance, view, names, stable: () => fixture.whenStable() };
}

describe('StarDataView depth', () => {
  it('sorts by sortField and sortOrder', async () => {
    const t = await setup((h) => h.sortField.set('price'));
    expect(t.names()).toEqual(['Lamp', 'Rug']);
    t.host.sortOrder.set(-1);
    await t.stable();
    expect(t.names()).toEqual(['Desk', 'Chair']);
  });

  it('filters with filter() and goes back to the first page', async () => {
    const t = await setup((h) => h.first.set(2));
    t.view.filter('e');
    await t.stable();
    expect(t.host.first()).toBe(0);
    expect(t.names()).toEqual(['Desk', 'Shelf']);
    t.view.filter('zz');
    await t.stable();
    expect(t.el.querySelector('.star-table__empty')).not.toBeNull();
  });

  it('emits pageChange and passes the paginator options', async () => {
    const t = await setup();
    t.el.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click();
    await t.stable();
    expect(t.host.pages.at(-1)!.page).toBe(1);
    expect(t.names()).toEqual(['Chair', 'Shelf']);
    expect(t.el.querySelector('star-paginator [role=combobox]')).not.toBeNull();
  });

  it('puts the paginator at the top, at both ends, and can always show it', async () => {
    const t = await setup((h) => h.position.set('both'));
    expect(t.el.querySelectorAll('star-paginator').length).toBe(2);
    t.host.position.set('top');
    t.host.items.set(PRODUCTS.slice(0, 1));
    await t.stable();
    expect(t.el.querySelectorAll('star-paginator').length).toBe(0);
    t.host.always.set(true);
    await t.stable();
    const pager = t.el.querySelector('star-paginator')!;
    expect(pager.compareDocumentPosition(t.el.querySelector('ul')!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('asks for pages in lazy mode', async () => {
    const t = await setup((h) => {
      h.lazy.set(true);
      h.items.set(PRODUCTS.slice(0, 2));
      h.sortField.set('name');
    });
    expect(t.host.loads).toEqual([
      { first: 0, rows: 2, sortField: 'name', sortOrder: 1, filter: '' },
    ]);
    expect(t.names()).toEqual(['Lamp', 'Desk']);
    expect(t.el.querySelector('.star-paginator__report')!.textContent).toContain('40');
    t.el.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click();
    await t.stable();
    expect(t.host.loads.at(-1)!.first).toBe(2);
    t.view.filter('de');
    expect(t.host.loads.at(-1)).toEqual({
      first: 0,
      rows: 2,
      sortField: 'name',
      sortOrder: 1,
      filter: 'de',
    });
  });

  it('asks again from the first page after a sort change in lazy mode, once per change', async () => {
    const t = await setup((h) => {
      h.lazy.set(true);
      h.items.set(PRODUCTS.slice(0, 2));
      h.sortField.set('name');
    });
    expect(t.host.loads.length).toBe(1);
    t.el.querySelector<HTMLButtonElement>('[aria-label="Next page"]')!.click();
    await t.stable();
    expect(t.host.loads.length).toBe(2);
    t.host.sortOrder.set(-1);
    await t.stable();
    expect(t.host.loads.length).toBe(3);
    expect(t.host.loads.at(-1)).toEqual({
      first: 0,
      rows: 2,
      sortField: 'name',
      sortOrder: -1,
      filter: '',
    });
    expect(t.host.first()).toBe(0);
    t.host.sortField.set('price');
    t.host.sortOrder.set(1);
    await t.stable();
    expect(t.host.loads.length).toBe(4);
    expect(t.host.loads.at(-1)!.sortField).toBe('price');
  });

  it('goes back to the first page after a sort change in client mode', async () => {
    const t = await setup((h) => h.first.set(2));
    t.host.sortField.set('price');
    await t.stable();
    expect(t.host.first()).toBe(0);
    expect(t.host.loads).toEqual([]);
  });

  it('shows the loading state, with the slots', async () => {
    const t = await setup((h) => h.loading.set(true));
    const host = t.el.querySelector('star-data-view')!;
    expect(host.getAttribute('aria-busy')).toBe('true');
    expect(
      t.el.querySelector('.star-data-view__loading [role=status], .star-data-view__loading'),
    ).not.toBeNull();
    expect(t.el.querySelector('.star-data-view__loading')!.textContent).toContain('Loading');
    t.host.slots.set(true);
    await t.stable();
    expect(t.el.querySelector('.own-loading')!.textContent).toBe('Wait');
    expect(t.el.querySelector('.own-grid')!.closest('[aria-hidden=true]')).not.toBeNull();
    expect(t.el.querySelector('.own-start')!.textContent).toBe('0');
  });
});
