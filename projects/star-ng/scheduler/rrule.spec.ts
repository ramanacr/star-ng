import { starExpandRrule, starFormatRrule, starParseRrule, StarRrule } from './rrule';

/** Local date at a wall-clock time. */
const at = (y: number, m: number, d: number, h = 0, min = 0): Date => new Date(y, m - 1, d, h, min);
/** `yyyy-mm-dd hh:mm` text of local dates, for readable expectations. */
const text = (dates: readonly Date[]): string[] =>
  dates.map((date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  });
/** Expands `rule` from `start` over a wide window. */
const expand = (rule: string, start: Date, from = at(1990, 1, 1), to = at(2100, 1, 1)): string[] =>
  text(starExpandRrule(rule, start, { start: from, end: to }, { limit: 60 }));

describe('starParseRrule', () => {
  it('reads every supported part', () => {
    const rule = starParseRrule(
      'RRULE:FREQ=MONTHLY;INTERVAL=2;COUNT=5;BYDAY=2MO,-1FR,TU;BYMONTHDAY=1,-1;BYMONTH=3,9;WKST=SU',
    );
    expect(rule).toEqual({
      freq: 'MONTHLY',
      interval: 2,
      count: 5,
      until: null,
      byDay: [
        { day: 1, ordinal: 2 },
        { day: 5, ordinal: -1 },
        { day: 2, ordinal: 0 },
      ],
      byMonthDay: [1, -1],
      byMonth: [3, 9],
      weekStart: 0,
      unsupported: [],
    } satisfies StarRrule);
  });

  it('defaults INTERVAL to 1 and WKST to Monday, and takes the parts in any case and order', () => {
    const rule = starParseRrule('byday=mo;freq=weekly');
    expect(rule?.freq).toBe('WEEKLY');
    expect(rule?.interval).toBe(1);
    expect(rule?.weekStart).toBe(1);
    expect(rule?.byDay).toEqual([{ day: 1, ordinal: 0 }]);
  });

  it('reads UNTIL as a UTC time, a local time or a whole local day', () => {
    expect(starParseRrule('FREQ=DAILY;UNTIL=20260310T120000Z')?.until?.toISOString()).toBe(
      '2026-03-10T12:00:00.000Z',
    );
    expect(starParseRrule('FREQ=DAILY;UNTIL=20260310T083000')?.until).toEqual(
      at(2026, 3, 10, 8, 30),
    );
    // A date-only UNTIL keeps the whole day: the last moment of 10 March, local time.
    const until = starParseRrule('FREQ=DAILY;UNTIL=20260310')!.until!;
    expect(text([until])).toEqual(['2026-03-10 23:59']);
  });

  it('lists the parts it does not expand, and returns null without a valid FREQ', () => {
    expect(starParseRrule('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=-1;BYHOUR=9')?.unsupported).toEqual([
      'BYSETPOS',
      'BYHOUR',
    ]);
    expect(starParseRrule('INTERVAL=2')).toBeNull();
    expect(starParseRrule('FREQ=HOURLY')).toBeNull();
    expect(starParseRrule('')).toBeNull();
    expect(starParseRrule('FREQ=DAILY;INTERVAL=0')).toBeNull();
    expect(starParseRrule('FREQ=DAILY;COUNT=x')).toBeNull();
    expect(starParseRrule('FREQ=DAILY;BYDAY=XX')).toBeNull();
    expect(starParseRrule('FREQ=DAILY;BYMONTHDAY=0')).toBeNull();
    expect(starParseRrule('FREQ=DAILY;BYMONTH=13')).toBeNull();
    expect(starParseRrule('FREQ=DAILY;UNTIL=2026')).toBeNull();
  });

  it('writes a rule back to RRULE text', () => {
    const source =
      'FREQ=MONTHLY;INTERVAL=2;COUNT=5;BYDAY=2MO,-1FR;BYMONTHDAY=1,-1;BYMONTH=3,9;WKST=SU';
    expect(starFormatRrule(starParseRrule(source)!)).toBe(source);
    expect(starFormatRrule(starParseRrule('FREQ=WEEKLY;BYDAY=TU,TH')!)).toBe(
      'FREQ=WEEKLY;BYDAY=TU,TH',
    );
    expect(starFormatRrule(starParseRrule('FREQ=DAILY;UNTIL=20260310T120000Z')!)).toBe(
      'FREQ=DAILY;UNTIL=20260310T120000Z',
    );
  });
});

