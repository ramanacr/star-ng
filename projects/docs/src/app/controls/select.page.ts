import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { StarField } from 'star-ng/field';
import { StarOptionTemplate, StarSelect } from 'star-ng/select';
import { DOCS, DocsRow } from '../shared/docs';

interface Country {
  readonly code: string;
  readonly name: string;
  readonly region: string;
  readonly closed?: boolean;
}

@Component({
  selector: 'docs-select-page',
  imports: [DOCS, StarSelect, StarOptionTemplate, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Select"
      lead="A dropdown for one choice. It is a select-only combobox (WAI-ARIA) with a listbox panel: typed options, filter, groups, option templates, a clear button, a loading state and virtual scroll for long lists."
      importFrom="import { StarSelect, StarOptionTemplate } from 'star-ng/select';"
    >
      <docs-example
        heading="Objects as options"
        source="select/basic"
        [script]="basicScript"
        note="optionLabel and optionValue take a property name or a function. Without optionValue the value is the whole option. Without optionLabel the option itself is the text."
      >
        <div class="docs-stack">
          <star-select
            [options]="countries"
            optionLabel="name"
            optionValue="code"
            [(value)]="country"
            placeholder="Select a country"
            ariaLabel="Country"
          />
          <p class="docs-output" role="status">Country: {{ country() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Filter and clear button"
        source="select/filter"
        note="filter adds a search field at the top of the panel. showClear adds a button that sets the value to null."
      >
        <div class="docs-stack">
          <star-select
            [options]="countries"
            optionLabel="name"
            optionValue="code"
            [(value)]="filtered"
            placeholder="Search a country"
            ariaLabel="Country with filter"
            filter
            showClear
          />
          <p class="docs-output" role="status">Filtered: {{ filtered() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Groups"
        source="select/groups"
        note="optionGroup is the property (or function) with the group heading. Options of one group show together, in the order in which the headings first appear."
      >
        <star-select
          [options]="countries"
          optionLabel="name"
          optionValue="code"
          optionGroup="region"
          [(value)]="grouped"
          placeholder="Grouped by region"
          ariaLabel="Country by region"
        />
      </docs-example>

      <docs-example
        heading="Disabled options"
        source="select/disabled-options"
        note="optionDisabled marks options that the user cannot choose. The keyboard skips them."
      >
        <star-select
          [options]="countries"
          optionLabel="name"
          optionValue="code"
          optionDisabled="closed"
          [(value)]="open"
          placeholder="Offices (one is closed)"
          ariaLabel="Office"
        />
      </docs-example>

      <docs-example
        heading="Option template"
        source="select/template"
        [script]="templateScript"
        note="A star-select content child ng-template with starOption draws each row. The context has the option, selected and index. Pass starOptionOf to type the option."
      >
        <star-select
          [options]="countries"
          optionLabel="name"
          optionValue="code"
          [(value)]="templated"
          placeholder="Select a country"
          ariaLabel="Country with template"
        >
          <ng-template starOption [starOptionOf]="countries" let-item>
            <span>
              {{ item.name }}
              <small>{{ item.region }}</small>
            </span>
          </ng-template>
        </star-select>
      </docs-example>

      <docs-example
        heading="Virtual scroll"
        source="select/virtual"
        [script]="virtualScript"
        note="virtualScroll renders only the lines in view. Every line has the height virtualItemSize (40 px by default) and the text stays on one line. End goes to the last of 5,000 options."
      >
        <star-select
          [options]="orders"
          [(value)]="order"
          placeholder="5,000 orders"
          ariaLabel="Order"
          virtualScroll
          filter
        />
      </docs-example>

      <docs-example
        heading="Sizes and states"
        source="select/states"
        note="loading shows a spinner in place of the caret. A disabled select takes no focus. A read-only select keeps its value and does not open."
      >
        <div class="docs-stack">
          <star-select [options]="regions" size="sm" placeholder="Small" ariaLabel="Small select" />
          <star-select [options]="regions" disabled placeholder="Disabled" ariaLabel="Disabled" />
          <star-select [options]="regions" [value]="'EMEA'" readonly ariaLabel="Read-only" />
          <star-select [options]="[]" loading placeholder="Loading options" ariaLabel="Loading" />
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="select/form"
        [script]="formScript"
        note="star-select is a Signal Forms control: bind it with formField. Pass the field state to star-field and the error shows after the user leaves the control."
      >
        <div class="docs-stack">
          <star-field label="Office country" for="select-form-country" [state]="office.country()">
            <star-select
              inputId="select-form-country"
              [formField]="office.country"
              [options]="countries"
              optionLabel="name"
              optionValue="code"
              placeholder="Select a country"
              ariaLabel="Office country"
              showClear
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ office().valid() }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarSelect', 'StarOptionListBase', 'StarOptionTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Technical notes</h2>
      <p>
        The panel is a native popover placed by the Angular CDK overlay, so it also works inside a
        modal dialog. The select is the PrimeNG <code>p-select</code> equivalent. The focus stays on
        the combobox: the active option is named by <code>aria-activedescendant</code>.
      </p>
    </docs-page>
  `,
})
export class SelectPage {
  protected readonly countries: readonly Country[] = [
    { code: 'DE', name: 'Germany', region: 'Europe' },
    { code: 'FR', name: 'France', region: 'Europe' },
    { code: 'IN', name: 'India', region: 'Asia' },
    { code: 'JP', name: 'Japan', region: 'Asia', closed: true },
    { code: 'BR', name: 'Brazil', region: 'Americas' },
    { code: 'CA', name: 'Canada', region: 'Americas' },
  ];
  protected readonly regions = ['EMEA', 'APAC', 'Americas'];
  protected readonly orders: readonly string[] = Array.from(
    { length: 5000 },
    (_, index) => `Order ${String(index + 1).padStart(5, '0')}`,
  );

  protected readonly country = signal<string | null>(null);
  protected readonly filtered = signal<string | null>(null);
  protected readonly grouped = signal<string | null>(null);
  protected readonly open = signal<string | null>(null);
  protected readonly templated = signal<string | null>(null);
  protected readonly order = signal<string | null>(null);

  protected readonly officeModel = signal<{ country: string | null }>({ country: null });
  protected readonly office = form(this.officeModel, (path) => {
    required(path.country, { message: 'Select a country.' });
  });

  protected readonly basicScript = `readonly countries: readonly Country[] = [
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'FR', name: 'France', region: 'Europe' },
  { code: 'IN', name: 'India', region: 'Asia' },
];
readonly country = signal<string | null>(null);`;
  protected readonly templateScript = `// Import StarOptionTemplate in the component imports.
readonly countries: readonly Country[] = [
  { code: 'DE', name: 'Germany', region: 'Europe' },
  { code: 'IN', name: 'India', region: 'Asia' },
];`;
  protected readonly virtualScript = `readonly orders: readonly string[] = Array.from(
  { length: 5000 },
  (_, index) => \`Order \${String(index + 1).padStart(5, '0')}\`,
);`;
  protected readonly formScript = `readonly officeModel = signal<{ country: string | null }>({ country: null });
readonly office = form(this.officeModel, (path) => {
  required(path.country, { message: 'Select a country.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starOption]',
      description:
        'Content child. Draws one option row. The context has $implicit (the option), selected and index.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the control.' },
    { name: '--star-border', description: 'Border of the control and the panel.' },
    { name: '--star-surface-muted', description: 'Background of the control at rest.' },
    { name: '--star-accent', description: 'Border of the focused control.' },
    { name: '--star-focus-ring', description: 'Focus ring (box-shadow).' },
    { name: '--star-danger', description: 'Border of an invalid control.' },
    { name: '--star-primary', description: 'Check mark of the chosen option.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space / Arrow down', description: 'On the trigger: opens the panel.' },
    {
      name: 'Arrow up / Arrow down',
      description: 'Moves the active option. Disabled options are skipped.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last enabled option.' },
    { name: 'Enter / Space', description: 'Chooses the active option and closes the panel.' },
    { name: 'Alt + Arrow up', description: 'Chooses the active option and closes the panel.' },
    {
      name: 'Letter keys',
      description:
        'Typeahead: moves to the option that starts with the typed text. On a closed select it also chooses it.',
    },
    { name: 'Escape', description: 'Closes the panel. The focus stays on the trigger.' },
    { name: 'Tab', description: 'Closes the panel and moves the focus on.' },
  ];
}
