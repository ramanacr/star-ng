import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { starSplitDateTime, starTimeFormat } from './date-format';
import { StarDatePicker, StarDateRangePicker } from './date-picker';
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
