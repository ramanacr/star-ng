import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarKnob } from 'star-ng/knob';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-knob-page',
  imports: [DOCS, StarKnob],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Knob"
      lead="A circular dial for a number. It has the slider role: drag around the dial or use the keyboard."
      importFrom="import { StarKnob } from 'star-ng/knob';"
    >
      <docs-example heading="Basic" source="knob/basic">
        <star-knob [(value)]="progress" valueTemplate="{value}%" ariaLabel="Progress" />
        <p class="docs-output" role="status">Value: {{ progress() }}</p>
      </docs-example>

      <docs-example heading="Range, step and size" source="knob/range">
        <star-knob
          [(value)]="temperature"
          [min]="10"
          [max]="30"
          [step]="0.5"
          [size]="160"
          valueTemplate="{value}°"
          ariaLabel="Temperature"
        />
      </docs-example>

      <docs-example heading="Read-only and disabled" source="knob/states">
        <star-knob [value]="72" readonly [size]="90" ariaLabel="Disk use" />
        <star-knob [value]="35" disabled [size]="90" ariaLabel="Locked value" />
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        The knob keeps its geometry in a right-to-left page, like a clock: the arc runs clockwise
        and Arrow up and Arrow right add one step. See the Right-to-left guide.
      </p>

      <docs-api [of]="['StarKnob']" [cssVars]="cssVars" [keyboard]="keyboard" />
    </docs-page>
  `,
})
export class KnobPage {
  protected readonly progress = signal(60);
  protected readonly temperature = signal(21);

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Color of the value arc.' },
    { name: '--star-border', description: 'Color of the track.' },
    { name: '--star-text-strong', description: 'Color of the value text.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow up / Arrow right', description: 'Adds one step.' },
    { name: 'Arrow down / Arrow left', description: 'Subtracts one step.' },
    { name: 'Page up / Page down', description: 'Adds or subtracts a tenth of the range.' },
    { name: 'Home / End', description: 'Sets the minimum or the maximum.' },
  ];
}
