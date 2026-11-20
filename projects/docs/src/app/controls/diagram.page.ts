import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import {
  StarDiagram,
  StarDiagramChange,
  StarDiagramEdge,
  StarDiagramEdgePatch,
  StarDiagramNode,
  StarDiagramNodePatch,
  StarDiagramNodeTemplate,
  starApplyPatches,
  starLayoutGrid,
  starLayoutTree,
} from '@star-ng/ui/diagram';
import { DOCS, DocsRow } from '../shared/docs';

const WORKFLOW_NODES: readonly StarDiagramNode[] = [
  { id: 'placed', x: 40, y: 40, width: 140, height: 48, shape: 'rounded', label: 'Order placed' },
  { id: 'paid', x: 260, y: 32, width: 140, height: 64, shape: 'diamond', label: 'Payment ok?' },
  { id: 'pick', x: 480, y: 40, width: 140, height: 48, shape: 'rect', label: 'Pick items' },
  { id: 'ship', x: 700, y: 40, width: 140, height: 48, shape: 'rect', label: 'Ship order' },
  { id: 'remind', x: 260, y: 200, width: 140, height: 48, shape: 'rect', label: 'Send reminder' },
  { id: 'done', x: 700, y: 200, width: 140, height: 48, shape: 'ellipse', label: 'Delivered' },
];

const WORKFLOW_EDGES: readonly StarDiagramEdge[] = [
  { id: 'placed-paid', from: 'placed', to: 'paid', routing: 'orthogonal' },
  { id: 'paid-pick', from: 'paid', to: 'pick', routing: 'orthogonal', label: 'Yes' },
  { id: 'paid-remind', from: 'paid', to: 'remind', routing: 'orthogonal', label: 'No' },
  { id: 'remind-paid', from: 'remind', to: 'placed', routing: 'straight', arrow: 'end' },
  { id: 'pick-ship', from: 'pick', to: 'ship', routing: 'orthogonal' },
  { id: 'ship-done', from: 'ship', to: 'done', routing: 'orthogonal' },
];

