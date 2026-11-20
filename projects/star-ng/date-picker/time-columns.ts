import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
} from '@angular/core';
import {
  STAR_UI_TEXT,
  starInlineKey,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';

/** One part of the time: a column of the panel. */
type TimePart = 'hour' | 'minute' | 'second' | 'period';

interface TimeCell {
  /**
   * Hour 0–23 (24-hour clock) or 1–12 (12-hour clock), minute or second 0–59, or period 0 (am) /
   * 1 (pm).
   */
  readonly value: number;
  readonly label: string;
  readonly selected: boolean;
  readonly disabled: boolean;
}

interface TimeColumn {
  readonly part: TimePart;
  readonly label: string;
  readonly cells: readonly TimeCell[];
}

const DAY_SECONDS = 24 * 60 * 60;

/** Minutes after midnight of `HH:mm` (or `HH:mm:ss`) text, or `null` when the text is not a time. */
export function starTimeToMinutes(text: string | null | undefined): number | null {
  const seconds = starTimeToSeconds(text);
  return seconds === null ? null : Math.floor(seconds / 60);
}

/** Seconds after midnight of `HH:mm` or `HH:mm:ss` text, or `null` when the text is not a time. */
export function starTimeToSeconds(text: string | null | undefined): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?/.exec(text ?? '');
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] ?? 0);
  return hours > 23 || minutes > 59 || seconds > 59 ? null : hours * 3600 + minutes * 60 + seconds;
}

/** `HH:mm` text of seconds after midnight, or `HH:mm:ss` with `withSeconds`. */
export function starTimeText(total: number, withSeconds = false): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  const text = `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}`;
  return withSeconds ? `${text}:${pad(total % 60)}` : text;
}

/** A whole step of at least 1. */
function wholeStep(value: number): number {
  return Math.max(1, Math.floor(value) || 1);
}

/** `true` when the locale writes the hour in the 12-hour clock (with am and pm). */
function localeUses12Hours(locale?: string): boolean {
  const parts = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).formatToParts(
    new Date(2000, 0, 1, 13),
  );
  return parts.some((part) => part.type === 'dayPeriod');
}

/** The locale's names of the morning and the afternoon, for example `AM` and `PM`. */
function periodNames(locale?: string): readonly [string, string] {
  const name = (hour: number) =>
    new Intl.DateTimeFormat(locale, { hour: 'numeric', hourCycle: 'h12' })
      .formatToParts(new Date(2000, 0, 1, hour))
      .find((part) => part.type === 'dayPeriod')?.value ?? (hour < 12 ? 'AM' : 'PM');
  return [name(9), name(21)];
}

/**
 * The hour, minute, second (with `showSeconds`) and (in the 12-hour clock) am / pm columns of a
 * time panel. `star-time-picker` shows them in its panel, and the date pickers show them under
 * the calendar with `showTime`. The value is 24-hour `HH:mm` text (`HH:mm:ss` with
 * `showSeconds`), or `null`. Times outside `min` … `max` are disabled, and the columns follow
 * `stepHour`, `stepMinute` and `stepSecond`. Each column is a listbox: Arrow up / down, Home and End move
 * in a column, Arrow left / right move to the column that is on that side.
 *
 * `<star-time-columns [(value)]="time" min="08:00" max="18:00" [stepMinute]="15" />`
 */
