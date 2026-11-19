import {
  starCellAddress,
  starColumnIndex,
  starColumnName,
  starEvaluate,
  StarFormulaContext,
  StarFormulaError,
  starFormulaReferences,
  StarFormulaValue,
  starIsFormulaError,
  starParseAddress,
  starParseFormula,
  starShiftFormula,
  starTokenizeFormula,
} from '@star-ng/ui/spreadsheet';

/** A context over a fixed map of `Sheet!A1` values. */
function ctx(
  values: Record<string, StarFormulaValue>,
  extra: Partial<StarFormulaContext> = {},
): StarFormulaContext {
  const sheets = new Set(['sheet1', 'sheet2', 'my sheet']);
  for (const key of Object.keys(values)) sheets.add(key.split('!')[0].toLowerCase());
  return {
    sheet: 'Sheet1',
    cell: (sheet, row, col) => {
      const key = `${sheet}!${starCellAddress(row, col)}`.toLowerCase();
      for (const [k, v] of Object.entries(values)) if (k.toLowerCase() === key) return v;
      return null;
    },
    hasSheet: (sheet) => sheets.has(sheet.toLowerCase()),
    today: () => new Date(2026, 10, 19),
    ...extra,
  };
}

function code(value: StarFormulaValue): string | null {
  return starIsFormulaError(value) ? value.code : null;
}

describe('formula addresses', () => {
  it('converts column indexes and names', () => {
    expect(starColumnName(0)).toBe('A');
    expect(starColumnName(25)).toBe('Z');
    expect(starColumnName(26)).toBe('AA');
    expect(starColumnName(701)).toBe('ZZ');
    expect(starColumnName(702)).toBe('AAA');
    expect(starColumnIndex('A')).toBe(0);
    expect(starColumnIndex('z')).toBe(25);
    expect(starColumnIndex('AA')).toBe(26);
    expect(starColumnIndex('AAA')).toBe(702);
    expect(starColumnIndex('1')).toBe(-1);
    expect(starColumnIndex('')).toBe(-1);
  });

  it('parses and formats cell addresses', () => {
    expect(starCellAddress(0, 0)).toBe('A1');
    expect(starCellAddress(9, 27)).toBe('AB10');
    expect(starParseAddress('B3')).toEqual({ row: 2, col: 1 });
    expect(starParseAddress('$c$10')).toEqual({ row: 9, col: 2 });
    expect(starParseAddress('A0')).toBeNull();
    expect(starParseAddress('3B')).toBeNull();
  });
});

describe('formula tokenizer and parser', () => {
  it('tokenizes references, functions and operators', () => {
    const types = starTokenizeFormula('=SUM(A1:$B$2, Sheet2!C3) & "x" <> 1.5e2%').map(
      (t) => t.type,
    );
    expect(types).toEqual([
      'function',
      'paren',
      'reference',
      'comma',
      'reference',
      'paren',
      'operator',
      'string',
      'operator',
      'number',
      'operator',
    ]);
  });

  it('reads quoted sheet names and doubled quotes in strings', () => {
    expect(starEvaluate(`='My sheet'!A1`, ctx({ 'My sheet!A1': 7 }))).toBe(7);
    expect(starEvaluate('="say ""hi"""')).toBe('say "hi"');
  });

  it('treats a cell-like name before a parenthesis as a function', () => {
    const ast = starParseFormula('=LOG10(1)');
    expect(ast.type).toBe('call');
  });

  it('returns #ERROR! for a syntax error, never throws', () => {
    expect(code(starEvaluate('=1+'))).toBe('#ERROR!');
    expect(code(starEvaluate('=(1'))).toBe('#ERROR!');
    expect(code(starEvaluate('=SUM(1'))).toBe('#ERROR!');
    expect(code(starEvaluate('=1)'))).toBe('#ERROR!');
    expect(code(starEvaluate('="open'))).toBe('#ERROR!');
  });

  it('lists the references of a formula', () => {
    const refs = starFormulaReferences(starParseFormula('=A1+SUM(B1:C2)+Sheet2!$D$4'), 'Sheet1');
    expect(refs.cells).toEqual([
      { sheet: 'Sheet1', row: 0, col: 0 },
      { sheet: 'Sheet2', row: 3, col: 3 },
    ]);
    expect(refs.ranges).toEqual([{ sheet: 'Sheet1', top: 0, left: 1, bottom: 1, right: 2 }]);
  });
});

