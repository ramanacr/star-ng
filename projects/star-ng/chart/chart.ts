import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { STAR_UI_TEXT } from 'star-ng/core';
import {
  areaRadius,
  axisAngles,
  cleanPoints,
  labelAnchor,
  labelOffset,
  linearRadius,
  markerPath,
  niceScale,
  polarPoint,
  polarSectors,
  polygonPath,
  ringPath,
  scalePosition,
  scatterScales,
  sectorPath,
  stackColumns,
  stackExtent,
  StarChartScale,
  StarChartStackSegment,
  tickDecimals,
  toFinite,
  truncateLabel,
} from './chart-geometry';

export interface StarChartSeries {
  readonly label: string;
  readonly data: readonly number[];
}

/** One point of a scatter series. */
export interface StarChartPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A scatter series: points with an x and a y value. Points with a missing or not finite `x` or
 * `y` are left out of the plot and the table.
 */
export interface StarChartPointSeries {
  readonly label: string;
  readonly data: readonly StarChartPoint[];
}

export type StarChartType =
  'bar' | 'stacked-bar' | 'line' | 'area' | 'doughnut' | 'pie' | 'radar' | 'polar-area' | 'scatter';

/**
 * Categorical slots, in fixed order (never cycled). Validated with the dataviz palette checks:
 * light on #ffffff and dark on #0f1216 pass lightness, chroma, CVD (adjacent ΔE ≥ 8.4) and
 * normal-vision floors. Slots 3–5 are below 3:1 on white, so every chart ships a table view.
 * Defined as design tokens `--star-chart-1…8` in `styles/_tokens.scss`.
 */
export const STAR_CHART_SLOTS = 8;
/** Doughnut slices compare every pair: the first 4 slots pass all-pairs; the rest fold into "Other". */
const DOUGHNUT_SLOTS = 4;

const W = 640;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 36, left: 48 };
/** Scatter has axis titles, so it keeps more room at the left, top and bottom. */
const SCATTER_PAD = { top: 24, right: 20, bottom: 44, left: 56 };
/** Radar and polar area use a squarer view box than the axis charts: the plot is a circle. */
const RADIAL_W = 520;
const RADIAL_H = 300;
/** Radius of the radar and polar area plots, and the room for the labels around them. */
const RADIAL = 105;
const RADIAL_LABEL_GAP = 12;
/** Longest category label at a radar or polar axis, in characters, before it is cut. */
const RADIAL_LABEL_CHARS = 18;
const MARKER_RADIUS = 5;

/** The number of an element of a series: a plain value, or the y of a point. */
function valueOf(element: number | StarChartPoint): number {
  return element !== null && typeof element === 'object' ? element.y : element;
}

function extentOf(values: readonly number[]): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const raw of values) {
    const v = toFinite(raw, NaN);
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min <= max ? { min, max } : { min: 0, max: 0 };
}

/**
 * Chart (PrimeNG `p-chart` without Chart.js): dependency-free SVG bar, stacked bar, line, area,
 * doughnut, pie, radar, polar area and scatter charts.
 * One y-axis, recessive grid, 2px lines, 4px rounded bar ends on the baseline, 2px surface gaps,
 * legend for 2+ series, hover tooltip per mark (crosshair on line), and a data table (visible on
 * demand, always present for screen readers). Colors are fixed series slots in both themes.
 *
 * ```html
 * <star-chart type="bar" title="Orders per month" [labels]="months" [series]="volume" />
 * ```
 */
