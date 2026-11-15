import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import { STAR_UI_TEXT } from '@star-ng/ui/core';

/**
 * Knob (PrimeNG `p-knob`): circular value dial, `role="slider"` with Arrow / PageUp / PageDown /
 * Home / End keys; drag around the dial with a pointer.
 * `<star-knob [(value)]="completion" [max]="100" valueTemplate="{value}%" ariaLabel="Completion" />`
 */
@Component({
  selector: 'star-knob',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-knob', '[class.star-knob--disabled]': 'disabled()' },
  template: `
    <svg
      viewBox="0 0 100 100"
      [attr.width]="size()"
      [attr.height]="size()"
      role="slider"
      [attr.tabindex]="disabled() ? -1 : 0"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-valuemin]="lowest()"
      [attr.aria-valuemax]="highest()"
      [attr.aria-valuenow]="value()"
      [attr.aria-valuetext]="text()"
      [attr.aria-disabled]="disabled() || null"
      (keydown)="onKeydown($event)"
      (pointerdown)="onPointer($event)"
      (pointermove)="$event.buttons === 1 && onPointer($event)"
      (blur)="touch.emit()"
    >
      <path class="star-knob__track" [attr.d]="arc(1)" />
      <path class="star-knob__value" [attr.d]="arc(ratio())" />
      <text class="star-knob__text" x="50" y="57" text-anchor="middle">{{ text() }}</text>
    </svg>
  `,
})
export class StarKnob implements FormValueControl<number> {
  readonly value = model(0);
  readonly min = input<number | undefined>(0);
  readonly max = input<number | undefined>(100);
  readonly step = input(1);
  readonly size = input(120);
  /** `{value}` is replaced by the number, for example `{value}%`. */
  readonly valueTemplate = input('{value}');
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();
  protected readonly id = inject(_IdGenerator).getId('star-knob-');

  protected readonly lowest = computed(() => this.min() ?? 0);
  protected readonly highest = computed(() => this.max() ?? 100);
  protected readonly ratio = computed(
    () => (this.value() - this.lowest()) / Math.max(1, this.highest() - this.lowest()),
  );
  protected readonly text = computed(() =>
    this.valueTemplate().replace('{value}', String(this.value())),
  );

  /** 270° arc from the lower left, clockwise. */
  protected arc(ratio: number): string {
    const start = (135 * Math.PI) / 180;
    const end = start + Math.max(0.0001, ratio) * 1.5 * Math.PI;
    const p = (a: number) =>
      `${(50 + 40 * Math.cos(a)).toFixed(2)} ${(50 + 40 * Math.sin(a)).toFixed(2)}`;
    return `M ${p(start)} A 40 40 0 ${end - start > Math.PI ? 1 : 0} 1 ${p(end)}`;
  }

  private set(next: number): void {
    if (this.disabled() || this.readonly()) return;
    const stepped = Math.round(next / this.step()) * this.step();
    this.value.set(Math.min(this.highest(), Math.max(this.lowest(), stepped)));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const big = (this.highest() - this.lowest()) / 10;
    const moves: Record<string, number> = {
      ArrowUp: this.step(),
      ArrowRight: this.step(),
      ArrowDown: -this.step(),
      ArrowLeft: -this.step(),
      PageUp: big,
      PageDown: -big,
    };
    if (event.key in moves) {
      event.preventDefault();
      this.set(this.value() + moves[event.key]);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.set(event.key === 'Home' ? this.lowest() : this.highest());
    }
  }

  protected onPointer(event: PointerEvent): void {
    const svg = event.currentTarget as SVGSVGElement;
    const box = svg.getBoundingClientRect();
    const angle = Math.atan2(
      event.clientY - (box.top + box.height / 2),
      event.clientX - (box.left + box.width / 2),
    );
    let degrees = (angle * 180) / Math.PI - 135;
    if (degrees < 0) degrees += 360;
    if (degrees > 270) return;
    this.set(this.lowest() + (degrees / 270) * (this.highest() - this.lowest()));
  }
}

const SWATCHES = [
  '#4f46e5',
  '#0369a1',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#6250d6',
  '#0f172a',
  '#64748b',
];

/**
 * Color picker (PrimeNG `p-colorpicker`): preset swatches, the native color dialog and a
 * hex field. Value: `#rrggbb`.
 * `<star-color-picker [(value)]="tagColor" ariaLabel="Tag color" />`
 */
@Component({
  selector: 'star-color-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'star-color' },
  template: `
    <div
      class="star-color__swatches"
      role="radiogroup"
      [attr.aria-label]="ariaLabel() ?? text.colorLabel"
    >
      @for (swatch of swatches(); track swatch) {
        <button
          type="button"
          role="radio"
          class="star-color__swatch"
          [style.background]="swatch"
          [attr.aria-checked]="swatch.toLowerCase() === value().toLowerCase()"
          [attr.aria-label]="swatch"
          [disabled]="disabled()"
          (click)="value.set(swatch)"
        ></button>
      }
    </div>
    <label class="star-color__custom">
      <input
        type="color"
        class="star-color__native"
        [value]="value()"
        [disabled]="disabled()"
        (input)="value.set($any($event.target).value)"
        (blur)="touch.emit()"
      />
      <span class="star-sr-only">{{ text.customColor }}</span>
    </label>
    <input
      class="star-input star-input--sm star-color__hex"
      [value]="value()"
      [disabled]="disabled()"
      [attr.aria-label]="text.hexValue(ariaLabel() ?? text.colorLabel)"
      maxlength="7"
      (change)="onHex($any($event.target))"
    />
  `,
})
export class StarColorPicker implements FormValueControl<string> {
  protected readonly text = inject(STAR_UI_TEXT);
  readonly value = model('#4f46e5');
  readonly swatches = input<readonly string[]>(SWATCHES);
  readonly ariaLabel = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly touch = output<void>();

  protected onHex(input: HTMLInputElement): void {
    const raw = input.value.trim();
    const hex = raw.startsWith('#') ? raw : `#${raw}`;
    if (/^#[0-9a-f]{6}$/i.test(hex)) this.value.set(hex.toLowerCase());
    else input.value = this.value();
  }
}
