import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  starFormatPattern,
  starParsePattern,
  starPatternHasTime,
  starPatternHint,
  starTimePattern,
} from './date-pattern';
import { StarDatePicker, StarDateRangePicker, StarMultiDatePicker } from './date-picker';
import { StarDateRange } from './date-utils';

describe('date pattern: format', () => {
  const day = new Date(2026, 10, 5, 9, 26, 7);

  it('formats every token', () => {
    expect(starFormatPattern(day, 'dd-MMM-yyyy', 'en-US')).toBe('05-Nov-2026');
    expect(starFormatPattern(day, 'dd-MMM-yyyy HH:mm', 'en-US')).toBe('05-Nov-2026 09:26');
    expect(starFormatPattern(day, 'd/M/yy', 'en-US')).toBe('5/11/26');
    expect(starFormatPattern(day, 'MMMM d, yyyy', 'en-US')).toBe('November 5, 2026');
    expect(starFormatPattern(day, 'yyyy-MM-dd HH:mm:ss', 'en-US')).toBe('2026-11-05 09:26:07');
    expect(starFormatPattern(new Date(2026, 10, 5, 21, 6), 'h:mm a', 'en-US')).toBe('9:06 PM');
    expect(starFormatPattern(new Date(2026, 10, 5, 0, 6), 'hh:mm a', 'en-US')).toBe('12:06 AM');
    expect(starFormatPattern(day, 'H.m.s', 'en-US')).toBe('9.26.7');
  });

  it('keeps quoted and other text as it is', () => {
    expect(starFormatPattern(day, "yyyy-MM-dd'T'HH:mm", 'en-US')).toBe('2026-11-05T09:26');
    expect(starFormatPattern(day, "dd 'of' MMMM", 'en-US')).toBe('05 of November');
    expect(starFormatPattern(day, "dd''MM", 'en-US')).toBe("05'11");
    expect(starFormatPattern(day, "'day' d", 'en-US')).toBe('day 5');
  });

  it('gives the empty text without a date', () => {
    expect(starFormatPattern(null, 'dd-MMM-yyyy', 'en-US')).toBe('');
    expect(starFormatPattern(new Date(Number.NaN), 'dd-MMM-yyyy', 'en-US')).toBe('');
  });

  it('uses the month names of the locale without a trailing dot', () => {
    expect(starFormatPattern(day, 'dd-MMM-yyyy', 'de-DE')).toBe('05-Nov-2026');
    expect(starFormatPattern(new Date(2026, 2, 1), 'dd-MMM-yyyy', 'de-DE')).not.toContain('.');
    expect(starFormatPattern(new Date(2026, 1, 1), 'dd-MMM-yyyy', 'fr-FR')).not.toMatch(/\.-/);
    expect(starFormatPattern(day, 'd MMMM yyyy', 'de-DE')).toBe('5 November 2026');
  });

  it('adds the time of showTime to a pattern without a time', () => {
    expect(starTimePattern('dd-MMM-yyyy', true, '24', false)).toBe('dd-MMM-yyyy HH:mm');
    expect(starTimePattern('dd-MMM-yyyy', true, '24', true)).toBe('dd-MMM-yyyy HH:mm:ss');
    expect(starTimePattern('dd-MMM-yyyy', true, '12', false)).toBe('dd-MMM-yyyy hh:mm a');
    expect(starTimePattern('dd-MMM-yyyy', false, '24', false)).toBe('dd-MMM-yyyy');
    expect(starTimePattern('dd-MMM-yyyy H:mm', true, '12', false)).toBe('dd-MMM-yyyy H:mm');
    expect(starPatternHasTime("dd-MMM-yyyy 'at' HH:mm")).toBe(true);
    // Letters in quotes are text, not tokens.
    expect(starPatternHasTime("dd-MMM-yyyy 'hms'")).toBe(false);
    expect(starPatternHint("yyyy-MM-dd'T'HH:mm")).toBe('yyyy-MM-ddTHH:mm');
  });
});

