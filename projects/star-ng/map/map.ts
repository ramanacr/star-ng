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
  isDevMode,
  linkedSignal,
  model,
  numberAttribute,
  output,
  PLATFORM_ID,
  signal,
  TemplateRef,
  untracked,
  viewChild,
} from '@angular/core';
import {
  injectStarControlDefaults,
  STAR_UI_TEXT,
  StarAnnouncer,
  StarPart,
  starPrefersReducedMotion,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  StarGeoJsonFeature,
  StarGeoJsonFeatureCollection,
  StarLonLat,
  StarMapBounds,
  starMapBoundsOf,
  starMapBubbleRadius,
  starMapClasses,
  starMapFit,
  starMapParse,
  starMapPath,
  StarMapPoint,
  StarMapProjection,
  starMapRange,
  starMapReadingOrder,
  StarMapShape,
  StarMapSize,
  starMapTiles,
  starMapTileUrl,
  starMapToScreen,
  starMapToWorld,
  starMapUnion,
  StarMapView,
  starMapZoomAround,
  starProject,
  starUnproject,
} from './map-geo';

/* eslint-disable @typescript-eslint/no-explicit-any -- layer data is owner data of any shape */

/** A layer of GeoJSON shapes: polygons (with holes), lines and points, optionally a choropleth. */
export interface StarMapShapeLayer<P = any> {
  readonly type: 'shape';
  readonly id: string;
  /** Name of the layer in the legend and the data table. Defaults to `id`. */
  readonly title?: string;
  readonly data: StarGeoJsonFeatureCollection<P>;
  /**
   * Key of a feature, for `selection`, the outputs and the focus. Default:
   * `<layer id>:<feature.id>`, else `<layer id>:<index>`, so two layers never share a key.
   */
  readonly key?: (feature: StarGeoJsonFeature<P>, index: number) => string;
  /** Accessible name of a feature. Default: `properties.name`, else the key. */
  readonly label?: (feature: StarGeoJsonFeature<P>) => string;
  /** The value of a feature: the shapes are coloured by value classes (choropleth). */
  readonly value?: (feature: StarGeoJsonFeature<P>) => number | null | undefined;
  /** Colours of the classes, lightest first. Default: steps of the `--star-chart-1` token. */
  readonly colors?: readonly string[];
  /** Number of value classes (equal intervals). Default 5. */
  readonly classes?: number;
  /** Shows the legend of the classes. Default: true when the layer has `value`. */
  readonly legend?: boolean;
  /** Shapes of this layer can be selected (see `selectionMode`). Default true. */
  readonly selectable?: boolean;
}

/** A layer of point markers, drawn with the `ng-template[starMapMarker]` slot or a pin. */
export interface StarMapMarkerLayer<T = any> {
  readonly type: 'marker';
  readonly id: string;
  readonly title?: string;
  readonly data: readonly T[];
  readonly position: (item: T) => StarLonLat;
  readonly label: (item: T) => string;
  /** Key of an item. Default: `<layer id>:<index>`. */
  readonly key?: (item: T, index: number) => string;
  readonly value?: (item: T) => number | null | undefined;
}

/** A layer of circles sized by value (area grows with the value). */
export interface StarMapBubbleLayer<T = any> {
  readonly type: 'bubble';
  readonly id: string;
  readonly title?: string;
  readonly data: readonly T[];
  readonly position: (item: T) => StarLonLat;
  readonly label: (item: T) => string;
  readonly value: (item: T) => number;
  /** Key of an item. Default: `<layer id>:<index>`. */
  readonly key?: (item: T, index: number) => string;
  /** Smallest and largest radius in screen pixels. Default 4 and 24. */
  readonly minRadius?: number;
  readonly maxRadius?: number;
  /** Fill colour. Default the `--star-chart-2` token. */
  readonly color?: string;
}

/**
 * A layer of web map tiles (Web Mercator only). The map requests only the address the owner
 * gives, for the visible tiles, in the browser. `attribution` is required by most tile services.
 */
export interface StarMapTileLayer {
  readonly type: 'tile';
  readonly id: string;
  /** Address of a tile with `{z}`, `{x}` and `{y}`, for example `https://…/{z}/{x}/{y}.png`. */
  readonly urlTemplate: string;
  /** Attribution text shown on the map, for example `© OpenStreetMap contributors`. */
  readonly attribution: string;
  readonly opacity?: number;
  /** Highest tile level of the service. Default 19. */
  readonly maxZoom?: number;
}

/** A layer of `star-map`. */
export type StarMapLayer =
  StarMapShapeLayer | StarMapMarkerLayer | StarMapBubbleLayer | StarMapTileLayer;

/** A shape, marker or bubble of the map, as the outputs and the slots see it. */
export interface StarMapFeature<T = unknown> {
  readonly key: string;
  /** Id of the layer. */
  readonly layer: string;
  readonly kind: 'shape' | 'marker' | 'bubble';
  readonly label: string;
  readonly value: number | null;
  /** The GeoJSON feature of a shape, the item of a marker or bubble. */
  readonly data: T;
  /** The label point (centroid of a shape) as longitude and latitude. */
  readonly position: StarLonLat;
}

