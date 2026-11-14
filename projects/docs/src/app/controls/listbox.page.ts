import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import { StarField } from 'star-ng/field';
import { StarListbox } from 'star-ng/listbox';
import { StarOptionTemplate } from 'star-ng/select';
import { DOCS, DocsRow } from '../shared/docs';

interface Queue {
  readonly id: string;
  readonly name: string;
  readonly site: string;
  readonly closed?: boolean;
}

@Component({
  selector: 'docs-listbox-page',
  imports: [DOCS, StarListbox, StarOptionTemplate, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Listbox"
      lead="A list of choices that stays in the page. It chooses one value, or several with checkboxes. It has a filter, groups and option templates."
      importFrom="import { StarListbox } from 'star-ng/listbox';"
    >
      <docs-example
        heading="Single choice"
        source="listbox/single"
        [script]="singleScript"
        note="The list has one tab stop. Arrow keys move the active option and choose it. Letters jump to the option that starts with the typed text."
      >
        <div class="docs-stack">
          <star-listbox
            [options]="queues"
            optionLabel="name"
            optionValue="id"
            [(value)]="queue"
            scrollHeight="12rem"
            ariaLabel="Queue"
          />
          <p class="docs-output" role="status">Queue: {{ queue() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Multiple with filter"
        source="listbox/multiple"
        note="multiple adds a checkbox to each row, and the value is an array. Space and Enter toggle the active option. filter adds a search field."
      >
        <div class="docs-stack">
          <star-listbox
            [options]="queues"
            optionLabel="name"
            optionValue="id"
            [(value)]="many"
            multiple
            filter
            scrollHeight="12rem"
            ariaLabel="Queues"
          />
          <p class="docs-output" role="status">Queues: {{ manyText() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Groups and disabled options"
        source="listbox/groups"
        note="optionGroup shows headings. optionDisabled marks options that cannot be chosen; the keyboard does not choose them."
      >
        <star-listbox
          [options]="queues"
          optionLabel="name"
          optionValue="id"
          optionGroup="site"
          optionDisabled="closed"
          [(value)]="grouped"
          scrollHeight="14rem"
          ariaLabel="Queue by site"
        />
      </docs-example>

      <docs-example
        heading="Option template"
        source="listbox/template"
        note="A starOption template (from star-ng/select) draws each row."
      >
        <star-listbox
          [options]="queues"
          optionLabel="name"
          optionValue="id"
          [(value)]="templated"
          scrollHeight="12rem"
          ariaLabel="Queue with template"
        >
          <ng-template starOption [starOptionOf]="queues" let-item let-selected="selected">
            <span>
              {{ item.name }}
              <small>{{ item.site }}</small>
            </span>
          </ng-template>
        </star-listbox>
      </docs-example>

      <docs-example
        heading="Disabled"
        source="listbox/disabled"
        note="A disabled listbox takes no focus and does not change."
      >
        <star-listbox
          [options]="queues"
          optionLabel="name"
          optionValue="id"
          [value]="'intake'"
          disabled
          scrollHeight="8rem"
          ariaLabel="Disabled queue"
        />
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="listbox/form"
        [script]="formScript"
        note="Bind with formField. The rule here needs at least one choice. The listbox is a focusable list: it has no input id, so label it with ariaLabel."
      >
        <div class="docs-stack">
          <star-field label="Notify queues" [state]="alert.queues()">
            <star-listbox
              [formField]="alert.queues"
              [options]="queues"
              optionLabel="name"
              optionValue="id"
              multiple
              scrollHeight="10rem"
              ariaLabel="Notify queues"
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ alert().valid() }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarListbox', 'StarOptionTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ListboxPage {
  protected readonly queues: readonly Queue[] = [
    { id: 'intake', name: 'Intake', site: 'Berlin' },
    { id: 'billing', name: 'Billing', site: 'Berlin' },
    { id: 'support', name: 'Support', site: 'Pune' },
    { id: 'returns', name: 'Returns', site: 'Pune', closed: true },
    { id: 'partners', name: 'Partners', site: 'Lisbon' },
  ];

  protected readonly queue = signal<string | readonly string[] | null>(null);
  protected readonly many = signal<string | readonly string[] | null>(['billing']);
  protected readonly grouped = signal<string | readonly string[] | null>(null);
  protected readonly templated = signal<string | readonly string[] | null>(null);

  protected manyText(): string {
    const value = this.many();
    return Array.isArray(value) && value.length ? value.join(', ') : 'none';
  }

  protected readonly alertModel = signal<{ queues: readonly string[] }>({ queues: [] });
  protected readonly alert = form(this.alertModel, (path) => {
    minLength(path.queues, 1, { message: 'Select at least one queue.' });
  });

  protected readonly singleScript = `readonly queues: readonly Queue[] = [
  { id: 'intake', name: 'Intake', site: 'Berlin' },
  { id: 'billing', name: 'Billing', site: 'Berlin' },
  { id: 'support', name: 'Support', site: 'Pune' },
];
readonly queue = signal<string | readonly string[] | null>(null);`;
  protected readonly formScript = `readonly alertModel = signal<{ queues: readonly string[] }>({ queues: [] });
readonly alert = form(this.alertModel, (path) => {
  minLength(path.queues, 1, { message: 'Select at least one queue.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starOption]',
      description:
        'Content child. Draws the text of one option row. The context has $implicit, selected and index.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Border of the box.' },
    { name: '--star-radius-lg', description: 'Corner radius of the box.' },
    { name: '--star-accent', description: 'Border of the box when the list has focus.' },
    { name: '--star-focus-ring', description: 'Focus ring (box-shadow).' },
    { name: '--star-danger', description: 'Border of an invalid box.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow up / Arrow down',
      description: 'Moves the active option. In single mode it also chooses the option.',
    },
    { name: 'Home / End', description: 'Moves to the first or the last option.' },
    {
      name: 'Enter / Space',
      description: 'Chooses the active option, or toggles it in multiple mode.',
    },
    {
      name: 'Letter keys',
      description: 'Typeahead: moves to the option that starts with the typed text.',
    },
  ];
}
