import {
  qrEncode,
  qrFormatBits,
  qrInterleave,
  qrMode,
  qrPenalty,
  qrVersionBits,
  starEncodeQr,
  StarQrErrorCorrection,
} from './qr-encoder';

/*
 * A small QR decoder written for the tests only, straight from ISO/IEC 18004. It shares no code
 * with the encoder: it rebuilds the function pattern layout (alignment positions from the
 * spacing rule of annex E), reads and checks the format information, removes the mask, reads
 * the codewords in placement order, checks every Reed-Solomon block with syndromes, and parses
 * the bit stream back to text.
 */

/** GF(256) product by shift and add, modulo x^8 + x^4 + x^3 + x^2 + 1. */
function mul(a: number, b: number): number {
  let product = 0;
  for (let bit = 7; bit >= 0; bit--) {
    product = (product << 1) ^ (product & 0x80 ? 0x11d : 0);
    if ((b >> bit) & 1) product ^= a;
  }
  return product & 0xff;
}

/** Alignment centres from the rule of annex E: even spacing from 4v + 10 down to 6. */
function alignment(version: number): number[] {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const last = 4 * version + 10;
  const step = version === 32 ? 26 : Math.ceil((last - 6) / (count - 1) / 2) * 2;
  const positions = [6];
  for (let k = count - 2; k >= 0; k--) positions.push(last - k * step);
  return positions;
}

function functionModules(version: number): boolean[][] {
  const size = 17 + 4 * version;
  const mark = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const box = (top: number, left: number, height: number, width: number) => {
    for (let r = top; r < top + height; r++)
      for (let c = left; c < left + width; c++) mark[r][c] = true;
  };
  box(0, 0, 9, 9); // upper left finder, separator and format information
  box(0, size - 8, 9, 8); // upper right finder, separator and format information
  box(size - 8, 0, 8, 9); // lower left finder, separator, format information, dark module
  const centres = alignment(version);
  for (const row of centres) {
    for (const col of centres) {
      if (mark[row][col]) continue; // overlaps a finder pattern
      box(row - 2, col - 2, 5, 5);
    }
  }
  box(6, 0, 1, size);
  box(0, 6, size, 1);
  if (version >= 7) {
    box(size - 11, 0, 3, 6);
    box(0, size - 11, 6, 3);
  }
  return mark;
}

const MASK_RULES: ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

const LEVELS: StarQrErrorCorrection[] = ['M', 'L', 'H', 'Q'];

interface Decoded {
  version: number;
  level: StarQrErrorCorrection;
  mask: number;
  formatBits: number;
  codewords: number[];
  text: string;
  eci: number | null;
}

function readFormat(m: boolean[][]): [number, number] {
  const size = m.length;
  const first: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ]; // prettier-ignore
  const second: [number, number][] = [
    ...[1, 2, 3, 4, 5, 6, 7].map((k): [number, number] => [size - k, 8]),
    ...[8, 7, 6, 5, 4, 3, 2, 1].map((k): [number, number] => [8, size - k]),
  ];
  const read = (cells: [number, number][]) =>
    cells.reduce((bits, [r, c]) => (bits << 1) | (m[r][c] ? 1 : 0), 0);
  return [read(first), read(second)];
}

function decode(m: boolean[][]): Decoded {
  const size = m.length;
  const version = (size - 17) / 4;
  const [formatBits, copy] = readFormat(m);
  expect(copy, 'both format copies').toBe(formatBits);
  const format = formatBits ^ 0b101010000010010;
  const level = LEVELS[format >> 13];
  const mask = (format >> 10) & 7;
  // BCH check of the format information: the 15-bit word is a multiple of the generator.
  let rest = format;
  for (let bit = 14; bit >= 10; bit--) if ((rest >> bit) & 1) rest ^= 0b10100110111 << (bit - 10);
  expect(rest, 'format BCH remainder').toBe(0);

  const reserved = functionModules(version);
  const bits: number[] = [];
  let up = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right = 5;
    for (let k = 0; k < size; k++) {
      const row = up ? size - 1 - k : k;
      for (const col of [right, right - 1]) {
        if (reserved[row][col]) continue;
        bits.push((m[row][col] ? 1 : 0) ^ (MASK_RULES[mask](row, col) ? 1 : 0));
      }
    }
    up = !up;
  }
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  return { version, level, mask, formatBits, codewords, ...parse(codewords, version, level) };
}

