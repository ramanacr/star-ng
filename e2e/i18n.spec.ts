import { expect, Locator, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

interface Texts {
  readonly language: string;
  readonly navigation: string;
  readonly next: string;
  readonly report: string;
  readonly placeholder: string;
  readonly filter: string;
  readonly noResults: string;
  readonly choose: string;
  readonly limit: string;
  readonly show: string;
  readonly rule: string;
}

const ENGLISH: Texts = {
  language: 'English',
  navigation: 'Pagination',
  next: 'Next page',
  report: '1–10 of 95',
  placeholder: 'Select',
  filter: 'Search',
  noResults: 'No results found',
  choose: 'Choose files',
  limit: 'up to 3 files',
  show: 'Show password',
  rule: 'At least 12 characters',
};

const GERMAN: Texts = {
  language: 'Deutsch',
  navigation: 'Seitennavigation',
  next: 'Nächste Seite',
  report: '1–10 von 95',
  placeholder: 'Auswählen',
  filter: 'Suchen',
  noResults: 'Keine Ergebnisse gefunden',
  choose: 'Dateien auswählen',
  limit: 'bis zu 3 Dateien',
  show: 'Passwort anzeigen',
  rule: 'Mindestens 12 Zeichen',
};

const SPANISH: Texts = {
  language: 'Español',
  navigation: 'Paginación',
  next: 'Página siguiente',
  report: '1–10 de 95',
  placeholder: 'Seleccionar',
  filter: 'Buscar',
  noResults: 'No se encontraron resultados',
  choose: 'Elegir archivos',
  limit: 'hasta 3 archivos',
  show: 'Mostrar contraseña',
  rule: 'Al menos 12 caracteres',
};

async function expectTexts(live: Locator, texts: Texts): Promise<void> {
  // Paginator: accessible names and the page report.
  await expect(live.getByRole('navigation', { name: texts.navigation })).toBeVisible();
  await expect(live.getByRole('button', { name: texts.next })).toBeVisible();
  await expect(live.locator('.star-paginator__report')).toHaveText(texts.report);
  // Select: the placeholder.
  await expect(
    live.locator('star-select:not(.star-paginator__select) .star-select__trigger'),
  ).toContainText(texts.placeholder);
  // File upload: the choose button and the limit hint.
  await expect(live.getByText(texts.choose, { exact: true })).toBeVisible();
  await expect(live.locator('.star-upload')).toContainText(texts.limit);
  // Password: the accessible name of the toggle and the first rule.
  await expect(live.getByRole('button', { name: texts.show })).toBeVisible();
  await expect(live.locator('.star-password__rules li').first()).toContainText(texts.rule);
}

test.describe('language packs', () => {
  test('the live example switches the built-in text of several controls', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/guides/i18n', 'Internationalisation');
    const live = example(page, 'Language switch');
    const languages = live.getByRole('radiogroup', { name: 'Language' });

    await expectTexts(live, ENGLISH);

    for (const texts of [GERMAN, SPANISH, ENGLISH]) {
      await languages.getByRole('radio', { name: texts.language }).click();
      await expect(languages.getByRole('radio', { name: texts.language })).toBeChecked();
      await expectTexts(live, texts);
    }
    expect(errors).toEqual([]);
  });

  test('the select shows the translated filter field and empty message', async ({ page }) => {
    await openPage(page, '/guides/i18n', 'Internationalisation');
    const live = example(page, 'Language switch');
    await live.getByRole('radio', { name: 'Deutsch' }).click();

    await live.locator('star-select:not(.star-paginator__select) .star-select__trigger').click();
    const search = page.getByRole('searchbox', { name: 'Suchen' });
    await expect(search).toBeVisible();
    await search.fill('zzz');
    await expect(page.getByText('Keine Ergebnisse gefunden')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('the page report follows the language', async ({ page }) => {
    await openPage(page, '/guides/i18n', 'Internationalisation');
    const live = example(page, 'Language switch');
    await live.getByRole('radio', { name: 'Español' }).click();
    await live.getByRole('button', { name: 'Página siguiente' }).click();
    await expect(live.locator('.star-paginator__report')).toHaveText('11–20 de 95');
  });

  test('the built-in pack changes only the part of the page that provides it', async ({ page }) => {
    await openPage(page, '/guides/i18n', 'Internationalisation');
    const live = example(page, 'Default and overridden text');
    await expect(live.getByRole('progressbar', { name: 'Loading', exact: true })).toBeVisible();
    await expect(live.getByRole('progressbar', { name: 'Wird geladen' })).toBeVisible();
  });
});
