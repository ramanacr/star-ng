import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { form, FormField, validate } from '@angular/forms/signals';
import { StarCheckbox } from '@star-ng/ui/checkbox';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-checkbox-page',
  imports: [DOCS, StarCheckbox, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Checkbox"
      lead="A native checkbox with a styled box. Works alone, with two-way binding or with Signal Forms."
      importFrom="import { StarCheckbox } from '@star-ng/ui/checkbox';"
    >
      <docs-example heading="Two-way binding" source="checkbox/basic" [script]="basicScript">
        <star-checkbox [(checked)]="subscribed">Send me product news</star-checkbox>
        <p class="docs-output" role="status">Subscribed: {{ subscribed() }}</p>
      </docs-example>

      <docs-example
        heading="Indeterminate"
        source="checkbox/indeterminate"
        note="The mixed state clears when the user toggles the box."
      >
        <star-checkbox [(checked)]="all" [(indeterminate)]="some">All regions</star-checkbox>
      </docs-example>

      <docs-example heading="Signal Forms" source="checkbox/form" [script]="formScript">
        <star-checkbox [formField]="terms.accept">I accept the terms</star-checkbox>
        <p class="docs-output" role="status">Valid: {{ terms().valid() }}</p>
      </docs-example>

      <docs-example heading="Disabled and read-only" source="checkbox/states">
        <star-checkbox [checked]="true" disabled>Disabled</star-checkbox>
        <star-checkbox [checked]="true" readonly>Read-only</star-checkbox>
      </docs-example>

      <docs-api [of]="['StarCheckbox']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class CheckboxPage {
  protected readonly subscribed = signal(true);
  protected readonly all = signal(false);
  protected readonly some = signal(true);
  protected readonly model = signal({ accept: false });
  protected readonly terms = form(this.model, (path) => {
    validate(path.accept, ({ value }) => (value() ? undefined : { kind: 'mustAccept' }));
  });

  protected readonly basicScript = `readonly subscribed = signal(true);`;
  protected readonly formScript = `readonly model = signal({ accept: false });
readonly terms = form(this.model, (path) => {
  validate(path.accept, ({ value }) => (value() ? undefined : { kind: 'mustAccept' }));
});`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The label. Without it, set ariaLabel.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Fill of the checked box.' },
    { name: '--star-on-tone', description: 'Color of the check mark.' },
    { name: '--star-border-strong', description: 'Border of the unchecked box.' },
    { name: '--star-focus-ring-primary', description: 'Focus ring (box-shadow).' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Space', description: 'Toggles the checkbox.' },
  ];
}
