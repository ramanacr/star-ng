import { starColumnIndex, starColumnName } from './address';

/** One end of a cell reference in a formula. Zero-based; `absRow` and `absCol` mark `$`. */
export interface StarFormulaRefPart {
  readonly row: number;
  readonly col: number;
  readonly absRow: boolean;
  readonly absCol: boolean;
}

/** A token of a formula. `start` and `end` are offsets in the formula text (end excluded). */
export type StarFormulaToken =
  | {
      readonly type: 'number';
      readonly value: number;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly type: 'string';
      readonly value: string;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly type: 'boolean';
      readonly value: boolean;
      readonly start: number;
      readonly end: number;
    }
  | { readonly type: 'error'; readonly value: string; readonly start: number; readonly end: number }
  | {
      readonly type: 'reference';
      /** Sheet name as written (quotes removed), or null for the current sheet. */
      readonly sheet: string | null;
      readonly from: StarFormulaRefPart;
      /** Second corner of a range, or null for one cell. */
      readonly to: StarFormulaRefPart | null;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly type: 'function';
      readonly value: string;
      readonly start: number;
      readonly end: number;
    }
  | { readonly type: 'name'; readonly value: string; readonly start: number; readonly end: number }
  | {
      readonly type: 'operator';
      readonly value: string;
      readonly start: number;
      readonly end: number;
    }
  | {
      readonly type: 'paren';
      readonly value: '(' | ')';
      readonly start: number;
      readonly end: number;
    }
  | { readonly type: 'comma'; readonly start: number; readonly end: number }
  /** Text that is not a token (an unclosed string, an unknown character). */
  | {
      readonly type: 'invalid';
      readonly value: string;
      readonly start: number;
      readonly end: number;
    };

/** Error literals that a formula may contain. */
const ERROR_LITERALS = ['#DIV/0!', '#REF!', '#NAME?', '#VALUE!', '#CIRC!', '#NUM!', '#ERROR!'];

const NUMBER = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const SHEET = /^(?:'((?:[^']|'')+)'|([A-Za-z_À-￿][\w.À-￿]*))!/;
const CELL = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)(?![\w(])/;
const IDENT = /^[A-Za-z_][\w.]*/;
const OPERATORS = ['<>', '<=', '>=', '+', '-', '*', '/', '^', '&', '=', '<', '>', '%'];

function cellPart(match: RegExpExecArray): StarFormulaRefPart {
  return {
    absCol: match[1] === '$',
    col: starColumnIndex(match[2]),
    absRow: match[3] === '$',
    row: Number(match[4]) - 1,
  };
}

/**
 * Splits a formula into tokens. A leading `=` is skipped. White space separates tokens and is not
 * returned. The tokenizer never throws: text it cannot read becomes an `invalid` token, which the
 * parser turns into `#ERROR!`.
 */
export function starTokenizeFormula(formula: string): StarFormulaToken[] {
  const tokens: StarFormulaToken[] = [];
  let i = 0;
  const text = formula;
  if (text.trimStart().startsWith('=')) i = text.indexOf('=') + 1;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const rest = text.slice(i);
    // Strings: "..." with "" for a quote.
    if (ch === '"') {
      let j = i + 1;
      let value = '';
      let closed = false;
      while (j < text.length) {
        if (text[j] === '"') {
          if (text[j + 1] === '"') {
            value += '"';
            j += 2;
            continue;
          }
          closed = true;
          j++;
          break;
        }
        value += text[j++];
      }
      tokens.push(
        closed
          ? { type: 'string', value, start: i, end: j }
          : { type: 'invalid', value: text.slice(i), start: i, end: text.length },
      );
      i = j;
      continue;
    }
    if (ch === '#') {
      const literal = ERROR_LITERALS.find((e) => rest.toUpperCase().startsWith(e));
      if (literal) {
        tokens.push({ type: 'error', value: literal, start: i, end: i + literal.length });
        i += literal.length;
        continue;
      }
    }
    const number = NUMBER.exec(rest);
    if (number) {
      tokens.push({
        type: 'number',
        value: Number(number[0]),
        start: i,
        end: i + number[0].length,
      });
      i += number[0].length;
      continue;
    }
    // References: [Sheet!]A1[:B2]
    const sheetMatch = SHEET.exec(rest);
    const afterSheet = sheetMatch ? rest.slice(sheetMatch[0].length) : rest;
    const cell = CELL.exec(afterSheet);
    if (cell) {
      let length = (sheetMatch?.[0].length ?? 0) + cell[0].length;
      let to: StarFormulaRefPart | null = null;
      if (afterSheet[cell[0].length] === ':') {
        const second = CELL.exec(afterSheet.slice(cell[0].length + 1));
        if (second) {
          to = cellPart(second);
          length += 1 + second[0].length;
        }
      }
      const sheet = sheetMatch ? (sheetMatch[1]?.replace(/''/g, "'") ?? sheetMatch[2]) : null;
      tokens.push({
        type: 'reference',
        sheet,
        from: cellPart(cell),
        to,
        start: i,
        end: i + length,
      });
      i += length;
      continue;
    }
    const ident = IDENT.exec(rest);
    if (ident) {
      const end = i + ident[0].length;
      let k = end;
      while (k < text.length && /\s/.test(text[k])) k++;
      const upper = ident[0].toUpperCase();
      if (text[k] === '(') tokens.push({ type: 'function', value: upper, start: i, end });
      else if (upper === 'TRUE' || upper === 'FALSE')
        tokens.push({ type: 'boolean', value: upper === 'TRUE', start: i, end });
      else tokens.push({ type: 'name', value: ident[0], start: i, end });
      i = end;
      continue;
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'paren', value: ch, start: i, end: i + 1 });
      i++;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma', start: i, end: i + 1 });
      i++;
      continue;
    }
    const op = OPERATORS.find((o) => rest.startsWith(o));
    if (op) {
      tokens.push({ type: 'operator', value: op, start: i, end: i + op.length });
      i += op.length;
      continue;
    }
    tokens.push({ type: 'invalid', value: ch, start: i, end: i + 1 });
    i++;
  }
  return tokens;
}

