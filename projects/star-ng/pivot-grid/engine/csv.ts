import type { StarPivotColumn, StarPivotResult } from './types';

/** Texts and options of `starPivotToCsv`. */
export interface StarPivotCsvOptions {
  /** Text of the top start cell (above the row labels). */
  readonly corner?: string;
  /** Label of a grand total row or column. */
  readonly total: string;
  /** Label of a subtotal column of a member. */
  readonly subtotal: (label: string) => string;
  /** Cell text of a value; default: the plain value (`String`), empty for no value. */
  readonly format?: (value: unknown, column: StarPivotColumn) => string;
  /**
   * Prefixes `'` to a text field that starts with `=`, `+`, `-` or `@`, so a spreadsheet does not
   * run it as a formula (default true). Number cells are not changed.
   */
  readonly escapeFormulas?: boolean;
  /** Field separator (default `,`). */
  readonly delimiter?: string;
}

/** One field of RFC 4180: quoted when it holds the delimiter, a quote or a line break. */
function quote(field: string, delimiter: string): string {
  return field.includes(delimiter) || /["\r\n]/.test(field)
    ? `"${field.replace(/"/g, '""')}"`
    : field;
}

/**
 * The visible pivot as CSV (RFC 4180, CRLF line ends, no final line break): one line per header
 * row (a spanning header in its first column), then one line per row with the row label and the
 * cell values.
 */
export function starPivotToCsv<T>(
  result: StarPivotResult<T>,
  options: StarPivotCsvOptions,
): string {
  const delimiter = options.delimiter ?? ',';
  const escape = options.escapeFormulas ?? true;
  const text = (value: string): string =>
    quote(escape && /^[=+\-@]/.test(value) ? `'${value}` : value, delimiter);
  const lines: string[] = [];
  const width = result.columns.length;
  result.headerRows.forEach((cells, index) => {
    const line = Array.from({ length: width }, () => '');
    for (const cell of cells) {
      line[cell.column] =
        cell.kind === 'total'
          ? options.total
          : cell.kind === 'subtotal'
            ? options.subtotal(cell.label)
            : cell.label;
    }
    lines.push([index === 0 ? (options.corner ?? '') : '', ...line].map(text).join(delimiter));
  });
  result.rows.forEach((row, r) => {
    const fields = [text(row.kind === 'total' ? options.total : row.label)];
    result.columns.forEach((column, c) => {
      const value = result.cells[r][c];
      if (value === null || value === undefined) fields.push('');
      else if (options.format) fields.push(text(options.format(value, column)));
      else if (typeof value === 'number') fields.push(quote(String(value), delimiter));
      else fields.push(text(String(value)));
    });
    lines.push(fields.join(delimiter));
  });
  return lines.join('\r\n');
}
