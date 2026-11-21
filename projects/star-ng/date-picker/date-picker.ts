import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  contentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  Injector,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  injectStarControlDefaults,
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarDirectionService,
  StarPart,
  StarSlot,
  starSlot,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';
import {
  StarCalendar,
  StarCalendarMonthChange,
  StarCalendarView,
  StarCalendarYearChange,
} from './calendar';
import {
  starAtTime as atTime,
  starAtStepTime,
  starClampTime,
  starDates,
  starDayTimeLimits,
  starFormatDateTime,
  starFromDate,
  starMapRange,
  starParseIso,
  starParsePeriod,
  starSplitDateTime,
  StarTimeLimits,
  starTimeOf,
  starWithTime as withTime,
} from './date-format';
import { STAR_DATE_PICKER_DEFAULTS } from './date-picker-defaults';
import { STAR_DATE_HOST, STAR_DATE_TEMPLATE } from './date-picker.template';
import { StarDateSheet } from './date-sheet';
import type {
  StarButtonBarContext,
  StarDateContext,
  StarDecadeContext,
  StarTimeCellContext,
} from './date-slots';
import {
  compareDays,
  DEFAULT_DATE_FORMAT,
  formatDate,
  formatHint,
  parseDate,
  sameDay,
  StarDateRange,
  StarSpecialDate,
  startOfDay,
} from './date-utils';
import { StarTimeColumns } from './time-columns';

const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
];
/**
 * Space between the popup and the window edge. When the popup fits neither below nor above the
 * field (a tall popup, for example with `showTime`, next to a field in the middle of a small
 * window), the overlay pushes it into the window, this far from the edge.
 */
const PANEL_VIEWPORT_MARGIN = 8;

/**
 * Shared input + popup behaviour of the date controls: typed entry with locale-aware parsing,
 * a calendar popup (native popover, so it works in dialogs), Today / Clear bar, keyboard.
 */
@Directive()
export abstract class StarDateInputBase<TValue> {
  /** Keeps the CDK direction (overlays and menus) in step with `<html dir>`. */
  private readonly directionSync = inject(StarDirectionService);
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly ids = inject(_IdGenerator);
  /** Defaults from `provideStarDatePickerDefaults`, then `provideStarNg`. */
  protected readonly defaults = injectStarControlDefaults(
    ['sm', 'md'],
    inject(STAR_DATE_PICKER_DEFAULTS),
  );
  /**
   * The parent `star-field` when it labels this picker: the label points at the input with `for`,
   * the hint or error describes it.
   */
  protected readonly field = injectStarFieldLink(() => this.inputId());

  abstract readonly value: ReturnType<typeof model<TValue>>;

