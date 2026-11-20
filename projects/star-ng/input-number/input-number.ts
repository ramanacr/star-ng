import { _IdGenerator } from '@angular/cdk/a11y';
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { FormValueControl } from '@angular/forms/signals';
import {
  injectStarControlDefaults,
  STAR_UI_TEXT,
  StarInputVariant,
  StarStyled,
  ɵSTAR_PART_HOST,
} from '@star-ng/ui/core';
import { injectStarFieldLink } from '@star-ng/ui/field';

/**
 * Number field (PrimeNG `p-inputnumber`): locale formatting with `Intl.NumberFormat`
 * (decimal, currency, percent, units), min / max clamping, step buttons, Arrow keys and
 * PageUp / PageDown, `role="spinbutton"`. While focused the field shows plain editable digits;
 * on blur it shows the formatted number.
 *
 * `<star-input-number [formField]="form.quantity" [min]="0" [max]="500" unit="kilogram" showButtons />`
 */
@Component({
  selector: 'star-input-number',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-number',
    '[class.star-number--disabled]': 'disabled()',
    '[class.star-number--invalid]': 'showInvalid()',
    '[class.star-number--buttons]': 'showButtons()',
    '[class.star-number--filled]': "variant() === 'filled'",
  },
  template: `
    <div data-star-part="control" class="star-number__control">
      @if (showButtons()) {
        <button
          data-star-part="stepButton"
          type="button"
          class="star-number__btn"
          tabindex="-1"
          [attr.aria-label]="uiText.decrease"
          [disabled]="!canStep(-1)"
          (click)="stepBy(-1)"
        >
          <i data-star-part="stepIcon" class="ph-bold ph-minus" aria-hidden="true"></i>
        </button>
      }
      <input
        data-star-part="input"
        #input
        type="text"
        class="star-number__input"
        role="spinbutton"
        autocomplete="off"
        [attr.inputmode]="maxFractionDigits() === 0 ? 'numeric' : 'decimal'"
        [id]="inputId()"
        [attr.name]="name() || null"
        [value]="text()"
        [attr.placeholder]="placeholder()"
        [disabled]="disabled()"
        [readOnly]="readonly()"
        [required]="required()"
        [attr.aria-label]="ariaLabel()"
        [attr.aria-valuenow]="value()"
        [attr.aria-valuetext]="formatted()"
        [attr.aria-valuemin]="min()"
        [attr.aria-valuemax]="max()"
        [attr.aria-describedby]="field?.describedBy() ?? null"
        [attr.aria-invalid]="showInvalid() || null"
        (focus)="onFocus()"
        (input)="text.set(input.value)"
        (blur)="onBlur()"
        (keydown)="onKeydown($event)"
      />
      @if (showButtons()) {
        <button
          data-star-part="stepButton"
          type="button"
          class="star-number__btn"
          tabindex="-1"
          [attr.aria-label]="uiText.increase"
          [disabled]="!canStep(1)"
          (click)="stepBy(1)"
        >
          <i data-star-part="stepIcon" class="ph-bold ph-plus" aria-hidden="true"></i>
        </button>
      }
    </div>
  `,
})
export class StarInputNumber implements FormValueControl<number | null> {
  private readonly defaults = injectStarControlDefaults([]);
  protected readonly uiText = inject(STAR_UI_TEXT);
  protected readonly field = injectStarFieldLink(() => this.inputId());
  /** Invalid after touch, or while the parent `star-field` shows an error. */
  protected readonly showInvalid = computed(
    () => (this.invalid() && this.touched()) || !!this.field?.errorText(),
  );

