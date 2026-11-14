import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  StarCellEditEvent,
  StarColumn,
  StarColumnFilters,
  StarLazyLoadEvent,
  StarRowExpansionTemplate,
  StarRowReorderEvent,
  StarSortState,
  StarTable,
} from './table';

interface Row {
  id: number;
  product: string;
  status: string;
  note: string;
  amount: number;
}

const ROWS: Row[] = [
  { id: 1, product: 'Cable Kit', status: 'Open', note: 'First, "urgent"', amount: -5 },
  { id: 2, product: 'Notebook XL', status: 'Closed', note: '=SUM(A1:A9)', amount: 12 },
  { id: 3, product: 'Cable Kit', status: 'Closed', note: '', amount: 7 },
  { id: 4, product: 'Desk Lamp', status: 'Open', note: 'Line 1\nLine 2', amount: 3 },
];

@Component({
  imports: [StarTable],
  template: `
    <star-table
      [value]="rows"
      [columns]="columns"
      dataKey="id"
      selectionMode="multiple"
      [(selection)]="selection"
      [(filters)]="filters"
      [lazy]="lazy()"
      (lazyLoad)="events.push($event)"
    />
  `,
})
class Host {
  readonly table = viewChild.required<StarTable<Row>>(StarTable);
  readonly rows = ROWS;
  readonly columns: StarColumn<Row>[] = [
    { field: 'product', header: 'Product', sortable: true, filter: 'text' },
    { field: 'status', header: 'Status', filter: 'select' },
    { field: 'note', header: 'Note' },
    { field: 'amount', header: 'Amount' },
    { field: 'id', header: 'Internal id', exportable: false },
  ];
  readonly selection = signal<readonly Row[]>([]);
  readonly filters = signal<StarColumnFilters>({});
  readonly lazy = signal(false);
  readonly events: StarLazyLoadEvent[] = [];
}

describe('StarTable column filters and CSV export', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const products = () =>
      [...el.querySelectorAll('tbody tr td:nth-child(2)')].map((cell) => cell.textContent?.trim());
    return { fixture, el, host: fixture.componentInstance, products };
  }

  it('renders a labelled filter for each column that asks for one', async () => {
    const { el } = await setup();
    const filters = [...el.querySelectorAll<HTMLElement>('.star-table__filter')];
    expect(filters.map((filter) => filter.getAttribute('aria-label'))).toEqual([
      'Filter by Product',
      'Filter by Status',
    ]);
    const options = [...el.querySelectorAll('select.star-table__filter option')];
    expect(options.map((option) => option.textContent?.trim())).toEqual(['All', 'Closed', 'Open']);
  });

  it('filters by text and by choice together, and clears the filters', async () => {
    const { fixture, el, host, products } = await setup();
    const input = el.querySelector<HTMLInputElement>('input.star-table__filter')!;
    input.value = 'cable';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(products()).toEqual(['Cable Kit', 'Cable Kit']);

    const select = el.querySelector<HTMLSelectElement>('select.star-table__filter')!;
    select.value = 'Closed';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.filters()).toEqual({ product: 'cable', status: 'Closed' });
    expect(el.querySelectorAll('tbody tr').length).toBe(1);

    host.table().clearFilters();
    await fixture.whenStable();
    expect(products().length).toBe(4);
    expect(input.value).toBe('');
  });

  it('sends the column filters to the server in lazy mode', async () => {
    const { fixture, host } = await setup();
    host.lazy.set(true);
    host.filters.set({ status: 'Open' });
    await fixture.whenStable();
    expect(host.events.at(-1)?.filters).toEqual({ status: 'Open' });
    expect(host.events.at(-1)?.first).toBe(0);
  });

  it('exports the filtered rows in sort order, with quoting and formula protection', async () => {
    const { fixture, host } = await setup();
    host.table().sortBy(host.columns[0]);
    await fixture.whenStable();
    expect(host.table().toCsv().split('\r\n')).toEqual([
      'Product,Status,Note,Amount',
      'Cable Kit,Open,"First, ""urgent""",-5',
      'Cable Kit,Closed,,7',
      'Desk Lamp,Open,"Line 1\nLine 2",3',
      "Notebook XL,Closed,'=SUM(A1:A9),12",
    ]);

    host.filters.set({ status: 'Closed' });
    await fixture.whenStable();
    expect(host.table().toCsv({ separator: ';' }).split('\r\n')).toEqual([
      'Product;Status;Note;Amount',
      'Cable Kit;Closed;;7',
      "Notebook XL;Closed;'=SUM(A1:A9);12",
    ]);
  });

  it('exports the selected rows only when asked', async () => {
    const { fixture, host } = await setup();
    host.selection.set([ROWS[3]]);
    await fixture.whenStable();
    expect(host.table().toCsv({ selectionOnly: true }).split('\r\n').length).toBe(2);
  });
});

