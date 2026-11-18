import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarBarcode, StarBarcodeType } from '@star-ng/ui/barcode';
import { StarInput } from '@star-ng/ui/field';
import { StarSelect } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-barcode-page',
  imports: [DOCS, StarBarcode, StarInput, StarSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Barcode"
      lead="A linear barcode drawn as SVG: Code 128, EAN-13, UPC-A and Code 39, encoded from the standards without a library. The Kendo UI equivalent is kendo-barcode; Syncfusion has ejs-barcodegenerator."
      importFrom="import { StarBarcode, starEncodeBarcode } from '@star-ng/ui/barcode';"
    >
      <docs-example
        heading="Code 128"
        source="barcode/code128"
        note="Code 128 encodes ASCII text. The code sets A, B and C are chosen automatically: runs of digits use set C, which packs two digits in one character. The check character is added. The barcode is an image labelled with the human-readable value."
      >
        <star-barcode value="ORDER-2026-00418" />
      </docs-example>

      <docs-example
        heading="Product codes"
        source="barcode/product"
        note="EAN-13 takes 12 digits (the check digit is added) or 13 digits; UPC-A takes 11 or 12 digits. Each symbol keeps the quiet zones of its standard: 11 and 7 modules for EAN-13, 9 for UPC-A, 10 for Code 128 and Code 39."
      >
        <div class="docs-row">
          <star-barcode value="5901234123457" type="ean13" />
          <star-barcode value="036000291452" type="upca" />
          <star-barcode value="PART-42" type="code39" [moduleWidth]="1" />
        </div>
      </docs-example>

      <docs-example
        heading="Error state"
        source="barcode/error"
        [script]="errorScript"
        note="A value that cannot be encoded (a wrong check digit, a letter in an EAN-13, a character outside the set) shows an error text instead of bars, and the invalid output emits true."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-select
              [options]="types"
              optionLabel="label"
              optionValue="value"
              [(value)]="type"
              ariaLabel="Barcode type"
              [style.width.rem]="10"
            />
            <input
              starInput
              aria-label="Barcode value"
              [value]="value()"
              (input)="value.set($any($event.target).value)"
            />
          </div>
          <star-barcode
            [value]="value()"
            [type]="type() ?? 'code128'"
            (invalid)="invalid.set($event)"
          />
          <p>Valid: {{ invalid() ? 'no' : 'yes' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Size and text"
        source="barcode/size"
        note="moduleWidth is the width of the narrowest bar in pixels, barHeight the height of the bars. showText shows or hides the text under the bars."
      >
        <star-barcode value="4006381333931" type="ean13" [moduleWidth]="3" [barHeight]="90" />
        <star-barcode value="INV-1042" [showText]="false" [barHeight]="40" />
      </docs-example>

      <docs-api [of]="['StarBarcode']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class BarcodePage {
  protected readonly types: readonly { label: string; value: StarBarcodeType }[] = [
    { label: 'Code 128', value: 'code128' },
    { label: 'EAN-13', value: 'ean13' },
    { label: 'UPC-A', value: 'upca' },
    { label: 'Code 39', value: 'code39' },
  ];
  protected readonly type = signal<StarBarcodeType | null>('ean13');
  protected readonly value = signal('5901234123450');
  protected readonly invalid = signal(false);

  protected readonly errorScript = `readonly type = signal<StarBarcodeType | null>('ean13');
readonly value = signal('5901234123450');
readonly invalid = signal(false);`;

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-code-dark',
      description: 'Colour of the bars and the text. Black in both themes.',
    },
    {
      name: '--star-code-light',
      description: 'Colour of the field and the quiet zones. White in both themes.',
    },
    { name: '--star-danger', description: 'Colour of the error text and its border.' },
  ];
}
