import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  STAR_UI_TEXT,
  StarDirectionService,
  starIsRtl,
  StarPart,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import {
  SPARK_H,
  SPARK_W,
  sparklineArea,
  sparklineBars,
  sparklineExtent,
  sparklineLine,
  sparklinePoints,
  sparklineStats,
  sparklineY,
  StarSparklineType,
} from './sparkline-geometry';

export type { StarSparklineType } from './sparkline-geometry';

/** A value that gets a marker: the last, the lowest or the highest. `none` draws no marker. */
export type StarSparklineHighlight = 'last' | 'min' | 'max' | 'none';

/** Number of colour slots of the chart palette (`--star-chart-1…8`). */
const SLOTS = 8;

/** A size input: a number is pixels, a text is any CSS length (`6em`, `100%`). */
const toLength = (value: string | number) => (typeof value === 'number' ? `${value}px` : value);

/**
 * Sparkline: a tiny chart without axes that fits in a line of text or a table cell. Kendo UI
 * `kendo-sparkline`, Ignite UI `igx-sparkline` and Syncfusion `ejs-sparkline` are the equivalents.
 *
 * Types: `line` (default), `area`, `bar` and `win-loss` (up for a value above zero, down for one
 * below). The plot is pure SVG and renders on the server. In right-to-left the x axis runs from
 * the right. The sparkline is an image (`role="img"`) with a label that sums up the data (trend,
 * first, last, lowest and highest value) from `STAR_UI_TEXT`; it is not a focus stop.
 *
 * `<star-sparkline [data]="[12, 9, 15, 21]" [highlight]="['last']" />`
 */