describe('starEvaluate: literals and operators', () => {
  it('evaluates numbers, strings and booleans', () => {
    expect(starEvaluate('=42')).toBe(42);
    expect(starEvaluate('=.5')).toBe(0.5);
    expect(starEvaluate('="text"')).toBe('text');
    expect(starEvaluate('=true')).toBe(true);
    expect(starEvaluate('=FALSE')).toBe(false);
    expect(starEvaluate('1+1')).toBe(2);
  });

  it('applies operator precedence like Excel', () => {
    expect(starEvaluate('=1+2*3')).toBe(7);
    expect(starEvaluate('=(1+2)*3')).toBe(9);
    expect(starEvaluate('=2^3^2')).toBe(64); // left-associative
    expect(starEvaluate('=-2^2')).toBe(4); // negation binds tighter than ^
    expect(starEvaluate('=2*3^2')).toBe(18);
    expect(starEvaluate('=10-4-3')).toBe(3);
    expect(starEvaluate('=12/3/2')).toBe(2);
    expect(starEvaluate('=50%')).toBe(0.5);
    expect(starEvaluate('=200*10%')).toBe(20);
    expect(starEvaluate('=1+2&"x"')).toBe('3x');
    expect(starEvaluate('=1+2=3')).toBe(true);
    expect(starEvaluate('="a"&1+1="a2"')).toBe(true);
    expect(starEvaluate('=--3')).toBe(3);
    expect(starEvaluate('=+3')).toBe(3);
  });

  it('compares numbers, text (case-insensitive) and booleans', () => {
    expect(starEvaluate('=2>1')).toBe(true);
    expect(starEvaluate('=2<=1')).toBe(false);
    expect(starEvaluate('=2>=2')).toBe(true);
    expect(starEvaluate('=2<>2')).toBe(false);
    expect(starEvaluate('="abc"="ABC"')).toBe(true);
    expect(starEvaluate('="a"<"b"')).toBe(true);
    // Type order: numbers < text < booleans.
    expect(starEvaluate('=1<"a"')).toBe(true);
    expect(starEvaluate('="z"<TRUE')).toBe(true);
    expect(starEvaluate('=A1=0', ctx({}))).toBe(true);
    expect(starEvaluate('=A1=""', ctx({}))).toBe(true);
  });

  it('coerces text and booleans in arithmetic', () => {
    expect(starEvaluate('="3"+1')).toBe(4);
    expect(starEvaluate('=TRUE+1')).toBe(2);
    expect(code(starEvaluate('="x"+1'))).toBe('#VALUE!');
    expect(starEvaluate('=A1+1', ctx({}))).toBe(1);
    expect(starEvaluate('=0.1+0.2&""')).toBe('0.3');
  });

  it('reports #DIV/0!, #VALUE!, #NAME? and #NUM!', () => {
    expect(code(starEvaluate('=1/0'))).toBe('#DIV/0!');
    expect(code(starEvaluate('=1/A1', ctx({})))).toBe('#DIV/0!');
    expect(code(starEvaluate('=FOO(1)'))).toBe('#NAME?');
    expect(code(starEvaluate('=total+1'))).toBe('#NAME?');
    expect(code(starEvaluate('=10^400'))).toBe('#NUM!');
    expect(code(starEvaluate('=A1:A2+1', ctx({})))).toBe('#VALUE!');
    expect(code(starEvaluate('=A1:A2', ctx({})))).toBe('#VALUE!');
  });

  it('propagates the first error and reads error literals', () => {
    expect(code(starEvaluate('=#REF!+1'))).toBe('#REF!');
    expect(code(starEvaluate('=A1*2', ctx({ 'Sheet1!A1': new StarFormulaError('#DIV/0!') })))).toBe(
      '#DIV/0!',
    );
    expect(code(starEvaluate('=1/0+FOO()'))).toBe('#DIV/0!');
  });
});

