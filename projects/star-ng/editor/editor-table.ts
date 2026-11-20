/**
 * Tables of `star-editor`: the cell grid with row and column spans, and the table commands. The
 * table maths follows the table engine of Aurora RTE (MIT, same owner,
 * https://github.com/ramanacr/aurora-rte, `tables.ts`), on the DOM instead of a document model.
 * A header row is a `thead` row of `th scope="col"` cells.
 */

/** Class of a table that the editor made. Border and alignment classes go with it. */
export const STAR_EDITOR_TABLE_CLASS = 'star-editor-table';

export type StarEditorTableBorders = 'all' | 'rows' | 'none';
export type StarEditorTableAlign = 'start' | 'center' | 'end';

/** One slot of the grid: the cell that covers it and the place of that cell (its origin). */
export interface StarEditorTableSlot {
  readonly cell: HTMLTableCellElement;
  readonly row: number;
  readonly col: number;
}

/** The grid of a table: `grid[row][col]` is the slot; rows in the order of `table.rows`. */
export function starEditorTableGrid(table: HTMLTableElement): StarEditorTableSlot[][] {
  const grid: StarEditorTableSlot[][] = [];
  [...table.rows].forEach((tr, r) => {
    grid[r] ??= [];
    let c = 0;
    for (const cell of tr.cells) {
      while (grid[r][c]) c++;
      const rows = Math.max(1, cell.rowSpan || 1);
      const cols = Math.max(1, cell.colSpan || 1);
      for (let dr = 0; dr < rows && r + dr < table.rows.length; dr++)
        for (let dc = 0; dc < cols; dc++) {
          grid[r + dr] ??= [];
          grid[r + dr][c + dc] = { cell, row: r, col: c };
        }
      c += cols;
    }
  });
  return grid;
}

/** The place (origin) of `cell` in the grid. */
export function starEditorCellPlace(
  grid: readonly StarEditorTableSlot[][],
  cell: HTMLTableCellElement,
): { row: number; col: number } {
  for (const row of grid) for (const slot of row) if (slot?.cell === cell) return slot;
  return { row: 0, col: 0 };
}

function newCell(doc: Document, header: boolean): HTMLTableCellElement {
  const cell = doc.createElement(header ? 'th' : 'td');
  if (header) cell.setAttribute('scope', 'col');
  cell.appendChild(doc.createElement('br'));
  return cell;
}

const isHeaderRow = (tr: HTMLTableRowElement) => tr.parentElement?.tagName === 'THEAD';

/** Puts `cell` in `tr` before the first cell of that row whose place is after `col`. */
function placeCell(
  table: HTMLTableElement,
  tr: HTMLTableRowElement,
  cell: HTMLTableCellElement,
  col: number,
): void {
  const grid = starEditorTableGrid(table);
  const next = [...tr.cells].find((other) => starEditorCellPlace(grid, other).col >= col);
  tr.insertBefore(cell, next ?? null);
}

/** A new table: `rows` × `cols`, the first row a header row with `header`. */
export function starEditorNewTable(
  doc: Document,
  rows: number,
  cols: number,
  header: boolean,
): HTMLTableElement {
  const table = doc.createElement('table');
  table.className = STAR_EDITOR_TABLE_CLASS;
  const make = (section: HTMLTableSectionElement, count: number, th: boolean) => {
    for (let r = 0; r < count; r++) {
      const tr = doc.createElement('tr');
      for (let c = 0; c < cols; c++) tr.appendChild(newCell(doc, th));
      section.appendChild(tr);
    }
  };
  if (header) make(table.appendChild(doc.createElement('thead')), 1, true);
  make(table.appendChild(doc.createElement('tbody')), Math.max(1, header ? rows - 1 : rows), false);
  return table;
}

