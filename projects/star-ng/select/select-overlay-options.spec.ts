import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAutoComplete } from '@star-ng/ui/autocomplete';
import { StarMultiSelect } from './multi-select';
import { StarSelect } from './select';

@Component({
  imports: [StarSelect, StarMultiSelect, StarAutoComplete],
  template: `
    <star-select
      [options]="cities"
      [(value)]="city"
      ariaLabel="City"
      panelClass="orders-panel"
      [panelStyle]="{ 'min-width': '20rem' }"
      [appendTo]="appendTo()"
    />
    <star-multi-select
      [options]="cities"
      [(value)]="many"
      ariaLabel="Cities"
      [panelClass]="['a-panel', 'b-panel']"
      appendTo="body"
    />
    <star-autocomplete
      [options]="cities"
      [(value)]="found"
      ariaLabel="Find city"
      panelClass="find-panel"
      dropdown
    />
  `,
})
class Host {
  readonly cities = ['Berlin', 'Paris'];
  readonly city = signal<string | null>(null);
  readonly many = signal<readonly string[]>([]);
  readonly found = signal<string | null>(null);
  readonly appendTo = signal<'self' | 'body'>('self');
}

describe('overlay options', () => {
  afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((n) => n.remove()));

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, host: fixture.componentInstance, el };
  }

  it('select: panelClass and panelStyle go on the panel', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLElement>('star-select [role=combobox]')!.click();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('.star-panel.orders-panel')!;
    expect(panel).toBeTruthy();
    expect(panel.style.minWidth).toBe('20rem');
    // jsdom has no native popover, so the CDK puts both locations in the overlay container; the
    // inline location next to the control is checked in the browser (e2e).
  });

  it('appendTo body: the panel is in the overlay container', async () => {
    const { fixture, host, el } = await setup();
    host.appendTo.set('body');
    await fixture.whenStable();
    el.querySelector<HTMLElement>('star-select [role=combobox]')!.click();
    await fixture.whenStable();
    const panel = document.querySelector<HTMLElement>('.star-panel.orders-panel')!;
    expect(panel.closest('.cdk-overlay-container')).not.toBeNull();
    expect(el.contains(panel)).toBe(false);
  });

  it('multi-select and autocomplete take the options too', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLElement>('star-multi-select [role=combobox]')!.click();
    await fixture.whenStable();
    const multi = document.querySelector<HTMLElement>('.star-panel.a-panel.b-panel')!;
    expect(multi.closest('.cdk-overlay-container')).not.toBeNull();
    el.querySelector<HTMLButtonElement>('star-autocomplete .star-select__icon-btn')!.click();
    await fixture.whenStable();
    expect(document.querySelector('.star-panel.find-panel')).not.toBeNull();
  });
});
