import { DOCUMENT } from '@angular/common';
import {
  ApplicationRef,
  createEnvironmentInjector,
  EnvironmentInjector,
  Injector,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  injectStarConfig,
  provideStarNg,
  STAR_CONFIG,
  STAR_UI_TEXT,
  STAR_UI_TEXT_DEFAULTS,
  StarConfigService,
  starConfigSize,
  StarDirectionService,
} from '@star-ng/ui/core';
import { STAR_THEME_STORAGE_KEY } from '@star-ng/ui/theme';

describe('provideStarNg', () => {
  afterEach(() => {
    const root = document.documentElement;
    root.removeAttribute('data-star-motion');
    root.style.removeProperty('--star-z-index-base');
  });

  it('provides STAR_CONFIG and an empty config by default', () => {
    expect(TestBed.inject(STAR_CONFIG)).toEqual({});
    expect(TestBed.inject(StarConfigService).config()).toEqual({});
  });

  it('composes the UI text, theme storage key and direction providers', () => {
    TestBed.configureTestingModule({
      providers: [
        provideStarNg({
          uiText: { close: 'Zu' },
          themeStorageKey: 'app-theme',
          direction: true,
          inputVariant: 'filled',
        }),
      ],
    });
    expect(TestBed.inject(STAR_UI_TEXT).close).toBe('Zu');
    expect(TestBed.inject(STAR_UI_TEXT).clear).toBe(STAR_UI_TEXT_DEFAULTS.clear);
    expect(TestBed.inject(STAR_THEME_STORAGE_KEY)).toBe('app-theme');
    expect(TestBed.inject(STAR_CONFIG).inputVariant).toBe('filled');
    // The environment initializer starts the direction service.
    expect(TestBed.inject(Injector).get(StarDirectionService, null)).not.toBeNull();
  });

  it('keeps the defaults of the composed providers when the config does not set them', () => {
    TestBed.configureTestingModule({ providers: [provideStarNg({ size: 'small' })] });
    expect(TestBed.inject(STAR_UI_TEXT)).toBe(STAR_UI_TEXT_DEFAULTS);
    expect(TestBed.inject(STAR_THEME_STORAGE_KEY)).toBe('star-theme');
  });

  it('keeps a motion attribute and a z-index base that the application set itself', () => {
    const root = document.documentElement;
    root.setAttribute('data-star-motion', 'reduced');
    root.style.setProperty('--star-z-index-base', '3000');
    TestBed.inject(StarConfigService);
    TestBed.tick();
    expect(root.getAttribute('data-star-motion')).toBe('reduced');
    expect(root.style.getPropertyValue('--star-z-index-base')).toBe('3000');
  });

  it('sets the motion attribute and the z-index base on <html>, and follows update()', () => {
    TestBed.configureTestingModule({
      providers: [provideStarNg({ reducedMotion: 'always', overlay: { zIndexBase: 2000 } })],
    });
    TestBed.inject(ApplicationRef).tick();
    const root = TestBed.inject(DOCUMENT).documentElement;
    expect(root.getAttribute('data-star-motion')).toBe('reduced');
    expect(root.style.getPropertyValue('--star-z-index-base')).toBe('2000');

    const service = TestBed.inject(StarConfigService);
    service.update({ reducedMotion: 'system', overlay: { appendTo: 'body' } });
    TestBed.inject(ApplicationRef).tick();
    expect(root.hasAttribute('data-star-motion')).toBe(false);
    // `overlay` merges: the z-index base stays.
    expect(service.config().overlay).toEqual({ zIndexBase: 2000, appendTo: 'body' });
    expect(root.style.getPropertyValue('--star-z-index-base')).toBe('2000');
  });

  it('warns in dev mode when provideStarNg is below the root injector', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    TestBed.configureTestingModule({ providers: [provideStarNg({ size: 'small' })] });
    TestBed.inject(StarConfigService);
    expect(warn).not.toHaveBeenCalled();
    const child = createEnvironmentInjector(
      [provideStarNg({ size: 'large' })],
      TestBed.inject(EnvironmentInjector),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('below the root injector'));
    child.destroy();
    warn.mockRestore();
  });

  it('injectStarConfig reads the current config once', () => {
    TestBed.configureTestingModule({ providers: [provideStarNg({ locale: 'de' })] });
    TestBed.inject(StarConfigService).update({ filterMatchMode: 'startsWith' });
    const config = TestBed.runInInjectionContext(() => injectStarConfig());
    expect(config.locale).toBe('de');
    expect(config.filterMatchMode).toBe('startsWith');
  });
});

describe('starConfigSize', () => {
  it('maps the config size to the size names of a control', () => {
    expect(starConfigSize('small', 'md', ['sm', 'md'])).toBe('sm');
    expect(starConfigSize('medium', 'sm', ['sm', 'md'])).toBe('md');
    expect(starConfigSize('large', 'md', ['sm', 'md', 'lg'])).toBe('lg');
  });

  it('falls back when the control has no such size or the config sets none', () => {
    expect(starConfigSize('large', 'md', ['sm', 'md'])).toBe('md');
    expect(starConfigSize(undefined, 'md', ['sm', 'md'])).toBe('md');
  });
});
