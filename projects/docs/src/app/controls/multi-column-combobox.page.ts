import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, required } from '@angular/forms/signals';
import { StarEmptyTemplate, StarFooterTemplate } from '@star-ng/ui/core';
import { StarField } from '@star-ng/ui/field';
import {
  StarColumnCellTemplate,
  StarComboboxColumn,
  StarMultiColumnCombobox,
} from '@star-ng/ui/multi-column-combobox';
import { DOCS, DocsRow } from '../shared/docs';

interface Product {
  readonly sku: string;
  readonly name: string;
  readonly category: string;
  readonly stock: number;
}

const PRODUCTS: readonly Product[] = [
  { sku: 'P-1001', name: 'Desk lamp', category: 'Lighting', stock: 42 },
  { sku: 'P-1002', name: 'Floor lamp', category: 'Lighting', stock: 0 },
  { sku: 'P-1003', name: 'Office chair', category: 'Seating', stock: 12 },
  { sku: 'P-1004', name: 'Stool', category: 'Seating', stock: 30 },
  { sku: 'P-1005', name: 'Standing desk', category: 'Desks', stock: 5 },
  { sku: 'P-1006', name: 'Corner desk', category: 'Desks', stock: 8 },
  { sku: 'P-1007', name: 'Bookshelf', category: 'Storage', stock: 17 },
  { sku: 'P-1008', name: 'Filing cabinet', category: 'Storage', stock: 3 },
];

interface Part {
  readonly id: number;
  readonly code: string;
  readonly description: string;
  readonly bin: string;
}

