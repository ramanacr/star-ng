/**
 * Cell addresses of the spreadsheet: column letters, `A1` addresses and their zero-based row and
 * column numbers. Pure functions without DOM access.
 */

/** Number of columns of a sheet in Excel (A to XFD). A reference past it is `#REF!`. */
export const STAR_SHEET_MAX_COLUMNS = 16384;
/** Number of rows of a sheet in Excel. A reference past it is `#REF!`. */
export const STAR_SHEET_MAX_ROWS = 1048576;

/** A cell by zero-based row and column. */
export interface StarCellPosition {
  readonly row: number;
  readonly col: number;
}

/** A block of cells: zero-based, both corners included, `top <= bottom` and `left <= right`. */
export interface StarCellRange {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

/** Column letters of a zero-based column: 0 is `A`, 25 is `Z`, 26 is `AA`. */
export function starColumnName(col: number): string {
  let name = '';
  let n = Math.floor(col) + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/** Zero-based column of column letters (any case), or -1 when the text is not letters. */
export function starColumnIndex(name: string): number {
  if (!/^[A-Za-z]+$/.test(name)) return -1;
  let n = 0;
  for (const ch of name.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** `A1` address of a zero-based row and column. */
export function starCellAddress(row: number, col: number): string {
  return `${starColumnName(col)}${row + 1}`;
}

/** Row and column of an `A1` address (`$` signs and lower case allowed), or null. */
export function starParseAddress(address: string): StarCellPosition | null {
  const match = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(address.trim());
  if (!match) return null;
  const row = Number(match[2]) - 1;
  const col = starColumnIndex(match[1]);
  if (row < 0 || col < 0) return null;
  return { row, col };
}

/** The range of two corners in any order. */
export function starNormalizeRange(a: StarCellPosition, b: StarCellPosition): StarCellRange {
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

/** True when the cell is inside the range. */
export function starRangeContains(range: StarCellRange, row: number, col: number): boolean {
  return row >= range.top && row <= range.bottom && col >= range.left && col <= range.right;
}

/** `A1:B5` text of a range (`A1` for one cell). */
export function starRangeAddress(range: StarCellRange): string {
  const from = starCellAddress(range.top, range.left);
  const to = starCellAddress(range.bottom, range.right);
  return from === to ? from : `${from}:${to}`;
}
