import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';

interface Country {
  code: string;
  name: string;
  disabled?: boolean;
}

const COUNTRIES: Country[] = [
  { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany', disabled: true },
  { code: 'FR', name: 'France' },
  { code: 'JP', name: 'Japan' },
];

@Component({
  imports: [StarSelect, StarMultiSelect],
  template: `
    <star-select
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      optionDisabled="disabled"
      [(value)]="country"
      ariaLabel="Country"
      filter
      showClear
    />
    <star-multi-select
      [options]="countries"
      optionLabel="name"
      optionValue="code"
      optionDisabled="disabled"
      [(value)]="codes"
      ariaLabel="Countries"
    />
  `,
})
class Host {
  readonly countries = COUNTRIES;
  readonly country = signal<string | null>(null);
  readonly codes = signal<readonly string[]>([]);
}

function key(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

function options(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('[role=option]')];
}

describe('StarSelect', () => {
  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const triggers = el.querySelectorAll<HTMLElement>('[role=combobox]');
    return { fixture, host: fixture.componentInstance, single: triggers[0], multi: triggers[1] };
  }

  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('renders a combobox with the placeholder and no value', async () => {
    const { single } = await setup();
    expect(single.getAttribute('aria-expanded')).toBe('false');
    expect(single.textContent).toContain('Select');
  });

  it('opens on click and selects an option by click', async () => {
    const { fixture, host, single } = await setup();
    single.click();
    await fixture.whenStable();
    expect(single.getAttribute('aria-expanded')).toBe('true');
    expect(options().map((o) => o.textContent?.trim())).toEqual([
      'India',
      'Germany',
      'France',
      'Japan',
    ]);
    options()[2].click();
    await fixture.whenStable();
    expect(host.country()).toBe('FR');
    expect(single.textContent).toContain('France');
    expect(single.getAttribute('aria-expanded')).toBe('false');
  });

  it('skips disabled options with the keyboard and selects with Enter', async () => {
    const { fixture, host, single } = await setup();
    key(single, 'ArrowDown'); // opens, India active
    await fixture.whenStable();
    key(single, 'ArrowDown'); // Germany disabled -> France
    await fixture.whenStable();
    expect(single.getAttribute('aria-activedescendant')).toBe(options()[2].id);
    key(single, 'Enter');
    await fixture.whenStable();
    expect(host.country()).toBe('FR');
  });

  it('ignores clicks on disabled options', async () => {
    const { fixture, host, single } = await setup();
    single.click();
    await fixture.whenStable();
    expect(options()[1].getAttribute('aria-disabled')).toBe('true');
    options()[1].click();
    await fixture.whenStable();
    expect(host.country()).toBeNull();
  });

  it('filters options and shows the empty message', async () => {
    const { fixture, single } = await setup();
    single.click();
    await fixture.whenStable();
    const filter = document.querySelector<HTMLInputElement>('[role=searchbox]')!;
    filter.value = 'jap';
    filter.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(options().map((o) => o.textContent?.trim())).toEqual(['Japan']);
    filter.value = 'zzz';
    filter.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(document.querySelector('.star-listbox__empty')?.textContent).toContain('No results');
  });

  it('closes with Escape without changing the value', async () => {
    const { fixture, host, single } = await setup();
    host.country.set('IN');
    key(single, 'ArrowDown');
    await fixture.whenStable();
    key(single, 'Escape');
    await fixture.whenStable();
    expect(single.getAttribute('aria-expanded')).toBe('false');
    expect(host.country()).toBe('IN');
  });

  it('clears the value with the clear button', async () => {
    const { fixture, host } = await setup();
    host.country.set('JP');
    await fixture.whenStable();
    const clear = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.star-select__icon-btn',
    )!;
    clear.click();
    await fixture.whenStable();
    expect(host.country()).toBeNull();
  });

  it('typeahead selects the next match while closed', async () => {
    const { fixture, host, single } = await setup();
    key(single, 'j');
    await fixture.whenStable();
    expect(host.country()).toBe('JP');
  });

  describe('multi-select', () => {
    it('toggles options and keeps the panel open', async () => {
      const { fixture, host, multi } = await setup();
      multi.click();
      await fixture.whenStable();
      options()[0].click();
      options()[3].click();
      await fixture.whenStable();
      expect(host.codes()).toEqual(['IN', 'JP']);
      expect(multi.getAttribute('aria-expanded')).toBe('true');
      options()[0].click();
      await fixture.whenStable();
      expect(host.codes()).toEqual(['JP']);
    });

    it('select all picks only enabled options', async () => {
      const { fixture, host, multi } = await setup();
      multi.click();
      await fixture.whenStable();
      document.querySelector<HTMLButtonElement>('.star-panel__toggle-all')!.click();
      await fixture.whenStable();
      expect(host.codes()).toEqual(['IN', 'FR', 'JP']);
      document.querySelector<HTMLButtonElement>('.star-panel__toggle-all')!.click();
      await fixture.whenStable();
      expect(host.codes()).toEqual([]);
    });

    it('shows a count when more than maxSelectedLabels are chosen', async () => {
      const { fixture, host, multi } = await setup();
      host.codes.set(['IN', 'FR', 'JP', 'DE']);
      await fixture.whenStable();
      expect(multi.textContent).toContain('4 items selected');
    });
  });
});

