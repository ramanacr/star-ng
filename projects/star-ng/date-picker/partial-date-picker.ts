import { CdkConnectedOverlay, CdkOverlayOrigin } from '@angular/cdk/overlay';
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_SLOT_HOST, StarPart, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { StarCalendar } from './calendar';
import { StarDateInputBase } from './date-picker';
import { STAR_DATE_HOST, STAR_DATE_TEMPLATE } from './date-picker.template';
import { StarDateRange } from './date-utils';
import {
  starComparePartialDates,
  StarDatePrecision,
  starFormatPartialDate,
  starIsValidPartialDate,
  starParsePartialDate,
  StarPartialDate,
  starPartialDateFromDate,
  starPartialDateHint,
  starPartialDatePrecision,
  starPartialDateToDate,
} from './partial-date';
import { StarTimeColumns } from './time-columns';

/** The precisions from the finest to the coarsest. */
const PRECISIONS: readonly StarDatePrecision[] = ['day', 'month', 'year'];

/**
 * Partial date picker: a full date, a month and year, or a year only, for a date that the user
 * does not know to the day. The value keeps its precision: `{ year, month, day }` with `null`
 * for an unknown part (`month` 1–12), or `null` when empty. A `Date` cannot hold an unknown day.
 *
 * Typed text sets the precision: with `datePattern="dd-MMM-yyyy"`, `14-Apr-2026` is a full date,
 * `MAR-2026` a month and year, `1981` a year. The text shows only the known parts (`Mar-2026`,
 * `2026`), never an invented day.
 *
 * In the popup, a radio group above the calendar chooses the precision: the day view for a full
 * date, the month view for a month and year, the year view for a year. It opens on the precision
 * of the value. A pick in the calendar sets the value at that precision; changing the precision
 * alone does not change the value. `precisions` limits the choice, and the group is left out
 * when only one precision is allowed.
 *
 * `minDate` and `maxDate` compare at the precision of the value: with `minDate` 15 March 2026,
 * `Mar-2026` is allowed and `Feb-2026` is not. `disabledDates`, `disabledDays` and `dateDisabled`
 * apply to full dates. `starComparePartialDates` compares two values for a check across fields,
 * such as "the end is not before the start".
 *
 * `<star-partial-date-picker [formField]="form.startedOn" datePattern="dd-MMM-yyyy" />`
 */
