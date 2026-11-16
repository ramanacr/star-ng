import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarColorPicker } from '@star-ng/ui/knob';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-color-picker-page',
  imports: [DOCS, StarColorPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Color picker"
      lead="Preset swatches, a custom color panel and a hex field. The custom tile opens a StarNG panel (not the color dialog of the browser) with a saturation and brightness area and a hue slider. The value is a #rrggbb string."
      importFrom="import { StarColorPicker } from '@star-ng/ui/knob';"
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

      <h2>Accessibility and right-to-left</h2>
      <p>
        The area and the hue slider each have the slider role and a value text, for example
        "Saturation 69%, brightness 90%" and "243 degrees". The panel is a dialog: Escape and Done
        close it, and the focus goes back to the custom tile. In a right-to-left page the panel is
        mirrored: the saturation and the hue grow toward the left, and the arrow keys follow what
        the user sees.
      </p>

      <docs-api [of]="['StarColorPicker']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class ColorPickerPage {
  protected readonly color = signal('#4f46e5');
  protected readonly category = signal('#0f766e');

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-radius-sm', description: 'Corner radius of the custom color tile.' },
    { name: '--star-radius-md', description: 'Corner radius of the area and the hue slider.' },
    { name: '--star-surface', description: 'Background of the panel and ring of the thumbs.' },
    { name: '--star-border', description: 'Border of the panel, the area and the hue slider.' },
    { name: '--star-focus-ring', description: 'Focus ring of the area and the hue slider.' },
    { name: '--star-text-strong', description: 'Ring of the selected swatch.' },
    { name: '--star-accent', description: 'Focus outline of a swatch.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves through the swatches, the custom tile and the hex field.' },
    {
      name: 'Enter / Space',
      description: 'Selects the focused swatch. On the custom tile: opens the color panel.',
    },
    {
      name: 'Arrow left / Arrow right',
      description:
        'In the area: less or more saturation. In the hue slider: changes the hue. Shift moves by 10.',
    },
    {
      name: 'Arrow up / Arrow down',
      description: 'In the area: more or less brightness. In the hue slider: changes the hue.',
    },
    { name: 'Page up / Page down', description: 'In the area or the hue slider: moves by 10.' },
    {
      name: 'Home / End',
      description: 'In the area: no or full saturation. In the hue slider: the first or last hue.',
    },
    { name: 'Escape', description: 'Closes the panel. The focus goes back to the custom tile.' },
    { name: 'Enter', description: 'In the hex field: applies the typed #rrggbb value.' },
  ];
}
