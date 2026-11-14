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

export interface StarChartSeries {
  readonly label: string;
  readonly data: readonly number[];
}

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

/** Round axis maximum and 4–5 ticks ("nice numbers"). */
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * power).find((s) => s >= rough) ?? rough;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(10));
}

/**
 * Chart (PrimeNG `p-chart` without Chart.js): dependency-free SVG bar, line, area, doughnut and pie charts.
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
    <figure class="star-chart__figure" [attr.aria-labelledby]="titleId">
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

      @if (legend().length > 1 && !showTable()) {
        <ul class="star-chart__legend" aria-hidden="true">
          @for (item of legend(); track item.label) {
            <li>
              <span class="star-chart__swatch" [style.background]="item.color"></span
              >{{ item.label }}
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
        @switch (round() ? 'round' : 'axis') {
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
              <div class="star-chart__tip" [style.left.%]="50" [style.top.%]="8">
                <span class="star-chart__swatch" [style.background]="slice.color"></span>
                {{ slice.label }}: <strong>{{ format(slice.value) }}</strong> ({{ slice.percent }}%)
              </div>
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
                  {{ format(tick) }}
                </text>
              }
              @for (label of labels(); track $index; let i = $index) {
                <text
                  class="star-chart__axis"
                  [attr.x]="x(i)"
                  [attr.y]="H - 12"
                  text-anchor="middle"
                >
                  {{ label }}
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
                @for (s of series(); track s.label; let si = $index) {
                  <span class="star-chart__tip-row">
                    <span class="star-chart__swatch" [style.background]="color(si)"></span>
                    {{ s.label }}: <strong>{{ format(s.data[hover()!] ?? 0) }}</strong>
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
              {{ round() ? text.chartCategory : (categoryLabel() ?? text.chartCategory) }}
            </th>
            @if (round()) {
              <th scope="col">{{ series()[0]?.label ?? text.chartValue }}</th>
              <th scope="col">{{ text.chartShare }}</th>
            } @else {
              @for (s of series(); track s.label) {
                <th scope="col">{{ s.label }}</th>
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
          } @else {
            @for (label of labels(); track $index; let i = $index) {
              <tr>
                <th scope="row">{{ label }}</th>
                @for (s of series(); track s.label) {
                  <td>{{ format(s.data[i] ?? 0) }}</td>
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
  protected readonly PAD = PAD;
  protected readonly titleId = inject(_IdGenerator).getId('star-chart-');

  /**
   * `'area'` is a line chart with a soft fill under each line. `'pie'` is a doughnut without
   * the hole and the total; like the doughnut it shows the top 3 categories and "Other".
   */
  readonly type = input<'bar' | 'line' | 'area' | 'doughnut' | 'pie'>('bar');
  /** Doughnut or pie: one series as parts of a whole. */
  protected readonly round = computed(() => this.type() === 'doughnut' || this.type() === 'pie');
  readonly title = input.required<string>();
  /** Category labels (x axis, or doughnut slices). */
  readonly labels = input<readonly string[]>([]);
  /** One or more series. Doughnut uses the first series only. More than 8 series are cut. */
  readonly series = input<readonly StarChartSeries[]>([]);
  readonly categoryLabel = input<string | null>(null);
  readonly locale = input<string | undefined>(undefined);
  /** Start the table view open. */
  readonly table = input(false, { transform: booleanAttribute });

  protected readonly showTable = linkedSignal(() => this.table());
  protected readonly hover = signal<number | null>(null);

  private readonly numberFormat = computed(
    () => new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 1 }),
  );
  protected format(value: number): string {
    return this.numberFormat().format(value);
  }

  protected color(index: number): string {
    return `var(--star-chart-${(index % STAR_CHART_SLOTS) + 1})`;
  }

  protected readonly legend = computed(() =>
    this.round()
      ? this.slices().map((s) => ({ label: s.label, color: s.color }))
      : this.series()
          .slice(0, STAR_CHART_SLOTS)
          .map((s, i) => ({ label: s.label, color: this.color(i) })),
  );

  protected readonly ticks = computed(() =>
    niceTicks(Math.max(0, ...this.series().flatMap((s) => s.data))),
  );
  private readonly yMax = computed(() => this.ticks().at(-1) ?? 1);
  protected readonly band = computed(
    () => (W - PAD.left - PAD.right) / Math.max(1, this.labels().length),
  );

  protected x(index: number): number {
    return PAD.left + this.band() * (index + 0.5);
  }
  protected y(value: number): number {
    return PAD.top + (1 - value / this.yMax()) * (H - PAD.top - PAD.bottom);
  }

  /** Grouped bars: 2px gap between neighbours, 4px rounded top, square base. */
  protected readonly bars = computed(() => {
    const series = this.series().slice(0, STAR_CHART_SLOTS);
    const groupWidth = Math.min(this.band() * 0.7, 28 * series.length + 2 * (series.length - 1));
    const barWidth = (groupWidth - 2 * (series.length - 1)) / Math.max(1, series.length);
    const base = this.y(0);
    return this.labels().flatMap((_, i) =>
      series.map((s, si) => {
        const left = this.x(i) - groupWidth / 2 + si * (barWidth + 2);
        const top = this.y(s.data[i] ?? 0);
        const r = Math.min(4, barWidth / 2, Math.max(0, base - top));
        const path =
          `M${left},${base}V${top + r}Q${left},${top} ${left + r},${top}` +
          `H${left + barWidth - r}Q${left + barWidth},${top} ${left + barWidth},${top + r}V${base}Z`;
        return { key: `${i}-${si}`, index: i, path, color: this.color(si) };
      }),
    );
  });

  protected readonly lines = computed(() =>
    this.series()
      .slice(0, STAR_CHART_SLOTS)
      .map((s, si) => ({
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

  protected readonly total = computed(() =>
    (this.series()[0]?.data ?? []).reduce((a, b) => a + b, 0),
  );

  /** Doughnut: top 3 categories + "Other" (4 slots validated for all-pairs comparison). */
  protected readonly slices = computed(() => {
    const data = this.series()[0]?.data ?? [];
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
}
