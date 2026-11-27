import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { insertRefraction, provideStarGlassRefraction, refractionRenders } from './refraction';

function clean(): void {
  document.getElementById('star-glass-refraction-defs')?.remove();
  document.documentElement.removeAttribute('data-star-refraction');
}

describe('glass refraction filter', () => {
  beforeEach(clean);
  afterEach(clean);

  it('puts one hidden SVG with the two filters into the body', () => {
    insertRefraction(document, false);
    const svg = document.getElementById('star-glass-refraction-defs')!;
    expect(svg.parentElement).toBe(document.body);
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.style.position).toBe('absolute');
    const filters = [...svg.querySelectorAll('filter')];
    expect(filters.map((filter) => filter.id)).toEqual([
      'star-glass-refraction',
      'star-glass-refraction-rtl',
    ]);
    for (const filter of filters) {
      expect(filter.getAttribute('primitiveUnits')).toBe('objectBoundingBox');
      expect(filter.querySelector('feDisplacementMap')).not.toBeNull();
      // No image: the map is made of floods and blurs, so img-src of a CSP does not matter.
      expect(filter.querySelector('feImage')).toBeNull();
    }
    expect(document.documentElement.hasAttribute('data-star-refraction')).toBe(false);
  });

  it('mirrors the start band in right to left', () => {
    insertRefraction(document, false);
    const band = (id: string, result: string) =>
      Number(document.querySelector(`#${id} [result='${result}']`)!.getAttribute('width'));
    const ltr = 'star-glass-refraction';
    const rtl = 'star-glass-refraction-rtl';
    expect(band(ltr, 'x-low')).toBeGreaterThan(band(ltr, 'x-high'));
    expect(band(rtl, 'x-low')).toBe(band(ltr, 'x-high'));
    expect(band(rtl, 'x-high')).toBe(band(ltr, 'x-low'));
  });

  it('is idempotent and marks <html> only where the filter renders', () => {
    insertRefraction(document, true);
    insertRefraction(document, true);
    expect(document.querySelectorAll('#star-glass-refraction-defs')).toHaveLength(1);
    expect(document.querySelectorAll('filter#star-glass-refraction')).toHaveLength(1);
    expect(document.documentElement.hasAttribute('data-star-refraction')).toBe(true);
  });

  it('detects the engine from navigator.userAgentData', () => {
    const fake = (brands: { brand: string }[] | undefined) =>
      ({
        defaultView: {
          navigator: brands ? { userAgentData: { brands } } : {},
          CSS: { supports: () => true },
        },
      }) as unknown as Document;
    expect(refractionRenders(fake([{ brand: 'Chromium' }, { brand: 'Not.A/Brand' }]))).toBe(true);
    expect(refractionRenders(fake(undefined))).toBe(false);
    expect(refractionRenders(fake([{ brand: 'Other' }]))).toBe(false);
    expect(refractionRenders({ defaultView: null } as unknown as Document)).toBe(false);
  });

  it('the provider inserts the filter once in the browser', () => {
    TestBed.configureTestingModule({
      providers: [provideStarGlassRefraction(), provideStarGlassRefraction()],
    });
    TestBed.inject(DOCUMENT);
    expect(document.querySelectorAll('#star-glass-refraction-defs')).toHaveLength(1);
  });

  it('the provider does nothing on the server', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }, provideStarGlassRefraction()],
    });
    TestBed.inject(DOCUMENT);
    expect(document.getElementById('star-glass-refraction-defs')).toBeNull();
    expect(document.documentElement.hasAttribute('data-star-refraction')).toBe(false);
  });
});
