import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';

const CITIES = ['Berlin', 'Paris', 'Lisbon'];

@Component({
  imports: [StarSelect, StarMultiSelect],
  template: `
    <star-select
      [options]="cities"
      [(value)]="city"
      ariaLabel="City"
      [focusOnHover]="hover()"
      [selectOnFocus]="selectOnFocus()"
      [autoOptionFocus]="autoFocus()"
    />
    <star-multi-select
      [options]="cities"
      [(value)]="many"
      ariaLabel="Cities"
      [autoOptionFocus]="autoFocus()"
    />
  `,
})
class Host {
  readonly cities = CITIES;
  readonly city = signal<string | null>(null);
  readonly many = signal<readonly string[]>([]);
  readonly hover = signal(true);
  readonly selectOnFocus = signal(false);
  readonly autoFocus = signal(true);
}

function key(target: Element, name: string): void {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }),
  );
}

function panelOptions(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.star-panel [role=option]')];
}

describe('keyboard options of the option list', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const combos = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
      '[role=combobox]',
    );
    return { fixture, host: fixture.componentInstance, combos };
  }

  it('defaults: hover moves the active option, keys do not choose, the first option is active', async () => {
    const { fixture, host, combos } = await setup();
    combos[0].click();
    await fixture.whenStable();
    expect(combos[0].getAttribute('aria-activedescendant')).toBe(panelOptions()[0].id);
    panelOptions()[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await fixture.whenStable();
    expect(combos[0].getAttribute('aria-activedescendant')).toBe(panelOptions()[2].id);
    key(combos[0], 'ArrowUp');
    await fixture.whenStable();
    expect(host.city()).toBeNull();
  });

  it('focusOnHover off: the pointer does not move the active option', async () => {
    const { fixture, host, combos } = await setup();
    host.hover.set(false);
    await fixture.whenStable();
    combos[0].click();
    await fixture.whenStable();
    panelOptions()[2].dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    await fixture.whenStable();
    expect(combos[0].getAttribute('aria-activedescendant')).toBe(panelOptions()[0].id);
  });

  it('selectOnFocus: a key move chooses the option and keeps the panel open', async () => {
    const { fixture, host, combos } = await setup();
    host.selectOnFocus.set(true);
    await fixture.whenStable();
    combos[0].click();
    await fixture.whenStable();
    key(combos[0], 'ArrowDown');
    await fixture.whenStable();
    expect(host.city()).toBe('Paris');
    expect(combos[0].getAttribute('aria-expanded')).toBe('true');
    key(combos[0], 'End');
    await fixture.whenStable();
    expect(host.city()).toBe('Lisbon');
  });

  it('autoOptionFocus off: no option is active until a key moves', async () => {
    const { fixture, host, combos } = await setup();
    host.autoFocus.set(false);
    await fixture.whenStable();
    combos[0].click();
    await fixture.whenStable();
    expect(combos[0].hasAttribute('aria-activedescendant')).toBe(false);
    key(combos[0], 'ArrowDown');
    await fixture.whenStable();
    expect(combos[0].getAttribute('aria-activedescendant')).toBe(panelOptions()[0].id);
    key(combos[0], 'Escape');
    await fixture.whenStable();

    combos[1].click();
    await fixture.whenStable();
    expect(combos[1].hasAttribute('aria-activedescendant')).toBe(false);
  });
});
