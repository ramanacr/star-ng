import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import {
  StarActionSheetItem,
  StarBottomSheet,
  StarBottomSheetContext,
} from '@star-ng/ui/bottom-sheet';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';
import { ExportInvoiceData, ExportInvoiceSheet } from './export-invoice-sheet';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './bottom-sheet.page.scss',
  selector: 'docs-bottom-sheet-page',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Bottom sheet"
      lead="A panel that slides up from the bottom edge of the window, for a short choice or a few actions. StarBottomSheet opens a component or a template in a native dialog element, so the browser gives the top layer, the inert page and Escape. The focus returns to the button that opened it."
      importFrom="import { StarBottomSheet } from '@star-ng/ui/bottom-sheet';"
    >
      <docs-example
        heading="Sheet from a component"
        source="bottom-sheet/component"
        [script]="componentScript"
        note="open shows a component. The data goes in with config.data and the component injects it with STAR_BOTTOM_SHEET_DATA. The component closes the sheet with the injected StarBottomSheetRef, and the result comes out of ref.afterDismissed(). Escape and a click on the backdrop give undefined."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button leadingIcon="ph-bold ph-export" (pressed)="exportInvoice()">
              Export invoice
            </star-button>
          </div>
          <p class="docs-output" role="status">Export format: {{ format() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Action sheet"
        source="bottom-sheet/actions"
        [script]="actionsScript"
        note="openActions shows a list of actions and resolves with the chosen one, or undefined for Cancel. An action has a label, and optionally an icon, danger, disabled and a value."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button
              variant="secondary"
              leadingIcon="ph-bold ph-dots-three"
              (pressed)="orderActions()"
            >
              Order actions
            </star-button>
          </div>
          <p class="docs-output" role="status">Action: {{ action() }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Template and options"
        source="bottom-sheet/template"
        [script]="templateScript"
        note="open also takes a template: let-data gives config.data and let-ref the ref. maxHeight limits the height, and the body scrolls. closeOnBackdrop false keeps the sheet open on a backdrop click; Escape still closes it."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="showProjects(projects)">
              Pick a project
            </star-button>
          </div>
          <p class="docs-output" role="status">Project: {{ project() }}</p>
        </div>
        <ng-template #projects let-data let-ref="ref">
          <div class="docs-stack">
            <h2 class="star-dialog__title">Projects</h2>
            @for (name of data; track name) {
              <star-button variant="ghost" (pressed)="ref.dismiss(name)">{{ name }}</star-button>
            }
          </div>
        </ng-template>
      </docs-example>

      <docs-api [of]="['StarActionSheet']" [cssVars]="cssVars" [keyboard]="keyboard" />

      <h2>Bottom sheet service</h2>
      <div class="docs-table-wrap">
        <table class="docs-table">
          <caption>
            StarBottomSheet, StarBottomSheetConfig and StarBottomSheetRef
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
        The sheet is a <code>dialog</code> element pinned to the bottom edge. It fills the width of
        the window up to <code>--star-bottom-sheet-max-width</code>, and the bottom padding adds
        <code>env(safe-area-inset-bottom)</code> for phones with a home bar. The handle at the top
        is decorative and hidden from screen readers. The sheet slides up with a
        <code>&#64;starting-style</code> transition; a user who prefers reduced motion gets none.
      </p>
      <p>
        A modal sheet (the default) makes the rest of the page inert and keeps Tab inside. With
        <code>hasBackdrop: false</code> the sheet is not modal: there is no backdrop, the page stays
        usable, and Escape still closes the sheet. One sheet is open at a time: opening a new one
        dismisses the current one.
      </p>
    </docs-page>
  `,
})
export class BottomSheetPage {
  private readonly sheet = inject(StarBottomSheet);

  constructor() {
    // The service puts its overlays in the body, outside the page: close them when the page
    // goes, as its route styles go with it.
    inject(DestroyRef).onDestroy(() => this.sheet.dismiss());
  }

  protected readonly format = signal('none');
  protected readonly action = signal('none');
  protected readonly project = signal('none');

  protected async exportInvoice(): Promise<void> {
    const ref = this.sheet.open<ExportInvoiceSheet, ExportInvoiceData, string>(ExportInvoiceSheet, {
      data: { invoiceId: 'INV-2041' },
      ariaLabel: 'Export invoice INV-2041',
    });
    this.format.set((await ref.afterDismissed()) ?? 'cancelled');
  }

  protected async orderActions(): Promise<void> {
    const actions: StarActionSheetItem<string>[] = [
      { label: 'Share order', icon: 'ph-bold ph-share-network', value: 'share' },
      { label: 'Duplicate order', icon: 'ph-bold ph-copy', value: 'duplicate' },
      { label: 'Print label', icon: 'ph-bold ph-printer', disabled: true },
      { label: 'Cancel order', icon: 'ph-bold ph-x-circle', danger: true, value: 'cancel' },
    ];
    const ref = this.sheet.openActions(actions, { ariaLabel: 'Order ORD-1042 actions' });
    const chosen = await ref.afterDismissed();
    this.action.set(chosen?.value ?? 'none');
  }

  protected async showProjects(
    template: TemplateRef<StarBottomSheetContext<readonly string[], string>>,
  ): Promise<void> {
    const ref = this.sheet.open(template, {
      data: ['Harbor bridge', 'City library', 'North depot', 'Riverside park'],
      ariaLabel: 'Projects',
      maxHeight: '60dvh',
      closeOnBackdrop: false,
    });
    this.project.set((await ref.afterDismissed()) ?? 'none');
  }

  protected readonly componentScript = `private readonly sheet = inject(StarBottomSheet);
readonly format = signal('none');

async exportInvoice(): Promise<void> {
  const ref = this.sheet.open<ExportInvoiceSheet, ExportInvoiceData, string>(
    ExportInvoiceSheet,
    { data: { invoiceId: 'INV-2041' }, ariaLabel: 'Export invoice INV-2041' },
  );
  this.format.set((await ref.afterDismissed()) ?? 'cancelled');
}

// The component that the sheet shows:
@Component({
  selector: 'docs-export-invoice-sheet',
  imports: [StarButton],
  template: \`
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
  \`,
})
export class ExportInvoiceSheet {
  protected readonly data = inject<ExportInvoiceData>(STAR_BOTTOM_SHEET_DATA);
  protected readonly ref = inject<StarBottomSheetRef<string>>(StarBottomSheetRef);
}`;

  protected readonly actionsScript = `readonly action = signal('none');

async orderActions(): Promise<void> {
  const actions: StarActionSheetItem<string>[] = [
    { label: 'Share order', icon: 'ph-bold ph-share-network', value: 'share' },
    { label: 'Duplicate order', icon: 'ph-bold ph-copy', value: 'duplicate' },
    { label: 'Print label', icon: 'ph-bold ph-printer', disabled: true },
    { label: 'Cancel order', icon: 'ph-bold ph-x-circle', danger: true, value: 'cancel' },
  ];
  const ref = this.sheet.openActions(actions, { ariaLabel: 'Order ORD-1042 actions' });
  const chosen = await ref.afterDismissed();
  this.action.set(chosen?.value ?? 'none');
}`;

  protected readonly templateScript = `readonly project = signal('none');

async showProjects(
  template: TemplateRef<StarBottomSheetContext<readonly string[], string>>,
): Promise<void> {
  const ref = this.sheet.open(template, {
    data: ['Harbor bridge', 'City library', 'North depot', 'Riverside park'],
    ariaLabel: 'Projects',
    maxHeight: '60dvh',
    closeOnBackdrop: false,
  });
  this.project.set((await ref.afterDismissed()) ?? 'none');
}`;

  protected readonly serviceRows: readonly DocsRow[] = [
    {
      name: 'open(content, config?, injector?)',
      description:
        'Opens a component or a template and returns a StarBottomSheetRef. A component injects STAR_BOTTOM_SHEET_DATA and StarBottomSheetRef; a template gets let-data and let-ref="ref".',
    },
    {
      name: 'openActions(actions, config?)',
      description:
        'Opens star-action-sheet with the actions. The ref resolves with the chosen action, or undefined.',
    },
    { name: 'dismiss()', description: 'Closes the open sheet, if there is one.' },
    { name: 'config.data', description: 'Value for STAR_BOTTOM_SHEET_DATA and let-data.' },
    {
      name: 'config.ariaLabel',
      description: 'Accessible name of the sheet. Default: the bottomSheet UI text.',
    },
    {
      name: 'config.hasBackdrop',
      description:
        'Default true: modal, with a backdrop. false opens a non-modal sheet and the page stays usable.',
    },
    { name: 'config.closeOnBackdrop', description: 'Default true. A backdrop click closes.' },
    { name: 'config.closeOnEscape', description: 'Default true. Escape closes.' },
    { name: 'config.panelClass', description: 'Extra CSS classes on the sheet element.' },
    { name: 'config.maxHeight', description: 'CSS max-height of the sheet, for example 50dvh.' },
    {
      name: 'ref.dismiss(result?)',
      description: 'Closes the sheet with a result. Inside the sheet, inject the ref to call it.',
    },
    {
      name: 'ref.afterDismissed(), ref.closed',
      description:
        'A promise of the result. It is undefined after Escape, a backdrop click or dismiss() without a value.',
    },
  ];

  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-bottom-sheet-max-width',
      description: 'Largest width of the sheet. Default 40rem; a narrower window fills the width.',
    },
    { name: '--star-surface', description: 'Background of the sheet.' },
    { name: '--star-scrim-modal', description: 'Color of the backdrop.' },
    { name: '--star-border-strong', description: 'Color of the handle.' },
    { name: '--star-danger', description: 'Text color of a danger action.' },
  ];

  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Escape', description: 'Closes the sheet. The result is undefined.' },
    {
      name: 'Tab / Shift+Tab',
      description: 'Moves between the controls of the sheet. A modal sheet keeps the focus inside.',
    },
    { name: 'Enter / Space', description: 'Presses the focused action.' },
  ];
}
