import { _IdGenerator } from '@angular/cdk/a11y';
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  Directive,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  numberAttribute,
  output,
  OutputEmitterRef,
  PLATFORM_ID,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import { starChartPng, starChartSvgDocument } from '@star-ng/ui/chart';
import { STAR_UI_TEXT, StarAnnouncer } from '@star-ng/ui/core';
import {
  starContentBounds,
  StarDiagramDirection,
  StarDiagramEdge,
  StarDiagramHandle,
  StarDiagramNode,
  StarDiagramPoint,
  StarDiagramPort,
  StarDiagramRect,
  starEdgePoints,
  starFitView,
  starNearestNode,
  starNodeAt,
  starNodesInRect,
  starNormaliseRect,
  starPathData,
  starPathMidpoint,
  starPortPoint,
  starPortsOf,
  starResizeRect,
  starShapePath,
  starSnap,
  starZoomAt,
} from './diagram-geometry';
import {
  StarDiagramHistory,
  StarDiagramPatch,
  StarDiagramTransaction,
  starInvertPatches,
} from './diagram-history';

export type StarDiagramNodePatch = StarDiagramPatch<StarDiagramNode>;
export type StarDiagramEdgePatch = StarDiagramPatch<StarDiagramEdge>;

/** Why the diagram emits a change. `revert` undoes edge patches of a canceled node change. */
export type StarDiagramChangeReason =
  'move' | 'resize' | 'connect' | 'delete' | 'label' | 'layout' | 'undo' | 'redo' | 'revert';

/**
 * Payload of `nodesPatch` and `edgesPatch`: patches to apply to your list, for example with
 * `starApplyPatches`. Call `cancel()` to refuse them; the diagram then does not record them.
 * The outputs do not end in `Change` because they carry patches, not the new arrays, so
 * `[(nodes)]` two-way binding is not available.
 */
export interface StarDiagramChange<P> {
  readonly patches: readonly P[];
  readonly reason: StarDiagramChangeReason;
  cancel(): void;
  readonly canceled: boolean;
}

/** Context of `ng-template[starDiagramNode]`. */
export interface StarDiagramNodeContext {
  readonly $implicit: StarDiagramNode;
  readonly selected: boolean;
}

/**
 * Custom node content: `<ng-template starDiagramNode let-node>…</ng-template>`. It renders in an
 * SVG `foreignObject` in the browser; the server renders the plain label, and an export shows the
 * plain label too.
 */
@Directive({ selector: 'ng-template[starDiagramNode]' })
export class StarDiagramNodeTemplate {
  readonly template = inject<TemplateRef<StarDiagramNodeContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: StarDiagramNodeTemplate,
    _context: unknown,
  ): _context is StarDiagramNodeContext {
    return true;
  }
}

type Drag =
  | {
      readonly kind: 'move';
      readonly start: StarDiagramPoint;
      readonly ids: readonly string[];
      readonly dx: number;
      readonly dy: number;
    }
  | {
      readonly kind: 'resize';
      readonly id: string;
      readonly handle: StarDiagramHandle;
      readonly start: StarDiagramPoint;
      readonly rect: StarDiagramRect;
      readonly current: StarDiagramRect;
    }
  | {
      readonly kind: 'connect';
      readonly from: string;
      readonly port: StarDiagramPort;
      readonly current: StarDiagramPoint;
      readonly target: string | null;
    }
  | {
      readonly kind: 'marquee';
      readonly start: StarDiagramPoint;
      readonly current: StarDiagramPoint;
      readonly base: readonly string[];
    }
  | {
      readonly kind: 'pan';
      readonly client: StarDiagramPoint;
      readonly view: StarDiagramPoint;
    };

const HANDLES: readonly StarDiagramHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const ARROWS: Record<string, StarDiagramDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

function emitChange<P>(
  emitter: OutputEmitterRef<StarDiagramChange<P>>,
  patches: readonly P[],
  reason: StarDiagramChangeReason,
): boolean {
  let canceled = false;
  emitter.emit({
    patches,
    reason,
    cancel: () => {
      canceled = true;
    },
    get canceled() {
      return canceled;
    },
  });
  return !canceled;
}

/**
 * Diagram (Syncfusion `ejs-diagram`, DevExtreme `dxDiagram`; Kendo `Diagram`): nodes and
 * connections on an SVG canvas.
 *
 * - Select with a click, Shift+click or a marquee; drag nodes (snapped to `gridSize`); resize with
 *   the handles; drag from a port to another node to connect; Delete removes.
 * - Pan with Space and drag or the middle mouse button; zoom with Control and the wheel, the
 *   buttons or the `zoom` model; fit to the content.
 * - Contract: the diagram never changes `nodes` or `edges`: it emits patches in `nodesPatch`
 *   and `edgesPatch` (not `nodesChange`, so there is no `[(nodes)]` two-way binding). Apply them
 *   (`starApplyPatches`) or call `cancel()`.
 * - Undo and redo: the diagram records every change that no handler canceled, on the contract
 *   that the owner applied it. `undo()` (Control+Z) and `redo()` (Control+Y) emit the inverse or
 *   the same patches again, with the reason `undo` or `redo`.
 * - Keyboard: the nodes are a listbox with one tab stop. Arrow keys go to the nearest node,
 *   Alt+Arrow moves, Shift+Alt+Arrow resizes, Enter edits the label, Control+A selects all.
 *
 * `<star-diagram [nodes]="nodes()" [edges]="edges()" (nodesPatch)="nodes.set(starApplyPatches(nodes(), $event.patches))" />`
 */
