import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { StarToast, StarToastMessageTemplate, StarToastService } from '@star-ng/ui/toast';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-toast-page',
  imports: [DOCS, StarButton, StarToast, StarToastMessageTemplate],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Toast"
      lead="A short message that appears at the edge of the window and closes by itself (PrimeNG MessageService with p-toast). Code shows a message with StarToastService. One star-toast in the app shell shows the messages."
      importFrom="import { StarToast, StarToastService } from '@star-ng/ui/toast';"
    >
      <docs-example
        heading="Severities"
        source="toast/severities"
        [script]="severitiesScript"
        note="success, info, warn and error show a message with a summary and a detail text. A message closes after 5 seconds, an error message after 8 seconds. An error has the role alert and the other messages have the role status, so screen readers read them."
      >
        <star-button size="sm" variant="success" (pressed)="notify('success')">Success</star-button>
        <star-button size="sm" variant="secondary" (pressed)="notify('info')">Info</star-button>
        <star-button size="sm" variant="warning" (pressed)="notify('warn')">Warn</star-button>
        <star-button size="sm" variant="danger" (pressed)="notify('error')">Error</star-button>
      </docs-example>

      <docs-example
        heading="Sticky and timed messages"
        source="toast/sticky"
        [script]="stickyScript"
        note="sticky keeps a message until the user closes it. life sets the time in milliseconds. The timer stops while the pointer or the keyboard focus is on the message. clear removes every message."
      >
        <star-button size="sm" variant="secondary" (pressed)="sticky()">Sticky message</star-button>
        <star-button size="sm" variant="secondary" (pressed)="quick()"
          >Two second message</star-button
        >
        <star-button size="sm" variant="ghost" (pressed)="toasts.clear()">Clear all</star-button>
      </docs-example>

      <docs-example
        heading="Duplicate messages"
        source="toast/duplicates"
        [script]="duplicatesScript"
        note="While a message with the same summary, detail, severity and key is visible, a new call with the same texts adds nothing. Set preventDuplicates to false on the service to allow copies."
      >
        <star-button size="sm" variant="secondary" (pressed)="twice()">Save twice</star-button>
      </docs-example>

      <docs-example
        heading="Duplicates per outlet"
        source="toast/outlet-duplicates"
        [script]="outletDuplicatesScript"
        note="preventDuplicates on star-toast (PrimeNG preventDuplicates) ignores a message with the same severity, summary and detail as one that this outlet showed before, also after it closed. preventOpenDuplicates (PrimeNG preventOpenDuplicates) ignores only a copy of a message that is visible now; the service does that for every outlet by default, so this input matters when StarToastService.preventDuplicates is false."
      >
        <star-button size="sm" variant="secondary" (pressed)="remind()">Show reminder</star-button>
        <star-toast position="bottom-end" key="reminder" preventDuplicates />
      </docs-example>

      <docs-example
        heading="Close events and narrow windows"
        source="toast/closed"
        [script]="closedScript"
        note="closed reports each toast of the outlet that closes, with the reason: timeout (the timer ran out), close (the close button, close() of the template, or remove(id)) or clear (clear()). StarToastService.closed reports the same for every outlet. breakpoints (PrimeNG breakpoints) takes max-widths with a style object: below the width, the stack goes full width at the bottom of the window, and the style object applies on top."
      >
        <div class="docs-stack">
          <p class="docs-output" role="status">Last close: {{ lastClose() }}</p>
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="shortNote()">
              Show a 3 second note
            </star-button>
            <star-button size="sm" variant="ghost" (pressed)="toasts.clear('events')">
              Clear notes
            </star-button>
          </div>
        </div>
        <star-toast
          position="top-end"
          key="events"
          [breakpoints]="{ '640px': {} }"
          (closed)="lastClose.set($event.message.summary + ': ' + $event.reason)"
        />
      </docs-example>

      <docs-example
        heading="Corners that follow the direction"
        source="toast/corners"
        [script]="cornersScript"
        note="Each star-toast shows the messages of its own key. position accepts top-left, top-right, bottom-left and bottom-right (the corners of the screen) and top-start, top-end, bottom-start and bottom-end (the corners follow the writing direction: start is the right side in a right-to-left page). top-center and bottom-center are the same in both directions."
      >
        <star-button size="sm" variant="secondary" (pressed)="corner('start')">
          Message at the start
        </star-button>
        <star-button size="sm" variant="secondary" (pressed)="corner('end')">
          Message at the end
        </star-button>
        <star-toast position="bottom-start" key="start" />
        <star-toast position="bottom-end" key="end" />
      </docs-example>

      <docs-example
        heading="Message with an action"
        source="toast/message"
        [script]="messageScript"
        note="starToastMessage replaces the summary and the detail of each toast. The context has the message and close(), which closes that toast. The box, the status or alert role, the severity icon and the close button stay. A button in the template needs an accessible name. A message that closes by itself must not hold the only way to an action, so this example uses sticky, and the page has an Undo archive button too."
      >
        <star-button size="sm" variant="secondary" (pressed)="archive()">Archive order</star-button>
        <star-button size="sm" variant="ghost" (pressed)="undo()">Undo archive</star-button>
        <p class="docs-output" role="status">{{ undoNote() }}</p>
        <star-toast position="bottom-center" key="undo">
          <ng-template starToastMessage let-message let-close="close">
            <p class="star-toast__summary">{{ message.summary }}</p>
            <button
              type="button"
              class="star-btn star-btn--ghost star-btn--sm"
              [attr.aria-label]="'Undo: ' + message.summary"
              (click)="undo(); close()"
            >
              Undo
            </button>
          </ng-template>
        </star-toast>
      </docs-example>

      <h2>Right-to-left</h2>
      <p>
        <code>top-left</code>, <code>top-right</code>, <code>bottom-left</code> and
        <code>bottom-right</code> are physical corners. Use <code>top-start</code>,
        <code>top-end</code>, <code>bottom-start</code> and <code>bottom-end</code> for a corner
        that follows the writing direction. The accent line of a message is on the start side. See
        the Right-to-left guide.
      </p>

      <docs-api
        [of]="['StarToast', 'StarToastMessageTemplate']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />

      <h2>Toast service</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            StarToastService and StarToastOptions
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
        The outlet is a manual native popover, so it stays in the top layer above an open modal
        dialog. It opens again after each change, which moves the stack above a dialog that opened
        later. The outlet has the role <code>region</code> and the name Notifications. A
        <code>star-toast</code> with a <code>key</code> shows only the messages with the same key,
        which allows more than one outlet.
      </p>
    </docs-page>
  `,
})
export class ToastPage {
  protected readonly toasts = inject(StarToastService);

  protected notify(severity: 'success' | 'info' | 'warn' | 'error'): void {
    const copy = {
      success: ['Order sent', 'The customer gets it by email.'],
      info: ['Assigned to you', 'ORD-1051 moved to your queue.'],
      warn: ['Delivery at risk', 'ORD-1047 is due in 2 hours.'],
      error: ['Sync failed', 'The warehouse system did not answer.'],
    }[severity];
    this.toasts[severity](copy[0], copy[1]);
  }

  protected sticky(): void {
    this.toasts.show({
      severity: 'warn',
      summary: 'Stock is low',
      detail: 'This message stays until you close it.',
      sticky: true,
    });
  }

  protected quick(): void {
    this.toasts.show({ severity: 'info', summary: 'Quick note', life: 2000 });
  }

  protected corner(side: 'start' | 'end'): void {
    this.toasts.show({
      severity: 'info',
      summary: `Corner: ${side}`,
      life: 4000,
      key: side,
    });
  }

  protected readonly undoNote = signal('Nothing archived yet.');
  protected readonly lastClose = signal('none');
  private noteCount = 0;

  protected remind(): void {
    this.toasts.show({
      severity: 'info',
      summary: 'Check the open invoices',
      life: 3000,
      key: 'reminder',
    });
  }

  protected shortNote(): void {
    this.noteCount++;
    this.toasts.show({ summary: `Note ${this.noteCount}`, life: 3000, key: 'events' });
  }

  protected archive(): void {
    this.undoNote.set('ORD-1051 archived.');
    this.toasts.show({
      severity: 'info',
      summary: 'ORD-1051 archived',
      sticky: true,
      key: 'undo',
    });
  }

  protected undo(): void {
    this.undoNote.set('Archive undone.');
  }

  protected twice(): void {
    this.toasts.success('Saved');
    this.toasts.success('Saved');
  }

  protected readonly messageScript = `archive(): void {
  this.toasts.show({ severity: 'info', summary: 'ORD-1051 archived', sticky: true, key: 'undo' });
}