/** Error correction per block and block count of a few versions (table 9), for de-interleaving. */
const BLOCKS: Record<string, [number, number]> = {
  '1-M': [10, 1],
  '1-Q': [13, 1],
  '1-L': [7, 1],
  '2-L': [10, 1],
  '3-M': [26, 1],
  '5-Q': [18, 4],
  '7-H': [26, 5],
  '10-H': [28, 8],
  '15-L': [22, 6],
};

function deinterleave(codewords: number[], version: number, level: StarQrErrorCorrection) {
  const [ec, count] = BLOCKS[`${version}-${level}`];
  const dataTotal = codewords.length - ec * count;
  const short = Math.floor(dataTotal / count);
  const longCount = dataTotal % count;
  const blocks: number[][] = Array.from({ length: count }, () => []);
  let index = 0;
  for (let i = 0; i <= short; i++) {
    for (let b = 0; b < count; b++) {
      const length = short + (b >= count - longCount ? 1 : 0);
      if (i < length) blocks[b].push(codewords[index++]);
    }
  }
  for (let i = 0; i < ec; i++) for (let b = 0; b < count; b++) blocks[b].push(codewords[index++]);
  // Every block is a Reed-Solomon code word: all syndromes S_i = c(α^i) are zero.
  for (const block of blocks) {
    for (let i = 0; i < ec; i++) {
      let alpha = 1;
      for (let k = 0; k < i; k++) alpha = mul(alpha, 2);
      let syndrome = 0;
      for (const codeword of block) syndrome = mul(syndrome, alpha) ^ codeword;
      expect(syndrome, `syndrome ${i}`).toBe(0);
    }
  }
  return blocks.flatMap((block) => block.slice(0, block.length - ec));
}

function parse(
  codewords: number[],
  version: number,
  level: StarQrErrorCorrection,
): { text: string; eci: number | null } {
  const data = deinterleave(codewords, version, level);
  const bits = data.flatMap((byte) => [7, 6, 5, 4, 3, 2, 1, 0].map((k) => (byte >> k) & 1));
  let at = 0;
  const take = (length: number) => {
    let value = 0;
    for (let k = 0; k < length; k++) value = (value << 1) | bits[at++];
    return value;
  };
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  let text = '';
  let eci: number | null = null;
  for (;;) {
    if (at + 4 > bits.length) break;
    const mode = take(4);
    if (mode === 0) break;
    if (mode === 0b0111) {
      eci = take(8);
      continue;
    }
    if (mode === 0b0001) {
      let count = take([10, 12, 14][band]);
      while (count >= 3) {
        text += String(take(10)).padStart(3, '0');
        count -= 3;
      }
      if (count === 2) text += String(take(7)).padStart(2, '0');
      if (count === 1) text += String(take(4));
    } else if (mode === 0b0010) {
      const set = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
      let count = take([9, 11, 13][band]);
      while (count >= 2) {
        const pair = take(11);
        text += set[Math.floor(pair / 45)] + set[pair % 45];
        count -= 2;
      }
      if (count) text += set[take(6)];
    } else if (mode === 0b0100) {
      const count = take([8, 16, 16][band]);
      const bytes = Array.from({ length: count }, () => take(8));
      text += new TextDecoder(eci === 26 ? 'utf-8' : 'latin1').decode(new Uint8Array(bytes));
    } else {
      throw new Error(`unknown mode ${mode}`);
    }
  }
  return { text, eci };
}

