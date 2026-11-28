import { starReducePattern } from './date-pattern';
import {
  starComparePartialDates,
  starFormatPartialDate,
  starIsValidPartialDate,
  starParsePartialDate,
  StarPartialDate,
  starPartialDateFromDate,
  starPartialDateHint,
  starPartialDatePrecision,
  starPartialDateToDate,
} from './partial-date';

const day = (year: number, month: number, date: number): StarPartialDate => ({
  year,
  month,
  day: date,
});
const month = (year: number, value: number): StarPartialDate => ({ year, month: value, day: null });
const year = (value: number): StarPartialDate => ({ year: value, month: null, day: null });

describe('partial date: pattern reduction', () => {
  it('drops the day, then the month, with one separator', () => {
    expect(starReducePattern('dd-MMM-yyyy', 'My')).toBe('MMM-yyyy');
    expect(starReducePattern('dd-MMM-yyyy', 'y')).toBe('yyyy');
    expect(starReducePattern('yyyy-MM-dd', 'My')).toBe('yyyy-MM');
    expect(starReducePattern('MMM dd, yyyy', 'My')).toBe('MMM yyyy');
    expect(starReducePattern('MM/dd/yyyy', 'My')).toBe('MM/yyyy');
  });

  it('drops time tokens and quotes literal text again', () => {
    expect(starReducePattern('dd-MMM-yyyy HH:mm', 'dMy')).toBe('dd-MMM-yyyy');
    expect(starReducePattern("dd 'de' MMMM 'de' yyyy", 'My')).toBe("MMMM' de 'yyyy");
    expect(starReducePattern("yyyy'T'MM", 'My')).toBe("yyyy'T'MM");
  });
});

describe('partial date: precision and validity', () => {
  it('derives the precision from the known parts', () => {
    expect(starPartialDatePrecision(day(2026, 4, 14))).toBe('day');
    expect(starPartialDatePrecision(month(2026, 3))).toBe('month');
    expect(starPartialDatePrecision(year(1981))).toBe('year');
  });

  it('accepts real partial dates', () => {
    expect(starIsValidPartialDate(day(2026, 4, 30))).toBe(true);
    expect(starIsValidPartialDate(day(2024, 2, 29))).toBe(true);
    expect(starIsValidPartialDate(month(2026, 12))).toBe(true);
    expect(starIsValidPartialDate(year(1))).toBe(true);
    expect(starIsValidPartialDate(year(9999))).toBe(true);
  });

  it('rejects impossible parts', () => {
    expect(starIsValidPartialDate(month(2026, 13))).toBe(false);
    expect(starIsValidPartialDate(month(2026, 0))).toBe(false);
    expect(starIsValidPartialDate(day(2026, 4, 31))).toBe(false);
    expect(starIsValidPartialDate(day(2026, 2, 29))).toBe(false);
    expect(starIsValidPartialDate(day(2026, 4, 0))).toBe(false);
    expect(starIsValidPartialDate({ year: 2026, month: null, day: 5 })).toBe(false);
    expect(starIsValidPartialDate({ year: 2026.5, month: null, day: null })).toBe(false);
    expect(starIsValidPartialDate(year(0))).toBe(false);
    expect(starIsValidPartialDate(year(10000))).toBe(false);
    expect(starIsValidPartialDate(null)).toBe(false);
    expect(starIsValidPartialDate('2026')).toBe(false);
    expect(starIsValidPartialDate({ year: '2026', month: null, day: null })).toBe(false);
  });
});

describe('partial date: compare', () => {
  it('compares at the coarser precision of the two', () => {
    expect(starComparePartialDates(day(2026, 4, 14), day(2026, 4, 15))).toBeLessThan(0);
    expect(starComparePartialDates(day(2026, 4, 15), day(2026, 4, 14))).toBeGreaterThan(0);
    expect(starComparePartialDates(day(2026, 4, 14), day(2026, 4, 14))).toBe(0);
    expect(starComparePartialDates(month(2026, 3), day(2026, 4, 14))).toBeLessThan(0);
    expect(starComparePartialDates(month(2026, 4), day(2026, 4, 14))).toBe(0);
    expect(starComparePartialDates(day(2026, 4, 1), month(2026, 4))).toBe(0);
    expect(starComparePartialDates(year(2026), day(2026, 12, 31))).toBe(0);
    expect(starComparePartialDates(year(2025), month(2026, 1))).toBeLessThan(0);
    expect(starComparePartialDates(month(2027, 1), year(2026))).toBeGreaterThan(0);
  });

  it('finds a stop before its start', () => {
    const start = month(2026, 3);
    expect(starComparePartialDates(day(2026, 2, 28), start) < 0).toBe(true);
    expect(starComparePartialDates(day(2026, 3, 1), start) < 0).toBe(false);
  });
});

describe('partial date: Date conversion', () => {
  it('converts from and to a Date', () => {
    const date = new Date(2026, 3, 14);
    expect(starPartialDateFromDate(date)).toEqual(day(2026, 4, 14));
    expect(starPartialDateFromDate(date, 'month')).toEqual(month(2026, 4));
    expect(starPartialDateFromDate(date, 'year')).toEqual(year(2026));
    expect(starPartialDateToDate(day(2026, 4, 14))).toEqual(date);
    expect(starPartialDateToDate(month(2026, 4))).toEqual(new Date(2026, 3, 1));
    expect(starPartialDateToDate(year(2026))).toEqual(new Date(2026, 0, 1));
    expect(starPartialDateToDate(year(81)).getFullYear()).toBe(81);
  });
});

