import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { STAR_UI_TEXT_DEFAULTS, StarClipboard } from '@star-ng/ui/core';
import type { StarMenuItem } from '@star-ng/ui/menu';
import { StarColumn, StarTable } from './table';
import {
  defaultMenuItems,
  StarTableContextMenuEvent,
  StarTableMenuDefault,
  StarTableMenuItems,
} from './table-context-menu';
import { StarColumnPins } from './table-pinning';

interface Line {
  id: string;
  item: string;
  qty: number;
  city: string;
}

const LINES: Line[] = [
  { id: 'L-1', item: 'Cable kit', qty: 3, city: 'Oslo' },
  { id: 'L-2', item: 'Desk lamp', qty: 1, city: 'Lima' },
  { id: 'L-3', item: 'Notebook', qty: 7, city: 'Oslo' },
];

const OPEN: StarMenuItem = { label: 'Open order' };

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows()"
    [columns]="columns"
    dataKey="id"
    ariaLabel="Order lines"
    [cellNavigation]="nav()"
    [groupBy]="grouped() ? 'city' : null"
    [contextMenu]="menu()"
    [contextMenuDefaults]="defaults()"
    [(contextMenuSelection)]="menuRow"
    [(sortField)]="sortField"
    [(sortOrder)]="sortOrder"
    [(pinnedColumns)]="pins"
    [(hiddenColumns)]="hidden"
    (contextMenuSelect)="chosen.push($event)"
  />`,
})
class MenuHost {
  readonly table = viewChild.required<StarTable<Line>>(StarTable);
  readonly rows = signal<readonly Line[]>(LINES);
  readonly nav = signal<boolean | undefined>(true);
  readonly grouped = signal(false);
  readonly menu = signal<StarTableMenuItems<Line> | null>([OPEN]);
  readonly defaults = signal<readonly StarTableMenuDefault[]>([]);
  readonly menuRow = signal<Line | null>(null);
  readonly sortField = signal<string | null>(null);
  readonly sortOrder = signal<1 | -1>(1);
  readonly pins = signal<StarColumnPins>({});
  readonly hidden = signal<readonly string[]>([]);
  readonly chosen: StarTableContextMenuEvent<Line>[] = [];
  readonly columns: StarColumn<Line>[] = [
    { field: 'id', header: 'Line' },
    { field: 'item', header: 'Item', sortable: true },
    { field: 'qty', header: 'Quantity', sortable: true },
    { field: 'city', header: 'City' },
  ];
}

async function setup(change: (host: MenuHost) => void = () => undefined) {
  const copied: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: StarClipboard,
        useValue: { copy: (text: string) => (copied.push(text), Promise.resolve(true)) },
      },
    ],
  });
  const fixture = TestBed.createComponent(MenuHost);
  change(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
  };
  const cell = (id: string, field: string) =>
    el.querySelector<HTMLElement>(`tbody tr[data-row="${id}"] td[data-field="${field}"]`)!;
  const rightClick = async (target: Element) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
    target.dispatchEvent(event);
    await settle();
    return event.defaultPrevented;
  };
  const items = () => [...document.querySelectorAll<HTMLElement>('.star-menu [role="menuitem"]')];
  const labels = () => items().map((item) => item.textContent?.trim());
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
    );
    await settle();
  };
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    settle,
    cell,
    rightClick,
    items,
    labels,
    press,
    copied,
  };
}

describe('defaultMenuItems', () => {
  const column: StarColumn<Line> = { field: 'qty', header: 'Quantity', sortable: true };
  const actions = (side: 'start' | 'end' | null, canHide: boolean) => ({
    text: STAR_UI_TEXT_DEFAULTS,
    column,
    side,
    canHide,
    copy: () => undefined,
    pin: () => undefined,
    sort: () => undefined,
    hide: () => undefined,
    exportCsv: () => undefined,
  });
  const all: StarTableMenuDefault[] = [
    'copy',
    'copyWithHeaders',
    'pinStart',
    'pinEnd',
    'unpin',
    'sortAsc',
    'sortDesc',
    'hideColumn',
    'export',
  ];

  it('builds the items in order, with the column in the labels', () => {
    const items = defaultMenuItems(all, actions(null, true));
    expect(items.map((item) => item.label)).toEqual([
      'Copy',
      'Copy with headers',
      'Pin Quantity to start',
      'Pin Quantity to end',
      'Unpin Quantity',
      'Sort ascending',
      'Sort descending',
      'Hide Quantity',
      'Export CSV',
    ]);
    expect(items.find((item) => item.label === 'Unpin Quantity')?.disabled).toBe(true);
  });

  it('disables what changes nothing and leaves out column items off a cell', () => {
    const pinned = defaultMenuItems(all, actions('start', false));
    expect(pinned.find((item) => item.label === 'Pin Quantity to start')?.disabled).toBe(true);
    expect(pinned.find((item) => item.label === 'Hide Quantity')?.disabled).toBe(true);
    const off = defaultMenuItems(all, { ...actions(null, true), column: null });
    expect(off.map((item) => item.label)).toEqual(['Copy', 'Copy with headers', 'Export CSV']);
    const unsortable = defaultMenuItems(['sortAsc'], {
      ...actions(null, true),
      column: { field: 'id', header: 'Line' },
    });
    expect(unsortable).toEqual([]);
  });
});

describe('StarTable context menu', () => {
  afterEach(() => document.body.replaceChildren());

  it('leaves the browser menu alone without items', async () => {
    const { cell, rightClick } = await setup((host) => host.menu.set(null));
    expect(await rightClick(cell('L-1', 'item'))).toBe(false);
  });

  it('opens on a right click with the cell, and a choice emits the row, the column and the item', async () => {
    const { host, el, cell, rightClick, items, labels, settle } = await setup();
    expect(await rightClick(cell('L-2', 'qty'))).toBe(true);
    expect(labels()).toEqual(['Open order']);
    expect(host.menuRow()).toBe(LINES[1]);
    expect(el.querySelector('tr[data-row="L-2"]')!.classList).toContain('star-table__row--menu');
    items()[0].click();
    await settle();
    expect(host.chosen).toHaveLength(1);
    expect(host.chosen[0].row).toBe(LINES[1]);
    expect(host.chosen[0].column?.field).toBe('qty');
    expect(host.chosen[0].item).toBe(OPEN);
    expect(el.querySelector('.star-table__row--menu')).toBeNull();
  });

  it('builds the items with a function of the row and the column', async () => {
    const { cell, rightClick, labels } = await setup((host) =>
      host.menu.set((row, column) => [{ label: `${row.id} ${column?.header ?? '-'}` }]),
    );
    await rightClick(cell('L-3', 'city'));
    expect(labels()).toEqual(['L-3 City']);
  });

  it('runs the built-in items: sort, pin, hide and copy', async () => {
    const { host, cell, rightClick, items, labels, settle, copied } = await setup((h) =>
      h.defaults.set(['copy', 'copyWithHeaders', 'sortDesc', 'pinEnd', 'hideColumn']),
    );
    await rightClick(cell('L-1', 'qty'));
    expect(labels()).toEqual([
      'Copy',
      'Copy with headers',
      'Sort descending',
      'Pin Quantity to end',
      'Hide Quantity',
      'Open order',
    ]);
    expect(document.querySelector('.star-menu [role="separator"]')).not.toBeNull();
    items()[2].click();
    await settle();
    expect(host.sortField()).toBe('qty');
    expect(host.sortOrder()).toBe(-1);
    expect(host.chosen[0].item.label).toBe('Sort descending');

    await rightClick(cell('L-1', 'qty'));
    items()[3].click();
    await settle();
    expect(host.pins()).toEqual({ qty: 'end' });

    await rightClick(cell('L-1', 'qty'));
    items()[1].click();
    await settle();
    expect(copied).toEqual(['Quantity\r\n3']);

    await rightClick(cell('L-1', 'qty'));
    items()[4].click();
    await settle();
    expect(host.hidden()).toEqual(['qty']);
  });

  it('opens with Shift+F10 and the context menu key, and gives the focus back on close', async () => {
    const { cell, press, items, labels, host } = await setup();
    cell('L-1', 'item').focus();
    await press('F10', { shiftKey: true });
    expect(labels()).toEqual(['Open order']);
    expect(document.activeElement).toBe(items()[0]);
    // CDK menus read `keyCode`.
    await press('Escape', { keyCode: 27 } as KeyboardEventInit);
    expect(items()).toEqual([]);
    expect(document.activeElement).toBe(cell('L-1', 'item'));

    await press('ArrowDown');
    await press('ContextMenu');
    expect(host.menuRow()).toBe(LINES[1]);
    items()[0].click();
    await new Promise((resolve) => setTimeout(resolve));
    expect(host.chosen[0].column?.field).toBe('item');
    expect(document.activeElement).toBe(cell('L-2', 'item'));
  });

  it('opens on a row without cell navigation, but not on a group heading', async () => {
    const { el, rightClick, labels } = await setup((host) => {
      host.nav.set(false);
      host.grouped.set(true);
    });
    const heading = el.querySelector<HTMLElement>('tbody tr.star-table__group th')!;
    expect(await rightClick(heading)).toBe(false);
    const row = el.querySelector<HTMLElement>('tbody tr.star-table__row td')!;
    expect(await rightClick(row)).toBe(true);
    expect(labels()).toEqual(['Open order']);
  });

  it('knows the column and runs the column items without cell navigation', async () => {
    const { host, el, rightClick, items, labels, settle, copied } = await setup((h) => {
      h.nav.set(false);
      h.menu.set((row, column) => [{ label: `${row.id} ${column?.header ?? '-'}` }]);
      h.defaults.set(['copy', 'sortAsc', 'pinStart', 'hideColumn']);
    });
    const qty = () =>
      el.querySelector<HTMLElement>('tbody tr[data-row="L-1"] td[data-field="qty"]')!;
    expect(el.querySelector('table')!.getAttribute('role')).toBeNull();
    await rightClick(qty());
    expect(labels()).toEqual([
      'Copy',
      'Sort ascending',
      'Pin Quantity to start',
      'Hide Quantity',
      'L-1 Quantity',
    ]);
    items()[0].click();
    await settle();
    expect(copied).toEqual(['3']);
    expect(host.chosen[0].column?.field).toBe('qty');
    // The copy of the menu cell does not make it the active cell outside a grid.
    expect(host.table().activeCell()).toBeNull();

    await rightClick(qty());
    items()[1].click();
    await settle();
    expect(host.sortField()).toBe('qty');
    expect(host.sortOrder()).toBe(1);
  });

  it('moves the focus to the nearest cell after Hide column or a delete item', async () => {
    const { host, cell, rightClick, items, settle } = await setup((h) => {
      h.defaults.set(['hideColumn']);
      h.menu.set((row) => [
        {
          label: 'Delete line',
          command: () => h.rows.update((rows) => rows.filter((item) => item !== row)),
        },
      ]);
    });
    const table = host.table();
    const changes: unknown[] = [];
    table.activeCellChange.subscribe((cell) => changes.push(cell));
    cell('L-2', 'qty').focus();
    await rightClick(cell('L-2', 'qty'));
    items()[0].click();
    await settle();
    await settle();
    // Same row, the next visible column.
    expect(host.hidden()).toEqual(['qty']);
    expect(table.activeCell()).toEqual({ rowKey: 'L-2', field: 'city' });
    expect(document.activeElement).toBe(cell('L-2', 'city'));

    await rightClick(cell('L-2', 'city'));
    items()[1].click();
    await settle();
    await settle();
    // Same column, the next row.
    expect(table.activeCell()).toEqual({ rowKey: 'L-3', field: 'city' });
    expect(document.activeElement).toBe(cell('L-3', 'city'));
    expect(changes).toContainEqual({ rowKey: 'L-3', field: 'city' });
  });

  it('does not run the focus return after the table is destroyed', async () => {
    const { fixture, cell, rightClick, items } = await setup();
    await rightClick(cell('L-1', 'item'));
    items()[0].click();
    fixture.destroy();
    await new Promise((resolve) => setTimeout(resolve));
    expect(document.activeElement).toBe(document.body);
  });
});
