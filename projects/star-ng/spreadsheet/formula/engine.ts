import { starCellAddress, StarCellRange, starParseAddress, starRangeContains } from './address';
import { starEvaluate, StarFormulaContext, StarFormulaError, StarFormulaValue } from './evaluate';
import { StarFormulaNode, starFormulaReferences, starParseFormula } from './parser';

/** The input of one cell for the engine: a formula, or a literal value. */
export interface StarFormulaCellInput {
  readonly value?: string | number | boolean | null;
  /** Formula text, with or without the leading `=`. It wins over `value`. */
  readonly formula?: string;
}

/** Options of `StarFormulaEngine`. */
export interface StarFormulaEngineOptions {
  /** Today's date for `TODAY()` (default: `new Date()`). */
  readonly today?: () => Date;
}

interface SheetState {
  readonly name: string;
  readonly inputs: Map<string, StarFormulaCellInput>;
}

interface FormulaState {
  readonly node: StarFormulaNode;
  /** Keys of the single cells it reads. */
  readonly cells: ReadonlySet<string>;
  /** Ranges it reads, with the sheet key (lower case). */
  readonly ranges: readonly (StarCellRange & { readonly sheet: string })[];
}

const CIRC = new StarFormulaError('#CIRC!');

/**
 * Formula engine of `star-spreadsheet`: cell inputs of one or more sheets, a dependency graph and
 * the computed values. Pure TypeScript (no DOM, no `eval`, no `Function`), so it runs on the
 * server and in a web worker too.
 *
 * - `setCell` recalculates only the cell and the cells that depend on it (directly or through
 *   other cells), each once, in dependency order. `lastRecalculated` lists them.
 * - A cycle (`A1` reads `B1`, `B1` reads `A1`) gives `#CIRC!` to every cell in it; cells that only
 *   read the cycle get the error through their formula.
 * - Sheet names are not case-sensitive, as in Excel. A reference to a sheet that does not exist is
 *   `#REF!`; adding the sheet later recalculates everything.
 *
 * Cell keys in `lastRecalculated` have the form `Sheet1!B3`.
 */
export class StarFormulaEngine {
  private readonly sheets = new Map<string, SheetState>();
  private readonly formulas = new Map<string, FormulaState>();
  /** Cell key to the formula cells that read it directly. */
  private readonly dependents = new Map<string, Set<string>>();
  /** Formula cells that read at least one range. */
  private readonly rangeReaders = new Set<string>();
  private readonly values = new Map<string, StarFormulaValue>();
  private recalculated: string[] = [];
  private readonly context: StarFormulaContext;

  constructor(private readonly options: StarFormulaEngineOptions = {}) {
    this.context = {
      cell: (sheet, row, col) => this.read(this.key(sheet, starCellAddress(row, col))),
      hasSheet: (sheet) => this.sheets.has(sheet.toLowerCase()),
      today: this.options.today,
    };
  }

  /** Formula cells that the last change evaluated, in evaluation order (`Sheet1!B3`). */
  get lastRecalculated(): readonly string[] {
    return this.recalculated;
  }

  /** Names of the sheets, in the order they were added. */
  sheetNames(): string[] {
    return [...this.sheets.values()].map((s) => s.name);
  }

  /** True when the sheet exists (any case). */
  hasSheet(name: string): boolean {
    return this.sheets.has(name.toLowerCase());
  }

  /** Adds or replaces a whole sheet and recalculates every formula. */
  setSheet(
    name: string,
    cells: Readonly<Record<string, StarFormulaCellInput | null | undefined>>,
  ): void {
    const lower = name.toLowerCase();
    const old = this.sheets.get(lower);
    if (old) for (const address of old.inputs.keys()) this.unlink(this.key(name, address));
    const state: SheetState = { name, inputs: new Map() };
    this.sheets.set(lower, state);
    for (const [address, input] of Object.entries(cells)) {
      const pos = starParseAddress(address);
      if (!pos || !input) continue;
      const normal = starCellAddress(pos.row, pos.col);
      state.inputs.set(normal, input);
      this.link(this.key(name, normal), name, input);
    }
    this.recalculateAll();
  }