describe('date pattern: parse', () => {
  const parse = (text: string, pattern = 'dd-MMM-yyyy', locale = 'en-US') =>
    starParsePattern(text, pattern, locale);

  it('reads the pattern in any case', () => {
    expect(parse('05-Nov-2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-nov-2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-NOV-2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('  05-Nov-2026  ')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-nov-2026 09:26', 'dd-MMM-yyyy HH:mm')).toEqual(new Date(2026, 10, 5, 9, 26));
  });

  it('reads long names, the month number, short numbers and other separators', () => {
    expect(parse('05-November-2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-11-2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('5-Nov-2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('05 Nov 2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('05/Nov/2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-Nov.-2026')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-Nov-26')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-Sep-2026', 'dd-MMM-yyyy', 'en-GB')).toEqual(new Date(2026, 8, 5));
    expect(parse('05-Sept-2026', 'dd-MMM-yyyy', 'en-GB')).toEqual(new Date(2026, 8, 5));
    expect(parse('5/11/26', 'd/M/yy')).toEqual(new Date(2026, 10, 5));
    expect(parse('05112026', 'ddMMyyyy')).toEqual(new Date(2026, 10, 5));
    expect(parse('November 5, 2026', 'MMMM d, yyyy')).toEqual(new Date(2026, 10, 5));
    expect(parse('2026-11-05T09:26', "yyyy-MM-dd'T'HH:mm")).toEqual(new Date(2026, 10, 5, 9, 26));
    expect(parse('05 of nov', "dd 'of' MMM")).toEqual(new Date(new Date().getFullYear(), 10, 5));
  });

  it('reads the month names of de-DE, with and without the dot', () => {
    expect(parse('05-Nov.-2026', 'dd-MMM-yyyy', 'de-DE')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-nov-2026', 'dd-MMM-yyyy', 'de-DE')).toEqual(new Date(2026, 10, 5));
    expect(parse('05-März-2026', 'dd-MMM-yyyy', 'de-DE')).toEqual(new Date(2026, 2, 5));
    expect(parse('05-Dezember-2026', 'dd-MMM-yyyy', 'de-DE')).toEqual(new Date(2026, 11, 5));
    expect(parse('05-Mai-2026', 'dd-MMM-yyyy', 'de-DE')).toEqual(new Date(2026, 4, 5));
  });

  it('reads the 12-hour clock with a day period', () => {
    const pattern = 'dd-MMM-yyyy hh:mm a';
    expect(parse('05-Nov-2026 09:26 PM', pattern)).toEqual(new Date(2026, 10, 5, 21, 26));
    expect(parse('05-Nov-2026 9:26 pm', pattern)).toEqual(new Date(2026, 10, 5, 21, 26));
    expect(parse('05-Nov-2026 9:26pm', pattern)).toEqual(new Date(2026, 10, 5, 21, 26));
    expect(parse('05-Nov-2026 12:05 a.m.', pattern)).toEqual(new Date(2026, 10, 5, 0, 5));
    expect(parse('05-Nov-2026 12:05 PM', pattern)).toEqual(new Date(2026, 10, 5, 12, 5));
    // Without a day period the hour is read as it is.
    expect(parse('05-Nov-2026 21:26', pattern)).toEqual(new Date(2026, 10, 5, 21, 26));
    expect(parse('05-Nov-2026 13:26 PM', pattern)).toBeNull();
  });

  it('rejects text that is not a real date or does not follow the pattern', () => {
    expect(parse('31-Feb-2026')).toBeNull();
    expect(parse('29-Feb-2026')).toBeNull();
    expect(parse('29-Feb-2028')).toEqual(new Date(2028, 1, 29));
    expect(parse('32-Nov-2026')).toBeNull();
    expect(parse('05-Xyz-2026')).toBeNull();
    expect(parse('05-13-2026')).toBeNull();
    expect(parse('05-Nov')).toBeNull();
    expect(parse('05-Nov-2026 extra')).toBeNull();
    expect(parse('')).toBeNull();
    expect(parse('05-Ju-2026')).toBeNull();
    expect(parse('05-Nov-2026 24:00', 'dd-MMM-yyyy HH:mm')).toBeNull();
    expect(parse('05-Nov-2026 09:60', 'dd-MMM-yyyy HH:mm')).toBeNull();
    expect(parse('05-Nov-2026', 'dd-MMM-yyyy HH:mm')).toBeNull();
  });

  it('round-trips every day of a year in several locales and patterns', () => {
    const patterns = ['dd-MMM-yyyy HH:mm', 'd MMMM yy', 'dd.MM.yyyy', 'MMM d, yyyy h:mm a'];
    for (const locale of ['en-US', 'en-GB', 'de-DE', 'fr-FR']) {
      for (const pattern of patterns) {
        for (let index = 0; index < 366; index++) {
          const date = new Date(2028, 0, 1 + index, index % 24, (index * 7) % 60);
          const text = starFormatPattern(date, pattern, locale);
          const expected = starPatternHasTime(pattern)
            ? date
            : new Date(date.getFullYear(), date.getMonth(), date.getDate());
          expect(starParsePattern(text, pattern, locale), `${locale} ${pattern} ${text}`).toEqual(
            expected,
          );
        }
      }
    }
  });
});

@Component({
  imports: [StarDatePicker, StarDateRangePicker, StarMultiDatePicker],
  template: `
    <star-date-picker
      ariaLabel="Due"
      locale="en-US"
      datePattern="dd-MMM-yyyy"
      dataType="string"
      showTime
      [(value)]="due"
    />
    <star-date-picker
      ariaLabel="Ship"
      locale="en-US"
      datePattern="dd-MMM-yyyy"
      [dateFormat]="{ dateStyle: 'long' }"
      [(value)]="ship"
    />
    <star-date-picker
      ariaLabel="Twelve"
      locale="en-US"
      datePattern="dd-MMM-yyyy"
      hourFormat="12"
      showTime
      [(value)]="twelve"
    />
    <star-date-picker
      ariaLabel="Kept"
      locale="en-US"
      datePattern="dd-MMM-yyyy"
      keepInvalid
      [(value)]="kept"
    />
    <star-date-range-picker
      ariaLabel="Trip"
      locale="en-US"
      datePattern="dd-MMM-yyyy"
      dataType="string"
      [(value)]="trip"
    />
    <star-multi-date-picker
      ariaLabel="Days"
      locale="en-US"
      datePattern="dd-MMM-yyyy"
      [(value)]="days"
    />
    <star-date-picker ariaLabel="Month" view="month" datePattern="dd-MMM-yyyy" [(value)]="month" />
  `,
})
class PatternHost {
  readonly due = signal<string | null>('2026-11-05T09:26');
  readonly ship = signal<Date | null>(new Date(2026, 10, 5));
  readonly twelve = signal<Date | null>(new Date(2026, 10, 5, 21, 6));
  readonly kept = signal<Date | null>(new Date(2026, 10, 5));
  readonly trip = signal<StarDateRange<string> | null>({ start: '2026-11-05', end: '2026-11-10' });
  readonly days = signal<readonly Date[]>([new Date(2026, 10, 5), new Date(2026, 10, 9)]);
  readonly month = signal<Date | null>(new Date(2026, 10, 1));
}

describe('date picker: datePattern', () => {
  async function setup() {
    const fixture = TestBed.createComponent(PatternHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = (label: string) =>
      el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    const type = async (label: string, text: string) => {
      const field = input(label);
      field.dispatchEvent(new Event('focus'));
      field.value = text;
      field.dispatchEvent(new Event('input'));
      field.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, input, type };
  }

  it('shows the value in the pattern, with the time of showTime', async () => {
    const { input } = await setup();
    expect(input('Due').value).toBe('05-Nov-2026 09:26');
    expect(input('Due').placeholder).toBe('dd-MMM-yyyy HH:mm');
    expect(input('Due').getAttribute('inputmode')).toBe('text');
    // The pattern wins over dateFormat.
    expect(input('Ship').value).toBe('05-Nov-2026');
    expect(input('Twelve').value).toBe('05-Nov-2026 09:06 PM');
    expect(input('Twelve').placeholder).toBe('dd-MMM-yyyy hh:mm a');
  });

  it('reads typed text in the pattern into the value', async () => {
    const { host, input, type } = await setup();
    await type('Due', '10-nov-2026 14:05');
    expect(host.due()).toBe('2026-11-10T14:05');
    expect(input('Due').value).toBe('10-Nov-2026 14:05');
    await type('Due', '05-nov-2026 09:26');
    expect(host.due()).toBe('2026-11-05T09:26');
    // A date without the time keeps the time of the value.
    await type('Due', '06-Nov-2026');
    expect(host.due()).toBe('2026-11-06T09:26');
    await type('Ship', '7 november 2026');
    expect(host.ship()).toEqual(new Date(2026, 10, 7));
    expect(input('Ship').value).toBe('07-Nov-2026');
    await type('Twelve', '05-Nov-2026 08:15 am');
    expect(host.twelve()).toEqual(new Date(2026, 10, 5, 8, 15));
  });

  it('reverts invalid text, or keeps it with keepInvalid', async () => {
    const { host, input, type } = await setup();
    await type('Due', '31-Feb-2026 09:26');
    expect(host.due()).toBe('2026-11-05T09:26');
    expect(input('Due').value).toBe('05-Nov-2026 09:26');
    await type('Kept', '31-Feb-2026');
    expect(host.kept()).toBeNull();
    expect(input('Kept').value).toBe('31-Feb-2026');
    expect(input('Kept').getAttribute('aria-invalid')).toBe('true');
  });

  it('uses the pattern for both ends of a range and each day of a list', async () => {
    const { host, input, type } = await setup();
    expect(input('Trip').value).toBe('05-Nov-2026 – 10-Nov-2026');
    await type('Trip', '12-nov-2026 - 01-Nov-2026');
    expect(host.trip()).toEqual({ start: '2026-11-01', end: '2026-11-12' });
    expect(input('Trip').value).toBe('01-Nov-2026 – 12-Nov-2026');
    expect(input('Days').value).toBe('05-Nov-2026, 09-Nov-2026');
    await type('Days', '03-Nov-2026; 01-nov-2026');
    expect(host.days()).toEqual([new Date(2026, 10, 1), new Date(2026, 10, 3)]);
  });

  it('does not use the pattern for the month view', async () => {
    const { input } = await setup();
    expect(input('Month').value).toBe('11/2026');
    expect(input('Month').getAttribute('inputmode')).toBe('numeric');
  });
});
