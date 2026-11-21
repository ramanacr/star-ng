import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  ViewEncapsulation,
} from '@angular/core';
import { StarBottomSheet, StarBottomSheetContext } from '@star-ng/ui/bottom-sheet';
import { StarButton } from '@star-ng/ui/button';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './bottom-sheet-container.page.scss',
  selector: 'docs-bottom-sheet-container-page',
  imports: [DOCS, StarButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Bottom sheet container"
      lead="The element that holds one open bottom sheet: star-bottom-sheet-container, with a native dialog element inside. StarBottomSheet creates it at the end of the body and removes it after the close. You do not put it in a template: the config of open() sets its inputs. This page shows the options that change the container."
      importFrom="import { StarBottomSheet, StarBottomSheetConfig } from '@star-ng/ui/bottom-sheet';"
    >
      <docs-example
        heading="Non-modal sheet"
        source="bottom-sheet-container/non-modal"
        [script]="nonModalScript"
        note="hasBackdrop false opens the dialog element without showModal: there is no backdrop and the page stays usable. Escape and the Close button still close the sheet."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="openFilters(filters)">
              Show filters
            </star-button>
          </div>
          <p class="docs-output" role="status">Filter: {{ filter() }}</p>
        </div>
        <ng-template #filters let-ref="ref">
          <div class="docs-stack">
            <h2 class="star-dialog__title">Order filters</h2>
            <div class="docs-row">
              <star-button variant="secondary" (pressed)="ref.dismiss('Open orders')">
                Open orders
              </star-button>
              <star-button variant="secondary" (pressed)="ref.dismiss('Shipped orders')">
                Shipped orders
              </star-button>
              <star-button variant="ghost" (pressed)="ref.dismiss()">Close</star-button>
            </div>
          </div>
        </ng-template>
      </docs-example>

      <docs-example
        heading="Height and extra classes"
        source="bottom-sheet-container/height"
        [script]="heightScript"
        note="maxHeight sets the CSS max-height of the dialog element, and the body scrolls. panelClass adds classes to the dialog element, for your own styles. ariaLabel names the dialog."
      >
        <div class="docs-stack">
          <div class="docs-row">
            <star-button variant="secondary" (pressed)="openCities(cities)">
              Choose a city
            </star-button>
          </div>
          <p class="docs-output" role="status">City: {{ city() }}</p>
        </div>
        <ng-template #cities let-data let-ref="ref">
          <div class="docs-stack">
            <h2 class="star-dialog__title">Cities</h2>
            @for (name of data; track name) {
              <star-button variant="ghost" (pressed)="ref.dismiss(name)">{{ name }}</star-button>
            }
          </div>
        </ng-template>
      </docs-example>

      <docs-api [of]="['StarBottomSheetContainer']" [cssVars]="cssVars" />

      <h2>Technical notes</h2>
      <p>
        The container renders a <code>dialog</code> element with the class
        <code>star-bottom-sheet</code>, a decorative handle and the content (a component or a
        template). A modal sheet opens with <code>showModal()</code>, so the browser puts it in the
        top layer and makes the page inert. A non-modal sheet has the <code>z-index</code> of
        <code>--star-z-index-base</code> minus one, below the overlay container, so a menu that
        opens from the sheet stays on top. The inputs of the container are set by StarBottomSheet;
        treat them as internal. Material <code>MatBottomSheetContainer</code> is the equivalent.
      </p>
    </docs-page>
  `,
})
export class BottomSheetContainerPage {
  private readonly sheet = inject(StarBottomSheet);

  constructor() {
    // The service puts its overlays in the body, outside the page: close them when the page
    // goes, as its route styles go with it.
    inject(DestroyRef).onDestroy(() => this.sheet.dismiss());
  }

  protected readonly filter = signal('none');
  protected readonly city = signal('none');

  protected async openFilters(
    template: TemplateRef<StarBottomSheetContext<undefined, string>>,
  ): Promise<void> {
    const ref = this.sheet.open(template, { hasBackdrop: false, ariaLabel: 'Order filters' });
    this.filter.set((await ref.afterDismissed()) ?? 'none');
  }

  protected async openCities(
    template: TemplateRef<StarBottomSheetContext<readonly string[], string>>,
  ): Promise<void> {
    const ref = this.sheet.open(template, {
      data: ['Lisbon', 'Madrid', 'Paris', 'Berlin', 'Vienna', 'Prague', 'Oslo', 'Dublin'],
      ariaLabel: 'Cities',
      maxHeight: '45dvh',
      panelClass: 'docs-city-sheet',
    });
    this.city.set((await ref.afterDismissed()) ?? 'none');
  }

  protected readonly nonModalScript = `private readonly sheet = inject(StarBottomSheet);
readonly filter = signal('none');

async openFilters(template: TemplateRef<StarBottomSheetContext<undefined, string>>) {
  const ref = this.sheet.open(template, { hasBackdrop: false, ariaLabel: 'Order filters' });
  this.filter.set((await ref.afterDismissed()) ?? 'none');
}`;

  protected readonly heightScript = `async openCities(template: TemplateRef<StarBottomSheetContext<readonly string[], string>>) {
  const ref = this.sheet.open(template, {
    data: ['Lisbon', 'Madrid', 'Paris', 'Berlin', 'Vienna', 'Prague', 'Oslo', 'Dublin'],
    ariaLabel: 'Cities',
    maxHeight: '45dvh',
    panelClass: 'docs-city-sheet',
  });
  this.city.set((await ref.afterDismissed()) ?? 'none');
}`;

  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-bottom-sheet-max-width', description: 'Largest width of the sheet.' },
    {
      name: '--star-z-index-base',
      description:
        'Base z-index of the overlay container (provideStarNg overlay.zIndexBase). A non-modal sheet stays one below it.',
    },
    { name: '--star-scrim-modal', description: 'Color of the backdrop of a modal sheet.' },
  ];
}
