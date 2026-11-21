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
        heading="Header toggle, icon position and events"
        source="panel/toggler"
        [script]="togglerScript"
        note="toggler header makes the title the toggle button (the icon comes before the text). iconPos start puts the toggle button before the title. beforeToggle emits the state before a toggle, afterToggle the new state after the render. showHeader false hides the header (the region keeps the header text as its name). starHeader replaces the title and starIcon toggle the toggle icon (it gets expanded)."
      >
        <div class="docs-stack">
          <star-panel
            header="Delivery address"
            toggleable
            toggler="header"
            (beforeToggle)="toggleLog.set('before: ' + ($event.collapsed ? 'collapsed' : 'open'))"
            (afterToggle)="
              toggleLog.set(toggleLog() + ', after: ' + ($event.collapsed ? 'collapsed' : 'open'))
            "
          >
            12 Harbor Road, Lakeside.
          </star-panel>
          <star-panel header="Invoice notes" toggleable iconPos="start">
            Send the invoice at the end of the month.
          </star-panel>
          <p class="docs-output" role="status">{{ toggleLog() || 'No toggle yet' }}</p>
        </div>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-panel names that StarNG gives in another way: the content template is the
        default content, headericons is [starPanelActions], footer is [starPanelFooter], the header
        template is starHeader and the icon template is starIcon with toggle; toggleButtonProps is
        the pass-through pt (part toggleButton). Not needed: motionOptions (the motion comes from
        the theme tokens and stops with reduced motion).
      </p>

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
  protected readonly toggleLog = signal('');
  protected readonly togglerScript = `readonly toggleLog = signal('');`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The body of the panel or the fieldset.' },
    {
      name: '[starPanelActions]',
      description: 'Panel only: actions in the header, before the collapse button.',
    },
    { name: '[starPanelFooter]', description: 'Panel only: a footer under the body.' },
    {
      name: 'ng-template[starHeader]',
      description: 'Panel only. Replaces the title content. PrimeNG header template.',
    },
    {
      name: 'ng-template[starIcon]',
      description:
        'Panel only. "toggle" replaces the toggle icon; $implicit is true while open. PrimeNG icon template.',
    },
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
