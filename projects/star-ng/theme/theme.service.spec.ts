import { TestBed } from '@angular/core/testing';
import { StarThemeService } from './theme.service';

describe('StarThemeService', () => {
  let listener: ((event: { matches: boolean }) => void) | null;
  let systemDark: boolean;

  beforeEach(() => {
    localStorage.clear();
    listener = null;
    systemDark = false;
    window.matchMedia = ((query: string) => ({
      matches: systemDark,
      media: query,
      addEventListener: (_type: string, handler: (event: { matches: boolean }) => void) => {
        listener = handler;
      },
    })) as unknown as typeof window.matchMedia;
  });

  const theme = () => document.documentElement.getAttribute('data-theme');

  it('follows the system setting by default and reacts when it changes', () => {
    systemDark = true;
    const service = TestBed.inject(StarThemeService);
    TestBed.tick();
    expect(service.mode()).toBe('system');
    expect(theme()).toBe('dark');

    listener?.({ matches: false });
    TestBed.tick();
    expect(theme()).toBe('light');
  });

  it('applies and remembers an explicit choice', () => {
    const service = TestBed.inject(StarThemeService);
    service.setMode('dark');
    TestBed.tick();
    expect(theme()).toBe('dark');
    expect(localStorage.getItem('star-theme')).toBe('dark');

    // The system setting does not change an explicit choice.
    listener?.({ matches: false });
    TestBed.tick();
    expect(theme()).toBe('dark');
  });

  it('starts with the stored choice and ignores an unknown stored value', () => {
    localStorage.setItem('star-theme', 'light');
    systemDark = true;
    expect(TestBed.inject(StarThemeService).mode()).toBe('light');

    TestBed.resetTestingModule();
    localStorage.setItem('star-theme', 'sepia');
    expect(TestBed.inject(StarThemeService).mode()).toBe('system');
  });
});