describe('starEvaluate: references', () => {
  const values = ctx({
    'Sheet1!A1': 1,
    'Sheet1!A2': 2,
    'Sheet1!A3': 3,
    'Sheet1!B1': 'text',
    'Sheet1!B2': true,
    'Sheet2!A1': 10,
    'Sheet2!B2': 20,
  });

  it('reads relative, absolute and mixed references', () => {
    expect(starEvaluate('=A1+A2', values)).toBe(3);
    expect(starEvaluate('=$A$1+A$2+$A3', values)).toBe(6);
    expect(starEvaluate('=a3', values)).toBe(3);
  });

  it('reads ranges in any corner order', () => {
    expect(starEvaluate('=SUM(A1:A3)', values)).toBe(6);
    expect(starEvaluate('=SUM(A3:A1)', values)).toBe(6);
    expect(starEvaluate('=SUM(A1:B3)', values)).toBe(6);
  });

  it('reads other sheets', () => {
    expect(starEvaluate('=Sheet2!A1*2', values)).toBe(20);
    expect(starEvaluate('=SUM(Sheet2!A1:B2)', values)).toBe(30);
    expect(starEvaluate('=sheet2!b2', values)).toBe(20);
  });

  it('returns #REF! for a missing sheet or a reference past the sheet limits', () => {
    expect(code(starEvaluate('=Nope!A1', values))).toBe('#REF!');
    expect(code(starEvaluate('=SUM(Nope!A1:A2)', values))).toBe('#REF!');
    expect(code(starEvaluate('=XFE1', values))).toBe('#REF!');
  });

  it('reads an empty cell as 0 in arithmetic and as "" in text', () => {
    expect(starEvaluate('=Z99*1', values)).toBe(0);
    expect(starEvaluate('=Z99&"x"', values)).toBe('x');
    expect(starEvaluate('=Z99', values)).toBe(0);
  });
});

