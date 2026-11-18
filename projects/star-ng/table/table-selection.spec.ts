import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import {
  StarHeaderCheckboxToggleEvent,
  StarRowSelectEvent,
  starSelectionKey,
  starSelectionRange,
  StarTableSelectionChangingEvent,
} from './table-selection';

interface Order {
  id: number;
  order: string;
  status: string;
}

const ORDERS: Order[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  order: `Order ${1040 + i}`,
  status: i % 3 === 0 ? 'Closed' : 'Open',
}));

@Component({
  imports: [StarTable],
  template: `
    <star-table
      [value]="rows()"
      [columns]="columns"
      dataKey="id"
      [selectionMode]="mode()"
      [(selection)]="selection"
      [(selectionKeys)]="keys"
      [(selectAll)]="all"
      [metaKeySelection]="meta()"
      [selectionPageOnly]="pageOnly()"
      [rowSelectable]="selectable()"
      [globalFilter]="query()"
      [paginator]="paginator()"
      [rows]="5"
      (selectionChanging)="onChanging($event)"
      (rowSelect)="selected.push($event)"
      (rowUnselect)="unselected.push($event)"
      (headerCheckboxToggle)="toggles.push($event)"
    />
  `,
})
class Host {
  readonly table = viewChild.required<StarTable<Order>>(StarTable);
  readonly rows = signal<readonly Order[]>(ORDERS);
  readonly columns: StarColumn<Order>[] = [
    { field: 'order', header: 'Order' },
    { field: 'status', header: 'Status' },
  ];
  readonly mode = signal<'single' | 'multiple' | null>('multiple');
  readonly selection = signal<readonly Order[]>([]);
  readonly keys = signal<readonly unknown[] | null>(null);
  readonly all = signal<boolean | null>(null);
  readonly meta = signal(false);
  readonly pageOnly = signal(false);
  readonly selectable = signal<((row: Order) => boolean) | null>(null);
  readonly query = signal('');
  readonly paginator = signal(false);
  readonly cancel = signal(false);
  readonly changing: StarTableSelectionChangingEvent<Order>[] = [];
  readonly selected: StarRowSelectEvent<Order>[] = [];
  readonly unselected: StarRowSelectEvent<Order>[] = [];
  readonly toggles: StarHeaderCheckboxToggleEvent[] = [];

  onChanging(event: StarTableSelectionChangingEvent<Order>): void {
    this.changing.push(event);
    if (this.cancel()) event.cancel();
  }
}

