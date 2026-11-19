/**
 * QR Code model 2 encoder, written from ISO/IEC 18004:2015. Pure functions without browser
 * APIs, so a symbol can be built on the server or in a print pipeline.
 *
 * Steps (clause numbers of the standard):
 * 1. Mode selection (7.3): numeric, alphanumeric, or byte for any other text. Byte mode encodes
 *    UTF-8; text outside ASCII gets the ECI designator 26 (UTF-8) in front (7.3.2).
 * 2. Version selection: the smallest version (1 to 40) whose data capacity fits the bits.
 * 3. Bit stream (7.4): mode indicator, character count, data, terminator, pad bits and the pad
 *    codewords 0xEC and 0x11.
 * 4. Error correction (7.5): blocks per table 9, Reed-Solomon codewords per block, then the
 *    codewords interleaved (7.6).
 * 5. Module placement (7.7): function patterns, then the codewords in two-module columns from
 *    the lower right corner.
 * 6. Masking (7.8): each of the 8 masks is applied and scored with the penalty rules N1 to N4;
 *    the lowest score wins.
 * 7. Format information (7.9) and version information (7.10), BCH coded.
 */
import { rsRemainder } from './qr-galois';
import {
  QR_ALIGNMENT_POSITIONS,
  QR_EC_BLOCKS,
  QR_EC_CODEWORDS,
  qrDataCodewords,
  qrSize,
  StarQrErrorCorrection,
} from './qr-tables';

export type { StarQrErrorCorrection } from './qr-tables';

/** Encoding mode of the data. */
export type StarQrMode = 'numeric' | 'alphanumeric' | 'byte';

/** Options of `starEncodeQr`. */
export interface StarQrOptions {
  /** Error correction level: L (7 %), M (15 %, default), Q (25 %) or H (30 %). */
  readonly errorCorrection?: StarQrErrorCorrection;
  /** Smallest version to use, 1 to 40. Default 1. */
  readonly minVersion?: number;
  /** A fixed mask pattern, 0 to 7, instead of the one with the lowest penalty. */
  readonly mask?: number;
}

/** An encoded QR Code symbol. */
export interface StarQrCode {
  readonly version: number;
  readonly errorCorrection: StarQrErrorCorrection;
  readonly mode: StarQrMode;
  readonly mask: number;
  /** Modules by row and column; `true` is dark. Without the quiet zone. */
  readonly modules: boolean[][];
}

/** The 45 characters of the alphanumeric mode, in value order. */
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

const MODE_BITS: Record<StarQrMode, number> = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
};
const ECI_MODE = 0b0111;
const ECI_UTF8 = 26;

/** Level bits of the format information (table 12). */
const LEVEL_BITS: Record<StarQrErrorCorrection, number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };

/** Bits of the character count indicator (table 3). */
function countBits(mode: StarQrMode, version: number): number {
  const band = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  return { numeric: [10, 12, 14], alphanumeric: [9, 11, 13], byte: [8, 16, 16] }[mode][band];
}

/** A growable list of bits. */
class BitBuffer {
  readonly bits: number[] = [];
  append(value: number, length: number): void {
    for (let bit = length - 1; bit >= 0; bit--) this.bits.push((value >>> bit) & 1);
  }
}

/**
 * UTF-8 bytes of a text (no TextEncoder, so the encoder runs anywhere). A lone surrogate is not
 * a character: it becomes U+FFFD, as TextEncoder does.
 */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const char of text) {
    let code = char.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
    }
  }
  return bytes;
}

/** The most compact single mode for the whole text. */
export function qrMode(text: string): StarQrMode {
  if (/^[0-9]*$/.test(text)) return 'numeric';
  if ([...text].every((char) => ALPHANUMERIC.includes(char))) return 'alphanumeric';
  return 'byte';
}

