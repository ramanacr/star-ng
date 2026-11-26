import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarColumn, StarTable } from './table';
import { StarRowPins } from './table-row-pins';
import {
  starRowClasses,
  StarTableRowClassFn,
  StarTableRowTone,
  StarTableRowToneFn,
} from './table-row-tone';

interface Login {
  id: number;
  ip: string;
  status: 'Success' | 'Failed' | 'Withdrawn';
}

const LOGINS: Login[] = [
  { id: 1, ip: '192.0.2.10', status: 'Success' },
  { id: 2, ip: '192.0.2.43', status: 'Failed' },
  { id: 3, ip: '192.0.2.77', status: 'Withdrawn' },
];

@Component({
  imports: [StarTable],
  template: `<star-table
    [value]="rows"
    [columns]="columns"
    dataKey="id"
    striped
    selectionMode="multiple"
    [(selection)]="selection"
    [pinnedRows]="pins()"
    [rowClass]="rowClass()"
    [rowTone]="rowTone()"
  />`,
})
class ToneHost {
  readonly rows = LOGINS;
  readonly columns: StarColumn<Login>[] = [
    { field: 'ip', header: 'IP address', frozen: true },
    { field: 'status', header: 'Status' },
    { field: 'id', header: 'Id', pinned: 'end' },
  ];
  readonly selection = signal<readonly Login[]>([]);
  readonly pins = signal<StarRowPins>({});
  readonly rowClass = signal<StarTableRowClassFn<Login> | null>(null);
  readonly rowTone = signal<StarTableRowToneFn<Login> | null>(null);
}

const toneOf = (row: Login): StarTableRowTone | null =>
  row.status === 'Failed' ? 'danger' : row.status === 'Withdrawn' ? 'muted' : null;

