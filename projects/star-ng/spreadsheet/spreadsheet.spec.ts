import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAnnouncer } from '@star-ng/ui/core';
import {
  StarSpreadsheet,
  StarSpreadsheetCells,
  StarSpreadsheetSelection,
  StarSpreadsheetSheet,
} from '@star-ng/ui/spreadsheet';

@Component({
  imports: [StarSpreadsheet],
  template: `<star-spreadsheet
    [(cells)]="cells"
    [rows]="rows()"
    [columns]="8"
    [readonly]="readonly()"
    locale="en-US"
    (selectionChange)="selection = $event"
  />`,
})
class Host {
  readonly sheet = viewChild.required(StarSpreadsheet);
  readonly cells = signal<StarSpreadsheetCells>({
    A1: { value: 1 },
    A2: { value: 2 },
    A3: { value: 3 },
    B1: { formula: '=SUM(A1:A3)' },
    C1: { value: 'Rent' },
  });
  readonly rows = signal(20);
  readonly readonly = signal(false);
  selection: StarSpreadsheetSelection | null = null;
}

@Component({
  imports: [StarSpreadsheet],
  template: `<star-spreadsheet [(sheets)]="sheets" [(activeSheet)]="active" [columns]="4" />`,
})
class SheetsHost {
  readonly sheets = signal<readonly StarSpreadsheetSheet[]>([
    { name: 'Budget', cells: { A1: { formula: '=Data!A1*2' } } },
    { name: 'Data', cells: { A1: { value: 21 } } },
  ]);
  readonly active = signal(0);
}

/** A pointer event (a mouse event where the DOM has no PointerEvent). */
function pointer(type: string, init: MouseEventInit = {}): MouseEvent {
  const Ctor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  return new Ctor(type, init);
}

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

/** A clipboard event with a DataTransfer stand-in (jsdom has no ClipboardEvent data). */
function clipboard(target: Element, type: 'copy' | 'cut' | 'paste', text = ''): string {
  const data = new Map<string, string>([['text/plain', text]]);
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    clipboardData: { setData(t: string, v: string): void; getData(t: string): string };
  };
  Object.defineProperty(event, 'clipboardData', {
    value: {
      setData: (t: string, v: string) => data.set(t, v),
      getData: (t: string) => data.get(t) ?? '',
    },
  });
  target.dispatchEvent(event);
  return data.get('text/plain') ?? '';
}