/** Inserts a row above or below the row of `cell`. Spanning cells grow. */
export function starEditorInsertRow(
  cell: HTMLTableCellElement,
  below: boolean,
): HTMLTableRowElement {
  const table = cell.closest('table')!;
  const grid = starEditorTableGrid(table);
  const place = starEditorCellPlace(grid, cell);
  const r = below ? place.row + Math.max(1, cell.rowSpan) - 1 : place.row;
  const anchor = table.rows[r];
  const doc = table.ownerDocument;
  const tr = doc.createElement('tr');
  const grown = new Set<HTMLTableCellElement>();
  const header = isHeaderRow(anchor) && !below;
  for (let c = 0; c < grid[r].length; c++) {
    const slot = grid[r][c];
    const spansOver = below ? slot.row + Math.max(1, slot.cell.rowSpan) - 1 > r : slot.row < r;
    if (spansOver) {
      if (!grown.has(slot.cell)) {
        slot.cell.rowSpan = Math.max(1, slot.cell.rowSpan) + 1;
        grown.add(slot.cell);
      }
      c += Math.max(1, slot.cell.colSpan) - 1;
    } else tr.appendChild(newCell(doc, header));
  }
  if (below) anchor.after(tr);
  else anchor.before(tr);
  return tr;
}

/** Deletes the row of `cell`. Cells that span into other rows shrink. False when the table is gone. */
export function starEditorDeleteRow(cell: HTMLTableCellElement): boolean {
  const table = cell.closest('table')!;
  const grid = starEditorTableGrid(table);
  const r = starEditorCellPlace(grid, cell).row;
  const tr = table.rows[r];
  const done = new Set<HTMLTableCellElement>();
  for (const slot of grid[r]) {
    if (done.has(slot.cell)) continue;
    done.add(slot.cell);
    const span = Math.max(1, slot.cell.rowSpan);
    if (span === 1) continue;
    slot.cell.rowSpan = span - 1;
    if (slot.row === r) {
      // The cell starts in this row: it moves down to the next row.
      const next = table.rows[r + 1];
      next.insertBefore(
        slot.cell,
        [...next.cells].find((other) => starEditorCellPlace(grid, other).col > slot.col) ?? null,
      );
    }
  }
  tr.remove();
  return dropEmpty(table);
}

/** Removes empty sections, and the table when it has no rows. False when the table is gone. */
function dropEmpty(table: HTMLTableElement): boolean {
  for (const tr of [...table.rows]) if (!tr.cells.length) tr.remove();
  for (const section of [...table.tBodies, table.tHead, table.tFoot])
    if (section && !section.rows.length) section.remove();
  if (!table.rows.length) {
    table.remove();
    return false;
  }
  return true;
}

/**
 * Inserts a column before or after the column of `cell`. Each row gets one new cell at the
 * logical column of the span-aware grid; only a cell that the new column cuts through (the new
 * column is inside its column span) grows instead.
 */
export function starEditorInsertColumn(cell: HTMLTableCellElement, after: boolean): void {
  const table = cell.closest('table')!;
  const grid = starEditorTableGrid(table);
  const place = starEditorCellPlace(grid, cell);
  // The new column takes this logical index.
  const target = after ? place.col + Math.max(1, cell.colSpan) : place.col;
  const doc = table.ownerDocument;
  const grown = new Set<HTMLTableCellElement>();
  grid.forEach((row, r) => {
    const inside = row[target];
    if (inside && inside.col < target) {
      // The new column cuts through this cell: it grows (once, for all its rows).
      if (!grown.has(inside.cell)) {
        inside.cell.colSpan = Math.max(1, inside.cell.colSpan) + 1;
        grown.add(inside.cell);
      }
      return;
    }
    const tr = table.rows[r];
    const fresh = newCell(doc, isHeaderRow(tr));
    // Before the first cell of this row (by the grid before the change) at or after the target.
    const next = [...tr.cells].find((other) => starEditorCellPlace(grid, other).col >= target);
    tr.insertBefore(fresh, next ?? null);
  });
  const c = after ? target - 1 : target;
  const colgroup = table.querySelector(':scope > colgroup');
  if (colgroup) {
    const cols = colgroup.querySelectorAll('col');
    const col = doc.createElement('col');
    const at = cols[c];
    if (at && after) at.after(col);
    else if (at) at.before(col);
    else colgroup.appendChild(col);
  }
}

