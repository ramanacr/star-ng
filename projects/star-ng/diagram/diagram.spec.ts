import { Component, PLATFORM_ID, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StarAnnouncer } from '@star-ng/ui/core';
import {
  StarDiagram,
  StarDiagramChange,
  StarDiagramEdge,
  StarDiagramEdgePatch,
  StarDiagramNode,
  StarDiagramNodePatch,
  StarDiagramNodeTemplate,
  starApplyPatches,
} from '@star-ng/ui/diagram';

const NODES: StarDiagramNode[] = [
  { id: 'new', x: 0, y: 0, width: 100, height: 40, shape: 'rounded', label: 'New order' },
  { id: 'check', x: 200, y: 0, width: 100, height: 40, shape: 'diamond', label: 'In stock?' },
  { id: 'ship', x: 400, y: 0, width: 100, height: 40, shape: 'rect', label: 'Ship' },
  { id: 'wait', x: 200, y: 160, width: 100, height: 40, shape: 'ellipse', label: 'Back order' },
];
const EDGES: StarDiagramEdge[] = [
  { id: 'e1', from: 'new', to: 'check', routing: 'orthogonal' },
  { id: 'e2', from: 'check', to: 'ship', routing: 'orthogonal', label: 'Yes' },
  { id: 'e3', from: 'check', to: 'wait', routing: 'straight', label: 'No', arrow: 'both' },
];

@Component({
  imports: [StarDiagram, StarDiagramNodeTemplate],
  template: `
    <star-diagram
      [nodes]="nodes()"
      [edges]="edges()"
      [(selection)]="selection"
      [(zoom)]="zoom"
      [gridSize]="20"
      [documentKey]="documentKey()"
      ariaLabel="Order workflow"
      (nodesChange)="onNodes($event)"
      (edgesChange)="onEdges($event)"
    >
      @if (custom()) {
        <ng-template starDiagramNode let-node>
          <span class="custom">{{ node.label }}</span>
        </ng-template>
      }
    </star-diagram>
  `,
})
class DiagramHost {
  readonly diagram = viewChild.required(StarDiagram);
  readonly nodes = signal<readonly StarDiagramNode[]>(NODES);
  readonly edges = signal<readonly StarDiagramEdge[]>(EDGES);
  readonly selection = signal<readonly string[]>([]);
  readonly zoom = signal(1);
  readonly documentKey = signal<string | null>('orders');
  readonly custom = signal(false);
  readonly cancelNodes = signal(false);
  readonly cancelEdges = signal(false);
  readonly nodeChanges: StarDiagramChange<StarDiagramNodePatch>[] = [];
  readonly edgeChanges: StarDiagramChange<StarDiagramEdgePatch>[] = [];

  onNodes(change: StarDiagramChange<StarDiagramNodePatch>): void {
    this.nodeChanges.push(change);
    if (this.cancelNodes()) change.cancel();
    else this.nodes.update((list) => starApplyPatches(list, change.patches));
  }

  onEdges(change: StarDiagramChange<StarDiagramEdgePatch>): void {
    this.edgeChanges.push(change);
    if (this.cancelEdges()) change.cancel();
    else this.edges.update((list) => starApplyPatches(list, change.patches));
  }
}

function key(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function pointer(
  type: string,
  target: EventTarget,
  x: number,
  y: number,
  init: MouseEventInit = {},
) {
  target.dispatchEvent(
    new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      ...init,
    }),
  );
}

async function setup() {
  const fixture = TestBed.createComponent(DiagramHost);
  const announced: string[] = [];
  vi.spyOn(TestBed.inject(StarAnnouncer), 'announce').mockImplementation(async (message) => {
    announced.push(message);
  });
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const host = fixture.componentInstance;
  const stable = () => fixture.whenStable();
  const node = (id: string) => root.querySelector<SVGGElement>(`[data-node-id="${id}"]`)!;
  const canvas = root.querySelector<HTMLElement>('.star-diagram__canvas')!;
  const drag = async (target: Element, from: [number, number], to: [number, number], init = {}) => {
    pointer('pointerdown', target, from[0], from[1], init);
    await stable();
    pointer('pointermove', document, to[0], to[1]);
    pointer('pointerup', document, to[0], to[1]);
    await stable();
  };
  return { fixture, root, host, stable, node, canvas, drag, announced };
}