@Component({
  selector: 'star-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-chart' },
  template: `
    <figure
      class="star-chart__figure"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="descriptionId"
    >
      <figcaption class="star-chart__head">
        <span class="star-chart__title" [id]="titleId">{{ title() }}</span>
        <button
          type="button"
          class="star-btn star-btn--ghost star-btn--sm"
          [attr.aria-pressed]="showTable()"
          (click)="showTable.set(!showTable())"
        >
          <i
            class="ph-bold"
            [class.ph-table]="!showTable()"
            [class.ph-chart-bar]="showTable()"
            aria-hidden="true"
          ></i>
          {{ showTable() ? text.chartView : text.tableView }}
        </button>
      </figcaption>
      <p class="star-sr-only" [id]="descriptionId">{{ description() }}</p>

      @if (legend().length > 1 && !showTable()) {
        <ul class="star-chart__legend" aria-hidden="true">
          @for (item of legend(); track item.label) {
            <li>
              @if (item.shape) {
                <svg class="star-chart__swatch-shape" viewBox="-6 -6 12 12">
                  <path
                    class="star-chart__mark star-chart__marker"
                    [attr.d]="item.shape"
                    [style.--mark]="item.color"
                  />
                </svg>
              } @else {
                <span class="star-chart__swatch" [style.background]="item.color"></span>
              }
              {{ item.label }}
            </li>
          }
        </ul>
      }

      <div
        class="star-chart__plot"
        [hidden]="showTable()"
        aria-hidden="true"
        (mouseleave)="hover.set(null)"
      >
        @switch (kind()) {
          @case ('round') {
            <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="star-chart__svg">
              <g [attr.transform]="'translate(' + W / 2 + ',' + H / 2 + ')'">
                @for (slice of slices(); track slice.label; let i = $index) {
                  <path
                    class="star-chart__slice"
                    [attr.d]="slice.path"
                    [style.fill]="slice.color"
                    [class.star-chart__mark--dim]="hover() !== null && hover() !== i"
                    (mouseenter)="hover.set(i)"
                  />
                }
                @if (type() === 'doughnut') {
                  <text class="star-chart__total" y="-2" text-anchor="middle">
                    {{ format(total()) }}
                  </text>
                  <text class="star-chart__total-label" y="18" text-anchor="middle">
                    {{ text.chartTotal }}
                  </text>
                }
              </g>
            </svg>
            @if (hover() !== null) {
              @let slice = slices()[hover()!];
              @if (slice) {
                <div class="star-chart__tip" [style.left.%]="50" [style.top.%]="8">
                  <span class="star-chart__swatch" [style.background]="slice.color"></span>
                  {{ slice.label }}: <strong>{{ format(slice.value) }}</strong> ({{
                    slice.percent
                  }}%)
                </div>
              }
            }
          }
          @case ('radar') {
            @let plot = radar();
            <svg [attr.viewBox]="'0 0 ' + RW + ' ' + RH" class="star-chart__svg">
              <g [attr.transform]="'translate(' + RW / 2 + ',' + RH / 2 + ')'">
                @for (ring of plot.rings; track ring.value) {
                  <path class="star-chart__ring" [attr.d]="ring.path" />
                }
                @for (spoke of plot.spokes; track $index) {
                  <line
                    class="star-chart__grid"
                    x1="0"
                    y1="0"
                    [attr.x2]="spoke.x"
                    [attr.y2]="spoke.y"
                  />
                }
                @if (hover() !== null && plot.spokes[hover()!]) {
                  <line
                    class="star-chart__crosshair"
                    x1="0"
                    y1="0"
                    [attr.x2]="plot.spokes[hover()!].x"
                    [attr.y2]="plot.spokes[hover()!].y"
                  />
                }
                @for (polygon of plot.polygons; track polygon.label) {
                  <path
                    class="star-chart__mark star-chart__polygon"
                    [attr.d]="polygon.path"
                    [style.--mark]="polygon.color"
                  />
                }
                @for (polygon of plot.polygons; track polygon.label) {
                  @for (vertex of polygon.vertices; track vertex.index) {
                    <path
                      class="star-chart__mark star-chart__vertex"
                      [attr.d]="vertex.shape"
                      [style.--mark]="polygon.color"
                    />
                  }
                }
                @for (ring of plot.rings; track ring.value) {
                  <text
                    class="star-chart__ring-label"
                    [attr.x]="4"
                    [attr.y]="-ring.radius + 11"
                    text-anchor="start"
                  >
                    {{ ring.text }}
                  </text>
                }
                @for (label of plot.labels; track $index) {
                  <text
                    class="star-chart__axis"
                    [attr.x]="label.x"
                    [attr.y]="label.y"
                    [attr.dy]="label.dy"
                    [attr.text-anchor]="label.anchor"
                  >
                    {{ label.text }}
                    @if (label.text !== label.full) {
                      <title>{{ label.full }}</title>
                    }
                  </text>
                }
                @for (hit of plot.hits; track $index; let i = $index) {
                  <path class="star-chart__hit" [attr.d]="hit" (mouseenter)="hover.set(i)" />
                }
              </g>
            </svg>
            @if (hover() !== null && labels()[hover()!] !== undefined) {
              <div class="star-chart__tip star-chart__tip--corner">
                <span class="star-chart__tip-title">{{ labels()[hover()!] }}</span>
                @for (s of drawn(); track s.label; let si = $index) {
                  <span class="star-chart__tip-row">
                    <span class="star-chart__swatch" [style.background]="color(si)"></span>
                    {{ s.label }}: <strong>{{ cell(s, hover()!) }}</strong>
                  </span>
                }
              </div>
            }
          }
          @case ('polar') {
            @let plot = polar();
            <svg [attr.viewBox]="'0 0 ' + RW + ' ' + RH" class="star-chart__svg">
              <g [attr.transform]="'translate(' + RW / 2 + ',' + RH / 2 + ')'">
                @for (ring of plot.rings; track ring.value) {
                  <circle class="star-chart__ring" [attr.r]="ring.radius" />
                }
                @for (sector of plot.sectors; track sector.index) {
                  @if (sector.path) {
                    <path
                      class="star-chart__mark star-chart__sector"
                      [attr.d]="sector.path"
                      [style.--mark]="color(0)"
                      [class.star-chart__mark--dim]="hover() !== null && hover() !== sector.index"
                    />
                  }
                }
                @for (ring of plot.rings; track ring.value) {
                  <text
                    class="star-chart__ring-label"
                    [attr.x]="ring.x"
                    [attr.y]="ring.y"
                    text-anchor="start"
                  >
                    {{ ring.text }}
                  </text>
                }
                @for (sector of plot.sectors; track sector.index) {
                  <text
                    class="star-chart__axis"
                    [attr.x]="sector.label.x"
                    [attr.y]="sector.label.y"
                    [attr.dy]="sector.label.dy"
                    [attr.text-anchor]="sector.label.anchor"
                  >
                    {{ sector.label.text }}
                    @if (sector.label.text !== sector.label.full) {
                      <title>{{ sector.label.full }}</title>
                    }
                  </text>
                }
                @for (sector of plot.sectors; track sector.index) {
                  <path
                    class="star-chart__hit"
                    [attr.d]="sector.hit"
                    (mouseenter)="hover.set(sector.index)"
                  />
                }
              </g>
            </svg>
            @if (hover() !== null) {
              @let sector = plot.sectors[hover()!];
              @if (sector) {
                <div class="star-chart__tip star-chart__tip--corner">
                  <span class="star-chart__tip-title">{{ sector.label.full }}</span>
                  <span class="star-chart__tip-row">
                    <span class="star-chart__swatch" [style.background]="color(0)"></span>
                    {{ valueName() }}: <strong>{{ format(sector.value) }}</strong>
                  </span>
                </div>
              }
            }
          }
          @case ('scatter') {
            @let plot = scatter();
            <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="star-chart__svg">
              @for (tick of plot.yTicks; track tick.value) {
                <line
                  class="star-chart__grid"
                  [attr.x1]="SP.left"
                  [attr.x2]="W - SP.right"
                  [attr.y1]="tick.position"
                  [attr.y2]="tick.position"
                />
                <text
                  class="star-chart__axis"
                  [attr.x]="SP.left - 8"
                  [attr.y]="tick.position + 4"
                  text-anchor="end"
                >
                  {{ tick.text }}
                </text>
              }
              @for (tick of plot.xTicks; track tick.value) {
                <line
                  class="star-chart__grid"
                  [attr.x1]="tick.position"
                  [attr.x2]="tick.position"
                  [attr.y1]="SP.top"
                  [attr.y2]="H - SP.bottom"
                />
                <text
                  class="star-chart__axis"
                  [attr.x]="tick.position"
                  [attr.y]="H - SP.bottom + 16"
                  text-anchor="middle"
                >
                  {{ tick.text }}
                </text>
              }
              @if (categoryLabel()) {
                <text
                  class="star-chart__axis-title"
                  [attr.x]="W - SP.right"
                  [attr.y]="H - 4"
                  text-anchor="end"
                >
                  {{ categoryLabel() }}
                </text>
              }
              @if (valueLabel()) {
                <text class="star-chart__axis-title" x="4" y="12" text-anchor="start">
                  {{ valueLabel() }}
                </text>
              }
              @for (point of plot.points; track point.index) {
                <path
                  class="star-chart__mark star-chart__point"
                  [attr.d]="point.shape"
                  [style.--mark]="point.color"
                  [class.star-chart__mark--dim]="hover() !== null && hover() !== point.index"
                />
              }
              @for (point of plot.points; track point.index) {
                <circle
                  class="star-chart__hit"
                  r="10"
                  [attr.cx]="point.px"
                  [attr.cy]="point.py"
                  (mouseenter)="hover.set(point.index)"
                />
              }
            </svg>
            @if (hover() !== null) {
              @let point = plot.points[hover()!];
              @if (point) {
                <div
                  class="star-chart__tip star-chart__tip--point"
                  [style.left.%]="(point.px / W) * 100"
                  [style.top.%]="(point.py / H) * 100"
                  [style.translate]="
                    point.px / W > 0.7 ? '-100% 0' : point.px / W < 0.3 ? '0 0' : null
                  "
                >
                  <span class="star-chart__tip-title">{{ point.seriesLabel }}</span>
                  <span class="star-chart__tip-row">
                    <svg class="star-chart__swatch-shape" viewBox="-6 -6 12 12">
                      <path
                        class="star-chart__mark star-chart__marker"
                        [attr.d]="point.legendShape"
                        [style.--mark]="point.color"
                      />
                    </svg>
                    {{ xName() }}: <strong>{{ precise(point.x) }}</strong>
                  </span>
                  <span class="star-chart__tip-row star-chart__tip-indent">
                    {{ yName() }}: <strong>{{ precise(point.y) }}</strong>
                  </span>
                </div>
              }
            }
          }
          @default {
            <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="star-chart__svg">
              @for (tick of ticks(); track tick) {
                <line
                  class="star-chart__grid"
                  [attr.x1]="PAD.left"
                  [attr.x2]="W - PAD.right"
                  [attr.y1]="y(tick)"
                  [attr.y2]="y(tick)"
                />
                <text
                  class="star-chart__axis"
                  [attr.x]="PAD.left - 8"
                  [attr.y]="y(tick) + 4"
                  text-anchor="end"
                >
                  {{ yTick()(tick) }}
                </text>
              }
              @if (yScale().min < 0) {
                <line
                  class="star-chart__baseline"
                  [attr.x1]="PAD.left"
                  [attr.x2]="W - PAD.right"
                  [attr.y1]="y(0)"
                  [attr.y2]="y(0)"
                />
              }
              @for (label of axisLabels(); track $index; let i = $index) {
                <text
                  class="star-chart__axis"
                  [attr.x]="x(i)"
                  [attr.y]="H - 12"
                  text-anchor="middle"
                >
                  {{ label.text }}
                  @if (label.text !== label.full) {
                    <title>{{ label.full }}</title>
                  }
                </text>
              }
              @if (type() === 'bar') {
                @for (bar of bars(); track bar.key) {
                  <path
                    class="star-chart__bar"
                    [attr.d]="bar.path"
                    [style.fill]="bar.color"
                    [class.star-chart__mark--dim]="hover() !== null && hover() !== bar.index"
                  />
                }
              } @else if (type() === 'stacked-bar') {
                @for (segment of segments(); track segment.key) {
                  <rect
                    class="star-chart__mark star-chart__segment"
                    [attr.x]="segment.x"
                    [attr.y]="segment.y"
                    [attr.width]="segment.width"
                    [attr.height]="segment.height"
                    [style.--mark]="segment.color"
                    [class.star-chart__mark--dim]="hover() !== null && hover() !== segment.index"
                  />
                }
              } @else {
                @if (hover() !== null) {
                  <line
                    class="star-chart__crosshair"
                    [attr.x1]="x(hover()!)"
                    [attr.x2]="x(hover()!)"
                    [attr.y1]="PAD.top"
                    [attr.y2]="H - PAD.bottom"
                  />
                }
                @for (line of lines(); track line.label) {
                  @if (type() === 'area') {
                    <path class="star-chart__area" [attr.d]="line.area" [style.fill]="line.color" />
                  }
                  <path class="star-chart__line" [attr.d]="line.path" [style.stroke]="line.color" />
                  @if (hover() !== null) {
                    <circle
                      class="star-chart__dot"
                      r="4.5"
                      [attr.cx]="x(hover()!)"
                      [attr.cy]="y(line.data[hover()!] ?? 0)"
                      [style.fill]="line.color"
                    />
                  }
                }
              }
              <!-- Hit targets: one full-height column per category, wider than the marks. -->
              @for (label of labels(); track $index; let i = $index) {
                <rect
                  class="star-chart__hit"
                  [attr.x]="x(i) - band() / 2"
                  [attr.y]="PAD.top"
                  [attr.width]="band()"
                  [attr.height]="H - PAD.top - PAD.bottom"
                  (mouseenter)="hover.set(i)"
                />
              }
            </svg>
            @if (hover() !== null) {
              <div
                class="star-chart__tip"
                [style.left.%]="(x(hover()!) / W) * 100"
                [style.top.%]="6"
              >
                <span class="star-chart__tip-title">{{ labels()[hover()!] }}</span>
                @for (s of drawn(); track s.label; let si = $index) {
                  <span class="star-chart__tip-row">
                    <span class="star-chart__swatch" [style.background]="color(si)"></span>
                    {{ s.label }}: <strong>{{ cell(s, hover()!) }}</strong>
                    @if (type() === 'stacked-bar' && percent()) {
                      ({{ share(stack()[hover()!]?.segments?.[si]) }}%)
                    }
                  </span>
                }
                @if (type() === 'stacked-bar') {
                  <span class="star-chart__tip-row star-chart__tip-total">
                    {{ text.chartTotal }}:
                    <strong>{{ format(stack()[hover()!]?.total ?? 0) }}</strong>
                  </span>
                }
              </div>
            }
          }
        }
      </div>

      <table class="star-chart__table" [class.star-sr-only]="!showTable()">
        <caption class="star-sr-only">
          {{
            title()
          }}
        </caption>
        <thead>
          <tr>
            <th scope="col">
              {{ firstHeader() }}
            </th>
            @if (round()) {
              <th scope="col">{{ series()[0]?.label ?? text.chartValue }}</th>
              <th scope="col">{{ text.chartShare }}</th>
            } @else if (kind() === 'polar') {
              <th scope="col">{{ valueName() }}</th>
            } @else if (kind() === 'scatter') {
              <th scope="col">{{ xName() }}</th>
              <th scope="col">{{ yName() }}</th>
            } @else {
              @for (s of series(); track s.label) {
                <th scope="col">{{ s.label }}</th>
              }
              @if (type() === 'stacked-bar') {
                <th scope="col">{{ text.chartTotal }}</th>
              }
            }
          </tr>
        </thead>
        <tbody>
          @if (round()) {
            @for (slice of slices(); track slice.label) {
              <tr>
                <th scope="row">{{ slice.label }}</th>
                <td>{{ format(slice.value) }}</td>
                <td>{{ slice.percent }}%</td>
              </tr>
            }
          } @else if (kind() === 'polar') {
            @for (label of labels(); track $index; let i = $index) {
              <tr>
                <th scope="row">{{ label }}</th>
                <td>{{ cell(numeric()[0], i) }}</td>
              </tr>
            }
          } @else if (kind() === 'scatter') {
            @for (row of scatterRows(); track $index) {
              <tr>
                <th scope="row">{{ row.series }}</th>
                <td>{{ precise(row.x) }}</td>
                <td>{{ precise(row.y) }}</td>
              </tr>
            }
          } @else {
            @for (label of labels(); track $index; let i = $index) {
              <tr>
                <th scope="row">{{ label }}</th>
                @for (s of numeric(); track s.label) {
                  <td>{{ cell(s, i) }}</td>
                }
                @if (type() === 'stacked-bar') {
                  <td>{{ format(stack()[i]?.total ?? 0) }}</td>
                }
              </tr>
            }
          }
        </tbody>
      </table>
    </figure>
  `,
})
export class StarChart {
  protected readonly text = inject(STAR_UI_TEXT);
  protected readonly W = W;
  protected readonly H = H;
  protected readonly RW = RADIAL_W;
  protected readonly RH = RADIAL_H;
  protected readonly PAD = PAD;
  protected readonly SP = SCATTER_PAD;
  private readonly ids = inject(_IdGenerator);
  protected readonly titleId = this.ids.getId('star-chart-');
  protected readonly descriptionId = this.ids.getId('star-chart-description-');

