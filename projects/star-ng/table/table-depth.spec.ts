import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { StarQueryGroup } from '@star-ng/ui/query-builder';
import { StarColumn, StarTable } from './table';
import type { StarRowPinEvent, StarRowPins } from './table-row-pins';
import {
  StarFooterRowTemplate,
  StarGroupFooterTemplate,
  StarPaginatorEndTemplate,
  StarPaginatorStartTemplate,
  StarRowTemplate,
  StarTableCell,
} from './table-slots';

interface Order {
  id: string;
  customer: string;
  status: string;
  total: number;
}

const ORDERS: Order[] = [
  { id: 'ORD-1', customer: 'Ava Stone', status: 'Open', total: 40 },
  { id: 'ORD-2', customer: 'Ben Carter', status: 'Paid', total: 12 },
  { id: 'ORD-3', customer: 'Chloe Park', status: 'Open', total: 7 },
  { id: 'ORD-4', customer: 'Dan Moss', status: 'Shipped', total: 25 },
];

const COLUMNS: StarColumn<Order>[] = [
  { field: 'id', header: 'Order' },
  { field: 'customer', header: 'Customer', filter: 'text' },
  { field: 'status', header: 'Status', filter: 'multiselect', excelFilter: true },
  { field: 'total', header: 'Total' },
];

@Component({
  imports: [
    StarTable,
    StarRowTemplate,
    StarTableCell,
    StarFooterRowTemplate,
    StarGroupFooterTemplate,
    StarPaginatorStartTemplate,
    StarPaginatorEndTemplate,
  ],
  template: `
    <star-table
      class="slots"
      [value]="rows"
      [columns]="columns"
      dataKey="id"
      ariaLabel="Slots"
      [cellNavigation]="nav()"
      [groupBy]="group()"
      paginator
      [rows]="10"
    >
      <ng-template starRow [starRowOf]="rows" let-row let-index="index" let-columns="columns">
        @for (column of columns; track column.field) {
          <td [starTableCell]="column.field" [starTableCellRow]="row" class="own-cell">
            {{ index }}:{{ $any(row)[column.field] }}
          </td>
        }
      </ng-template>
      <ng-template starFooterRow let-columns let-rows="rows">
        <td class="own-foot" [attr.colspan]="columns.length">{{ rows.length }} orders</td>
      </ng-template>
      <ng-template starGroupFooter let-label let-rows="rows" let-columns="columns">
        <td class="own-group-foot" [attr.colspan]="columns.length">
          {{ label }}: {{ rows.length }}
        </td>
      </ng-template>
      <ng-template starPaginatorStart let-state
        ><span class="own-start">Page {{ state.page + 1 }}</span></ng-template
      >
      <ng-template starPaginatorEnd><span class="own-end">End</span></ng-template>
    </star-table>
  `,
})
class SlotHost {
  readonly table = viewChild.required<StarTable<Order>>(StarTable);
  readonly rows = ORDERS;
  readonly columns = COLUMNS.slice(0, 2);
  readonly nav = signal<boolean | undefined>(undefined);
  readonly group = signal<keyof Order | null>(null);
}

@Component({
  imports: [StarTable],
  template: `
    <star-table
      [value]="rows"
      [columns]="columns"
      dataKey="id"
      ariaLabel="Orders"
      filterDisplay="menu"
      [filterDelay]="delay()"
      [globalFilter]="query()"
      [(pinnedRows)]="pins"
      (rowPin)="pinEvents.push($event)"
      [selectionMode]="mode()"
      [(columnSelection)]="columnSelection"
      [advancedFilter]="advanced()"
      [(advancedQuery)]="query2"
      [contextMenuDefaults]="['pinRowTop', 'pinRowBottom', 'unpinRow']"
      [virtualScroll]="virtual()"
      [scrollHeight]="virtual() ? '150px' : null"
      [virtualRowHeight]="40"
      [groupBy]="groupBy()"
      [collapsedGroups]="collapsed()"
      [lazy]="lazy()"
      [totalRecords]="lazy() ? 8 : 0"
    />
  `,
})
class FeatureHost {
  readonly table = viewChild.required<StarTable<Order>>(StarTable);
  rows = ORDERS;
  readonly columns = COLUMNS;
  readonly delay = signal(0);
  readonly query = signal('');
  readonly pins = signal<StarRowPins>({});
  readonly pinEvents: StarRowPinEvent<Order>[] = [];
  readonly mode = signal<'column' | null>(null);
  readonly columnSelection = signal<readonly string[]>([]);
  readonly advanced = signal(false);
  readonly query2 = signal<StarQueryGroup>({ operator: 'and', rules: [] });
  readonly virtual = signal(false);
  readonly groupBy = signal<keyof Order | null>(null);
  readonly collapsed = signal<readonly string[]>([]);
  readonly lazy = signal(false);
}

