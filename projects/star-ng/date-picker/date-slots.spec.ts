import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarFooterTemplate, StarHeaderTemplate } from '@star-ng/ui/core';
import { StarCalendar } from './calendar';
import { StarDatePicker, StarDateRangePicker, StarMultiDatePicker } from './date-picker';
import { StarDateTemplate } from './date-slots';
import { isoDay, startOfDay } from './date-utils';

const TODAY = startOfDay(new Date());

@Component({
  imports: [
    StarCalendar,
    StarDatePicker,
    StarDateRangePicker,
    StarMultiDatePicker,
    StarDateTemplate,
    StarHeaderTemplate,
    StarFooterTemplate,
  ],
  template: `
    <star-calendar class="plain" locale="en-GB" [firstDayOfWeek]="1" [selected]="today" />
    <star-calendar
      class="slotted"
      locale="en-GB"
      [firstDayOfWeek]="1"
      [selected]="today"
      [disabledDays]="[0]"
    >
      <ng-template
        starDate
        let-date
        let-today="today"
        let-selected="selected"
        let-disabled="disabled"
        let-outside="outside"
        ><b class="mine"
          >{{ iso(date) }}|{{ today }}|{{ selected }}|{{ disabled }}|{{ outside }}</b
        ></ng-template
      >
      <ng-template starHeader><i class="head">Head</i></ng-template>
      <ng-template starFooter><i class="foot">Foot</i></ng-template>
    </star-calendar>
    <star-date-picker class="single" locale="en-GB" showButtonBar [(value)]="date">
      <ng-template starDate let-date
        ><b class="mine">{{ date.getDate() }}!</b></ng-template
      >
      <ng-template starHeader><i class="head">Pick a due date</i></ng-template>
      <ng-template starFooter><i class="foot">Due dates have a dot</i></ng-template>
    </star-date-picker>
    <star-date-range-picker class="range" locale="en-GB" [numberOfMonths]="2" [(value)]="range">
      <ng-template starDate let-date
        ><b class="mine">{{ date.getDate() }}</b></ng-template
      >
    </star-date-range-picker>
    <star-multi-date-picker class="multi" locale="en-GB" [(value)]="dates">
      <ng-template starDate let-date let-selected="selected"
        ><b class="mine">{{ date.getDate() }}{{ selected ? '*' : '' }}</b></ng-template
      >
    </star-multi-date-picker>
  `,
})
class Host {
  readonly today = TODAY;
  readonly date = signal<Date | null>(new Date(2026, 10, 18));
  readonly range = signal<{ start: Date | null; end: Date | null } | null>({
    start: new Date(2026, 10, 3),
    end: new Date(2026, 10, 9),
  });
  readonly dates = signal<readonly Date[]>([new Date(2026, 10, 4)]);
  readonly iso = isoDay;
}

function key(target: Element, key: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }),
  );
}