  readonly placeholder = input<string | null>(null);
  readonly minDate = input<Date | null>(null);
  readonly maxDate = input<Date | null>(null);
  readonly disabledDates = input<readonly Date[]>([]);
  readonly disabledDays = input<readonly number[]>([]);
  readonly dateDisabled = input<((date: Date) => boolean) | null>(null);
  readonly firstDayOfWeek = input<number | null>(this.defaults.firstDayOfWeek ?? null);
  /** BCP 47 locale for names and formats. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  /**
   * `Intl.DateTimeFormat` options for the input text (default numeric day / month / year). The
   * shared default of `displayFormat` and `inputFormat`.
   */
  readonly dateFormat = input<Intl.DateTimeFormatOptions>(DEFAULT_DATE_FORMAT);
  /**
   * `Intl.DateTimeFormat` options of the text while the field does not have the focus, for
   * example `{ dateStyle: 'long' }` (Ignite UI `displayFormat`). Default: `dateFormat`.
   */
  readonly displayFormat = input<Intl.DateTimeFormatOptions | null>(null);
  /**
   * `Intl.DateTimeFormat` options of the text while the field has the focus (Ignite UI
   * `inputFormat`, PrimeNG `dateFormat`). Typed text is read in the order of day, month and year
   * of this format, with any separators; the month names of the locale are accepted too.
   * Default: `dateFormat`.
   */
  readonly inputFormat = input<Intl.DateTimeFormatOptions | null>(null);
  /**
   * Keeps typed text that is not a valid date (PrimeNG `keepInvalid`). The field is marked
   * invalid (`aria-invalid`) and the value becomes empty, so a required check fails. Without
   * it, such text goes back to the text of the value.
   */
  readonly keepInvalid = input(false, { transform: booleanAttribute });
  /**
   * Type of the value (PrimeNG `dataType`): `'date'` (default) gives `Date` objects, `'string'`
   * gives ISO text: `yyyy-mm-dd`, or `yyyy-mm-ddTHH:mm` (`yyyy-mm-ddTHH:mm:ss` with
   * `showSeconds`) with `showTime`. The text that the picker writes is a local date and time,
   * without a time zone. A value may be a `Date` or ISO text in both modes; the picker also reads
   * fractional seconds and a zone (`2026-11-22T13:30:15.123Z`, `...+01:00`), as server JSON often
   * has them, and shows that instant in local time. So a date-only value sent as UTC midnight
   * (`2026-11-22T00:00:00Z`) shows the previous day west of UTC: send a date without a time
   * (`2026-11-22`) for a calendar day.
   */
  readonly dataType = input<'date' | 'string'>('date');
  /**
   * Opens the popup as a modal sheet in the middle of the window, in a native `<dialog>` with a
   * backdrop, and with larger days for touch (PrimeNG `touchUI`). The keyboard model does not
   * change; Escape and a click on the backdrop close it. While it is open, the page does not
   * scroll (the scroll lock of `star-dialog`).
   */
  readonly touchUI = input(false, { transform: booleanAttribute });
  /**
   * Window width at or below which the popup opens as a sheet (as `touchUI`): a CSS length, for
   * example `'640px'` or `'40rem'`, used in the media query `(max-width: <breakpoint>)` (PrimeNG
   * `breakpoint`). The width is checked when the popup opens. While the sheet is open, the page
   * does not scroll.
   */
  readonly breakpoint = input<string | null>(null);
  /** Months shown side by side in the popup. */
  readonly numberOfMonths = input(1);
  /** Shows the ISO 8601 week number at the start of each week. */
  readonly showWeek = input(this.defaults.showWeek ?? false, { transform: booleanAttribute });
  /** Shows the days of the month before and after (PrimeNG `showOtherMonths`). */
  readonly showOtherMonths = input(true, { transform: booleanAttribute });
  /** The shown days of the month before and after can be chosen (PrimeNG `selectOtherMonths`). */
  readonly selectOtherMonths = input(true, { transform: booleanAttribute });
  /**
   * Marked days in the calendar, for example holidays (Ignite UI `specialDates`). The kind and
   * the label are part of the accessible name of the day.
   */
  readonly specialDates = input<readonly StarSpecialDate[]>([]);
  /**
   * Clock of the typed time with `showTime`: `'24'` (14:30) or `'12'` (2:30 PM). Both forms
   * are accepted when the user types.
   */
  readonly hourFormat = input<'24' | '12'>(this.defaults.hourFormat ?? '24');
  /**
   * Adds seconds to the time with `showTime`: the text is `hh:mm:ss` and the popup has a second
   * column (PrimeNG `showSeconds`).
   */
  readonly showSeconds = input(false, { transform: booleanAttribute });
  /**
   * Earliest and latest time of every day with `showTime`, `HH:mm` or `HH:mm:ss`, for example
   * opening hours (Ignite UI `minValue` / `maxValue` of the time part). They add to `minDate` /
   * `maxDate`: the columns disable the other times, typed text outside them is not taken, and a
   * picked day moves its time into them.
   */
  readonly minTime = input<string | null>(null);
  readonly maxTime = input<string | null>(null);
  /** Hour step of the time columns with `showTime` (PrimeNG `stepHour`). */
  readonly stepHour = input(1);
  /** Second step of the time columns with `showSeconds` (PrimeNG `stepSecond`). */
  readonly stepSecond = input(1);
  readonly showButtonBar = input(this.defaults.showButtonBar ?? false, {
    transform: booleanAttribute,
  });
  readonly showClear = input(false, { transform: booleanAttribute });
  /** Disables typing; the date can only be picked. */
  readonly readonlyInput = input(false, { transform: booleanAttribute });
  /** Size. Default: `size` of `provideStarNg` (`small` or `medium`), else `md`. */
  readonly size = input<'sm' | 'md'>(this.defaults.size ?? 'md');
  readonly ariaLabel = input<string | null>(null);
  readonly inputId = input(this.ids.getId('star-date-'));

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');

