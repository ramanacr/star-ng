import {
  STAR_GANTT_DAY_WIDTH,
  starGanttDays,
  starGanttDependencyPath,
  starGanttRange,
  starGanttRows,
  starGanttShift,
  StarGanttTask,
  starGanttTicks,
  starGanttUnitStart,
  starGanttWindow,
  starGanttX,
} from './gantt-model';

const at = (m: number, d: number, h = 0): Date => new Date(2026, m - 1, d, h);
const day = (date: Date) => `${date.getMonth() + 1}-${date.getDate()}`;

const PLAN: StarGanttTask[] = [
  { id: 'plan', name: 'Plan', start: at(3, 2), end: at(3, 3) },
  { id: 'build', name: 'Build', start: at(3, 1), end: at(3, 1) },
  { id: 'design', name: 'Design', start: at(3, 3), end: at(3, 7), progress: 50, parentId: 'build' },
  { id: 'code', name: 'Code', start: at(3, 9), end: at(3, 21), progress: 0, parentId: 'build' },
  { id: 'api', name: 'API', start: at(3, 9), end: at(3, 13), progress: 100, parentId: 'code' },
  { id: 'launch', name: 'Launch', start: at(3, 30), end: at(3, 30), milestone: true },
];

describe('starGanttRows', () => {
  it('orders the tree, with levels, sizes and positions', () => {
    const rows = starGanttRows(PLAN);
    expect(rows.map((r) => [r.task.id, r.level, r.posinset, r.setsize, r.summary])).toEqual([
      ['plan', 1, 1, 3, false],
      ['build', 1, 2, 3, true],
      ['design', 2, 1, 2, false],
      ['code', 2, 2, 2, true],
      ['api', 3, 1, 1, false],
      ['launch', 1, 3, 3, false],
    ]);
    expect(rows.map((r) => r.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('lets a summary task span its children, with weighted progress', () => {
    const build = starGanttRows(PLAN).find((r) => r.task.id === 'build')!;
    // Design: 4 days at 50 %, Code: its own child API (4 days at 100 %).
    expect(day(build.start)).toBe('3-3');
    expect(day(build.end)).toBe('3-13');
    expect(build.progress).toBe(75);
    const code = starGanttRows(PLAN).find((r) => r.task.id === 'code')!;
    expect([day(code.start), day(code.end), code.progress]).toEqual(['3-9', '3-13', 100]);
  });

  it('leaves out the children of a collapsed summary task', () => {
    const rows = starGanttRows(PLAN, new Set(['build']));
    expect(rows.map((r) => r.task.id)).toEqual(['plan', 'build', 'launch']);
    expect(rows[1].expanded).toBe(false);
    // A collapsed summary keeps the span of its children.
    expect(day(rows[1].end)).toBe('3-13');
  });

  it('marks milestones, and keeps unknown parents and loops at the top level', () => {
    const rows = starGanttRows([
      { id: 1, name: 'Gate', start: at(3, 5), end: at(3, 5) },
      { id: 2, name: 'Orphan', start: at(3, 5), end: at(3, 6), parentId: 99 },
    ]);
    expect(rows.map((r) => [r.task.name, r.level, r.milestone])).toEqual([
      ['Gate', 1, true],
      ['Orphan', 1, false],
    ]);
  });
});

describe('scale maths', () => {
  it('counts local days and positions dates', () => {
    expect(starGanttDays(at(3, 1), at(3, 4))).toBe(3);
    expect(starGanttDays(at(3, 1), at(3, 1, 12))).toBe(0.5);
    expect(starGanttX(at(3, 4), at(3, 1), STAR_GANTT_DAY_WIDTH.day)).toBe(120);
    expect(starGanttX(at(3, 4), at(3, 1), STAR_GANTT_DAY_WIDTH.week)).toBe(48);
  });

  it('moves a date by the unit of the scale', () => {
    expect(day(starGanttShift(at(3, 2), 'day', 1))).toBe('3-3');
    expect(day(starGanttShift(at(3, 2), 'week', -1))).toBe('2-23');
    expect(day(starGanttShift(at(1, 31), 'month', 1))).toBe('2-28');
  });

  it('starts units on the day, the first day of the week, or the first of the month', () => {
    // Wednesday 4 March 2026.
    expect(day(starGanttUnitStart(at(3, 4, 15), 'day'))).toBe('3-4');
    expect(day(starGanttUnitStart(at(3, 4), 'week', 1))).toBe('3-2');
    expect(day(starGanttUnitStart(at(3, 4), 'week', 0))).toBe('3-1');
    expect(day(starGanttUnitStart(at(3, 4), 'month'))).toBe('3-1');
  });

  it('pads the range by one unit on each side', () => {
    const rows = starGanttRows(PLAN);
    const days = starGanttRange(rows, 'day');
    expect([day(days.start), day(days.end)]).toEqual(['3-1', '4-1']);
    const weeks = starGanttRange(rows, 'week', 1);
    expect([day(weeks.start), day(weeks.end)]).toEqual(['2-23', '4-13']);
    const months = starGanttRange(rows, 'month');
    expect([day(months.start), day(months.end)]).toEqual(['2-1', '5-1']);
  });

  it('finds the range of very many rows (no argument spread)', () => {
    const rows = Array.from({ length: 200_000 }, (_, i) => ({
      start: at(3, 1 + (i % 28)),
      end: at(3, 2 + (i % 28)),
    }));
    const range = starGanttRange(rows, 'day');
    expect([day(range.start), day(range.end)]).toEqual(['2-28', '3-31']);
  });

  it('builds the header ticks of each scale', () => {
    const range = { start: at(2, 23), end: at(3, 9) };
    const week = starGanttTicks(range, 'week', 'en-GB', 1);
    expect(week.lower.map((t) => [t.label, t.x, t.width])).toEqual([
      ['23 Feb', 0, 112],
      ['2 Mar', 112, 112],
    ]);
    expect(week.upper.map((t) => [t.label, t.x, t.width])).toEqual([
      ['February 2026', 0, 96],
      ['March 2026', 96, 128],
    ]);
    const days = starGanttTicks({ start: at(3, 1), end: at(3, 3) }, 'day', 'en-GB');
    expect(days.lower.map((t) => t.label)).toEqual(['1', '2']);
    expect(days.lower[1].title).toBe('Monday 2 March');
    const months = starGanttTicks({ start: at(2, 1), end: at(4, 1) }, 'month', 'en-GB');
    expect(months.lower.map((t) => t.label)).toEqual(['Feb', 'Mar']);
    expect(months.upper.map((t) => t.label)).toEqual(['2026']);
  });
});

describe('starGanttDependencyPath', () => {
  const from = { start: 0, end: 100, y: 18 };

  it('routes finish to start straight when the target starts later', () => {
    expect(starGanttDependencyPath('FS', from, { start: 140, end: 200, y: 54 }, 36)).toBe(
      'M 100 18 H 108 V 54 H 140',
    );
  });

  it('routes finish to start around the target row when it starts earlier', () => {
    expect(starGanttDependencyPath('FS', from, { start: 60, end: 200, y: 54 }, 36)).toBe(
      'M 100 18 H 108 V 36 H 52 V 54 H 60',
    );
    // Target above the source: the turn is at the bottom border of the target row.
    expect(
      starGanttDependencyPath(
        'FS',
        { start: 0, end: 100, y: 90 },
        { start: 60, end: 80, y: 18 },
        36,
      ),
    ).toBe('M 100 90 H 108 V 36 H 52 V 18 H 60');
  });

  it('routes start to start and finish to finish outside both points', () => {
    expect(starGanttDependencyPath('SS', from, { start: 40, end: 80, y: 54 }, 36)).toBe(
      'M 0 18 H -8 V 54 H 40',
    );
    expect(starGanttDependencyPath('FF', from, { start: 40, end: 80, y: 54 }, 36)).toBe(
      'M 100 18 H 108 V 54 H 80',
    );
  });

  it('routes start to finish into the end of the target', () => {
    expect(
      starGanttDependencyPath(
        'SF',
        { start: 100, end: 200, y: 18 },
        { start: 20, end: 60, y: 54 },
        36,
      ),
    ).toBe('M 100 18 H 92 V 54 H 60');
    expect(starGanttDependencyPath('SF', from, { start: 20, end: 60, y: 54 }, 36)).toBe(
      'M 0 18 H -8 V 36 H 68 V 54 H 60',
    );
  });
});

describe('starGanttWindow (row virtualization)', () => {
  it('renders the rows in view plus the overscan', () => {
    expect(starGanttWindow(0, 360, 36, 1000)).toEqual({ start: 0, end: 16 });
    expect(starGanttWindow(3600, 360, 36, 1000)).toEqual({ start: 95, end: 116 });
  });

  it('stays inside the row count', () => {
    expect(starGanttWindow(35_900, 360, 36, 1000)).toEqual({ start: 992, end: 1000 });
    expect(starGanttWindow(0, 360, 36, 3)).toEqual({ start: 0, end: 3 });
    expect(starGanttWindow(-50, 0, 36, 0)).toEqual({ start: 0, end: 0 });
  });
});