  /** Removes a sheet. Formulas that read it get `#REF!`. */
  removeSheet(name: string): void {
    const state = this.sheets.get(name.toLowerCase());
    if (!state) return;
    for (const address of state.inputs.keys()) {
      const key = this.key(name, address);
      this.unlink(key);
      this.values.delete(key);
    }
    this.sheets.delete(name.toLowerCase());
    this.recalculateAll();
  }

  /** The input of a cell, or undefined. */
  input(sheet: string, address: string): StarFormulaCellInput | undefined {
    const pos = starParseAddress(address);
    if (!pos) return undefined;
    return this.sheets.get(sheet.toLowerCase())?.inputs.get(starCellAddress(pos.row, pos.col));
  }

  /**
   * Sets one cell (null or undefined clears it) and recalculates it and its dependents only.
   * Creates the sheet when it does not exist. Returns `lastRecalculated`.
   */
  setCell(
    sheet: string,
    address: string,
    input: StarFormulaCellInput | null | undefined,
  ): readonly string[] {
    const pos = starParseAddress(address);
    if (!pos) return (this.recalculated = []);
    if (!this.sheets.has(sheet.toLowerCase())) this.setSheet(sheet, {});
    const state = this.sheets.get(sheet.toLowerCase())!;
    const normal = starCellAddress(pos.row, pos.col);
    const key = this.key(state.name, normal);
    this.unlink(key);
    if (input && (input.formula || (input.value !== undefined && input.value !== null))) {
      state.inputs.set(normal, input);
      this.link(key, state.name, input);
    } else {
      state.inputs.delete(normal);
    }
    this.values.delete(key);
    const affected = this.collectDependents([key]);
    this.recalculate(affected);
    return this.recalculated;
  }

  /** The value of a cell: computed for a formula, the literal otherwise, null when empty. */
  value(sheet: string, address: string): StarFormulaValue {
    const pos = starParseAddress(address);
    if (!pos) return null;
    return this.read(this.key(sheet, starCellAddress(pos.row, pos.col)));
  }

  /** True when the cell holds a formula. */
  isFormula(sheet: string, address: string): boolean {
    const pos = starParseAddress(address);
    return !!pos && this.formulas.has(this.key(sheet, starCellAddress(pos.row, pos.col)));
  }

  // Internals ------------------------------------------------------------------------------

  /** Internal key of a cell: the sheet name in lower case and the normal address. */
  private key(sheet: string, address: string): string {
    return `${sheet.toLowerCase()}!${address}`;
  }

  /** Key with the sheet name as it was added, for `lastRecalculated`. */
  private display(key: string): string {
    const at = key.lastIndexOf('!');
    const sheet = key.slice(0, at);
    return `${this.sheets.get(sheet)?.name ?? sheet}${key.slice(at)}`;
  }

  private split(key: string): { sheet: string; row: number; col: number } {
    const at = key.lastIndexOf('!');
    const pos = starParseAddress(key.slice(at + 1))!;
    return { sheet: key.slice(0, at), row: pos.row, col: pos.col };
  }

  private read(key: string): StarFormulaValue {
    if (this.formulas.has(key)) return this.values.get(key) ?? null;
    const { sheet } = this.split(key);
    const input = this.sheets.get(sheet)?.inputs.get(key.slice(key.lastIndexOf('!') + 1));
    if (!input) return null;
    const v = input.value;
    return v === undefined || v === '' ? null : v;
  }

  private link(key: string, sheet: string, input: StarFormulaCellInput): void {
    if (!input.formula) return;
    const node = starParseFormula(input.formula);
    const refs = starFormulaReferences(node, sheet);
    const cells = new Set(refs.cells.map((c) => this.key(c.sheet, starCellAddress(c.row, c.col))));
    const ranges = refs.ranges.map((r) => ({ ...r, sheet: r.sheet.toLowerCase() }));
    this.formulas.set(key, { node, cells, ranges });
    for (const cell of cells) {
      let set = this.dependents.get(cell);
      if (!set) this.dependents.set(cell, (set = new Set()));
      set.add(key);
    }
    if (ranges.length) this.rangeReaders.add(key);
  }

