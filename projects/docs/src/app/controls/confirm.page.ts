import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarConfirmService } from '@star-ng/ui/dialog';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-confirm-page',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Confirm"
      lead="A question that the user answers with accept or reject. StarConfirmService.ask returns a promise: true for accept, false for reject, Escape, the close button or a click outside. One star-confirm-host in the app shell shows the question."
      importFrom="import { StarConfirmHost, StarConfirmService } from '@star-ng/ui/dialog';"
    >
      <docs-example
        heading="Confirm dialog"
        source="confirm/dialog"
        [script]="dialogScript"
        note="Without a target, ask opens a small modal alertdialog. Use it for a risky action, such as a delete. By default the focus starts on the safe choice, which is reject."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              variant="ghost-danger"
              leadingIcon="ph-bold ph-trash"
              (pressed)="deleteOrder()"
            >
              Delete order
            </star-button>
          </div>
          <p class="docs-output" role="status">Result: {{ result() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Focus, labels and acknowledge-only"
        source="confirm/options"
        [script]="optionsScript"
        note="defaultFocus accept puts the first focus on the accept button. acceptLabel and rejectLabel change the button texts. rejectVisible false hides the reject button, which gives a dialog that the user only acknowledges."
      >
        <div class="docs-row">
          <star-button variant="secondary" (pressed)="publish()">Publish price list</star-button>
          <star-button variant="secondary" (pressed)="acknowledge()">Show notice</star-button>
        </div>
      </docs-example>

      <docs-example
        heading="Confirm popup"
        source="confirm/popup"
        [script]="popupScript"
        note="With a target element, ask shows a small popup next to the element instead of a dialog (PrimeNG ConfirmPopup). Use it for a low-risk question on a button or a row. A click outside the popup or Escape rejects."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              variant="ghost"
              leadingIcon="ph-bold ph-archive"
              (pressed)="archive($event)"
            >
              Archive
            </star-button>
          </div>
          <p class="docs-output" role="status">Archive result: {{ popupResult() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Delete from a row"
        source="confirm/popup-row"
        [script]="rowScript"
        note="severity danger gives the accept button the danger variant. The first focus stays on the safe choice, reject. The popup is an alertdialog with aria-modal false, and the message is its accessible name. Tab cycles between the two buttons. After an answer the focus returns to the row button."
      >
        <div class="docs-stack">
          <div class="docs-stack">
            @for (invoice of invoices(); track invoice.id) {
              <div class="docs-row">
                <span>{{ invoice.id }}, {{ invoice.amount }}</span>
                <star-button
                  size="sm"
                  variant="ghost-danger"
                  leadingIcon="ph-bold ph-trash"
                  [ariaLabel]="'Delete ' + invoice.id"
                  (pressed)="deleteInvoice(invoice.id, $event)"
                />
              </div>
            }
          </div>
          <p class="docs-output" role="status">Invoice result: {{ rowResult() }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarConfirmHost']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Confirm service</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            StarConfirmService and StarConfirmOptions
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
        Requests wait in a queue: the host shows one at a time, in the order of the calls. The
        dialog has the role <code>alertdialog</code>, and the question is its accessible name
        through the header. The popup is a <code>star-popover</code> with the role
        <code>alertdialog</code> and <code>aria-modal="false"</code>, so it stays above an open
        modal dialog. The CDK places it below or above the target, whichever has space, and Tab and
        Shift+Tab cycle between its buttons.
      </p>
    </docs-page>
  `,
})
export class ConfirmPage {
  private readonly confirm = inject(StarConfirmService);

  constructor() {
    // The questions of this page close with it (as "no"): a popup is anchored to an element of
    // the page, and the shell host would keep a dialog open on the next page.
    inject(DestroyRef).onDestroy(() => {
      while (this.confirm.current()) this.confirm.settle(false);
    });
  }

  protected readonly result = signal('none');
  protected readonly popupResult = signal('none');
  protected readonly rowResult = signal('none');
  protected readonly invoices = signal([
    { id: 'INV-2041', amount: '1,240.00 EUR' },
    { id: 'INV-2042', amount: '310.50 EUR' },
    { id: 'INV-2043', amount: '89.90 EUR' },
  ]);

  protected async deleteOrder(): Promise<void> {
    const accepted = await this.confirm.ask({
      header: 'Delete order ORD-1042?',
      message: 'The order and its history are removed. You cannot undo this.',
      icon: 'ph-bold ph-trash',
      acceptLabel: 'Delete',
      acceptVariant: 'danger',
    });
    this.result.set(accepted ? 'deleted' : 'kept');
  }

  protected async publish(): Promise<void> {
    const accepted = await this.confirm.ask({
      header: 'Publish the price list?',
      message: 'Customers see the new prices at once.',
      icon: 'ph-bold ph-megaphone',
      acceptLabel: 'Publish',
      rejectLabel: 'Not yet',
      defaultFocus: 'accept',
    });
    this.result.set(accepted ? 'published' : 'not published');
  }

  protected async acknowledge(): Promise<void> {
    await this.confirm.ask({
      header: 'Maintenance tonight',
      message: 'The portal is read-only from 22:00 to 23:00.',
      icon: 'ph-bold ph-wrench',
      acceptLabel: 'Got it',
      rejectVisible: false,
    });
    this.result.set('acknowledged');
  }

  protected async archive(event: MouseEvent): Promise<void> {
    const accepted = await this.confirm.ask({
      header: 'Archive order ORD-1042?',
      message: 'You can restore it from the archive.',
      icon: 'ph-bold ph-archive',
      acceptLabel: 'Archive',
      target: event.currentTarget as HTMLElement,
    });
    this.popupResult.set(accepted ? 'archived' : 'kept');
  }

  protected async deleteInvoice(id: string, event: MouseEvent): Promise<void> {
    const accepted = await this.confirm.ask({
      message: `Delete invoice ${id}?`,
      acceptLabel: 'Delete',
      severity: 'danger',
      target: event.currentTarget as HTMLElement,
    });
    if (accepted) this.invoices.update((list) => list.filter((invoice) => invoice.id !== id));
    this.rowResult.set(accepted ? `${id} deleted` : `${id} kept`);
  }

  protected readonly dialogScript = `private readonly confirm = inject(StarConfirmService);
readonly result = signal('none');

async deleteOrder(): Promise<void> {
  const accepted = await this.confirm.ask({
    header: 'Delete order ORD-1042?',
    message: 'The order and its history are removed. You cannot undo this.',
    icon: 'ph-bold ph-trash',
    acceptLabel: 'Delete',
    acceptVariant: 'danger',
  });
  this.result.set(accepted ? 'deleted' : 'kept');
}`;
  protected readonly optionsScript = `async publish(): Promise<void> {
  const accepted = await this.confirm.ask({
    header: 'Publish the price list?',
    message: 'Customers see the new prices at once.',
    icon: 'ph-bold ph-megaphone',
    acceptLabel: 'Publish',
    rejectLabel: 'Not yet',
    defaultFocus: 'accept',
  });
  this.result.set(accepted ? 'published' : 'not published');
}

async acknowledge(): Promise<void> {
  await this.confirm.ask({
    header: 'Maintenance tonight',
    message: 'The portal is read-only from 22:00 to 23:00.',
    icon: 'ph-bold ph-wrench',
    acceptLabel: 'Got it',
    rejectVisible: false,
  });
  this.result.set('acknowledged');
}`;
  protected readonly popupScript = `readonly popupResult = signal('none');

async archive(event: MouseEvent): Promise<void> {
  const accepted = await this.confirm.ask({
    header: 'Archive order ORD-1042?',
    message: 'You can restore it from the archive.',
    icon: 'ph-bold ph-archive',
    acceptLabel: 'Archive',
    target: event.currentTarget as HTMLElement,
  });
  this.popupResult.set(accepted ? 'archived' : 'kept');
}`;

  protected readonly rowScript = `readonly invoices = signal([
  { id: 'INV-2041', amount: '1,240.00 EUR' },
  { id: 'INV-2042', amount: '310.50 EUR' },
  { id: 'INV-2043', amount: '89.90 EUR' },
]);
readonly rowResult = signal('none');

async deleteInvoice(id: string, event: MouseEvent): Promise<void> {
  const accepted = await this.confirm.ask({
    message: \`Delete invoice \${id}?\`,
    acceptLabel: 'Delete',
    severity: 'danger',
    target: event.currentTarget as HTMLElement,
  });
  if (accepted) this.invoices.update((list) => list.filter((invoice) => invoice.id !== id));
  this.rowResult.set(accepted ? \`\${id} deleted\` : \`\${id} kept\`);
}`;

  protected readonly serviceRows: readonly DocsRow[] = [
    {
      name: 'ask(options)',
      description:
        'Queues a question and returns a promise of a boolean: true for accept, false for reject or dismiss.',
    },
    {
      name: 'options.header, options.message',
      description:
        'The title and the text of the question. The header is optional: without it, the message is the accessible name. The popup shows only the message, which is its accessible name.',
    },
    { name: 'options.icon', description: 'Phosphor icon class shown next to the message.' },
    {
      name: 'options.acceptLabel, options.rejectLabel',
      description: 'Button texts. The defaults come from the @star-ng/ui text provider.',
    },
    {
      name: 'options.acceptVariant',
      description: 'Button variant of the accept button. Use danger for a delete.',
    },
    {
      name: 'options.severity',
      description:
        'default or danger. danger gives the accept button the danger variant, when acceptVariant is not set.',
    },
    { name: 'options.rejectVisible', description: 'false hides the reject button.' },
    {
      name: 'options.defaultFocus',
      description: 'accept or reject (default). The button that gets the first focus.',
    },
    {
      name: 'options.target',
      description:
        'An element or an ElementRef. Shows a popup next to it instead of a dialog. The focus returns to it after an answer or Escape.',
    },
    { name: 'settle(accepted)', description: 'Resolves the visible request. The host calls it.' },
  ];

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starConfirmTemplate]',
      description:
        'Content child of star-confirm-host. "header" replaces the dialog title (the dialog keeps the header or message as its name), "icon" the icon, "acceptIcon" and "rejectIcon" add an icon in the buttons, "footer" replaces the buttons. Context: $implicit (the options), accept and reject. PrimeNG #header, #icon, #accepticon, #rejecticon and #footer.',
    },
    {
      name: 'ng-template[starConfirmMessage]',
      description:
        'Inside star-confirm-host. Replaces the message text of the dialog and the popup. let-options gives the options of ask.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-primary-soft', description: 'Background of the icon circle.' },
    { name: '--star-primary', description: 'Color of the icon.' },
    { name: '--star-text-muted', description: 'Color of the message.' },
    { name: '--star-border', description: 'Line above the footer of the dialog.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Escape', description: 'Rejects the question and closes the dialog or the popup.' },
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves between the buttons. The dialog and the popup trap the focus.',
    },
    { name: 'Enter / Space', description: 'Presses the focused button.' },
  ];
}
