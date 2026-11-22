import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarMultiSelect } from './multi-select';

interface City {
  readonly code: string;
  readonly name: string;
}

const cities = (): City[] => [
  { code: 'BER', name: 'Berlin' },
  { code: 'PAR', name: 'Paris' },
  { code: 'LIS', name: 'Lisbon' },
];

@Component({
  imports: [StarMultiSelect],
  template: `
    <star-multi-select
      [options]="options()"
      optionLabel="name"
      optionValue="code"
      [(value)]="codes"
      display="chip"
      ariaLabel="Cities"
    />
  `,
})
class Host {
  readonly options = signal<readonly City[]>(cities());
  readonly codes = signal<readonly string[]>(['BER', 'LIS']);
}

describe('multi-select chip keys', () => {
  it('keeps the chip rows when the options are new objects with the same values', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const chips = () => [...el.querySelectorAll<HTMLElement>('[data-star-part=chipPanel]')];
    const before = chips();
    expect(before.map((chip) => chip.textContent?.trim())).toEqual(['Berlin', 'Lisbon']);

    fixture.componentInstance.options.set(cities());
    await fixture.whenStable();
    const after = chips();
    // The same nodes: no chip was destroyed (no leave motion, no second row of chips).
    expect(after).toHaveLength(2);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(el.querySelectorAll('.star-chip--leaving')).toHaveLength(0);

    fixture.componentInstance.codes.set(['LIS']);
    await fixture.whenStable();
    expect(chips()).toEqual([before[1]]);
  });
});
