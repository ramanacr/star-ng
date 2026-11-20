import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarMenuItem, StarSplitButton } from '@star-ng/ui/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-split-button-page',
  imports: [DOCS, StarSplitButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Split button"
      lead="A main action and a menu of related actions in one control. A click on the main part runs the default action. The caret opens the other actions."
      importFrom="import { StarSplitButton } from '@star-ng/ui/menu';"
    >
      <docs-example
        heading="Main action and menu"
        source="split-button/basic"
        [script]="basicScript"
        note="The pressed output is for the main action. The itemClick output is for the menu."
      >
        <div class="docs-stack">
          <star-split-button
            label="Place order"
            icon="ph-bold ph-paper-plane-tilt"
            [items]="orderOptions"
            (pressed)="last.set('Place order')"
            (itemClick)="last.set($event.label ?? '')"
          />
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Variants and sizes"
        source="split-button/variants"
        note="The variant and size inputs are the ones of star-button."
      >
        <star-split-button label="Save" variant="secondary" size="sm" [items]="orderOptions" />
        <star-split-button label="Approve" variant="success" [items]="orderOptions" />
        <star-split-button label="Remove" variant="danger" size="lg" [items]="orderOptions" />
      </docs-example>

      <docs-example heading="Disabled" source="split-button/disabled">
        <star-split-button label="Place order" disabled [items]="orderOptions" />
      </docs-example>

      <docs-example
        heading="Appearance, parts and events"
        source="split-button/appearance"
        [script]="eventsScript"
        note="appearance (outlined, text, link), raised and rounded style both buttons. iconPos puts the icon at the end of the label. buttonDisabled turns off only the main button and menuButtonDisabled only the menu button. expandAriaLabel names the menu button and dropdownIcon changes its icon (or starIcon with dropdown and a template). dropdownClick, menuShow and menuHide report the menu button and the menu."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-split-button
              label="Export"
              icon="ph-bold ph-download-simple"
              iconPos="end"
              appearance="outlined"
              expandAriaLabel="More export formats"
              [items]="orderOptions"
              (menuShow)="menuLog.set('menu open')"
              (menuHide)="menuLog.set('menu closed')"
            />
            <star-split-button label="Archive" variant="secondary" raised [items]="orderOptions" />
            <star-split-button
              label="Publish"
              buttonDisabled
              dropdownIcon="ph-bold ph-dots-three"
              expandAriaLabel="Publish options"
              [items]="orderOptions"
            />
          </div>
          <p class="docs-output" role="status">Menu: {{ menuLog() }}</p>
        </div>
      </docs-example>

      <h2>Names in PrimeNG</h2>
      <p>
        The PrimeNG p-splitbutton names that StarNG gives in another way: model is items; severity
        is variant (plain is secondary); onClick is pressed; outlined and text are appearance;
        tooltip and tooltipOptions are the starTooltip directive on the host; menuStyle and
        menuStyleClass are the pass-through pt. Not needed: appendTo (the menu is an overlay of the
        Angular CDK), dir (the direction of the page) and motionOptions (the motion comes from the
        theme tokens and stops with reduced motion).
      </p>

      <docs-api
        [of]="['StarSplitButton']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class SplitButtonPage {
  protected readonly last = signal('none');
  protected readonly menuLog = signal('closed');
  protected readonly eventsScript = `readonly menuLog = signal('closed');
// orderOptions as in the first example`;

  protected readonly orderOptions: readonly StarMenuItem[] = [
    { label: 'Place and close order', icon: 'ph-bold ph-check-circle' },
    { label: 'Schedule for later', icon: 'ph-bold ph-clock' },
    { label: 'Save as draft', icon: 'ph-bold ph-floppy-disk' },
  ];

  protected readonly basicScript = `readonly last = signal('none');

readonly orderOptions: readonly StarMenuItem[] = [
  { label: 'Place and close order', icon: 'ph-bold ph-check-circle' },
  { label: 'Schedule for later', icon: 'ph-bold ph-clock' },
  { label: 'Save as draft', icon: 'ph-bold ph-floppy-disk' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description:
        'Projected content goes after the label in the main button. PrimeNG content template.',
    },
    {
      name: 'ng-template[starIcon]',
      description: 'Content child. "dropdown" replaces the icon of the menu button.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary-fill', description: 'Fill of the primary variant, for both parts.' },
    {
      name: '--star-button-radius',
      description: 'Outer corner radius. The inner corners are square.',
    },
    { name: '--star-focus-ring', description: 'Focus ring of both parts.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves from the main button to the caret button.' },
    { name: 'Enter / Space', description: 'On the main button: runs the main action.' },
    { name: 'Enter / Space / Arrow down', description: 'On the caret button: opens the menu.' },
    { name: 'Arrow up / Arrow down', description: 'Moves between the menu items.' },
    { name: 'Escape', description: 'Closes the menu. The focus returns to the caret button.' },
  ];
}
