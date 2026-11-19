import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { STAR_UI_TEXT } from '@star-ng/ui/core';
import { StarBarcodeType, starEncodeBarcode } from './barcode-encoder';

/** Names of the symbologies in the error text. */
const TYPE_NAMES: Record<StarBarcodeType, string> = {
  code128: 'Code 128',
  ean13: 'EAN-13',
  upca: 'UPC-A',
  code39: 'Code 39',
};

/** Room under the bars for the human-readable text, in pixels. */
const TEXT_ROOM = 18;

/**
 * Barcode: a linear barcode drawn as SVG rectangles. Kendo UI `kendo-barcode` and Syncfusion
 * `ejs-barcodegenerator` are the equivalents.
 *
 * Types: `code128` (default; code sets A, B and C chosen automatically, with the check
 * character), `ean13`, `upca` (12 or 11 digits get their check digit; a wrong check digit is an
 * error) and `code39`. The symbol keeps the quiet zones of its standard. The barcode is an image
 * (`role="img"`) labelled with the human-readable value. A value that cannot be encoded shows an
 * error text and emits `invalid`. The bars stay dark on light in both themes and under forced
 * colours (`forced-color-adjust: none`), because many scanners cannot read an inverted code.
 *
 * `<star-barcode value="5901234123457" type="ean13" />`
 */
@Component({
  selector: 'star-barcode',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'img',
    class: 'star-barcode',
    '[class.star-barcode--invalid]': '!encoding()',
    '[attr.aria-label]': 'label()',
  },
  template: `
    @if (encoding(); as code) {
      <svg
        class="star-barcode__svg"
        [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
        [attr.width]="width()"
        [attr.height]="height()"
        aria-hidden="true"
        focusable="false"
        shape-rendering="crispEdges"
      >
        <rect class="star-barcode__background" [attr.width]="width()" [attr.height]="height()" />
        @for (bar of rects(); track $index) {
          <rect
            class="star-barcode__bar"
            [attr.x]="bar.x"
            y="0"
            [attr.width]="bar.width"
            [attr.height]="barHeight()"
          />
        }
        @if (showText()) {
          <text
            class="star-barcode__text"
            [attr.x]="width() / 2"
            [attr.y]="barHeight() + 14"
            text-anchor="middle"
            [textContent]="code.text"
          ></text>
        }
      </svg>
    } @else {
      <span class="star-barcode__error">{{ error() }}</span>
    }
  `,
})
export class StarBarcode {
  protected readonly text = inject(STAR_UI_TEXT);

  /** The value to encode. */
  readonly value = input('');
  /** The symbology: `code128` (default), `ean13`, `upca` or `code39`. */
  readonly type = input<StarBarcodeType>('code128');
  /** Shows the human-readable text under the bars. */
  readonly showText = input(true, { transform: booleanAttribute });
  /** Height of the bars in pixels. */
  readonly barHeight = input(64);
  /** Width of the narrowest bar (one module) in pixels. Rounded to whole pixels, at least 1. */
  readonly moduleWidth = input(2);
  /** Label for assistive technology. Default: the human-readable value. */
  readonly ariaLabel = input<string | null>(null);
  // The wave G1 brief asks for an output named `invalid`. It shares the name of a native DOM
  // event, but the host is not a form control, so the native `invalid` event never fires on it.
  /** Emits `true` when the value cannot be encoded, and `false` when it can be again. */
  readonly invalid = output<boolean>(); // eslint-disable-line @angular-eslint/no-output-native

  protected readonly encoding = computed(() => starEncodeBarcode(this.value(), this.type()));
  /** Whole pixels per module, so every bar edge falls on a pixel and the widths stay exact. */
  private readonly module = computed(() => {
    const width = Math.round(this.moduleWidth());
    return Number.isFinite(width) ? Math.max(1, width) : 1;
  });

  protected readonly rects = computed(() => {
    const code = this.encoding();
    if (!code) return [];
    const module = this.module();
    const rects: { x: number; width: number }[] = [];
    let x = code.quiet[0];
    code.bars.forEach((width, index) => {
      if (index % 2 === 0) rects.push({ x: x * module, width: width * module });
      x += width;
    });
    return rects;
  });
  protected readonly width = computed(() => {
    const code = this.encoding();
    if (!code) return 0;
    const modules = code.bars.reduce((sum, width) => sum + width, 0);
    return (code.quiet[0] + modules + code.quiet[1]) * this.module();
  });
  protected readonly height = computed(() => this.barHeight() + (this.showText() ? TEXT_ROOM : 0));

  protected readonly error = computed(() => this.text.barcodeInvalid(TYPE_NAMES[this.type()]));
  protected readonly label = computed(
    () => this.ariaLabel() || (this.encoding()?.text ?? this.error()),
  );

  constructor() {
    let last = false;
    effect(() => {
      const invalid = !this.encoding();
      if (invalid === last) return;
      last = invalid;
      untracked(() => this.invalid.emit(invalid));
    });
  }
}