/** Deletes the column of `cell`. Cells that span into other columns shrink. False when the table is gone. */
export function starEditorDeleteColumn(cell: HTMLTableCellElement): boolean {
  const table = cell.closest('table')!;
  const grid = starEditorTableGrid(table);
  const c = starEditorCellPlace(grid, cell).col;
  const done = new Set<HTMLTableCellElement>();
  for (const row of grid) {
    const slot = row[c];
    if (!slot || done.has(slot.cell)) continue;
    done.add(slot.cell);
    const span = Math.max(1, slot.cell.colSpan);
    if (span > 1) slot.cell.colSpan = span - 1;
    else slot.cell.remove();
  }
  table.querySelector(':scope > colgroup')?.querySelectorAll('col')[c]?.remove();
  return dropEmpty(table);
}

/** Moves the content of `from` to the end of `into` (empty content is left out). */
function moveContent(from: HTMLTableCellElement, into: HTMLTableCellElement): void {
  if (!from.textContent?.trim() && !from.querySelector('img,table,iframe')) return;
  if (!into.textContent?.trim() && !into.querySelector('img,table,iframe')) into.replaceChildren();
  else into.appendChild(into.ownerDocument.createElement('br'));
  while (from.firstChild) into.appendChild(from.firstChild);
}

/** Merges `cell` with the cell after it (same rows). False when they do not line up. */
export function starEditorMergeNext(cell: HTMLTableCellElement): boolean {
  const table = cell.closest('table')!;
  const grid = starEditorTableGrid(table);
  const place = starEditorCellPlace(grid, cell);
  const next = grid[place.row][place.col + Math.max(1, cell.colSpan)];
  if (
    !next ||
    next.row !== place.row ||
    Math.max(1, next.cell.rowSpan) !== Math.max(1, cell.rowSpan)
  )
    return false;
  moveContent(next.cell, cell);
  cell.colSpan = Math.max(1, cell.colSpan) + Math.max(1, next.cell.colSpan);
  next.cell.remove();
  return true;
}

/** Merges `cell` with the cell below it (same columns). False when they do not line up. */
export function starEditorMergeBelow(cell: HTMLTableCellElement): boolean {
  const table = cell.closest('table')!;
  const grid = starEditorTableGrid(table);
  const place = starEditorCellPlace(grid, cell);
  const below = grid[place.row + Math.max(1, cell.rowSpan)]?.[place.col];
  if (
    !below ||
    below.col !== place.col ||
    Math.max(1, below.cell.colSpan) !== Math.max(1, cell.colSpan)
  )
    return false;
  if (isHeaderRow(table.rows[below.row]) !== isHeaderRow(table.rows[place.row])) return false;
  moveContent(below.cell, cell);
  cell.rowSpan = Math.max(1, cell.rowSpan) + Math.max(1, below.cell.rowSpan);
  // A row that is now empty stays: the merged cell spans it.
  below.cell.remove();
  return true;
}

/** Splits a merged cell back into single cells. False when it is not merged. */
export function starEditorSplitCell(cell: HTMLTableCellElement): boolean {
  const rows = Math.max(1, cell.rowSpan);
  const cols = Math.max(1, cell.colSpan);
  if (rows === 1 && cols === 1) return false;
  const table = cell.closest('table')!;
  const place = starEditorCellPlace(starEditorTableGrid(table), cell);
  cell.rowSpan = 1;
  cell.colSpan = 1;
  cell.removeAttribute('rowspan');
  cell.removeAttribute('colspan');
  const doc = table.ownerDocument;
  for (let r = place.row; r < place.row + rows; r++) {
    const tr = table.rows[r];
    if (!tr) break;
    for (let c = place.col; c < place.col + cols; c++) {
      if (r === place.row && c === place.col) continue;
      placeCell(table, tr, newCell(doc, cell.tagName === 'TH'), c);
    }
  }
  return true;
}