@Component({
  imports: [StarTable, StarRowExpansionTemplate],
  template: `
    <star-table
      [value]="rows"
      [columns]="columns"
      dataKey="id"
      [rowExpandMode]="mode()"
      [(expandedKeys)]="expanded"
    >
      <ng-template starRowExpansion [starRowExpansionOf]="rows" let-row>
        <p class="detail">Note: {{ row.note }}</p>
      </ng-template>
    </star-table>
  `,
})
class ExpansionHost {
  readonly table = viewChild.required<StarTable<Row>>(StarTable);
  readonly rows = ROWS;
  readonly columns: StarColumn<Row>[] = [{ field: 'product', header: 'Product' }];
  readonly expanded = signal<readonly unknown[]>([]);
  readonly mode = signal<'single' | 'multiple'>('multiple');
}

describe('StarTable row expansion', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ExpansionHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const toggles = () => [...el.querySelectorAll<HTMLButtonElement>('.star-table__toggle')];
    const details = () =>
      [...el.querySelectorAll('.star-table__expansion .detail')].map((d) => d.textContent?.trim());
    return { fixture, el, host: fixture.componentInstance, toggles, details };
  }

  it('shows the detail of a row below it and names the button state', async () => {
    const { fixture, el, host, toggles, details } = await setup();
    expect(toggles().length).toBe(4);
    expect(toggles()[1].getAttribute('aria-label')).toBe('Expand row');
    expect(toggles()[1].getAttribute('aria-expanded')).toBe('false');

    toggles()[1].click();
    await fixture.whenStable();
    expect(host.expanded()).toEqual([2]);
    expect(details()).toEqual(['Note: =SUM(A1:A9)']);
    expect(toggles()[1].getAttribute('aria-label')).toBe('Collapse row');
    const detailRow = el.querySelector('.star-table__expansion')!;
    expect(toggles()[1].getAttribute('aria-controls')).toBe(detailRow.id);
    expect(detailRow.querySelector('td')?.getAttribute('colspan')).toBe('2');
    expect(detailRow.previousElementSibling?.textContent).toContain('Notebook XL');

    toggles()[1].click();
    await fixture.whenStable();
    expect(details()).toEqual([]);
  });

  it('keeps one row open in single mode, and opens or closes all rows from code', async () => {
    const { fixture, host, toggles, details } = await setup();
    host.mode.set('single');
    await fixture.whenStable();
    toggles()[0].click();
    toggles()[2].click();
    await fixture.whenStable();
    expect(host.expanded()).toEqual([3]);

    host.table().expandAll();
    await fixture.whenStable();
    expect(details().length).toBe(4);
    host.table().collapseAll();
    await fixture.whenStable();
    expect(details().length).toBe(0);
  });
});

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows()"
    [columns]="columns"
    dataKey="id"
    (cellEdit)="edits.push($event)"
  />`,
})
class EditHost {
  readonly rows = signal(ROWS);
  readonly columns: StarColumn<Row>[] = [
    { field: 'product', header: 'Product', editable: true },
    {
      field: 'status',
      header: 'Status',
      editable: (row) => row.status === 'Open',
      editor: 'select',
      editOptions: ['Open', 'Closed'],
    },
    { field: 'amount', header: 'Amount', editable: true, editor: 'number' },
    { field: 'note', header: 'Note' },
  ];
  readonly edits: StarCellEditEvent<Row>[] = [];
}

describe('StarTable inline cell edit', () => {
  async function setup() {
    const fixture = TestBed.createComponent(EditHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const open = async (row: number, column: number) => {
      el.querySelector<HTMLButtonElement>(
        `tbody tr:nth-child(${row}) td:nth-child(${column}) .star-table__edit`,
      )!.click();
      await fixture.whenStable();
      return el.querySelector<HTMLInputElement | HTMLSelectElement>('.star-table__editor')!;
    };
    return { fixture, el, host: fixture.componentInstance, open };
  }

  it('offers an edit button only on editable cells', async () => {
    const { el } = await setup();
    const buttons = [...el.querySelectorAll('.star-table__edit')];
    // 4 products + 2 open statuses + 4 amounts.
    expect(buttons.length).toBe(10);
    // The name comes from the content (action and value), so it holds the visible text.
    expect(buttons[0].hasAttribute('aria-label')).toBe(false);
    expect(buttons[0].textContent!.replace(/\s+/g, ' ').trim()).toMatch(/^Edit Product: \S/);
  });

  it('emits the new text on Enter and does not change the rows itself', async () => {
    const { fixture, el, host, open } = await setup();
    const editor = await open(1, 1);
    expect(editor.value).toBe('Cable Kit');
    editor.value = 'Cable Kit Forte';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    editor.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host.edits).toEqual([
      { row: ROWS[0], field: 'product', value: 'Cable Kit Forte', previous: 'Cable Kit' },
    ]);
    expect(el.querySelector('.star-table__editor')).toBeNull();
    expect(el.querySelector('tbody td')?.textContent).toContain('Cable Kit');
  });

  it('emits a number for a number editor and nothing when the value is the same', async () => {
    const { fixture, host, open } = await setup();
    let editor = await open(2, 3);
    editor.value = '12';
    editor.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host.edits).toEqual([]);

    editor = await open(2, 3);
    editor.value = '40';
    editor.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(host.edits.at(-1)).toMatchObject({ field: 'amount', value: 40, previous: 12 });
  });

  it('cancels on Escape and commits a choice', async () => {
    const { fixture, el, host, open } = await setup();
    let editor = await open(1, 1);
    editor.value = 'Changed';
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(host.edits).toEqual([]);
    expect(el.querySelector('.star-table__editor')).toBeNull();

    editor = await open(1, 2);
    editor.value = 'Closed';
    editor.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.edits.at(-1)).toMatchObject({ field: 'status', value: 'Closed', previous: 'Open' });
  });
});

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="id"
    columnToggle
    reorderableColumns
    resizableColumns
    [(columnOrder)]="order"
    [(hiddenColumns)]="hidden"
    [(columnWidths)]="widths"
  />`,
})
class ColumnsHost {
  readonly table = viewChild.required<StarTable<Row>>(StarTable);
  readonly rows = ROWS;
  readonly columns: StarColumn<Row>[] = [
    { field: 'product', header: 'Product' },
    { field: 'status', header: 'Status' },
    { field: 'id', header: 'Id', width: '80px', frozen: true, hideable: false },
    { field: 'amount', header: 'Amount', width: '100px', frozen: true },
  ];
  readonly order = signal<readonly string[]>([]);
  readonly hidden = signal<readonly string[]>([]);
  readonly widths = signal<Readonly<Record<string, number>>>({});
}