describe('partial date: parse', () => {
  const pattern = { pattern: 'dd-MMM-yyyy', locale: 'en-US' };

  it('reads the three precisions of a pattern', () => {
    expect(starParsePartialDate('MAR-2026', pattern)).toEqual(month(2026, 3));
    expect(starParsePartialDate('14-APR-2026', pattern)).toEqual(day(2026, 4, 14));
    expect(starParsePartialDate('1981', pattern)).toEqual(year(1981));
    expect(starParsePartialDate(' march 2026 ', pattern)).toEqual(month(2026, 3));
    expect(starParsePartialDate('5/11/2026', pattern)).toEqual(day(2026, 11, 5));
  });

  it('reads ISO text of every precision', () => {
    expect(starParsePartialDate('2026-04-14', pattern)).toEqual(day(2026, 4, 14));
    expect(starParsePartialDate('2026-04', pattern)).toEqual(month(2026, 4));
    expect(starParsePartialDate('2026', { locale: 'en-GB' })).toEqual(year(2026));
  });

  it('reads the locale order without a pattern', () => {
    expect(starParsePartialDate('14/04/2026', { locale: 'en-GB' })).toEqual(day(2026, 4, 14));
    expect(starParsePartialDate('04/2026', { locale: 'en-GB' })).toEqual(month(2026, 4));
    expect(starParsePartialDate('Apr 2026', { locale: 'en-GB' })).toEqual(month(2026, 4));
    expect(starParsePartialDate('04/14/2026', { locale: 'en-US' })).toEqual(day(2026, 4, 14));
    expect(starParsePartialDate('April 14, 2026', { locale: 'en-US' })).toEqual(day(2026, 4, 14));
    expect(starParsePartialDate('14.04.2026', { locale: 'de-DE' })).toEqual(day(2026, 4, 14));
    expect(starParsePartialDate('März 2026', { locale: 'de-DE' })).toEqual(month(2026, 3));
  });

  it('rejects impossible parts and other text', () => {
    expect(starParsePartialDate('31-APR-2026', pattern)).toBeNull();
    expect(starParsePartialDate('13-2026', pattern)).toBeNull();
    expect(starParsePartialDate('13/2026', { locale: 'en-GB' })).toBeNull();
    expect(starParsePartialDate('2026-13', pattern)).toBeNull();
    expect(starParsePartialDate('29-Feb-2026', pattern)).toBeNull();
    expect(starParsePartialDate('hello', pattern)).toBeNull();
    expect(starParsePartialDate('', pattern)).toBeNull();
    expect(starParsePartialDate('14', pattern)).toBeNull();
  });

  it('takes only the allowed precisions', () => {
    const noDay = { ...pattern, precisions: ['month', 'year'] as const };
    expect(starParsePartialDate('14-Apr-2026', noDay)).toBeNull();
    expect(starParsePartialDate('Apr-2026', noDay)).toEqual(month(2026, 4));
    const dayOnly = { ...pattern, precisions: ['day'] as const };
    expect(starParsePartialDate('2026', dayOnly)).toBeNull();
    expect(starParsePartialDate('Apr-2026', dayOnly)).toBeNull();
  });
});

describe('partial date: format', () => {
  const pattern = { pattern: 'dd-MMM-yyyy', locale: 'en-US' };

  it('shows only the known parts of a pattern', () => {
    expect(starFormatPartialDate(day(2026, 4, 14), pattern)).toBe('14-Apr-2026');
    expect(starFormatPartialDate(month(2026, 3), pattern)).toBe('Mar-2026');
    expect(starFormatPartialDate(year(2026), pattern)).toBe('2026');
  });

  it('uses the Intl format without a pattern', () => {
    expect(starFormatPartialDate(day(2026, 4, 14), { locale: 'en-GB' })).toBe('14/04/2026');
    expect(starFormatPartialDate(month(2026, 4), { locale: 'en-GB' })).toBe('04/2026');
    expect(starFormatPartialDate(year(2026), { locale: 'en-GB' })).toBe('2026');
    expect(
      starFormatPartialDate(month(2026, 4), { locale: 'en-GB', format: { dateStyle: 'long' } }),
    ).toBe('April 2026');
    expect(
      starFormatPartialDate(day(2026, 4, 14), { locale: 'en-GB', format: { dateStyle: 'long' } }),
    ).toBe('14 April 2026');
  });

  it('gives the empty text for an empty or impossible value', () => {
    expect(starFormatPartialDate(null, pattern)).toBe('');
    expect(starFormatPartialDate(month(2026, 13), pattern)).toBe('');
  });

  it('reads back what it writes', () => {
    for (const value of [day(2026, 4, 14), month(2026, 3), year(1981)]) {
      expect(starParsePartialDate(starFormatPartialDate(value, pattern), pattern)).toEqual(value);
      const gb = { locale: 'en-GB' };
      expect(starParsePartialDate(starFormatPartialDate(value, gb), gb)).toEqual(value);
    }
  });

  it('gives a hint per precision', () => {
    expect(starPartialDateHint('day', pattern)).toBe('dd-MMM-yyyy');
    expect(starPartialDateHint('month', pattern)).toBe('MMM-yyyy');
    expect(starPartialDateHint('year', pattern)).toBe('yyyy');
    expect(starPartialDateHint('day', { locale: 'en-GB' })).toBe('dd/mm/yyyy');
    expect(starPartialDateHint('month', { locale: 'en-GB' })).toBe('mm/yyyy');
  });
});
