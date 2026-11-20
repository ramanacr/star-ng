import { _IdGenerator } from '@angular/cdk/a11y';
import { isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChild,
  DestroyRef,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import {
  injectStarControlDefaults,
  STAR_UI_TEXT,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { starChartPng, starChartSvgDocument, starChartViewBox } from './chart-export';
import {
  areaRadius,
  axisAngles,
  boundedScale,
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
import {
  starChartClampCursor,
  starChartMoveCursor,
  StarChartPointCursor,
  StarChartPointInfo,
  StarChartPointRows,
  StarChartPointSelectEvent,
  StarChartPointTarget,
  StarChartTooltip,
  StarChartTooltipContext,
} from './chart-interaction';

export interface StarChartSeries {
  readonly label: string;
  readonly data: readonly number[];
  /**
   * Bar, line and area charts: draw this series as bars or as a line, for a combo chart (Chart.js
   * dataset `type`). Default: the chart type.
   */
  readonly type?: 'bar' | 'line';
  /**
   * Bar, line and area charts (not horizontal): `'secondary'` measures this series on a second
   * value axis at the end of the plot (Chart.js `yAxisID`). Default `'primary'`.
   */
  readonly axis?: 'primary' | 'secondary';
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
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-chart',
    '(click)': 'onPlotClick($event)',
    '[class.star-chart--legend-bottom]': "legendPosition() === 'bottom'",
    '[class.star-chart--legend-start]': "legendPosition() === 'start'",
    '[class.star-chart--legend-end]': "legendPosition() === 'end'",
  },
  template: `
    <figure
      data-star-part="figure"
      class="star-chart__figure"
      [attr.aria-labelledby]="titleId"
      [attr.aria-describedby]="descriptionId"
    >
      <figcaption data-star-part="head" class="star-chart__head">
        <span data-star-part="titleText" class="star-chart__title" [id]="titleId">{{
          title()
        }}</span>
        <button
          data-star-part="headButton"
          type="button"
          class="star-btn star-btn--ghost star-btn--sm"
          [attr.aria-pressed]="showTable()"
          (click)="showTable.set(!showTable())"
        >
          <i
            data-star-part="headIcon"
            class="ph-bold"
            [class.ph-table]="!showTable()"
            [class.ph-chart-bar]="showTable()"
            aria-hidden="true"
          ></i>
          {{ showTable() ? text.chartView : text.tableView }}
        </button>
      </figcaption>
      <p class="star-sr-only" [id]="descriptionId">{{ description() }}</p>

      <div data-star-part="body" class="star-chart__body">
        @if (legend().length > 1 && !showTable()) {
          @if (toggleLegend()) {
            <!-- Each series name is a toggle button: pressed while the series is shown. -->
            <ul
              data-star-part="legend"
              class="star-chart__legend star-chart__legend--toggle"
              [attr.aria-label]="text.chartLegend"
            >
              @for (item of legend(); track item.slot) {
                <li data-star-part="legendRow">
                  <button
                    data-star-part="legendItem"
                    type="button"
                    class="star-chart__legend-item"
                    [attr.aria-pressed]="!item.hidden"
                    (click)="toggleSeries(item.slot)"
                  >
                    @if (item.shape) {
                      <svg
                        data-star-part="swatchIcon"
                        class="star-chart__swatch-shape"
                        viewBox="-6 -6 12 12"
                      >
                        <path
                          data-star-part="mark"
                          class="star-chart__mark star-chart__marker"
                          [attr.d]="item.shape"
                          [style.--mark]="item.color"
                        />
                      </svg>
                    } @else {
                      <span
                        data-star-part="swatch"
                        class="star-chart__swatch"
                        [style.background]="item.color"
                      ></span>
                    }
                    {{ item.label }}
                  </button>
                </li>
              }
            </ul>
          } @else {
            <ul data-star-part="legend" class="star-chart__legend" aria-hidden="true">
              @for (item of legend(); track item.label) {
                <li data-star-part="legendRow">
                  @if (item.shape) {
                    <svg
                      data-star-part="swatchIcon"
                      class="star-chart__swatch-shape"
                      viewBox="-6 -6 12 12"
                    >
                      <path
                        data-star-part="mark"
                        class="star-chart__mark star-chart__marker"
                        [attr.d]="item.shape"
                        [style.--mark]="item.color"
                      />
                    </svg>
                  } @else {
                    <span
                      data-star-part="swatch"
                      class="star-chart__swatch"
                      [style.background]="item.color"
                    ></span>
                  }
                  {{ item.label }}
                </li>
              }
            </ul>
          }
        }

        <div data-star-part="frame" class="star-chart__frame" [hidden]="showTable()">
          <div
            data-star-part="plot"
            class="star-chart__plot"
            aria-hidden="true"
            (mouseleave)="hover.set(null)"
          >
            @switch (kind()) {
              @case ('round') {
                <svg
                  data-star-part="svg"
                  [attr.viewBox]="'0 0 ' + W + ' ' + H"
                  class="star-chart__svg"
                >
                  <g [attr.transform]="'translate(' + W / 2 + ',' + H / 2 + ')'">
                    @for (slice of slices(); track slice.label; let i = $index) {
                      <path
                        data-star-part="slice"
                        class="star-chart__slice"
                        [attr.d]="slice.path"
                        [style.fill]="slice.color"
                        [class.star-chart__mark--dim]="hover() !== null && hover() !== i"
                        (mouseenter)="hover.set(i)"
                      />
                    }
                    @if (type() === 'doughnut') {
                      <text
                        data-star-part="total"
                        class="star-chart__total"
                        y="-2"
                        text-anchor="middle"
                      >
                        {{ format(total()) }}
                      </text>
                      <text
                        data-star-part="totalLabel"
                        class="star-chart__total-label"
                        y="18"
                        text-anchor="middle"
                      >
                        {{ text.chartTotal }}
                      </text>
                    }
                  </g>
                </svg>
                @if (hover() !== null) {
                  @let slice = slices()[hover()!];
                  @if (slice) {
                    <div
                      data-star-part="tip"
                      class="star-chart__tip"
                      [style.left.%]="50"
                      [style.top.%]="8"
                    >
                      @if (tooltipTemplate(); as custom) {
                        <ng-container
                          *ngTemplateOutlet="custom.template; context: tooltipContext()"
                        />
                      } @else {
                        <span
                          data-star-part="swatch"
                          class="star-chart__swatch"
                          [style.background]="slice.color"
                        ></span>
                        {{ slice.label }}:
                        <strong data-star-part="tipText">{{ format(slice.value) }}</strong> ({{
                          slice.percent
                        }}%)
                      }
                    </div>
                  }
                }
              }
              @case ('radar') {
                @let plot = radar();
                <svg
                  data-star-part="svg"
                  [attr.viewBox]="'0 0 ' + RW + ' ' + RH"
                  class="star-chart__svg"
                >
                  <g [attr.transform]="'translate(' + RW / 2 + ',' + RH / 2 + ')'">
                    @for (ring of plot.rings; track ring.value) {
                      <path data-star-part="ring" class="star-chart__ring" [attr.d]="ring.path" />
                    }
                    @for (spoke of plot.spokes; track $index) {
                      <line
                        data-star-part="grid"
                        class="star-chart__grid"
                        x1="0"
                        y1="0"
                        [attr.x2]="spoke.x"
                        [attr.y2]="spoke.y"
                      />
                    }
                    @if (hover() !== null && plot.spokes[hover()!]) {
                      <line
                        data-star-part="crosshair"
                        class="star-chart__crosshair"
                        x1="0"
                        y1="0"
                        [attr.x2]="plot.spokes[hover()!].x"
                        [attr.y2]="plot.spokes[hover()!].y"
                      />
                    }
                    @for (polygon of plot.polygons; track polygon.label) {
                      <path
                        data-star-part="mark"
                        class="star-chart__mark star-chart__polygon"
                        [attr.d]="polygon.path"
                        [style.--mark]="polygon.color"
                      />
                    }
                    @for (polygon of plot.polygons; track polygon.label) {
                      @for (vertex of polygon.vertices; track vertex.index) {
                        <path
                          data-star-part="mark"
                          class="star-chart__mark star-chart__vertex"
                          [attr.d]="vertex.shape"
                          [style.--mark]="polygon.color"
                        />
                      }
                    }
                    @for (ring of plot.rings; track ring.value) {
                      <text
                        data-star-part="ringLabel"
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
                        data-star-part="axis"
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
                  <div data-star-part="tip" class="star-chart__tip star-chart__tip--corner">
                    @if (tooltipTemplate(); as custom) {
                      <ng-container
                        *ngTemplateOutlet="custom.template; context: tooltipContext()"
                      />
                    } @else {
                      <span data-star-part="tipHeader" class="star-chart__tip-title">{{
                        labels()[hover()!]
                      }}</span>
                      @for (s of drawn(); track s.slot) {
                        <span data-star-part="tipRow" class="star-chart__tip-row">
                          <span
                            data-star-part="swatch"
                            class="star-chart__swatch"
                            [style.background]="color(s.slot)"
                          ></span>
                          {{ s.label }}:
                          <strong data-star-part="valueText">{{ cell(s, hover()!) }}</strong>
                        </span>
                      }
                    }
                  </div>
                }
              }
              @case ('polar') {
                @let plot = polar();
                <svg
                  data-star-part="svg"
                  [attr.viewBox]="'0 0 ' + RW + ' ' + RH"
                  class="star-chart__svg"
                >
                  <g [attr.transform]="'translate(' + RW / 2 + ',' + RH / 2 + ')'">
                    @for (ring of plot.rings; track ring.value) {
                      <circle
                        data-star-part="ring"
                        class="star-chart__ring"
                        [attr.r]="ring.radius"
                      />
                    }
                    @for (sector of plot.sectors; track sector.index) {
                      @if (sector.path) {
                        <path
                          data-star-part="mark"
                          class="star-chart__mark star-chart__sector"
                          [attr.d]="sector.path"
                          [style.--mark]="color(0)"
                          [class.star-chart__mark--dim]="
                            hover() !== null && hover() !== sector.index
                          "
                        />
                      }
                    }
                    @for (ring of plot.rings; track ring.value) {
                      <text
                        data-star-part="ringLabel"
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
                        data-star-part="axis"
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
                    <div data-star-part="tip" class="star-chart__tip star-chart__tip--corner">
                      @if (tooltipTemplate(); as custom) {
                        <ng-container
                          *ngTemplateOutlet="custom.template; context: tooltipContext()"
                        />
                      } @else {
                        <span data-star-part="tipHeader" class="star-chart__tip-title">{{
                          sector.label.full
                        }}</span>
                        <span data-star-part="tipRow" class="star-chart__tip-row">
                          <span
                            data-star-part="swatch"
                            class="star-chart__swatch"
                            [style.background]="color(0)"
                          ></span>
                          {{ valueName() }}:
                          <strong data-star-part="valueText">{{ format(sector.value) }}</strong>
                        </span>
                      }
                    </div>
                  }
                }
              }
              @case ('scatter') {
                @let plot = scatter();
                <svg
                  data-star-part="svg"
                  [attr.viewBox]="'0 0 ' + W + ' ' + H"
                  class="star-chart__svg"
                >
                  @for (tick of plot.yTicks; track tick.value) {
                    <line
                      data-star-part="grid"
                      class="star-chart__grid"
                      [attr.x1]="SP.left"
                      [attr.x2]="W - SP.right"
                      [attr.y1]="tick.position"
                      [attr.y2]="tick.position"
                    />
                    <text
                      data-star-part="axis"
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
                      data-star-part="grid"
                      class="star-chart__grid"
                      [attr.x1]="tick.position"
                      [attr.x2]="tick.position"
                      [attr.y1]="SP.top"
                      [attr.y2]="H - SP.bottom"
                    />
                    <text
                      data-star-part="axis"
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
                      data-star-part="axisLabel"
                      class="star-chart__axis-title"
                      [attr.x]="W - SP.right"
                      [attr.y]="H - 4"
                      text-anchor="end"
                    >
                      {{ categoryLabel() }}
                    </text>
                  }
                  @if (valueLabel()) {
                    <text
                      data-star-part="axisLabel"
                      class="star-chart__axis-title"
                      x="4"
                      y="12"
                      text-anchor="start"
                    >
                      {{ valueLabel() }}
                    </text>
                  }
                  @for (point of plot.points; track point.index) {
                    <path
                      data-star-part="mark"
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
                      data-star-part="tip"
                      class="star-chart__tip star-chart__tip--point"
                      [style.left.%]="(point.px / W) * 100"
                      [style.top.%]="(point.py / H) * 100"
                      [style.translate]="
                        point.px / W > 0.7 ? '-100% 0' : point.px / W < 0.3 ? '0 0' : null
                      "
                    >
                      @if (tooltipTemplate(); as custom) {
                        <ng-container
                          *ngTemplateOutlet="custom.template; context: tooltipContext()"
                        />
                      } @else {
                        <span data-star-part="tipHeader" class="star-chart__tip-title">{{
                          point.seriesLabel
                        }}</span>
                        <span data-star-part="tipRow" class="star-chart__tip-row">
                          <svg
                            data-star-part="swatchIcon"
                            class="star-chart__swatch-shape"
                            viewBox="-6 -6 12 12"
                          >
                            <path
                              data-star-part="mark"
                              class="star-chart__mark star-chart__marker"
                              [attr.d]="point.legendShape"
                              [style.--mark]="point.color"
                            />
                          </svg>
                          {{ xName() }}:
                          <strong data-star-part="valueText">{{ precise(point.x) }}</strong>
                        </span>
                        <span
                          data-star-part="tipRow"
                          class="star-chart__tip-row star-chart__tip-indent"
                        >
                          {{ yName() }}:
                          <strong data-star-part="valueText">{{ precise(point.y) }}</strong>
                        </span>
                      }
                    </div>
                  }
                }
              }
              @default {
                <svg
                  data-star-part="svg"
                  [attr.viewBox]="'0 0 ' + W + ' ' + H"
                  class="star-chart__svg"
                  [class.star-chart__svg--zoom]="textZoom() > 1"
                  [style.--star-chart-zoom]="textZoom()"
                >
                  @for (tick of valueTicks(); track tick.value) {
                    <line
                      data-star-part="grid"
                      class="star-chart__grid"
                      [attr.x1]="tick.x1"
                      [attr.x2]="tick.x2"
                      [attr.y1]="tick.y1"
                      [attr.y2]="tick.y2"
                    />
                    <text
                      data-star-part="axis"
                      class="star-chart__axis"
                      [attr.x]="tick.tx"
                      [attr.y]="tick.ty"
                      [attr.text-anchor]="tick.anchor"
                    >
                      {{ tick.text }}
                    </text>
                  }
                  @if (secondaryTitle()) {
                    <text
                      data-star-part="axisLabel"
                      class="star-chart__axis-title"
                      [attr.x]="W - 4"
                      y="10"
                      text-anchor="end"
                    >
                      {{ secondaryTitle() }}
                    </text>
                  }
                  @for (tick of secondaryTicks(); track tick.value) {
                    <text
                      data-star-part="axis"
                      class="star-chart__axis"
                      [attr.x]="tick.tx"
                      [attr.y]="tick.ty"
                      text-anchor="start"
                    >
                      {{ tick.text }}
                    </text>
                  }
                  @if (baseline(); as base) {
                    <line
                      data-star-part="baseline"
                      class="star-chart__baseline"
                      [attr.x1]="base.x1"
                      [attr.x2]="base.x2"
                      [attr.y1]="base.y1"
                      [attr.y2]="base.y2"
                    />
                  }
                  @for (label of axisLabels(); track $index) {
                    @if (label.show) {
                      <text
                        data-star-part="axis"
                        class="star-chart__axis star-chart__axis--category"
                        [attr.x]="label.x"
                        [attr.y]="label.y"
                        [attr.text-anchor]="label.anchor"
                      >
                        {{ label.text }}
                        @if (label.text !== label.full) {
                          <title>{{ label.full }}</title>
                        }
                      </text>
                    }
                  }
                  @if (type() === 'stacked-bar') {
                    @for (segment of segments(); track segment.key) {
                      <rect
                        data-star-part="mark"
                        class="star-chart__mark star-chart__segment"
                        [attr.x]="segment.x"
                        [attr.y]="segment.y"
                        [attr.width]="segment.width"
                        [attr.height]="segment.height"
                        [style.--mark]="segment.color"
                        [class.star-chart__mark--dim]="
                          hover() !== null && hover() !== segment.index
                        "
                      />
                    }
                  } @else {
                    @for (bar of bars(); track bar.key) {
                      <path
                        data-star-part="bar"
                        class="star-chart__bar"
                        [attr.d]="bar.path"
                        [style.fill]="bar.color"
                        [class.star-chart__mark--dim]="hover() !== null && hover() !== bar.index"
                      />
                    }
                    @if (hover() !== null && lines().length) {
                      <line
                        data-star-part="crosshair"
                        class="star-chart__crosshair"
                        [attr.x1]="x(hover()!)"
                        [attr.x2]="x(hover()!)"
                        [attr.y1]="pad().top"
                        [attr.y2]="H - pad().bottom"
                      />
                    }
                    @for (line of lines(); track line.slot) {
                      @if (type() === 'area') {
                        <path
                          data-star-part="area"
                          class="star-chart__area"
                          [attr.d]="line.area"
                          [style.fill]="line.color"
                        />
                      }
                      <path
                        data-star-part="line"
                        class="star-chart__line"
                        [attr.d]="line.path"
                        [style.stroke]="line.color"
                      />
                      @if (hover() !== null) {
                        <circle
                          data-star-part="dot"
                          class="star-chart__dot"
                          r="4.5"
                          [attr.cx]="x(hover()!)"
                          [attr.cy]="y(line.data[hover()!] ?? 0, line.secondary)"
                          [style.fill]="line.color"
                        />
                      }
                    }
                  }
                  <!-- Hit targets: one full band per category, wider than the marks. -->
                  @for (hit of hits(); track $index; let i = $index) {
                    <rect
                      class="star-chart__hit"
                      [attr.x]="hit.x"
                      [attr.y]="hit.y"
                      [attr.width]="hit.width"
                      [attr.height]="hit.height"
                      (mouseenter)="hover.set(i)"
                    />
                  }
                </svg>
                @if (hover() !== null) {
                  <div
                    data-star-part="tip"
                    class="star-chart__tip"
                    [style.left.%]="tipAt().left"
                    [style.top.%]="tipAt().top"
                  >
                    @if (tooltipTemplate(); as custom) {
                      <ng-container
                        *ngTemplateOutlet="custom.template; context: tooltipContext()"
                      />
                    } @else {
                      <span data-star-part="tipHeader" class="star-chart__tip-title">{{
                        labels()[hover()!]
                      }}</span>
                      @for (s of drawn(); track s.slot; let si = $index) {
                        <span data-star-part="tipRow" class="star-chart__tip-row">
                          <span
                            data-star-part="swatch"
                            class="star-chart__swatch"
                            [style.background]="color(s.slot)"
                          ></span>
                          {{ s.label }}:
                          <strong data-star-part="valueText">{{ cell(s, hover()!) }}</strong>
                          @if (type() === 'stacked-bar' && percent()) {
                            ({{ share(stack()[hover()!]?.segments?.[si]) }}%)
                          }
                        </span>
                      }
                      @if (type() === 'stacked-bar') {
                        <span
                          data-star-part="tipRow"
                          class="star-chart__tip-row star-chart__tip-total"
                        >
                          {{ text.chartTotal }}:
                          <strong data-star-part="valueText">{{
                            format(stack()[hover()!]?.total ?? 0)
                          }}</strong>
                        </span>
                      }
                    }
                  </div>
                }
              }
            }
          </div>
          <!--
            Keyboard and screen reader access to the data points: one focus target per point.
            The pointer goes through to the marks; (click) serves assistive technology that
            activates a target.
          -->
          <div
            data-star-part="points"
            class="star-chart__points"
            role="group"
            [attr.aria-label]="text.chartPoints(title())"
            [attr.aria-describedby]="pointsHintId"
          >
            @for (row of pointRows(); track $index; let r = $index) {
              @for (point of row; track point.index; let c = $index) {
                <span
                  data-star-part="target"
                  class="star-chart__target"
                  role="img"
                  [attr.data-point]="r + '-' + c"
                  [attr.tabindex]="r === cursor().row && c === cursor().col ? 0 : -1"
                  [attr.aria-label]="point.name"
                  [style.left.%]="point.left"
                  [style.top.%]="point.top"
                  (focus)="onPointFocus(r, c, point)"
                  (blur)="hover.set(null)"
                  (click)="selectPoint(point)"
                  (keydown)="onPointKeydown($event)"
                ></span>
              }
            }
            <span class="star-sr-only" [id]="pointsHintId">{{ text.chartPointsHint }}</span>
          </div>
        </div>
      </div>

      <table data-star-part="table" class="star-chart__table" [class.star-sr-only]="!showTable()">
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
              <th scope="col">
                {{ series()[0]?.label ?? text.chartValue }}
              </th>
              <th scope="col">{{ text.chartShare }}</th>
            } @else if (kind() === 'polar') {
              <th scope="col">
                {{ valueName() }}
              </th>
            } @else if (kind() === 'scatter') {
              <th scope="col">
                {{ xName() }}
              </th>
              <th scope="col">
                {{ yName() }}
              </th>
            } @else {
              @for (s of series(); track s.label) {
                <th scope="col">
                  {{ s.label }}
                </th>
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
                <td>
                  {{ format(slice.value) }}
                </td>
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
                <td>
                  {{ precise(row.x) }}
                </td>
                <td>
                  {{ precise(row.y) }}
                </td>
              </tr>
            }
          } @else {
            @for (label of labels(); track $index; let i = $index) {
              <tr>
                <th scope="row">{{ label }}</th>
                @for (s of numeric(); track s.label) {
                  <td>
                    {{ cell(s, i) }}
                  </td>
                }
                @if (type() === 'stacked-bar') {
                  <td>
                    {{ format(tableStack()[i]?.total ?? 0) }}
                  </td>
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
  private readonly defaults = injectStarControlDefaults([]);
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
  /** BCP 47 locale of the number format. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  /**
   * How values show in the tooltip, the table and the value axis: `Intl.NumberFormat` options,
   * for example `{ style: 'currency', currency: 'EUR' }` (Chart.js tick `callback`).
   */
  readonly valueFormat = input<Intl.NumberFormatOptions | null>(null);
  /** Lowest value of the value axis (bar, stacked bar, line, area). Default: from the data. */
  readonly min = input<number | null>(null);
  /** Highest value of the value axis. Values beyond the ends stop at the end. */
  readonly max = input<number | null>(null);
  /** Distance between the ticks of the value axis. Default: a round step. */
  readonly stepSize = input<number | null>(null);
  /**
   * Bar and stacked bar: the bars run along the line and the categories go down the side
   * (Chart.js `indexAxis: 'y'`). Series `type` and `axis` do not apply.
   */
  readonly horizontal = input(false, { transform: booleanAttribute });
  /** Start the table view open. */
  readonly table = input(false, { transform: booleanAttribute });
  /**
   * Positions in `series` of the series that are hidden. A click on a legend item adds or
   * removes its series (Chart.js legend `onClick`, PrimeNG through the Chart.js options). The
   * table keeps every series.
   */
  readonly hiddenSeries = model<readonly number[]>([]);
  /** Where the legend is: above, below, or at the start or the end of the plot. */
  readonly legendPosition = input<'top' | 'bottom' | 'start' | 'end'>('top');

  /**
   * A data point was clicked, or Enter or Space was pressed on a focused one. PrimeNG
   * `onDataSelect`.
   */
  readonly pointSelect = output<StarChartPointSelectEvent>();

  protected readonly showTable = linkedSignal(() => this.table());
  protected readonly hover = signal<number | null>(null);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly pointsHintId = this.ids.getId('star-chart-points-hint-');
  /** Custom tooltip content (`ng-template starChartTooltip`). */
  protected readonly tooltipTemplate = contentChild(StarChartTooltip);
  /** The focus target in the tab order (roving tabindex). */
  private readonly cursorState = signal<StarChartPointCursor>({ row: 0, col: 0 });
  protected readonly cursor = computed(() =>
    starChartClampCursor(this.pointRows(), this.cursorState()),
  );

  private readonly numberFormat = computed(
    () => new Intl.NumberFormat(this.locale(), this.valueFormat() ?? { maximumFractionDigits: 1 }),
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
    const options: Intl.NumberFormatOptions = { ...this.valueFormat() };
    // Ticks show just enough decimals, unless `valueFormat` fixes them.
    if (options.maximumFractionDigits === undefined) {
      options.maximumFractionDigits = Math.max(digits, options.minimumFractionDigits ?? 0);
      options.minimumFractionDigits = Math.min(
        options.minimumFractionDigits ?? 0,
        options.maximumFractionDigits,
      );
    }
    const formatter = new Intl.NumberFormat(this.locale(), options);
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
      type: (s as StarChartSeries).type,
      axis: (s as StarChartSeries).axis,
    })),
  );
  /**
   * The series that are drawn: the first 8 that are not hidden. `slot` is the position in
   * `series`, which keeps the color, the marker and the legend place of a series.
   */
  protected readonly drawn = computed(() => {
    const hidden = new Set(this.hiddenSeries());
    return this.numeric()
      .slice(0, STAR_CHART_SLOTS)
      .map((s, slot) => ({ ...s, slot }))
      .filter((s) => !hidden.has(s.slot));
  });
  /** The legend toggles series: charts with series (not doughnut, pie or polar area). */
  protected readonly toggleLegend = computed(() => !this.round() && this.kind() !== 'polar');

  protected toggleSeries(slot: number): void {
    const hidden = this.hiddenSeries();
    this.hiddenSeries.set(
      hidden.includes(slot)
        ? hidden.filter((s) => s !== slot)
        : [...hidden, slot].sort((a, b) => a - b),
    );
  }

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
      return this.slices().map((s, i) => ({
        label: s.label,
        slot: i,
        hidden: false,
        color: s.color,
        shape: '',
      }));
    // Polar area has one color: the categories are named at the axis, not in a legend.
    if (this.kind() === 'polar') return [];
    const marked = this.kind() === 'radar' || this.kind() === 'scatter';
    const hidden = new Set(this.hiddenSeries());
    const series = this.kind() === 'scatter' ? this.series() : this.numeric();
    return series.slice(0, STAR_CHART_SLOTS).map((s, i) => ({
      label: this.onSecondary(s as StarChartSeries)
        ? this.text.chartSecondaryAxis(s.label)
        : s.label,
      slot: i,
      hidden: hidden.has(i),
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

  /** Bars along the line, categories down the side: bar and stacked bar with `horizontal`. */
  protected readonly isHorizontal = computed(
    () => this.horizontal() && (this.type() === 'bar' || this.type() === 'stacked-bar'),
  );
  /** How a drawn series looks: its own `type`, else the chart type. Stacked bars ignore it. */
  private seriesKind(series: StarChartSeries): 'bar' | 'line' {
    if (this.type() === 'stacked-bar' || this.isHorizontal()) return 'bar';
    return series.type ?? (this.type() === 'bar' ? 'bar' : 'line');
  }
  /** The series uses the second value axis (vertical bar, line and area charts only). */
  private onSecondary(series: StarChartSeries): boolean {
    return !this.isHorizontal() && this.type() !== 'stacked-bar' && series.axis === 'secondary';
  }
  protected readonly hasSecondary = computed(() => this.drawn().some((s) => this.onSecondary(s)));
  /** Room around the plot: more at the start for category names, at the end for a 2nd axis. */
  protected readonly pad = computed(() => ({
    top: PAD.top,
    right: this.hasSecondary() ? 56 : PAD.right,
    bottom: this.isHorizontal() ? 28 : PAD.bottom,
    left: this.isHorizontal() ? 104 : PAD.left,
  }));

  protected readonly stack = computed(() =>
    stackColumns(
      this.drawn().map((s) => s.data),
      this.labels().length,
      this.percent(),
    ),
  );
  /** The value axis: from the data, or from `min`, `max` and `stepSize`. */
  protected readonly yScale = computed<StarChartScale>(() => {
    const bounds = { min: this.min(), max: this.max(), stepSize: this.stepSize() };
    if (this.type() === 'stacked-bar') {
      const { min, max } = stackExtent(this.stack());
      return boundedScale(min, max, { includeZero: true, ...bounds });
    }
    const { min, max } = extentOf(
      this.drawn()
        .filter((s) => !this.onSecondary(s))
        .flatMap((s) => s.data),
    );
    return boundedScale(min, max, { includeZero: true, ...bounds });
  });
  /** The second value axis, at the end of the plot. */
  protected readonly secondaryScale = computed<StarChartScale>(() => {
    const { min, max } = extentOf(
      this.drawn()
        .filter((s) => this.onSecondary(s))
        .flatMap((s) => s.data),
    );
    return niceScale(min, max, { includeZero: true });
  });
  protected readonly band = computed(() => {
    const pad = this.pad();
    const length = this.isHorizontal() ? H - pad.top - pad.bottom : W - pad.left - pad.right;
    return length / Math.max(1, this.labels().length);
  });

  /** Position of a category along the category axis. */
  protected x(index: number): number {
    const pad = this.pad();
    return (this.isHorizontal() ? pad.top : pad.left) + this.band() * (index + 0.5);
  }
  /** Position of a value along a value axis. Values outside the axis stop at its ends. */
  protected y(value: number, secondary = false): number {
    const { min, max } = secondary ? this.secondaryScale() : this.yScale();
    const pad = this.pad();
    const share = (Math.min(Math.max(value, min), max) - min) / (max - min || 1);
    return this.isHorizontal()
      ? pad.left + share * (W - pad.left - pad.right)
      : pad.top + (1 - share) * (H - pad.top - pad.bottom);
  }

  /** Grid lines and tick labels of the value axis. */
  protected readonly valueTicks = computed(() => {
    const scale = this.yScale();
    const pad = this.pad();
    const text = this.tickFormatter(
      scale.ticks,
      this.type() === 'stacked-bar' && this.percent() ? '%' : '',
    );
    return this.inRange(scale).map((value) => {
      const at = this.y(value);
      return this.isHorizontal()
        ? {
            value,
            text: text(value),
            x1: at,
            x2: at,
            y1: pad.top,
            y2: H - pad.bottom,
            tx: at,
            ty: H - pad.bottom + 18,
            anchor: 'middle',
          }
        : {
            value,
            text: text(value),
            x1: pad.left,
            x2: W - pad.right,
            y1: at,
            y2: at,
            tx: pad.left - 8,
            ty: at + 4,
            anchor: 'end',
          };
    });
  });
  /** Tick labels of the second value axis, at the end of the plot. */
  protected readonly secondaryTicks = computed(() => {
    if (!this.hasSecondary()) return [];
    const scale = this.secondaryScale();
    const text = this.tickFormatter(scale.ticks);
    const x = W - this.pad().right + 8;
    return this.inRange(scale).map((value) => ({
      value,
      text: text(value),
      tx: x,
      ty: this.y(value, true) + 4,
    }));
  });
  /** Ticks inside the ends of the scale: a tick outside would draw beyond the plot. */
  private inRange(scale: StarChartScale): number[] {
    const slack = Math.abs(scale.max - scale.min) * 1e-9;
    return scale.ticks.filter((t) => t >= scale.min - slack && t <= scale.max + slack);
  }

  /** Title of the second value axis: the names of its series. */
  protected readonly secondaryTitle = computed(() =>
    this.hasSecondary()
      ? this.drawn()
          .filter((s) => this.onSecondary(s))
          .map((s) => s.label)
          .join(', ')
      : '',
  );

  /** The zero line, when the value axis has negative values. */
  protected readonly baseline = computed(() => {
    if (!(this.yScale().min < 0)) return null;
    const pad = this.pad();
    const at = this.y(0);
    return this.isHorizontal()
      ? { x1: at, x2: at, y1: pad.top, y2: H - pad.bottom }
      : { x1: pad.left, x2: W - pad.right, y1: at, y2: at };
  });
  /**
   * Width of the plot on the screen, in pixels (browser only, from a ResizeObserver). 0 until it
   * is measured.
   */
  protected readonly plotWidth = signal(0);
  /**
   * The view box shrinks with a narrow container, and its text with it. Axis text grows back by
   * this factor (at most 2) so it stays readable, and the category labels thin out to make room.
   */
  protected readonly textZoom = computed(() => {
    const width = this.plotWidth();
    return width > 0 ? Math.min(2, Math.max(1, W / width)) : 1;
  });
  /** Show every `step`-th category label: 1, unless the zoomed labels need more room. */
  protected readonly labelStep = computed(() => {
    const zoom = this.textZoom();
    if (zoom <= 1) return 1;
    const band = this.band();
    if (this.isHorizontal()) return Math.max(1, Math.ceil((16 * zoom) / band));
    const longest = Math.max(0, ...this.labels().map((label) => label.length));
    const wanted = Math.min(longest, 6) * 6.5 * zoom;
    return Math.max(1, Math.ceil(wanted / band));
  });
  /** Category labels cut to their room, with the full text as a title. */
  protected readonly axisLabels = computed(() => {
    const pad = this.pad();
    const horizontal = this.isHorizontal();
    const step = this.labelStep();
    const zoom = this.textZoom();
    const room = horizontal ? pad.left - 12 : this.band() * step;
    const max = Math.max(3, Math.floor(room / (6.5 * zoom)));
    return this.labels().map((label, i) => ({
      text: truncateLabel(label, max),
      full: label,
      show: i % step === 0,
      x: horizontal ? pad.left - 8 : this.x(i),
      y: horizontal ? this.x(i) + 4 : H - 12,
      anchor: horizontal ? 'end' : 'middle',
    }));
  });
  /** Hover targets: one band per category, wider than the marks. */
  protected readonly hits = computed(() => {
    const pad = this.pad();
    const band = this.band();
    return this.labels().map((_, i) =>
      this.isHorizontal()
        ? { x: pad.left, y: this.x(i) - band / 2, width: W - pad.left - pad.right, height: band }
        : { x: this.x(i) - band / 2, y: pad.top, width: band, height: H - pad.top - pad.bottom },
    );
  });
  /** Where the tooltip of the hovered category goes, in percent of the plot. */
  protected readonly tipAt = computed(() => {
    const hover = this.hover() ?? 0;
    return this.isHorizontal()
      ? { left: 50, top: ((this.x(hover) + this.band() / 2) / H) * 100 }
      : { left: (this.x(hover) / W) * 100, top: 6 };
  });

  /** Grouped bars: 2px gap between neighbours, 4px rounded end, square base. */
  protected readonly bars = computed(() => {
    const series = this.drawn().filter((s) => this.seriesKind(s) === 'bar');
    const horizontal = this.isHorizontal();
    const count = Math.max(1, series.length);
    const group = Math.min(this.band() * 0.7, 28 * count + 2 * (count - 1));
    const thickness = (group - 2 * (count - 1)) / count;
    return this.labels().flatMap((_, i) =>
      series.map((s, si) => {
        const secondary = this.onSecondary(s);
        const base = this.y(0, secondary);
        const end = this.y(toFinite(s.data[i]), secondary);
        const start = this.x(i) - group / 2 + si * (thickness + 2);
        let path: string;
        if (horizontal) {
          const r = Math.min(4, thickness / 2, Math.max(0, end - base));
          path =
            `M${base},${start}H${end - r}Q${end},${start} ${end},${start + r}` +
            `V${start + thickness - r}Q${end},${start + thickness} ${end - r},${start + thickness}` +
            `H${base}Z`;
        } else {
          const r = Math.min(4, thickness / 2, Math.max(0, base - end));
          path =
            `M${start},${base}V${end + r}Q${start},${end} ${start + r},${end}` +
            `H${start + thickness - r}Q${start + thickness},${end} ${start + thickness},${end + r}V${base}Z`;
        }
        return {
          key: `${i}-${s.slot}`,
          index: i,
          slot: s.slot,
          center: start + thickness / 2,
          end,
          path,
          color: this.color(s.slot),
        };
      }),
    );
  });

  /** Stacked bars: one rectangle per value that is not 0, outlined in a darker tone. */
  protected readonly segments = computed(() => {
    const thickness = Math.min(this.band() * 0.6, 64);
    const horizontal = this.isHorizontal();
    return this.stack().flatMap((column, i) =>
      column.segments
        .filter((segment) => segment.start !== segment.end)
        .map((segment) => {
          const a = this.y(segment.start);
          const b = this.y(segment.end);
          const across = this.x(i) - thickness / 2;
          return {
            key: `${i}-${segment.series}`,
            index: i,
            x: horizontal ? Math.min(a, b) : across,
            y: horizontal ? across : Math.min(a, b),
            width: horizontal ? Math.abs(a - b) : thickness,
            height: horizontal ? thickness : Math.abs(a - b),
            color: this.color(this.drawn()[segment.series]?.slot ?? segment.series),
          };
        }),
    );
  });

  /**
   * The stack of every series (not only the shown ones), for the Total column of the table:
   * the table keeps hidden series, so its total does too.
   */
  protected readonly tableStack = computed(() =>
    stackColumns(
      this.numeric()
        .slice(0, STAR_CHART_SLOTS)
        .map((s) => s.data),
      this.labels().length,
    ),
  );

  /** Share of a stack segment in its column, in percent (percent mode). */
  protected share(segment: StarChartStackSegment | undefined): number {
    return segment ? Math.round(Math.abs(segment.end - segment.start) * 10) / 10 : 0;
  }

  /** Lines (line and area charts, and series with `type: 'line'` in a bar chart). */
  protected readonly lines = computed(() =>
    this.drawn()
      .filter((s) => this.seriesKind(s) === 'line')
      .map((s) => {
        const secondary = this.onSecondary(s);
        const path = s.data
          .map((v, i) => `${i ? 'L' : 'M'}${this.x(i)},${this.y(v, secondary)}`)
          .join('');
        const base = this.y(0, secondary);
        return {
          label: s.label,
          slot: s.slot,
          secondary,
          data: s.data,
          color: this.color(s.slot),
          path,
          // Area: the line, then down to the baseline and back to the first point.
          area: s.data.length
            ? `${path}L${this.x(s.data.length - 1)},${base}L${this.x(0)},${base}Z`
            : '',
        };
      }),
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
      const mid = a0 + (a1 - a0) / 2;
      const at = (outer + inner) / 2;
      return {
        label: item.label,
        value: item.value,
        percent: Math.round((item.value / total) * 1000) / 10,
        color: this.color(i),
        path,
        x: at * Math.cos(mid),
        y: at * Math.sin(mid),
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
      polygons: this.drawn().map((s) => {
        const points = angles.map((a, i) =>
          polarPoint(linearRadius(toFinite(s.data[i]), scale, RADIAL), a),
        );
        return {
          label: s.label,
          slot: s.slot,
          color: this.color(s.slot),
          path: polygonPath(points),
          vertices: points.map((p, index) => ({
            index,
            x: p.x,
            y: p.y,
            shape: markerPath(s.slot, p.x, p.y, MARKER_RADIUS - 1),
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
    const hidden = new Set(this.hiddenSeries());
    const drawn = this.scatterData()
      .slice(0, STAR_CHART_SLOTS)
      .map((s, slot) => ({ ...s, slot }))
      .filter((s) => !hidden.has(s.slot));
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
      points: drawn.flatMap((s) =>
        s.points.map((p, local) => {
          const px = scalePosition(p.x, scales.x, left, right);
          const py = scalePosition(p.y, scales.y, bottom, top);
          return {
            index: index++,
            local,
            series: s.slot,
            seriesLabel: s.label,
            color: this.color(s.slot),
            x: p.x,
            y: p.y,
            px,
            py,
            // The shape repeats the series color: series stay apart where two colors are close.
            shape: markerPath(s.slot, px, py, MARKER_RADIUS),
            legendShape: markerPath(s.slot, 0, 0, MARKER_RADIUS),
          };
        }),
      ),
    };
  });

  // ---------- Responsive labels ----------

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Browser only: afterNextRender does not run on the server.
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0;
        if (width !== this.plotWidth()) this.plotWidth.set(width);
      });
      const plot = this.host.nativeElement.querySelector('.star-chart__plot');
      if (plot) observer.observe(plot);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  // ---------- Export ----------

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The background behind the chart: the first fill that is not transparent. */
  private surface(): string {
    const view = this.host.nativeElement.ownerDocument.defaultView;
    for (let node: Element | null = this.host.nativeElement; node; node = node.parentElement) {
      const color = view?.getComputedStyle(node).backgroundColor;
      if (color && color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') return color;
    }
    return '#ffffff';
  }

  private plotSvg(): SVGSVGElement | null {
    return this.host.nativeElement.querySelector<SVGSVGElement>('.star-chart__plot svg');
  }

  /**
   * The plot as a stand-alone SVG document (colors resolved, with the title), for a download or
   * a report. An empty string on the server. PrimeNG / Chart.js `toBase64Image` gives a PNG only.
   */
  exportSvg(): string {
    const svg = this.browser ? this.plotSvg() : null;
    if (!svg) return '';
    return starChartSvgDocument(svg, { title: this.title(), background: this.surface() });
  }

  /**
   * The plot as a PNG image, `scale` times the size of the view box (default 2 for sharp
   * output). `null` on the server or without a canvas. Chart.js `toBase64Image`.
   */
  async exportPng(scale = 2): Promise<Blob | null> {
    const svgDocument = this.exportSvg();
    const svg = this.plotSvg();
    const box = svg ? starChartViewBox(svg) : null;
    if (!svgDocument || !box) return null;
    const doc = this.host.nativeElement.ownerDocument;
    return starChartPng(doc, svgDocument, box.width, box.height, scale);
  }

  // ---------- Data point focus, tooltip and selection ----------

  /** One focus target per data point, in percent of the plot, one row per drawn series. */
  protected readonly pointRows = computed<StarChartPointRows>(() => {
    const labels = this.labels();
    const target = (
      seriesIndex: number,
      series: string,
      index: number,
      label: string,
      value: number,
      left: number,
      top: number,
      hover: number,
      shown = this.format(value),
    ): StarChartPointTarget => ({
      seriesIndex,
      series,
      index,
      label,
      value,
      left,
      top,
      hover,
      name: this.text.chartPointLabel(series, label, shown),
    });
    switch (this.kind()) {
      case 'round': {
        const name = this.series()[0]?.label ?? this.text.chartValue;
        return [
          this.slices().map((s, i) =>
            target(
              0,
              name,
              i,
              s.label,
              s.value,
              ((W / 2 + s.x) / W) * 100,
              ((H / 2 + s.y) / H) * 100,
              i,
            ),
          ),
        ];
      }
      case 'radar':
        return this.radar().polygons.map((polygon, si) =>
          polygon.vertices.map((v) =>
            target(
              polygon.slot,
              polygon.label,
              v.index,
              labels[v.index] ?? '',
              toFinite(this.drawn()[si]?.data[v.index]),
              ((RADIAL_W / 2 + v.x) / RADIAL_W) * 100,
              ((RADIAL_H / 2 + v.y) / RADIAL_H) * 100,
              v.index,
            ),
          ),
        );
      case 'polar': {
        const name = this.valueName();
        return [
          this.polar().sectors.map((s) => {
            const at = polarPoint(Math.max(s.radius * 0.6, 8), s.mid);
            return target(
              0,
              name,
              s.index,
              s.label.full,
              s.value,
              ((RADIAL_W / 2 + at.x) / RADIAL_W) * 100,
              ((RADIAL_H / 2 + at.y) / RADIAL_H) * 100,
              s.index,
            );
          }),
        ];
      }
      case 'scatter': {
        const rows: StarChartPointTarget[][] = [];
        for (const p of this.scatter().points) {
          (rows[p.series] ??= []).push(
            target(
              p.series,
              p.seriesLabel,
              p.local,
              this.precise(p.x),
              p.y,
              (p.px / W) * 100,
              (p.py / H) * 100,
              p.index,
              this.precise(p.y),
            ),
          );
        }
        return rows.filter(Boolean);
      }
      default: {
        const horizontal = this.isHorizontal();
        return this.drawn().map((s, si) =>
          labels.map((label, i) => {
            const value = toFinite(s.data[i]);
            let along = this.y(value, this.onSecondary(s));
            let across = this.x(i);
            if (this.type() === 'stacked-bar') {
              const segment = this.stack()[i]?.segments[si];
              along = this.y(segment ? segment.end : 0);
            } else if (this.seriesKind(s) === 'bar') {
              const bar = this.bars().find((b) => b.index === i && b.slot === s.slot);
              across = bar?.center ?? across;
            }
            const left = horizontal ? along : across;
            const top = horizontal ? across : along;
            return target(s.slot, s.label, i, label, value, (left / W) * 100, (top / H) * 100, i);
          }),
        );
      }
    }
  });

  /** Points that the tooltip shows: every point at the hover index. */
  protected readonly tooltipContext = computed<StarChartTooltipContext>(() => {
    const hover = this.hover();
    const points: StarChartPointInfo[] = this.pointRows()
      .flat()
      .filter((point) => point.hover === hover)
      .map(({ seriesIndex, index, value, series, label }) => ({
        seriesIndex,
        index,
        value,
        series,
        label,
      }));
    const label = this.kind() === 'scatter' ? (points[0]?.series ?? '') : (points[0]?.label ?? '');
    return { $implicit: points, points, label };
  });

  protected onPointFocus(row: number, col: number, point: StarChartPointTarget): void {
    this.cursorState.set({ row, col });
    this.hover.set(point.hover);
  }

  /**
   * A click on the plot selects the data point nearest to the pointer (the focus targets let the
   * pointer through to the marks).
   */
  protected onPlotClick(event: MouseEvent): void {
    const target = event.target as Element | null;
    const frame = target?.closest('.star-chart__plot')?.parentElement;
    if (!frame) return;
    const box = frame.getBoundingClientRect();
    const left = box.width ? ((event.clientX - box.left) / box.width) * 100 : 0;
    const top = box.height ? ((event.clientY - box.top) / box.height) * 100 : 0;
    let best: StarChartPointTarget | null = null;
    let distance = Infinity;
    for (const point of this.pointRows().flat()) {
      const d = (point.left - left) ** 2 + (point.top - top) ** 2;
      if (d < distance) [best, distance] = [point, d];
    }
    if (best) this.selectPoint(best);
  }

  protected selectPoint(point: StarChartPointTarget): void {
    this.pointSelect.emit({
      seriesIndex: point.seriesIndex,
      index: point.index,
      value: point.value,
    });
  }

  /** Arrow keys, Home and End move between the points; Enter and Space select one. */
  protected onPointKeydown(event: KeyboardEvent): void {
    const rows = this.pointRows();
    const cursor = this.cursor();
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const point = rows[cursor.row]?.[cursor.col];
      if (point) this.selectPoint(point);
      return;
    }
    if (event.key === 'Escape') {
      this.hover.set(null);
      return;
    }
    // Horizontal bars: the categories run down, so Arrow Down and Up move along a series and
    // Arrow Right and Left move between the series.
    const swap: Readonly<Record<string, string>> = {
      ArrowDown: 'ArrowRight',
      ArrowUp: 'ArrowLeft',
      ArrowRight: 'ArrowDown',
      ArrowLeft: 'ArrowUp',
    };
    const key = this.isHorizontal() ? (swap[event.key] ?? event.key) : event.key;
    const next = starChartMoveCursor(rows, cursor, key);
    if (!next) return;
    event.preventDefault();
    this.cursorState.set(next);
    this.host.nativeElement
      .querySelector<HTMLElement>(`[data-point="${next.row}-${next.col}"]`)
      ?.focus();
  }
}
