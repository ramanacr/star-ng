import {
  starEditorDeleteColumn,
  starEditorDeleteRow,
  starEditorInsertColumn,
  starEditorInsertRow,
  starEditorMergeBelow,
  starEditorMergeNext,
  starEditorNewTable,
  starEditorSetColumnWidth,
  starEditorSetTableLook,
  starEditorSiblingCell,
  starEditorSplitCell,
  starEditorTableGrid,
  starEditorTableLook,
  starEditorToggleHeaderRow,
} from './editor-table';

function table(html: string): HTMLTableElement {
  const holder = document.createElement('div');
  holder.innerHTML = html;
  return holder.querySelector('table')!;
}

/** The grid as text: the first letter of each slot's cell. */
function shape(t: HTMLTableElement): string {
  return starEditorTableGrid(t)
    .map((row) => row.map((slot) => slot.cell.textContent!.trim()[0] ?? '_').join(''))
    .join('|');
}

const cell = (t: HTMLTableElement, text: string) =>
  [...t.querySelectorAll<HTMLTableCellElement>('td,th')].find(
    (c) => c.textContent!.trim() === text,
  )!;

describe('table grid', () => {
  it('maps row and column spans', () => {
    const t = table(
      '<table><tbody><tr><td rowspan="2">A</td><td colspan="2">B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
    );
    expect(shape(t)).toBe('ABB|ACD');
  });
});

describe('table commands', () => {
  it('makes a new table with a header row of th scope=col', () => {
    const t = starEditorNewTable(document, 3, 2, true);
    expect(t.outerHTML).toBe(
      '<table class="star-editor-table"><thead><tr><th scope="col"><br></th><th scope="col"><br></th></tr></thead><tbody><tr><td><br></td><td><br></td></tr><tr><td><br></td><td><br></td></tr></tbody></table>',
    );
  });

  it('inserts rows and grows spanning cells', () => {
    const t = table(
      '<table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>',
    );
    starEditorInsertRow(cell(t, 'B'), true);
    expect(cell(t, 'A').rowSpan).toBe(3);
    expect(shape(t)).toBe('AB|A_|AC');
    starEditorInsertRow(cell(t, 'A'), false);
    expect(shape(t)).toBe('__|AB|A_|AC');
  });

  it('deletes rows: a cell that starts in the row moves down', () => {
    const t = table(
      '<table><tbody><tr><td rowspan="2">A</td><td>B</td></tr><tr><td>C</td></tr></tbody></table>',
    );
    expect(starEditorDeleteRow(cell(t, 'B'))).toBe(true);
    expect(shape(t)).toBe('AC');
    expect(cell(t, 'A').rowSpan).toBe(1);
    expect(starEditorDeleteRow(cell(t, 'C'))).toBe(false);
    expect(t.isConnected).toBe(false);
  });

  it('inserts and deletes columns with spans and the colgroup', () => {
    const t = table(
      '<table><colgroup><col><col></colgroup><tbody><tr><td colspan="2">A</td></tr><tr><td>B</td><td>C</td></tr></tbody></table>',
    );
    starEditorInsertColumn(cell(t, 'B'), true);
    expect(shape(t)).toBe('AAA|B_C');
    expect(t.querySelectorAll('col').length).toBe(3);
    starEditorInsertColumn(cell(t, 'B'), false);
    expect(shape(t)).toBe('_AAA|_B_C');
    starEditorDeleteColumn(cell(t, 'C'));
    expect(shape(t)).toBe('_AA|_B_');
    expect(t.querySelectorAll('col').length).toBe(3);
  });

  it('merges with the next cell and the cell below, and splits again', () => {
    const t = table(
      '<table><tbody><tr><td>A</td><td>B</td></tr><tr><td>C</td><td>D</td></tr></tbody></table>',
    );
    expect(starEditorMergeNext(cell(t, 'A'))).toBe(true);
    expect(shape(t)).toBe('AA|CD');
    expect(cell(t, 'AB').colSpan).toBe(2);
    expect(starEditorMergeBelow(cell(t, 'C'))).toBe(false);
    expect(starEditorMergeNext(cell(t, 'C'))).toBe(true);
    expect(starEditorMergeBelow(cell(t, 'AB'))).toBe(true);
    expect(t.rows[0].cells[0].rowSpan).toBe(2);
    expect(starEditorSplitCell(t.rows[0].cells[0])).toBe(true);
    expect(shape(t)).toBe('A_|__');
    expect(starEditorSplitCell(t.rows[0].cells[0])).toBe(false);
  });

  it('toggles the header row', () => {
    const t = table('<table><tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody></table>');
    starEditorToggleHeaderRow(t);
    expect(t.innerHTML).toBe(
      '<thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td>B</td></tr></tbody>',
    );
    starEditorToggleHeaderRow(t);
    expect(t.innerHTML).toBe('<tbody><tr><td>A</td></tr><tr><td>B</td></tr></tbody>');
  });

  it('sets the look, column widths, and finds the next cell', () => {
    const t = table('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
    starEditorSetTableLook(t, { borders: 'rows', align: 'center' });
    expect(t.className).toBe('star-editor-table star-editor-table--rows star-editor-table--center');
    expect(starEditorTableLook(t)).toEqual({ borders: 'rows', align: 'center' });
    expect(starEditorSetColumnWidth(t, 1, 10)).toBe(32);
    expect(t.querySelector('colgroup')!.outerHTML).toBe(
      '<colgroup><col><col style="width: 32px;"></colgroup>',
    );
    expect(starEditorSiblingCell(cell(t, 'A'), 1)).toBe(cell(t, 'B'));
    expect(starEditorSiblingCell(cell(t, 'B'), 1)).toBeNull();
  });
});
