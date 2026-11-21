import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './radio.page.scss',
  selector: 'docs-radio-page',
  imports: [DOCS, StarRadioGroup, StarRadio],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Radio"
      lead="star-radio-group owns the value. Each star-radio is a native radio input, so the arrow keys move and select."
      importFrom="import { StarRadio, StarRadioGroup } from '@star-ng/ui/radio';"
    >
      <docs-example heading="Group" source="radio/basic" [script]="basicScript">
        <star-radio-group [(value)]="plan" ariaLabel="Plan">
          <star-radio value="starter">Starter</star-radio>
          <star-radio value="team">Team</star-radio>
          <star-radio value="business">Business</star-radio>
        </star-radio-group>
        <p class="docs-output" role="status">Plan: {{ plan() }}</p>
      </docs-example>

      <docs-example heading="Horizontal" source="radio/horizontal">
        <star-radio-group [(value)]="size" orientation="horizontal" ariaLabel="Size">
          <star-radio value="s">Small</star-radio>
          <star-radio value="m">Medium</star-radio>
          <star-radio value="l">Large</star-radio>
        </star-radio-group>
      </docs-example>

      <docs-example heading="Disabled option" source="radio/disabled">
        <star-radio-group [(value)]="delivery" ariaLabel="Delivery">
          <star-radio value="standard">Standard</star-radio>
          <star-radio value="express">Express</star-radio>
          <star-radio value="pickup" disabled>Pick-up (not available)</star-radio>
        </star-radio-group>
      </docs-example>

      <docs-api
        [of]="['StarRadioGroup', 'StarRadio']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class RadioPage {
  protected readonly plan = signal<string | null>('team');
  protected readonly size = signal<string | null>('m');
  protected readonly delivery = signal<string | null>('standard');

  protected readonly basicScript = `readonly plan = signal<string | null>('team');`;

  protected readonly slots: readonly DocsRow[] = [
    { name: 'star-radio-group (default)', description: 'The star-radio elements.' },
    { name: 'star-radio (default)', description: 'The label of the option.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Ring color of the selected option.' },
    { name: '--star-border-strong', description: 'Border of an unselected option.' },
    { name: '--star-focus-ring-primary', description: 'Focus ring (box-shadow).' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves focus into and out of the group.' },
    { name: 'Arrow keys', description: 'Move to and select the next or previous option.' },
    { name: 'Space', description: 'Selects the focused option.' },
  ];
}