describe('StarTable columns: order, visibility, width, freeze', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ColumnsHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const headers = () =>
      [...el.querySelectorAll<HTMLElement>('thead th')].map((th) => th.textContent?.trim());
    return { fixture, el, host: fixture.componentInstance, headers };
  }

  it('puts frozen columns first and offsets each by the frozen widths before it', async () => {
    const { el, headers } = await setup();
    expect(headers()).toEqual(['Id', 'Amount', 'Product', 'Status']);
    const cells = [...el.querySelectorAll<HTMLElement>('tbody tr:first-child td')];
    expect(cells[0].classList).toContain('star-table__cell--frozen');
    expect(cells[0].style.insetInlineStart).toBe('0px');
    expect(cells[1].style.insetInlineStart).toBe('calc(80px)');
    expect(cells[2].classList).not.toContain('star-table__cell--frozen');
  });

  it('moves and hides columns, and exports the visible columns in display order', async () => {
    const { fixture, host, headers } = await setup();
    host.table().moveColumn('status', 'product');
    await fixture.whenStable();
    expect(headers()).toEqual(['Id', 'Amount', 'Status', 'Product']);
    expect(host.order()).toEqual(['id', 'amount', 'status', 'product']);

    host.hidden.set(['amount']);
    await fixture.whenStable();
    expect(headers()).toEqual(['Id', 'Status', 'Product']);
    expect(host.table().toCsv().split('\r\n')[0]).toBe('Id,Status,Product');
  });

  it('resizes a column with the arrow keys and keeps a minimum width', async () => {
    const { fixture, el, host } = await setup();
    const handle = el.querySelector<HTMLElement>('thead th:nth-child(1) .star-table__resizer')!;
    expect(handle.getAttribute('aria-label')).toBe('Resize Id');
    host.widths.set({ id: 80 });
    await fixture.whenStable();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await fixture.whenStable();
    expect(host.widths()).toEqual({ id: 96 });
    expect(el.querySelector<HTMLElement>('thead th')!.style.width).toBe('96px');

    host.widths.set({ id: 50 });
    await fixture.whenStable();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();
    expect(host.widths()).toEqual({ id: 48 });
  });

  it('resizes the other way round in a right-to-left page: the handle is on the left edge', async () => {
    const { fixture, el, host } = await setup();
    el.setAttribute('dir', 'rtl');
    const handle = el.querySelector<HTMLElement>('thead th:nth-child(1) .star-table__resizer')!;
    host.widths.set({ id: 80 });
    await fixture.whenStable();
    // Arrow left moves the edge to the left, which makes the column wider.
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    await fixture.whenStable();
    expect(host.widths()).toEqual({ id: 96 });
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await fixture.whenStable();
    expect(host.widths()).toEqual({ id: 64 });
  });
});

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="id"
    virtualScroll
    [virtualRowHeight]="40"
    scrollHeight="400px"
  />`,
})
class VirtualHost {
  readonly rows = Array.from({ length: 1000 }, (_, i) => ({ id: i + 1, product: `Row ${i + 1}` }));
  readonly columns: StarColumn<{ id: number; product: string }>[] = [
    { field: 'product', header: 'Product' },
  ];
}

describe('StarTable virtual scroll', () => {
  it('renders the rows in view only and keeps the scroll height with spacer rows', async () => {
    const fixture = TestBed.createComponent(VirtualHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => [...el.querySelectorAll<HTMLElement>('tbody .star-table__row')];
    const spacers = () =>
      [...el.querySelectorAll<HTMLElement>('.star-table__spacer td')].map((td) => td.style.height);

    // 480 px fallback viewport / 40 px = 12 rows in view + 5 buffer rows.
    expect(rows().length).toBe(17);
    expect(rows()[0].textContent).toContain('Row 1');
    expect(spacers()).toEqual([`${(1000 - 17) * 40}px`]);
    expect(el.querySelector('table')?.getAttribute('aria-rowcount')).toBe('1001');

    const viewport = el.querySelector<HTMLElement>('.star-table__scroll')!;
    Object.defineProperty(viewport, 'clientHeight', { value: 400 });
    viewport.scrollTop = 4000;
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();

    // First row in view is row 101; 5 buffer rows before it, 10 in view, 5 after.
    expect(rows().length).toBe(20);
    expect(rows()[0].textContent).toContain('Row 96');
    expect(rows()[0].getAttribute('aria-rowindex')).toBe('97');
    expect(spacers()).toEqual([`${95 * 40}px`, `${(1000 - 115) * 40}px`]);
  });
});

@Component({
  imports: [StarTable],
  template: `<star-table [value]="rows" [columns]="columns" dataKey="id" [(filters)]="filters" />`,
})
class FilterTypesHost {
  readonly rows = [
    { id: 1, status: 'Open', amount: 5, received: new Date(2026, 9, 3, 23, 30) },
    { id: 2, status: 'Closed', amount: 12, received: new Date(2026, 9, 10, 8) },
    { id: 3, status: 'Escalated', amount: 40, received: new Date(2026, 9, 20, 8) },
    { id: 4, status: 'Open', amount: 0, received: '2026-11-02T10:00:00Z' },
  ];
  readonly columns: StarColumn<(typeof this.rows)[number]>[] = [
    { field: 'id', header: 'Id' },
    { field: 'status', header: 'Status', filter: 'multiselect' },
    { field: 'amount', header: 'Amount', filter: 'number' },
    { field: 'received', header: 'Received', filter: 'date', format: () => 'formatted' },
  ];
  readonly filters = signal<StarColumnFilters>({});
}

describe('StarTable filter types', () => {
  async function setup() {
    const fixture = TestBed.createComponent(FilterTypesHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const ids = () =>
      [...el.querySelectorAll('tbody tr td:first-child')].map((cell) => cell.textContent?.trim());
    const type = async (label: string, value: string) => {
      const input = el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    return { fixture, el, host: fixture.componentInstance, ids, type };
  }

  it('filters a number column by a range, with either bound open', async () => {
    const { host, ids, type } = await setup();
    await type('Amount from', '5');
    expect(host.filters()).toEqual({ amount: { min: 5 } });
    expect(ids()).toEqual(['1', '2', '3']);
    await type('Amount to', '12');
    expect(ids()).toEqual(['1', '2']);
    await type('Amount from', '');
    expect(host.filters()).toEqual({ amount: { min: null, max: 12 } });
    expect(ids()).toEqual(['1', '2', '4']);
  });

  it('filters a date column by local day, from the value and not the display text', async () => {
    const { ids, type } = await setup();
    await type('Received from', '2026-10-03');
    await type('Received to', '2026-10-10');
    expect(ids()).toEqual(['1', '2']);
  });

  it('filters by a list of choices and ignores an empty list', async () => {
    const { fixture, host, ids } = await setup();
    host.filters.set({ status: ['Open', 'Escalated'] });
    await fixture.whenStable();
    expect(ids()).toEqual(['1', '3', '4']);
    host.filters.set({ status: [] });
    await fixture.whenStable();
    expect(ids().length).toBe(4);
  });
});

describe('StarTable Excel and print export', () => {
  @Component({
    imports: [StarTable],
    template: `<star-table [value]="rows" [columns]="columns" dataKey="id" ariaLabel="Orders" />`,
  })
  class ExportHost {
    readonly table = viewChild.required<StarTable<Row>>(StarTable);
    readonly rows = ROWS;
    readonly columns: StarColumn<Row>[] = [
      { field: 'product', header: 'Product & quantity' },
      { field: 'status', header: 'Status', exportValue: (row) => row.status.toUpperCase() },
      { field: 'note', header: 'Note' },
      { field: 'amount', header: 'Amount' },
    ];
  }

  async function setup() {
    const fixture = TestBed.createComponent(ExportHost);
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance };
  }

  it('uses exportValue in every export and takes rows from the options', async () => {
    const { host } = await setup();
    expect(host.table().toCsv().split('\r\n')[1]).toBe('Cable Kit,OPEN,"First, ""urgent""",-5');
    expect(
      host
        .table()
        .toCsv({ rows: [ROWS[2]] })
        .split('\r\n'),
    ).toEqual(['Product & quantity,Status,Note,Amount', 'Cable Kit,CLOSED,,7']);
  });

  it('builds a valid .xlsx archive with text as inline strings and numbers as numbers', async () => {
    const { host } = await setup();
    const bytes = host.table().toXlsx();
    const text = new TextDecoder().decode(bytes);
    // ZIP signature, six parts, end-of-archive record.
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const end = new DataView(bytes.buffer, bytes.length - 22);
    expect(end.getUint32(0, true)).toBe(0x06054b50);
    expect(end.getUint16(10, true)).toBe(6);
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('<sheet name="Orders" sheetId="1"');
    // Header is escaped; a formula-like note is text; the amount is a number.
    expect(text).toContain('<t xml:space="preserve">Product &amp; quantity</t>');
    expect(text).toContain('t="inlineStr"><is><t xml:space="preserve">=SUM(A1:A9)</t>');
    expect(text).toContain('<c r="D2"><v>-5</v></c>');
    expect(text).toContain('<t xml:space="preserve">OPEN</t>');
  });

  it('prints a plain table document through a hidden frame', async () => {
    const { host } = await setup();
    host.table().print({ title: 'Orders <today>' });
    const frame = document.querySelector<HTMLIFrameElement>('iframe[aria-hidden="true"]')!;
    expect(frame.srcdoc).toContain('<h1>Orders &lt;today&gt;</h1>');
    expect(frame.srcdoc).toContain('<th scope="col">Product &amp; quantity</th>');
    expect(frame.srcdoc).toContain('<td class="n">-5</td>');
    frame.remove();
  });
});

describe('StarTable stacked layout', () => {
  @Component({
    imports: [StarTable],
    template: `<star-table [value]="rows" [columns]="columns" responsiveLayout="stack" />`,
  })
  class StackHost {
    readonly rows = ROWS;
    readonly columns: StarColumn<Row>[] = [
      { field: 'product', header: 'Product', filter: 'text' },
      { field: 'status', header: 'Status' },
    ];
  }

  it('labels every body cell with its column header for the stacked layout', async () => {
    const fixture = TestBed.createComponent(StackHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('star-table')?.classList).toContain('star-table--stack');
    const cells = [...el.querySelectorAll<HTMLElement>('tbody tr:first-child td')];
    expect(cells.map((cell) => cell.dataset['label'])).toEqual(['Product', 'Status']);
    // Only a filter cell that has a filter gets a label; the empty one hides when stacked.
    const filters = [...el.querySelectorAll<HTMLElement>('.star-table__filters td')];
    expect(filters.map((cell) => cell.dataset['label'])).toEqual(['Product', undefined]);
  });
});

describe('StarTable groups, multi-sort, footer, row reorder and saved state', () => {
  @Component({
    imports: [StarTable],
    template: `<star-table
      [value]="rows()"
      [columns]="columns"
      dataKey="id"
      multiSort
      reorderableRows
      [groupBy]="group()"
      [stateKey]="key()"
      [(sortMeta)]="sorts"
      [(collapsedGroups)]="closed"
      (rowReorder)="moves.push($event)"
    />`,
  })
  class Host2 {
    readonly table = viewChild.required<StarTable<Row>>(StarTable);
    readonly rows = signal(ROWS);
    readonly group = signal<'status' | null>(null);
    readonly key = signal<string | null>(null);
    readonly sorts = signal<readonly StarSortState[]>([]);
    readonly closed = signal<readonly string[]>([]);
    readonly moves: StarRowReorderEvent<Row>[] = [];
    readonly columns: StarColumn<Row>[] = [
      { field: 'product', header: 'Product', sortable: true, footer: 'Total' },
      { field: 'status', header: 'Status', sortable: true },
      {
        field: 'amount',
        header: 'Amount',
        sortable: true,
        footer: (rows) => String(rows.reduce((sum, row) => sum + row.amount, 0)),
      },
    ];
  }

  async function setup() {
    localStorage.clear();
    const fixture = TestBed.createComponent(Host2);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const column = (n: number) =>
      [...el.querySelectorAll(`tbody tr.star-table__row:not([hidden]) td:nth-child(${n})`)].map(
        (cell) => cell.textContent?.trim(),
      );
    const sortButton = (label: string) =>
      [...el.querySelectorAll<HTMLButtonElement>('.star-table__sort')].find((button) =>
        button.textContent?.includes(label),
      )!;
    return { fixture, el, host: fixture.componentInstance, column, sortButton };
  }

  it('sorts by two columns with Shift + click and marks the order', async () => {
    const { fixture, el, host, column, sortButton } = await setup();
    sortButton('Product').click();
    sortButton('Amount').dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    sortButton('Amount').dispatchEvent(new MouseEvent('click', { shiftKey: true, bubbles: true }));
    await fixture.whenStable();
    expect(host.sorts()).toEqual([
      { field: 'product', order: 1 },
      { field: 'amount', order: -1 },
    ]);
    // Cable Kit rows by amount down (7, -5), then the other products by name.
    expect(column(4)).toEqual(['7', '-5', '3', '12']);
    expect([...el.querySelectorAll('.star-table__sort-rank')].map((r) => r.textContent)).toEqual([
      '1',
      '2',
    ]);
    const sorted = [...el.querySelectorAll('th[aria-sort]')].map((th) =>
      th.getAttribute('aria-sort'),
    );
    expect(sorted).toEqual(['ascending', 'none', 'none']);

    sortButton('Status').click();
    await fixture.whenStable();
    expect(host.sorts()).toEqual([{ field: 'status', order: 1 }]);
  });

  it('shows rows under group headings and closes a group', async () => {
    const { fixture, el, host, column } = await setup();
    host.group.set('status');
    await fixture.whenStable();
    const headings = () =>
      [...el.querySelectorAll('.star-table__group-toggle')].map((button) =>
        button.textContent?.replace(/\s+/g, ' ').trim(),
      );
    expect(headings()).toEqual(['Open 2', 'Closed 2']);
    expect(column(2)).toEqual(['Cable Kit', 'Desk Lamp', 'Notebook XL', 'Cable Kit']);

    el.querySelector<HTMLButtonElement>('.star-table__group-toggle')!.click();
    await fixture.whenStable();
    expect(host.closed()).toEqual(['Open']);
    expect(column(2)).toEqual(['Notebook XL', 'Cable Kit']);
    expect(el.querySelector('.star-table__group-toggle')?.getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('shows a footer row from fixed text and from the filtered rows', async () => {
    const { el } = await setup();
    const footer = [...el.querySelectorAll('tfoot td')].map((cell) => cell.textContent?.trim());
    // First cell: the row order column.
    expect(footer).toEqual(['', 'Total', '', '17']);
  });

  it('asks the owner to move a row and stops when the order is not its own', async () => {
    const { fixture, el, host, sortButton } = await setup();
    const down = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Move down"]')];
    const up = () => [...el.querySelectorAll<HTMLButtonElement>('[aria-label="Move up"]')];
    expect(up()[0].disabled).toBe(true);
    expect(down()[3].disabled).toBe(true);
    down()[1].click();
    expect(host.moves).toEqual([{ row: ROWS[1], from: 1, to: 2 }]);

    sortButton('Product').click();
    await fixture.whenStable();
    expect(down().every((button) => button.disabled)).toBe(true);
  });

  it('saves the view under stateKey and restores it in a new table', async () => {
    const first = await setup();
    first.host.key.set('spec-table');
    await first.fixture.whenStable();
    first.sortButton('Amount').click();
    first.host.table().filters.set({ product: 'x' });
    await first.fixture.whenStable();
    const saved = JSON.parse(localStorage.getItem('spec-table') ?? '{}');
    expect(saved.sortField).toBe('amount');
    expect(saved.filters).toEqual({ product: 'x' });

    const fixture = TestBed.createComponent(Host2);
    fixture.componentInstance.key.set('spec-table');
    await fixture.whenStable();
    const table = fixture.componentInstance.table();
    expect(table.sortField()).toBe('amount');
    expect(table.filters()).toEqual({ product: 'x' });

    table.clearState();
    expect(localStorage.getItem('spec-table')).toBeNull();
  });
});
