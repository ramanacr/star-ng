/**
 * Arithmetic in GF(2^8) and the Reed-Solomon error correction of QR Code (ISO/IEC 18004,
 * clause 7.5.2 and annex A). The field uses the primitive polynomial
 * x^8 + x^4 + x^3 + x^2 + 1 (0x11D) and the generator α = 2.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
{
  let value = 1;
  for (let power = 0; power < 255; power++) {
    EXP[power] = value;
    LOG[value] = power;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  // A second copy avoids a modulo in `gfMultiply`.
  for (let power = 255; power < 512; power++) EXP[power] = EXP[power - 255];
}

/** Product of two field elements. */
export function gfMultiply(a: number, b: number): number {
  return a && b ? EXP[LOG[a] + LOG[b]] : 0;
}

/**
 * Generator polynomial of `degree` error correction codewords: the product of (x - α^i) for
 * i = 0 … degree - 1. Coefficients from the highest power down; the first one is 1.
 */
export function rsGenerator(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMultiply(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

const generators = new Map<number, number[]>();

/**
 * The `degree` error correction codewords of `data`: the remainder of data(x) · x^degree
 * divided by the generator polynomial.
 */
export function rsRemainder(data: readonly number[], degree: number): number[] {
  let generator = generators.get(degree);
  if (!generator) {
    generator = rsGenerator(degree);
    generators.set(degree, generator);
  }
  const remainder = new Array<number>(degree).fill(0);
  for (const codeword of data) {
    const factor = codeword ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < degree; i++) remainder[i] ^= gfMultiply(generator[i + 1], factor);
  }
  return remainder;
}
