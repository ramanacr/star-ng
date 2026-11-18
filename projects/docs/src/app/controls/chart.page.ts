import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
  StarChart,
  StarChartPointSelectEvent,
  StarChartPointSeries,
  StarChartSeries,
  StarChartTooltip,
} from '@star-ng/ui/chart';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-chart-page',
  imports: [DOCS, StarChart, StarChartTooltip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Chart"
      lead="Bar, stacked bar, line, area, doughnut, pie, radar, polar area and scatter charts drawn as SVG, without a chart library. Every chart can show its data as a table. This is the equivalent of the PrimeNG p-chart."
      importFrom="import { StarChart } from '@star-ng/ui/chart';"
    >
      <docs-example
        heading="Bar chart"
        source="chart/bar"
        note="Series are grouped per category. A legend appears for two or more series; a click on a name hides or shows the series. Hover a column to see its values."
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
        heading="Stacked bar chart"
        source="chart/stacked-bar"
        note="Series are stacked in one column per category, the first series at the bottom. Hover a column to see each value and the total. Negative values stack below the baseline."
      >
        <star-chart
          type="stacked-bar"
          title="Orders per month by channel"
          [labels]="months"
          [series]="channelOrders"
          categoryLabel="Month"
        />
      </docs-example>

      <docs-example
        heading="Stacked bar chart, percent"
        source="chart/stacked-bar-percent"
        note="The percent input scales every column to 100 percent, to compare the shares of the channels. The tooltip and the table still show the real values."
      >
        <star-chart
          type="stacked-bar"
          title="Share of orders by channel"
          [labels]="months"
          [series]="channelOrders"
          categoryLabel="Month"
          percent
        />
      </docs-example>

      <docs-example
        heading="Radar chart"
        source="chart/radar"
        note="One polygon per series over one axis per category. All series share one scale, and the rings carry the values. Each series has its own marker shape as well as its color."
      >
        <star-chart
          type="radar"
          title="Product ratings by criterion"
          [labels]="criteria"
          [series]="ratings"
          categoryLabel="Criterion"
        />
      </docs-example>

      <docs-example
        heading="Polar area chart"
        source="chart/polar-area"
        note="One sector per category, all with the same angle. The area of a sector is in proportion to the value: the radius grows with the square root of the value, and the rings show round values on that scale."
      >
        <star-chart
          type="polar-area"
          title="Visits by weekday"
          [labels]="weekdays"
          [series]="weekdayVisits"
          categoryLabel="Weekday"
        />
      </docs-example>

      <docs-example
        heading="Scatter chart"
        source="chart/scatter"
        note="Points from x and y values on two numeric axes. Series data is a list of { x, y } points. Each series has its own marker shape as well as its color, and the table lists every point."
      >
        <star-chart
          type="scatter"
          title="Price against weight"
          [series]="products"
          categoryLabel="Weight (kg)"
          valueLabel="Price"
        />
      </docs-example>

      <docs-example
        heading="Long labels"
        source="chart/long-labels"
        note="A label that does not fit its column or axis is cut with an ellipsis. The full text shows as a title when you hover it, and stays in the data table."
      >
        <div class="docs-chart-narrow">
          <star-chart
            type="stacked-bar"
            title="Orders by region"
            [labels]="longRegions"
            [series]="regionChannels"
          />
        </div>
        <div class="docs-chart-narrow">
          <star-chart
            type="radar"
            title="Detailed ratings"
            [labels]="longCriteria"
            [series]="ratings"
          />
        </div>
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
        heading="Keyboard, tooltip template and point selection"
        source="chart/interaction"
        [script]="interactionScript"
        note="Tab moves to the data points: one tab stop for the chart. Arrow Right and Arrow Left move along a series, Arrow Down and Arrow Up to the next or the previous series, Home and End to the ends. The tooltip shows on hover and on focus. ng-template starChartTooltip replaces its content (context: the points, and label). A click, or Enter or Space on a focused point, emits pointSelect."
      >
        <div class="docs-stack">
          <star-chart
            type="line"
            title="Orders per month, interactive"
            [labels]="months"
            [series]="orders"
            (pointSelect)="picked.set($event)"
          >
            <ng-template starChartTooltip let-points let-label="label">
              <span class="star-chart__tip-title">{{ label }}</span>
              @for (point of points; track point.seriesIndex) {
                <span class="star-chart__tip-row"
                  >{{ point.series }}: {{ point.value }} orders</span
                >
              }
            </ng-template>
          </star-chart>
          <p class="docs-output" role="status">
            Selected:
            {{
              picked()
                ? orders[picked()!.seriesIndex].label +
                  ', ' +
                  months[picked()!.index] +
                  ': ' +
                  picked()!.value
                : 'none'
            }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Value format and axis range"
        source="chart/value-format"
        note="valueFormat takes Intl.NumberFormat options for the axis, the tooltip, the table and the names of the points. min, max and stepSize fix the value axis; values beyond an end stop at that end."
      >
        <star-chart
          type="bar"
          title="Revenue per region"
          locale="en-US"
          [labels]="regions"
          [series]="revenue"
          [valueFormat]="euro"
          [min]="0"
          [max]="60000"
          [stepSize]="15000"
        />
      </docs-example>

      <docs-example
        heading="Horizontal bars"
        source="chart/horizontal"
        note="horizontal turns a bar or stacked bar chart on its side: the bars run along the line and the category names go down the side, with room for long names."
      >
        <star-chart
          type="bar"
          horizontal
          title="Orders per region"
          [labels]="longRegions"
          [series]="regionChannels"
        />
      </docs-example>

      <docs-example
        heading="Combo chart with a second axis"
        source="chart/combo"
        [script]="comboScript"
        note="In a bar, line or area chart, a series can set type ('bar' or 'line') and axis ('primary' or 'secondary'). Here the order count is bars on the left axis and the return rate is a line on a second axis at the end of the plot. The second axis is titled with the names of its series, and the legend marks them (right axis)."
      >
        <star-chart type="bar" title="Orders and return rate" [labels]="months" [series]="combo" />
      </docs-example>

      <docs-example
        heading="Export as SVG or PNG"
        source="chart/export"
        [script]="exportScript"
        note="exportSvg() returns the plot as a stand-alone SVG document: the colors of the tokens are resolved and the title is in it. exportPng(scale) draws it on a canvas and resolves to a PNG Blob. Both work in the browser only: on the server exportSvg() returns an empty string and exportPng() resolves to null."
      >
        <div class="docs-stack">
          <star-chart
            #exported
            type="bar"
            title="Orders per month, export"
            [labels]="months"
            [series]="orders"
          />
          <div class="docs-row">
            <button
              type="button"
              class="star-btn star-btn--secondary"
              (click)="downloadSvg(exported)"
            >
              Download SVG
            </button>
            <button
              type="button"
              class="star-btn star-btn--secondary"
              (click)="downloadPng(exported)"
            >
              Download PNG
            </button>
          </div>
        </div>
      </docs-example>

      <docs-example
        heading="Legend: hide series and placement"
        source="chart/legend"
        [script]="legendScript"
        note="Each name in the legend is a toggle button (aria-pressed): a click hides or shows its series, and the hiddenSeries model holds the positions of the hidden series. Colors and markers stay with their series. The data table keeps every series. legendPosition places the legend at the top (default), the bottom, the start or the end."
      >
        <div class="docs-stack">
          <star-chart
            type="line"
            title="Orders by channel"
            [labels]="months"
            [series]="channelOrders"
            [(hiddenSeries)]="hiddenChannels"
            legendPosition="end"
          />
          <p class="docs-output" role="status">
            Hidden series: {{ hiddenChannels().join(', ') || 'none' }}
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Sizing"
        source="chart/sizing"
        note="The chart fills the width of its container and keeps its aspect ratio (the view box does not change). Set the width on a wrapper. In a narrow container the axis text grows back to stay readable, and the category labels thin out: here every second month has a label. The focus targets, the tooltip and the table keep every month."
      >
        <div class="docs-chart-narrow">
          <star-chart type="bar" title="Orders, narrow" [labels]="months" [series]="single" />
        </div>
        <div class="docs-chart-narrow">
          <star-chart
            type="line"
            title="Visits per month, narrow"
            [labels]="yearMonths"
            [series]="yearVisits"
          />
        </div>
      </docs-example>

      <h2>Choosing a chart</h2>
      <ul>
        <li>
          <strong>Bar</strong>: compare values of a few categories, one bar per series.
          <strong>Stacked bar</strong>: show how a total divides into parts. Use the percent input
          when the shares matter more than the totals. Segments that do not start at the baseline
          are hard to compare between columns, so use a grouped bar when exact comparison of every
          series is the goal.
        </li>
        <li>
          <strong>Line</strong> and <strong>area</strong>: change over ordered categories such as
          months. Use an area chart for one series, or for a few series that do not hide each other.
        </li>
        <li>
          <strong>Doughnut</strong> and <strong>pie</strong>: parts of a whole with a few categories
          (the three largest are shown, the rest is grouped as Other).
        </li>
        <li>
          <strong>Radar</strong>: compare the profile of two or three items over the same 5 to 12
          criteria on one scale. It does not suit criteria with different units, or many series.
        </li>
        <li>
          <strong>Polar area</strong>: one value per category when the categories repeat in a cycle,
          such as weekdays or hours. For a plain comparison a bar chart reads better.
        </li>
        <li>
          <strong>Scatter</strong>: the relation of two measured values, one point per item. Use it
          when the x values are measurements and not a fixed list of categories.
        </li>
      </ul>

      <h2>Stacked bar, radar, polar area and scatter</h2>
      <ul>
        <li>
          <strong>Negative values.</strong> A stacked bar stacks negative values below the baseline
          and positive values above it. A radar chart puts the lowest end of its scale in the
          center. A polar area chart cannot draw a negative area, so it reads a negative value as 0.
        </li>
        <li>
          <strong>Missing values.</strong> A value that is <code>null</code>, <code>NaN</code> or
          not finite counts as 0 in stacked bar, radar and polar area charts. A scatter point with a
          missing x or y is not drawn and is not in the table.
        </li>
        <li>
          <strong>Polar area scale.</strong> The area of a sector, not its radius, carries the
          value, because the eye reads area. A value four times as large has a sector with four
          times the area and twice the radius.
        </li>
        <li>
          <strong>Colors and marks.</strong> Marks have an outline in a darker tone of the series
          color, so they keep 3:1 contrast with the background in both themes. Radar and scatter
          also give each series its own marker shape. A polar area chart uses one color because the
          categories are named at the chart, not in a legend.
        </li>
        <li>
          <strong>Long labels.</strong> Labels are cut to fit their column or axis, with an
          ellipsis. The full text shows as a title and stays in the table.
        </li>
      </ul>

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

      <h2>Right-to-left</h2>
      <p>
        The plot keeps its left-to-right geometry in a right-to-left page, as numeric axes do. The
        title, the legend and the data table follow the page direction and start on the right. See
        the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarChart', 'StarChartTooltip']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ChartPage {
  protected readonly euro: Intl.NumberFormatOptions = {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  };
  protected readonly combo: StarChartSeries[] = [
    { label: 'Orders', data: [120, 150, 170, 140, 190, 210] },
    {
      label: 'Return rate (%)',
      data: [4.2, 3.8, 5.1, 4.6, 3.2, 2.9],
      type: 'line',
      axis: 'secondary',
    },
  ];
  protected readonly comboScript = `readonly combo: StarChartSeries[] = [
  { label: 'Orders', data: [120, 150, 170, 140, 190, 210] },
  { label: 'Return rate (%)', data: [4.2, 3.8, 5.1, 4.6, 3.2, 2.9], type: 'line', axis: 'secondary' },
];`;
  protected downloadSvg(chart: StarChart): void {
    const svg = chart.exportSvg();
    if (svg) this.download(new Blob([svg], { type: 'image/svg+xml' }), 'orders.svg');
  }
  protected async downloadPng(chart: StarChart): Promise<void> {
    const png = await chart.exportPng(2);
    if (png) this.download(png, 'orders.png');
  }
  private download(blob: Blob, name: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  }
  protected readonly exportScript = `downloadPng(chart: StarChart): void {
  chart.exportPng(2).then((png) => {
    if (!png) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(png);
    link.download = 'orders.png';
    link.click();
    URL.revokeObjectURL(link.href);
  });
}`;
  protected readonly hiddenChannels = signal<readonly number[]>([2]);
  protected readonly legendScript = `readonly hiddenChannels = signal<readonly number[]>([2]);`;
  protected readonly picked = signal<StarChartPointSelectEvent | null>(null);
  protected readonly interactionScript = `readonly picked = signal<StarChartPointSelectEvent | null>(null);`;
  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template starChartTooltip',
      description:
        'Content of the tooltip. Context: $implicit and points (seriesIndex, index, value, series, label of each point at the hover position), label (the category, or the series for scatter).',
    },
  ];
  protected readonly months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  protected readonly yearMonths = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  protected readonly yearVisits: StarChartSeries[] = [
    { label: 'Visits', data: [820, 940, 910, 880, 1020, 960, 870, 900, 1100, 1180, 1250, 1320] },
  ];
  protected readonly orders: StarChartSeries[] = [
    { label: 'Received', data: [120, 150, 170, 140, 190, 210] },
    { label: 'Shipped', data: [110, 140, 160, 135, 180, 200] },
  ];
  protected readonly single: StarChartSeries[] = [
    { label: 'Received', data: [120, 150, 170, 140, 190, 210] },
  ];
  protected readonly channelOrders: StarChartSeries[] = [
    { label: 'Web', data: [120, 150, 170, 140, 190, 210] },
    { label: 'Mobile app', data: [80, 95, 120, 130, 150, 185] },
    { label: 'Phone', data: [40, 38, 35, 30, 28, 25] },
    { label: 'Partner', data: [25, 30, 28, 45, 52, 60] },
  ];
  protected readonly criteria = [
    'Battery',
    'Display',
    'Sound',
    'Build',
    'Value for money',
    'Support',
  ];
  protected readonly ratings: StarChartSeries[] = [
    { label: 'Model A', data: [8, 6, 7, 9, 5, 7] },
    { label: 'Model B', data: [6, 9, 8, 7, 6, 5] },
    { label: 'Model C', data: [7, 7, 5, 6, 9, 8] },
  ];
  protected readonly longRegions = [
    'Northern coastal region',
    'Southern inland region',
    'Eastern highlands',
  ];
  protected readonly regionChannels: StarChartSeries[] = [
    { label: 'Web', data: [120, 90, 60] },
    { label: 'Phone', data: [30, 45, 20] },
  ];
  protected readonly longCriteria = [
    'Battery life under heavy load',
    'Display brightness outdoors',
    'Sound',
    'Build quality and materials',
    'Value for money',
    'Customer support response',
  ];
  protected readonly weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly weekdayVisits: StarChartSeries[] = [
    { label: 'Visits', data: [820, 940, 910, 880, 1020, 460, 310] },
  ];
  protected readonly products: StarChartPointSeries[] = [
    {
      label: 'Backpacks',
      data: [
        { x: 0.6, y: 35 },
        { x: 0.9, y: 52 },
        { x: 1.1, y: 48 },
        { x: 1.4, y: 79 },
        { x: 1.8, y: 95 },
        { x: 2.1, y: 88 },
      ],
    },
    {
      label: 'Suitcases',
      data: [
        { x: 2.4, y: 110 },
        { x: 3.1, y: 135 },
        { x: 3.6, y: 180 },
        { x: 4.2, y: 165 },
        { x: 4.9, y: 240 },
        { x: 5.5, y: 215 },
      ],
    },
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
    {
      name: '--star-border-strong',
      description: 'Color of the hover crosshair of line charts and the zero line of stacked bars.',
    },
    { name: '--star-text-muted', description: 'Color of axis labels and the legend.' },
    {
      name: '--star-surface',
      description:
        'Gap between marks, ring around line dots, and halo behind the ring labels of radar and polar area charts.',
    },
    {
      name: '--star-text-strong',
      description:
        'Mixed into the series color to make the outline of stacked bar, radar, polar area and scatter marks.',
    },
    { name: '--star-tooltip-surface', description: 'Background of the hover tooltip.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab, then Enter or Space',
      description:
        'Focuses the Table / Chart button and switches the view. The chart has an accessible name (the title) and a description: the kind of chart, the number of series and items, and the range of values.',
    },
    {
      name: 'Tab to the data points',
      description:
        'One tab stop for all points. Each point reads its series, category and value, and shows the tooltip.',
    },
    {
      name: 'Arrow Right / Arrow Left, Home / End',
      description: 'Moves along the series. The plot keeps left to right in right-to-left pages.',
    },
    { name: 'Arrow Down / Arrow Up', description: 'Moves to the next or the previous series.' },
    {
      name: 'Horizontal bars',
      description:
        'The categories run down the side, so Arrow Down and Arrow Up move along a series, and Arrow Right and Arrow Left move between the series.',
    },
    { name: 'Enter / Space', description: 'Selects the focused point (pointSelect).' },
  ];
}
