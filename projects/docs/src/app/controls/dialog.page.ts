import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import {
  StarDialog,
  StarDialogPosition,
  StarDialogService,
  StarDialogSize,
} from '@star-ng/ui/dialog';
import { StarField, StarInput } from '@star-ng/ui/field';
import { StarContextMenu, StarMenu, StarMenuItem, StarMenuTrigger } from '@star-ng/ui/menu';
import { StarCascadeSelect } from '@star-ng/ui/select';
import { DOCS, DocsRow } from '../shared/docs';
import { EditNoteData, EditNoteDialog } from './edit-note-dialog';
import { RecordPreviewData, RecordPreviewDialog } from './record-preview-dialog';

interface Place {
  readonly name: string;
  readonly code?: string;
  readonly children?: readonly Place[];
}

const SIZES: readonly StarDialogSize[] = ['sm', 'md', 'lg', 'xl', 'full'];
const POSITIONS: readonly StarDialogPosition[] = [
  'center',
  'top',
  'bottom',
  'start',
  'end',
  'top-start',
  'top-end',
  'bottom-start',
  'bottom-end',
];

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './dialog.page.scss',
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
        heading="Header icon, subheader and actions"
        source="dialog/header"
        [script]="headerScript"
        note="icon puts a Phosphor icon in a tile before the title, and iconTone colors the tile: primary (default), info, warn, danger or success. The icon is decorative. subheader adds a text after the title, for example a record number; it is part of the accessible name. headerDivider draws a line under the header. Content with starDialogHeaderActions goes into the header, before the header buttons: here a Close button takes the place of the close icon (closable=false). StarDialogService takes the same options, and headerAction puts one button in the header that closes the dialog with its result."
      >
        <div class="docs-stack">
          <p class="docs-output" role="status">Header action result: {{ previewResult() }}</p>
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="restoreOpen.set(true)">
              Restore record
            </star-button>
            <star-button variant="secondary" (pressed)="previewOpen.set(true)">
              Preview record
            </star-button>
            <star-button variant="secondary" (pressed)="openPreview()">
              Preview from code
            </star-button>
          </div>
        </div>
        <star-dialog
          [(visible)]="restoreOpen"
          header="Restore record"
          subheader="REC-2041"
          icon="ph-bold ph-arrow-counter-clockwise"
          iconTone="warn"
          headerDivider
        >
          <p>The record comes back with its notes and attachments.</p>
          <div starDialogFooter class="star-dialog__footer">
            <star-button variant="ghost" (pressed)="restoreOpen.set(false)">Cancel</star-button>
            <star-button (pressed)="restoreOpen.set(false)">Restore</star-button>
          </div>
        </star-dialog>
        <star-dialog
          [(visible)]="previewOpen"
          header="Preview"
          subheader="REC-2041"
          icon="ph-bold ph-file-text"
          iconTone="info"
          headerDivider
          [closable]="false"
        >
          <star-button
            starDialogHeaderActions
            size="sm"
            variant="secondary"
            (pressed)="previewOpen.set(false)"
            >Close</star-button
          >
          <p>The printer on the second floor jams on thick paper.</p>
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
        heading="Maximize"
        source="dialog/maximize"
        [script]="maximizeScript"
        note="maximizable adds a Maximize button to the header (PrimeNG maximizable). The dialog then fills the window, and the button becomes Restore. Bind maximized with a two-way binding to set or read the state. maximize and restore report the change. Escape closes a maximized dialog too, unless closeOnEscape is false."
      >
        <div class="docs-stack">
          <p class="docs-output" role="status">Maximized: {{ maximizedState() ? 'yes' : 'no' }}</p>
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="maximizeOpen.set(true)">
              Open order lines
            </star-button>
          </div>
        </div>
        <star-dialog
          [(visible)]="maximizeOpen"
          [(maximized)]="maximizedState"
          header="Order lines"
          size="lg"
          maximizable
        >
          <p>ORD-1042 has 12 lines. Maximize the dialog to see more of them at once.</p>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Position"
        source="dialog/position"
        [script]="positionScript"
        note="position places the dialog in the window (PrimeNG position): center (default), top, bottom, start, end, top-start, top-end, bottom-start or bottom-end, 1rem from the edge. start and end follow the writing direction: end is the right edge in a left-to-right page and the left edge in a right-to-left page."
      >
        <div class="docs-row">
          @for (item of positions; track item) {
            <star-button variant="secondary" (pressed)="openAt(item)">{{ item }}</star-button>
          }
        </div>
        <star-dialog
          [(visible)]="positionOpen"
          [position]="position()"
          size="sm"
          [header]="'Position ' + position()"
        >
          <p>This dialog is at the {{ position() }} position.</p>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Breakpoints, scroll and focus"
        source="dialog/responsive"
        [script]="responsiveScript"
        note="breakpoints sets the width per window size (PrimeNG breakpoints): the keys are max-widths, and the smallest key that matches wins over width and size. blockScroll stops the page from scrolling while the dialog is open and gives the scroll back after the close; it is on by default for a modal dialog and off for a non-modal one. focusOnShow=false keeps the focus off the controls: the dialog box takes it, so the first Tab reaches the first control."
      >
        <div class="docs-row">
          <star-button variant="secondary" (pressed)="responsiveOpen.set(true)">
            Open responsive dialog
          </star-button>
          <star-button variant="secondary" (pressed)="scrollOpen.set(true)">
            Non-modal, page scrolls
          </star-button>
        </div>
        <star-dialog
          [(visible)]="responsiveOpen"
          header="Responsive dialog"
          width="48rem"
          [breakpoints]="{ '960px': '75vw', '640px': '100vw' }"
          [focusOnShow]="false"
        >
          <p>48rem wide on a large window, 75vw up to 960px and the full width up to 640px.</p>
          <star-field label="Reference"><input starInput value="INV-2041" /></star-field>
        </star-dialog>
        <star-dialog
          [(visible)]="scrollOpen"
          header="Scroll stays on"
          [modal]="false"
          position="bottom-end"
          size="sm"
        >
          <p>A non-modal dialog does not block the page scroll. Set blockScroll to block it.</p>
        </star-dialog>
      </docs-example>

      <docs-example
        heading="Headless"
        source="dialog/headless"
        [script]="headlessScript"
        note="headless renders only your content in the dialog box: no header, no title and no close button (PrimeNG headless template). The starDialogFooter slot still works. Your content takes over two duties: name the dialog with ariaLabelledby (the id of your heading) or ariaLabel, and give a button that closes it. Escape still closes the dialog when closeOnEscape is on."
      >
        <star-button variant="secondary" (pressed)="headlessOpen.set(true)">
          Open headless dialog
        </star-button>
        <star-dialog [(visible)]="headlessOpen" headless ariaLabelledby="docs-headless-title">
          <div class="docs-stack docs-headless">
            <h2 id="docs-headless-title">Shipping label for ORD-1042</h2>
            <p>Your content draws its own heading, padding and buttons.</p>
            <div class="docs-row">
              <star-button (pressed)="headlessOpen.set(false)">Done</star-button>
            </div>
          </div>
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

      <docs-api [of]="['StarDialog']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />

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
        Page scroll locks while a dialog with <code>blockScroll</code> is open (on by default for a
        modal dialog), with the CSS rule
        <code>html:has(dialog.star-dialog--block-scroll[open])</code>. The page scroll comes back
        when the dialog closes. The dialog enters and leaves with
        <code>&#64;starting-style</code> transitions, and a user who prefers reduced motion gets
        none.
      </p>
    </docs-page>
  `,
})
export class DialogPage {
  private readonly dialogs = inject(StarDialogService);

  constructor() {
    // The service puts its overlays in the body, outside the page: close them when the page
    // goes, as its route styles go with it.
    inject(DestroyRef).onDestroy(() => this.dialogs.closeAll());
  }

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
  protected readonly maximizeOpen = signal(false);
  protected readonly maximizedState = signal(false);
  protected readonly positions = POSITIONS;
  protected readonly positionOpen = signal(false);
  protected readonly position = signal<StarDialogPosition>('center');
  protected readonly responsiveOpen = signal(false);
  protected readonly scrollOpen = signal(false);
  protected readonly headlessOpen = signal(false);
  protected readonly restoreOpen = signal(false);
  protected readonly previewOpen = signal(false);
  protected readonly previewResult = signal('none');
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

  protected openAt(position: StarDialogPosition): void {
    this.position.set(position);
    this.positionOpen.set(true);
  }

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

  protected async openPreview(): Promise<void> {
    const ref = this.dialogs.open<RecordPreviewDialog, RecordPreviewData, string>(
      RecordPreviewDialog,
      {
        header: 'Preview',
        subheader: 'REC-2041',
        icon: 'ph-bold ph-file-text',
        iconTone: 'info',
        headerDivider: true,
        closable: false,
        headerAction: { label: 'Close', variant: 'secondary', result: 'closed' },
        data: {
          description: 'The printer on the second floor jams on thick paper.',
          resolution: 'The paper tray was set to thick paper.',
        },
      },
    );
    this.previewResult.set((await ref.closed) ?? 'dismissed');
  }

  protected readonly basicScript = `readonly basicOpen = signal(false);`;
  protected readonly headerScript = `private readonly dialogs = inject(StarDialogService);
