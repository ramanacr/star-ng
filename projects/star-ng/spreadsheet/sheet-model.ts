import {
  starCellAddress,
  StarCellPosition,
  StarCellRange,
  starColumnName,
  starParseAddress,
} from './formula/address';
import {
  StarFormulaValue,
  starIsFormulaError,
  starNumberText,
  starSerialToDate,
} from './formula/evaluate';
import { StarFormulaNode, starParseFormula } from './formula/parser';
import { starShiftFormula } from './formula/tokenizer';

/** Number format of a cell. `general` shows the number as typed (default). */
export type StarCellNumberFormat = 'general' | 'number' | 'percent' | 'currency' | 'date';

/** Background colours of a cell: the soft palette tokens of the theme. */
export type StarCellBackground = 'accent' | 'success' | 'warning' | 'danger' | 'muted';

/** Format of a cell: number format, text style, alignment and background. */
export interface StarCellFormat {
  readonly type?: StarCellNumberFormat;
  /** Fraction digits of `number`, `percent` and `currency` (defaults 2, 0 and 2). */
  readonly decimals?: number;
  /** Thousands separators for `number` (default true). */
  readonly thousands?: boolean;
  /** ISO 4217 code of `currency` (default `USD`). */
  readonly currency?: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  /** Horizontal alignment. Default: numbers at the end, everything else at the start. */
  readonly align?: 'start' | 'center' | 'end';
  readonly background?: StarCellBackground;
}

/** One cell of `star-spreadsheet`: a literal value or a formula, and a format. */
export interface StarSpreadsheetCell {
  readonly value?: string | number | boolean;
  /** Formula text with the leading `=`, for example `=SUM(B2:B6)`. */
  readonly formula?: string;
  readonly format?: StarCellFormat;
}

/** Cells of a sheet by `A1` address. Empty cells have no entry. */
export type StarSpreadsheetCells = Readonly<Record<string, StarSpreadsheetCell>>;

/** A named sheet of `star-spreadsheet`. Names are unique, not case-sensitive. */
export interface StarSpreadsheetSheet {
  readonly name: string;
  readonly cells: StarSpreadsheetCells;
}

const NUMBER_TEXT = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * The cell content of typed text: `=…` is a formula, a number is a number, TRUE and FALSE are
 * booleans, a leading apostrophe keeps the rest as text (`'0042`), and empty text is null (clear).
 */
export function starParseCellText(
  text: string,
): Pick<StarSpreadsheetCell, 'value' | 'formula'> | null {
  if (text === '') return null;
  if (text.startsWith("'")) return { value: text.slice(1) };
  if (text.startsWith('=') && text.length > 1) return { formula: text };
  const trimmed = text.trim();
  if (NUMBER_TEXT.test(trimmed)) return { value: Number(trimmed) };
  const upper = trimmed.toUpperCase();
  if (upper === 'TRUE' || upper === 'FALSE') return { value: upper === 'TRUE' };
  return { value: text };
}

/** The raw text of a cell, as the formula bar and the cell editor show it. */
export function starCellText(cell: StarSpreadsheetCell | null | undefined): string {
  if (!cell) return '';
  if (cell.formula) return cell.formula;
  const v = cell.value;
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return starNumberText(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v === '') return '';
  // Text that would read back as a number, a boolean or a formula keeps a leading apostrophe.
  const parsed = starParseCellText(v);
  return v.startsWith("'") || parsed?.value !== v ? `'${v}` : v;
}

/**
 * The display text of a value with a format, through `Intl.NumberFormat` and
 * `Intl.DateTimeFormat` in `locale`. A date is a serial day number (1900 date system).
 */
