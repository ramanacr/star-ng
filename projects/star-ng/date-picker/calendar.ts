import { _IdGenerator } from '@angular/cdk/a11y';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import {
  injectStarControlDefaults,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  starInlineKey,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';
import { starParseIso } from './date-format';
import type { StarDateContext, StarDecadeContext } from './date-slots';
import {
  addDays,
  addMonths,
  compareDays,
  isoDay,
  localeFirstDay,
  monthGrid,
  sameDay,
  sameMonth,
  StarDateRange,
  StarSpecialDate,
  startOfDay,
} from './date-utils';

export type StarCalendarView = 'day' | 'month' | 'year';

/** The shown month after a navigation: `month` 1–12 (PrimeNG `onMonthChange`). */
export interface StarCalendarMonthChange {
  readonly month: number;
  readonly year: number;
}

/** The shown year after a navigation (PrimeNG `onYearChange`). */
export interface StarCalendarYearChange {
  readonly year: number;
}

interface DayCell {
  readonly date: Date;
  readonly key: string;
  readonly label: string;
  readonly outside: boolean;
  /** Not rendered: a day of another month with `showOtherMonths` off or two or more months. */
  readonly blank: boolean;
  readonly today: boolean;
  readonly disabled: boolean;
  readonly special: StarSpecialDate | null;
}

/** ISO 8601 week number of a date (week 1 has the first Thursday of the year). */
export function isoWeek(date: Date): number {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Move to the Thursday of this week: its year is the week's year.
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7);
}

/**
 * Month grid used by `star-date-picker`, `star-date-range-picker`, or on its own as an inline
 * calendar (PrimeNG `p-datepicker [inline]`). WAI-ARIA date grid keyboard model:
 * arrows move by day / week, Home / End to week start / end, PageUp / PageDown by month,
 * Shift + PageUp / PageDown by year, Enter / Space select. Month and year views for fast jumps.
 */
