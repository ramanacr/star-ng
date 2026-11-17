import { _IdGenerator } from '@angular/cdk/a11y';
import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  Directive,
  ElementRef,
  forwardRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  STAR_SLOT_HOST,
  STAR_UI_TEXT,
  StarDirectionService,
  StarSlot,
  starSlot,
} from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';
import { StarCalendar, StarCalendarView } from './calendar';
import type { StarDateContext } from './date-slots';
import {
  compareDays,
  DEFAULT_DATE_FORMAT,
  formatDate,
  formatHint,
  parseDate,
  sameDay,
  StarDateRange,
  startOfDay,
} from './date-utils';
import { StarTimeColumns } from './time-columns';

/** Time part of the input text: 24-hour clock, so typed text parses the same in every locale. */
const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
};

/** The calendar day of `date` at the given local time. */
function atTime(date: Date, hours: number, minutes: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes);
}

const PANEL_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
];

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
  readonly firstDayOfWeek = input<number | null>(null);
  /** BCP 47 locale for names and formats. Default: the browser locale. */
  readonly locale = input<string | undefined>(undefined);
  /** `Intl.DateTimeFormat` options for the input text (default numeric day / month / year). */
  readonly dateFormat = input<Intl.DateTimeFormatOptions>(DEFAULT_DATE_FORMAT);
  /** Months shown side by side in the popup. */
  readonly numberOfMonths = input(1);
  /** Shows the ISO 8601 week number at the start of each week. */
  readonly showWeek = input(false, { transform: booleanAttribute });
  /**
   * Clock of the typed time with `showTime`: `'24'` (14:30) or `'12'` (2:30 PM). Both forms
   * are accepted when the user types.
   */
  readonly hourFormat = input<'24' | '12'>('24');
  readonly showButtonBar = input(false, { transform: booleanAttribute });
  readonly showClear = input(false, { transform: booleanAttribute });
  /** Disables typing; the date can only be picked. */
  readonly readonlyInput = input(false, { transform: booleanAttribute });
  readonly size = input<'sm' | 'md'>('md');
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

  protected readonly positions = PANEL_POSITIONS;
  protected readonly panelId = this.ids.getId('star-date-panel-');
  protected readonly open = signal(false);
  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
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

  /** Text for the current value. */
  protected abstract readonly displayText: () => string;
  /** Text the user is typing; resets when the value changes. */
  protected readonly typed = linkedSignal(() => this.displayText());
  protected abstract parseText(text: string): TValue | undefined;
  protected abstract emptyValue(): TValue;
  protected abstract pickToday(today: Date): void;

  protected format(date: Date | null): string {
    return formatDate(date, this.locale(), this.dateFormat());
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
    this.open.set(true);
    this.opened.emit();
  }

  closePanel(focusInput = true): void {
    if (!this.open()) return;
    this.open.set(false);
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

  /** Applies typed text: valid dates set the value, invalid text reverts. */
  protected commitTyped(): void {
    const text = this.typed();
    if (text === this.displayText()) return;
    const parsed = text.trim() ? this.parseText(text) : this.emptyValue();
    if (parsed === undefined) this.revertText();
    else this.value.set(parsed);
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

  protected onInputBlur(): void {
    this.commitTyped();
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
    this.pickToday(startOfDay(new Date()));
  }

  clear(): void {
    this.value.set(this.emptyValue());
    this.closePanel();
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }

  protected parseOne(text: string): Date | null | undefined {
    const date = parseDate(text, this.locale());
    return date && this.allowed(date) ? date : undefined;
  }

  /**
   * "<date> hh:mm" or "<date>, hh:mm". A date without a time takes the fallback time.
   * `undefined`: the text is not a valid date and time.
   */
  protected parseDateTime(text: string, hours: number, minutes: number): Date | undefined {
    const match =
      /^(.*?)[,\s]+(\d{1,2})[:.](\d{2})\s*([ap])\.?\s?m?\.?$|^(.*?)[,\s]+(\d{1,2})[:.](\d{2})$/i.exec(
        text.trim(),
      );
    const date = this.parseOne(match ? (match[1] ?? match[5]) : text);
    if (!date) return undefined;
    if (!match) return atTime(date, hours, minutes);
    let h = Number(match[2] ?? match[6]);
    const m = Number(match[3] ?? match[7]);
    const meridiem = match[4]?.toLowerCase();
    if (meridiem) {
      if (h < 1 || h > 12) return undefined;
      h = (h % 12) + (meridiem === 'p' ? 12 : 0);
    }
    return h > 23 || m > 59 ? undefined : atTime(date, h, m);
  }

  /** `date` moved into `minDate` … `maxDate`, compared to the minute. */
  protected clampTime(date: Date): Date {
    const min = this.minDate();
    const max = this.maxDate();
    if (min && date.getTime() < min.getTime()) return new Date(min);
    if (max && date.getTime() > max.getTime()) return new Date(max);
    return date;
  }

  /** Earliest and latest time of the day of `date`: `minDate` / `maxDate` when it is that day. */
  protected timeLimits(date: Date | null | undefined): { min?: string; max?: string } {
    const min = this.minDate();
    const max = this.maxDate();
    return {
      min: date && min && sameDay(date, min) ? timeOf(min) : undefined,
      max: date && max && sameDay(date, max) ? timeOf(max) : undefined,
    };
  }

  protected timeHint(): string {
    return this.hourFormat() === '12' ? ' hh:mm am' : ' hh:mm';
  }

  protected formatDateTime(date: Date | null): string {
    return formatDate(date, this.locale(), {
      ...this.dateFormat(),
      ...TIME_FORMAT,
      hourCycle: this.hourFormat() === '12' ? 'h12' : 'h23',
    });
  }
}

/** One set of time columns in the popup. */
export interface StarTimeField {
  readonly label: string;
  /** `hh:mm`, or `''` when the date is not chosen yet. */
  readonly value: string;
  readonly set: (time: string) => void;
  /** Earliest and latest time on the chosen day, `hh:mm` (from `minDate` / `maxDate`). */
  readonly min?: string;
  readonly max?: string;
}

function timeOf(date: Date | null | undefined): string {
  const pad = (part: number) => String(part).padStart(2, '0');
  return date ? `${pad(date.getHours())}:${pad(date.getMinutes())}` : '';
}

/** `date` at the `hh:mm` time, or `null` when either is missing. */
function withTime(date: Date | null | undefined, time: string): Date | null {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  return date && match ? atTime(date, Number(match[1]), Number(match[2])) : null;
}

const TEMPLATE = `
  <div #control class="star-date__control" cdkOverlayOrigin #origin="cdkOverlayOrigin">
    <input
      #input
      type="text"
      class="star-date__input"
      autocomplete="off"
      inputmode="numeric"
      aria-haspopup="dialog"
      [id]="inputId()"
      [attr.name]="name() || null"
      [value]="typed()"
      [attr.placeholder]="hint()"
      [disabled]="disabled()"
      [readOnly]="readonly() || readonlyInput()"
      [required]="required()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-controls]="open() ? panelId : null"
      [attr.aria-describedby]="fieldDescribedBy()"
      [attr.aria-invalid]="showInvalid() || null"
      (input)="typed.set(input.value)"
      (click)="readonlyInput() && togglePanel()"
      (keydown)="onInputKeydown($event)"
      (blur)="onInputBlur()"
    />
    @if (showClear() && hasValue() && interactive()) {
      <button type="button" class="star-select__icon-btn" [attr.aria-label]="text.clear" (click)="clear()">
        <i class="ph-bold ph-x" aria-hidden="true"></i>
      </button>
    }
    <button
      type="button"
      class="star-date__toggle"
      [disabled]="!interactive()"
      aria-haspopup="dialog"
      [attr.aria-label]="text.chooseDate"
      [attr.aria-expanded]="open()"
      [attr.aria-controls]="open() ? panelId : null"
      (click)="togglePanel()"
    >
      <i class="ph-bold ph-calendar-blank" aria-hidden="true"></i>
    </button>
  </div>

  <ng-template
    cdkConnectedOverlay
    cdkConnectedOverlayUsePopover="inline"
    [cdkConnectedOverlayOrigin]="origin"
    [cdkConnectedOverlayOpen]="open()"
    [cdkConnectedOverlayPositions]="positions"
    (attach)="onAttached()"
    (detach)="closePanel(false)"
    (overlayOutsideClick)="onOutsideClick($event)"
  >
    <div
      class="star-panel star-date__panel"
      role="dialog"
      [id]="panelId"
      [attr.aria-label]="text.chooseDate"
      (keydown)="onPanelKeydown($event)"
    >
      @if (headerSlot(); as header) {
        <ng-container *ngTemplateOutlet="header" />
      }
      <star-calendar
        [mode]="mode"
        [selected]="calendarSelected()"
        [range]="calendarRange()"
        [selectedDates]="calendarDates()"
        [granularity]="granularity()"
        [numberOfMonths]="numberOfMonths()"
        [showWeek]="showWeek()"
        [minDate]="minDate()"
        [maxDate]="maxDate()"
        [disabledDates]="disabledDates()"
        [disabledDays]="disabledDays()"
        [dateDisabled]="dateDisabled()"
        [firstDayOfWeek]="firstDayOfWeek()"
        [locale]="locale()"
        [dateTemplate]="dateSlot()"
        (dateSelect)="onDateSelect($event)"
      />
      @if (timeEnabled()) {
        <div class="star-date__time">
          @for (field of timeFields(); track field.label) {
            <div class="star-date__time-field" role="group" [attr.aria-label]="field.label">
              <span class="star-date__time-label" aria-hidden="true">{{ field.label }}</span>
              <star-time-columns
                [value]="field.value || null"
                [min]="field.min"
                [max]="field.max"
                [stepMinute]="timeStep() / 60"
                [hourFormat]="hourFormat()"
                [disabled]="!field.value"
                (valueChange)="$event && field.set($event)"
              />
            </div>
          }
          <button type="button" class="star-btn star-btn--primary star-btn--sm" (click)="closePanel()">{{ text.done }}</button>
        </div>
      }
      @if (showButtonBar()) {
        <div class="star-date__bar">
          <button type="button" class="star-btn star-btn--ghost star-btn--sm" (click)="today()">{{ text.today }}</button>
          <button type="button" class="star-btn star-btn--ghost star-btn--sm" (click)="clear()">{{ text.clear }}</button>
        </div>
      }
      <!-- The footer is last, below the button bar. PrimeNG \`#footer\` template. -->
      @if (footerSlot(); as footer) {
        <ng-container *ngTemplateOutlet="footer" />
      }
    </div>
  </ng-template>
`;

const HOST = {
  class: 'star-date',
  '[class.star-date--open]': 'open()',
  '[class.star-date--disabled]': 'disabled()',
  '[class.star-date--invalid]': 'showInvalid()',
  '[class.star-date--sm]': "size() === 'sm'",
};

/**
 * Date picker (PrimeNG `p-datepicker`): typed entry (`dd/mm/yyyy` or the locale's order, or ISO),
 * calendar popup with month / year views, min / max, disabled dates and weekdays, Today / Clear.
 *
 * `showTime` adds a time of day: the value keeps hours and minutes, the text is
 * `dd/mm/yyyy, hh:mm` in the 24-hour clock, and the popup has hour and minute columns (a
 * StarNG panel, not the popup of the browser) and stays open until the user chooses Done. With
 * `showTime`, `minDate` / `maxDate` also limit the time: the columns disable the times outside
 * the limits, and a value outside the limits moves to the nearest limit.
 *
 * `view="month"` or `view="year"` chooses a month or a year: the value is its first day and the
 * text is `mm/yyyy` or `yyyy`.
 *
 * `<star-date-picker [formField]="form.receivedOn" [maxDate]="today" showButtonBar />`
 */
@Component({
  selector: 'star-date-picker',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet, StarCalendar, StarTimeColumns],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarDatePicker) }],
  host: HOST,
  template: TEMPLATE,
})
export class StarDatePicker
  extends StarDateInputBase<Date | null>
  implements FormValueControl<Date | null>
{
  readonly value = model<Date | null>(null);
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
    const value = this.value();
    if (!value) return '';
    if (this.view() === 'year') return String(value.getFullYear());
    if (this.view() === 'month') {
      return `${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
    }
    return this.timeEnabled() ? this.formatDateTime(value) : this.format(value);
  };
  protected readonly hasValue = computed(() => this.value() !== null);
  protected readonly calendarSelected = this.value;
  protected readonly calendarRange = signal<StarDateRange | null>(null);

  protected parseText(text: string): Date | null | undefined {
    if (this.view() !== 'day') return this.parsePeriod(text.trim());
    if (!this.timeEnabled()) return this.parseOne(text);
    const current = this.value();
    const date = this.parseDateTime(text, current?.getHours() ?? 0, current?.getMinutes() ?? 0);
    return date && this.clampTime(date).getTime() === date.getTime() ? date : undefined;
  }

  /** `mm/yyyy`, `yyyy-mm` or `yyyy`: the first day of that month or year. */
  private parsePeriod(text: string): Date | undefined {
    const year = /^(\d{4})$/.exec(text);
    const month = /^(\d{1,2})[/.\- ](\d{4})$/.exec(text);
    const iso = /^(\d{4})-(\d{1,2})$/.exec(text);
    let date: Date | null = null;
    if (this.view() === 'year' && year) date = new Date(Number(year[1]), 0, 1);
    else if (this.view() === 'month' && month)
      date = new Date(Number(month[2]), Number(month[1]) - 1, 1);
    else if (this.view() === 'month' && iso) date = new Date(Number(iso[1]), Number(iso[2]) - 1, 1);
    if (!date || date.getMonth() > 11 || Number.isNaN(date.getTime())) return undefined;
    if (month && (Number(month[1]) < 1 || Number(month[1]) > 12)) return undefined;
    if (iso && (Number(iso[2]) < 1 || Number(iso[2]) > 12)) return undefined;
    return this.periodAllowed(date) ? date : undefined;
  }

  /** A month or year is allowed when any part of it is inside `minDate` … `maxDate`. */
  private periodAllowed(first: Date): boolean {
    const last =
      this.view() === 'year'
        ? new Date(first.getFullYear(), 11, 31)
        : new Date(first.getFullYear(), first.getMonth() + 1, 0);
    const min = this.minDate();
    const max = this.maxDate();
    return (!min || compareDays(last, min) >= 0) && (!max || compareDays(first, max) <= 0);
  }

  protected emptyValue(): Date | null {
    return null;
  }

  protected pickToday(today: Date): void {
    if (this.view() === 'month')
      return this.onDateSelect(new Date(today.getFullYear(), today.getMonth(), 1));
    if (this.view() === 'year') return this.onDateSelect(new Date(today.getFullYear(), 0, 1));
    if (!this.allowed(today)) return;
    if (!this.timeEnabled()) return this.onDateSelect(today);
    this.setValue(this.atCurrentTime(today));
  }

  protected onDateSelect(date: Date): void {
    if (!this.timeEnabled()) {
      this.setValue(date);
      this.closePanel();
      return;
    }
    // Keep the time already chosen; a first pick starts at the current time.
    const current = this.value();
    this.setValue(
      current ? atTime(date, current.getHours(), current.getMinutes()) : this.atCurrentTime(date),
    );
  }

  protected override timeFields(): readonly StarTimeField[] {
    return [
      {
        label: this.text.time,
        value: timeOf(this.value()),
        ...this.timeLimits(this.value()),
        set: (time) => {
          const next = withTime(this.value(), time);
          if (next) this.setValue(next);
        },
      },
    ];
  }

  /** `date` at the current time of day, rounded down to the minute step. */
  private atCurrentTime(date: Date): Date {
    const now = new Date();
    const step = Math.max(1, this.stepMinute());
    return atTime(date, now.getHours(), now.getMinutes() - (now.getMinutes() % step));
  }

  private setValue(date: Date): void {
    const next = this.timeEnabled() ? this.clampTime(date) : date;
    this.value.set(next);
    this.dateSelect.emit(next);
  }
}

/**
 * Date range picker (PrimeNG `p-datepicker selectionMode="range"`). Value: `{ start, end }`.
 * First click sets the start, second click the end (swapped if earlier); hovering previews.
 * Type `01/11/2026 – 15/11/2026` (any separator between the two dates).
 */
@Component({
  selector: 'star-date-range-picker',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet, StarCalendar, StarTimeColumns],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarDateRangePicker) }],
  host: { ...HOST, class: 'star-date star-date--range' },
  template: TEMPLATE,
})
export class StarDateRangePicker
  extends StarDateInputBase<StarDateRange | null>
  implements FormValueControl<StarDateRange | null>
{
  readonly value = model<StarDateRange | null>(null);
  /**
   * Adds a time of day to both ends. A new start is at 00:00 and a new end at 23:59; the popup
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
    const range = this.value();
    const update = (edge: 'start' | 'end') => (time: string) => {
      const current = this.value();
      const next = withTime(current?.[edge], time);
      if (!current?.start || !next) return;
      const changed = { ...current, [edge]: this.clampTime(next) };
      // Keep the order when both ends are on the same day.
      if (changed.end && changed.start && changed.end.getTime() < changed.start.getTime()) return;
      this.value.set(changed);
      if (changed.end) this.rangeSelect.emit(changed);
    };
    const start = this.timeLimits(range?.start);
    const end = this.timeLimits(range?.end);
    // On one day the end is not before the start.
    const sameDate = !!range?.start && !!range.end && sameDay(range.start, range.end);
    return [
      {
        label: this.text.startTime,
        value: timeOf(range?.start),
        set: update('start'),
        min: start.min,
        max: sameDate ? timeOf(range?.end) : start.max,
      },
      {
        label: this.text.endTime,
        value: timeOf(range?.end),
        set: update('end'),
        min: sameDate ? timeOf(range?.start) : end.min,
        max: end.max,
      },
    ];
  }
  protected readonly hasValue = computed(() => !!this.value()?.start);
  protected readonly calendarSelected = signal<Date | null>(null);
  protected readonly calendarRange = this.value;

  protected readonly displayText = () => {
    const range = this.value();
    if (!range?.start) return '';
    return range.end
      ? `${this.show(range.start)} – ${this.show(range.end)}`
      : `${this.show(range.start)} – `;
  };

  protected parseText(text: string): StarDateRange | null | undefined {
    // Two dates, each written with its own separators, split on a dash or "to" between them.
    const parts = text.split(/\s+[–—-]\s*|\s+to\s+/i).filter((part) => part.trim());
    if (parts.length !== 2) return undefined;
    if (this.showTime()) {
      const from = this.parseDateTime(parts[0], 0, 0);
      const to = this.parseDateTime(parts[1], 23, 59);
      if (!from || !to) return undefined;
      return from.getTime() <= to.getTime() ? { start: from, end: to } : { start: to, end: from };
    }
    const start = this.parseOne(parts[0]);
    const end = this.parseOne(parts[1]);
    if (!start || !end) return undefined;
    return compareDays(start, end) <= 0 ? { start, end } : { start: end, end: start };
  }

  protected emptyValue(): StarDateRange | null {
    return null;
  }

  protected pickToday(today: Date): void {
    if (!this.allowed(today)) return;
    if (this.showTime()) {
      this.value.set({
        start: this.clampTime(atTime(today, 0, 0)),
        end: this.clampTime(atTime(today, 23, 59)),
      });
      return;
    }
    this.value.set({ start: today, end: today });
    this.closePanel();
  }

  protected onDateSelect(date: Date): void {
    const range = this.value();
    if (!range?.start || range.end) {
      this.value.set({
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
          end: this.clampTime(atTime(last, 23, 59)),
        }
      : { start: first, end: last };
    this.value.set(next);
    this.rangeSelect.emit(next);
    // With a time, the popup stays open for the time fields.
    if (!this.showTime()) this.closePanel();
  }
}

/**
 * Multiple-date picker (PrimeNG `p-datepicker selectionMode="multiple"`). Value: a list of
 * days in date order. A click adds a day or removes it; the popup stays open. Type the dates
 * with a comma or a semicolon between them.
 */
@Component({
  selector: 'star-multi-date-picker',
  imports: [CdkConnectedOverlay, CdkOverlayOrigin, NgTemplateOutlet, StarCalendar, StarTimeColumns],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarMultiDatePicker) }],
  host: { ...HOST, class: 'star-date star-date--multiple' },
  template: TEMPLATE,
})
export class StarMultiDatePicker
  extends StarDateInputBase<readonly Date[]>
  implements FormValueControl<readonly Date[]>
{
  readonly value = model<readonly Date[]>([]);
  /** Largest number of days (0 = no limit). A click on a new day does nothing at the limit. */
  readonly maxDates = input(0);

  protected readonly mode = 'multiple' as const;
  protected readonly hasValue = computed(() => this.value().length > 0);
  protected readonly calendarSelected = signal<Date | null>(null);
  protected readonly calendarRange = signal<StarDateRange | null>(null);
  protected override readonly calendarDates = this.value;

  protected readonly displayText = () =>
    this.value()
      .map((date) => this.format(date))
      .join(', ');

  protected parseText(text: string): readonly Date[] | undefined {
    const dates: Date[] = [];
    for (const part of text.split(/\s*[,;]\s*/).filter((item) => item.trim())) {
      const date = this.parseOne(part);
      if (!date) return undefined;
      if (!dates.some((day) => sameDay(day, date))) dates.push(date);
    }
    if (this.maxDates() > 0 && dates.length > this.maxDates()) return undefined;
    return dates.sort((a, b) => a.getTime() - b.getTime());
  }

  protected emptyValue(): readonly Date[] {
    return [];
  }

  protected pickToday(today: Date): void {
    if (this.allowed(today) && !this.value().some((day) => sameDay(day, today))) {
      this.onDateSelect(today);
    }
  }

  protected onDateSelect(date: Date): void {
    const days = this.value();
    if (days.some((day) => sameDay(day, date))) {
      this.value.set(days.filter((day) => !sameDay(day, date)));
    } else if (this.maxDates() <= 0 || days.length < this.maxDates()) {
      this.value.set([...days, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  }
}
