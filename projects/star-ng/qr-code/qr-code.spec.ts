import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarQrCode, StarQrErrorCorrection, starEncodeQr } from '@star-ng/ui/qr-code';

@Component({
  imports: [StarQrCode],
  template: `<star-qr-code
    [value]="value()"
    [errorCorrection]="level()"
    [size]="200"
    [image]="image()"
    [foreground]="foreground()"
    [ariaLabel]="label()"
  />`,
})
class Host {
  readonly value = signal('https://example.com/orders/1042');
  readonly level = signal<StarQrErrorCorrection>('M');
  readonly image = signal<string | null>(null);
  readonly foreground = signal<string | null>(null);
  readonly label = signal<string | null>(null);
}

async function setup(platform?: string) {
  if (platform) {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: platform }] });
  }
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  const host = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('star-qr-code')!;
  return { fixture, host, state: fixture.componentInstance };
}

/** Number of dark modules drawn by the path (each subpath is `M x y h n v 1 h -n z`). */
function darkModules(path: string): number {
  return [...path.matchAll(/h(\d+)v1/g)].reduce((sum, match) => sum + Number(match[1]), 0);
}

function count(modules: boolean[][]): number {
  return modules.flat().filter(Boolean).length;
}

describe('StarQrCode', () => {
  it('is an image labelled "QR code: value"', async () => {
    const { host } = await setup();
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('QR code: https://example.com/orders/1042');
    expect(host.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('shortens a long value in the label', async () => {
    const { fixture, host, state } = await setup();
    state.value.set('https://example.com/' + 'a'.repeat(200));
    await fixture.whenStable();
    const label = host.getAttribute('aria-label')!;
    expect(label.length).toBeLessThanOrEqual('QR code: '.length + 81);
    expect(label.endsWith('…')).toBe(true);
    state.label.set('Order link');
    await fixture.whenStable();
    expect(host.getAttribute('aria-label')).toBe('Order link');
  });

  it('cuts the label on whole characters', async () => {
    const { fixture, host, state } = await setup();
    state.value.set('a'.repeat(79) + '😀' + 'b'.repeat(10));
    await fixture.whenStable();
    expect(host.getAttribute('aria-label')).toBe('QR code: ' + 'a'.repeat(79) + '😀…');
  });

  it('renders nothing for an empty value', async () => {
    const { fixture, host, state } = await setup();
    state.value.set('');
    await fixture.whenStable();
    expect(host.querySelector('svg')).toBeNull();
    expect(host.querySelector('.star-qr-code__error')).toBeNull();
    expect(host.hasAttribute('role')).toBe(false);
    expect(host.hasAttribute('aria-label')).toBe(false);
    expect(host.classList).not.toContain('star-qr-code--invalid');
  });

  it('draws the dark modules as one path with a quiet zone of 4 modules', async () => {
    const { host } = await setup();
    const modules = starEncodeQr('https://example.com/orders/1042');
    const paths = host.querySelectorAll('.star-qr-code__modules');
    expect(paths.length).toBe(1);
    expect(darkModules(paths[0].getAttribute('d')!)).toBe(count(modules));
    const svg = host.querySelector('svg')!;
    const side = modules.length + 8;
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${side} ${side}`);
    expect(svg.getAttribute('width')).toBe('200');
    // The first dark module is the corner of the upper left finder pattern, at (4, 4).
    expect(paths[0].getAttribute('d')!.startsWith('M4 4h7v1h-7z')).toBe(true);
  });

  it('uses the chosen error correction level, and H with a centre image', async () => {
    const { fixture, host, state } = await setup();
    const path = () => host.querySelector('.star-qr-code__modules')!.getAttribute('d')!;
    const value = 'https://example.com/orders/1042';
    state.level.set('L');
    await fixture.whenStable();
    expect(darkModules(path())).toBe(count(starEncodeQr(value, { errorCorrection: 'L' })));
    state.image.set('logo.svg');
    await fixture.whenStable();
    expect(darkModules(path())).toBe(count(starEncodeQr(value, { errorCorrection: 'H' })));
    const image = host.querySelector('.star-qr-code__image')!;
    expect(image.getAttribute('href')).toBe('logo.svg');
    expect(host.querySelector('.star-qr-code__image-backdrop')).not.toBeNull();
  });

  it('takes the colours from tokens or from the inputs', async () => {
    const { fixture, host, state } = await setup();
    expect(host.style.getPropertyValue('--star-code-dark')).toBe('');
    state.foreground.set('var(--star-primary)');
    await fixture.whenStable();
    expect(host.style.getPropertyValue('--star-code-dark')).toBe('var(--star-primary)');
  });

  it('shows an error when the value is too long', async () => {
    const { fixture, host, state } = await setup();
    state.value.set('x'.repeat(3000));
    await fixture.whenStable();
    expect(host.querySelector('svg')).toBeNull();
    expect(host.classList).toContain('star-qr-code--invalid');
    const error = host.querySelector('.star-qr-code__error')!;
    expect(error.textContent?.trim()).toBe('The value is too long for a QR code.');
    expect(host.getAttribute('aria-label')).toBe('The value is too long for a QR code.');
  });

  it('renders on the server', async () => {
    const { host } = await setup('server');
    expect(host.querySelector('.star-qr-code__modules')?.getAttribute('d')).toMatch(/^M4 4/);
  });
});
