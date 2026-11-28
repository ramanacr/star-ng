/**
 * Fixed date patterns of the date pickers (`datePattern`), for example `dd-MMM-yyyy` for
 * `05-Nov-2026`. A pure formatter and a tolerant parser. Internal.
 *
 * Tokens (a run of the same letter):
 *
 * - `d`, `dd`: day of the month, `5` or `05`.
 * - `M`, `MM`: month number, `1`…`12` or `01`…`12`.
 * - `MMM`: short month name of the locale, without a trailing dot (`Nov`; de-DE `Nov`, `Mär`).
 * - `MMMM`: long month name of the locale (`November`).
 * - `yy`: two-digit year (`26`); `y`, `yyy`, `yyyy`: the full year (`yyyy` is padded to 4 digits).
 * - `H`, `HH`: hour 0…23; `h`, `hh`: hour 1…12; `m`, `mm`: minutes; `s`, `ss`: seconds.
 * - `a`: day period of the locale (`AM`, `PM`).
 * - Text in single quotes is literal (`'T'`); `''` is a single quote. Every other character,
 *   also other letters, is literal text.
 */

/** One part of a pattern: a token (`d`, `MMM`, …) or literal text. */
interface PatternPart {
  readonly token?: string;
  readonly text?: string;
}

const TOKEN_LETTERS = 'dMyHhmsa';
const TIME_LETTERS = 'Hhmsa';
/** Separators that a separator literal of the pattern matches when the user types. */
const SEPARATOR = /^[\s\-/.,:]+$/;
const SEPARATOR_RUN = /^[\s\-/.,:]+/;

const partsCache = new Map<string, readonly PatternPart[]>();

/** The parts of a pattern. Literal text next to each other is joined. */
function patternParts(pattern: string): readonly PatternPart[] {
  const cached = partsCache.get(pattern);
  if (cached) return cached;
  const parts: PatternPart[] = [];
  const literal = (text: string) => {
    const last = parts[parts.length - 1];
    if (last && last.text !== undefined) parts[parts.length - 1] = { text: last.text + text };
    else parts.push({ text });
  };
  let index = 0;
  while (index < pattern.length) {
    const char = pattern[index];
    if (char === "'") {
      if (pattern[index + 1] === "'") {
        literal("'");
        index += 2;
        continue;
      }
      let end = index + 1;
      let text = '';
      while (end < pattern.length) {
        if (pattern[end] === "'" && pattern[end + 1] === "'") {
          text += "'";
          end += 2;
        } else if (pattern[end] === "'") {
          break;
        } else {
          text += pattern[end++];
        }
      }
      if (text) literal(text);
      index = end + 1;
    } else if (TOKEN_LETTERS.includes(char)) {
      let end = index;
      while (pattern[end] === char) end++;
      parts.push({ token: pattern.slice(index, end) });
      index = end;
    } else {
      literal(char);
      index++;
    }
  }
  partsCache.set(pattern, parts);
  return parts;
}

/** The pattern has a time token (`H`, `h`, `m`, `s` or `a`). */
export function starPatternHasTime(pattern: string): boolean {
  return patternParts(pattern).some((part) => part.token && TIME_LETTERS.includes(part.token[0]));
}

/**
 * The pattern of the text: `datePattern`, with the time added when `time` is set and the pattern
 * has no time token: ` HH:mm` (` HH:mm:ss` with `seconds`), or ` hh:mm a` in the 12-hour clock.
 */
export function starTimePattern(
  pattern: string,
  time: boolean,
  hourFormat: '12' | '24',
  seconds: boolean,
): string {
  if (!time || starPatternHasTime(pattern)) return pattern;
  const sec = seconds ? ':ss' : '';
  return hourFormat === '12' ? `${pattern} hh:mm${sec} a` : `${pattern} HH:mm${sec}`;
}

/**
 * The pattern with only the tokens whose letter is in `letters`, for example `MMM-yyyy` and
 * `yyyy` from `dd-MMM-yyyy`. Each left-out token takes one literal next to it (the literal after
 * it, else the one before it) with it, so `yyyy-MM-dd` gives `yyyy-MM`. Literal text with a
 * letter or a quote is quoted again.
 */
