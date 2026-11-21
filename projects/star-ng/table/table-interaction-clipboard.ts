import { OutputEmitterRef } from '@angular/core';
import type { StarClipboard, StarUiText } from '@star-ng/ui/core';
import type { StarCellEditEvent, StarColumn } from './table';
import { parseTsv, StarTablePasteCell, StarTablePasteEvent, toTsv } from './table-clipboard';
import {
  parseEditorText,
  sameEditValue,
  StarCellChange,
  starCellError,
  StarEditBatch,
  StarRowEditSaveEvent,
} from './table-editing';
import { OWN_KEYS, StarTableCellRef } from './table-navigation';

/** The table parts that copy and paste read and call. Functions, so the table gives them lazily. */
export interface StarTableClipboardHost<T> {
  readonly clipboard: StarClipboard;
  readonly document: Document;
  readonly text: () => StarUiText;
  readonly copyHeaders: () => boolean;
  readonly beforePaste: OutputEmitterRef<StarTablePasteEvent<T>>;
  readonly cellEdit: () => OutputEmitterRef<StarCellEditEvent<T>>;
  readonly rowEditSave: () => OutputEmitterRef<StarRowEditSaveEvent<T>>;
  readonly body: () => HTMLElement | undefined;
  readonly cellSelectionMode: () => 'cell' | 'range' | null;
  readonly cellSelection: () => readonly StarTableCellRef[];
  readonly rowSelectionMode: () => 'single' | 'multiple' | null;
  readonly selection: () => readonly T[];
  /** Selected column fields with `selectionMode="column"`, else empty. */
  readonly columnFields: () => readonly string[];
  readonly active: () => StarTableCellRef | null;
  /** Rows that the keys move between (page rows outside closed groups). */
  readonly navRows: () => readonly T[];
  /** Rows of all pages in display order. */
  readonly withAdded: () => readonly T[];
  readonly visibleColumns: () => readonly StarColumn<T>[];
  /** Row keys that have selected cells. */
  readonly hasSelectedCells: (row: T) => boolean;
  readonly isCellSelected: (row: T, column: StarColumn<T>) => boolean;
  readonly isSelected: (row: T) => boolean;
  readonly trackKey: (row: T) => unknown;
  readonly cellText: (row: T, column: StarColumn<T>) => string;
  readonly isRowInEdit: (row: T) => boolean;
  readonly isEditable: (row: T, column: StarColumn<T>) => boolean;
  readonly isEditing: (row: T, column: StarColumn<T>) => boolean;
  readonly rawValue: (row: T, column: StarColumn<T>) => unknown;
  readonly batchEdit: () => boolean;
  readonly batch: () => StarEditBatch<T>;
  readonly rowEditMode: () => boolean;
  readonly announce: (message: string) => void;
}

/** The rows, columns and cells that a copy takes. */
interface CopyBlock<T> {
  readonly rows: readonly T[];
  readonly columns: readonly StarColumn<T>[];
  readonly has: (row: T, column: StarColumn<T>) => boolean;
  readonly count: number;
}

/** A cell of the table and its column, as the context menu copy gives it. */
type CellOf<T> = { readonly row: T; readonly column: StarColumn<T> } | null;

type PasteCell<T> = StarTablePasteCell<T> & { readonly column: StarColumn<T> };

/**
 * Copy (Ctrl+C, `copyToClipboard`, the Copy menu items) and paste (Ctrl+V with `pasteEditable`)
 * of `star-table`. `StarTableInteraction` owns one and delegates to it. Internal.
 */
export class StarTableClipboardActions<T> {
  constructor(private readonly host: StarTableClipboardHost<T>) {}

  /**
   * Copies the cell selection, else the selected rows, else `cell` (the menu cell), else the active
   * cell, as TSV; announces the result. Resolves with the number of copied cells.
   */
  async copy(headers: boolean | undefined, cell: CellOf<T>): Promise<number> {
    const host = this.host;
    const block = this.block(cell);
    if (!block) return 0;
    const lines = block.rows.map((row) =>
      block.columns.map((column) => (block.has(row, column) ? this.copyText(row, column) : '')),
    );
    if (headers ?? host.copyHeaders()) {
      lines.unshift(block.columns.map((column) => column.header));
    }
    const done = await host.clipboard.copy(toTsv(lines));
    const text = host.text();
    host.announce(done ? text.copiedCells(block.count) : text.copyFailed);
    return done ? block.count : 0;
  }