describe('StarSpreadsheet', () => {
  let announce: ReturnType<typeof vi.fn>;

  async function setup() {
    announce = vi.fn(() => Promise.resolve());
    TestBed.configureTestingModule({
      providers: [{ provide: StarAnnouncer, useValue: { announce, clear: vi.fn() } }],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const grid = el.querySelector<HTMLElement>('[role=grid]')!;
    const cell = (address: string) => {
      const col = address.charCodeAt(0) - 65;
      const row = Number(address.slice(1)) - 1;
      return el.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)!;
    };
    const press = async (k: string, init: KeyboardEventInit = {}) => {
      const target = el.querySelector('.star-spreadsheet__editor') ?? grid;
      const event = key(target, k, init);
      await fixture.whenStable();
      return event;
    };
    return { fixture, el, grid, cell, press, host: fixture.componentInstance };
  }

  it('renders column letters, row numbers and ARIA counts', async () => {
    const { el, grid } = await setup();
    expect(grid.getAttribute('aria-rowcount')).toBe('21');
    expect(grid.getAttribute('aria-colcount')).toBe('9');
    const heads = [...el.querySelectorAll('[role=columnheader]')].map((h) => h.textContent!.trim());
    expect(heads.slice(0, 3)).toEqual(['A', 'B', 'C']);
    const firstRow = el.querySelector('.star-spreadsheet__body [role=row]')!;
    expect(firstRow.getAttribute('aria-rowindex')).toBe('2');
    expect(firstRow.querySelector('[role=rowheader]')!.textContent!.trim()).toBe('1');
    expect(firstRow.querySelector('[role=gridcell]')!.getAttribute('aria-colindex')).toBe('2');
  });

  it('windows the rows and keeps aria-rowindex across the window', async () => {
    const { fixture, el, host } = await setup();
    host.rows.set(5000);
    await fixture.whenStable();
    const rows = el.querySelectorAll('.star-spreadsheet__body [role=row]');
    expect(rows.length).toBeLessThan(60);
    const viewport = el.querySelector<HTMLElement>('.star-spreadsheet__viewport')!;
    viewport.scrollTop = 28 * 1000;
    viewport.dispatchEvent(new Event('scroll'));
    await fixture.whenStable();
    const first = el.querySelector('.star-spreadsheet__body [role=row]')!;
    const index = Number(first.getAttribute('aria-rowindex'));
    expect(index).toBeGreaterThan(990);
    expect(index).toBeLessThan(1002);
    expect(first.querySelector('[role=rowheader]')!.textContent!.trim()).toBe(String(index - 1));
  });

  it('shows computed values and recalculates when the model changes from outside', async () => {
    const { fixture, cell, host } = await setup();
    expect(cell('B1').textContent!.trim()).toBe('6');
    host.cells.update((c) => ({ ...c, A2: { value: 10 } }));
    await fixture.whenStable();
    expect(cell('B1').textContent!.trim()).toBe('14');
    expect(host.sheet().value('B1')).toBe(14);
  });

  it('replaces a cell by typing and commits with Enter, moving down', async () => {
    const { grid, press, host, el } = await setup();
    grid.focus();
    await press('7');
    const editor = el.querySelector<HTMLInputElement>('.star-spreadsheet__editor')!;
    expect(editor.value).toBe('7');
    expect(announce).toHaveBeenCalledWith('Editing A1', 'polite');
    editor.value = '75';
    editor.dispatchEvent(new Event('input'));
    await press('Enter');
    expect(host.cells()['A1']).toEqual({ value: 75 });
    expect(host.selection?.active).toBe('A2');
    expect(el.querySelector('.star-spreadsheet__editor')).toBeNull();
  });

  it('keeps keys typed before the editor has the focus', async () => {
    const { fixture, grid, host } = await setup();
    grid.focus();
    key(grid, '4');
    key(grid, '2');
    key(grid, 'Enter');
    await fixture.whenStable();
    expect(host.cells()['A1']).toEqual({ value: 42 });
  });

  it('edits in place with F2, cancels with Escape, and Tab commits to the right', async () => {
    const { grid, press, host, el } = await setup();
    grid.focus();
    await press('ArrowRight');
    await press('F2');
    const editor = el.querySelector<HTMLInputElement>('.star-spreadsheet__editor')!;
    expect(editor.value).toBe('=SUM(A1:A3)');
    editor.value = '=SUM(A1:A2)';
    editor.dispatchEvent(new Event('input'));
    await press('Escape');
    expect(host.cells()['B1']).toEqual({ formula: '=SUM(A1:A3)' });
    await press('Enter');
    const again = el.querySelector<HTMLInputElement>('.star-spreadsheet__editor')!;
    again.value = '=A1*100';
    again.dispatchEvent(new Event('input'));
    await press('Tab');
    expect(host.cells()['B1']).toEqual({ formula: '=A1*100' });
    expect(host.selection?.active).toBe('C1');
  });

  it('shows the raw formula in the formula bar', async () => {
    const { grid, press, el } = await setup();
    grid.focus();
    await press('ArrowRight');
    const bar = el.querySelector<HTMLInputElement>('.star-spreadsheet__formula')!;
    expect(bar.value).toBe('=SUM(A1:A3)');
    expect(el.querySelector('.star-spreadsheet__name')!.textContent).toBe('B1');
  });

  it('announces the active cell with its address, value and formula', async () => {
    const { grid, press } = await setup();
    grid.focus();
    await press('ArrowRight');
    expect(announce).toHaveBeenLastCalledWith('B1, 6, formula SUM of A1 to A3', 'polite');
    await press('ArrowDown');
    expect(announce).toHaveBeenLastCalledWith('B2, blank', 'polite');
  });

  it('selects a range with Shift and the arrows, and points at the active cell', async () => {
    const { grid, press, el, host } = await setup();
    grid.focus();
    await press('ArrowDown', { shiftKey: true });
    await press('ArrowRight', { shiftKey: true });
    expect(el.querySelectorAll('[role=gridcell][aria-selected=true]')).toHaveLength(4);
    expect(host.selection?.address).toBe('A1:B2');
    expect(host.selection?.active).toBe('A1');
    expect(grid.getAttribute('aria-activedescendant')).toBe(
      el.querySelector('[data-row="0"][data-col="0"]')!.id,
    );
    expect(announce).toHaveBeenLastCalledWith('A1 to B2 selected', 'polite');
  });

  it('clears the selection with Delete and undoes and redoes it', async () => {
    const { grid, press, host } = await setup();
    grid.focus();
    await press('ArrowDown', { shiftKey: true });
    await press('Delete');
    expect(host.cells()['A1']).toBeUndefined();
    expect(host.cells()['A2']).toBeUndefined();
    expect(host.sheet().value('B1')).toBe(3);
    await press('z', { ctrlKey: true });
    expect(host.cells()['A1']).toEqual({ value: 1 });
    await press('y', { ctrlKey: true });
    expect(host.cells()['A1']).toBeUndefined();
  });

  it('copies a range as TSV and pastes TSV from Excel or Google Sheets', async () => {
    const { grid, press, host } = await setup();
    grid.focus();
    await press('ArrowRight', { shiftKey: true });
    await press('ArrowRight', { shiftKey: true });
    expect(clipboard(grid, 'copy')).toBe('1\t6\tRent');

    await press('ArrowDown');
    await press('ArrowDown');
    await press('ArrowDown');
    await press('ArrowDown');
    clipboard(grid, 'paste', 'x\t"a\tb"\r\n3\t=A5*2\r\n');
    expect(host.cells()['A5']).toEqual({ value: 'x' });
    expect(host.cells()['B5']).toEqual({ value: 'a\tb' });
    expect(host.cells()['A6']).toEqual({ value: 3 });
    expect(host.cells()['B6']).toEqual({ formula: '=A5*2' });
    expect(host.selection?.address).toBe('A5:B6');
    expect(announce).toHaveBeenLastCalledWith('Pasted into A5 to B6', 'polite');
  });

  it('pastes its own copy with formulas, moving relative references', async () => {
    const { grid, press, host } = await setup();
    grid.focus();
    await press('ArrowRight');
    const text = clipboard(grid, 'copy');
    await press('ArrowRight');
    clipboard(grid, 'paste', text);
    expect(host.cells()['C1']).toEqual({ formula: '=SUM(B1:B3)' });
  });

  it('cuts a range', async () => {
    const { grid, host } = await setup();
    grid.focus();
    expect(clipboard(grid, 'cut')).toBe('1');
    expect(host.cells()['A1']).toBeUndefined();
  });

  it('fills down with Control+D and moves relative references', async () => {
    const { grid, press, host } = await setup();
    grid.focus();
    await press('ArrowRight');
    await press('ArrowDown', { shiftKey: true });
    await press('ArrowDown', { shiftKey: true });
    await press('d', { ctrlKey: true });
    expect(host.cells()['B2']).toEqual({ formula: '=SUM(A2:A4)' });
    expect(host.cells()['B3']).toEqual({ formula: '=SUM(A3:A5)' });
    expect(host.sheet().value('B2')).toBe(5);
  });

  it('fills with the fill handle', async () => {
    const { fixture, grid, el, host, cell } = await setup();
    grid.focus();
    const handle = el.querySelector('[data-fill]')!;
    handle.dispatchEvent(pointer('pointerdown', { bubbles: true, button: 0 }));
    cell('A3').dispatchEvent(pointer('pointerover', { bubbles: true }));
    await fixture.whenStable();
    expect(el.querySelector('.star-spreadsheet__fill-target')).not.toBeNull();
    document.dispatchEvent(pointer('pointerup'));
    await fixture.whenStable();
    expect(host.cells()['A2']).toEqual({ value: 1 });
    expect(host.cells()['A3']).toEqual({ value: 1 });
    expect(host.selection?.address).toBe('A1:A3');
  });

  it('selects a range by dragging, and a whole column from its header', async () => {
    const { fixture, el, host, cell } = await setup();
    cell('A1').dispatchEvent(pointer('pointerdown', { bubbles: true, button: 0 }));
    cell('B3').dispatchEvent(pointer('pointerover', { bubbles: true }));
    document.dispatchEvent(pointer('pointerup'));
    await fixture.whenStable();
    expect(host.selection?.address).toBe('A1:B3');
    el.querySelector('[data-colhead="2"]')!.dispatchEvent(
      pointer('pointerdown', { bubbles: true, button: 0 }),
    );
    await fixture.whenStable();
    expect(host.selection?.address).toBe('C1:C20');
  });

  it('formats with Control+B and the number format select', async () => {
    const { fixture, grid, press, host, el, cell } = await setup();
    grid.focus();
    await press('b', { ctrlKey: true });
    expect(host.cells()['A1']).toEqual({ value: 1, format: { bold: true } });
    expect(cell('A1').classList).toContain('star-spreadsheet__cell--bold');
    const select = el.querySelector<HTMLSelectElement>('select')!;
    select.value = 'percent';
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(cell('A1').textContent!.trim()).toBe('100%');
    const bold = el.querySelector('[aria-label=Bold]')!;
    expect(bold.getAttribute('aria-pressed')).toBe('true');
  });

  it('exports CSV and JSON and imports CSV', async () => {
    const { fixture, host, cell } = await setup();
    expect(host.sheet().toCsv()).toBe('1,6,Rent\r\n2,,\r\n3,,');
    expect(host.sheet().toCsv({ formulas: true })).toBe('1,=SUM(A1:A3),Rent\r\n2,,\r\n3,,');
    const csv = host.sheet().toCsv({ formulas: true });
    host.sheet().fromCsv('"a, b",2\r\n=B1*3,');
    await fixture.whenStable();
    expect(cell('A2').textContent!.trim()).toBe('6');
    expect(host.cells()['A1']).toEqual({ value: 'a, b' });
    host.sheet().fromCsv(csv);
    await fixture.whenStable();
    expect(host.cells()['B1']).toEqual({ formula: '=SUM(A1:A3)' });
    expect(JSON.parse(host.sheet().toJson()).sheets[0].name).toBe('Sheet1');
  });

  it('escapes text that starts like a formula in CSV (formula injection)', async () => {
    const { fixture, host } = await setup();
    host.cells.set({
      A1: { value: '=HYPERLINK("x")' },
      B1: { value: '@cmd' },
      C1: { value: -5 },
      D1: { formula: '=C1*2' },
      E1: { value: '+1 note' },
    });
    await fixture.whenStable();
    expect(host.sheet().toCsv()).toBe(`"'=HYPERLINK(""x"")",'@cmd,-5,-10,'+1 note`);
    expect(host.sheet().toCsv({ formulas: true })).toBe(
      `"'=HYPERLINK(""x"")",'@cmd,-5,=C1*2,'+1 note`,
    );
    expect(host.sheet().toCsv({ escapeFormulas: false })).toBe(
      `"=HYPERLINK(""x"")",@cmd,-5,-10,+1 note`,
    );
    // The apostrophe reads back as text.
    host.sheet().fromCsv(host.sheet().toCsv({ formulas: true }));
    await fixture.whenStable();
    expect(host.cells()['A1']).toEqual({ value: '=HYPERLINK("x")' });
    expect(host.cells()['D1']).toEqual({ formula: '=C1*2' });
  });

  it('does not edit when read-only', async () => {
    const { fixture, grid, press, el, host } = await setup();
    host.readonly.set(true);
    await fixture.whenStable();
    grid.focus();
    await press('9');
    expect(el.querySelector('.star-spreadsheet__editor')).toBeNull();
    expect(grid.getAttribute('aria-readonly')).toBe('true');
    expect(el.querySelector('star-toolbar')).toBeNull();
  });
});

describe('StarSpreadsheet sheets', () => {
  it('reads other sheets and switches with the tabs', async () => {
    const fixture = TestBed.createComponent(SheetsHost);
    await fixture.whenStable();
    const el: HTMLElement = fixture.nativeElement;
    const a1 = () => el.querySelector('[data-row="0"][data-col="0"]')!.textContent!.trim();
    expect(a1()).toBe('42');
    const tabs = el.querySelectorAll<HTMLElement>('[role=tab]');
    expect(tabs).toHaveLength(2);
    expect(el.querySelector('[role=tabpanel]')!.getAttribute('aria-labelledby')).toBe(tabs[0].id);
    tabs[1].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.active()).toBe(1);
    expect(a1()).toBe('21');
    key(tabs[1], 'ArrowLeft');
    await fixture.whenStable();
    expect(fixture.componentInstance.active()).toBe(0);
  });

  it('writes edits into the sheets model', async () => {
    const fixture = TestBed.createComponent(SheetsHost);
    fixture.componentInstance.active.set(1);
    await fixture.whenStable();
    const grid = fixture.nativeElement.querySelector('[role=grid]') as HTMLElement;
    grid.focus();
    key(grid, '5');
    await fixture.whenStable();
    key(fixture.nativeElement.querySelector('.star-spreadsheet__editor'), 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.sheets()[1].cells['A1']).toEqual({ value: 5 });
    fixture.componentInstance.active.set(0);
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('[data-row="0"][data-col="0"]').textContent.trim(),
    ).toBe('10');
  });
});

describe('StarSpreadsheet on the server', () => {
  it('renders the grid without browser APIs', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=grid]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('[role=gridcell]').length).toBeGreaterThan(0);
  });
});
