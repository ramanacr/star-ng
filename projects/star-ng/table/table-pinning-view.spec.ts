import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import { StarColumnPinEvent, StarColumnPins } from './table-pinning';

interface Sale {
  id: number;
  region: string;
  units: number;
  total: number;
}

const SALES: Sale[] = [
  { id: 1, region: 'North', units: 4, total: 40 },
  { id: 2, region: 'South', units: 6, total: 75 },
];

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="id"
    selectionMode="multiple"
    pinnableColumns
    reorderableColumns
    [(pinnedColumns)]="pins"
    [(columnWidths)]="widths"
    [stateKey]="stateKey()"
    stateStorage="session"
    (columnPin)="events.push($event)"
  />`,
})
class PinHost {
  readonly table = viewChild.required<StarTable<Sale>>(StarTable);
  readonly rows = SALES;
  readonly columns: StarColumn<Sale>[] = [
    { field: 'region', header: 'Region', width: '120px', frozen: true },
    { field: 'units', header: 'Units', width: '90px' },
    { field: 'total', header: 'Total', width: '100px', pinned: 'end' },
    { field: 'id', header: 'Id', width: '60px' },
  ];
  readonly pins = signal<StarColumnPins>({});
  readonly widths = signal<Readonly<Record<string, number>>>({});
  readonly stateKey = signal<string | null>(null);
  readonly events: StarColumnPinEvent[] = [];
}

describe('StarTable column pinning', () => {
  afterEach(() => sessionStorage.clear());

  async function setup() {
    const fixture = TestBed.createComponent(PinHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const headers = () =>
      [...el.querySelectorAll<HTMLElement>('thead th[data-field]')].map(
        (th) => th.dataset['field'],
      );
    const header = (field: string) =>
      el.querySelector<HTMLElement>(`thead th[data-field="${field}"]`)!;
    return { fixture, el, host: fixture.componentInstance, headers, header };
  }

  it('sticks end pins to the inline end with the separator on the first of them', async () => {
    const { el, headers, header } = await setup();
    expect(headers()).toEqual(['region', 'units', 'id', 'total']);
    expect(header('region').classList).toContain('star-table__cell--frozen');
    expect(header('region').classList).toContain('star-table__cell--pin-edge');
    expect(header('region').style.insetInlineStart).toBe('0px');
    expect(header('total').classList).toContain('star-table__cell--pinned-end');
    expect(header('total').classList).toContain('star-table__cell--pin-edge');
    expect(header('total').style.insetInlineEnd).toBe('0px');
    expect(header('units').classList).not.toContain('star-table__cell--frozen');
    // The selection column sticks too while there are start pins.
    expect(el.querySelector('star-table')!.classList).toContain('star-table--pin-lead');
    expect(el.querySelector('star-table')!.classList).toContain('star-table--pin-trail');
    const cells = el.querySelectorAll('tbody tr:first-child td.star-table__cell--pinned-end');
    expect(cells.length).toBe(1);
  });

  it('pins and unpins with the API, emits columnPin and moves the column to its side', async () => {
    const { fixture, host, headers, header, el } = await setup();
    host.table().pinColumn('id', 'end');
    await fixture.whenStable();
    expect(host.pins()).toEqual({ id: 'end' });
    expect(host.events).toEqual([{ field: 'id', side: 'end' }]);
    expect(headers()).toEqual(['region', 'units', 'total', 'id']);
    // `total` is the inner end column now: offset by the declared width of `id`.
    expect(header('total').style.insetInlineEnd).toBe('calc(60px)');
    expect(header('total').classList).toContain('star-table__cell--pin-edge');
    expect(header('id').classList).not.toContain('star-table__cell--pin-edge');

    host.table().pinColumn('region', null);
    host.table().pinColumn('region', null);
    await fixture.whenStable();
    expect(host.events.length).toBe(2);
    expect(headers()).toEqual(['region', 'units', 'total', 'id']);
    expect(header('region').classList).not.toContain('star-table__cell--frozen');
    expect(el.querySelector('star-table')!.classList).not.toContain('star-table--pin-lead');
  });

  it('follows a resized column in the offsets', async () => {
    const { fixture, host, header } = await setup();
    host.pins.set({ units: 'start' });
    host.widths.set({ region: 150 });
    await fixture.whenStable();
    expect(header('units').style.insetInlineStart).toBe('calc(150px)');
  });

  it('keeps the logical sides in a right-to-left page', async () => {
    const { fixture, el, header } = await setup();
    el.setAttribute('dir', 'rtl');
    await fixture.whenStable();
    expect(header('region').style.insetInlineStart).toBe('0px');
    expect(header('total').style.insetInlineEnd).toBe('0px');
    expect(header('total').style.left).toBe('');
    expect(header('total').style.right).toBe('');
  });

  it('moves pinned columns within their side only', async () => {
    const { fixture, host, headers } = await setup();
    host.table().moveColumn('units', 'total');
    host.table().moveColumn('units', 'region');
    await fixture.whenStable();
    expect(headers()).toEqual(['region', 'units', 'id', 'total']);
    host.table().moveColumn('id', 'units');
    await fixture.whenStable();
    expect(headers()).toEqual(['region', 'id', 'units', 'total']);
  });

  it('offers pin buttons in the Columns panel', async () => {
    const { fixture, host, el } = await setup();
    el.querySelector<HTMLElement>('.star-table__tools button')!.click();
    await fixture.whenStable();
    const button = (name: string) =>
      [...document.querySelectorAll<HTMLButtonElement>('.star-table__columns-pin button')].find(
        (item) => item.getAttribute('aria-label') === name,
      )!;
    expect(button('Pin Region to start').getAttribute('aria-pressed')).toBe('true');
    expect(button('Pin Region to end').getAttribute('aria-pressed')).toBe('false');
    expect(button('Unpin Units').getAttribute('aria-disabled')).toBe('true');
    button('Unpin Units').click();
    expect(host.events).toEqual([]);
    button('Pin Units to end').click();
    await fixture.whenStable();
    expect(host.pins()).toEqual({ units: 'end' });
    expect(button('Pin Units to end').getAttribute('aria-pressed')).toBe('true');
    // Units is the first end pin now: it cannot move before the unpinned columns.
    const earlier = document.querySelector<HTMLButtonElement>('[aria-label="Move Units earlier"]')!;
    expect(earlier.disabled).toBe(true);
    const later = document.querySelector<HTMLButtonElement>('[aria-label="Move Units later"]')!;
    expect(later.disabled).toBe(false);
  });

  it('saves and restores the pins with stateKey', async () => {
    const { fixture, host } = await setup();
    host.stateKey.set('pin-state');
    await fixture.whenStable();
    host.table().pinColumn('id', 'start');
    await fixture.whenStable();
    expect(JSON.parse(sessionStorage.getItem('pin-state')!).pinnedColumns).toEqual({
      id: 'start',
    });

    const second = TestBed.createComponent(PinHost);
    second.componentInstance.stateKey.set('pin-state');
    await second.whenStable();
    expect(second.componentInstance.pins()).toEqual({ id: 'start' });
  });
});
