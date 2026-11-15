import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarRangeSlider, StarSlider } from '@star-ng/ui/slider';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-slider-page',
  imports: [DOCS, StarSlider, StarRangeSlider],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Slider"
      lead="star-slider is a native range input with a styled track. star-range-slider has two thumbs for a low and a high value."
      importFrom="import { StarRangeSlider, StarSlider } from '@star-ng/ui/slider';"
    >
      <docs-example heading="Single value" source="slider/basic">
        <div class="docs-stack">
          <star-slider [(value)]="volume" showValue ariaLabel="Volume" />
          <p class="docs-output" role="status">Volume: {{ volume() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Steps and formatted value"
        source="slider/format"
        [script]="formatScript"
      >
        <div class="docs-stack">
          <star-slider
            [(value)]="discount"
            [min]="0"
            [max]="50"
            [step]="5"
            showValue
            [format]="percent"
            ariaLabel="Discount"
          />
        </div>
      </docs-example>

      <docs-example heading="Range" source="slider/range">
        <div class="docs-stack">
          <star-range-slider
            [(value)]="price"
            [bounds]="[0, 500]"
            [step]="10"
            showValue
            ariaLabel="Price range"
          />
          <p class="docs-output" role="status">From {{ price()[0] }} to {{ price()[1] }}</p>
        </div>
      </docs-example>

      <docs-example heading="Disabled" source="slider/disabled">
        <div class="docs-stack">
          <star-slider [value]="30" disabled ariaLabel="Locked value" />
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        A native range input runs from right to left in a right-to-left page: the minimum is on the
        right and the track fill follows. Arrow left raises the value. See the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarSlider', 'StarRangeSlider']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class SliderPage {
  protected readonly volume = signal(40);
  protected readonly discount = signal(15);
  protected readonly price = signal<readonly [number, number]>([100, 300]);
  protected readonly percent = (value: number) => `${value} %`;

  protected readonly formatScript = `readonly discount = signal(15);
readonly percent = (value: number) => \`\${value} %\`;`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Color of the filled part of the track and the thumb.' },
    { name: '--star-border', description: 'Color of the empty part of the track.' },
    { name: '--star-focus-ring-primary', description: 'Focus ring of the thumb.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Arrow keys', description: 'Change the value by one step.' },
    { name: 'Page up / Page down', description: 'Change the value by a larger step.' },
    { name: 'Home / End', description: 'Set the minimum or the maximum.' },
    { name: 'Tab', description: 'Range slider: moves between the low and the high thumb.' },
  ];
}
