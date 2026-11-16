import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import { STAR_SLOTS } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import { StarChipTemplate, StarMultiSelect, StarOptionTemplate } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';

interface Department {
  readonly id: string;
  readonly name: string;
  readonly site: string;
  readonly closed?: boolean;
}

interface City {
  readonly code: string;
  readonly name: string;
}

interface Parcel {
  readonly id: number;
  readonly name: string;
}

@Component({
  selector: 'docs-multi-select-page',
  imports: [
    DOCS,
    StarMultiSelect,
    StarOptionTemplate,
    StarChipTemplate,
    STAR_SLOTS,
    StarField,
    FormField,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Multi-select"
      lead="A dropdown for several choices. The panel has a checkbox for every option, a select all box and an optional filter. The trigger shows the chosen labels as text or as removable chips."
      importFrom="import { StarMultiSelect } from '@star-ng/ui/select';"
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
        heading="Large list"
        source="multi-select/large"
        [script]="largeScript"
        note="virtualScroll renders only the lines in view, also with select all. Select all chooses every enabled option, also those that are not in the DOM. Arrow keys, Home, End, Page up, Page down and type-ahead reach all 10,000 options."
      >
        <div class="docs-stack">
          <star-multi-select
            [options]="parcels"
            optionLabel="name"
            optionValue="id"
            [(value)]="selectedParcels"
            placeholder="10,000 parcels"
            ariaLabel="Parcels"
            virtualScroll
          />
          <p class="docs-output" role="status">Parcels: {{ selectedParcels().length }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Slots"
        source="multi-select/slots"
        [script]="slotsScript"
        note="Content child templates change parts of the control. starChip draws one chip when display is chip. Its context has remove, which removes that option. starHeader and starFooter add content to the panel. starEmpty gets the filter text."
      >
        <star-multi-select
          [options]="cities"
          optionLabel="name"
          optionValue="code"
          [(value)]="visited"
          display="chip"
          placeholder="Select cities"
          ariaLabel="Cities"
          filter
        >
          <ng-template starHeader>
            <p class="docs-output">Cities with an office</p>
          </ng-template>
          <ng-template starEmpty let-text>No city matches {{ text }}.</ng-template>
          <ng-template starChip [starChipOf]="cities" let-item let-remove="remove">
            <span class="star-chip star-chip--sm">
              {{ item.code }}
              <button type="button" class="star-chip__remove" tabindex="-1" (click)="remove()">
                x
              </button>
            </span>
          </ng-template>
          <ng-template starFooter>
            <p class="docs-output">{{ cities.length }} cities</p>
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
        [of]="['StarMultiSelect', 'StarOptionListBase', 'StarChipTemplate']"
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

  protected readonly parcels: readonly Parcel[] = Array.from({ length: 10_000 }, (_, index) => ({
    id: index + 1,
    name: `Parcel ${index + 1}`,
  }));

  protected readonly cities: readonly City[] = [
    { code: 'BER', name: 'Berlin' },
    { code: 'PAR', name: 'Paris' },
    { code: 'PUN', name: 'Pune' },
    { code: 'LIS', name: 'Lisbon' },
  ];
  protected readonly visited = signal<readonly string[]>(['BER', 'PUN']);
  protected readonly chosen = signal<readonly string[]>([]);
  protected readonly chips = signal<readonly string[]>(['eng', 'ops']);
  protected readonly grouped = signal<readonly string[]>([]);
  protected readonly templated = signal<readonly string[]>([]);
  protected readonly selectedParcels = signal<readonly number[]>([]);

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
  protected readonly largeScript = `readonly parcels: readonly Parcel[] = Array.from({ length: 10_000 }, (_, index) => ({
  id: index + 1,
  name: \`Parcel \${index + 1}\`,
}));
readonly selectedParcels = signal<readonly number[]>([]);`;
  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core' and StarChipTemplate in the component imports.
readonly cities: readonly City[] = [
  { code: 'BER', name: 'Berlin' },
  { code: 'PAR', name: 'Paris' },
  { code: 'PUN', name: 'Pune' },
];
readonly visited = signal<readonly string[]>(['BER', 'PUN']);`;
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
    {
      name: 'ng-template[starChip]',
      description:
        'Content child. Draws one chip when display is chip. $implicit is the option. remove() removes it from the value.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content at the top of the panel, above the filter.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content at the bottom of the panel, below the list.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Content child. Replaces the empty message. $implicit is the filter text.',
    },
    {
      name: 'ng-template[starLoading]',
      description: 'Content child. A row at the top of the list while loading is on.',
    },
    {
      name: 'ng-template[starGroup]',
      description:
        'Content child. Replaces the text of a group heading. $implicit is the label and count is the number of options in the group after filtering.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. Replaces one icon. Set starIcon to dropdown, clear, filter or check.',
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
    {
      name: 'Page up / Page down',
      description:
        'With virtualScroll: moves the active option by the lines in view, over all options. Disabled options are skipped.',
    },
    { name: 'Enter / Space', description: 'Toggles the active option. The panel stays open.' },
    {
      name: 'Letter keys',
      description:
        'Typeahead: moves to the option that starts with the typed text. A space in the middle of the typed text belongs to the text.',
    },
    { name: 'Escape', description: 'Closes the panel. The focus returns to the trigger.' },
  ];
}
