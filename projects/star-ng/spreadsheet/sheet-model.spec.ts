import { StarFormulaError } from '@star-ng/ui/spreadsheet';
import {
  starCellsFromRows,
  starCellText,
  starDescribeFormula,
  starFillCells,
  starFormatCellValue,
  starFormatDelimited,
  starParseCellText,
  starParseDelimited,
  starSheetOffsets,
  starSheetWindow,
  starUsedRange,
} from './sheet-model';

describe('cell text', () => {
  it('parses typed text into a formula, a number, a boolean or text', () => {
    expect(starParseCellText('=SUM(A1:A3)')).toEqual({ formula: '=SUM(A1:A3)' });
    expect(starParseCellText('42')).toEqual({ value: 42 });
    expect(starParseCellText(' -1.5e3 ')).toEqual({ value: -1500 });
    expect(starParseCellText('true')).toEqual({ value: true });
    expect(starParseCellText('Rent')).toEqual({ value: 'Rent' });
    expect(starParseCellText("'0042")).toEqual({ value: '0042' });
    expect(starParseCellText('=')).toEqual({ value: '=' });
    expect(starParseCellText('')).toBeNull();
  });

  it('gives the raw text of a cell for editing', () => {
    expect(starCellText({ formula: '=A1*2', value: 4 })).toBe('=A1*2');
    expect(starCellText({ value: 0.1 + 0.2 })).toBe('0.3');
    expect(starCellText({ value: false })).toBe('FALSE');
    expect(starCellText(undefined)).toBe('');
  });

  it('keeps an apostrophe for text that would read as a number, a boolean or a formula', () => {
    expect(starCellText({ value: '42' })).toBe("'42");
    expect(starCellText({ value: 'TRUE' })).toBe("'TRUE");
    expect(starCellText({ value: '=A1' })).toBe("'=A1");
    expect(starCellText({ value: "'x" })).toBe("''x");
    expect(starCellText({ value: 'Rent' })).toBe('Rent');
    expect(starCellText({ value: '' })).toBe('');
    for (const text of ['42', 'TRUE', '=A1', "'x", 'Rent']) {
      expect(starParseCellText(starCellText({ value: text }))).toEqual({ value: text });
    }
  });
});

describe('starFormatCellValue', () => {
  it('formats numbers with Intl and the locale', () => {
    expect(starFormatCellValue(1234.5, undefined, 'en-US')).toBe('1234.5');
    expect(starFormatCellValue(1234.5, { type: 'number' }, 'en-US')).toBe('1,234.50');
    expect(starFormatCellValue(1234.5, { type: 'number' }, 'de-DE')).toBe('1.234,50');
    expect(
      starFormatCellValue(1234.5, { type: 'number', decimals: 0, thousands: false }, 'en-US'),
    ).toBe('1235');
    expect(starFormatCellValue(0.256, { type: 'percent', decimals: 1 }, 'en-US')).toBe('25.6%');
    expect(starFormatCellValue(12, { type: 'currency', currency: 'EUR' }, 'en-US')).toBe('€12.00');
    expect(starFormatCellValue(46345, { type: 'date' }, 'en-US')).toBe('Nov 19, 2026');
  });

  it('gives #NUM! for a date outside the serial range instead of throwing', () => {
    expect(starFormatCellValue(2958465, { type: 'date' }, 'en-US')).toBe('Dec 31, 9999');
    expect(starFormatCellValue(2958466, { type: 'date' }, 'en-US')).toBe('#NUM!');
    expect(starFormatCellValue(1e12, { type: 'date' }, 'en-US')).toBe('#NUM!');
    expect(starFormatCellValue(0, { type: 'date' }, 'en-US')).toBe('#NUM!');
    expect(starFormatCellValue(-5, { type: 'date' }, 'en-US')).toBe('#NUM!');
  });

  it('falls back to the general format for invalid format options or locales', () => {
    expect(starFormatCellValue(12.5, { type: 'currency', currency: 'X1' }, 'en-US')).toBe('12.5');
    expect(starFormatCellValue(12.5, { type: 'number', decimals: -1 }, 'en-US')).toBe('12.5');
    expect(starFormatCellValue(12.5, { type: 'percent', decimals: 500 }, 'en-US')).toBe('12.5');
    expect(starFormatCellValue(12.5, { type: 'number' }, 'not a locale!')).toBe('12.5');
  });

  it('shows text, booleans, errors and empty cells', () => {
    expect(starFormatCellValue('Rent', { type: 'number' }, 'en-US')).toBe('Rent');
    expect(starFormatCellValue(true, undefined, 'en-US')).toBe('TRUE');
    expect(starFormatCellValue(new StarFormulaError('#DIV/0!'), undefined, 'en-US')).toBe(
      '#DIV/0!',
    );
    expect(starFormatCellValue(null, undefined, 'en-US')).toBe('');
  });
});

