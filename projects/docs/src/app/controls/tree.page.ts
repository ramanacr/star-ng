import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { form, FormField, minLength } from '@angular/forms/signals';

import { StarField } from '@star-ng/ui/field';

import { StarTree, StarTreeNode } from '@star-ng/ui/tree';

import { DOCS, DocsRow } from '../shared/docs';

import { buildLargeTree } from './large-tree';

@Component({
  selector: 'docs-tree-page',

  imports: [DOCS, StarTree, StarField, FormField],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <docs-page
      heading="Tree"
      lead="A hierarchy of nodes with expand and collapse, optional selection (single, multiple or checkbox) and a filter. It follows the WAI-ARIA tree keyboard model."
      importFrom="import { StarTree, StarTreeNode } from '@star-ng/ui/tree';"
    >
      <docs-example
        heading="Expand and collapse"
        source="tree/basic"
        [script]="basicScript"
        note="Without selectionMode a click on a branch opens or closes it. expanded is a two-way list of node keys. A node has a unique key, a label and optional icon and children."
      >
        <star-tree [nodes]="folders" [(expanded)]="open" scrollHeight="16rem" ariaLabel="Folders" />
      </docs-example>

      <docs-example
        heading="Single selection"
        source="tree/single"
        note="selectionMode single keeps one key in value. selectable false or disabled on a node blocks its selection. The nodeSelect output fires for each user choice."
      >
        <div class="docs-stack">
          <star-tree
            [nodes]="folders"
            selectionMode="single"
            [(value)]="selected"
            [(expanded)]="singleOpen"
            scrollHeight="16rem"
            ariaLabel="Folder"
            (nodeSelect)="lastNode.set($event.label)"
          />

          <p class="docs-output" role="status">Selected: {{ selected().join(', ') || 'none' }}</p>

          <p class="docs-output" role="status">Last node: {{ lastNode() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Multiple selection"
        source="tree/multiple"
        note="selectionMode multiple toggles each node on its own."
      >
        <star-tree
          [nodes]="folders"
          selectionMode="multiple"
          [(value)]="picked"
          [(expanded)]="multipleOpen"
          scrollHeight="16rem"
          ariaLabel="Folders to back up"
        />
      </docs-example>

      <docs-example
        heading="Checkbox selection and filter"
        source="tree/checkbox"
        [script]="checkboxScript"
        note="In checkbox mode a branch selects all its leaves. A branch with some leaves chosen is mixed. value holds the keys of the leaves. filter shows every branch that has a match, open."
      >
        <div class="docs-stack">
          <star-tree
            [nodes]="folders"
            selectionMode="checkbox"
            [(value)]="checked"
            [(expanded)]="checkboxOpen"
            filter
            scrollHeight="16rem"
            ariaLabel="Folders to sync"
          />

          <p class="docs-output" role="status">Leaves: {{ checked().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Large tree with windowed rendering"
        source="tree/virtual"
        [script]="virtualScript"
        note="virtualScroll renders only the rows in and near the viewport, so a tree with 11,110 open nodes stays fast. It needs scrollHeight, and every row gets the fixed height virtualItemSize (in pixels, default 34: keep it equal to the real row height). Use it from about a thousand open rows. Expand, collapse, selection, filter and the keys work over all rows, also the rows that are not in the DOM; aria-setsize and aria-posinset come from the data. Limits: rows do not wrap (a long label is cut), and the tree select panel is always 18rem high."
      >
        <div class="docs-stack">
          <star-tree
            [nodes]="large.nodes"
            [(expanded)]="largeOpen"
            selectionMode="checkbox"
            [(value)]="largeChecked"
            virtualScroll
            [virtualItemSize]="34"
            filter
            scrollHeight="20rem"
            ariaLabel="Orders by site"
          />

          <p class="docs-output" role="status">
            {{ large.count }} nodes, {{ largeChecked().length }} orders checked
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Signal Forms"
        source="tree/form"
        [script]="formScript"
        note="Bind with formField. The value is the array of selected keys."
      >
        <div class="docs-stack">
          <star-field label="Folders to share" [state]="share.folders()">
            <star-tree
              [formField]="share.folders"
              [nodes]="folders"
              selectionMode="checkbox"
              scrollHeight="12rem"
              ariaLabel="Folders to share"
            />
          </star-field>

          <p class="docs-output" role="status">Valid: {{ share().valid() }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        In a right-to-left page the keys of the WAI-ARIA tree pattern are mirrored: Arrow left opens
        a closed branch and moves to its first child, and Arrow right closes an open branch and
        moves to the parent. Indentation and the expander arrow follow the direction. See the
        Right-to-left guide.
      </p>

      <docs-api [of]="['StarTree']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class TreePage {
  protected readonly folders: readonly StarTreeNode[] = [
    {
      key: 'docs',

      label: 'Documents',

      icon: 'ph-bold ph-folder',

      children: [
        { key: 'invoices', label: 'Invoices', icon: 'ph-bold ph-file-text' },

        { key: 'contracts', label: 'Contracts', icon: 'ph-bold ph-file-text' },

        { key: 'archive', label: 'Archive (locked)', icon: 'ph-bold ph-lock', disabled: true },
      ],
    },

    {
      key: 'media',

      label: 'Media',

      icon: 'ph-bold ph-folder',

      children: [
        { key: 'photos', label: 'Photos', icon: 'ph-bold ph-image' },

        {
          key: 'video',

          label: 'Video',

          icon: 'ph-bold ph-folder',

          children: [
            { key: 'raw', label: 'Raw clips' },

            { key: 'edits', label: 'Edits' },
          ],
        },
      ],
    },

    { key: 'notes', label: 'Notes', icon: 'ph-bold ph-note' },
  ];

  protected readonly open = signal<readonly string[]>(['docs']);

  protected readonly singleOpen = signal<readonly string[]>(['docs']);

  protected readonly multipleOpen = signal<readonly string[]>(['media']);

  protected readonly checkboxOpen = signal<readonly string[]>(['media']);

  protected readonly large = buildLargeTree();

  protected readonly largeOpen = signal<readonly string[]>(this.large.branchKeys);

  protected readonly largeChecked = signal<readonly string[]>([]);

  protected readonly selected = signal<readonly string[]>([]);

  protected readonly picked = signal<readonly string[]>([]);

  protected readonly checked = signal<readonly string[]>([]);

  protected readonly lastNode = signal('none');

  protected readonly shareModel = signal<{ folders: readonly string[] }>({ folders: [] });

  protected readonly share = form(this.shareModel, (path) => {
    minLength(path.folders, 1, { message: 'Select at least one folder.' });
  });

  protected readonly basicScript = `readonly folders: readonly StarTreeNode[] = [

  {

    key: 'docs',

    label: 'Documents',

    icon: 'ph-bold ph-folder',

    children: [

      { key: 'invoices', label: 'Invoices' },

      { key: 'contracts', label: 'Contracts' },

    ],

  },

  { key: 'notes', label: 'Notes' },

];

readonly open = signal<readonly string[]>(['docs']);`;

  protected readonly checkboxScript = `readonly checked = signal<readonly string[]>([]);

readonly checkboxOpen = signal<readonly string[]>(['media']);`;

  protected readonly virtualScript = `// 10 sites x 10 warehouses x 10 aisles x 10 orders = 11,110 nodes.

readonly large: LargeTree = buildLargeTree(); // { nodes, branchKeys, count }

readonly largeOpen = signal<readonly string[]>(this.large.branchKeys);

readonly largeChecked = signal<readonly string[]>([]);`;

  protected readonly formScript = `readonly shareModel = signal<{ folders: readonly string[] }>({ folders: [] });

readonly share = form(this.shareModel, (path) => {

  minLength(path.folders, 1, { message: 'Select at least one folder.' });

});`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The nodes come from the nodes input, not from content.' },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-border', description: 'Border of the tree.' },

    { name: '--star-radius-lg', description: 'Corner radius of the tree.' },

    { name: '--star-surface-muted', description: 'Background of a row under the pointer.' },

    { name: '--star-primary-soft', description: 'Background of a selected row.' },

    { name: '--star-primary', description: 'Text of a selected row and fill of a checked box.' },

    { name: '--star-accent', description: 'Focus ring of a row.' },

    { name: '--star-tree-level', description: 'Set on each row: the depth that sets the indent.' },
  ];

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow down / Arrow up',

      description: 'Moves the focus to the next or the previous visible node.',
    },

    {
      name: 'Arrow right',

      description: 'Opens a closed branch. On an open branch it moves to the first child.',
    },

    { name: 'Arrow left', description: 'Closes an open branch. Otherwise it moves to the parent.' },

    { name: 'Home / End', description: 'Moves to the first or the last visible node.' },

    {
      name: 'Enter / Space',

      description: 'Selects the node. Without selectionMode it opens or closes a branch.',
    },

    { name: '*', description: 'Opens every branch at the level of the focused node.' },

    {
      name: 'With virtualScroll',

      description:
        'All keys work over every open row. A target row that is not rendered is scrolled into the window and then focused. The focus never leaves the tree: while the focused row is out of the window, the focus waits on the scroll area and returns to the row when it renders.',
    },
  ];
}
