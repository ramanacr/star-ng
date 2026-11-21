import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarField } from '@star-ng/ui/field';
import { StarInputMask } from '@star-ng/ui/input-mask';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './input-mask.page.scss',
  selector: 'docs-input-mask-page',
  imports: [DOCS, StarInputMask, StarField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Input mask"
      lead="A text field with a fixed format, such as a phone number or a serial number. Mask tokens: 9 is a digit, a is a letter, * is a letter or a digit. Other characters are literals."
      importFrom="import { StarInputMask } from '@star-ng/ui/input-mask';"
    >
      <docs-example heading="Phone number" source="input-mask/phone">
        <div class="docs-stack">
          <star-field label="Phone">
            <star-input-mask mask="(999) 999-9999" [(value)]="phone" />
          </star-field>
          <p class="docs-output" role="status">Value: {{ phone() || '(empty)' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Raw value"
        source="input-mask/unmask"
        note="With unmask the value has only the typed characters, without the literals."
      >
        <div class="docs-stack">
          <star-field label="Serial number">
            <star-input-mask mask="aa-9999-**" unmask slotChar="#" [(value)]="serial" />
          </star-field>
          <p class="docs-output" role="status">Value: {{ serial() || '(empty)' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Character pattern"
        source="input-mask/pattern"
        note="characterPattern sets what an a slot takes, as regular expression source. Here the letters are A to F only."
      >
        <star-input-mask
          mask="aa-9999"
          characterPattern="[A-F]"
          [(value)]="batch"
          ariaLabel="Batch code"
        />
        <p class="docs-output" role="status">Value: {{ batch() || 'empty' }}</p>
      </docs-example>

      <docs-example
        heading="Clear, fixed positions and filled"
        source="input-mask/options"
        note="showClear adds a clear button. keepCharPositions keeps the later characters in place when you delete one. variant filled gives the filled look of the other fields."
      >
        <star-input-mask
          mask="9999-9999"
          [(value)]="card"
          showClear
          keepCharPositions
          variant="filled"
          ariaLabel="Member number"
        />
      </docs-example>

      <docs-api [of]="['StarInputMask']" [cssVars]="cssVars" />

      <h3>Functions</h3>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            Mask functions
          </caption>
          <thead>
            <tr>
              <th scope="col">Function</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row"><code>applyMask(mask, raw, slotChar?)</code></th>
              <td>Returns the masked text for raw characters.</td>
            </tr>
            <tr>
              <th scope="row"><code>unmask(mask, masked, slotChar?)</code></th>
              <td>Returns the typed characters of a masked text.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </docs-page>
  `,
})
export class InputMaskPage {
  protected readonly card = signal('');
  protected readonly phone = signal('');
  protected readonly batch = signal('');
  protected readonly serial = signal('');

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-input-radius', description: 'Corner radius of the field.' },
    { name: '--star-accent', description: 'Border color on focus.' },
    { name: '--star-danger', description: 'Border color when invalid.' },
  ];
}
