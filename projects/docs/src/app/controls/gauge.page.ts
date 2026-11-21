import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, max, min } from '@angular/forms/signals';
import { StarButton } from '@star-ng/ui/button';
import { StarField } from '@star-ng/ui/field';
import { StarGaugeRange, StarLinearGauge, StarRadialGauge } from '@star-ng/ui/gauge';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './gauge.page.scss',
  selector: 'docs-gauge-page',
  imports: [DOCS, StarLinearGauge, StarRadialGauge, StarButton, StarField, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Gauge"
      lead="Linear and radial gauges show one value on a scale with coloured ranges, ticks and labels. They are read-only meters, or sliders with the interactive option. The Kendo UI equivalents are kendo-lineargauge, kendo-radialgauge and kendo-arcgauge; Ignite UI has igx-linear-gauge and igx-radial-gauge, Syncfusion has ejs-lineargauge and ejs-circulargauge."
      importFrom="import { StarLinearGauge, StarRadialGauge } from '@star-ng/ui/gauge';"
    >
      <docs-example
        heading="Radial gauge"
        source="gauge/radial"
        [script]="loadScript"
        note="The default arc runs from 225 to -45 degrees (math angles: 0 points right, 90 up). The gauge has the meter role with aria-valuenow, aria-valuemin, aria-valuemax and a formatted aria-valuetext. The pointer moves with an animation, unless the user prefers reduced motion."
      >
        <div class="docs-stack">
          <star-radial-gauge
            [value]="load()"
            [ranges]="zones"
            [labels]="{ style: 'unit', unit: 'percent' }"
            locale="en-US"
            ariaLabel="Server load"
          />
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="change(-15)">Less</star-button>
            <star-button size="sm" variant="secondary" (pressed)="change(15)">More</star-button>
          </div>
        </div>
      </docs-example>

      <docs-example
        heading="Pointers and arcs"
        source="gauge/pointers"
        note="pointer is needle, bar or marker. startAngle, endAngle and arcWidth shape the arc."
      >
        <div class="docs-row">
          <star-radial-gauge [value]="62" pointer="bar" [arcWidth]="16" ariaLabel="Disk use" />
          <star-radial-gauge
            [value]="38"
            pointer="marker"
            [startAngle]="180"
            [endAngle]="0"
            [ticks]="{ major: 4, minor: 5 }"
            ariaLabel="Memory use"
          />
        </div>
      </docs-example>

      <docs-example
        heading="Linear gauge"
        source="gauge/linear"
        note="orientation is horizontal or vertical. A horizontal scale runs from the right in right-to-left. ticks sets the major intervals (major) or the value between major ticks (step), and the minor parts per interval."
      >
        <div class="docs-stack">
          <star-linear-gauge
            [value]="load()"
            [ranges]="zones"
            [ticks]="{ step: 25, minor: 5 }"
            ariaLabel="Server load"
          />
          <star-linear-gauge
            [value]="load()"
            pointer="marker"
            [ranges]="zones"
            ariaLabel="Server load, marker"
          />
          <div class="docs-row">
            <star-linear-gauge
              orientation="vertical"
              [value]="72"
              [max]="120"
              [ticks]="{ major: 6, minor: 2 }"
              ariaLabel="Response time"
            />
            <star-linear-gauge
              orientation="vertical"
              pointer="needle"
              [value]="18"
              [min]="-20"
              [max]="40"
              [ranges]="cold"
              ariaLabel="Room temperature"
            />
          </div>
        </div>
      </docs-example>

      <docs-example
        heading="Interactive with Signal Forms"
        source="gauge/interactive"
        [script]="formScript"
        note="With interactive, the gauge is a slider: the arrow keys change the value by step, Page Up and Page Down by a tenth of the scale, Home and End go to the ends, and a pointer drags along the scale. It binds to a Signal Forms field like star-slider."
      >
        <div class="docs-stack">
          <star-field label="Volume">
            <star-linear-gauge interactive [step]="5" [formField]="model.volume" />
          </star-field>
          <star-radial-gauge pointer="bar" [value]="settings().volume" ariaLabel="Volume level" />
          <p>Volume: {{ settings().volume }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarLinearGauge', 'StarRadialGauge', 'StarGaugeBase']"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class GaugePage {
  protected readonly load = signal(58);
  protected readonly zones: readonly StarGaugeRange[] = [
    { from: 0, to: 60, color: 'success' },
    { from: 60, to: 85, color: 'warning' },
    { from: 85, to: 100, color: 'danger' },
  ];
  protected readonly cold: readonly StarGaugeRange[] = [
    { from: -20, to: 0, color: 1 },
    { from: 26, to: 40, color: 'danger' },
  ];

  protected readonly settings = signal({ volume: 40 });
  protected readonly model = form(this.settings, (path) => {
    min(path.volume, 0);
    max(path.volume, 100);
  });

  protected change(delta: number): void {
    this.load.update((value) => Math.min(100, Math.max(0, value + delta)));
  }

  protected readonly loadScript = `readonly load = signal(58);
readonly zones: readonly StarGaugeRange[] = [
  { from: 0, to: 60, color: 'success' },
  { from: 60, to: 85, color: 'warning' },
  { from: 85, to: 100, color: 'danger' },
];`;

  protected readonly formScript = `readonly settings = signal({ volume: 40 });
readonly model = form(this.settings, (path) => {
  min(path.volume, 0);
  max(path.volume, 100);
});`;

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-gauge-pointer',
      description: 'Colour of the bar pointer. Default --star-primary.',
    },
    {
      name: '--star-gauge-length',
      description: 'Length of a linear gauge. Default 24rem (horizontal) or 16rem (vertical).',
    },
    { name: '--star-gauge-size', description: 'Width of a radial gauge. Default 12rem.' },
    {
      name: '--star-gauge-range',
      description:
        'Colour of one range, set from its color: --star-chart-1…8, --star-success, --star-warning or --star-danger.',
    },
  ];

  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Arrow keys',
      description:
        'Interactive mode: change the value by step. In right-to-left the left arrow raises a horizontal gauge.',
    },
    { name: 'Page Up / Page Down', description: 'Change the value by a tenth of the scale.' },
    { name: 'Home / End', description: 'Go to the lowest or the highest value.' },
  ];
}