@Component({
  selector: 'star-calendar',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarCalendar) }],
  host: {
    class: 'star-calendar',
    '[attr.role]': "labelledBy() ? 'group' : null",
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-describedby]': 'labelledBy() ? fieldDescribedBy() : null',
    '[attr.aria-busy]': 'labelledBy() ? fieldBusy() : null',
  },
  template: `
    @if (headerSlot(); as header) {
      <ng-container *ngTemplateOutlet="header" />
    }
    <div data-star-part="header" class="star-calendar__header">
      <button
        data-star-part="navigation"
        type="button"
        class="star-calendar__nav"
        [attr.aria-label]="view() === 'year' ? text.previousYears : text.previousMonth"
        (click)="page(-1)"
      >
        <i
          data-star-part="previousIcon"
          class="ph-bold ph-caret-left star-icon-mirror"
          aria-hidden="true"
        ></i>
      </button>
      <h2
        data-star-part="monthHeader"
        class="star-calendar__title"
        [id]="titleId"
        aria-live="polite"
      >
        @if (view() === 'day') {
          <button
            data-star-part="titleButton"
            type="button"
            class="star-calendar__title-btn"
            [attr.aria-label]="text.chooseMonth + ', ' + monthLabel()"
            (click)="setView('month')"
          >
            {{ monthName() }}
          </button>
        }
        @if (view() !== 'year' && granularity() !== 'year') {
          <button
            data-star-part="titleButton"
            type="button"
            class="star-calendar__title-btn"
            [attr.aria-label]="text.chooseYear + ', ' + focused().getFullYear()"
            (click)="setView('year')"
          >
            {{ focused().getFullYear() }}
          </button>
        } @else {
          <span data-star-part="titleText" class="star-calendar__title-text">
            @if (decadeSlot(); as custom) {
              <ng-container
                *ngTemplateOutlet="
                  custom;
                  context: { $implicit: years(), first: years()[0], last: years()[11] }
                "
              />
            } @else {
              {{ years()[0] }} – {{ years()[11] }}
            }
          </span>
        }
      </h2>
      <button
        data-star-part="navigation"
        type="button"
        class="star-calendar__nav"
        [attr.aria-label]="view() === 'year' ? text.nextYears : text.nextMonth"
        (click)="page(1)"
      >
        <i
          data-star-part="nextIcon"
          class="ph-bold ph-caret-right star-icon-mirror"
          aria-hidden="true"
        ></i>
      </button>
    </div>

    @switch (view()) {
      @case ('day') {
        <div
          data-star-part="monthsPanel"
          class="star-calendar__months"
          [class.star-calendar__months--many]="monthCount() > 1"
        >
          @for (grid of grids(); track $index) {
            <!-- Grid keyboard is delegated from the focused day buttons (roving tabindex). -->
            <!-- eslint-disable-next-line @angular-eslint/template/interactive-supports-focus -->
            <table
              data-star-part="grid"
              class="star-calendar__grid"
              role="grid"
              [attr.aria-labelledby]="monthCount() > 1 ? null : titleId"
              [attr.aria-label]="monthCount() > 1 ? grid.label : null"
              (keydown)="onDayKeydown($event)"
            >
              @if (monthCount() > 1) {
                <caption data-star-part="caption" class="star-calendar__caption">
                  {{
                    grid.label
                  }}
                </caption>
              }
              <thead data-star-part="head">
                <tr data-star-part="weekShortRow">
                  @if (showWeek()) {
                    <th
                      data-star-part="weekCell"
                      scope="col"
                      class="star-calendar__week"
                      [attr.abbr]="text.weekNumber"
                    >
                      {{ text.weekShort }}
                    </th>
                  }
                  @for (day of weekdays(); track day.short) {
                    <th data-star-part="gridHeaderCell" scope="col" [attr.abbr]="day.long">
                      {{ day.short }}
                    </th>
                  }
                </tr>
              </thead>
              <tbody data-star-part="body">
                @for (week of grid.weeks; track $index) {
                  <tr data-star-part="gridBodyRow">
                    @if (showWeek()) {
                      <th data-star-part="weekCell" scope="row" class="star-calendar__week">
                        {{ week.number }}
                      </th>
                    }
                    @for (cell of week.days; track cell.key) {
                      @if (cell.blank) {
                        <td data-star-part="gridCell" role="gridcell"></td>
                      } @else {
                        <td
                          data-star-part="gridCell"
                          role="gridcell"
                          [attr.aria-selected]="isSelected(cell.date)"
                          [class.star-calendar__cell--range]="inRange(cell.date)"
                          [class.star-calendar__cell--range-start]="isRangeEdge(cell.date, 'start')"
                          [class.star-calendar__cell--range-end]="isRangeEdge(cell.date, 'end')"
                        >
                          <button
                            data-star-part="dayButton"
                            type="button"
                            class="star-calendar__day"
                            [attr.data-date]="cell.key"
                            [class.star-calendar__day--outside]="cell.outside"
                            [class.star-calendar__day--today]="cell.today"
                            [class.star-calendar__day--selected]="isSelected(cell.date)"
                            [class.star-calendar__day--special]="!!cell.special"
                            [attr.data-special]="
                              cell.special ? cell.special.kind || 'special' : null
                            "
                            [attr.tabindex]="sameDay(cell.date, focused()) ? 0 : -1"
                            [attr.aria-label]="cell.label"
                            [attr.aria-current]="cell.today ? 'date' : null"
                            [attr.aria-disabled]="cell.disabled || null"
                            (click)="cell.disabled || choose(cell.date)"
                            (mouseenter)="hover.set(cell.date)"
                            (mousedown)="onDayMousedown($event, cell)"
                            (focus)="onDayFocus(cell)"
                          >
                            @if (dateSlot(); as custom) {
                              <ng-container
                                *ngTemplateOutlet="
                                  custom;
                                  context: {
                                    $implicit: cell.date,
                                    today: cell.today,
                                    selected: isSelected(cell.date),
                                    disabled: cell.disabled,
                                    outside: cell.outside,
                                    special: cell.special,
                                  }
                                "
                              />
                            } @else {
                              {{ cell.date.getDate() }}
                            }
                          </button>
                        </td>
                      }
                    }
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      }
      @case ('month') {
        <div
          data-star-part="pickerPanel"
          class="star-calendar__picker"
          role="group"
          [attr.aria-label]="text.chooseMonth"
          (keydown)="onPickerKeydown($event, 'month')"
        >
          @for (month of months(); track $index; let i = $index) {
            <button
              data-star-part="pickButton"
              type="button"
              class="star-calendar__pick"
              [attr.data-pick]="i"
              [class.star-calendar__pick--selected]="i === focused().getMonth()"
              [attr.tabindex]="i === focused().getMonth() ? 0 : -1"
              [attr.aria-pressed]="i === focused().getMonth()"
              [disabled]="monthDisabled(i)"
              (click)="pickMonth(i)"
            >
              {{ month }}
            </button>
          }
        </div>
      }
      @case ('year') {
        <div
          data-star-part="pickerPanel"
          class="star-calendar__picker"
          role="group"
          [attr.aria-label]="text.chooseYear"
          (keydown)="onPickerKeydown($event, 'year')"
        >
          @for (year of years(); track year) {
            <button
              data-star-part="pickButton"
              type="button"
              class="star-calendar__pick"
              [attr.data-pick]="year"
              [class.star-calendar__pick--selected]="year === focused().getFullYear()"
              [attr.tabindex]="year === focused().getFullYear() ? 0 : -1"
              [attr.aria-pressed]="year === focused().getFullYear()"
              [disabled]="yearDisabled(year)"
              (click)="pickYear(year)"
            >
              {{ year }}
            </button>
          }
        </div>
      }
    }
    @if (footerSlot(); as footer) {
      <ng-container *ngTemplateOutlet="footer" />
    }
  `,
})
export class StarCalendar {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly defaults = injectStarControlDefaults([]);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly titleId = inject(_IdGenerator).getId('star-calendar-title-');
  /**
   * The parent `star-field` when it labels an inline calendar: the calendar is a group named by
   * the label, and a click on the label focuses the active day. In the popup of a date picker
   * the picker owns the label, so this is `null` there.
   */
  private readonly field = injectStarFieldLink(null, () => this.focusActive());
  /** `aria-busy` of the control while an async validator of the parent `star-field` runs. */
  protected readonly fieldBusy = computed(() => this.field?.pending() || null);
  protected readonly labelledBy = computed(() => this.field?.labelledBy() ?? null);
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  protected readonly sameDay = sameDay;

