import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete, StarMultiAutoComplete } from './autocomplete';

interface City {
  code: string;
  name: string;
  country: string;
}

const CITIES: City[] = [
  { code: 'BER', name: 'Berlin', country: 'Germany' },
  { code: 'MUC', name: 'Munich', country: 'Germany' },
  { code: 'PAR', name: 'Paris', country: 'France' },
];

@Component({
  imports: [StarAutoComplete, StarMultiAutoComplete],
  template: `
    <star-autocomplete
      class="single"
      [options]="cities"
      optionLabel="name"
      optionValue="code"
      [(value)]="city"
      [forceSelection]="force()"
      showClear
      ariaLabel="City"
      (optionSelect)="selects.push($event.code)"
      (optionUnselect)="unselects.push($event)"
    />
    <star-autocomplete
      class="grouped"
      [suggestions]="results()"
      optionLabel="name"
      optionValue="code"
      optionGroup="country"
      [(value)]="remote"
      ariaLabel="Remote city"
    />
    <star-multi-autocomplete
      class="multi"
      [options]="cities"
      optionLabel="name"
      optionValue="code"
      [(value)]="codes"
      separator=","
      addOnTab
      addOnBlur
      allowCustomValues
      [unique]="unique()"
      ariaLabel="Cities"
      (optionSelect)="selects.push($event.code)"
      (optionUnselect)="unselects.push($event)"
    />
  `,
})
class Host {
  readonly cities = CITIES;
  readonly results = signal<readonly City[]>([CITIES[2], CITIES[0], CITIES[1]]);
  readonly city = signal<string | null>(null);
  readonly remote = signal<string | null>(null);
  readonly codes = signal<readonly string[]>([]);
  readonly force = signal(false);
  readonly unique = signal(true);
  readonly selects: string[] = [];
  readonly unselects: string[] = [];
}

function key(target: Element, name: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('autocomplete extras', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = (selector: string) => el.querySelector<HTMLInputElement>(`${selector} input`)!;
    return { fixture, host: fixture.componentInstance, el, input };
  }

  it('without forceSelection, unknown text goes back to the label on blur', async () => {
    const { fixture, host, input } = await setup();
    host.city.set('BER');
    await fixture.whenStable();
    const field = input('.single');
    type(field, 'xyz');
    await fixture.whenStable();
    key(field, 'Escape');
    field.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.city()).toBe('BER');
    expect(field.value).toBe('Berlin');
  });

  it('forceSelection clears the text and the value on blur', async () => {
    const { fixture, host, input } = await setup();
    host.city.set('BER');
    host.force.set(true);
    await fixture.whenStable();
    const field = input('.single');
    type(field, 'xyz');
    await fixture.whenStable();
    key(field, 'Escape');
    field.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.city()).toBeNull();
    expect(field.value).toBe('');
  });

  it('showClear clears the value and emits optionUnselect; a choice emits optionSelect', async () => {
    const { fixture, host, el, input } = await setup();
    const field = input('.single');
    type(field, 'mun');
    await fixture.whenStable();
    document.querySelector<HTMLElement>('.star-panel [role=option]')!.click();
    await fixture.whenStable();
    expect(host.selects).toEqual(['MUC']);
    el.querySelector<HTMLButtonElement>('.single .star-select__icon-btn')!.click();
    await fixture.whenStable();
    expect(host.city()).toBeNull();
    expect(host.unselects).toEqual(['MUC']);
  });

  it('groups server suggestions with optionGroup', async () => {
    const { fixture, input } = await setup();
    type(input('.grouped'), 'r');
    await fixture.whenStable();
    const rows = [...document.querySelectorAll('.star-panel [role=listbox] > li')].map(
      (li) => `${li.getAttribute('role') ?? 'group'}:${li.textContent?.trim()}`,
    );
    expect(rows).toEqual([
      'presentation:France',
      'option:Paris',
      'presentation:Germany',
      'option:Berlin',
      'option:Munich',
    ]);
  });

  it('separator turns each finished part into a chip', async () => {
    const { fixture, host, input } = await setup();
    const field = input('.multi');
    type(field, 'berlin,Rome,Par');
    await fixture.whenStable();
    expect(host.codes()).toEqual(['BER', 'Rome']);
    expect(field.value).toBe('Par');
    expect(host.selects).toEqual(['BER']);
  });

  it('addOnTab adds a chip and keeps focus in the field', async () => {
    const { fixture, host, input } = await setup();
    const field = input('.multi');
    type(field, 'paris');
    await fixture.whenStable();
    expect(key(field, 'Tab').defaultPrevented).toBe(true);
    await fixture.whenStable();
    expect(host.codes()).toEqual(['PAR']);
    expect(field.value).toBe('');
    // Nothing typed: Tab leaves the field as usual.
    expect(key(field, 'Tab').defaultPrevented).toBe(false);
  });

  it('addOnBlur adds the typed text as a chip', async () => {
    const { fixture, host, input } = await setup();
    const field = input('.multi');
    type(field, 'Rome');
    await fixture.whenStable();
    key(field, 'Escape');
    field.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.codes()).toEqual(['Rome']);
  });

  it('unique off: an option can be chosen twice, and one chip is removed at a time', async () => {
    const { fixture, host, el, input } = await setup();
    host.unique.set(false);
    await fixture.whenStable();
    const field = input('.multi');
    type(field, 'berlin,berlin,');
    await fixture.whenStable();
    expect(host.codes()).toEqual(['BER', 'BER']);
    el.querySelector<HTMLButtonElement>('.multi .star-chip__remove')!.click();
    await fixture.whenStable();
    expect(host.codes()).toEqual(['BER']);
    expect(host.unselects).toEqual(['BER']);
    key(field, 'Backspace');
    await fixture.whenStable();
    expect(host.codes()).toEqual([]);
    expect(host.unselects).toEqual(['BER', 'BER']);
  });

  it('arrow keys move the active option and never choose it', async () => {
    const { fixture, host, input } = await setup();
    const single = input('.single');
    single.focus();
    single.value = 'r';
    single.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    key(single, 'ArrowDown');
    key(single, 'ArrowDown');
    await fixture.whenStable();
    expect(host.city()).toBeNull();
    expect(single.value).toBe('r');
    key(single, 'Escape');

    const multi = input('.multi');
    multi.value = 'r';
    multi.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    key(multi, 'ArrowDown');
    key(multi, 'ArrowDown');
    await fixture.whenStable();
    expect(host.codes()).toEqual([]);
  });

  it('an empty field on blur clears the value and emits optionUnselect', async () => {
    const { fixture, host, input } = await setup();
    host.city.set('PAR');
    await fixture.whenStable();
    const field = input('.single');
    field.value = '';
    field.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    field.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.city()).toBeNull();
    expect(host.unselects).toEqual(['PAR']);
  });
});