undo(): void {
  this.undoNote.set('Archive undone.');
}`;
  protected readonly cornersScript = `corner(side: 'start' | 'end'): void {
  this.toasts.show({ severity: 'info', summary: 'Corner: ' + side, life: 4000, key: side });
}`;
  protected readonly severitiesScript = `private readonly toasts = inject(StarToastService);

notify(severity: 'success' | 'info' | 'warn' | 'error'): void {
  const copy = {
    success: ['Order sent', 'The customer gets it by email.'],
    info: ['Assigned to you', 'ORD-1051 moved to your queue.'],
    warn: ['Delivery at risk', 'ORD-1047 is due in 2 hours.'],
    error: ['Sync failed', 'The warehouse system did not answer.'],
  }[severity];
  this.toasts[severity](copy[0], copy[1]);
}`;
  protected readonly stickyScript = `sticky(): void {
  this.toasts.show({
    severity: 'warn',
    summary: 'Stock is low',
    detail: 'This message stays until you close it.',
    sticky: true,
  });
}

quick(): void {
  this.toasts.show({ severity: 'info', summary: 'Quick note', life: 2000 });
}`;
  protected readonly outletDuplicatesScript = `remind(): void {
  // The second click shows nothing: the outlet showed this reminder before.
  this.toasts.show({
    severity: 'info',
    summary: 'Check the open invoices',
    life: 3000,
    key: 'reminder',
  });
}`;
  protected readonly closedScript = `readonly lastClose = signal('none');
