import {
  afterRenderEffect,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  Directive,
  ElementRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { StarDirectionService, starInlineKey, starIsRtl } from '@star-ng/ui/core';
import { injectStarFieldLink, starFieldLabelledBy, starJoinIds } from '@star-ng/ui/field';
import {
  arcPath,
  gaugeRatio,
  gaugeTicks,
  LINEAR_CROSS_BOX,
  LINEAR_END,
  LINEAR_LENGTH_BOX,
  LINEAR_START,
  linearPoint,
  polar,
  RADIAL_BOX,
  RADIAL_CENTER,
  radialAngle,
  radialRatioAt,
  snapGaugeValue,
  StarGaugeOrientation,
  StarGaugeTicks,
} from './gauge-geometry';

export type { StarGaugeOrientation, StarGaugeTicks } from './gauge-geometry';

/** Colour of a range: a slot of the chart palette (1 to 8) or a semantic colour token. */
export type StarGaugeColor = number | 'success' | 'warning' | 'danger';

/** A coloured band of the scale, for example the warning zone of a load. */
export interface StarGaugeRange {
  readonly from: number;
  readonly to: number;
  /** Chart palette slot 1 to 8, or `success`, `warning`, `danger`. Default: the slot of its position. */
  readonly color?: StarGaugeColor;
}

/** How the value is drawn: a `needle`, a filled `bar`, or a `marker` triangle. */
export type StarGaugePointer = 'needle' | 'bar' | 'marker';

/** Cross-axis positions of the linear gauge (view box units). */
const TRACK = 18;
const TRACK_WIDTH = 8;
const RANGE = 26;
const TICK_FROM = 30;
const MAJOR_TO = 38;
const MINOR_TO = 34;
const LABEL = 46;
/** The vertical view box is wider than the horizontal one is tall: labels sit beside the scale. */
const VERTICAL_CROSS_BOX = 96;

/** Radius of the radial track (centre line of the arc). */
const RADIUS = 75;

const SEMANTIC: Record<string, string> = {
  success: 'var(--star-success)',
  warning: 'var(--star-warning)',
  danger: 'var(--star-danger)',
};

function rangeColor(color: StarGaugeColor | undefined, index: number): string {
  if (typeof color === 'string' && SEMANTIC[color]) return SEMANTIC[color];
  const slot = typeof color === 'number' ? Math.round(color) : (index % 8) + 1;
  return `var(--star-chart-${slot >= 1 && slot <= 8 ? slot : 1})`;
}

const fixed = (value: number) => Number(value.toFixed(2));

/**
 * Shared inputs and behaviour of `star-linear-gauge` and `star-radial-gauge`: the value and the
 * scale, ranges, ticks, labels, formatting, motion and the optional interactive (slider) mode
 * with keyboard, pointer and Signal Forms support.
 */
@Directive()
export abstract class StarGaugeBase implements FormValueControl<number> {
  protected readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly direction = inject(StarDirectionService);

  /** The value. Two-way bindable; a Signal Forms field in interactive mode. */
  readonly value = model(0);
  /** Lowest value of the scale. Also bound from a Signal Forms `min()` rule. */
  readonly min = input<number | undefined>(0);
  /** Highest value of the scale. Also bound from a Signal Forms `max()` rule. */
  readonly max = input<number | undefined>(100);
  /** Coloured bands of the scale. */
  readonly ranges = input<readonly StarGaugeRange[]>([]);
  /** Major intervals (`major`) or the value between major ticks (`step`), and `minor` parts per interval. */
  readonly ticks = input<StarGaugeTicks>({ major: 5, minor: 2 });
  /**
   * Labels of the major ticks: `true` (default), `false`, or `Intl.NumberFormat` options that
   * format the labels and the value text, for example `{ style: 'unit', unit: 'percent' }`.
   */
  readonly labels = input<boolean | Intl.NumberFormatOptions>(true);
  /** Locale of the numbers (`Intl.NumberFormat`). Default: the runtime locale. */
  readonly locale = input<string | undefined>(undefined);
  /** Animates the pointer when the value changes. Off when the user prefers reduced motion. */
  readonly animate = input(true, { transform: booleanAttribute });
  /** Lets the user set the value: the gauge becomes a slider (keyboard and pointer). */
  readonly interactive = input(false, { transform: booleanAttribute });
  /** Step of the keyboard and the pointer in interactive mode. A value not above zero means 1. */
  readonly step = input(1);
  /** Label for assistive technology. */
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that labels the gauge. */
  readonly ariaLabelledby = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  /** Emits when an interactive gauge loses the focus. */
  readonly touch = output<void>();

  /** The parent `star-field` when it labels the gauge: the host is not labelable. */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  protected readonly labelledBy = computed(() =>
    starFieldLabelledBy(this.field, this.ariaLabel(), this.ariaLabelledby()),
  );
  protected readonly describedBy = computed(() => starJoinIds(this.field?.describedBy()));

  /** Direction measured at the host after a render; `null` before the first render. */
  private readonly hostRtl = signal<boolean | null>(null);
  protected readonly rtl = computed(() => this.hostRtl() ?? this.direction.value() === 'rtl');

  constructor() {
    afterRenderEffect(() => {
      this.direction.value();
      this.hostRtl.set(starIsRtl(this.host.nativeElement));
    });
  }

  /**
   * The scale ends: a bound that is not a finite number uses its default (0 or 100), and a `min`
   * above the `max` is swapped with it.
   */
  private readonly bounds = computed(() => {
    const min = this.min();
    const max = this.max();
    const low = min !== undefined && Number.isFinite(min) ? min : 0;
    const high = max !== undefined && Number.isFinite(max) ? max : 100;
    return low <= high ? [low, high] : [high, low];
  });
  protected readonly lowest = computed(() => this.bounds()[0]);
  protected readonly highest = computed(() => this.bounds()[1]);
  /** The step in use: 1 when `step` is not a number above zero. */
  protected readonly stepSize = computed(() => {
    const step = this.step();
    return step > 0 && Number.isFinite(step) ? step : 1;
  });
  /** The value kept on the scale. */
  protected readonly shown = computed(() =>
    Math.min(this.highest(), Math.max(this.lowest(), Number(this.value()) || 0)),
  );
  protected readonly ratio = computed(() =>
    gaugeRatio(this.shown(), this.lowest(), this.highest()),
  );
  /** Share of the scale in percent, for the bar pointer (`pathLength="100"`). */
  protected readonly dash = computed(() => `${fixed(this.ratio() * 100)} 100`);
  protected readonly active = computed(
    () => this.interactive() && !this.disabled() && !this.readonly(),
  );

  private readonly formatter = computed(() => {
    const labels = this.labels();
    const options = typeof labels === 'object' ? labels : { maximumFractionDigits: 2 };
    return new Intl.NumberFormat(this.locale(), options);
  });
  protected format(value: number): string {
    return this.formatter().format(value);
  }
  protected readonly valueText = computed(() => this.format(this.shown()));

  protected readonly tickValues = computed(() =>
    gaugeTicks(this.lowest(), this.highest(), this.ticks()),
  );

  /** Ranges as ratios on the scale, with their colour. */
  protected readonly rangeBands = computed(() =>
    this.ranges().map((range, index) => {
      const from = gaugeRatio(Math.min(range.from, range.to), this.lowest(), this.highest());
      const to = gaugeRatio(Math.max(range.from, range.to), this.lowest(), this.highest());
      return { from, to, color: rangeColor(range.color, index) };
    }),
  );

  /** Focuses the gauge (interactive mode). */
  focus(options?: FocusOptions): void {
    this.host.nativeElement.focus(options);
  }

  protected set(next: number): void {
    if (!this.active()) return;
    this.value.set(snapGaugeValue(next, this.lowest(), this.highest(), this.stepSize()));
  }

  /** `true` when the horizontal arrow keys follow the reading direction. */
  protected abstract readonly inlineArrows: () => boolean;
  /** The ratio of the scale under a pointer position, or `null` when it cannot be measured. */
  protected abstract ratioAt(event: PointerEvent): number | null;

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.active()) return;
    const step = this.stepSize();
    const big = Math.max(step, (this.highest() - this.lowest()) / 10);
    const key = this.inlineArrows() ? starInlineKey(event, this.host.nativeElement) : event.key;
    const moves: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: big,
      PageDown: -big,
    };
    if (key in moves) {
      event.preventDefault();
      this.set(this.shown() + moves[key]);
    } else if (key === 'Home' || key === 'End') {
      event.preventDefault();
      this.set(key === 'Home' ? this.lowest() : this.highest());
    }
  }

  /** `true` between a primary button press on the gauge and its release or cancel. */
  private dragging = false;

  /** A primary button press starts a drag and sets the value under the pointer. */
  protected onPointerDown(event: PointerEvent): void {
    if (!this.active() || event.button !== 0) return;
    event.preventDefault();
    this.focus();
    this.dragging = true;
    const target = this.host.nativeElement;
    if (typeof target.setPointerCapture === 'function' && event.pointerId !== undefined) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // A synthetic event has no active pointer to capture.
      }
    }
    this.setFromPointer(event);
  }

  /** Moves the value while a drag that started on the gauge goes on. */
  protected onPointerMove(event: PointerEvent): void {
    if (!this.dragging || !this.active()) return;
    this.setFromPointer(event);
  }

  /** `pointerup`, `pointercancel` and `lostpointercapture` end the drag. */
  protected endDrag(): void {
    this.dragging = false;
  }

  private setFromPointer(event: PointerEvent): void {
    const ratio = this.ratioAt(event);
    if (ratio === null) return;
    this.set(this.lowest() + ratio * (this.highest() - this.lowest()));
  }

  /** Position of a pointer in view box units of the gauge SVG. */
  protected pointIn(event: PointerEvent, width: number, height: number) {
    const svg = this.host.nativeElement.querySelector('svg');
    const box = svg?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return {
      x: ((event.clientX - box.left) / box.width) * width,
      y: ((event.clientY - box.top) / box.height) * height,
    };
  }
}

