import { TestBed } from '@angular/core/testing';
import { StarThemeService } from '@star-ng/ui/theme';
import { StarThemeSwitch } from '@star-ng/ui/theme-switch';

describe('StarThemeSwitch', () => {
  beforeEach(() => {
    localStorage.clear();
    window.matchMedia = (() => ({
      matches: false,
      addEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
  });

  async function setup() {
    const fixture = TestBed.createComponent(StarThemeSwitch);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const fab = () => el.querySelector<HTMLButtonElement>('.star-speed-dial__fab')!;
    const actions = () => [...el.querySelectorAll<HTMLButtonElement>('.star-speed-dial__action')];
    return { fixture, el, fab, actions, service: TestBed.inject(StarThemeService) };
  }

  it('offers System, Light and Dark and marks the current mode', async () => {
    const { fixture, actions, service } = await setup();
    expect(actions().map((item) => item.getAttribute('aria-label'))).toEqual([
      'System',
      'Light',
      'Dark',
    ]);
    expect(actions().map((item) => item.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);

    service.setMode('light');
    await fixture.whenStable();
    expect(actions().map((item) => item.getAttribute('aria-pressed'))).toEqual([
      'false',
      'true',
      'false',
    ]);
  });

  it('calls the theme service when an item is chosen', async () => {
    const { fixture, fab, actions, service } = await setup();
    fab().click();
    await fixture.whenStable();
    actions()[2].click();
    await fixture.whenStable();
    expect(service.mode()).toBe('dark');
    expect(localStorage.getItem('star-theme')).toBe('dark');
  });

  it('names the button with the label and the current mode', async () => {
    const { fixture, fab, service } = await setup();
    expect(fab().getAttribute('aria-label')).toBe('Theme: System');
    service.setMode('dark');
    await fixture.whenStable();
    expect(fab().getAttribute('aria-label')).toBe('Theme: Dark');
    expect(fab().querySelector('i')?.className).toContain('ph-moon');
  });
});
