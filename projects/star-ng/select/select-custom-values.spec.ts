import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarMultiAutoComplete } from '@star-ng/ui/autocomplete';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';

interface City {
  code: string;
  name: string;
}

const CITIES: City[] = [
  { code: 'BER', name: 'Berlin' },
  { code: 'PAR', name: 'Paris' },
  { code: 'LIS', name: 'Lisbon' },
];

@Component({
  imports: [StarSelect, StarMultiSelect, StarMultiAutoComplete],
  template: `
    <star-select
      [options]="cities"
      optionLabel="name"
      optionValue="code"
      [(value)]="city"
      editable
      [allowCustomValue]="allowCustom()"
      ariaLabel="City"
      (customValue)="customs.push($event)"
    />
    <star-multi-select
      [options]="cities"
      optionLabel="name"
      optionValue="code"
      [(value)]="codes"
      filter
      allowCustomValues
      display="chip"
      ariaLabel="Cities"
      (customValueAdd)="added.push($event)"
    />
    <star-multi-autocomplete
      [options]="cities"
      optionLabel="name"
      optionValue="code"
      [(value)]="tags"
      allowCustomValues
      ariaLabel="Find cities"
      (customValueAdd)="added.push($event)"
    />
  `,
})
class Host {
  readonly cities = CITIES;
  readonly city = signal<string | null>(null);
  readonly codes = signal<readonly string[]>([]);
  readonly tags = signal<readonly string[]>([]);
  readonly allowCustom = signal(false);
  readonly customs: string[] = [];
  readonly added: string[] = [];
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

function panelOptions(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.star-panel [role=option]')];
}

describe('editable select and custom values', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const combos = el.querySelectorAll<HTMLElement>('[role=combobox]');
    return { fixture, host: fixture.componentInstance, combos };
  }

  it('editable: a text field combobox that filters while typing', async () => {
    const { fixture, combos } = await setup();
    const input = combos[0] as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    type(input, 'par');
    await fixture.whenStable();
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(panelOptions().map((o) => o.textContent?.trim())).toEqual(['Paris']);
    expect(input.getAttribute('aria-activedescendant')).toBe(panelOptions()[0].id);
  });

  it('editable: Enter chooses the active option and shows its label', async () => {
    const { fixture, host, combos } = await setup();
    const input = combos[0] as HTMLInputElement;
    type(input, 'lis');
    await fixture.whenStable();
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.city()).toBe('LIS');
    expect(input.value).toBe('Lisbon');
  });

  it('editable: unknown text goes back on blur without allowCustomValue', async () => {
    const { fixture, host, combos } = await setup();
    host.city.set('BER');
    await fixture.whenStable();
    const input = combos[0] as HTMLInputElement;
    expect(input.value).toBe('Berlin');
    type(input, 'Rome');
    await fixture.whenStable();
    key(input, 'Escape');
    input.dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
    expect(host.city()).toBe('BER');
    expect(input.value).toBe('Berlin');
  });

  it('editable: unknown text becomes the value with allowCustomValue', async () => {
    const { fixture, host, combos } = await setup();
    host.allowCustom.set(true);
    await fixture.whenStable();
    const input = combos[0] as HTMLInputElement;
    type(input, 'Rome');
    await fixture.whenStable();
    expect(panelOptions().length).toBe(0);
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.city()).toBe('Rome');
    expect(host.customs).toEqual(['Rome']);
    expect(input.value).toBe('Rome');
  });

  it('multi-select: the "Add" row adds the filter text as a value', async () => {
    const { fixture, host, combos } = await setup();
    combos[1].click();
    await fixture.whenStable();
    const filter = document.querySelector<HTMLInputElement>('.star-panel__filter input')!;
    filter.focus();
    type(filter, 'Rome');
    await fixture.whenStable();
    const add = panelOptions().at(-1)!;
    expect(add.textContent?.trim()).toBe('Add “Rome”');
    expect(document.querySelector('.star-panel .star-listbox__empty')).toBeNull();
    key(filter, 'ArrowDown');
    await fixture.whenStable();
    expect(filter.getAttribute('aria-activedescendant')).toBe(add.id);
    key(filter, 'Enter');
    await fixture.whenStable();
    expect(host.codes()).toEqual(['Rome']);
    expect(host.added).toEqual(['Rome']);
    expect(filter.value).toBe('');
    expect(combos[1].textContent).toContain('Rome');
  });

  it('multi-select: no "Add" row for an existing label', async () => {
    const { fixture, combos } = await setup();
    combos[1].click();
    await fixture.whenStable();
    type(document.querySelector<HTMLInputElement>('.star-panel__filter input')!, 'paris');
    await fixture.whenStable();
    expect(panelOptions().map((o) => o.textContent?.trim())).toEqual(['Paris']);
  });

  it('multiple autocomplete: the "Add" row adds the typed text as a chip', async () => {
    const { fixture, host, combos } = await setup();
    const input = combos[2] as HTMLInputElement;
    input.focus();
    type(input, 'Rome');
    await fixture.whenStable();
    expect(panelOptions().map((o) => o.textContent?.trim())).toEqual(['Add “Rome”']);
    key(input, 'ArrowDown');
    key(input, 'Enter');
    await fixture.whenStable();
    expect(host.tags()).toEqual(['Rome']);
    expect(host.added).toEqual(['Rome']);
    expect(input.value).toBe('');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('star-multi-autocomplete .star-chip')
        ?.textContent,
    ).toContain('Rome');
  });
});
