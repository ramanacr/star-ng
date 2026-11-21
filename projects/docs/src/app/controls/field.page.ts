import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { email, form, FormField, required } from '@angular/forms/signals';
import { StarField, StarInput } from '@star-ng/ui/field';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './field.page.scss',
  selector: 'docs-field-page',
  imports: [DOCS, StarField, StarInput, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Field and input"
      lead="star-field adds a label, a hint and an error message to a control. starInput styles a native input or textarea and links it to the field."
      importFrom="import { StarField, StarInput } from '@star-ng/ui/field';"
    >
      <docs-example heading="Label and hint" source="field/basic">
        <div class="docs-stack">
          <star-field label="Full name" hint="As shown on your account.">
            <input starInput placeholder="Avery Stone" />
          </star-field>
        </div>
      </docs-example>

      <docs-example
        heading="Validation with Signal Forms"
        source="field/validation"
        [script]="validationScript"
        note="Pass the field state. The first error shows after the user leaves the control."
      >
        <div class="docs-stack">
          <star-field label="Email" [state]="contact.email()">
            <input starInput type="email" [formField]="contact.email" />
          </star-field>
        </div>
      </docs-example>

      <docs-example heading="Sizes" source="field/sizes">
        <div class="docs-stack">
          <input starInput size="sm" aria-label="Small" placeholder="Small" />
          <input starInput aria-label="Medium" placeholder="Medium" />
          <input starInput size="lg" aria-label="Large" placeholder="Large" />
        </div>
      </docs-example>

      <docs-example
        heading="Textarea"
        source="field/textarea"
        note="autoResize makes the textarea grow with its content."
      >
        <div class="docs-stack">
          <star-field label="Notes">
            <textarea starInput autoResize placeholder="Add a note"></textarea>
          </star-field>
        </div>
      </docs-example>

      <docs-example heading="Explicit error and disabled" source="field/states">
        <div class="docs-stack">
          <star-field label="Promo code" error="This code has expired.">
            <input starInput value="SPRING" />
          </star-field>
          <star-field label="Account number">
            <input starInput value="100-204" disabled />
          </star-field>
        </div>
      </docs-example>

      <docs-api [of]="['StarField', 'StarInput']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class FieldPage {
  protected readonly model = signal({ email: '' });
  protected readonly contact = form(this.model, (path) => {
    required(path.email, { message: 'Enter an email address.' });
    email(path.email, { message: 'Enter a valid email address.' });
  });

  protected readonly validationScript = `readonly model = signal({ email: '' });
readonly contact = form(this.model, (path) => {
  required(path.email, { message: 'Enter an email address.' });
  email(path.email, { message: 'Enter a valid email address.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The control: an input with starInput or a StarNG control.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the input.' },
    { name: '--star-input-font-weight', description: 'Font weight of the typed text.' },
    { name: '--star-label-font-weight', description: 'Font weight of the label.' },
    { name: '--star-label-text-transform', description: 'For example uppercase.' },
    { name: '--star-label-letter-spacing', description: 'Letter spacing of the label.' },
    { name: '--star-accent', description: 'Border color on focus.' },
    { name: '--star-danger', description: 'Border and message color of an invalid field.' },
  ];
}
