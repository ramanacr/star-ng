import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarIconTemplate } from '@star-ng/ui/core';
import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-toggle-switch-page',
  imports: [DOCS, StarToggleSwitch, StarIconTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Toggle switch"
      lead="An on/off setting that applies at once. A native checkbox with role switch."
      importFrom="import { StarToggleSwitch } from '@star-ng/ui/toggle-switch';"
    >
      <docs-example heading="Two-way binding" source="toggle-switch/basic" [script]="basicScript">
        <star-toggle-switch [(checked)]="alerts">Email alerts</star-toggle-switch>
        <p class="docs-output" role="status">Alerts: {{ alerts() ? 'on' : 'off' }}</p>
      </docs-example>

      <docs-example heading="Small" source="toggle-switch/small">
        <star-toggle-switch size="sm" [(checked)]="compact">Compact rows</star-toggle-switch>
      </docs-example>

      <docs-example heading="Disabled" source="toggle-switch/disabled">
        <star-toggle-switch [checked]="true" disabled
          >Two-step sign-in (set by your admin)</star-toggle-switch
        >
      </docs-example>

      <docs-example
        heading="State labels and handle icons"
        source="toggle-switch/labels"
        note="onLabel and offLabel show the state as text next to the switch (screen readers read the switch state). starIcon on and off draw an icon in the handle."
      >
        <star-toggle-switch [(checked)]="lights" onLabel="On" offLabel="Off">
          Lights
          <ng-template starIcon="on"><i class="ph-bold ph-check"></i></ng-template>
          <ng-template starIcon="off"><i class="ph-bold ph-x"></i></ng-template>
        </star-toggle-switch>
      </docs-example>

      <docs-api
        [of]="['StarToggleSwitch']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ToggleSwitchPage {
  protected readonly lights = signal(true);
  protected readonly alerts = signal(true);
  protected readonly compact = signal(false);

  protected readonly basicScript = `readonly alerts = signal(true);`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The label. Without it, set ariaLabel.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary', description: 'Track color when on.' },
    { name: '--star-border-strong', description: 'Track color when off.' },
    { name: '--star-focus-ring-primary', description: 'Focus ring (box-shadow).' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Space', description: 'Toggles the switch.' },
  ];
}