@Component({
  selector: 'docs-multi-column-combobox-page-content',
  imports: [
    DOCS,
    FormField,
    StarColumnCellTemplate,
    StarEmptyTemplate,
    StarField,
    StarFooterTemplate,
    StarMultiColumnCombobox,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .stock-out {
      color: var(--star-danger);
    }
  `,
  template: `
    <docs-page
      heading="Multi-column combobox"
      lead="A combobox whose list shows several columns under a header row. Typing filters the rows over every column. The Kendo UI equivalent is MultiColumnComboBox; Ignite UI builds it from igx-combo with an item template."
      importFrom="import { StarMultiColumnCombobox } from '@star-ng/ui/multi-column-combobox';"
    >
      <docs-example
        heading="Products in columns"
        source="multi-column-combobox/basic"
        [script]="basicScript"
        note="Type to filter: the text searches the SKU, the name and the category, without case or accents. Alt+Arrow down opens the list. The field shows the optionLabel of the chosen row; the value is its optionValue."
      >
        <div class="docs-stack">
          <star-multi-column-combobox
            [options]="products"
            [columns]="columns"
            optionLabel="name"
            optionValue="sku"
            [(value)]="sku"
            placeholder="Find a product"
            ariaLabel="Product"
            showClear
          />
          <p class="docs-output" role="status">Value: {{ sku() ?? 'none' }}</p>
        </div>
      </docs-example>

      <docs-example
        heading="Cell template and filter fields"
        source="multi-column-combobox/templates"
        note="ng-template starColumnCell renders every cell (context: the row, column and index). filterFields limits the search to the name; filterMatchMode is startsWith. A footer slot sits under the list."
      >
        <star-multi-column-combobox
          [options]="products"
          [columns]="columns"
          optionLabel="name"
          optionValue="sku"
          [filterFields]="['name']"
          filterMatchMode="startsWith"
          ariaLabel="Product by name"
          placeholder="Name starts with…"
        >
          <ng-template starColumnCell let-row let-column="column">
            @if ($any(column).field === 'stock') {
              <span [class.stock-out]="$any(row).stock === 0">
                {{ $any(row).stock === 0 ? 'Out of stock' : $any(row).stock + ' left' }}
              </span>
            } @else {
              {{ $any(row)[$any(column).field] }}
            }
          </ng-template>
          <ng-template starEmpty let-query>No product name starts with “{{ query }}”.</ng-template>
          <ng-template starFooter> {{ products.length }} products </ng-template>
        </star-multi-column-combobox>
      </docs-example>

      <docs-example
        heading="Large data with virtual scroll"
        source="multi-column-combobox/virtual"
        note="virtualScroll renders only the rows in view, so 5,000 rows stay fast. Page up and Page down move by a page of rows."
      >
        <star-multi-column-combobox
          [options]="parts"
          [columns]="partColumns"
          optionLabel="code"
          optionValue="id"
          virtualScroll
          [virtualItemSize]="40"
          ariaLabel="Part"
          placeholder="Part code or description"
        />
      </docs-example>

      <docs-example
        heading="In a form, required"
        source="multi-column-combobox/form"
        note="Signal Forms through [formField]; Reactive Forms through SignalFormControl, like the other fields."
      >
        <div class="docs-stack">
          <star-field label="Product" [state]="f.product()">
            <star-multi-column-combobox
              [formField]="f.product"
              [options]="products"
              [columns]="columns"
              optionLabel="name"
              optionValue="sku"
            />
          </star-field>
          <p class="docs-output" role="status">Valid: {{ f.product().valid() ? 'yes' : 'no' }}</p>
        </div>
      </docs-example>

      <docs-api
        [of]="['StarMultiColumnCombobox']"
        [slots]="slots"
        [cssVars]="cssVars"
        [keyboard]="keyboard"
      />
    </docs-page>
  `,
})
export class MultiColumnComboboxPageContent {
  protected readonly products = PRODUCTS;
  protected readonly columns: readonly StarComboboxColumn<Product>[] = [
    { field: 'sku', header: 'SKU', width: '5.5rem' },
    { field: 'name', header: 'Name' },
    { field: 'category', header: 'Category', width: '6.5rem' },
    { field: 'stock', header: 'Stock', width: '6.5rem' },
  ];
  protected readonly sku = signal<string | null>(null);

  protected readonly parts: readonly Part[] = Array.from({ length: 5000 }, (_, i) => ({
    id: i + 1,
    code: `PT-${String(i + 1).padStart(5, '0')}`,
    description: ['Bolt', 'Nut', 'Washer', 'Bracket', 'Hinge'][i % 5] + ` size ${(i % 12) + 1}`,
    bin: `B${(i % 40) + 1}`,
  }));
  protected readonly partColumns: readonly StarComboboxColumn<Part>[] = [
    { field: 'code', header: 'Code', width: '6.5rem' },
    { field: 'description', header: 'Description' },
    { field: 'bin', header: 'Bin', width: '3.5rem' },
  ];

  protected readonly model = signal<{ product: string | null }>({ product: null });
  protected readonly f = form(this.model, (p) => {
    required(p.product, { message: 'Choose a product.' });
  });

  protected readonly basicScript = `readonly sku = signal<string | null>(null);
readonly columns: readonly StarComboboxColumn<Product>[] = [
  { field: 'sku', header: 'SKU', width: '5.5rem' },
  { field: 'name', header: 'Name' },
  { field: 'category', header: 'Category', width: '6.5rem' },
  { field: 'stock', header: 'Stock', width: '6.5rem' },
];`;

  protected readonly slots: readonly DocsRow[] = [
    {
      name: 'ng-template[starColumnCell]',
      description:
        'Content of each cell. Context: the row ($implicit and row), column and index. No focusable elements.',
    },
    {
      name: 'ng-template[starEmpty]',
      description: 'Shown when no row matches. Context: the text.',
    },
    {
      name: 'ng-template[starLoading]',
      description: 'Shown above the rows while loading is true.',
    },
    { name: 'ng-template[starHeader]', description: 'Content above the column header row.' },
    { name: 'ng-template[starFooter]', description: 'Content under the list.' },
  ];
  protected readonly cssVars: readonly DocsRow[] = [
    {
      name: '--star-mcc-columns',
      description: 'Grid columns of the header and the rows. Set from the column widths.',
    },
    { name: '--star-surface-muted', description: 'Background of the header row.' },
    { name: '--star-border', description: 'Line under the header row.' },
  ];
  protected readonly keyboard: readonly DocsRow[] = [
    { name: 'Alt+Arrow down / Arrow down', description: 'Opens the list.' },
    { name: 'Arrow down / Arrow up', description: 'Moves to the next or previous row.' },
    { name: 'Home / End', description: 'While the list is open: first or last row.' },
    { name: 'Page down / Page up', description: 'While the list is open: moves by a page.' },
    { name: 'Enter', description: 'Chooses the active row and closes the list.' },
    { name: 'Alt+Arrow up', description: 'Chooses the active row and closes the list.' },
    { name: 'Escape', description: 'Closes the list.' },
  ];
}

/**
 * Route component of the page. It loads the route styles (`multi-column-combobox.page.scss`): the library
 * partials of the page and the docs layout. The page content is a child, so its own component
 * styles come after them, as they came after the global styles.
 */
@Component({
  selector: 'docs-multi-column-combobox-page',
  imports: [MultiColumnComboboxPageContent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './multi-column-combobox.page.scss',
  template: '<docs-multi-column-combobox-page-content />',
})
export class MultiColumnComboboxPage {}
