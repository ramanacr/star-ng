import { STAR_UI_TEXT_DEFAULTS, STAR_UI_TEXT_PARAMS, StarUiText } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import { STAR_UI_TEXT_ES } from '@star-ng/ui/i18n/es';

type Name = keyof StarUiText;

/**
 * Entries that a language may keep identical to English, because the word is the same there.
 * Every entry is checked: a stale entry (a text that differs) fails the test.
 */
const SAME_AS_ENGLISH: Record<string, readonly Name[]> = {
  // "Layout", "Details", "Dock", "System", "Editor", "Link" and "Minute" are the usual German UI words.
  de: [
    'layout',
    'rowDetails',
    'dock',
    'themeSystem',
    'editorLabel',
    'editorLink',
    'chartX',
    'chartY',
    'minute',
    // A data point reads "series, category: value" in every language.
    'chartPointLabel',
  ],
  // "Color", "Editor" and "Total" are the Spanish words too. "X" and "Y" are axis names in every language.
  es: ['colorLabel', 'editorLabel', 'chartTotal', 'chartX', 'chartY', 'chartPointLabel'],
};

const PACKS: Record<string, StarUiText> = { de: STAR_UI_TEXT_DE, es: STAR_UI_TEXT_ES };
const NAMES = Object.keys(STAR_UI_TEXT_DEFAULTS) as Name[];
const COUNTS = [0, 1, 2, 5];

/** Parameters that are texts (everything else is a number). */
const TEXT_PARAMS: Record<string, readonly string[]> = {
  fileTooLarge: ['name', 'max'],
  fileMaxSize: ['size'],
  meterValue: ['value'],
  chartDescription: ['kind', 'min', 'max'],
  sparklineSummary: ['first', 'last', 'min', 'max', 'trend'],
  barcodeInvalid: ['type'],
  qrCodeLabel: ['value'],
};
const TEXT_NAMES = new Set(['label', 'column', 'name', 'alt']);

/** Arguments for an entry: `count` for the numbers, `Sample` for the texts. */
function args(name: Name, count: number): unknown[] {
  const params = STAR_UI_TEXT_PARAMS[name] ?? [];
  return params.map((param) =>
    TEXT_NAMES.has(param) || TEXT_PARAMS[name]?.includes(param) ? 'Sample' : count,
  );
}

/** The text of an entry for sample values. */
function render(text: StarUiText, name: Name, count: number): string {
  const entry = text[name];
  return typeof entry === 'function'
    ? (entry as (...a: unknown[]) => string)(...args(name, count))
    : entry;
}

describe('built-in language packs', () => {
  for (const [language, pack] of Object.entries(PACKS)) {
    describe(language, () => {
      it('has exactly the keys of the English defaults', () => {
        expect(Object.keys(pack).sort()).toEqual([...NAMES].sort());
      });

      it('has the same kind of entry (text or function) as English', () => {
        for (const name of NAMES) {
          expect(typeof pack[name], name).toBe(typeof STAR_UI_TEXT_DEFAULTS[name]);
        }
      });

      it('has no empty text', () => {
        for (const name of NAMES) {
          for (const count of COUNTS) {
            const value = render(pack, name, count);
            expect(typeof value, name).toBe('string');
            expect(value.trim(), `${name}(${count})`).not.toBe('');
          }
        }
      });

      it('keeps the values that a function receives', () => {
        for (const name of NAMES) {
          if (typeof pack[name] !== 'function') continue;
          const given = args(name, 7);
          const value = render(pack, name, 7);
          for (const arg of given) {
            // `sliderMinimum` and `sliderMaximum` may drop an empty label only.
            expect(value, name).toContain(String(arg));
          }
        }
      });

      it('translates every entry except the allow-listed ones', () => {
        const allowed = new Set(SAME_AS_ENGLISH[language]);
        for (const name of NAMES) {
          const same = COUNTS.every(
            (count) => render(pack, name, count) === render(STAR_UI_TEXT_DEFAULTS, name, count),
          );
          if (allowed.has(name)) {
            expect(same, `${name} is allow-listed but differs: remove it from the list`).toBe(true);
          } else {
            expect(same, `${name} is still English`).toBe(false);
          }
        }
      });
    });
  }

  it('uses the plural rules of the language for counts', () => {
    expect(STAR_UI_TEXT_DE.selectedItems(1)).toBe('1 Element ausgewählt');
    expect(STAR_UI_TEXT_DE.selectedItems(2)).toBe('2 Elemente ausgewählt');
    expect(STAR_UI_TEXT_DE.selectedItems(0)).toBe('0 Elemente ausgewählt');
    expect(STAR_UI_TEXT_DE.fileUpTo(1)).toBe('bis zu 1 Datei');
    expect(STAR_UI_TEXT_DE.fileUpTo(5)).toBe('bis zu 5 Dateien');
    expect(STAR_UI_TEXT_DE.resultsAvailable(1)).toBe('1 Ergebnis verfügbar');
    expect(STAR_UI_TEXT_DE.resultsAvailable(3)).toBe('3 Ergebnisse verfügbar');
    expect(STAR_UI_TEXT_DE.tagLimit(1)).toContain('1 Eintrag ');
    expect(STAR_UI_TEXT_DE.tagLimit(5)).toContain('5 Einträge');

    expect(STAR_UI_TEXT_ES.selectedItems(1)).toBe('1 elemento seleccionado');
    expect(STAR_UI_TEXT_ES.selectedItems(2)).toBe('2 elementos seleccionados');
    expect(STAR_UI_TEXT_ES.selectedItems(0)).toBe('0 elementos seleccionados');
    expect(STAR_UI_TEXT_ES.fileUpTo(1)).toBe('hasta 1 archivo');
    expect(STAR_UI_TEXT_ES.fileUpTo(5)).toBe('hasta 5 archivos');
    expect(STAR_UI_TEXT_ES.passwordRuleLength(1)).toBe('Al menos 1 carácter');
    expect(STAR_UI_TEXT_ES.passwordRuleLength(12)).toBe('Al menos 12 caracteres');
    expect(STAR_UI_TEXT_ES.fileLimitReached(1)).toBe('Se permite hasta 1 archivo.');
    expect(STAR_UI_TEXT_ES.fileLimitReached(3)).toBe('Se permiten hasta 3 archivos.');
  });

  it('keeps the placeholders and the dash of a page report', () => {
    expect(STAR_UI_TEXT_DE.pageReport(1, 10, 95)).toBe('1–10 von 95');
    expect(STAR_UI_TEXT_ES.pageReport(1, 10, 95)).toBe('1–10 de 95');
  });

  it('keeps the sliders short when the label is empty', () => {
    expect(STAR_UI_TEXT_DE.sliderMinimum('')).toBe('Minimum');
    expect(STAR_UI_TEXT_ES.sliderMinimum('')).toBe('Mínimo');
    expect(STAR_UI_TEXT_ES.sliderMaximum('Precio')).toBe('Precio: máximo');
  });
});
