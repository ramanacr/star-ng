import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarFieldset, StarPanel } from '@star-ng/ui/panel';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-panel-page',
  imports: [DOCS, StarPanel, StarFieldset, StarButton, StarField, StarInput],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Panel and fieldset"
      lead="A panel is a titled box with header actions and an optional collapse button. A fieldset groups form controls on the native fieldset element. The PrimeNG equivalents are p-panel and p-fieldset."
      importFrom="import { StarPanel, StarFieldset } from '@star-ng/ui/panel';"
    >
      <docs-example
        heading="Panel with actions"
        source="panel/basic"
        [script]="basicScript"
        note="With toggleable, the header has a button that collapses the body. The collapsed model holds the state."
      >
        <div class="docs-stack">
          <star-panel header="Order notes" toggleable [(collapsed)]="collapsed">
            <star-button starPanelActions variant="ghost" size="sm" leadingIcon="ph-bold ph-plus">
              Add note
            </star-button>
            Ship with the next pallet. Call the front desk on arrival.
          </star-panel>
          <p class="docs-output" role="status">
            The panel is {{ collapsed() ? 'collapsed' : 'open' }}.
          </p>
        </div>
      </docs-example>

      <docs-example
        heading="Fieldset"
        source="panel/fieldset"
        note="The legend is the accessible name of the group of controls. With toggleable, the legend is a button."
      >
        <div class="docs-stack">
          <star-fieldset legend="Contact person" toggleable>
            <star-field label="Name">
              <input starInput />
            </star-field>
            <star-field label="Email">
              <input starInput type="email" placeholder="name@example.com" />
            </star-field>
          </star-fieldset>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarPanel', 'StarFieldset']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class PanelPage {
  protected readonly collapsed = signal(false);

  protected readonly basicScript = `readonly collapsed = signal(false);`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The body of the panel or the fieldset.' },
    {
      name: '[starPanelActions]',
      description: 'Panel only: actions in the header, before the collapse button.',
    },
    { name: '[starPanelFooter]', description: 'Panel only: a footer under the body.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the panel.' },
    {
      name: '--star-border',
      description: 'Outline of the panel and the fieldset, and the line under the header.',
    },
    { name: '--star-radius-lg', description: 'Corner radius.' },
    { name: '--star-text-muted', description: 'Color of the legend.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Enter / Space',
      description: 'On the collapse button or the legend button: collapses or expands the body.',
    },
    { name: 'Tab', description: 'The collapsed body is inert: the focus skips it.' },
  ];
}
