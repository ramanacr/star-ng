/**
 * Pure encoders of the linear barcodes of `star-barcode`, written from the public standards:
 * Code 128 (ISO/IEC 15417), EAN-13 and UPC-A (ISO/IEC 15420) and Code 39 (ISO/IEC 16388).
 * No browser API is used, so the encoders also run on the server and in a print pipeline.
 */

export type StarBarcodeType = 'code128' | 'ean13' | 'upca' | 'code39';

/** A barcode as module widths. */
export interface StarBarcodeEncoding {
  /** Widths in modules, alternating bar and space, starting with a bar. No quiet zones. */
  readonly bars: readonly number[];
  /** The human-readable text (with a computed check digit for EAN-13 and UPC-A). */
  readonly text: string;
  /** Minimum light margins before and after the symbol, in modules. */
  readonly quiet: readonly [number, number];
}

// prettier-ignore
/**
 * Code 128 symbol characters 0 to 105 and the stop character (106): widths of bar, space, bar,
 * space, bar, space (and a final bar for the stop), in modules.
 */
export const CODE128_PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212',
  '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221',
  '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221',
  '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321',
  '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131',
  '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131',
  '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111',
  '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114',
  '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242',
  '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311',
  '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_A = 103;
const START_B = 104;
const START_C = 105;
const STOP = 106;
const CODE_A = 101;
const CODE_B = 100;
const CODE_C = 99;
const SHIFT = 98;

/**
 * Symbol values of a Code 128 symbol: the start character, the data, the code set changes and
 * the modulo 103 check character (not the stop). Follows the minimal encodation rules of
 * ISO/IEC 15417 annex E: subset C for runs of digits, subset A for control characters, a shift
 * for a single character of the other subset. Returns `null` for an empty value or a character
 * outside ASCII (0 to 127).
 */
export function code128Values(text: string): number[] | null {
  const codes = [...text].map((char) => char.codePointAt(0)!);
  if (!codes.length || codes.some((code) => code > 127)) return null;
  const isDigit = (index: number) => codes[index] >= 48 && codes[index] <= 57;
  const digitRun = (index: number) => {
    let end = index;
    while (end < codes.length && isDigit(end)) end++;
    return end - index;
  };
  // True when a control character comes before any lower case character from `index` on.
  const controlFirst = (index: number) => {
    for (let k = index; k < codes.length; k++) {
      if (codes[k] < 32) return true;
      if (codes[k] >= 96) return false;
    }
    return false;
  };
  const valueA = (code: number) => (code < 32 ? code + 64 : code - 32);
  const valueB = (code: number) => code - 32;

  const values: number[] = [];
  let set: 'A' | 'B' | 'C';
  const lead = digitRun(0);
  if (lead >= 4 || (lead === 2 && codes.length === 2)) {
    set = 'C';
    values.push(START_C);
  } else {
    set = controlFirst(0) ? 'A' : 'B';
    values.push(set === 'A' ? START_A : START_B);
  }

  let i = 0;
  while (i < codes.length) {
    if (set === 'C') {
      if (digitRun(i) >= 2) {
        values.push((codes[i] - 48) * 10 + (codes[i + 1] - 48));
        i += 2;
        continue;
      }
      set = controlFirst(i) ? 'A' : 'B';
      values.push(set === 'A' ? CODE_A : CODE_B);
      continue;
    }
    const run = digitRun(i);
    if (run >= 4) {
      if (run % 2) {
        values.push(set === 'A' ? valueA(codes[i]) : valueB(codes[i]));
        i++;
      }
      set = 'C';
      values.push(CODE_C);
      continue;
    }
    const code = codes[i];
    if (set === 'A' && code >= 96) {
      // Lower case in subset A: shift for one character when a control character follows first.
      if (controlFirst(i + 1)) {
        values.push(SHIFT, valueB(code));
        i++;
      } else {
        set = 'B';
        values.push(CODE_B);
      }
      continue;
    }
    if (set === 'B' && code < 32) {
      // A control character in subset B: shift unless more control characters come first.
      if (controlFirst(i + 1)) {
        set = 'A';
        values.push(CODE_A);
      } else {
        values.push(SHIFT, valueA(code));
        i++;
      }
      continue;
    }
    values.push(set === 'A' ? valueA(code) : valueB(code));
    i++;
  }

  const check = values.reduce((sum, value, index) => sum + value * Math.max(1, index), 0) % 103;
  values.push(check);
  return values;
}

