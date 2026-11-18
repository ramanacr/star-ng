import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarListbox } from './listbox';

interface City {
  code: string;
  name: string;
}

@Component({
  imports: [StarListbox],
  template: `
    <star-listbox
      [options]="cities"
      optionLabel="name"
      optionValue="code"
      filterBy="code"
      filterMatchMode="startsWith"
      filterLocale="de"
      [(value)]="city"
      ariaLabel="City"
      filter
    />
  `,
})
class Host {
  readonly cities: City[] = [
    { code: 'BER', name: 'Berlin' },
    { code: 'MUC', name: 'Munich' },
    { code: 'ZRH', name: 'Zürich' },
  ];
  readonly city = signal<string | null>(null);
}

describe('listbox filter options', () => {
  it('filters by the filterBy field with the match mode', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector<HTMLInputElement>('input')!;
    input.value = 'mu';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const labels = [...el.querySelectorAll('[role=option]')].map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Munich']);
    input.value = 'u';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(el.querySelectorAll('[role=option]').length).toBe(0);
  });
});
