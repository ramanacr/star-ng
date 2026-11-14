import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarToastService } from 'star-ng/toast';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-toast-page',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Toast"
      lead="A short message that appears at the edge of the window and closes by itself (PrimeNG MessageService with p-toast). Code shows a message with StarToastService. One star-toast in the app shell shows the messages."
      importFrom="import { StarToast, StarToastService } from 'star-ng/toast';"
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

      <docs-api [of]="['StarToast']" [slots]="slots" [cssVars]="cssVars" [keyboard]="keyboard" />

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

  protected twice(): void {
    this.toasts.success('Saved');
    this.toasts.success('Saved');
  }

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
  protected readonly duplicatesScript = `twice(): void {
  this.toasts.success('Saved');
  this.toasts.success('Saved'); // ignored: the first message is still visible
}`;

  protected readonly serviceRows: readonly DocsRow[] = [
    {
      name: 'show(options)',
      description:
        'Shows a message and returns its id. options has summary, detail, severity, life, sticky and key.',
    },
    {
      name: 'success(summary, detail?), info(...), warn(...), error(...)',
      description: 'Short forms of show. error closes after 8 seconds, the others after 5.',
    },
    { name: 'remove(id)', description: 'Removes one message.' },
    { name: 'clear(key?)', description: 'Removes all messages, or only the messages of one key.' },
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
    { name: '(none)', description: 'The outlet shows the messages of the service.' },
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
    { name: 'Tab', description: 'Moves to the close button of a message. The close timer stops.' },
    { name: 'Enter / Space', description: 'On the close button: removes the message.' },
  ];
}