/** Turns the first row into a header row (`thead`, `th scope="col"`), or back. */
export function starEditorToggleHeaderRow(table: HTMLTableElement): void {
  const doc = table.ownerDocument;
  const rename = (cell: HTMLTableCellElement, tag: 'th' | 'td') => {
    const next = doc.createElement(tag);
    for (const attribute of [...cell.attributes])
      if (attribute.name !== 'scope') next.setAttribute(attribute.name, attribute.value);
    if (tag === 'th') next.setAttribute('scope', 'col');
    while (cell.firstChild) next.appendChild(cell.firstChild);
    cell.replaceWith(next);
  };
  if (table.tHead) {
    const body = table.tBodies[0] ?? table.appendChild(doc.createElement('tbody'));
    for (const tr of [...table.tHead.rows].reverse()) {
      for (const cell of [...tr.cells]) rename(cell, 'td');
      body.insertBefore(tr, body.firstChild);
    }
    table.tHead.remove();
    return;
  }
  const first = table.rows[0];
  if (!first) return;
  const head = doc.createElement('thead');
  table.insertBefore(head, table.tBodies[0] ?? null);
  head.appendChild(first);
  for (const cell of [...first.cells]) rename(cell, 'th');
  dropEmpty(table);
}

/** The border style and alignment of a table, from its classes. */
export function starEditorTableLook(table: HTMLTableElement): {
  borders: StarEditorTableBorders;
  align: StarEditorTableAlign;
} {
  const has = (name: string) => table.classList.contains(`${STAR_EDITOR_TABLE_CLASS}--${name}`);
  return {
    borders: has('rows') ? 'rows' : has('borderless') ? 'none' : 'all',
    align: has('center') ? 'center' : has('end') ? 'end' : 'start',
  };
}

/** Sets the border style and alignment of a table, as classes. */
export function starEditorSetTableLook(
  table: HTMLTableElement,
  look: { borders: StarEditorTableBorders; align: StarEditorTableAlign },
): void {
  const prefix = `${STAR_EDITOR_TABLE_CLASS}--`;
  for (const name of ['rows', 'borderless', 'center', 'end']) table.classList.remove(prefix + name);
  table.classList.add(STAR_EDITOR_TABLE_CLASS);
  if (look.borders === 'rows') table.classList.add(`${prefix}rows`);
  if (look.borders === 'none') table.classList.add(`${prefix}borderless`);
  if (look.align !== 'start') table.classList.add(prefix + look.align);
}

/** The width of a column in pixels from the `colgroup` (0 when it has none). */
export function starEditorColumnWidth(table: HTMLTableElement, col: number): number {
  const value = table.querySelector(':scope > colgroup')?.querySelectorAll('col')[col]?.style.width;
  return value?.endsWith('px') ? Number.parseFloat(value) : 0;
}

/**
 * Sets the width of a column in pixels (at least 32), in a `colgroup` that the editor adds when
 * the table has none. `current` is the measured width of the column when it has no width yet.
 */
export function starEditorSetColumnWidth(
  table: HTMLTableElement,
  col: number,
  width: number,
): number {
  const doc = table.ownerDocument;
  const count = starEditorTableGrid(table)[0]?.length ?? 0;
  let colgroup = table.querySelector<HTMLTableColElement>(':scope > colgroup');
  if (!colgroup) {
    colgroup = doc.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }
  while (colgroup.querySelectorAll('col').length < count)
    colgroup.appendChild(doc.createElement('col'));
  const value = Math.max(32, Math.round(width));
  colgroup.querySelectorAll('col')[col]?.style.setProperty('width', `${value}px`);
  return value;
}

/** The cell after (`1`) or before (`-1`) `cell` in reading order, or `null` at the end. */
export function starEditorSiblingCell(
  cell: HTMLTableCellElement,
  delta: 1 | -1,
): HTMLTableCellElement | null {
  const table = cell.closest('table')!;
  const cells = [...table.rows].flatMap((tr) => [...tr.cells]);
  return cells[cells.indexOf(cell) + delta] ?? null;
}