@Component({
  selector: 'star-diagram',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-diagram-host',
    '(pointerdown)': 'onPointerDown($event)',
    '(pointerover)': 'onPointerOver($event)',
    '(dblclick)': 'onDoubleClick($event)',
    '(wheel)': 'onWheel($event)',
    '(keydown)': 'onKeydown($event)',
    '(keyup)': 'onKeyup($event)',
    '(focusin)': 'onFocusIn($event)',
    '(focusout)': 'onFocusOut($event)',
  },
  template: `
    <div class="star-diagram" [style.--star-diagram-height]="height()">
      <div
        class="star-diagram__toolbar"
        role="toolbar"
        [attr.aria-label]="ariaLabel() ?? text.diagram"
      >
        <button
          type="button"
          class="star-diagram__tool"
          [attr.aria-label]="text.zoomOut"
          (click)="zoomOut()"
        >
          <i class="ph-bold ph-magnifying-glass-minus" aria-hidden="true"></i>
        </button>
        <output class="star-diagram__zoom" aria-live="off">{{ percent() }}%</output>
        <button
          type="button"
          class="star-diagram__tool"
          [attr.aria-label]="text.zoomIn"
          (click)="zoomIn()"
        >
          <i class="ph-bold ph-magnifying-glass-plus" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="star-diagram__tool"
          [attr.aria-label]="text.zoomToFit"
          (click)="fitToContent()"
        >
          <i class="ph-bold ph-arrows-in" aria-hidden="true"></i>
        </button>
        @if (!readonly()) {
          <button
            type="button"
            class="star-diagram__tool"
            [attr.aria-label]="text.undo"
            [attr.aria-disabled]="!canUndo() || null"
            (click)="undo()"
          >
            <i class="ph-bold ph-arrow-counter-clockwise" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            class="star-diagram__tool"
            [attr.aria-label]="text.redo"
            [attr.aria-disabled]="!canRedo() || null"
            (click)="redo()"
          >
            <i class="ph-bold ph-arrow-clockwise" aria-hidden="true"></i>
          </button>
        }
      </div>

      <div
        #canvas
        class="star-diagram__canvas"
        dir="ltr"
        [class.star-diagram__canvas--pan]="panReady()"
        [attr.role]="focused() ? 'application' : null"
        [attr.aria-label]="focused() ? (ariaLabel() ?? text.diagram) : null"
        [attr.aria-describedby]="id + '-hint'"
        [attr.tabindex]="nodes().length ? -1 : 0"
      >
        <svg #svg class="star-diagram__svg" width="100%" height="100%">
          <defs>
            <marker
              [id]="id + '-arrow'"
              class="star-diagram__arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 Z" />
            </marker>
            <pattern
              [id]="id + '-grid'"
              patternUnits="userSpaceOnUse"
              [attr.width]="gridStep()"
              [attr.height]="gridStep()"
              [attr.x]="view().x"
              [attr.y]="view().y"
            >
              <circle class="star-diagram__dot" cx="1" cy="1" r="1" />
            </pattern>
          </defs>
          @if (showGrid() && gridSize() > 0) {
            <rect
              class="star-diagram__grid"
              width="100%"
              height="100%"
              data-export="skip"
              [attr.fill]="'url(#' + id + '-grid)'"
            />
          }
          <g class="star-diagram__content" [attr.transform]="transform()">
            <g class="star-diagram__edges" aria-hidden="true">
              @for (edge of edgeViews(); track edge.id) {
                <g
                  class="star-diagram__edge"
                  [class.star-diagram__edge--selected]="selectedEdge() === edge.id"
                  [attr.data-edge-id]="edge.id"
                >
                  <path class="star-diagram__edge-hit" data-export="skip" [attr.d]="edge.d" />
                  <path
                    class="star-diagram__edge-line"
                    [attr.d]="edge.d"
                    [attr.marker-end]="edge.end"
                    [attr.marker-start]="edge.start"
                  />
                  @if (edge.label) {
                    <text
                      class="star-diagram__edge-label"
                      text-anchor="middle"
                      [attr.x]="edge.mid.x"
                      [attr.y]="edge.mid.y - 6"
                    >
                      {{ edge.label }}
                    </text>
                  }
                </g>
              }
              @if (connectLine(); as line) {
                <path
                  class="star-diagram__edge-line star-diagram__edge-line--draft"
                  data-export="skip"
                  [attr.d]="line"
                />
              }
            </g>
            <g
              class="star-diagram__nodes"
              role="listbox"
              aria-multiselectable="true"
              [attr.aria-label]="text.diagramNodes"
            >
              @for (node of nodeViews(); track node.id) {
                <g
                  class="star-diagram__node"
                  role="option"
                  [class.star-diagram__node--selected]="isSelected(node.id)"
                  [class.star-diagram__node--target]="connectTarget() === node.id"
                  [attr.data-node-id]="node.id"
                  [attr.aria-selected]="isSelected(node.id)"
                  [attr.tabindex]="focusStop() === node.id ? 0 : -1"
                >
                  <path class="star-diagram__shape" [attr.d]="shapeOf(node)" />
                  <text
                    class="star-diagram__label"
                    text-anchor="middle"
                    dominant-baseline="central"
                    [class.star-diagram__label--hidden]="!!customNode()"
                    [attr.x]="node.x + node.width / 2"
                    [attr.y]="node.y + node.height / 2"
                  >
                    {{ node.label }}
                  </text>
                  @if (customNode(); as template) {
                    <foreignObject
                      data-export="skip"
                      [attr.x]="node.x"
                      [attr.y]="node.y"
                      [attr.width]="node.width"
                      [attr.height]="node.height"
                    >
                      <div class="star-diagram__custom">
                        <ng-container
                          *ngTemplateOutlet="
                            template;
                            context: { $implicit: node, selected: isSelected(node.id) }
                          "
                        />
                      </div>
                    </foreignObject>
                  }
                </g>
              }
            </g>
            @if (!readonly()) {
              <g class="star-diagram__handles" aria-hidden="true" data-export="skip">
                @for (port of portViews(); track port.key) {
                  <circle
                    class="star-diagram__port"
                    [attr.data-port]="port.port.id"
                    [attr.data-port-node]="port.node"
                    [attr.cx]="port.point.x"
                    [attr.cy]="port.point.y"
                    [attr.r]="5 / zoom()"
                  />
                }
                @for (handle of handleViews(); track handle.handle) {
                  <rect
                    class="star-diagram__handle"
                    [class]="'star-diagram__handle star-diagram__handle--' + handle.handle"
                    [attr.data-handle]="handle.handle"
                    [attr.x]="handle.x"
                    [attr.y]="handle.y"
                    [attr.width]="handle.size"
                    [attr.height]="handle.size"
                  />
                }
              </g>
            }
            @if (marqueeRect(); as box) {
              <rect
                class="star-diagram__marquee"
                data-export="skip"
                [attr.x]="box.x"
                [attr.y]="box.y"
                [attr.width]="box.width"
                [attr.height]="box.height"
              />
            }
          </g>
        </svg>
        @if (editing(); as edit) {
          <input
            class="star-input star-diagram__editor"
            [attr.aria-label]="text.diagramEditLabel"
            [value]="edit.label"
            [style.left.px]="edit.left"
            [style.top.px]="edit.top"
            [style.width.px]="edit.width"
            (keydown)="onEditorKey($event)"
            (blur)="commitLabel($any($event.target).value)"
          />
        }
      </div>
      <p class="star-sr-only" [id]="id + '-hint'">{{ text.diagramHint }}</p>
      <div class="star-sr-only">
        <p [id]="id + '-nodes'">{{ text.diagramNodes }}</p>
        <ul [attr.aria-labelledby]="id + '-nodes'">
          @for (node of nodes(); track node.id) {
            <li>{{ node.label }}</li>
          }
        </ul>
        <p [id]="id + '-edges'">{{ text.diagramConnections }}</p>
        <ul [attr.aria-labelledby]="id + '-edges'">
          @for (edge of edgeList(); track edge.id) {
            <li>{{ edge.text }}</li>
          }
        </ul>
      </div>
    </div>
  `,
})
export class StarDiagram {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly announcer = inject(StarAnnouncer);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly id = inject(_IdGenerator).getId('star-diagram-');

