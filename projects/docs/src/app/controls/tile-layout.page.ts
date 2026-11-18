import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarTile, StarTileLayout, StarTileResize } from '@star-ng/ui/tile-layout';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-tile-layout-page',
  imports: [DOCS, StarTileLayout, StarTile],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .figure {
      margin: 0;
      font: var(--star-type-title-lg);
      color: var(--star-text-strong);
    }
    .caption {
      margin: 0.25rem 0 0;
      color: var(--star-text-muted);
    }
  `,
  template: `
    <docs-page
      heading="Tile layout"
      lead="A grid of tiles with columns, a row height and a gap. Each tile spans one or more columns and rows. The tiles can move and change size with the pointer and the keyboard. The Material equivalent is mat-grid-list; the Kendo UI equivalent is TileLayout."
      importFrom="import { StarTile, StarTileLayout } from '@star-ng/ui/tile-layout';"
    >
      <docs-example
        heading="Grid list"
        source="tile-layout/basic"
        [script]="basicScript"
        note="A tile spans colSpan columns and rowSpan rows. Each tile is a group, named by its label or by its header."
      >
        <star-tile-layout [columns]="4" rowHeight="7rem" gap="0.75rem">
          @for (tile of basicTiles; track tile.key) {
            <star-tile [key]="tile.key" [colSpan]="tile.colSpan" [rowSpan]="tile.rowSpan">
              <span starTileHeader>{{ tile.title }}</span>
              <p class="caption">{{ tile.text }}</p>
            </star-tile>
          }
        </star-tile-layout>
      </docs-example>

      <docs-example
        heading="Reorder and resize"
        source="tile-layout/dashboard"
        [script]="dashboardScript"
        note="Drag a tile, or focus it and press Control and an arrow key, to move it. Press Control, Shift and an arrow key, or drag the corner handle, to resize it. Render the tiles in the order model, so the reading order follows the screen."
      >
        <div class="docs-stack">
          <star-tile-layout
            [columns]="3"
            rowHeight="8rem"
            reorderable
            resizable
            [(order)]="order"
            (tileResize)="onResize($event)"
          >
            @for (key of order(); track key) {
              @let tile = dashboard[key];
              <star-tile
                [key]="key"
                [label]="tile.title"
                [(colSpan)]="tile.colSpan"
                [(rowSpan)]="tile.rowSpan"
              >
                <span starTileHeader>{{ tile.title }}</span>
                <p class="figure">{{ tile.figure }}</p>
                <p class="caption">{{ tile.caption }}</p>
              </star-tile>
            }
          </star-tile-layout>
          <p class="docs-output" role="status">
            Order: {{ order().join(', ') }}. {{ lastResize() }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Responsive columns"
        source="tile-layout/responsive"
        [script]="responsiveScript"
        note="breakpoints sets the columns for a narrow layout: sm below 36rem, md below 48rem and lg below 64rem of the layout width (CSS container queries). A span never exceeds the columns in force."
      >
        <star-tile-layout [columns]="4" [breakpoints]="{ sm: 1, md: 2 }" rowHeight="6rem">
          @for (city of cities; track city) {
            <star-tile [key]="city" [label]="city">
              <span starTileHeader>{{ city }}</span>
            </star-tile>
          }
        </star-tile-layout>
      </docs-example>

      <docs-api
        [of]="['StarTileLayout', 'StarTile']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class TileLayoutPage {
  protected readonly basicTiles = [
    { key: 'one', title: 'Overview', text: 'Two columns, two rows.', colSpan: 2, rowSpan: 2 },
    { key: 'two', title: 'Tasks', text: 'One cell.', colSpan: 1, rowSpan: 1 },
    { key: 'three', title: 'Notes', text: 'One cell.', colSpan: 1, rowSpan: 1 },
    { key: 'four', title: 'Activity', text: 'Two columns.', colSpan: 2, rowSpan: 1 },
  ];

  protected readonly order = signal<readonly string[]>(['orders', 'revenue', 'visits', 'tickets']);
  protected readonly lastResize = signal('');
  protected readonly dashboard: Record<
    string,
    { title: string; figure: string; caption: string; colSpan: number; rowSpan: number }
  > = {
    orders: { title: 'Orders', figure: '1,284', caption: 'This month', colSpan: 2, rowSpan: 1 },
    revenue: { title: 'Revenue', figure: '84,200', caption: 'This month', colSpan: 1, rowSpan: 1 },
    visits: { title: 'Visits', figure: '12,940', caption: 'Last 7 days', colSpan: 1, rowSpan: 1 },
    tickets: { title: 'Open tickets', figure: '17', caption: 'Today', colSpan: 2, rowSpan: 1 },
  };

  protected readonly cities: readonly string[] = ['Lisbon', 'Oslo', 'Porto', 'Turin'];

  protected onResize(event: StarTileResize): void {
    this.lastResize.set(`${event.key}: ${event.colSpan} × ${event.rowSpan}.`);
  }

  protected readonly basicScript = `readonly basicTiles = [
  { key: 'one', title: 'Overview', text: 'Two columns, two rows.', colSpan: 2, rowSpan: 2 },
  { key: 'two', title: 'Tasks', text: 'One cell.', colSpan: 1, rowSpan: 1 },
  { key: 'three', title: 'Notes', text: 'One cell.', colSpan: 1, rowSpan: 1 },
  { key: 'four', title: 'Activity', text: 'Two columns.', colSpan: 2, rowSpan: 1 },
];`;
  protected readonly dashboardScript = `readonly order = signal<readonly string[]>(['orders', 'revenue', 'visits', 'tickets']);
readonly lastResize = signal('');
readonly dashboard = {
  orders: { title: 'Orders', figure: '1,284', caption: 'This month', colSpan: 2, rowSpan: 1 },
  revenue: { title: 'Revenue', figure: '84,200', caption: 'This month', colSpan: 1, rowSpan: 1 },
  visits: { title: 'Visits', figure: '12,940', caption: 'Last 7 days', colSpan: 1, rowSpan: 1 },
  tickets: { title: 'Open tickets', figure: '17', caption: 'Today', colSpan: 2, rowSpan: 1 },
};

onResize(event: StarTileResize): void {
  this.lastResize.set(\`\${event.key}: \${event.colSpan} × \${event.rowSpan}.\`);
}`;
  protected readonly responsiveScript = `readonly cities = ['Lisbon', 'Oslo', 'Porto', 'Turin'];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '[starTileHeader]',
      description: 'Title row of a tile. It names the tile when there is no label.',
    },
    { name: '(default)', description: 'Body of a tile. It scrolls when the content is taller.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of a tile.' },
    { name: '--star-border', description: 'Border of a tile.' },
    { name: '--star-border-strong', description: 'Lines of the resize handle.' },
    { name: '--star-accent', description: 'Focus ring and resize outline.' },
    { name: '--star-shadow-lg', description: 'Shadow of the tile that is dragged.' },
    { name: '--star-duration-base', description: 'Duration of the drag animation.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description: 'Moves to the next tile (reorderable or resizable layout) or control.',
    },
    {
      name: 'Control + Arrow right / Arrow left',
      description: 'Moves the focused tile one place later or earlier, in reading order.',
    },
    {
      name: 'Control + Arrow down / Arrow up',
      description: 'Moves the focused tile one row later or earlier.',
    },
    {
      name: 'Control + Shift + Arrow keys',
      description:
        'Makes the focused tile wider or narrower (inline arrows) and taller or shorter (block arrows).',
    },
  ];
}
