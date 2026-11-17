import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarFooterTemplate, StarHeaderTemplate } from '@star-ng/ui/core';
import {
  compareDays,
  isoDay,
  sameDay,
  StarCalendar,
  StarDateRange,
  StarDateTemplate,
} from '@star-ng/ui/date-picker';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-calendar-page',
  imports: [DOCS, StarCalendar, StarDateTemplate, StarHeaderTemplate, StarFooterTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Calendar"
      lead="The month grid of the date picker, used on its own as an always visible calendar. It does not keep a value: it shows what you give it and emits the day that the user chooses. This is the PrimeNG p-datepicker with the inline option."
      importFrom="import { StarCalendar } from '@star-ng/ui/date-picker';"
    >
      <docs-example
        heading="Inline calendar"
        source="calendar/basic"
        [script]="basicScript"
        note="Pass the chosen day with selected and take the new one from dateSelect. The calendar does not change selected by itself."
      >
        <div class="docs-stack">
          <star-calendar
            class="star-calendar--inline"
            [selected]="shipDate()"
            (dateSelect)="shipDate.set($event)"
            locale="en-GB"
            [firstDayOfWeek]="1"
          />
          <p class="docs-output" role="status">Ship date: {{ iso(shipDate()) }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Range"
        source="calendar/range"
        [script]="rangeScript"
        note="mode='range' with a range value of { start, end }. The component draws the fill and the hover preview. Your handler decides what a click does: here the first click sets the start and the second click sets the end."
      >
        <div class="docs-stack">
          <star-calendar
            class="star-calendar--inline"
            mode="range"
            [range]="booking()"
            (dateSelect)="pick($event)"
            locale="en-GB"
            [firstDayOfWeek]="1"
          />
          <p class="docs-output" role="status">
            Booking: {{ iso(booking()?.start) }} to {{ iso(booking()?.end) }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Two months, week numbers and limits"
        source="calendar/months"
        [script]="monthsScript"
        note="numberOfMonths shows months side by side, showWeek adds ISO 8601 week numbers. minDate, maxDate, disabledDays, disabledDates and dateDisabled work as on the date picker."
      >
        <star-calendar
          class="star-calendar--inline"
          [selected]="stay()"
          (dateSelect)="stay.set($event)"
          [numberOfMonths]="2"
          showWeek
          [minDate]="minDate"
          [maxDate]="maxDate"
          [disabledDays]="[0]"
          locale="en-GB"
          [firstDayOfWeek]="1"
        />
      </docs-example>

      <docs-example
        heading="Month view"
        source="calendar/granularity"
        note="granularity='month' (or 'year') shows only the month view and emits the first day of the chosen month."
      >
        <div class="docs-stack">
          <star-calendar
            class="star-calendar--inline"
            granularity="month"
            [selected]="reportMonth()"
            (dateSelect)="reportMonth.set($event)"
            locale="en-GB"
          />
          <p class="docs-output" role="status">Month: {{ iso(reportMonth()) }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Slots"
        source="calendar/slots"
        [script]="slotsScript"
        note="Content child templates change parts of the calendar. starDate replaces the content of a day button and gets the date, today, selected, disabled and outside: here a dot marks the days when an invoice is due. The button keeps its accessible name, so a screen reader does not announce the dot: give the information in text too. starHeader adds content above the calendar and starFooter below the grid. Do not put buttons or links in starDate: the calendar owns the focus and the keys."
      >
        <div class="docs-stack">
          <star-calendar
            class="star-calendar--inline"
            [selected]="payDate()"
            (dateSelect)="payDate.set($event)"
            locale="en-GB"
            [firstDayOfWeek]="1"
          >
            <ng-template starHeader>
              <p class="docs-output docs-due-note">Invoices due in November 2026</p>
            </ng-template>
            <ng-template starDate let-date>
              <span class="docs-due" [class.docs-due--marked]="isDue(date)">{{
                date.getDate()
              }}</span>
            </ng-template>
            <ng-template starFooter>
              <p class="docs-output docs-due-note">
                A dot marks a due date: 5, 12 and 26 November.
              </p>
            </ng-template>
          </star-calendar>
          <p class="docs-output" role="status">Payment date: {{ iso(payDate()) }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The grid follows the page direction: the week starts on the right and Arrow left moves to
        the following day (Arrow right to the day before). In the month and year views Arrow left
        and Arrow right turn the same way. The previous and next month arrows turn around. See the
        Right-to-left guide.
      </p>

      <docs-api [of]="['StarCalendar']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Technical notes</h2>
      <p>
        The calendar is a WAI-ARIA date grid with one tab stop (roving tabindex). Disabled days use
        <code>aria-disabled</code> and stay in the grid, so the arrow keys can pass over them. The
        class <code>star-calendar--inline</code> adds a border, a radius and a surface for a
        calendar that sits on the page. The date picker popup does not use it.
      </p>
    </docs-page>
  `,
  styles: `
    .docs-due {
      position: relative;
    }
    .docs-due--marked::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      width: 0.3rem;
      height: 0.3rem;
      border-radius: 50%;
      background: currentColor;
      transform: translateX(-50%);
    }
    .docs-due-note {
      margin: var(--star-space-2) 0;
    }
  `,
})
export class CalendarPage {
  protected readonly iso = (date: Date | null | undefined): string =>
    date ? isoDay(date) : 'none';

  protected readonly shipDate = signal<Date | null>(new Date(2026, 10, 17));
  protected readonly booking = signal<StarDateRange | null>({
    start: new Date(2026, 10, 9),
    end: new Date(2026, 10, 13),
  });
  protected readonly stay = signal<Date | null>(new Date(2026, 10, 17));
  protected readonly reportMonth = signal<Date | null>(new Date(2026, 10, 1));
  protected readonly minDate = new Date(2026, 9, 12);
  protected readonly maxDate = new Date(2026, 11, 20);

  protected pick(date: Date): void {
    const range = this.booking();
    if (!range?.start || range.end) {
      this.booking.set({ start: date, end: null });
    } else if (compareDays(date, range.start) < 0) {
      this.booking.set({ start: date, end: range.start });
    } else {
      this.booking.set({ start: range.start, end: date });
    }
  }

  protected readonly basicScript = `readonly shipDate = signal<Date | null>(new Date(2026, 10, 17));
readonly iso = (date: Date | null) => (date ? isoDay(date) : 'none');`;
  protected readonly rangeScript = `readonly booking = signal<StarDateRange | null>({
  start: new Date(2026, 10, 9),
  end: new Date(2026, 10, 13),
});

pick(date: Date): void {
  const range = this.booking();
  if (!range?.start || range.end) {
    this.booking.set({ start: date, end: null });
  } else if (compareDays(date, range.start) < 0) {
    this.booking.set({ start: date, end: range.start });
  } else {
    this.booking.set({ start: range.start, end: date });
  }
}`;
  protected readonly monthsScript = `readonly stay = signal<Date | null>(new Date(2026, 10, 17));
readonly minDate = new Date(2026, 9, 12);
readonly maxDate = new Date(2026, 11, 20);`;

  protected readonly dueDates: readonly Date[] = [
    new Date(2026, 10, 5),
    new Date(2026, 10, 12),
    new Date(2026, 10, 26),
  ];
  protected readonly payDate = signal<Date | null>(new Date(2026, 10, 17));
  protected readonly isDue = (date: Date) => this.dueDates.some((due) => sameDay(due, date));
  protected readonly slotsScript = `// Import StarHeaderTemplate and StarFooterTemplate from '@star-ng/ui/core' and StarDateTemplate in the component imports.
readonly dueDates: readonly Date[] = [
  new Date(2026, 10, 5),
  new Date(2026, 10, 12),
  new Date(2026, 10, 26),
];
readonly payDate = signal<Date | null>(new Date(2026, 10, 17));
readonly isDue = (date: Date) => this.dueDates.some((due) => sameDay(due, date));
readonly iso = (date: Date | null) => (date ? isoDay(date) : 'none');

// Component styles: the dot below the day number.
// .docs-due { position: relative; }
// .docs-due--marked::after {
//   content: '';
//   position: absolute;
//   top: 100%;
//   left: 50%;
//   width: 0.3rem;
//   height: 0.3rem;
//   border-radius: 50%;
//   background: currentColor;
//   transform: translateX(-50%);
// }`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starDate]',
      description:
        'Content child. Replaces the content of a day button. The button keeps its accessible name (the full date), aria-current, aria-disabled and the keys. The context has $implicit (the date), today, selected, disabled and outside. Do not add focusable elements: the calendar owns the keys. With two or more months the template applies to every month.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content at the top of the calendar, above the month and year.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content at the bottom of the calendar, below the grid.',
    },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Chosen day and the marker of today.' },
    { name: '--star-primary-soft', description: 'Fill between the two ends of a range.' },
    { name: '--star-surface-muted', description: 'Hover background of a day.' },
    { name: '--star-focus-ring', description: 'Focus ring of a day.' },
    { name: '--star-text-muted', description: 'Days of other months.' },
    { name: '--star-text-soft', description: 'Disabled days.' },
    { name: '--star-border', description: 'Border of the inline calendar.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow left / Arrow right', description: 'Previous or next day.' },
    { name: 'Arrow up / Arrow down', description: 'Previous or next week.' },
    { name: 'Home / End', description: 'First or last day of the week.' },
    { name: 'Page up / Page down', description: 'Previous or next month.' },
    { name: 'Shift + Page up / Page down', description: 'Previous or next year.' },
    {
      name: 'Enter / Space',
      description: 'Chooses the focused day. A disabled day is not chosen.',
    },
    {
      name: 'Arrow keys',
      description: 'In the month and year views: move by one (left, right) or by a row (up, down).',
    },
  ];
}
