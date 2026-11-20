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
      <p>
        The default swatches come from the theme. After the first render, the control reads
        <code>--star-primary</code>, <code>--star-accent</code>, <code>--star-success</code>,
        <code>--star-warning</code>, <code>--star-danger</code>, <code>--star-info</code> and
        <code>--star-chart-1</code> to <code>--star-chart-12</code> on its own element, and shows
        the ones that exist as <code>#rrggbb</code> colors, without duplicates. The control reads
        them once: it does not watch for a theme change, so the swatches keep the colors of the
        theme that was active at that time. On the server, and when no token gives a color, a fixed
        list of eight colors is used. When you set <code>[swatches]</code>, that list is always used
        and nothing is read. The default value does not change.
      </p>

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

      <h2>Eye dropper</h2>
      <p>
        In a browser with the <code>EyeDropper</code> API, an eye dropper button follows the custom
        tile (PrimeNG <code>p-inputcolor-eyedropper</code>). It lets the user pick a color anywhere
        on the screen; the color becomes the value and the control emits <code>changed</code>.
        Escape cancels and keeps the value. The control checks for the API after the first render,
        so the server page and a browser without the API show no button. The label comes from
        <code>STAR_UI_TEXT.eyeDropper</code>.
      </p>

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
