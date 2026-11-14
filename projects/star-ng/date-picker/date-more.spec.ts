import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { isoWeek, StarCalendar } from './calendar';
import { StarDatePicker } from './date-picker';
import { StarTimePicker } from './time-picker';

@Component({
  imports: [StarCalendar, StarDatePicker, StarTimePicker],
  template: `
    <star-calendar
      locale="en-GB"
      [selected]="day()"
      [numberOfMonths]="2"
      showWeek
      (dateSelect)="day.set($event)"
    />
    <star-date-picker locale="en-GB" showTime hourFormat="12" ariaLabel="Call" [(value)]="call" />
    <star-time-picker
      ariaLabel="Start"
      min="08:00"
      max="18:00"
      [stepMinute]="15"
      [(value)]="start"
    />
  `,
})
class Host {
  readonly day = signal<Date | null>(new Date(2026, 10, 18));
  readonly call = signal<Date | null>(null);
  readonly start = signal<string | null>('09:30');
}

describe('date picker: week numbers, two months, 12-hour time, time picker', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }

  it('gives ISO 8601 week numbers at the year boundary', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1);
    expect(isoWeek(new Date(2026, 11, 31))).toBe(53);
    expect(isoWeek(new Date(2027, 0, 3))).toBe(53);
    expect(isoWeek(new Date(2027, 0, 4))).toBe(1);
    expect(isoWeek(new Date(2026, 10, 18))).toBe(47);
  });

  it('shows two months with captions and week numbers, each day once', async () => {
    const { fixture, el, host } = await setup();
    const calendar = el.querySelector('star-calendar')!;
    const captions = [...calendar.querySelectorAll('caption')].map((c) => c.textContent?.trim());
    expect(captions).toEqual(['November 2026', 'December 2026']);
    const keys = [...calendar.querySelectorAll<HTMLElement>('[data-date]')].map(
      (day) => day.dataset['date'],
    );
    expect(keys.length).toBe(30 + 31);
    expect(new Set(keys).size).toBe(keys.length);
    expect(calendar.querySelector('thead th.star-calendar__week')?.textContent?.trim()).toBe('Wk');
    // 18 November 2026 is in week 47.
    const row = calendar.querySelector('[data-date="2026-11-18"]')!.closest('tr')!;
    expect(row.querySelector('th.star-calendar__week')?.textContent?.trim()).toBe('47');

    // A day in the second month is chosen without a change of the shown months.
    calendar.querySelector<HTMLButtonElement>('[data-date="2026-12-10"]')!.click();
    await fixture.whenStable();
    expect(host.day()).toEqual(new Date(2026, 11, 10));
    expect([...calendar.querySelectorAll('caption')].map((c) => c.textContent?.trim())).toEqual(
      captions,
    );
  });

  it('reads and shows a 12-hour time, and still accepts a 24-hour time', async () => {
    const { fixture, el, host } = await setup();
    const input = el.querySelector<HTMLInputElement>('input[aria-label="Call"]')!;
    const type = async (text: string) => {
      input.value = text;
      input.dispatchEvent(new Event('input'));
      input.dispatchEvent(new Event('blur'));
      await fixture.whenStable();
    };
    expect(input.placeholder).toContain('hh:mm am');
    await type('23/11/2026 2:30 pm');
    expect(host.call()).toEqual(new Date(2026, 10, 23, 14, 30));
    expect(input.value).toMatch(/^23\/11\/2026, 0?2:30\s?pm$/i);

    await type('23/11/2026 12:05 am');
    expect(host.call()).toEqual(new Date(2026, 10, 23, 0, 5));
    await type('24/11/2026 17:45');
    expect(host.call()).toEqual(new Date(2026, 10, 24, 17, 45));
    // 13 pm is not a time: the text goes back to the value.
    await type('24/11/2026 13:00 pm');
    expect(host.call()).toEqual(new Date(2026, 10, 24, 17, 45));
  });

  it('time picker holds HH:mm text and clears to null', async () => {
    const { fixture, el, host } = await setup();
    const input = el.querySelector<HTMLInputElement>('star-time-picker input')!;
    expect(input.type).toBe('time');
    expect(input.value).toBe('09:30');
    expect(input.min).toBe('08:00');
    expect(input.step).toBe('900');
    input.value = '14:45';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.start()).toBe('14:45');
    input.value = '';
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(host.start()).toBeNull();
  });
});