describe('StarTable row classes and row tones', () => {
  async function setup() {
    const fixture = TestBed.createComponent(ToneHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const row = (id: number) =>
      [...el.querySelectorAll<HTMLElement>('tbody tr.star-table__row')].find((tr) =>
        tr.textContent!.includes(LOGINS[id - 1].ip),
      )!;
    const update = async () => {
      fixture.detectChanges();
      await fixture.whenStable();
    };
    return { fixture, el, host: fixture.componentInstance, row, update };
  }

  it('leaves the row classes unchanged without the inputs', async () => {
    const { el } = await setup();
    const rows = [...el.querySelectorAll<HTMLElement>('tbody tr.star-table__row')];
    expect(rows.length).toBe(3);
    expect(rows[0].className).toBe('star-table__row');
    expect(rows[1].className).toBe('star-table__row star-table__row--alt');
    expect(el.querySelector('[class*="--tone"]')).toBeNull();
  });

  it('adds a string, a list or a record of classes', async () => {
    const { host, row, update } = await setup();
    host.rowClass.set((item) => (item.status === 'Failed' ? 'failed audit-row' : null));
    await update();
    expect(row(2).classList).toContain('failed');
    expect(row(2).classList).toContain('audit-row');
    expect(row(1).className).toBe('star-table__row');

    host.rowClass.set((item) => ['by-list', `status-${item.status.toLowerCase()}`]);
    await update();
    expect(row(2).classList).toContain('by-list');
    expect(row(2).classList).toContain('status-failed');
    expect(row(2).classList).not.toContain('failed');

    host.rowClass.set((item) => ({ withdrawn: item.status === 'Withdrawn', never: false }));
    await update();
    expect(row(3).classList).toContain('withdrawn');
    expect(row(3).classList).not.toContain('never');
    expect(row(2).classList).not.toContain('by-list');
  });

  it('passes the position in the shown rows, -1 for a pinned row', async () => {
    const { host, row, update } = await setup();
    const seen = new Map<number, number>();
    host.rowClass.set((item, index) => {
      seen.set(item.id, index);
      return null;
    });
    host.pins.set({ top: [3] });
    await update();
    expect(seen.get(1)).toBe(0);
    expect(seen.get(2)).toBe(1);
    expect(seen.get(3)).toBe(-1);
    expect(row(3).classList).toContain('star-table__row--pinned');
  });

  it('keeps the classes of the table (striped, selected) next to the consumer classes', async () => {
    const { host, row, update } = await setup();
    host.rowClass.set(() => 'mine');
    host.selection.set([LOGINS[1]]);
    await update();
    const failed = row(2);
    expect(failed.classList).toContain('star-table__row');
    expect(failed.classList).toContain('star-table__row--alt');
    expect(failed.classList).toContain('star-table__row--selected');
    expect(failed.classList).toContain('mine');
    expect(failed.getAttribute('aria-selected')).toBe('true');

    // The selection changes after the consumer classes are set: both stay.
    host.selection.set([]);
    await update();
    expect(row(2).classList).not.toContain('star-table__row--selected');
    expect(row(2).classList).toContain('mine');
    expect(row(2).classList).toContain('star-table__row--alt');
  });

  it('adds the tone classes from rowTone and removes them when the tone goes', async () => {
    const { host, row, update } = await setup();
    host.rowTone.set(toneOf);
    await update();
    expect(row(2).classList).toContain('star-table__row--tone');
    expect(row(2).classList).toContain('star-table__row--tone-danger');
    expect(row(3).classList).toContain('star-table__row--tone-muted');
    expect(row(1).className).toBe('star-table__row');

    host.rowTone.set(null);
    await update();
    expect(row(2).classList).not.toContain('star-table__row--tone');
    expect(row(2).className).toBe('star-table__row star-table__row--alt');
  });

  it('combines rowTone and rowClass on one row', async () => {
    const { host, row, update } = await setup();
    host.rowTone.set(toneOf);
    host.rowClass.set((item) => ({ flagged: item.status === 'Failed' }));
    await update();
    expect(row(2).classList).toContain('star-table__row--tone-danger');
    expect(row(2).classList).toContain('flagged');
  });

  it('tones a pinned row and keeps the pinned cells in the toned row', async () => {
    const { host, row, update } = await setup();
    host.rowTone.set(toneOf);
    host.pins.set({ top: [2] });
    await update();
    const failed = row(2);
    expect(failed.closest('tbody')!.classList).toContain('star-table__pinned--top');
    expect(failed.classList).toContain('star-table__row--tone-danger');
    // The frozen and end-pinned cells are children of the toned row; the tone rules fill them.
    expect(failed.querySelector(':scope > td.star-table__cell--frozen')).not.toBeNull();
    expect(failed.querySelector(':scope > td.star-table__cell--pinned-end')).not.toBeNull();
  });

  it('does not change the keyboard or the accessibility attributes', async () => {
    const { host, row, update } = await setup();
    const before = [...row(2).attributes]
      .filter((attr) => attr.name !== 'class')
      .map((attr) => `${attr.name}=${attr.value}`);
    host.rowTone.set(toneOf);
    host.rowClass.set(() => 'mine');
    await update();
    const after = [...row(2).attributes]
      .filter((attr) => attr.name !== 'class')
      .map((attr) => `${attr.name}=${attr.value}`);
    expect(after).toEqual(before);
  });
});

describe('starRowClasses', () => {
  it('is null without a tone and without classes', () => {
    expect(starRowClasses(null, null)).toBeNull();
    expect(starRowClasses(undefined, '')).toBeNull();
    expect(starRowClasses(null, [])).toBeNull();
    expect(starRowClasses(null, { a: false })).toBeNull();
  });

  it('splits strings, flattens lists and keeps the true keys of a record', () => {
    expect(starRowClasses(null, '  a  b ')).toEqual(['a', 'b']);
    expect(starRowClasses(null, ['a b', 'c'])).toEqual(['a', 'b', 'c']);
    expect(starRowClasses(null, { a: true, b: false })).toEqual(['a']);
  });

  it('puts the tone classes first and ignores an unknown tone', () => {
    expect(starRowClasses('warn', 'x')).toEqual([
      'star-table__row--tone',
      'star-table__row--tone-warn',
      'x',
    ]);
    expect(starRowClasses('loud' as StarTableRowTone, null)).toBeNull();
  });
});