@Component({
  selector: 'docs-diagram-page',
  imports: [DOCS, StarButton, StarDiagram, StarDiagramNodeTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .card {
      display: grid;
      gap: 0.125rem;
      text-align: center;
    }
    .card small {
      color: var(--star-text-muted);
    }
  `,
  template: `
    <docs-page
      heading="Diagram"
      lead="Nodes and connections on an SVG canvas: select, drag with snap to the grid, resize, connect, pan and zoom, undo and redo, with the keyboard too. The diagram never changes its inputs: it emits patches, and the owner applies them. The Syncfusion and Kendo UI equivalent is Diagram; the DevExtreme equivalent is dxDiagram."
      importFrom="import { StarDiagram, starApplyPatches } from '@star-ng/ui/diagram';"
    >
      <docs-example
        heading="Order workflow"
        source="diagram/workflow"
        [script]="workflowScript"
        note="Drag a node, or select it and press Alt and an arrow key. Drag from a port (the circles on a selected node) to another node to connect them. Space and drag, or the middle mouse button, pans; Control and the wheel zooms. Control+Z undoes."
      >
        <div class="docs-stack">
          <div class="actions">
            <star-button variant="secondary" size="sm" (pressed)="layoutTree()"
              >Tree layout</star-button
            >
            <star-button variant="secondary" size="sm" (pressed)="layoutGrid()"
              >Grid layout</star-button
            >
            <star-button variant="secondary" size="sm" (pressed)="download()"
              >Export SVG</star-button
            >
          </div>
          <star-diagram
            #workflow
            [nodes]="nodes()"
            [edges]="edges()"
            [(selection)]="selection"
            fitContent
            ariaLabel="Order workflow"
            (nodesChange)="onNodes($event)"
            (edgesChange)="onEdges($event)"
          />
          <p class="docs-output" role="status">{{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Node template"
        source="diagram/template"
        [script]="templateScript"
        note="ng-template[starDiagramNode] renders custom content in each node, in a foreignObject. The server and the export show the plain label."
      >
        <star-diagram
          [nodes]="cards()"
          [edges]="cardEdges"
          readonly
          [showGrid]="false"
          height="14rem"
          ariaLabel="Order stages"
        >
          <ng-template starDiagramNode let-node>
            <span class="card">
              <strong>{{ node.label }}</strong>
              <small>{{ counts[node.id] }} orders</small>
            </span>
          </ng-template>
        </star-diagram>
      </docs-example>

      <docs-api [of]="['StarDiagram']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class DiagramPage {
  private readonly workflow = viewChild.required<StarDiagram>('workflow');
  protected readonly nodes = signal<readonly StarDiagramNode[]>(WORKFLOW_NODES);
  protected readonly edges = signal<readonly StarDiagramEdge[]>(WORKFLOW_EDGES);
  protected readonly selection = signal<readonly string[]>([]);
  protected readonly last = signal('No change yet.');

  protected readonly cards = signal<readonly StarDiagramNode[]>([
    { id: 'new', x: 20, y: 40, width: 150, height: 64, shape: 'rounded', label: 'New' },
    { id: 'packed', x: 230, y: 40, width: 150, height: 64, shape: 'rounded', label: 'Packed' },
    { id: 'shipped', x: 440, y: 40, width: 150, height: 64, shape: 'rounded', label: 'Shipped' },
  ]);
  protected readonly cardEdges: readonly StarDiagramEdge[] = [
    { id: 'a', from: 'new', to: 'packed', routing: 'straight' },
    { id: 'b', from: 'packed', to: 'shipped', routing: 'straight' },
  ];
  protected readonly counts: Record<string, number> = { new: 12, packed: 7, shipped: 31 };

  protected onNodes(change: StarDiagramChange<StarDiagramNodePatch>): void {
    this.nodes.update((nodes) => starApplyPatches(nodes, change.patches));
    this.last.set(`${change.reason}: ${change.patches.length} node patch(es)`);
  }

  protected onEdges(change: StarDiagramChange<StarDiagramEdgePatch>): void {
    this.edges.update((edges) => starApplyPatches(edges, change.patches));
    this.last.set(`${change.reason}: ${change.patches.length} connection patch(es)`);
  }

  protected layoutTree(): void {
    this.workflow().applyLayout(
      starLayoutTree(this.nodes(), this.edges(), { direction: 'right', origin: { x: 40, y: 40 } }),
    );
    this.workflow().fitToContent();
  }

  protected layoutGrid(): void {
    this.workflow().applyLayout(
      starLayoutGrid(this.nodes(), { columns: 3, origin: { x: 40, y: 40 } }),
    );
    this.workflow().fitToContent();
  }

  protected download(): void {
    const svg = this.workflow().exportSvg();
    if (!svg) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    link.download = 'order-workflow.svg';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  protected readonly workflowScript = `readonly nodes = signal<readonly StarDiagramNode[]>([
  { id: 'placed', x: 40, y: 40, width: 140, height: 48, shape: 'rounded', label: 'Order placed' },
  { id: 'paid', x: 260, y: 32, width: 140, height: 64, shape: 'diamond', label: 'Payment ok?' },
  // …
]);
readonly edges = signal<readonly StarDiagramEdge[]>([
  { id: 'placed-paid', from: 'placed', to: 'paid', routing: 'orthogonal' },
  { id: 'paid-pick', from: 'paid', to: 'pick', routing: 'orthogonal', label: 'Yes' },
  // …
]);

// The diagram never changes its inputs. Apply the patches, or call change.cancel().
// Undo and redo work on the patches that were applied.
onNodes(change: StarDiagramChange<StarDiagramNodePatch>): void {
  this.nodes.update((nodes) => starApplyPatches(nodes, change.patches));
}
onEdges(change: StarDiagramChange<StarDiagramEdgePatch>): void {
  this.edges.update((edges) => starApplyPatches(edges, change.patches));
}

layoutTree(): void {
  // Pure helper; applyLayout emits it as one undoable change.
  this.workflow().applyLayout(starLayoutTree(this.nodes(), this.edges(), { direction: 'right' }));
}`;
  protected readonly templateScript = `readonly counts: Record<string, number> = { new: 12, packed: 7, shipped: 31 };`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starDiagramNode]',
      description:
        'Content of each node, in a foreignObject (browser only). Context: $implicit is the node, selected is its selection state.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-diagram-height',
      description: 'Height of the canvas (the height input sets it).',
    },
    { name: '--star-border-strong', description: 'Node outline and grid dots.' },
    { name: '--star-primary', description: 'Outline of selected nodes and connections.' },
    { name: '--star-primary-soft', description: 'Fill of selected nodes and of the marquee.' },
    { name: '--star-accent', description: 'Focus ring, ports and the connection that is drawn.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'Moves into the diagram (one tab stop for all nodes) and out of it.',
    },
    {
      name: 'Arrow keys',
      description:
        'Go to the nearest node in that direction and select it. Shift adds it to the selection.',
    },
    { name: 'Alt + Arrow keys', description: 'Move the selected nodes by one grid step.' },
    {
      name: 'Shift + Alt + Arrow keys',
      description: 'Make the selected nodes wider or narrower, taller or shorter.',
    },
    {
      name: 'Enter',
      description: 'Edits the label of the focused node. Enter saves, Escape cancels.',
    },
    { name: 'Delete', description: 'Removes the selected nodes with their connections.' },
    { name: 'Control + A', description: 'Selects every node.' },
    { name: 'Control + Z / Control + Y', description: 'Undo and redo.' },
    { name: 'Escape', description: 'Clears the selection.' },
  ];
}