/** The data segment: mode, ECI header bits and the data bits (without the count indicator). */
function segment(text: string): {
  mode: StarQrMode;
  count: number;
  header: BitBuffer;
  data: BitBuffer;
} {
  const mode = qrMode(text);
  const header = new BitBuffer();
  const data = new BitBuffer();
  let count = text.length;
  if (mode === 'numeric') {
    for (let i = 0; i < text.length; i += 3) {
      const group = text.slice(i, i + 3);
      data.append(+group, group.length * 3 + 1);
    }
  } else if (mode === 'alphanumeric') {
    for (let i = 0; i < text.length; i += 2) {
      const first = ALPHANUMERIC.indexOf(text[i]);
      if (i + 1 < text.length) data.append(first * 45 + ALPHANUMERIC.indexOf(text[i + 1]), 11);
      else data.append(first, 6);
    }
  } else {
    const bytes = utf8(text);
    count = bytes.length;
    if (bytes.length !== text.length) {
      // Not plain ASCII: say that the bytes are UTF-8 (ECI 000026, one byte designator).
      header.append(ECI_MODE, 4);
      header.append(ECI_UTF8, 8);
    }
    for (const byte of bytes) data.append(byte, 8);
  }
  return { mode, count, header, data };
}

/** Data codewords of `text` in `version` at `level`, or `null` when they do not fit. */
function dataCodewords(
  text: string,
  version: number,
  level: StarQrErrorCorrection,
): { mode: StarQrMode; codewords: number[] } | null {
  const { mode, count, header, data } = segment(text);
  const countLength = countBits(mode, version);
  if (count >= 1 << countLength) return null;
  const capacity = qrDataCodewords(version, level) * 8;
  const buffer = new BitBuffer();
  buffer.bits.push(...header.bits);
  buffer.append(MODE_BITS[mode], 4);
  buffer.append(count, countLength);
  buffer.bits.push(...data.bits);
  if (buffer.bits.length > capacity) return null;
  buffer.append(0, Math.min(4, capacity - buffer.bits.length)); // terminator
  buffer.append(0, (8 - (buffer.bits.length % 8)) % 8);
  const codewords: number[] = [];
  for (let i = 0; i < buffer.bits.length; i += 8) {
    codewords.push(buffer.bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  for (let pad = 0xec; codewords.length < capacity / 8; pad ^= 0xec ^ 0x11) codewords.push(pad);
  return { mode, codewords };
}

/**
 * The final codeword sequence of `data` (7.6): the blocks of table 9 (the shorter blocks first),
 * their data codewords interleaved, then their error correction codewords interleaved.
 */
export function qrInterleave(
  data: readonly number[],
  version: number,
  level: StarQrErrorCorrection,
): number[] {
  const blockCount = QR_EC_BLOCKS[level][version - 1];
  const ecLength = QR_EC_CODEWORDS[level][version - 1];
  const shortLength = Math.floor(data.length / blockCount);
  const longBlocks = data.length % blockCount;
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (let block = 0; block < blockCount; block++) {
    const length = shortLength + (block >= blockCount - longBlocks ? 1 : 0);
    const part = data.slice(offset, offset + length);
    offset += length;
    blocks.push(part);
    ecBlocks.push(rsRemainder(part, ecLength));
  }
  const result: number[] = [];
  for (let i = 0; i <= shortLength; i++) {
    for (const block of blocks) if (i < block.length) result.push(block[i]);
  }
  for (let i = 0; i < ecLength; i++) for (const block of ecBlocks) result.push(block[i]);
  return result;
}

/** Remainder of `value` (shifted by the degree) divided by a BCH generator polynomial. */
function bchRemainder(value: number, generator: number, degree: number): number {
  let remainder = value << degree;
  for (let bit = 31 - Math.clz32(remainder); bit >= degree; bit--) {
    if ((remainder >>> bit) & 1) remainder ^= generator << (bit - degree);
  }
  return remainder;
}

/** The 15 format information bits of a level and a mask (7.9.1), masked with 101010000010010. */
export function qrFormatBits(level: StarQrErrorCorrection, mask: number): number {
  const data = (LEVEL_BITS[level] << 3) | mask;
  return ((data << 10) | bchRemainder(data, 0b10100110111, 10)) ^ 0b101010000010010;
}

/** The 18 version information bits of versions 7 to 40 (7.10, annex D). */
export function qrVersionBits(version: number): number {
  return (version << 12) | bchRemainder(version, 0b1111100100101, 12);
}

/** Mask conditions of table 10 (i is the row, j the column): `true` inverts the module. */
const MASKS: readonly ((i: number, j: number) => boolean)[] = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0,
];

/** A symbol under construction: module colours and which modules are function patterns. */
class Matrix {
  readonly size: number;
  readonly dark: boolean[][];
  readonly reserved: boolean[][];

  constructor(readonly version: number) {
    this.size = qrSize(version);
    this.dark = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.reserved = Array.from({ length: this.size }, () =>
      new Array<boolean>(this.size).fill(false),
    );
    this.drawFunctionPatterns();
  }

  private set(row: number, col: number, dark: boolean): void {
    this.dark[row][col] = dark;
    this.reserved[row][col] = true;
  }

  private drawFunctionPatterns(): void {
    const size = this.size;
    // Finder patterns (7 × 7) with their light separators.
    for (const [top, left] of [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ]) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const row = top + r;
          const col = left + c;
          if (row < 0 || col < 0 || row >= size || col >= size) continue;
          const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
          this.set(row, col, ring !== 2 && ring !== 4);
        }
      }
    }
    // Timing patterns.
    for (let i = 8; i < size - 8; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    // Alignment patterns (5 × 5), except where they would overlap a finder pattern.
    const positions = QR_ALIGNMENT_POSITIONS[this.version - 1];
    const last = positions.length - 1;
    positions.forEach((row, a) => {
      positions.forEach((col, b) => {
        if ((a === 0 && b === 0) || (a === 0 && b === last) || (a === last && b === 0)) return;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            this.set(row + r, col + c, Math.max(Math.abs(r), Math.abs(c)) !== 1);
          }
        }
      });
    });
    // Reserve the format areas (filled per mask) and set the dark module.
    this.drawFormat(0);
    this.set(size - 8, 8, true);
    // Version information (versions 7 and up).
    if (this.version >= 7) {
      const bits = qrVersionBits(this.version);
      for (let i = 0; i < 18; i++) {
        const dark = ((bits >> i) & 1) === 1;
        const a = size - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.set(a, b, dark); // lower left block
        this.set(b, a, dark); // upper right block
      }
    }
  }

  /** Writes the 15 format bits in both places (figure 25); bit 14 is the most significant. */
  drawFormat(bits: number): void {
    const size = this.size;
    const bit = (index: number) => ((bits >> index) & 1) === 1;
    for (let k = 0; k < 15; k++) {
      const index = 14 - k;
      // First copy, around the upper left finder pattern.
      if (k < 6) this.set(8, k, bit(index));
      else if (k === 6) this.set(8, 7, bit(index));
      else if (k === 7) this.set(8, 8, bit(index));
      else if (k === 8) this.set(7, 8, bit(index));
      else this.set(14 - k, 8, bit(index));
      // Second copy: bits 14 to 8 upwards from the bottom left corner, bits 7 to 0 along row 8
      // under the upper right finder pattern.
      if (k < 7) this.set(size - 1 - k, 8, bit(index));
      else this.set(8, size - 15 + k, bit(index));
    }
  }

  /** Places the codewords (7.7.3): two-module columns from the right, upwards then downwards. */
  drawCodewords(codewords: readonly number[]): void {
    const size = this.size;
    let index = 0;
    const total = codewords.length * 8;
    let upwards = true;
    for (let right = size - 1; right > 0; right -= 2) {
      if (right === 6) right = 5; // the vertical timing pattern is skipped
      for (let step = 0; step < size; step++) {
        const row = upwards ? size - 1 - step : step;
        for (const col of [right, right - 1]) {
          if (this.reserved[row][col]) continue;
          // Remainder bits after the last codeword are light (0).
          const dark = index < total && ((codewords[index >> 3] >> (7 - (index & 7))) & 1) === 1;
          this.dark[row][col] = dark;
          index++;
        }
      }
      upwards = !upwards;
    }
  }

  /** Inverts the data modules where the mask condition holds. */
  applyMask(mask: number): void {
    const condition = MASKS[mask];
    for (let row = 0; row < this.size; row++) {
      for (let col = 0; col < this.size; col++) {
        if (!this.reserved[row][col] && condition(row, col)) {
          this.dark[row][col] = !this.dark[row][col];
        }
      }
    }
  }
}

