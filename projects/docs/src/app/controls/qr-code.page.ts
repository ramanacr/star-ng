import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarInput } from '@star-ng/ui/field';
import { StarQrCode, StarQrErrorCorrection } from '@star-ng/ui/qr-code';
import { StarSelectButton } from '@star-ng/ui/select-button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-qr-code-page',
  imports: [DOCS, StarQrCode, StarInput, StarSelectButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="QR code"
      lead="A QR Code drawn as SVG, encoded from ISO/IEC 18004 without a library: automatic version, mode and mask, four error correction levels and an optional centre image. The Kendo UI equivalent is kendo-qrcode; Ignite UI has igx-qr-code-barcode and Syncfusion has ejs-qrcodegenerator."
      importFrom="import { StarQrCode, starEncodeQr } from '@star-ng/ui/qr-code';"
    >
      <docs-example
        heading="Link"
        source="qr-code/link"
        note="The version (1 to 40), the mode (numeric, alphanumeric or UTF-8 bytes) and the mask are chosen automatically. The symbol has a quiet zone of 4 modules. It is an image labelled QR code and the value; ariaLabel sets another label."
      >
        <star-qr-code value="https://example.com/orders/1042" />
      </docs-example>

      <docs-example
        heading="Error correction"
        source="qr-code/levels"
        [script]="levelScript"
        note="errorCorrection is L (7 % of the symbol can be restored), M (15 %, default), Q (25 %) or H (30 %). A higher level makes a larger symbol for the same value."
      >
        <div class="docs-stack">
          <star-select-button
            [options]="['L', 'M', 'Q', 'H']"
            [(value)]="level"
            ariaLabel="Error correction level"
          />
          <input
            starInput
            aria-label="QR code value"
            [value]="value()"
            (input)="value.set($any($event.target).value)"
          />
          <star-qr-code [value]="value()" [errorCorrection]="levelOf(level())" [size]="200" />
        </div>
      </docs-example>

      <docs-example
        heading="Centre image"
        source="qr-code/image"
        note="image puts a picture in the centre. It hides modules, so the level is always H. Keep the image small and the colours dark on light, and test the code with the readers your users have: not every reader copes with a covered centre."
      >
        <star-qr-code value="https://example.com/projects" image="favicon.svg" [size]="200" />
      </docs-example>

      <docs-example
        heading="Colours"
        source="qr-code/colours"
        note="foreground and background take a CSS colour or a token. The default tokens --star-code-dark and --star-code-light keep the code dark on light in both themes, because many readers cannot read a light code on a dark field. Under forced colours the code keeps these colours (forced-color-adjust: none), so a high-contrast theme does not invert it."
      >
        <star-qr-code
          value="INVOICE 2026-0042"
          foreground="var(--star-primary)"
          [size]="120"
          ariaLabel="Invoice 2026-0042"
        />
      </docs-example>

      <docs-api [of]="['StarQrCode']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class QrCodePage {
  protected readonly level = signal<string | readonly string[] | null>('M');
  protected readonly value = signal('https://example.com/invoices/2026-0042');

  protected levelOf(level: string | readonly string[] | null): StarQrErrorCorrection {
    return level === 'L' || level === 'Q' || level === 'H' ? level : 'M';
  }

  protected readonly levelScript = `readonly level = signal<string | readonly string[] | null>('M');
readonly value = signal('https://example.com/invoices/2026-0042');

levelOf(level: string | readonly string[] | null): StarQrErrorCorrection {
  return level === 'L' || level === 'Q' || level === 'H' ? level : 'M';
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-code-dark',
      description: 'Colour of the dark modules. Black in both themes. Set by foreground.',
    },
    {
      name: '--star-code-light',
      description:
        'Colour of the light modules and the quiet zone. White in both themes. Set by background.',
    },
    { name: '--star-danger', description: 'Colour of the error text when the value is too long.' },
  ];
}