@Component({
  selector: 'star-partial-date-picker',
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
  providers: [{ provide: STAR_SLOT_HOST, useExisting: forwardRef(() => StarPartialDatePicker) }],
  host: {
    ...STAR_DATE_HOST,
    class: 'star-date star-date--partial',
    '[attr.data-precision]': 'valuePrecision()',
  },
  template: STAR_DATE_TEMPLATE,
})
export class StarPartialDatePicker
  extends StarDateInputBase<StarPartialDate | null>
  implements FormValueControl<StarPartialDate | null>
{
  /** The date: `{ year, month, day }` with `null` for an unknown month or day, or `null`. */
  readonly value = model<StarPartialDate | null>(null);
  /**
   * The precisions the user may choose or type, in any order: `'day'` (a full date), `'month'`
   * (a month and year) and `'year'`. Default: all three. Typed text of another precision is not
   * taken.
   */
  readonly precisions = input<readonly StarDatePrecision[]>(PRECISIONS);
  /** The user chose a date in the calendar or with Today; the event is the new value. */
  readonly dateSelect = output<StarPartialDate>();

  protected readonly mode = 'single' as const;
  /** The allowed precisions, from the finest to the coarsest. */
  private readonly allowedPrecisions = computed(() => {
    const allowed = PRECISIONS.filter((precision) => this.precisions().includes(precision));
    return allowed.length ? allowed : PRECISIONS;
  });
  /** The value when it is a real partial date of an allowed precision, else `null`. */
  protected readonly partial = computed(() => {
    const value = this.value();
    return starIsValidPartialDate(value) &&
      this.allowedPrecisions().includes(starPartialDatePrecision(value))
      ? value
      : null;
  });
  /** Precision of the value (`data-precision` on the host), or `null` when empty. */
  protected readonly valuePrecision = computed(() => {
    const partial = this.partial();
    return partial ? starPartialDatePrecision(partial) : null;
  });
  /** A value that is not a real partial date, or one of a precision that is not allowed. */
  private readonly valueInvalid = computed(
    () => (this.value() ?? null) !== null && !this.partial(),
  );
  /** The precision of the calendar: the value's, until the user chooses another one. */
  protected readonly precision = linkedSignal<StarDatePrecision>(
    () => this.valuePrecision() ?? this.allowedPrecisions()[0],
  );
  protected override readonly granularity = this.precision;
  private readonly options = computed(() => {
    const labels: Record<StarDatePrecision, string> = {
      day: this.text.precisionDay,
      month: this.text.precisionMonth,
      year: this.text.precisionYear,
    };
    return this.allowedPrecisions().map((value) => ({
      value,
      label: labels[value],
      checked: value === this.precision(),
    }));
  });
  protected override precisionOptions() {
    return this.options();
  }
  protected override choosePrecision(precision: StarDatePrecision): void {
    this.precision.set(precision);
  }

  protected override readonly showInvalid = computed(
    () =>
      (this.invalid() && this.touched()) ||
      !!this.field?.errorText() ||
      this.textInvalid() ||
      this.valueInvalid(),
  );
  /** The pattern of a full date; the month and year forms come from it. */
  protected override readonly textPattern = computed(() => this.datePattern());
  private readonly formatOptions = computed(() => ({
    pattern: this.datePattern(),
    locale: this.locale(),
    format: (this.editing() ? this.inputFormat() : this.displayFormat()) ?? this.dateFormat(),
  }));
  /** The forms of the allowed precisions, for example `dd-MMM-yyyy, MMM-yyyy, yyyy`. */
  protected override readonly hint = computed(
    () =>
      this.placeholder() ??
      this.allowedPrecisions()
        .map((precision) => starPartialDateHint(precision, this.formatOptions()))
        .join(', '),
  );
  protected readonly displayText = () =>
    starFormatPartialDate(this.partial(), this.formatOptions());
  protected readonly hasValue = computed(() => (this.value() ?? null) !== null);
  /** A full date is the chosen day of the calendar. */
  protected readonly calendarSelected = computed(() => {
    const partial = this.partial();
    return partial && partial.day !== null ? starPartialDateToDate(partial) : null;
  });
  /**
   * A month or a year has no chosen day, but the calendar opens on it: in single mode the last
   * of `selectedDates` places the calendar and marks no day.
   */
  protected override readonly calendarDates = computed(() => {
    const partial = this.partial();
    return partial && partial.day === null ? [starPartialDateToDate(partial)] : [];
  });
  protected readonly calendarRange = signal<StarDateRange | null>(null);

  /** A partial date inside `minDate` … `maxDate` at its own precision, and not a disabled day. */
  protected allowedPartial(value: StarPartialDate): boolean {
    const min = this.minDate();
    const max = this.maxDate();
    if (min && starComparePartialDates(value, starPartialDateFromDate(min)) < 0) return false;
    if (max && starComparePartialDates(value, starPartialDateFromDate(max)) > 0) return false;
    return value.day === null || this.allowed(starPartialDateToDate(value));
  }

  protected parseText(text: string): StarPartialDate | null | undefined {
    const parsed = starParsePartialDate(text, {
      ...this.formatOptions(),
      precisions: this.allowedPrecisions(),
    });
    return parsed && this.allowedPartial(parsed) ? parsed : undefined;
  }

  protected emptyValue(): StarPartialDate | null {
    return null;
  }

  protected pickToday(today: Date): void {
    const value = starPartialDateFromDate(today, this.precision());
    if (this.allowedPartial(value)) this.setValue(value);
  }

  protected onDateSelect(date: Date): void {
    const value = starPartialDateFromDate(date, this.precision());
    if (!this.allowedPartial(value)) return;
    this.setValue(value);
  }

  private setValue(value: StarPartialDate): void {
    this.value.set(value);
    this.dateSelect.emit(value);
    this.closePanel();
  }
}