function encode128(text: string): StarBarcodeEncoding | null {
  const values = code128Values(text);
  if (!values) return null;
  const bars = [...values, STOP].flatMap((value) => [...CODE128_PATTERNS[value]].map(Number));
  return { bars, text, quiet: [10, 10] };
}

// prettier-ignore
/**
 * EAN set A (odd parity) widths of the digits 0 to 9: space, bar, space, bar. Set C uses the
 * same widths starting with a bar; set B (even parity) uses them in reverse order.
 */
const EAN_WIDTHS = [
  '3211', '2221', '2122', '1411', '1132', '1231', '1114', '1312', '1213', '3112',
];
// prettier-ignore
/** Set (A or B) of each left digit, chosen by the leading digit of an EAN-13. */
const EAN_LEADING = [
  'AAAAAA', 'AABABB', 'AABBAB', 'AABBBA', 'ABAABB', 'ABBAAB', 'ABBBAA', 'ABABAB', 'ABABBA', 'ABBABA',
];

/** The modulo 10 check digit of the 12 data digits of an EAN-13 (weights 1 and 3 from the left). */
export function eanCheckDigit(digits: string): number {
  let sum = 0;
  for (let index = 0; index < 12; index++) sum += +digits[index] * (index % 2 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

/** EAN-13 of 12 digits (the check digit is added) or 13 digits (the check digit must match). */
function encodeEan(value: string): { bars: number[]; text: string } | null {
  if (!/^\d{12,13}$/.test(value)) return null;
  const check = eanCheckDigit(value);
  if (value.length === 13 && +value[12] !== check) return null;
  const digits = value.slice(0, 12) + check;
  const sets = EAN_LEADING[+digits[0]];
  const bars = [1, 1, 1];
  for (let index = 1; index <= 6; index++) {
    const widths = [...EAN_WIDTHS[+digits[index]]].map(Number);
    bars.push(...(sets[index - 1] === 'A' ? widths : widths.reverse()));
  }
  bars.push(1, 1, 1, 1, 1);
  for (let index = 7; index <= 12; index++)
    bars.push(...[...EAN_WIDTHS[+digits[index]]].map(Number));
  bars.push(1, 1, 1);
  return { bars, text: digits };
}

// prettier-ignore
/**
 * Code 39 characters: 9 elements (bar, space, ..., bar), `w` wide and `n` narrow. `*` is the
 * start and stop character.
 */
export const CODE39_PATTERNS: Readonly<Record<string, string>> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '*': 'nwnnwnwnn',
  $: 'nwnwnwnnn', '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn',
};

/** Width of a wide Code 39 element, in narrow modules (the standard allows 2 to 3). */
const CODE39_WIDE = 3;

function encode39(value: string): StarBarcodeEncoding | null {
  if (!value || value.includes('*') || [...value].some((char) => !CODE39_PATTERNS[char])) {
    return null;
  }
  const bars: number[] = [];
  [...`*${value}*`].forEach((char, index) => {
    // A narrow space separates two characters.
    if (index) bars.push(1);
    for (const element of CODE39_PATTERNS[char]) bars.push(element === 'w' ? CODE39_WIDE : 1);
  });
  return { bars, text: value, quiet: [10, 10] };
}

/**
 * Encodes `value` as a barcode of `type`. Returns `null` when the value cannot be encoded: an
 * empty value, a character outside the set of the symbology, or a wrong EAN or UPC check digit.
 *
 * - `code128`: ASCII text; code sets A, B and C are chosen automatically.
 * - `ean13`: 12 digits (the check digit is added) or 13 digits.
 * - `upca`: 11 digits (the check digit is added) or 12 digits.
 * - `code39`: digits, upper case letters, space and `- . $ / + %`.
 */
export function starEncodeBarcode(
  value: string,
  type: StarBarcodeType,
): StarBarcodeEncoding | null {
  switch (type) {
    case 'ean13': {
      const ean = encodeEan(value);
      return ean && { ...ean, quiet: [11, 7] };
    }
    case 'upca': {
      if (!/^\d{11,12}$/.test(value)) return null;
      const ean = encodeEan(`0${value}`);
      return ean && { bars: ean.bars, text: ean.text.slice(1), quiet: [9, 9] };
    }
    case 'code39':
      return encode39(value);
    default:
      return encode128(value);
  }
}