/** Payload of `shapeClick` and `markerClick`. */
export interface StarMapFeatureEvent<T = unknown> {
  readonly feature: StarMapFeature<T>;
  /** The click or key event. */
  readonly event: Event;
}

/** Context of the `starMapMarker` and `starMapTooltip` slots. */
export interface StarMapFeatureContext<T = any> {
  readonly $implicit: StarMapFeature<T>;
  readonly selected: boolean;
}

/** Template of a marker: `<ng-template starMapMarker let-feature>`. */
@Directive({ selector: 'ng-template[starMapMarker]' })
export class StarMapMarker {
  readonly template = inject<TemplateRef<StarMapFeatureContext>>(TemplateRef);

  static ngTemplateContextGuard(_dir: StarMapMarker, _ctx: unknown): _ctx is StarMapFeatureContext {
    return true;
  }
}

/** Template of the tooltip: `<ng-template starMapTooltip let-feature>`. */
@Directive({ selector: 'ng-template[starMapTooltip]' })
export class StarMapTooltip {
  readonly template = inject<TemplateRef<StarMapFeatureContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _dir: StarMapTooltip,
    _ctx: unknown,
  ): _ctx is StarMapFeatureContext {
    return true;
  }
}

interface Item extends StarMapFeature {
  readonly world: StarMapPoint;
  readonly bounds: StarMapBounds;
  readonly selectable: boolean;
  /** Accessible name: the label and the value. */
  readonly name: string;
  readonly shape?: StarMapShape;
  readonly path?: string;
  readonly fill?: string;
  readonly radius?: number;
  readonly color?: string;
}

interface LegendEntry {
  readonly color: string;
  readonly text: string;
}

interface Legend {
  readonly id: string;
  readonly title: string;
  readonly entries: readonly LegendEntry[];
}

/** Size of the viewport before it is measured (and on the server). */
const FALLBACK_VIEWPORT: StarMapSize = { width: 800, height: 450 };
const PADDING = 16;
const DEFAULT_CLASSES = 5;

const classColor = (index: number, count: number) =>
  `color-mix(in srgb, var(--star-chart-1) ${Math.round(((index + 1) / count) * 85 + 15)}%, var(--star-surface))`;

/**
 * Map (DevExtreme `dxVectorMap`, Kendo UI Map, Ignite UI `igx-geographic-map`, Syncfusion
 * `ejs-maps`): an SVG map of layers. A `shape` layer draws GeoJSON polygons (with holes and
 * multi-polygons), lines and points, coloured by value classes with a legend (choropleth); a
 * `marker` layer places markers (slot `ng-template[starMapMarker]`); a `bubble` layer sizes
 * circles by value; an optional `tile` layer shows web map tiles from an address the owner gives
 * (with the required attribution). Web Mercator or equirectangular projection (`starProject`).
 *
 * Interaction: drag to pan, Control and the wheel or a pinch to zoom, the zoom buttons, and the
 * `zoom` and `center` models (`null`: fit the data). Shapes can be selected (`selection`,
 * `selectionMode`); `shapeClick` and `markerClick` report clicks and Enter. Tooltip slot
 * `ng-template[starMapTooltip]`.
 *
 * Accessibility: the features are one tab stop; arrow keys move between them in reading order,
 * Enter or Space selects, Shift and the arrow keys pan, plus and minus zoom. Every feature has a
 * name from `label` (and its value). The map area has `role="application"` only while it has the
 * focus, with a keyboard hint. A data table lists every feature and value (`table` shows it).
 * Without features, the plain arrow keys pan.
 *
 * Known limits: the label point of a shape is the area centroid of its largest polygon, which
 * can lie outside a concave shape (a C or a crescent) or in a hole; a feature that crosses the
 * antimeridian (±180°) is drawn as a band across the map (split it in the data); the focus
 * outline of a shape is painted in document order, so a later neighbouring shape can cover part
 * of it.
 *
 * ```html
 * <star-map [layers]="layers" [(selection)]="selection" ariaLabel="Sales by region" />
 * ```
 */