/**
 * Penalty score of a symbol (7.8.3, table 11): N1 = 3 for runs of five equal modules in a row
 * or column, plus 1 per extra module; N2 = 3 per 2 × 2 block of one colour; N3 = 40 per
 * 1:1:3:1:1 finder-like pattern with four light modules on one side (the area outside the
 * symbol counts as light); N4 = 10 per 5 % that the share of dark modules differs from 50 %.
 */
export function qrPenalty(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  let score = 0;
  const at = (row: number, col: number, vertical: boolean) => {
    const r = vertical ? col : row;
    const c = vertical ? row : col;
    return r >= 0 && c >= 0 && r < size && c < size && modules[r][c];
  };
  for (const vertical of [false, true]) {
    for (let line = 0; line < size; line++) {
      // N1
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && at(line, i, vertical) === at(line, i - 1, vertical)) {
          run++;
        } else {
          if (run >= 5) score += 3 + (run - 5);
          run = 1;
        }
      }
      // N3: dark-light-dark-dark-dark-light-dark with four light modules before or after.
      for (let i = -4; i < size; i++) {
        const core =
          at(line, i, vertical) &&
          !at(line, i + 1, vertical) &&
          at(line, i + 2, vertical) &&
          at(line, i + 3, vertical) &&
          at(line, i + 4, vertical) &&
          !at(line, i + 5, vertical) &&
          at(line, i + 6, vertical);
        if (!core) continue;
        const lightBefore = [1, 2, 3, 4].every((k) => !at(line, i - k, vertical));
        const lightAfter = [7, 8, 9, 10].every((k) => !at(line, i + k, vertical));
        if (lightBefore) score += 40;
        if (lightAfter) score += 40;
      }
    }
  }
  // N2
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const color = modules[row][col];
      if (
        modules[row][col + 1] === color &&
        modules[row + 1][col] === color &&
        modules[row + 1][col + 1] === color
      ) {
        score += 3;
      }
    }
  }
  // N4
  let dark = 0;
  for (const row of modules) for (const module of row) if (module) dark++;
  const percent = (dark * 100) / (size * size);
  score += 10 * Math.floor(Math.abs(percent - 50) / 5);
  return score;
}

