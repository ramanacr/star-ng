import {
  ChangeDetectionStrategy,
  Component,
  effect,
  resource,
  signal,
  untracked,
} from '@angular/core';

import { form, FormField, minLength } from '@angular/forms/signals';

import { StarButton } from '@star-ng/ui/button';

import { StarField } from '@star-ng/ui/field';

import type { StarMenuItem } from '@star-ng/ui/menu';

import { STAR_SLOTS } from '@star-ng/ui/core';

import {
  StarNodeTemplate,
  StarTree,
  StarTreeDropValidator,
  StarTreeNode,
  StarTreeNodeDropEvent,
} from '@star-ng/ui/tree';

import { DOCS, DocsRow } from '../shared/docs';

import { buildLargeTree } from './large-tree';

import { DEPARTMENTS, LAZY_PROJECTS, loadTeams, moveNode } from './tree-depth';

interface Project {
  readonly owner: string;
}

@Component({
  selector: 'docs-tree-page',

  imports: [DOCS, StarTree, StarNodeTemplate, STAR_SLOTS, StarField, FormField, StarButton],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <docs-page
      heading="Tree"
      lead="A hierarchy of nodes with expand and collapse, optional selection (single, multiple or checkbox), a filter, lazy children, a context menu and drag and drop. It follows the WAI-ARIA tree keyboard model."
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
        heading="Filter modes"
        source="tree/filter-modes"
        note="filterMode lenient keeps a matching node with all its descendants (they follow the expanded keys); strict (the default) keeps only the matching paths. Both open the ancestors of a match. filterBy lists the fields to search: label, another node property or a field of data. filterLocale sets the language of the compare; case and accents never count. Try the name of a lead, for example Chen."
      >
        <star-tree
          [nodes]="departments"
          [(expanded)]="filterOpen"
          filter
          filterMode="lenient"
          [filterBy]="['label', 'lead']"
          scrollHeight="16rem"
          ariaLabel="Departments by lead"
        />
      </docs-example>

      <docs-example
        heading="Checkbox propagation and locked nodes"
        source="tree/propagation"
        note="propagateSelectionUp (default true) checks a parent when all its selectable children are checked and shows it mixed when some are. propagateSelectionDown (default true) checks the descendants with the node. A disabled node or one with selectable false is locked: it keeps its state, and it does not count for its parent. nodeSelect and nodeUnselect fire for each user change."
      >
        <div class="docs-stack">
          <star-tree
            [nodes]="departments"
            selectionMode="checkbox"
            [(value)]="lockedChecked"
            [expanded]="['fin']"
            scrollHeight="16rem"
            ariaLabel="Departments to audit"
            (nodeSelect)="lastChange.set('checked ' + $event.label)"
            (nodeUnselect)="lastChange.set('unchecked ' + $event.label)"
          />

          <p class="docs-output" role="status">
            Value: {{ lockedChecked().join(', ') || 'none' }}. Last change: {{ lastChange() }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Lazy children"
        source="tree/lazy"
        [script]="lazyScript"
        note="A node with leaf false shows the toggle before it has children. Opening it emits nodeExpand: the owner sets loading on the node, loads the children (here with resource() and fake data after a short delay, no network) and puts them into a new copy of the nodes. While loading is true the open node shows a loading row (loadingMode row, the default) or a spinner in its toggle (loadingMode icon), and aria-busy."
      >
        <star-tree
          [nodes]="projectNodes()"
          [(expanded)]="lazyOpen"
          scrollHeight="16rem"
          ariaLabel="Projects and teams"
          (nodeExpand)="loadProject($event.node)"
        />
      </docs-example>

      <docs-example
        heading="Drag and drop"
        source="tree/drag-drop"
        [script]="dragScript"
        note="draggableNodes and droppableNodes let the user move nodes. The tree never changes nodes: nodeDrop gives dragNode, dropNode and position (before, after or inside), and the owner moves the node. The keyboard alternative: on a focused node, Ctrl+Shift+Arrow up or down moves it before the previous or after the next sibling, Ctrl+Shift+Arrow right moves it into the previous sibling, and Ctrl+Shift+Arrow left moves it out to the parent level (mirrored in right-to-left). A live region announces each move. validateDrop refuses a drop (here: nothing goes inside People). For drops between trees, give the source a draggableScope and the target a matching droppableScope; the event then has fromTree."
      >
        <div class="docs-stack">
          <star-tree
            [nodes]="movable()"
            [(expanded)]="movableOpen"
            draggableNodes
            droppableNodes
            [validateDrop]="noDropInPeople"
            scrollHeight="18rem"
            ariaLabel="Departments to arrange"
            (nodeDrop)="onDrop($event)"
          />

          <p class="docs-output" role="status">Last move: {{ lastMove() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Context menu and events"
        source="tree/context-menu"
        note="contextMenu adds a menu on right click, Shift+F10 or the context menu key; contextMenuSelect gives the node and the item. nodeContextMenu and nodeDoubleClick fire with the node too."
      >
        <div class="docs-stack">
          <star-tree
            [nodes]="departments"
            [expanded]="['eng']"
            [contextMenu]="nodeActions"
            scrollHeight="16rem"
            ariaLabel="Departments with actions"
            (contextMenuSelect)="lastAction.set($event.item.label + ' ' + $event.node.label)"
            (nodeDoubleClick)="lastAction.set('double click ' + $event.node.label)"
          />

          <p class="docs-output" role="status">Last action: {{ lastAction() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Methods"
        source="tree/methods"
        note="expandAll opens every branch that has children (lazy nodes stay closed), collapseAll closes all, expandPath opens the ancestors of a key, and scrollToNode opens them and scrolls the row into view. Call them on a template reference or on viewChild(StarTree)."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="apiTree.expandAll()">
              Expand all
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="apiTree.collapseAll()">
              Collapse all
            </star-button>
            <star-button size="sm" variant="secondary" (pressed)="apiTree.scrollToNode('tax')">
              Show Tax
            </star-button>
          </div>
          <star-tree
            #apiTree
            [nodes]="departments"
            [(expanded)]="apiOpen"
            scrollHeight="10rem"
            ariaLabel="Departments for the methods"
          />
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
        heading="Slots"
        source="tree/slots"
        [script]="slotsScript"
        note="Content child templates change parts of the tree. starNode replaces the label of a node and gets the node, its level, expanded and selected. starHeader and starFooter add content above and below the rows. starEmpty gets the filter text. starIcon toggle replaces the arrow of a branch. Do not put buttons or links in starNode: the tree owns the focus and the keys."
      >
        <star-tree
          [nodes]="projects"
          [(expanded)]="projectsOpen"
          filter
          scrollHeight="16rem"
          ariaLabel="Projects"
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
        </star-tree>
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

  protected readonly departments = DEPARTMENTS;

  protected readonly filterOpen = signal<readonly string[]>([]);

  protected readonly lockedChecked = signal<readonly string[]>(['audit']);

  protected readonly lastChange = signal('none');

  // ---- lazy children ----
  protected readonly projectNodes = signal<readonly StarTreeNode[]>(LAZY_PROJECTS);

  protected readonly lazyOpen = signal<readonly string[]>([]);

  /** Projects whose teams are requested, in order; the first one loads now. */
  private readonly projectQueue = signal<readonly string[]>([]);

  private readonly projectTeams = resource({
    params: () => this.projectQueue()[0],
    loader: ({ params, abortSignal }) => loadTeams(params, abortSignal),
  });

  // ---- drag and drop ----
  protected readonly movable = signal<readonly StarTreeNode[]>(DEPARTMENTS);

  protected readonly movableOpen = signal<readonly string[]>(['eng', 'fin']);

  protected readonly lastMove = signal('none');

  protected readonly noDropInPeople: StarTreeDropValidator = (_drag, target, position) =>
    !(target.key === 'people' && position === 'inside');

  // ---- context menu ----
  protected readonly nodeActions: readonly StarMenuItem[] = [
    { label: 'Rename', icon: 'ph-bold ph-pencil-simple' },
    { label: 'Archive', icon: 'ph-bold ph-archive' },
  ];

  protected readonly lastAction = signal('none');

  // ---- methods ----
  protected readonly apiOpen = signal<readonly string[]>([]);

  constructor() {
    // A project's teams arrived: put them into a new copy of the nodes, then load the next one.
    effect(() => {
      if (this.projectTeams.status() !== 'resolved') return;
      const key = this.projectQueue()[0];
      const teams = this.projectTeams.value();
      if (!key || !teams) return;
      untracked(() => {
        this.projectNodes.update((nodes) =>
          nodes.map((node) =>
            node.key === key ? { ...node, loading: false, children: teams } : node,
          ),
        );
        this.projectQueue.update((queue) => queue.slice(1));
      });
    });
  }

  protected loadProject(node: StarTreeNode): void {
    if (node.children || node.loading || node.leaf !== false) return;
    this.projectNodes.update((nodes) =>
      nodes.map((n) => (n.key === node.key ? { ...n, loading: true } : n)),
    );
    this.projectQueue.update((queue) => [...queue, node.key]);
  }

  protected onDrop(event: StarTreeNodeDropEvent): void {
    this.movable.update((nodes) => moveNode(nodes, event));
    this.lastMove.set(`${event.dragNode.label} ${event.position} ${event.dropNode.label}`);
  }

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

  protected readonly lazyScript = `readonly projectNodes = signal<readonly StarTreeNode[]>([
  { key: 'atlas', label: 'Project Atlas', leaf: false },
  { key: 'beacon', label: 'Project Beacon', leaf: false },
]);
/** Projects whose teams are requested, in order; the first one loads now. */
private readonly projectQueue = signal<readonly string[]>([]);
private readonly projectTeams = resource({
  params: () => this.projectQueue()[0],
  // Fake server call: resolves with the teams after a short delay.
  loader: ({ params, abortSignal }) => loadTeams(params, abortSignal),
});

constructor() {
  effect(() => {
    if (this.projectTeams.status() !== 'resolved') return;
    const key = this.projectQueue()[0];
    const teams = this.projectTeams.value();
    if (!key || !teams) return;
    untracked(() => {
      this.projectNodes.update((nodes) =>
        nodes.map((node) => (node.key === key ? { ...node, loading: false, children: teams } : node)),
      );
      this.projectQueue.update((queue) => queue.slice(1));
    });
  });
}

loadProject(node: StarTreeNode): void {
  if (node.children || node.loading || node.leaf !== false) return;
  this.projectNodes.update((nodes) =>
    nodes.map((n) => (n.key === node.key ? { ...n, loading: true } : n)),
  );
  this.projectQueue.update((queue) => [...queue, node.key]);
}`;

  protected readonly dragScript = `readonly movable = signal<readonly StarTreeNode[]>(DEPARTMENTS);

readonly noDropInPeople: StarTreeDropValidator = (_drag, target, position) =>
  !(target.key === 'people' && position === 'inside');

onDrop(event: StarTreeNodeDropEvent): void {
  // moveNode removes event.dragNode and puts it before, after or inside event.dropNode.
  this.movable.update((nodes) => moveNode(nodes, event));
}`;

  protected readonly checkboxScript = `readonly checked = signal<readonly string[]>([]);

readonly checkboxOpen = signal<readonly string[]>(['media']);`;

  protected readonly virtualScript = `// 10 sites x 10 warehouses x 10 aisles x 10 orders = 11,110 nodes.

readonly large: LargeTree = buildLargeTree(); // { nodes, branchKeys, count }

readonly largeOpen = signal<readonly string[]>(this.large.branchKeys);

readonly largeChecked = signal<readonly string[]>([]);`;

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
readonly projectsOpen = signal<readonly string[]>(['web']);`;

  protected readonly formScript = `readonly shareModel = signal<{ folders: readonly string[] }>({ folders: [] });

readonly share = form(this.shareModel, (path) => {

  minLength(path.folders, 1, { message: 'Select at least one folder.' });

});`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starNode]',
      description:
        'Content child. Replaces the label of a node. The toggle, checkbox and icon stay. The context has $implicit (the node), level, expanded and selected. Do not add focusable elements: the tree owns the keys. The content is inside the label. With virtualScroll the row keeps the height virtualItemSize and long content is cut off with an ellipsis.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content at the top of the tree, above the filter.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content at the bottom of the tree, below the rows.',
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
    { name: '--star-border', description: 'Border of the tree.' },

    { name: '--star-radius-lg', description: 'Corner radius of the tree.' },

    { name: '--star-surface-muted', description: 'Background of a row under the pointer.' },

    { name: '--star-primary-soft', description: 'Background of a selected row.' },

    { name: '--star-primary', description: 'Text of a selected row and fill of a checked box.' },

    { name: '--star-accent', description: 'Focus ring of a row.' },

    { name: '--star-tree-level', description: 'Set on each row: the depth that sets the indent.' },

    {
      name: '--star-tree-drop-color',
      description: 'Drop line and drop box while a node is dragged (default --star-primary).',
    },
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
      name: 'Ctrl+Shift+Arrow up / down',

      description:
        'With draggableNodes and droppableNodes: moves the node before the previous or after the next sibling (nodeDrop).',
    },

    {
      name: 'Ctrl+Shift+Arrow right / left',

      description:
        'Moves the node into the previous sibling, or out to the level of its parent. Mirrored in right-to-left.',
    },

    {
      name: 'Shift+F10 / Context menu key',

      description: 'Opens the context menu of the node (contextMenu).',
    },

    {
      name: 'With virtualScroll',

      description:
        'All keys work over every open row. A target row that is not rendered is scrolled into the window and then focused. The focus never leaves the tree: while the focused row is out of the window, the focus waits on the scroll area and returns to the row when it renders.',
    },
  ];
}
