import { addDays, addMonths, monthGrid, startOfDay } from '@star-ng/ui/date-picker';
import { starExpandRrule } from './rrule';

/** Views of `star-scheduler`. `timeline-day` shows the resources as rows. */
export type StarSchedulerView = 'day' | 'week' | 'work-week' | 'month' | 'agenda' | 'timeline-day';

/** Colour of an event: an entry of the chart palette (`--star-chart-1` … `--star-chart-8`). */
export type StarSchedulerColor = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type StarSchedulerId = string | number;

/**
 * An event of `star-scheduler`. Dates are local. For an all-day event `end` is the midnight after
 * the last day (exclusive); an `end` on the same day as `start` gives a one-day event.
 */
export interface StarSchedulerEvent {
  readonly id: StarSchedulerId;
  readonly title: string;
  readonly start: Date;
  readonly end: Date;
  readonly allDay?: boolean;
  /** Id of a `StarSchedulerResource` (a room, a person). */
  readonly resourceId?: StarSchedulerId | null;
  /** Entry of the chart palette, 1 to 8. Without it the event takes the colour of its resource. */
  readonly color?: StarSchedulerColor;
  /** RRULE text (RFC 5545), for example `FREQ=WEEKLY;BYDAY=TU`. `start` is the first occurrence. */
  readonly recurrence?: string | null;
  /** Days without an occurrence of the series. */
  readonly exceptions?: readonly Date[];
  /** The event cannot be moved, resized or edited. */
  readonly readonly?: boolean;
}

/** A row of the timeline view and an option of the editor. */
export interface StarSchedulerResource {
  readonly id: StarSchedulerId;
  readonly name: string;
  readonly color?: StarSchedulerColor;
}

/** One shown instance of an event: the event itself, or one occurrence of a series. */
export interface StarSchedulerOccurrence {
  /** Unique key: the id, plus the occurrence time for a series. */
  readonly key: string;
  readonly event: StarSchedulerEvent;
  readonly start: Date;
  readonly end: Date;
  /** True for an occurrence of a recurring event. */
  readonly recurring: boolean;
}

/** Visible range of a view: `start` inclusive, `end` exclusive, and the shown days. */
export interface StarSchedulerRange {
  readonly start: Date;
  readonly end: Date;
  readonly days: readonly Date[];
}

export interface StarSchedulerRangeOptions {
  /** 0 = Sunday. */
  readonly firstDayOfWeek: number;
  /** Weekdays of the work week (0 = Sunday). */
  readonly workWeekDays: readonly number[];
  /** Days of the agenda view. */
  readonly agendaDays: number;
}

const MINUTE = 60_000;

/** First day of the week that contains `date`. */
export function starWeekStart(date: Date, firstDayOfWeek: number): Date {
  const day = startOfDay(date);
  return addDays(day, -((day.getDay() - firstDayOfWeek + 7) % 7));
}

/** The range and the days that a view shows for the anchor `date`. */
export function starSchedulerRange(
  view: StarSchedulerView,
  date: Date,
  options: StarSchedulerRangeOptions,
): StarSchedulerRange {
  const day = startOfDay(date);
  const span = (first: Date, count: number): Date[] =>
    Array.from({ length: count }, (_, i) => addDays(first, i));
  let days: Date[];
  switch (view) {
    case 'day':
    case 'timeline-day':
      days = [day];
      break;
    case 'week':
      days = span(starWeekStart(day, options.firstDayOfWeek), 7);
      break;
    case 'work-week': {
      const week = span(starWeekStart(day, options.firstDayOfWeek), 7);
      days = week.filter((d) => options.workWeekDays.includes(d.getDay()));
      if (!days.length) days = week;
      break;
    }
    case 'month':
      days = monthGrid(day, options.firstDayOfWeek).flat();
      break;
    case 'agenda':
      days = span(day, Math.max(1, options.agendaDays));
      break;
  }
  return { start: days[0], end: addDays(days[days.length - 1], 1), days };
}

