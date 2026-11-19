import {
  starAllDayEnd,
  starDaySegments,
  starDaySpans,
  starMinutesOf,
  starMonthCell,
  starPackColumns,
  StarSchedulerEvent,
  starSchedulerOccurrences,
  starSchedulerRange,
  starSchedulerStep,
  starShiftDate,
  starSnapToSlot,
  starWallMinutes,
} from './scheduler-model';

const at = (y: number, m: number, d: number, h = 0, min = 0): Date => new Date(y, m - 1, d, h, min);
const day = (date: Date) => `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
const options = { firstDayOfWeek: 1, workWeekDays: [1, 2, 3, 4, 5], agendaDays: 7 };

describe('starSchedulerRange', () => {
  // Wednesday 4 March 2026.
  const anchor = at(2026, 3, 4, 15);

  it('shows one day for the day and timeline views', () => {
    for (const view of ['day', 'timeline-day'] as const) {
      const range = starSchedulerRange(view, anchor, options);
      expect(range.days.map(day)).toEqual(['2026-3-4']);
      expect(range.start).toEqual(at(2026, 3, 4));
      expect(range.end).toEqual(at(2026, 3, 5));
    }
  });

  it('starts the week on the first day of the week', () => {
    expect(starSchedulerRange('week', anchor, options).days.map(day)).toEqual([
      '2026-3-2',
      '2026-3-3',
      '2026-3-4',
      '2026-3-5',
      '2026-3-6',
      '2026-3-7',
      '2026-3-8',
    ]);
    const sunday = starSchedulerRange('week', anchor, { ...options, firstDayOfWeek: 0 });
    expect(day(sunday.days[0])).toBe('2026-3-1');
  });

  it('keeps the work days in the work week', () => {
    const range = starSchedulerRange('work-week', anchor, options);
    expect(range.days.map(day)).toEqual([
      '2026-3-2',
      '2026-3-3',
      '2026-3-4',
      '2026-3-5',
      '2026-3-6',
    ]);
    expect(range.end).toEqual(at(2026, 3, 7));
  });

  it('shows six weeks for the month', () => {
    const range = starSchedulerRange('month', anchor, options);
    expect(range.days).toHaveLength(42);
    expect(day(range.start)).toBe('2026-2-23');
    expect(day(range.end)).toBe('2026-4-6');
  });

  it('shows the agenda days from the anchor', () => {
    const range = starSchedulerRange('agenda', anchor, { ...options, agendaDays: 3 });
    expect(range.days.map(day)).toEqual(['2026-3-4', '2026-3-5', '2026-3-6']);
  });
});

describe('starSchedulerStep', () => {
  it('pages by the length of the view', () => {
    const date = at(2026, 1, 31);
    expect(day(starSchedulerStep('day', date, 1, 7))).toBe('2026-2-1');
    expect(day(starSchedulerStep('week', date, -1, 7))).toBe('2026-1-24');
    expect(day(starSchedulerStep('work-week', date, 1, 7))).toBe('2026-2-7');
    // Month paging clamps the day: 31 January + 1 month = 28 February.
    expect(day(starSchedulerStep('month', date, 1, 7))).toBe('2026-2-28');
    expect(day(starSchedulerStep('agenda', date, 1, 14))).toBe('2026-2-14');
    expect(day(starSchedulerStep('timeline-day', date, -1, 7))).toBe('2026-1-30');
  });
});

describe('starSchedulerOccurrences', () => {
  const range = { start: at(2026, 3, 2), end: at(2026, 3, 9) };

  it('keeps single events that overlap the range, sorted by start then longer first', () => {
    const events: StarSchedulerEvent[] = [
      { id: 'late', title: 'Late', start: at(2026, 3, 3, 14), end: at(2026, 3, 3, 15) },
      { id: 'out', title: 'Out', start: at(2026, 3, 10, 9), end: at(2026, 3, 10, 10) },
      { id: 'short', title: 'Short', start: at(2026, 3, 3, 9), end: at(2026, 3, 3, 10) },
      { id: 'long', title: 'Long', start: at(2026, 3, 3, 9), end: at(2026, 3, 3, 12) },
      { id: 'before', title: 'Runs in', start: at(2026, 3, 1, 22), end: at(2026, 3, 2, 2) },
    ];
    expect(starSchedulerOccurrences(events, range).map((o) => o.key)).toEqual([
      'before',
      'long',
      'short',
      'late',
    ]);
  });

  it('expands a recurring event, keeps its length, and gives each occurrence a key', () => {
    const events: StarSchedulerEvent[] = [
      {
        id: 7,
        title: 'Stand-up',
        start: at(2026, 2, 2, 9),
        end: at(2026, 2, 2, 9, 15),
        recurrence: 'FREQ=WEEKLY;BYDAY=MO,WE',
        exceptions: [at(2026, 3, 4)],
      },
    ];
    const occurrences = starSchedulerOccurrences(events, range);
    expect(occurrences.map((o) => day(o.start))).toEqual(['2026-3-2']);
    expect(occurrences[0].end).toEqual(at(2026, 3, 2, 9, 15));
    expect(occurrences[0].recurring).toBe(true);
    expect(occurrences[0].key).toBe(`7@${at(2026, 3, 2, 9).getTime()}`);
  });

  it('gives all-day events an exclusive midnight end', () => {
    const events: StarSchedulerEvent[] = [
      { id: 1, title: 'Fair', start: at(2026, 3, 3), end: at(2026, 3, 5), allDay: true },
      { id: 2, title: 'Holiday', start: at(2026, 3, 6), end: at(2026, 3, 6), allDay: true },
    ];
    const [fair, holiday] = starSchedulerOccurrences(events, range);
    expect(fair.end).toEqual(at(2026, 3, 5));
    expect(holiday.end).toEqual(at(2026, 3, 7));
    expect(starAllDayEnd({ start: at(2026, 3, 3), end: at(2026, 3, 4, 12) })).toEqual(
      at(2026, 3, 5),
    );
  });
});

describe('invalid and unsupported recurrence rules', () => {
  const range = { start: at(2026, 3, 2), end: at(2026, 3, 9) };
  const base = (recurrence: string): StarSchedulerEvent => ({
    id: 9,
    title: 'Review',
    start: at(2026, 3, 3, 10),
    end: at(2026, 3, 3, 11),
    recurrence,
  });
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => warn.mockRestore());

  it('shows the single base event for a rule that does not parse', () => {
    const occurrences = starSchedulerOccurrences([base('FREQ=HOURLY')], range);
    expect(occurrences.map((o) => [o.key, o.recurring])).toEqual([['9', false]]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('FREQ=HOURLY'));
  });

  it('does not expand a rule with an unsupported part, and names the part', () => {
    const occurrences = starSchedulerOccurrences(
      [base('FREQ=MONTHLY;BYDAY=TU;BYSETPOS=-1')],
      range,
    );
    expect(occurrences.map((o) => [o.key, o.recurring])).toEqual([['9', false]]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('BYSETPOS'));
  });

  it('warns once per rule', () => {
    starSchedulerOccurrences([base('FREQ=DAILY;BYHOUR=9')], range);
    starSchedulerOccurrences([base('FREQ=DAILY;BYHOUR=9')], range);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('starPackColumns (overlap layout)', () => {
  it('puts overlapping items side by side and keeps separate clusters apart', () => {
    const packed = starPackColumns([
      { start: 0, end: 60 },
      { start: 30, end: 90 },
      { start: 60, end: 120 },
      { start: 200, end: 260 },
    ]);
    expect(packed).toEqual([
      { column: 0, columns: 2 },
      { column: 1, columns: 2 },
      // Reuses the first column, which is free at 60.
      { column: 0, columns: 2 },
      { column: 0, columns: 1 },
    ]);
  });

  it('opens a column for each item that starts while all columns are taken', () => {
    const packed = starPackColumns([
      { start: 0, end: 100 },
      { start: 10, end: 100 },
      { start: 20, end: 100 },
    ]);
    expect(packed.map((p) => p.column)).toEqual([0, 1, 2]);
    expect(packed.every((p) => p.columns === 3)).toBe(true);
  });

  it('keeps the order of the input and treats zero-length items as one unit long', () => {
    const packed = starPackColumns([
      { start: 50, end: 50 },
      { start: 50, end: 80 },
    ]);
    expect(packed).toEqual([
      { column: 1, columns: 2 },
      { column: 0, columns: 2 },
    ]);
  });
});

describe('day segments and spans', () => {
  it('cuts a timed occurrence at midnight and gives minutes from midnight', () => {
    const occurrences = starSchedulerOccurrences(
      [{ id: 1, title: 'Night', start: at(2026, 3, 2, 22), end: at(2026, 3, 3, 1, 30) }],
      { start: at(2026, 3, 2), end: at(2026, 3, 4) },
    );
    const [first] = starDaySegments(occurrences, at(2026, 3, 2));
    expect(first).toMatchObject({ startMinute: 1320, endMinute: 1440, continuesAfter: true });
    const [second] = starDaySegments(occurrences, at(2026, 3, 3));
    expect(second).toMatchObject({ startMinute: 0, endMinute: 90, continuesBefore: true });
  });

  it('places all-day occurrences in lanes across the days', () => {
    const days = starSchedulerRange('week', at(2026, 3, 4), options).days;
    const occurrences = starSchedulerOccurrences(
      [
        { id: 1, title: 'Fair', start: at(2026, 3, 3), end: at(2026, 3, 6), allDay: true },
        { id: 2, title: 'Audit', start: at(2026, 3, 4), end: at(2026, 3, 4), allDay: true },
        { id: 3, title: 'Holiday', start: at(2026, 3, 7), end: at(2026, 3, 7), allDay: true },
      ],
      { start: days[0], end: at(2026, 3, 9) },
    );
    const spans = starDaySpans(occurrences, days).map((s) => [
      s.occurrence.key,
      s.first,
      s.last,
      s.lane,
    ]);
    expect(spans).toEqual([
      ['1', 1, 3, 0],
      ['2', 2, 2, 1],
      ['3', 5, 5, 0],
    ]);
  });
});

describe('starMonthCell ("+N more")', () => {
  it('shows every item up to the limit', () => {
    expect(starMonthCell(['a', 'b', 'c'], 3)).toEqual({ shown: ['a', 'b', 'c'], more: 0 });
  });

  it('replaces the last shown item with "+N more" when there are more', () => {
    expect(starMonthCell(['a', 'b', 'c', 'd', 'e'], 3)).toEqual({ shown: ['a', 'b'], more: 3 });
    expect(starMonthCell(['a', 'b'], 1)).toEqual({ shown: [], more: 2 });
  });
});

describe('time helpers', () => {
  it('snaps to the nearest slot', () => {
    expect(starSnapToSlot(at(2026, 3, 3, 10, 10), 30)).toEqual(at(2026, 3, 3, 10));
    expect(starSnapToSlot(at(2026, 3, 3, 10, 15), 30)).toEqual(at(2026, 3, 3, 10, 30));
    expect(starSnapToSlot(at(2026, 3, 3, 23, 50), 30)).toEqual(at(2026, 3, 4));
    expect(starSnapToSlot(at(2026, 3, 3, 10, 7), 15)).toEqual(at(2026, 3, 3, 10, 0));
  });

  it('shifts and measures wall-clock time', () => {
    expect(starShiftDate(at(2026, 3, 3, 10), 1, 30)).toEqual(at(2026, 3, 4, 10, 30));
    expect(starShiftDate(at(2026, 3, 3, 23, 30), 0, 60)).toEqual(at(2026, 3, 4, 0, 30));
    expect(starWallMinutes(at(2026, 3, 3, 10), at(2026, 3, 4, 9))).toBe(1380);
  });

  it('reads HH:mm text', () => {
    expect(starMinutesOf('08:30', 0)).toBe(510);
    expect(starMinutesOf('24:00', 0)).toBe(1440);
    expect(starMinutesOf('later', 480)).toBe(480);
    expect(starMinutesOf(null, 60)).toBe(60);
  });
});
