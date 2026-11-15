import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import {
  isoDay,
  StarDatePicker,
  StarDateRange,
  StarDateRangePicker,
  StarMultiDatePicker,
} from 'star-ng/date-picker';
import { StarField } from 'star-ng/field';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-date-picker-page',
  imports: [
    DOCS,
    RouterLink,
    StarDatePicker,
    StarDateRangePicker,
    StarMultiDatePicker,
    StarField,
    FormField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Date picker"
      lead="An input with a calendar popup. The user types a date or picks it in the calendar. There are three components: one date (star-date-picker), a range (star-date-range-picker) and several single days (star-multi-date-picker). Typed text follows the order of day, month and year of the locale."
      importFrom="import { StarDatePicker, StarDateRangePicker, StarMultiDatePicker } from 'star-ng/date-picker';"
    >
      <docs-example
        heading="Single date"
        source="date-picker/basic"
        [script]="basicScript"
        note="The value is a Date at local midnight, or null. firstDayOfWeek='1' starts the week on Monday. showButtonBar adds the Today and Clear buttons. Arrow down on the field, or the calendar button, opens the popup."
      >
        <div class="docs-stack">
          <star-date-picker
            [(value)]="delivery"
            locale="en-GB"
            [firstDayOfWeek]="1"
            ariaLabel="Delivery date"
            showButtonBar
          />
          <p class="docs-output" role="status">Delivery: {{ iso(delivery()) }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Date range"
        source="date-picker/range"
        [script]="rangeScript"
        note="The value is { start, end }. The first click sets the start, the second click sets the end. If the second click is on an earlier day, the two days swap. The popup closes after the second click."
      >
        <div class="docs-stack">
          <star-date-range-picker [(value)]="booking" locale="en-GB" ariaLabel="Booking range" />
          <p class="docs-output" role="status">
            Booking: {{ iso(booking()?.start) }} to {{ iso(booking()?.end) }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Several days"
        source="date-picker/multiple"
        [script]="multipleScript"
        note="A click adds a day or removes it, and the popup stays open. The value is a list in date order. maxDates limits the number of days (0 means no limit)."
      >
        <div class="docs-stack">
          <star-multi-date-picker
            [(value)]="visits"
            [maxDates]="4"
            locale="en-GB"
            ariaLabel="Visit days"
            showClear
          />
          <p class="docs-output" role="status">Days: {{ visits().length }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Minimum, maximum and disabled dates"
        source="date-picker/limits"
        [script]="limitsScript"
        note="minDate and maxDate limit the choice. disabledDays takes weekday numbers (0 is Sunday). disabledDates takes single days. dateDisabled takes a function for any other rule. Disabled days cannot be chosen with the mouse, the keyboard or typed text."
      >
        <div class="docs-stack">
          <star-date-picker
            [(value)]="slot"
            [minDate]="minDate"
            [maxDate]="maxDate"
            [disabledDays]="weekend"
            [disabledDates]="closedDays"
            [dateDisabled]="isMonthStart"
            locale="en-GB"
            ariaLabel="Pick-up date"
          />
          <p class="docs-output" role="status">Pick-up: {{ iso(slot()) }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Locale and first day of the week"
        source="date-picker/locale"
        note="locale sets the month and weekday names and the order of the typed date. The first day of the week follows the locale. firstDayOfWeek overrides it (0 is Sunday). showWeek adds ISO 8601 week numbers, numberOfMonths shows more months side by side."
      >
        <div class="docs-stack">
          <star-date-picker
            [value]="germanDate"
            locale="de-DE"
            [firstDayOfWeek]="1"
            showWeek
            ariaLabel="Lieferdatum"
          />
          <star-date-picker
            [value]="americanDate"
            locale="en-US"
            [firstDayOfWeek]="0"
            [numberOfMonths]="2"
            ariaLabel="Delivery date (US)"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Typed input and format"
        source="date-picker/format"
        [script]="formatScript"
        note="The user can type the date in the order of the locale (20/11/2026 for en-GB) or as ISO text (2026-11-20). A valid and allowed date sets the value when the user presses Enter or leaves the field. Other text goes back to the last value. dateFormat takes Intl.DateTimeFormat options for the shown text. readonlyInput turns off typing."
      >
        <div class="docs-stack">
          <star-date-picker
            [(value)]="invoiceDate"
            locale="en-GB"
            [dateFormat]="longFormat"
            ariaLabel="Invoice date"
            placeholder="dd/mm/yyyy"
          />
          <star-date-picker
            [value]="invoiceDate()"
            locale="en-GB"
            readonlyInput
            ariaLabel="Invoice date, pick only"
          />
          <p class="docs-output" role="status">Invoice: {{ iso(invoiceDate()) }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Date and time"
        source="date-picker/time"
        [script]="timeScript"
        note="showTime adds a time field to the popup. The value keeps hours and minutes, and the popup stays open until the user chooses Done. stepMinute sets the minute step. hourFormat='12' shows 2:30 pm in the text. The range picker has showTime too (start 00:00, end 23:59 by default). With showTime, minDate and maxDate also limit the time."
      >
        <div class="docs-stack">
          <star-date-picker
            [(value)]="meeting"
            locale="en-GB"
            showTime
            [stepMinute]="15"
            ariaLabel="Meeting start"
          />
          <p class="docs-output" role="status">
            Meeting: {{ iso(meeting()) }} {{ clock(meeting()) }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Month and year views"
        source="date-picker/views"
        note="view='month' or view='year' chooses a month or a year. The value is the first day of it, and the text is mm/yyyy or yyyy. In the day view, a click on the month name or the year in the popup header opens the month or the year view for a fast jump."
      >
        <div class="docs-stack">
          <star-date-picker
            [(value)]="reportMonth"
            view="month"
            locale="en-GB"
            ariaLabel="Report month"
          />
          <star-date-picker
            [(value)]="reportYear"
            view="year"
            locale="en-GB"
            ariaLabel="Report year"
          />
          <p class="docs-output" role="status">
            Month: {{ iso(reportMonth()) }}, year: {{ iso(reportYear()) }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Sizes and states"
        source="date-picker/states"
        note="size='sm' makes the control smaller. A disabled picker takes no focus. A read-only picker keeps its value and does not open. showClear adds a clear button while there is a value."
      >
        <div class="docs-stack">
          <star-date-picker size="sm" locale="en-GB" ariaLabel="Small date picker" />
          <star-date-picker disabled locale="en-GB" ariaLabel="Disabled date picker" />
          <star-date-picker
            [value]="delivery()"
            readonly
            locale="en-GB"
            ariaLabel="Read-only date picker"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="date-picker/form"
        [script]="formScript"
        note="All three pickers are Signal Forms controls: bind them with formField. Pass the field state to star-field and the error shows after the user leaves the control."
      >
        <div class="docs-stack">
          <star-field label="Delivery date" for="date-form-delivery" [state]="order.deliveryDate()">
            <star-date-picker
              inputId="date-form-delivery"
              [formField]="order.deliveryDate"
              locale="en-GB"
              [minDate]="minDate"
              ariaLabel="Required delivery date"
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ order().valid() }}</p>
        </div>
      </docs-example>

      <h2>Inline mode</h2>
      <p>
        The picker always opens a popup. For a calendar that is always visible on the page, use
        <a routerLink="/controls/calendar"><code>star-calendar</code></a> alone. It is the PrimeNG
        <code>p-datepicker [inline]</code> equivalent. The time of day alone is in
        <a routerLink="/controls/time-picker"><code>star-time-picker</code></a
        >.
      </p>

      <h2>Right-to-left</h2>
      <p>
        The calendar follows the page direction: Arrow left moves to the following day in a
        right-to-left page, and the previous and next month arrows turn around. The popup opens
        aligned with the start edge of the field (the right edge in a right-to-left page). See the
        Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarDatePicker', 'StarDateRangePicker', 'StarMultiDatePicker', 'StarDateInputBase']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Date helpers</h2>
      <p>
        <code>star-ng/date-picker</code> also exports the helper functions that the calendar uses.
        All of them work with local calendar days (time 00:00) and have no dependency on a date
        library.
      </p>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Exports of date-utils
          </caption>
          <thead>
            <tr>
              <th scope="col">Export</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (helper of helpers; track helper.name) {
              <tr>
                <th scope="row">
                  <code>{{ helper.name }}</code>
                </th>
                <td>{{ helper.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Technical notes</h2>
      <p>
        The popup is a native popover placed by the Angular CDK overlay, so it also works inside a
        modal dialog. The date picker is the PrimeNG <code>p-datepicker</code> equivalent. The
        calendar in the popup is a WAI-ARIA date grid. Dates are local calendar days: the value has
        no time zone, so a date does not move to another day when the user travels.
      </p>
    </docs-page>
  `,
})
export class DatePickerPage {
  protected readonly iso = (date: Date | null | undefined): string =>
    date ? isoDay(date) : 'none';
  protected readonly clock = (date: Date | null): string =>
    date
      ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
      : '';

  protected readonly delivery = signal<Date | null>(new Date(2026, 10, 17));
  protected readonly booking = signal<StarDateRange | null>({
    start: new Date(2026, 10, 9),
    end: new Date(2026, 10, 13),
  });
  protected readonly visits = signal<readonly Date[]>([
    new Date(2026, 10, 10),
    new Date(2026, 10, 12),
  ]);

  protected readonly slot = signal<Date | null>(new Date(2026, 10, 18));
  protected readonly minDate = new Date(2026, 10, 3);
  protected readonly maxDate = new Date(2026, 10, 27);
  protected readonly weekend: readonly number[] = [0, 6];
  protected readonly closedDays: readonly Date[] = [new Date(2026, 10, 11)];
  protected readonly isMonthStart = (date: Date): boolean => date.getDate() === 1;

  protected readonly germanDate = new Date(2026, 10, 17);
  protected readonly americanDate = new Date(2026, 10, 17);

  protected readonly invoiceDate = signal<Date | null>(new Date(2026, 10, 17));
  protected readonly longFormat: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  protected readonly meeting = signal<Date | null>(new Date(2026, 10, 17, 9, 30));
  protected readonly reportMonth = signal<Date | null>(new Date(2026, 10, 1));
  protected readonly reportYear = signal<Date | null>(new Date(2026, 0, 1));

  protected readonly orderModel = signal<{ deliveryDate: Date | null }>({ deliveryDate: null });
  protected readonly order = form(this.orderModel, (path) => {
    required(path.deliveryDate, { message: 'Choose a delivery date.' });
  });

  protected readonly basicScript = `readonly delivery = signal<Date | null>(new Date(2026, 10, 17));
// isoDay comes from 'star-ng/date-picker'.
readonly iso = (date: Date | null) => (date ? isoDay(date) : 'none');`;
  protected readonly rangeScript = `readonly booking = signal<StarDateRange | null>({
  start: new Date(2026, 10, 9),
  end: new Date(2026, 10, 13),
});`;
  protected readonly multipleScript = `readonly visits = signal<readonly Date[]>([
  new Date(2026, 10, 10),
  new Date(2026, 10, 12),
]);`;
  protected readonly limitsScript = `readonly slot = signal<Date | null>(new Date(2026, 10, 18));
readonly minDate = new Date(2026, 10, 3);
readonly maxDate = new Date(2026, 10, 27);
readonly weekend: readonly number[] = [0, 6];
readonly closedDays: readonly Date[] = [new Date(2026, 10, 11)];
// Any other rule: here the first day of a month is not available.
readonly isMonthStart = (date: Date) => date.getDate() === 1;`;
  protected readonly formatScript = `readonly invoiceDate = signal<Date | null>(new Date(2026, 10, 17));
readonly longFormat: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};`;
  protected readonly timeScript = `readonly meeting = signal<Date | null>(new Date(2026, 10, 17, 9, 30));`;
  protected readonly formScript = `readonly orderModel = signal<{ deliveryDate: Date | null }>({ deliveryDate: null });
readonly order = form(this.orderModel, (path) => {
  required(path.deliveryDate, { message: 'Choose a delivery date.' });
});`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-border', description: 'Border of the field and the popup.' },
    { name: '--star-surface-muted', description: 'Background of the field at rest.' },
    { name: '--star-accent', description: 'Border of the focused field.' },
    { name: '--star-focus-ring', description: 'Focus ring (box-shadow).' },
    { name: '--star-danger', description: 'Border of an invalid field.' },
    { name: '--star-primary', description: 'Today marker and chosen day.' },
    { name: '--star-primary-soft', description: 'Fill between the two ends of a range.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow down / Alt + Arrow down', description: 'In the field: opens the popup.' },
    { name: 'Enter', description: 'In the field: applies the typed text.' },
    { name: 'Escape', description: 'Closes the popup. The focus goes back to the field.' },
    { name: 'Arrow left / Arrow right', description: 'In the calendar: previous or next day.' },
    { name: 'Arrow up / Arrow down', description: 'In the calendar: previous or next week.' },
    { name: 'Home / End', description: 'In the calendar: first or last day of the week.' },
    { name: 'Page up / Page down', description: 'In the calendar: previous or next month.' },
    {
      name: 'Shift + Page up / Page down',
      description: 'In the calendar: previous or next year.',
    },
    {
      name: 'Enter / Space',
      description: 'In the calendar: chooses the focused day. A disabled day is not chosen.',
    },
    {
      name: 'Arrow keys',
      description: 'In the month and year views: move by one (left, right) or by a row (up, down).',
    },
  ];

  protected readonly helpers: readonly DocsRow[] = [
    { name: 'StarDateRange', description: 'Interface { start: Date | null; end: Date | null }.' },
    { name: 'startOfDay(date)', description: 'The same calendar day at local midnight.' },
    {
      name: 'addDays(date, days)',
      description: 'The day that is a number of days later or earlier.',
    },
    {
      name: 'addMonths(date, months)',
      description:
        'Adds months and keeps the day inside the month (31 January + 1 month = 28 February).',
    },
    {
      name: 'sameDay(a, b)',
      description: 'True when both are the same calendar day. False if one is empty.',
    },
    {
      name: 'sameMonth(a, b)',
      description: 'True when both are in the same month of the same year.',
    },
    {
      name: 'compareDays(a, b)',
      description: 'Negative when a is an earlier day than b, 0 on the same day, positive after.',
    },
    {
      name: 'isoDay(date)',
      description: 'Text yyyy-mm-dd of a local day, for keys and for tests.',
    },
    {
      name: 'localeFirstDay(locale?)',
      description: 'First day of the week for a locale (0 is Sunday). It falls back to Monday.',
    },
    {
      name: 'monthGrid(month, firstDay)',
      description: 'Six weeks of seven days that cover the month, starting on firstDay.',
    },
    {
      name: 'DEFAULT_DATE_FORMAT',
      description: 'Intl options for the numeric day, month and year.',
    },
    {
      name: 'formatDate(date, locale, options)',
      description: 'Formats a date with Intl.DateTimeFormat. An empty date gives an empty text.',
    },
    {
      name: 'formatHint(locale)',
      description: 'Placeholder text such as dd/mm/yyyy or mm/dd/yyyy for the locale.',
    },
    {
      name: 'parseDate(text, locale)',
      description:
        'Reads typed text: ISO yyyy-mm-dd, or the numeric order of the locale with any separator. Returns null when the text is not a real date.',
    },
    {
      name: 'isoWeek(date)',
      description: 'ISO 8601 week number of a date (exported from the calendar).',
    },
  ];
}
