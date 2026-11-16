import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, minLength } from '@angular/forms/signals';
import { STAR_SLOTS } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import { StarNodeTemplate, StarTreeNode, StarTreeSelect } from '@star-ng/ui/tree';
import { DOCS, DocsRow } from '../shared/docs';
import { buildLargeTree } from './large-tree';

interface Project {
  readonly owner: string;
}

@Component({
  selector: 'docs-tree-select-page',
  imports: [DOCS, StarTreeSelect, StarNodeTemplate, STAR_SLOTS, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Tree select"
      lead="A select field whose panel is a tree. It chooses one node, several nodes, or the leaves of checked branches. The value is the array of selected node keys."
      importFrom="import { StarTreeSelect } from '@star-ng/ui/tree';"
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
        heading="Large tree with windowed rendering"
        source="tree-select/virtual"
        [script]="virtualScript"
        note="virtualScroll renders only the rows in and near the panel viewport, so a tree with 11,110 open nodes opens and scrolls fast. The panel is 18rem high. virtualItemSize is the row height in pixels (default 34). Selection, filter and the keys work over all rows, also the rows that are not in the DOM."
      >
        <div class="docs-stack">
          <star-tree-select
            [nodes]="large.nodes"
            [(expanded)]="largeOpen"
            selectionMode="checkbox"
            [(value)]="largeTeams"
            virtualScroll
            [virtualItemSize]="34"
            filter
            placeholder="Select orders"
            ariaLabel="Orders by site"
          />
          <p class="docs-output" role="status">{{ largeTeams().length }} orders checked</p>
        </div>
      </docs-example>

      <docs-example
        heading="Slots"
        source="tree-select/slots"
        [script]="slotsScript"
        note="Content child templates change parts of the panel tree. starNode replaces the label of a node and gets the node, its level, expanded and selected. starHeader and starFooter add content above and below the rows. starEmpty gets the filter text. starIcon toggle replaces the arrow of a branch. Do not put buttons or links in starNode: the tree owns the focus and the keys."
      >
        <star-tree-select
          [nodes]="projects"
          [(expanded)]="projectsOpen"
          [(value)]="project"
          filter
          placeholder="Select a project"
          ariaLabel="Project"
        >
          <ng-template starHeader>
            <p class="docs-output">Active projects</p>
          </ng-template>
          <ng-template starNode [starNodeOf]="projects" let-node let-level="level">
            {{ node.label }}
            @if (node.data) {
              <small>(owner {{ node.data.owner }}, level {{ level }})</small>
            }
          </ng-template>
          <ng-template starIcon="toggle"
            ><i class="ph-bold ph-arrow-right" aria-hidden="true"></i
          ></ng-template>
          <ng-template starEmpty let-text>No project matches {{ text }}.</ng-template>
          <ng-template starFooter>
            <p class="docs-output">3 projects</p>
          </ng-template>
        </star-tree-select>
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

      <h2>Right-to-left</h2>
      <p>
        The tree panel is aligned with the start edge of the field, and the tree keys are mirrored
        as in the Tree control. See the Right-to-left guide.
      </p>

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
  protected readonly large = buildLargeTree();
  protected readonly largeOpen = signal<readonly string[]>(this.large.branchKeys);
  protected readonly largeTeams = signal<readonly string[]>([]);
  protected readonly nodes = signal<readonly string[]>([]);

  protected readonly projects: readonly StarTreeNode<Project>[] = [
    {
      key: 'web',
      label: 'Website',
      data: { owner: 'Asha' },
      children: [
        { key: 'web-ui', label: 'UI kit', data: { owner: 'Ben' } },
        { key: 'web-api', label: 'API', data: { owner: 'Chen' } },
      ],
    },
    { key: 'app', label: 'Mobile app', data: { owner: 'Dara' } },
  ];
  protected readonly projectsOpen = signal<readonly string[]>(['web']);
  protected readonly project = signal<readonly string[]>([]);

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
  protected readonly virtualScript = `// 10 sites x 10 warehouses x 10 aisles x 10 orders = 11,110 nodes.
readonly large: LargeTree = buildLargeTree(); // { nodes, branchKeys, count }
readonly largeOpen = signal<readonly string[]>(this.large.branchKeys);
readonly largeTeams = signal<readonly string[]>([]);`;
  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core' and StarNodeTemplate in the component imports.
interface Project {
  readonly owner: string;
}
readonly projects: readonly StarTreeNode<Project>[] = [
  {
    key: 'web',
    label: 'Website',
    data: { owner: 'Asha' },
    children: [
      { key: 'web-ui', label: 'UI kit', data: { owner: 'Ben' } },
      { key: 'web-api', label: 'API', data: { owner: 'Chen' } },
    ],
  },
  { key: 'app', label: 'Mobile app', data: { owner: 'Dara' } },
];
readonly projectsOpen = signal<readonly string[]>(['web']);
readonly project = signal<readonly string[]>([]);`;
  protected readonly formScript = `readonly hireModel = signal<{ department: readonly string[] }>({ department: [] });
readonly hire = form(this.hireModel, (path) => {
  minLength(path.department, 1, { message: 'Select a department.' });
});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starNode]',
      description:
        'Content child. Replaces the label of a node. The toggle, checkbox and icon stay. The context has $implicit (the node), level, expanded and selected. Do not add focusable elements: the tree owns the keys. The content is inside the label. With virtualScroll the row keeps the height virtualItemSize and long content is cut off with an ellipsis.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content at the top of the panel, above the filter.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content at the bottom of the panel, below the rows.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Content child. Replaces the empty message. $implicit is the filter text.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Content child. Set starIcon to toggle to replace the arrow of a branch. Use one root element: the arrow rotation and the right-to-left mirror apply to it. $implicit is true when the branch is open.',
    },
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
    {
      name: 'Arrow keys, Home / End, *',
      description:
        'In the panel: the keys of the tree. With virtualScroll they reach rows that are not rendered: the row scrolls into the window and takes the focus.',
    },
    {
      name: 'Enter / Space',
      description: 'In the panel: selects the node. In single mode it closes the panel.',
    },
    { name: 'Escape', description: 'Closes the panel. The focus returns to the field.' },
  ];
}