  /** The rows, columns and cells that a copy takes (see `copyToClipboard`), or `null`. */
  private block(cell: CellOf<T> = null): CopyBlock<T> | null {
    const host = this.host;
    const columns = host.visibleColumns();
    const fields = new Set(host.columnFields());
    if (fields.size) {
      // Column selection: every filtered row (all pages, in sort order) of the selected
      // visible columns, in display order.
      const picked = columns.filter((column) => fields.has(column.field));
      const rows = host.withAdded();
      if (picked.length && rows.length) {
        return { rows, columns: picked, has: () => true, count: rows.length * picked.length };
      }
    }
    if (host.cellSelectionMode() && host.cellSelection().length) {
      const rows = host.navRows();
      const rowIndexes = rows.flatMap((row, i) => (host.hasSelectedCells(row) ? [i] : []));
      const fields = new Set(host.cellSelection().map((item) => item.field));
      const colIndexes = columns.flatMap((column, i) => (fields.has(column.field) ? [i] : []));
      if (rowIndexes.length && colIndexes.length) {
        const blockRows = rows.slice(rowIndexes[0], rowIndexes[rowIndexes.length - 1] + 1);
        const blockColumns = columns.slice(colIndexes[0], colIndexes[colIndexes.length - 1] + 1);
        const has = (row: T, column: StarColumn<T>) => host.isCellSelected(row, column);
        let count = 0;
        for (const row of blockRows)
          for (const column of blockColumns) if (has(row, column)) count++;
        return { rows: blockRows, columns: blockColumns, has, count };
      }
    }
    if (host.rowSelectionMode() && host.selection().length) {
      const rows = host.withAdded().filter((row) => host.isSelected(row));
      if (rows.length && columns.length) {
        return { rows, columns, has: () => true, count: rows.length * columns.length };
      }
    }
    if (cell) return { rows: [cell.row], columns: [cell.column], has: () => true, count: 1 };
    const active = host.active();
    const row =
      active && host.navRows().find((item) => Object.is(host.trackKey(item), active.rowKey));
    const column = active && columns.find((item) => item.field === active.field);
    if (row === null || row === undefined || !column) return null;
    return { rows: [row], columns: [column], has: () => true, count: 1 };
  }

  /** Clipboard text of a cell: `exportValue`, else the display text. */
  private copyText(row: T, column: StarColumn<T>): string {
    return column.exportValue
      ? String(column.exportValue(row) ?? '')
      : this.host.cellText(row, column);
  }

  /** Ctrl+C (Cmd+C) in the body: copies (see `copyToClipboard`). Returns true when handled. */
  onCopyKey(event: KeyboardEvent): boolean {
    const ctrl = event.ctrlKey || event.metaKey;
    if (!ctrl || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'c') return false;
    const target = event.target as Element;
    const body = this.host.body();
    // With selected columns the copy works from anywhere in the grid (a header button too).
    const scope = this.host.columnFields().length ? body?.parentElement : body;
    if (!scope?.contains(target)) return false;
    if (target.closest(OWN_KEYS)) return false;
    // Text that the user selected on the page: the browser copies it.
    const selected = this.host.document.getSelection?.();
    if (selected && !selected.isCollapsed && selected.toString()) return false;
    if (!this.block()) return false;
    event.preventDefault();
    void this.copy(undefined, null);
    return true;
  }

  /** Ctrl+V (Cmd+V) on a cell of `column` in `row` (`pasteEditable` is checked by the caller). */
  onPaste(event: ClipboardEvent, row: T, column: StarColumn<T>): void {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const lines = parseTsv(text);
    if (!lines.length) return;
    event.preventDefault();
    this.pasteLines(row, column, text, lines);
  }

  /** Writes pasted lines into the editable cells from a cell to the right and down. */
  private pasteLines(row: T, column: StarColumn<T>, text: string, lines: string[][]): void {
    const host = this.host;
    const cells = this.pasteCells(row, column, lines);
    if (!cells.length) return;
    let canceled = false;
    host.beforePaste.emit({
      cells: cells.map(({ row: item, field, value, previous }) => ({
        row: item,
        field,
        value,
        previous,
      })),
      text,
      cancel: () => {
        canceled = true;
      },
      get canceled() {
        return canceled;
      },
    });
    if (canceled) return;
    const { groups, skipped } = this.validate(cells);
    const pasted = this.apply(groups);
    const message = host.text().pastedCells(pasted);
    host.announce(skipped ? `${message}. ${host.text().skippedCells(skipped)}` : message);
  }

