import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { StarField } from 'star-ng/field';
import { StarCascadeSelect } from 'star-ng/select';
import { DOCS, DocsRow } from '../shared/docs';

interface Place {
  readonly name: string;
  readonly code?: string;
  readonly closed?: boolean;
  readonly children?: readonly Place[];
}

@Component({
  selector: 'docs-cascade-select-page',
  imports: [DOCS, StarCascadeSelect, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Cascade select"
      lead="A dropdown for one leaf of nested options, for example country, state and city. The popup is a menu with submenus. The value is the leaf."
      importFrom="import { StarCascadeSelect } from 'star-ng/select';"
    >
      <docs-example
        heading="Country, state and city"
        source="cascade-select/basic"
        [script]="basicScript"
        note="optionChildren is the property (or function) with the child options; it is children by default. An option without children is a leaf. The value comes from optionValue of the leaf."
      >
        <div class="docs-stack">
          <star-cascade-select
            [options]="places"
            optionLabel="name"
            optionValue="code"
            [(value)]="place"
            placeholder="Choose a city"
            ariaLabel="City"
          />
          <p class="docs-output" role="status">Value: {{ place() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Whole path and clear button"
        source="cascade-select/path"
        note="showPath shows 'Germany / Bavaria / Nuremberg' instead of the leaf label. showClear adds a button that sets the value to null."
      >
        <star-cascade-select
          [options]="places"
          optionLabel="name"
          optionValue="code"
          [(value)]="pathPlace"
          placeholder="Choose a city"
          ariaLabel="City with path"
          showPath
          showClear
        />
      </docs-example>

      <docs-example
        heading="Disabled options and states"
        source="cascade-select/states"
        note="optionDisabled marks an option that the user cannot choose. A disabled or read-only select does not open."
      >
        <div class="docs-stack">
          <star-cascade-select
            [options]="places"
            optionLabel="name"
            optionValue="code"
            optionDisabled="closed"
            placeholder="One city is closed"
            ariaLabel="City with a closed office"
          />
          <star-cascade-select
            [options]="places"
            optionLabel="name"
            optionValue="code"
            size="sm"
            disabled
            placeholder="Disabled"
            ariaLabel="Disabled city"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="cascade-select/form"
        [script]="formScript"
        note="Bind with formField. Pass the field state to star-field."
      >
        <div class="docs-stack">
          <star-field label="Office city" for="cascade-form-city" [state]="office.city()">
            <star-cascade-select
              inputId="cascade-form-city"
              [formField]="office.city"
              [options]="places"
              optionLabel="name"
              optionValue="code"
              placeholder="Choose a city"
              showPath
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ office().valid() }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The list opens aligned with the start edge of the field. In a right-to-left page Arrow left
        opens a submenu and Arrow right returns to the parent option. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarCascadeSelect']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class CascadeSelectPage {
  protected readonly places: readonly Place[] = [
    {
      name: 'Germany',
      children: [
        {
          name: 'Bavaria',
          children: [
            { name: 'Munich', code: 'DE-MUC' },
            { name: 'Nuremberg', code: 'DE-NUE' },
          ],
        },
        { name: 'Hesse', children: [{ name: 'Frankfurt', code: 'DE-FRA' }] },
      ],
    },
    {
      name: 'India',
      children: [
        { name: 'Maharashtra', children: [{ name: 'Pune', code: 'IN-PNQ' }] },
        { name: 'Telangana', children: [{ name: 'Hyderabad', code: 'IN-HYD', closed: true }] },
      ],
    },
    { name: 'Remote', code: 'REMOTE' },
  ];

  protected readonly place = signal<string | null>(null);
  protected readonly pathPlace = signal<string | null>(null);

  protected readonly officeModel = signal<{ city: string | null }>({ city: null });
  protected readonly office = form(this.officeModel, (path) => {
    required(path.city, { message: 'Choose a city.' });
  });

  protected readonly basicScript = `readonly places: readonly Place[] = [
  {
    name: 'Germany',
    children: [
      {
        name: 'Bavaria',
        children: [
          { name: 'Munich', code: 'DE-MUC' },
          { name: 'Nuremberg', code: 'DE-NUE' },
        ],
      },
    ],
  },
  { name: 'Remote', code: 'REMOTE' },
];
readonly place = signal<string | null>(null);`;
  protected readonly formScript = `readonly officeModel = signal<{ city: string | null }>({ city: null });
readonly office = form(this.officeModel, (path) => {
  required(path.city, { message: 'Choose a city.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The options come from the options input, not from content.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the control.' },
    { name: '--star-border', description: 'Border of the control.' },
    { name: '--star-accent', description: 'Border of the focused control.' },
    { name: '--star-danger', description: 'Border of an invalid control.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space / Arrow down', description: 'On the trigger: opens the menu.' },
    { name: 'Arrow up / Arrow down', description: 'Moves between the options of one level.' },
    { name: 'Arrow right', description: 'Opens the submenu of the focused option.' },
    { name: 'Arrow left', description: 'Closes a submenu and returns to its parent option.' },
    { name: 'Enter / Space', description: 'Chooses the focused leaf and closes the menu.' },
    {
      name: 'Letter keys',
      description: 'Typeahead: moves to the option that starts with the typed text.',
    },
    { name: 'Escape', description: 'Closes the menu. The focus returns to the trigger.' },
  ];
}