  /**
   * `'area'` is a line chart with a soft fill under each line. `'pie'` is a doughnut without
   * the hole and the total; like the doughnut it shows the top 3 categories and "Other".
   * `'stacked-bar'` stacks the series of a category in one column. `'radar'` draws one polygon per
   * series over one axis per category. `'polar-area'` draws one sector per category of the first
   * series, with the area of the sector in proportion to the value. `'scatter'` plots points from
   * `{ x, y }` data on two numeric axes.
   */
  readonly type = input<StarChartType>('bar');
  /**
   * Stacked bar only: scale every column to 100 percent, to compare the shares of the series
   * instead of the totals. The tooltip still shows the real values.
   */
  readonly percent = input(false, { transform: booleanAttribute });
  /** Doughnut or pie: one series as parts of a whole. */
  protected readonly round = computed(() => this.type() === 'doughnut' || this.type() === 'pie');
  protected readonly kind = computed<'round' | 'radar' | 'polar' | 'scatter' | 'axis'>(() => {
    switch (this.type()) {
      case 'doughnut':
      case 'pie':
        return 'round';
      case 'radar':
        return 'radar';
      case 'polar-area':
        return 'polar';
      case 'scatter':
        return 'scatter';
      default:
        return 'axis';
    }
  });
  readonly title = input.required<string>();
  /** Category labels (x axis, or doughnut slices). */
  readonly labels = input<readonly string[]>([]);
  /**
   * One or more series. Doughnut, pie and polar area use the first series only. More than 8
   * series are cut. Scatter takes `{ x, y }` points in `data`: plain numbers there are y values
   * with the position in the series as x.
   */
  readonly series = input<readonly (StarChartSeries | StarChartPointSeries)[]>([]);
  /** Name of the category column of the table. Scatter: name of the x axis and column. */
  readonly categoryLabel = input<string | null>(null);
  /** Scatter and polar area: name of the y axis and column, or of the value column. */
  readonly valueLabel = input<string | null>(null);
  readonly locale = input<string | undefined>(undefined);
  /** Start the table view open. */
  readonly table = input(false, { transform: booleanAttribute });

