import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
  StarGeoJsonFeatureCollection,
  StarLonLat,
  StarMap,
  StarMapFeatureEvent,
  StarMapLayer,
  StarMapMarker,
  StarMapTooltip,
} from '@star-ng/ui/map';
import { DOCS, DocsRow } from '../shared/docs';

interface Region {
  readonly name: string;
  readonly sales: number | null;
}

/**
 * Lakeland: fictional regions drawn for these docs (public domain, CC0). Lakeshire has a lake
 * (a hole in its polygon), the Isles are a MultiPolygon, and Southfen has no sales data.
 */
const LAKELAND: StarGeoJsonFeatureCollection<Region> = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'northmoor',
      properties: { name: 'Northmoor', sales: 42 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 49],
            [10.4, 51.2],
            [11.6, 52],
            [13.9, 51.8],
            [14, 49],
            [10, 49],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'eastvale',
      properties: { name: 'Eastvale', sales: 77 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [14, 49],
            [13.9, 51.8],
            [16.2, 52.1],
            [17.8, 51],
            [18, 49],
            [14, 49],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'lakeshire',
      properties: { name: 'Lakeshire', sales: 18 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [10, 49],
            [14, 49],
            [14.1, 46.4],
            [12, 45.8],
            [10.3, 46.5],
            [10, 49],
          ],
          [
            [11.4, 47.2],
            [12.6, 47.2],
            [12.8, 48.1],
            [11.6, 48.3],
            [11.4, 47.2],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'southfen',
      properties: { name: 'Southfen', sales: null },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [14, 49],
            [18, 49],
            [17.6, 46.6],
            [15.6, 46],
            [14.1, 46.4],
            [14, 49],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      id: 'isles',
      properties: { name: 'The Isles', sales: 63 },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [
            [
              [18.6, 47.2],
              [19.5, 47.1],
              [19.6, 48],
              [18.8, 48.2],
              [18.6, 47.2],
            ],
          ],
          [
            [
              [18.9, 49.2],
              [19.7, 49.3],
              [19.5, 50],
              [18.9, 49.9],
              [18.9, 49.2],
            ],
          ],
        ],
      },
    },
  ],
};

const RIVER: StarGeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: 'long-river',
      properties: { name: 'Long River' },
      geometry: {
        type: 'LineString',
        coordinates: [
          [13.2, 52],
          [13.6, 50.4],
          [14.4, 49.2],
          [14.2, 47.6],
          [15, 46.1],
        ],
      },
    },
  ],
};

interface Town {
  readonly name: string;
  readonly at: StarLonLat;
  readonly visitors: number;
}

const TOWNS: readonly Town[] = [
  { name: 'Moor End', at: [11.2, 50.8], visitors: 1200 },
  { name: 'Harbor Town', at: [17, 47.6], visitors: 5400 },
  { name: 'Fenwick', at: [15.6, 47.2], visitors: 800 },
  { name: 'Vale Cross', at: [16, 50.6], visitors: 2600 },
];

interface Capital {
  readonly name: string;
  readonly at: StarLonLat;
}

const CAPITALS: readonly Capital[] = [
  { name: 'Paris', at: [2.35, 48.86] },
  { name: 'Berlin', at: [13.4, 52.52] },
  { name: 'Madrid', at: [-3.7, 40.42] },
];