readonly restoreOpen = signal(false);
readonly previewOpen = signal(false);
readonly previewResult = signal('none');

// The same header from code: one header action closes the dialog with its result.
async openPreview(): Promise<void> {
  const ref = this.dialogs.open<RecordPreviewDialog, RecordPreviewData, string>(
    RecordPreviewDialog,
    {
      header: 'Preview',
      subheader: 'REC-2041',
      icon: 'ph-bold ph-file-text',
      iconTone: 'info',
      headerDivider: true,
      closable: false,
      headerAction: { label: 'Close', variant: 'secondary', result: 'closed' },
      data: {
        description: 'The printer on the second floor jams on thick paper.',
        resolution: 'The paper tray was set to thick paper.',
      },
    },
  );
  this.previewResult.set((await ref.closed) ?? 'dismissed');
}`;
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
  protected readonly maximizeScript = `readonly maximizeOpen = signal(false);
readonly maximizedState = signal(false);`;
  protected readonly positionScript = `readonly positions: readonly StarDialogPosition[] = [
  'center', 'top', 'bottom', 'start', 'end', 'top-start', 'top-end', 'bottom-start', 'bottom-end',
];
readonly positionOpen = signal(false);
readonly position = signal<StarDialogPosition>('center');

openAt(position: StarDialogPosition): void {
  this.position.set(position);
  this.positionOpen.set(true);
}`;
  protected readonly responsiveScript = `readonly responsiveOpen = signal(false);
