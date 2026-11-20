/**
 * Clipboard text of `star-table`: tab-separated values (TSV), the format that spreadsheets copy
 * and paste. Pure helpers, no DOM. AG Grid clipboard, Ignite UI `clipboardOptions`.
 */

/** One cell that `Ctrl+V` writes, as `beforePaste` shows it. */
export interface StarTablePasteCell<T> {
  readonly row: T;
  readonly field: string;
  /** The parsed value: text, or a number / `null` for a `'number'` editor. */
  readonly value: string | number | null;
  /** The cell value before the paste (without pending batch changes). */
  readonly previous: unknown;
}

/** `beforePaste` output: the cells that the paste writes. `cancel()` stops the paste. */
export interface StarTablePasteEvent<T> {
  readonly cells: readonly StarTablePasteCell<T>[];
  /** The pasted text. */
  readonly text: string;
  /** Stops the paste: no cell changes. */
  cancel(): void;
  /** True after `cancel()`. */
  readonly canceled: boolean;
}

/** Options of `copyToClipboard`. */
export interface StarTableCopyOptions {
  /** Adds a first line with the column headers (default: the table `copyHeaders`). */
  readonly headers?: boolean;
}

/**
 * One TSV cell: the text as it is, or in double quotes (with inner quotes doubled) when it holds a
 * tab, a line break or a double quote, as spreadsheets write it.
 */
export function tsvCell(text: string): string {
  return /[\t\r\n"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** TSV text of a block of cells: tabs between the cells, CR LF between the lines. */
export function toTsv(lines: readonly (readonly string[])[]): string {
  return lines.map((line) => line.map(tsvCell).join('\t')).join('\r\n');
}

/**
 * Cells of a TSV text. A cell in double quotes can hold tabs, line breaks and doubled quotes.
 * CR LF, LF and CR end a line; the line break at the end of the text (spreadsheets add one) does
 * not make an empty line.
 */
export function parseTsv(text: string): string[][] {
  const lines: string[][] = [];
  let line: string[] = [];
  let cell = '';
  let i = 0;
  let quoted = false;
  const endCell = () => {
    line.push(cell);
    cell = '';
  };
  const endLine = () => {
    endCell();
    lines.push(line);
    line = [];
  };
  while (i < text.length) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 2;
        continue;
      }
      if (char === '"') quoted = false;
      else cell += char;
      i++;
      continue;
    }
    if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === '\t') {
      endCell();
    } else if (char === '\r' || char === '\n') {
      endLine();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else {
      cell += char;
    }
    i++;
  }
  if (cell !== '' || line.length || quoted) endLine();
  return lines;
}