@Component({
  selector: 'star-time-columns',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-time__columns', '[class.star-time__columns--disabled]': 'disabled()' },
  template: `
    @for (column of columns(); track column.part; let c = $index) {
      <!-- Each option is a button (Enter and Space choose it); the column handles the arrows. -->
      <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
      <div
        starPart="column"
        class="star-time__column"
        role="listbox"
        [attr.aria-label]="column.label"
        [attr.aria-disabled]="disabled() || null"
        [attr.data-part]="column.part"
        (keydown)="onColumnKeydown($event, c)"
      >
        @for (cell of column.cells; track cell.value) {
          <button
            starPart="cell"
            type="button"
            role="option"
            class="star-time__cell"
            [class.star-time__cell--selected]="cell.selected"
            [attr.data-value]="cell.value"
            [attr.tabindex]="cell.value === activeOf(column) ? 0 : -1"
            [attr.aria-selected]="cell.selected"
            [attr.aria-disabled]="cell.disabled || null"
            (click)="pick(column.part, cell.value)"
            (focus)="activate(column.part, cell.value)"
          >
            {{ cell.label }}
          </button>
        }
      </div>
    }
  `,
})
export class StarTimeColumns {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** `HH:mm` (or `HH:mm:ss` with `showSeconds`) in the 24-hour clock, or `null`. */
  readonly value = model<string | null>(null);
  /** Earliest and latest time, `HH:mm` or `HH:mm:ss`. */
  readonly min = input<string | undefined>(undefined);
  readonly max = input<string | undefined>(undefined);
  /** Hours of the hour column: 0, then every `stepHour` hours. */
  readonly stepHour = input(1);
  /** Minutes of the minute column: 0, then every `stepMinute` minutes. */
  readonly stepMinute = input(1);
  /** Seconds of the second column: 0, then every `stepSecond` seconds. */
  readonly stepSecond = input(1);
  /** Adds a second column; the value is `HH:mm:ss`. */
  readonly showSeconds = input(false, { transform: booleanAttribute });
  /**
   * Clock of the columns: `'24'` (an hour column 00–23) or `'12'` (1–12 and an am / pm column).
   * Default: the clock of the browser locale. The value is always 24-hour text.
   */
  readonly hourFormat = input<'12' | '24' | undefined>(undefined);
  /** Every cell is disabled, for example while a date picker has no date. */
  readonly disabled = input(false, { transform: booleanAttribute });

  private readonly hourStep = computed(() => wholeStep(this.stepHour()));
  private readonly minuteStep = computed(() => wholeStep(this.stepMinute()));
  /** Without the second column, only second 0 is offered. */
  private readonly secondStep = computed(() =>
    this.showSeconds() ? wholeStep(this.stepSecond()) : 60,
  );
  private readonly twelveHours = computed(() => {
    const format = this.hourFormat();
    return format ? format === '12' : localeUses12Hours();
  });
  private readonly lower = computed(() => starTimeToSeconds(this.min()) ?? 0);
  private readonly upper = computed(() => starTimeToSeconds(this.max()) ?? DAY_SECONDS - 1);
  /** Hours (0–23), minutes and seconds that the columns offer: 0, then every step. */
  private readonly hourList = computed(() => series(24, this.hourStep()));
  private readonly minuteList = computed(() => series(60, this.minuteStep()));
  private readonly secondList = computed(() => series(60, this.secondStep()));

  /** The value in seconds after midnight, or `null`. */
  private readonly current = computed(() => starTimeToSeconds(this.value()));
  /**
   * The time that the columns show: the value, or else the first time that can be chosen. A
   * click in one column keeps the other parts of this time.
   */
  private readonly base = computed(() => {
    const current = this.current();
    if (current !== null) return current;
    const first = this.offeredMinutes()[0];
    return first ? first.minute * 60 + first.first : 0;
  });
  /**
   * Every minute of the day that has an offered time (on the steps, inside `min` … `max`), with
   * its first and last offered second. At most 24 x 60 entries: the seconds are computed, not
   * listed, so the second column does not cost 86,400 times.
   */
  private readonly offeredMinutes = computed(() => {
    const step = this.secondStep();
    const lastSecond = this.secondList()[this.secondList().length - 1];
    const minutes: OfferedMinute[] = [];
    for (const hour of this.hourList())
      for (const minute of this.minuteList()) {
        const start = hour * 3600 + minute * 60;
        const low = Math.max(this.lower() - start, 0);
        const high = Math.min(this.upper() - start, lastSecond);
        const first = Math.ceil(low / step) * step;
        const last = Math.floor(high / step) * step;
        if (first <= last) minutes.push({ minute: hour * 60 + minute, first, last });
      }
    return minutes;
  });

  /** Focused value of each column (roving tab stop). */
  private readonly active = signal<Partial<Record<TimePart, number>>>({});

