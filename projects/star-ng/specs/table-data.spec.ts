import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCellTemplate, StarColumn, StarTable } from '@star-ng/ui/table';

interface Row {
  id: number;
  name: string;
  score: number;
}

const ROWS: Row[] = Array.from({ length: 23 }, (_, i) => ({
  id: i + 1,
  name: `Item ${String.fromCharCode(65 + (i % 26))}${i}`,
  score: (i * 7) % 10,
}));

@Component({
  imports: [StarTable, StarCellTemplate],
  template: `
    <star-table
      [value]="rows"
      [columns]="columns"
      dataKey="id"
      selectionMode="multiple"
      [(selection)]="selection"
      [globalFilter]="filter()"
      paginator
      [rows]="5"
    >
      <ng-template starCell="score" [starCellOf]="rows" let-row>★{{ row.score }}</ng-template>
    </star-table>
  `,
})
class TableHost {
  readonly rows = ROWS;
  readonly columns: StarColumn<Row>[] = [
    { field: 'name', header: 'Name', sortable: true },
    { field: 'score', header: 'Score', sortable: true },
  ];
  readonly selection = signal<readonly Row[]>([]);
  readonly filter = signal('');
}

describe('StarTable', () => {
  async function setup() {
    const fixture = TestBed.createComponent(TableHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const bodyRows = () => [...el.querySelectorAll('tbody tr')];
    const firstCells = () =>
      bodyRows().map((r) => r.querySelectorAll('td')[1]?.textContent?.trim());
    return { fixture, el, bodyRows, firstCells };
  }

  it('paginates rows client side and renders custom cells', async () => {
    const { el, bodyRows } = await setup();
    expect(bodyRows().length).toBe(5);
    expect(el.querySelector('tbody tr td:nth-child(3)')?.textContent?.trim()).toMatch(/^★\d$/);
  });

  it('sorts by a column and toggles the order', async () => {
    const { fixture, el } = await setup();
    const scoreHeader = el.querySelectorAll('th')[2];
    scoreHeader.querySelector('button')!.click();
    await fixture.whenStable();
    expect(scoreHeader.getAttribute('aria-sort')).toBe('ascending');
    const scores = () =>
      [...el.querySelectorAll('tbody tr td:nth-child(3)')].map((c) => c.textContent?.trim());
    expect(scores()[0]).toBe('★0');
    scoreHeader.querySelector('button')!.click();
    await fixture.whenStable();
    expect(scoreHeader.getAttribute('aria-sort')).toBe('descending');
    expect(scores()[0]).toBe('★9');
  });

  it('filters with the global filter and shows the empty state', async () => {
    const { fixture, firstCells, el } = await setup();
    fixture.componentInstance.filter.set('item c2');
    await fixture.whenStable();
    expect(firstCells()).toEqual(['Item C2']);
    fixture.componentInstance.filter.set('nothing matches');
    await fixture.whenStable();
    expect(el.querySelector('.star-table__empty')?.textContent).toContain('No records found');
  });

  it('selects rows and the header checkbox selects the page', async () => {
    const { fixture, el } = await setup();
    const rowBoxes = () => [...el.querySelectorAll<HTMLInputElement>('tbody input[type=checkbox]')];
    rowBoxes()[0].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selection().map((r) => r.id)).toEqual([1]);
    const header = el.querySelector<HTMLInputElement>('thead input[type=checkbox]')!;
    expect(header.indeterminate).toBe(true);
    header.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.selection().map((r) => r.id)).toEqual([1, 2, 3, 4, 5]);
  });
});
