import {
  CODE128_PATTERNS,
  code128Values,
  CODE39_PATTERNS,
  eanCheckDigit,
  starEncodeBarcode,
} from './barcode-encoder';

/** Expands bar/space widths (bar first) to a module string: 1 for a bar, 0 for a space. */
function modules(widths: readonly number[]): string {
  return widths.map((width, index) => (index % 2 ? '0' : '1').repeat(width)).join('');
}

/**
 * EAN-13 symbol characters as module strings, written independently of the encoder tables
 * (ISO/IEC 15420, table 1): set A (odd parity, "L"), set B (even parity, "G"), set C ("R").
 */
const SET_A = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];
const SET_B = SET_A.map((bits) =>
  [...bits]
    .map((bit) => (bit === '1' ? '0' : '1'))
    .reverse()
    .join(''),
);
const SET_C = SET_A.map((bits) => [...bits].map((bit) => (bit === '1' ? '0' : '1')).join(''));
/** Sets A/B of the six left digits, chosen by the leading digit (ISO/IEC 15420, table 2). */
const LEADING = [
  'AAAAAA',
  'AABABB',
  'AABBAB',
  'AABBBA',
  'ABAABB',
  'ABBAAB',
  'ABBBAA',
  'ABABAB',
  'ABABBA',
  'ABBABA',
];

function eanModules(digits: string): string {
  const sets = LEADING[+digits[0]];
  let out = '101';
  for (let i = 1; i <= 6; i++) out += (sets[i - 1] === 'A' ? SET_A : SET_B)[+digits[i]];
  out += '01010';
  for (let i = 7; i <= 12; i++) out += SET_C[+digits[i]];
  return out + '101';
}

describe('Code 128 tables', () => {
  it('has 106 symbol patterns of 11 modules with an even bar sum, and a 13 module stop', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.slice(0, 106).forEach((pattern, value) => {
      const widths = [...pattern].map(Number);
      expect(widths, `value ${value}`).toHaveLength(6);
      expect(
        widths.reduce((a, b) => a + b),
        `value ${value}`,
      ).toBe(11);
      expect((widths[0] + widths[2] + widths[4]) % 2, `value ${value}`).toBe(0);
    });
    expect(CODE128_PATTERNS[106]).toBe('2331112');
    expect(new Set(CODE128_PATTERNS).size).toBe(107);
  });

  it('keeps the start characters at 103 (A), 104 (B) and 105 (C)', () => {
    expect(CODE128_PATTERNS[103]).toBe('211412');
    expect(CODE128_PATTERNS[104]).toBe('211214');
    expect(CODE128_PATTERNS[105]).toBe('211232');
  });
});

