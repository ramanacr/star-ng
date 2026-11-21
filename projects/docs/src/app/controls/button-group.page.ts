import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { StarButton, StarButtonGroup } from '@star-ng/ui/button';
import { StarMenuItem, StarSplitButton } from '@star-ng/ui/menu';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './button-group.page.scss',
  selector: 'docs-button-group-page',
  imports: [DOCS, StarButton, StarButtonGroup, StarSplitButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Button group"
      lead="Joins adjacent buttons into one bar: the buttons share their borders and only the outer corners are round. Each button keeps its own action. It is not a selection control: to pick a value, use the select button. The PrimeNG equivalent is p-buttongroup."
      importFrom="import { StarButtonGroup } from '@star-ng/ui/button';"
    >
      <docs-example
        heading="Actions"
        source="button-group/basic"
        [script]="basicScript"
        note="The group has role group and the name from ariaLabel. Every button stays in the tab order."
      >
        <div class="docs-stack">
          <star-button-group ariaLabel="Order actions">
            <star-button
              variant="secondary"
              leadingIcon="ph-bold ph-floppy-disk"
              (pressed)="last.set('Save')"
            >
              Save
            </star-button>
            <star-button
              variant="secondary"
              leadingIcon="ph-bold ph-copy"
              (pressed)="last.set('Copy')"
            >
              Copy
            </star-button>
            <star-button
              variant="secondary"
              leadingIcon="ph-bold ph-trash"
              (pressed)="last.set('Delete')"
            >
              Delete
            </star-button>
          </star-button-group>
          <p class="docs-output" role="status">Last action: {{ last() }}</p>
        </div>
      </docs-example>

      <docs-example heading="Icon buttons and sizes" source="button-group/icons">
        <div class="docs-stack">
          <star-button-group ariaLabel="Text alignment">
            <star-button
              variant="secondary"
              iconOnly
              leadingIcon="ph-bold ph-text-align-left"
              ariaLabel="Align left"
            />
            <star-button
              variant="secondary"
              iconOnly
              leadingIcon="ph-bold ph-text-align-center"
              ariaLabel="Align center"
            />
            <star-button
              variant="secondary"
              iconOnly
              leadingIcon="ph-bold ph-text-align-right"
              ariaLabel="Align right"
            />
          </star-button-group>
          <star-button-group ariaLabel="Pages">
            <star-button variant="secondary" size="sm">Previous</star-button>
            <star-button variant="secondary" size="sm">Next</star-button>
          </star-button-group>
        </div>
      </docs-example>

      <docs-example
        heading="With a split button"
        source="button-group/split"
        [script]="splitScript"
        note="A split button can be the last item of a group: its caret gets the outer corners."
      >
        <star-button-group ariaLabel="Invoice actions">
          <star-button variant="secondary">Preview</star-button>
          <star-split-button label="Send" variant="secondary" [items]="sendOptions" />
        </star-button-group>
      </docs-example>

      <docs-api
        [of]="['StarButtonGroup']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class ButtonGroupPage {
  protected readonly last = signal('none');

  protected readonly sendOptions: readonly StarMenuItem[] = [
    { label: 'Send later', icon: 'ph-bold ph-clock' },
    { label: 'Send as PDF', icon: 'ph-bold ph-file-pdf' },
  ];

  protected readonly basicScript = `readonly last = signal('none');`;
  protected readonly splitScript = `readonly sendOptions: readonly StarMenuItem[] = [
  { label: 'Send later', icon: 'ph-bold ph-clock' },
  { label: 'Send as PDF', icon: 'ph-bold ph-file-pdf' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: '(default)',
      description: 'star-button, button.star-btn or star-split-button elements.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-button-radius', description: 'Radius of the outer corners.' },
    { name: '--star-border', description: 'Shared border between secondary buttons.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab', description: 'Moves to the next button. Each button is one tab stop.' },
    { name: 'Enter / Space', description: 'Runs the action of the focused button.' },
  ];
}
