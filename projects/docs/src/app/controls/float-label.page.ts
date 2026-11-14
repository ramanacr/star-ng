import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarInput } from 'star-ng/field';
import { StarSelect } from 'star-ng/select';
import { StarFloatLabel } from 'star-ng/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-float-label-page',
  imports: [DOCS, StarFloatLabel, StarInput, StarSelect],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Float label"
      lead="The label sits inside the input and moves above it when the input has focus or a value. Wrap one text input, one textarea or one select. The label is a real label around the control, so a click focuses the control and a screen reader reads the label."
      importFrom="import { StarFloatLabel } from 'star-ng/utility';"
    >
      <docs-example
        heading="Text input and textarea"
        source="float-label/basic"
        [script]="script"
        note="The control gets an empty placeholder when it has none, because the CSS needs one. A placeholder of your own is hidden while the label is down."
      >
        <div class="docs-stack">
          <star-float-label label="Customer name">
            <input starInput [value]="name()" (input)="name.set($any($event.target).value)" />
          </star-float-label>
          <star-float-label label="Delivery note">
            <textarea starInput rows="3"></textarea>
          </star-float-label>
          <p class="docs-output" role="status">Customer: {{ name() || 'empty' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Select"
        source="float-label/select"
        note="With a star-select the label moves up when an option is chosen. Give the select an ariaLabel."
      >
        <div class="docs-stack">
          <star-float-label label="City">
            <star-select [options]="cities" [(value)]="city" ariaLabel="City" />
          </star-float-label>
        </div>
      </docs-example>

      <docs-api [of]="['StarFloatLabel']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class FloatLabelPage {
  protected readonly name = signal('');
  protected readonly city = signal<string | null>(null);
  protected readonly cities: readonly string[] = ['Berlin', 'Lisbon', 'Oslo', 'Toronto'];

  protected readonly script = `readonly name = signal('');`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'One text input, textarea or star-select.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-surface',
      description: 'Background of the label, so it hides the border behind it.',
    },
    { name: '--star-text-muted', description: 'Color of the label while it is down.' },
    { name: '--star-text-strong', description: 'Color of the label while it is up.' },
    { name: '--star-duration-fast', description: 'Duration of the move.' },
  ];
}
