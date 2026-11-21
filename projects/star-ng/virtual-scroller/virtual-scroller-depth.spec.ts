import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarVirtualContentTemplate,
  StarVirtualItemTemplate,
  StarVirtualLoaderTemplate,
  StarVirtualRange,
  StarVirtualScroller,
} from './virtual-scroller';

const ROWS = Array.from({ length: 200 }, (_, r) =>
  Array.from({ length: 100 }, (_, c) => `R${r}C${c}`),
);
const NUMBERS = Array.from({ length: 1000 }, (_, i) => i);

@Component({
  imports: [
    StarVirtualScroller,
    StarVirtualItemTemplate,
    StarVirtualLoaderTemplate,
    StarVirtualContentTemplate,
  ],
  template: `
    <star-virtual-scroller
      id="grid"
      orientation="both"
      [items]="rows"
      [itemSize]="30"
      [columnSize]="80"
      scrollHeight="300px"
      ariaLabel="Cells"
    >
      <ng-template starVirtualItem let-cell let-column="column"
        ><span class="cell">{{ cell }}/{{ column }}</span></ng-template
      >
    </star-virtual-scroller>
    <star-virtual-scroller
      id="loader"
      [items]="numbers"
      [itemSize]="30"
      [loading]="loading()"
      scrollHeight="300px"
      ariaLabel="Numbers"
    >
      <ng-template starVirtualLoader let-i="index"
        ><span class="skeleton">loading {{ i }}</span></ng-template
      >
    </star-virtual-scroller>
    <star-virtual-scroller
      id="content"
      [items]="numbers"
      [itemSize]="30"
      scrollHeight="300px"
      ariaLabel="Numbers in a table"
      lazy
      [delay]="delay()"
      (lazyLoad)="ranges.push($event)"
    >
      <ng-template starVirtualContent let-items let-first="first"
        ><ol class="own-content" [attr.start]="first + 1">
          @for (n of items; track n) {
            <li>{{ n }}</li>
          }
        </ol></ng-template
      >
    </star-virtual-scroller>
  `,
})
class Host {
  readonly rows = ROWS;
  readonly numbers = NUMBERS;
  readonly loading = signal(false);
  readonly delay = signal(0);
  readonly ranges: StarVirtualRange[] = [];
}

describe('StarVirtualScroller depth', () => {
  async function setup(change?: (host: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance };
  }

  it('renders rows and a window of columns with orientation both', async () => {
    const { el } = await setup();
    const grid = el.querySelector('#grid')!;
    expect(grid.classList).toContain('star-scroller--both');
    const rows = [...grid.querySelectorAll<HTMLElement>('[role=listitem]')];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(200);
    const cells = [...rows[0].querySelectorAll('.cell')].map((c) => c.textContent);
    expect(cells[0]).toBe('R0C0/0');
    expect(cells.length).toBeLessThan(100);
    const row = rows[0].querySelector<HTMLElement>('[data-star-part=rowPanel]')!;
    expect(row.style.width).toBe('8000px');
  });

  it('shows the loader slot in place of each item while loading', async () => {
    const { el } = await setup((h) => h.loading.set(true));
    const loader = el.querySelector('#loader')!;
    expect(loader.querySelector('.skeleton')!.textContent).toBe('loading 0');
    expect(loader.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the content slot with the rendered items', async () => {
    const { el } = await setup();
    const list = el.querySelector('#content .own-content')!;
    const items = [...list.querySelectorAll('li')].map((li) => li.textContent);
    expect(items[0]).toBe('0');
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(1000);
  });

  it('waits for delay before lazyLoad', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(Host);
      fixture.componentInstance.delay.set(250);
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(10);
      fixture.detectChanges();
      expect(fixture.componentInstance.ranges).toEqual([]);
      await vi.advanceTimersByTimeAsync(300);
      expect(fixture.componentInstance.ranges.length).toBe(1);
      expect(fixture.componentInstance.ranges[0].first).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