function partText(part: StarFormulaRefPart): string {
  return `${part.absCol ? '$' : ''}${starColumnName(part.col)}${part.absRow ? '$' : ''}${part.row + 1}`;
}

function shiftPart(
  part: StarFormulaRefPart,
  rows: number,
  cols: number,
): StarFormulaRefPart | null {
  const row = part.absRow ? part.row : part.row + rows;
  const col = part.absCol ? part.col : part.col + cols;
  if (row < 0 || col < 0) return null;
  return { ...part, row, col };
}

/** Sheet prefix as written in a formula: quoted when the name is not a plain word. */
export function starSheetPrefix(sheet: string): string {
  return /^[A-Za-z_][\w.]*$/.test(sheet) && !/^[A-Za-z]{1,3}\d+$/.test(sheet)
    ? `${sheet}!`
    : `'${sheet.replace(/'/g, "''")}'!`;
}

/**
 * Moves the relative references of a formula by `rows` and `cols`, as the fill handle and a paste
 * do: `=A1+$B$1` filled one row down is `=A2+$B$1`. A reference that would leave the sheet (above
 * row 1 or left of column A) becomes `#REF!`. Everything else in the text stays as written.
 */
export function starShiftFormula(formula: string, rows: number, cols: number): string {
  if (!rows && !cols) return formula;
  let out = '';
  let last = 0;
  for (const token of starTokenizeFormula(formula)) {
    if (token.type !== 'reference') continue;
    const from = shiftPart(token.from, rows, cols);
    const to = token.to ? shiftPart(token.to, rows, cols) : null;
    let replacement: string;
    if (!from || (token.to && !to)) replacement = '#REF!';
    else {
      // Keep the sheet prefix as written (cell parts never contain "!").
      const written = formula.slice(token.start, token.end);
      const sheet = token.sheet === null ? '' : written.slice(0, written.lastIndexOf('!') + 1);
      replacement = `${sheet}${partText(from)}${to ? ':' + partText(to) : ''}`;
    }
    out += formula.slice(last, token.start) + replacement;
    last = token.end;
  }
  return out + formula.slice(last);
}
