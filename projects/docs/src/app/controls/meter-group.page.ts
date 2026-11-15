import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StarMeterGroup, StarMeterItem } from '@star-ng/ui/utility';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-meter-group-page',
  imports: [DOCS, StarMeterGroup],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Meter group"
      lead="One bar that is split into parts, with a legend. The parts use the chart palette tokens in order. Each part has the meter role, so a screen reader announces its value."
      importFrom="import { StarMeterGroup, StarMeterItem } from '@star-ng/ui/utility';"
    >
      <docs-example
        heading="Storage by type"
        source="meter-group/basic"
        [script]="script"
        note="max is the full scale. Without max the scale is the sum of the values, so the bar is always full."
      >
        <div class="docs-stack">
          <star-meter-group [items]="storage" [max]="100" unit="GB" ariaLabel="Storage used" />
        </div>
      </docs-example>

      <docs-example
        heading="Scale from the sum"
        source="meter-group/sum"
        note="Without max the parts share the whole bar. Use this for a split of a total, such as the share of each region."
      >
        <div class="docs-stack">
          <star-meter-group [items]="regions" ariaLabel="Orders by region" />
        </div>
      </docs-example>

      <docs-api [of]="['StarMeterGroup']" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class MeterGroupPage {
  protected readonly storage: readonly StarMeterItem[] = [
    { label: 'Documents', value: 30 },
    { label: 'Images', value: 20 },
    { label: 'Backups', value: 15 },
  ];
  protected readonly regions: readonly StarMeterItem[] = [
    { label: 'North', value: 42 },
    { label: 'South', value: 31 },
    { label: 'East', value: 18 },
    { label: 'West', value: 9 },
  ];

  protected readonly script = `readonly storage: readonly StarMeterItem[] = [
  { label: 'Documents', value: 30 },
  { label: 'Images', value: 20 },
  { label: 'Backups', value: 15 },
];`;

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-chart-1 … --star-chart-8',
      description: 'Colors of the parts, in order. The ninth part uses the first color again.',
    },
    { name: '--star-border', description: 'Color of the empty part of the bar.' },
    { name: '--star-radius-pill', description: 'Corner radius of the bar.' },
    { name: '--star-text-muted', description: 'Color of the legend text.' },
    { name: '--star-text-strong', description: 'Color of the legend values.' },
  ];
}
