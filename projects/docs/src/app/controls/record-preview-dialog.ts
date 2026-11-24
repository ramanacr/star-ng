import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STAR_DIALOG_DATA } from '@star-ng/ui/dialog';

export interface RecordPreviewData {
  readonly description: string;
  readonly resolution: string;
}

/** Content of the header action example: a read-only preview, closed from the header. */
@Component({
  selector: 'docs-record-preview-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-stack">
      <h3>Description</h3>
      <p>{{ data.description }}</p>
      <h3>Resolution</h3>
      <p>{{ data.resolution }}</p>
    </div>
  `,
})
export class RecordPreviewDialog {
  protected readonly data = inject<RecordPreviewData>(STAR_DIALOG_DATA);
}