describe('QR encoder (ISO/IEC 18004)', () => {
  it('computes the format information of table C.1', () => {
    expect(qrFormatBits('L', 0)).toBe(0b111011111000100);
    expect(qrFormatBits('M', 0)).toBe(0b101010000010010);
    expect(qrFormatBits('Q', 0)).toBe(0b011010101011111);
    expect(qrFormatBits('H', 0)).toBe(0b001011010001001);
    // The 32 format words differ pairwise in at least 7 bits (BCH (15, 5) code).
    const words = (['L', 'M', 'Q', 'H'] as const).flatMap((level) =>
      [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => qrFormatBits(level, mask)),
    );
    for (let a = 0; a < words.length; a++) {
      for (let b = a + 1; b < words.length; b++) {
        let diff = words[a] ^ words[b];
        let count = 0;
        while (diff) {
          count += diff & 1;
          diff >>= 1;
        }
        expect(count).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it('computes the version information of table D.1', () => {
    expect(qrVersionBits(7)).toBe(0x07c94);
    expect(qrVersionBits(8)).toBe(0x085bc);
  });

  it('selects the numeric, alphanumeric or byte mode', () => {
    expect(qrMode('01234567')).toBe('numeric');
    expect(qrMode('HELLO WORLD')).toBe('alphanumeric');
    expect(qrMode('Hello')).toBe('byte');
    expect(qrMode('Grüße')).toBe('byte');
  });

  it('encodes "HELLO WORLD" 1-Q to the published codewords', () => {
    const code = qrEncode('HELLO WORLD', { errorCorrection: 'Q' });
    expect(code.version).toBe(1);
    expect(code.mode).toBe('alphanumeric');
    const decoded = decode(code.modules);
    expect(decoded.level).toBe('Q');
    expect(decoded.mask).toBe(code.mask);
    expect(decoded.formatBits).toBe(qrFormatBits('Q', code.mask));
    expect(decoded.codewords).toEqual([
      32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236,
      168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16,
    ]); // prettier-ignore
    expect(decoded.text).toBe('HELLO WORLD');
  });

  it('encodes "01234567" 1-M to the codewords of annex I', () => {
    const code = qrEncode('01234567', { errorCorrection: 'M' });
    expect(code.version).toBe(1);
    expect(code.mode).toBe('numeric');
    const decoded = decode(code.modules);
    expect(decoded.codewords).toEqual([
      16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17,
      165, 36, 212, 193, 237, 54, 199, 135, 44, 85,
    ]); // prettier-ignore
    expect(decoded.text).toBe('01234567');
  });

  it('encodes a link in byte mode and decodes it back', () => {
    const value = 'https://example.com/orders/1042';
    const code = qrEncode(value);
    expect(code.mode).toBe('byte');
    expect(code.version).toBe(3);
    const decoded = decode(code.modules);
    expect(decoded.level).toBe('M');
    expect(decoded.text).toBe(value);
    expect(decoded.eci).toBeNull();
  });

  it('encodes text outside ASCII as UTF-8 with the ECI designator 26', () => {
    const value = 'Grüße aus Köln, 東京';
    const decoded = decode(starEncodeQr(value, { errorCorrection: 'L' }));
    expect(decoded.eci).toBe(26);
    expect(decoded.text).toBe(value);
  });

  it('interleaves several blocks and keeps each block a valid Reed-Solomon code word', () => {
    // 5-Q: 2 blocks of 15 and 2 blocks of 16 data codewords, 18 error correction codewords each.
    const value = 'INVOICE 2026-0042 TOTAL 1234.50 EUR PAID';
    const code = qrEncode(value, { errorCorrection: 'Q', minVersion: 5 });
    expect(code.version).toBe(5);
    const decoded = decode(code.modules);
    expect(decoded.codewords).toHaveLength(134);
    expect(decoded.text).toBe(value);

    const data = Array.from({ length: 62 }, (_, i) => i);
    const final = qrInterleave(data, 5, 'Q');
    expect(final).toHaveLength(62 + 4 * 18);
    expect(final.slice(0, 8)).toEqual([0, 15, 30, 46, 1, 16, 31, 47]);
    // The last data codewords come from the two long blocks only.
    expect(final.slice(56, 62)).toEqual([14, 29, 44, 60, 45, 61]);
  });

  it('writes the version information in both blocks from version 7', () => {
    const value = 'A'.repeat(50) + ' 0123456789'.repeat(3);
    const code = qrEncode(value, { errorCorrection: 'H', minVersion: 7 });
    expect(code.version).toBe(7);
    const m = code.modules;
    const size = m.length;
    let lowerLeft = 0;
    let upperRight = 0;
    for (let i = 17; i >= 0; i--) {
      lowerLeft = (lowerLeft << 1) | (m[size - 11 + (i % 3)][Math.floor(i / 3)] ? 1 : 0);
      upperRight = (upperRight << 1) | (m[Math.floor(i / 3)][size - 11 + (i % 3)] ? 1 : 0);
    }
    expect(lowerLeft).toBe(0x07c94);
    expect(upperRight).toBe(0x07c94);
    expect(decode(m).text).toBe(value);
  });

  it('decodes larger symbols with many blocks', () => {
    const value = 'Order 1042 shipped to Example Street 5, Springfield. '.repeat(5);
    // 265 bytes: 16-H holds 250 bytes, 17-H holds 280.
    expect(qrEncode(value, { errorCorrection: 'H' }).version).toBe(17);
    const low = qrEncode(value, { errorCorrection: 'L', minVersion: 15 });
    expect(low.version).toBe(15);
    expect(decode(low.modules).text).toBe(value);
    // 100 bytes: 9-H holds 97 bytes, 10-H holds 119 (8 blocks).
    const ten = qrEncode(value.slice(0, 100), { errorCorrection: 'H' });
    expect(ten.version).toBe(10);
    expect(decode(ten.modules).text).toBe(value.slice(0, 100));
  });

  it('draws the finder, timing and dark modules', () => {
    const m = starEncodeQr('HELLO WORLD', { errorCorrection: 'Q' });
    expect(m).toHaveLength(21);
    const finder = ['1111111', '1000001', '1011101', '1011101', '1011101', '1000001', '1111111'];
    for (const [top, left] of [
      [0, 0],
      [0, 14],
      [14, 0],
    ]) {
      const rows = finder.map((_, r) =>
        m[top + r]
          .slice(left, left + 7)
          .map((dark) => (dark ? '1' : '0'))
          .join(''),
      );
      expect(rows).toEqual(finder);
    }
    expect(m[6].slice(8, 13).map(Number)).toEqual([1, 0, 1, 0, 1]);
    expect(m.slice(8, 13).map((row) => Number(row[6]))).toEqual([1, 0, 1, 0, 1]);
    expect(m[13][8]).toBe(true);
  });

  it('picks the version from the capacity of table 7', () => {
    expect(qrEncode('1'.repeat(41), { errorCorrection: 'L' }).version).toBe(1);
    expect(qrEncode('1'.repeat(42), { errorCorrection: 'L' }).version).toBe(2);
    expect(qrEncode('A'.repeat(25), { errorCorrection: 'L' }).version).toBe(1);
    expect(qrEncode('A'.repeat(26), { errorCorrection: 'L' }).version).toBe(2);
    expect(qrEncode('a'.repeat(17), { errorCorrection: 'L' }).version).toBe(1);
    expect(qrEncode('a'.repeat(18), { errorCorrection: 'L' }).version).toBe(2);
    expect(qrEncode('1'.repeat(7089), { errorCorrection: 'L' }).version).toBe(40);
    expect(qrEncode('a'.repeat(2953), { errorCorrection: 'L' }).version).toBe(40);
    expect(() => qrEncode('1'.repeat(7090), { errorCorrection: 'L' })).toThrow(RangeError);
    expect(() => qrEncode('a'.repeat(1274), { errorCorrection: 'H' })).toThrow(RangeError);
  });

  it('chooses the mask with the lowest penalty', () => {
    for (const value of ['HELLO WORLD', 'https://example.com/orders/1042', '01234567']) {
      const chosen = qrEncode(value);
      const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) =>
        qrPenalty(qrEncode(value, { mask }).modules),
      );
      expect(qrPenalty(chosen.modules)).toBe(Math.min(...scores));
      expect(scores.indexOf(Math.min(...scores))).toBe(chosen.mask);
    }
  });

  it('scores the penalty rules N1 to N4', () => {
    // All light 21 × 21: N1 = 42 lines × (3 + 16), N2 = 400 × 3, N3 = 0, N4 = 10 × 10.
    const light = Array.from({ length: 21 }, () => new Array<boolean>(21).fill(false));
    expect(qrPenalty(light)).toBe(42 * 19 + 400 * 3 + 100);
    // A checkerboard: no runs, no blocks, no finder-like pattern, about 50 % dark.
    const board = Array.from({ length: 21 }, (_, r) =>
      Array.from({ length: 21 }, (_, c) => (r + c) % 2 === 0),
    );
    expect(qrPenalty(board)).toBe(0);
  });
});
