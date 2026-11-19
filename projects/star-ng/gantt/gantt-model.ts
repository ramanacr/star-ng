import { addDays, addMonths, startOfDay } from '@star-ng/ui/date-picker';

/** Time scale of `star-gantt`: the unit of the lower header row and of keyboard moves. */
export type StarGanttScale = 'day' | 'week' | 'month';

/** Dependency types: finish to start, start to start, finish to finish, start to finish. */
export type StarGanttDependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export type StarGanttId = string | number;

/** A dependency of a task on the task `from`. */
export interface StarGanttDependency {
  readonly from: StarGanttId;
  readonly type: StarGanttDependencyType;
}

/**
 * A task of `star-gantt`. Dates are local; `end` is exclusive (a task on 3 and 4 March ends on
 * 5 March 00:00). A summary task (one with children) takes its dates and progress from them.
 */
export interface StarGanttTask {
  readonly id: StarGanttId;
  readonly name: string;
  readonly start: Date;
  readonly end: Date;
  /** Done part, 0 to 100. */
  readonly progress?: number;
  /** Id of the summary task this task belongs to. */
  readonly parentId?: StarGanttId | null;
  readonly dependencies?: readonly StarGanttDependency[];
  /** A point in time, drawn as a diamond at `start`. */
  readonly milestone?: boolean;
  /** Entry of the chart palette, 1 to 8. */
  readonly color?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
}

/** A shown row: the task, its place in the tree, and its effective dates. */
export interface StarGanttRow {
  readonly task: StarGanttTask;
  /** Index among the shown rows. */
  readonly index: number;
  /** 1 for a top-level task. */
  readonly level: number;
  readonly summary: boolean;
  readonly expanded: boolean;
  readonly start: Date;
  readonly end: Date;
  readonly progress: number;
  readonly milestone: boolean;
  /** Position among its siblings (1-based) and the number of siblings. */
  readonly posinset: number;
  readonly setsize: number;
  readonly parentId: StarGanttId | null;
}

const DAY = 86_400_000;
const key = (id: StarGanttId | null | undefined) =>
  id === null || id === undefined ? '' : String(id);

/** Whole local days from `a` to `b` (fractions for times of day), stable across DST. */
export function starGanttDays(a: Date, b: Date): number {
  const whole = Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
  const part = (d: Date) => (d.getHours() * 60 + d.getMinutes()) / 1440;
  return whole + part(b) - part(a);
}

/** A date moved by whole days, keeping its time of day. */
export function starGanttShiftDays(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
  );
}

/** A date moved by `count` units of the scale (day, week or month). */
export function starGanttShift(date: Date, scale: StarGanttScale, count: number): Date {
  if (scale === 'month') {
    const moved = addMonths(date, count);
    return new Date(
      moved.getFullYear(),
      moved.getMonth(),
      moved.getDate(),
      date.getHours(),
      date.getMinutes(),
    );
  }
  return starGanttShiftDays(date, scale === 'week' ? 7 * count : count);
}

/**
 * The shown rows in tree order. Children follow their summary task, and the children of a
 * collapsed summary are left out. A summary task spans its children (earliest start, latest end)
 * and its progress is the duration-weighted progress of its children (its own dates and progress
 * are not used).
 */