  protected readonly columns = computed<readonly TimeColumn[]>(() => {
    const base = this.base();
    const chosen = this.current() !== null;
    const off = this.disabled();
    const baseHour = Math.floor(base / 3600);
    const baseMinute = Math.floor(base / 60) % 60;
    const baseSecond = base % 60;
    const pm = baseHour >= 12 ? 1 : 0;
    const pad = (part: number) => String(part).padStart(2, '0');
    const twelve = this.twelveHours();
    const offered = this.offeredMinutes();
    // Hours and minutes of the day (hour * 60 + minute) that have an offered time.
    const offeredHours = new Set(offered.map((entry) => Math.floor(entry.minute / 60)));
    const offeredMinutes = new Set(offered.map((entry) => entry.minute));

    // In the 12-hour clock the hours on the step are those of the period that the columns show.
    const hourValues = twelve
      ? [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter((value) =>
          this.hourList().includes(this.hour24(value, pm)),
        )
      : this.hourList();
    const hours: TimeCell[] = hourValues.map((value) => {
      const hour = this.hour24(value, pm);
      return {
        value,
        label: twelve ? String(value) : pad(value),
        selected: chosen && hour === baseHour,
        disabled: off || !offeredHours.has(hour),
      };
    });
    const minutes: TimeCell[] = this.minuteList().map((value) => ({
      value,
      label: pad(value),
      selected: chosen && value === baseMinute,
      disabled: off || !offeredMinutes.has(baseHour * 60 + value),
    }));
    const columns: TimeColumn[] = [
      { part: 'hour', label: this.text.hour, cells: hours },
      { part: 'minute', label: this.text.minute, cells: minutes },
    ];
    if (this.showSeconds()) {
      columns.push({
        part: 'second',
        label: this.text.second,
        cells: this.secondList().map((value) => ({
          value,
          label: pad(value),
          selected: chosen && value === baseSecond,
          disabled: off || !this.inLimits(baseHour * 3600 + baseMinute * 60 + value),
        })),
      });
    }
    if (twelve) {
      const names = periodNames();
      columns.push({
        part: 'period',
        label: this.text.dayPeriod,
        cells: [0, 1].map((value) => ({
          value,
          label: names[value],
          selected: chosen && value === pm,
          disabled: off || ![...offeredHours].some((hour) => (hour >= 12 ? 1 : 0) === value),
        })),
      });
    }
    return columns;
  });

  constructor() {
    // A chosen time far down a column is scrolled into view when the columns appear.
    afterNextRender(() => this.scrollSelectedIntoView());
  }

  /** Focuses the active cell of the first column (the chosen hour, or the first one allowed). */
  focus(): void {
    const first = this.columns()[0];
    this.focusCell(first.part, this.activeOf(first));
  }

  /** Focuses the first column after the next render, for a panel that has just opened. */
  focusAfterRender(): void {
    afterNextRender(() => this.focus(), { injector: this.injector });
  }

  /** Forgets the focused cells, so the next focus goes to the chosen time. */
  reset(): void {
    this.active.set({});
  }

  /** Arrow up / down and Home / End move in a column; Arrow left / right move between columns. */
  protected onColumnKeydown(event: KeyboardEvent, index: number): void {
    const columns = this.columns();
    const column = columns[index];
    const values = column.cells.map((cell) => cell.value);
    const position = Math.max(0, values.indexOf(this.activeOf(column)));
    // In right-to-left the column before is on the right: the arrows follow what the user sees.
    const key = starInlineKey(event);
    let target: { part: TimePart; value: number } | null = null;
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const next = Math.min(
        values.length - 1,
        Math.max(0, position + (key === 'ArrowUp' ? -1 : 1)),
      );
      target = { part: column.part, value: values[next] };
    } else if (key === 'Home' || key === 'End') {
      target = { part: column.part, value: values[key === 'Home' ? 0 : values.length - 1] };
    } else if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const other = columns[index + (key === 'ArrowLeft' ? -1 : 1)];
      if (other) target = { part: other.part, value: this.activeOf(other) };
    }
    if (!target) return;
    event.preventDefault();
    this.activate(target.part, target.value);
    this.focusCell(target.part, target.value);
  }

  /** The focusable value of a column: the focused one, else the chosen one, else the first. */
  protected activeOf(column: TimeColumn): number {
    const active = this.active()[column.part];
    if (active !== undefined && column.cells.some((cell) => cell.value === active)) return active;
    return (
      column.cells.find((cell) => cell.selected)?.value ??
      column.cells.find((cell) => !cell.disabled)?.value ??
      column.cells[0].value
    );
  }

  protected activate(part: TimePart, value: number): void {
    if (this.active()[part] === value) return;
    this.active.update((active) => ({ ...active, [part]: value }));
  }

  /** Chooses one part of the time and keeps the other parts. A disabled cell does nothing. */
  protected pick(part: TimePart, value: number): void {
    const cell = this.columns()
      .find((column) => column.part === part)
      ?.cells.find((item) => item.value === value);
    if (!cell || cell.disabled) return;
    const base = this.base();
    let hour = Math.floor(base / 3600);
    let minute = Math.floor(base / 60) % 60;
    let second = base % 60;
    if (part === 'hour') hour = this.twelveHours() ? this.hour24(value, hour >= 12 ? 1 : 0) : value;
    else if (part === 'minute') minute = value;
    else if (part === 'second') second = value;
    else hour = (hour % 12) + value * 12;
    // A part that is not on its step (for example 23:59) moves down to the step.
    if (part !== 'hour' && part !== 'period') hour -= hour % this.hourStep();
    if (part !== 'minute') minute -= minute % this.minuteStep();
    if (part !== 'second') second -= second % this.secondStep();
    this.activate(part, value);
    this.value.set(
      starTimeText(this.nearestAllowed(hour * 3600 + minute * 60 + second), this.showSeconds()),
    );
  }

  /** Focuses a cell at once, so a key pressed right after a move acts on the new cell. */
  private focusCell(part: TimePart, value: number): void {
    this.host.nativeElement
      .querySelector<HTMLElement>(`[data-part="${part}"] [data-value="${value}"]`)
      ?.focus();
  }

  private scrollSelectedIntoView(): void {
    for (const column of this.host.nativeElement.querySelectorAll<HTMLElement>(
      '.star-time__column',
    )) {
      const cell = column.querySelector<HTMLElement>('.star-time__cell--selected');
      if (!cell) continue;
      const top =
        cell.getBoundingClientRect().top - column.getBoundingClientRect().top + column.scrollTop;
      if (
        top < column.scrollTop ||
        top + cell.offsetHeight > column.scrollTop + column.clientHeight
      )
        column.scrollTop = Math.max(0, top - (column.clientHeight - cell.offsetHeight) / 2);
    }
  }

  /** Hour 0–23 of a 12-hour clock hour (1–12) and a period (0 am, 1 pm). */
  private hour24(value: number, pm: number): number {
    return this.twelveHours() ? (value % 12) + pm * 12 : value;
  }

  private inLimits(time: number): boolean {
    return time >= this.lower() && time <= this.upper();
  }

  /** `time` when the columns offer it, else the offered time that is nearest to it. */
  private nearestAllowed(time: number): number {
    const step = this.secondStep();
    let best: number | null = null;
    for (const entry of this.offeredMinutes()) {
      // The offered second of this minute that is nearest to `time`.
      const start = entry.minute * 60;
      const second = Math.min(
        entry.last,
        Math.max(entry.first, Math.round((time - start) / step) * step),
      );
      const candidate = start + second;
      if (candidate === time) return time;
      if (best === null || Math.abs(candidate - time) < Math.abs(best - time)) best = candidate;
    }
    return best ?? time;
  }
}

/** A minute of the day (hour * 60 + minute) with its first and last offered second. */
interface OfferedMinute {
  readonly minute: number;
  readonly first: number;
  readonly last: number;
}

/** 0 … `end` - 1 in steps of `by`. */
function series(end: number, by: number): number[] {
  return Array.from({ length: Math.ceil(end / by) }, (_, index) => index * by);
}