@Component({
  selector: 'star-sparkline',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  imports: [StarPart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    '[class]': "'star-sparkline star-sparkline--' + type()",
    '[attr.aria-label]': 'label()',
    '[style.--star-sparkline-color]': 'colorToken()',
  },
  template: `
    <svg
      starPart="svg"
      class="star-sparkline__svg"
      [attr.viewBox]="viewBox"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      [attr.width]="widthCss()"
      [attr.height]="heightCss()"
      [style.width]="widthCss()"
      [style.height]="heightCss()"
    >
      @if (referenceY(); as y) {
        <line
          starPart="reference"
          class="star-sparkline__reference"
          x1="0"
          [attr.x2]="viewWidth"
          [attr.y1]="y"
          [attr.y2]="y"
        />
      }
      @if (bars(); as list) {
        @for (bar of list; track $index) {
          <rect
            starPart="bar"
            class="star-sparkline__bar"
            [class.star-sparkline__bar--negative]="bar.negative"
            [class.star-sparkline__bar--marked]="marked().has($index)"
            [attr.x]="bar.x.toFixed(2)"
            [attr.y]="bar.y.toFixed(2)"
            [attr.width]="bar.width.toFixed(2)"
            [attr.height]="bar.height.toFixed(2)"
          />
        }
      } @else if (line()) {
        @if (type() === 'area') {
          <path starPart="area" class="star-sparkline__area" [attr.d]="area()" />
        }
        <path starPart="line" class="star-sparkline__line" [attr.d]="line()" />
        @for (marker of markers(); track marker.kind) {
          <path
            [attr.class]="'star-sparkline__marker star-sparkline__marker--' + marker.kind"
            [attr.d]="marker.d"
          />
        }
      }
    </svg>
  `,
})
export class StarSparkline {
  protected readonly text = inject(STAR_UI_TEXT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly direction = inject(StarDirectionService);

  /** `line` (default), `area`, `bar` or `win-loss`. */
  readonly type = input<StarSparklineType>('line');
  /** The values, in order. A value that is not finite leaves a gap in a line. */
  readonly data = input<readonly number[]>([]);
  /** Lowest value of the plot. Default: the lowest value (zero for bars). */
  readonly min = input<number | undefined>(undefined);
  /** Highest value of the plot. Default: the highest value (zero for bars). */
  readonly max = input<number | undefined>(undefined);
  /** Values that get a marker (line, area) or a strong colour (bar). Default: none. */
  readonly highlight = input<readonly StarSparklineHighlight[]>([]);
  /** A value that gets a dashed horizontal line, for example a target. The automatic range includes it. */
  readonly referenceLine = input<number | undefined>(undefined);
  /** Colour slot of the chart palette, 1 to 8 (`--star-chart-1…8`). */
  readonly color = input(1);
  /** Width: a number of pixels or a CSS length. Default: `6em`. */
  readonly width = input<string | number>('6em');
  /** Height: a number of pixels or a CSS length. Default: `1em`, the height of the text. */
  readonly height = input<string | number>('1em');
  /** Locale of the numbers in the label (`Intl.NumberFormat`). Default: the runtime locale. */
  readonly locale = input<string | undefined>(undefined);
  /** Label for assistive technology. Default: a summary of the data. */
  readonly ariaLabel = input<string | null>(null);

  protected readonly viewBox = `0 0 ${SPARK_W} ${SPARK_H}`;
  protected readonly viewWidth = SPARK_W;
  protected readonly widthCss = computed(() => toLength(this.width()));
  protected readonly heightCss = computed(() => toLength(this.height()));

  /** Direction measured at the host after a render; `null` before the first render. */
  private readonly hostRtl = signal<boolean | null>(null);
  protected readonly rtl = computed(() => this.hostRtl() ?? this.direction.value() === 'rtl');

  constructor() {
    afterRenderEffect(() => {
      this.direction.value();
      this.hostRtl.set(starIsRtl(this.host.nativeElement));
    });
  }

  protected readonly colorToken = computed(() => {
    const slot = Math.round(this.color());
    return `var(--star-chart-${slot >= 1 && slot <= SLOTS ? slot : 1})`;
  });

  private readonly extent = computed(() =>
    sparklineExtent(this.data(), this.type(), this.min(), this.max(), this.referenceLine()),
  );
  private readonly stats = computed(() => sparklineStats(this.data()));

  private readonly points = computed(() =>
    this.type() === 'line' || this.type() === 'area'
      ? sparklinePoints(this.data(), this.extent(), this.rtl())
      : [],
  );
  protected readonly line = computed(() => sparklineLine(this.points()));
  protected readonly area = computed(() => sparklineArea(this.points(), this.extent()));

  protected readonly bars = computed(() => {
    const type = this.type();
    return type === 'bar' || type === 'win-loss'
      ? sparklineBars(this.data(), type, this.extent(), this.rtl())
      : null;
  });

  /** Indexes of the highlighted values, in the order of `highlight`, without duplicates. */
  private readonly highlighted = computed(() => {
    const stats = this.stats();
    if (!stats) return [] as { kind: 'last' | 'min' | 'max'; index: number }[];
    const index = { last: stats.lastIndex, min: stats.minIndex, max: stats.maxIndex };
    const kinds = [...new Set(this.highlight())].filter(
      (kind): kind is 'last' | 'min' | 'max' => kind !== 'none',
    );
    return kinds.map((kind) => ({ kind, index: index[kind] }));
  });
  protected readonly marked = computed(() => new Set(this.highlighted().map((h) => h.index)));

  protected readonly markers = computed(() =>
    this.highlighted().flatMap(({ kind, index }) => {
      const point = this.points()[index];
      return point ? [{ kind, d: `M ${point.x.toFixed(2)} ${point.y.toFixed(2)} h 0` }] : [];
    }),
  );

  protected readonly referenceY = computed(() => {
    const value = this.referenceLine();
    if (value === undefined || !Number.isFinite(value) || !this.stats()) return null;
    // Keep the line visible when it is at the very top (y would be a falsy 0 otherwise).
    return sparklineY(value, this.extent()).toFixed(2);
  });

  private readonly format = computed(
    () => new Intl.NumberFormat(this.locale(), { maximumFractionDigits: 2 }),
  );

  /** The label: `ariaLabel`, else a summary of the data. */
  protected readonly label = computed(() => {
    const given = this.ariaLabel();
    if (given) return given;
    const stats = this.stats();
    if (!stats) return this.text.missingData;
    if (this.type() === 'win-loss') {
      const finite = this.data().filter(Number.isFinite);
      return this.text.sparklineWinLoss(
        finite.filter((value) => value > 0).length,
        finite.filter((value) => value < 0).length,
      );
    }
    const format = (value: number) => this.format().format(value);
    const trend = {
      up: this.text.sparklineTrendUp,
      down: this.text.sparklineTrendDown,
      flat: this.text.sparklineTrendFlat,
    }[stats.trend];
    return this.text.sparklineSummary(
      format(stats.first),
      format(stats.last),
      format(stats.min),
      format(stats.max),
      trend,
    );
  });
}