export function starGanttRows(
  tasks: readonly StarGanttTask[],
  collapsed: ReadonlySet<string> = new Set(),
): StarGanttRow[] {
  const byId = new Map(tasks.map((t) => [key(t.id), t]));
  const children = new Map<string, StarGanttTask[]>();
  for (const task of tasks) {
    // A parent that is not in the list makes the task a top-level one.
    const parent = byId.has(key(task.parentId)) ? key(task.parentId) : '';
    const list = children.get(parent);
    if (list) list.push(task);
    else children.set(parent, [task]);
  }
  const spans = new Map<string, { start: Date; end: Date; progress: number; weight: number }>();
  const visiting = new Set<string>();
  const span = (
    task: StarGanttTask,
  ): { start: Date; end: Date; progress: number; weight: number } => {
    const id = key(task.id);
    const known = spans.get(id);
    if (known) return known;
    const kids = visiting.has(id) ? [] : (children.get(id) ?? []);
    visiting.add(id);
    let result;
    if (kids.length) {
      const parts = kids.map(span);
      const start = new Date(parts.reduce((min, p) => Math.min(min, p.start.getTime()), Infinity));
      const end = new Date(parts.reduce((max, p) => Math.max(max, p.end.getTime()), -Infinity));
      const weight = parts.reduce((sum, p) => sum + p.weight, 0);
      const done = parts.reduce((sum, p) => sum + p.progress * p.weight, 0);
      result = {
        start,
        end,
        progress: weight ? Math.round(done / weight) : 0,
        weight,
      };
    } else {
      const end = task.milestone || task.end < task.start ? task.start : task.end;
      result = {
        start: task.start,
        end,
        progress: clampProgress(task.progress ?? 0),
        weight: Math.max(starGanttDays(task.start, end), 0.0001),
      };
    }
    visiting.delete(id);
    spans.set(id, result);
    return result;
  };
  const rows: StarGanttRow[] = [];
  const walk = (parent: string, level: number, seen: Set<string>) => {
    const list = children.get(parent) ?? [];
    list.forEach((task, i) => {
      const id = key(task.id);
      if (seen.has(id)) return;
      const summary = (children.get(id)?.length ?? 0) > 0;
      const expanded = summary && !collapsed.has(id);
      const s = span(task);
      rows.push({
        task,
        index: rows.length,
        level,
        summary,
        expanded,
        start: s.start,
        end: s.end,
        progress: s.progress,
        milestone: !summary && (!!task.milestone || +s.end === +s.start),
        posinset: i + 1,
        setsize: list.length,
        parentId: parent ? (byId.get(parent)?.id ?? null) : null,
      });
      if (expanded) walk(id, level + 1, new Set([...seen, id]));
    });
  };
  walk('', 1, new Set());
  return rows;
}

function clampProgress(value: number): number {
  return Math.min(100, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)));
}

/** Width of one day in pixels for each scale. */
export const STAR_GANTT_DAY_WIDTH: Readonly<Record<StarGanttScale, number>> = {
  day: 40,
  week: 16,
  month: 5,
};

/** First day of the unit that contains `date`. */
export function starGanttUnitStart(date: Date, scale: StarGanttScale, firstDayOfWeek = 1): Date {
  const day = startOfDay(date);
  if (scale === 'month') return new Date(day.getFullYear(), day.getMonth(), 1);
  if (scale === 'week') return addDays(day, -((day.getDay() - firstDayOfWeek + 7) % 7));
  return day;
}

/**
 * The time range the timeline shows: from one unit before the earliest start to one unit after
 * the latest end, aligned to whole units. Without tasks it shows the units around `fallback`.
 */
export function starGanttRange(
  rows: readonly { start: Date; end: Date }[],
  scale: StarGanttScale,
  firstDayOfWeek = 1,
  fallback: Date = new Date(2000, 0, 1),
): { start: Date; end: Date } {
  // A loop, not Math.min(...spread): the spread fails for very many rows.
  const min = rows.length
    ? new Date(rows.reduce((m, r) => Math.min(m, r.start.getTime()), Infinity))
    : fallback;
  const max = rows.length
    ? new Date(rows.reduce((m, r) => Math.max(m, r.end.getTime()), -Infinity))
    : fallback;
  const start = starGanttShift(starGanttUnitStart(min, scale, firstDayOfWeek), scale, -1);
  const lastUnit = starGanttUnitStart(max, scale, firstDayOfWeek);
  const end = starGanttShift(lastUnit, scale, 2);
  return { start, end };
}

/** Horizontal position of a date in the timeline, in pixels from the range start. */
export function starGanttX(date: Date, rangeStart: Date, dayWidth: number): number {
  return starGanttDays(rangeStart, date) * dayWidth;
}

/** One header cell of the time scale. */
export interface StarGanttTick {
  readonly start: Date;
  readonly x: number;
  readonly width: number;
  readonly label: string;
  /** Full text for screen readers and tooltips. */
  readonly title: string;
}