describe('delimited text (CSV and TSV)', () => {
  it('quotes fields with the delimiter, quotes or line breaks (RFC 4180)', () => {
    const csv = starFormatDelimited(
      [
        ['Item', 'Note'],
        ['Rent, office', 'say "hi"'],
        ['Two\nlines', ''],
      ],
      ',',
    );
    expect(csv).toBe('Item,Note\r\n"Rent, office","say ""hi"""\r\n"Two\nlines",');
  });

  it('parses quoted fields, CRLF and a final line break', () => {
    expect(starParseDelimited('a,"b,c"\r\n"d ""e""",f\r\n', ',')).toEqual([
      ['a', 'b,c'],
      ['d "e"', 'f'],
    ]);
    expect(starParseDelimited('"x\ny",z', ',')).toEqual([['x\ny', 'z']]);
    expect(starParseDelimited('', ',')).toEqual([]);
  });

  it('round-trips CSV', () => {
    const rows = [
      ['=SUM(A1:A2)', '1,5', '"q"'],
      ['', 'multi\r\nline', 'end'],
    ];
    expect(starParseDelimited(starFormatDelimited(rows, ','), ',')).toEqual(rows);
  });

  it('parses TSV as Excel and Google Sheets write it', () => {
    expect(starParseDelimited('1\t2\n3\t"a\tb"\n', '\t')).toEqual([
      ['1', '2'],
      ['3', 'a\tb'],
    ]);
  });
});

describe('cells from rows and the used range', () => {
  it('writes rows of text from an origin', () => {
    expect(
      starCellsFromRows(
        [
          ['1', 'x'],
          ['', '=A1*2'],
        ],
        { row: 1, col: 1 },
      ),
    ).toEqual({
      B2: { value: 1 },
      C2: { value: 'x' },
      C3: { formula: '=A1*2' },
    });
  });

  it('finds the used range', () => {
    expect(starUsedRange({ B2: { value: 1 }, D5: { value: 2 } })).toEqual({
      top: 0,
      left: 0,
      bottom: 4,
      right: 3,
    });
    expect(starUsedRange({})).toBeNull();
  });
});

describe('starFillCells (fill handle)', () => {
  const cells = {
    A1: { value: 1 },
    B1: { formula: '=A1*2', format: { bold: true } },
    A2: { value: 'x' },
  };

  it('repeats values and shifts relative references down', () => {
    const out = starFillCells(
      cells,
      { top: 0, left: 0, bottom: 0, right: 1 },
      { top: 0, left: 0, bottom: 2, right: 1 },
    );
    expect(out['A2']).toEqual({ value: 1 });
    expect(out['A3']).toEqual({ value: 1 });
    expect(out['B2']).toEqual({ formula: '=A2*2', format: { bold: true } });
    expect(out['B3']).toEqual({ formula: '=A3*2', format: { bold: true } });
  });

  it('repeats a block pattern to the right and clears empty sources', () => {
    const out = starFillCells(
      { A1: { value: 1 }, C1: { value: 9 } },
      { top: 0, left: 0, bottom: 0, right: 1 },
      { top: 0, left: 0, bottom: 0, right: 3 },
    );
    expect(out['C1']).toEqual({ value: 1 });
    expect(out['D1']).toBeUndefined();
  });

  it('fills upwards with negative shifts and #REF! past the edge', () => {
    const out = starFillCells(
      { A2: { formula: '=B1' } },
      { top: 1, left: 0, bottom: 1, right: 0 },
      { top: 0, left: 0, bottom: 1, right: 0 },
    );
    expect(out['A1']).toEqual({ formula: '=#REF!' });
  });
});

describe('sheet windowing', () => {
  const offsets = starSheetOffsets(1000, (i) => (i === 2 ? 50 : 20));

  it('sums sizes into offsets', () => {
    expect(offsets.slice(0, 5)).toEqual([0, 20, 40, 90, 110]);
    expect(offsets[1000]).toBe(999 * 20 + 50);
  });

  it('gives the rows in view plus an overscan', () => {
    expect(starSheetWindow(offsets, 0, 100, 0)).toEqual({ start: 0, end: 4 });
    expect(starSheetWindow(offsets, 95, 40, 0)).toEqual({ start: 3, end: 6 });
    expect(starSheetWindow(offsets, 95, 40, 2)).toEqual({ start: 1, end: 8 });
    expect(starSheetWindow(offsets, 1e9, 100, 2)).toEqual({ start: 993, end: 1000 });
    expect(starSheetWindow([0], 0, 100, 2)).toEqual({ start: 0, end: 0 });
  });
});

describe('starDescribeFormula', () => {
  const words = {
    call: (name: string, args: string) => `${name} of ${args}`,
    range: (from: string, to: string) => `${from} to ${to}`,
  };

  it('reads a formula as words', () => {
    expect(starDescribeFormula('=SUM(A1:A5)', words)).toBe('SUM of A1 to A5');
    expect(starDescribeFormula('=$B$2*10%+Sheet2!C3', words)).toBe('B2 * 10% + Sheet2 C3');
    expect(starDescribeFormula('=IF(A1>0,"yes",-1)', words)).toBe('IF of A1 > 0, yes, -1');
    expect(starDescribeFormula('=1+', words)).toBe('=1+');
  });
});
