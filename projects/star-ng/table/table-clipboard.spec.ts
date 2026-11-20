import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarClipboard } from '@star-ng/ui/core';
import { StarCellEditEvent, StarColumn, StarTable } from './table';
import { parseTsv, StarTablePasteEvent, toTsv, tsvCell } from './table-clipboard';
import { StarBatchChanges, StarRowEditSaveEvent } from './table-editing';
import { StarTableCellRef } from './table-navigation';

describe('TSV helpers', () => {
  it('quotes cells with tabs, line breaks and quotes', () => {
    expect(tsvCell('Desk lamp')).toBe('Desk lamp');
    expect(tsvCell('a\tb')).toBe('"a\tb"');
    expect(tsvCell('line 1\nline 2')).toBe('"line 1\nline 2"');
    expect(tsvCell('12" screen')).toBe('"12"" screen"');
    expect(
      toTsv([
        ['SKU', 'Name'],
        ['SKU-1', 'Say "hi"'],
      ]),
    ).toBe('SKU\tName\r\nSKU-1\t"Say ""hi"""');
  });

  it('reads TSV with quoted cells and any line break, without an empty last line', () => {
    expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
    expect(parseTsv('"x\ty"\t"line 1\nline 2"\n"12"" screen"')).toEqual([
      ['x\ty', 'line 1\nline 2'],
      ['12" screen'],
    ]);
    expect(parseTsv('a\t\rb')).toEqual([['a', ''], ['b']]);
    expect(parseTsv('')).toEqual([]);
    expect(parseTsv('one')).toEqual([['one']]);
  });

  it('reads back what it writes', () => {
    const block = [
      ['Tab\there', 'Quote "q"'],
      ['Line\r\nbreak', ''],
    ];
    expect(parseTsv(toTsv(block))).toEqual(block);
  });
});

interface Part {
  sku: string;
  name: string;
  stock: number | null;
  bin: string;
}