/** The anchor date one page earlier (`-1`) or later (`1`). */
export function starSchedulerStep(
  view: StarSchedulerView,
  date: Date,
  direction: 1 | -1,
  agendaDays: number,
): Date {
  switch (view) {
    case 'day':
    case 'timeline-day':
      return addDays(date, direction);
    case 'week':
    case 'work-week':
      return addDays(date, 7 * direction);
    case 'month':
      return addMonths(date, direction);
    case 'agenda':
      return addDays(date, Math.max(1, agendaDays) * direction);
  }
}

/** End of an all-day event as an exclusive midnight, at least one day after its start day. */
export function starAllDayEnd(event: { start: Date; end: Date }): Date {
  const first = startOfDay(event.start);
  const end = startOfDay(event.end);
  const exclusive = end.getTime() === event.end.getTime() ? end : addDays(end, 1);
  return exclusive > first ? exclusive : addDays(first, 1);
}

/** The instant an occurrence takes up, at least one minute, for overlap checks. */
const visibleEnd = (start: Date, end: Date): number =>
  Math.max(end.getTime(), start.getTime() + MINUTE);

/**
 * The occurrences of the events in a range, sorted by start (then longer first). A recurring
 * event gives one occurrence per RRULE match that overlaps the range; its length is the length
 * of the event.
 */
export function starSchedulerOccurrences(
  events: readonly StarSchedulerEvent[],
  range: { readonly start: Date; readonly end: Date },
): StarSchedulerOccurrence[] {
  const result: StarSchedulerOccurrence[] = [];
  const from = range.start.getTime();
  const to = range.end.getTime();
  for (const event of events) {
    const start = event.start;
    const end = event.allDay ? starAllDayEnd(event) : event.end;
    if (event.recurrence) {
      const length = Math.max(0, end.getTime() - start.getTime());
      const starts = starExpandRrule(event.recurrence, start, range, {
        duration: length,
        exceptions: event.exceptions,
      });
      for (const occurrence of starts) {
        result.push({
          key: `${event.id}@${occurrence.getTime()}`,
          event,
          start: occurrence,
          end: event.allDay
            ? starAllDayEnd({ start: occurrence, end: shiftLike(occurrence, start, end) })
            : new Date(occurrence.getTime() + length),
          recurring: true,
        });
      }
    } else if (start.getTime() < to && visibleEnd(start, end) > from) {
      result.push({ key: String(event.id), event, start, end, recurring: false });
    }
  }
  return result.sort(
    (a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime(),
  );
}

/** `end` moved by the same number of calendar days as `start` moved to `occurrence`. */
function shiftLike(occurrence: Date, start: Date, end: Date): Date {
  const days = Math.round((startOfDay(occurrence).getTime() - startOfDay(start).getTime()) / 864e5);
  return addDays(end, days);
}

/** Column of an item in a cluster of overlapping items, and the column count of that cluster. */
export interface StarPackedColumn {
  readonly column: number;
  readonly columns: number;
}

/**
 * Lays out overlapping intervals side by side (column packing). Items that overlap, directly or
 * through others, form a cluster; each item takes the first free column of its cluster, and all
 * items of a cluster share its column count. The result is in the order of `items`.
 */
export function starPackColumns(
  items: readonly { readonly start: number; readonly end: number }[],
): StarPackedColumn[] {
  const order = items
    .map((item, index) => ({ start: item.start, end: Math.max(item.end, item.start + 1), index }))
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const result: { column: number; columns: number }[] = new Array(items.length);
  let cluster: { index: number; column: number }[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    for (const entry of cluster) {
      result[entry.index] = { column: entry.column, columns: columnEnds.length };
    }
    cluster = [];
    columnEnds = [];
  };
  for (const item of order) {
    if (item.start >= clusterEnd) close();
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column < 0) column = columnEnds.push(item.end) - 1;
    else columnEnds[column] = item.end;
    cluster.push({ index: item.index, column });
    clusterEnd = Math.max(clusterEnd === -Infinity ? item.end : clusterEnd, item.end);
  }
  close();
  return result;
}

/** Snaps a time to the nearest slot of the day (wall-clock minutes). */
export function starSnapToSlot(date: Date, slotMinutes: number): Date {
  const minutes = date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
  const snapped = Math.round(minutes / slotMinutes) * slotMinutes;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, snapped);
}

