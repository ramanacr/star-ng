import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import {
  StarDescriptionEntry,
  StarDescriptionItem,
  StarDescriptionList,
} from '@star-ng/ui/description-list';
import { StarIcon } from '@star-ng/ui/icon';
import { StarTag } from '@star-ng/ui/tag';
import { DOCS, DocsRow } from '../shared/docs';

@Component({
  encapsulation: ViewEncapsulation.None,
  styleUrl: './description-list.page.scss',
  selector: 'docs-description-list-page',
  imports: [DOCS, StarDescriptionList, StarDescriptionItem, StarIcon, StarTag],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <docs-page
      heading="Description list"
      lead="Read-only label and value pairs, for example in a record preview panel or the details of an order. It renders dl, dt and dd elements, so screen readers announce each label with its value. PrimeNG has no description list control."
      importFrom="import { StarDescriptionList, StarDescriptionItem } from '@star-ng/ui/description-list';"
    >
      <docs-example
        heading="Label and value pairs"
        source="description-list/stacked"
        [script]="orderScript"
        note="items takes label, value and an optional hint. The default stacked layout puts the label above the value. An empty value shows a dash; screen readers read No value."
      >
        <div class="docs-stack">
          <star-description-list [items]="order" />
        </div>
      </docs-example>

      <docs-example
        heading="Inline layout and sizes"
        source="description-list/inline"
        note="inline puts the label and the value in one row. The labels have a fixed width: the token, or the labelWidth input. size sm has smaller text and gaps."
      >
        <div class="docs-stack">
          <star-description-list layout="inline" [items]="order" />
          <star-description-list layout="inline" size="sm" labelWidth="7rem" [items]="order" />
        </div>
      </docs-example>

      <docs-example
        heading="Columns"
        source="description-list/columns"
        note="columns lets the pairs flow into columns, top to bottom. A column is at least 12rem wide, so a narrow screen shows fewer columns."
      >
        <div class="docs-stack">
          <star-description-list layout="columns" [columns]="3" [items]="shipment" />
        </div>
      </docs-example>

      <docs-example
        heading="Content as the value"
        source="description-list/content"
        note="A star-description-item has the label input and takes its value as content: tags, links or icons. A hint goes under the value. Items of the items input come first."
      >
        <div class="docs-stack">
          <star-description-list layout="inline">
            <star-description-item label="Status" hint="Set by the warehouse">
              <star-tag severity="success" value="Shipped" />
            </star-description-item>
            <star-description-item label="Contact">
              <a href="mailto:orders@example.com">orders&#64;example.com</a>
            </star-description-item>
            <star-description-item label="Priority">
              <star-icon name="flag" weight="fill" />
              High
            </star-description-item>
            <star-description-item label="Note" />
          </star-description-list>
        </div>
      </docs-example>

      <docs-example
        heading="Long values"
        source="description-list/truncate"
        note="Long values wrap. With truncate each value stays on one line; a value that is cut shows its full text in a tooltip on hover and keyboard focus. placeholder sets the text of an empty value."
      >
        <div class="docs-stack">
          <star-description-list layout="inline" [items]="address" />
          <star-description-list layout="inline" truncate placeholder="Not set" [items]="address" />
        </div>
      </docs-example>

      <docs-api
        [of]="['StarDescriptionList', 'StarDescriptionItem']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class DescriptionListPage {
  protected readonly order: StarDescriptionEntry[] = [
    { label: 'Organization', value: 'Example Trading' },
    { label: 'Site', value: 'Site 01', hint: 'Main warehouse' },
    { label: 'Received', value: '24-Aug-2026 12:58' },
    { label: 'Pending reason', value: null },
  ];

  protected readonly shipment: StarDescriptionEntry[] = [
    { label: 'Order', value: 'SO-1042' },
    { label: 'Customer', value: 'Example Trading' },
    { label: 'City', value: 'Lyon' },
    { label: 'Carrier', value: 'Rail freight' },
    { label: 'Packages', value: 4 },
    { label: 'Weight', value: '38 kg' },
    { label: 'Shipped', value: '25-Aug-2026' },
    { label: 'Delivered', value: null },
    { label: 'Invoice', value: 'INV-2207' },
  ];

  protected readonly address: StarDescriptionEntry[] = [
    {
      label: 'Delivery address',
      value: 'Unit 4, North Industrial Park, 1200 Harbor Road, Example City',
    },
    { label: 'Reference', value: 'PO-77812-NORTH-PARK-REPLENISHMENT-WEEK-35' },
    { label: 'Gate', value: '' },
  ];

  protected readonly orderScript = `readonly order: StarDescriptionEntry[] = [
  { label: 'Organization', value: 'Example Trading' },
  { label: 'Site', value: 'Site 01', hint: 'Main warehouse' },
  { label: 'Received', value: '24-Aug-2026 12:58' },
  { label: 'Pending reason', value: null },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'star-description-item',
      description:
        'Content child of the list: one pair. Its label input is the label; its content is the value.',
    },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    { name: '--star-description-list-label-color', description: 'Color of the labels.' },
    { name: '--star-description-list-label-weight', description: 'Font weight of the labels.' },
    { name: '--star-description-list-value-color', description: 'Color of the values.' },
    { name: '--star-description-list-gap', description: 'Space between the pairs.' },
    {
      name: '--star-description-list-label-width',
      description: 'Width of the labels in the inline layout (default 10rem).',
    },
    {
      name: '--star-description-list-columns',
      description: 'Number of columns of the columns layout. Set by the columns input.',
    },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    {
      name: 'Tab',
      description:
        'With truncate: moves to each value that is cut and shows its full text in a tooltip.',
    },
    { name: 'Escape', description: 'Hides the tooltip.' },
  ];
}
