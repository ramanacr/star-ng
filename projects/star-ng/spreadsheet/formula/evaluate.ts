import { STAR_SHEET_MAX_COLUMNS, STAR_SHEET_MAX_ROWS } from './address';
import { StarFormulaNode, starParseFormula } from './parser';
import { StarFormulaRefPart } from './tokenizer';

/**
 * Error codes of a formula result.
 * - `#DIV/0!` division by zero, or the average of no numbers.
 * - `#REF!` a reference to a sheet that does not exist, or past the sheet limits.
 * - `#NAME?` an unknown function or name.
 * - `#VALUE!` a value of the wrong type (text in arithmetic, a range where one value is needed,
 *   a wrong number of arguments).
 * - `#CIRC!` a circular reference.
 * - `#NUM!` a number that is not finite, or a date before 1900.
 * - `#ERROR!` a formula that cannot be parsed.
 */
export type StarFormulaErrorCode =
  '#DIV/0!' | '#REF!' | '#NAME?' | '#VALUE!' | '#CIRC!' | '#NUM!' | '#ERROR!';

/** The error result of a formula. Compare `code`; the class has no other state. */
export class StarFormulaError {
  constructor(readonly code: StarFormulaErrorCode | string) {}

  toString(): string {
    return this.code;
  }

  toJSON(): string {
    return this.code;
  }
}

/** The value of a cell: a number, text, a boolean, an error, or `null` for an empty cell. */
export type StarFormulaValue = number | string | boolean | StarFormulaError | null;

/** True when the value is a formula error. */
export function starIsFormulaError(value: unknown): value is StarFormulaError {
  return value instanceof StarFormulaError;
}

/** What `starEvaluate` reads: the cells, the sheet names and the date. All optional. */
export interface StarFormulaContext {
  /** Sheet of references without a sheet name (default `Sheet1`). */
  readonly sheet?: string;
  /** Value of a cell (zero-based row and column). Missing: every cell is empty. */
  readonly cell?: (sheet: string, row: number, col: number) => StarFormulaValue;
  /** True when the sheet exists. Missing: every sheet exists. A missing sheet gives `#REF!`. */
  readonly hasSheet?: (sheet: string) => boolean;
  /** Today's date for `TODAY()` (default: `new Date()`). */
  readonly today?: () => Date;
}

/** A range value inside the evaluator: rows of cell values. */
class RangeValue {
  constructor(readonly rows: readonly (readonly StarFormulaValue[])[]) {}

  *values(): Iterable<StarFormulaValue> {
    for (const row of this.rows) yield* row;
  }

  get single(): boolean {
    return this.rows.length === 1 && this.rows[0].length === 1;
  }
}

type Value = StarFormulaValue | RangeValue;

const ERRORS = new Map<string, StarFormulaError>();
function err(code: StarFormulaErrorCode): StarFormulaError {
  let e = ERRORS.get(code);
  if (!e) ERRORS.set(code, (e = new StarFormulaError(code)));
  return e;
}

/** Milliseconds of one day, and the day 0 of the 1900 date system (1899-12-30). */
const DAY = 86_400_000;
const EPOCH = Date.UTC(1899, 11, 30);

/** Serial day number (1900 date system, as Excel and Google Sheets) of a calendar date. */
export function starDateToSerial(year: number, month: number, day: number): number {
  return Math.round((Date.UTC(year, month - 1, day) - EPOCH) / DAY);
}

/** Calendar date (UTC midnight) of a serial day number. */
export function starSerialToDate(serial: number): Date {
  return new Date(EPOCH + Math.floor(serial) * DAY);
}

/** Decimal number text, as typed in a cell: `12`, `-1.5`, `.5`, `1e3`. */
const DECIMAL = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

// Coercions --------------------------------------------------------------------------------

/** One value from a range of one cell; a bigger range is `#VALUE!`. */
function scalar(value: Value): StarFormulaValue {
  if (value instanceof RangeValue) return value.single ? value.rows[0][0] : err('#VALUE!');
  return value;
}

function toNumber(value: Value): number | StarFormulaError {
  const v = scalar(value);
  if (v === null) return 0;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (v instanceof StarFormulaError) return v;
  const text = v.trim();
  // Decimal notation only: Number() would also read "0x10", "0b11" and "Infinity".
  if (!DECIMAL.test(text)) return err('#VALUE!');
  const n = Number(text);
  return Number.isFinite(n) ? n : err('#VALUE!');
}