const texts = (root: Element, selector: string) =>
  Array.from(root.querySelectorAll(selector)).map((node) => node.textContent?.trim());
const bodyIds = (root: Element) =>
  Array.from(root.querySelectorAll('tbody[data-star-part="body"] > tr[data-star-part="row"]')).map(
    (row) => row.querySelector('td[data-star-part="rowCell"]')?.textContent?.trim(),
  );

describe('StarTable depth (N1)', () => {
  describe('slots', () => {
    it('starRow renders the data cells of each row, the row keeps its key and lead cells', async () => {
      const fixture = TestBed.createComponent(SlotHost);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const rows = root.querySelectorAll('tbody > tr[data-star-part="row"]');
      expect(rows.length).toBe(4);
      expect(texts(rows[1], 'td.own-cell')).toEqual(['1:ORD-2', '1:Ben Carter']);
      expect(rows[0].querySelector('td.own-cell')?.getAttribute('data-star-part')).toBe('rowCell');
    });

    it('starTableCell keeps the grid semantics with cell navigation', async () => {
      const fixture = TestBed.createComponent(SlotHost);
      fixture.componentInstance.nav.set(true);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const cells = root.querySelectorAll<HTMLElement>('td.own-cell');
      expect(cells[0].getAttribute('data-field')).toBe('id');
      expect(cells[0].getAttribute('tabindex')).toBe('0');
      expect(cells[1].getAttribute('tabindex')).toBe('-1');
      cells[0].focus();
      cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await fixture.whenStable();
      expect(document.activeElement).toBe(cells[1]);
    });

    it('starFooterRow fills the footer row with the columns and the filtered rows', async () => {
      const fixture = TestBed.createComponent(SlotHost);
      await fixture.whenStable();
      const foot = (fixture.nativeElement as HTMLElement).querySelector('tfoot td.own-foot');
      expect(foot?.textContent?.trim()).toBe('4 orders');
      expect(foot?.getAttribute('colspan')).toBe('2');
    });

    it('starGroupFooter adds a footer row below each group', async () => {
      const fixture = TestBed.createComponent(SlotHost);
      fixture.componentInstance.group.set('status');
      await fixture.whenStable();
      expect(texts(fixture.nativeElement, 'td.own-group-foot')).toEqual([
        'Open: 2',
        'Paid: 1',
        'Shipped: 1',
      ]);
    });

    it('starPaginatorStart and starPaginatorEnd go into the paginator', async () => {
      const fixture = TestBed.createComponent(SlotHost);
      await fixture.whenStable();
      const pager = (fixture.nativeElement as HTMLElement).querySelector('star-paginator')!;
      expect(pager.querySelector('.own-start')?.textContent).toBe('Page 1');
      expect(pager.querySelector('.own-end')?.textContent).toBe('End');
    });
  });

  describe('row pinning', () => {
    it('pinRow moves a row to the pinned top or bottom part and emits rowPin', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      await fixture.whenStable();
      const host = fixture.componentInstance;
      const root = fixture.nativeElement as HTMLElement;
      host.table().pinRow(ORDERS[2], 'top');
      host.table().pinRow(ORDERS[0], 'bottom');
      await fixture.whenStable();
      expect(host.pins()).toEqual({ top: ['ORD-3'], bottom: ['ORD-1'] });
      expect(host.pinEvents.map((e) => [e.row.id, e.side])).toEqual([
        ['ORD-3', 'top'],
        ['ORD-1', 'bottom'],
      ]);
      const top = root.querySelector('tbody[data-star-part="pinnedTopPanel"] tr');
      expect(top?.querySelector('td')?.textContent?.trim()).toBe('ORD-3');
      expect(bodyIds(root)).toEqual(['ORD-2', 'ORD-4']);
      const bottom = root.querySelector('tbody[data-star-part="pinnedBottomPanel"] tr');
      expect(bottom?.querySelector('td')?.textContent?.trim()).toBe('ORD-1');
      host.table().unpinRow(ORDERS[2]);
      await fixture.whenStable();
      expect(host.pins()).toEqual({ top: [], bottom: ['ORD-1'] });
      expect(bodyIds(root)).toEqual(['ORD-2', 'ORD-3', 'ORD-4']);
      expect(host.pinEvents.at(-1)).toEqual({ row: ORDERS[2], side: null });
    });

    it('a pinned row stays rendered with virtual scroll', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.rows = Array.from({ length: 200 }, (_, i) => ({
        id: `ORD-${i}`,
        customer: `C${i}`,
        status: 'Open',
        total: i,
      }));
      host.virtual.set(true);
      host.pins.set({ top: ['ORD-150'] });
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const pinned = root.querySelector('tbody[data-star-part="pinnedTopPanel"] tr');
      expect(pinned?.querySelector('td')?.textContent?.trim()).toBe('ORD-150');
    });

    it('a pinned row stays in the pinned part when its group is closed', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.groupBy.set('status');
      host.collapsed.set(['Open']);
      host.pins.set({ top: ['ORD-1'] });
      await fixture.whenStable();
      const row = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
        'tbody[data-star-part="pinnedTopPanel"] tr',
      )!;
      expect(row.hidden).toBe(false);
    });

    it('pinned rows have aria-rowindex with virtual scroll, before and after the body', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.virtual.set(true);
      host.pins.set({ top: ['ORD-2'], bottom: ['ORD-4'] });
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const top = root.querySelector('tbody[data-star-part="pinnedTopPanel"] tr')!;
      const first = root.querySelector('tbody[data-star-part="body"] tr[data-star-part="row"]')!;
      const bottom = root.querySelector('tbody[data-star-part="pinnedBottomPanel"] tr')!;
      // One header row: the top pin is row 2, the body starts at 3, the bottom pin follows it.
      expect(top.getAttribute('aria-rowindex')).toBe('2');
      expect(first.getAttribute('aria-rowindex')).toBe('3');
      expect(bottom.getAttribute('aria-rowindex')).toBe('5');
      expect(root.querySelector('table')!.getAttribute('aria-rowcount')).toBe('5');
    });

    it('lazy mode keeps the pinned row objects when their page is not loaded', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.lazy.set(true);
      await fixture.whenStable();
      host.table().pinRow(ORDERS[0], 'top');
      host.rows = [{ id: 'ORD-9', customer: 'Ivy Moon', status: 'Paid', total: 3 }];
      fixture.changeDetectorRef.markForCheck();
      fixture.componentRef.changeDetectorRef.detectChanges();
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const top = root.querySelector('tbody[data-star-part="pinnedTopPanel"] tr');
      expect(top?.querySelector('td')?.textContent?.trim()).toBe('ORD-1');
      expect(bodyIds(root)).toEqual(['ORD-9']);
    });

    it('the context menu offers pin top, pin bottom and unpin', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const cell = root.querySelector<HTMLElement>(
        'tbody[data-star-part="body"] td[data-field="customer"]',
      )!;
      cell.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
      await fixture.whenStable();
      const labels = Array.from(document.querySelectorAll('[role="menuitem"]')).map((item) =>
        item.textContent?.trim(),
      );
      expect(labels).toEqual(['Pin row to top', 'Pin row to bottom', 'Unpin row']);
      const items = document.querySelectorAll<HTMLElement>('[role="menuitem"]');
      expect(items[2].getAttribute('aria-disabled')).toBe('true');
      items[0].click();
      await fixture.whenStable();
      expect(fixture.componentInstance.pins()).toEqual({ top: ['ORD-1'], bottom: [] });
    });
  });

  describe('filterDelay', () => {
    afterEach(() => vi.useRealTimers());

    it('waits for the delay before a typed column filter or the global filter applies', async () => {
      vi.useFakeTimers();
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.delay.set(300);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      host.query.set('Ava');
      fixture.detectChanges();
      expect(bodyIds(root)).toHaveLength(4);
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      expect(bodyIds(root)).toEqual(['ORD-1']);
      host.query.set('');
      fixture.detectChanges();
      vi.advanceTimersByTime(300);
      fixture.detectChanges();
      host.table().filters.set({});
      // A typed value in the filter menu or row goes through the same delay.
      (
        host.table() as unknown as { setFilterDelayed(f: string, v: string): void }
      ).setFilterDelayed('customer', 'Ben');
      fixture.detectChanges();
      expect(bodyIds(root)).toHaveLength(4);
      vi.advanceTimersByTime(299);
      expect(host.table().filters()).toEqual({});
      vi.advanceTimersByTime(1);
      fixture.detectChanges();
      expect(bodyIds(root)).toEqual(['ORD-2']);
    });
  });

  describe('Excel-style filter', () => {
    it('shows a search box, Select all, Clear and a value check list', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const button = root.querySelector<HTMLButtonElement>(
        'th[data-field="status"] [data-star-part="filterButton"]',
      )!;
      button.click();
      await fixture.whenStable();
      const panel = document.querySelector<HTMLElement>('[data-star-part="filterPanel"]')!;
      const search = panel.querySelector<HTMLInputElement>('[data-star-part="valueSearchInput"]')!;
      expect(search.getAttribute('aria-label')).toBe('Search');
      const choices = () => texts(panel, '[data-star-part="choiceLabel"]');
      expect(choices()).toEqual(['Open', 'Paid', 'Shipped']);
      search.value = 'p';
      search.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(choices()).toEqual(['Open', 'Paid', 'Shipped']);
      search.value = 'pa';
      search.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      expect(choices()).toEqual(['Paid']);
      panel.querySelector<HTMLElement>('[data-star-part="selectAllButton"] button')!.click();
      search.value = '';
      search.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      const boxes = Array.from(
        panel.querySelectorAll<HTMLInputElement>('[data-star-part="choiceInput"]'),
      );
      expect(boxes.map((box) => box.checked)).toEqual([false, true, false]);
      boxes[0].click();
      await fixture.whenStable();
      Array.from(panel.querySelectorAll<HTMLElement>('star-button button'))
        .find((b) => b.textContent?.trim() === 'Apply')!
        .click();
      await fixture.whenStable();
      expect(fixture.componentInstance.table().filters()['status']).toEqual(['Paid', 'Open']);
      expect(bodyIds(root)).toEqual(['ORD-1', 'ORD-2', 'ORD-3']);
    });

    it('Clear all in the list unchecks every value', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      await fixture.whenStable();
      fixture.componentInstance.table().filters.set({ status: ['Open'] });
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      root
        .querySelector<HTMLButtonElement>(
          'th[data-field="status"] [data-star-part="filterButton"]',
        )!
        .click();
      await fixture.whenStable();
      const panel = document.querySelector<HTMLElement>('[data-star-part="filterPanel"]')!;
      panel.querySelector<HTMLElement>('[data-star-part="clearAllButton"] button')!.click();
      await fixture.whenStable();
      const boxes = Array.from(
        panel.querySelectorAll<HTMLInputElement>('[data-star-part="choiceInput"]'),
      );
      expect(boxes.every((box) => !box.checked)).toBe(true);
    });
  });

  describe('advanced filter', () => {
    it('applies advancedQuery to the rows', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.query2.set({
        operator: 'and',
        rules: [{ field: 'total', matchMode: 'gt', value: 20 }],
      });
      await fixture.whenStable();
      expect(bodyIds(fixture.nativeElement)).toEqual(['ORD-1', 'ORD-4']);
    });

    it('opens a dialog with the query builder; Apply sets advancedQuery', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.advanced.set(true);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const open = root.querySelector<HTMLElement>(
        '[data-star-part="advancedFilterButton"] button',
      )!;
      expect(open.textContent?.trim()).toBe('Advanced filter');
      open.click();
      await fixture.whenStable();
      const dialog = document.querySelector<HTMLElement>('dialog')!;
      expect(dialog.querySelector('star-query-builder')).not.toBeNull();
      const table = host.table() as unknown as {
        advancedDraft: { set(value: StarQueryGroup): void };
      };
      table.advancedDraft.set({
        operator: 'and',
        rules: [{ field: 'status', matchMode: 'contains', value: 'open' }],
      });
      Array.from(dialog.querySelectorAll<HTMLElement>('button'))
        .find((b) => b.textContent?.trim() === 'Apply')!
        .click();
      await fixture.whenStable();
      expect(host.query2().rules.length).toBe(1);
      expect(bodyIds(root)).toEqual(['ORD-1', 'ORD-3']);
    });
  });

  describe('column selection', () => {
    it('selects a column from its header button; Shift extends; Ctrl toggles', async () => {
      const fixture = TestBed.createComponent(FeatureHost);
      const host = fixture.componentInstance;
      host.mode.set('column');
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;
      const button = (field: string) =>
        root.querySelector<HTMLButtonElement>(
          `th[data-field="${field}"] [data-star-part="columnSelectButton"]`,
        )!;
      expect(button('id').getAttribute('aria-label')).toBe('Select column Order');
      expect(button('id').getAttribute('aria-pressed')).toBe('false');
      button('id').click();
      await fixture.whenStable();
      expect(host.columnSelection()).toEqual(['id']);
      button('status').dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
      await fixture.whenStable();
      expect(host.columnSelection()).toEqual(['id', 'customer', 'status']);
      button('customer').dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true }));
      await fixture.whenStable();
      expect(host.columnSelection()).toEqual(['id', 'status']);
      expect(button('status').getAttribute('aria-pressed')).toBe('true');
      const th = root.querySelector('th[data-field="status"]')!;
      expect(th.classList).toContain('star-table__th--selected');
      const cells = root.querySelectorAll(
        'tbody[data-star-part="body"] td.star-table__cell--col-selected',
      );
      expect(cells.length).toBe(8);
      button('status').click();
      await fixture.whenStable();
      expect(host.columnSelection()).toEqual(['status']);
    });
  });
});
