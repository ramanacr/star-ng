import { StarFormulaEngine, StarFormulaValue, starIsFormulaError } from '@star-ng/ui/spreadsheet';

function code(value: StarFormulaValue): string | null {
  return starIsFormulaError(value) ? value.code : null;
}

describe('StarFormulaEngine', () => {
  let engine: StarFormulaEngine;

  beforeEach(() => {
    engine = new StarFormulaEngine({ today: () => new Date(2026, 10, 19) });
    engine.setSheet('Sheet1', {
      A1: { value: 2 },
      A2: { value: 3 },
      B1: { formula: '=A1*10' },
      C1: { formula: '=B1+1' },
      D1: { formula: '=SUM(A1:A3)' },
      E1: { formula: '=Z9+1' },
    });
  });

  it('computes every formula when a sheet is set', () => {
    expect(engine.value('Sheet1', 'B1')).toBe(20);
    expect(engine.value('Sheet1', 'C1')).toBe(21);
    expect(engine.value('Sheet1', 'D1')).toBe(5);
    expect(engine.value('Sheet1', 'A1')).toBe(2);
    expect(engine.value('Sheet1', 'Q1')).toBeNull();
    expect(engine.isFormula('Sheet1', 'B1')).toBe(true);
    expect(engine.input('Sheet1', 'b1')).toEqual({ formula: '=A1*10' });
  });

  it('recalculates only the dependents of a changed cell, in dependency order', () => {
    const order = engine.setCell('Sheet1', 'A1', { value: 5 });
    expect(order).toEqual(['Sheet1!B1', 'Sheet1!C1', 'Sheet1!D1'].sort(byOrder(order)));
    expect(order.indexOf('Sheet1!B1')).toBeLessThan(order.indexOf('Sheet1!C1'));
    expect(order).not.toContain('Sheet1!E1');
    expect(engine.value('Sheet1', 'C1')).toBe(51);
    expect(engine.value('Sheet1', 'D1')).toBe(8);
  });

  it('recalculates a cell that a range reads, also when it was empty before', () => {
    const order = engine.setCell('Sheet1', 'A3', { value: 10 });
    expect(order).toEqual(['Sheet1!D1']);
    expect(engine.value('Sheet1', 'D1')).toBe(15);
  });

  it('relinks a formula that changes its references', () => {
    engine.setCell('Sheet1', 'B1', { formula: '=A2*10' });
    expect(engine.value('Sheet1', 'C1')).toBe(31);
    expect(engine.setCell('Sheet1', 'A1', { value: 100 })).toEqual(['Sheet1!D1']);
    expect(engine.setCell('Sheet1', 'A2', { value: 4 })).toContain('Sheet1!C1');
    expect(engine.value('Sheet1', 'C1')).toBe(41);
  });

  it('clears a cell', () => {
    engine.setCell('Sheet1', 'A1', null);
    expect(engine.value('Sheet1', 'B1')).toBe(0);
    expect(engine.input('Sheet1', 'A1')).toBeUndefined();
  });

  it('detects direct, indirect and range cycles with #CIRC!', () => {
    engine.setCell('Sheet1', 'F1', { formula: '=F1+1' });
    expect(code(engine.value('Sheet1', 'F1'))).toBe('#CIRC!');

    engine.setCell('Sheet1', 'G1', { formula: '=H1' });
    engine.setCell('Sheet1', 'H1', { formula: '=I1' });
    engine.setCell('Sheet1', 'I1', { formula: '=G1' });
    expect(code(engine.value('Sheet1', 'G1'))).toBe('#CIRC!');
    expect(code(engine.value('Sheet1', 'H1'))).toBe('#CIRC!');
    expect(code(engine.value('Sheet1', 'I1'))).toBe('#CIRC!');

    engine.setCell('Sheet1', 'J5', { formula: '=SUM(J1:J10)' });
    expect(code(engine.value('Sheet1', 'J5'))).toBe('#CIRC!');
  });

  it('gives the cycle error to readers of a cycle, and recovers when the cycle breaks', () => {
    engine.setCell('Sheet1', 'G1', { formula: '=H1' });
    engine.setCell('Sheet1', 'H1', { formula: '=G1' });
    engine.setCell('Sheet1', 'K1', { formula: '=G1*2' });
    engine.setCell('Sheet1', 'K2', { formula: '=IF(TRUE,1,G1)' });
    expect(code(engine.value('Sheet1', 'K1'))).toBe('#CIRC!');
    expect(engine.value('Sheet1', 'K2')).toBe(1);
    engine.setCell('Sheet1', 'H1', { value: 4 });
    expect(engine.value('Sheet1', 'G1')).toBe(4);
    expect(engine.value('Sheet1', 'K1')).toBe(8);
  });

  it('reads other sheets, with names in any case, and #REF! for missing sheets', () => {
    engine.setCell('Sheet1', 'L1', { formula: '=Data!A1*2' });
    expect(code(engine.value('Sheet1', 'L1'))).toBe('#REF!');
    engine.setSheet('Data', { A1: { value: 21 } });
    expect(engine.value('Sheet1', 'L1')).toBe(42);
    expect(engine.setCell('data', 'A1', { value: 1 })).toEqual(['Sheet1!L1']);
    expect(engine.value('Sheet1', 'L1')).toBe(2);
    engine.removeSheet('Data');
    expect(code(engine.value('Sheet1', 'L1'))).toBe('#REF!');
    expect(engine.sheetNames()).toEqual(['Sheet1']);
  });

  it('handles a long chain without overflowing the stack', () => {
    const cells: Record<string, { value?: number; formula?: string }> = { A1: { value: 1 } };
    for (let r = 2; r <= 5000; r++) cells[`A${r}`] = { formula: `=A${r - 1}+1` };
    engine.setSheet('Long', cells);
    expect(engine.value('Long', 'A5000')).toBe(5000);
    expect(engine.setCell('Long', 'A1', { value: 2 })).toHaveLength(4999);
    expect(engine.value('Long', 'A5000')).toBe(5001);
  });

  it('evaluates TODAY with the engine date', () => {
    engine.setCell('Sheet1', 'M1', { formula: '=TODAY()-DATE(2026,11,1)' });
    expect(engine.value('Sheet1', 'M1')).toBe(18);
  });
});

/** Keeps the order of `actual` for the items of a sorted list, so toEqual checks the set. */
function byOrder(actual: readonly string[]): (a: string, b: string) => number {
  return (a, b) => actual.indexOf(a) - actual.indexOf(b);
}