  readonly nodes = input<readonly StarDiagramNode[]>([]);
  readonly edges = input<readonly StarDiagramEdge[]>([]);
  /** Ids of the selected nodes. */
  readonly selection = model<readonly string[]>([]);
  /** Zoom factor: 1 is 100 %. */
  readonly zoom = model(1);
  readonly minZoom = input(0.25, { transform: numberAttribute });
  readonly maxZoom = input(4, { transform: numberAttribute });
  /** Grid of the snap and of the keyboard moves, in diagram units. 0: no snap. */
  readonly gridSize = input(20, { transform: numberAttribute });
  readonly showGrid = input(true, { transform: booleanAttribute });
  /** Routing of the connections that the user draws. */
  readonly connectorRouting = input<'straight' | 'orthogonal'>('orthogonal');
  /** No changes: select, pan and zoom only. */
  readonly readonly = input(false, { transform: booleanAttribute });
  /** Fits the content into the canvas after the first render (browser only). */
  readonly fitContent = input(false, { transform: booleanAttribute });
  /**
   * Identity of the document that `nodes` and `edges` show, for example its id. When it changes,
   * the undo history is cleared, so that no patch of the old document applies to the new one.
   * Without it, call `clearHistory()` after you load another document.
   */
  readonly documentKey = input<unknown>(undefined);
  /** Height of the canvas (a CSS length). */
  readonly height = input('24rem');
  readonly ariaLabel = input<string | null>(null);

  /** Node patches: moves, resizes, labels, deletes, layouts, undo and redo. */
  readonly nodesPatch = output<StarDiagramChange<StarDiagramNodePatch>>();
  /** Edge patches: new connections, deletes, undo and redo. */
  readonly edgesPatch = output<StarDiagramChange<StarDiagramEdgePatch>>();

  protected readonly customNode = computed(() =>
    this.ready() ? (this.nodeTemplate()?.template ?? null) : null,
  );
  private readonly nodeTemplate = contentChild(StarDiagramNodeTemplate);
  private readonly canvas = viewChild<ElementRef<HTMLElement>>('canvas');
  private readonly svg = viewChild<ElementRef<SVGSVGElement>>('svg');

  /** Pan offset of the content, in canvas pixels. */
  protected readonly view = signal<StarDiagramPoint>({ x: 0, y: 0 });
  private readonly size = signal({ width: 800, height: 400 });
  private readonly ready = signal(false);
  protected readonly focused = signal(false);
  protected readonly selectedEdge = signal<string | null>(null);
  private readonly focusId = signal<string | null>(null);
  private readonly hoverId = signal<string | null>(null);
  private readonly drag = signal<Drag | null>(null);
  private readonly space = signal(false);
  protected readonly editing = signal<{
    id: string;
    label: string;
    left: number;
    top: number;
    width: number;
  } | null>(null);
  private readonly history = new StarDiagramHistory<StarDiagramNode, StarDiagramEdge>();
  private readonly historyVersion = signal(0);
  /** Removes the document listeners of the drag in progress. */
  private endDrag: (() => void) | null = null;
  private edgeCount = 0;

