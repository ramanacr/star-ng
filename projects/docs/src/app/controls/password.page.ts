import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarField } from 'star-ng/field';
import { StarPassword, StarPasswordRule } from 'star-ng/password';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-password-page',
  imports: [DOCS, StarPassword, StarField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Password"
      lead="A password field with a show / hide button. With feedback it adds a strength meter and a rule checklist."
      importFrom="import { StarPassword } from 'star-ng/password';"
    >
      <docs-example
        heading="Sign-in field"
        source="password/basic"
        note="Without feedback, autocomplete is current-password."
      >
        <div class="docs-stack">
          <star-field label="Password">
            <star-password [(value)]="current" />
          </star-field>
        </div>
      </docs-example>

      <docs-example
        heading="New password with feedback"
        source="password/feedback"
        note="The default rules need 12 characters, an upper-case and a lower-case letter, a number and a symbol. Their labels come from STAR_UI_TEXT."
      >
        <div class="docs-stack">
          <star-field label="New password">
            <star-password [(value)]="created" feedback />
          </star-field>
        </div>
      </docs-example>

      <docs-example heading="Custom rules" source="password/rules" [script]="rulesScript">
        <div class="docs-stack">
          <star-field label="PIN phrase">
            <star-password [(value)]="phrase" feedback [rules]="rules" />
          </star-field>
        </div>
      </docs-example>

      <docs-api [of]="['StarPassword']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class PasswordPage {
  protected readonly current = signal('');
  protected readonly created = signal('');
  protected readonly phrase = signal('');
  protected readonly rules: readonly StarPasswordRule[] = [
    { label: 'At least 8 characters', test: (value) => value.length >= 8 },
    { label: 'No spaces', test: (value) => !/\s/.test(value) },
  ];

  protected readonly rulesScript = `readonly rules: readonly StarPasswordRule[] = [
  { label: 'At least 8 characters', test: (value) => value.length >= 8 },
  { label: 'No spaces', test: (value) => !/\\s/.test(value) },
];`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-success', description: 'Color of a rule that passes and of a strong meter.' },
    { name: '--star-warning', description: 'Color of a fair meter.' },
    { name: '--star-accent', description: 'Border color on focus, color of a good meter.' },
    { name: '--star-danger', description: 'Border color when invalid, color of a weak meter.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves from the field to the show / hide button.' },
    { name: 'Enter / Space', description: 'On the button: shows or hides the password.' },
  ];
}
