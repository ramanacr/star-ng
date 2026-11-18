import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarFilterMatchMode } from '@star-ng/ui/core';
import { StarSelect } from './select';

interface City {
  code: string;
  name: string;
}

const CITIES: City[] = [
  { code: 'BER', name: 'Berlin' },
  { code: 'MAD', name: 'Málaga' },
  { code: 'PAR', name: 'Paris' },
  { code: 'LIS', name: 'Lisbon' },
];

@Component({
  imports: [StarSelect],
  template: `
    <star-select
      [options]="cities"
      optionLabel="name"
      optionValue="code"
      [filterBy]="filterBy()"
      [filterMatchMode]="mode()"
      [resetFilterOnHide]="reset()"
      [(value)]="city"
      ariaLabel="City"
      filter
    />
  `,
})
class Host {
  readonly cities = CITIES;
  readonly city = signal<string | null>(null);
  readonly filterBy = signal<'code' | readonly ('code' | 'name')[] | null>(null);
  readonly mode = signal<StarFilterMatchMode>('contains');
  readonly reset = signal(true);
}

function labels(): string[] {
  return [...document.querySelectorAll<HTMLElement>('[role=option]')].map(
    (o) => o.textContent?.trim() ?? '',
  );
}

function filterInput(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('.star-panel__filter input')!;
}

async function type(fixture: { whenStable(): Promise<unknown> }, text: string): Promise<void> {
  const input = filterInput();
  input.value = text;
  input.dispatchEvent(new Event('input'));
  await fixture.whenStable();
}

describe('select filter options', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(
      '[role=combobox]',
    )!;
    trigger.click();
    await fixture.whenStable();
    return { fixture, host: fixture.componentInstance, trigger };
  }

  it('filters the label without accents by default', async () => {
    const { fixture } = await setup();
    await type(fixture, 'mala');
    expect(labels()).toEqual(['Málaga']);
  });

  it('searches the filterBy fields', async () => {
    const { fixture, host } = await setup();
    host.filterBy.set('code');
    await type(fixture, 'par');
    expect(labels()).toEqual(['Paris']);
    await type(fixture, 'Paris');
    expect(labels()).toEqual([]);
    host.filterBy.set(['code', 'name']);
    await fixture.whenStable();
    expect(labels()).toEqual(['Paris']);
  });

  it('applies filterMatchMode', async () => {
    const { fixture, host } = await setup();
    host.mode.set('startsWith');
    await type(fixture, 'l');
    expect(labels()).toEqual(['Lisbon']);
    host.mode.set('notContains');
    await fixture.whenStable();
    expect(labels()).toEqual(['Paris']);
  });

  it('clears the filter on close by default, and keeps it with resetFilterOnHide off', async () => {
    const { fixture, host, trigger } = await setup();
    await type(fixture, 'par');
    trigger.click();
    await fixture.whenStable();
    trigger.click();
    await fixture.whenStable();
    expect(labels().length).toBe(4);

    host.reset.set(false);
    await type(fixture, 'par');
    trigger.click();
    await fixture.whenStable();
    trigger.click();
    await fixture.whenStable();
    expect(filterInput().value).toBe('par');
    expect(labels()).toEqual(['Paris']);
  });
});
