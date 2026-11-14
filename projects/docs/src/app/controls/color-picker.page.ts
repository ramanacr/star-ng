import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarColorPicker } from 'star-ng/knob';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-color-picker-page',
  imports: [DOCS, StarColorPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Color picker"
      lead="Preset swatches, the native color dialog and a hex field. The value is a #rrggbb string."
      importFrom="import { StarColorPicker } from 'star-ng/knob';"
    >
      <docs-example heading="Basic" source="color-picker/basic">
        <star-color-picker [(value)]="color" ariaLabel="Label color" />
        <p class="docs-output" role="status">Value: {{ color() }}</p>
      </docs-example>

      <docs-example heading="Custom swatches" source="color-picker/swatches">
        <star-color-picker
          [(value)]="category"
          [swatches]="['#0f766e', '#b45309', '#7c3aed', '#be123c']"
          ariaLabel="Category color"
        />
      </docs-example>

      <docs-example heading="Disabled" source="color-picker/disabled">
        <star-color-picker value="#64748b" disabled ariaLabel="Locked color" />
      </docs-example>

      <docs-api [of]="['StarColorPicker']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class ColorPickerPage {
  protected readonly color = signal('#4f46e5');
  protected readonly category = signal('#0f766e');

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-radius-sm', description: 'Corner radius of the native color button.' },
    { name: '--star-text-strong', description: 'Ring of the selected swatch.' },
    { name: '--star-accent', description: 'Focus outline of a swatch.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves through the swatches, the color dialog and the hex field.' },
    { name: 'Enter / Space', description: 'Selects the focused swatch.' },
    { name: 'Enter', description: 'In the hex field: applies the typed #rrggbb value.' },
  ];
}
