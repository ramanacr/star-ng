import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injectable,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import {
  provideStarUiText,
  STAR_UI_TEXT,
  STAR_UI_TEXT_DEFAULTS,
  starUiTextFromSignal,
} from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import { StarFileUpload } from '@star-ng/ui/file-upload';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import { STAR_UI_TEXT_ES } from '@star-ng/ui/i18n/es';
import { StarPaginator } from '@star-ng/ui/paginator';
import { StarPassword } from '@star-ng/ui/password';
import { StarSelect } from '@star-ng/ui/select';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { StarSpinner } from '@star-ng/ui/spinner';
import { DOCS } from '../shared/docs';

/** Wrapper that gives its content a built-in language pack, to show a provider on one subtree. */
@Component({
  selector: 'docs-german-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideStarUiText(STAR_UI_TEXT_DE)],
  imports: [StarSpinner],
  template: `<star-spinner />`,
})
export class DocsGermanText {}

/** The language of the live example: a signal that the control texts read. */
@Injectable()
export class DocsLanguage {
  /** The choice of the language switch. */
  readonly choice = signal<string | readonly string[] | null>('en');
  readonly text = computed(() => {
    switch (this.choice()) {
      case 'de':
        return STAR_UI_TEXT_DE;
      case 'es':
        return STAR_UI_TEXT_ES;
      default:
        return STAR_UI_TEXT_DEFAULTS;
    }
  });
}

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './i18n.guide.scss',
  selector: 'docs-i18n-guide',
  imports: [
    DOCS,
    StarSpinner,
    DocsGermanText,
    StarSelectButton,
    StarPaginator,
    StarSelect,
    StarFileUpload,
    StarPassword,
    StarField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    DocsLanguage,
    {
      provide: STAR_UI_TEXT,
      useFactory: () => starUiTextFromSignal(inject(DocsLanguage).text),
    },
  ],
  template: `
    <docs-page
      heading="Internationalisation"
      lead="The controls have built-in text: screen-reader labels, empty states, page reports. All of it is in one object behind the STAR_UI_TEXT injection token. The defaults are English. German and Spanish packs are included."
      importFrom="import { provideStarUiText, STAR_UI_TEXT, StarUiText } from '@star-ng/ui/core';"
    >
      <h2>Use a built-in language pack</h2>
      <p>
        Each language is in its own entry point. An application bundles only the languages that it
        imports. The packs are not part of the package root.
      </p>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Built-in language packs
          </caption>
          <thead>
            <tr>
              <th scope="col">Language</th>
              <th scope="col">Import from</th>
              <th scope="col">Export</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>German (formal address)</td>
              <td><code>@star-ng/ui/i18n/de</code></td>
              <td><code>STAR_UI_TEXT_DE</code></td>
            </tr>
            <tr>
              <td>Spanish (neutral)</td>
              <td><code>@star-ng/ui/i18n/es</code></td>
              <td><code>STAR_UI_TEXT_ES</code></td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Give the pack to <code>provideStarUiText()</code>. Provide it in the application config, or
        on one component to change the text of the controls inside it.
      </p>
      <docs-code [code]="pack" label="Built-in pack" />
      <docs-example
        heading="Default and overridden text"
        source="i18n/spinner"
        note="Both spinners have an accessible name: 'Loading' and 'Wird geladen' (from the German pack)."
      >
        <star-spinner />
        <docs-german-text />
      </docs-example>
      <p>To change single entries, spread the pack and replace what you need:</p>
      <docs-code [code]="change" label="Changed entry" />

      <h2>Switch the language at run time</h2>
      <p>
        <code>provideStarUiTextFromSignal()</code> takes a function. The function reads a signal and
        returns a pack. Every entry of the text calls that function when a control renders it, so
        OnPush controls update at once when the signal changes. No translation library is needed.
        Entries that the pack does not have fall back to English.
      </p>
      <docs-code [code]="signalCode" label="Language signal" />
      <p>
        If the signal is in a service, use <code>starUiTextFromSignal()</code> in a factory, as the
        example below does. Do not spread a text that has getters into a new object: the spread
        reads every getter once and freezes the text.
      </p>
      <docs-example
        heading="Language switch"
        source="i18n/switch"
        [script]="switchScript"
        note="The labels of the fields are your own text and stay English. The built-in text of the controls changes."
      >
        <div class="docs-stack">
          <star-select-button
            [options]="languages"
            optionLabel="label"
            optionValue="id"
            [(value)]="language.choice"
            [allowEmpty]="false"
            ariaLabel="Language"
          />
          <star-paginator [totalRecords]="95" />
          <star-field label="City">
            <star-select [options]="cities" [(value)]="city" filter ariaLabel="City" />
          </star-field>
          <star-field label="Attachments">
            <star-file-upload multiple [maxFileSize]="1000000" [fileLimit]="3" />
          </star-field>
          <star-field label="New password">
            <star-password value="abc" feedback />
          </star-field>
        </div>
      </docs-example>

      <h2>Write a pack for another language</h2>
      <p>
        A pack is an object of the type <code>StarUiText</code>. The compiler checks it: a missing
        or misspelled entry is an error.
      </p>
      <ol>
        <li>
          Start from the English text. <code>STAR_UI_TEXT_DEFAULTS</code> has every entry. The
          German pack in the repository is a complete example.
        </li>
        <li>
          Translate the fixed strings. Keep screen-reader labels short: a screen reader reads them
          aloud at every focus change.
        </li>
        <li>
          Write the function entries so that they return the full sentence. A function can change
          the word order, add a case ending or choose a plural form. The parameter names are in
          <code>STAR_UI_TEXT_PARAMS</code>.
        </li>
        <li>
          For counts, use <code>Intl.PluralRules</code>. Do not test only for the number 1: many
          languages have more than two plural forms.
        </li>
        <li>Provide the pack with <code>provideStarUiText()</code> or the signal provider.</li>
      </ol>
      <docs-code [code]="ownPack" label="Own pack" />
      <p>
        To contribute a language, add the folder
        <code>projects/star-ng/i18n/&lt;code&gt;</code> with an <code>ng-package.json</code>, an
        <code>index.ts</code> and the pack, as <code>i18n/de</code> does. Add the language to the
        lists in <code>projects/star-ng/specs/ui-text-packs.spec.ts</code>. That test checks that no
        entry is missing, empty or still English.
      </p>

      <h2>Transloco</h2>
      <p>
        If the application uses Transloco, <code>provideStarUiTextFromTransloco()</code> reads every
        entry from the active language (keys <code>ui.close</code>, <code>ui.page</code> and so on)
        and updates the controls when the language changes. A missing key falls back to English.
        This entry point needs the optional peer dependency <code>&#64;jsverse/transloco</code>.
      </p>
      <docs-code [code]="transloco" label="Transloco provider" />
      <p>
        Function entries become <code>{{ '{' + '{ param }' + '}' }}</code> placeholders. The
        parameter names are in <code>STAR_UI_TEXT_PARAMS</code>. Use the plural support of your
        Transloco setup for counts.
      </p>
      <docs-code [code]="json" label="Translation file" />

      <h2>Another translation tool</h2>
      <p>
        Provide <code>STAR_UI_TEXT</code> with your own factory. Read signals inside getters, so
        that OnPush controls render again when the language changes.
      </p>
      <docs-code [code]="custom" label="Custom provider" />

      <h2>What is not translated</h2>
      <p>
        Only the text that a control renders by itself is translated, for example "Loading", "No
        results found" or "1–10 of 95". Your own labels, placeholders, option texts and validation
        messages are inputs: translate them with your own tool.
      </p>
      <h3>Numbers and dates</h3>
      <p>
        Controls that format numbers or dates take a <code>locale</code> input (a BCP 47 tag such as
        <code>de-DE</code>) and use the browser's <code>Intl</code> API. A language pack does not
        set it. Without the input, the controls use the application locale.
      </p>
    </docs-page>
  `,
})
export class I18nGuide {
  protected readonly language = inject(DocsLanguage);
  protected readonly languages = [
    { id: 'en', label: 'English' },
    { id: 'de', label: 'Deutsch' },
    { id: 'es', label: 'Español' },
  ];
  protected readonly cities = ['Berlin', 'Madrid', 'Lisbon', 'Vienna'];
  protected readonly city = signal<string | null>(null);