@Component({
  selector: 'star-map',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-map',
    '[class.star-map--table]': 'showTable()',
  },
  template: `
    <div starPart="bar" class="star-map__bar">
      <div starPart="zoom" class="star-map__zoom">
        <button
          starPart="button"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.zoomIn"
          [attr.title]="text.zoomIn"
          [disabled]="view().zoom >= maxZoom()"
          (click)="zoomBy(1)"
        >
          <i starPart="icon" class="ph-bold ph-plus" aria-hidden="true"></i>
        </button>
        <button
          starPart="button"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.zoomOut"
          [attr.title]="text.zoomOut"
          [disabled]="view().zoom <= minZoom()"
          (click)="zoomBy(-1)"
        >
          <i starPart="icon" class="ph-bold ph-minus" aria-hidden="true"></i>
        </button>
        <button
          starPart="button"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm star-btn--icon"
          [attr.aria-label]="text.mapResetView"
          [attr.title]="text.mapResetView"
          (click)="resetView()"
        >
          <i starPart="icon" class="ph-bold ph-crosshair" aria-hidden="true"></i>
        </button>
      </div>
      <button
        starPart="button"
        type="button"
        class="star-btn star-btn--ghost star-btn--sm"
        [attr.aria-pressed]="showTable()"
        (click)="showTable.set(!showTable())"
      >
        <i
          starPart="icon"
          class="ph-bold"
          [class.ph-table]="!showTable()"
          [class.ph-map-trifold]="showTable()"
          aria-hidden="true"
        ></i>
        {{ showTable() ? text.map : text.tableView }}
      </button>
    </div>

    <!-- The keys come from the focused feature (roving tab index) or the empty map. -->
    <div
      starPart="viewport"
      #area
      class="star-map__viewport"
      [class.star-map__viewport--panning]="panning()"
      [attr.role]="focused() ? 'application' : 'group'"
      [attr.aria-label]="ariaLabel() ?? text.map"
      [attr.aria-describedby]="hintId"
      [attr.tabindex]="items().length ? null : 0"
      (focusin)="focused.set(true)"
      (focusout)="onFocusOut($event)"
      (keydown)="onKeydown($event)"
      (pointerdown)="onPointerDown($event)"
      (pointermove)="onPointerMove($event)"
      (pointerup)="onPointerUp($event)"
      (pointercancel)="onPointerUp($event)"
      (wheel)="onWheel($event)"
    >
      <svg
        starPart="svg"
        class="star-map__svg"
        role="none"
        [attr.viewBox]="'0 0 ' + viewport().width + ' ' + viewport().height"
        preserveAspectRatio="xMidYMid meet"
      >
        @if (tiles().length) {
          <g
            starPart="tiles"
            class="star-map__tiles"
            [attr.opacity]="tileLayer()?.opacity ?? 1"
            aria-hidden="true"
          >
            @for (tile of tiles(); track tile.href) {
              <image
                [attr.href]="tile.href"
                [attr.x]="tile.left"
                [attr.y]="tile.top"
                [attr.width]="tile.width"
                [attr.height]="tile.height"
                preserveAspectRatio="none"
              />
            }
          </g>
        }
        <g [attr.transform]="transform()">
          @for (item of shapeItems(); track item.key) {
            <path
              starPart="shape"
              class="star-map__shape"
              [class.star-map__shape--line]="item.shape?.kind === 'line'"
              [class.star-map__shape--point]="item.shape?.kind === 'point'"
              [class.star-map__shape--selected]="isSelected(item.key)"
              [class.star-map__shape--empty]="item.fill === noData"
              [attr.d]="item.path || pointPath(item)"
              [style.fill]="item.shape?.kind === 'line' ? 'none' : item.fill"
              fill-rule="evenodd"
              role="button"
              [attr.data-map-key]="item.key"
              [attr.tabindex]="item.key === tabKey() ? 0 : -1"
              [attr.aria-label]="item.name"
              [attr.aria-pressed]="pressable(item) ? isSelected(item.key) : null"
              (click)="onItemClick(item, $event)"
              (focus)="onItemFocus(item)"
              (blur)="tipKey.set(null)"
              (pointerenter)="hoverKey.set(item.key)"
              (pointerleave)="hoverKey.set(null)"
            />
          }
        </g>
        @for (bubble of bubbleItems(); track bubble.item.key) {
          <circle
            starPart="bubble"
            class="star-map__bubble"
            [attr.cx]="bubble.x"
            [attr.cy]="bubble.y"
            [attr.r]="bubble.item.radius"
            [style.fill]="bubble.item.color"
            role="button"
            [attr.data-map-key]="bubble.item.key"
            [attr.tabindex]="bubble.item.key === tabKey() ? 0 : -1"
            [attr.aria-label]="bubble.item.name"
            (click)="onItemClick(bubble.item, $event)"
            (focus)="onItemFocus(bubble.item)"
            (blur)="tipKey.set(null)"
            (pointerenter)="hoverKey.set(bubble.item.key)"
            (pointerleave)="hoverKey.set(null)"
          />
        }
      </svg>

      @for (marker of markerItems(); track marker.item.key) {
        <div
          starPart="marker"
          class="star-map__marker"
          role="button"
          [attr.data-map-key]="marker.item.key"
          [attr.tabindex]="marker.item.key === tabKey() ? 0 : -1"
          [attr.aria-label]="marker.item.name"
          [style.left.px]="marker.x"
          [style.top.px]="marker.y"
          (click)="onItemClick(marker.item, $event)"
          (focus)="onItemFocus(marker.item)"
          (blur)="tipKey.set(null)"
          (pointerenter)="hoverKey.set(marker.item.key)"
          (pointerleave)="hoverKey.set(null)"
        >
          @if (markerTemplate(); as slot) {
            <ng-container
              *ngTemplateOutlet="
                slot.template;
                context: { $implicit: marker.item, selected: isSelected(marker.item.key) }
              "
            />
          } @else {
            <i starPart="pin" class="ph-fill ph-map-pin star-map__pin" aria-hidden="true"></i>
          }
        </div>
      }

      @if (tooltip(); as tip) {
        <div
          starPart="tooltip"
          class="star-map__tooltip"
          aria-hidden="true"
          [style.left.px]="tip.x"
          [style.top.px]="tip.y"
        >
          @if (tooltipTemplate(); as slot) {
            <ng-container
              *ngTemplateOutlet="
                slot.template;
                context: { $implicit: tip.item, selected: isSelected(tip.item.key) }
              "
            />
          } @else {
            {{ tip.item.name }}
          }
        </div>
      }

      @if (tileLayer(); as tile) {
        <div starPart="attribution" class="star-map__attribution" dir="auto">
          {{ tile.attribution }}
        </div>
      }
    </div>
    <p starPart="srText" class="star-sr-only" [id]="hintId">{{ text.mapHint }}</p>

    @for (legend of legends(); track legend.id) {
      <div starPart="legend" class="star-map__legend">
        <span
          starPart="legendTitle"
          class="star-map__legend-title"
          [id]="hintId + '-' + legend.id"
          >{{ legend.title }}</span
        >
        <ul
          starPart="legendList"
          class="star-map__legend-list"
          [attr.aria-labelledby]="hintId + '-' + legend.id"
        >
          @for (entry of legend.entries; track $index) {
            <li starPart="legendItem" class="star-map__legend-item">
              <span
                starPart="swatch"
                class="star-map__swatch"
                [style.background]="entry.color"
                aria-hidden="true"
              ></span>
              {{ entry.text }}
            </li>
          }
        </ul>
      </div>
    }

    <table starPart="table" class="star-map__table" [class.star-sr-only]="!showTable()">
      <caption starPart="srText" class="star-sr-only">
        {{
          ariaLabel() ?? text.map
        }}
      </caption>
      <thead starPart="thead">
        <tr starPart="row">
          <th starPart="headerCell" scope="col">{{ text.mapFeature }}</th>
          <th starPart="headerCell" scope="col">{{ text.mapLayer }}</th>
          <th starPart="headerCell" scope="col">{{ text.chartValue }}</th>
        </tr>
      </thead>
      <tbody starPart="tbody">
        @for (item of ordered(); track item.key) {
          <tr starPart="row">
            <th starPart="headerCell" scope="row">{{ item.label }}</th>
            <td starPart="cell">{{ layerTitle(item.layer) }}</td>
            <td starPart="cell">
              {{ item.value === null ? text.missingData : format(item.value) }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class StarMap {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly announcer = inject(StarAnnouncer);
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly defaults = injectStarControlDefaults([]);

  /** The layers, drawn in order (a tile layer is always below). */
  readonly layers = input<readonly StarMapLayer[]>([]);
  /** `mercator` (Web Mercator, default; needed for tiles) or `equirectangular`. */
  readonly projection = input<StarMapProjection>('mercator');
  /** Zoom level (the world is `256 × 2^zoom` pixels wide). `null`: fit the data. */
  readonly zoom = model<number | null>(null);
  /** Longitude and latitude in the middle of the map. `null`: the middle of the data. */
  readonly center = model<StarLonLat | null>(null);
  readonly minZoom = input(0, { transform: numberAttribute });
  readonly maxZoom = input(18, { transform: numberAttribute });
  /** Keys of the selected shapes. */
  readonly selection = model<readonly string[]>([]);
  /** `single` (default), `multiple` or `none`: how a click or Enter selects shapes. */
  readonly selectionMode = input<'none' | 'single' | 'multiple'>('single');
  /** Start with the data table shown. */
  readonly table = input(false, { transform: booleanAttribute });
  /** Name of the map. Defaults to the `map` text. */
  readonly ariaLabel = input<string | null>(null);
  /** BCP 47 locale of the values. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  /** `Intl.NumberFormat` options of the values (legend, names, table, tooltip). */
  readonly valueFormat = input<Intl.NumberFormatOptions | null>(null);

  /** A click, Enter or Space on a shape. */
  readonly shapeClick = output<StarMapFeatureEvent<StarGeoJsonFeature>>();
  /** A click, Enter or Space on a marker or a bubble. */
  readonly markerClick = output<StarMapFeatureEvent>();

  protected readonly markerTemplate = contentChild(StarMapMarker);
  protected readonly tooltipTemplate = contentChild(StarMapTooltip);
  private readonly viewportRef = viewChild<ElementRef<HTMLElement>>('area');

  protected readonly hintId = inject(_IdGenerator).getId('star-map-hint-');
  protected readonly noData = 'var(--star-map-no-data)';
  protected readonly showTable = linkedSignal(() => this.table());
  protected readonly focused = signal(false);
  protected readonly hoverKey = signal<string | null>(null);
  protected readonly tipKey = signal<string | null>(null);
  private readonly activeKey = signal<string | null>(null);
  private readonly measured = signal<StarMapSize | null>(null);
  /** The view while an animation runs. */
  private readonly animated = signal<StarMapView | null>(null);
  protected readonly panning = signal(false);
  private pointers = new Map<number, StarMapPoint>();
  private gesture: {
    view: StarMapView;
    start: StarMapPoint;
    distance: number;
    moved: boolean;
  } | null = null;
  private suppressClick = false;
  private frame: number | null = null;
  /** Counts the zoom animations; a frame of an older one does nothing. */
  private animation = 0;

  private readonly formatter = computed(
    () => new Intl.NumberFormat(this.locale(), this.valueFormat() ?? { maximumFractionDigits: 1 }),
  );
  protected format(value: number): string {
    return this.formatter().format(value);
  }

  protected readonly viewport = computed(() => this.measured() ?? FALLBACK_VIEWPORT);

  protected readonly tileLayer = computed<StarMapTileLayer | null>(() => {
    const tile = this.layers().find((layer): layer is StarMapTileLayer => layer.type === 'tile');
    return tile && this.projection() === 'mercator' && tile.attribution?.trim() ? tile : null;
  });

  /** Every shape, marker and bubble of the layers. */
  protected readonly items = computed<readonly Item[]>(() => {
    const projection = this.projection();
    const items: Item[] = [];
    const name = (label: string, value: number | null) =>
      value === null ? label : this.text.mapFeatureValue(label, this.format(value));
    for (const layer of this.layers()) {
      if (layer.type === 'shape') {
        const shapes = starMapParse(layer.data, projection);
        const valueOf = layer.value;
        const values = shapes.map((shape) => (valueOf ? (valueOf(shape.feature) ?? null) : null));
        const count = Math.max(1, Math.round(layer.classes ?? DEFAULT_CLASSES));
        const classes = starMapClasses(values, count);
        shapes.forEach((shape, i) => {
          const feature = shape.feature;
          const key =
            layer.key?.(feature, shape.index) ?? `${layer.id}:${feature.id ?? shape.index}`;
          const props = (feature.properties ?? {}) as Record<string, unknown>;
          const label =
            layer.label?.(feature) ?? (typeof props['name'] === 'string' ? props['name'] : key);
          const value =
            typeof values[i] === 'number' && Number.isFinite(values[i]) ? values[i] : null;
          const level = classes.classOf(value);
          const fill = !valueOf
            ? 'var(--star-map-fill)'
            : level === null
              ? this.noData
              : (layer.colors?.[level] ?? classColor(level, count));
          items.push({
            key,
            layer: layer.id,
            kind: 'shape',
            label,
            value,
            data: feature,
            position: starUnproject(shape.centroid, projection),
            world: shape.centroid,
            bounds: shape.bounds,
            selectable: layer.selectable !== false,
            name: name(label, value),
            shape,
            path: starMapPath(shape),
            fill,
          });
        });
      } else if (layer.type === 'marker' || layer.type === 'bubble') {
        const values = layer.data.map((item) => layer.value?.(item) ?? null);
        const known = values.filter(
          (v): v is number => typeof v === 'number' && Number.isFinite(v),
        );
        const { min, max } = starMapRange(known);
        layer.data.forEach((data, index) => {
          const position = layer.position(data);
          if (!position || !Number.isFinite(position[0]) || !Number.isFinite(position[1])) return;
          const world = starProject(position, projection);
          const raw = values[index];
          const value = typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
          const label = layer.label(data);
          const key = layer.key?.(data, index) ?? `${layer.id}:${index}`;
          items.push({
            key,
            layer: layer.id,
            kind: layer.type,
            label,
            value,
            data,
            position,
            world,
            bounds: starMapBoundsOf([world]),
            selectable: false,
            name: name(label, value),
            ...(layer.type === 'bubble'
              ? {
                  radius: starMapBubbleRadius(
                    value ?? min,
                    min,
                    max,
                    layer.minRadius ?? 4,
                    layer.maxRadius ?? 24,
                  ),
                  color: layer.color ?? 'var(--star-chart-2)',
                }
              : {}),
          });
        });
      }
    }
    return items;
  });

  private readonly dataBounds = computed(() => starMapUnion(this.items().map((i) => i.bounds)));

  /** The items in reading order: rows from the top, each from the left. */
  protected readonly ordered = computed(() => {
    const items = this.items();
    const bounds = this.dataBounds();
    const tolerance = bounds ? Math.max(1e-6, (bounds.maxY - bounds.minY) / 20) : 1;
    return starMapReadingOrder(
      items.map((item) => item.world),
      tolerance,
    ).map((index) => items[index]);
  });

  /** The one feature in the tab order. */
  protected readonly tabKey = computed(() => {
    const active = this.activeKey();
    const ordered = this.ordered();
    return ordered.some((item) => item.key === active) ? active : (ordered[0]?.key ?? null);
  });

  /** The view: the zoom and center models, the fit of the data where a model is `null`. */
  readonly view = computed<StarMapView>(() => {
    const animated = this.animated();
    if (animated) return animated;
    const viewport = this.viewport();
    const bounds = this.dataBounds();
    const fit = bounds
      ? starMapFit(bounds, viewport, PADDING, this.minZoom(), this.maxZoom())
      : { center: starProject([0, 0], this.projection()), zoom: this.minZoom() };
    const zoom = this.zoom();
    const center = this.center();
    return {
      zoom: zoom === null ? fit.zoom : this.clampZoom(zoom),
      center: center === null ? fit.center : starProject(center, this.projection()),
    };
  });

  protected readonly transform = computed(() => {
    const { center, zoom } = this.view();
    const k = 2 ** zoom;
    const viewport = this.viewport();
    const tx = viewport.width / 2 - center[0] * k;
    const ty = viewport.height / 2 - center[1] * k;
    return `translate(${round(tx)} ${round(ty)}) scale(${round(k, 6)})`;
  });
  /** Radius of a point shape in world pixels (4 screen pixels). */
  protected readonly pointRadius = computed(() => round(4 / 2 ** this.view().zoom, 6));

  protected readonly shapeItems = computed(() => this.items().filter((i) => i.kind === 'shape'));
  private screenOf(item: Item): StarMapPoint {
    return starMapToScreen(item.world, this.view(), this.viewport());
  }
  protected readonly bubbleItems = computed(() =>
    this.items()
      .filter((item) => item.kind === 'bubble')
      .map((item) => {
        const [x, y] = this.screenOf(item);
        return { item, x: round(x), y: round(y) };
      }),
  );
  protected readonly markerItems = computed(() =>
    this.items()
      .filter((item) => item.kind === 'marker')
      .map((item) => {
        const [x, y] = this.screenOf(item);
        return { item, x: round(x), y: round(y) };
      }),
  );

  protected readonly tooltip = computed(() => {
    const key = this.hoverKey() ?? this.tipKey();
    const item = key === null ? null : this.items().find((i) => i.key === key);
    if (!item) return null;
    const [x, y] = this.screenOf(item);
    return { item, x: round(x), y: round(y) };
  });

  /** Visible tiles of the tile layer, browser only. */
  protected readonly tiles = computed(() => {
    const layer = this.tileLayer();
    if (!layer || !this.browser) return [];
    return starMapTiles(this.view(), this.viewport(), layer.maxZoom ?? 19).map((tile) => ({
      ...tile,
      href: starMapTileUrl(layer.urlTemplate, tile.z, tile.x, tile.y),
    }));
  });

  protected readonly legends = computed<readonly Legend[]>(() => {
    const legends: Legend[] = [];
    for (const layer of this.layers()) {
      if (layer.type !== 'shape' || !layer.value || layer.legend === false) continue;
      const values = this.items()
        .filter((item) => item.layer === layer.id)
        .map((item) => item.value);
      const count = Math.max(1, Math.round(layer.classes ?? DEFAULT_CLASSES));
      const { breaks } = starMapClasses(values, count);
      const entries: LegendEntry[] = [];
      for (let i = 0; i + 1 < breaks.length; i++) {
        entries.push({
          color: layer.colors?.[i] ?? classColor(i, count),
          text: this.text.mapRange(this.format(breaks[i]), this.format(breaks[i + 1])),
        });
      }
      if (values.some((value) => value === null)) {
        entries.push({ color: this.noData, text: this.text.missingData });
      }
      legends.push({
        id: layer.id,
        title: `${this.text.mapLegend}: ${layer.title ?? layer.id}`,
        entries,
      });
    }
    return legends;
  });

  constructor() {
    effect(() => {
      const tile = this.layers().find((layer) => layer.type === 'tile') as
        StarMapTileLayer | undefined;
      const projection = this.projection();
      if (!tile || !isDevMode()) return;
      untracked(() => {
        if (!tile.attribution?.trim()) {
          console.warn(
            'star-map: a tile layer needs an attribution text; the tiles are not shown.',
          );
        } else if (projection !== 'mercator') {
          console.warn('star-map: a tile layer needs the mercator projection; it is not shown.');
        }
      });
    });
    afterNextRender(() => this.watchSize());
    inject(DestroyRef).onDestroy(() => {
      if (this.frame !== null) this.doc.defaultView?.cancelAnimationFrame?.(this.frame);
    });
  }

  // ---------- Public API ----------

  /** Zooms by `steps` levels around the middle of the map (animated unless motion is reduced). */
  zoomBy(steps: number): void {
    const view = this.view();
    const viewport = this.viewport();
    const target = this.clampZoom(view.zoom + steps);
    if (target === view.zoom) return;
    const next = starMapZoomAround(
      view,
      [viewport.width / 2, viewport.height / 2],
      target,
      viewport,
    );
    this.animate(next, () => {
      this.setView(next);
      void this.announcer.announce(this.text.mapZoomLevel(round(next.zoom, 1)));
    });
  }

  /** Fits the data again: `zoom` and `center` become `null`. */
  resetView(): void {
    const bounds = this.dataBounds();
    const target = bounds
      ? starMapFit(bounds, this.viewport(), PADDING, this.minZoom(), this.maxZoom())
      : null;
    const done = () => {
      this.zoom.set(null);
      this.center.set(null);
    };
    if (target) this.animate(target, done);
    else done();
  }

  // ---------- Helpers for the template ----------

  protected isSelected(key: string): boolean {
    return this.selection().includes(key);
  }

  protected pressable(item: Item): boolean {
    return item.selectable && this.selectionMode() !== 'none';
  }

  protected layerTitle(id: string): string {
    const layer = this.layers().find((l) => l.id === id);
    return (layer && 'title' in layer && layer.title) || id;
  }

  /** A point shape: a small circle around each point (the hit target and the focus outline). */
  protected pointPath(item: Item): string {
    const r = this.pointRadius();
    const d = round(2 * r, 6);
    return (item.shape?.rings ?? [])
      .map(
        ([[x, y]]) =>
          `M${round(x - r, 6)} ${round(y, 6)}a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 ${-d} 0Z`,
      )
      .join('');
  }

  private clampZoom(zoom: number): number {
    return Math.max(this.minZoom(), Math.min(this.maxZoom(), zoom));
  }

  private setView(view: StarMapView): void {
    this.zoom.set(round(this.clampZoom(view.zoom), 4));
    const [lon, lat] = starUnproject(view.center, this.projection());
    this.center.set([round(lon, 6), round(lat, 6)]);
  }

  /**
   * Stops a running zoom animation where it is (the user took over with a drag, the wheel or a
   * pan key), so its end does not overwrite the new view.
   */
  private stopAnimation(): void {
    if (this.frame === null) return;
    const current = this.view();
    this.doc.defaultView?.cancelAnimationFrame?.(this.frame);
    this.frame = null;
    this.animation++;
    this.animated.set(null);
    this.setView(current);
  }

  private animate(target: StarMapView, done: () => void): void {
    const view = this.doc.defaultView;
    if (!this.browser || !view?.requestAnimationFrame || starPrefersReducedMotion(this.doc)) {
      done();
      return;
    }
    if (this.frame !== null) view.cancelAnimationFrame(this.frame);
    const from = this.view();
    // A later animation or stopAnimation() makes this one stale, even if its frame still runs.
    const run = ++this.animation;
    let start: number | null = null;
    const duration = 200;
    const step = (now: number) => {
      if (run !== this.animation) return;
      start ??= now;
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - (1 - t) ** 3;
      if (t < 1) {
        this.animated.set({
          zoom: from.zoom + (target.zoom - from.zoom) * e,
          center: [
            from.center[0] + (target.center[0] - from.center[0]) * e,
            from.center[1] + (target.center[1] - from.center[1]) * e,
          ],
        });
        this.frame = view.requestAnimationFrame(step);
      } else {
        this.frame = null;
        this.animated.set(null);
        done();
      }
    };
    this.frame = view.requestAnimationFrame(step);
  }

  // ---------- Selection and focus ----------

  private activate(item: Item, event: Event): void {
    this.activeKey.set(item.key);
    if (this.pressable(item)) {
      const mode = this.selectionMode();
      const on = this.isSelected(item.key);
      if (mode === 'single') this.selection.set(on ? [] : [item.key]);
      else
        this.selection.set(
          on ? this.selection().filter((k) => k !== item.key) : [...this.selection(), item.key],
        );
    }
    const payload = { feature: this.publicFeature(item), event };
    if (item.kind === 'shape') {
      this.shapeClick.emit(payload as StarMapFeatureEvent<StarGeoJsonFeature>);
    } else {
      this.markerClick.emit(payload);
    }
  }

  private publicFeature(item: Item): StarMapFeature {
    const { key, layer, kind, label, value, data, position } = item;
    return { key, layer, kind, label, value, data, position };
  }

  protected onItemClick(item: Item, event: MouseEvent): void {
    if (this.suppressClick) {
      this.suppressClick = false;
      return;
    }
    this.activate(item, event);
  }

  protected onItemFocus(item: Item): void {
    this.activeKey.set(item.key);
    this.tipKey.set(item.key);
  }

  protected onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!next || !this.viewportRef()?.nativeElement.contains(next)) this.focused.set(false);
  }

  /** Focuses a feature and pans it into view when it is outside. */
  private focusItem(item: Item): void {
    this.activeKey.set(item.key);
    const [x, y] = this.screenOf(item);
    const viewport = this.viewport();
    if (x < 0 || y < 0 || x > viewport.width || y > viewport.height) {
      this.setView({ center: item.world, zoom: this.view().zoom });
    }
    afterNextRender(
      () => {
        const target = [
          ...this.host.querySelectorAll<HTMLElement | SVGElement>('[data-map-key]'),
        ].find((element) => element.getAttribute('data-map-key') === item.key);
        target?.focus();
      },
      { injector: this.injector },
    );
  }

  protected onKeydown(event: KeyboardEvent): void {
    const ordered = this.ordered();
    const current = ordered.findIndex((item) => item.key === this.tabKey());
    const viewport = this.viewport();
    const k = 2 ** this.view().zoom;
    // Shift and an arrow pan; without features (the map itself is the tab stop) a plain arrow too.
    if (event.key.startsWith('Arrow') && (event.shiftKey || !ordered.length)) {
      const step = { x: viewport.width / 8 / k, y: viewport.height / 8 / k };
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-step.x, 0],
        ArrowRight: [step.x, 0],
        ArrowUp: [0, -step.y],
        ArrowDown: [0, step.y],
      };
      const [dx, dy] = delta[event.key] ?? [0, 0];
      event.preventDefault();
      this.stopAnimation();
      const view = this.view();
      this.setView({ zoom: view.zoom, center: [view.center[0] + dx, view.center[1] + dy] });
      return;
    }
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(ordered.length - 1, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = ordered.length - 1;
        break;
      case '+':
      case '=':
        event.preventDefault();
        this.zoomBy(1);
        return;
      case '-':
      case '_':
        event.preventDefault();
        this.zoomBy(-1);
        return;
      case 'Enter':
      case ' ': {
        const item = ordered[current];
        const target = event.target as Element | null;
        if (item && target?.getAttribute('data-map-key') === item.key) {
          event.preventDefault();
          this.activate(item, event);
        }
        return;
      }
      case 'Escape':
        this.tipKey.set(null);
        this.hoverKey.set(null);
        return;
    }
    if (next === null || next < 0 || !ordered.length) return;
    event.preventDefault();
    this.focusItem(ordered[next]);
  }

  // ---------- Pointer: pan, pinch and wheel ----------

  private localPoint(event: PointerEvent | WheelEvent): StarMapPoint {
    const element = this.viewportRef()?.nativeElement;
    const rect = element?.getBoundingClientRect();
    const viewport = this.viewport();
    const scaleX = rect?.width ? viewport.width / rect.width : 1;
    const scaleY = rect?.height ? viewport.height / rect.height : 1;
    return [
      (event.clientX - (rect?.left ?? 0)) * scaleX,
      (event.clientY - (rect?.top ?? 0)) * scaleY,
    ];
  }

  protected onPointerDown(event: PointerEvent): void {
    if (event.button > 0) return;
    this.stopAnimation();
    this.suppressClick = false;
    this.pointers.set(event.pointerId ?? 0, this.localPoint(event));
    this.startGesture();
  }

  private startGesture(): void {
    const points = [...this.pointers.values()];
    if (!points.length) {
      this.gesture = null;
      return;
    }
    const start: StarMapPoint =
      points.length === 1
        ? points[0]
        : [(points[0][0] + points[1][0]) / 2, (points[0][1] + points[1][1]) / 2];
    const distance =
      points.length > 1 ? Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) : 0;
    this.gesture = { view: this.view(), start, distance, moved: this.gesture?.moved ?? false };
  }

  protected onPointerMove(event: PointerEvent): void {
    const id = event.pointerId ?? 0;
    if (!this.gesture || !this.pointers.has(id)) return;
    this.pointers.set(id, this.localPoint(event));
    const points = [...this.pointers.values()];
    const { view, start, distance } = this.gesture;
    const viewport = this.viewport();
    if (points.length >= 2 && distance > 0) {
      const middle: StarMapPoint = [
        (points[0][0] + points[1][0]) / 2,
        (points[0][1] + points[1][1]) / 2,
      ];
      const ratio = Math.hypot(points[0][0] - points[1][0], points[0][1] - points[1][1]) / distance;
      const zoomed = starMapZoomAround(
        view,
        start,
        this.clampZoom(view.zoom + Math.log2(ratio)),
        viewport,
      );
      const k = 2 ** zoomed.zoom;
      this.gesture = { ...this.gesture, moved: true };
      this.setView({
        zoom: zoomed.zoom,
        center: [
          zoomed.center[0] - (middle[0] - start[0]) / k,
          zoomed.center[1] - (middle[1] - start[1]) / k,
        ],
      });
      return;
    }
    const [x, y] = points[0];
    const dx = x - start[0];
    const dy = y - start[1];
    if (!this.gesture.moved && Math.hypot(dx, dy) < 4) return;
    if (!this.gesture.moved) {
      this.gesture = { ...this.gesture, moved: true };
      this.panning.set(true);
      try {
        this.viewportRef()?.nativeElement.setPointerCapture?.(id);
      } catch {
        // A synthetic pointer cannot be captured.
      }
    }
    const k = 2 ** view.zoom;
    this.setView({ zoom: view.zoom, center: [view.center[0] - dx / k, view.center[1] - dy / k] });
  }

  protected onPointerUp(event: PointerEvent): void {
    const id = event.pointerId ?? 0;
    if (!this.pointers.has(id)) return;
    this.pointers.delete(id);
    if (this.gesture?.moved) this.suppressClick = true;
    if (this.pointers.size) {
      this.startGesture();
    } else {
      this.gesture = null;
      this.panning.set(false);
    }
  }

  protected onWheel(event: WheelEvent): void {
    // Without Control the wheel scrolls the page. A trackpad pinch sends the wheel with Control.
    if (!event.ctrlKey) return;
    event.preventDefault();
    this.stopAnimation();
    const view = this.view();
    // Lines and pages scroll more per unit than pixels: 16 pixels a line, a viewport a page.
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.viewport().height : 1;
    const zoom = this.clampZoom(view.zoom - event.deltaY * unit * 0.01);
    if (zoom === view.zoom) return;
    this.setView(starMapZoomAround(view, this.localPoint(event), zoom, this.viewport()));
  }

  private watchSize(): void {
    const element = this.viewportRef()?.nativeElement;
    const view = this.doc.defaultView;
    if (!element || !view || typeof view.ResizeObserver !== 'function') return;
    const observer = new view.ResizeObserver(() => {
      const rect = element.getBoundingClientRect();
      if (rect.width && rect.height) {
        this.measured.set({ width: Math.round(rect.width), height: Math.round(rect.height) });
      }
    });
    observer.observe(element);
    this.injector.get(DestroyRef).onDestroy(() => observer.disconnect());
  }
}

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** The world point of a screen point, for owners that place their own overlays. */
export function starMapScreenToLonLat(
  point: StarMapPoint,
  view: StarMapView,
  viewport: StarMapSize,
  projection: StarMapProjection = 'mercator',
): StarLonLat {
  return starUnproject(starMapToWorld(point, view, viewport), projection);
}
