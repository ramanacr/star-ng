import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarListbox } from '@star-ng/ui/listbox';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';

interface Order {
  id: number;
  name: string;
  region: string;
}

/** Function accessors: they must never see an option that is not loaded (`undefined`). */
const id = (o: Order) => o.id;
const label = (o: Order) => o.name;
const region = (o: Order) => o.region;

@Component({
  imports: [StarSelect, StarMultiSelect, StarListbox],
  template: `
    <star-select
      [options]="rows()"
      [optionLabel]="label"
      [optionValue]="id"
      [optionGroup]="region"
      [(value)]="order"
      lazy
      virtualScroll
      ariaLabel="Order"
    />
    <star-multi-select
      [options]="rows()"
      [optionLabel]="label"
      [optionValue]="id"
      [optionGroup]="region"
      [(value)]="orders"
      lazy
      virtualScroll
      ariaLabel="Orders"
    />
    <star-listbox
      [options]="rows()"
      [optionLabel]="label"
      [optionValue]="id"
      [optionGroup]="region"
      [(value)]="listed"
      lazy
      ariaLabel="Order list"
    />
  `,
})
class Host {
  readonly label = label;
  readonly id = id;
  readonly region = region;
  /** Two loaded orders between rows that are not loaded. */
  readonly rows = signal<readonly (Order | undefined)[]>(
    Array.from({ length: 30 }, (_, i) =>
      i === 1 || i === 3 ? { id: i, name: `Order ${i}`, region: 'North' } : undefined,
    ),
  );
  readonly order = signal<number | null>(3);
  readonly orders = signal<readonly number[]>([1]);
  readonly listed = signal<number | readonly number[] | null>([3]);
}

describe('lazy rows with function accessors', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  it('select, multi-select and listbox render loading rows without calling the accessors', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const [single, multi] = [...el.querySelectorAll<HTMLElement>('[role=combobox]')];
    expect(single.textContent).toContain('Order 3');
    expect(multi.textContent).toContain('Order 1');

    single.click();
    await fixture.whenStable();
    const panel = document.querySelector('.star-panel')!;
    expect(panel.querySelectorAll('.star-listbox__option--loading').length).toBeGreaterThan(0);
    expect(panel.querySelector('[aria-selected=true]')?.textContent?.trim()).toBe('Order 3');
    single.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    multi.click();
    await fixture.whenStable();
    // Virtual scroll draws only a window of the rows.
    expect(
      document.querySelectorAll('.star-panel .star-listbox__option--loading').length,
    ).toBeGreaterThan(0);
    multi.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await fixture.whenStable();

    const list = el.querySelector('star-listbox [role=listbox]')!;
    expect(list.querySelectorAll('.star-listbox__option--loading').length).toBe(28);
    expect(list.querySelector('[aria-selected=true]')?.textContent?.trim()).toBe('Order 3');
  });
});