/** Host bindings shared by both gauges. */
const GAUGE_HOST = {
  '[attr.role]': "interactive() ? 'slider' : 'meter'",
  '[attr.tabindex]': 'active() ? 0 : interactive() ? -1 : null',
  '[attr.aria-valuenow]': 'shown()',
  '[attr.aria-valuemin]': 'lowest()',
  '[attr.aria-valuemax]': 'highest()',
  '[attr.aria-valuetext]': 'valueText()',
  '[attr.aria-label]': 'labelledBy() ? null : ariaLabel()',
  '[attr.aria-labelledby]': 'labelledBy()',
  '[attr.aria-describedby]': 'describedBy()',
  '[attr.aria-disabled]': '(interactive() && disabled()) || null',
  '[attr.aria-readonly]': '(interactive() && readonly()) || null',
  '[class.star-gauge--animate]': 'animate()',
  '[class.star-gauge--interactive]': 'active()',
  '[class.star-gauge--disabled]': 'disabled()',
  '(keydown)': 'onKeydown($event)',
  '(pointerdown)': 'onPointerDown($event)',
  '(pointermove)': 'onPointerMove($event)',
  '(pointerup)': 'endDrag()',
  '(pointercancel)': 'endDrag()',
  '(lostpointercapture)': 'endDrag()',
  '(blur)': 'touch.emit()',
};