/** The two header rows of the time scale: `upper` (months or years) and `lower` (the units). */
export function starGanttTicks(
  range: { start: Date; end: Date },
  scale: StarGanttScale,
  locale: string | undefined,
  firstDayOfWeek = 1,
): { upper: StarGanttTick[]; lower: StarGanttTick[] } {
  const width = STAR_GANTT_DAY_WIDTH[scale];
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options);
  const build = (
    first: Date,
    next: (d: Date) => Date,
    label: Intl.DateTimeFormat,
    title: Intl.DateTimeFormat,
  ): StarGanttTick[] => {
    const ticks: StarGanttTick[] = [];
    for (let d = first; d < range.end && ticks.length < 5000; d = next(d)) {
      const from = d < range.start ? range.start : d;
      const to = next(d) > range.end ? range.end : next(d);
      ticks.push({
        start: from,
        x: starGanttX(from, range.start, width),
        width: starGanttDays(from, to) * width,
        label: label.format(d),
        title: title.format(d),
      });
    }
    return ticks;
  };
  const monthStart = new Date(range.start.getFullYear(), range.start.getMonth(), 1);
  const months = () =>
    build(
      monthStart,
      (d) => new Date(d.getFullYear(), d.getMonth() + 1, 1),
      format({
        month: scale === 'month' ? 'short' : 'long',
        year: scale === 'month' ? undefined : 'numeric',
      }),
      format({ month: 'long', year: 'numeric' }),
    );
  switch (scale) {
    case 'day':
      return {
        upper: months(),
        lower: build(
          range.start,
          (d) => addDays(d, 1),
          format({ day: 'numeric' }),
          format({ weekday: 'long', day: 'numeric', month: 'long' }),
        ),
      };
    case 'week':
      return {
        upper: months(),
        lower: build(
          starGanttUnitStart(range.start, 'week', firstDayOfWeek),
          (d) => addDays(d, 7),
          format({ day: 'numeric', month: 'short' }),
          format({ day: 'numeric', month: 'long', year: 'numeric' }),
        ),
      };
    case 'month':
      return {
        upper: build(
          new Date(range.start.getFullYear(), 0, 1),
          (d) => new Date(d.getFullYear() + 1, 0, 1),
          format({ year: 'numeric' }),
          format({ year: 'numeric' }),
        ),
        lower: months(),
      };
  }
}

/** Ends of a bar for dependency routing: x of start and end, and y of the row centre. */
export interface StarGanttBarEnds {
  readonly start: number;
  readonly end: number;
  readonly y: number;
}

/**
 * Orthogonal SVG path of a dependency arrow from task `from` to task `to`. FS leaves the end of
 * `from` and enters the start of `to`; SS leaves and enters at the starts; FF at the ends; SF
 * leaves the start and enters the end. When the target point lies on the wrong side, the path
 * turns at the row border above or below the target row.
 */
export function starGanttDependencyPath(
  type: StarGanttDependencyType,
  from: StarGanttBarEnds,
  to: StarGanttBarEnds,
  rowHeight: number,
  gap = 8,
): string {
  const leavesEnd = type === 'FS' || type === 'FF';
  const entersStart = type === 'FS' || type === 'SS';
  const sx = leavesEnd ? from.end : from.start;
  const tx = entersStart ? to.start : to.end;
  const sy = from.y;
  const ty = to.y;
  const out = leavesEnd ? sx + gap : sx - gap;
  const into = entersStart ? tx - gap : tx + gap;
  // Same side (SS, FF): one turn column outside both points.
  if (type === 'SS') return `M ${sx} ${sy} H ${Math.min(out, into)} V ${ty} H ${tx}`;
  if (type === 'FF') return `M ${sx} ${sy} H ${Math.max(out, into)} V ${ty} H ${tx}`;
  // FS goes right then into the start; SF goes left then into the end.
  const direct = type === 'FS' ? into >= out : into <= out;
  if (direct) return `M ${sx} ${sy} H ${out} V ${ty} H ${tx}`;
  const border = ty >= sy ? ty - rowHeight / 2 : ty + rowHeight / 2;
  return `M ${sx} ${sy} H ${out} V ${border} H ${into} V ${ty} H ${tx}`;
}

/** Rows to render for a scroll position: `[start, end)`, with `overscan` extra rows each side. */
export function starGanttWindow(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  count: number,
  overscan = 5,
): { start: number; end: number } {
  const size = Math.max(1, rowHeight);
  const first = Math.floor(Math.max(0, scrollTop) / size);
  const visible = Math.ceil(Math.max(0, viewportHeight) / size) + 1;
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return { start: Math.min(start, end), end };
}
