import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete } from '@star-ng/ui/autocomplete';
import { StarLazyLoadEvent } from '@star-ng/ui/core';
import { StarListbox } from '@star-ng/ui/listbox';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';

interface Order {
  id: number;
  name: string;
}

const TOTAL = 200;

/** Fills the array with orders from `first` to `last`. */
function load(
  rows: readonly (Order | undefined)[],
  event: StarLazyLoadEvent,
): (Order | undefined)[] {
  const next = [...rows];
  for (let i = event.first; i <= event.last && i < TOTAL; i++) {
    next[i] = { id: i, name: `Order ${i}` };
  }
  return next;
}

@Component({
  imports: [StarSelect, StarMultiSelect, StarAutoComplete, StarListbox],
  template: `
    <star-select
      [options]="rows()"
      optionLabel="name"
      optionValue="id"
      [(value)]="order"
      lazy
      virtualScroll
      filter
      ariaLabel="Order"
      (lazyLoad)="events.push($event)"
    />
    <star-multi-select
      [options]="rows()"
      optionLabel="name"
      optionValue="id"
      [(value)]="orders"
      lazy
      virtualScroll
      ariaLabel="Orders"
      (lazyLoad)="events.push($event)"
    />
    <star-autocomplete
      [options]="rows()"
      optionLabel="name"
      optionValue="id"
      [(value)]="found"
      lazy
      virtualScroll
      ariaLabel="Find order"
      (lazyLoad)="events.push($event)"
    />
    <star-listbox
      [options]="rows()"
      optionLabel="name"
      optionValue="id"
      [(value)]="listed"
      lazy
      filter
      ariaLabel="Order list"
      (lazyLoad)="listEvents.push($event)"
    />
  `,
})
class Host {
  readonly rows = signal<readonly (Order | undefined)[]>(Array.from({ length: TOTAL }));
  readonly order = signal<number | null>(null);
  readonly orders = signal<readonly number[]>([]);
  readonly found = signal<number | null>(null);
  readonly listed = signal<number | readonly number[] | null>(null);
  readonly events: StarLazyLoadEvent[] = [];
  readonly listEvents: StarLazyLoadEvent[] = [];
}

function key(target: Element, name: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

describe('lazy loading', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const triggers = el.querySelectorAll<HTMLElement>('[role=combobox]');
    return { fixture, host: fixture.componentInstance, el, triggers };
  }

  it('select: asks for the rows in view and shows loading rows until they come', async () => {
    const { fixture, host, triggers } = await setup();
    expect(host.events).toEqual([]);
    triggers[0].click();
    await fixture.whenStable();
    expect(host.events.length).toBe(1);
    expect(host.events[0]).toEqual(expect.objectContaining({ first: 0, filter: '' }));
    const list = document.querySelector('.star-panel [role=listbox]')!;
    expect(list.getAttribute('aria-busy')).toBe('true');
    const first = document.querySelector('.star-panel [role=option]')!;
    expect(first.getAttribute('aria-disabled')).toBe('true');
    expect(first.classList).toContain('star-listbox__option--loading');
    expect(first.textContent).toContain('Loading');

    host.rows.update((rows) => load(rows, host.events[0]));
    await fixture.whenStable();
    expect(list.getAttribute('aria-busy')).toBeNull();
    expect(document.querySelector('.star-panel [role=option]')!.textContent?.trim()).toBe(
      'Order 0',
    );
  });

  it('select: the keyboard skips options that are not loaded', async () => {
    const { fixture, host, triggers } = await setup();
    host.rows.update((rows) => {
      const next = [...rows];
      next[0] = { id: 0, name: 'Order 0' };
      next[2] = { id: 2, name: 'Order 2' };
      return next;
    });
    await fixture.whenStable();
    triggers[0].click();
    await fixture.whenStable();
    const input = document.querySelector<HTMLInputElement>(
      '.star-panel .star-panel__filter input',
    )!;
    input.focus();
    await fixture.whenStable();
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-0$/);
    key(input, 'ArrowDown');
    await fixture.whenStable();
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-2$/);
  });

  it('select: the filter text goes to the event and does not filter in the browser', async () => {
    const { fixture, host, triggers } = await setup();
    triggers[0].click();
    await fixture.whenStable();
    const input = document.querySelector<HTMLInputElement>(
      '.star-panel .star-panel__filter input',
    )!;
    input.value = 'Order 5';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.events.at(-1)).toEqual(expect.objectContaining({ first: 0, filter: 'Order 5' }));
    expect(document.querySelectorAll('.star-panel [role=option]').length).toBeGreaterThan(1);
  });

  it('multi-select and autocomplete ask for rows too', async () => {
    const { fixture, host, triggers } = await setup();
    triggers[1].click();
    await fixture.whenStable();
    expect(host.events.length).toBe(1);
    key(triggers[1], 'Escape');
    await fixture.whenStable();

    const input = triggers[2] as HTMLInputElement;
    input.value = 'Ord';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(host.events.at(-1)).toEqual(expect.objectContaining({ first: 0, filter: 'Ord' }));
  });

  it('listbox: asks for rows, marks the list busy and skips loading rows by keyboard', async () => {
    const { fixture, host, el } = await setup();
    expect(host.listEvents.length).toBe(1);
    const list = el.querySelector<HTMLElement>('star-listbox [role=listbox]')!;
    expect(list.getAttribute('aria-busy')).toBe('true');

    host.rows.update((rows) => {
      const next = rows.map((_, i) => (i % 2 ? undefined : { id: i, name: `Order ${i}` }));
      return next;
    });
    await fixture.whenStable();
    list.focus();
    list.dispatchEvent(new FocusEvent('focus'));
    await fixture.whenStable();
    key(list, 'ArrowDown');
    await fixture.whenStable();
    expect(list.getAttribute('aria-activedescendant')).toMatch(/-2$/);
    expect(host.listed()).toBe(2);
  });
});
