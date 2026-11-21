import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { StarDatePicker } from '@star-ng/ui/date-picker';
import { StarIftaLabel, StarInput } from '@star-ng/ui/field';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { StarSelect } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './ifta-label.page.scss',
  selector: 'docs-ifta-label-page',
  imports: [DOCS, FormField, StarDatePicker, StarIftaLabel, StarInput, StarInputNumber, StarSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="In-field label"
      lead="The label sits inside the box of the control, above the value, and stays there. It is a star-field with another layout: the label names the control, a click on it focuses the control, and the hint and the error work the same way. The PrimeNG equivalent is p-iftalabel."
      importFrom="import { StarIftaLabel } from '@star-ng/ui/field';"
    >
      <docs-example
        heading="Text input, select, date and number"
        source="ifta-label/basic"
        [script]="basicScript"
        note="A text input, a date picker and an input number get the label with for. A select names itself with aria-labelledby."
      >
        <div class="docs-stack">
          <star-ifta-label label="Customer name" hint="As on the invoice.">
            <input starInput placeholder="Avery Stone" />
          </star-ifta-label>
          <star-ifta-label label="City">
            <star-select [options]="cities" [(value)]="city" />
          </star-ifta-label>
          <star-ifta-label label="Delivery date">
            <star-date-picker />
          </star-ifta-label>
          <star-ifta-label label="Quantity">
            <star-input-number [(value)]="quantity" [min]="1" />
          </star-ifta-label>
        </div>
      </docs-example>

      <docs-example
        heading="Validation with Signal Forms"
        source="ifta-label/validation"
        [script]="validationScript"
        note="Pass the field state, as for star-field. The first error shows after the user leaves the control."
      >
        <div class="docs-stack">
          <star-ifta-label label="Order number" [state]="order.number()">
            <input starInput [formField]="order.number" />
          </star-ifta-label>
        </div>
      </docs-example>

      <docs-api [of]="['StarIftaLabel', 'StarField']" [slots]="slots" [cssVars]="cssVars" />

      <h2>Technical notes</h2>
      <p>
        StarIftaLabel extends StarField, so it has the inputs of the field: label, hint, error,
        state, required, messages and for. The form controls inside it link to it as they link to a
        star-field. The label lets the pointer through, so a click on it reaches the control.
      </p>
    </docs-page>
  `,
})
export class IftaLabelPage {
  protected readonly cities: readonly string[] = ['Berlin', 'Lisbon', 'Oslo', 'Toronto'];
  protected readonly city = signal<string | null>(null);
  protected readonly quantity = signal<number | null>(1);

  private readonly model = signal({ number: '' });
  protected readonly order = form(this.model, (path) => {
    required(path.number, { message: 'Enter the order number.' });
  });

  protected readonly basicScript = `readonly cities = ['Berlin', 'Lisbon', 'Oslo', 'Toronto'];
readonly city = signal<string | null>(null);
readonly quantity = signal<number | null>(1);`;

  protected readonly validationScript = `private readonly model = signal({ number: '' });
readonly order = form(this.model, (path) => {
  required(path.number, { message: 'Enter the order number.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description:
        'One control with a text box: starInput, star-select, star-date-picker, star-input-number and others.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-text-muted', description: 'Color of the label.' },
    { name: '--star-accent', description: 'Color of the label while the control has the focus.' },
    { name: '--star-danger', description: 'Color of the error text and the required mark.' },
  ];
}
