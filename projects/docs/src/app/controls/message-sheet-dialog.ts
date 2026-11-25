import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { STAR_DIALOG_DATA, StarDialogRef } from '@star-ng/ui/dialog';
import { StarField, StarInput } from '@star-ng/ui/field';

export interface MessageSheetData {
  readonly orderId: string;
  readonly to: string;
}

/**
 * Content of the side sheet example: a message editor that grows with the sheet. The host is a
 * flex column with `flex: 1`, so the text area takes the free height of the sheet body.
 */
@Component({
  selector: 'docs-message-sheet-dialog',
  imports: [StarField, StarInput, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: var(--star-space-4);
    }
    .docs-message-field {
      flex: 1;
    }
    .docs-message-field textarea {
      flex: 1;
      min-height: 8rem;
      resize: none;
    }
  `,
  template: `
    <star-field label="To"><input starInput readonly [value]="data.to" /></star-field>
    <star-field class="docs-message-field" label="Message" [hint]="'Order ' + data.orderId">
      <textarea
        starInput
        data-autofocus
        [value]="message()"
        (input)="message.set($any($event.target).value)"
      ></textarea>
    </star-field>
    <div class="star-dialog__footer star-dialog__footer--inline">
      <star-button variant="ghost" (pressed)="ref.close()">Cancel</star-button>
      <star-button [disabled]="!message().trim()" (pressed)="ref.close(message().trim())">
        Send
      </star-button>
    </div>
  `,
})
export class MessageSheetDialog {
  protected readonly data = inject<MessageSheetData>(STAR_DIALOG_DATA);
  protected readonly ref = inject<StarDialogRef<string>>(StarDialogRef);
  protected readonly message = signal(
    `Hello, your order ${this.data.orderId} leaves the warehouse today.`,
  );
}