  readonly touch = output<void>();
  readonly opened = output<void>();
  readonly closed = output<void>();
  /** The user moved the calendar to another month (PrimeNG `onMonthChange`). */
  readonly monthChange = output<StarCalendarMonthChange>();
  /** The user moved the calendar to another year (PrimeNG `onYearChange`). */
  readonly yearChange = output<StarCalendarYearChange>();
  /** The user switched the calendar between the day, month and year views. */
  readonly viewChange = output<StarCalendarView>();
  /**
   * The user chose Today in the button bar, after the value changed; the event is today
   * (PrimeNG `onTodayClick`). Not emitted when today cannot be chosen.
   */
  readonly todayClick = output<Date>();
  /**
   * The user chose Clear in the button bar or the clear button, after the value was cleared
   * (PrimeNG `onClearClick`).
   */
  readonly clearClick = output<void>();

  protected readonly positions = PANEL_POSITIONS;
  protected readonly viewportMargin = PANEL_VIEWPORT_MARGIN;
  protected readonly panelId = this.ids.getId('star-date-panel-');
  protected readonly open = signal(false);
  /** The touch mode: the open popup is a modal sheet (`touchUI` or `breakpoint`). */
  protected readonly sheet = new StarDateSheet();
  private readonly sheetDialog = viewChild<ElementRef<HTMLDialogElement>>('sheetDialog');
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);
  /**
   * Invalid after touch, while the parent `star-field` shows an error, or while the field keeps
   * text that is not a date (`keepInvalid`).
   */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText() || this.textInvalid(),
  );
  /** The field has the focus: the text follows `inputFormat`, else `displayFormat`. */
  protected readonly editing = signal(false);
  private readonly textFormat = computed(
    () => (this.editing() ? this.inputFormat() : this.displayFormat()) ?? this.dateFormat(),
  );
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  protected readonly interactive = computed(() => !this.disabled() && !this.readonly());
  protected readonly hint = computed(() => this.placeholder() ?? formatHint(this.locale()));

  /** Time fields in the popup (`showTime` on the single and the range picker). */
  protected readonly timeEnabled: () => boolean = () => false;
  protected readonly timeStep: () => number = () => 60;
  protected timeFields(): readonly StarTimeField[] {
    return [];
  }
  /** Chosen days of the multiple-date picker. */
  protected readonly calendarDates: () => readonly Date[] = () => [];
  /** Smallest unit the user chooses (the single picker's `view`). */
  protected readonly granularity: () => StarCalendarView = () => 'day';

  protected readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  protected readonly control = viewChild.required<ElementRef<HTMLElement>>('control');
  protected readonly calendar = viewChild(StarCalendar);

  /** `starDate`, `starHeader` and `starFooter` slots written inside the picker. */
  private readonly slots = contentChildren(StarSlot, { descendants: true });
  protected readonly headerSlot = starSlot<object>(this.slots, this, 'header');
  protected readonly footerSlot = starSlot<object>(this.slots, this, 'footer');
  protected readonly dateSlot = starSlot<StarDateContext>(this.slots, this, 'date');
  protected readonly decadeSlot = starSlot<StarDecadeContext>(this.slots, this, 'decade');
  protected readonly buttonBarSlot = starSlot<StarButtonBarContext>(this.slots, this, 'buttonBar');
  /** `starTimeCell`: the cells of the time columns of `showTime`. */
  protected readonly timeCellSlot = starSlot<StarTimeCellContext>(this.slots, this, 'timeCell');
  protected readonly buttonBarContext: StarButtonBarContext = {
    today: () => this.today(),
    clear: () => this.onClearClick(),
  };

  /** Text for the current value. */
  protected abstract readonly displayText: () => string;
  /** Typed text that is not a date, kept with `keepInvalid`. It resets when the value changes. */
  private readonly keptText = linkedSignal<TValue, string | null>({
    source: () => this.value(),
    computation: () => null,
  });
  /** The field keeps text that is not a date. */
  protected readonly textInvalid = computed(() => this.keptText() !== null);
  /** Text the user is typing; resets when the value changes. */
  protected readonly typed = linkedSignal(() => this.keptText() ?? this.displayText());
  protected abstract parseText(text: string): TValue | undefined;
  protected abstract emptyValue(): TValue;
  protected abstract pickToday(today: Date): void;

  protected format(date: Date | null): string {
    return formatDate(date, this.locale(), this.textFormat());
  }

  /** A value of the model as a date: ISO text is read as a local date and time. */
  protected toDate(value: Date | string | null | undefined): Date | null {
    return starParseIso(value);
  }

  /** A date as a value of the model: the date, or ISO text with `dataType: 'string'`. */
  protected fromDate(date: Date): Date | string {
    return starFromDate(date, this.dataType(), this.timeEnabled(), this.showSeconds());
  }

  protected allowed(date: Date): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    return (
      (!min || compareDays(date, min) >= 0) &&
      (!max || compareDays(date, max) <= 0) &&
      !this.disabledDays().includes(date.getDay()) &&
      !this.disabledDates().some((d) => sameDay(d, date)) &&
      !this.dateDisabled()?.(date)
    );
  }

  openPanel(): void {
    if (!this.interactive() || this.open()) return;
    const sheet = this.sheet.decide(this.touchUI(), this.breakpoint());
    this.open.set(true);
    this.opened.emit();
    if (!sheet) return;
    afterNextRender(
      () => {
        this.sheet.show(this.sheetDialog()?.nativeElement);
        this.calendar()?.focusActive();
      },
      { injector: this.injector },
    );
  }

  protected onSheetCancel(event: Event): void {
    event.preventDefault();
    this.closePanel();
  }

  protected onSheetClick(event: MouseEvent): void {
    if (!this.sheet.isBackdropClick(event)) return;
    this.closePanel();
    this.touch.emit();
  }

  closePanel(focusInput = true): void {
    if (!this.open()) return;
    this.open.set(false);
    this.sheet.close(this.sheetDialog()?.nativeElement);
    if (focusInput) this.input().nativeElement.focus();
    this.closed.emit();
  }

  protected togglePanel(): void {
    if (this.open()) this.closePanel();
    else this.openPanel();
  }

  protected onAttached(): void {
    this.calendar()?.focusActive();
  }

  protected onOutsideClick(event: MouseEvent): void {
    if (this.control().nativeElement.contains(event.target as Node)) return;
    this.closePanel(false);
    this.touch.emit();
  }

  /**
   * Applies typed text: valid dates set the value. Invalid text reverts, or with `keepInvalid`
   * stays, marked invalid, and the value becomes empty.
   */
  protected commitTyped(): void {
    const text = this.typed();
    if (text === this.displayText()) return;
    const parsed = text.trim() ? this.parseText(text) : this.emptyValue();
    if (parsed !== undefined) {
      this.value.set(parsed);
    } else if (this.keepInvalid()) {
      this.value.set(this.emptyValue());
      // After the value: a new value resets the kept text.
      this.keptText.set(text);
    } else {
      this.revertText();
    }
  }

  /**
   * Restores the text of the current value. Also writes the DOM: the `[value]` binding does not
   * update when the signal returns to the value it last rendered.
   */
  private revertText(): void {
    const text = this.displayText();
    this.typed.set(text);
    this.input().nativeElement.value = text;
  }

  /**
   * Switches the text to `inputFormat` at once, before the user types: a render after the focus
   * would replace text that is typed right after it. So the render runs here. When the text
   * changes, all of it is selected, so typing replaces it (as after Tab); a mouse click still
   * places the caret, because the browser sets it after the focus event.
   */
  protected onInputFocus(): void {
    if (this.editing()) return;
    this.editing.set(true);
    // Without displayFormat or inputFormat the text does not change: no render is needed.
    if (!this.displayFormat() && !this.inputFormat()) return;
    const input = this.input().nativeElement;
    const before = input.value;
    this.changeDetector.detectChanges();
    if (input.value !== before) input.select();
  }

  protected onInputBlur(): void {
    this.commitTyped();
    this.editing.set(false);
    if (!this.open()) this.touch.emit();
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' && (event.altKey || !this.open())) {
      event.preventDefault();
      this.openPanel();
    } else if (event.key === 'Enter') {
      this.commitTyped();
    } else if (event.key === 'Escape' && this.open()) {
      event.preventDefault();
      this.closePanel();
    }
  }

  protected onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closePanel();
    }
  }

  protected today(): void {
    const today = startOfDay(new Date());
    // The month and year views choose the month or year of today, which is always shown.
    if (this.granularity() === 'day' && !this.allowed(today)) return;
    this.pickToday(today);
    this.todayClick.emit(today);
  }

  protected onClearClick(): void {
    this.clear();
    this.clearClick.emit();
  }

  clear(): void {
    this.value.set(this.emptyValue());
    this.closePanel();
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }

  protected parseOne(text: string): Date | null | undefined {
    const date = parseDate(text, this.locale(), this.inputFormat() ?? this.dateFormat());
    return date && this.allowed(date) ? date : undefined;
  }

  /**
   * "<date> hh:mm[:ss]" or "<date>, hh:mm[:ss] am". A date without a time takes the fallback
   * time, moved into the limits (`clampTime`). A typed time outside the limits is not taken.
   * `undefined`: the text is not a valid date and time.
   */
  protected parseDateTime(text: string, fallback: Date): Date | undefined {
    const time = starSplitDateTime(text);
    if (time === undefined) return undefined;
    const date = this.parseOne(time ? time.date : text);
    if (!date) return undefined;
    if (!time) {
      return this.clampTime(
        atTime(date, fallback.getHours(), fallback.getMinutes(), fallback.getSeconds()),
      );
    }
    // Without the second column the seconds are 0.
    const typed = atTime(date, time.hours, time.minutes, this.showSeconds() ? time.seconds : 0);
    return this.clampTime(typed).getTime() === typed.getTime() ? typed : undefined;
  }

  private readonly limits = computed<StarTimeLimits>(() => ({
    minDate: this.minDate(),
    maxDate: this.maxDate(),
    minTime: this.minTime(),
    maxTime: this.maxTime(),
  }));

  /** `date` moved into `minTime` … `maxTime` of its day, then into `minDate` … `maxDate`. */
  protected clampTime(date: Date): Date {
    return starClampTime(date, this.limits());
  }

  /** Earliest and latest time of the day of `date` (`minTime` / `maxTime`, `minDate` / `maxDate`). */
  protected timeLimits(date: Date | null | undefined): { min?: string; max?: string } {
    return starDayTimeLimits(date, this.limits(), this.showSeconds());
  }

  protected timeHint(): string {
    const seconds = this.showSeconds() ? ':ss' : '';
    return this.hourFormat() === '12' ? ` hh:mm${seconds} am` : ` hh:mm${seconds}`;
  }

  protected formatDateTime(date: Date | null): string {
    return starFormatDateTime(
      date,
      this.locale(),
      this.textFormat(),
      this.hourFormat(),
      this.showSeconds(),
    );
  }

  /** `hh:mm` of a date, or `hh:mm:ss` with `showSeconds`. */
  protected timeOf(date: Date | null | undefined): string {
    return starTimeOf(date, this.showSeconds());
  }

  /** `date` at the time of day now, rounded down to the hour, minute and second steps. */
  protected atCurrentTime(date: Date, stepMinute: number): Date {
    const seconds = this.showSeconds() ? this.stepSecond() : 0;
    return starAtStepTime(date, new Date(), [this.stepHour(), stepMinute, seconds]);
  }
}