  readonly mode = input<'single' | 'range' | 'multiple'>('single');
  readonly selected = input<Date | null>(null);
  /** Chosen days in `'multiple'` mode. */
  readonly selectedDates = input<readonly Date[]>([]);
  /**
   * Smallest unit the user chooses. `'month'` and `'year'` show only the month or year view
   * and emit the first day of the chosen month or year.
   */
  readonly granularity = input<StarCalendarView>('day');
  /** Months shown side by side in the day view. */
  readonly numberOfMonths = input(1);
  /** Shows the ISO 8601 week number at the start of each week. */
  readonly showWeek = input(false, { transform: booleanAttribute });
  /**
   * Shows the days of the month before and after in the first and last week (PrimeNG
   * `showOtherMonths`). Off: those cells are empty. With two or more months they are always empty.
   */
  readonly showOtherMonths = input(true, { transform: booleanAttribute });
  /**
   * The shown days of the month before and after can be chosen (PrimeNG `selectOtherMonths`).
   * Off: they are shown but disabled (`aria-disabled`).
   */
  readonly selectOtherMonths = input(true, { transform: booleanAttribute });
  readonly range = input<StarDateRange | null>(null);
  readonly minDate = input<Date | null>(null);
  readonly maxDate = input<Date | null>(null);
  readonly disabledDates = input<readonly Date[]>([]);
  /** Weekdays that cannot be chosen (0 = Sunday … 6 = Saturday). */
  readonly disabledDays = input<readonly number[]>([]);
  /** Extra rule, for example public holidays from the server. */
  readonly dateDisabled = input<((date: Date) => boolean) | null>(null);
  /** 0 = Sunday. Default: the locale's first day of the week. */
  readonly firstDayOfWeek = input<number | null>(null);
  /** BCP 47 locale for names. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  /**
   * Marked days, for example holidays or due dates (Ignite UI `specialDates`). The day gets a
   * dot, and its accessible name gets the kind and the label: "12 March 2026, Holiday: Company
   * day". The `starDate` context has the entry as `special`.
   */
  readonly specialDates = input<readonly StarSpecialDate[]>([]);
  /** Set by the date pickers. In your own markup, use the `starDate` slot. */
  readonly dateTemplate = input<TemplateRef<StarDateContext> | null>(null);
  /** Set by the date pickers. In your own markup, use the `starDecade` slot. */
  readonly decadeTemplate = input<TemplateRef<StarDecadeContext> | null>(null);

