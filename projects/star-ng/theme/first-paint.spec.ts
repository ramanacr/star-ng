import { starThemeFirstPaintScript } from './first-paint';

describe('starThemeFirstPaintScript', () => {
  const run = (script: string) => new Function(script)();
  const theme = () => document.documentElement.getAttribute('data-theme');

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
    })) as unknown as typeof window.matchMedia;
  });

  it('uses the system setting when no choice is saved', () => {
    run(starThemeFirstPaintScript());
    expect(theme()).toBe('dark');
  });

  it('uses the saved choice', () => {
    localStorage.setItem('star-theme', 'light');
    run(starThemeFirstPaintScript());
    expect(theme()).toBe('light');
  });

  it('reads a custom storage key', () => {
    localStorage.setItem('my-app-theme', 'light');
    run(starThemeFirstPaintScript('my-app-theme'));
    expect(theme()).toBe('light');
  });
});
