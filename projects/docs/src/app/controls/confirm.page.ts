import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarConfirmService } from 'star-ng/dialog';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-confirm-page',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Confirm"
      lead="A question that the user answers with accept or reject. StarConfirmService.ask returns a promise: true for accept, false for reject, Escape, the close button or a click outside. One star-confirm-host in the app shell shows the question."
      importFrom="import { StarConfirmHost, StarConfirmService } from 'star-ng/dialog';"
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
        through the header. The popup is a <code>star-popover</code>, so it stays above an open
        modal dialog.
      </p>
    </docs-page>
  `,
})
export class ConfirmPage {
  private readonly confirm = inject(StarConfirmService);

  protected readonly result = signal('none');
  protected readonly popupResult = signal('none');

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

  protected readonly serviceRows: readonly DocsRow[] = [
    {
      name: 'ask(options)',
      description:
        'Queues a question and returns a promise of a boolean: true for accept, false for reject or dismiss.',
    },
    {
      name: 'options.header, options.message',
      description: 'The title and the text of the question.',
    },
    { name: 'options.icon', description: 'Phosphor icon class shown next to the message.' },
    {
      name: 'options.acceptLabel, options.rejectLabel',
      description: 'Button texts. The defaults come from the star-ng text provider.',
    },
    {
      name: 'options.acceptVariant',
      description: 'Button variant of the accept button. Use danger for a delete.',
    },
    { name: 'options.rejectVisible', description: 'false hides the reject button.' },
    {
      name: 'options.defaultFocus',
      description: 'accept or reject (default). The button that gets the first focus.',
    },
    {
      name: 'options.target',
      description: 'An element. Shows a popup next to it instead of a dialog.',
    },
    { name: 'settle(accepted)', description: 'Resolves the visible request. The host calls it.' },
  ];

  protected readonly slots: readonly DocsRow[] = [
    { name: '(none)', description: 'The host takes everything from the ask options.' },
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
      description: 'Moves between the buttons. A dialog traps the focus.',
    },
    { name: 'Enter / Space', description: 'Presses the focused button.' },
  ];
}
