import {
  QR_ALIGNMENT_POSITIONS,
  QR_EC_BLOCKS,
  QR_EC_CODEWORDS,
  qrDataCodewords,
  qrTotalCodewords,
} from './qr-tables';

describe('QR tables (ISO/IEC 18004, tables 1, 7, 9 and E.1)', () => {
  it('has the total codewords of each version', () => {
    expect(qrTotalCodewords(1)).toBe(26);
    expect(qrTotalCodewords(2)).toBe(44);
    expect(qrTotalCodewords(6)).toBe(172);
    expect(qrTotalCodewords(7)).toBe(196);
    expect(qrTotalCodewords(10)).toBe(346);
    expect(qrTotalCodewords(14)).toBe(581);
    expect(qrTotalCodewords(27)).toBe(1828);
    expect(qrTotalCodewords(40)).toBe(3706);
  });

  it('gives the data capacity in codewords of table 7', () => {
    const table: Record<number, [number, number, number, number]> = {
      1: [19, 16, 13, 9],
      2: [34, 28, 22, 16],
      3: [55, 44, 34, 26],
      4: [80, 64, 48, 36],
      5: [108, 86, 62, 46],
      6: [136, 108, 76, 60],
      7: [156, 124, 88, 66],
      8: [194, 154, 110, 86],
      9: [232, 182, 132, 100],
      10: [274, 216, 154, 122],
      15: [523, 415, 295, 223],
      20: [861, 669, 485, 385],
      25: [1276, 1000, 718, 538],
      30: [1735, 1373, 985, 745],
      35: [2306, 1812, 1286, 986],
      40: [2956, 2334, 1666, 1276],
    };
    for (const [version, capacities] of Object.entries(table)) {
      (['L', 'M', 'Q', 'H'] as const).forEach((level, index) => {
        expect(qrDataCodewords(+version, level), `${version}-${level}`).toBe(capacities[index]);
      });
    }
  });

  it('has 40 entries per level, with blocks that hold all the codewords', () => {
    for (const level of ['L', 'M', 'Q', 'H'] as const) {
      expect(QR_EC_CODEWORDS[level]).toHaveLength(40);
      expect(QR_EC_BLOCKS[level]).toHaveLength(40);
      for (let version = 1; version <= 40; version++) {
        const blocks = QR_EC_BLOCKS[level][version - 1];
        const ec = QR_EC_CODEWORDS[level][version - 1] * blocks;
        expect(ec + qrDataCodewords(version, level)).toBe(qrTotalCodewords(version));
        expect(Math.floor(qrDataCodewords(version, level) / blocks)).toBeGreaterThan(0);
      }
    }
  });

  it('places the alignment patterns from 6 to 4 * version + 10 at even spacing', () => {
    expect(QR_ALIGNMENT_POSITIONS[0]).toEqual([]);
    expect(QR_ALIGNMENT_POSITIONS[1]).toEqual([6, 18]);
    expect(QR_ALIGNMENT_POSITIONS[6]).toEqual([6, 22, 38]);
    expect(QR_ALIGNMENT_POSITIONS[31]).toEqual([6, 34, 60, 86, 112, 138]);
    expect(QR_ALIGNMENT_POSITIONS[39]).toEqual([6, 30, 58, 86, 114, 142, 170]);
    for (let version = 2; version <= 40; version++) {
      const positions = QR_ALIGNMENT_POSITIONS[version - 1];
      expect(positions.length, `version ${version}`).toBe(Math.floor(version / 7) + 2);
      expect(positions.at(-1), `version ${version}`).toBe(4 * version + 10);
      const steps = positions.slice(2).map((value, index) => value - positions[index + 1]);
      expect(new Set(steps).size, `version ${version}`).toBeLessThanOrEqual(1);
      steps.forEach((step) => expect(step % 2).toBe(0));
    }
  });
});
