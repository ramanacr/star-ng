import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarCalendar } from './calendar';
import { StarDatePicker, StarDateRangePicker, StarMultiDatePicker } from './date-picker';
import {
  addMonths,
  formatHint,
  localeFirstDay,
  monthGrid,
  parseDate,
  StarDateRange,
} from './date-utils';

/**
 * `aria-expanded` of the popup: the text field is a textbox, which cannot be expanded, so the
 * state is on the calendar button next to it.
 */
function expanded(input: HTMLInputElement): string | null {
  return input
    .closest('.star-date__control')!
    .querySelector('.star-date__toggle')!
    .getAttribute('aria-expanded');
}

describe('date utils', () => {
  it('parses the locale order, ISO and two-digit years; rejects impossible dates', () => {
    expect(parseDate('22/11/2026', 'en-GB')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('11/22/2026', 'en-US')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('22.11.26', 'de-DE')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('2026-11-22', 'en-US')).toEqual(new Date(2026, 10, 22));
    expect(parseDate('31/02/2026', 'en-GB')).toBeNull();
    expect(parseDate('hello', 'en-GB')).toBeNull();
  });

  it('builds a 6-week grid starting on the requested weekday', () => {
    const grid = monthGrid(new Date(2026, 10, 15), 1);
    expect(grid.length).toBe(6);
    expect(grid[0][0]).toEqual(new Date(2026, 9, 26)); // Monday before 1 Nov 2026
    expect(grid.flat().every((d, i, all) => i === 0 || d > all[i - 1])).toBe(true);
  });

  it('clamps month arithmetic and reads locale hints', () => {
    expect(addMonths(new Date(2026, 0, 31), 1)).toEqual(new Date(2026, 1, 28));
    expect(formatHint('en-GB')).toBe('dd/mm/yyyy');
    expect(formatHint('en-US')).toBe('mm/dd/yyyy');
    expect([0, 1]).toContain(localeFirstDay('en-US'));
  });
});

@Component({
  imports: [StarCalendar],
  template: `<star-calendar
    locale="en-GB"
    [firstDayOfWeek]="1"
    [selected]="date()"
    [disabledDays]="[0]"
    (dateSelect)="date.set($event)"
  />`,
})
class CalendarHost {
  readonly date = signal<Date | null>(new Date(2026, 10, 18));
}

@Component({
  imports: [StarDatePicker, StarDateRangePicker],
  template: `
    <star-date-picker
      locale="en-GB"
      [(value)]="date"
      ariaLabel="Date"
      [maxDate]="max"
      showButtonBar
    />
    <star-date-range-picker locale="en-GB" [(value)]="range" ariaLabel="Range" />
  `,
})
class PickerHost {
  readonly date = signal<Date | null>(null);
  readonly range = signal<StarDateRange | null>(null);
  readonly max = new Date(2026, 11, 31);
}

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

