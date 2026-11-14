import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import { StarField } from 'star-ng/field';
import { StarTreeNode, StarTreeSelect } from 'star-ng/tree';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-tree-select-page',
  imports: [DOCS, StarTreeSelect, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Tree select"
      lead="A select field whose panel is a tree. It chooses one node, several nodes, or the leaves of checked branches. The value is the array of selected node keys."
      importFrom="import { StarTreeSelect } from 'star-ng/tree';"
    >
      <docs-example
        heading="Single node"
        source="tree-select/single"
        [script]="singleScript"
        note="In single mode (the default) a choice closes the panel. The value is an array with one key. showClear adds a clear button."
      >
        <div class="docs-stack">
          <star-tree-select
            [nodes]="departments"
            [(value)]="department"
            placeholder="Select a department"
            ariaLabel="Department"
            showClear
          />
          <p class="docs-output" role="status">
            Department: {{ department().join(', ') || 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Checkbox selection and filter"
        source="tree-select/checkbox"
        note="selectionMode checkbox keeps the panel open and selects the leaves of a checked branch. Above maxSelectedLabels (3 by default) the field shows a count. filter adds a search field."
      >
        <div class="docs-stack">
          <star-tree-select
            [nodes]="departments"
            selectionMode="checkbox"
            [(value)]="teams"
            filter
            placeholder="Select teams"
            ariaLabel="Teams"
          />
          <p class="docs-output" role="status">Teams: {{ teams().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Multiple and disabled"
        source="tree-select/multiple"
        note="selectionMode multiple toggles single nodes. A disabled field takes no focus."
      >
        <div class="docs-stack">
          <star-tree-select
            [nodes]="departments"
            selectionMode="multiple"
            [(value)]="nodes"
            placeholder="Select nodes"
            ariaLabel="Nodes"
          />
          <p class="docs-output" role="status">Nodes: {{ nodes().join(', ') || 'none' }}</p>
          <star-tree-select
            [nodes]="departments"
            disabled
            placeholder="Disabled"
            ariaLabel="Disabled department"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="tree-select/form"
        [script]="formScript"
        note="Bind with formField. The rule here needs at least one node. The field is a button: label it with ariaLabel."
      >
        <div class="docs-stack">
          <star-field label="Department" [state]="hire.department()">
            <star-tree-select
              [formField]="hire.department"
              [nodes]="departments"
              placeholder="Select a department"
              ariaLabel="Hire department"
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ hire().valid() }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarTreeSelect']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class TreeSelectPage {
  protected readonly departments: readonly StarTreeNode[] = [
    {
      key: 'eng',
      label: 'Engineering',
      children: [
        { key: 'web', label: 'Web' },
        { key: 'mobile', label: 'Mobile' },
        { key: 'data', label: 'Data' },
      ],
    },
    {
      key: 'ops',
      label: 'Operations',
      children: [
        { key: 'support', label: 'Support' },
        { key: 'logistics', label: 'Logistics' },
      ],
    },
    { key: 'fin', label: 'Finance' },
  ];

  protected readonly department = signal<readonly string[]>([]);
  protected readonly teams = signal<readonly string[]>([]);
  protected readonly nodes = signal<readonly string[]>([]);

  protected readonly hireModel = signal<{ department: readonly string[] }>({ department: [] });
  protected readonly hire = form(this.hireModel, (path) => {
    minLength(path.department, 1, { message: 'Select a department.' });
  });

  protected readonly singleScript = `readonly departments: readonly StarTreeNode[] = [
  {
    key: 'eng',
    label: 'Engineering',
    children: [
      { key: 'web', label: 'Web' },
      { key: 'mobile', label: 'Mobile' },
    ],
  },
  { key: 'fin', label: 'Finance' },
];
readonly department = signal<readonly string[]>([]);`;
  protected readonly formScript = `readonly hireModel = signal<{ department: readonly string[] }>({ department: [] });
readonly hire = form(this.hireModel, (path) => {
  minLength(path.department, 1, { message: 'Select a department.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The nodes come from the nodes input, not from content.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-border', description: 'Border of the field and the panel.' },
    { name: '--star-accent', description: 'Border of the focused field.' },
    { name: '--star-primary', description: 'Selected rows and checked boxes in the panel.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space / Arrow down',
      description: 'On the field: opens the panel. The focus moves into the tree.',
    },
    { name: 'Arrow keys, Home / End, *', description: 'In the panel: the keys of the tree.' },
    {
      name: 'Enter / Space',
      description: 'In the panel: selects the node. In single mode it closes the panel.',
    },
    { name: 'Escape', description: 'Closes the panel. The focus returns to the field.' },
  ];
}