  private unlink(key: string): void {
    const state = this.formulas.get(key);
    if (!state) return;
    for (const cell of state.cells) this.dependents.get(cell)?.delete(key);
    this.rangeReaders.delete(key);
    this.formulas.delete(key);
  }

  /** Formula cells that read `key` directly (one cell or a range). */
  private directDependents(key: string): string[] {
    const out = [...(this.dependents.get(key) ?? [])];
    if (this.rangeReaders.size) {
      const { sheet, row, col } = this.split(key);
      for (const reader of this.rangeReaders) {
        const state = this.formulas.get(reader)!;
        if (state.ranges.some((r) => r.sheet === sheet && starRangeContains(r, row, col))) {
          out.push(reader);
        }
      }
    }
    return out;
  }

  /** The keys and every cell that depends on them, transitively. */
  private collectDependents(keys: readonly string[]): Set<string> {
    const seen = new Set<string>(keys);
    const stack = [...keys];
    while (stack.length) {
      for (const next of this.directDependents(stack.pop()!)) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    return seen;
  }

  private recalculateAll(): void {
    this.recalculate(new Set(this.formulas.keys()));
  }

  /** Cells in `affected` that the formula cell reads. */
  private precedentsIn(key: string, affected: ReadonlySet<string>): string[] {
    const state = this.formulas.get(key);
    if (!state) return [];
    const out = [...state.cells].filter((c) => affected.has(c));
    if (state.ranges.length) {
      for (const other of affected) {
        if (state.cells.has(other)) continue;
        const { sheet, row, col } = this.split(other);
        if (state.ranges.some((r) => r.sheet === sheet && starRangeContains(r, row, col))) {
          out.push(other);
        }
      }
    }
    return out;
  }

  /**
   * Evaluates the formula cells of `affected` in dependency order: Tarjan's strongly connected
   * components over the "reads" edges come out precedents first. A component of more than one cell,
   * or a cell that reads itself, is a cycle and gets `#CIRC!`. Iterative, so a long chain of cells
   * does not overflow the stack.
   */
  private recalculate(affected: Set<string>): void {
    this.recalculated = [];
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let counter = 0;
    const edges = new Map<string, string[]>();
    const edgesOf = (key: string): string[] => {
      let list = edges.get(key);
      if (!list) edges.set(key, (list = this.precedentsIn(key, affected)));
      return list;
    };

    for (const root of affected) {
      if (index.has(root)) continue;
      const work: { key: string; next: number }[] = [{ key: root, next: 0 }];
      index.set(root, counter);
      low.set(root, counter++);
      stack.push(root);
      onStack.add(root);
      while (work.length) {
        const frame = work[work.length - 1];
        const list = edgesOf(frame.key);
        if (frame.next < list.length) {
          const to = list[frame.next++];
          if (!index.has(to)) {
            index.set(to, counter);
            low.set(to, counter++);
            stack.push(to);
            onStack.add(to);
            work.push({ key: to, next: 0 });
          } else if (onStack.has(to)) {
            low.set(frame.key, Math.min(low.get(frame.key)!, index.get(to)!));
          }
          continue;
        }
        work.pop();
        const parent = work[work.length - 1];
        if (parent) low.set(parent.key, Math.min(low.get(parent.key)!, low.get(frame.key)!));
        if (low.get(frame.key) === index.get(frame.key)) {
          const component: string[] = [];
          let member: string;
          do {
            member = stack.pop()!;
            onStack.delete(member);
            component.push(member);
          } while (member !== frame.key);
          this.evaluateComponent(component);
        }
      }
    }
  }

  private evaluateComponent(component: readonly string[]): void {
    const only = component[0];
    const cyclic = component.length > 1 || this.precedentsIn(only, new Set([only])).includes(only);
    for (const key of component) {
      const state = this.formulas.get(key);
      if (!state) continue;
      if (cyclic) this.values.set(key, CIRC);
      else {
        const { sheet } = this.split(key);
        const name = this.sheets.get(sheet)?.name ?? sheet;
        this.values.set(key, starEvaluate(state.node, { ...this.context, sheet: name }));
      }
      this.recalculated.push(this.display(key));
    }
  }
}