  protected readonly pack = `// app.config.ts
import { provideStarUiText } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';

export const appConfig: ApplicationConfig = {
  providers: [provideStarUiText(STAR_UI_TEXT_DE)],
};`;

  protected readonly change = `provideStarUiText({ ...STAR_UI_TEXT_DE, close: 'Zumachen' })`;

  protected readonly signalCode = `// app.config.ts
import { signal } from '@angular/core';
import { provideStarUiTextFromSignal, STAR_UI_TEXT_DEFAULTS } from '@star-ng/ui/core';
import { STAR_UI_TEXT_DE } from '@star-ng/ui/i18n/de';
import { STAR_UI_TEXT_ES } from '@star-ng/ui/i18n/es';

export const language = signal<'en' | 'de' | 'es'>('en');
const packs = { en: STAR_UI_TEXT_DEFAULTS, de: STAR_UI_TEXT_DE, es: STAR_UI_TEXT_ES };

export const appConfig: ApplicationConfig = {
  providers: [provideStarUiTextFromSignal(() => packs[language()])],
};

// Anywhere in the application: language.set('de');`;

  protected readonly switchScript = `@Injectable()
export class DocsLanguage {
  readonly choice = signal<string | readonly string[] | null>('en');
  readonly text = computed(() => {
    switch (this.choice()) {
      case 'de':
        return STAR_UI_TEXT_DE;
      case 'es':
        return STAR_UI_TEXT_ES;
      default:
        return STAR_UI_TEXT_DEFAULTS;
    }
  });
}

@Component({
  providers: [
    DocsLanguage,
    { provide: STAR_UI_TEXT, useFactory: () => starUiTextFromSignal(inject(DocsLanguage).text) },
  ],
})
export class LanguageDemo {
  protected readonly language = inject(DocsLanguage);
  protected readonly languages = [
    { id: 'en', label: 'English' },
    { id: 'de', label: 'Deutsch' },
    { id: 'es', label: 'Español' },
  ];
  protected readonly cities = ['Berlin', 'Madrid', 'Lisbon', 'Vienna'];
  protected readonly city = signal<string | null>(null);
}`;