/** Moves a date by whole days and minutes of wall-clock time (stable across DST). */
export function starShiftDate(date: Date, days: number, minutes = 0): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes() + minutes,
    date.getSeconds(),
  );
}

/** Minutes of wall-clock time from `a` to `b`, counting calendar days as 1440 minutes. */
export function starWallMinutes(a: Date, b: Date): number {
  const days = Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 864e5);
  return days * 1440 + (b.getHours() * 60 + b.getMinutes()) - (a.getHours() * 60 + a.getMinutes());
}

/** The part of an occurrence that falls on one day. */
export interface StarDaySegment {
  readonly occurrence: StarSchedulerOccurrence;
  /** Minutes from midnight. */
  readonly startMinute: number;
  readonly endMinute: number;
  /** The occurrence started on an earlier day. */
  readonly continuesBefore: boolean;
  /** The occurrence goes on to a later day. */
  readonly continuesAfter: boolean;
}

/** Segments of the timed occurrences on `day`, with minutes from midnight. */
export function starDaySegments(
  occurrences: readonly StarSchedulerOccurrence[],
  day: Date,
): StarDaySegment[] {
  const first = startOfDay(day);
  const next = addDays(first, 1);
  const segments: StarDaySegment[] = [];
  for (const occurrence of occurrences) {
    if (occurrence.event.allDay) continue;
    const end = visibleEnd(occurrence.start, occurrence.end);
    if (occurrence.start >= next || end <= first.getTime()) continue;
    const continuesBefore = occurrence.start < first;
    const continuesAfter = end > next.getTime();
    segments.push({
      occurrence,
      startMinute: continuesBefore ? 0 : starWallMinutes(first, occurrence.start),
      endMinute: continuesAfter
        ? 1440
        : Math.max(
            starWallMinutes(first, new Date(end)),
            (continuesBefore ? 0 : starWallMinutes(first, occurrence.start)) + 1,
          ),
      continuesBefore,
      continuesAfter,
    });
  }
  return segments;
}

/** True when an occurrence covers any part of `day`. */
export function starOccursOn(occurrence: StarSchedulerOccurrence, day: Date): boolean {
  const first = startOfDay(day);
  const next = addDays(first, 1);
  return occurrence.start < next && visibleEnd(occurrence.start, occurrence.end) > first.getTime();
}

/** An occurrence across the day columns of a view (all-day row). */
export interface StarDaySpan {
  readonly occurrence: StarSchedulerOccurrence;
  /** Index of the first and last covered day in `days`. */
  readonly first: number;
  readonly last: number;
  /** Lane (row) in the all-day area. */
  readonly lane: number;
}

/** Places the occurrences that cover the given days in lanes (all-day row). */
export function starDaySpans(
  occurrences: readonly StarSchedulerOccurrence[],
  days: readonly Date[],
): StarDaySpan[] {
  const covered = occurrences
    .map((occurrence) => {
      const indexes = days
        .map((day, index) => (starOccursOn(occurrence, day) ? index : -1))
        .filter((index) => index >= 0);
      return indexes.length
        ? { occurrence, first: indexes[0], last: indexes[indexes.length - 1] }
        : null;
    })
    .filter((span): span is { occurrence: StarSchedulerOccurrence; first: number; last: number } =>
      Boolean(span),
    );
  const lanes = starPackColumns(covered.map((span) => ({ start: span.first, end: span.last + 1 })));
  return covered.map((span, index) => ({ ...span, lane: lanes[index].column }));
}

/** Events of a month cell: the ones shown, and how many more there are ("+N more"). */
export function starMonthCell<T>(items: readonly T[], limit: number): { shown: T[]; more: number } {
  const max = Math.max(0, limit);
  if (items.length <= max) return { shown: [...items], more: 0 };
  // The "+N more" button takes the place of the last shown event.
  const shown = items.slice(0, Math.max(0, max - 1));
  return { shown, more: items.length - shown.length };
}

/** Minutes of `HH:mm` text, or `fallback` when it is not a time. */
export function starMinutesOf(text: string | null | undefined, fallback: number): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((text ?? '').trim());
  if (!match) return fallback;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes >= 0 && minutes <= 1440 ? minutes : fallback;
}