export function starReducePattern(pattern: string, letters: string): string {
  const parts = [...patternParts(pattern)];
  for (let index = 0; index < parts.length;) {
    const token = parts[index].token;
    if (!token || letters.includes(token[0])) {
      index++;
      continue;
    }
    if (parts[index + 1]?.text !== undefined) parts.splice(index, 2);
    else if (parts[index - 1]?.text !== undefined) parts.splice(--index, 2);
    else parts.splice(index, 1);
  }
  // A separator left at either end goes too.
  while (parts[0]?.text !== undefined && SEPARATOR.test(parts[0].text)) parts.shift();
  while (parts.at(-1)?.text !== undefined && SEPARATOR.test(parts.at(-1)!.text!)) parts.pop();
  return parts
    .map((part) => {
      if (part.token) return part.token;
      const text = part.text ?? '';
      return /[\p{L}']/u.test(text) ? `'${text.replace(/'/g, "''")}'` : text;
    })
    .join('');
}

/** Placeholder of a pattern: the pattern without the quotes of its literal text. */
export function starPatternHint(pattern: string): string {
  return patternParts(pattern)
    .map((part) => part.token ?? part.text)
    .join('');
}

/** Lower case, without a trailing dot. */
function bare(name: string, locale: string | undefined): string {
  return name.toLocaleLowerCase(locale).replace(/\.$/, '').trim();
}

interface LocaleNames {
  /** Short month names for `MMM`, without a trailing dot. */
  readonly short: readonly string[];
  readonly long: readonly string[];
  /** Day periods of `a`: AM and PM. */
  readonly periods: readonly [string, string];
  /** Lower-case names to read, longest first: [name, month index]. */
  readonly monthNames: readonly (readonly [string, number])[];
}

const namesCache = new Map<string, LocaleNames>();

function localeNames(locale: string | undefined): LocaleNames {
  const key = locale ?? '';
  const cached = namesCache.get(key);
  if (cached) return cached;
  const months = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 15));
  const name = (options: Intl.DateTimeFormatOptions) => {
    const format = new Intl.DateTimeFormat(locale, options);
    return months.map(
      (date) => format.formatToParts(date).find((part) => part.type === 'month')?.value ?? '',
    );
  };
  const short = name({ month: 'short' }).map((text) => text.replace(/\.$/, ''));
  const long = name({ month: 'long' });
  // The names inside a date can differ from the names alone (de-DE "März" and "Mär").
  const shortInDate = name({ day: 'numeric', month: 'short', year: 'numeric' });
  const longInDate = name({ day: 'numeric', month: 'long', year: 'numeric' });
  const period = (hour: number) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', hourCycle: 'h12' })
      .formatToParts(new Date(2026, 0, 1, hour))
      .find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM');
  const monthNames = new Map<string, number>();
  for (const list of [long, longInDate, short, shortInDate]) {
    list.forEach((text, index) => {
      const lower = bare(text, locale);
      if (lower && !monthNames.has(lower)) monthNames.set(lower, index);
    });
  }
  const names: LocaleNames = {
    short,
    long,
    periods: [period(9), period(15)],
    monthNames: [...monthNames].sort((a, b) => b[0].length - a[0].length),
  };
  namesCache.set(key, names);
  return names;
}

const pad = (value: number, length: number) => String(value).padStart(length, '0');

/**
 * Text of a date in a pattern, for example `05-Nov-2026 09:26` for `dd-MMM-yyyy HH:mm`. Month
 * names and day periods come from the locale (`Intl`). `''` without a date.
 */
export function starFormatPattern(
  date: Date | null | undefined,
  pattern: string,
  locale: string | undefined,
): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const names = localeNames(locale);
  const hours = date.getHours();
  return patternParts(pattern)
    .map((part) => {
      const token = part.token;
      if (!token) return part.text;
      const length = token.length;
      switch (token[0]) {
        case 'd':
          return pad(date.getDate(), Math.min(length, 2));
        case 'M':
          if (length === 3) return names.short[date.getMonth()];
          if (length >= 4) return names.long[date.getMonth()];
          return pad(date.getMonth() + 1, length);
        case 'y':
          return length === 2
            ? pad(date.getFullYear() % 100, 2)
            : pad(date.getFullYear(), length === 4 ? 4 : 1);
        case 'H':
          return pad(hours, Math.min(length, 2));
        case 'h':
          return pad(hours % 12 || 12, Math.min(length, 2));
        case 'm':
          return pad(date.getMinutes(), Math.min(length, 2));
        case 's':
          return pad(date.getSeconds(), Math.min(length, 2));
        default:
          return names.periods[hours < 12 ? 0 : 1];
      }
    })
    .join('');
}

/**
 * The date of text typed in a pattern, or `null` when the text does not follow the pattern or is
 * not a real date (31-Feb-2026) or time.
 *
 * The reading is tolerant:
 *
 * - Upper and lower case do not matter (`05-nov-2026`).
 * - `MMM` and `MMMM` take the short or the long month name of the locale, with or without a
 *   trailing dot (de-DE `Nov.`), a unique start of at least three letters of a name (`Sep` in
 *   en-GB, where the short name is `Sept`), or the month number (`05-11-2026`).
 * - Numbers may have one digit fewer (`5-Nov-2026` for `dd`); a year of one or two digits for
 *   `yyyy` is in the 2000s.
 * - A separator in the pattern (space, `-`, `/`, `.`, `,`, `:`) takes any run of these
 *   separators, and space may stand around other literal text.
 * - `a` takes the day periods of the locale and `am` / `pm` (also `a`, `p`, `a.m.`). Without a
 *   typed day period, `h` and `hh` take an hour 0…23 as it is.
 * - A pattern without a day, a month or a year reads the 1st, January or the current year.
 */
export function starParsePattern(
  text: string,
  pattern: string,
  locale: string | undefined,
): Date | null {
  const names = localeNames(locale);
  const parts = patternParts(pattern);
  let rest = text.trim();
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  let twelve = false;
  let period: 0 | 1 | null = null;

  const digits = (max: number): number | null => {
    const match = new RegExp(`^\\d{1,${max}}`).exec(rest);
    if (!match) return null;
    rest = rest.slice(match[0].length);
    return Number(match[0]);
  };

  /** A typed month number 1…12 as the month index; -1 when it is not one. */
  const digitsMonth = (): number => {
    const number = digits(2);
    return number === null || number < 1 || number > 12 ? -1 : number - 1;
  };

  const monthName = (): number | null => {
    const lower = rest.toLocaleLowerCase(locale);
    for (const [name, index] of names.monthNames) {
      if (lower.startsWith(name)) {
        rest = rest.slice(name.length).replace(/^\./, '');
        return index;
      }
    }
    // A unique start of a name, at least three letters.
    const word = /^\p{L}{3,}/u.exec(lower)?.[0];
    if (!word) return null;
    const found = new Set(
      names.monthNames.filter(([name]) => name.startsWith(word)).map(([, index]) => index),
    );
    if (found.size !== 1) return null;
    rest = rest.slice(word.length).replace(/^\./, '');
    return [...found][0];
  };

  const dayPeriod = (): 0 | 1 | null => {
    const lower = rest.toLocaleLowerCase(locale);
    const options: [string, 0 | 1][] = [
      [bare(names.periods[0], locale), 0],
      [bare(names.periods[1], locale), 1],
    ];
    for (const [name, value] of options.sort((a, b) => b[0].length - a[0].length)) {
      if (name && lower.startsWith(name)) {
        rest = rest.slice(name.length).replace(/^\./, '');
        return value;
      }
    }
    const latin = /^([ap])\.?\s?(m\.?)?/i.exec(rest);
    if (!latin) return null;
    rest = rest.slice(latin[0].length);
    return latin[1].toLowerCase() === 'a' ? 0 : 1;
  };

  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    const token = part.token;
    if (!token) {
      const literal = part.text ?? '';
      const last = index === parts.length - 1;
      if (SEPARATOR.test(literal)) {
        const match = SEPARATOR_RUN.exec(rest);
        // Space before an optional day period may be left out (9:26am).
        if (!match) {
          if (parts[index + 1]?.token?.[0] === 'a' && /^\s+$/.test(literal)) continue;
          if (last) continue;
          return null;
        }
        rest = rest.slice(match[0].length);
        continue;
      }
      rest = rest.replace(/^\s+/, '');
      const trimmed = literal.trim();
      if (
        rest.slice(0, trimmed.length).toLocaleLowerCase(locale) !==
        trimmed.toLocaleLowerCase(locale)
      ) {
        return null;
      }
      rest = rest.slice(trimmed.length).replace(/^\s+/, '');
      continue;
    }
    const length = token.length;
    let value: number | null;
    switch (token[0]) {
      case 'd':
        value = day = digits(2);
        break;
      case 'M':
        value = month = length >= 3 ? (monthName() ?? digitsMonth()) : digitsMonth();
        break;
      case 'y': {
        const before = rest;
        value = digits(length === 2 ? 2 : 4);
        const typed = before.length - rest.length;
        if (value !== null && (length === 2 || typed <= 2)) value += 2000;
        year = value;
        break;
      }
      case 'H':
        value = hours = digits(2) ?? -1;
        if (hours < 0 || hours > 23) return null;
        break;
      case 'h':
        twelve = true;
        value = hours = digits(2) ?? -1;
        if (hours < 0 || hours > 23) return null;
        break;
      case 'm':
        value = minutes = digits(2) ?? -1;
        if (minutes < 0 || minutes > 59) return null;
        break;
      case 's':
        value = seconds = digits(2) ?? -1;
        if (seconds < 0 || seconds > 59) return null;
        break;
      default:
        // The day period may be left out; the hour is then read as it is.
        rest = rest.replace(/^\s+/, '');
        period = rest ? dayPeriod() : null;
        if (rest && period === null) return null;
        value = 0;
    }
    if (value === null) return null;
  }
  if (rest.trim()) return null;

  if (twelve && period !== null) {
    if (hours < 1 || hours > 12) return null;
    hours = (hours % 12) + (period === 1 ? 12 : 0);
  } else if (period !== null && hours > 12) {
    return null;
  } else if (period !== null) {
    hours = (hours % 12) + (period === 1 ? 12 : 0);
  }

  const y = year ?? new Date().getFullYear();
  const m = month ?? 0;
  const d = day ?? 1;
  if (m < 0 || m > 11 || d < 1) return null;
  // setFullYear: `new Date(26, …)` would be 1926.
  const date = new Date(2000, 0, 1, hours, minutes, seconds);
  date.setFullYear(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date : null;
}