export function starFormatCellValue(
  value: StarFormulaValue,
  format: StarCellFormat | undefined,
  locale?: string | null,
): string {
  if (value === null || value === undefined) return '';
  if (starIsFormulaError(value)) return value.code;
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'string') return value;
  const lang = locale || undefined;
  if (format?.type === 'date') {
    // Excel shows #### here; a formula error code is the clearest text for a cell.
    if (!Number.isFinite(value) || value < 1 || value > STAR_SHEET_MAX_DATE_SERIAL) return '#NUM!';
    try {
      return new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'UTC' }).format(
        starSerialToDate(value),
      );
    } catch {
      return generalNumber(value, undefined);
    }
  }
  try {
    return formatNumber(value, format, lang);
  } catch {
    // Invalid options (a currency code, a number of decimals) or an invalid locale: Intl throws a
    // RangeError. Show the number in the general format rather than break the rendering.
    try {
      return generalNumber(value, lang);
    } catch {
      return generalNumber(value, undefined);
    }
  }
}

/** Last serial day number that is a date (9999-12-31), as in Excel. */
export const STAR_SHEET_MAX_DATE_SERIAL = 2958465;

function generalNumber(value: number, lang: string | undefined): string {
  return new Intl.NumberFormat(lang, { maximumFractionDigits: 10, useGrouping: false }).format(
    Number(value.toPrecision(15)),
  );
}