  /** True when `undo()` has a change to revert. */
  readonly canUndo = computed(() => (this.historyVersion(), this.history.canUndo()));
  /** True when `redo()` has a change to apply again. */
  readonly canRedo = computed(() => (this.historyVersion(), this.history.canRedo()));

  protected readonly percent = computed(() => Math.round(this.zoom() * 100));
  protected readonly gridStep = computed(() => Math.max(1, this.gridSize() * this.zoom()));
  protected readonly transform = computed(
    () => `translate(${this.view().x} ${this.view().y}) scale(${this.zoom()})`,
  );
  protected readonly panReady = computed(() => this.space() || this.drag()?.kind === 'pan');

  /** The nodes as drawn now: during a drag, at their preview position and size. */
  protected readonly nodeViews = computed<readonly StarDiagramNode[]>(() => {
    const drag = this.drag();
    const nodes = this.nodes();
    if (drag?.kind === 'move') {
      const ids = new Set(drag.ids);
      const grid = this.gridSize();
      return nodes.map((n) =>
        ids.has(n.id)
          ? { ...n, x: starSnap(n.x + drag.dx, grid), y: starSnap(n.y + drag.dy, grid) }
          : n,
      );
    }
    if (drag?.kind === 'resize') {
      return nodes.map((n) => (n.id === drag.id ? { ...n, ...drag.current } : n));
    }
    return nodes;
  });

  protected readonly edgeViews = computed(() => {
    const nodes = this.nodeViews();
    const marker = `url(#${this.id}-arrow)`;
    return this.edges().map((edge) => {
      const points = starEdgePoints(edge, nodes);
      const arrow = edge.arrow ?? 'end';
      return {
        id: edge.id,
        label: edge.label ?? '',
        d: starPathData(points),
        mid: starPathMidpoint(points),
        end: arrow === 'none' ? null : marker,
        start: arrow === 'both' ? marker : null,
      };
    });
  });

  protected readonly edgeList = computed(() => {
    const labels = new Map(this.nodes().map((n) => [n.id, n.label]));
    return this.edges().map((edge) => ({
      id: edge.id,
      text:
        this.text.diagramConnection(
          labels.get(edge.from) ?? edge.from,
          labels.get(edge.to) ?? edge.to,
        ) + (edge.label ? ` (${edge.label})` : ''),
    }));
  });

  protected readonly focusStop = computed(() => {
    const id = this.focusId();
    const nodes = this.nodes();
    return id && nodes.some((n) => n.id === id) ? id : (nodes[0]?.id ?? null);
  });

  protected readonly portViews = computed(() => {
    const drag = this.drag();
    if (drag && drag.kind !== 'connect') return [];
    const show = new Set([...this.selection(), ...(this.hoverId() ? [this.hoverId()!] : [])]);
    if (drag?.kind === 'connect') show.add(drag.from);
    return this.nodeViews()
      .filter((n) => show.has(n.id))
      .flatMap((n) =>
        starPortsOf(n).map((port) => ({
          key: `${n.id}:${port.id}`,
          node: n.id,
          port,
          point: starPortPoint(n, port),
        })),
      );
  });

  protected readonly handleViews = computed(() => {
    const ids = this.selection();
    if (ids.length !== 1 || this.drag()?.kind === 'move') return [];
    const node = this.nodeViews().find((n) => n.id === ids[0]);
    if (!node) return [];
    const size = 8 / this.zoom();
    const xs = { w: node.x, c: node.x + node.width / 2, e: node.x + node.width };
    const ys = { n: node.y, c: node.y + node.height / 2, s: node.y + node.height };
    return HANDLES.map((handle) => {
      const x = handle.includes('w') ? xs.w : handle.includes('e') ? xs.e : xs.c;
      const y = handle.includes('n') ? ys.n : handle.includes('s') ? ys.s : ys.c;
      return { handle, x: x - size / 2, y: y - size / 2, size };
    });
  });

  protected readonly connectLine = computed(() => {
    const drag = this.drag();
    if (drag?.kind !== 'connect') return null;
    const from = this.nodes().find((n) => n.id === drag.from);
    return from ? starPathData([starPortPoint(from, drag.port), drag.current]) : null;
  });
  protected readonly connectTarget = computed(() => {
    const drag = this.drag();
    return drag?.kind === 'connect' ? drag.target : null;
  });