interface Site {
  id: number;
  name: string;
  region: string;
}

@Component({
  imports: [StarSelect],
  template: `
    <star-select
      [options]="sites"
      optionLabel="name"
      optionValue="id"
      optionGroup="region"
      [(value)]="site"
      ariaLabel="Site"
      filter
    />
    <star-select
      [options]="many"
      optionLabel="name"
      optionValue="id"
      virtualScroll
      [virtualItemSize]="40"
      [(value)]="pick"
      ariaLabel="Batch"
    />
  `,
})
class GroupHost {
  readonly sites: Site[] = [
    { id: 1, name: 'Berlin', region: 'EMEA' },
    { id: 2, name: 'Osaka', region: 'APAC' },
    { id: 3, name: 'Madrid', region: 'EMEA' },
    { id: 4, name: 'Pune', region: 'APAC' },
  ];
  readonly many = Array.from({ length: 2000 }, (_, i) => ({ id: i, name: `Batch ${i}` }));
  readonly site = signal<number | null>(null);
  readonly pick = signal<number | null>(null);
}

describe('StarSelect option groups and virtual scroll', () => {
  async function setup() {
    const fixture = TestBed.createComponent(GroupHost);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const trigger = (label: string) => el.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
    return { fixture, host: fixture.componentInstance, trigger };
  }

  it('shows options under group headings and keeps keyboard order inside the groups', async () => {
    const { fixture, host, trigger } = await setup();
    key(trigger('Site'), 'ArrowDown');
    await fixture.whenStable();
    const lines = [...document.querySelectorAll('.star-listbox > li')].map(
      (line) => `${line.className.includes('group') ? '#' : ''}${line.textContent?.trim()}`,
    );
    expect(lines).toEqual(['#EMEA', 'Berlin', 'Madrid', '#APAC', 'Osaka', 'Pune']);
    const heading = document.querySelector('.star-listbox__group')!;
    expect(options()[1].getAttribute('aria-describedby')).toBe(heading.id);

    // First option is active on open; two steps down reach the first option of the second group.
    key(trigger('Site'), 'ArrowDown');
    key(trigger('Site'), 'ArrowDown');
    key(trigger('Site'), 'Enter');
    await fixture.whenStable();
    expect(host.site()).toBe(2);
  });

  it('renders a window of a long list and moves it to the active option', async () => {
    const { fixture, host, trigger } = await setup();
    host.pick.set(1500);
    await fixture.whenStable();
    key(trigger('Batch'), 'ArrowDown');
    await fixture.whenStable();
    expect(options().length).toBeLessThan(30);
    const active = document.querySelector<HTMLElement>('.star-listbox__option--active')!;
    expect(active.textContent).toContain('Batch 1500');
    expect(active.getAttribute('aria-setsize')).toBe('2000');
    expect(active.getAttribute('aria-posinset')).toBe('1501');
    const spacers = [...document.querySelectorAll<HTMLElement>('.star-listbox__spacer')];
    expect(spacers.length).toBe(2);

    key(trigger('Batch'), 'End');
    await fixture.whenStable();
    key(trigger('Batch'), 'Enter');
    await fixture.whenStable();
    expect(host.pick()).toBe(1999);
  });
});