private noteCount = 0;

shortNote(): void {
  this.noteCount++;
  this.toasts.show({ summary: 'Note ' + this.noteCount, life: 3000, key: 'events' });
}`;
  protected readonly duplicatesScript = `twice(): void {
  this.toasts.success('Saved');
  this.toasts.success('Saved'); // ignored: the first message is still visible
}`;

  protected readonly serviceRows: readonly DocsRow[] = [
    {
      name: 'show(options)',
      description:
        'Shows a message and returns its id. options has summary, detail, severity, life, sticky and key. An ignored duplicate returns the id of the visible copy, or 0.',
    },
    {
      name: 'success(summary, detail?), info(...), warn(...), error(...)',
      description: 'Short forms of show. error closes after 8 seconds, the others after 5.',
    },
    { name: 'remove(id)', description: 'Removes one message (close reason close).' },
    {
      name: 'clear(key?)',
      description: 'Removes all messages, or only the messages of one key (close reason clear).',
    },
    {
      name: 'closed',
      description:
        'Observable of every toast that closes: { message, reason } with the reason timeout, close or clear.',
    },
    {
      name: 'pause(id), resume(id)',
      description: 'Stops and starts the close timer of a message.',
    },
    { name: 'messages', description: 'Read-only signal with the messages that are visible now.' },
    {
      name: 'preventDuplicates',
      description: 'true (default): an identical visible message is ignored.',
    },
  ];

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starToastMessage]',
      description:
        'Content child. Replaces the summary and the detail of each toast (PrimeNG #message template). The context has $implicit (the message) and close(). The toast box, its role, the severity icon and the close button stay. Not for the only way to do an action: a message that closes by itself can be gone before the user reaches it.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-success', description: 'Accent of a success message.' },
    { name: '--star-warning', description: 'Accent of a warn message.' },
    { name: '--star-danger', description: 'Accent of an error message.' },
    { name: '--star-accent', description: 'Accent of an info message and the focus ring.' },
    { name: '--star-glass-surface-strong', description: 'Background of a message.' },
    { name: '--star-shadow-lg', description: 'Shadow of a message.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'Moves to the close button of a message, and to the buttons in a starToastMessage template. The close timer stops.',
    },
    { name: 'Enter / Space', description: 'On the close button: removes the message.' },
  ];
}