/**
 * Encodes `text` as a QR Code symbol. Throws a `RangeError` when the text does not fit in
 * version 40 at the chosen error correction level.
 */
export function qrEncode(text: string, options: StarQrOptions = {}): StarQrCode {
  const level = options.errorCorrection ?? 'M';
  let found: { version: number; mode: StarQrMode; codewords: number[] } | null = null;
  for (let version = Math.max(1, Math.min(40, options.minVersion ?? 1)); version <= 40; version++) {
    const data = dataCodewords(text, version, level);
    if (data) {
      found = { version, ...data };
      break;
    }
  }
  if (!found)
    throw new RangeError('The text is too long for a QR Code at this error correction level.');
  const { version, mode, codewords } = found;
  const final = qrInterleave(codewords, version, level);

  const build = (mask: number) => {
    const matrix = new Matrix(version);
    matrix.drawCodewords(final);
    matrix.applyMask(mask);
    matrix.drawFormat(qrFormatBits(level, mask));
    return matrix;
  };

  let best: Matrix | null = null;
  let bestMask = 0;
  if (options.mask !== undefined && options.mask >= 0 && options.mask <= 7) {
    bestMask = Math.floor(options.mask);
    best = build(bestMask);
  } else {
    let bestScore = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      const matrix = build(mask);
      const score = qrPenalty(matrix.dark);
      if (score < bestScore) {
        bestScore = score;
        best = matrix;
        bestMask = mask;
      }
    }
  }
  return { version, errorCorrection: level, mode, mask: bestMask, modules: best!.dark };
}

/**
 * Encodes `value` as a QR Code and returns its modules by row and column (`true` is dark),
 * without the quiet zone. The version (1 to 40), the mode (numeric, alphanumeric or UTF-8
 * bytes) and the mask are chosen automatically. Throws a `RangeError` when the value is too long.
 *
 * ```ts
 * const modules = starEncodeQr('https://example.com', { errorCorrection: 'Q' });
 * ```
 */
export function starEncodeQr(value: string, options: StarQrOptions = {}): boolean[][] {
  return qrEncode(value, options).modules;
}