const PARTS: Part[] = [
  { sku: 'P-1', name: 'Bolt', stock: 4, bin: 'A' },
  { sku: 'P-2', name: 'Nut', stock: 9, bin: 'B' },
  { sku: 'P-3', name: 'Washer', stock: 2, bin: 'A' },
  { sku: 'P-4', name: 'Hinge "XL"', stock: 1, bin: 'C' },
];

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows()"
    [columns]="columns"
    dataKey="sku"
    ariaLabel="Parts"
    [selectionMode]="mode()"
    [(selection)]="selected"
    [(cellSelection)]="cells"
    [copyHeaders]="headers()"
    [pasteEditable]="paste()"
    [batchEdit]="batch()"
    [editMode]="editMode()"
    (cellEdit)="edits.push($event)"
    (rowEditSave)="rowSaves.push($event)"
    (batchSave)="saved.push($event)"
    (beforePaste)="onBefore($event)"
  />`,
})
class ClipHost {
  readonly table = viewChild.required<StarTable<Part>>(StarTable);
  readonly rows = signal(PARTS);
  readonly mode = signal<'multiple' | 'range' | null>('range');
  readonly selected = signal<readonly Part[]>([]);
  readonly cells = signal<readonly StarTableCellRef[]>([]);
  readonly headers = signal(false);
  readonly paste = signal(true);
  readonly batch = signal(false);
  readonly editMode = signal<'cell' | 'row'>('cell');
  readonly cancel = signal(false);
  readonly edits: StarCellEditEvent<Part>[] = [];
  readonly rowSaves: StarRowEditSaveEvent<Part>[] = [];
  readonly saved: StarBatchChanges<Part>[] = [];
  readonly before: StarTablePasteEvent<Part>[] = [];
  readonly columns: StarColumn<Part>[] = [
    { field: 'sku', header: 'SKU' },
    { field: 'name', header: 'Name', editable: true, required: true },
    { field: 'stock', header: 'Stock', editable: true, editor: 'number', min: 0, max: 99 },
    { field: 'bin', header: 'Bin', editable: true, editor: 'select', editOptions: ['A', 'B', 'C'] },
  ];

  onBefore(event: StarTablePasteEvent<Part>): void {
    this.before.push(event);
    if (this.cancel()) event.cancel();
  }
}

async function setup(change: (host: ClipHost) => void = () => undefined) {
  const copied: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      {
        provide: StarClipboard,
        useValue: { copy: (text: string) => (copied.push(text), Promise.resolve(true)) },
      },
    ],
  });
  const fixture = TestBed.createComponent(ClipHost);
  const announce = vi.spyOn(TestBed.inject(LiveAnnouncer), 'announce').mockResolvedValue();
  change(fixture.componentInstance);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  document.body.append(el);
  const cell = (sku: string, field: string) =>
    el.querySelector<HTMLElement>(`tbody tr[data-row="${sku}"] td[data-field="${field}"]`)!;
  const focus = async (sku: string, field: string) => {
    const target = cell(sku, field);
    (target.querySelector<HTMLElement>('.star-table__edit') ?? target).focus();
    await fixture.whenStable();
  };
  const ctrlC = async () => {
    const event = new KeyboardEvent('keydown', {
      key: 'c',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.activeElement!.dispatchEvent(event);
    await fixture.whenStable();
    await Promise.resolve();
    return event.defaultPrevented;
  };
  const pasteText = async (text: string) => {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => text } });
    document.activeElement!.dispatchEvent(event);
    await fixture.whenStable();
    return event.defaultPrevented;
  };
  const said = () => announce.mock.calls.map(([message]) => message);
  return {
    fixture,
    el,
    host: fixture.componentInstance,
    cell,
    focus,
    ctrlC,
    pasteText,
    copied,
    said,
  };
}

describe('StarTable clipboard', () => {
  afterEach(() => document.body.replaceChildren());

  it('copies the focused cell with Ctrl+C and announces it', async () => {
    const { focus, ctrlC, copied, said } = await setup((host) => host.mode.set(null));
    await focus('P-4', 'name');
    expect(await ctrlC()).toBe(true);
    expect(copied).toEqual(['"Hinge ""XL"""']);
    expect(said()).toContain('Copied 1 cell');
  });

  it('copies a cell range as a block, with headers on request', async () => {
    const { fixture, host, focus, ctrlC, copied, said } = await setup((h) => h.headers.set(true));
    host.cells.set([
      { rowKey: 'P-1', field: 'name' },
      { rowKey: 'P-1', field: 'stock' },
      { rowKey: 'P-2', field: 'stock' },
    ]);
    await fixture.whenStable();
    await focus('P-1', 'sku');
    await ctrlC();
    expect(copied).toEqual(['Name\tStock\r\nBolt\t4\r\n\t9']);
    expect(said()).toContain('Copied 3 cells');

    await host.table().copyToClipboard({ headers: false });
    expect(copied[1]).toBe('Bolt\t4\r\n\t9');
  });

  it('copies the selected rows in display order', async () => {
    const { fixture, host, focus, ctrlC, copied } = await setup((h) => h.mode.set('multiple'));
    host.selected.set([PARTS[2], PARTS[0]]);
    await fixture.whenStable();
    await focus('P-2', 'sku');
    await ctrlC();
    expect(copied).toEqual(['P-1\tBolt\t4\tA\r\nP-3\tWasher\t2\tA']);
  });

  it('leaves Ctrl+C to the browser in a field and with no cell', async () => {
    const { el, fixture, ctrlC, copied } = await setup((h) => h.mode.set(null));
    expect(await ctrlC()).toBe(false);
    el.querySelector<HTMLElement>('tbody .star-table__edit')!.click();
    await fixture.whenStable();
    const editor = el.querySelector<HTMLInputElement>('.star-table__editor')!;
    editor.focus();
    expect(document.activeElement).toBe(editor);
    expect(await ctrlC()).toBe(false);
    expect(copied).toEqual([]);
  });

  it('pastes TSV into editable cells with validation and emits cellEdit', async () => {
    const { host, focus, pasteText, said } = await setup();
    await focus('P-1', 'name');
    // Row 1: name, stock, bin, plus one extra cell past the last column.
    // Row 2: an empty required name, a number out of range, a bin that is no option.
    // Row 3: unchanged name, a new stock.
    expect(await pasteText('Bolt M6\t7\tC\textra\n\t500\tZ\nWasher\t3\n')).toBe(true);
    expect(host.before).toHaveLength(1);
    expect(
      host.before[0].cells.map((cell) => `${cell.row.sku}.${cell.field}=${cell.value}`),
    ).toEqual([
      'P-1.name=Bolt M6',
      'P-1.stock=7',
      'P-1.bin=C',
      'P-2.name=',
      'P-2.stock=500',
      'P-2.bin=Z',
      'P-3.name=Washer',
      'P-3.stock=3',
    ]);
    expect(host.edits.map((edit) => `${edit.row.sku}.${edit.field}=${edit.value}`)).toEqual([
      'P-1.name=Bolt M6',
      'P-1.stock=7',
      'P-1.bin=C',
      'P-3.stock=3',
    ]);
    expect(host.edits[1].previous).toBe(4);
    expect(said()).toContain('Pasted 4 cells. 3 cells not pasted: value not valid');
  });

  it('can be canceled, and does nothing without pasteEditable', async () => {
    const { host, fixture, focus, pasteText } = await setup((h) => h.cancel.set(true));
    await focus('P-2', 'stock');
    expect(await pasteText('5')).toBe(true);
    expect(host.before).toHaveLength(1);
    expect(host.edits).toEqual([]);

    host.paste.set(false);
    await fixture.whenStable();
    expect(await pasteText('5')).toBe(false);
    expect(host.before).toHaveLength(1);
  });

  it('adds a paste to the batch as one undo step', async () => {
    const { host, fixture, focus, pasteText } = await setup((h) => h.batch.set(true));
    await focus('P-2', 'stock');
    await pasteText('11\tA\n12\tB');
    const table = host.table();
    expect(host.edits).toEqual([]);
    expect(table.pendingChanges().updated.map((change) => change.changes)).toEqual([
      { stock: 11, bin: 'A' },
      { stock: 12, bin: 'B' },
    ]);
    table.undo();
    await fixture.whenStable();
    expect(table.pendingChanges().updated).toEqual([]);
  });

  it('emits rowEditSave per row in row edit mode', async () => {
    const { host, focus, pasteText } = await setup((h) => h.editMode.set('row'));
    await focus('P-1', 'stock');
    await pasteText('8\tB');
    expect(host.rowSaves).toEqual([
      { row: PARTS[0], changes: { stock: 8, bin: 'B' }, previous: { stock: 4, bin: 'A' } },
    ]);
  });

  it('counts only changed cells in a batch paste', async () => {
    const { host, focus, pasteText, said } = await setup((h) => h.batch.set(true));
    await focus('P-2', 'stock');
    // Stock 9 stays 9, the bin changes.
    await pasteText('9	C');
    expect(
      host
        .table()
        .pendingChanges()
        .updated.map((change) => change.changes),
    ).toEqual([{ bin: 'C' }]);
    expect(said()).toContain('Pasted 1 cell');
    await pasteText('9	C');
    expect(said()).toContain('Pasted 0 cells');
  });

  it('clears a choice that is not required with an empty value', async () => {
    const { host, focus, pasteText } = await setup();
    await focus('P-3', 'bin');
    await pasteText('	');
    expect(host.edits.map((edit) => `${edit.row.sku}.${edit.field}=${edit.value}`)).toEqual([
      'P-3.bin=',
    ]);
  });

  it('leaves out a cell whose editor is open', async () => {
    const { host, el, fixture, cell, pasteText } = await setup();
    el.querySelector<HTMLElement>(
      'tr[data-row="P-1"] td[data-field="name"] .star-table__edit',
    )!.click();
    await fixture.whenStable();
    const editor = el.querySelector<HTMLInputElement>('.star-table__editor')!;
    expect(editor).not.toBeNull();
    // A paste event on the SKU cell of the same row, while the editor keeps the focus.
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => 'x	Pasted	7' } });
    cell('P-1', 'sku').dispatchEvent(event);
    await fixture.whenStable();
    expect(host.edits.map((edit) => edit.field)).toEqual(['stock']);
    void pasteText;
  });
});