  readonly dateSelect = output<Date>();
  /**
   * The user moved to another month (arrows, keys, the month view, or a day of another month).
   * With two or more months, the first shown month. PrimeNG `onMonthChange`, Ignite UI
   * `viewDateChanged`.
   */
  readonly monthChange = output<StarCalendarMonthChange>();
  /** The user moved to another year (PrimeNG `onYearChange`). */
  readonly yearChange = output<StarCalendarYearChange>();
  /** The user switched between the day, month and year views (Ignite UI `activeViewChanged`). */
  readonly viewChange = output<StarCalendarView>();

  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  private readonly ownDateSlot = starSlot<StarDateContext>(this.slots, this, 'date');
  /** Own `starDate` slot first, then the `dateTemplate` input. */
  protected readonly dateSlot = computed(() => this.ownDateSlot() ?? this.dateTemplate());
  private readonly ownDecadeSlot = starSlot<StarDecadeContext>(this.slots, this, 'decade');
  /** Own `starDecade` slot first, then the `decadeTemplate` input. */
  protected readonly decadeSlot = computed(() => this.ownDecadeSlot() ?? this.decadeTemplate());

  readonly view = linkedSignal<StarCalendarView>(() => this.granularity());
  protected readonly hover = signal<Date | null>(null);
  private readonly today = startOfDay(new Date());

  private readonly anchor = computed(() => {
    const range = this.range();
    return (
      this.selected() ?? range?.end ?? range?.start ?? this.selectedDates().at(-1) ?? this.today
    );
  });
  /** Day with keyboard focus; also decides which month is shown. */
  readonly focused = linkedSignal(() => startOfDay(this.anchor()));

  private readonly firstDay = computed(
    () => this.firstDayOfWeek() ?? localeFirstDay(this.locale()),
  );