/** One set of time columns in the popup. */
export interface StarTimeField {
  readonly label: string;
  /** `hh:mm` (`hh:mm:ss` with `showSeconds`), or `''` when the date is not chosen yet. */
  readonly value: string;
  readonly set: (time: string) => void;
  /** Earliest and latest time on the chosen day, `hh:mm` or `hh:mm:ss` (from `minDate` / `maxDate`). */
  readonly min?: string;
  readonly max?: string;
}

/**
 * Date picker (PrimeNG `p-datepicker`): typed entry (`dd/mm/yyyy` or the locale's order, or ISO),
 * calendar popup with month / year views, min / max, disabled dates and weekdays, Today / Clear.
 *
 * `showTime` adds a time of day: the value keeps hours and minutes (and seconds with
 * `showSeconds`), the text is `dd/mm/yyyy, hh:mm` in the 24-hour clock, and the popup has hour
 * and minute columns (a
 * StarNG panel, not the popup of the browser) and stays open until the user chooses Done. With
 * `showTime`, `minDate` / `maxDate` also limit the time: the columns disable the times outside
 * the limits, and a value outside the limits moves to the nearest limit.
 *
 * `view="month"` or `view="year"` chooses a month or a year: the value is its first day and the
 * text is `mm/yyyy` or `yyyy`.
 *
 * `<star-date-picker [formField]="form.receivedOn" [maxDate]="today" showButtonBar />`
 *
 * The type parameter `T` is the type of the value: `Date` (default) or `string`. Pair it with
 * `dataType`: `T` = `string` needs `dataType="string"`, or the picker writes `Date`s into a
 * string model. Angular infers `T` from `[(value)]` or `[formField]`.
 */
