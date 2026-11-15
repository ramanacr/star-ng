import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { STAR_UI_TEXT, STAR_UI_TEXT_DEFAULTS } from '@star-ng/ui/core';
import { StarPaginator } from '@star-ng/ui/paginator';
import { StarPassword } from '@star-ng/ui/password';
import { provideStarUiTextFromTransloco } from './transloco-ui-text';

@Component({
  imports: [StarPaginator, StarPassword],
  template: `
    <star-paginator [totalRecords]="95" />
    <star-password value="abc" feedback />
  `,
})
class Host {}

describe('provideStarUiTextFromTransloco', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: {
            en: { ui: { pagination: 'Pagination' } },
            de: {
              ui: {
                pagination: 'Seitennavigation',
                pageReport: '{{ first }}–{{ last }} von {{ total }}',
                passwordRuleLength: 'Mindestens {{ min }} Zeichen',
              },
            },
          },
          translocoConfig: { availableLangs: ['en', 'de'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideStarUiTextFromTransloco()],
    });
  });

  it('falls back to the English defaults for keys a language does not have', () => {
    const text = TestBed.inject(STAR_UI_TEXT);
    expect(text.pagination).toBe('Pagination');
    expect(text.close).toBe(STAR_UI_TEXT_DEFAULTS.close);
    expect(text.pageReport(1, 10, 95)).toBe('1–10 of 95');
  });

  it('re-renders OnPush controls with the new language, including parameters', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const nav = () => el.querySelector('star-paginator nav')!;
    const report = () => el.querySelector('.star-paginator__report')!.textContent!.trim();
    const firstRule = () => el.querySelector('.star-password__rules li')!.textContent!.trim();
    expect(nav().getAttribute('aria-label')).toBe('Pagination');
    expect(report()).toBe('1–10 of 95');
    expect(firstRule()).toContain('At least 12 characters');

    TestBed.inject(TranslocoService).setActiveLang('de');
    await fixture.whenStable();
    expect(nav().getAttribute('aria-label')).toBe('Seitennavigation');
    expect(report()).toBe('1–10 von 95');
    expect(firstRule()).toContain('Mindestens 12 Zeichen');
  });
});
