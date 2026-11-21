import {
  ChangeDetectionStrategy,
  Component,
  effect,
  resource,
  signal,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { STAR_SLOTS } from '@star-ng/ui/core';
import {
  StarTreeTable,
  StarTreeTableCellEditEvent,
  StarTreeTableColumn,
  StarTreeTableContextMenuEvent,
  StarTreeTableNode,
} from '@star-ng/ui/data-display';
import { StarMenuItem } from '@star-ng/ui/menu';
import {
  StarCellTemplate,
  StarFooterRowTemplate,
  StarHeaderCellTemplate,
  StarPaginatorStartTemplate,
} from '@star-ng/ui/table';
import { StarNodeTemplate, StarTreeNode } from '@star-ng/ui/tree';
import { DOCS, DocsRow } from '../shared/docs';
import { buildLargeTreeTable } from './large-tree-table';
import { FOLDERS, loadFolderChildren, PROJECTS, updateNode } from './tree-table-data';

type Row = Record<string, unknown>;

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './tree-table.page.scss',
  selector: 'docs-tree-table-page',
  imports: [
    DOCS,
    StarTreeTable,
    StarNodeTemplate,
    STAR_SLOTS,
    StarHeaderCellTemplate,
    StarCellTemplate,
    StarFooterRowTemplate,
    StarPaginatorStartTemplate,
  ],
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

      <docs-example
        heading="Large tree table with windowed rendering"
        source="tree-table/virtual"
        [script]="virtualScript"
        note="virtualScroll renders only the rows in and near the viewport, so a table with 11,110 open rows stays fast. It needs scrollHeight, and every row gets the fixed height virtualItemSize (in pixels, the default is the natural row height: keep it equal to the real row height). It stays one table with a sticky header: a spacer row above and one below the rendered rows stand for the others, so the header and the cells stay aligned. The columns share the width equally unless a column sets width. Use it from about a thousand open rows. Expand, collapse and the keys work over all rows, also the rows that are not in the DOM; aria-rowcount, aria-rowindex, aria-level, aria-setsize and aria-posinset come from the data. Limits: a cell does not wrap (a long text is cut)."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="large.nodes"
            [columns]="virtualColumns"
            [(expanded)]="largeOpen"
            virtualScroll
            scrollHeight="20rem"
            ariaLabel="Stock by site"
          />
          <p class="docs-output" role="status">
            {{ large.count }} rows, {{ largeOpen().length }} branches open
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Slots"
        source="tree-table/slots"
        [script]="slotsScript"
        note="Content child templates change parts of the table. starNode replaces the label of a node in the first column and gets the node, its level, expanded and selected. The toggle and the keys stay. starHeader and starFooter add content above and below the table. starEmpty fills one row over all columns when there are no rows; without it the table shows nothing. Do not put buttons or links in these templates: the table owns the focus and the keys."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="departments"
            [columns]="columns"
            [expanded]="allOpen"
            ariaLabel="Departments with slots"
          >
            <ng-template starHeader>
              <p class="docs-output">Budget by department</p>
            </ng-template>
            <ng-template starNode [starNodeOf]="departments" let-node let-level="level">
              <strong [style.color]="level === 1 ? 'var(--star-text)' : 'var(--star-text-muted)'">
                {{ node.label }}
              </strong>
              <small>(level {{ level }})</small>
            </ng-template>
            <ng-template starFooter>
              <p class="docs-output">Figures in millions.</p>
            </ng-template>
          </star-tree-table>
          <star-tree-table [nodes]="[]" [columns]="columns" ariaLabel="Empty departments">
            <ng-template starEmpty let-text>No departments yet.</ng-template>
          </star-tree-table>
        </div>
      </docs-example>

      <docs-example
        heading="Sort, filter and page"
        source="tree-table/sort-filter"
        [script]="sortFilterScript"
        note="A sortable column sorts the rows when its header is pressed; siblings sort within their parent, so every task stays under its project. multiSort adds a column with Shift + click. filter shows a search field (globalFilter), and a column with filter gets a field in a second header row. filterMode lenient shows a match with its ancestors and all its descendants; strict shows only the matching paths. The ancestors of a match show open. paginator pages over the top-level rows: a project and its tasks stay on one page."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="projects"
            [columns]="projectColumns"
            [(expanded)]="projectOpen"
            [(sortField)]="sortField"
            [(sortOrder)]="sortOrder"
            multiSort
            filter
            [(globalFilter)]="query"
            [filterMode]="strict() ? 'strict' : 'lenient'"
            paginator
            [rows]="5"
            [rowsPerPageOptions]="[5, 10]"
            ariaLabel="Projects"
          />
          <label class="docs-output">
            <input type="checkbox" [checked]="strict()" (change)="strict.set(!strict())" />
            Strict filter mode
          </label>
          <p class="docs-output" role="status">
            Sort: {{ sortField() ?? 'none' }} {{ sortOrder() === 1 ? 'ascending' : 'descending' }},
            search: {{ query() || 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Table slots"
        source="tree-table/table-slots"
        note="The tree table takes the template slots of the table: starHeaderCell (the label of one header), starCell (the content of one column; in the first column the toggle stays), starRow with starTableCell (the cells after the tree column), starFooterRow, starLoading (with the loading input, and in the loading row of lazy children), starPaginatorStart and starPaginatorEnd. starIcon replaces the toggle, check (check box), sort and filter icons; the toggle gets expanded, the check icon checked (false when partly checked), the sort icon true ascending, false descending. Content with starTableCaption goes above the table, starTableSummary below it."
      >
        <star-tree-table
          [nodes]="projects"
          [columns]="projectColumns"
          [(expanded)]="slotOpen"
          selectionMode="checkbox"
          filter
          paginator
          [rows]="3"
          [rowsPerPageOptions]="[3, 6]"
          ariaLabel="Projects with table slots"
        >
          <strong starTableCaption>Projects this quarter</strong>
          <ng-template starHeaderCell="hours" let-column>{{ column.header }} (h)</ng-template>
          <ng-template starCell="hours" [starCellOf]="projects" let-value="value">
            <strong>{{ value }}</strong>
          </ng-template>
          <ng-template starFooterRow [starFooterRowOf]="projects" let-columns let-rows="rows">
            <td [attr.colspan]="columns.length">{{ rows.length }} projects</td>
          </ng-template>
          <ng-template starIcon="toggle" let-open>
            <i [class]="open ? 'ph-bold ph-minus-square' : 'ph-bold ph-plus-square'"></i>
          </ng-template>
          <ng-template starIcon="sort" let-ascending>
            <i
              [class]="
                ascending === undefined
                  ? 'ph-bold ph-arrows-down-up'
                  : ascending
                    ? 'ph-bold ph-arrow-up'
                    : 'ph-bold ph-arrow-down'
              "
            ></i>
          </ng-template>
          <ng-template starPaginatorStart let-state>
            <span>Page {{ state.page + 1 }} of {{ state.pageCount }}</span>
          </ng-template>
        </star-tree-table>
      </docs-example>

      <docs-example
        heading="Checkbox selection"
        source="tree-table/checkbox"
        [script]="checkboxScript"
        note="selectionMode checkbox adds a check box to the first cell of every row. Checking a project checks its tasks (propagateSelectionDown), and a project is checked when all its tasks are and shows mixed when some are (propagateSelectionUp). selection is a two-way list of node keys. A click on the row or Space on the focused row toggles it. selectionMode single and multiple select rows without check boxes."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="firstProjects"
            [columns]="projectColumns"
            [expanded]="['website', 'website-content', 'shop']"
            selectionMode="checkbox"
            [(selection)]="checked"
            ariaLabel="Projects to bill"
          />
          <p class="docs-output" role="status">Selected: {{ checked().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Lazy children"
        source="tree-table/lazy"
        [script]="lazyScript"
        note="With lazy, a node with leaf false shows an expander before it has children. Opening it emits nodeExpand: the owner sets loading on the node, loads the children (here with resource() and fake data after a short delay, no network) and puts them into a new copy of the nodes. While loading is true an open node shows a loading row under it."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="folders()"
            [columns]="folderColumns"
            [(expanded)]="folderOpen"
            lazy
            (nodeExpand)="loadFolder($event.node)"
            ariaLabel="Folders"
          />
          <p class="docs-output" role="status">
            {{ folderQueue().length ? 'Loading ' + folderQueue()[0] : 'Idle' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Columns: freeze, resize and reorder"
        source="tree-table/column-features"
        [script]="columnFeaturesScript"
        note="A frozen column stays in view when the table scrolls sideways (this demo is narrow, so it scrolls); frozen columns come first and the first column holds the tree toggle. resizableColumns adds a handle to each header: drag it, or focus it and use Arrow left and Arrow right. reorderableColumns lets the user drag a header or use its move buttons. columnWidths and columnOrder are two-way, so the owner can store them."
      >
        <div class="docs-stack docs-stack--narrow">
          <star-tree-table
            [nodes]="twoProjects"
            [columns]="frozenColumns"
            [expanded]="['website']"
            resizableColumns
            reorderableColumns
            [(columnWidths)]="widths"
            [(columnOrder)]="order"
            ariaLabel="Projects with frozen name"
          />
          <p class="docs-output" role="status">Order: {{ order().join(', ') || 'default' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Cell edit"
        source="tree-table/edit"
        [script]="editScript"
        note="A column with editable can change in place. When a column is editable the cells take the focus (cellNavigation, automatic here; set it to true or false to choose): Arrow right moves from a row into its cells, Arrow left and Arrow right move between cells, and Arrow left on the first cell goes back to the row. Enter or F2 opens the editor, Enter commits and Escape cancels. The table never changes nodes: it emits cellEdit, and the owner stores the value. editor number emits a number."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="editable()"
            [columns]="editColumns"
            [expanded]="['website', 'shop']"
            (cellEdit)="saveEdit($event)"
            ariaLabel="Editable projects"
          />
          <p class="docs-output" role="status">Last edit: {{ lastEdit() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Context menu"
        source="tree-table/context-menu"
        [script]="contextMenuScript"
        note="contextMenu takes menu items. A right click on a row, or Shift+F10 or the context menu key on the focused row, opens the menu (star-menu with starContextMenu). The choice emits contextMenuSelect with the node and the item. Escape closes the menu and the focus returns to the row."
      >
        <div class="docs-stack">
          <star-tree-table
            [nodes]="firstProjects"
            [columns]="projectColumns"
            [expanded]="['website']"
            [contextMenu]="rowActions"
            (contextMenuSelect)="onRowAction($event)"
            ariaLabel="Projects with actions"
          />
          <p class="docs-output" role="status">Last action: {{ lastAction() }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        In a right-to-left page Arrow left opens a closed branch (or moves into the row) and Arrow
        right closes an open one or moves to the parent row. In a cell, the two keys move toward the
        start and the end of the row. Indentation grows from the right and the expander arrow turns
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

  protected readonly large = buildLargeTreeTable();
  protected readonly virtualColumns: readonly StarTreeTableColumn[] = [
    { field: 'name', header: 'Location' },
    { field: 'kind', header: 'Kind', width: '8rem' },
    { field: 'units', header: 'Units', width: '8rem', align: 'end' },
  ];
  protected readonly largeOpen = signal<readonly string[]>(this.large.branchKeys);

  // ---- sort, filter and page ----
  protected readonly projects = PROJECTS;
  protected readonly firstProjects = PROJECTS.slice(0, 3);
  protected readonly twoProjects = PROJECTS.slice(0, 2);
  protected readonly projectColumns: readonly StarTreeTableColumn[] = [
    { field: 'name', header: 'Project', sortable: true },
    { field: 'owner', header: 'Owner', sortable: true, filter: true },
    { field: 'hours', header: 'Hours', sortable: true, align: 'end' },
  ];
  protected readonly projectOpen = signal<readonly string[]>(['website']);
  protected readonly slotOpen = signal<readonly string[]>([]);
  protected readonly sortField = signal<string | null>(null);
  protected readonly sortOrder = signal<1 | -1>(1);
  protected readonly query = signal('');
  protected readonly strict = signal(false);

  // ---- checkbox selection ----
  protected readonly checked = signal<readonly string[]>(['shop-cart']);

  // ---- lazy children ----
  protected readonly folderColumns: readonly StarTreeTableColumn[] = [
    { field: 'name', header: 'Folder' },
    { field: 'files', header: 'Files', align: 'end' },
  ];
  protected readonly folders = signal<readonly StarTreeTableNode[]>(FOLDERS);
  protected readonly folderOpen = signal<readonly string[]>([]);
  /** Folders whose children are requested, in order; the first one loads now. */
  protected readonly folderQueue = signal<readonly string[]>([]);
  private readonly folderChildren = resource({
    params: () => this.folderQueue()[0],
    loader: ({ params }) => loadFolderChildren(params),
  });

  // ---- columns ----
  protected readonly frozenColumns: readonly StarTreeTableColumn[] = [
    { field: 'name', header: 'Project', frozen: true, width: '12rem' },
    { field: 'owner', header: 'Owner', width: '10rem' },
    { field: 'hours', header: 'Hours', width: '8rem', align: 'end' },
  ];
  protected readonly widths = signal<Readonly<Record<string, number>>>({});
  protected readonly order = signal<readonly string[]>([]);

  // ---- cell edit ----
  protected readonly editable = signal<readonly StarTreeTableNode[]>(PROJECTS.slice(0, 2));
  protected readonly editColumns: readonly StarTreeTableColumn[] = [
    { field: 'name', header: 'Project' },
    { field: 'owner', header: 'Owner', editable: true },
    { field: 'hours', header: 'Hours', editable: true, editor: 'number', align: 'end' },
  ];
  protected readonly lastEdit = signal('none');

  // ---- context menu ----
  protected readonly rowActions: readonly StarMenuItem[] = [
    { label: 'Open', icon: 'ph-bold ph-arrow-square-out' },
    { label: 'Duplicate', icon: 'ph-bold ph-copy' },
    { separator: true },
    { label: 'Archive', icon: 'ph-bold ph-archive' },
  ];
  protected readonly lastAction = signal('none');

  constructor() {
    // A folder's children arrived: put them into a new copy of the nodes, then load the next one.
    effect(() => {
      if (this.folderChildren.status() !== 'resolved') return;
      const key = this.folderQueue()[0];
      const children = this.folderChildren.value();
      if (!key || !children) return;
      untracked(() => {
        this.folders.update((nodes) =>
          updateNode(nodes, key, (node) => ({ ...node, loading: false, children })),
        );
        this.folderQueue.update((queue) => queue.slice(1));
      });
    });
  }

  protected loadFolder(node: StarTreeTableNode): void {
    if (node.children || node.loading) return;
    this.folders.update((nodes) => updateNode(nodes, node.key, (n) => ({ ...n, loading: true })));
    this.folderQueue.update((queue) => [...queue, node.key]);
  }

  protected saveEdit(event: StarTreeTableCellEditEvent): void {
    this.editable.update((nodes) =>
      updateNode(nodes, event.node.key, (node) => ({
        ...node,
        data: { ...node.data, [event.field]: event.value },
      })),
    );
    this.lastEdit.set(`${event.node.label}, ${event.field}: ${event.previous} to ${event.value}`);
  }

  protected onRowAction(event: StarTreeTableContextMenuEvent): void {
    this.lastAction.set(`${event.item.label}: ${event.node.label}`);
  }

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

  protected readonly virtualScript = `// 10 sites x 10 warehouses x 10 aisles x 10 bins = 11,110 rows.
// Each node: { key, label, data: { name, kind, units }, children }.
readonly large: LargeTreeTable = buildLargeTreeTable(); // { nodes, branchKeys, count }
readonly virtualColumns: readonly StarTreeTableColumn[] = [
  { field: 'name', header: 'Location' },
  { field: 'kind', header: 'Kind', width: '8rem' },
  { field: 'units', header: 'Units', width: '8rem', align: 'end' },
];
// Every branch is open: 11,110 open rows.
readonly largeOpen = signal<readonly string[]>(this.large.branchKeys);`;

  protected readonly slotsScript = `// Import STAR_SLOTS from '@star-ng/ui/core' and StarNodeTemplate from '@star-ng/ui/tree'
// in the component imports.
readonly departments: readonly StarTreeNode<Record<string, unknown>>[] = [ /* as above */ ];
readonly allOpen = ['eng', 'apps', 'ops'];`;

  protected readonly sortFilterScript = `// PROJECTS: projects with tasks; data: { name, owner, hours }.
readonly projects = PROJECTS;
readonly projectColumns: readonly StarTreeTableColumn[] = [
  { field: 'name', header: 'Project', sortable: true },
  { field: 'owner', header: 'Owner', sortable: true, filter: true },
  { field: 'hours', header: 'Hours', sortable: true, align: 'end' },
];
readonly projectOpen = signal<readonly string[]>(['website']);
readonly sortField = signal<string | null>(null);
readonly sortOrder = signal<1 | -1>(1);
readonly query = signal('');
readonly strict = signal(false);`;

  protected readonly checkboxScript = `readonly checked = signal<readonly string[]>(['shop-cart']);`;

  protected readonly lazyScript = `readonly folders = signal<readonly StarTreeTableNode[]>([
  { key: 'invoices', label: 'Invoices', data: { name: 'Invoices', files: 24 }, leaf: false },
  { key: 'orders', label: 'Orders', data: { name: 'Orders', files: 18 }, leaf: false },
  { key: 'readme', label: 'Read me', data: { name: 'Read me', files: 1 }, leaf: true },
]);
readonly folderOpen = signal<readonly string[]>([]);
/** Folders whose children are requested, in order; the first one loads now. */
readonly folderQueue = signal<readonly string[]>([]);
private readonly folderChildren = resource({
  params: () => this.folderQueue()[0],
  // Fake server call: resolves with the children after a short delay.
  loader: ({ params }) => loadFolderChildren(params),
});

constructor() {
  effect(() => {
    if (this.folderChildren.status() !== 'resolved') return;
    const key = this.folderQueue()[0];
    const children = this.folderChildren.value();
    if (!key || !children) return;
    untracked(() => {
      this.folders.update((nodes) =>
        updateNode(nodes, key, (node) => ({ ...node, loading: false, children })),
      );
      this.folderQueue.update((queue) => queue.slice(1));
    });
  });
}

loadFolder(node: StarTreeTableNode): void {
  if (node.children || node.loading) return;
  this.folders.update((nodes) => updateNode(nodes, node.key, (n) => ({ ...n, loading: true })));
  this.folderQueue.update((queue) => [...queue, node.key]);
}`;

  protected readonly columnFeaturesScript = `readonly frozenColumns: readonly StarTreeTableColumn[] = [
  { field: 'name', header: 'Project', frozen: true, width: '12rem' },
  { field: 'owner', header: 'Owner', width: '10rem' },
  { field: 'hours', header: 'Hours', width: '8rem', align: 'end' },
];
readonly widths = signal<Readonly<Record<string, number>>>({});
readonly order = signal<readonly string[]>([]);`;

  protected readonly editScript = `readonly editable = signal<readonly StarTreeTableNode[]>(PROJECTS.slice(0, 2));
readonly editColumns: readonly StarTreeTableColumn[] = [
  { field: 'name', header: 'Project' },
  { field: 'owner', header: 'Owner', editable: true },
  { field: 'hours', header: 'Hours', editable: true, editor: 'number', align: 'end' },
];

saveEdit(event: StarTreeTableCellEditEvent): void {
  // The table does not change the nodes: store the value in a new copy.
  this.editable.update((nodes) =>
    updateNode(nodes, event.node.key, (node) => ({
      ...node,
      data: { ...node.data, [event.field]: event.value },
    })),
  );
}`;

  protected readonly contextMenuScript = `// Import StarMenuItem from '@star-ng/ui/menu'.
readonly rowActions: readonly StarMenuItem[] = [
  { label: 'Open', icon: 'ph-bold ph-arrow-square-out' },
  { label: 'Duplicate', icon: 'ph-bold ph-copy' },
  { separator: true },
  { label: 'Archive', icon: 'ph-bold ph-archive' },
];

onRowAction(event: StarTreeTableContextMenuEvent): void {
  this.lastAction.set(event.item.label + ': ' + event.node.label);
}`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starNode]',
      description:
        'Content child, from @star-ng/ui/tree. Replaces the label of a node in the first column. The toggle (and the check box) stay. The context has $implicit (the node), level (1 for a root node), expanded and selected. Do not add focusable elements: the table owns the keys. With virtualScroll the row keeps the height virtualItemSize and the content does not wrap.',
    },
    {
      name: 'ng-template[starEmpty]',
      description:
        'Content child. Shows one row over all columns when there are no rows. $implicit is the globalFilter text. Without this slot the table shows no row, or the text "No results found" while a filter is on.',
    },
    {
      name: 'ng-template[starHeader]',
      description: 'Content child. Content above the table.',
    },
    {
      name: 'ng-template[starFooter]',
      description: 'Content child. Content below the table.',
    },
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
    { name: 'Home / End', description: 'Moves the focus to the first or the last visible row.' },
    {
      name: 'Arrow right',
      description:
        'Opens a closed branch. On an open branch or a leaf it moves into the row (first cell) with cell navigation; otherwise it does nothing. In a cell: the next cell.',
    },
    {
      name: 'Cell navigation (cellNavigation)',
      description:
        'The cells take the focus and the arrow keys move between them. Not set (the default): on when a column is editable, off otherwise. cellNavigation true or false sets it for the table.',
    },
    {
      name: 'Arrow left',
      description:
        'Closes an open branch. Otherwise it moves the focus to the parent row. In a cell: the previous cell, and from the first cell back to the row.',
    },
    { name: 'Home / End in a cell', description: 'The first or the last cell of the row.' },
    {
      name: 'Space',
      description: 'With selectionMode: selects or unselects the row (checks it in checkbox mode).',
    },
    {
      name: 'Enter / F2',
      description:
        'Opens the editor of the focused cell, or of the first editable cell of the focused row. In the editor Enter commits and Escape cancels.',
    },
    {
      name: 'Shift+F10 / context menu key',
      description: 'Opens the context menu of the focused row (with contextMenu).',
    },
    {
      name: 'Arrow left / Arrow right on a resize handle',
      description: 'Makes the column narrower or wider (with resizableColumns).',
    },
    {
      name: 'With virtualScroll',
      description:
        'All keys work over every open row. A target row that is not rendered is scrolled into the window and then focused. The focus never leaves the table: while the focused row is out of the window, the focus waits on the scroll area and returns to the row when it renders.',
    },
  ];
}