/**
 * Linear gauge: a value on a straight scale with ranges, ticks and labels. Kendo UI
 * `kendo-lineargauge`, Ignite UI `igx-linear-gauge` and Syncfusion `ejs-lineargauge` are the
 * equivalents.
 *
 * Horizontal (default) or vertical; a horizontal scale runs from the right in right-to-left. The
 * gauge is a read-only `meter`; with `interactive` it is a `slider` (arrow keys, Page Up / Page
 * Down, Home / End, pointer drag) that works with Signal Forms like `star-slider`.
 *
 * `<star-linear-gauge [value]="load()" [ranges]="zones" ariaLabel="Server load" />`
 */
@Component({
  selector: 'star-linear-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    ...GAUGE_HOST,
    '[class]': "'star-gauge star-gauge--linear star-gauge--' + orientation()",
    '[attr.aria-orientation]': "interactive() && orientation() === 'vertical' ? 'vertical' : null",
  },
  template: `
    <svg class="star-gauge__svg" [attr.viewBox]="viewBox()" aria-hidden="true" focusable="false">
      <line
        class="star-gauge__track"
        [attr.stroke-width]="trackWidth"
        [attr.x1]="track().x1"
        [attr.y1]="track().y1"
        [attr.x2]="track().x2"
        [attr.y2]="track().y2"
      />
      @for (band of bands(); track $index) {
        <line
          class="star-gauge__range"
          [style.--star-gauge-range]="band.color"
          [attr.x1]="band.x1"
          [attr.y1]="band.y1"
          [attr.x2]="band.x2"
          [attr.y2]="band.y2"
        />
      }
      @for (tick of minorTicks(); track $index) {
        <line
          class="star-gauge__tick star-gauge__tick--minor"
          [attr.x1]="tick.x1"
          [attr.y1]="tick.y1"
          [attr.x2]="tick.x2"
          [attr.y2]="tick.y2"
        />
      }
      @for (tick of majorTicks(); track $index) {
        <line
          class="star-gauge__tick star-gauge__tick--major"
          [attr.x1]="tick.line.x1"
          [attr.y1]="tick.line.y1"
          [attr.x2]="tick.line.x2"
          [attr.y2]="tick.line.y2"
        />
        @if (labels() !== false) {
          <text
            class="star-gauge__label"
            [attr.x]="tick.label.x"
            [attr.y]="tick.label.y"
            [attr.text-anchor]="vertical() ? 'start' : 'middle'"
            dominant-baseline="middle"
            [textContent]="tick.text"
          ></text>
        }
      }
      @switch (pointer()) {
        @case ('needle') {
          <line
            class="star-gauge__needle"
            [style.transform]="move()"
            [attr.x1]="vertical() ? 6 : 0"
            [attr.y1]="vertical() ? 0 : 6"
            [attr.x2]="vertical() ? 30 : 0"
            [attr.y2]="vertical() ? 0 : 30"
          />
        }
        @case ('marker') {
          <path
            class="star-gauge__marker"
            [style.transform]="move()"
            [attr.d]="vertical() ? 'M 2 -6 L 2 6 L 12 0 Z' : 'M -6 2 L 6 2 L 0 12 Z'"
          />
        }
        @default {
          <line
            class="star-gauge__bar"
            pathLength="100"
            [attr.stroke-width]="trackWidth"
            [style.stroke-dasharray]="dash()"
            [attr.x1]="track().x1"
            [attr.y1]="track().y1"
            [attr.x2]="track().x2"
            [attr.y2]="track().y2"
          />
        }
      }
    </svg>
  `,
})
export class StarLinearGauge extends StarGaugeBase {
  /** `bar` (default), `needle` or `marker`. */
  readonly pointer = input<StarGaugePointer>('bar');
  /** `horizontal` (default) or `vertical` (the scale runs from the bottom). */
  readonly orientation = input<StarGaugeOrientation>('horizontal');

