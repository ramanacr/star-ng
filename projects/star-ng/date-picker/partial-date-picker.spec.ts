import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, FormField, required } from '@angular/forms/signals';
import { StarField } from '@star-ng/ui/field';
import { StarDatePrecision, StarPartialDate } from './partial-date';
import { StarPartialDatePicker } from './partial-date-picker';

@Component({
  imports: [StarPartialDatePicker],
  template: `<star-partial-date-picker
    [(value)]="value"
    locale="en-US"
    datePattern="dd-MMM-yyyy"
    [precisions]="precisions()"
    [minDate]="minDate()"
    [maxDate]="maxDate()"
    [keepInvalid]="keepInvalid()"
    [disabled]="disabled()"
    [readonly]="readonly()"
    showButtonBar
    ariaLabel="Start"
  />`,
})
class PartialHost {
  readonly value = signal<StarPartialDate | null>(null);
  readonly precisions = signal<readonly StarDatePrecision[]>(['day', 'month', 'year']);
  readonly minDate = signal<Date | null>(null);
  readonly maxDate = signal<Date | null>(null);
  readonly keepInvalid = signal(false);
  readonly disabled = signal(false);
  readonly readonly = signal(false);
}

@Component({
  imports: [StarPartialDatePicker, StarField, FormField],
  template: `<star-field label="Started" for="started" [state]="model.started()">
    <star-partial-date-picker inputId="started" [formField]="model.started" locale="en-GB" />
  </star-field>`,
})
class FormHost {
  readonly data = signal<{ started: StarPartialDate | null }>({ started: null });
  readonly model = form(this.data, (path) => {
    required(path.started, { message: 'Enter when it started.' });
  });
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.dispatchEvent(new Event('blur'));
}

function key(target: Element, name: string, init: KeyboardEventInit = {}): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }),
  );
}

function radios(): HTMLInputElement[] {
  return [...document.querySelectorAll<HTMLInputElement>('.star-date__precision-radio')];
}