  protected readonly marqueeRect = computed(() => {
    const drag = this.drag();
    if (drag?.kind !== 'marquee') return null;
    return starNormaliseRect({
      x: drag.start.x,
      y: drag.start.y,
      width: drag.current.x - drag.start.x,
      height: drag.current.y - drag.start.y,
    });
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.endDrag?.());
    // A zoom from outside (the model) stays within minZoom and maxZoom.
    effect(() => {
      const zoom = this.zoom();
      const next = Math.min(this.maxZoom(), Math.max(this.minZoom(), zoom));
      if (next !== zoom) untracked(() => this.zoom.set(next));
    });
    // Another document: the recorded patches belong to the old one.
    let lastKey: unknown = undefined;
    let first = true;
    effect(() => {
      const key = this.documentKey();
      if (!first && key !== lastKey) untracked(() => this.clearHistory());
      first = false;
      lastKey = key;
    });
    if (!this.browser) return;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.ready.set(true);
      const canvas = this.canvas()?.nativeElement;
      const view = this.doc.defaultView;
      if (canvas) this.measure(canvas);
      const observer =
        canvas && view && typeof view.ResizeObserver === 'function'
          ? new view.ResizeObserver(() => this.measure(canvas))
          : null;
      if (canvas) observer?.observe(canvas);
      destroyRef.onDestroy(() => observer?.disconnect());
      if (this.fitContent()) this.fitToContent();
    });
  }

  private measure(canvas: HTMLElement): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width && height) this.size.set({ width, height });
  }

  protected shapeOf(node: StarDiagramNode): string {
    return starShapePath(node);
  }

  protected isSelected(id: string): boolean {
    return this.selection().includes(id);
  }

  private label(id: string): string {
    return this.nodes().find((n) => n.id === id)?.label ?? id;
  }

  private announce(message: string): void {
    void this.announcer.announce(message);
  }

  // ---------------------------------------------------------------- view

  /** Zooms in one step around the middle of the canvas. */
  zoomIn(): void {
    this.zoomTo(this.zoom() * 1.25);
  }

  /** Zooms out one step around the middle of the canvas. */
  zoomOut(): void {
    this.zoomTo(this.zoom() / 1.25);
  }

  private zoomTo(zoom: number, at?: StarDiagramPoint): void {
    const point = at ?? { x: this.size().width / 2, y: this.size().height / 2 };
    const next = starZoomAt(
      { zoom: this.zoom(), ...this.view() },
      zoom,
      point,
      this.minZoom(),
      this.maxZoom(),
    );
    this.zoom.set(next.zoom);
    this.view.set({ x: next.x, y: next.y });
  }

  /** Zooms and pans so that every node shows. */
  fitToContent(): void {
    const bounds = starContentBounds(this.nodes());
    if (!bounds) return;
    const next = starFitView(bounds, this.size(), 24, this.minZoom(), Math.min(1, this.maxZoom()));
    this.zoom.set(next.zoom);
    this.view.set({ x: next.x, y: next.y });
  }

  /** A canvas pixel position as a diagram point. */
  private toDiagram(event: { clientX: number; clientY: number }): StarDiagramPoint {
    const rect = this.canvas()?.nativeElement.getBoundingClientRect();
    const view = this.view();
    const zoom = this.zoom();
    return {
      x: (event.clientX - (rect?.left ?? 0) - view.x) / zoom,
      y: (event.clientY - (rect?.top ?? 0) - view.y) / zoom,
    };
  }

  // ---------------------------------------------------------------- changes

  /** Emits a transaction (edges first) and records it. `false` when a handler canceled it. */
  private commit(
    tx: StarDiagramTransaction<StarDiagramNode, StarDiagramEdge>,
    reason: StarDiagramChangeReason,
    record = true,
  ): boolean {
    if (!tx.nodes.length && !tx.edges.length) return false;
    // Edges need their nodes: nodes that come (back) go first, edges of nodes that go go first.
    const nodesFirst = tx.nodes.some((patch) => patch.type === 'add');
    const steps = [
      { emitter: this.edgesPatch, patches: tx.edges },
      { emitter: this.nodesPatch, patches: tx.nodes },
    ] as const;
    const [first, second] = nodesFirst ? [steps[1], steps[0]] : [steps[0], steps[1]];
    const emit = (
      step: (typeof steps)[number],
      patches: readonly unknown[],
      why: StarDiagramChangeReason,
    ) => emitChange(step.emitter as OutputEmitterRef<StarDiagramChange<unknown>>, patches, why);
    if (first.patches.length && !emit(first, first.patches, reason)) return false;
    if (second.patches.length && !emit(second, second.patches, reason)) {
      if (first.patches.length) {
        emit(
          first,
          starInvertPatches(first.patches as readonly StarDiagramPatch<{ id: string }>[]),
          'revert',
        );
      }
      return false;
    }
    if (record) {
      this.history.push(tx);
      this.historyVersion.update((v) => v + 1);
    }
    return true;
  }

  /**
   * Forgets every recorded change: `undo()` and `redo()` have nothing to do afterwards. Call it
   * when you replace `nodes` and `edges` with another document (or set `documentKey`), or after
   * you change them outside the diagram in a way that the recorded patches do not know.
   */
  clearHistory(): void {
    this.history.clear();
    this.historyVersion.update((v) => v + 1);
  }

  /** Emits the inverse of the last recorded change. */
  undo(): boolean {
    const tx = this.history.peekUndo();
    if (!tx || this.readonly()) return false;
    const inverse = { nodes: starInvertPatches(tx.nodes), edges: starInvertPatches(tx.edges) };
    if (!this.commit(inverse, 'undo', false)) return false;
    this.history.commitUndo();
    this.historyVersion.update((v) => v + 1);
    this.announce(this.text.editUndone);
    return true;
  }

  /** Emits the last undone change again. */
  redo(): boolean {
    const tx = this.history.peekRedo();
    if (!tx || this.readonly()) return false;
    if (!this.commit(tx, 'redo', false)) return false;
    this.history.commitRedo();
    this.historyVersion.update((v) => v + 1);
    this.announce(this.text.editRedone);
    return true;
  }

  /** Moves the nodes to the positions of `next` (for example a `starLayoutTree` result), undoable. */
  applyLayout(next: readonly StarDiagramNode[]): boolean {
    const byId = new Map(this.nodes().map((n) => [n.id, n]));
    const patches: StarDiagramNodePatch[] = [];
    for (const n of next) {
      const old = byId.get(n.id);
      if (old && (old.x !== n.x || old.y !== n.y)) {
        patches.push({
          type: 'update',
          id: n.id,
          before: { x: old.x, y: old.y },
          after: { x: n.x, y: n.y },
        });
      }
    }
    return this.commit({ nodes: patches, edges: [] }, 'layout');
  }

  private moveBy(ids: readonly string[], dx: number, dy: number, reason: 'move' = 'move'): boolean {
    const grid = this.gridSize();
    const set = new Set(ids);
    const patches: StarDiagramNodePatch[] = [];
    for (const n of this.nodes()) {
      if (!set.has(n.id)) continue;
      const x = starSnap(n.x + dx, grid);
      const y = starSnap(n.y + dy, grid);
      if (x !== n.x || y !== n.y) {
        patches.push({ type: 'update', id: n.id, before: { x: n.x, y: n.y }, after: { x, y } });
      }
    }
    return this.commit({ nodes: patches, edges: [] }, reason);
  }

  /** Resizes one or more nodes as one undoable change. */
  private resize(rects: ReadonlyMap<string, StarDiagramRect>): boolean {
    const patches: StarDiagramNodePatch[] = [];
    for (const n of this.nodes()) {
      const rect = rects.get(n.id);
      if (
        !rect ||
        (n.x === rect.x && n.y === rect.y && n.width === rect.width && n.height === rect.height)
      ) {
        continue;
      }
      patches.push({
        type: 'update',
        id: n.id,
        before: { x: n.x, y: n.y, width: n.width, height: n.height },
        after: { ...rect },
      });
    }
    return this.commit({ nodes: patches, edges: [] }, 'resize');
  }

  /** Removes the selected nodes with their connections, or the selected connection. */
  deleteSelection(): boolean {
    if (this.readonly()) return false;
    const ids = new Set(this.selection());
    const edgeId = this.selectedEdge();
    const nodes = this.nodes().filter((n) => ids.has(n.id));
    const edges = this.edges().filter(
      (e) => ids.has(e.from) || ids.has(e.to) || (!nodes.length && e.id === edgeId),
    );
    const done = this.commit(
      {
        nodes: nodes.map((item) => ({ type: 'remove', item })),
        edges: edges.map((item) => ({ type: 'remove', item })),
      },
      'delete',
    );
    if (done) {
      this.selection.set([]);
      this.selectedEdge.set(null);
      this.announce(this.text.diagramDeleted(nodes.length || edges.length));
    }
    return done;
  }

  /** Selects every node. */
  selectAll(): void {
    this.selection.set(this.nodes().map((n) => n.id));
  }

  private connect(from: string, port: StarDiagramPort, to: string, at: StarDiagramPoint): boolean {
    const target = this.nodes().find((n) => n.id === to);
    if (!target) return false;
    const ports = starPortsOf(target);
    const toPort = ports.reduce((best, p) => {
      const a = starPortPoint(target, p);
      const b = starPortPoint(target, best);
      return Math.hypot(a.x - at.x, a.y - at.y) < Math.hypot(b.x - at.x, b.y - at.y) ? p : best;
    }, ports[0]);
    const ids = new Set(this.edges().map((e) => e.id));
    let id = `${from}-${to}`;
    while (ids.has(id)) id = `${from}-${to}-${++this.edgeCount}`;
    const edge: StarDiagramEdge = {
      id,
      from,
      to,
      fromPort: port.id,
      toPort: toPort.id,
      routing: this.connectorRouting(),
    };
    const done = this.commit({ nodes: [], edges: [{ type: 'add', item: edge }] }, 'connect');
    if (done) this.announce(this.text.diagramConnected(this.label(from), this.label(to)));
    return done;
  }

  // ---------------------------------------------------------------- pointer

  protected onPointerOver(event: PointerEvent): void {
    const id = (event.target as Element).closest?.('[data-node-id]')?.getAttribute('data-node-id');
    if (id !== undefined && id !== this.hoverId()) this.hoverId.set(id ?? null);
  }

  protected onPointerDown(event: PointerEvent): void {
    const canvas = this.canvas()?.nativeElement;
    const target = event.target as Element;
    if (!canvas?.contains(target) || target.closest('.star-diagram__editor')) return;
    const point = this.toDiagram(event);
    if (event.button === 1 || (event.button === 0 && this.space())) {
      event.preventDefault();
      this.start(
        {
          kind: 'pan',
          client: { x: event.clientX, y: event.clientY },
          view: this.view(),
        },
        event,
      );
      return;
    }
    if (event.button !== 0) return;
    const handle = target
      .closest('[data-handle]')
      ?.getAttribute('data-handle') as StarDiagramHandle | null;
    const nodeId = this.selection()[0];
    const node = this.nodes().find((n) => n.id === nodeId);
    if (handle && node && !this.readonly()) {
      event.preventDefault();
      this.start(
        { kind: 'resize', id: node.id, handle, start: point, rect: node, current: node },
        event,
      );
      return;
    }
    const portEl = target.closest('[data-port]');
    if (portEl && !this.readonly()) {
      const from = portEl.getAttribute('data-port-node')!;
      const fromNode = this.nodes().find((n) => n.id === from);
      const port =
        fromNode && starPortsOf(fromNode).find((p) => p.id === portEl.getAttribute('data-port'));
      if (port) {
        event.preventDefault();
        this.start({ kind: 'connect', from, port, current: point, target: null }, event);
        return;
      }
    }
    const id = target.closest('[data-node-id]')?.getAttribute('data-node-id');
    if (id) {
      this.selectedEdge.set(null);
      this.focusId.set(id);
      if (event.shiftKey) {
        this.selection.update((ids) =>
          ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
        );
      } else if (!this.isSelected(id)) {
        this.selection.set([id]);
      }
      if (!this.readonly() && this.isSelected(id)) {
        this.start({ kind: 'move', start: point, ids: this.selection(), dx: 0, dy: 0 }, event);
      }
      return;
    }
    const edgeId = target.closest('[data-edge-id]')?.getAttribute('data-edge-id');
    if (edgeId) {
      this.selection.set([]);
      this.selectedEdge.set(edgeId);
      return;
    }
    this.selectedEdge.set(null);
    this.start(
      {
        kind: 'marquee',
        start: point,
        current: point,
        base: event.shiftKey ? this.selection() : [],
      },
      event,
    );
    if (!event.shiftKey) this.selection.set([]);
  }

  private start(drag: Drag, event: PointerEvent): void {
    this.endDrag?.();
    this.drag.set(drag);
    // Pointer capture keeps the moves coming when the pointer leaves the canvas or the window.
    // Not for a node move: capture retargets pointerup and dblclick to the canvas, and the
    // double click that edits a label must still reach the node.
    if (drag.kind !== 'move' && drag.kind !== 'marquee') {
      const canvas = this.canvas()?.nativeElement;
      try {
        canvas?.setPointerCapture?.(event.pointerId);
      } catch {
        // A synthetic event without an active pointer: the document listeners still work.
      }
    }
    const move = (e: PointerEvent) => this.onPointerMove(e);
    const end = () => {
      this.doc.removeEventListener('pointermove', move);
      this.doc.removeEventListener('pointerup', up);
      this.doc.removeEventListener('pointercancel', up);
      this.endDrag = null;
    };
    const up = (e: PointerEvent) => {
      end();
      this.onPointerUp(e);
    };
    this.endDrag = end;
    this.doc.addEventListener('pointermove', move);
    this.doc.addEventListener('pointerup', up);
    this.doc.addEventListener('pointercancel', up);
  }

  private onPointerMove(event: PointerEvent): void {
    const drag = this.drag();
    if (!drag) return;
    const point = this.toDiagram(event);
    switch (drag.kind) {
      case 'move':
        this.drag.set({ ...drag, dx: point.x - drag.start.x, dy: point.y - drag.start.y });
        break;
      case 'resize':
        this.drag.set({
          ...drag,
          current: starResizeRect(
            drag.rect,
            drag.handle,
            point.x - drag.start.x,
            point.y - drag.start.y,
            this.gridSize(),
          ),
        });
        break;
      case 'connect': {
        const over = starNodeAt(this.nodes(), point);
        this.drag.set({
          ...drag,
          current: point,
          target: over && over !== drag.from ? over : null,
        });
        break;
      }
      case 'marquee':
        this.drag.set({ ...drag, current: point });
        break;
      case 'pan':
        this.view.set({
          x: drag.view.x + event.clientX - drag.client.x,
          y: drag.view.y + event.clientY - drag.client.y,
        });
        break;
    }
  }

  private onPointerUp(event: PointerEvent): void {
    const drag = this.drag();
    if (drag) this.onPointerMove(event);
    const last = this.drag();
    this.drag.set(null);
    if (!last) return;
    if (last.kind === 'move' && (last.dx || last.dy)) this.moveBy(last.ids, last.dx, last.dy);
    else if (last.kind === 'resize') this.resize(new Map([[last.id, last.current]]));
    else if (last.kind === 'connect' && last.target)
      this.connect(last.from, last.port, last.target, last.current);
    else if (last.kind === 'marquee') {
      const box = this.marqueeOf(last);
      const inside = box.width || box.height ? starNodesInRect(this.nodes(), box) : [];
      this.selection.set([...new Set([...last.base, ...inside])]);
    }
  }

  private marqueeOf(drag: Extract<Drag, { kind: 'marquee' }>): StarDiagramRect {
    return starNormaliseRect({
      x: drag.start.x,
      y: drag.start.y,
      width: drag.current.x - drag.start.x,
      height: drag.current.y - drag.start.y,
    });
  }

  protected onWheel(event: WheelEvent): void {
    if (
      !(event.ctrlKey || event.metaKey) ||
      !this.canvas()?.nativeElement.contains(event.target as Node)
    )
      return;
    event.preventDefault();
    const rect = this.canvas()!.nativeElement.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    this.zoomTo(this.zoom() * factor, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  protected onDoubleClick(event: MouseEvent): void {
    const id = (event.target as Element).closest('[data-node-id]')?.getAttribute('data-node-id');
    if (id) this.editLabel(id);
  }

  // ---------------------------------------------------------------- keyboard and focus

  protected onFocusIn(event: FocusEvent): void {
    if (!this.canvas()?.nativeElement.contains(event.target as Node)) return;
    this.focused.set(true);
    const id = (event.target as Element).closest?.('[data-node-id]')?.getAttribute('data-node-id');
    if (id) this.focusId.set(id);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.canvas()?.nativeElement.contains(next)) {
      this.focused.set(false);
      this.space.set(false);
    }
  }

  protected onKeyup(event: KeyboardEvent): void {
    if (event.key === ' ') this.space.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (!this.canvas()?.nativeElement.contains(target) || target.closest('.star-diagram__editor'))
      return;
    const id = target.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const direction = ARROWS[event.key];

    if (ctrl && key === 'z' && !event.shiftKey) return this.handled(event, () => this.undo());
    if (ctrl && (key === 'y' || (key === 'z' && event.shiftKey))) {
      return this.handled(event, () => this.redo());
    }
    if (ctrl && key === 'a') return this.handled(event, () => this.selectAll());
    if (key === 'Delete' || key === 'Backspace')
      return this.handled(event, () => this.deleteSelection());
    if (key === 'Escape') {
      return this.handled(event, () => {
        this.drag.set(null);
        this.selection.set([]);
        this.selectedEdge.set(null);
      });
    }
    if (key === ' ') {
      event.preventDefault();
      this.space.set(true);
      if (id && !event.repeat) {
        this.selection.set(
          ctrl && this.isSelected(id)
            ? this.selection().filter((x) => x !== id)
            : ctrl
              ? [...this.selection(), id]
              : [id],
        );
      }
      return;
    }
    if (key === 'Enter' && id) return this.handled(event, () => this.editLabel(id));
    if (!direction) return;
    event.preventDefault();
    const step = this.gridSize() || 1;
    const dx = direction === 'left' ? -step : direction === 'right' ? step : 0;
    const dy = direction === 'up' ? -step : direction === 'down' ? step : 0;
    const ids = this.selection().length ? this.selection() : id ? [id] : [];
    if (event.altKey && !this.readonly() && ids.length) {
      if (event.shiftKey) {
        const handle: StarDiagramHandle = dx ? 'e' : 's';
        const set = new Set(ids);
        const resized = this.nodes().filter((node) => set.has(node.id));
        const rects = new Map(
          resized.map((node) => [node.id, starResizeRect(node, handle, dx, dy, step)] as const),
        );
        if (this.resize(rects)) {
          const n = resized[0];
          const rect = rects.get(n.id)!;
          this.announce(this.text.diagramNodeResized(n.label, rect.width, rect.height));
        }
      } else if (this.moveBy(ids, dx, dy)) {
        const n = this.nodes().find((node) => node.id === ids[0])!;
        this.announce(
          this.text.diagramNodeMoved(
            n.label,
            starSnap(n.x + dx, this.gridSize()),
            starSnap(n.y + dy, this.gridSize()),
          ),
        );
      }
      return;
    }
    const from = id ?? this.focusStop();
    if (!from) return;
    const next = id ? starNearestNode(this.nodes(), id, direction) : from;
    if (!next) return;
    this.focusNode(next);
    if (event.shiftKey) {
      this.selection.update((sel) => (sel.includes(next) ? sel : [...sel, next]));
    } else if (!ctrl) {
      this.selection.set([next]);
    }
  }

  private handled(event: KeyboardEvent, run: () => unknown): void {
    event.preventDefault();
    run();
  }

  private focusNode(id: string): void {
    this.focusId.set(id);
    this.canvas()
      ?.nativeElement.querySelector<SVGGElement>(`[data-node-id="${CSS.escape(id)}"]`)
      ?.focus();
  }

  // ---------------------------------------------------------------- label editor

  /** Opens the inline label editor of a node. */
  editLabel(id: string): void {
    const node = this.nodes().find((n) => n.id === id);
    if (!node || this.readonly()) return;
    const zoom = this.zoom();
    const view = this.view();
    this.editing.set({
      id,
      label: node.label,
      left: node.x * zoom + view.x,
      top: (node.y + node.height / 2) * zoom + view.y - 16,
      width: Math.max(80, node.width * zoom),
    });
    if (!this.browser) return;
    afterNextRender(
      () => {
        const field =
          this.host.nativeElement.querySelector<HTMLInputElement>('.star-diagram__editor');
        field?.focus();
        field?.select();
      },
      { injector: this.injector },
    );
  }

  protected onEditorKey(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      this.commitLabel((event.target as HTMLInputElement).value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      const id = this.editing()?.id;
      this.editing.set(null);
      if (id) this.focusNode(id);
    }
  }

  protected commitLabel(value: string): void {
    const edit = this.editing();
    if (!edit) return;
    this.editing.set(null);
    const label = value.trim();
    if (label && label !== edit.label) {
      this.commit(
        {
          nodes: [{ type: 'update', id: edit.id, before: { label: edit.label }, after: { label } }],
          edges: [],
        },
        'label',
      );
    }
    this.focusNode(edit.id);
  }

  // ---------------------------------------------------------------- export

  /**
   * The diagram as a stand-alone SVG document around its content (browser only; `''` on the
   * server). Custom node templates export as their plain labels. Chart.js-like `toBase64Image`
   * is `exportPng()`.
   */
  exportSvg(): string {
    const svg = this.browser ? this.svg()?.nativeElement : null;
    const bounds = starContentBounds(this.nodes());
    if (!svg || !bounds) return '';
    const pad = 16;
    const view = this.doc.defaultView;
    const background = view?.getComputedStyle(
      this.host.nativeElement.querySelector('.star-diagram__canvas')!,
    ).backgroundColor;
    return starChartSvgDocument(svg, {
      title: this.ariaLabel() ?? this.text.diagram,
      background: background || undefined,
      prepare: (copy) => {
        for (const element of copy.querySelectorAll('foreignObject')) element.remove();
        copy
          .querySelector('g[transform]')
          ?.setAttribute('transform', `translate(${pad - bounds.x} ${pad - bounds.y})`);
        copy.setAttribute('viewBox', `0 0 ${bounds.width + 2 * pad} ${bounds.height + 2 * pad}`);
        copy.removeAttribute('width');
        copy.removeAttribute('height');
      },
    });
  }

  /** The diagram as a PNG image, `scale` times its size. `null` on the server or without a canvas. */
  async exportPng(scale = 2): Promise<Blob | null> {
    const document = this.exportSvg();
    const bounds = starContentBounds(this.nodes());
    if (!document || !bounds) return null;
    return starChartPng(this.doc, document, bounds.width + 32, bounds.height + 32, scale);
  }
}