describe('starEvaluate: functions', () => {
  const values = ctx({
    'Sheet1!A1': 4,
    'Sheet1!A2': 'x',
    'Sheet1!A3': true,
    'Sheet1!A4': -2,
    'Sheet1!A5': null,
    'Sheet1!B1': new StarFormulaError('#DIV/0!'),
  });

  it('SUM adds numbers and ignores text and booleans in ranges', () => {
    expect(starEvaluate('=SUM(1,2,3)')).toBe(6);
    expect(starEvaluate('=SUM(A1:A5)', values)).toBe(2);
    expect(starEvaluate('=SUM(A1:A5,TRUE,"3")', values)).toBe(6);
    expect(code(starEvaluate('=SUM("x")'))).toBe('#VALUE!');
    expect(code(starEvaluate('=SUM(A1:B1)', values))).toBe('#DIV/0!');
    expect(starEvaluate('=SUM()')).toBe(0);
  });

  it('AVERAGE, MIN and MAX', () => {
    expect(starEvaluate('=AVERAGE(A1:A5)', values)).toBe(1);
    expect(starEvaluate('=AVERAGE(2,4,9)')).toBe(5);
    expect(code(starEvaluate('=AVERAGE(A2:A3)', values))).toBe('#DIV/0!');
    expect(starEvaluate('=MIN(A1:A5)', values)).toBe(-2);
    expect(starEvaluate('=MAX(A1:A5, 10)', values)).toBe(10);
    expect(starEvaluate('=MAX(A2)', values)).toBe(0);
    expect(starEvaluate('=MIN()')).toBe(0);
  });

  it('COUNT and COUNTA', () => {
    expect(starEvaluate('=COUNT(A1:A5)', values)).toBe(2);
    expect(starEvaluate('=COUNT(1,"2","x",TRUE)')).toBe(3);
    expect(starEvaluate('=COUNTA(A1:A5)', values)).toBe(4);
    expect(starEvaluate('=COUNTA(A1:B1)', values)).toBe(2);
  });

  it('IF, AND, OR and NOT', () => {
    expect(starEvaluate('=IF(1>0,"yes","no")')).toBe('yes');
    expect(starEvaluate('=IF(0,"yes","no")')).toBe('no');
    expect(starEvaluate('=IF(FALSE,1)')).toBe(false);
    // Only the chosen branch is evaluated.
    expect(starEvaluate('=IF(TRUE,1,1/0)')).toBe(1);
    expect(code(starEvaluate('=IF("x",1,2)'))).toBe('#VALUE!');
    expect(starEvaluate('=AND(TRUE,1,A3)', values)).toBe(true);
    expect(starEvaluate('=AND(TRUE,0)')).toBe(false);
    expect(starEvaluate('=OR(FALSE,0,A1)', values)).toBe(true);
    expect(starEvaluate('=OR(FALSE)')).toBe(false);
    expect(code(starEvaluate('=AND(A2)', values))).toBe('#VALUE!');
    expect(starEvaluate('=NOT(TRUE)')).toBe(false);
    expect(starEvaluate('=NOT(0)')).toBe(true);
  });

  it('ROUND (half away from zero) and ABS', () => {
    expect(starEvaluate('=ROUND(2.5)')).toBe(3);
    expect(starEvaluate('=ROUND(-2.5)')).toBe(-3);
    expect(starEvaluate('=ROUND(1.005,2)')).toBe(1.01);
    expect(starEvaluate('=ROUND(1234.5,-2)')).toBe(1200);
    expect(starEvaluate('=ABS(-3)')).toBe(3);
    expect(starEvaluate('=ABS(A4)', values)).toBe(2);
  });

  it('CONCAT, LEN, UPPER and LOWER', () => {
    expect(starEvaluate('=CONCAT("a",1,TRUE)')).toBe('a1TRUE');
    expect(starEvaluate('=CONCAT(A1:A4)', values)).toBe('4xTRUE-2');
    expect(starEvaluate('=LEN("hello")')).toBe(5);
    expect(starEvaluate('=LEN(123)')).toBe(3);
    expect(starEvaluate('=UPPER("abc")')).toBe('ABC');
    expect(starEvaluate('=LOWER("ABC")')).toBe('abc');
  });

  it('TODAY and DATE give serial day numbers (1900 date system)', () => {
    expect(starEvaluate('=DATE(1900,3,1)')).toBe(61);
    expect(starEvaluate('=DATE(2026,11,19)')).toBe(46345);
    expect(starEvaluate('=DATE(2026,13,1)')).toBe(starEvaluate('=DATE(2027,1,1)'));
    expect(starEvaluate('=TODAY()', values)).toBe(46345);
    expect(code(starEvaluate('=DATE(-1,1,1)'))).toBe('#NUM!');
  });

  it('checks the number of arguments', () => {
    expect(code(starEvaluate('=NOT(1,2)'))).toBe('#VALUE!');
    expect(code(starEvaluate('=ABS()'))).toBe('#VALUE!');
    expect(code(starEvaluate('=TODAY(1)'))).toBe('#VALUE!');
  });

  it('evaluates nested calls', () => {
    expect(starEvaluate('=ROUND(AVERAGE(1,2),0)&"-"&UPPER(LOWER("Ab"))')).toBe('2-AB');
  });
});

describe('starShiftFormula (fill handle and paste)', () => {
  it('moves relative parts and keeps absolute parts', () => {
    expect(starShiftFormula('=A1+$B$1+C$1+$D1', 1, 1)).toBe('=B2+$B$1+D$1+$D2');
    expect(starShiftFormula('=SUM(A1:A5)', 0, 2)).toBe('=SUM(C1:C5)');
    expect(starShiftFormula('=Sheet2!A1*2', 3, 0)).toBe('=Sheet2!A4*2');
  });

  it('keeps strings and function names', () => {
    expect(starShiftFormula('=LOG10(A1)&"A1"', 1, 0)).toBe('=LOG10(A2)&"A1"');
  });

  it('writes #REF! for a reference that leaves the sheet', () => {
    expect(starShiftFormula('=A1+1', -1, 0)).toBe('=#REF!+1');
    expect(starShiftFormula('=SUM(A1:B2)', 0, -1)).toBe('=SUM(#REF!)');
  });
});
