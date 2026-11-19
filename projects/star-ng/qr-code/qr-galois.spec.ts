import { gfMultiply, rsGenerator, rsRemainder } from './qr-galois';

/** Multiplication in GF(256) modulo x^8 + x^4 + x^3 + x^2 + 1, by shift and add (no tables). */
function slowMultiply(a: number, b: number): number {
  let product = 0;
  for (let bit = 7; bit >= 0; bit--) {
    product = (product << 1) ^ (product & 0x80 ? 0x11d : 0);
    if ((b >> bit) & 1) product ^= a;
  }
  return product & 0xff;
}

describe('QR Galois field and Reed-Solomon code', () => {
  it('multiplies like the shift-and-add definition of GF(256)', () => {
    for (let a = 0; a < 256; a += 7) {
      for (let b = 0; b < 256; b += 5) {
        expect(gfMultiply(a, b)).toBe(slowMultiply(a, b));
      }
    }
    expect(gfMultiply(0x80, 2)).toBe(0x1d);
  });

  it('builds the generator polynomial of 7 error correction codewords (ISO/IEC 18004, annex A)', () => {
    // g(x) = x^7 + α^87 x^6 + α^229 x^5 + α^146 x^4 + α^149 x^3 + α^238 x^2 + α^102 x + α^21.
    const alpha = (power: number) => {
      let value = 1;
      for (let i = 0; i < power; i++) value = slowMultiply(value, 2);
      return value;
    };
    expect(rsGenerator(7)).toEqual([1, ...[87, 229, 146, 149, 238, 102, 21].map(alpha)]);
  });

  it('computes the error correction codewords of "01234567" 1-M (ISO/IEC 18004, annex I)', () => {
    const data = [16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, 10)).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
  });

  it('computes the error correction codewords of "HELLO WORLD" 1-Q', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236];
    expect(rsRemainder(data, 13)).toEqual([168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16]);
  });
});
