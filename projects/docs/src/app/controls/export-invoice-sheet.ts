import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { STAR_BOTTOM_SHEET_DATA, StarBottomSheetRef } from '@star-ng/ui/bottom-sheet';
import { StarButton } from '@star-ng/ui/button';

export interface ExportInvoiceData {
  readonly invoiceId: string;
}

/** Content of the bottom sheet example: picks an export format and returns it. */
@Component({
  selector: 'docs-export-invoice-sheet',
  imports: [StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="docs-stack">
      <h2 class="star-dialog__title">Export invoice {{ data.invoiceId }}</h2>
      <p class="docs-output">Choose a file format.</p>
      <div class="docs-row">
        <star-button variant="secondary" data-autofocus (pressed)="ref.dismiss('PDF')">
          PDF
        </star-button>
        <star-button variant="secondary" (pressed)="ref.dismiss('CSV')">CSV</star-button>
        <star-button variant="ghost" (pressed)="ref.dismiss()">Cancel</star-button>
      </div>
    </div>
  `,
})
export class ExportInvoiceSheet {
  protected readonly data = inject<ExportInvoiceData>(STAR_BOTTOM_SHEET_DATA);
  protected readonly ref = inject<StarBottomSheetRef<string>>(StarBottomSheetRef);
}