function formatNumber(value: number, format: StarCellFormat | undefined, lang?: string): string {
  switch (format?.type ?? 'general') {
    case 'number': {
      const d = format?.decimals ?? 2;
      return new Intl.NumberFormat(lang, {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
        useGrouping: format?.thousands ?? true,
      }).format(value);
    }
    case 'percent': {
      const d = format?.decimals ?? 0;
      return new Intl.NumberFormat(lang, {
        style: 'percent',
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(value);
    }
    case 'currency': {
      const d = format?.decimals ?? 2;
      return new Intl.NumberFormat(lang, {
        style: 'currency',
        currency: format?.currency ?? 'USD',
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(value);
    }
    default:
      return generalNumber(value, lang);
  }
}

/**
 * Rows of fields as delimited text: CSV with `,` (RFC 4180) or TSV with a tab (the clipboard
 * format of Excel and Google Sheets). A field with the delimiter, a quote or a line break is
 * quoted, and quotes are doubled. Lines end with CRLF; there is no final line break.
 */
export function starFormatDelimited(
  rows: readonly (readonly string[])[],
  delimiter: string,
): string {
  const quote = (field: string): string =>
    field.includes(delimiter) || /["\r\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
  return rows.map((row) => row.map(quote).join(delimiter)).join('\r\n');
}

/**
 * Parses delimited text (RFC 4180 quoting) into rows of fields. CRLF, LF and CR end a line; a
 * final line break adds no row. Quoted fields may hold the delimiter, line breaks and `""`.
 */
export function starParseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let quoted = false;
  let any = false;
  while (i < text.length) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    any = true;
    if (ch === '"' && field === '') {
      quoted = true;
      i++;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
      i++;
    } else if (ch === '\r' || ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      any = false;
      i += ch === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      field += ch;
      i++;
    }
  }
  if (any || field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Cells from rows of typed text, the first row and column at `origin`. Empty text is skipped. */
export function starCellsFromRows(
  rows: readonly (readonly string[])[],
  origin: StarCellPosition = { row: 0, col: 0 },
): Record<string, StarSpreadsheetCell> {
  const cells: Record<string, StarSpreadsheetCell> = {};
  rows.forEach((row, r) =>
    row.forEach((text, c) => {
      const cell = starParseCellText(text);
      if (cell) cells[starCellAddress(origin.row + r, origin.col + c)] = cell;
    }),
  );
  return cells;
}

/** The range from A1 to the last row and column that hold a cell, or null for an empty sheet. */
export function starUsedRange(cells: StarSpreadsheetCells): StarCellRange | null {
  let bottom = -1;
  let right = -1;
  for (const address of Object.keys(cells)) {
    const pos = starParseAddress(address);
    if (!pos) continue;
    bottom = Math.max(bottom, pos.row);
    right = Math.max(right, pos.col);
  }
  return bottom < 0 ? null : { top: 0, left: 0, bottom, right };
}

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/**
 * Fills `target` (which contains `source`) by repeating the source block, as the fill handle
 * does: values and formats are copied, and the relative references of formulas move with the
 * distance (`=A1*2` filled one row down is `=A2*2`). An empty source cell clears its targets.
 * Returns a new cells record.
 */
export function starFillCells(
  cells: StarSpreadsheetCells,
  source: StarCellRange,
  target: StarCellRange,
): Record<string, StarSpreadsheetCell> {
  const out: Record<string, StarSpreadsheetCell> = { ...cells };
  const h = source.bottom - source.top + 1;
  const w = source.right - source.left + 1;
  for (let r = target.top; r <= target.bottom; r++) {
    for (let c = target.left; c <= target.right; c++) {
      if (r >= source.top && r <= source.bottom && c >= source.left && c <= source.right) continue;
      const sr = source.top + mod(r - source.top, h);
      const sc = source.left + mod(c - source.left, w);
      const from = cells[starCellAddress(sr, sc)];
      const address = starCellAddress(r, c);
      if (!from) {
        delete out[address];
        continue;
      }
      out[address] = from.formula
        ? { ...from, formula: starShiftFormula(from.formula, r - sr, c - sc) }
        : { ...from };
    }
  }
  return out;
}

/**
 * Offsets of rows or columns: entry `i` is the start of item `i`, the last entry is the total
 * size. `size(i)` gives the size of item `i`.
 */
export function starSheetOffsets(count: number, size: (index: number) => number): number[] {
  const offsets = new Array<number>(count + 1);
  offsets[0] = 0;
  for (let i = 0; i < count; i++) offsets[i + 1] = offsets[i] + size(i);
  return offsets;
}

/** Index of the item that contains `position` (binary search in the offsets). */
function itemAt(offsets: readonly number[], position: number): number {
  let lo = 0;
  let hi = offsets.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= position) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Items to render for a scroll position: `[start, end)` covers the view (`scroll` to
 * `scroll + viewport`) plus `overscan` items on each side. The scroll position is limited to the
 * content, so a stale value after the sheet shrank still renders the last items.
 */
export function starSheetWindow(
  offsets: readonly number[],
  scroll: number,
  viewport: number,
  overscan: number,
): { start: number; end: number } {
  const count = offsets.length - 1;
  if (count <= 0) return { start: 0, end: 0 };
  const total = offsets[count];
  const from = Math.max(0, Math.min(scroll, total - viewport));
  const first = itemAt(offsets, from);
  let end = first + 1;
  while (end < count && offsets[end] < from + viewport) end++;
  return { start: Math.max(0, first - overscan), end: Math.min(count, end + overscan) };
}

/** Words of `starDescribeFormula`: a function call and a range. */
export interface StarFormulaWords {
  readonly call: (name: string, args: string) => string;
  readonly range: (from: string, to: string) => string;
}

function refText(ref: { row: number; col: number }): string {
  return `${starColumnName(ref.col)}${ref.row + 1}`;
}

function speak(node: StarFormulaNode, words: StarFormulaWords): string {
  switch (node.type) {
    case 'number':
      return starNumberText(node.value);
    case 'string':
      return node.value;
    case 'boolean':
      return node.value ? 'TRUE' : 'FALSE';
    case 'error':
      return node.code;
    case 'name':
      return node.name;
    case 'ref':
      return `${node.sheet ? node.sheet + ' ' : ''}${refText(node.ref)}`;
    case 'range':
      return `${node.sheet ? node.sheet + ' ' : ''}${words.range(refText(node.from), refText(node.to))}`;
    case 'call':
      return words.call(node.name, node.args.map((a) => speak(a, words)).join(', '));
    case 'unary':
      return `${node.op === '-' ? '-' : ''}${speak(node.arg, words)}`;
    case 'percent':
      return `${speak(node.arg, words)}%`;
    case 'binary':
      return `${speak(node.left, words)} ${node.op} ${speak(node.right, words)}`;
  }
}

/**
 * A formula as words for a screen reader: `=SUM(A1:A5)` reads "SUM of A1 to A5" with English
 * words. `$` signs are left out. A formula that cannot be parsed is returned as written.
 */
export function starDescribeFormula(formula: string, words: StarFormulaWords): string {
  const node = starParseFormula(formula);
  if (node.type === 'error' && node.code === '#ERROR!') return formula;
  return speak(node, words);
}