  /** The editable cells that pasted lines reach, with their parsed and previous values. */
  private pasteCells(row: T, column: StarColumn<T>, lines: string[][]): PasteCell<T>[] {
    const host = this.host;
    const rows = host.navRows();
    const columns = host.visibleColumns();
    const top = rows.findIndex((item) => Object.is(host.trackKey(item), host.trackKey(row)));
    const left = columns.indexOf(column);
    if (top < 0 || left < 0) return [];
    const cells: PasteCell<T>[] = [];
    lines.forEach((line, i) => {
      const target = rows[top + i];
      if (target === undefined || host.isRowInEdit(target)) return;
      line.forEach((value, j) => {
        const col = columns[left + j];
        // A cell with its editor open keeps the editor value.
        if (!col || !host.isEditable(target, col) || host.isEditing(target, col)) return;
        const parsed = parseEditorText(col.editor, value);
        const previous = host.rawValue(target, col);
        cells.push({ row: target, field: col.field, column: col, value: parsed, previous });
      });
    });
    return cells;
  }

  /**
   * The valid cells by row, and the number of cells left out. Each cell is validated with the
   * pasted values of its row, so a rule can compare fields.
   */
  private validate(cells: readonly PasteCell<T>[]): {
    readonly groups: { readonly row: T; readonly valid: readonly StarTablePasteCell<T>[] }[];
    readonly skipped: number;
  } {
    const host = this.host;
    const byRow = new Map<unknown, { row: T; cells: PasteCell<T>[] }>();
    for (const cell of cells) {
      const key = host.trackKey(cell.row);
      const group = byRow.get(key) ?? { row: cell.row, cells: [] };
      group.cells.push(cell);
      byRow.set(key, group);
    }
    let skipped = 0;
    const groups = [...byRow.values()].map((group) => {
      const values = Object.fromEntries(group.cells.map((cell) => [cell.field, cell.value]));
      const draft = { ...group.row, ...values } as T;
      const valid = group.cells.filter((cell) => {
        const options = cell.column.editor === 'select' ? cell.column.editOptions : undefined;
        // An empty value clears a choice that is not required (`required` reports it).
        const empty = cell.value === '' || cell.value === null;
        const error =
          (options && !empty && !options.includes(String(cell.value))) ||
          starCellError(cell.column, cell.value, draft, host.text());
        if (error) skipped++;
        return !error;
      });
      return { row: group.row, valid };
    });
    return { groups, skipped };
  }

  /** Emits the edit events of a paste (or records a batch step). Returns the written cells. */
  private apply(
    groups: readonly { readonly row: T; readonly valid: readonly StarTablePasteCell<T>[] }[],
  ): number {
    const host = this.host;
    let count = 0;
    if (host.batchEdit()) {
      const rows = groups.map(({ row, valid }) => ({
        row,
        cells: valid.map((cell): StarCellChange => ({
          field: cell.field,
          value: cell.value,
          original: cell.previous,
        })),
      }));
      // A cell that keeps its value (also its pending value) is not counted.
      const changed = rows.filter((entry) =>
        entry.cells.some((cell) => this.batchChanges(entry.row, cell)),
      );
      const count = rows.reduce(
        (sum, entry) =>
          sum + entry.cells.filter((cell) => this.batchChanges(entry.row, cell)).length,
        0,
      );
      return changed.length && host.batch().changeRows(rows) ? count : 0;
    }
    for (const { row, valid } of groups) {
      // A pasted cell that differs from the cell value in the row.
      const changed = valid.filter((cell) => !sameEditValue(cell.value, cell.previous));
      count += changed.length;
      if (!changed.length) continue;
      if (host.rowEditMode()) {
        host.rowEditSave().emit({
          row,
          changes: Object.fromEntries(changed.map((cell) => [cell.field, cell.value])),
          previous: Object.fromEntries(changed.map((cell) => [cell.field, cell.previous])),
        });
        continue;
      }
      for (const cell of changed) {
        host
          .cellEdit()
          .emit({ row, field: cell.field, value: cell.value, previous: cell.previous });
      }
    }
    return count;
  }

  /** A batch cell change that differs from the pending (or row) value of the cell. */
  private batchChanges(row: T, cell: StarCellChange): boolean {
    const pending = this.host.batch().pending(row, cell.field);
    return !sameEditValue(cell.value, pending ? pending.value : cell.original);
  }
}