describe('StarTable selection', () => {
  async function setup(change?: (host: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = fixture.componentInstance;
    const rows = () => [...el.querySelectorAll<HTMLTableRowElement>('tbody tr.star-table__row')];
    const boxes = () => [
      ...el.querySelectorAll<HTMLInputElement>('tbody td.star-table__select input'),
    ];
    const header = () => el.querySelector<HTMLInputElement>('thead th.star-table__select input')!;
    const ids = () => host.selection().map((row) => row.id);
    const click = async (index: number, init: MouseEventInit = {}) => {
      rows()
        [index].querySelectorAll('td')[1]
        .dispatchEvent(new MouseEvent('click', { bubbles: true, ...init }));
      await fixture.whenStable();
    };
    const key = async (target: HTMLElement, init: KeyboardEventInit) => {
      target.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
      );
      await fixture.whenStable();
    };
    return { fixture, el, host, rows, boxes, header, ids, click, key };
  }

  it('names each check box with the row and the header check box with the scope', async () => {
    const { boxes, header, host, fixture } = await setup();
    expect(boxes()[0].getAttribute('aria-label')).toBe('Select row Order 1040');
    expect(header().getAttribute('aria-label')).toBe('Select all rows');
    host.pageOnly.set(true);
    await fixture.whenStable();
    // Without a paginator the page is all rows.
    expect(header().getAttribute('aria-label')).toBe('Select all rows');
    host.paginator.set(true);
    await fixture.whenStable();
    expect(header().getAttribute('aria-label')).toBe('Select all rows on this page');
  });

  it('selectionPageOnly false: the header check box selects the whole filter result, mixed when some are selected', async () => {
    const { host, fixture, boxes, header, ids } = await setup((h) => h.paginator.set(true));
    boxes()[0].click();
    await fixture.whenStable();
    expect(header().indeterminate).toBe(true);
    expect(header().closest('star-checkbox')).toBeTruthy();
    header().click();
    await fixture.whenStable();
    expect(ids()).toEqual(ORDERS.map((o) => o.id));
    expect(header().checked).toBe(true);
    expect(host.toggles.map((t) => t.checked)).toEqual([true]);
    // With a filter, only the filter result.
    header().click();
    await fixture.whenStable();
    host.query.set('closed');
    await fixture.whenStable();
    header().click();
    await fixture.whenStable();
    expect(ids()).toEqual([1, 4, 7, 10]);
  });

  it('selectionPageOnly limits the header check box to the page', async () => {
    const { fixture, header, ids } = await setup((h) => {
      h.paginator.set(true);
      h.pageOnly.set(true);
    });
    header().click();
    await fixture.whenStable();
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
  });

  it('rowSelectable disables the box and is skipped by select-all and ranges', async () => {
    const { fixture, boxes, header, ids, click, host } = await setup((h) => {
      h.selectable.set((row) => row.status === 'Open');
      h.meta.set(true);
    });
    expect(boxes()[0].disabled).toBe(true);
    expect(boxes()[1].disabled).toBe(false);
    header().click();
    await fixture.whenStable();
    expect(ids()).toEqual([2, 3, 5, 6, 8, 9, 11, 12]);
    expect(header().checked).toBe(true);
    header().click();
    await fixture.whenStable();
    expect(ids()).toEqual([]);
    await click(0);
    expect(ids()).toEqual([]);
    await click(1);
    await click(4, { shiftKey: true });
    expect(ids()).toEqual([2, 3, 5]);
    expect(host.selected.map((e) => e.row.id)).toEqual([2, 3, 5]);
  });

  it('metaKeySelection: click replaces, Ctrl / Cmd toggles, Shift selects a range', async () => {
    const { ids, click, host } = await setup((h) => h.meta.set(true));
    await click(1);
    expect(ids()).toEqual([2]);
    await click(3);
    expect(ids()).toEqual([4]);
    await click(1, { ctrlKey: true });
    expect(ids()).toEqual([4, 2]);
    await click(4, { metaKey: true });
    expect(ids()).toEqual([4, 2, 5]);
    await click(4, { ctrlKey: true });
    expect(ids()).toEqual([4, 2]);
    expect(host.unselected.map((e) => e.row.id)).toEqual([2, 5]);
    // The anchor is the last row clicked (row 5): Shift + click selects rows 3 to 5.
    await click(2, { shiftKey: true });
    expect(ids()).toEqual([3, 4, 5]);
    expect(host.selected.at(-1)?.originalEvent).toBeInstanceOf(MouseEvent);
  });

  it('without metaKeySelection a row click keeps today’s behaviour', async () => {
    const { ids, click, host, fixture } = await setup();
    await click(1);
    expect(ids()).toEqual([]);
    host.mode.set('single');
    await fixture.whenStable();
    await click(1);
    expect(ids()).toEqual([2]);
    await click(1, { ctrlKey: true });
    expect(ids()).toEqual([2]);
  });

  it('metaKeySelection in single mode: Ctrl + click clears the row', async () => {
    const { ids, click } = await setup((h) => {
      h.mode.set('single');
      h.meta.set(true);
    });
    await click(1);
    expect(ids()).toEqual([2]);
    await click(1, { ctrlKey: true });
    expect(ids()).toEqual([]);
  });

  it('keyboard: Space toggles the focused row, Shift + Space and Shift + Arrow extend', async () => {
    const { rows, ids, key, boxes, el } = await setup((h) => h.meta.set(true));
    expect(rows()[0].tabIndex).toBe(0);
    expect(rows()[1].tabIndex).toBe(-1);
    rows()[1].focus();
    await key(rows()[1], { key: ' ' });
    expect(ids()).toEqual([2]);
    await key(rows()[1], { key: 'ArrowDown', shiftKey: true });
    expect(ids()).toEqual([2, 3]);
    expect(document.activeElement).toBe(rows()[2]);
    await key(rows()[2], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows()[3]);
    await key(rows()[4], { key: ' ', shiftKey: true });
    expect(ids()).toEqual([2, 3, 4, 5]);
    await key(rows()[4], { key: ' ' });
    expect(ids()).toEqual([2, 3, 4]);
    // On a row check box, Shift + Arrow moves to the next check box and extends the range.
    boxes()[6].focus();
    await key(boxes()[6], { key: 'ArrowDown', shiftKey: true });
    expect(document.activeElement).toBe(boxes()[7]);
    expect(ids()).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(el.querySelector('tbody tr[tabindex="0"]')).toBe(rows()[7]);
  });

  it('Shift + Space on a check box selects the range without metaKeySelection', async () => {
    const { boxes, ids, key, fixture } = await setup();
    boxes()[1].click();
    await fixture.whenStable();
    const event = new KeyboardEvent('keydown', {
      key: ' ',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    boxes()[3].dispatchEvent(event);
    await fixture.whenStable();
    expect(event.defaultPrevented).toBe(true);
    expect(ids()).toEqual([2, 3, 4]);
    // Rows are not tab stops without metaKeySelection.
    await key(boxes()[3], { key: 'Tab' });
    expect(boxes()[3].closest('tr')!.hasAttribute('tabindex')).toBe(false);
  });

  it('selectionChanging fires before the change and can cancel it', async () => {
    const { host, fixture, boxes, ids, header } = await setup();
    boxes()[0].click();
    await fixture.whenStable();
    expect(host.changing[0].previous).toEqual([]);
    expect(host.changing[0].next.map((r) => r.id)).toEqual([1]);
    host.cancel.set(true);
    boxes()[1].click();
    await fixture.whenStable();
    expect(ids()).toEqual([1]);
    expect(boxes()[1].checked).toBe(false);
    header().click();
    await fixture.whenStable();
    expect(ids()).toEqual([1]);
    expect(header().indeterminate).toBe(true);
    expect(header().checked).toBe(false);
    expect(host.toggles).toEqual([]);
    // Putting the box back does not count as a second toggle.
    expect(host.changing).toHaveLength(3);
  });

  it('a cancelled radio change keeps the old radio checked', async () => {
    const { host, fixture, el, ids } = await setup((h) => h.mode.set('single'));
    const radios = () => [...el.querySelectorAll<HTMLInputElement>('tbody input[type=radio]')];
    expect(radios()[0].getAttribute('aria-label')).toBe('Select row Order 1040');
    radios()[0].click();
    await fixture.whenStable();
    host.cancel.set(true);
    radios()[2].click();
    await fixture.whenStable();
    expect(ids()).toEqual([1]);
    expect(radios()[0].checked).toBe(true);
    expect(radios()[2].checked).toBe(false);
  });

  it('selectionKeys keeps the selection when the rows are new objects', async () => {
    const { host, fixture, boxes, rows } = await setup((h) => h.keys.set([]));
    boxes()[1].click();
    await fixture.whenStable();
    expect(host.keys()).toEqual([2]);
    host.rows.set(ORDERS.map((o) => ({ ...o, status: o.status + '!' })));
    await fixture.whenStable();
    expect(rows()[1].getAttribute('aria-selected')).toBe('true');
    boxes()[2].click();
    await fixture.whenStable();
    expect(host.keys()).toEqual([2, 3]);
    // Both rows are the fresh objects of the new value.
    expect(host.selection().map((r) => r.status)).toEqual(['Open!', 'Open!']);
    // Keys set by the owner show as selected.
    host.keys.set([5]);
    await fixture.whenStable();
    expect(rows()[4].getAttribute('aria-selected')).toBe('true');
    expect(rows()[1].getAttribute('aria-selected')).toBe('false');
  });

  it('key mode keeps keys that have no row object (other pages, lazy data)', async () => {
    const { host, fixture, boxes, header } = await setup((h) => {
      h.keys.set([101, 205]);
      h.pageOnly.set(true);
    });
    boxes()[2].click();
    await fixture.whenStable();
    expect(host.keys()).toEqual([101, 205, 3]);
    expect(host.selection().map((r) => r.id)).toEqual([3]);
    // The header check box selects and clears only the rows it covers.
    header().click();
    await fixture.whenStable();
    expect(new Set(host.keys())).toEqual(new Set([101, 205, ...ORDERS.map((o) => o.id)]));
    header().click();
    await fixture.whenStable();
    expect(host.keys()).toEqual([101, 205]);
    expect(host.selection()).toEqual([]);
  });

  it('key mode keeps selection in step with the keys and value, and exports those rows', async () => {
    const { host, fixture } = await setup((h) => h.keys.set([]));
    host.keys.set([2, 4]);
    await fixture.whenStable();
    expect(host.selection().map((r) => r.order)).toEqual(['Order 1041', 'Order 1043']);
    host.rows.set(ORDERS.map((o) => ({ ...o, order: o.order + ' (new)' })));
    await fixture.whenStable();
    expect(host.selection().map((r) => r.order)).toEqual(['Order 1041 (new)', 'Order 1043 (new)']);
    const csv = host.table().toCsv({ selectionOnly: true });
    expect(csv).toContain('Order 1041 (new)');
    expect(csv).toContain('Order 1043 (new)');
    expect(csv).not.toContain('Order 1040');
  });

  it('passes the DOM event as originalEvent and emits rowUnselect before rowSelect', async () => {
    const { host, fixture, boxes, el, header } = await setup();
    boxes()[0].click();
    await fixture.whenStable();
    expect(host.selected[0].originalEvent).toBeInstanceOf(Event);
    header().click();
    await fixture.whenStable();
    expect(host.toggles[0].originalEvent).toBeInstanceOf(Event);
    host.mode.set('single');
    host.selection.set([]);
    await fixture.whenStable();
    const radios = () => [...el.querySelectorAll<HTMLInputElement>('tbody input[type=radio]')];
    radios()[0].click();
    await fixture.whenStable();
    const order: string[] = [];
    host.table().rowSelect.subscribe((e) => order.push('select ' + e.row.id));
    host.table().rowUnselect.subscribe((e) => order.push('unselect ' + e.row.id));
    radios()[1].click();
    await fixture.whenStable();
    expect(order).toEqual(['unselect 1', 'select 2']);
    expect(host.selected.at(-1)?.originalEvent?.type).toBe('change');
  });

  it('Space on a selected row in single mode clears it, with the key event', async () => {
    const { host, rows, key, ids } = await setup((h) => {
      h.mode.set('single');
      h.meta.set(true);
    });
    await key(rows()[1], { key: ' ' });
    expect(ids()).toEqual([2]);
    expect(host.selected[0].originalEvent).toBeInstanceOf(KeyboardEvent);
    await key(rows()[1], { key: ' ' });
    expect(ids()).toEqual([]);
  });

  it('selectAll lets the owner decide what "all" means (lazy data)', async () => {
    const { host, fixture, header, ids } = await setup((h) => h.all.set(false));
    expect(header().checked).toBe(false);
    header().click();
    await fixture.whenStable();
    expect(host.all()).toBe(true);
    expect(ids()).toEqual([]);
    expect(host.toggles.map((t) => t.checked)).toEqual([true]);
    expect(header().checked).toBe(true);
  });

  it('starSelectionRange and starSelectionKey', () => {
    const keyOf = (n: number) => n;
    expect(starSelectionRange([1, 2, 3, 4], keyOf, 3, 1)).toEqual([1, 2, 3]);
    expect(starSelectionRange([1, 2, 3, 4], keyOf, 9, 2)).toEqual([2]);
    expect(starSelectionRange([1, 2], keyOf, 1, 9)).toEqual([]);
    const k = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
    expect(starSelectionKey(k({ key: ' ' }), true)).toBe('toggle');
    expect(starSelectionKey(k({ key: ' ' }), false)).toBe(null);
    expect(starSelectionKey(k({ key: ' ', shiftKey: true }), false)).toBe('range');
    expect(starSelectionKey(k({ key: 'ArrowUp', shiftKey: true }), false)).toBe('extend-up');
    expect(starSelectionKey(k({ key: 'ArrowDown', shiftKey: true }), true)).toBe('extend-down');
    expect(starSelectionKey(k({ key: 'ArrowDown' }), true)).toBe(null);
    expect(starSelectionKey(k({ key: ' ', ctrlKey: true }), true)).toBe(null);
  });
});