  protected readonly ownPack = `// star-ui-text-fr.ts
import { StarUiText } from '@star-ng/ui/core';

const plural = new Intl.PluralRules('fr');

export const STAR_UI_TEXT_FR: StarUiText = {
  close: 'Fermer',
  loading: 'Chargement',
  // A function returns the full sentence: word order and plural form are yours.
  selectedItems: (count) =>
    \`\${count} \${plural.select(count) === 'other' ? 'éléments sélectionnés' : 'élément sélectionné'}\`,
  pageReport: (first, last, total) => \`\${first}–\${last} sur \${total}\`,
  // ...and every other entry of StarUiText. A missing entry does not compile.
};`;

  protected readonly transloco = `import { provideStarUiTextFromTransloco } from '@star-ng/ui/transloco';

export const appConfig: ApplicationConfig = {
  providers: [
    provideTransloco({ /* your Transloco config */ }),
    provideStarUiTextFromTransloco(), // or provideStarUiTextFromTransloco('controls')
  ],
};`;

  protected readonly json = `// public/i18n/de.json
{
  "ui": {
    "loading": "Wird geladen",
    "close": "Schließen",
    "pageReport": "{{ first }}–{{ last }} von {{ total }}"
  }
}`;

  protected readonly custom = `import { STAR_UI_TEXT, STAR_UI_TEXT_DEFAULTS, StarUiText } from '@star-ng/ui/core';

{
  provide: STAR_UI_TEXT,
  useFactory: (): StarUiText => {
    const i18n = inject(MyTranslations); // has a signal-based t(key)
    return {
      ...STAR_UI_TEXT_DEFAULTS,
      get loading() {
        return i18n.t('controls.loading');
      },
      page: (page) => i18n.t('controls.page', { page }),
    };
  },
}`;
}