describe('StarPartialDatePicker', () => {
  async function setup() {
    const fixture = TestBed.createComponent(PartialHost);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      element: element.querySelector('star-partial-date-picker') as HTMLElement,
      input: element.querySelector('input')!,
    };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('reads typed text of the three precisions and shows only the known parts', async () => {
    const { fixture, host, input, element } = await setup();
    expect(input.placeholder).toBe('dd-MMM-yyyy, MMM-yyyy, yyyy');
    expect(input.getAttribute('inputmode')).toBe('text');

    type(input, 'MAR-2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: 3, day: null });
    expect(input.value).toBe('Mar-2026');
    expect(element.dataset['precision']).toBe('month');

    type(input, '14-APR-2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: 4, day: 14 });
    expect(input.value).toBe('14-Apr-2026');
    expect(element.dataset['precision']).toBe('day');

    type(input, '1981');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 1981, month: null, day: null });
    expect(input.value).toBe('1981');

    type(input, '');
    await fixture.whenStable();
    expect(host.value()).toBeNull();
    expect(element.dataset['precision']).toBeUndefined();
  });

  it('reverts impossible text, or keeps it marked invalid with keepInvalid', async () => {
    const { fixture, host, input } = await setup();
    host.value.set({ year: 2026, month: 3, day: null });
    await fixture.whenStable();
    type(input, '31-Apr-2026');
    await fixture.whenStable();
    expect(input.value).toBe('Mar-2026');
    expect(host.value()).toEqual({ year: 2026, month: 3, day: null });

    host.keepInvalid.set(true);
    await fixture.whenStable();
    type(input, '13-2026');
    await fixture.whenStable();
    expect(host.value()).toBeNull();
    expect(input.value).toBe('13-2026');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('marks a value with impossible parts invalid and shows no text', async () => {
    const { fixture, host, input } = await setup();
    host.value.set({ year: 2026, month: 13, day: null });
    await fixture.whenStable();
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    host.value.set({ year: 2026, month: 12, day: null });
    await fixture.whenStable();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('takes only the allowed precisions', async () => {
    const { fixture, host, input } = await setup();
    host.precisions.set(['month', 'year']);
    await fixture.whenStable();
    expect(input.placeholder).toBe('MMM-yyyy, yyyy');
    type(input, '14-Apr-2026');
    await fixture.whenStable();
    expect(host.value()).toBeNull();
    type(input, 'Apr-2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: 4, day: null });

    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(radios().map((radio) => radio.value)).toEqual(['month', 'year']);

    host.precisions.set(['year']);
    await fixture.whenStable();
    expect(radios()).toEqual([]);
    // The month value is not of an allowed precision any more.
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('compares minDate and maxDate at the precision of the value', async () => {
    const { fixture, host, input } = await setup();
    host.minDate.set(new Date(2026, 2, 15));
    host.maxDate.set(new Date(2026, 5, 10));
    await fixture.whenStable();
    type(input, 'Mar-2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: 3, day: null });
    type(input, '2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: null, day: null });
    type(input, 'Feb-2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: null, day: null });
    type(input, '14-Mar-2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: null, day: null });
    type(input, '15-Mar-2026');
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: 3, day: 15 });
  });

  it('opens on the precision of the value and picks a day, a month or a year', async () => {
    const { fixture, host, input } = await setup();
    host.value.set({ year: 2026, month: 4, day: 14 });
    await fixture.whenStable();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    const group = document.querySelector('.star-date__precision')!;
    expect(group.getAttribute('role')).toBe('radiogroup');
    expect(group.getAttribute('aria-label')).toBe('Precision');
    expect(radios().map((radio) => radio.checked)).toEqual([true, false, false]);
    expect(document.querySelector('[data-date="2026-04-14"]')).not.toBeNull();

    // Month and year: the month view; the value does not change until a pick.
    radios()[1].click();
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: 4, day: 14 });
    expect(document.querySelector('[data-date]')).toBeNull();
    document.querySelector<HTMLButtonElement>('.star-calendar__pick[data-pick="2"]')!.click();
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2026, month: 3, day: null });
    expect(input.value).toBe('Mar-2026');
    expect(document.querySelector('.star-date__precision')).toBeNull();

    // It opens again in the month view, on March 2026, without a chosen day.
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(radios().map((radio) => radio.checked)).toEqual([false, true, false]);
    expect(
      document.querySelector('.star-calendar__pick--selected')?.getAttribute('data-pick'),
    ).toBe('2');

    radios()[2].click();
    await fixture.whenStable();
    document.querySelector<HTMLButtonElement>('.star-calendar__pick[data-pick="2024"]')!.click();
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2024, month: null, day: null });
    expect(input.value).toBe('2024');

    key(input, 'ArrowDown');
    await fixture.whenStable();
    radios()[0].click();
    await fixture.whenStable();
    // A year alone marks no day.
    expect(document.querySelector('[aria-selected="true"]')).toBeNull();
    document.querySelector<HTMLButtonElement>('[data-date="2024-01-10"]')!.click();
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: 2024, month: 1, day: 10 });
  });

  it('chooses today at the precision of the popup', async () => {
    const { fixture, host, input } = await setup();
    key(input, 'ArrowDown');
    await fixture.whenStable();
    radios()[2].click();
    await fixture.whenStable();
    const today = document.querySelector<HTMLButtonElement>('[data-star-part="todayButton"]')!;
    today.click();
    await fixture.whenStable();
    expect(host.value()).toEqual({ year: new Date().getFullYear(), month: null, day: null });
  });

  it('does not open when disabled or read only', async () => {
    const { fixture, host, input } = await setup();
    host.disabled.set(true);
    await fixture.whenStable();
    expect(input.disabled).toBe(true);
    host.disabled.set(false);
    host.readonly.set(true);
    await fixture.whenStable();
    expect(input.readOnly).toBe(true);
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(document.querySelector('.star-date__panel')).toBeNull();
  });

  it('is a Signal Forms control labelled by star-field', async () => {
    const fixture = TestBed.createComponent(FormHost);
    await fixture.whenStable();
    const host = fixture.componentInstance;
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector('input')!;
    expect(element.querySelector('label')!.getAttribute('for')).toBe('started');
    expect(host.model().valid()).toBe(false);
    type(input, '04/2026');
    await fixture.whenStable();
    expect(host.data().started).toEqual({ year: 2026, month: 4, day: null });
    expect(input.value).toBe('04/2026');
    expect(host.model().valid()).toBe(true);
    host.data.set({ started: { year: 1981, month: null, day: null } });
    await fixture.whenStable();
    expect(input.value).toBe('1981');
  });
});