function toBoolean(value: Value): boolean | StarFormulaError {
  const v = scalar(value);
  if (v === null) return false;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (v instanceof StarFormulaError) return v;
  const upper = v.trim().toUpperCase();
  if (upper === 'TRUE') return true;
  if (upper === 'FALSE') return false;
  return err('#VALUE!');
}

/** Text of a number as the General format shows it: at most 15 significant digits. */
export function starNumberText(n: number): string {
  return String(Number(n.toPrecision(15)));
}

function toText(value: Value): string | StarFormulaError {
  const v = scalar(value);
  if (v === null) return '';
  if (typeof v === 'number') return starNumberText(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof StarFormulaError) return v;
  return v;
}

function finite(n: number): number | StarFormulaError {
  return Number.isFinite(n) ? n : err('#NUM!');
}

// Functions --------------------------------------------------------------------------------

type Fn = (args: readonly Value[], ctx: StarFormulaContext) => StarFormulaValue;

/**
 * The numbers of the arguments, as SUM reads them: in a range (or a reference) only numbers count
 * and text, booleans and empty cells are skipped; a direct argument is converted (`"3"` and TRUE
 * count, `"x"` is `#VALUE!`). The first error wins.
 */
function numbers(args: readonly Value[]): number[] | StarFormulaError {
  const out: number[] = [];
  for (const arg of args) {
    if (arg instanceof RangeValue) {
      for (const v of arg.values()) {
        if (v instanceof StarFormulaError) return v;
        if (typeof v === 'number') out.push(v);
      }
    } else {
      const n = toNumber(arg);
      if (n instanceof StarFormulaError) return n;
      out.push(n);
    }
  }
  return out;
}

function booleans(args: readonly Value[]): boolean[] | StarFormulaError {
  const out: boolean[] = [];
  for (const arg of args) {
    if (arg instanceof RangeValue) {
      for (const v of arg.values()) {
        if (v instanceof StarFormulaError) return v;
        if (typeof v === 'boolean') out.push(v);
        else if (typeof v === 'number') out.push(v !== 0);
      }
    } else {
      const b = toBoolean(arg);
      if (b instanceof StarFormulaError) return b;
      out.push(b);
    }
  }
  return out.length ? out : err('#VALUE!');
}

function unary(fn: (value: Value) => StarFormulaValue): Fn {
  return (args) => (args.length === 1 ? fn(args[0]) : err('#VALUE!'));
}

function text(fn: (text: string) => StarFormulaValue): Fn {
  return unary((value) => {
    const t = toText(value);
    return t instanceof StarFormulaError ? t : fn(t);
  });
}

/** Rounds half away from zero, without binary artefacts (`ROUND(1.005, 2)` is 1.01). */
function round(value: number, digits: number): number {
  // Excel accepts digits far outside this range; beyond it the result does not change.
  const d = Math.min(15, Math.max(-308, Math.trunc(digits)));
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const text = String(abs);
  if (text.includes('e')) return (sign * Math.round(abs * 10 ** d)) / 10 ** d;
  const shifted = Math.round(Number(`${text}e${d}`));
  return sign * Number(`${shifted}e${-d}`);
}

