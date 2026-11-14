import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideStarUiText,
  provideStarUiTextFromSignal,
  STAR_UI_TEXT,
  STAR_UI_TEXT_DEFAULTS,
  StarUiText,
  starUiTextFromSignal,
} from 'star-ng/core';
import { STAR_UI_TEXT_DE } from 'star-ng/i18n/de';
import { STAR_UI_TEXT_ES } from 'star-ng/i18n/es';
import { StarPaginator } from 'star-ng/paginator';
import { StarPassword } from 'star-ng/password';

type Language = 'en' | 'de' | 'es';
const PACKS: Record<Language, StarUiText> = {
  en: STAR_UI_TEXT_DEFAULTS,
  de: STAR_UI_TEXT_DE,
  es: STAR_UI_TEXT_ES,
};

@Component({
  imports: [StarPaginator, StarPassword],
  template: `
    <star-paginator [totalRecords]="95" />
    <star-password value="abc" feedback />
  `,
})
class Host {}

describe('provideStarUiText with a language pack', () => {
  it('accepts a full pack', () => {
    TestBed.configureTestingModule({ providers: [provideStarUiText(STAR_UI_TEXT_DE)] });
    const text = TestBed.inject(STAR_UI_TEXT);
    expect(text.close).toBe('Schließen');
    expect(text.pageReport(1, 10, 95)).toBe('1–10 von 95');
  });

  it('lets a pack be changed in single entries', () => {
    TestBed.configureTestingModule({
      providers: [provideStarUiText({ ...STAR_UI_TEXT_DE, close: 'Zumachen' })],
    });
    expect(TestBed.inject(STAR_UI_TEXT).close).toBe('Zumachen');
    expect(TestBed.inject(STAR_UI_TEXT).loading).toBe('Wird geladen');
  });
});

describe('provideStarUiTextFromSignal', () => {
  const language = signal<Language>('en');
  beforeEach(() => {
    language.set('en');
    TestBed.configureTestingModule({
      providers: [provideStarUiTextFromSignal(() => PACKS[language()])],
    });
  });

  it('reads the signal on every access', () => {
    const text = TestBed.inject(STAR_UI_TEXT);
    expect(text.close).toBe('Close');
    expect(text.selectedItems(2)).toBe('2 items selected');
    language.set('es');
    expect(text.close).toBe('Cerrar');
    expect(text.selectedItems(2)).toBe('2 elementos seleccionados');
  });

  it('re-renders OnPush controls when the signal changes', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const nav = () => el.querySelector('star-paginator nav')!.getAttribute('aria-label');
    const report = () => el.querySelector('.star-paginator__report')!.textContent!.trim();
    const firstRule = () => el.querySelector('.star-password__rules li')!.textContent!.trim();
    expect(nav()).toBe('Pagination');
    expect(report()).toBe('1–10 of 95');
    expect(firstRule()).toContain('At least 12 characters');

    language.set('de');
    await fixture.whenStable();
    expect(nav()).toBe('Seitennavigation');
    expect(report()).toBe('1–10 von 95');
    expect(firstRule()).toContain('Mindestens 12 Zeichen');

    language.set('es');
    await fixture.whenStable();
    expect(nav()).toBe('Paginación');
    expect(report()).toBe('1–10 de 95');
    expect(firstRule()).toContain('Al menos 12 caracteres');
  });
});

describe('starUiTextFromSignal', () => {
  it('falls back to English for entries that the source does not have', () => {
    const partial = signal<Partial<StarUiText>>({ close: 'Zu' });
    const text = starUiTextFromSignal(partial);
    expect(text.close).toBe('Zu');
    expect(text.clear).toBe('Clear');
    expect(text.page(3)).toBe('Page 3');
    partial.set({ page: (page) => `S. ${page}` });
    expect(text.close).toBe('Close');
    expect(text.page(3)).toBe('S. 3');
  });
});
