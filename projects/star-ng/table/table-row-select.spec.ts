import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCellTemplate, StarColumn, StarRowExpansionTemplate, StarTable } from './table';
import { starSelectionKey } from './table-selection';

interface Item {
  id: number;
  name: string;
  state: string;
}

const ITEMS: Item[] = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `Item ${i + 1}`,
  state: i % 2 ? 'Open' : 'Closed',
}));

@Component({
  imports: [StarTable, StarCellTemplate, StarRowExpansionTemplate],
  template: `
    <star-table
      [value]="rows"
      [columns]="columns()"
      dataKey="id"
      [selectionMode]="mode()"
      [selectionColumn]="column()"
      [selectOnFocus]="onFocus()"
      [cellNavigation]="cells()"
      [(selection)]="selection"
      (rowClick)="clicks.push($event.id)"
    >
      <ng-template starCell="state" [starCellOf]="rows" let-row>
        <button type="button" class="act">Open {{ row.id }}</button>
        <a href="#x" class="link" (click)="$event.preventDefault()">Link</a>
      </ng-template>
      @if (expansion()) {
        <ng-template starRowExpansion [starRowExpansionOf]="rows" let-row>
          <p class="detail">Detail {{ row.id }}</p>
        </ng-template>
      }
    </star-table>
  `,
})
class Host {
  readonly table = viewChild.required<StarTable<Item>>(StarTable);
  readonly rows = ITEMS;
  readonly columns = signal<StarColumn<Item>[]>([
    { field: 'name', header: 'Name' },
    { field: 'state', header: 'State' },
  ]);
  readonly mode = signal<'single' | 'multiple' | null>('single');
  readonly column = signal(false);
  readonly onFocus = signal(false);
  readonly cells = signal<boolean | undefined>(undefined);
  readonly expansion = signal(false);
  readonly selection = signal<readonly Item[]>([]);
  readonly clicks: number[] = [];
}

