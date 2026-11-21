import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { StarAccordion, StarAccordionContent, StarAccordionPanel } from '@star-ng/ui/accordion';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  selector: 'docs-accordion-page',
  imports: [DOCS, StarAccordion, StarAccordionPanel, StarAccordionContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Accordion"
      lead="A stack of sections. The header of a section is a button that opens or closes its body. The PrimeNG equivalent is p-accordion."
      importFrom="import { StarAccordion, StarAccordionPanel } from '@star-ng/ui/accordion';"
    >
      <docs-example
        heading="One section at a time"
        source="accordion/basic"
        [script]="basicScript"
        note="The value model holds the values of the open sections. Without multiple, opening a section closes the others."
      >
        <div class="docs-stack">
          <star-accordion [(value)]="open">
            <star-accordion-panel value="shipping" header="Shipping" icon="ph-bold ph-truck">
              Orders ship within two working days.
            </star-accordion-panel>
            <star-accordion-panel
              value="returns"
              header="Returns"
              icon="ph-bold ph-arrow-u-up-left"
            >
              Items can be returned for 30 days.
            </star-accordion-panel>
            <star-accordion-panel value="billing" header="Billing" disabled>
              This section is disabled.
            </star-accordion-panel>
          </star-accordion>
          <p class="docs-output" role="status">Open: {{ open().join(', ') || 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Several sections and lazy content"
        source="accordion/multiple"
        note="With multiple, any number of sections can be open. A body inside ng-template starAccordionContent renders when the section opens for the first time."
      >
        <div class="docs-stack">
          <star-accordion multiple [value]="['summary']">
            <star-accordion-panel value="summary" header="Summary">
              Twelve items, one parcel.
            </star-accordion-panel>
            <star-accordion-panel value="history" header="History">
              <ng-template starAccordionContent>
                <p>Created on Monday. Packed on Tuesday.</p>
              </ng-template>
            </star-accordion-panel>
          </star-accordion>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarAccordion', 'StarAccordionPanel', 'StarAccordionContent']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class AccordionPage {
  protected readonly open = signal<readonly string[]>(['shipping']);

  protected readonly basicScript = `readonly open = signal<readonly string[]>(['shipping']);`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'star-accordion-panel ng-template[starHeader]',
      description: 'Content child of a panel. Replaces the title text.',
    },
    {
      name: 'star-accordion-panel ng-template[starIcon="toggle"]',
      description:
        'Content child of a panel. Replaces the arrow; let-expanded is true when it is open. PrimeNG #toggleicon, expandIcon and collapseIcon. The accordion emits opened and closed with the panel value (PrimeNG onOpen and onClose).',
    },
    {
      name: '(default)',
      description: 'Inside star-accordion: the panels. Inside a panel: its body.',
    },
    {
      name: '[starAccordionHeader]',
      description: 'Extra content in the header of a panel, between the title and the caret.',
    },
    {
      name: 'ng-template starAccordionContent',
      description: 'Lazy body of a panel. It renders when the panel first opens.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-surface', description: 'Background of the accordion.' },
    { name: '--star-border', description: 'Outline and the lines between the panels.' },
    { name: '--star-radius-lg', description: 'Corner radius of the accordion.' },
    { name: '--star-duration-base', description: 'Time of the open and close animation.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Enter / Space', description: 'Opens or closes the section of the focused header.' },
    {
      name: 'Arrow Down / Arrow Up',
      description: 'Moves the focus to the next or previous header. It wraps around.',
    },
    { name: 'Home / End', description: 'Moves the focus to the first or last header.' },
  ];
}
