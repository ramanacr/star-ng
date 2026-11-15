import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarTreeTable, StarTreeTableColumn } from '@star-ng/ui/data-display';
import { StarTreeNode } from '@star-ng/ui/tree';
import { DOCS, DocsRow } from '../shared/docs';

type Row = Record<string, unknown>;

@Component({
  selector: 'docs-tree-table-page',
  imports: [DOCS, StarTreeTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Tree table"
      lead="Rows in a hierarchy, with expand and collapse in a table. The first column shows the tree toggle. The PrimeNG equivalent is p-treetable."
      importFrom="import { StarTreeTable, StarTreeTableColumn } from '@star-ng/ui/data-display';"
    >
      <docs-example
        heading="Expand and collapse"
        source="tree-table/basic"
        [script]="basicScript"
        note="Each node holds its column values in data. The columns input names the field of each column. expanded is a two-way list of node keys. The table has role treegrid. Only the rows of open branches are rendered."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="departments"
            [columns]="columns"
            [(expanded)]="open"
            ariaLabel="Departments"
          />
          <p class="docs-output" role="status">Open: {{ open().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Column width and alignment"
        source="tree-table/columns"
        [script]="columnsScript"
        note="A column can set a width and an alignment (start, center or end). The toggle() method opens or closes one node from code."
      >
        <star-tree-table
          [nodes]="departments"
          [columns]="wideColumns"
          [expanded]="allOpen"
          ariaLabel="Departments with fixed columns"
        />
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        In a right-to-left page Arrow left opens a closed branch and Arrow right closes an open one
        or moves to the parent row. Indentation grows from the right and the expander arrow turns
        around. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarTreeTable']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class TreeTablePage {
  protected readonly departments: readonly StarTreeNode<Row>[] = [
    {
      key: 'eng',
      label: 'Engineering',
      data: { name: 'Engineering', staff: 42, budget: '4.2M' },
      children: [
        {
          key: 'platform',
          label: 'Platform',
          data: { name: 'Platform', staff: 18, budget: '1.9M' },
        },
        {
          key: 'apps',
          label: 'Applications',
          data: { name: 'Applications', staff: 24, budget: '2.3M' },
          children: [
            { key: 'web', label: 'Web', data: { name: 'Web', staff: 14, budget: '1.3M' } },
            { key: 'mobile', label: 'Mobile', data: { name: 'Mobile', staff: 10, budget: '1.0M' } },
          ],
        },
      ],
    },
    {
      key: 'ops',
      label: 'Operations',
      data: { name: 'Operations', staff: 20, budget: '1.8M' },
      children: [
        { key: 'support', label: 'Support', data: { name: 'Support', staff: 12, budget: '0.9M' } },
        {
          key: 'logistics',
          label: 'Logistics',
          data: { name: 'Logistics', staff: 8, budget: '0.9M' },
        },
      ],
    },
    { key: 'finance', label: 'Finance', data: { name: 'Finance', staff: 9, budget: '0.7M' } },
  ];

  protected readonly columns: readonly StarTreeTableColumn[] = [
    { field: 'name', header: 'Department' },
    { field: 'staff', header: 'Staff' },
    { field: 'budget', header: 'Budget' },
  ];
  protected readonly wideColumns: readonly StarTreeTableColumn[] = [
    { field: 'name', header: 'Department' },
    { field: 'staff', header: 'Staff', width: '8rem', align: 'center' },
    { field: 'budget', header: 'Budget', width: '8rem', align: 'end' },
  ];

  protected readonly open = signal<readonly string[]>(['eng']);
  protected readonly allOpen: readonly string[] = ['eng', 'apps', 'ops'];

  protected readonly basicScript = `readonly departments: readonly StarTreeNode<Record<string, unknown>>[] = [
  {
    key: 'eng',
    label: 'Engineering',
    data: { name: 'Engineering', staff: 42, budget: '4.2M' },
    children: [
      { key: 'platform', label: 'Platform', data: { name: 'Platform', staff: 18, budget: '1.9M' } },
    ],
  },
  { key: 'finance', label: 'Finance', data: { name: 'Finance', staff: 9, budget: '0.7M' } },
];
readonly columns: readonly StarTreeTableColumn[] = [
  { field: 'name', header: 'Department' },
  { field: 'staff', header: 'Staff' },
  { field: 'budget', header: 'Budget' },
];
readonly open = signal<readonly string[]>(['eng']);`;
  protected readonly columnsScript = `readonly wideColumns: readonly StarTreeTableColumn[] = [
  { field: 'name', header: 'Department' },
  { field: 'staff', header: 'Staff', width: '8rem', align: 'center' },
  { field: 'budget', header: 'Budget', width: '8rem', align: 'end' },
];
readonly allOpen = ['eng', 'apps', 'ops'];`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The rows come from the nodes input, not from content.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-tree-level',
      description: 'Set on the first cell of each row: the depth that sets the indent.',
    },
    { name: '--star-accent', description: 'Focus ring of a row.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow down / Arrow up',
      description: 'Moves the focus to the next or the previous visible row.',
    },
    { name: 'Arrow right', description: 'Opens a closed branch. A leaf row does nothing.' },
    {
      name: 'Arrow left',
      description: 'Closes an open branch. Otherwise it moves the focus to the parent row.',
    },
  ];
}
