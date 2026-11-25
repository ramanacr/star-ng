import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { StarButton } from '@star-ng/ui/button';
import { STAR_DIALOG_DATA, StarDialogHeaderActions, StarDialogRef } from '@star-ng/ui/dialog';
import { StarField, StarInput } from '@star-ng/ui/field';

export interface SendReportData {
  readonly report: string;
}

/**
 * Content of the header actions example: the Send and Cancel buttons are in the dialog header,
 * from `<ng-template starDialogHeaderActions>`. Send is off until the address is valid and shows
 * a loading state while it sends; the component closes the dialog when it is done.
 */
@Component({
  selector: 'docs-send-report-dialog',
  imports: [StarField, StarInput, StarButton, StarDialogHeaderActions],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-template starDialogHeaderActions>
      <star-button size="sm" [disabled]="!valid()" [loading]="sending()" (pressed)="send()">
        Send
      </star-button>
      <star-button size="sm" variant="secondary" [disabled]="sending()" (pressed)="ref.close()">
        Cancel
      </star-button>
    </ng-template>
    <div class="docs-stack">
      <star-field label="Recipient email" hint="Send turns on when the address is valid.">
        <input
          starInput
          type="email"
          autocomplete="off"
          data-autofocus
          [value]="email()"
          (input)="email.set($any($event.target).value)"
        />
      </star-field>
      <star-field label="Message">
        <textarea
          starInput
          rows="3"
          [value]="message()"
          (input)="message.set($any($event.target).value)"
        ></textarea>
      </star-field>
    </div>
  `,
})
export class SendReportDialog {
  protected readonly data = inject<SendReportData>(STAR_DIALOG_DATA);
  protected readonly ref = inject<StarDialogRef<string>>(StarDialogRef);
  protected readonly email = signal('');
  protected readonly message = signal(`Here is the ${this.data.report}.`);
  protected readonly sending = signal(false);
  protected readonly valid = computed(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim()) && !this.sending(),
  );
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /** Your own logic runs first: here a short wait stands in for the request. */
  protected send(): void {
    if (!this.valid()) return;
    this.sending.set(true);
    this.timer = setTimeout(() => this.ref.close(this.email().trim()), 400);
  }
}