  protected readonly showTable = linkedSignal(() => this.table());
  protected readonly hover = signal<number | null>(null);

  private readonly numberFormat = computed(
    () => new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 1 }),
  );
  private readonly preciseFormat = computed(
    () => new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 3 }),
  );
  protected format(value: number): string {
    return this.numberFormat().format(value);
  }
  /** Up to 3 decimals: scatter values are measurements, not counts. */
  protected precise(value: number): string {
    return this.preciseFormat().format(value);
  }

  /** Axis tick text: just enough decimals to show every tick exactly. */
  private tickFormatter(ticks: readonly number[], suffix = ''): (value: number) => string {
    const digits = tickDecimals(ticks);
    const formatter = new Intl.NumberFormat(this.locale(), { maximumFractionDigits: digits });
    return (value) => formatter.format(value) + suffix;
  }

  protected color(index: number): string {
    return `var(--star-chart-${(index % STAR_CHART_SLOTS) + 1})`;
  }

  /** The series as numbers: a point of a scatter series counts as its y value. */
  protected readonly numeric = computed<readonly StarChartSeries[]>(() =>
    this.series().map((s) => ({
      label: s.label,
      data: (s.data as readonly (number | StarChartPoint)[]).map(valueOf),
    })),
  );
  /** The series that are drawn: the first 8. */
  protected readonly drawn = computed(() => this.numeric().slice(0, STAR_CHART_SLOTS));

  /** Table cell of a series at a category: a missing value reads as 0. */
  protected cell(series: StarChartSeries | undefined, index: number): string {
    return this.format(toFinite(series?.data[index]));
  }

  protected readonly firstHeader = computed(() =>
    this.round()
      ? this.text.chartCategory
      : this.kind() === 'scatter'
        ? this.text.chartSeries
        : (this.categoryLabel() ?? this.text.chartCategory),
  );
  protected readonly xName = computed(() => this.categoryLabel() ?? this.text.chartX);
  protected readonly yName = computed(() => this.valueLabel() ?? this.text.chartY);
  protected readonly valueName = computed(
    () => this.valueLabel() ?? this.series()[0]?.label ?? this.text.chartValue,
  );

  protected readonly legend = computed(() => {
    if (this.round())
      return this.slices().map((s) => ({ label: s.label, color: s.color, shape: '' }));
    // Polar area has one color: the categories are named at the axis, not in a legend.
    if (this.kind() === 'polar') return [];
    const marked = this.kind() === 'radar' || this.kind() === 'scatter';
    return this.drawn().map((s, i) => ({
      label: s.label,
      color: this.color(i),
      shape: marked ? markerPath(i, 0, 0, MARKER_RADIUS) : '',
    }));
  });

  /** Text of the accessible description: the kind of chart, its size and the range of values. */
  protected readonly description = computed(() => {
    const kind = this.kind();
    const kinds: Record<StarChartType, string> = {
      bar: this.text.chartTypeBar,
      'stacked-bar': this.text.chartTypeStackedBar,
      line: this.text.chartTypeLine,
      area: this.text.chartTypeArea,
      doughnut: this.text.chartTypeDoughnut,
      pie: this.text.chartTypePie,
      radar: this.text.chartTypeRadar,
      'polar-area': this.text.chartTypePolarArea,
      scatter: this.text.chartTypeScatter,
    };
    let seriesCount = this.drawn().length;
    let items = this.labels().length;
    let values: readonly number[];
    if (kind === 'scatter') {
      const points = this.scatterRows();
      items = points.length;
      values = points.map((p) => p.y);
    } else if (kind === 'round' || kind === 'polar') {
      seriesCount = Math.min(1, seriesCount);
      values = this.numeric()[0]?.data ?? [];
    } else {
      values = this.drawn().flatMap((s) => s.data);
    }
    const { min, max } = extentOf(values);
    return this.text.chartDescription(
      kinds[this.type()],
      seriesCount,
      items,
      this.format(min),
      this.format(max),
    );
  });

  // ---------- Axis charts: bar, stacked bar, line, area ----------

  protected readonly stack = computed(() =>
    stackColumns(
      this.drawn().map((s) => s.data),
      this.labels().length,
      this.percent(),
    ),
  );
  protected readonly yScale = computed<StarChartScale>(() => {
    if (this.type() === 'stacked-bar') {
      const { min, max } = stackExtent(this.stack());
      return niceScale(min, max, { includeZero: true });
    }
    return niceScale(0, extentOf(this.numeric().flatMap((s) => s.data)).max, {
      includeZero: true,
    });
  });
  protected readonly ticks = computed(() => this.yScale().ticks);
  protected readonly yTick = computed(() =>
    this.tickFormatter(this.ticks(), this.type() === 'stacked-bar' && this.percent() ? '%' : ''),
  );
  protected readonly band = computed(
    () => (W - PAD.left - PAD.right) / Math.max(1, this.labels().length),
  );
  /** Category labels cut to the width of their column, with the full text as a title. */
  protected readonly axisLabels = computed(() => {
    const max = Math.max(3, Math.floor(this.band() / 6.5));
    return this.labels().map((label) => ({ text: truncateLabel(label, max), full: label }));
  });

  protected x(index: number): number {
    return PAD.left + this.band() * (index + 0.5);
  }
  protected y(value: number): number {
    const { min, max } = this.yScale();
    return PAD.top + (1 - (value - min) / (max - min || 1)) * (H - PAD.top - PAD.bottom);
  }

  /** Grouped bars: 2px gap between neighbours, 4px rounded top, square base. */
  protected readonly bars = computed(() => {
    const series = this.drawn();
    const groupWidth = Math.min(this.band() * 0.7, 28 * series.length + 2 * (series.length - 1));
    const barWidth = (groupWidth - 2 * (series.length - 1)) / Math.max(1, series.length);
    const base = this.y(0);
    return this.labels().flatMap((_, i) =>
      series.map((s, si) => {
        const left = this.x(i) - groupWidth / 2 + si * (barWidth + 2);
        const top = this.y(toFinite(s.data[i]));
        const r = Math.min(4, barWidth / 2, Math.max(0, base - top));
        const path =
          `M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}` +
          `H${left + barWidth - r}Q${left + barWidth},${top} ${left + barWidth},${top + r}V${base}Z`;
        return { key: `${i}-${si}`, index: i, path, color: this.color(si) };
      }),
    );
  });

  /** Stacked bars: one rectangle per value that is not 0, outlined in a darker tone. */
  protected readonly segments = computed(() => {
    const width = Math.min(this.band() * 0.6, 64);
    return this.stack().flatMap((column, i) =>
      column.segments
        .filter((segment) => segment.start !== segment.end)
        .map((segment) => {
          const a = this.y(segment.start);
          const b = this.y(segment.end);
          return {
            key: `${i}-${segment.series}`,
            index: i,
            x: this.x(i) - width / 2,
            y: Math.min(a, b),
            width,
            height: Math.abs(a - b),
            color: this.color(segment.series),
          };
        }),
    );
  });

  /** Share of a stack segment in its column, in percent (percent mode). */
  protected share(segment: StarChartStackSegment | undefined): number {
    return segment ? Math.round(Math.abs(segment.end - segment.start) * 10) / 10 : 0;
  }

  protected readonly lines = computed(() =>
    this.drawn().map((s, si) => ({
      label: s.label,
      data: s.data,
      color: this.color(si),
      path: s.data.map((v, i) => `${i ? 'L' : 'M'}${this.x(i)},${this.y(v)}`).join(''),
      // Area: the line, then down to the baseline and back to the first point.
      area: s.data.length
        ? s.data.map((v, i) => `${i ? 'L' : 'M'}${this.x(i)},${this.y(v)}`).join('') +
          `L${this.x(s.data.length - 1)},${this.y(0)}L${this.x(0)},${this.y(0)}Z`
        : '',
    })),
  );

  // ---------- Doughnut and pie ----------

  protected readonly total = computed(() =>
    (this.numeric()[0]?.data ?? []).reduce((a, b) => a + b, 0),
  );

  /** Doughnut: top 3 categories + "Other" (4 slots validated for all-pairs comparison). */
  protected readonly slices = computed(() => {
    const data = this.numeric()[0]?.data ?? [];
    let items = this.labels().map((label, i) => ({ label, value: data[i] ?? 0 }));
    if (items.length > DOUGHNUT_SLOTS) {
      const sorted = [...items].sort((a, b) => b.value - a.value);
      const rest = sorted.slice(DOUGHNUT_SLOTS - 1).reduce((sum, item) => sum + item.value, 0);
      items = [
        ...sorted.slice(0, DOUGHNUT_SLOTS - 1),
        { label: this.text.chartOther, value: rest },
      ];
    }
    const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
    const outer = 110;
    const inner = this.type() === 'pie' ? 0 : 70;
    let angle = -Math.PI / 2;
    return items.map((item, i) => {
      const sweep = (item.value / total) * Math.PI * 2;
      const gap = items.length > 1 ? 0.02 : 0; // 2px-ish surface gap between slices
      const a0 = angle + gap / 2;
      const a1 = angle + sweep - gap / 2;
      angle += sweep;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (r: number, a: number) =>
        `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`;
      const full = sweep >= Math.PI * 2 - 0.001;
      const ring = full
        ? `M0,-${outer}A${outer},${outer} 0 1 1 -0.01,-${outer}ZM0,-${inner}A${inner},${inner} 0 1 0 0.01,-${inner}Z`
        : `M${p(outer, a0)}A${outer},${outer} 0 ${large} 1 ${p(outer, a1)}L${p(inner, a1)}A${inner},${inner} 0 ${large} 0 ${p(inner, a0)}Z`;
      const wedge = full
        ? `M0,-${outer}A${outer},${outer} 0 1 1 -0.01,-${outer}Z`
        : `M0,0L${p(outer, a0)}A${outer},${outer} 0 ${large} 1 ${p(outer, a1)}Z`;
      const path = inner ? ring : wedge;
      return {
        label: item.label,
        value: item.value,
        percent: Math.round((item.value / total) * 1000) / 10,
        color: this.color(i),
        path,
      };
    });
  });

  // ---------- Radar and polar area ----------

  /** Label at the end of an axis, cut to a fixed length with the full text as a title. */
  private axisLabel(label: string, angle: number) {
    const point = polarPoint(RADIAL + RADIAL_LABEL_GAP, angle);
    return {
      x: point.x,
      y: point.y,
      anchor: labelAnchor(angle),
      dy: labelOffset(angle),
      text: truncateLabel(label, RADIAL_LABEL_CHARS),
      full: label,
    };
  }

  /** Radar: one scale for all series, rings and spokes, one polygon and its markers per series. */
  protected readonly radar = computed(() => {
    const count = this.labels().length;
    const angles = axisAngles(count);
    const half = count ? Math.PI / count : 0;
    const values = this.drawn().flatMap((s) => s.data.slice(0, count));
    const { min, max } = extentOf(values);
    const scale = niceScale(min, max, { includeZero: true });
    const tick = this.tickFormatter(scale.ticks);
    return {
      scale,
      rings: scale.ticks
        .filter((t) => t > scale.min)
        .map((t) => {
          const radius = linearRadius(t, scale, RADIAL);
          return { value: t, radius, path: ringPath(angles, radius), text: tick(t) };
        }),
      spokes: angles.map((a) => polarPoint(RADIAL, a)),
      labels: this.labels().map((label, i) => this.axisLabel(label, angles[i])),
      hits: angles.map((a) => sectorPath(0, RADIAL + RADIAL_LABEL_GAP, a - half, a + half)),
      polygons: this.drawn().map((s, si) => {
        const points = angles.map((a, i) =>
          polarPoint(linearRadius(toFinite(s.data[i]), scale, RADIAL), a),
        );
        return {
          label: s.label,
          color: this.color(si),
          path: polygonPath(points),
          vertices: points.map((p, index) => ({
            index,
            shape: markerPath(si, p.x, p.y, MARKER_RADIUS - 1),
          })),
        };
      }),
    };
  });

  /**
   * Polar area: equal angles, and the area of a sector in proportion to its value, so the radius
   * grows with the square root of the value. The rings are at round values on that scale.
   */
  protected readonly polar = computed(() => {
    const count = this.labels().length;
    const data = this.labels().map((_, i) => Math.max(0, toFinite(this.numeric()[0]?.data[i])));
    const scale = niceScale(0, extentOf(data).max, { includeZero: true });
    const tick = this.tickFormatter(scale.ticks);
    const ringAngle = -Math.PI / 2 + (count ? Math.PI / count : 0);
    return {
      scale,
      rings: scale.ticks
        .filter((t) => t > 0)
        .map((t) => {
          const radius = areaRadius(t, scale.max, RADIAL);
          const at = polarPoint(radius, ringAngle);
          return { value: t, radius, text: tick(t), x: at.x + 3, y: at.y - 2 };
        }),
      sectors: polarSectors(data, scale.max, RADIAL).map((s) => ({
        ...s,
        path: sectorPath(0, s.radius, s.start, s.end),
        hit: sectorPath(0, RADIAL, s.start, s.end),
        label: this.axisLabel(this.labels()[s.index], s.mid),
      })),
    };
  });

  // ---------- Scatter ----------

  /** Points with a finite x and y, per series (all series, for the table). */
  private readonly scatterData = computed(() =>
    this.series().map((s) => {
      const data = s.data as readonly (number | StarChartPoint | null | undefined)[];
      const points = data.map((element, i) =>
        typeof element === 'number' ? { x: i, y: element } : element,
      );
      return { label: s.label, points: cleanPoints(points) };
    }),
  );
  protected readonly scatterRows = computed(() =>
    this.scatterData().flatMap((s) => s.points.map((p) => ({ series: s.label, x: p.x, y: p.y }))),
  );

  protected readonly scatter = computed(() => {
    const drawn = this.scatterData().slice(0, STAR_CHART_SLOTS);
    const scales = scatterScales(drawn.flatMap((s) => s.points));
    const left = SCATTER_PAD.left;
    const right = W - SCATTER_PAD.right;
    const top = SCATTER_PAD.top;
    const bottom = H - SCATTER_PAD.bottom;
    const xText = this.tickFormatter(scales.x.ticks);
    const yText = this.tickFormatter(scales.y.ticks);
    let index = 0;
    return {
      xTicks: scales.x.ticks.map((value) => ({
        value,
        position: scalePosition(value, scales.x, left, right),
        text: xText(value),
      })),
      yTicks: scales.y.ticks.map((value) => ({
        value,
        position: scalePosition(value, scales.y, bottom, top),
        text: yText(value),
      })),
      points: drawn.flatMap((s, si) =>
        s.points.map((p) => {
          const px = scalePosition(p.x, scales.x, left, right);
          const py = scalePosition(p.y, scales.y, bottom, top);
          return {
            index: index++,
            seriesLabel: s.label,
            color: this.color(si),
            x: p.x,
            y: p.y,
            px,
            py,
            // The shape repeats the series color: series stay apart where two colors are close.
            shape: markerPath(si, px, py, MARKER_RADIUS),
            legendShape: markerPath(si, 0, 0, MARKER_RADIUS),
          };
        }),
      ),
    };
  });
}