describe('StarDiagram', () => {
  it('renders the nodes as a listbox and lists nodes and connections for screen readers', async () => {
    const { root, node, canvas } = await setup();
    const list = root.querySelector('[role="listbox"]')!;
    expect(list.getAttribute('aria-multiselectable')).toBe('true');
    expect(list.getAttribute('aria-label')).toBe('Nodes');
    expect(node('new').getAttribute('role')).toBe('option');
    expect(node('new').getAttribute('aria-label')).toBeNull();
    expect(node('new').textContent?.trim()).toBe('New order');
    expect(node('new').getAttribute('tabindex')).toBe('0');
    expect(node('ship').getAttribute('tabindex')).toBe('-1');
    const hidden = [...root.querySelectorAll('.star-sr-only li')].map((li) =>
      li.textContent?.trim(),
    );
    expect(hidden).toContain('In stock? to Ship (Yes)');
    expect(hidden).toContain('Back order');
    // role="application" only while the focus is inside.
    expect(canvas.getAttribute('role')).toBeNull();
    expect(canvas.getAttribute('aria-describedby')).toBeTruthy();
    node('new').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await TestBed.inject(StarAnnouncer).announce('');
    expect(canvas.getAttribute('aria-describedby')).toBeTruthy();
  });

  it('switches to role application on focus', async () => {
    const { node, canvas, stable } = await setup();
    node('new').focus();
    node('new').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await stable();
    expect(canvas.getAttribute('role')).toBe('application');
    expect(canvas.getAttribute('aria-label')).toBe('Order workflow');
  });

  it('draws edges with arrows and labels', async () => {
    const { root } = await setup();
    const lines = [...root.querySelectorAll('.star-diagram__edge-line')];
    expect(lines.length).toBe(3);
    expect(lines[0].getAttribute('marker-end')).toContain('-arrow');
    expect(lines[2].getAttribute('marker-start')).toContain('-arrow');
    expect(root.querySelector('.star-diagram__edge-label')?.textContent?.trim()).toBe('Yes');
  });

  it('selects with a click, Shift+click and a marquee', async () => {
    const { host, node, canvas, stable, drag } = await setup();
    pointer('pointerdown', node('new').querySelector('path')!, 10, 10);
    pointer('pointerup', document, 10, 10);
    await stable();
    expect(host.selection()).toEqual(['new']);
    pointer('pointerdown', node('ship'), 410, 10, { shiftKey: true });
    pointer('pointerup', document, 410, 10);
    await stable();
    expect(host.selection()).toEqual(['new', 'ship']);
    await drag(canvas, [-10, -10], [320, 60]);
    expect(host.selection()).toEqual(['new', 'check']);
  });

  it('drags nodes with snap to the grid and emits one move patch per node', async () => {
    const { host, node, drag, stable } = await setup();
    host.selection.set(['new', 'check']);
    await stable();
    await drag(node('new'), [10, 10], [43, 27]);
    const change = host.nodeChanges.at(-1)!;
    expect(change.reason).toBe('move');
    expect(change.patches).toEqual([
      { type: 'update', id: 'new', before: { x: 0, y: 0 }, after: { x: 40, y: 20 } },
      { type: 'update', id: 'check', before: { x: 200, y: 0 }, after: { x: 240, y: 20 } },
    ]);
    expect(host.nodes()[0].x).toBe(40);
  });

  it('resizes with a handle', async () => {
    const { root, host, stable, drag } = await setup();
    host.selection.set(['ship']);
    await stable();
    const handle = root.querySelector('[data-handle="se"]')!;
    await drag(handle, [500, 40], [541, 79]);
    expect(host.nodeChanges.at(-1)).toMatchObject({
      reason: 'resize',
      patches: [{ id: 'ship', after: { x: 400, y: 0, width: 140, height: 80 } }],
    });
  });

  it('connects a port to another node', async () => {
    const { root, host, stable, drag, announced } = await setup();
    host.selection.set(['new']);
    await stable();
    const port = root.querySelector('[data-port="bottom"][data-port-node="new"]')!;
    await drag(port, [50, 40], [250, 170]);
    const change = host.edgeChanges.at(-1)!;
    expect(change.reason).toBe('connect');
    expect(change.patches[0]).toMatchObject({
      type: 'add',
      item: { from: 'new', to: 'wait', fromPort: 'bottom', toPort: 'top', routing: 'orthogonal' },
    });
    expect(announced.at(-1)).toBe('Connected New order to Back order');
  });

  it('moves the focus to the nearest node with the arrow keys and selects it', async () => {
    const { host, node, stable } = await setup();
    node('new').focus();
    key(node('new'), 'ArrowRight');
    await stable();
    expect(document.activeElement).toBe(node('check'));
    expect(host.selection()).toEqual(['check']);
    key(node('check'), 'ArrowDown');
    await stable();
    expect(document.activeElement).toBe(node('wait'));
    key(node('wait'), 'ArrowRight', { shiftKey: true });
    await stable();
    expect(host.selection()).toEqual(['wait', 'ship']);
    key(node('ship'), 'a', { ctrlKey: true });
    await stable();
    expect(host.selection()).toEqual(['new', 'check', 'ship', 'wait']);
  });

  it('moves with Alt+Arrow and resizes with Shift+Alt+Arrow, announced', async () => {
    const { host, node, stable, announced } = await setup();
    host.selection.set(['ship']);
    await stable();
    key(node('ship'), 'ArrowDown', { altKey: true });
    await stable();
    expect(host.nodes()[2]).toMatchObject({ x: 400, y: 20 });
    expect(announced.at(-1)).toBe('Ship moved to 400, 20');
    key(node('ship'), 'ArrowRight', { altKey: true, shiftKey: true });
    await stable();
    expect(host.nodes()[2]).toMatchObject({ width: 120, height: 40 });
    expect(announced.at(-1)).toBe('Ship resized to 120 by 40');
    key(node('ship'), 'ArrowUp', { altKey: true, shiftKey: true });
    await stable();
    expect(host.nodes()[2].height).toBe(20);
  });

  it('deletes the selection with its connections, edges first', async () => {
    const { host, node, stable, announced } = await setup();
    host.selection.set(['check']);
    await stable();
    key(node('check'), 'Delete');
    await stable();
    expect(host.edges()).toEqual([]);
    expect(host.nodes().map((n) => n.id)).toEqual(['new', 'ship', 'wait']);
    expect(host.edgeChanges.at(-1)!.reason).toBe('delete');
    expect(announced.at(-1)).toBe('1 item deleted');
  });

  it('reverts the edge patches when the node change is canceled, and records nothing', async () => {
    const { host, node, stable } = await setup();
    host.cancelNodes.set(true);
    host.selection.set(['check']);
    await stable();
    key(node('check'), 'Delete');
    await stable();
    expect(host.edgeChanges.map((c) => c.reason)).toEqual(['delete', 'revert']);
    expect(host.edges().length).toBe(3);
    expect(host.diagram().canUndo()).toBe(false);
  });

  it('undoes and redoes the applied changes with Control+Z and Control+Y', async () => {
    const { host, node, stable } = await setup();
    host.selection.set(['check']);
    await stable();
    key(node('check'), 'Delete');
    await stable();
    expect(host.diagram().canUndo()).toBe(true);
    key(node('new'), 'z', { ctrlKey: true });
    await stable();
    expect(
      host
        .nodes()
        .map((n) => n.id)
        .sort(),
    ).toEqual(['check', 'new', 'ship', 'wait']);
    expect(host.edges().length).toBe(3);
    expect(host.nodeChanges.at(-1)!.reason).toBe('undo');
    expect(host.diagram().canRedo()).toBe(true);
    key(node('new'), 'y', { ctrlKey: true });
    await stable();
    expect(host.nodes().length).toBe(3);
    // A canceled undo stays on the stack.
    host.cancelNodes.set(true);
    host.cancelEdges.set(true);
    expect(host.diagram().undo()).toBe(false);
    expect(host.diagram().canUndo()).toBe(true);
  });

  it('edits a label with Enter', async () => {
    const { root, host, node, stable } = await setup();
    node('wait').focus();
    key(node('wait'), 'Enter');
    await stable();
    const field = root.querySelector<HTMLInputElement>('.star-diagram__editor')!;
    expect(field.getAttribute('aria-label')).toBe('Node label');
    expect(field.value).toBe('Back order');
    field.value = 'Reorder';
    key(field, 'Enter');
    await stable();
    expect(host.nodeChanges.at(-1)).toMatchObject({
      reason: 'label',
      patches: [{ id: 'wait', before: { label: 'Back order' }, after: { label: 'Reorder' } }],
    });
    expect(root.querySelector('.star-diagram__editor')).toBeNull();
  });

  it('zooms with the buttons, Control+wheel and fit, within the limits', async () => {
    const { root, host, canvas, stable } = await setup();
    root.querySelector<HTMLButtonElement>('[aria-label="Zoom in"]')!.click();
    await stable();
    expect(host.zoom()).toBeCloseTo(1.25);
    expect(root.querySelector('.star-diagram__zoom')?.textContent?.trim()).toBe('125%');
    canvas.dispatchEvent(
      new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true }),
    );
    await stable();
    expect(host.zoom()).toBeCloseTo(1.25 / 1.1);
    for (let i = 0; i < 20; i++) host.diagram().zoomOut();
    expect(host.zoom()).toBe(0.25);
    host.diagram().fitToContent();
    await stable();
    expect(host.zoom()).toBeGreaterThan(0.25);
    expect(host.zoom()).toBeLessThanOrEqual(1);
  });

  it('applies a layout as an undoable change', async () => {
    const { host } = await setup();
    const moved = host.nodes().map((n, i) => ({ ...n, x: i * 150, y: 300 }));
    expect(host.diagram().applyLayout(moved)).toBe(true);
    expect(host.nodeChanges.at(-1)!.reason).toBe('layout');
    expect(host.nodes()[1]).toMatchObject({ x: 150, y: 300 });
    host.diagram().undo();
    expect(host.nodes()[1]).toMatchObject({ x: 200, y: 0 });
  });

  it('renders a node template in a foreignObject in the browser', async () => {
    const { root, host, stable } = await setup();
    host.custom.set(true);
    await stable();
    expect(root.querySelectorAll('foreignObject').length).toBe(4);
    expect(root.querySelector('foreignObject .custom')?.textContent).toBe('New order');
  });

  it('exports an SVG document around the content', async () => {
    const { host } = await setup();
    const svg = host.diagram().exportSvg();
    expect(svg).toContain('<svg');
    expect(svg).toContain('viewBox="0 0 532 232"');
    expect(svg).toContain('<title>Order workflow</title>');
    expect(svg).not.toContain('data-export');
  });

  it('clears the history with clearHistory() and when the documentKey changes', async () => {
    const { host, node, stable } = await setup();
    host.selection.set(['ship']);
    await stable();
    key(node('ship'), 'ArrowDown', { altKey: true });
    await stable();
    expect(host.diagram().canUndo()).toBe(true);
    host.diagram().clearHistory();
    expect(host.diagram().canUndo()).toBe(false);
    key(node('ship'), 'ArrowDown', { altKey: true });
    await stable();
    expect(host.diagram().canUndo()).toBe(true);
    // Another document: the old patches must not apply to it.
    host.documentKey.set('invoices');
    await stable();
    expect(host.diagram().canUndo()).toBe(false);
  });

  it('keeps the exported labels centred', async () => {
    const { host } = await setup();
    const svg = host.diagram().exportSvg();
    // The label keeps its centring without the CSS classes.
    expect(svg).toMatch(
      /<text[^>]*text-anchor="middle"[^>]*dominant-baseline="central"[^>]*>\s*Ship/,
    );
    expect(svg).toMatch(/<text[^>]*text-anchor="middle"[^>]*>\s*Yes/);
  });

  it('emits the nodes before the edges when an undo adds them back', async () => {
    const { host, node, stable } = await setup();
    const order: string[] = [];
    host.selection.set(['check']);
    await stable();
    key(node('check'), 'Delete');
    await stable();
    const sub1 = host.diagram().nodesChange.subscribe(() => order.push('nodes'));
    const sub2 = host.diagram().edgesChange.subscribe(() => order.push('edges'));
    host.diagram().undo();
    expect(order).toEqual(['nodes', 'edges']);
    sub1.unsubscribe();
    sub2.unsubscribe();
  });

  it('ends a pointer drag when it is destroyed and captures the pointer of a resize', async () => {
    const { fixture, root, host, node, canvas, stable } = await setup();
    const capture = vi.fn();
    canvas.setPointerCapture = capture;
    host.selection.set(['new']);
    await stable();
    // A move drag keeps the pointer events on the node, so a double click still finds it.
    node('new').dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10, button: 0 }),
    );
    expect(capture).not.toHaveBeenCalled();
    document.dispatchEvent(
      new MouseEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10 }),
    );
    root
      .querySelector('[data-handle="se"]')!
      .dispatchEvent(
        new MouseEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 40, button: 0 }),
      );
    expect(capture).toHaveBeenCalledTimes(1);
    const removed = vi.spyOn(document, 'removeEventListener');
    fixture.destroy();
    expect(removed.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['pointermove', 'pointerup', 'pointercancel']),
    );
    removed.mockRestore();
  });

  it('edits the label after a double click that follows a pointer down on the node', async () => {
    const { root, node, stable } = await setup();
    pointer('pointerdown', node('ship'), 410, 10);
    pointer('pointerup', document, 410, 10);
    node('ship').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await stable();
    expect(root.querySelector<HTMLInputElement>('.star-diagram__editor')?.value).toBe('Ship');
  });

  it('resizes several selected nodes with one undoable change', async () => {
    const { host, node, stable } = await setup();
    host.selection.set(['new', 'ship']);
    await stable();
    const before = host.nodeChanges.length;
    key(node('ship'), 'ArrowRight', { altKey: true, shiftKey: true });
    await stable();
    expect(host.nodeChanges.length).toBe(before + 1);
    expect(host.nodeChanges.at(-1)!.patches.length).toBe(2);
    host.diagram().undo();
    expect(host.nodes().find((n) => n.id === 'new')!.width).toBe(100);
    expect(host.nodes().find((n) => n.id === 'ship')!.width).toBe(100);
  });

  it('keeps the zoom model within the limits', async () => {
    const { host, stable } = await setup();
    host.zoom.set(10);
    await stable();
    expect(host.zoom()).toBe(4);
    host.zoom.set(0.01);
    await stable();
    expect(host.zoom()).toBe(0.25);
  });

  it('renders on the server platform with plain labels', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: PLATFORM_ID, useValue: 'server' }] });
    const { root, host, stable } = await setup();
    host.custom.set(true);
    await stable();
    expect(root.querySelectorAll('[role="option"]').length).toBe(4);
    expect(root.querySelector('foreignObject')).toBeNull();
    expect(root.querySelector('.star-diagram__label')?.textContent?.trim()).toBe('New order');
    expect(host.diagram().exportSvg()).toBe('');
  });
});
