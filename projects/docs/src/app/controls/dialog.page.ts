import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarDialog, StarDialogService, StarDialogSize } from '@star-ng/ui/dialog';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarContextMenu, StarMenu, StarMenuItem, StarMenuTrigger } from '@star-ng/ui/menu';
import { StarCascadeSelect } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';
import { EditNoteData, EditNoteDialog } from './edit-note-dialog';

interface Place {
  readonly name: string;
  readonly code?: string;
  readonly children?: readonly Place[];
}

const SIZES: readonly StarDialogSize[] = ['sm', 'md', 'lg', 'xl', 'full'];

@Component({
  selector: 'docs-dialog-page',
  imports: [
    DOCS,
    StarButton,
    StarCascadeSelect,
    StarContextMenu,
    StarDialog,
    StarField,
    StarInput,
    StarMenu,
    StarMenuTrigger,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Dialog"
      lead="A window above the page, built on the native dialog element. The browser gives the top layer, the focus trap, Escape and the return of the focus. A modal dialog makes the rest of the page inert."
      importFrom="import { StarDialog, StarDialogService } from '@star-ng/ui/dialog';"
    >
      <docs-example
        heading="Header and footer"
        source="dialog/basic"
        [script]="basicScript"
        note="Bind visible with a two-way binding. The header input gives the title and the accessible name. Content with starDialogHeader adds to the header, and content with starDialogFooter becomes the footer. The close button in the header sets visible to false."
      >
        <star-button (pressed)="basicOpen.set(true)">Edit order</star-button>
        <star-dialog [(visible)]="basicOpen" header="Edit order ORD-1042">
          <span starDialogHeader class="docs-output">Last saved at 10:42</span>
          <div class="docs-stack">
            <star-field label="Customer">
              <input starInput value="Orchard Supply" />
            </star-field>
            <star-field label="Delivery note" hint="The driver reads this note.">
              <textarea starInput rows="3">Leave at the loading dock.</textarea>
            </star-field>
          </div>
          <div starDialogFooter class="star-dialog__footer">
            <star-button variant="ghost" (pressed)="basicOpen.set(false)">Cancel</star-button>
            <star-button (pressed)="basicOpen.set(false)">Save</star-button>
          </div>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Sizes"
        source="dialog/sizes"
        [script]="sizesScript"
        note="The size input is sm, md (default), lg, xl or full. The width input sets a fixed CSS width and overrides size."
      >
        <div class="docs-row">
          @for (item of sizes; track item) {
            <star-button variant="secondary" (pressed)="openSize(item)">
              Open {{ item }}
            </star-button>
          }
        </div>
        <star-dialog [(visible)]="sizeOpen" [size]="size()" [header]="'Size ' + size()">
          <p>The size input of this dialog is {{ size() }}.</p>
          <div starDialogFooter class="star-dialog__footer">
            <star-button (pressed)="sizeOpen.set(false)">Close</star-button>
          </div>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Close rules"
        source="dialog/close-rules"
        [script]="rulesScript"
        note="Escape and the close button close the dialog by default. A click on the backdrop closes it only with dismissableMask. closable=false hides the close button and closeOnEscape=false turns Escape off, so only your own button closes the dialog. A dialog with modal=false has no backdrop and does not block the page."
      >
        <div class="docs-row">
          <star-button variant="secondary" (pressed)="maskOpen.set(true)"
            >Backdrop click</star-button
          >
          <star-button variant="secondary" (pressed)="lockedOpen.set(true)">Locked</star-button>
          <star-button variant="secondary" (pressed)="floatOpen.set(true)">Non-modal</star-button>
        </div>
        <star-dialog [(visible)]="maskOpen" header="Closes on a backdrop click" dismissableMask>
          <p>Click outside this window to close it.</p>
        </star-dialog>
        <star-dialog
          [(visible)]="lockedOpen"
          header="Locked dialog"
          [closable]="false"
          [closeOnEscape]="false"
        >
          <p>This dialog has no close button and ignores Escape.</p>
          <div starDialogFooter class="star-dialog__footer">
            <star-button (pressed)="lockedOpen.set(false)">Done</star-button>
          </div>
        </star-dialog>
        <star-dialog [(visible)]="floatOpen" header="Non-modal dialog" [modal]="false">
          <p>The page behind this window stays usable.</p>
          <div starDialogFooter class="star-dialog__footer">
            <star-button (pressed)="floatOpen.set(false)">Close</star-button>
          </div>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Initial focus"
        source="dialog/focus"
        [script]="focusScript"
        note="The browser puts the focus on the first focusable element. Put autofocus on a native element, or data-autofocus on any element or component, to choose another one. When the dialog closes, the focus returns to the button that opened it."
      >
        <div class="docs-row">
          <star-button variant="secondary" (pressed)="defaultFocusOpen.set(true)">
            First focusable
          </star-button>
          <star-button variant="secondary" (pressed)="markedFocusOpen.set(true)">
            Marked field
          </star-button>
        </div>
        <star-dialog [(visible)]="defaultFocusOpen" header="Default focus">
          <p>The focus starts on the close button.</p>
          <star-field label="Reference"><input starInput value="ORD-1042" /></star-field>
        </star-dialog>
        <star-dialog [(visible)]="markedFocusOpen" header="Marked focus">
          <star-field label="Reference">
            <input starInput value="ORD-1042" data-autofocus />
          </star-field>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Drag"
        source="dialog/drag"
        [script]="dragScript"
        note="draggable moves the dialog by its header (PrimeNG draggable). The move button in the header has the name Move dialog: focus it and press Alt with an arrow key to move the dialog by 10 pixels. keepInViewport (default true) keeps the dialog inside the window. dragEnd gives the position of the top left corner. The dialog opens at its normal place again, unless rememberPosition is set."
      >
        <div class="docs-stack">
          <p class="docs-output" role="status">Last position: {{ dragNote() }}</p>
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="dragOpen.set(true)">
              Open movable dialog
            </star-button>
          </div>
        </div>
        <star-dialog
          [(visible)]="dragOpen"
          header="Movable dialog"
          draggable
          (dragEnd)="dragNote.set($event.x + ', ' + $event.y)"
        >
          <p>Drag the header, or focus the move button and press Alt with an arrow key.</p>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Resize"
        source="dialog/resize"
        [script]="resizeScript"
        note="resizable adds a handle in the bottom end corner (PrimeNG resizable). Drag it with the pointer, or focus it (name Resize dialog) and press Shift with an arrow key to change the size by 10 pixels. The top start corner stays in place, and the smallest size is 240 by 160 pixels. resizeEnd gives the new width and height."
      >
        <div class="docs-stack">
          <p class="docs-output" role="status">Last size: {{ resizeNote() }}</p>
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="resizeOpen.set(true)">
              Open resizable dialog
            </star-button>
          </div>
        </div>
        <star-dialog
          [(visible)]="resizeOpen"
          header="Resizable dialog"
          resizable
          draggable
          (resizeEnd)="resizeNote.set($event.width + ' x ' + $event.height)"
        >
          <p>Drag the corner handle, or focus it and press Shift with an arrow key.</p>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Dialog from code"
        source="dialog/service"
        [script]="serviceScript"
        note="StarDialogService.open shows a component in a modal dialog, with no element in your template. The data goes in with config.data and the component injects it with STAR_DIALOG_DATA. The component closes the dialog with the injected StarDialogRef, and the result comes out of ref.closed. Escape, the close button and the backdrop give undefined."
      >
        <div class="docs-stack">
          <p class="docs-output" role="status">Note: {{ note() }}</p>
          <div class="docs-row">
            <star-button leadingIcon="ph-bold ph-note-pencil" (pressed)="editNote()">
              Edit note
            </star-button>
          </div>
        </div>
      </docs-example>

      <docs-example
        heading="Menus and selects inside a modal"
        source="dialog/popups"
        [script]="popupsScript"
        note="A menu button, a cascade select and a context menu work inside a modal dialog. The menu popups go into the dialog, so they take clicks and keys."
      >
        <star-button variant="secondary" (pressed)="popupsOpen.set(true)">
          Open order dialog
        </star-button>
        <star-dialog [(visible)]="popupsOpen" header="Order ORD-1042" size="md">
          <div class="docs-stack">
            <star-field label="Shipping city" hint="Menus and cascade selects open above the modal">
              <star-cascade-select
                [options]="places"
                optionLabel="name"
                optionValue="code"
                [(value)]="place"
                ariaLabel="Dialog city"
                showPath
              />
            </star-field>
            <div class="docs-row">
              <star-button size="sm" variant="secondary" [starMenuTrigger]="actionsMenu">
                More actions
              </star-button>
              <star-menu
                #actionsMenu
                [items]="actionItems"
                (itemClick)="lastAction.set($event.label ?? '')"
              />
              <span class="docs-output" tabindex="0" [starContextMenu]="actionsMenu">
                Last action: {{ lastAction() }}
              </span>
            </div>
          </div>
          <div starDialogFooter class="star-dialog__footer">
            <star-button (pressed)="popupsOpen.set(false)">Done</star-button>
          </div>
        </star-dialog>
      </docs-example>

      <docs-api
        [of]="['StarDialog', 'StarDialogBase']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Dialog service</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            StarDialogService and StarDialogRef
          </caption>
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Description</th>
            </tr>
          </thead>
          <tbody>
            @for (row of serviceRows; track row.name) {
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
        A modal <code>dialog</code> makes the rest of the page inert. Everything outside the dialog
        takes no click and no key, and a popup that the Angular CDK puts in its overlay container is
        outside the dialog. The popover, tooltip and toast of StarNG use the top layer, so they stay
        above a dialog. A menu trigger, a context menu and a menu bar inside a dialog use
        <code>keepMenuInsideDialog</code> from <code>@star-ng/ui/menu</code>, which moves the menu
        popup into the dialog. A select inside a dialog also opens its panel in the top layer.
      </p>
      <p>
        Page scroll locks while a modal dialog is open (the CSS rule
        <code>html:has(dialog.star-dialog--modal[open])</code>). The dialog enters and leaves with
        <code>&#64;starting-style</code> transitions, and a user who prefers reduced motion gets
        none.
      </p>
    </docs-page>
  `,
})
export class DialogPage {
  private readonly dialogs = inject(StarDialogService);

  protected readonly sizes = SIZES;
  protected readonly basicOpen = signal(false);
  protected readonly sizeOpen = signal(false);
  protected readonly size = signal<StarDialogSize>('md');
  protected readonly maskOpen = signal(false);
  protected readonly lockedOpen = signal(false);
  protected readonly floatOpen = signal(false);
  protected readonly defaultFocusOpen = signal(false);
  protected readonly markedFocusOpen = signal(false);
  protected readonly popupsOpen = signal(false);
  protected readonly dragOpen = signal(false);
  protected readonly dragNote = signal('not moved');
  protected readonly resizeOpen = signal(false);
  protected readonly resizeNote = signal('not resized');
  protected readonly note = signal('Call the customer before delivery.');
  protected readonly place = signal<string | null>(null);
  protected readonly lastAction = signal('none');

  protected readonly places: readonly Place[] = [
    {
      name: 'Germany',
      children: [
        {
          name: 'Bavaria',
          children: [
            { name: 'Munich', code: 'DE-MUC' },
            { name: 'Nuremberg', code: 'DE-NUE' },
          ],
        },
      ],
    },
    {
      name: 'India',
      children: [
        { name: 'Maharashtra', children: [{ name: 'Pune', code: 'IN-PNQ' }] },
        { name: 'Telangana', children: [{ name: 'Hyderabad', code: 'IN-HYD' }] },
      ],
    },
  ];

  protected readonly actionItems: readonly StarMenuItem[] = [
    { label: 'Assign to me', icon: 'ph-bold ph-user' },
    {
      label: 'Move to',
      icon: 'ph-bold ph-arrow-bend-up-right',
      items: [{ label: 'North queue' }, { label: 'South queue' }],
    },
  ];

  protected openSize(size: StarDialogSize): void {
    this.size.set(size);
    this.sizeOpen.set(true);
  }

  protected async editNote(): Promise<void> {
    const ref = this.dialogs.open<EditNoteDialog, EditNoteData, string>(EditNoteDialog, {
      header: 'Edit note',
      size: 'md',
      data: { orderId: 'ORD-1042', note: this.note() },
    });
    const saved = await ref.closed;
    if (saved !== undefined) this.note.set(saved);
  }

  protected readonly basicScript = `readonly basicOpen = signal(false);`;
  protected readonly sizesScript = `readonly sizes: readonly StarDialogSize[] = ['sm', 'md', 'lg', 'xl', 'full'];
readonly sizeOpen = signal(false);
readonly size = signal<StarDialogSize>('md');

openSize(size: StarDialogSize): void {
  this.size.set(size);
  this.sizeOpen.set(true);
}`;
  protected readonly rulesScript = `readonly maskOpen = signal(false);
readonly lockedOpen = signal(false);
readonly floatOpen = signal(false);`;
  protected readonly focusScript = `readonly defaultFocusOpen = signal(false);
readonly markedFocusOpen = signal(false);`;
  protected readonly dragScript = `readonly dragOpen = signal(false);
readonly dragNote = signal('not moved');`;
  protected readonly resizeScript = `readonly resizeOpen = signal(false);
readonly resizeNote = signal('not resized');`;
  protected readonly serviceScript = `private readonly dialogs = inject(StarDialogService);
readonly note = signal('Call the customer before delivery.');

async editNote(): Promise<void> {
  const ref = this.dialogs.open<EditNoteDialog, EditNoteData, string>(EditNoteDialog, {
    header: 'Edit note',
    size: 'md',
    data: { orderId: 'ORD-1042', note: this.note() },
  });
  const saved = await ref.closed; // undefined when the user dismissed the dialog
  if (saved !== undefined) this.note.set(saved);
}

// The component that the dialog shows:
@Component({
  selector: 'docs-edit-note-dialog',
  imports: [StarField, StarInput, StarButton],
  template: \`
    <star-field label="Internal note" [hint]="'Order ' + data.orderId">
      <textarea starInput rows="3" data-autofocus [value]="note()"
        (input)="note.set($any($event.target).value)"></textarea>
    </star-field>
    <div class="star-dialog__footer star-dialog__footer--inline">
      <star-button variant="ghost" (pressed)="ref.close()">Cancel</star-button>
      <star-button (pressed)="ref.close(note().trim())">Save</star-button>
    </div>
  \`,
})
export class EditNoteDialog {
  protected readonly data = inject<EditNoteData>(STAR_DIALOG_DATA);
  protected readonly ref = inject<StarDialogRef<string>>(StarDialogRef);
  protected readonly note = signal(this.data.note);
}`;
  protected readonly popupsScript = `readonly popupsOpen = signal(false);
readonly place = signal<string | null>(null);
readonly lastAction = signal('none');

readonly actionItems: readonly StarMenuItem[] = [
  { label: 'Assign to me', icon: 'ph-bold ph-user' },
  {
    label: 'Move to',
    icon: 'ph-bold ph-arrow-bend-up-right',
    items: [{ label: 'North queue' }, { label: 'South queue' }],
  },
];`;

  protected readonly serviceRows: readonly DocsRow[] = [
    {
      name: 'open(component, config?, injector?)',
      description:
        'Opens the component in a modal dialog and returns a StarDialogRef. config has header, size, width, data, closable, closeOnEscape, dismissableMask, role and ariaLabel.',
    },
    { name: 'closeAll()', description: 'Closes every dialog that the service opened.' },
    {
      name: 'STAR_DIALOG_DATA',
      description: 'Injection token: the config.data value, inside the opened component.',
    },
    {
      name: 'StarDialogRef.close(result?)',
      description: 'Closes the dialog. The result goes to the closed promise.',
    },
    {
      name: 'StarDialogRef.closed',
      description: 'Promise that resolves after the dialog has closed: the result, or undefined.',
    },
    {
      name: 'star-dialog__footer--inline',
      description:
        'CSS class for a footer inside the opened component: it spans the full width of the dialog body.',
    },
  ];

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The body of the dialog.' },
    { name: '[starDialogHeader]', description: 'Extra header content, next to the title.' },
    {
      name: '[starDialogFooter]',
      description: 'The footer. Use the class star-dialog__footer for the standard button row.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the dialog.' },
    { name: '--star-radius-2xl', description: 'Corner radius of the dialog.' },
    { name: '--star-shadow-modal', description: 'Shadow of the dialog.' },
    { name: '--star-scrim-modal', description: 'Color of the backdrop of a modal dialog.' },
    { name: '--star-text-strong', description: 'Color of the title.' },
    { name: '--star-border', description: 'Line above the footer.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Escape', description: 'Closes the dialog, unless closeOnEscape is false.' },
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves the focus inside a modal dialog. The focus does not leave the dialog.',
    },
    {
      name: 'Alt + arrow keys',
      description:
        'In the header of a draggable dialog (the move button): moves the dialog by 10 pixels.',
    },
    {
      name: 'Shift + arrow keys',
      description: 'On the resize handle of a resizable dialog: changes the size by 10 pixels.',
    },
  ];
}
