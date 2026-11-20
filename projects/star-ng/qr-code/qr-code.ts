import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { STAR_UI_TEXT, StarStyled, ɵSTAR_PART_HOST } from '@star-ng/ui/core';
import { qrEncode, StarQrErrorCorrection } from './qr-encoder';

/** Light modules around the symbol (ISO/IEC 18004, clause 6.3.8). */
const QUIET_ZONE = 4;
/** Longest value shown in the default label; a longer one is cut with an ellipsis. */
const LABEL_LENGTH = 80;
/** Share of the symbol width that a centre image covers. Level H restores up to 30 % damage. */
const IMAGE_SHARE = 0.22;

/**
 * SVG path of the dark modules: one subpath per horizontal run, offset by the quiet zone.
 * Each subpath is `M x y h n v1 h-n z`.
 */
function modulePath(modules: readonly (readonly boolean[])[]): string {
  let path = '';
  modules.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (!row[x]) {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run]) run++;
      path += `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${run}v1h-${run}z`;
      x += run;
    }
  });
  return path;
}

/**
 * QR code: a QR Code model 2 symbol drawn as SVG, encoded from ISO/IEC 18004 without a library.
 * Kendo UI `kendo-qrcode`, Ignite UI `igx-qr-code-barcode` and Syncfusion `ejs-qrcodegenerator`
 * are the equivalents.
 *
 * The version (1 to 40), the mode (numeric, alphanumeric, or UTF-8 bytes) and the mask are
 * chosen automatically; `errorCorrection` is L, M (default), Q or H. The symbol keeps a quiet
 * zone of 4 modules and draws its dark modules as one path. An optional centre `image` covers
 * part of the symbol, so it forces level H. The code is an image (`role="img"`) labelled
 * "QR code: value"; an empty value renders nothing. The modules stay dark on light in both
 * themes and under forced colours (`forced-color-adjust: none`), because many scanners cannot
 * read an inverted code.
 *
 * `<star-qr-code value="https://example.com" [size]="160" />`
 */
@Component({
  selector: 'star-qr-code',
  hostDirectives: [{ directive: StarStyled, inputs: ['pt', 'unstyled'] }],
  viewProviders: [{ provide: ɵSTAR_PART_HOST, useExisting: StarStyled }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'star-qr-code',
    '[attr.role]': "value() ? 'img' : null",
    '[class.star-qr-code--invalid]': '!!error()',
    '[attr.aria-label]': 'label()',
    '[style.--star-code-dark]': 'foreground()',
    '[style.--star-code-light]': 'background()',
  },
  template: `
    @if (code(); as symbol) {
      <svg
        data-star-part="graphic"
        class="star-qr-code__svg"
        [attr.viewBox]="'0 0 ' + side() + ' ' + side()"
        [attr.width]="size()"
        [attr.height]="size()"
        aria-hidden="true"
        focusable="false"
        shape-rendering="crispEdges"
      >
        <rect
          data-star-part="backgroundItem"
          class="star-qr-code__background"
          [attr.width]="side()"
          [attr.height]="side()"
        />
        <path data-star-part="modulesItem" class="star-qr-code__modules" [attr.d]="path()" />
        @if (imageBox(); as box) {
          <rect
            data-star-part="logoPanel"
            class="star-qr-code__image-backdrop"
            [attr.x]="box.x - 0.5"
            [attr.y]="box.y - 0.5"
            [attr.width]="box.size + 1"
            [attr.height]="box.size + 1"
          />
          <image
            data-star-part="logoItem"
            class="star-qr-code__image"
            [attr.href]="image()"
            [attr.x]="box.x"
            [attr.y]="box.y"
            [attr.width]="box.size"
            [attr.height]="box.size"
            preserveAspectRatio="xMidYMid meet"
          />
        }
      </svg>
    } @else if (error()) {
      <span data-star-part="errorText" class="star-qr-code__error">{{ error() }}</span>
    }
  `,
})
export class StarQrCode {
  protected readonly text = inject(STAR_UI_TEXT);

  /** The text to encode, for example a link. */
  readonly value = input('');
  /** Error correction level: L (7 %), M (15 %, default), Q (25 %) or H (30 %). */
  readonly errorCorrection = input<StarQrErrorCorrection>('M');
  /** Width and height in pixels. */
  readonly size = input(160);
  /**
   * Colour of the dark modules. Default `--star-code-dark` (black in both themes). Keep it dark
   * and fixed: a theme token such as `--star-text-strong` turns light in the dark theme, and
   * many readers cannot read a light code.
   */
  readonly foreground = input<string | null>(null);
  /** Colour of the light modules and the quiet zone. Default `--star-code-light`. */
  readonly background = input<string | null>(null);
  /**
   * Address of an image in the centre, for example a logo. It hides modules, so the level is
   * H. Keep the colours dark on light and test the code with the readers of your users.
   */
  readonly image = input<string | null>(null);
  /** Label for assistive technology. Default: "QR code: " and the value. */
  readonly ariaLabel = input<string | null>(null);

  /** The level in use: H when there is a centre image. */
  protected readonly level = computed<StarQrErrorCorrection>(() =>
    this.image() ? 'H' : this.errorCorrection(),
  );

  /** The encoded symbol, or the error text; nothing for an empty value. */
  private readonly result = computed(() => {
    if (!this.value()) return { code: null, error: null };
    try {
      return { code: qrEncode(this.value(), { errorCorrection: this.level() }), error: null };
    } catch (error) {
      // The encoder throws a RangeError when the value does not fit in version 40.
      const message =
        error instanceof RangeError ? this.text.qrCodeTooLong : this.text.barcodeInvalid('QR Code');
      return { code: null, error: message };
    }
  });
  protected readonly code = computed(() => this.result().code);
  protected readonly error = computed(() => this.result().error);

  protected readonly side = computed(() => (this.code()?.modules.length ?? 0) + 2 * QUIET_ZONE);
  protected readonly path = computed(() => modulePath(this.code()?.modules ?? []));

  /** Square of the centre image, aligned to whole modules, in view box units. */
  protected readonly imageBox = computed(() => {
    const code = this.code();
    if (!this.image() || !code) return null;
    const count = code.modules.length;
    let size = Math.floor(count * IMAGE_SHARE);
    if ((count - size) % 2) size++;
    const start = QUIET_ZONE + (count - size) / 2;
    return { x: start, y: start, size };
  });

  protected readonly label = computed(() => {
    if (!this.value()) return null;
    if (this.ariaLabel()) return this.ariaLabel()!;
    const error = this.error();
    if (error) return error;
    // Cut on code points, so a character outside the BMP is never split.
    const chars = [...this.value()];
    const short =
      chars.length > LABEL_LENGTH
        ? `${chars.slice(0, LABEL_LENGTH).join('').trimEnd()}…`
        : this.value();
    return this.text.qrCodeLabel(short);
  });
}
