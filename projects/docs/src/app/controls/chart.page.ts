import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarChart, StarChartSeries } from 'star-ng/chart';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-chart-page',
  imports: [DOCS, StarChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Chart"
      lead="Bar, line, area, doughnut and pie charts drawn as SVG, without a chart library. Every chart can show its data as a table. This is the equivalent of the PrimeNG p-chart."
      importFrom="import { StarChart } from 'star-ng/chart';"
    >
      <docs-example
        heading="Bar chart"
        source="chart/bar"
        note="Series are grouped per category. A legend appears for two or more series. Hover a column to see its values."
      >
        <star-chart
          type="bar"
          title="Orders per month"
          [labels]="months"
          [series]="orders"
          categoryLabel="Month"
        />
      </docs-example>

      <docs-example heading="Line chart" source="chart/line">
        <star-chart
          type="line"
          title="Orders per month, line"
          [labels]="months"
          [series]="orders"
        />
      </docs-example>

      <docs-example
        heading="Area chart"
        source="chart/area"
        note="An area chart is a line chart with a soft fill under each line."
      >
        <star-chart
          type="area"
          title="Orders per month, area"
          [labels]="months"
          [series]="orders"
        />
      </docs-example>

      <docs-example
        heading="Doughnut chart"
        source="chart/doughnut"
        note="One series as parts of a whole. A doughnut shows the three largest categories and groups the rest as Other."
      >
        <star-chart
          type="doughnut"
          title="Traffic by channel"
          [labels]="channels"
          [series]="traffic"
        />
      </docs-example>

      <docs-example
        heading="Pie chart"
        source="chart/pie"
        note="A pie chart is a doughnut without the hole and the total."
      >
        <star-chart type="pie" title="Revenue by region" [labels]="regions" [series]="revenue" />
      </docs-example>

      <docs-example
        heading="Data table"
        source="chart/table"
        note="The data table is always in the page for screen readers. The button switches the visible view. The table input starts with the table open."
      >
        <star-chart
          type="bar"
          title="Revenue by region, table"
          [labels]="regions"
          [series]="revenue"
          categoryLabel="Region"
          table
        />
      </docs-example>

      <docs-example
        heading="Sizing"
        source="chart/sizing"
        note="The chart fills the width of its container and keeps its aspect ratio. Set the width on a wrapper."
      >
        <div class="docs-chart-narrow">
          <star-chart type="bar" title="Orders, narrow" [labels]="months" [series]="single" />
        </div>
      </docs-example>

      <h2>Series colors and themes</h2>
      <p>
        Series use the tokens <code>--star-chart-1</code> to <code>--star-chart-8</code> in a fixed
        order. They have separate values for the light and the dark theme, so a chart follows the
        theme without a change in the template. Override a token to change a series color. A chart
        shows at most eight series. Colors follow the series position, not its value.
      </p>
      <p>
        Some colors have less than 3:1 contrast with the background. Meaning is therefore never
        carried by color alone: the legend names each series and every chart offers the data table.
      </p>

      <docs-api [of]="['StarChart']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class ChartPage {
  protected readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  protected readonly orders: StarChartSeries[] = [
    { label: 'Received', data: [120, 150, 170, 140, 190, 210] },
    { label: 'Shipped', data: [110, 140, 160, 135, 180, 200] },
  ];
  protected readonly single: StarChartSeries[] = [
    { label: 'Received', data: [120, 150, 170, 140, 190, 210] },
  ];
  protected readonly regions = ['North', 'South', 'East', 'West'];
  protected readonly revenue: StarChartSeries[] = [
    { label: 'Revenue', data: [48000, 32000, 27000, 41000] },
  ];
  protected readonly channels = ['Search', 'Direct', 'Referral', 'Email', 'Social'];
  protected readonly traffic: StarChartSeries[] = [
    { label: 'Visits', data: [5200, 3100, 1400, 900, 600] },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-chart-1 … --star-chart-8', description: 'Series colors, in fixed order.' },
    { name: '--star-border', description: 'Color of the grid lines.' },
    { name: '--star-border-strong', description: 'Color of the hover crosshair of line charts.' },
    { name: '--star-text-muted', description: 'Color of axis labels and the legend.' },
    { name: '--star-surface', description: 'Gap between marks and ring around line dots.' },
    { name: '--star-tooltip-surface', description: 'Background of the hover tooltip.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab, then Enter or Space',
      description:
        'Focuses the Table / Chart button and switches the view. The marks have no keyboard focus: the table gives the same data.',
    },
  ];
}