describe('StarCalendar', () => {
  it('moves focus with the keyboard and selects with Enter', async () => {
    const fixture = TestBed.createComponent(CalendarHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const grid = el.querySelector('[role=grid]')!;
    const focusable = () =>
      el.querySelector<HTMLButtonElement>('.star-calendar__day[tabindex="0"]')!;
    expect(focusable().dataset['date']).toBe('2026-11-18');
    expect(el.querySelector('th')?.textContent?.trim()).toMatch(/^Mon/);

    key(grid, 'ArrowDown');
    await fixture.whenStable();
    expect(focusable().dataset['date']).toBe('2026-11-25');
    key(grid, 'PageDown');
    await fixture.whenStable();
    expect(focusable().dataset['date']).toBe('2026-12-25');
    expect(el.querySelector('.star-calendar__title')?.textContent).toContain('December');
    key(grid, 'Enter');
    await fixture.whenStable();
    expect(fixture.componentInstance.date()).toEqual(new Date(2026, 11, 25));
  });

  it('marks disabled days and ignores clicks on them', async () => {
    const fixture = TestBed.createComponent(CalendarHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const sunday = el.querySelector<HTMLButtonElement>('[data-date="2026-11-22"]')!;
    expect(sunday.getAttribute('aria-disabled')).toBe('true');
    sunday.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.date()).toEqual(new Date(2026, 10, 18));
  });

  it('switches to month view and back', async () => {
    const fixture = TestBed.createComponent(CalendarHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.star-calendar__title-btn')!.click();
    await fixture.whenStable();
    const months = el.querySelectorAll<HTMLButtonElement>('.star-calendar__pick');
    expect(months.length).toBe(12);
    months[2].click();
    await fixture.whenStable();
    expect(el.querySelector('.star-calendar__title')?.textContent).toContain('March');
  });
});

@Component({
  imports: [StarDatePicker],
  template: `<star-date-picker locale="en-GB" showTime [stepMinute]="15" [(value)]="date" />`,
})
class TimeHost {
  readonly date = signal<Date | null>(null);
}

describe('StarDatePicker', () => {
  async function setup() {
    const fixture = TestBed.createComponent(PickerHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const inputs = el.querySelectorAll<HTMLInputElement>('input');
    return { fixture, host: fixture.componentInstance, single: inputs[0], range: inputs[1] };
  }

  function type(input: HTMLInputElement, text: string): void {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('shows the locale hint and accepts typed dates', async () => {
    const { fixture, host, single } = await setup();
    expect(single.placeholder).toBe('dd/mm/yyyy');
    type(single, '5/3/2026');
    await fixture.whenStable();
    expect(host.date()).toEqual(new Date(2026, 2, 5));
    expect(single.value).toBe('05/03/2026');
  });

  it('reverts invalid or out-of-range text', async () => {
    const { fixture, host, single } = await setup();
    host.date.set(new Date(2026, 0, 10));
    await fixture.whenStable();
    type(single, '40/40/2026');
    await fixture.whenStable();
    expect(single.value).toBe('10/01/2026');
    type(single, '01/01/2027');
    await fixture.whenStable();
    expect(host.date()).toEqual(new Date(2026, 0, 10));
    type(single, '');
    await fixture.whenStable();
    expect(host.date()).toBeNull();
  });

  it('opens the calendar with Alt+ArrowDown and picks a day', async () => {
    const { fixture, host, single } = await setup();
    host.date.set(new Date(2026, 5, 15));
    await fixture.whenStable();
    key(single, 'ArrowDown', { altKey: true });
    await fixture.whenStable();
    expect(expanded(single)).toBe('true');
    document.querySelector<HTMLButtonElement>('[data-date="2026-06-20"]')!.click();
    await fixture.whenStable();
    expect(host.date()).toEqual(new Date(2026, 5, 20));
    expect(expanded(single)).toBe('false');
  });

  it('showTime: types, shows and edits a time of day and keeps the popup open', async () => {
    const fixture = TestBed.createComponent(TimeHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const input = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(input.placeholder).toBe('dd/mm/yyyy hh:mm');

    type(input, '22/11/2026 14:30');
    await fixture.whenStable();
    expect(host.date()).toEqual(new Date(2026, 10, 22, 14, 30));
    expect(input.value).toBe('22/11/2026, 14:30');

    type(input, '23/11/2026');
    await fixture.whenStable();
    expect(host.date()).toEqual(new Date(2026, 10, 23, 14, 30));
    type(input, '23/11/2026 25:00');
    await fixture.whenStable();
    expect(input.value).toBe('23/11/2026, 14:30');

    key(input, 'ArrowDown', { altKey: true });
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('[data-date="2026-11-27"]')!.click();
    await fixture.whenStable();
    expect(host.date()).toEqual(new Date(2026, 10, 27, 14, 30));
    expect(expanded(input)).toBe('true');

    const time = document.querySelector<HTMLInputElement>('.star-date__time input')!;
    expect(time.value).toBe('14:30');
    expect(time.step).toBe('900');
    time.value = '09:15';
    time.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.date()).toEqual(new Date(2026, 10, 27, 9, 15));

    document.querySelector<HTMLButtonElement>('.star-date__time button')!.click();
    await fixture.whenStable();
    expect(expanded(input)).toBe('false');
  });

  it('range picker takes start then end, swapping when needed, and parses typed ranges', async () => {
    const { fixture, host, range } = await setup();
    host.range.set({ start: new Date(2026, 3, 10), end: new Date(2026, 3, 12) });
    await fixture.whenStable();
    expect(range.value).toBe('10/04/2026 – 12/04/2026');
    key(range, 'ArrowDown');
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('[data-date="2026-04-20"]')!.click();
    await fixture.whenStable();
    expect(host.range()).toEqual({ start: new Date(2026, 3, 20), end: null });
    document.querySelector<HTMLButtonElement>('[data-date="2026-04-14"]')!.click();
    await fixture.whenStable();
    expect(host.range()).toEqual({ start: new Date(2026, 3, 14), end: new Date(2026, 3, 20) });

    type(range, '01/05/2026 - 03/05/2026');
    await fixture.whenStable();
    expect(host.range()).toEqual({ start: new Date(2026, 4, 1), end: new Date(2026, 4, 3) });
  });
});

@Component({
  imports: [StarDatePicker, StarDateRangePicker, StarMultiDatePicker],
  template: `
    <star-date-picker
      locale="en-GB"
      showTime
      ariaLabel="Limited"
      [minDate]="min"
      [maxDate]="max"
      [(value)]="limited"
    />
    <star-date-picker locale="en-GB" view="month" ariaLabel="Month" [(value)]="month" />
    <star-date-picker locale="en-GB" view="year" ariaLabel="Year" [(value)]="year" />
    <star-date-range-picker locale="en-GB" showTime ariaLabel="Shift" [(value)]="shift" />
    <star-multi-date-picker locale="en-GB" ariaLabel="Days" [maxDates]="3" [(value)]="days" />
  `,
})
class GapsHost {
  readonly min = new Date(2026, 10, 10, 9, 0);
  readonly max = new Date(2026, 10, 20, 17, 0);
  readonly limited = signal<Date | null>(null);
  readonly month = signal<Date | null>(null);
  readonly year = signal<Date | null>(null);
  readonly shift = signal<StarDateRange | null>(null);
  readonly days = signal<readonly Date[]>([]);
}

describe('date picker: time limits, month and year, range with time, multiple dates', () => {
  async function setup() {
    const fixture = TestBed.createComponent(GapsHost);
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
    const open = async (label: string) => {
      key(field(label), 'ArrowDown', { altKey: true });
      await fixture.whenStable();
    };
    return { fixture, host: fixture.componentInstance, field, type, open };
  }

  it('limits the time with minDate and maxDate when showTime is on', async () => {
    const { fixture, host, field, type, open } = await setup();
    await type('Limited', '10/11/2026 08:00');
    expect(host.limited()).toBeNull();
    await type('Limited', '10/11/2026 09:30');
    expect(host.limited()).toEqual(new Date(2026, 10, 10, 9, 30));

    await open('Limited');
    const time = document.querySelector<HTMLInputElement>('.star-date__time input')!;
    time.value = '07:00';
    time.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.limited()).toEqual(new Date(2026, 10, 10, 9, 0));
    expect(field('Limited').value).toBe('10/11/2026, 09:00');
  });

  it('chooses a month or a year: typed text and the popup', async () => {
    const { fixture, host, field, type, open } = await setup();
    expect(field('Month').placeholder).toBe('mm/yyyy');
    await type('Month', '03/2027');
    expect(host.month()).toEqual(new Date(2027, 2, 1));
    await type('Month', '13/2027');
    expect(field('Month').value).toBe('03/2027');

    await open('Month');
    expect(document.querySelector('.star-calendar__grid')).toBeNull();
    document.querySelector<HTMLButtonElement>('.star-calendar__pick[data-pick="7"]')!.click();
    await fixture.whenStable();
    expect(host.month()).toEqual(new Date(2027, 7, 1));
    expect(expanded(field('Month'))).toBe('false');

    await type('Year', '2031');
    expect(host.year()).toEqual(new Date(2031, 0, 1));
    await open('Year');
    document.querySelector<HTMLButtonElement>('.star-calendar__pick[data-pick="2030"]')!.click();
    await fixture.whenStable();
    expect(field('Year').value).toBe('2030');
  });

  it('gives a range a start and an end time and keeps the popup open', async () => {
    const { fixture, host, field, type, open } = await setup();
    await type('Shift', '02/11/2026 08:00 - 03/11/2026 16:30');
    expect(host.shift()).toEqual({
      start: new Date(2026, 10, 2, 8, 0),
      end: new Date(2026, 10, 3, 16, 30),
    });

    await open('Shift');
    document.querySelector<HTMLButtonElement>('[data-date="2026-11-09"]')!.click();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('[data-date="2026-11-05"]')!.click();
    await fixture.whenStable();
    expect(host.shift()).toEqual({
      start: new Date(2026, 10, 5, 0, 0),
      end: new Date(2026, 10, 9, 23, 59),
    });
    expect(expanded(field('Shift'))).toBe('true');

    const times = [...document.querySelectorAll<HTMLInputElement>('.star-date__time input')];
    expect(times.map((time) => time.value)).toEqual(['00:00', '23:59']);
    times[1].value = '18:00';
    times[1].dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.shift()?.end).toEqual(new Date(2026, 10, 9, 18, 0));
    expect(field('Shift').value).toBe('05/11/2026, 00:00 – 09/11/2026, 18:00');
  });

  it('adds and removes days in the multiple-date picker, up to the limit', async () => {
    const { fixture, host, field, type, open } = await setup();
    await type('Days', '20/11/2026, 05/11/2026; 20/11/2026');
    expect(host.days()).toEqual([new Date(2026, 10, 5), new Date(2026, 10, 20)]);
    expect(field('Days').value).toBe('05/11/2026, 20/11/2026');

    await open('Days');
    const day = (iso: string) => document.querySelector<HTMLButtonElement>(`[data-date="${iso}"]`)!;
    day('2026-11-12').click();
    await fixture.whenStable();
    day('2026-11-13').click();
    await fixture.whenStable();
    expect(host.days().length).toBe(3);
    expect(day('2026-11-12').closest('td')?.getAttribute('aria-selected')).toBe('true');
    expect(expanded(field('Days'))).toBe('true');

    day('2026-11-05').click();
    await fixture.whenStable();
    expect(host.days()).toEqual([new Date(2026, 10, 12), new Date(2026, 10, 20)]);
  });
});
