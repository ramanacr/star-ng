import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete, StarMultiAutoComplete } from '@star-ng/ui/autocomplete';
import { StarListbox } from '@star-ng/ui/listbox';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';
import { StarSelectionChangingEvent } from './selection-changing';

const CITIES = ['Berlin', 'Paris', 'Lisbon'];

@Component({
  imports: [StarSelect, StarMultiSelect, StarListbox, StarAutoComplete, StarMultiAutoComplete],
  template: `
    <star-select
      [options]="cities"
      [(value)]="city"
      ariaLabel="City"
      showClear
      (selectionChanging)="onChanging($event)"
    />
    <star-multi-select
      [options]="cities"
      [(value)]="many"
      ariaLabel="Cities"
      (selectionChanging)="onChanging($event)"
    />
    <star-autocomplete
      [options]="cities"
      [(value)]="found"
      ariaLabel="Find city"
      (selectionChanging)="onChanging($event)"
    />
    <star-multi-autocomplete
      [options]="cities"
      [(value)]="tags"
      ariaLabel="Find cities"
      (selectionChanging)="onChanging($event)"
    />
    <star-listbox
      [options]="cities"
      [(value)]="listed"
      ariaLabel="City list"
      (selectionChanging)="onChanging($event)"
    />
  `,
})
class Host {
  readonly cities = CITIES;
  readonly city = signal<string | null>('Berlin');
  readonly many = signal<readonly string[]>([]);
  readonly found = signal<string | null>(null);
  readonly tags = signal<readonly string[]>([]);
  readonly listed = signal<string | readonly string[] | null>(null);
  readonly events: { previous: unknown; next: unknown }[] = [];
  cancel = false;

  onChanging(event: StarSelectionChangingEvent<unknown>): void {
    this.events.push({ previous: event.previous, next: event.next });
    if (this.cancel) event.cancel();
  }
}

function key(target: Element, name: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

function panelOption(label: string): HTMLElement {
  return [...document.querySelectorAll<HTMLElement>('.star-panel [role=option]')].find(
    (o) => o.textContent?.trim() === label,
  )!;
}

describe('selectionChanging', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      host: fixture.componentInstance,
      el,
      combos: el.querySelectorAll<HTMLElement>('[role=combobox]'),
    };
  }

  it('select: fires before the change, and cancel keeps the old value', async () => {
    const { fixture, host, combos } = await setup();
    host.cancel = true;
    combos[0].click();
    await fixture.whenStable();
    panelOption('Paris').click();
    await fixture.whenStable();
    expect(host.events).toEqual([{ previous: 'Berlin', next: 'Paris' }]);
    expect(host.city()).toBe('Berlin');

    host.cancel = false;
    combos[0].click();
    await fixture.whenStable();
    panelOption('Lisbon').click();
    await fixture.whenStable();
    expect(host.events.at(-1)).toEqual({ previous: 'Berlin', next: 'Lisbon' });
    expect(host.city()).toBe('Lisbon');
  });

  it('select: choosing the same option again fires no event; clear can be cancelled', async () => {
    const { fixture, host, el, combos } = await setup();
    combos[0].click();
    await fixture.whenStable();
    panelOption('Berlin').click();
    await fixture.whenStable();
    expect(host.events).toEqual([]);
    host.cancel = true;
    el.querySelector<HTMLButtonElement>('star-select .star-select__icon-btn')!.click();
    await fixture.whenStable();
    expect(host.events).toEqual([{ previous: 'Berlin', next: null }]);
    expect(host.city()).toBe('Berlin');
  });

  it('multi-select: a cancelled toggle keeps the array', async () => {
    const { fixture, host, combos } = await setup();
    host.cancel = true;
    combos[1].click();
    await fixture.whenStable();
    key(combos[1], 'Enter');
    await fixture.whenStable();
    expect(host.events).toEqual([{ previous: [], next: ['Berlin'] }]);
    expect(host.many()).toEqual([]);
  });

  it('autocomplete: a cancelled choice puts the old text back', async () => {
    const { fixture, host, combos } = await setup();
    host.cancel = true;
    const input = combos[2] as HTMLInputElement;
    input.value = 'par';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    panelOption('Paris').click();
    await fixture.whenStable();
    expect(host.events).toEqual([{ previous: null, next: 'Paris' }]);
    expect(host.found()).toBeNull();
    expect(input.value).toBe('');
  });

  it('multiple autocomplete: a cancelled choice adds no chip', async () => {
    const { fixture, host, combos } = await setup();
    host.cancel = true;
    const input = combos[3] as HTMLInputElement;
    input.value = 'lis';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    panelOption('Lisbon').click();
    await fixture.whenStable();
    expect(host.events).toEqual([{ previous: [], next: ['Lisbon'] }]);
    expect(host.tags()).toEqual([]);
  });

  it('listbox: a cancelled keyboard move keeps the value', async () => {
    const { fixture, host, el } = await setup();
    host.cancel = true;
    const list = el.querySelector<HTMLElement>('star-listbox [role=listbox]')!;
    list.dispatchEvent(new FocusEvent('focus'));
    key(list, 'ArrowDown');
    await fixture.whenStable();
    expect(host.events).toEqual([{ previous: null, next: 'Paris' }]);
    expect(host.listed()).toBeNull();
  });
});
