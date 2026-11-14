import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideStarUiText } from 'star-ng/core';
import { StarSpinner } from 'star-ng/spinner';
import { DOCS } from '../shared/docs';

/** Wrapper that gives its content other control text, to show a provider on one subtree. */
@Component({
  selector: 'docs-german-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provideStarUiText({ loading: 'Wird geladen' })],
  imports: [StarSpinner],
  template: `<star-spinner />`,
})
export class DocsGermanText {}

@Component({
  selector: 'docs-i18n-guide',
  imports: [DOCS, StarSpinner, DocsGermanText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Internationalisation"
      lead="The controls have built-in text: screen-reader labels, empty states, page reports. All of it is in one object behind the STAR_UI_TEXT injection token. The defaults are English."
      importFrom="import { provideStarUiText, STAR_UI_TEXT, StarUiText } from 'star-ng/core';"
    >
      <h2>What is translated</h2>
      <p>
        Only the text that a control renders by itself, for example "Loading", "No results" or "Page
        2 of 5". Labels, placeholders and option text are your inputs: translate them with your own
        tool.
      </p>
      <p>
        <code>StarUiText</code> has two kinds of entries: fixed strings and functions. A function
        gets the values (for example a count) and returns the full sentence, so that the word order
        can change per language.
      </p>

      <h2>Fixed text</h2>
      <p>
        <code>provideStarUiText()</code> replaces some or all entries. Provide it in the application
        config, or on one component to change the text of the controls inside it.
      </p>
      <docs-code [code]="fixed" label="provideStarUiText" />
      <docs-example
        heading="Default and overridden text"
        source="i18n/spinner"
        note="Both spinners have an accessible name: 'Loading' and 'Wird geladen'."
      >
        <star-spinner />
        <docs-german-text />
      </docs-example>

      <h2>Live language switch with Transloco</h2>
      <p>
        If the application uses Transloco, <code>provideStarUiTextFromTransloco()</code> reads every
        entry from the active language (keys <code>ui.close</code>, <code>ui.page</code>
        and so on) and updates the controls when the language changes. A missing key falls back to
        English. This entry point needs the optional peer dependency
        <code>&#64;jsverse/transloco</code>.
      </p>
      <docs-code [code]="transloco" label="Transloco provider" />
      <p>
        Function entries become <code>{{ '{' + '{ param }' + '}' }}</code> placeholders. The
        parameter names are in <code>STAR_UI_TEXT_PARAMS</code>.
      </p>
      <docs-code [code]="json" label="Translation file" />

      <h2>Another translation tool</h2>
      <p>
        Provide <code>STAR_UI_TEXT</code> with your own factory. Read signals inside getters, so
        that OnPush controls render again when the language changes.
      </p>
      <docs-code [code]="custom" label="Custom provider" />

      <h2>Numbers and dates</h2>
      <p>
        Controls that format numbers or dates take a <code>locale</code> input (a BCP 47 tag such as
        <code>de-DE</code>) and use the browser's <code>Intl</code> API.
      </p>
    </docs-page>
  `,
})
export class I18nGuide {
  protected readonly fixed = `// app.config.ts
import { provideStarUiText } from 'star-ng/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideStarUiText({
      loading: 'Wird geladen',
      close: 'Schließen',
      pageReport: (first, last, total) => \`\${first}–\${last} von \${total}\`,
    }),
  ],
};`;

  protected readonly transloco = `import { provideStarUiTextFromTransloco } from 'star-ng/transloco';

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

  protected readonly custom = `import { STAR_UI_TEXT, STAR_UI_TEXT_DEFAULTS, StarUiText } from 'star-ng/core';

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