const FUNCTIONS: Readonly<Record<string, Fn>> = {
  SUM: (args) => {
    const n = numbers(args);
    return n instanceof StarFormulaError ? n : finite(n.reduce((a, b) => a + b, 0));
  },
  AVERAGE: (args) => {
    const n = numbers(args);
    if (n instanceof StarFormulaError) return n;
    return n.length ? finite(n.reduce((a, b) => a + b, 0) / n.length) : err('#DIV/0!');
  },
  MIN: (args) => {
    const n = numbers(args);
    if (n instanceof StarFormulaError) return n;
    return n.length ? n.reduce((a, b) => (b < a ? b : a)) : 0;
  },
  MAX: (args) => {
    const n = numbers(args);
    if (n instanceof StarFormulaError) return n;
    return n.length ? n.reduce((a, b) => (b > a ? b : a)) : 0;
  },
  COUNT: (args) => {
    let count = 0;
    for (const arg of args) {
      if (arg instanceof RangeValue) {
        for (const v of arg.values()) if (typeof v === 'number') count++;
      } else if (arg !== null && !(arg instanceof StarFormulaError)) {
        if (!(toNumber(arg) instanceof StarFormulaError)) count++;
      }
    }
    return count;
  },
  COUNTA: (args) => {
    let count = 0;
    for (const arg of args) {
      if (arg instanceof RangeValue) {
        for (const v of arg.values()) if (v !== null) count++;
      } else if (arg !== null) count++;
    }
    return count;
  },
  AND: (args) => {
    const b = booleans(args);
    return b instanceof StarFormulaError ? b : b.every(Boolean);
  },
  OR: (args) => {
    const b = booleans(args);
    return b instanceof StarFormulaError ? b : b.some(Boolean);
  },
  NOT: unary((value) => {
    const b = toBoolean(value);
    return b instanceof StarFormulaError ? b : !b;
  }),
  ROUND: (args) => {
    if (args.length < 1 || args.length > 2) return err('#VALUE!');
    const n = toNumber(args[0]);
    if (n instanceof StarFormulaError) return n;
    const d = args.length > 1 ? toNumber(args[1]) : 0;
    if (d instanceof StarFormulaError) return d;
    return finite(round(n, d));
  },
  ABS: unary((value) => {
    const n = toNumber(value);
    return n instanceof StarFormulaError ? n : Math.abs(n);
  }),
  CONCAT: (args) => {
    let out = '';
    for (const arg of args) {
      const parts = arg instanceof RangeValue ? [...arg.values()] : [arg];
      for (const part of parts) {
        const t = toText(part);
        if (t instanceof StarFormulaError) return t;
        out += t;
      }
    }
    return out;
  },
  LEN: text((t) => t.length),
  UPPER: text((t) => t.toUpperCase()),
  LOWER: text((t) => t.toLowerCase()),
  TODAY: (args, ctx) => {
    if (args.length) return err('#VALUE!');
    const now = ctx.today?.() ?? new Date();
    return starDateToSerial(now.getFullYear(), now.getMonth() + 1, now.getDate());
  },
  DATE: (args) => {
    if (args.length !== 3) return err('#VALUE!');
    const parts: number[] = [];
    for (const arg of args) {
      const n = toNumber(arg);
      if (n instanceof StarFormulaError) return n;
      parts.push(Math.trunc(n));
    }
    let [year] = parts;
    if (year >= 0 && year < 1900) year += 1900;
    if (year < 0 || year > 9999) return err('#NUM!');
    const serial = starDateToSerial(year, parts[1], parts[2]);
    return serial < 1 ? err('#NUM!') : serial;
  },
};

/** Names of the functions that `starEvaluate` knows, in alphabetical order. */
export const STAR_FORMULA_FUNCTIONS: readonly string[] = [...Object.keys(FUNCTIONS), 'IF'].sort();

// Evaluator --------------------------------------------------------------------------------

function compare(a: StarFormulaValue, b: StarFormulaValue): number {
  // Empty takes the type of the other side.
  const rank = (v: StarFormulaValue): number =>
    typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;
  let x = a;
  let y = b;
  if (x === null) x = typeof y === 'string' ? '' : typeof y === 'boolean' ? false : 0;
  if (y === null) y = typeof x === 'string' ? '' : typeof x === 'boolean' ? false : 0;
  const rx = rank(x);
  const ry = rank(y);
  if (rx !== ry) return rx - ry;
  if (typeof x === 'string' && typeof y === 'string') {
    const lx = x.toLowerCase();
    const ly = y.toLowerCase();
    return lx < ly ? -1 : lx > ly ? 1 : 0;
  }
  const nx = Number(x);
  const ny = Number(y);
  return nx < ny ? -1 : nx > ny ? 1 : 0;
}

function inLimits(ref: StarFormulaRefPart): boolean {
  return (
    ref.row >= 0 &&
    ref.col >= 0 &&
    ref.row < STAR_SHEET_MAX_ROWS &&
    ref.col < STAR_SHEET_MAX_COLUMNS
  );
}