  protected readonly monthName = computed(() =>
    new Intl.DateTimeFormat(this.locale(), { month: 'long' }).format(this.focused()),
  );
  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' }).format(
      this.focused(),
    ),
  );

  protected readonly weekdays = computed(() => {
    const short = new Intl.DateTimeFormat(this.locale(), { weekday: 'short' });
    const long = new Intl.DateTimeFormat(this.locale(), { weekday: 'long' });
    // 2026-11-01 is a Sunday.
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(2026, 10, 1 + ((this.firstDay() + i) % 7));
      return { short: short.format(date), long: long.format(date) };
    });
  });

  /** Entries of `specialDates` by `yyyy-mm-dd`; the first entry of a day wins. */
  private readonly specialByDay = computed(() => {
    const days = new Map<string, StarSpecialDate>();
    for (const special of this.specialDates()) {
      const date = starParseIso(special.date);
      if (date && !days.has(isoDay(date))) days.set(isoDay(date), special);
    }
    return days;
  });

  protected readonly monthCount = computed(() => Math.max(1, Math.floor(this.numberOfMonths())));

  /**
   * First shown month. It stays while the focused day is inside the shown months, so moving
   * focus between two shown months does not shift the view.
   */
  private readonly viewStart = linkedSignal<{ focused: Date; count: number }, Date>({
    source: () => ({ focused: this.focused(), count: this.monthCount() }),
    computation: ({ focused, count }, previous) => {
      const month = new Date(focused.getFullYear(), focused.getMonth(), 1);
      if (!previous) return month;
      const start = previous.value;
      const offset =
        (month.getFullYear() - start.getFullYear()) * 12 + month.getMonth() - start.getMonth();
      if (offset >= 0 && offset < count) return start;
      return offset < 0 ? month : addMonths(month, -(count - 1));
    },
  });

  /** One grid per shown month. With two or more months, days of other months are blank. */
  protected readonly grids = computed(() => {
    const fullLabel = new Intl.DateTimeFormat(this.locale(), { dateStyle: 'full' });
    const monthLabel = new Intl.DateTimeFormat(this.locale(), { month: 'long', year: 'numeric' });
    const many = this.monthCount() > 1;
    const hideOther = many || !this.showOtherMonths();
    const lockOther = !this.selectOtherMonths();
    const specials = this.specialByDay();
    return Array.from({ length: this.monthCount() }, (_, index) => {
      const month = addMonths(this.viewStart(), index);
      return {
        key: isoDay(month),
        label: monthLabel.format(month),
        weeks: monthGrid(month, this.firstDay())
          .map((week) => ({
            number: isoWeek(week.find((day) => day.getDay() === 4) ?? week[0]),
            days: week.map((date): DayCell => {
              const outside = !sameMonth(date, month);
              const key = isoDay(date);
              const special = specials.get(key) ?? null;
              return {
                date,
                key,
                label: this.dayLabel(fullLabel.format(date), special),
                special,
                outside,
                blank: hideOther && outside,
                today: sameDay(date, this.today),
                disabled: this.isDisabled(date) || (lockOther && outside),
              };
            }),
          }))
          // With two or more months a week that has only blank days is left out.
          .filter((week) => !many || week.days.some((day) => !day.blank)),
      };
    });
  });

  protected readonly months = computed(() => {
    const format = new Intl.DateTimeFormat(this.locale(), { month: 'short' });
    return Array.from({ length: 12 }, (_, i) => format.format(new Date(2026, i, 1)));
  });

  protected readonly years = computed(() => {
    const year = this.focused().getFullYear();
    const start = year - (((year % 12) + 12) % 12);
    return Array.from({ length: 12 }, (_, i) => start + i);
  });

  /** Accessible name of a day: the full date, then the kind and label of a special date. */
  private dayLabel(full: string, special: StarSpecialDate | null): string {
    if (!special) return full;
    const kind =
      special.kind === 'holiday'
        ? this.text.holiday
        : special.kind === 'event'
          ? this.text.event
          : special.kind || this.text.specialDate;
    return special.label ? `${full}, ${kind}: ${special.label}` : `${full}, ${kind}`;
  }

  isDisabled(date: Date): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    if (min && compareDays(date, min) < 0) return true;
    if (max && compareDays(date, max) > 0) return true;
    if (this.disabledDays().includes(date.getDay())) return true;
    if (this.disabledDates().some((disabled) => sameDay(disabled, date))) return true;
    return this.dateDisabled()?.(date) ?? false;
  }

  protected isSelected(date: Date): boolean {
    if (this.mode() === 'single') return sameDay(date, this.selected());
    if (this.mode() === 'multiple') return this.selectedDates().some((day) => sameDay(day, date));
    const range = this.range();
    return sameDay(date, range?.start) || sameDay(date, range?.end);
  }

  /** Range fill, including the hover preview while only the start is chosen. */
  protected inRange(date: Date): boolean {
    if (this.mode() !== 'range') return false;
    const range = this.range();
    const start = range?.start;
    const end = range?.end ?? (start ? this.hover() : null);
    if (!start || !end) return false;
    const [from, to] = compareDays(start, end) <= 0 ? [start, end] : [end, start];
    return compareDays(date, from) >= 0 && compareDays(date, to) <= 0;
  }

  protected isRangeEdge(date: Date, edge: 'start' | 'end'): boolean {
    if (!this.inRange(date)) return false;
    const range = this.range();
    const a = range?.start;
    const b = range?.end ?? this.hover();
    if (!a || !b) return false;
    const [from, to] = compareDays(a, b) <= 0 ? [a, b] : [b, a];
    return sameDay(date, edge === 'start' ? from : to);
  }

  protected choose(date: Date): void {
    if (this.isDisabled(date)) return;
    this.moveTo(date);
    this.dateSelect.emit(date);
  }

  /** Moves focus into the grid (call after opening a popup). */
  focusActive(): void {
    afterNextRender(
      () => {
        const root = this.host.nativeElement;
        const target =
          this.view() === 'day'
            ? root.querySelector<HTMLElement>(`[data-date="${isoDay(this.focused())}"]`)
            : root.querySelector<HTMLElement>('.star-calendar__pick[tabindex="0"]');
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  protected page(step: 1 | -1): void {
    const current = this.focused();
    if (this.view() === 'day') this.moveTo(addMonths(current, step));
    else if (this.view() === 'month') this.moveTo(addMonths(current, step * 12));
    else this.moveTo(addMonths(current, step * 144));
  }

  protected onDayKeydown(event: KeyboardEvent): void {
    const current = this.focused();
    const weekStart = (current.getDay() - this.firstDay() + 7) % 7;
    // The day before is on the left in left-to-right and on the right in right-to-left.
    const key = starInlineKey(event);
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(current, -1),
      ArrowRight: () => addDays(current, 1),
      ArrowUp: () => addDays(current, -7),
      ArrowDown: () => addDays(current, 7),
      Home: () => addDays(current, -weekStart),
      End: () => addDays(current, 6 - weekStart),
      PageUp: () => addMonths(current, event.shiftKey ? -12 : -1),
      PageDown: () => addMonths(current, event.shiftKey ? 12 : 1),
    };
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.choose(current);
      return;
    }
    const move = moves[key];
    if (!move) return;
    event.preventDefault();
    this.moveTo(move());
    this.focusActive();
  }

  protected onPickerKeydown(event: KeyboardEvent, kind: 'month' | 'year'): void {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -3,
      ArrowDown: 3,
    };
    const step = steps[starInlineKey(event)];
    if (step === undefined) return;
    event.preventDefault();
    this.moveTo(addMonths(this.focused(), kind === 'month' ? step : step * 12));
    this.focusActive();
  }

  protected pickMonth(month: number): void {
    const current = this.focused();
    this.moveTo(addMonths(current, month - current.getMonth()));
    if (this.granularity() === 'month') {
      this.dateSelect.emit(new Date(current.getFullYear(), month, 1));
      return;
    }
    this.setView('day');
    this.focusActive();
  }

  protected pickYear(year: number): void {
    const current = this.focused();
    this.moveTo(addMonths(current, (year - current.getFullYear()) * 12));
    if (this.granularity() === 'year') {
      this.dateSelect.emit(new Date(year, 0, 1));
      return;
    }
    this.setView('month');
    this.focusActive();
  }

  /**
   * A locked day of another month (`selectOtherMonths` off) does not take the focus from a
   * mousedown: the focus would move the shown month, and the click chooses nothing.
   */
  protected onDayMousedown(event: MouseEvent, cell: DayCell): void {
    if (cell.outside && cell.disabled) event.preventDefault();
  }

  protected onDayFocus(cell: DayCell): void {
    if (cell.outside && cell.disabled) return;
    this.moveTo(cell.date);
  }

  /** Moves the focused day and tells when the shown month or year changes. */
  protected moveTo(date: Date): void {
    const before = this.viewStart();
    this.focused.set(date);
    const after = this.viewStart();
    if (sameMonth(before, after)) return;
    this.monthChange.emit({ month: after.getMonth() + 1, year: after.getFullYear() });
    if (before.getFullYear() !== after.getFullYear()) {
      this.yearChange.emit({ year: after.getFullYear() });
    }
  }

  protected setView(view: StarCalendarView): void {
    if (this.view() === view) return;
    this.view.set(view);
    this.viewChange.emit(view);
  }

  protected monthDisabled(month: number): boolean {
    const year = this.focused().getFullYear();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const min = this.minDate();
    const max = this.maxDate();
    return (!!min && compareDays(last, min) < 0) || (!!max && compareDays(first, max) > 0);
  }

  protected yearDisabled(year: number): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    return (!!min && year < min.getFullYear()) || (!!max && year > max.getFullYear());
  }
}