  protected readonly trackWidth = TRACK_WIDTH;
  protected readonly viewBox = computed(() =>
    this.orientation() === 'vertical'
      ? `0 0 ${VERTICAL_CROSS_BOX} ${LINEAR_LENGTH_BOX}`
      : `0 0 ${LINEAR_LENGTH_BOX} ${LINEAR_CROSS_BOX}`,
  );

  private point(ratio: number, offset: number) {
    return linearPoint(ratio, offset, this.orientation(), this.rtl());
  }
  private segment(from: number, to: number, offset: number) {
    const a = this.point(from, offset);
    const b = this.point(to, offset);
    return { x1: fixed(a.x), y1: fixed(a.y), x2: fixed(b.x), y2: fixed(b.y) };
  }

  protected readonly track = computed(() => this.segment(0, 1, TRACK));
  protected readonly bands = computed(() =>
    this.rangeBands().map((band) => ({
      ...this.segment(band.from, band.to, RANGE),
      color: band.color,
    })),
  );
  protected readonly majorTicks = computed(() =>
    this.tickValues().major.map((value) => {
      const ratio = gaugeRatio(value, this.lowest(), this.highest());
      return {
        line: this.tickLine(ratio, MAJOR_TO),
        label: this.point(ratio, LABEL),
        text: this.format(value),
      };
    }),
  );
  protected readonly minorTicks = computed(() =>
    this.tickValues().minor.map((value) =>
      this.tickLine(gaugeRatio(value, this.lowest(), this.highest()), MINOR_TO),
    ),
  );
  private tickLine(ratio: number, to: number) {
    const a = this.point(ratio, TICK_FROM);
    const b = this.point(ratio, to);
    return { x1: fixed(a.x), y1: fixed(a.y), x2: fixed(b.x), y2: fixed(b.y) };
  }