describe('StarTable selectionColumn', () => {
  async function setup(change?: (host: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const host = fixture.componentInstance;
    const rows = () => [...el.querySelectorAll<HTMLTableRowElement>('tbody tr.star-table__row')];
    const ids = () => host.selection().map((row) => row.id);
    const click = async (index: number, init: MouseEventInit = {}, target?: Element) => {
      (target ?? rows()[index].querySelector('td[data-field="name"], td')!).dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, ...init }),
      );
      await fixture.whenStable();
    };
    const key = async (target: HTMLElement, init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
      target.dispatchEvent(event);
      await fixture.whenStable();
      return event;
    };
    return { fixture, el, host, rows, ids, click, key };
  }

  it('renders no selection column and keeps aria-selected on the rows', async () => {
    const { el, rows, click } = await setup();
    expect(el.querySelector('.star-table__select')).toBeNull();
    expect(el.querySelectorAll('thead th').length).toBe(2);
    expect(rows()[0].querySelectorAll('td').length).toBe(2);
    expect(el.querySelector('star-table')!.classList).toContain('star-table--row-selection');
    expect(rows()[0].getAttribute('aria-selected')).toBe('false');
    expect(rows()[0].classList).toContain('star-table__row--clickable');
    await click(2);
    expect(rows()[2].getAttribute('aria-selected')).toBe('true');
    expect(rows()[2].classList).toContain('star-table__row--selected');
  });

  it('default: the selection column stays and the rows are not tab stops', async () => {
    const { el, rows } = await setup((h) => h.column.set(true));
    expect(el.querySelectorAll('tbody td.star-table__select input[type="radio"]').length).toBe(6);
    expect(rows()[0].hasAttribute('tabindex')).toBe(false);
    expect(el.querySelector('star-table')!.classList).not.toContain('star-table--row-selection');
  });

  it('single: a click selects the row, Ctrl + click clears it', async () => {
    const { click, ids, host } = await setup();
    await click(1);
    expect(ids()).toEqual([2]);
    await click(3);
    expect(ids()).toEqual([4]);
    await click(3, { ctrlKey: true });
    expect(ids()).toEqual([]);
    expect(host.clicks).toEqual([2, 4, 4]);
  });

  it('multiple: click replaces, Ctrl / Cmd toggles, Shift selects a range', async () => {
    const { click, ids } = await setup((h) => h.mode.set('multiple'));
    await click(1);
    expect(ids()).toEqual([2]);
    await click(3, { ctrlKey: true });
    expect(ids()).toEqual([2, 4]);
    await click(4, { metaKey: true });
    expect(ids()).toEqual([2, 4, 5]);
    await click(0, { shiftKey: true });
    expect(ids()).toEqual([1, 2, 3, 4, 5]);
    await click(2);
    expect(ids()).toEqual([3]);
  });

  it('clicks on buttons and links in a cell do not select the row', async () => {
    const { click, ids, rows, host } = await setup();
    await click(1, {}, rows()[1].querySelector('button.act')!);
    await click(1, {}, rows()[1].querySelector('a.link')!);
    expect(ids()).toEqual([]);
    expect(host.clicks).toEqual([]);
  });

  it('the expand button toggles the detail without selecting the row', async () => {
    const { click, ids, rows, el } = await setup((h) => h.expansion.set(true));
    await click(0, {}, rows()[0].querySelector('td.star-table__expander button')!);
    expect(el.querySelector('.detail')?.textContent).toContain('Detail 1');
    expect(ids()).toEqual([]);
  });

  it('keyboard: one tab stop, arrows move the focus, Space and Enter select', async () => {
    const { rows, key, ids } = await setup();
    expect(rows()[0].tabIndex).toBe(0);
    expect(rows()[1].tabIndex).toBe(-1);
    rows()[0].focus();
    await key(rows()[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(rows()[1]);
    expect(ids()).toEqual([]);
    const enter = await key(rows()[1], { key: 'Enter' });
    expect(enter.defaultPrevented).toBe(true);
    expect(ids()).toEqual([2]);
    // Single mode without the column: Space selects again, it does not clear the row.
    await key(rows()[1], { key: ' ' });
    expect(ids()).toEqual([2]);
    await key(rows()[1], { key: 'ArrowDown' });
    await key(rows()[2], { key: ' ' });
    expect(ids()).toEqual([3]);
    expect(rows()[2].tabIndex).toBe(0);
  });

  it('keyboard in multiple mode: Space / Enter toggle, Shift + Arrow extends', async () => {
    const { rows, key, ids } = await setup((h) => h.mode.set('multiple'));
    rows()[1].focus();
    await key(rows()[1], { key: ' ' });
    await key(rows()[1], { key: 'ArrowDown', shiftKey: true });
    expect(ids()).toEqual([2, 3]);
    expect(document.activeElement).toBe(rows()[2]);
    await key(rows()[2], { key: 'Enter' });
    expect(ids()).toEqual([2]);
  });

  it('Enter on a button in a cell does not select the row', async () => {
    const { rows, key, ids } = await setup();
    const button = rows()[1].querySelector<HTMLElement>('button.act')!;
    const event = await key(button, { key: 'Enter' });
    expect(event.defaultPrevented).toBe(false);
    expect(ids()).toEqual([]);
  });

  it('selectOnFocus: Arrow Up / Down move the selection in single mode', async () => {
    const { rows, key, ids } = await setup((h) => h.onFocus.set(true));
    rows()[0].focus();
    await key(rows()[0], { key: 'ArrowDown' });
    expect(ids()).toEqual([2]);
    await key(rows()[1], { key: 'ArrowDown' });
    expect(ids()).toEqual([3]);
    await key(rows()[2], { key: 'ArrowUp' });
    expect(ids()).toEqual([2]);
    expect(document.activeElement).toBe(rows()[1]);
  });

  it('selectOnFocus does not select in multiple mode', async () => {
    const { rows, key, ids } = await setup((h) => {
      h.onFocus.set(true);
      h.mode.set('multiple');
    });
    await key(rows()[0], { key: 'ArrowDown' });
    expect(ids()).toEqual([]);
    expect(document.activeElement).toBe(rows()[1]);
  });

  it('with cell navigation: Space on a cell selects its row, no select lead cell', async () => {
    const { el, rows, key, ids, click } = await setup((h) => h.cells.set(true));
    expect(el.querySelector('td[data-field="$select"]')).toBeNull();
    expect(rows()[0].hasAttribute('tabindex')).toBe(false);
    const cell = rows()[2].querySelector<HTMLElement>('td[data-field="name"]')!;
    cell.focus();
    const event = await key(cell, { key: ' ' });
    expect(event.defaultPrevented).toBe(true);
    expect(ids()).toEqual([3]);
    // Space on a control in a cell keeps its own meaning.
    await key(rows()[4].querySelector<HTMLElement>('button.act')!, { key: ' ' });
    expect(ids()).toEqual([3]);
    await click(4);
    expect(ids()).toEqual([5]);
  });

  it('starSelectionKey: Enter selects only on a row and only when asked', () => {
    const k = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
    expect(starSelectionKey(k({ key: 'Enter' }), true, true)).toBe('toggle');
    expect(starSelectionKey(k({ key: 'Enter', shiftKey: true }), true, true)).toBe('range');
    expect(starSelectionKey(k({ key: 'Enter' }), true)).toBe(null);
    expect(starSelectionKey(k({ key: 'Enter' }), false, true)).toBe(null);
  });
});