describe('Code 128 encodation (ISO/IEC 15417, annex E)', () => {
  it('uses subset B for text, with the modulo 103 check character', () => {
    // "PJJ123C": start B 104; values P=48, J=42, J=42, 1=17, 2=18, 3=19, C=35.
    // Check: (104 + 1*48 + 2*42 + 3*42 + 4*17 + 5*18 + 6*19 + 7*35) mod 103
    //      = (104 + 48 + 84 + 126 + 68 + 90 + 114 + 245) mod 103 = 879 mod 103 = 55.
    expect(code128Values('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55]);
  });

  it('starts in subset C for an even run of four or more digits', () => {
    // 12 34 56: start C 105; check (105 + 12 + 2*34 + 3*56) mod 103 = 353 mod 103 = 44.
    expect(code128Values('123456')).toEqual([105, 12, 34, 56, 44]);
    // Exactly two digits use start C too: (105 + 42) mod 103 = 44.
    expect(code128Values('42')).toEqual([105, 42, 44]);
  });

  it('switches to subset C inside text after the first digit of an odd run', () => {
    // "AB12345": B A B 1, CODE C (99), 23, 45.
    const values = code128Values('AB12345')!;
    expect(values.slice(0, -1)).toEqual([104, 33, 34, 17, 99, 23, 45]);
    const sum = 104 + 33 + 2 * 34 + 3 * 17 + 4 * 99 + 5 * 23 + 6 * 45;
    expect(values.at(-1)).toBe(sum % 103);
  });

  it('leaves subset C for the last odd digit', () => {
    // "12345": start C, 12, 34, CODE B (100), 5.
    const values = code128Values('12345')!;
    expect(values.slice(0, -1)).toEqual([105, 12, 34, 100, 21]);
  });

  it('uses subset A for control characters and a shift for a single change', () => {
    // A tab before any lower case letter: start A; tab = 9 + 64 = 73.
    expect(code128Values('A\tB')!.slice(0, -1)).toEqual([103, 33, 73, 34]);
    // One control character inside lower case text: SHIFT (98) in subset B.
    expect(code128Values('ab\tcd')!.slice(0, -1)).toEqual([104, 65, 66, 98, 73, 67, 68]);
  });

  it('rejects characters outside ASCII and empty values', () => {
    expect(code128Values('café')).toBeNull();
    expect(code128Values('')).toBeNull();
  });

  it('draws start, data, check and stop with quiet zones of ten modules', () => {
    const result = starEncodeBarcode('42', 'code128')!;
    const expected = [105, 42, 44].map((value) => CODE128_PATTERNS[value]).join('') + '2331112';
    expect(result.bars.join('')).toBe(expected);
    expect(result.bars.reduce((a, b) => a + b)).toBe(3 * 11 + 13);
    expect(result.quiet).toEqual([10, 10]);
    expect(result.text).toBe('42');
  });
});

describe('EAN-13 and UPC-A (ISO/IEC 15420)', () => {
  it('computes the modulo 10 check digit', () => {
    expect(eanCheckDigit('590123412345')).toBe(7);
    expect(eanCheckDigit('400638133393')).toBe(1);
    expect(eanCheckDigit('003600029145')).toBe(2);
  });

  it('encodes 5901234123457 to the 95 modules of the standard', () => {
    const result = starEncodeBarcode('5901234123457', 'ean13')!;
    expect(modules(result.bars)).toBe(eanModules('5901234123457'));
    expect(modules(result.bars)).toHaveLength(95);
    expect(result.text).toBe('5901234123457');
    expect(result.quiet).toEqual([11, 7]);
  });

  it('adds the check digit to 12 digits and rejects a wrong one', () => {
    expect(starEncodeBarcode('400638133393', 'ean13')?.text).toBe('4006381333931');
    expect(starEncodeBarcode('4006381333932', 'ean13')).toBeNull();
    expect(starEncodeBarcode('40063813339', 'ean13')).toBeNull();
    expect(starEncodeBarcode('40063813339A', 'ean13')).toBeNull();
  });

  it('encodes UPC-A as EAN-13 with a leading zero', () => {
    const result = starEncodeBarcode('036000291452', 'upca')!;
    expect(modules(result.bars)).toBe(eanModules('0036000291452'));
    expect(result.text).toBe('036000291452');
    expect(result.quiet).toEqual([9, 9]);
    expect(starEncodeBarcode('03600029145', 'upca')?.text).toBe('036000291452');
    expect(starEncodeBarcode('036000291453', 'upca')).toBeNull();
  });
});

describe('Code 39 (ISO/IEC 16388)', () => {
  it('has 44 patterns of 9 elements with exactly 3 wide ones', () => {
    expect(Object.keys(CODE39_PATTERNS)).toHaveLength(44);
    for (const [char, pattern] of Object.entries(CODE39_PATTERNS)) {
      expect(pattern, char).toMatch(/^[nw]{9}$/);
      expect(pattern.replace(/n/g, ''), char).toHaveLength(3);
    }
    expect(new Set(Object.values(CODE39_PATTERNS)).size).toBe(44);
  });

  it('wraps the data in start and stop characters with a narrow gap', () => {
    const result = starEncodeBarcode('A1', 'code39')!;
    // "*" = 100101101101, "A" = 110101001011, "1" = 110100101011 with narrow 1 and wide 2 modules;
    // the encoder uses wide 3, so compare the narrow/wide sequence instead.
    const wide = result.bars.map((width) => (width === 3 ? 'w' : 'n')).join('');
    expect(wide).toBe(
      [CODE39_PATTERNS['*'], CODE39_PATTERNS['A'], CODE39_PATTERNS['1'], CODE39_PATTERNS['*']].join(
        'n',
      ),
    );
    expect(CODE39_PATTERNS['*']).toBe('nwnnwnwnn');
    expect(CODE39_PATTERNS['A']).toBe('wnnnnwnnw');
    expect(CODE39_PATTERNS['1']).toBe('wnnwnnnnw');
    expect(CODE39_PATTERNS['0']).toBe('nnnwwnwnn');
    expect(result.text).toBe('A1');
    expect(result.quiet).toEqual([10, 10]);
  });

  it('rejects characters outside the set and the start character in the data', () => {
    expect(starEncodeBarcode('abc', 'code39')).toBeNull();
    expect(starEncodeBarcode('A*B', 'code39')).toBeNull();
    expect(starEncodeBarcode('PART-42 $/+%.', 'code39')?.text).toBe('PART-42 $/+%.');
  });
});
