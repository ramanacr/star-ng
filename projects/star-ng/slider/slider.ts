import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { injectStarFieldLink, starJoinIds } from '@star-ng/ui/field';

/**
 * Slider (PrimeNG `p-slider`) on native `<input type="range">`: full keyboard and screen-reader
 * support from the platform, styled track and fill, optional value label.
 * `<star-slider [(value)]="severity" [min]="1" [max]="5" ariaLabel="Severity" showValue />`
 *
 * `orientation="vertical"` draws it from bottom (min) to top (max) with `aria-orientation`;
 * `slideEnd` emits the value when a drag or a key press ends (PrimeNG `orientation`,
 * `onSlideEnd`).
 */
@Component({
  selector: 'star-slider',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-slider',
    '[class.star-slider--disabled]': 'disabled()',
    '[class.star-slider--vertical]': "orientation() === 'vertical'",
  },
  template: `
    <input
      data-star-part="input"
      #range
      type="range"
      class="star-slider__input"
      [id]="inputId()"
      [min]="low()"
      [max]="high()"
      [step]="step()"
      [value]="value()"
      [disabled]="disabled() || readonly()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-labelledby]="ariaLabelledBy()"
      [attr.aria-describedby]="fieldDescribedBy()"
      [attr.aria-valuetext]="valueText()"
      [attr.aria-orientation]="orientation() === 'vertical' ? 'vertical' : null"
      [style.--star-fill]="percent() + '%'"
      (input)="value.set(+range.value)"
      (change)="slideEnd.emit(value())"
      (blur)="touch.emit()"
    />
    @if (showValue()) {
      <output data-star-part="valueText" class="star-slider__value" [attr.for]="inputId()">{{
        valueText()
      }}</output>
    }
  `,
})
export class StarSlider implements FormValueControl<number> {
  readonly value = model(0);
  /** Also bound from Signal Forms `min()` / `max()` validators. */
  readonly min = input<number | undefined>(0);
  readonly max = input<number | undefined>(100);
  protected readonly low = computed(() => this.min() ?? 0);
  protected readonly high = computed(() => this.max() ?? 100);
  readonly step = input(1);
  readonly showValue = input(false, { transform: booleanAttribute });
  /** Text for the current value, for example `(v) => v + ' kg'`. */
  readonly format = input<(value: number) => string>(String);
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that labels the control (`aria-labelledby`). PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  /** A value is needed; feeds Signal Forms `required()` (the slider role takes no `aria-required`). */
  readonly required = input(false, { transform: booleanAttribute });
  /** `'vertical'` draws the slider from bottom (min) to top (max). PrimeNG `orientation`. */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** The value when a drag or a key press ends (the native `change`). PrimeNG `onSlideEnd`. */
  readonly slideEnd = output<number>();
  readonly inputId = input(inject(_IdGenerator).getId('star-slider-'));
  /** The parent `star-field` when it labels the slider: the label points at the input. */
  private readonly field = injectStarFieldLink(this.inputId);
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected readonly percent = computed(
    () => ((this.value() - this.low()) / Math.max(1, this.high() - this.low())) * 100,
  );
  protected readonly valueText = computed(() => this.format()(this.value()));
}

/**
 * Range slider (PrimeNG `p-slider [range]`): two native range inputs on one track; the handles
 * cannot cross. Value: `[low, high]`.
 * `<star-range-slider [(value)]="ageRange" [bounds]="[0, 100]" ariaLabel="Age" showValue />`
 *
 * `orientation="vertical"`, `slideEnd` (the value when a drag or key press ends),
 * `minStepsBetweenHandles` (the smallest gap, in steps) and `disabledMinHandle` /
 * `disabledMaxHandle` (lock one handle) follow PrimeNG. With `ariaLabelledBy` the host is a
 * labelled `group`.
 */
