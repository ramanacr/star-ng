import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarRowExpansionTemplate, StarTable } from './table';

interface Shipment {
  id: number;
  city: string;
}

/** 1,000 shipments in 10 cities of 100 rows each. */
const SHIPMENTS: Shipment[] = Array.from({ length: 1000 }, (_, i) => ({
  id: i + 1,
  city: `City ${Math.floor(i / 100) + 1}`,
}));

@Component({
  imports: [StarTable, StarRowExpansionTemplate],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="id"
    virtualScroll
    [virtualRowHeight]="40"
    [virtualRowHeights]="heights()"
    scrollHeight="400px"
    [groupBy]="grouped() ? 'city' : null"
    [(collapsedGroups)]="closed"
    [(expandedKeys)]="open"
    selectionMode="single"
  >
    @if (detail()) {
      <ng-template starRowExpansion [starRowExpansionOf]="rows" let-row
        >Detail of {{ row.id }}</ng-template
      >
    }
  </star-table>`,
})
class VariableHost {
  readonly rows = SHIPMENTS;
  readonly columns: StarColumn<Shipment>[] = [{ field: 'id', header: 'Shipment' }];
  readonly heights = signal<'auto' | 'variable'>('auto');
  readonly grouped = signal(false);
  readonly detail = signal(false);
  readonly closed = signal<readonly string[]>([]);
  readonly open = signal<readonly unknown[]>([]);
}

async function setup(change: (host: VariableHost) => void = () => undefined) {
  const fixture = TestBed.createComponent(VariableHost);
  change(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    table: el.querySelector('star-table') as HTMLElement,
    rows: () => [...el.querySelectorAll<HTMLElement>('tbody tr.star-table__row')],
    spacers: () =>
      [...el.querySelectorAll<HTMLElement>('.star-table__spacer td')].map((td) => td.style.height),
  };
}

describe('StarTable virtual scroll with rows of different heights', () => {
  it('keeps one fixed height unless a feature or the input asks for rows of different heights', async () => {
    const { fixture, host, table } = await setup();
    expect(table.classList).toContain('star-table--virtual');
    expect(table.classList).not.toContain('star-table--variable');

    host.heights.set('variable');
    await fixture.whenStable();
    expect(table.classList).toContain('star-table--variable');

    host.heights.set('auto');
    host.grouped.set(true);
    await fixture.whenStable();
    expect(table.classList).toContain('star-table--variable');

    host.grouped.set(false);
    host.detail.set(true);
    await fixture.whenStable();
    expect(table.classList).toContain('star-table--variable');
  });

  it('renders group headings as items of the window and numbers every body row', async () => {
    const { el, rows, spacers } = await setup((host) => host.grouped.set(true));
    const lines = [...el.querySelectorAll<HTMLElement>('tbody tr')].filter(
      (row) => !row.classList.contains('star-table__spacer'),
    );
    // 480 px fallback view / 40 px estimate = 12 items in view, plus 5 after: 17 items.
    expect(lines.length).toBe(17);
    expect(lines[0].classList).toContain('star-table__group');
    expect(lines[0].getAttribute('aria-rowindex')).toBe('2');
    expect(rows()[0].getAttribute('aria-rowindex')).toBe('3');
    // 1,000 rows, 10 headings and the header row.
    expect(el.querySelector('table')?.getAttribute('aria-rowcount')).toBe('1011');
    expect(spacers()).toEqual([`${(1010 - 17) * 40}px`]);
  });

  it('leaves the rows of a closed group out of the list and the scroll height', async () => {
    const { el, fixture, host, rows, spacers } = await setup((host) => host.grouped.set(true));
    host.closed.set(['City 1']);
    await fixture.whenStable();
    const headings = [...el.querySelectorAll('tbody tr.star-table__group')];
    expect(headings[0].textContent).toContain('City 1');
    expect(headings[0].querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
    // The next heading follows right away, with the next position number.
    expect(headings[1].textContent).toContain('City 2');
    expect(headings[1].getAttribute('aria-rowindex')).toBe('3');
    expect(rows()[0].textContent).toContain('101');
    expect(el.querySelectorAll('tbody tr[hidden]').length).toBe(0);
    expect(el.querySelector('table')?.getAttribute('aria-rowcount')).toBe(String(1011 - 100));
    expect(spacers()).toEqual([`${(910 - 17) * 40}px`]);
  });

  it('renders the detail row with its row, numbers it and points the button at it', async () => {
    const { el, fixture, host, rows } = await setup((host) => host.detail.set(true));
    host.open.set([2]);
    await fixture.whenStable();
    const detail = el.querySelector<HTMLElement>('tr.star-table__expansion')!;
    expect(detail.textContent).toContain('Detail of 2');
    expect(rows()[1].getAttribute('aria-rowindex')).toBe('3');
    expect(detail.getAttribute('aria-rowindex')).toBe('4');
    expect(rows()[2].getAttribute('aria-rowindex')).toBe('5');
    const button = rows()[1].querySelector('button[aria-expanded="true"]')!;
    expect(button.getAttribute('aria-controls')).toBe(detail.id);
    expect(el.querySelector('table')?.getAttribute('aria-rowcount')).toBe('1002');
  });

  it('keeps the focused row rendered outside the window, between two spacers', async () => {
    const { el, fixture, rows, spacers } = await setup();
    const radio = rows()[2].querySelector<HTMLInputElement>('input[type="radio"]')!;
    radio.focus();
    radio.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    const viewport = el.querySelector<HTMLElement>('.star-table__scroll')!;
    Object.defineProperty(viewport, 'clientHeight', { value: 400 });
    viewport.scrollTop = 4000;
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    // Row 3, then the window of rows 96 to 115 (see the fixed height test).
    expect(rows()[0].getAttribute('aria-rowindex')).toBe('4');
    expect(rows()[1].getAttribute('aria-rowindex')).toBe('97');
    expect(rows().length).toBe(21);
    expect(spacers()).toEqual([`${2 * 40}px`, `${92 * 40}px`, `${(1000 - 115) * 40}px`]);
    expect(document.activeElement).toBe(radio);
  });
});

@Component({
  imports: [StarTable],
  template: `<star-table [value]="rows" [columns]="columns" virtualScroll />`,
})
class NoHeightHost {
  readonly rows = SHIPMENTS.slice(0, 10);
  readonly columns: StarColumn<Shipment>[] = [{ field: 'id', header: 'Shipment' }];
}

describe('StarTable virtual scroll guard', () => {
  it('warns in development mode when virtualScroll has no scrollHeight', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(NoHeightHost);
    await fixture.whenStable();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('virtualScroll needs scrollHeight'));
    warn.mockRestore();
  });
});