  protected readonly vertical = computed(() => this.orientation() === 'vertical');
  /** CSS transform that moves a needle or marker drawn at position 0 to the value. */
  protected readonly move = computed(() => {
    const at = this.point(this.ratio(), 0);
    return this.vertical()
      ? `translate(0px, ${fixed(at.y)}px)`
      : `translate(${fixed(at.x)}px, 0px)`;
  });

  protected readonly inlineArrows = () => !this.vertical();

  protected ratioAt(event: PointerEvent): number | null {
    const vertical = this.vertical();
    const at = vertical
      ? this.pointIn(event, VERTICAL_CROSS_BOX, LINEAR_LENGTH_BOX)
      : this.pointIn(event, LINEAR_LENGTH_BOX, LINEAR_CROSS_BOX);
    if (!at) return null;
    const length = LINEAR_END - LINEAR_START;
    let ratio = vertical ? (LINEAR_END - at.y) / length : (at.x - LINEAR_START) / length;
    if (!vertical && this.rtl()) ratio = 1 - ratio;
    return Math.min(1, Math.max(0, ratio));
  }
}

/**
 * Radial (arc) gauge: a value on a circular scale with ranges, ticks and labels. Kendo UI
 * `kendo-radialgauge` and `kendo-arcgauge`, Ignite UI `igx-radial-gauge` and Syncfusion
 * `ejs-circulargauge` are the equivalents.
 *
 * The arc runs from `startAngle` to `endAngle` (math degrees: 0 points right, 90 up; default
 * 225 to -45, a 270 degree arc open at the bottom). The gauge is a read-only `meter`; with
 * `interactive` it is a `slider` (arrow keys, Page Up / Page Down, Home / End, pointer drag).
 *
 * `<star-radial-gauge [value]="speed()" [max]="180" ariaLabel="Speed" />`
 */
@Component({
  selector: 'star-radial-gauge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { ...GAUGE_HOST, class: 'star-gauge star-gauge--radial' },
  template: `
    <svg class="star-gauge__svg" [attr.viewBox]="viewBox" aria-hidden="true" focusable="false">
      <path class="star-gauge__track" [attr.d]="track()" [attr.stroke-width]="width()" />
      @for (band of bands(); track $index) {
        <path class="star-gauge__range" [style.--star-gauge-range]="band.color" [attr.d]="band.d" />
      }
      @for (tick of minorTicks(); track $index) {
        <line
          class="star-gauge__tick star-gauge__tick--minor"
          [attr.x1]="tick.x1"
          [attr.y1]="tick.y1"
          [attr.x2]="tick.x2"
          [attr.y2]="tick.y2"
        />
      }
      @for (tick of majorTicks(); track $index) {
        <line
          class="star-gauge__tick star-gauge__tick--major"
          [attr.x1]="tick.line.x1"
          [attr.y1]="tick.line.y1"
          [attr.x2]="tick.line.x2"
          [attr.y2]="tick.line.y2"
        />
        @if (labels() !== false) {
          <text
            class="star-gauge__label"
            [attr.x]="tick.label.x"
            [attr.y]="tick.label.y"
            text-anchor="middle"
            dominant-baseline="middle"
            [textContent]="tick.text"
          ></text>
        }
      }
      @switch (pointer()) {
        @case ('bar') {
          <path
            class="star-gauge__bar"
            pathLength="100"
            [attr.d]="track()"
            [attr.stroke-width]="width()"
            [style.stroke-dasharray]="dash()"
          />
        }
        @case ('marker') {
          <path class="star-gauge__marker" [style.transform]="turn()" [attr.d]="marker()" />
        }
        @default {
          <g class="star-gauge__needle" [style.transform]="turn()">
            <path class="star-gauge__needle-body" [attr.d]="needle()" />
            <circle class="star-gauge__hub" cx="100" cy="100" r="6" />
          </g>
        }
      }
    </svg>
  `,
})
export class StarRadialGauge extends StarGaugeBase {
  /** `needle` (default), `bar` or `marker`. */
  readonly pointer = input<StarGaugePointer>('needle');
  /** Angle of the lowest value, in math degrees (0 points right, 90 up). */
  readonly startAngle = input(225);
  /** Angle of the highest value, in math degrees. Smaller than `startAngle`: the arc runs clockwise. */
  readonly endAngle = input(-45);
  /** Width of the arc, in units of the 200 × 200 view box. */
  readonly arcWidth = input(10);