@Component({
  selector: 'star-range-slider',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],

  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-slider star-slider--range',
    '[class.star-slider--disabled]': 'disabled()',
    '[class.star-slider--vertical]': "orientation() === 'vertical'",
    '[attr.role]': "ariaLabelledBy() ? 'group' : null",
    '[attr.aria-labelledby]': 'ariaLabelledBy()',
  },
  template: `
    <div
      data-star-part="track"
      class="star-slider__track"
      [style.--star-from]="lowPercent() + '%'"
      [style.--star-to]="highPercent() + '%'"
    >
      <input
        data-star-part="input"
        #low
        type="range"
        class="star-slider__input"
        [min]="bounds()[0]"
        [max]="bounds()[1]"
        [step]="step()"
        [value]="value()[0]"
        [disabled]="disabled() || disabledMinHandle()"
        [attr.aria-orientation]="orientation() === 'vertical' ? 'vertical' : null"
        (change)="slideEnd.emit(value())"
        [attr.aria-label]="text.sliderMinimum(groupLabel())"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-valuetext]="format()(value()[0])"
        (input)="setLow(+low.value, low)"
        (blur)="touch.emit()"
      />
      <input
        data-star-part="input"
        #high
        type="range"
        class="star-slider__input"
        [min]="bounds()[0]"
        [max]="bounds()[1]"
        [step]="step()"
        [value]="value()[1]"
        [disabled]="disabled() || disabledMaxHandle()"
        [attr.aria-orientation]="orientation() === 'vertical' ? 'vertical' : null"
        (change)="slideEnd.emit(value())"
        [attr.aria-label]="text.sliderMaximum(groupLabel())"
        [attr.aria-describedby]="fieldDescribedBy()"
        [attr.aria-valuetext]="format()(value()[1])"
        (input)="setHigh(+high.value, high)"
        (blur)="touch.emit()"
      />
    </div>
    @if (showValue()) {
      <output data-star-part="valueText" class="star-slider__value"
        >{{ format()(value()[0]) }} – {{ format()(value()[1]) }}</output
      >
    }
  `,
})
export class StarRangeSlider implements FormValueControl<readonly [number, number]> {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly value = model<readonly [number, number]>([0, 100]);
  /** Lowest and highest selectable values. */
  readonly bounds = input<readonly [number, number]>([0, 100]);
  readonly step = input(1);
  readonly showValue = input(false, { transform: booleanAttribute });
  readonly format = input<(value: number) => string>(String);
  readonly ariaLabel = input<string | null>(null);
  /** Id of the element that labels the control (`aria-labelledby`). PrimeNG `ariaLabelledBy`. */
  readonly ariaLabelledBy = input<string | null>(null);
  /** A value is needed; feeds Signal Forms `required()` (the slider role takes no `aria-required`). */
  readonly required = input(false, { transform: booleanAttribute });
  readonly disabled = input(false, { transform: booleanAttribute });
  /** `'vertical'`: low at the bottom, high at the top. PrimeNG `orientation`. */
  readonly orientation = input<'horizontal' | 'vertical'>('horizontal');
  /** Smallest gap between the handles, in steps. PrimeNG `minStepsBetweenHandles`. */
  readonly minStepsBetweenHandles = input(0);
  /** Locks the low handle. PrimeNG `disabledMinHandle`. */
  readonly disabledMinHandle = input(false, { transform: booleanAttribute });
  /** Locks the high handle. PrimeNG `disabledMaxHandle`. */
  readonly disabledMaxHandle = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  /** The value when a drag or a key press ends (the native `change`). PrimeNG `onSlideEnd`. */
  readonly slideEnd = output<readonly [number, number]>();
  private readonly gap = computed(() => Math.max(0, this.minStepsBetweenHandles()) * this.step());

  private readonly low = viewChild.required<ElementRef<HTMLInputElement>>('low');
  /**
   * The parent `star-field` when it labels the slider. Two inputs share one label, so the label
   * has no `for`: each input names itself with the label text, and a click focuses the low one.
   */
  private readonly field = injectStarFieldLink(null, () => this.focus());
  /** `ariaLabel`, else the `star-field` label text. */
  protected readonly groupLabel = computed(() => this.ariaLabel() ?? (this.field?.label() || ''));
  protected readonly fieldDescribedBy = computed(() => starJoinIds(this.field?.describedBy()));

  /** Focuses the handle of the low value. */
  focus(options?: FocusOptions): void {
    this.low().nativeElement.focus(options);
  }

  private toPercent(value: number): number {
    return ((value - this.bounds()[0]) / Math.max(1, this.bounds()[1] - this.bounds()[0])) * 100;
  }
  protected readonly lowPercent = computed(() => this.toPercent(this.value()[0]));
  protected readonly highPercent = computed(() => this.toPercent(this.value()[1]));

  protected setLow(value: number, input: HTMLInputElement): void {
    this.apply(value, this.value()[1], 'low', input);
  }

  protected setHigh(value: number, input: HTMLInputElement): void {
    this.apply(this.value()[0], value, 'high', input);
  }

  /**
   * Keeps both values in the bounds and at least the gap apart. The moved handle gives way to the
   * other one; when the bounds leave no room, the other handle moves too.
   */
  private apply(low: number, high: number, moved: 'low' | 'high', input: HTMLInputElement): void {
    const [min, max] = this.bounds();
    const gap = Math.min(this.gap(), max - min);
    const clamp = (n: number) => Math.min(max, Math.max(min, n));
    if (moved === 'low') {
      low = clamp(Math.min(low, high - gap));
      high = clamp(Math.max(high, low + gap));
      low = Math.min(low, high - gap);
    } else {
      high = clamp(Math.max(high, low + gap));
      low = clamp(Math.min(low, high - gap));
      high = Math.max(high, low + gap);
    }
    input.value = String(moved === 'low' ? low : high);
    this.value.set([low, high]);
  }
}