function evaluateNode(node: StarFormulaNode, ctx: StarFormulaContext): Value {
  const sheetOf = (sheet: string | null): string => sheet ?? ctx.sheet ?? 'Sheet1';
  switch (node.type) {
    case 'number':
    case 'string':
    case 'boolean':
      return node.value;
    case 'error':
      return err(node.code as StarFormulaErrorCode);
    case 'name':
      return err('#NAME?');
    case 'ref': {
      const sheet = sheetOf(node.sheet);
      if (!inLimits(node.ref) || (ctx.hasSheet && !ctx.hasSheet(sheet))) return err('#REF!');
      return ctx.cell?.(sheet, node.ref.row, node.ref.col) ?? null;
    }
    case 'range': {
      const sheet = sheetOf(node.sheet);
      if (!inLimits(node.from) || !inLimits(node.to) || (ctx.hasSheet && !ctx.hasSheet(sheet))) {
        return err('#REF!');
      }
      const top = Math.min(node.from.row, node.to.row);
      const bottom = Math.max(node.from.row, node.to.row);
      const left = Math.min(node.from.col, node.to.col);
      const right = Math.max(node.from.col, node.to.col);
      const rows: StarFormulaValue[][] = [];
      for (let r = top; r <= bottom; r++) {
        const row: StarFormulaValue[] = [];
        for (let c = left; c <= right; c++) row.push(ctx.cell?.(sheet, r, c) ?? null);
        rows.push(row);
      }
      return new RangeValue(rows);
    }
    case 'unary': {
      const n = toNumber(evaluateNode(node.arg, ctx));
      return n instanceof StarFormulaError ? n : node.op === '-' ? -n : n;
    }
    case 'percent': {
      const n = toNumber(evaluateNode(node.arg, ctx));
      return n instanceof StarFormulaError ? n : n / 100;
    }
    case 'binary':
      return binary(node.op, evaluateNode(node.left, ctx), evaluateNode(node.right, ctx));
    case 'call': {
      if (node.name === 'IF') {
        if (node.args.length < 2 || node.args.length > 3) return err('#VALUE!');
        const cond = toBoolean(evaluateNode(node.args[0], ctx));
        if (cond instanceof StarFormulaError) return cond;
        if (cond) return scalar(evaluateNode(node.args[1], ctx));
        return node.args.length > 2 ? scalar(evaluateNode(node.args[2], ctx)) : false;
      }
      const fn = Object.hasOwn(FUNCTIONS, node.name) ? FUNCTIONS[node.name] : undefined;
      if (!fn) return err('#NAME?');
      // A reference argument is a range of one cell, so SUM(A1) skips text as SUM(A1:A1) does.
      const args = node.args.map((arg) => {
        const value = evaluateNode(arg, ctx);
        return arg.type === 'ref' && !(value instanceof StarFormulaError)
          ? new RangeValue([[value as StarFormulaValue]])
          : value;
      });
      return fn(args, ctx);
    }
  }
}

function binary(op: string, l: Value, r: Value): StarFormulaValue {
  if (op === '&') {
    const a = toText(l);
    if (a instanceof StarFormulaError) return a;
    const b = toText(r);
    return b instanceof StarFormulaError ? b : a + b;
  }
  if (['=', '<>', '<', '>', '<=', '>='].includes(op)) {
    const a = scalar(l);
    if (a instanceof StarFormulaError) return a;
    const b = scalar(r);
    if (b instanceof StarFormulaError) return b;
    const c = compare(a, b);
    switch (op) {
      case '=':
        return c === 0;
      case '<>':
        return c !== 0;
      case '<':
        return c < 0;
      case '>':
        return c > 0;
      case '<=':
        return c <= 0;
      default:
        return c >= 0;
    }
  }
  const a = toNumber(l);
  if (a instanceof StarFormulaError) return a;
  const b = toNumber(r);
  if (b instanceof StarFormulaError) return b;
  switch (op) {
    case '+':
      return finite(a + b);
    case '-':
      return finite(a - b);
    case '*':
      return finite(a * b);
    case '/':
      return b === 0 ? err('#DIV/0!') : finite(a / b);
    case '^':
      return a === 0 && b < 0 ? err('#DIV/0!') : finite(a ** b);
    default:
      return err('#ERROR!');
  }
}

/**
 * Evaluates a formula (text with or without `=`, or a node from `starParseFormula`). Pure: it
 * reads cells only through `context` and never uses `eval` or `Function`.
 *
 * Supports numbers, text in double quotes, TRUE and FALSE, references (`A1`, `$A$1`, `A1:B5`,
 * `Sheet2!A1`, `'My sheet'!A1`), the operators `+ - * / ^ & = <> < > <= >=`, unary minus and
 * postfix `%`, and the functions SUM, AVERAGE, MIN, MAX, COUNT, COUNTA, IF, AND, OR, NOT, ROUND,
 * ABS, CONCAT, LEN, UPPER, LOWER, TODAY and DATE. Errors: see `StarFormulaErrorCode`. A formula
 * whose result is a range of more than one cell gives `#VALUE!`; an empty result cell gives 0.
 */
export function starEvaluate(
  formula: string | StarFormulaNode,
  context: StarFormulaContext = {},
): StarFormulaValue {
  const node = typeof formula === 'string' ? starParseFormula(formula) : formula;
  const value = scalar(evaluateNode(node, context));
  return value === null ? 0 : value;
}
