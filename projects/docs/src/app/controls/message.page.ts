import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { StarMessage } from 'star-ng/message';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-message-page',
  imports: [DOCS, StarMessage, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Message"
      lead="An inline message that stays in the page flow. It has a severity, an icon, an optional close button and an optional time limit. The PrimeNG equivalent is p-message."
      importFrom="import { StarMessage } from 'star-ng/message';"
    >
      <docs-example
        heading="Severities"
        source="message/severities"
        note="An error message has role alert. The other severities have role status."
      >
        <div class="docs-stack">
          <star-message>Your changes are saved as a draft.</star-message>
          <star-message severity="success">The invoice was sent.</star-message>
          <star-message severity="warn">The card expires next month.</star-message>
          <star-message severity="error">The payment was declined.</star-message>
        </div>
      </docs-example>

      <docs-example heading="Outlined" source="message/outlined">
        <div class="docs-stack">
          <star-message variant="outlined" severity="info">Orders close at 17:00.</star-message>
          <star-message variant="outlined" severity="warn"
            >Two items are low in stock.</star-message
          >
        </div>
      </docs-example>

      <docs-example
        heading="Closable"
        source="message/closable"
        [script]="closableScript"
        note="The close button hides the message and emits closed. Add the life input (milliseconds) to hide a message by itself."
      >
        <div class="docs-stack">
          @if (!gone()) {
            <star-message severity="warn" closable (closed)="closedCount.set(closedCount() + 1)">
              Draft not saved.
            </star-message>
          }
          <p class="docs-output" role="status">Closed: {{ closedCount() }}</p>
          <div class="docs-row">
            <star-button size="sm" variant="secondary" (pressed)="reset()">Show again</star-button>
          </div>
        </div>
      </docs-example>

      <docs-api [of]="['StarMessage']" [slots]="slots" [cssVars]="cssVars" />
    </docs-page>
  `,
})
export class MessagePage {
  protected readonly gone = signal(false);
  protected readonly closedCount = signal(0);

  protected reset(): void {
    // A new element is needed: the message hides itself and keeps its state.
    this.gone.set(true);
    setTimeout(() => this.gone.set(false));
  }

  protected readonly closableScript = `readonly gone = signal(false);
readonly closedCount = signal(0);

reset(): void {
  this.gone.set(true);
  setTimeout(() => this.gone.set(false));
}`;

  protected readonly slots: readonly DocsRow[] = [
    { name: '(default)', description: 'The text of the message.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-tone', description: 'Color of the icon and the outline. Set by the severity.' },
    { name: '--star-tone-soft', description: 'Fill of the message. Set by the severity.' },
    { name: '--star-radius-md', description: 'Corner radius.' },
  ];
}
