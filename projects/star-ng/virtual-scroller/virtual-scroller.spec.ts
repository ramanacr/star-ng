import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarEmptyTemplate, StarLoadingTemplate } from '@star-ng/ui/core';
import { StarVirtualItemTemplate, StarVirtualRange, StarVirtualScroller } from './virtual-scroller';

interface Order {
  readonly id: number;
  readonly number: string;
}

const ORDERS: Order[] = Array.from({ length: 10_000 }, (_, i) => ({
  id: i + 1,
  number: `ORD-${String(i + 1).padStart(5, '0')}`,
}));

@Component({
  imports: [StarVirtualScroller, StarVirtualItemTemplate, StarEmptyTemplate, StarLoadingTemplate],
  template: `
    <star-virtual-scroller
      id="orders"
      [items]="items()"
      [itemSize]="40"
      [orientation]="orientation()"
      scrollHeight="12rem"
      [lazy]="lazy()"
      [loading]="loading()"
      ariaLabel="Orders"
      (lazyLoad)="ranges.push($event)"
    >
      <ng-template
        starVirtualItem
        [starVirtualItemOf]="items()"
        let-order
        let-i="index"
        let-odd="odd"
        let-count="count"
      >
        <span class="row" [class.odd]="odd">{{ order.number }} ({{ i }}/{{ count }})</span>
      </ng-template>
      <ng-template starEmpty>Nothing to show</ng-template>
      <ng-template starLoading><span class="loader">Fetching</span></ng-template>
    </star-virtual-scroller>
    <star-virtual-scroller id="plain" [items]="cities" />
  `,
})
class Host {
  readonly items = signal<readonly Order[]>(ORDERS);
  readonly orientation = signal<'vertical' | 'horizontal'>('vertical');
  readonly lazy = signal(false);
  readonly loading = signal(false);
  readonly cities = ['Lisbon', 'Porto', 'Faro'];
  readonly ranges: StarVirtualRange[] = [];
  readonly scroller = viewChild.required<StarVirtualScroller<Order>>(StarVirtualScroller);
}