readonly scrollOpen = signal(false);`;
  protected readonly headlessScript = `readonly headlessOpen = signal(false);`;
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
        'Opens the component in a modal dialog and returns a StarDialogRef. config has header, subheader, icon, iconTone, headerDivider, headerAction, size, width, data, closable, closeOnEscape, dismissableMask, role, ariaLabel, position, draggable, resizable, maximizable, keepInViewport, breakpoints, blockScroll and focusOnShow.',
    },
    {
      name: 'StarDialogHeaderAction',
      description:
        'config.headerAction: one button in the header. label, variant (default secondary), icon, ariaLabel and result. A press closes the dialog, and closed resolves with result. With closable: false it takes the place of the close icon.',
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
    { name: '[starDialogHeader]', description: 'Extra header content, under the title.' },
    {
      name: '[starDialogHeaderActions]',
      description:
        'Header actions, for example a button, before the move, maximize and close buttons.',
    },
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
    {
      name: '--star-dialog-icon-tile-size',
      description: 'Width and height of the header icon tile. Default 2.375rem.',
    },
    { name: '--star-dialog-icon-size', description: 'Size of the header icon. Default 1.25rem.' },
    {
      name: '--star-dialog-icon-radius',
      description: 'Corner radius of the header icon tile. Default --star-radius-md.',
    },
    {
      name: '--star-dialog-icon-color',
      description: 'Color of the header icon. Set by iconTone; set it on .star-dialog__icon.',
    },
    {
      name: '--star-dialog-icon-surface',
      description:
        'Background of the header icon tile. Set by iconTone; set it on .star-dialog__icon.',
    },
    {
      name: '--star-dialog-subheader-color',
      description: 'Color of the subheader. Default --star-text-muted.',
    },
    {
      name: '--star-dialog-subheader-font',
      description:
        'Font of the subheader. Default --star-type-body-lg; set a monospace font for record numbers.',
    },
    {
      name: '--star-dialog-header-divider-color',
      description: 'Line under the header with headerDivider. Default --star-border.',
    },
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
