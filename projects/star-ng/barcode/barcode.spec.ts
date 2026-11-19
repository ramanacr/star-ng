import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarBarcode, StarBarcodeType } from '@star-ng/ui/barcode';

@Component({
  imports: [StarBarcode],
  template: `<star-barcode
    [value]="value()"
    [type]="type()"
    [showText]="showText()"
    [barHeight]="40"
    [moduleWidth]="moduleWidth()"
    (invalid)="events.push($event)"
  />`,
})
class Host {
  readonly value = signal('PJJ123C');
  readonly type = signal<StarBarcodeType>('code128');
  readonly showText = signal(true);
  readonly moduleWidth = signal(2);
  readonly events: boolean[] = [];
}

async function setup(platform?: string) {
  if (platform) {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  }
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('star-barcode')!;
  return { fixture, host, state: fixture.componentInstance };
}

describe('StarBarcode', () => {
  it('is an image labelled with the human-readable value', async () => {
    const { host } = await setup();
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('PJJ123C');
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('draws one rect per bar with the quiet zones and the module width', async () => {
    const { host } = await setup();
    // Start B, 7 data characters, check: 9 symbols of 3 bars, and a stop of 4 bars.
    const bars = host.querySelectorAll('.star-barcode__bar');
    expect(bars.length).toBe(9 * 3 + 4);
    // 9 × 11 + 13 modules plus 2 × 10 quiet modules, 2 px each.
    const svg = host.querySelector('svg')!;
    expect(svg.getAttribute('width')).toBe(String((9 * 11 + 13 + 20) * 2));
    expect(bars[0].getAttribute('x')).toBe('20');
    expect(bars[0].getAttribute('width')).toBe('4');
    expect(bars[0].getAttribute('height')).toBe('40');
  });

  it('shows the text under the bars, or not', async () => {
    const { fixture, host, state } = await setup();
    expect(host.querySelector('.star-barcode__text')?.textContent).toBe('PJJ123C');
    state.showText.set(false);
    await fixture.whenStable();
    expect(host.querySelector('.star-barcode__text')).toBeNull();
    expect(host.querySelector('svg')?.getAttribute('height')).toBe('40');
  });

  it('shows the full EAN-13 number with the computed check digit', async () => {
    const { fixture, host, state } = await setup();
    state.type.set('ean13');
    state.value.set('590123412345');
    await fixture.whenStable();
    expect(host.getAttribute('aria-label')).toBe('5901234123457');
    expect(host.querySelector('.star-barcode__text')?.textContent).toBe('5901234123457');
    // 95 modules plus quiet zones of 11 and 7.
    expect(host.querySelector('svg')?.getAttribute('width')).toBe(String((95 + 18) * 2));
  });

  it('shows an error state and emits invalid for a value that cannot be encoded', async () => {
    const { fixture, host, state } = await setup();
    state.type.set('ean13');
    state.value.set('5901234123450');
    await fixture.whenStable();
    expect(host.classList).toContain('star-barcode--invalid');
    expect(host.querySelector('svg')).toBeNull();
    const error = host.querySelector('.star-barcode__error')!;
    expect(error.textContent?.trim()).toBe('The value cannot be encoded as EAN-13.');
    expect(host.getAttribute('aria-label')).toBe(error.textContent?.trim());
    expect(state.events).toEqual([true]);
    state.value.set('5901234123457');
    await fixture.whenStable();
    expect(host.classList).not.toContain('star-barcode--invalid');
    expect(state.events).toEqual([true, false]);
  });

  it('rounds the module width to whole pixels, at least 1', async () => {
    const { fixture, host, state } = await setup();
    const firstBar = () => host.querySelector('.star-barcode__bar')!;
    state.moduleWidth.set(2.6);
    await fixture.whenStable();
    expect(firstBar().getAttribute('x')).toBe('30');
    expect(firstBar().getAttribute('width')).toBe('6');
    state.moduleWidth.set(0.3);
    await fixture.whenStable();
    expect(firstBar().getAttribute('width')).toBe('2');
  });

  it('renders on the server', async () => {
    const { host } = await setup('server');
    expect(host.querySelectorAll('.star-barcode__bar').length).toBeGreaterThan(0);
  });
});