describe('starExpandRrule', () => {
  describe('FREQ=DAILY', () => {
    it('repeats every day at the time of the start', () => {
      expect(expand('FREQ=DAILY;COUNT=3', at(2026, 3, 30, 9, 15))).toEqual([
        '2026-03-30 09:15',
        '2026-03-31 09:15',
        '2026-04-01 09:15',
      ]);
    });

    it('steps by INTERVAL', () => {
      expect(expand('FREQ=DAILY;INTERVAL=3;COUNT=3', at(2026, 3, 1, 8))).toEqual([
        '2026-03-01 08:00',
        '2026-03-04 08:00',
        '2026-03-07 08:00',
      ]);
    });

    it('keeps only the days of BYDAY and BYMONTH', () => {
      // Weekdays only (Monday 2 March 2026 to Friday 6 March), then the weekend is skipped.
      expect(expand('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;COUNT=6', at(2026, 3, 5, 9))).toEqual([
        '2026-03-05 09:00',
        '2026-03-06 09:00',
        '2026-03-09 09:00',
        '2026-03-10 09:00',
        '2026-03-11 09:00',
        '2026-03-12 09:00',
      ]);
      expect(expand('FREQ=DAILY;BYMONTH=2;COUNT=2', at(2026, 1, 30))).toEqual([
        '2026-02-01 00:00',
        '2026-02-02 00:00',
      ]);
    });

    it('keeps only the days of BYMONTHDAY, counted from the end when negative', () => {
      expect(expand('FREQ=DAILY;BYMONTHDAY=-1;COUNT=3', at(2026, 1, 15))).toEqual([
        '2026-01-31 00:00',
        '2026-02-28 00:00',
        '2026-03-31 00:00',
      ]);
    });
  });

  describe('FREQ=WEEKLY', () => {
    it('repeats on the weekday of the start without BYDAY', () => {
      expect(expand('FREQ=WEEKLY;COUNT=3', at(2026, 3, 3, 10))).toEqual([
        '2026-03-03 10:00',
        '2026-03-10 10:00',
        '2026-03-17 10:00',
      ]);
    });

    it('repeats on every BYDAY weekday, in date order', () => {
      expect(expand('FREQ=WEEKLY;BYDAY=FR,TU;COUNT=4', at(2026, 3, 3, 10))).toEqual([
        '2026-03-03 10:00',
        '2026-03-06 10:00',
        '2026-03-10 10:00',
        '2026-03-13 10:00',
      ]);
    });

    it('does not add a start that the rule does not produce', () => {
      // The start is a Wednesday; the rule only produces Mondays.
      expect(expand('FREQ=WEEKLY;BYDAY=MO;COUNT=2', at(2026, 3, 4, 9))).toEqual([
        '2026-03-09 09:00',
        '2026-03-16 09:00',
      ]);
    });

    it('uses WKST to group the weeks of INTERVAL=2', () => {
      // RFC 5545 example: the same rule with a different week start gives other days.
      const start = at(1997, 8, 5, 9);
      expect(expand('FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=MO', start)).toEqual([
        '1997-08-05 09:00',
        '1997-08-10 09:00',
        '1997-08-19 09:00',
        '1997-08-24 09:00',
      ]);
      expect(expand('FREQ=WEEKLY;INTERVAL=2;COUNT=4;BYDAY=TU,SU;WKST=SU', start)).toEqual([
        '1997-08-05 09:00',
        '1997-08-17 09:00',
        '1997-08-19 09:00',
        '1997-08-31 09:00',
      ]);
    });
  });

  describe('FREQ=MONTHLY', () => {
    it('repeats on the day of the month of the start and skips months without that day', () => {
      expect(expand('FREQ=MONTHLY;COUNT=4', at(2026, 1, 31, 9))).toEqual([
        '2026-01-31 09:00',
        '2026-03-31 09:00',
        '2026-05-31 09:00',
        '2026-07-31 09:00',
      ]);
    });

    it('takes ordinal weekdays: the second Monday and the last Friday', () => {
      expect(expand('FREQ=MONTHLY;BYDAY=2MO;COUNT=3', at(2026, 1, 1, 9))).toEqual([
        '2026-01-12 09:00',
        '2026-02-09 09:00',
        '2026-03-09 09:00',
      ]);
      expect(expand('FREQ=MONTHLY;BYDAY=-1FR;COUNT=3', at(2026, 1, 1, 16))).toEqual([
        '2026-01-30 16:00',
        '2026-02-27 16:00',
        '2026-03-27 16:00',
      ]);
    });

    it('takes every matching weekday of the month without an ordinal', () => {
      expect(expand('FREQ=MONTHLY;BYDAY=MO;COUNT=5', at(2026, 3, 1))).toEqual([
        '2026-03-02 00:00',
        '2026-03-09 00:00',
        '2026-03-16 00:00',
        '2026-03-23 00:00',
        '2026-03-30 00:00',
      ]);
    });

    it('takes BYMONTHDAY, negative days from the end, and skips days the month lacks', () => {
      expect(expand('FREQ=MONTHLY;BYMONTHDAY=1,-1;COUNT=4', at(2026, 1, 1, 9))).toEqual([
        '2026-01-01 09:00',
        '2026-01-31 09:00',
        '2026-02-01 09:00',
        '2026-02-28 09:00',
      ]);
      expect(expand('FREQ=MONTHLY;BYMONTHDAY=30;COUNT=2', at(2026, 1, 1))).toEqual([
        '2026-01-30 00:00',
        '2026-03-30 00:00',
      ]);
    });

    it('intersects BYDAY and BYMONTHDAY: Friday the 13th', () => {
      expect(expand('FREQ=MONTHLY;BYDAY=FR;BYMONTHDAY=13;COUNT=3', at(2026, 1, 1))).toEqual([
        '2026-02-13 00:00',
        '2026-03-13 00:00',
        '2026-11-13 00:00',
      ]);
    });

    it('steps by INTERVAL and filters BYMONTH', () => {
      expect(expand('FREQ=MONTHLY;INTERVAL=3;COUNT=3', at(2026, 1, 15))).toEqual([
        '2026-01-15 00:00',
        '2026-04-15 00:00',
        '2026-07-15 00:00',
      ]);
      expect(expand('FREQ=MONTHLY;BYMONTH=6,12;COUNT=3', at(2026, 1, 15))).toEqual([
        '2026-06-15 00:00',
        '2026-12-15 00:00',
        '2027-06-15 00:00',
      ]);
    });
  });

  describe('FREQ=YEARLY', () => {
    it('repeats on the date of the start, and 29 February only in leap years', () => {
      expect(expand('FREQ=YEARLY;COUNT=2', at(2026, 3, 3, 10))).toEqual([
        '2026-03-03 10:00',
        '2027-03-03 10:00',
      ]);
      expect(expand('FREQ=YEARLY;COUNT=3', at(2024, 2, 29))).toEqual([
        '2024-02-29 00:00',
        '2028-02-29 00:00',
        '2032-02-29 00:00',
      ]);
    });

    it('takes BYMONTH with the day of the start', () => {
      expect(expand('FREQ=YEARLY;BYMONTH=1,7;COUNT=3', at(2026, 1, 10))).toEqual([
        '2026-01-10 00:00',
        '2026-07-10 00:00',
        '2027-01-10 00:00',
      ]);
    });

    it('takes an ordinal weekday in BYMONTH: the last Monday of May', () => {
      expect(expand('FREQ=YEARLY;BYMONTH=5;BYDAY=-1MO;COUNT=2', at(2026, 1, 1))).toEqual([
        '2026-05-25 00:00',
        '2027-05-31 00:00',
      ]);
    });

    it('takes an ordinal weekday of the year without BYMONTH', () => {
      // The 20th Monday of the year.
      expect(expand('FREQ=YEARLY;BYDAY=20MO;COUNT=2', at(2026, 1, 1))).toEqual([
        '2026-05-18 00:00',
        '2027-05-17 00:00',
      ]);
    });

    it('takes BYMONTHDAY with BYMONTH', () => {
      expect(expand('FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=1,-1;COUNT=3', at(2026, 1, 1))).toEqual([
        '2026-03-01 00:00',
        '2026-03-31 00:00',
        '2027-03-01 00:00',
      ]);
    });

    it('steps by INTERVAL', () => {
      expect(expand('FREQ=YEARLY;INTERVAL=2;COUNT=2', at(2026, 6, 1))).toEqual([
        '2026-06-01 00:00',
        '2028-06-01 00:00',
      ]);
    });
  });

  describe('COUNT and UNTIL', () => {
    it('counts from the start of the series, also when the range starts later', () => {
      const dates = starExpandRrule('FREQ=DAILY;COUNT=5', at(2026, 3, 1, 9), {
        start: at(2026, 3, 4),
        end: at(2026, 4, 1),
      });
      expect(text(dates)).toEqual(['2026-03-04 09:00', '2026-03-05 09:00']);
    });

    it('stops at UNTIL, which is inclusive', () => {
      expect(expand('FREQ=DAILY;UNTIL=20260303T090000', at(2026, 3, 1, 9))).toEqual([
        '2026-03-01 09:00',
        '2026-03-02 09:00',
        '2026-03-03 09:00',
      ]);
      expect(expand('FREQ=WEEKLY;UNTIL=20260317', at(2026, 3, 3, 18))).toEqual([
        '2026-03-03 18:00',
        '2026-03-10 18:00',
        '2026-03-17 18:00',
      ]);
    });

    it('stops at whichever of COUNT and UNTIL comes first', () => {
      expect(expand('FREQ=DAILY;COUNT=2;UNTIL=20260310', at(2026, 3, 1))).toHaveLength(2);
      expect(expand('FREQ=DAILY;COUNT=20;UNTIL=20260303', at(2026, 3, 1))).toHaveLength(3);
    });

    it('stops at the range end without COUNT or UNTIL, and at the limit', () => {
      const dates = starExpandRrule('FREQ=DAILY', at(2026, 3, 1), {
        start: at(2026, 3, 1),
        end: at(2026, 3, 8),
      });
      expect(dates).toHaveLength(7);
      const limited = starExpandRrule(
        'FREQ=DAILY',
        at(2026, 3, 1),
        { start: at(2026, 3, 1), end: at(2030, 1, 1) },
        { limit: 10 },
      );
      expect(limited).toHaveLength(10);
    });

    it('finds the occurrences of a range far after the start without COUNT', () => {
      const dates = starExpandRrule('FREQ=WEEKLY;BYDAY=MO', at(2000, 1, 3, 9), {
        start: at(2026, 3, 1),
        end: at(2026, 3, 15),
      });
      expect(text(dates)).toEqual(['2026-03-02 09:00', '2026-03-09 09:00']);
    });
  });

  describe('range and exceptions', () => {
    it('keeps an occurrence that started before the range but still runs, with a duration', () => {
      const start = at(2026, 3, 1, 22);
      const range = { start: at(2026, 3, 2), end: at(2026, 3, 3) };
      expect(text(starExpandRrule('FREQ=DAILY', start, range))).toEqual(['2026-03-02 22:00']);
      expect(
        text(starExpandRrule('FREQ=DAILY', start, range, { duration: 3 * 3_600_000 })),
      ).toEqual(['2026-03-01 22:00', '2026-03-02 22:00']);
    });

    it('removes the occurrences on the days of the exceptions, after COUNT', () => {
      const dates = starExpandRrule(
        'FREQ=DAILY;COUNT=4',
        at(2026, 3, 1, 9),
        { start: at(2026, 1, 1), end: at(2027, 1, 1) },
        { exceptions: [at(2026, 3, 2), at(2026, 3, 3, 9)] },
      );
      // The exceptions still count: the series ends on 4 March.
      expect(text(dates)).toEqual(['2026-03-01 09:00', '2026-03-04 09:00']);
    });

    it('accepts a parsed rule, and returns nothing for invalid text', () => {
      const rule = starParseRrule('FREQ=DAILY;COUNT=2')!;
      expect(
        starExpandRrule(rule, at(2026, 3, 1), { start: at(2026, 1, 1), end: at(2027, 1, 1) }),
      ).toHaveLength(2);
      expect(
        starExpandRrule('FREQ=SECONDLY', at(2026, 3, 1), {
          start: at(2026, 1, 1),
          end: at(2027, 1, 1),
        }),
      ).toEqual([]);
    });
  });

  describe('daylight saving time', () => {
    const original = process.env['TZ'];
    beforeAll(() => {
      process.env['TZ'] = 'Europe/Berlin';
    });
    afterAll(() => {
      if (original === undefined) delete process.env['TZ'];
      else process.env['TZ'] = original;
    });

    it('keeps the wall-clock time across a change of the clock', () => {
      // Berlin moves the clock forward on 29 March 2026 and back on 25 October 2026.
      const spring = expand('FREQ=DAILY;COUNT=3', at(2026, 3, 28, 9));
      expect(spring).toEqual(['2026-03-28 09:00', '2026-03-29 09:00', '2026-03-30 09:00']);
      const autumn = expand('FREQ=WEEKLY;COUNT=2', at(2026, 10, 20, 9));
      expect(autumn).toEqual(['2026-10-20 09:00', '2026-10-27 09:00']);
    });

    it('has 23 hours between two occurrences across the spring change, when the zone has it', () => {
      const dates = starExpandRrule('FREQ=DAILY;COUNT=2', at(2026, 3, 28, 9), {
        start: at(2026, 1, 1),
        end: at(2027, 1, 1),
      });
      const hours = (dates[1].getTime() - dates[0].getTime()) / 3_600_000;
      const offsetChanges =
        at(2026, 3, 28).getTimezoneOffset() !== at(2026, 3, 30).getTimezoneOffset();
      expect(hours).toBe(offsetChanges ? 23 : 24);
    });
  });
});
