import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { StarButton } from 'star-ng/button';
import { STAR_DIALOG_DATA, StarDialogRef } from 'star-ng/dialog';
import { StarField, StarInput } from 'star-ng/field';

export interface EditNoteData {
  readonly orderId: string;
  readonly note: string;
}

/** Content of the dialog service example: edits a note and returns it. */
@Component({
  selector: 'docs-edit-note-dialog',
  imports: [StarField, StarInput, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <star-field label="Internal note" [hint]="'Order ' + data.orderId">
      <textarea
        starInput
        autoResize
        rows="3"
        data-autofocus
        [value]="note()"
        (input)="note.set($any($event.target).value)"
      ></textarea>
    </star-field>
    <div class="star-dialog__footer star-dialog__footer--inline">
      <star-button variant="ghost" (pressed)="ref.close()">Cancel</star-button>
      <star-button [disabled]="!note().trim()" (pressed)="ref.close(note().trim())">
        Save
      </star-button>
    </div>
  `,
})
export class EditNoteDialog {
  protected readonly data = inject<EditNoteData>(STAR_DIALOG_DATA);
  protected readonly ref = inject<StarDialogRef<string>>(StarDialogRef);
  protected readonly note = signal(this.data.note);
}