  protected readonly viewBox = `0 0 ${RADIAL_BOX} ${RADIAL_BOX}`;
  protected readonly width = computed(() => Math.min(40, Math.max(1, this.arcWidth())));
  private readonly inner = computed(() => RADIUS - this.width() / 2);

  private angleOf(value: number): number {
    return radialAngle(
      gaugeRatio(value, this.lowest(), this.highest()),
      this.startAngle(),
      this.endAngle(),
    );
  }
  private ray(angle: number, from: number, to: number) {
    const a = polar(RADIAL_CENTER, RADIAL_CENTER, from, angle);
    const b = polar(RADIAL_CENTER, RADIAL_CENTER, to, angle);
    return { x1: fixed(a.x), y1: fixed(a.y), x2: fixed(b.x), y2: fixed(b.y) };
  }

  protected readonly track = computed(() =>
    arcPath(RADIAL_CENTER, RADIAL_CENTER, RADIUS, this.startAngle(), this.endAngle()),
  );
  protected readonly bands = computed(() =>
    this.rangeBands()
      .filter((band) => band.to > band.from)
      .map((band) => {
        const span = this.endAngle() - this.startAngle();
        const from = this.startAngle() + band.from * span;
        const to = this.startAngle() + band.to * span;
        const radius = this.inner() - 4;
        return { d: arcPath(RADIAL_CENTER, RADIAL_CENTER, radius, from, to), color: band.color };
      }),
  );
  protected readonly majorTicks = computed(() => {
    const base = this.inner() - 8;
    return this.tickValues().major.map((value) => {
      const angle = this.angleOf(value);
      const label = polar(RADIAL_CENTER, RADIAL_CENTER, base - 18, angle);
      return {
        line: this.ray(angle, base, base - 8),
        label: { x: fixed(label.x), y: fixed(label.y) },
        text: this.format(value),
      };
    });
  });
  protected readonly minorTicks = computed(() => {
    const base = this.inner() - 8;
    return this.tickValues().minor.map((value) => this.ray(this.angleOf(value), base, base - 4));
  });

  /** CSS rotation that turns a needle or marker drawn at angle 0 to the value. */
  protected readonly turn = computed(
    () => `rotate(${-radialAngle(this.ratio(), this.startAngle(), this.endAngle())}deg)`,
  );
  protected readonly needle = computed(() => {
    const tip = fixed(RADIAL_CENTER + this.inner() - 4);
    return `M ${RADIAL_CENTER} ${RADIAL_CENTER - 3} L ${tip} ${RADIAL_CENTER} L ${RADIAL_CENTER} ${RADIAL_CENTER + 3} Z`;
  });
  protected readonly marker = computed(() => {
    const outer = RADIAL_CENTER + RADIUS + this.width() / 2;
    const tip = fixed(outer + 1);
    const back = fixed(outer + 10);
    return `M ${back} ${RADIAL_CENTER - 6} L ${back} ${RADIAL_CENTER + 6} L ${tip} ${RADIAL_CENTER} Z`;
  });

  protected readonly inlineArrows = () => false;

  protected ratioAt(event: PointerEvent): number | null {
    const at = this.pointIn(event, RADIAL_BOX, RADIAL_BOX);
    if (!at) return null;
    const angle = (Math.atan2(RADIAL_CENTER - at.y, at.x - RADIAL_CENTER) * 180) / Math.PI;
    return radialRatioAt(angle, this.startAngle(), this.endAngle());
  }
}
