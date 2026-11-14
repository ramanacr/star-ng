import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import { StarField } from 'star-ng/field';
import { StarMultiSelect, StarOptionTemplate } from 'star-ng/select';
import { DOCS, DocsRow } from '../shared/docs';

interface Department {
  readonly id: string;
  readonly name: string;
  readonly site: string;
  readonly closed?: boolean;
}

@Component({
  selector: 'docs-multi-select-page',
  imports: [DOCS, StarMultiSelect, StarOptionTemplate, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Multi-select"
      lead="A dropdown for several choices. The panel has a checkbox for every option, a select all box and an optional filter. The trigger shows the chosen labels as text or as removable chips."
      importFrom="import { StarMultiSelect } from 'star-ng/select';"
    >
      <docs-example
        heading="Basic"
        source="multi-select/basic"
        [script]="basicScript"
        note="The value is an array. Space and Enter toggle the active option and keep the panel open. Above maxSelectedLabels (3 by default) the trigger shows a count."
      >
        <div class="docs-stack">
          <star-multi-select
            [options]="departments"
            optionLabel="name"
            optionValue="id"
            [(value)]="chosen"
            placeholder="Select departments"
            ariaLabel="Departments"
          />
          <p class="docs-output" role="status">Chosen: {{ chosen().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Chips, filter and clear button"
        source="multi-select/chips"
        note="display chip shows removable chips. filter adds a search field. showClear adds a button that removes every choice."
      >
        <star-multi-select
          [options]="departments"
          optionLabel="name"
          optionValue="id"
          [(value)]="chips"
          display="chip"
          placeholder="Select departments"
          ariaLabel="Departments as chips"
          filter
          showClear
        />
      </docs-example>

      <docs-example
        heading="Groups and disabled options"
        source="multi-select/groups"
        note="optionGroup shows headings. optionDisabled marks options that cannot be chosen. Select all only touches enabled options that the filter shows."
      >
        <star-multi-select
          [options]="departments"
          optionLabel="name"
          optionValue="id"
          optionGroup="site"
          optionDisabled="closed"
          [(value)]="grouped"
          placeholder="Departments by site"
          ariaLabel="Departments by site"
        />
      </docs-example>

      <docs-example
        heading="Selection limit"
        source="multi-select/limit"
        note="selectionLimit stops choices at a number. The select all box is hidden when a limit is set."
      >
        <star-multi-select
          [options]="departments"
          optionLabel="name"
          optionValue="id"
          [selectionLimit]="2"
          placeholder="Pick up to 2"
          ariaLabel="Limited departments"
        />
      </docs-example>

      <docs-example
        heading="Option template"
        source="multi-select/template"
        note="A starOption template draws each row. The checkbox stays."
      >
        <star-multi-select
          [options]="departments"
          optionLabel="name"
          optionValue="id"
          [(value)]="templated"
          placeholder="Select departments"
          ariaLabel="Departments with template"
        >
          <ng-template starOption [starOptionOf]="departments" let-item let-selected="selected">
            <span>
              {{ item.name }}
              <small>{{ item.site }}</small>
            </span>
          </ng-template>
        </star-multi-select>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="multi-select/form"
        [script]="formScript"
        note="Bind with formField. The rule here needs at least two choices."
      >
        <div class="docs-stack">
          <star-field label="Teams" for="multi-form-teams" [state]="team.departments()">
            <star-multi-select
              inputId="multi-form-teams"
              [formField]="team.departments"
              [options]="departments"
              optionLabel="name"
              optionValue="id"
              display="chip"
              placeholder="Select at least two"
              ariaLabel="Teams"
              showClear
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ team().valid() }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The panel is aligned with the start edge of the field: the right edge in a right-to-left
        page. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarMultiSelect', 'StarOptionListBase']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class MultiSelectPage {
  protected readonly departments: readonly Department[] = [
    { id: 'fin', name: 'Finance', site: 'Berlin' },
    { id: 'hr', name: 'People', site: 'Berlin' },
    { id: 'eng', name: 'Engineering', site: 'Pune' },
    { id: 'ops', name: 'Operations', site: 'Pune' },
    { id: 'mkt', name: 'Marketing', site: 'Lisbon', closed: true },
  ];

  protected readonly chosen = signal<readonly string[]>([]);
  protected readonly chips = signal<readonly string[]>(['eng', 'ops']);
  protected readonly grouped = signal<readonly string[]>([]);
  protected readonly templated = signal<readonly string[]>([]);

  protected readonly teamModel = signal<{ departments: readonly string[] }>({ departments: [] });
  protected readonly team = form(this.teamModel, (path) => {
    minLength(path.departments, 2, { message: 'Select at least two departments.' });
  });

  protected readonly basicScript = `readonly departments: readonly Department[] = [
  { id: 'fin', name: 'Finance', site: 'Berlin' },
  { id: 'hr', name: 'People', site: 'Berlin' },
  { id: 'eng', name: 'Engineering', site: 'Pune' },
];
readonly chosen = signal<readonly string[]>([]);`;
  protected readonly formScript = `readonly teamModel = signal<{ departments: readonly string[] }>({ departments: [] });
readonly team = form(this.teamModel, (path) => {
  minLength(path.departments, 2, { message: 'Select at least two departments.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starOption]',
      description:
        'Content child. Draws the text of one option row. The context has $implicit, selected and index.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the control.' },
    { name: '--star-border', description: 'Border of the control and the panel.' },
    { name: '--star-accent', description: 'Border of the focused control.' },
    { name: '--star-primary', description: 'Fill of a checked box.' },
    { name: '--star-surface-muted', description: 'Background of the control and the active row.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space / Arrow down', description: 'On the trigger: opens the panel.' },
    {
      name: 'Arrow up / Arrow down',
      description: 'Moves the active option. Disabled options are skipped.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last enabled option.' },
    { name: 'Enter / Space', description: 'Toggles the active option. The panel stays open.' },
    {
      name: 'Letter keys',
      description: 'Typeahead: moves to the option that starts with the typed text.',
    },
    { name: 'Escape', description: 'Closes the panel. The focus returns to the trigger.' },
  ];
}
