import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { STAR_UI_TEXT, StarFilterService } from '@star-ng/ui/core';
import {
  StarQueryBuilder,
  starQueryComplete,
  StarQueryField,
  StarQueryGroup,
  starQueryToPredicate,
  starQueryToText,
  StarQueryValue,
} from '@star-ng/ui/query-builder';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { StarTable } from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';
import { DocsFill, formatDay, Order, orderColumns, ORDERS } from './table-demo';

/** Calendar day of an order as `yyyy-mm-dd`, the value shape of a date rule. */
const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './query-builder.page.scss',
  selector: 'docs-query-builder-page',
  imports: [
    DOCS,
    DocsFill,
    FormField,
    StarQueryBuilder,
    StarQueryValue,
    StarSelectButton,
    StarTable,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Query builder"
      lead="Build a filter from rules and nested groups joined with and or or. Each rule has a field, a match mode and a value editor for the field type. The match modes are the ones of the table filter, and starQueryToPredicate turns the query into a row test. The query model (starQueryToPredicate, starQueryToText, starQueryComplete and the query types) is also in the entry point @star-ng/ui/query-builder/model, which does not load the component. The Ignite UI equivalent is igx-query-builder; the Syncfusion equivalent is ejs-querybuilder; the Kendo UI equivalent is kendo-filter."
      importFrom="import { StarQueryBuilder, starQueryToPredicate } from '@star-ng/ui/query-builder';"
    >
      <docs-example
        heading="Filter a table"
        source="query-builder/table"
        [script]="tableScript"
        note="starQueryToPredicate(query, fields, filterService) gives a row test with the match logic of the table filter. An incomplete rule (no value, only one bound of Between, no choice for Is one of) does not filter and is not in the summary until it is complete. starQueryToText gives the summary."
      >
        <div class="docs-stack">
          <star-query-builder [fields]="fields" [(value)]="query" />
          <p class="docs-output" role="status">{{ summary() }} ({{ rows().length }} orders)</p>
          <docs-fill>
            <star-table
              [value]="rows()"
              [columns]="columns"
              dataKey="id"
              ariaLabel="Filtered orders"
              paginator
              [rows]="5"
            />
          </docs-fill>
        </div>
      </docs-example>

      <docs-example
        heading="Nested groups"
        source="query-builder/nested"
        [script]="nestedScript"
        note="Add group adds a group inside a group, up to maxDepth levels (default 3, the root included). Each group is a named group: Match all of, or Match any of. On a focused rule row, Delete removes the rule (Control+Z restores it) and Alt with the up or down arrow moves it."
      >
        <star-query-builder [fields]="fields" [maxDepth]="3" [(value)]="nested" />
      </docs-example>

      <docs-example
        heading="Custom value editor and custom match mode"
        source="query-builder/custom"
        [script]="customScript"
        note="An ng-template with starQueryValue replaces the value editor of the named fields; its context has rule, field and setValue. A mode registered with StarFilterService works in matchModes and in the predicate."
      >
        <div class="docs-stack">
          <star-query-builder [fields]="customFields" [(value)]="custom">
            <ng-template starQueryValue="region" let-rule let-setValue="setValue">
              <star-select-button
                size="sm"
                [options]="regions"
                [value]="regionOf(rule.value)"
                (valueChange)="setValue($event)"
                ariaLabel="Region"
              />
            </ng-template>
          </star-query-builder>
          <p class="docs-output" role="status">
            {{ customSummary() }} ({{ customRows().length }} orders)
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Forms and validation"
        source="query-builder/forms"
        [script]="formsScript"
        note="Bind the builder with [formField]. starQueryComplete(path, fields) makes the field invalid while a rule is incomplete; pass the message from STAR_UI_TEXT (queryIncomplete), as a function so it follows the language. The builder marks such rules and shows the error text after the focus leaves it. The summary prints the raw values, not locale-formatted ones. With Reactive Forms, use the same rule in a SignalFormControl."
      >
        <div class="docs-stack">
          <star-query-builder [fields]="fields" [formField]="filter" />
          <p class="docs-output" role="status">
            {{ filter().valid() ? 'Valid query.' : filter().errors()[0]?.message }}
          </p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarQueryBuilder', 'StarQueryValue']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class QueryBuilderPage {
  private readonly text = inject(STAR_UI_TEXT);
  private readonly filters = inject(StarFilterService);

  protected readonly columns = [
    ...orderColumns(),
    { field: 'placed', header: 'Placed', format: (row: Order) => formatDay(row.placed) },
  ];

  protected readonly fields: StarQueryField<Order>[] = [
    { field: 'customer', label: 'Customer', type: 'text' },
    { field: 'total', label: 'Total', type: 'number' },
    { field: 'quantity', label: 'Quantity', type: 'number' },
    { field: 'placed', label: 'Placed', type: 'date', value: (order) => isoDay(order.placed) },
    {
      field: 'status',
      label: 'Status',
      type: 'select',
      options: ['Open', 'Paid', 'Shipped', 'Overdue', 'Cancelled'],
    },
    { field: 'region', label: 'Region', type: 'select', options: ['Europe', 'Asia', 'Americas'] },
  ];

  protected readonly query = signal<StarQueryGroup>({
    operator: 'and',
    rules: [
      { field: 'status', matchMode: 'in', value: ['Open', 'Overdue'] },
      { field: 'total', matchMode: 'gte', value: 100 },
    ],
  });
  protected readonly rows = computed(() =>
    ORDERS.filter(starQueryToPredicate(this.query(), this.fields, this.filters)),
  );
  protected readonly summary = computed(() =>
    starQueryToText(this.query(), this.fields, this.text, this.filters),
  );

  protected readonly nested = signal<StarQueryGroup>({
    operator: 'and',
    rules: [
      { field: 'region', matchMode: 'equals', value: 'Europe' },
      {
        operator: 'or',
        rules: [
          { field: 'quantity', matchMode: 'gt', value: 5 },
          {
            field: 'placed',
            matchMode: 'between',
            value: { min: '2026-03-01', max: '2026-03-31' },
          },
        ],
      },
    ],
  });

  protected readonly regions = ['Europe', 'Asia', 'Americas'];
  protected regionOf(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }
  protected readonly customFields: StarQueryField<Order>[] = [
    { field: 'region', label: 'Region', type: 'text', matchModes: ['equals', 'notEquals'] },
    { field: 'total', label: 'Total', type: 'number', matchModes: ['roundHundred', 'gt', 'lt'] },
  ];
  protected readonly custom = signal<StarQueryGroup>({
    operator: 'and',
    rules: [
      { field: 'region', matchMode: 'equals', value: 'Asia' },
      { field: 'total', matchMode: 'roundHundred', value: 'yes' },
    ],
  });
  protected readonly customRows = computed(() =>
    ORDERS.filter(starQueryToPredicate(this.custom(), this.customFields, this.filters)),
  );
  protected readonly customSummary = computed(() =>
    starQueryToText(this.custom(), this.customFields, this.text, this.filters),
  );

  protected readonly filterModel = signal<StarQueryGroup>({
    operator: 'and',
    rules: [{ field: 'customer', matchMode: 'contains', value: '' }],
  });
  protected readonly filter = form(this.filterModel, (path) =>
    starQueryComplete(path, this.fields, { message: () => this.text.queryIncomplete }),
  );

  constructor() {
    this.filters.register(
      'roundHundred',
      (value) => Number(value) >= 100,
      'Is 100 or more (custom)',
    );
  }

  protected readonly tableScript = `readonly fields: StarQueryField<Order>[] = [
  { field: 'customer', label: 'Customer', type: 'text' },
  { field: 'total', label: 'Total', type: 'number' },
  { field: 'quantity', label: 'Quantity', type: 'number' },
  { field: 'placed', label: 'Placed', type: 'date', value: (order) => isoDay(order.placed) },
  { field: 'status', label: 'Status', type: 'select', options: ['Open', 'Paid', 'Shipped', 'Overdue', 'Cancelled'] },
  { field: 'region', label: 'Region', type: 'select', options: ['Europe', 'Asia', 'Americas'] },
];
readonly query = signal<StarQueryGroup>({
  operator: 'and',
  rules: [
    { field: 'status', matchMode: 'in', value: ['Open', 'Overdue'] },
    { field: 'total', matchMode: 'gte', value: 100 },
  ],
});
readonly rows = computed(() =>
  ORDERS.filter(starQueryToPredicate(this.query(), this.fields, this.filters)),
);
readonly summary = computed(() =>
  starQueryToText(this.query(), this.fields, inject(STAR_UI_TEXT), this.filters),
);`;
  protected readonly nestedScript = `readonly nested = signal<StarQueryGroup>({
  operator: 'and',
  rules: [
    { field: 'region', matchMode: 'equals', value: 'Europe' },
    {
      operator: 'or',
      rules: [
        { field: 'quantity', matchMode: 'gt', value: 5 },
        { field: 'placed', matchMode: 'between', value: { min: '2026-03-01', max: '2026-03-31' } },
      ],
    },
  ],
});`;
  protected readonly customScript = `readonly regions = ['Europe', 'Asia', 'Americas'];
regionOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
readonly customFields: StarQueryField<Order>[] = [
  { field: 'region', label: 'Region', type: 'text', matchModes: ['equals', 'notEquals'] },
  { field: 'total', label: 'Total', type: 'number', matchModes: ['roundHundred', 'gt', 'lt'] },
];

constructor() {
  inject(StarFilterService).register(
    'roundHundred',
    (value) => Number(value) >= 100,
    'Is 100 or more (custom)',
  );
}`;
  protected readonly formsScript = `readonly filterModel = signal<StarQueryGroup>({
  operator: 'and',
  rules: [{ field: 'customer', matchMode: 'contains', value: '' }],
});
private readonly text = inject(STAR_UI_TEXT);
readonly filter = form(this.filterModel, (path) =>
  starQueryComplete(path, this.fields, { message: () => this.text.queryIncomplete }),
);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starQueryValue]',
      description:
        'Custom value editor. starQueryValue="field" (or a list of keys) limits it to those fields; empty serves every field. Context: $implicit and rule (the rule), field, setValue(value).',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the root group.' },
    { name: '--star-surface-muted', description: 'Background of a nested group.' },
    { name: '--star-border', description: 'Border of a group.' },
    { name: '--star-border-strong', description: 'Start line of a nested group.' },
    { name: '--star-danger', description: 'Border of an incomplete rule after the focus left.' },
    { name: '--star-accent', description: 'Focus ring of a rule row.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves through the groups, rule rows and their controls.' },
    {
      name: 'Arrow keys',
      description: 'In the Match all / Match any toggle: chooses the operator of the group.',
    },
    { name: 'Delete', description: 'On a focused rule row: removes the rule.' },
    { name: 'Control + Z', description: 'Restores the last removed rule or group.' },
    {
      name: 'Alt + Arrow up / Arrow down',
      description: 'On a focused rule row: moves the rule one place up or down in its group.',
    },
  ];
}
