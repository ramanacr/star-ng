import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarActionSheetItem, StarBottomSheet } from '@star-ng/ui/bottom-sheet';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './action-sheet.page.scss',
  selector: 'docs-action-sheet-page',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Action sheet"
      lead="A list of actions in a bottom sheet, with a Cancel button at the end. StarBottomSheet.openActions opens it and resolves with the chosen action, or undefined when the user cancels. Use it on small screens for the actions of one item, instead of a menu."
      importFrom="import { StarBottomSheet, StarActionSheetItem } from '@star-ng/ui/bottom-sheet';"
    >
      <docs-example
        heading="Actions of an order"
        source="action-sheet/basic"
        [script]="basicScript"
        note="Each action has a label and a value. The chosen action comes out of ref.afterDismissed(). Cancel, Escape and a click on the backdrop give undefined."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              variant="secondary"
              leadingIcon="ph-bold ph-dots-three"
              (pressed)="invoiceActions()"
            >
              Invoice actions
            </star-button>
          </div>
          <p class="docs-output" role="status">Chosen: {{ chosen() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Icons, danger and disabled actions"
        source="action-sheet/states"
        [script]="statesScript"
        note="icon shows a Phosphor icon before the label. danger shows a destructive action in the danger color. disabled keeps the action in the list, but the user cannot choose it."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              variant="secondary"
              leadingIcon="ph-bold ph-folder"
              (pressed)="projectActions()"
            >
              Project actions
            </star-button>
          </div>
          <p class="docs-output" role="status">Project action: {{ projectAction() }}</p>
        </div>
      </docs-example>

      <docs-api [of]="['StarActionSheet']" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Action items</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            StarActionSheetItem
          </caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of itemRows; track row.name) {
              <tr>
                <th scope="row">
                  <code>{{ row.name }}</code>
                </th>
                <td>{{ row.description }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <h2>Technical notes</h2>
      <p>
        The action sheet is a list of native buttons in a <code>star-bottom-sheet-container</code>,
        so every action works with the keyboard and a screen reader announces it as a button. The
        Cancel button uses the <code>reject</code> UI text, and the sheet takes the
        <code>actions</code> UI text as its accessible name when the config sets no ariaLabel.
        PrimeNG has no action sheet; the nearest controls are a popup menu and a bottom drawer.
      </p>
    </docs-page>
  `,
})
export class ActionSheetPage {
  private readonly sheet = inject(StarBottomSheet);

  protected readonly chosen = signal('none');
  protected readonly projectAction = signal('none');

  protected async invoiceActions(): Promise<void> {
    const ref = this.sheet.openActions<string>(
      [
        { label: 'Download PDF', value: 'pdf' },
        { label: 'Send by e-mail', value: 'mail' },
        { label: 'Mark as paid', value: 'paid' },
      ],
      { ariaLabel: 'Invoice INV-2041 actions' },
    );
    this.chosen.set((await ref.afterDismissed())?.value ?? 'cancelled');
  }

  protected async projectActions(): Promise<void> {
    const actions: StarActionSheetItem<string>[] = [
      { label: 'Rename project', icon: 'ph-bold ph-pencil-simple', value: 'rename' },
      { label: 'Move to archive', icon: 'ph-bold ph-archive', value: 'archive' },
      { label: 'Export project', icon: 'ph-bold ph-export', disabled: true },
      { label: 'Delete project', icon: 'ph-bold ph-trash', danger: true, value: 'delete' },
    ];
    const ref = this.sheet.openActions(actions, { ariaLabel: 'Project North depot actions' });
    this.projectAction.set((await ref.afterDismissed())?.value ?? 'cancelled');
  }

  protected readonly basicScript = `private readonly sheet = inject(StarBottomSheet);
readonly chosen = signal('none');

async invoiceActions(): Promise<void> {
  const ref = this.sheet.openActions<string>(
    [
      { label: 'Download PDF', value: 'pdf' },
      { label: 'Send by e-mail', value: 'mail' },
      { label: 'Mark as paid', value: 'paid' },
    ],
    { ariaLabel: 'Invoice INV-2041 actions' },
  );
  this.chosen.set((await ref.afterDismissed())?.value ?? 'cancelled');
}`;

  protected readonly statesScript = `async projectActions(): Promise<void> {
  const actions: StarActionSheetItem<string>[] = [
    { label: 'Rename project', icon: 'ph-bold ph-pencil-simple', value: 'rename' },
    { label: 'Move to archive', icon: 'ph-bold ph-archive', value: 'archive' },
    { label: 'Export project', icon: 'ph-bold ph-export', disabled: true },
    { label: 'Delete project', icon: 'ph-bold ph-trash', danger: true, value: 'delete' },
  ];
  const ref = this.sheet.openActions(actions, { ariaLabel: 'Project North depot actions' });
  this.projectAction.set((await ref.afterDismissed())?.value ?? 'cancelled');
}`;

  protected readonly itemRows: readonly DocsRow[] = [
    { name: 'label', description: 'Text of the action. Required.' },
    { name: 'icon', description: 'Phosphor icon class, for example ph-bold ph-share.' },
    { name: 'danger', description: 'A destructive action: shown in the danger color.' },
    { name: 'disabled', description: 'The action shows, but the user cannot choose it.' },
    { name: 'value', description: 'Any value that the caller needs back, for example an id.' },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-bottom-sheet-max-width', description: 'Largest width of the sheet.' },
    { name: '--star-danger', description: 'Text color of a danger action.' },
    { name: '--star-surface', description: 'Background of the sheet.' },
  ];

  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Tab / Shift+Tab', description: 'Moves between the actions and Cancel.' },
    { name: 'Enter / Space', description: 'Chooses the focused action.' },
    { name: 'Escape', description: 'Closes the sheet. The result is undefined.' },
  ];
}