@Component({
  selector: 'star-date-picker',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    NgTemplateOutlet,
    StarCalendar,
    StarTimeColumns,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarDatePicker) }],
  host: STAR_DATE_HOST,
  template: STAR_DATE_TEMPLATE,
})
export class StarDatePicker<T extends Date | string = Date>
  extends StarDateInputBase<T | null>
  implements FormValueControl<T | null>
{
  /** The date: a `Date`, or ISO text with `dataType: 'string'`. */
  readonly value = model<T | null>(null);
  /** Adds a time of day (hours and minutes) to the value. */
  readonly showTime = input(false, { transform: booleanAttribute });
  /** Minute step of the time columns. */
  readonly stepMinute = input(1);
  /** Unit to choose: a day (default), a month or a year. */
  readonly view = input<StarCalendarView>('day');
  readonly dateSelect = output<Date>();

  protected readonly mode = 'single' as const;
  protected override readonly timeEnabled = () => this.showTime() && this.view() === 'day';
  protected override readonly timeStep = () => Math.max(1, this.stepMinute()) * 60;
  protected override readonly granularity = this.view;
  protected override readonly hint = computed(() => {
    if (this.placeholder()) return this.placeholder()!;
    if (this.view() === 'month') return 'mm/yyyy';
    if (this.view() === 'year') return 'yyyy';
    return formatHint(this.locale()) + (this.showTime() ? this.timeHint() : '');
  });
  protected readonly displayText = () => {
    const value = this.date();
    if (!value) return '';
    if (this.view() === 'year') return String(value.getFullYear());
    if (this.view() === 'month') {
      return `${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
    }
    return this.timeEnabled() ? this.formatDateTime(value) : this.format(value);
  };
  protected readonly hasValue = computed(() => this.date() !== null);
  /** The value as a date. */
  protected readonly date = computed(() => this.toDate(this.value()));
  protected readonly calendarSelected = this.date;
  protected readonly calendarRange = signal<StarDateRange | null>(null);

  protected parseText(text: string): T | null | undefined {
    const date = this.parseDay(text);
    return date ? (this.fromDate(date) as T) : date;
  }

  private parseDay(text: string): Date | null | undefined {
    const view = this.view();
    if (view !== 'day') return starParsePeriod(text.trim(), view, this.minDate(), this.maxDate());
    if (!this.timeEnabled()) return this.parseOne(text);
    return this.parseDateTime(text, this.date() ?? new Date(2000, 0, 1));
  }

  protected emptyValue(): T | null {
    return null;
  }

  protected pickToday(today: Date): void {
    if (this.view() === 'month')
      return this.onDateSelect(new Date(today.getFullYear(), today.getMonth(), 1));
    if (this.view() === 'year') return this.onDateSelect(new Date(today.getFullYear(), 0, 1));
    if (!this.allowed(today)) return;
    if (!this.timeEnabled()) return this.onDateSelect(today);
    this.setValue(this.atCurrentTime(today, this.stepMinute()));
  }

  protected onDateSelect(date: Date): void {
    if (!this.timeEnabled()) {
      this.setValue(date);
      this.closePanel();
      return;
    }
    // Keep the time already chosen; a first pick starts at the current time.
    const current = this.date();
    this.setValue(
      current
        ? atTime(date, current.getHours(), current.getMinutes(), current.getSeconds())
        : this.atCurrentTime(date, this.stepMinute()),
    );
  }

  protected override timeFields(): readonly StarTimeField[] {
    return [
      {
        label: this.text.time,
        value: this.timeOf(this.date()),
        ...this.timeLimits(this.date()),
        set: (time) => {
          const next = withTime(this.date(), time);
          if (next) this.setValue(next);
        },
      },
    ];
  }

  private setValue(date: Date): void {
    const next = this.timeEnabled() ? this.clampTime(date) : date;
    this.value.set(this.fromDate(next) as T);
    this.dateSelect.emit(next);
  }
}

/**
 * Date range picker (PrimeNG `p-datepicker selectionMode="range"`). Value: `{ start, end }`.
 * First click sets the start, second click the end (swapped if earlier); hovering previews.
 * Type `01/11/2026 – 15/11/2026` (any separator between the two dates).
 *
 * The type parameter `T` is the type of the value: `Date` (default) or `string`, for both ends. Pair it with
 * `dataType`: `T` = `string` needs `dataType="string"`, or the picker writes `Date`s into a
 * string model. Angular infers `T` from `[(value)]` or `[formField]`.
 */
@Component({
  selector: 'star-date-range-picker',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    NgTemplateOutlet,
    StarCalendar,
    StarTimeColumns,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarDateRangePicker) }],
  host: { ...STAR_DATE_HOST, class: 'star-date star-date--range' },
  template: STAR_DATE_TEMPLATE,
})
export class StarDateRangePicker<T extends Date | string = Date>
  extends StarDateInputBase<StarDateRange<T> | null>
  implements FormValueControl<StarDateRange<T> | null>
{
  /** The range: two `Date`s, or ISO text with `dataType: 'string'`. */
  readonly value = model<StarDateRange<T> | null>(null);
  /** The value as dates. */
  protected readonly range = computed(() => starMapRange(this.value(), (day) => this.toDate(day)));
  /**
   * Adds a time of day to both ends. A new start is at 00:00 and a new end at 23:59 (23:59:59
   * with `showSeconds`); the popup
   * has start and end time columns and stays open until the user chooses Done.
   */
  readonly showTime = input(false, { transform: booleanAttribute });
  /** Minute step of the time columns. */
  readonly stepMinute = input(1);
  readonly rangeSelect = output<StarDateRange>();

  protected readonly mode = 'range' as const;
  protected override readonly timeEnabled = this.showTime;
  protected override readonly timeStep = () => Math.max(1, this.stepMinute()) * 60;
  protected override readonly hint = computed(
    () =>
      this.placeholder() ?? formatHint(this.locale()) + (this.showTime() ? this.timeHint() : ''),
  );
  private readonly show = (date: Date | null) =>
    this.showTime() ? this.formatDateTime(date) : this.format(date);

  protected override timeFields(): readonly StarTimeField[] {
    const range = this.range();
    const update = (edge: 'start' | 'end') => (time: string) => {
      const current = this.range();
      const next = withTime(current?.[edge], time);
      if (!current?.start || !next) return;
      const changed = { ...current, [edge]: this.clampTime(next) };
      // Keep the order when both ends are on the same day.
      if (changed.end && changed.start && changed.end.getTime() < changed.start.getTime()) return;
      this.setRange(changed);
      if (changed.end) this.rangeSelect.emit(changed);
    };
    const start = this.timeLimits(range?.start);
    const end = this.timeLimits(range?.end);
    // On one day the end is not before the start.
    const sameDate = !!range?.start && !!range.end && sameDay(range.start, range.end);
    return [
      {
        label: this.text.startTime,
        value: this.timeOf(range?.start),
        set: update('start'),
        min: start.min,
        max: sameDate ? this.timeOf(range?.end) : start.max,
      },
      {
        label: this.text.endTime,
        value: this.timeOf(range?.end),
        set: update('end'),
        min: sameDate ? this.timeOf(range?.start) : end.min,
        max: end.max,
      },
    ];
  }
  protected readonly hasValue = computed(() => !!this.range()?.start);
  protected readonly calendarSelected = signal<Date | null>(null);
  protected readonly calendarRange = this.range;

  protected readonly displayText = () => {
    const range = this.range();
    if (!range?.start) return '';
    return range.end
      ? `${this.show(range.start)} – ${this.show(range.end)}`
      : `${this.show(range.start)} – `;
  };

  protected parseText(text: string): StarDateRange<T> | null | undefined {
    const range = this.parseRange(text);
    return range && this.toValue(range);
  }

  private parseRange(text: string): StarDateRange | null | undefined {
    // Two dates, each written with its own separators, split on a dash or "to" between them.
    const parts = text.split(/\s+[–—-]\s*|\s+to\s+/i).filter((part) => part.trim());
    if (parts.length !== 2) return undefined;
    if (this.showTime()) {
      const from = this.parseDateTime(parts[0], new Date(2000, 0, 1));
      const to = this.parseDateTime(parts[1], this.endOfDay(new Date(2000, 0, 1)));
      if (!from || !to) return undefined;
      return from.getTime() <= to.getTime() ? { start: from, end: to } : { start: to, end: from };
    }
    const start = this.parseOne(parts[0]);
    const end = this.parseOne(parts[1]);
    if (!start || !end) return undefined;
    return compareDays(start, end) <= 0 ? { start, end } : { start: end, end: start };
  }

  protected emptyValue(): StarDateRange<T> | null {
    return null;
  }

  private toValue(range: StarDateRange): StarDateRange<T> {
    return starMapRange(range, (day) => (day ? (this.fromDate(day) as T) : null))!;
  }

  private setRange(range: StarDateRange): void {
    this.value.set(this.toValue(range));
  }

  /** The last time of the day: 23:59, or 23:59:59 with `showSeconds`. */
  private endOfDay(date: Date): Date {
    return atTime(date, 23, 59, this.showSeconds() ? 59 : 0);
  }

  protected pickToday(today: Date): void {
    if (!this.allowed(today)) return;
    if (this.showTime()) {
      this.setRange({
        start: this.clampTime(atTime(today, 0, 0)),
        end: this.clampTime(this.endOfDay(today)),
      });
      return;
    }
    this.setRange({ start: today, end: today });
    this.closePanel();
  }

  protected onDateSelect(date: Date): void {
    const range = this.range();
    if (!range?.start || range.end) {
      this.setRange({
        start: this.showTime() ? this.clampTime(atTime(date, 0, 0)) : date,
        end: null,
      });
      return;
    }
    const [first, last] =
      compareDays(date, range.start) < 0 ? [date, range.start] : [range.start, date];
    const next = this.showTime()
      ? {
          start: this.clampTime(atTime(first, 0, 0)),
          end: this.clampTime(this.endOfDay(last)),
        }
      : { start: first, end: last };
    this.setRange(next);
    this.rangeSelect.emit(next);
    // With a time, the popup stays open for the time fields.
    if (!this.showTime()) this.closePanel();
  }
}

/**
 * Multiple-date picker (PrimeNG `p-datepicker selectionMode="multiple"`). Value: a list of
 * days in date order. A click adds a day or removes it; the popup stays open. Type the dates
 * with a comma or a semicolon between them.
 *
 * The type parameter `T` is the type of the value: `Date` (default) or `string`, for each day. Pair it with
 * `dataType`: `T` = `string` needs `dataType="string"`, or the picker writes `Date`s into a
 * string model. Angular infers `T` from `[(value)]` or `[formField]`.
 */
@Component({
  selector: 'star-multi-date-picker',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [
    StarPart,
    CdkConnectedOverlay,
    CdkOverlayOrigin,
    NgTemplateOutlet,
    StarCalendar,
    StarTimeColumns,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMultiDatePicker) }],
  host: { ...STAR_DATE_HOST, class: 'star-date star-date--multiple' },
  template: STAR_DATE_TEMPLATE,
})
export class StarMultiDatePicker<T extends Date | string = Date>
  extends StarDateInputBase<readonly T[]>
  implements FormValueControl<readonly T[]>
{
  /** The days: `Date`s, or ISO text with `dataType: 'string'`. */
  readonly value = model<readonly T[]>([]);
  /** The value as dates. */
  protected readonly dates = computed(() => starDates(this.value()));
  /** Largest number of days (0 = no limit). A click on a new day does nothing at the limit. */
  readonly maxDates = input(0);

  protected readonly mode = 'multiple' as const;
  protected readonly hasValue = computed(() => this.dates().length > 0);
  protected readonly calendarSelected = signal<Date | null>(null);
  protected readonly calendarRange = signal<StarDateRange | null>(null);
  protected override readonly calendarDates = this.dates;

  protected readonly displayText = () =>
    this.dates()
      .map((date) => this.format(date))
      .join(', ');

  protected parseText(text: string): readonly T[] | undefined {
    return this.parseDays(text)?.map((day) => this.fromDate(day) as T);
  }

  private parseDays(text: string): readonly Date[] | undefined {
    const dates: Date[] = [];
    for (const part of text.split(/\s*[,;]\s*/).filter((item) => item.trim())) {
      const date = this.parseOne(part);
      if (!date) return undefined;
      if (!dates.some((day) => sameDay(day, date))) dates.push(date);
    }
    if (this.maxDates() > 0 && dates.length > this.maxDates()) return undefined;
    return dates.sort((a, b) => a.getTime() - b.getTime());
  }

  protected emptyValue(): readonly T[] {
    return [];
  }

  private setDates(days: readonly Date[]): void {
    this.value.set(days.map((day) => this.fromDate(day) as T));
  }

  protected pickToday(today: Date): void {
    if (this.allowed(today) && !this.dates().some((day) => sameDay(day, today))) {
      this.onDateSelect(today);
    }
  }

  protected onDateSelect(date: Date): void {
    const days = this.dates();
    if (days.some((day) => sameDay(day, date))) {
      this.setDates(days.filter((day) => !sameDay(day, date)));
    } else if (this.maxDates() <= 0 || days.length < this.maxDates()) {
      this.setDates([...days, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  }
}
