import { StarCellRange } from './address';
import { StarFormulaRefPart, StarFormulaToken, starTokenizeFormula } from './tokenizer';

/** A node of a parsed formula (abstract syntax tree). */
export type StarFormulaNode =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'boolean'; readonly value: boolean }
  /** An error literal, or `#ERROR!` for a formula that cannot be parsed. */
  | { readonly type: 'error'; readonly code: string }
  | { readonly type: 'ref'; readonly sheet: string | null; readonly ref: StarFormulaRefPart }
  | {
      readonly type: 'range';
      readonly sheet: string | null;
      readonly from: StarFormulaRefPart;
      readonly to: StarFormulaRefPart;
    }
  | { readonly type: 'name'; readonly name: string }
  | { readonly type: 'call'; readonly name: string; readonly args: readonly StarFormulaNode[] }
  | { readonly type: 'unary'; readonly op: '-' | '+'; readonly arg: StarFormulaNode }
  | { readonly type: 'percent'; readonly arg: StarFormulaNode }
  | {
      readonly type: 'binary';
      readonly op: string;
      readonly left: StarFormulaNode;
      readonly right: StarFormulaNode;
    };

class SyntaxFail extends Error {}

/** Binary operator levels, from the loosest to the tightest. */
const LEVELS: readonly (readonly string[])[] = [
  ['=', '<>', '<', '>', '<=', '>='],
  ['&'],
  ['+', '-'],
  ['*', '/'],
  ['^'],
];

/**
 * Parses a formula (with or without the leading `=`) into a syntax tree. Precedence follows Excel,
 * from the loosest: comparison, `&`, `+ -`, `* /`, `^` (left-associative), postfix `%`, then
 * unary minus and plus (so `-2^2` is 4). A formula that cannot be parsed gives the node
 * `{ type: 'error', code: '#ERROR!' }`; the parser never throws.
 */
export function starParseFormula(formula: string): StarFormulaNode {
  const tokens = starTokenizeFormula(formula);
  let pos = 0;
  const peek = (): StarFormulaToken | undefined => tokens[pos];
  const isOp = (values: readonly string[]): boolean => {
    const t = peek();
    return t?.type === 'operator' && values.includes(t.value);
  };

  const binary = (level: number): StarFormulaNode => {
    if (level >= LEVELS.length) return percent();
    let left = binary(level + 1);
    while (isOp(LEVELS[level])) {
      const op = (tokens[pos++] as { value: string }).value;
      left = { type: 'binary', op, left, right: binary(level + 1) };
    }
    return left;
  };
  const percent = (): StarFormulaNode => {
    let node = unary();
    while (isOp(['%'])) {
      pos++;
      node = { type: 'percent', arg: node };
    }
    return node;
  };
  const unary = (): StarFormulaNode => {
    if (isOp(['-', '+'])) {
      const op = (tokens[pos++] as { value: string }).value as '-' | '+';
      return { type: 'unary', op, arg: unary() };
    }
    return primary();
  };
  const primary = (): StarFormulaNode => {
    const t = tokens[pos++];
    if (!t) throw new SyntaxFail();
    switch (t.type) {
      case 'number':
      case 'string':
      case 'boolean':
        return { type: t.type, value: t.value } as StarFormulaNode;
      case 'error':
        return { type: 'error', code: t.value };
      case 'name':
        return { type: 'name', name: t.value };
      case 'reference':
        return t.to
          ? { type: 'range', sheet: t.sheet, from: t.from, to: t.to }
          : { type: 'ref', sheet: t.sheet, ref: t.from };
      case 'function': {
        pos++; // "("
        const args: StarFormulaNode[] = [];
        if (peek()?.type === 'paren' && (peek() as { value: string }).value === ')') {
          pos++;
          return { type: 'call', name: t.value, args };
        }
        for (;;) {
          args.push(binary(0));
          const next = tokens[pos++];
          if (next?.type === 'comma') continue;
          if (next?.type === 'paren' && next.value === ')') break;
          throw new SyntaxFail();
        }
        return { type: 'call', name: t.value, args };
      }
      case 'paren': {
        if (t.value !== '(') throw new SyntaxFail();
        const inner = binary(0);
        const close = tokens[pos++];
        if (close?.type !== 'paren' || close.value !== ')') throw new SyntaxFail();
        return inner;
      }
      default:
        throw new SyntaxFail();
    }
  };

  try {
    if (!tokens.length) throw new SyntaxFail();
    const node = binary(0);
    if (pos < tokens.length) throw new SyntaxFail();
    return node;
  } catch (e) {
    if (e instanceof SyntaxFail) return { type: 'error', code: '#ERROR!' };
    throw e;
  }
}

/** A cell that a formula reads, with the sheet resolved. */
export interface StarFormulaCellReference {
  readonly sheet: string;
  readonly row: number;
  readonly col: number;
}

/** A range that a formula reads, with the sheet resolved. */
export interface StarFormulaRangeReference extends StarCellRange {
  readonly sheet: string;
}

/**
 * The cells and ranges that a parsed formula reads. References without a sheet get
 * `defaultSheet`. The spreadsheet engine builds its dependency graph from them.
 */
export function starFormulaReferences(
  node: StarFormulaNode,
  defaultSheet: string,
): { cells: StarFormulaCellReference[]; ranges: StarFormulaRangeReference[] } {
  const cells: StarFormulaCellReference[] = [];
  const ranges: StarFormulaRangeReference[] = [];
  const visit = (n: StarFormulaNode): void => {
    switch (n.type) {
      case 'ref':
        cells.push({ sheet: n.sheet ?? defaultSheet, row: n.ref.row, col: n.ref.col });
        break;
      case 'range':
        ranges.push({
          sheet: n.sheet ?? defaultSheet,
          top: Math.min(n.from.row, n.to.row),
          left: Math.min(n.from.col, n.to.col),
          bottom: Math.max(n.from.row, n.to.row),
          right: Math.max(n.from.col, n.to.col),
        });
        break;
      case 'call':
        n.args.forEach(visit);
        break;
      case 'unary':
      case 'percent':
        visit(n.arg);
        break;
      case 'binary':
        visit(n.left);
        visit(n.right);
        break;
    }
  };
  visit(node);
  return { cells, ranges };
}
