import { TestBed } from '@angular/core/testing';
import { starBreakpointValue, starViewportWidth } from '@star-ng/ui/core';

describe('starBreakpointValue', () => {
  const map = { '960px': '75vw', '640px': '100vw', '40rem': 'rem' };

  it('picks the smallest max-width that is not below the window width', () => {
    expect(starBreakpointValue({ '960px': '75vw', '640px': '100vw' }, 1200)).toBeUndefined();
    expect(starBreakpointValue({ '960px': '75vw', '640px': '100vw' }, 960)).toBe('75vw');
    expect(starBreakpointValue({ '960px': '75vw', '640px': '100vw' }, 700)).toBe('75vw');
    expect(starBreakpointValue({ '960px': '75vw', '640px': '100vw' }, 320)).toBe('100vw');
  });

  it('reads rem and em keys as 16 pixels, and gives nothing without a width or a map', () => {
    expect(starBreakpointValue({ '40rem': 'narrow' }, 640)).toBe('narrow');
    expect(starBreakpointValue({ '40em': 'narrow' }, 641)).toBeUndefined();
    expect(starBreakpointValue(map, null)).toBeUndefined();
    expect(starBreakpointValue(null, 300)).toBeUndefined();
  });
});

describe('starViewportWidth', () => {
  it('follows the window width', () => {
    const width = TestBed.runInInjectionContext(() => starViewportWidth());
    expect(width()).toBe(window.innerWidth);
    const before = window.innerWidth;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 500 });
    window.dispatchEvent(new Event('resize'));
    expect(width()).toBe(500);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: before });
    window.dispatchEvent(new Event('resize'));
  });
});
