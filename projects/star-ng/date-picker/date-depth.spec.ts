import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCalendar } from './calendar';
import { starIsoText, starParseIso, starSplitDateTime, starTimeFormat } from './date-format';
import { StarDatePicker, StarDateRangePicker, StarMultiDatePicker } from './date-picker';
import { parseDate, StarDateRange } from './date-utils';
import { StarTimePicker } from './time-picker';

/** The time columns of one time in the open popup (`Time`, `Start time` or `End time`). */
function timeGroup(label: string): HTMLElement {
  return document.querySelector<HTMLElement>(`.star-date__time-field[aria-label="${label}"]`)!;
}
function cellOf(root: ParentNode, part: string, value: number): HTMLButtonElement {
  return root.querySelector<HTMLButtonElement>(`[data-part="${part}"] [data-value="${value}"]`)!;
}
function valuesOf(root: ParentNode, part: string): number[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-part="${part}"] [role="option"]`)].map(
    (cell) => Number(cell.dataset['value']),
  );
}
async function settle(fixture: { whenStable: () => Promise<unknown> }): Promise<void> {
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  await fixture.whenStable();
}

describe('date format helpers', () => {
  it('splits a typed date and time, with seconds and am / pm', () => {
    expect(starSplitDateTime('22/11/2026, 14:30:15')).toEqual({
      date: '22/11/2026',
      hours: 14,
      minutes: 30,
      seconds: 15,
    });
    expect(starSplitDateTime('22/11/2026 2:30:15 pm')?.hours).toBe(14);
    expect(starSplitDateTime('22/11/2026 12:05 am')?.hours).toBe(0);
    expect(starSplitDateTime('22/11/2026')).toBeNull();
    expect(starSplitDateTime('22/11/2026 14:30:75')).toBeUndefined();
    expect(starSplitDateTime('22/11/2026 13:30 pm')).toBeUndefined();
  });

  it('formats the time part with seconds in both clocks', () => {
    const date = new Date(2026, 10, 22, 14, 5, 9);
    const format = (hour: '12' | '24') =>
      new Intl.DateTimeFormat('en-GB', starTimeFormat(hour, true)).format(date);
    expect(format('24')).toBe('14:05:09');
    expect(format('12').toLowerCase().replace(/\s/g, ' ')).toBe('02:05:09 pm');
  });
});

@Component({
  imports: [StarTimePicker],
  template: `
    <star-time-picker
      ariaLabel="Run at"
      showSeconds
      min="08:00:30"
      max="18:00:00"
      [stepHour]="2"
      [stepMinute]="15"
      [stepSecond]="10"
      [hourFormat]="hourFormat()"
      [(value)]="runAt"
    />
  `,
})
class SecondsTimeHost {
  readonly runAt = signal<string | null>('10:15:20');
  readonly hourFormat = signal<'12' | '24'>('24');
}

describe('time picker: seconds and steps', () => {
  const panel = () => document.querySelector<HTMLElement>('.star-time__panel')!;
  afterEach(() => document.querySelectorAll('.star-time__panel').forEach((item) => item.remove()));

  async function setup(change?: (host: SecondsTimeHost) => void) {
    const fixture = TestBed.createComponent(SecondsTimeHost);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('input')!;
    el.querySelector<HTMLButtonElement>('.star-date__toggle')!.click();
    await settle(fixture);
    return { fixture, host: fixture.componentInstance, input };
  }

  it('shows a second column and follows the hour, minute and second steps', async () => {
    const { fixture, host, input } = await setup();
    expect(input.value).toBe('10:15:20');
    expect(input.step).toBe('10');
    const column = panel().querySelector('[data-part="second"]')!;
    expect(column.getAttribute('role')).toBe('listbox');
    expect(column.getAttribute('aria-label')).toBe('Second');
    expect(valuesOf(panel(), 'hour')).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
    expect(valuesOf(panel(), 'minute')).toEqual([0, 15, 30, 45]);
    expect(valuesOf(panel(), 'second')).toEqual([0, 10, 20, 30, 40, 50]);
    expect(cellOf(panel(), 'second', 20).getAttribute('aria-selected')).toBe('true');

    cellOf(panel(), 'second', 50).click();
    await fixture.whenStable();
    expect(host.runAt()).toBe('10:15:50');
    cellOf(panel(), 'hour', 14).click();
    await fixture.whenStable();
    expect(host.runAt()).toBe('14:15:50');
  });

  it('keeps the limits to the second: 08:00:00 to 08:00:20 are disabled', async () => {
    const { fixture, host } = await setup((h) => h.runAt.set('08:00:40'));
    const disabled = (part: string, value: number) =>
      cellOf(panel(), part, value).getAttribute('aria-disabled') === 'true';
    expect(disabled('hour', 6)).toBe(true);
    expect(disabled('hour', 8)).toBe(false);
    expect(disabled('second', 20)).toBe(true);
    expect(disabled('second', 30)).toBe(false);
    cellOf(panel(), 'second', 0).click();
    await fixture.whenStable();
    expect(host.runAt()).toBe('08:00:40');
  });

  it('works with the 12-hour clock: hour, minute, second and am / pm columns', async () => {
    const { fixture, host } = await setup((h) => h.hourFormat.set('12'));
    const parts = [...panel().querySelectorAll<HTMLElement>('.star-time__column')].map(
      (column) => column.dataset['part'],
    );
    expect(parts).toEqual(['hour', 'minute', 'second', 'period']);
    // The even hours of the morning in the 12-hour clock.
    expect(valuesOf(panel(), 'hour')).toEqual([12, 2, 4, 6, 8, 10]);
    cellOf(panel(), 'period', 1).click();
    await fixture.whenStable();
    expect(host.runAt()).toBe('18:00:00');
  });

  it('reads the seconds of the native field', async () => {
    const { fixture, host, input } = await setup();
    input.value = '09:30';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.runAt()).toBe('09:30:00');
    input.value = '09:30:40';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.runAt()).toBe('09:30:40');
  });
});

@Component({
  imports: [StarDatePicker, StarDateRangePicker],
  template: `
    <star-date-picker
      locale="en-GB"
      ariaLabel="Sent"
      showTime
      showSeconds
      [stepSecond]="15"
      [(value)]="sent"
    />
    <star-date-picker
      locale="en-GB"
      ariaLabel="Sent 12h"
      showTime
      showSeconds
      hourFormat="12"
      [(value)]="sent"
    />
    <star-date-range-picker
      locale="en-GB"
      ariaLabel="Window"
      showTime
      showSeconds
      [(value)]="window"
    />
  `,
})
class SecondsDateHost {
  readonly sent = signal<Date | null>(new Date(2026, 10, 22, 14, 30, 15));
  readonly window = signal<{ start: Date | null; end: Date | null } | null>(null);
}

describe('date picker: seconds', () => {
  afterEach(() => document.querySelectorAll('.star-date__panel').forEach((item) => item.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(SecondsDateHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const field = (label: string) =>
      el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    const type = async (label: string, text: string) => {
      const input = field(label);
      input.value = text;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, field, type };
  }

  it('formats and parses the seconds in both clocks', async () => {
    const { host, field, type } = await setup();
    expect(field('Sent').value).toBe('22/11/2026, 14:30:15');
    expect(field('Sent').placeholder).toBe('dd/mm/yyyy hh:mm:ss');
    expect(field('Sent 12h').value.toLowerCase()).toContain('02:30:15');
    expect(field('Sent 12h').placeholder).toBe('dd/mm/yyyy hh:mm:ss am');
    await type('Sent', '23/11/2026 08:05:45');
    expect(host.sent()).toEqual(new Date(2026, 10, 23, 8, 5, 45));
    await type('Sent 12h', '23/11/2026 8:05:30 pm');
    expect(host.sent()).toEqual(new Date(2026, 10, 23, 20, 5, 30));
  });

  it('has a second column with the step, and a range ends at 23:59:59', async () => {
    const { fixture, host, field, type } = await setup();
    field('Sent').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    await settle(fixture);
    expect(valuesOf(timeGroup('Time'), 'second')).toEqual([0, 15, 30, 45]);
    cellOf(timeGroup('Time'), 'second', 45).click();
    await fixture.whenStable();
    expect(host.sent()).toEqual(new Date(2026, 10, 22, 14, 30, 45));

    await type('Window', '02/11/2026 - 03/11/2026');
    expect(host.window()).toEqual({
      start: new Date(2026, 10, 2, 0, 0, 0),
      end: new Date(2026, 10, 3, 23, 59, 59),
    });
    expect(field('Window').value).toBe('02/11/2026, 00:00:00 – 03/11/2026, 23:59:59');
  });
});

describe('date utils: input format and month names', () => {
  it('reads the order of the input format and the month names of the locale', () => {
    const iso: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    expect(parseDate('22 November 2026', 'en-GB')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('Nov 22, 2026', 'en-US')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('Sunday, 22 November 2026', 'en-GB')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('22. November 2026', 'de-DE')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('22 de noviembre de 2026', 'es-ES')).toEqual(new Date(2026, 10, 22));
    // The order of the format, not of the locale: month first.
    const monthFirst: Intl.DateTimeFormatOptions = {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    };
    expect(parseDate('11/22/2026', 'en-US', monthFirst)).toEqual(new Date(2026, 10, 22));
    expect(parseDate('2026/11/22', 'sv-SE', iso)).toEqual(new Date(2026, 10, 22));
  });

  it('converts ISO text and dates for the string data type', () => {
    expect(starParseIso('2026-11-22')).toEqual(new Date(2026, 10, 22));
    expect(starParseIso('2026-11-22T14:30')).toEqual(new Date(2026, 10, 22, 14, 30));
    expect(starParseIso('2026-11-22T14:30:15')).toEqual(new Date(2026, 10, 22, 14, 30, 15));
    expect(starParseIso('2026-02-30')).toBeNull();
    expect(starParseIso('22/11/2026')).toBeNull();
    expect(starIsoText(new Date(2026, 10, 22, 9, 5, 7))).toBe('2026-11-22');
    expect(starIsoText(new Date(2026, 10, 22, 9, 5, 7), true)).toBe('2026-11-22T09:05');
    expect(starIsoText(new Date(2026, 10, 22, 9, 5, 7), true, true)).toBe('2026-11-22T09:05:07');
  });
});

@Component({
  imports: [StarDatePicker, StarDateRangePicker, StarMultiDatePicker],
  template: `
    <star-date-picker
      locale="en-GB"
      ariaLabel="Due"
      [displayFormat]="longFormat"
      [inputFormat]="numeric"
      [(value)]="due"
    />
    <star-date-picker locale="en-GB" ariaLabel="Kept" keepInvalid [(value)]="kept" />
    <star-date-picker locale="en-GB" ariaLabel="Iso" dataType="string" [(value)]="iso" />
    <star-date-picker
      locale="en-GB"
      ariaLabel="Iso time"
      dataType="string"
      showTime
      showSeconds
      [(value)]="isoTime"
    />
    <star-date-range-picker
      locale="en-GB"
      ariaLabel="Iso range"
      dataType="string"
      [(value)]="isoRange"
    />
    <star-multi-date-picker
      locale="en-GB"
      ariaLabel="Iso days"
      dataType="string"
      [(value)]="isoDays"
    />
  `,
})
class FormatHost {
  readonly longFormat: Intl.DateTimeFormatOptions = { dateStyle: 'long' };
  readonly numeric: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };
  readonly due = signal<Date | null>(new Date(2026, 10, 22));
  readonly kept = signal<Date | null>(new Date(2026, 10, 22));
  readonly iso = signal<string | null>('2026-11-22');
  readonly isoTime = signal<string | null>('2026-11-22T14:30:15');
  readonly isoRange = signal<StarDateRange<string> | null>({
    start: '2026-11-02',
    end: '2026-11-05',
  });
  readonly isoDays = signal<readonly string[]>(['2026-11-05']);
}

describe('date picker: formats, keepInvalid and the string data type', () => {
  afterEach(() => document.querySelectorAll('.star-date__panel').forEach((item) => item.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(FormatHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const field = (label: string) =>
      el.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
    const type = async (label: string, text: string) => {
      const input = field(label);
      input.dispatchEvent(new Event('focus'));
      await fixture.whenStable();
      input.value = text;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, field, type };
  }

  it('shows the display format, and the input format while the field has the focus', async () => {
    const { fixture, host, field, type } = await setup();
    expect(field('Due').value).toBe('22 November 2026');
    field('Due').dispatchEvent(new Event('focus'));
    await fixture.whenStable();
    expect(field('Due').value).toBe('22/11/2026');
    field('Due').dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(field('Due').value).toBe('22 November 2026');

    await type('Due', '3 December 2026');
    expect(host.due()).toEqual(new Date(2026, 11, 3));
    expect(field('Due').value).toBe('3 December 2026');
  });

  it('keeps invalid text with keepInvalid, marks the field invalid and empties the value', async () => {
    const { host, field, type } = await setup();
    await type('Kept', '31/02/2026');
    expect(field('Kept').value).toBe('31/02/2026');
    expect(field('Kept').getAttribute('aria-invalid')).toBe('true');
    expect(field('Kept').closest('star-date-picker')?.classList).toContain('star-date--invalid');
    expect(host.kept()).toBeNull();

    await type('Kept', '28/02/2026');
    expect(host.kept()).toEqual(new Date(2026, 1, 28));
    expect(field('Kept').getAttribute('aria-invalid')).toBeNull();
    expect(field('Kept').value).toBe('28/02/2026');
  });

  it('reverts invalid text without keepInvalid', async () => {
    const { host, field, type } = await setup();
    await type('Iso', 'not a date');
    expect(field('Iso').value).toBe('22/11/2026');
    expect(field('Iso').getAttribute('aria-invalid')).toBeNull();
    expect(host.iso()).toBe('2026-11-22');
  });

  it('round-trips ISO text with dataType string', async () => {
    const { fixture, host, field, type } = await setup();
    expect(field('Iso').value).toBe('22/11/2026');
    await type('Iso', '01/12/2026');
    expect(host.iso()).toBe('2026-12-01');

    expect(field('Iso time').value).toBe('22/11/2026, 14:30:15');
    await type('Iso time', '23/11/2026 08:00:05');
    expect(host.isoTime()).toBe('2026-11-23T08:00:05');

    expect(field('Iso range').value).toBe('02/11/2026 – 05/11/2026');
    await type('Iso range', '10/11/2026 - 03/11/2026');
    expect(host.isoRange()).toEqual({ start: '2026-11-03', end: '2026-11-10' });

    expect(field('Iso days').value).toBe('05/11/2026');
    field('Iso days').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('[data-date="2026-11-12"]')!.click();
    await fixture.whenStable();
    expect(host.isoDays()).toEqual(['2026-11-05', '2026-11-12']);
    const chosen = document.querySelector('[data-date="2026-11-05"]')?.closest('td');
    expect(chosen?.getAttribute('aria-selected')).toBe('true');
  });
});

@Component({
  imports: [StarCalendar, StarDatePicker],
  template: `
    <star-calendar
      locale="en-GB"
      [firstDayOfWeek]="1"
      [selected]="hidden()"
      [showOtherMonths]="false"
      (dateSelect)="hidden.set($event)"
    />
    <star-calendar
      locale="en-GB"
      [firstDayOfWeek]="1"
      [selected]="locked()"
      [selectOtherMonths]="false"
      (dateSelect)="locked.set($event)"
    />
    <star-date-picker
      locale="en-GB"
      ariaLabel="Other months"
      [firstDayOfWeek]="1"
      [showOtherMonths]="false"
      [(value)]="picked"
    />
  `,
})
class OtherMonthsHost {
  readonly hidden = signal<Date | null>(new Date(2026, 10, 18));
  readonly locked = signal<Date | null>(new Date(2026, 10, 18));
  readonly picked = signal<Date | null>(new Date(2026, 10, 18));
}

describe('calendar: days of other months', () => {
  afterEach(() => document.querySelectorAll('.star-date__panel').forEach((item) => item.remove()));

  it('hides them with showOtherMonths off, and disables them with selectOtherMonths off', async () => {
    const fixture = TestBed.createComponent(OtherMonthsHost);
    await fixture.whenStable();
    const [hidden, locked] = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('star-calendar'),
    ];
    // November 2026 starts on a Sunday: Monday 26 October is the first cell.
    expect(hidden.querySelector('[data-date="2026-10-26"]')).toBeNull();
    expect(hidden.querySelector('[data-date="2026-11-01"]')).not.toBeNull();
    expect(hidden.querySelectorAll('tbody tr')[0].querySelectorAll('td').length).toBe(7);

    const outside = locked.querySelector<HTMLButtonElement>('[data-date="2026-10-26"]')!;
    expect(outside.classList).toContain('star-calendar__day--outside');
    expect(outside.getAttribute('aria-disabled')).toBe('true');
    outside.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.locked()).toEqual(new Date(2026, 10, 18));
    const inside = locked.querySelector<HTMLButtonElement>('[data-date="2026-11-02"]')!;
    expect(inside.getAttribute('aria-disabled')).toBeNull();
    inside.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.locked()).toEqual(new Date(2026, 10, 2));
  });

  it('passes showOtherMonths from the date picker to its calendar', async () => {
    const fixture = TestBed.createComponent(OtherMonthsHost);
    await fixture.whenStable();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      'input[aria-label="Other months"]',
    )!;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }));
    await fixture.whenStable();
    const panel = document.querySelector('.star-date__panel')!;
    expect(panel.querySelector('[data-date="2026-10-26"]')).toBeNull();
    expect(panel.querySelector('[data-date="2026-11-30"]')).not.toBeNull();
  });
});