@Component({
  selector: 'docs-map-page',
  imports: [DOCS, StarMap, StarMapMarker, StarMapTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .town {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.125rem 0.375rem;
      border: 1px solid var(--star-border-strong);
      border-radius: var(--star-radius-sm);
      background: var(--star-surface);
      color: var(--star-text-strong);
      font-size: 0.75rem;
      white-space: nowrap;
    }
  `,
  template: `
    <docs-page
      heading="Map"
      lead="A vector map of GeoJSON shapes, markers, bubbles and optional map tiles, with pan, zoom, selection, a legend and a data table. The DevExtreme equivalent is VectorMap, Kendo UI has Map, Ignite UI has the geographic map and Syncfusion has Maps."
      importFrom="import { StarMap } from '@star-ng/ui/map';"
    >
      <docs-example
        heading="Choropleth with a legend"
        source="map/choropleth"
        [script]="choroplethScript"
        note="The value accessor colours each region by one of five equal-interval classes of the --star-chart-1 token; Southfen has no data. Lakeshire has a lake (a hole), the Isles are two polygons. Tab enters the map, the arrow keys move between the regions in reading order, Enter selects. Drag to pan, Control and the wheel or a pinch to zoom."
      >
        <div class="docs-stack">
          <star-map
            [layers]="choropleth"
            [(selection)]="selection"
            [(zoom)]="zoom"
            ariaLabel="Sales by region"
            (shapeClick)="clicked($event)"
          />
          <p class="docs-output" role="status">
            Selected: {{ selection().join(', ') || '(none)' }}. Last click: {{ lastClick() }}. Zoom:
            {{ zoom() === null ? 'fit' : zoom() }}.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Markers, bubbles and a tooltip"
        source="map/markers"
        [script]="markersScript"
        note="A marker layer with the starMapMarker slot, a bubble layer sized by visitors, a line (the river) and the starMapTooltip slot. This map uses the equirectangular projection and selects nothing (selectionMode='none')."
      >
        <star-map
          [layers]="markerLayers"
          projection="equirectangular"
          selectionMode="none"
          ariaLabel="Towns and visitors"
        >
          <ng-template starMapMarker let-town>
            <span class="town"
              ><i class="ph-fill ph-map-pin" aria-hidden="true"></i>{{ town.label }}</span
            >
          </ng-template>
          <ng-template starMapTooltip let-feature>
            <strong>{{ feature.label }}</strong>
            @if (feature.value !== null) {
              · {{ feature.value }} visitors
            }
          </ng-template>
        </star-map>
      </docs-example>

      <docs-example
        heading="Tile layer (off by default)"
        source="map/tiles"
        [script]="tilesScript"
        note="A tile layer requests only the address you give, for the visible tiles, in the browser. It needs an attribution text. This example loads OpenStreetMap tiles only after you switch them on; the docs and their tests never use the network. The OpenStreetMap tile usage policy does not allow heavy use of its public tile servers: in production, use your own tile server or a commercial tile provider."
      >
        <div class="docs-stack">
          <label class="docs-row">
            <input type="checkbox" [checked]="tilesOn()" (change)="tilesOn.set(!tilesOn())" />
            Load OpenStreetMap tiles (from tile.openstreetmap.org)
          </label>
          <star-map [layers]="tileLayers()" selectionMode="none" ariaLabel="Three capitals" />
        </div>
      </docs-example>

      <h2>Data and licence</h2>
      <p>
        Lakeland, its regions, the river and the towns are fictional; they were drawn for these docs
        and are in the public domain (CC0). For real borders, Natural Earth (naturalearthdata.com)
        offers public domain GeoJSON. The library loads no map data and no tiles by itself.
      </p>
      <p>
        Tiles in production: the public OpenStreetMap tile servers are for light use only, under the
        OpenStreetMap tile usage policy (operations.osmfoundation.org/policies/tiles). For an
        application with real traffic, run your own tile server or use a commercial tile provider,
        and show the attribution text that its licence asks for.
      </p>

      <h2>Known limits</h2>
      <ul>
        <li>
          The label point of a shape (tooltip, focus order, panning to the focused shape) is the
          area centroid of its largest polygon. For a concave shape, such as a C or a crescent, or a
          ring with a hole, it can lie outside the shape.
        </li>
        <li>
          Features that cross the antimeridian (±180° longitude) are not split: they draw as a band
          across the map. Split them in the data.
        </li>
        <li>
          The focus outline of a shape is painted in document order, so a neighbouring shape that
          comes later can cover part of it.
        </li>
      </ul>

      <h2>Accessibility</h2>
      <p>
        Every shape, marker and bubble has a name from its label and value. The features are one tab
        stop; the map area has the role <code>application</code> only while it has the focus, and a
        hint names the keys. The data table lists every feature with its layer and value; the Table
        button shows it, and screen readers can always read it. Zoom and pan animations of the
        buttons stop when reduced motion is on.
      </p>

      <docs-api
        [of]="['StarMap', 'StarMapMarker', 'StarMapTooltip']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class MapPage {
  protected readonly selection = signal<readonly string[]>(['regions:eastvale']);
  protected readonly zoom = signal<number | null>(null);
  protected readonly lastClick = signal('(none)');
  protected readonly tilesOn = signal(false);

  protected readonly choropleth: readonly StarMapLayer[] = [
    {
      type: 'shape',
      id: 'regions',
      title: 'Sales in thousands',
      data: LAKELAND,
      value: (feature) => (feature.properties as Region).sales,
    },
  ];

  protected readonly markerLayers: readonly StarMapLayer[] = [
    { type: 'shape', id: 'regions', title: 'Regions', data: LAKELAND, selectable: false },
    { type: 'shape', id: 'river', title: 'Rivers', data: RIVER, selectable: false },
    {
      type: 'bubble',
      id: 'visitors',
      title: 'Visitors',
      data: TOWNS,
      position: (town: Town) => town.at,
      label: (town: Town) => `${town.name} visitors`,
      value: (town: Town) => town.visitors,
    },
    {
      type: 'marker',
      id: 'towns',
      title: 'Towns',
      data: TOWNS,
      position: (town: Town) => town.at,
      label: (town: Town) => town.name,
    },
  ];

  protected readonly tileLayers = computed<readonly StarMapLayer[]>(() => [
    ...(this.tilesOn()
      ? [
          {
            type: 'tile' as const,
            id: 'osm',
            urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors',
          },
        ]
      : []),
    {
      type: 'marker',
      id: 'capitals',
      title: 'Capitals',
      data: CAPITALS,
      position: (city: Capital) => city.at,
      label: (city: Capital) => city.name,
    },
  ]);

  protected clicked(event: StarMapFeatureEvent): void {
    this.lastClick.set(event.feature.label);
  }

  protected readonly choroplethScript = `readonly selection = signal<readonly string[]>(['regions:eastvale']);
readonly zoom = signal<number | null>(null); // null: fit the data
readonly choropleth: StarMapLayer[] = [
  {
    type: 'shape',
    id: 'regions',
    title: 'Sales in thousands',
    data: LAKELAND, // a GeoJSON FeatureCollection
    value: (feature) => feature.properties.sales, // null: no data
  },
];`;

  protected readonly markersScript = `readonly markerLayers: StarMapLayer[] = [
  { type: 'shape', id: 'regions', title: 'Regions', data: LAKELAND, selectable: false },
  { type: 'shape', id: 'river', title: 'Rivers', data: RIVER, selectable: false },
  {
    type: 'bubble', id: 'visitors', title: 'Visitors', data: TOWNS,
    position: (town) => town.at, // [longitude, latitude]
    label: (town) => town.name + ' visitors',
    value: (town) => town.visitors,
  },
  {
    type: 'marker', id: 'towns', title: 'Towns', data: TOWNS,
    position: (town) => town.at,
    label: (town) => town.name,
  },
];`;

  protected readonly tilesScript = `readonly tilesOn = signal(false);
readonly tileLayers = computed<StarMapLayer[]>(() => [
  ...(this.tilesOn()
    ? [{
        type: 'tile', id: 'osm',
        urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
      }]
    : []),
  { type: 'marker', id: 'capitals', title: 'Capitals', data: CAPITALS,
    position: (city) => city.at, label: (city) => city.name },
]);`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-map-height', description: 'Height of the map area (24rem).' },
    { name: '--star-chart-1', description: 'Base colour of the value classes and of lines.' },
    { name: '--star-chart-2', description: 'Default colour of bubbles.' },
    { name: '--star-map-fill', description: 'Fill of shapes of a layer without values.' },
    { name: '--star-map-no-data', description: 'Fill of shapes without a value.' },
    { name: '--star-map-stroke', description: 'Border of the shapes.' },
    { name: '--star-accent', description: 'Focus outline of a feature.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves into the map (one feature) and out of it.' },
    {
      name: 'Arrow keys, Home, End',
      description: 'Move between the features in reading order (rows from the top).',
    },
    { name: 'Enter / Space', description: 'Selects the focused shape and reports the click.' },
    { name: 'Shift + arrow keys', description: 'Pan the map.' },
    { name: 'Arrow keys (no features)', description: 'Pan the map.' },
    { name: '+ / -', description: 'Zoom in / out.' },
    { name: 'Escape', description: 'Hides the tooltip.' },
  ];
}