  readonly value = model<number | null>(null);
  readonly mode = input<'decimal' | 'currency' | 'percent' | 'unit'>('decimal');
  /** ISO 4217 code for `mode="currency"`, for example `EUR`. */
  readonly currency = input('USD');
  /**
   * ECMA-402 sanctioned unit for `mode="unit"`, for example `kilogram`, `milliliter`, `day`.
   * An unsupported unit (such as `milligram`) is shown as a plain suffix instead of failing.
   */
  readonly unit = input('');
  /** Text before the number, for example `~ `. */
  readonly prefix = input('');
  /** Text after the number, for example ` kg`. */
  readonly suffix = input('');
  /** BCP 47 locale of the number format. Default: `locale` of `provideStarNg`, else the browser locale. */
  readonly locale = input<string | undefined>(this.defaults.locale ?? undefined);
  /** Look: border on every side, or a filled surface. Default: `inputVariant` of `provideStarNg`, else `outlined`. PrimeNG `variant`. */
  readonly variant = input<StarInputVariant>(this.defaults.inputVariant ?? 'outlined');
  /** Default: the Intl default for the mode (0 for decimal, 2 for most currencies). */
  readonly minFractionDigits = input<number | undefined>(undefined);
  /** Default: the Intl default for the mode (3 for decimal, 2 for most currencies). */
  readonly maxFractionDigits = input<number | undefined>(undefined);
  readonly useGrouping = input(true, { transform: booleanAttribute });
  readonly step = input(1);
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);
  readonly showButtons = input(false, { transform: booleanAttribute });
  readonly placeholder = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);
  readonly inputId = input(inject(_IdGenerator).getId('star-number-'));

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly readonly = input(false, { transform: booleanAttribute });
  readonly required = input(false, { transform: booleanAttribute });
  readonly invalid = input(false, { transform: booleanAttribute });
  readonly touched = input(false, { transform: booleanAttribute });
  readonly name = input('');
  readonly touch = output<void>();

  private readonly input = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly focused = signal(false);

  /** Unit text appended when Intl does not support `unit`. */
  private readonly fallbackUnit = signal('');

  private readonly formatter = computed(() => {
    const mode = this.mode();
    const options: Intl.NumberFormatOptions = {
      style: mode,
      currency: mode === 'currency' ? this.currency() : undefined,
      unit: mode === 'unit' ? this.unit() : undefined,
      minimumFractionDigits: this.minFractionDigits(),
      maximumFractionDigits: this.maxFractionDigits(),
      useGrouping: this.useGrouping(),
    };
    try {
      const format = new Intl.NumberFormat(this.locale(), options);
      untracked(() => this.fallbackUnit.set(''));
      return format;
    } catch (error) {
      if (mode !== 'unit') throw error;
      untracked(() => this.fallbackUnit.set(this.unit() ? ' ' + this.unit() : ''));
      return new Intl.NumberFormat(this.locale(), {
        ...options,
        style: 'decimal',
        unit: undefined,
      });
    }
  });

  /** Decimal separator of the locale (`.` or `,`). */
  private readonly decimal = computed(
    () =>
      new Intl.NumberFormat(this.locale())
        .formatToParts(1.1)
        .find((part) => part.type === 'decimal')?.value ?? '.',
  );

  protected readonly formatted = computed(() => {
    const value = this.value();
    if (value === null) return '';
    const number = this.formatter().format(this.mode() === 'percent' ? value / 100 : value);
    return this.prefix() + number + this.fallbackUnit() + this.suffix();
  });

  /** Plain digits while editing, formatted text otherwise. */
  protected readonly text = linkedSignal(() =>
    this.focused() ? this.plain(this.value()) : this.formatted(),
  );

  private plain(value: number | null): string {
    if (value === null) return '';
    return String(value).replace('.', this.decimal());
  }

  /** Reads typed text with either separator; ignores grouping, currency and unit symbols. */
  parse(text: string): number | null | undefined {
    const decimal = this.decimal();
    const cleaned = text
      .replace(new RegExp(`[^0-9${decimal === ',' ? ',' : '.'}-]`, 'g'), '')
      .replace(decimal, '.');
    if (!cleaned || cleaned === '-') return null;
    const number = Number(cleaned);
    return Number.isFinite(number) ? number : undefined;
  }

  private clamp(value: number): number {
    const min = this.min();
    const max = this.max();
    const digits = this.formatter().resolvedOptions().maximumFractionDigits ?? 2;
    // Percent mode stores 42 for 42 %, so keep the same digits as displayed.
    let result = Number(
      value.toFixed(this.mode() === 'percent' ? Math.max(0, digits - 2) : digits),
    );
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  }

  protected onFocus(): void {
    this.focused.set(true);
  }

  protected onBlur(): void {
    this.commit();
    this.focused.set(false);
    // The [value] binding may not change if the formatted text equals the last render.
    this.input().nativeElement.value = this.formatted();
    this.touch.emit();
  }

  private commit(): void {
    const parsed = this.parse(this.text());
    if (parsed === undefined) return;
    this.value.set(parsed === null ? null : this.clamp(parsed));
  }

  protected canStep(direction: 1 | -1): boolean {
    if (this.disabled() || this.readonly()) return false;
    const value = this.value();
    if (value === null) return true;
    const limit = direction === 1 ? this.max() : this.min();
    return limit === undefined || (direction === 1 ? value < limit : value > limit);
  }

  stepBy(direction: number): void {
    if (this.disabled() || this.readonly()) return;
    if (this.focused()) this.commit();
    const start = this.value() ?? this.min() ?? 0;
    const next = this.clamp(start + direction * this.step());
    this.value.set(next);
    this.input().nativeElement.value = this.focused() ? this.plain(next) : this.formatted();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const steps: Record<string, number> = { ArrowUp: 1, ArrowDown: -1, PageUp: 10, PageDown: -10 };
    if (event.key in steps) {
      event.preventDefault();
      this.stepBy(steps[event.key]);
    } else if (event.key === 'Home' && this.min() !== undefined) {
      event.preventDefault();
      this.value.set(this.min() ?? null);
    } else if (event.key === 'End' && this.max() !== undefined) {
      event.preventDefault();
      this.value.set(this.max() ?? null);
    } else if (event.key === 'Enter') {
      this.commit();
    }
  }

  focus(options?: FocusOptions): void {
    this.input().nativeElement.focus(options);
  }
}