describe('date slots', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  async function open(fixture: { whenStable(): Promise<unknown> }, el: HTMLElement, cls: string) {
    key(el.querySelector(`.${cls} input`)!, 'ArrowDown', { altKey: true });
    await fixture.whenStable();
    return document.querySelector<HTMLElement>('.star-date__panel')!;
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('day template gets date, today, selected, disabled and outside', async () => {
    const { el } = await setup();
    const days = [...el.querySelectorAll<HTMLButtonElement>('.slotted .star-calendar__day')];
    expect(days.length).toBe(42);
    for (const day of days) {
      const expected = [
        day.dataset['date'],
        day.getAttribute('aria-current') === 'date',
        day.classList.contains('star-calendar__day--selected'),
        day.getAttribute('aria-disabled') === 'true',
        day.classList.contains('star-calendar__day--outside'),
      ].join('|');
      expect(day.querySelector('.mine')?.textContent).toBe(expected);
    }
    const texts = days.map((day) => day.textContent!);
    expect(texts.filter((t) => t.includes('|true|true|')).length).toBe(1);
    expect(texts.some((t) => /\|true\|false$/.test(t))).toBe(true);
    expect(texts.some((t) => t.endsWith('|true'))).toBe(true);
  });

  it('day template keeps the accessible name', async () => {
    const { el } = await setup();
    const plain = [...el.querySelectorAll<HTMLButtonElement>('.plain .star-calendar__day')];
    const slotted = [...el.querySelectorAll<HTMLButtonElement>('.slotted .star-calendar__day')];
    const label = new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' });
    slotted.forEach((day, i) => {
      const date = new Date(`${day.dataset['date']}T00:00`);
      expect(day.getAttribute('aria-label')).toBe(label.format(date));
      expect(day.getAttribute('aria-label')).toBe(plain[i].getAttribute('aria-label'));
      expect(day.getAttribute('tabindex')).toBe(plain[i].getAttribute('tabindex'));
    });
    const today = el.querySelector(`.slotted [data-date="${isoDay(TODAY)}"]`)!;
    expect(today.getAttribute('aria-current')).toBe('date');
    expect(today.querySelector('.mine')).not.toBeNull();
    // Without a slot the day shows its number only.
    expect(plain.find((day) => day.dataset['date'] === isoDay(TODAY))!.textContent!.trim()).toBe(
      String(TODAY.getDate()),
    );
  });

  it('date picker passes starDate to its calendar', async () => {
    const { fixture, el } = await setup();
    const panel = await open(fixture, el, 'single');
    const day = panel.querySelector('[data-date="2026-11-18"]')!;
    expect(day.querySelector('.mine')?.textContent).toBe('18!');
    expect(day.getAttribute('aria-label')).toBe(
      new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(new Date(2026, 10, 18)),
    );
    // The picker owns the slot: the calendars outside the picker do not use it.
    expect(el.querySelector('.plain .mine')).toBeNull();
  });

  it('multiple-date picker passes starDate to its calendar', async () => {
    const { fixture, el } = await setup();
    const panel = await open(fixture, el, 'multi');
    expect(panel.querySelector('[data-date="2026-11-04"] .mine')?.textContent).toBe('4*');
    expect(panel.querySelector('[data-date="2026-11-05"] .mine')?.textContent).toBe('5');
  });

  it('range picker uses starDate for both months', async () => {
    const { fixture, el } = await setup();
    const panel = await open(fixture, el, 'range');
    const grids = panel.querySelectorAll('[role="grid"]');
    expect(grids.length).toBe(2);
    grids.forEach((grid) => {
      const days = grid.querySelectorAll('.star-calendar__day');
      expect(days.length).toBeGreaterThan(27);
      expect(grid.querySelectorAll('.star-calendar__day .mine').length).toBe(days.length);
    });
    expect(panel.querySelector('[data-date="2026-12-24"] .mine')?.textContent).toBe('24');
  });

  it('header and footer render in the picker panel', async () => {
    const { fixture, el } = await setup();
    const panel = await open(fixture, el, 'single');
    const children = [...panel.children];
    const head = panel.querySelector('.head')!;
    const foot = panel.querySelector('.foot')!;
    const calendar = panel.querySelector('star-calendar')!;
    const bar = panel.querySelector('.star-date__bar')!;
    expect(head.textContent).toBe('Pick a due date');
    expect(foot.textContent).toBe('Due dates have a dot');
    expect(children.indexOf(head)).toBeLessThan(children.indexOf(calendar));
    expect(children.indexOf(calendar)).toBeLessThan(children.indexOf(foot));
    // The footer is the last child of the panel, below the Today / Clear button bar.
    expect(children.indexOf(bar)).toBeLessThan(children.indexOf(foot));
    expect(children.indexOf(foot)).toBe(children.length - 1);
    expect(head.closest('[role="grid"]')).toBeNull();
    // The inner calendar does not render the picker's header a second time.
    expect(panel.querySelectorAll('.head').length).toBe(1);
  });

  it('calendar renders its own header and footer outside the grid', async () => {
    const { el } = await setup();
    const calendar = el.querySelector('.slotted')!;
    const children = [...calendar.children];
    const head = calendar.querySelector('.head')!;
    const foot = calendar.querySelector('.foot')!;
    const months = calendar.querySelector('.star-calendar__months')!;
    expect(children.indexOf(head)).toBe(0);
    expect(children.indexOf(foot)).toBe(children.length - 1);
    expect(children.indexOf(months)).toBeGreaterThan(children.indexOf(head));
    expect(head.closest('[role="grid"]')).toBeNull();
    expect(foot.closest('[role="grid"]')).toBeNull();
    expect(el.querySelector('.plain .head')).toBeNull();
  });

  it('arrow keys still move the focused day with starDate', async () => {
    const { fixture, el } = await setup();
    const active = () =>
      el.querySelector<HTMLButtonElement>('.slotted .star-calendar__day[tabindex="0"]')!;
    const start = active();
    expect(start.dataset['date']).toBe(isoDay(TODAY));
    start.focus();
    key(start, 'ArrowDown');
    await fixture.whenStable();
    const next = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + 7);
    expect((document.activeElement as HTMLElement).dataset['date']).toBe(isoDay(next));
    expect(document.activeElement!.querySelector('.mine')).not.toBeNull();
  });
});

