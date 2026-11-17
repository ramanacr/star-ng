import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { SignalFormControl } from '@angular/forms/signals/compat';
import { StarAutoComplete } from '@star-ng/ui/autocomplete';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { syncSignalFormControls } from '@star-ng/ui/core';
import { StarDatePicker, StarTimePicker } from '@star-ng/ui/date-picker';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarMultiSelect, StarSelect } from '@star-ng/ui/select';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';
import { StarTreeNode, StarTreeSelect } from '@star-ng/ui/tree';
import { DOCS } from '../shared/docs';

@Component({
  selector: 'docs-forms-guide',
  imports: [
    DOCS,
    JsonPipe,
    FormField,
    ReactiveFormsModule,
    StarField,
    StarInput,
    StarAutoComplete,
    StarCheckbox,
    StarDatePicker,
    StarMultiSelect,
    StarSelect,
    StarTimePicker,
    StarToggleSwitch,
    StarTreeSelect,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Forms"
      lead="The form controls implement the Angular Signal Forms control interfaces. They also work with two-way binding, and inside a Reactive FormGroup through SignalFormControl."
    >
      <h2>Signal Forms</h2>
      <p>
        Bind a control to a field with <code>[formField]</code>. The control gets its value,
        disabled, required, invalid and touched state from the field. Pass the field state to
        <code>star-field</code> to show the first error after the user leaves the control.
      </p>
      <docs-example
        heading="Signal Forms"
        source="forms/signal"
        [script]="signalScript"
        note="Leave the name empty and move on to see the error."
      >
        <div class="docs-stack">
          <star-field label="Name" [state]="profile.name()">
            <input starInput [formField]="profile.name" />
          </star-field>
          <star-toggle-switch [formField]="profile.newsletter">Newsletter</star-toggle-switch>
          <p class="docs-output" role="status">
            {{ profile().valid() ? 'Valid' : 'Not valid' }}: {{ model().name || '(no name)' }}
          </p>
        </div>
      </docs-example>

      <h2>Labels of StarNG controls</h2>
      <p>
        Put a StarNG control in <code>star-field</code>. The control links itself to the field: the
        label gives the control its accessible name, a click on the label moves the focus to the
        control, and the hint or the error describes it. You do not set <code>for</code>,
        <code>inputId</code> or <code>ariaLabel</code>. When you set <code>ariaLabel</code> or
        <code>ariaLabelledBy</code> on the control, your value wins.
      </p>
      <docs-example
        heading="Labels"
        source="forms/labels"
        [script]="labelsScript"
        note="Click a label: the focus goes to its control."
      >
        <div class="docs-stack">
          <star-field label="Warehouse" hint="The order ships from here.">
            <star-select [options]="warehouses" placeholder="Choose a warehouse" />
          </star-field>
          <star-field label="Notify teams">
            <star-multi-select [options]="teams" placeholder="Choose teams" />
          </star-field>
          <star-field label="Destination city">
            <star-autocomplete [options]="cities" placeholder="Type a city" />
          </star-field>
          <star-field label="Ship date">
            <star-date-picker locale="en-GB" />
          </star-field>
          <star-field label="Pickup time">
            <star-time-picker />
          </star-field>
          <star-field label="Cost center">
            <star-tree-select [nodes]="costCenters" placeholder="Choose a cost center" />
          </star-field>
        </div>
      </docs-example>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            How each control links to star-field
          </caption>
          <thead>
            <tr>
              <th scope="col">Link</th>
              <th scope="col">Controls</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">The label points at the input with <code>for</code></th>
              <td>
                <code>starInput</code>, <code>star-password</code>, <code>star-input-number</code>,
                <code>star-input-mask</code>, <code>star-input-tags</code>,
                <code>star-autocomplete</code>, <code>star-multi-autocomplete</code>,
                <code>star-date-picker</code>, <code>star-date-range-picker</code>,
                <code>star-multi-date-picker</code>, <code>star-time-picker</code>,
                <code>star-slider</code>, <code>star-checkbox</code>,
                <code>star-toggle-switch</code>, <code>star-file-upload</code>
              </td>
            </tr>
            <tr>
              <th scope="row">
                The control has <code>aria-labelledby</code>; a click on the label focuses it
              </th>
              <td>
                <code>star-select</code>, <code>star-multi-select</code>, <code>star-listbox</code>,
                <code>star-radio-group</code>, <code>star-select-button</code>,
                <code>star-rating</code>, <code>star-knob</code>, <code>star-color-picker</code>,
                <code>star-input-otp</code>, <code>star-editor</code>, <code>star-tree</code>, an
                inline <code>star-calendar</code>
              </td>
            </tr>
            <tr>
              <th scope="row">
                The name is the label and the text on the button; a click on the label focuses it
              </th>
              <td><code>star-cascade-select</code>, <code>star-tree-select</code></td>
            </tr>
            <tr>
              <th scope="row">Each handle has the label text in its name</th>
              <td><code>star-range-slider</code></td>
            </tr>
            <tr>
              <th scope="row">No link</th>
              <td>
                <code>star-toggle-button</code> (its text is its name). In
                <code>star-input-group</code> and <code>star-icon-field</code>, the input links.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Two-way binding</h2>
      <p>
        Without a form, bind the model of the control: <code>[(checked)]</code> on a checkbox or a
        switch, <code>[(value)]</code> on value controls.
      </p>
      <docs-example heading="Two-way binding" source="forms/two-way">
        <star-checkbox [(checked)]="remember">Remember this device</star-checkbox>
        <p class="docs-output" role="status">{{ remember() }}</p>
      </docs-example>

      <h2>Reactive Forms: the SignalFormControl pattern</h2>
      <p>
        An application that still has Reactive Forms can put a StarNG control in a
        <code>FormGroup</code> with <code>SignalFormControl</code> (from
        <code>&#64;angular/forms/signals/compat</code>). The group sees value, validity, touched and
        disabled like any other control.
      </p>
      <ol>
        <li>Create the control with <code>new SignalFormControl(value, rules)</code>.</li>
        <li>Bind it with <code>[formField]="group.controls.x.fieldTree"</code>.</li>
        <li>
          Set disabled and conditional required with Signal Forms rules.
          <code>SignalFormControl.disable()</code> is not supported.
        </li>
        <li>
          Call <code>syncSignalFormControls(group)</code> once. Angular updates the group when a
          value changes, but not when a rule changes the status without a value change. This helper
          closes that gap.
        </li>
      </ol>
      <docs-example
        heading="Reactive Forms"
        source="forms/reactive"
        [script]="reactiveScript"
        note="Lock the form: the date picker and the checkbox become disabled and the group status follows."
      >
        <form class="docs-stack" [formGroup]="group">
          <star-field label="Reference">
            <input starInput formControlName="reference" />
          </star-field>
          <star-field label="Delivery date">
            <star-date-picker [formField]="group.controls.delivery.fieldTree" locale="en-GB" />
          </star-field>
          <star-checkbox [formField]="group.controls.confirmed.fieldTree">Confirmed</star-checkbox>
          <star-toggle-switch [(checked)]="locked">Lock the form</star-toggle-switch>
          <p class="docs-output" role="status">Group value: {{ group.value | json }}</p>
        </form>
      </docs-example>

      <h2>Field states the controls read</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Form state inputs
          </caption>
          <thead>
            <tr>
              <th scope="col">Input</th>
              <th scope="col">Effect</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><code>disabled</code></th>
              <td>The control cannot be changed or focused.</td>
            </tr>
            <tr>
              <th scope="row"><code>readonly</code></th>
              <td>The control can be focused and read, but not changed.</td>
            </tr>
            <tr>
              <th scope="row"><code>required</code></th>
              <td>Sets the native <code>required</code> or <code>aria-required</code>.</td>
            </tr>
            <tr>
              <th scope="row"><code>invalid</code> + <code>touched</code></th>
              <td>The invalid style and <code>aria-invalid</code> show only after a visit.</td>
            </tr>
            <tr>
              <th scope="row"><code>touch</code> (output)</th>
              <td>Tells the form that the user left the control.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </docs-page>
  `,
})
export class FormsGuide {
  protected readonly model = signal({ name: '', newsletter: true });
  protected readonly profile = form(this.model, (path) => {
    required(path.name, { message: 'Enter a name.' });
  });
  protected readonly remember = signal(false);

  protected readonly warehouses = ['Hamburg', 'Lyon', 'Porto'];
  protected readonly teams = ['Billing', 'Shipping', 'Support'];
  protected readonly cities = ['Berlin', 'Madrid', 'Paris', 'Rome', 'Vienna'];
  protected readonly costCenters: StarTreeNode[] = [
    {
      key: 'ops',
      label: 'Operations',
      children: [
        { key: 'ops-fleet', label: 'Fleet' },
        { key: 'ops-stock', label: 'Stock' },
      ],
    },
    { key: 'sales', label: 'Sales' },
  ];

  protected readonly locked = signal(false);
  protected readonly group = new FormGroup({
    reference: new FormControl('ORD-1042'),
    delivery: new SignalFormControl<Date | null>(null, (path) => {
      disabled(path, { when: () => this.locked() });
    }),
    confirmed: new SignalFormControl(false, (path) => {
      disabled(path, { when: () => this.locked() });
    }),
  });
  private readonly sync = syncSignalFormControls(this.group);

  protected readonly signalScript = `readonly model = signal({ name: '', newsletter: true });
readonly profile = form(this.model, (path) => {
  required(path.name, { message: 'Enter a name.' });
});`;

  protected readonly labelsScript = `readonly warehouses = ['Hamburg', 'Lyon', 'Porto'];
readonly teams = ['Billing', 'Shipping', 'Support'];
readonly cities = ['Berlin', 'Madrid', 'Paris', 'Rome', 'Vienna'];
readonly costCenters: StarTreeNode[] = [
  {
    key: 'ops',
    label: 'Operations',
    children: [
      { key: 'ops-fleet', label: 'Fleet' },
      { key: 'ops-stock', label: 'Stock' },
    ],
  },
  { key: 'sales', label: 'Sales' },
];`;

  protected readonly reactiveScript = `readonly locked = signal(false);
readonly group = new FormGroup({
  reference: new FormControl('ORD-1042'),
  delivery: new SignalFormControl<Date | null>(null, (path) => {
    disabled(path, { when: () => this.locked() });
  }),
  confirmed: new SignalFormControl(false, (path) => {
    disabled(path, { when: () => this.locked() });
  }),
});
// Keeps group.status in step with Signal Forms rules.
private readonly sync = syncSignalFormControls(this.group);`;
}
