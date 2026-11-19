import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarSparkline } from '@star-ng/ui/sparkline';
import { StarCellTemplate, StarColumn, StarTable } from '@star-ng/ui/table';
import { DOCS, DocsRow } from '../shared/docs';

interface Region {
  readonly region: string;
  readonly total: number;
  readonly trend: readonly number[];
}

@Component({
  selector: 'docs-sparkline-page',
  imports: [DOCS, StarSparkline, StarTable, StarCellTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Sparkline"
      lead="A tiny chart without axes that fits in a line of text or a table cell. It shows the shape of a series: a line, an area, bars or wins and losses. The Kendo UI equivalent is kendo-sparkline; Ignite UI has igx-sparkline and Syncfusion has ejs-sparkline."
      importFrom="import { StarSparkline } from '@star-ng/ui/sparkline';"
    >
      <docs-example
        heading="Line in text"
        source="sparkline/line"
        note="The default size is 6em wide and 1em tall, so the sparkline fits in a line of text. The sparkline is an image: its label sums up the trend, the first, last, lowest and highest value. It is not a focus stop."
      >
        <p>
          Weekly sales <star-sparkline [data]="sales" [highlight]="['last']" /> rose to 21.5
          thousand.
        </p>
      </docs-example>

      <docs-example
        heading="Types"
        source="sparkline/types"
        note="type is line, area, bar or win-loss. A win-loss bar goes up for a value above zero and down for one below. color picks a slot (1 to 8) of the chart palette."
      >
        <div class="docs-stack">
          <span
            >Line <star-sparkline [data]="sales" [width]="120" [height]="28" ariaLabel="Line"
          /></span>
          <span
            >Area
            <star-sparkline
              type="area"
              [data]="sales"
              [color]="3"
              [width]="120"
              [height]="28"
              ariaLabel="Area"
          /></span>
          <span
            >Bar
            <star-sparkline
              type="bar"
              [data]="change"
              [color]="7"
              [width]="120"
              [height]="28"
              ariaLabel="Bar"
          /></span>
          <span
            >Win-loss <star-sparkline type="win-loss" [data]="change" [width]="120" [height]="28"
          /></span>
        </div>
      </docs-example>

      <docs-example
        heading="Markers and reference line"
        source="sparkline/markers"
        note="highlight puts a marker on the last, the lowest or the highest value. referenceLine draws a dashed line at a value, for example a target. min and max fix the range of the plot."
      >
        <star-sparkline
          [data]="load"
          [highlight]="['min', 'max', 'last']"
          [referenceLine]="70"
          [min]="0"
          [max]="100"
          [width]="200"
          [height]="40"
          ariaLabel="Server load, target 70 percent"
        />
      </docs-example>

      <docs-example
        heading="In a table"
        source="sparkline/table"
        note="Put the sparkline in a cell template of star-table. Each row draws its own series."
      >
        <star-table
          [value]="regions"
          [columns]="columns"
          dataKey="region"
          ariaLabel="Sales per region"
        >
          <ng-template starCell="trend" [starCellOf]="regions" let-row>
            <star-sparkline [data]="row.trend" [highlight]="['last']" />
          </ng-template>
        </star-table>
      </docs-example>

      <docs-api [of]="['StarSparkline']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class SparklinePage {
  protected readonly sales = [12, 9, 15, 14, 18, 17, 21.5];
  protected readonly change = [3, -1, 4, 2, -3, 5, -2, 1];
  protected readonly load = [42, 55, 61, 48, 72, 88, 64, 58, 77, 69];

  protected readonly regions: readonly Region[] = [
    { region: 'North', total: 1240, trend: [80, 95, 90, 110, 120, 118, 130] },
    { region: 'South', total: 980, trend: [140, 132, 120, 125, 110, 104, 98] },
    { region: 'East', total: 1105, trend: [100, 102, 99, 101, 104, 100, 103] },
    { region: 'West', total: 1410, trend: [60, 75, 92, 110, 128, 150, 171] },
  ];
  protected readonly columns: readonly StarColumn<Region>[] = [
    { field: 'region', header: 'Region' },
    { field: 'total', header: 'Orders', align: 'end' },
    { field: 'trend', header: 'Last 7 weeks' },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-sparkline-color',
      description: 'Colour of the line, area and bars. Set by color from --star-chart-1…8.',
    },
    { name: '--star-danger', description: 'Colour of a bar below zero.' },
    { name: '--star-text-muted', description: 'Colour of the reference line.' },
  ];
}
