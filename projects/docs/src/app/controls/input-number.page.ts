import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import { StarInputNumber } from '@star-ng/ui/input-number';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './input-number.page.scss',
  selector: 'docs-input-number-page',
  imports: [DOCS, StarInputNumber, StarIconTemplate, StarField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Input number"
      lead="A number field that formats with the browser Intl API: decimal, currency, percent and unit. It parses what the user types in the same locale."
      importFrom="import { StarInputNumber } from '@star-ng/ui/input-number';"
    >
      <docs-example heading="Decimal with buttons" source="input-number/basic">
        <div class="docs-stack">
          <star-field label="Quantity">
            <star-input-number [(value)]="quantity" [min]="0" [max]="20" showButtons />
          </star-field>
          <p class="docs-output" role="status">Quantity: {{ quantity() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Currency and locale"
        source="input-number/currency"
        note="The value is a number. The text follows the locale: 1.234,50 € in de-DE."
      >
        <div class="docs-stack">
          <star-input-number
            [(value)]="price"
            mode="currency"
            currency="EUR"
            locale="de-DE"
            ariaLabel="Price in euro"
          />
          <star-input-number
            [(value)]="price"
            mode="currency"
            currency="USD"
            locale="en-US"
            ariaLabel="Price in dollars"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Percent, unit and suffix"
        source="input-number/modes"
        note="In percent mode the value is the number shown: 25 is 25 %."
      >
        <div class="docs-stack">
          <star-input-number [(value)]="share" mode="percent" locale="en-US" ariaLabel="Share" />
          <star-input-number
            [(value)]="weight"
            mode="unit"
            unit="kilogram"
            locale="en-US"
            ariaLabel="Weight"
          />
          <star-input-number [(value)]="items" suffix=" items" locale="en-US" ariaLabel="Items" />
        </div>
      </docs-example>

      <docs-example heading="Disabled and read-only" source="input-number/states">
        <div class="docs-stack">
          <star-input-number [value]="12" disabled ariaLabel="Disabled number" />
          <star-input-number [value]="12" readonly ariaLabel="Read-only number" />
        </div>
      </docs-example>

      <docs-example
        heading="Button layouts"
        source="input-number/layouts"
        note="buttonLayout places the step buttons: horizontal (default), stacked at the end, or vertical. starIcon increment and decrement replace their icons. allowEmpty false keeps a number in the field, and highlightOnFocus selects the text on focus."
      >
        <div class="docs-row">
          <star-input-number
            [(value)]="stacked"
            showButtons
            buttonLayout="stacked"
            [allowEmpty]="false"
            highlightOnFocus
            ariaLabel="Stacked"
          />
          <star-input-number
            [(value)]="vertical"
            showButtons
            buttonLayout="vertical"
            [min]="0"
            ariaLabel="Vertical"
          >
            <ng-template starIcon="increment"><i class="ph-bold ph-arrow-up"></i></ng-template>
            <ng-template starIcon="decrement"><i class="ph-bold ph-arrow-down"></i></ng-template>
          </star-input-number>
        </div>
      </docs-example>

      <docs-example
        heading="Currency display and clear"
        source="input-number/currency-display"
        note="currencyDisplay shows the currency as a symbol (default), a narrow symbol, the ISO code or its name. showClear adds a clear button while the field has a value."
      >
        <star-input-number
          [(value)]="fee"
          mode="currency"
          currency="EUR"
          currencyDisplay="code"
          showClear
          ariaLabel="Fee"
        />
      </docs-example>

      <docs-example
        heading="Plain number"
        source="input-number/plain"
        note="format false shows the plain number at all times, without grouping or currency text. localeMatcher picks the locale matching of Intl (lookup or best fit)."
      >
        <star-input-number
          [(value)]="plain"
          [format]="false"
          localeMatcher="lookup"
          ariaLabel="Plain amount"
        />
      </docs-example>

      <docs-api [of]="['StarInputNumber']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class InputNumberPage {
  protected readonly plain = signal<number | null>(1234567.5);
  protected readonly fee = signal<number | null>(49.9);
  protected readonly quantity = signal<number | null>(3);
  protected readonly stacked = signal<number | null>(12);
  protected readonly vertical = signal<number | null>(4);
  protected readonly price = signal<number | null>(1234.5);
  protected readonly share = signal<number | null>(25);
  protected readonly weight = signal<number | null>(2);
  protected readonly items = signal<number | null>(40);

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-input-font-weight', description: 'Font weight of the typed text.' },
    { name: '--star-accent', description: 'Border color on focus.' },
    { name: '--star-danger', description: 'Border color when invalid.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow up / Arrow down', description: 'Adds or subtracts one step.' },
    { name: 'Page up / Page down', description: 'Adds or subtracts ten steps.' },
    { name: 'Home / End', description: 'Sets the minimum or the maximum, when they are set.' },
    { name: 'Enter', description: 'Applies the typed text to the value.' },
  ];
}
