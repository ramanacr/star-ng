import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, computed, effect, inject, signal } from '@angular/core';

/** `'system'` follows the operating system setting (`prefers-color-scheme`). */
export type StarThemeMode = 'system' | 'light' | 'dark';

/** Default `localStorage` key of the saved theme choice. */
export const STAR_THEME_DEFAULT_STORAGE_KEY = 'star-theme';

/**
 * `localStorage` key of the saved theme choice. Provide another value when two applications
 * on one origin must keep separate choices. The first-paint script must use the same key.
 */
export const STAR_THEME_STORAGE_KEY = new InjectionToken<string>('STAR_THEME_STORAGE_KEY', {
  providedIn: 'root',
  factory: () => STAR_THEME_DEFAULT_STORAGE_KEY,
});

const MODES: readonly StarThemeMode[] = ['system', 'light', 'dark'];

/**
 * Color theme of the application. The StarNG tokens change with `data-theme` on `<html>`
 * (`star-ng/styles/_tokens.scss`); this service sets that attribute and remembers the choice
 * in the browser (`localStorage`). Inject it in the root component, so the theme applies on
 * every page.
 *
 * The service is optional: an application that has one fixed theme does not need it.
 */
@Injectable({ providedIn: 'root' })
export class StarThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = inject(STAR_THEME_STORAGE_KEY);
  private readonly view = this.document.defaultView;
  private readonly systemQuery = this.view?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;
  private readonly systemDark = signal(this.systemQuery?.matches ?? false);

  /** The user's choice. */
  readonly mode = signal<StarThemeMode>(this.stored());
  /** The theme in use now: `'system'` resolved to light or dark. */
  readonly theme = computed<'light' | 'dark'>(() => {
    const mode = this.mode();
    if (mode === 'system') return this.systemDark() ? 'dark' : 'light';
    return mode;
  });

  constructor() {
    this.systemQuery?.addEventListener?.('change', (event) => this.systemDark.set(event.matches));
    effect(() => this.document.documentElement.setAttribute('data-theme', this.theme()));
  }

  setMode(mode: StarThemeMode): void {
    this.mode.set(mode);
    try {
      this.view?.localStorage.setItem(this.storageKey, mode);
    } catch {
      // Storage can be blocked (private mode): the choice then lasts for this visit only.
    }
  }

  private stored(): StarThemeMode {
    try {
      const value = this.view?.localStorage.getItem(this.storageKey);
      return MODES.includes(value as StarThemeMode) ? (value as StarThemeMode) : 'system';
    } catch {
      return 'system';
    }
  }
}