describe('StarVirtualScroller', () => {
  // jsdom has no Element.scrollTo and no layout: scrolling only sets the scroll offset.
  const original = Element.prototype.scrollTo;
  beforeAll(() => {
    Element.prototype.scrollTo = function (this: Element, options?: ScrollToOptions | number) {
      if (typeof options === 'object') {
        if (options.top !== undefined) this.scrollTop = options.top;
        if (options.left !== undefined) this.scrollLeft = options.left;
      }
    } as typeof Element.prototype.scrollTo;
  });
  afterAll(() => {
    Element.prototype.scrollTo = original;
  });

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const box = (id: string) => el.querySelector<HTMLElement>(`#${id}`)!;
    const rows = (id = 'orders') => [...box(id).querySelectorAll<HTMLElement>('[role="listitem"]')];
    return { fixture, host: fixture.componentInstance, box, rows };
  }

  it('renders a window of the items in a focusable, labelled list', async () => {
    const { box, rows } = await setup();
    const viewport = box('orders').querySelector('cdk-virtual-scroll-viewport')!;
    expect(viewport.getAttribute('role')).toBe('list');
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(viewport.getAttribute('aria-label')).toBe('Orders');
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().length).toBeLessThan(60);
    expect(
      box('orders').querySelector('.cdk-virtual-scroll-content-wrapper')!.getAttribute('role'),
    ).toBe('presentation');
  });

  it('gives each rendered item the total and its position', async () => {
    const { rows } = await setup();
    expect(rows()[0].getAttribute('aria-setsize')).toBe('10000');
    expect(rows()[0].getAttribute('aria-posinset')).toBe('1');
    expect(rows()[1].getAttribute('aria-posinset')).toBe('2');
  });

  it('passes the item, index, count and parity to the item slot', async () => {
    const { rows } = await setup();
    expect(rows()[0].textContent?.trim()).toBe('ORD-00001 (0/10000)');
    expect(rows()[0].querySelector('.odd')).toBeNull();
    expect(rows()[1].querySelector('.odd')).not.toBeNull();
  });

  it('shows the item as text without an item slot', async () => {
    const { rows } = await setup();
    expect(rows('plain').map((row) => row.textContent?.trim())).toEqual([
      'Lisbon',
      'Porto',
      'Faro',
    ]);
  });

  it('sets the viewport size and the item size variable', async () => {
    const { box } = await setup();
    const viewport = box('orders').querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
    expect(viewport.style.height).toBe('12rem');
    expect(viewport.style.width).toBe('100%');
    expect(viewport.style.getPropertyValue('--star-scroller-item-size')).toBe('40px');
  });

  it('switches to a horizontal viewport', async () => {
    const { fixture, host, box } = await setup();
    host.orientation.set('horizontal');
    await fixture.whenStable();
    expect(box('orders').classList).toContain('star-scroller--horizontal');
    expect(
      box('orders')
        .querySelector('cdk-virtual-scroll-viewport')!
        .classList.contains('cdk-virtual-scroll-orientation-horizontal'),
    ).toBe(true);
  });

  it('scrollToIndex and scrollTo move the viewport and update visibleRange', async () => {
    const { fixture, host, box } = await setup();
    const viewport = box('orders').querySelector<HTMLElement>('cdk-virtual-scroll-viewport')!;
    host.scroller().scrollToIndex(500);
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(20_000);
    expect(host.scroller().visibleRange().first).toBe(500);

    host.scroller().scrollTo(400);
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    expect(viewport.scrollTop).toBe(400);
    expect(host.scroller().visibleRange().first).toBe(10);
  });

  it('emits lazyLoad with the rendered range only in lazy mode', async () => {
    const { fixture, host } = await setup();
    expect(host.ranges).toEqual([]);
    host.lazy.set(true);
    // A new array makes the viewport render again, which emits the range.
    host.items.set([...ORDERS]);
    await fixture.whenStable();
    host.scroller().scrollToIndex(2_000);
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fixture.whenStable();
    expect(host.ranges.length).toBeGreaterThan(0);
    const range = host.ranges.at(-1)!;
    expect(range.first).toBeLessThanOrEqual(range.last);
    // The same range is not emitted twice in a row.
    const pairs = host.ranges.map((r) => `${r.first}-${r.last}`);
    expect(pairs.every((pair, i) => i === 0 || pair !== pairs[i - 1])).toBe(true);
  });

  it('shows the loading slot over the items and sets aria-busy', async () => {
    const { fixture, host, box } = await setup();
    expect(box('orders').hasAttribute('aria-busy')).toBe(false);
    host.loading.set(true);
    await fixture.whenStable();
    expect(box('orders').getAttribute('aria-busy')).toBe('true');
    expect(box('orders').querySelector('.star-scroller__loading .loader')?.textContent).toBe(
      'Fetching',
    );
  });

  it('shows the loading slot instead of the empty slot while an empty list loads', async () => {
    const { fixture, host, box } = await setup();
    host.items.set([]);
    host.loading.set(true);
    await fixture.whenStable();
    expect(box('orders').querySelector('cdk-virtual-scroll-viewport')).toBeNull();
    expect(box('orders').querySelector('.loader')).not.toBeNull();
    host.loading.set(false);
    await fixture.whenStable();
    expect(box('orders').querySelector('.star-scroller__empty')?.textContent?.trim()).toBe(
      'Nothing to show',
    );
  });

  it('shows the built-in empty text and spinner without slots', async () => {
    const fixture = TestBed.createComponent(StarVirtualScroller);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent?.trim()).toBe('No records found');
    fixture.componentRef.setInput('loading', true);
    await fixture.whenStable();
    expect(el.querySelector('star-spinner')?.getAttribute('aria-label')).toBe('Loading');
  });
});
