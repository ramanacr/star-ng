import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarRangeSlider, StarSlider } from '@star-ng/ui/slider';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './slider.page.scss',
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

      <docs-example
        heading="Vertical slider"
        source="slider/vertical"
        note="orientation vertical draws the slider from bottom (min) to top (max). slideEnd emits the value when a drag or a key press ends."
      >
        <div class="docs-row">
          <star-slider
            [(value)]="height"
            orientation="vertical"
            ariaLabel="Height"
            showValue
            (slideEnd)="ended.set($event)"
          />
          <p class="docs-output" role="status">Last end: {{ ended() ?? 'none' }}</p>
        </div>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        A native range input runs from right to left in a right-to-left page: the minimum is on the
        right and the track fill follows. Arrow left raises the value. See the Right-to-left guide.
      </p>

      <docs-example
        heading="Range slider options"
        source="slider/range-options"
        note="orientation vertical, minStepsBetweenHandles (the smallest gap between the handles, in steps), disabledMinHandle or disabledMaxHandle (lock one handle) and slideEnd (the value when a drag or key press ends)."
      >
        <div class="docs-row">
          <star-range-slider
            [(value)]="span"
            orientation="vertical"
            [minStepsBetweenHandles]="10"
            ariaLabel="Span"
            (slideEnd)="spanEnd.set($event)"
          />
          <star-range-slider [(value)]="span" disabledMinHandle ariaLabel="Upper limit" />
          <p class="docs-output" role="status">Last end: {{ spanEnd()?.join(' to ') ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarSlider', 'StarRangeSlider']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class SliderPage {
  protected readonly span = signal<readonly [number, number]>([20, 60]);
  protected readonly spanEnd = signal<readonly [number, number] | null>(null);
  protected readonly volume = signal(40);
  protected readonly height = signal(60);
  protected readonly ended = signal<number | null>(null);
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
