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
      name: '(none)',
      description: 'The label and the icon are inputs. The menu comes from items.',
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