@Component({
  imports: [StarCalendar, StarDateTemplate],
  template: `
    <star-calendar
      class="range-one"
      locale="en-GB"
      [firstDayOfWeek]="1"
      mode="range"
      [range]="range"
      [numberOfMonths]="1"
    >
      <ng-template starDate let-date let-selected="selected" let-outside="outside"
        ><b class="mine" [attr.data-date]="iso(date)" [attr.data-selected]="selected">{{
          outside
        }}</b></ng-template
      >
    </star-calendar>
    <star-calendar
      class="range-two"
      locale="en-GB"
      [firstDayOfWeek]="1"
      mode="range"
      [range]="range"
      [numberOfMonths]="2"
    >
      <ng-template starDate let-date let-selected="selected" let-outside="outside"
        ><b class="mine" [attr.data-date]="iso(date)" [attr.data-selected]="selected">{{
          outside
        }}</b></ng-template
      >
    </star-calendar>
  `,
})
class RangeHost {
  readonly range = { start: new Date(2026, 10, 3), end: new Date(2026, 10, 9) };
  readonly iso = isoDay;
}

describe('date slots in range mode and in a multi-month grid', () => {
  async function setup() {
    const fixture = TestBed.createComponent(RangeHost);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }
  const marks = (el: HTMLElement, cls: string) =>
    [...el.querySelectorAll<HTMLElement>(`.${cls} .mine`)].map((n) => ({
      date: n.getAttribute('data-date')!,
      selected: n.getAttribute('data-selected'),
      outside: n.textContent,
    }));

  it('selected is true only for the two ends of the range, not for the days between', async () => {
    const el = await setup();
    for (const cls of ['range-one', 'range-two']) {
      const chosen = marks(el, cls)
        .filter((m) => m.selected === 'true')
        .map((m) => m.date);
      expect(chosen).toEqual(['2026-11-03', '2026-11-09']);
      const between = marks(el, cls).find((m) => m.date === '2026-11-05')!;
      expect(between.selected).toBe('false');
    }
  });

  it('outside marks the days of the other months in a one-month grid', async () => {
    const el = await setup();
    const all = marks(el, 'range-one');
    expect(all.find((m) => m.date === '2026-10-30')?.outside).toBe('true');
    expect(all.find((m) => m.date === '2026-11-15')?.outside).toBe('false');
    expect(all.find((m) => m.date === '2026-12-01')?.outside).toBe('true');
  });

  it('outside is false for every shown day in a two-month grid, which blanks the other-month cells', async () => {
    const el = await setup();
    const all = marks(el, 'range-two');
    const dates = all.map((m) => m.date);
    // November and December, each day once, in the month in which it is shown.
    expect(all.length).toBe(30 + 31);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates[0]).toBe('2026-11-01');
    expect(dates.at(-1)).toBe('2026-12-31');
    expect(all.every((m) => m.outside === 'false')).toBe(true);
  });
});
