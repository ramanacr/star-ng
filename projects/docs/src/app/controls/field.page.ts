import {
  ChangeDetectionStrategy,
  Component,
  resource,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { email, form, FormField, required, validateAsync } from '@angular/forms/signals';
import { StarButton } from '@star-ng/ui/button';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { StarField, StarFieldLabelEnd, StarInput } from '@star-ng/ui/field';
import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './field.page.scss',
  selector: 'docs-field-page',
  imports: [
    DOCS,
    StarButton,
    StarCheckbox,
    StarField,
    StarFieldLabelEnd,
    StarInput,
    StarRadio,
    StarRadioGroup,
    FormField,
  ],
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
        heading="Content at the end of the label row"
        source="field/label-end"
        note="labelEnd puts plain text at the inline end of the label row, in muted text. For a link or other rich content, add an element with starFieldLabelEnd. The end content is outside the label: it is not part of the accessible name of the control, and it is not in its description. In RTL it moves to the left; on a narrow field it wraps to its own line."
      >
        <div class="docs-stack">
          <star-field label="Reason" required labelEnd="jdoe · 25 Nov 2026 09:26">
            <textarea starInput placeholder="Why is this item closed?"></textarea>
          </star-field>
          <star-field label="Password">
            <a starFieldLabelEnd href="#forgot-password">Forgot password?</a>
            <input starInput type="password" autocomplete="current-password" />
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

      <docs-example
        heading="Async validation"
        source="field/async"
        [script]="asyncScript"
        note="While an async validator runs, pending() of the field state is true: the field and its control are aria-busy and the hint row shows a busy icon (hidden from screen readers). Try admin, taken by another account."
      >
        <div class="docs-stack">
          <star-field label="User name" hint="Letters and digits." [state]="account.userName()">
            <input starInput [formField]="account.userName" autocomplete="off" />
          </star-field>
        </div>
      </docs-example>

      <docs-example
        heading="Groups of checkboxes and radios"
        source="field/groups"
        note="Every checkbox in a field is described by the hint and the error; the first one also takes the label. A radio group passes the hint and the error to each radio, because Windows Narrator does not read them from the group."
      >
        <div class="docs-stack">
          <star-field label="Toppings" hint="Pick one or more." [error]="groupError()">
            <star-checkbox>Cheese</star-checkbox>
            <star-checkbox>Olives</star-checkbox>
            <star-checkbox>Peppers</star-checkbox>
          </star-field>
          <star-field label="Plan" hint="You can change it later." [error]="groupError()">
            <star-radio-group>
              <star-radio value="free">Free</star-radio>
              <star-radio value="pro">Pro</star-radio>
            </star-radio-group>
          </star-field>
          <star-button variant="secondary" (pressed)="toggleGroupError()">
            {{ groupError() ? 'Clear the errors' : 'Show the errors' }}
          </star-button>
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

      <docs-api
        [of]="['StarField', 'StarFieldLabelEnd', 'StarInput']"
        [slots]="slots"
        [cssVars]="cssVars"
      />
    </docs-page>
  `,
})
export class FieldPage {
  protected readonly groupError = signal<string | null>(null);
  protected toggleGroupError(): void {
    this.groupError.update((error) => (error ? null : 'Make a choice to continue.'));
  }

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

  protected readonly accountModel = signal({ userName: '' });
  protected readonly account = form(this.accountModel, (path) => {
    validateAsync(path.userName, {
      params: ({ value }) => value() || undefined,
      factory: (name) =>
        resource({
          params: name,
          // A stand-in for a server call (an httpResource in an application).
          loader: ({ params }) =>
            new Promise<boolean>((resolve) => setTimeout(() => resolve(params === 'admin'), 800)),
        }),
      onSuccess: (taken) =>
        taken ? { kind: 'taken', message: 'This user name is taken.' } : undefined,
      onError: () => undefined,
    });
  });

  protected readonly asyncScript = `readonly model = signal({ userName: '' });
readonly account = form(this.model, (path) => {
  validateAsync(path.userName, {
    params: ({ value }) => value() || undefined,
    factory: (name) =>
      resource({
        params: name,
        loader: ({ params }) => this.users.isTaken(params), // Promise<boolean>
      }),
    onSuccess: (taken) =>
      taken ? { kind: 'taken', message: 'This user name is taken.' } : undefined,
    onError: () => undefined,
  });
});`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The control: an input with starInput or a StarNG control.' },
    {
      name: '[starFieldLabelEnd]',
      description:
        'Content at the inline end of the label row, outside the label (for example a "Forgot password?" link). Not part of the accessible name. Import StarFieldLabelEnd.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the input.' },
    { name: '--star-input-font-weight', description: 'Font weight of the typed text.' },
    { name: '--star-label-font-weight', description: 'Font weight of the label.' },
    { name: '--star-label-text-transform', description: 'For example uppercase.' },
    { name: '--star-label-letter-spacing', description: 'Letter spacing of the label.' },
    { name: '--star-accent', description: 'Border color on focus.' },
    { name: '--star-danger', description: 'Border and message color of an invalid field.' },
    {
      name: '--star-field-label-end-color',
      description: 'Color of the end content of the label row. Default: --star-text-muted.',
    },
    {
      name: '--star-field-pending-color',
      description: 'Color of the busy icon while an async validator runs. Default: --star-accent.',
    },
  ];
}
