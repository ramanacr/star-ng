import { expect, Locator, Page, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { collectErrors, example, openPage as openDocsPage } from './support';

/**
 * Opens a docs page and waits until the page is hydrated. The page is prerendered, so it is
 * visible before the application runs, and a key or a click before hydration is lost. A hydrated
 * component loses its `ngh` attribute.
 */
async function openPage(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await openDocsPage(page, path, heading);
  await expect(page.locator('[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

/** The rows of a table body (not group, spacer, expansion or empty rows). */
const bodyRows = (table: Locator) => table.locator('tbody tr.star-table__row');

/** Text of one column of the visible body rows. */
const column = (table: Locator, index: number) =>
  table.locator(`tbody tr.star-table__row:not([hidden]) td:nth-child(${index})`);

/** Reads the whole body of a download as a Buffer. */
async function readDownload(download: import('@playwright/test').Download): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

/** `$1,234.50` as a number. */
const money = (text: string | null) => Number((text ?? '').replace(/[^0-9.-]/g, ''));

test.describe('table: basics', () => {
  test('renders columns, rows, a paginator and pages forward', async ({ page }) => {
    await openPage(page, '/controls/table', 'Table');
    const live = example(page, 'Columns and rows');
    const table = live.getByRole('table', { name: 'Orders' });
    await expect(table.getByRole('columnheader')).toHaveText([
      'Order',
      'Customer',
      'Product',
      'Status',
      'Total',
    ]);
    await expect(bodyRows(table)).toHaveCount(5);
    await expect(column(table, 1).first()).toHaveText('ORD-1001');

    // The report of the paginator is a polite live region.
    const report = live.locator('.star-paginator__report');
    await expect(report).toHaveAttribute('aria-live', 'polite');
    await expect(report).toContainText('1–5 of 57');
    await live.getByRole('button', { name: 'Next page' }).click();
    await expect(report).toContainText('6–10 of 57');
    await expect(column(table, 1).first()).toHaveText('ORD-1006');
  });

  test('draws cells with templates', async ({ page }) => {
    await openPage(page, '/controls/table', 'Table');
    const table = example(page, 'Cell templates').getByRole('table', {
      name: 'Orders with status tags',
    });
    await expect(table.locator('tbody .star-tag')).toHaveCount(5);
    await expect(table.locator('tbody .star-tag').first()).toHaveText('Open');
    await expect(bodyRows(table).first().locator('td').nth(1)).toContainText('ava@example.com');
  });

  test('formats the value and aligns the cells', async ({ page }) => {
    await openPage(page, '/controls/table', 'Table');
    const table = example(page, 'Value, format and alignment').getByRole('table');
    const first = bodyRows(table).first().locator('td');
    await expect(first).toHaveText(['ORD-1001', 'Jan 1, 2026', 'EUROPE', '1', '$12.50']);
    await expect(first.nth(3)).toHaveClass(/star-table__cell--center/);
    await expect(first.nth(4)).toHaveClass(/star-table__cell--end/);
  });

  test('has a small size, stripes and a sticky header', async ({ page }) => {
    await openPage(page, '/controls/table', 'Table');
    const live = example(page, 'Size, stripes and sticky header');
    const host = live.locator('star-table');
    await expect(host).toHaveClass(/star-table--sm/);
    await expect(host).toHaveClass(/star-table--striped/);
    await expect(host).toHaveClass(/star-table--sticky/);
    await expect(bodyRows(host).nth(1)).toHaveClass(/star-table__row--alt/);
    const scroll = live.locator('.star-table__scroll');
    await expect(scroll).toHaveCSS('max-height', /px$/);
    // The body scrolls inside the area and the header stays at the top.
    expect(await scroll.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await scroll.evaluate((el) => (el.scrollTop = 200));
    const head = await live.locator('thead').boundingBox();
    const area = await scroll.boundingBox();
    expect(Math.abs(head!.y - area!.y)).toBeLessThan(3);
  });

  test('shows a loading state with aria-busy, and an empty state', async ({ page }) => {
    await openPage(page, '/controls/table', 'Table');
    const live = example(page, 'Loading and empty state');
    const table = live.getByRole('table', { name: 'Orders being loaded' });
    await expect(table).not.toHaveAttribute('aria-busy', /.*/);
    await expect(bodyRows(table)).toHaveCount(3);

    await live.getByRole('button', { name: 'Start loading' }).click();
    await expect(table).toHaveAttribute('aria-busy', 'true');
    await expect(table.locator('.star-skeleton').first()).toBeVisible();
    await live.getByRole('button', { name: 'Stop loading' }).click();
    await expect(table).not.toHaveAttribute('aria-busy', /.*/);
    await expect(bodyRows(table)).toHaveCount(3);

    await expect(
      live.getByRole('table', { name: 'No orders' }).locator('.star-table__empty'),
    ).toHaveText('No orders yet. Add the first one.');
  });

  test('puts a caption above the table', async ({ page }) => {
    await openPage(page, '/controls/table', 'Table');
    const live = example(page, 'Caption');
    await expect(live.getByRole('heading', { level: 3, name: 'Latest orders' })).toBeVisible();
    const caption = await live.getByRole('heading', { level: 3 }).boundingBox();
    const table = await live.getByRole('table').boundingBox();
    expect(caption!.y).toBeLessThan(table!.y);
  });

  test('opens a row detail from the keyboard and names the state', async ({ page }) => {
    await openPage(page, '/controls/table', 'Table');
    const table = example(page, 'Row detail').getByRole('table');
    const button = table.getByRole('button', { name: 'Expand row' }).first();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.focus();
    await page.keyboard.press('Enter');
    const open = table.getByRole('button', { name: 'Collapse row' });
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    const detail = table.locator('tr.star-table__expansion');
    await expect(detail).toContainText('1 x Cable kit for Ava Stone (ava@example.com).');
    await expect(open).toHaveAttribute('aria-controls', (await detail.getAttribute('id')) ?? '');
    await expect(open).toBeFocused();
    await page.keyboard.press('Space');
    await expect(detail).toHaveCount(0);
  });

  test('lists every input, model and output of the table in the API tables', async ({ page }) => {
    // Public signal members of the table source: input(), model() and output().
    const source = (file: string) =>
      readFileSync(join(process.cwd(), 'projects/star-ng/table', file), 'utf8');
    const names = [
      ...source('table.ts').matchAll(/^\s+readonly (\w+) = (?:input|model|output)\b/gm),
    ]
      .map((match) => match[1])
      .filter((name) => !['template'].includes(name));
    expect(names.length).toBeGreaterThan(45);

    await openPage(page, '/controls/table', 'Table');
    const api = page.locator('docs-api');
    const listed = await api.locator('tbody th code').allTextContents();
    for (const name of names) expect(listed, `API row for ${name}`).toContain(name);
    // The template directives and their inputs.
    for (const name of ['starCell', 'starCellOf', 'starRowExpansionOf'])
      expect(listed).toContain(name);
    await expect(api.locator('h3', { hasText: 'StarCellTemplate' })).toBeVisible();
    await expect(api.locator('h3', { hasText: 'StarRowExpansionTemplate' })).toBeVisible();
    // Column fields, methods and types are written out too.
    const refs = await page.locator('docs-ref-table tbody th code').allTextContents();
    for (const field of ['field', 'exportValue', 'frozen', 'footer', 'editOptions']) {
      expect(refs).toContain(field);
    }
    for (const method of ['expandAll()', 'clearState()', 'toXlsx(options?)', 'print(options?)']) {
      expect(refs).toContain(method);
    }
  });
});

test.describe('table: sorting and filtering', () => {
  test('sorts from a header with Enter and Space and sets aria-sort', async ({ page }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    // The prerendered page answers keys only after hydration: wait until no component is left
    // with its `ngh` hydration marker.
    await expect(page.locator('[ngh]')).toHaveCount(0);
    const live = example(page, 'Sorting');
    const table = live.getByRole('table', { name: 'Sortable orders' });
    const customer = table.getByRole('columnheader', { name: 'Customer' });
    await expect(customer).toHaveAttribute('aria-sort', 'none');
    await expect(table.getByRole('columnheader', { name: 'Order' })).toHaveAttribute(
      'aria-sort',
      'none',
    );

    await customer.getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(customer).toHaveAttribute('aria-sort', 'ascending');
    await expect(live.getByRole('status')).toHaveText('Sort: customer (ascending)');
    await expect(column(table, 2).first()).toHaveText('Ava Stone');
    await expect(table.getByRole('columnheader', { name: 'Order' })).toHaveAttribute(
      'aria-sort',
      'none',
    );

    await page.keyboard.press('Space');
    await expect(customer).toHaveAttribute('aria-sort', 'descending');
    await expect(live.getByRole('status')).toHaveText('Sort: customer (descending)');
    await expect(column(table, 2).first()).toHaveText('Hugo Weber');
    await expect(customer.getByRole('button')).toBeFocused();

    // Sorting another column moves aria-sort to it and goes back to the first page.
    await table.getByRole('columnheader', { name: 'Total' }).getByRole('button').click();
    await expect(table.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(customer).toHaveAttribute('aria-sort', 'none');
    const totals = (await column(table, 5).allTextContents()).map(money);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  test('sorts by several columns with Shift + Enter and Shift + click', async ({ page }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Sort by several columns');
    const table = live.getByRole('table', { name: 'Orders sorted by several columns' });
    const sortButton = (name: string) =>
      table.getByRole('columnheader', { name }).getByRole('button');
    await expect(sortButton('Product')).toHaveAttribute(
      'title',
      'Shift + click adds this column to the sort',
    );

    await sortButton('Customer').focus();
    await page.keyboard.press('Enter');
    await sortButton('Product').focus();
    await page.keyboard.press('Shift+Enter');
    await expect(live.getByRole('status')).toHaveText('Sorts: customer up, product up');
    await expect(table.locator('.star-table__sort-rank')).toHaveText(['1', '2']);
    // aria-sort names the first sort column only.
    await expect(table.getByRole('columnheader', { name: 'Customer' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(table.getByRole('columnheader', { name: 'Product' })).toHaveAttribute(
      'aria-sort',
      'none',
    );

    // Shift + click on a sort column reverses it.
    await sortButton('Product').click({ modifiers: ['Shift'] });
    await expect(live.getByRole('status')).toHaveText('Sorts: customer up, product down');
    // Rows of the first customer are in descending product order.
    const rows = bodyRows(table);
    const first = await column(table, 2).first().textContent();
    const products: string[] = [];
    for (const row of await rows.all()) {
      if ((await row.locator('td:nth-child(2)').textContent()) === first) {
        products.push((await row.locator('td:nth-child(3)').textContent()) ?? '');
      }
    }
    expect(products).toEqual([...products].sort().reverse());

    // A plain click sorts by one column only.
    await sortButton('Total').click();
    await expect(live.getByRole('status')).toHaveText('Sorts: total up');
    await expect(table.locator('.star-table__sort-rank')).toHaveCount(0);
  });

  test('filters with the global filter, ignores case and accents, shows the empty state', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Global filter');
    const table = live.getByRole('table', { name: 'Searchable orders' });
    const search = live.getByRole('searchbox', { name: 'Search orders' });

    await search.fill('BEN cArTer');
    await expect(live.locator('.star-paginator__report')).toContainText('1–4 of 7');
    for (const cell of await column(table, 2).all()) await expect(cell).toHaveText('Ben Carter');

    // A search on the second page goes back to the first page.
    await live.getByRole('button', { name: 'Next page' }).click();
    await expect(live.locator('.star-paginator__report')).toContainText('5–7 of 7');
    await search.fill('ben');
    await expect(live.locator('.star-paginator__report')).toContainText('1–4 of 7');

    await search.fill('no such order');
    await expect(table.locator('.star-table__empty')).toHaveText('No records found');
    await search.fill('');
    await expect(bodyRows(table)).toHaveCount(4);
  });

  test('filters by text, choice, list, number range and date range, and clears them', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Column filters');
    const table = live.getByRole('table', { name: 'Orders with column filters' });
    const report = live.locator('.star-paginator__report');
    const filters = live.getByRole('status');
    await expect(report).toContainText('of 57');
    await expect(filters).toHaveText('Filters: {}');

    // Text filter. Seven orders belong to Ben Carter.
    await table.getByLabel('Filter by Customer').fill('ben');
    await expect(report).toContainText('of 7');
    await expect(filters).toHaveText('Filters: {"customer":"ben"}');

    // Select filter, with the choices of filterOptions. Three of them are in Europe.
    // It is a StarNG select: "All" is the placeholder, and its clear button shows every row.
    const region = table.getByRole('combobox', { name: 'Filter by Region' });
    await expect(table.locator('select')).toHaveCount(0);
    await expect(region).toHaveText('All');
    await region.click();
    await expect(page.getByRole('option')).toHaveText(['Europe', 'Asia', 'Americas']);
    await page.getByRole('option', { name: 'Europe' }).click();
    await expect(region).toHaveText('Europe');
    await expect(report).toContainText('of 3');
    for (const cell of await column(table, 3).all()) await expect(cell).toHaveText('Europe');
    await region
      .locator('xpath=ancestor::star-select[1]')
      .getByRole('button', { name: 'Clear' })
      .click();
    await expect(region).toHaveText('All');
    await expect(report).toContainText('of 7');

    // Multiselect filter: choose a status.
    await table.getByLabel('Filter by Customer').fill('');
    await table.getByRole('combobox', { name: 'Filter by Status' }).click();
    await page.getByRole('option', { name: 'Paid' }).click();
    await page.keyboard.press('Escape');
    for (const tag of await table.locator('tbody .star-tag').all())
      await expect(tag).toHaveText('Paid');
    await expect(filters).toContainText('"status":["Paid"]');

    // Number range: both bounds, then one open bound.
    await table.getByLabel('Total from').fill('100');
    await expect(filters).toContainText('"total":{"min":100}');
    for (const cell of await column(table, 6).all()) {
      expect(money(await cell.textContent())).toBeGreaterThanOrEqual(100);
    }
    await table.getByLabel('Total to').fill('300');
    for (const cell of await column(table, 6).all()) {
      const value = money(await cell.textContent());
      expect(value).toBeGreaterThanOrEqual(100);
      expect(value).toBeLessThanOrEqual(300);
    }
    await table.getByLabel('Total from').fill('');
    await expect(filters).toContainText('"total":{"min":null,"max":300}');

    // Clear everything with the method clearFilters().
    await live.getByRole('button', { name: 'Clear filters' }).click();
    await expect(filters).toHaveText('Filters: {}');
    await expect(report).toContainText('of 57');
    await expect(table.getByLabel('Total to')).toHaveValue('');
    await expect(table.getByLabel('Filter by Customer')).toHaveValue('');
    await expect(region).toHaveText('All');
  });

  test('filters a date column by a range of local days', async ({ page }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Column filters');
    const table = live.getByRole('table', { name: 'Orders with column filters' });
    await table.getByLabel('Placed from').fill('2026-03-01');
    await table.getByLabel('Placed to').fill('2026-03-31');
    await expect(live.getByRole('status')).toContainText(
      '"placed":{"min":"2026-03-01","max":"2026-03-31"}',
    );
    const placed = await column(table, 5).allTextContents();
    expect(placed.length).toBeGreaterThan(0);
    for (const text of placed) expect(text.trim()).toMatch(/^Mar \d+, 2026$/);
  });

  test('combines search, column filters and sort', async ({ page }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Combined');
    const table = live.getByRole('table', { name: 'Orders with search, filters and sort' });
    await live.getByRole('searchbox', { name: 'Search combined orders' }).fill('ava');
    await expect(live.locator('.star-paginator__report')).toContainText('of 8');
    await table.getByRole('combobox', { name: 'Filter by Region' }).click();
    await page.getByRole('option', { name: 'Europe' }).click();
    await expect(live.locator('.star-paginator__report')).toContainText('of 3');
    await table.getByRole('columnheader', { name: 'Total' }).getByRole('button').click();
    await expect(table.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    const totals = (await column(table, 6).allTextContents()).map(money);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
  });

  test('filter menu: a dialog with rules, Enter applies, focus returns, Tab stays inside', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Filter menu');
    const table = live.getByRole('table', { name: 'Invoices with filter menus' });
    await expect(table.locator('.star-table__filters')).toHaveCount(0);
    const button = table.getByRole('button', { name: 'Filter Customer', exact: true });
    await expect(button).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await button.click();
    const dialog = page.getByRole('dialog', { name: 'Filter Customer' });
    await expect(dialog).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await dialog.getByRole('combobox', { name: 'Match mode' }).selectOption('startsWith');
    await dialog.getByRole('textbox', { name: 'Filter by Customer' }).fill('ava');
    // Tab and Shift + Tab stay inside the dialog.
    for (let i = 0; i < 6; i++) await page.keyboard.press('Tab');
    await expect(dialog.locator(':focus')).toHaveCount(1);
    await dialog.getByRole('textbox', { name: 'Filter by Customer' }).press('Enter');
    await expect(dialog).toBeHidden();
    const active = table.getByRole('button', { name: 'Filter Customer, active' });
    await expect(active).toBeFocused();
    await expect(column(table, 2)).toHaveText(['Ava Stone', 'Ava Stone', 'Ava Stone', 'Ava Stone']);

    // Two number rules joined with Match any.
    await table.getByRole('button', { name: 'Filter Total' }).click();
    const total = page.getByRole('dialog', { name: 'Filter Total' });
    await expect(total.getByRole('combobox', { name: 'Match mode' })).toHaveValue('gte');
    await total.getByRole('spinbutton', { name: 'Filter by Total' }).fill('400');
    await total.getByRole('button', { name: 'Add rule' }).click();
    await total.getByRole('combobox', { name: 'Match mode' }).nth(1).selectOption('lt');
    await total.getByRole('spinbutton', { name: 'Filter by Total' }).nth(1).fill('10');
    await total.getByRole('combobox', { name: 'Combine rules' }).selectOption('or');
    await total.getByRole('button', { name: 'Apply' }).click();
    await expect(live.getByRole('status')).toContainText('"operator":"or"');

    // Escape closes without a change; Clear removes the filter. The popover moves the focus into
    // the dialog after the next render: wait for it, so Escape does not reach the button.
    await active.click();
    await expect(page.getByRole('dialog').locator(':focus')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(active).toBeFocused();
    await active.click();
    await page
      .getByRole('dialog', { name: 'Filter Customer' })
      .getByRole('button', { name: 'Clear' })
      .click();
    await expect(table.getByRole('button', { name: 'Filter Customer', exact: true })).toBeFocused();
  });

  test('custom match mode: Within 7 days', async ({ page }) => {
    await openPage(page, '/controls/table-sort-filter', 'Table sorting and filtering');
    const live = example(page, 'Custom match mode');
    const table = live.getByRole('table', { name: 'Orders with a custom match mode' });
    await table.getByRole('button', { name: 'Filter Placed' }).click();
    const dialog = page.getByRole('dialog', { name: 'Filter Placed' });
    const mode = dialog.getByRole('combobox', { name: 'Match mode' });
    await expect(mode.locator('option')).toHaveText([
      'Within 7 days',
      'Date is',
      'Date is before',
      'Date is after',
    ]);
    await dialog.getByLabel('Filter by Placed').fill('2026-01-07');
    await dialog.getByRole('button', { name: 'Apply' }).click();
    await expect(live.locator('.star-paginator__report')).toContainText('of 5');
  });
});

test.describe('table: paging', () => {
  test('pages on the client with the keyboard and changes the page size', async ({ page }) => {
    await openPage(page, '/controls/table-paging', 'Table paging');
    const live = example(page, 'Client paging');
    const table = live.getByRole('table', { name: 'Paged orders' });
    await expect(live.getByRole('status')).toHaveText('first = 0, rows = 5');

    const next = live.getByRole('button', { name: 'Next page' });
    await next.focus();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('first = 5, rows = 5');
    await expect(column(table, 1).first()).toHaveText('ORD-1006');
    await expect(live.locator('.star-paginator__report')).toContainText('6–10 of 57');

    await live.getByRole('button', { name: 'Last page' }).click();
    await expect(live.getByRole('status')).toHaveText('first = 55, rows = 5');
    await expect(bodyRows(table)).toHaveCount(2);
    await expect(next).toBeDisabled();

    const size = live.getByRole('combobox', { name: 'Rows per page' });
    await size.click();
    await expect(page.getByRole('option')).toHaveText(['5', '10', '20']);
    await page.getByRole('option', { name: '20' }).click();
    // The page size changes and the first row stays on a page border: 57 - 40 = 17 rows.
    await expect(live.getByRole('status')).toHaveText('first = 40, rows = 20');
    await expect(bodyRows(table)).toHaveCount(17);
    await expect(live.locator('.star-paginator__report')).toContainText('41–57 of 57');
  });

  test('loads pages, sorts and filters from the server in lazy mode', async ({ page }) => {
    await openPage(page, '/controls/table-paging', 'Table paging');
    const live = example(page, 'Lazy loading');
    const table = live.getByRole('table', { name: 'Orders from the server' });
    const request = live.getByRole('status');
    // The first request is sent when the table starts.
    await expect(request).toContainText('Last request: first 0, rows 5, sort none, filter {}');
    await expect(bodyRows(table)).toHaveCount(5);
    await expect(table).not.toHaveAttribute('aria-busy', /.*/);
    await expect(live.locator('.star-paginator__report')).toContainText('1–5 of 57');

    await live.getByRole('button', { name: 'Next page' }).click();
    await expect(request).toContainText('first 5, rows 5');
    await expect(column(table, 1).first()).toHaveText('ORD-1006');

    // A sort goes back to the first page and asks the server for the order.
    await table.getByRole('columnheader', { name: 'Customer' }).getByRole('button').focus();
    await page.keyboard.press('Enter');
    await expect(request).toContainText('first 0, rows 5, sort customer');
    await expect(table.getByRole('columnheader', { name: 'Customer' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(column(table, 2).first()).toHaveText('Ava Stone');

    // A filter shows the total that the server reports.
    await table.getByLabel('Filter by Customer').fill('ben');
    await expect(request).toContainText('"customer":"ben"');
    await expect(live.locator('.star-paginator__report')).toContainText('1–5 of 7');
    for (const cell of await column(table, 2).all()) await expect(cell).toHaveText('Ben Carter');

    await live.getByRole('combobox', { name: 'Rows per page' }).click();
    await page.getByRole('option', { name: '10', exact: true }).click();
    await expect(request).toContainText('rows 10');
    await expect(live.locator('.star-paginator__report')).toContainText('1–7 of 7');
  });
});

test.describe('table: selection', () => {
  test('selects rows with checkboxes and the header checkbox selects the page', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Multiple selection');
    const table = live.getByRole('table', { name: 'Orders with checkboxes' });
    const rowBoxes = table.locator('tbody').getByRole('checkbox', { name: 'Select row' });
    const header = table.locator('thead').getByRole('checkbox', { name: 'Select all rows' });
    const count = live.getByRole('status');
    await expect(count).toHaveText('0 selected');

    // Space on a focused row checkbox selects the row and marks it for a screen reader.
    await rowBoxes.first().focus();
    await page.keyboard.press('Space');
    await expect(count).toHaveText('1 selected');
    await expect(bodyRows(table).first()).toHaveAttribute('aria-selected', 'true');
    await expect(bodyRows(table).nth(1)).toHaveAttribute('aria-selected', 'false');
    await expect(bodyRows(table).first()).toHaveClass(/star-table__row--selected/);
    await expect(header).toHaveJSProperty('indeterminate', true);

    await header.check();
    await expect(count).toHaveText('5 selected');
    await expect(header).toBeChecked();

    // The selection stays when the user goes to the next page.
    await live.getByRole('button', { name: 'Next page' }).click();
    await expect(count).toHaveText('5 selected');
    await expect(header).not.toBeChecked();
    await rowBoxes.nth(1).check();
    await expect(count).toHaveText('6 selected');
    await live.getByRole('button', { name: 'Previous page' }).click();
    await expect(header).toBeChecked();

    await header.uncheck();
    await expect(count).toHaveText('1 selected');
    await live.getByRole('button', { name: 'Clear selection' }).click();
    await expect(count).toHaveText('0 selected');
  });

  test('selects rows from code, also on other pages', async ({ page }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Multiple selection');
    const table = live.getByRole('table', { name: 'Orders with checkboxes' });
    await live.getByRole('button', { name: 'Select open orders' }).click();
    // Every fifth order is open: 12 of 57.
    await expect(live.getByRole('status')).toHaveText('12 selected');
    await expect(bodyRows(table).first()).toHaveAttribute('aria-selected', 'true');
    await expect(bodyRows(table).nth(1)).toHaveAttribute('aria-selected', 'false');
  });

  test('selects one row with a radio button, a click or the arrow keys', async ({ page }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Single selection');
    const table = live.getByRole('table', { name: 'Orders with one choice' });
    const radios = table.getByRole('radio', { name: 'Select row' });
    await expect(live.getByRole('status')).toHaveText('Chosen: none');
    await expect(bodyRows(table).first()).toHaveClass(/star-table__row--clickable/);

    // A click on a cell selects the row.
    await bodyRows(table).nth(2).locator('td').nth(2).click();
    await expect(live.getByRole('status')).toHaveText('Chosen: ORD-1003');
    await expect(radios.nth(2)).toBeChecked();
    await expect(bodyRows(table).nth(2)).toHaveAttribute('aria-selected', 'true');

    // Arrow keys move the choice in the group of radio buttons.
    await radios.nth(2).focus();
    await page.keyboard.press('ArrowDown');
    await expect(live.getByRole('status')).toHaveText('Chosen: ORD-1004');
    await expect(bodyRows(table).nth(2)).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(live.getByRole('status')).toHaveText('Chosen: ORD-1002');
    await expect(radios.nth(1)).toBeChecked();
  });

  test('meta-key selection: click, Ctrl + click, Shift + click and the keyboard', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Meta-key selection');
    const table = live.getByRole('table', { name: 'Orders with meta-key selection' });
    const status = live.getByRole('status');
    const cell = (index: number) => bodyRows(table).nth(index).locator('td').nth(2);
    await cell(1).click();
    await expect(status).toContainText('1 selected. Selected ORD-1002');
    await cell(3).click({ modifiers: ['ControlOrMeta'] });
    await expect(status).toContainText('2 selected');
    await cell(5).click({ modifiers: ['Shift'] });
    await expect(status).toContainText('3 selected');
    await expect(bodyRows(table).nth(4)).toHaveAttribute('aria-selected', 'true');
    await cell(0).click();
    await expect(status).toContainText('1 selected');

    // The rows are one tab stop; the arrow keys move, Space and Shift + arrow select.
    await expect(bodyRows(table).nth(0)).toBeFocused();
    await expect(bodyRows(table).nth(1)).toHaveAttribute('tabindex', '-1');
    await page.keyboard.press('ArrowDown');
    await expect(bodyRows(table).nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(status).toContainText('2 selected');
    await page.keyboard.press('Shift+ArrowDown');
    await page.keyboard.press('Shift+ArrowDown');
    await expect(bodyRows(table).nth(3)).toBeFocused();
    await expect(status).toContainText('4 selected');
    await expect(
      bodyRows(table).nth(3).getByRole('checkbox', { name: 'Select row ORD-1004' }),
    ).toBeChecked();
  });

  test('check box selection: select-all of the filter result, unselectable rows, cancel', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Check box selection');
    const table = live.getByRole('table', { name: 'Orders with selectable rows' });
    const status = live.getByRole('status');
    const header = table.locator('thead').getByRole('checkbox', { name: 'Select all rows' });
    // Cancelled orders cannot be selected.
    const cancelled = bodyRows(table).filter({ hasText: 'Cancelled' }).first();
    await expect(cancelled.getByRole('checkbox')).toBeDisabled();

    const boxes = table.locator('tbody').getByRole('checkbox', { disabled: false });
    await boxes.nth(0).check();
    await expect(status).toHaveText('1 selected');
    await expect(header).toHaveJSProperty('indeterminate', true);
    // Shift + Space on a later box selects the range from the last toggled row.
    await boxes.nth(2).focus();
    await page.keyboard.press('Shift+Space');
    await expect(status).toHaveText('3 selected');
    await expect(boxes.nth(1)).toBeChecked();

    // All selectable orders are more than 20: the example cancels the change.
    await header.click();
    await expect(status).toHaveText('3 selected, more than 20 refused');
    await expect(header).not.toBeChecked();
    await expect(header).toHaveJSProperty('indeterminate', true);
  });

  test('emits the row of a click and ignores a click on a control', async ({ page }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Row click');
    const table = live.getByRole('table', { name: 'Orders with row click' });
    await expect(live.getByRole('status')).toHaveText('Opened: none');
    await bodyRows(table).nth(3).locator('td').first().click();
    await expect(live.getByRole('status')).toHaveText('Opened: ORD-1004');
    // Without a selection mode the row has no pointer style and no aria-selected.
    await expect(bodyRows(table).first()).not.toHaveClass(/star-table__row--clickable/);
    await expect(bodyRows(table).first()).not.toHaveAttribute('aria-selected', /.*/);
  });

  test('runs a row action without selecting the row', async ({ page }) => {
    await openPage(page, '/controls/table-selection', 'Table selection');
    const live = example(page, 'Row actions');
    const table = live.getByRole('table', { name: 'Orders with actions' });
    const cancel = table.getByRole('button', { name: 'Cancel ORD-1002' });
    await cancel.focus();
    await page.keyboard.press('Enter');
    await expect(bodyRows(table).nth(1).locator('.star-tag')).toHaveText('Cancelled');
    await expect(cancel).toBeDisabled();
    await expect(live.getByRole('status')).toHaveText('Selected: none');

    // A click on the row itself still selects it.
    await bodyRows(table).nth(1).locator('td').nth(2).click();
    await expect(live.getByRole('status')).toHaveText('Selected: ORD-1002');
  });
});

test.describe('table: editing', () => {
  test('edits a number from the keyboard, rejects a value and cancels with Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-edit', 'Table editing');
    const live = example(page, 'Inline cell edit');
    const table = live.getByRole('grid', { name: 'Editable orders' });
    // Quantity: not editable for the cancelled order (ORD-1003): four buttons of five rows.
    await expect(table.getByRole('button', { name: 'Edit Quantity' })).toHaveCount(4);
    await expect(table.getByRole('button', { name: 'Edit Product' })).toHaveCount(5);

    const edit = table.getByRole('button', { name: 'Edit Quantity' }).first();
    // The name is the action and the visible value; the value is in its own element.
    const value = edit.locator('.star-table__edit-value');
    await expect(edit).toHaveAccessibleName('Edit Quantity: 1');
    await expect(value).toHaveText('1');
    await edit.focus();
    await page.keyboard.press('Enter');
    const editor = table.getByRole('spinbutton', { name: 'Edit Quantity' });
    await expect(editor).toBeFocused();
    await editor.fill('12');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText(
      'Quantity not changed: enter a whole number from 1 to 9.',
    );
    await expect(editor).toHaveCount(0);
    await expect(value).toHaveText('1');
    await expect(edit).toBeFocused();

    await page.keyboard.press('Enter');
    await editor.fill('4');
    await page.keyboard.press('Enter');
    await expect(value).toHaveText('4');
    await expect(edit).toHaveAccessibleName('Edit Quantity: 4');
    await expect(live.getByRole('status')).toHaveText('ORD-1001: quantity changed from 1 to 4.');
    await expect(edit).toBeFocused();

    // Escape closes the editor and keeps the value.
    await page.keyboard.press('Enter');
    await editor.fill('7');
    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(value).toHaveText('4');
    await expect(edit).toBeFocused();
  });

  test('edits text and a choice, and saves when the field loses the focus', async ({ page }) => {
    await openPage(page, '/controls/table-edit', 'Table editing');
    const live = example(page, 'Inline cell edit');
    const table = live.getByRole('grid', { name: 'Editable orders' });

    await table.getByRole('button', { name: 'Edit Customer' }).first().click();
    const text = table.getByRole('textbox', { name: 'Edit Customer' });
    await expect(text).toBeFocused();
    await expect(text).toHaveValue('Ava Stone');
    await text.fill('Ava Stone-Reed');
    await page.keyboard.press('Tab');
    await expect(
      table
        .getByRole('button', { name: 'Edit Customer' })
        .first()
        .locator('.star-table__edit-value'),
    ).toHaveText('Ava Stone-Reed');

    await table.getByRole('button', { name: 'Edit Product' }).first().click();
    const choice = table.getByRole('combobox', { name: 'Edit Product' });
    await expect(choice).toHaveText('Cable kit');
    await page.getByRole('option', { name: 'Notebook' }).click();
    await expect(
      table
        .getByRole('button', { name: 'Edit Product' })
        .first()
        .locator('.star-table__edit-value'),
    ).toHaveText('Notebook');
    await expect(live.getByRole('status')).toHaveText(
      'ORD-1001: product changed from Cable kit to Notebook.',
    );
  });

  test('the choice editor opens its list at once, commits a choice and cancels on Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-edit', 'Table editing');
    const live = example(page, 'Inline cell edit');
    const table = live.getByRole('grid');
    const status = live.getByRole('status');
    const edit = table.getByRole('button', { name: 'Edit Product' }).first();
    const value = edit.locator('.star-table__edit-value');
    const before = await status.textContent();

    // The editor is a StarNG select with the focus on it and its list open.
    await edit.click();
    const choice = table.getByRole('combobox', { name: 'Edit Product' });
    await expect(table.locator('select')).toHaveCount(0);
    await expect(choice).toBeFocused();
    await expect(choice).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('listbox')).toBeVisible();

    // Escape closes the list and cancels: no change, and the focus is back on the cell.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(choice).toHaveCount(0);
    await expect(value).toHaveText('Cable kit');
    await expect(status).toHaveText(before ?? '');
    await expect(edit).toBeFocused();

    // A click outside closes the list without a change: the edit ends.
    await edit.click();
    await expect(choice).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('heading', { level: 1 }).click();
    await expect(choice).toHaveCount(0);
    await expect(value).toHaveText('Cable kit');

    // The keyboard: Enter on the edit button opens the list; Arrow down and Enter choose.
    await edit.focus();
    await page.keyboard.press('Enter');
    await expect(choice).toBeFocused();
    await expect(choice).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(choice).toHaveCount(0);
    await expect(value).not.toHaveText('Cable kit');
    await expect(status).toContainText('ORD-1001: product changed from Cable kit to');
    await expect(edit).toBeFocused();
  });

  test('moves rows with the buttons and disables them at the ends', async ({ page }) => {
    await openPage(page, '/controls/table-edit', 'Table editing');
    const live = example(page, 'Row order');
    const table = live.getByRole('table', { name: 'Order queue' });
    await expect(column(table, 2).first()).toHaveText('ORD-1001');
    await expect(table.getByRole('button', { name: 'Move up' }).first()).toBeDisabled();
    await expect(table.getByRole('button', { name: 'Move down' }).last()).toBeDisabled();

    const down = table.getByRole('button', { name: 'Move down' }).first();
    await down.focus();
    await page.keyboard.press('Enter');
    await expect(column(table, 2)).toHaveText(['ORD-1002', 'ORD-1001', 'ORD-1003', 'ORD-1004']);
    await table.getByRole('button', { name: 'Move up' }).nth(2).click();
    await expect(column(table, 2)).toHaveText(['ORD-1002', 'ORD-1003', 'ORD-1001', 'ORD-1004']);
  });

  test('edits a row from the keyboard, blocks an invalid save and cancels with Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-edit', 'Table editing');
    // The prerendered page answers keys only after hydration: wait until no component is left
    // with its `ngh` hydration marker.
    await expect(page.locator('[ngh]')).toHaveCount(0);
    const live = example(page, 'Row edit with validation');
    const table = live.getByRole('grid', { name: 'Orders with row edit' });
    const edit = table.getByRole('button', { name: 'Edit row' }).first();
    await edit.focus();
    await page.keyboard.press('Enter');
    const customer = table.getByRole('textbox', { name: 'Edit Customer' });
    await expect(customer).toBeFocused();
    await customer.fill('');
    await page.keyboard.press('Tab');
    await expect(table.getByRole('combobox', { name: 'Edit Status' })).toBeFocused();
    await page.keyboard.press('Enter');
    // Save is blocked: the customer is required.
    await expect(customer).toHaveAttribute('aria-invalid', 'true');
    await expect(customer).toBeFocused();
    await expect(table.getByText('Enter a value.')).toBeVisible();
    await customer.fill('Park Cafe');
    await page.keyboard.press('Enter');
    await expect(customer).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText(/customer changed/);
    await expect(table.getByRole('button', { name: 'Edit row' }).first()).toBeFocused();
    await expect(table.getByRole('gridcell', { name: 'Park Cafe' })).toBeVisible();

    await page.keyboard.press('F2');
    await table.getByRole('textbox', { name: 'Edit Customer' }).fill('Other');
    await page.keyboard.press('Escape');
    await expect(table.getByRole('textbox', { name: 'Edit Customer' })).toHaveCount(0);
    await expect(table.getByRole('gridcell', { name: 'Park Cafe' })).toBeVisible();
  });

  test('collects batch changes, undoes them with Ctrl+Z and saves them', async ({ page }) => {
    await openPage(page, '/controls/table-edit', 'Table editing');
    const live = example(page, 'Batch edit with undo');
    const table = live.getByRole('grid', { name: 'Orders with batch edit' });
    const edit = table.getByRole('button', { name: /^Edit Customer/ }).first();
    await edit.click();
    await table.getByRole('textbox', { name: 'Edit Customer' }).fill('Changed customer');
    await page.keyboard.press('Enter');
    await expect(edit).toHaveAccessibleName(/Changed customer.*changed$/);
    await expect(live.getByRole('button', { name: 'Save 1 change' })).toBeEnabled();
    await page.keyboard.press('Control+z');
    await expect(edit).not.toHaveAccessibleName(/changed$/);
    await page.keyboard.press('Control+y');
    await expect(edit).toHaveAccessibleName(/changed$/);
    await live.getByRole('button', { name: 'Save 1 change' }).click();
    await expect(live.getByRole('status')).toHaveText('Saved: 1 row changed.');
    await expect(edit).not.toHaveAccessibleName(/changed$/);
    await expect(edit).toHaveAccessibleName(/Changed customer/);
  });

  test('adds a row at the top and deletes a row', async ({ page }) => {
    await openPage(page, '/controls/table-edit', 'Table editing');
    const live = example(page, 'Add and delete rows');
    const table = live.getByRole('grid', { name: 'Orders to add and delete' });
    await expect(bodyRows(table)).toHaveCount(3);
    await live.getByRole('button', { name: 'Add order' }).click();
    const customer = table.getByRole('textbox', { name: 'Edit Customer' });
    await expect(customer).toBeFocused();
    await customer.fill('Park Cafe');
    await table.getByRole('textbox', { name: 'Edit Quantity' }).fill('3');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('ORD-900 added.');
    await expect(bodyRows(table)).toHaveCount(4);
    await table.getByRole('button', { name: 'Delete ORD-900' }).click();
    await expect(live.getByRole('status')).toHaveText('ORD-900 deleted.');
    await expect(bodyRows(table)).toHaveCount(3);
  });
});

test.describe('table: columns', () => {
  test('hides and moves columns in the Columns panel and locks one column', async ({ page }) => {
    await openPage(page, '/controls/table-columns', 'Table columns');
    const live = example(page, 'Hide and move columns');
    const table = live.getByRole('table', { name: 'Orders with column panel' });
    await expect(live.getByRole('status')).toHaveText('Order: default. Hidden: none.');

    const toggle = live.getByRole('button', { name: 'Columns' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    const panel = page.getByRole('dialog', { name: 'Columns' });
    await expect(panel).toBeVisible();

    await panel.getByRole('checkbox', { name: 'Customer' }).uncheck();
    await expect(table.getByRole('columnheader', { name: 'Customer' })).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Order: default. Hidden: customer.');
    // A column with hideable: false cannot be hidden.
    await expect(panel.getByRole('checkbox', { name: 'Order', exact: true })).toBeDisabled();

    // Move Region before Product with the arrow buttons.
    const earlier = panel.getByRole('button', { name: 'Move Region earlier' });
    await earlier.focus();
    await page.keyboard.press('Enter');
    await expect(table.getByRole('columnheader')).toHaveText([
      'Order',
      'Region',
      'Product',
      'Total',
    ]);
    await expect(live.getByRole('status')).toContainText(
      'Order: id, customer, region, product, total.',
    );
    // The focus stays on the button, so the user can press Enter again.
    await expect(earlier).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(table.getByRole('columnheader')).toHaveText([
      'Region',
      'Order',
      'Product',
      'Total',
    ]);
    // At the start of the list the button is disabled: the focus moves to the other direction.
    await expect(earlier).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Move Region later' })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(toggle).toBeFocused();

    // The last visible column cannot be hidden.
    await toggle.click();
    await panel.getByRole('checkbox', { name: 'Region' }).uncheck();
    await panel.getByRole('checkbox', { name: 'Product' }).uncheck();
    await panel.getByRole('checkbox', { name: 'Total' }).uncheck();
    await expect(table.getByRole('columnheader')).toHaveText(['Order']);
    await expect(panel.getByRole('checkbox', { name: 'Order', exact: true })).toBeDisabled();
  });

  test('moves a column when the user drags its header', async ({ page }) => {
    await openPage(page, '/controls/table-columns', 'Table columns');
    const live = example(page, 'Hide and move columns');
    const table = live.getByRole('table', { name: 'Orders with column panel' });
    await expect(table.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'draggable',
      'true',
    );
    await table
      .getByRole('columnheader', { name: 'Total' })
      .dragTo(table.getByRole('columnheader', { name: 'Customer' }));
    await expect(table.getByRole('columnheader')).toHaveText([
      'Order',
      'Total',
      'Customer',
      'Product',
      'Region',
    ]);
  });

  test('resizes a column with the arrow keys down to a minimum width', async ({ page }) => {
    await openPage(page, '/controls/table-columns', 'Table columns');
    const live = example(page, 'Resize columns');
    const table = live.getByRole('table', { name: 'Orders with resizable columns' });
    const handle = table.getByRole('separator', { name: 'Resize Customer' });
    await expect(handle).toHaveAttribute('aria-orientation', 'vertical');
    const header = table.getByRole('columnheader', { name: 'Customer' });
    const start = (await header.boundingBox())!.width;
    // A focusable separator needs its value: before any resize it is the rendered width.
    await expect(handle).toHaveAttribute('aria-valuenow', String(Math.round(start)));
    await expect(handle).toHaveAttribute('aria-valuemin', '48');

    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', String(Math.round(start + 16)));
    await expect(live.getByRole('status')).toContainText(`customer ${Math.round(start + 16)}px`);
    await expect(header).toHaveCSS('width', `${Math.round(start + 16)}px`);

    await page.keyboard.press('ArrowLeft', { delay: 0 });
    await page.keyboard.press('ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', String(Math.round(start - 16)));

    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft');
    await expect(handle).toHaveAttribute('aria-valuenow', '48');
    await expect(live.getByRole('status')).toContainText('customer 48px');
  });

  test('resizes a column with the pointer', async ({ page }) => {
    await openPage(page, '/controls/table-columns', 'Table columns');
    const live = example(page, 'Resize columns');
    const table = live.getByRole('table', { name: 'Orders with resizable columns' });
    const header = table.getByRole('columnheader', { name: 'Product' });
    const start = (await header.boundingBox())!.width;
    const separator = table.getByRole('separator', { name: 'Resize Product' });
    // The mouse needs the handle inside the viewport.
    await separator.scrollIntoViewIfNeeded();
    const handle = (await separator.boundingBox())!;
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await header.boundingBox())!.width).toBeGreaterThan(start + 40);
    await expect(live.getByRole('status')).toContainText('product ');
  });

  test('keeps frozen columns in view on sideways scroll', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await openPage(page, '/controls/table-columns', 'Table columns');
    const live = example(page, 'Frozen columns');
    const table = live.getByRole('table', { name: 'Wide orders' });
    await table.scrollIntoViewIfNeeded();
    const first = table.getByRole('columnheader', { name: 'Order' });
    const second = table.getByRole('columnheader', { name: 'Customer' });
    // The second frozen column starts where the first one ends (measured width).
    const firstWidth = (await first.boundingBox())!.width;
    await expect
      .poll(async () => parseFloat(await second.evaluate((cell) => cell.style.insetInlineStart)))
      .toBeCloseTo(firstWidth, 0);

    const scroll = live.locator('.star-table__scroll');
    const before = (await second.boundingBox())!.x;
    await scroll.evaluate((viewport) => (viewport.scrollLeft = 300));
    expect(await scroll.evaluate((viewport) => viewport.scrollLeft)).toBeGreaterThan(50);
    await expect
      .poll(async () => Math.round((await second.boundingBox())!.x))
      .toBeLessThanOrEqual(Math.round(before));
    // Both frozen headers stay at the start edge of the scroll area, next to each other.
    const left = (await scroll.boundingBox())!.x;
    const a = (await first.boundingBox())!;
    const b = (await second.boundingBox())!;
    expect(Math.abs(a.x - left)).toBeLessThan(3);
    expect(Math.abs(b.x - (a.x + a.width))).toBeLessThan(2);
    // The cells of the body stay with the header.
    const cell = (await bodyRows(table).first().locator('td').nth(1).boundingBox())!;
    expect(Math.abs(cell.x - b.x)).toBeLessThan(2);
    // Columns that are not frozen scroll away.
    const email = table.getByRole('columnheader', { name: 'Email' });
    expect((await email.boundingBox())!.x).toBeLessThan(left + 600);
  });

  test('pins columns to both edges from the Columns panel', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 900 });
    await openPage(page, '/controls/table-columns', 'Table columns');
    const live = example(page, 'Pin to start and end');
    const table = live.getByRole('table', { name: 'Orders with pinned columns' });
    await table.scrollIntoViewIfNeeded();
    const scroll = live.locator('.star-table__scroll');
    // The end pin touches the end edge of the scroll area before and after a sideways scroll.
    const edge = () =>
      scroll.evaluate((viewport) => {
        const cell = viewport.querySelector('th[data-field="total"]')!.getBoundingClientRect();
        const area = viewport.getBoundingClientRect();
        return Math.abs(cell.right - (area.left + viewport.clientLeft + viewport.clientWidth)) < 2;
      });
    await expect.poll(edge).toBe(true);
    await scroll.evaluate((viewport) => (viewport.scrollLeft = 200));
    await expect.poll(edge).toBe(true);

    // Pin Email to the start from the panel: it moves next to Order and sticks.
    await live.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('button', { name: 'Pin Email to start' }).click();
    await expect(page.getByRole('button', { name: 'Pin Email to start' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Pin Email to start' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(live.getByRole('status')).toContainText('email start');
    const headers = table.locator('thead th[data-field]');
    await expect(headers.nth(1)).toHaveAttribute('data-field', 'email');
    await expect(headers.nth(1)).toHaveClass(/star-table__cell--frozen/);
  });

  test('saves the view in the session and restores it after a reload', async ({ page }) => {
    await openPage(page, '/controls/table-columns', 'Table columns');
    const live = example(page, 'Saved view');
    let table = live.getByRole('table', { name: 'Orders with saved view' });
    await table.getByRole('columnheader', { name: 'Customer' }).getByRole('button').click();
    await expect(table.getByRole('columnheader', { name: 'Customer' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await live.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('checkbox', { name: 'Region' }).uncheck();
    await page.keyboard.press('Escape');
    await expect(table.getByRole('columnheader', { name: 'Region' })).toHaveCount(0);
    const saved = await page.evaluate(() => sessionStorage.getItem('docs-table-saved-view'));
    expect(JSON.parse(saved ?? '{}')).toMatchObject({
      sortField: 'customer',
      sortOrder: 1,
      hiddenColumns: ['region'],
    });

    await page.reload();
    table = example(page, 'Saved view').getByRole('table', { name: 'Orders with saved view' });
    await expect(table.getByRole('columnheader', { name: 'Customer' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(table.getByRole('columnheader', { name: 'Region' })).toHaveCount(0);

    // Clear the saved copy: the next visit starts with the default view.
    await example(page, 'Saved view').getByRole('button', { name: 'Clear saved view' }).click();
    expect(await page.evaluate(() => sessionStorage.getItem('docs-table-saved-view'))).toBeNull();
    await page.reload();
    table = example(page, 'Saved view').getByRole('table', { name: 'Orders with saved view' });
    await expect(table.getByRole('columnheader', { name: 'Region' })).toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Customer' })).toHaveAttribute(
      'aria-sort',
      'none',
    );
  });
});

test.describe('table: layout', () => {
  test('expands rows with the keyboard, in single mode, and from code', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Row expansion');
    const table = live.getByRole('table', { name: 'Orders with detail' });
    const details = table.locator('tr.star-table__expansion');
    const status = live.getByRole('status');
    await expect(status).toHaveText('Open: none');

    const first = table.getByRole('button', { name: 'Expand row' }).first();
    await first.focus();
    await page.keyboard.press('Space');
    await expect(status).toHaveText('Open: ORD-1001');
    await expect(details).toHaveCount(1);
    await expect(details).toContainText('ava@example.com');
    // The detail row spans all columns and the button points at it.
    await expect(details.locator('td')).toHaveAttribute('colspan', '6');
    await expect(table.getByRole('button', { name: 'Collapse row' })).toHaveAttribute(
      'aria-controls',
      (await details.getAttribute('id')) ?? '',
    );

    await table.getByRole('button', { name: 'Expand row' }).first().click();
    await expect(details).toHaveCount(2);
    await expect(status).toHaveText('Open: ORD-1001, ORD-1002');

    // Single mode: opening a row closes the others.
    await live.getByRole('switch', { name: 'One row open at a time' }).check();
    await table.getByRole('button', { name: 'Expand row' }).first().click();
    await expect(status).toHaveText('Open: ORD-1003');
    await expect(details).toHaveCount(1);

    await live.getByRole('button', { name: 'Expand all' }).click();
    await expect(details).toHaveCount(4);
    await live.getByRole('button', { name: 'Collapse all' }).click();
    await expect(details).toHaveCount(0);
    await expect(status).toHaveText('Open: none');
  });

  test('groups rows under headings and closes a group', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Row groups');
    const table = live.getByRole('table', { name: 'Orders in groups' });
    await expect(table.locator('.star-table__group')).toHaveCount(0);
    await live.getByRole('switch', { name: 'Group by region' }).check();

    const headings = table.locator('.star-table__group-toggle');
    await expect(headings).toHaveText([/Europe\s+4/, /Asia\s+4/, /Americas\s+4/]);
    await expect(headings.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(bodyRows(table)).toHaveCount(12);

    await headings.first().focus();
    await page.keyboard.press('Enter');
    await expect(headings.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(live.getByRole('status')).toHaveText('Closed: Europe');
    await expect(table.locator('tbody tr.star-table__row:not([hidden])')).toHaveCount(8);
    await expect(table.locator('tbody tr.star-table__row[hidden]')).toHaveCount(4);

    await page.keyboard.press('Space');
    await expect(headings.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(live.getByRole('status')).toHaveText('Closed: none');
  });

  test('shows a footer row from the rows of the table', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const table = example(page, 'Footer').getByRole('table', { name: 'Orders with totals' });
    const footer = table.locator('tfoot td');
    await expect(footer).toHaveCount(4);
    await expect(footer.first()).toHaveText('Total');
    const quantities = (await column(table, 3).allTextContents()).map(Number);
    const totals = (await column(table, 4).allTextContents()).map(money);
    const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
    await expect(footer.nth(2)).toHaveText(String(sum(quantities)));
    expect(money(await footer.nth(3).textContent())).toBeCloseTo(sum(totals), 2);
  });

  test('spans column groups over their columns and names them in the cells', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Column groups');
    const table = live.getByRole('table', { name: 'Sales by region and quarter' });
    await expect(table.locator('thead tr')).toHaveCount(3);
    const sales = table.getByRole('columnheader', { name: 'Sales', exact: true });
    await expect(sales).toHaveAttribute('colspan', '6');
    await expect(sales).toHaveAttribute('scope', 'colgroup');
    await expect(table.getByRole('columnheader', { name: 'Q2, 3 months' })).toBeVisible();
    // The cell of March names Sales, Q1 and Mar.
    const ids = (await bodyRows(table).first().locator('td').nth(4).getAttribute('headers'))!;
    const names = await Promise.all(
      ids.split(' ').map((id) => table.locator(`[id="${id}"]`).innerText()),
    );
    expect(names.map((name) => name.trim())).toEqual(['Sales', 'Q1', 'Mar']);
    // The group is as wide as its columns.
    const q1 = (await table.getByRole('columnheader', { name: 'Q1' }).boundingBox())!;
    const jan = (await table.getByRole('columnheader', { name: 'Jan' }).boundingBox())!;
    const mar = (await table.getByRole('columnheader', { name: 'Mar' }).boundingBox())!;
    expect(Math.abs(q1.x - jan.x)).toBeLessThan(2);
    expect(Math.abs(q1.x + q1.width - (mar.x + mar.width))).toBeLessThan(2);

    // Hiding a month shrinks its group.
    await live.getByRole('button', { name: 'Columns' }).click();
    await page.getByRole('checkbox', { name: 'Feb' }).uncheck();
    await page.keyboard.press('Escape');
    await expect(table.getByRole('columnheader', { name: 'Q1' })).toHaveAttribute('colspan', '2');
    await expect(sales).toHaveAttribute('colspan', '5');
  });

  test('shows a summary row and a summary below each group', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Summaries');
    const table = live.getByRole('table', { name: 'Sales with summaries' });
    const footer = table.locator('tfoot td');
    await expect(footer.nth(1)).toHaveText(/Count\s*8/);
    await expect(footer.nth(2)).toContainText('Sum');
    // The group summaries of the January column add up to the footer sum.
    const groups = table.locator('tbody tr.star-table__group-footer');
    await expect(groups).toHaveCount(3);
    // The summary styles apply at every width, not only in the stacked phone layout.
    await expect(groups.first().locator('td').nth(2)).toHaveCSS('font-weight', '600');
    await expect(footer.nth(2).locator('.star-table__summary-label')).toHaveCSS(
      'margin-inline-end',
      '6px',
    );
    const januaries = await groups.locator('td:nth-child(3)').allTextContents();
    const total = januaries.map(money).reduce((a, b) => a + b, 0);
    expect(total).toBe(money(await footer.nth(2).textContent()));
    await live.getByRole('switch', { name: 'Group by region' }).click();
    await expect(groups).toHaveCount(0);
    await expect(footer.nth(1)).toHaveText(/Count\s*8/);
  });

  test('merges the group cells over their rows with rowspan', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const table = example(page, 'Merged group cells').getByRole('table', {
      name: 'Sales with merged regions',
    });
    await expect(table.locator('tbody tr.star-table__group')).toHaveCount(0);
    const europe = table.getByRole('cell', { name: 'Europe', exact: true });
    await expect(europe).toHaveAttribute('rowspan', '3');
    await expect(europe).toHaveCSS('vertical-align', 'top');
    // The merged cell is as tall as its three rows.
    const rows = bodyRows(table);
    const first = (await rows.nth(0).boundingBox())!;
    const third = (await rows.nth(2).boundingBox())!;
    const cell = (await europe.boundingBox())!;
    expect(Math.abs(cell.y - first.y)).toBeLessThan(2);
    expect(Math.abs(cell.y + cell.height - (third.y + third.height))).toBeLessThan(2);
    // Selection stays per row.
    await rows.nth(1).getByRole('checkbox').check();
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'false');
  });

  test('renders a window of the 60 metric columns and follows a sideways scroll', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Column virtualization');
    const table = live.getByRole('table', { name: 'Wide metrics' });
    await table.scrollIntoViewIfNeeded();
    await expect(table).toHaveAttribute('aria-colcount', '61');
    const headers = table.locator('thead th[data-field]');
    const count = await headers.count();
    expect(count).toBeLessThan(20);
    await expect(table.getByRole('columnheader', { name: 'Metric 60' })).toHaveCount(0);
    const scroll = live.locator('.star-table__scroll');
    const width = await scroll.evaluate((viewport) => viewport.scrollWidth);
    // 6 rem for the row column, 60 columns of 112 px.
    expect(width).toBeGreaterThan(60 * 112);
    await scroll.evaluate((viewport) => (viewport.scrollLeft = viewport.scrollWidth));
    const last = table.getByRole('columnheader', { name: 'Metric 60' });
    await expect(last).toBeVisible();
    await expect(last).toHaveAttribute('aria-colindex', '61');
    // The scroll width does not change while the window moves.
    expect(await scroll.evaluate((viewport) => viewport.scrollWidth)).toBe(width);
    // Header and body cells stay in line.
    const cell = bodyRows(table).first().locator('td').last();
    await expect(cell).toHaveAttribute('aria-colindex', '61');
    const a = (await last.boundingBox())!;
    const b = (await cell.boundingBox())!;
    expect(Math.abs(a.x - b.x)).toBeLessThan(2);
    // The pinned row column stays rendered and in view.
    await expect(table.getByRole('columnheader', { name: 'Row' })).toBeVisible();
  });

  test('stacks the rows as label and value lines in a narrow table', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Stacked layout');
    const table = live.getByRole('table', { name: 'Orders stacked' });
    await table.scrollIntoViewIfNeeded();
    await expect(live.locator('star-table')).toHaveClass(/star-table--stack/);
    const row = bodyRows(table).first();
    const cells = row.locator('td[data-label]');
    await expect(cells).toHaveCount(5);
    await expect(cells.first()).toHaveAttribute('data-label', 'Order');
    // Each cell is a block under the one before it, and its label comes from data-label.
    const tops = await cells.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().top)),
    );
    for (let i = 1; i < tops.length; i++) expect(tops[i]).toBeGreaterThan(tops[i - 1]);
    const label = await cells
      .first()
      .evaluate((cell) => getComputedStyle(cell, '::before').content);
    expect(label).toBe('"Order"');
    const scroll = live.locator('.star-table__scroll');
    expect(await scroll.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);

    // Sorting stays possible: the sortable headers are still buttons.
    await table.getByRole('button', { name: 'Total' }).click();
    await expect(table.getByRole('columnheader', { name: 'Total' })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  test('has no sideways page scroll at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openPage(page, '/controls/table-layout', 'Table layout');
    const overflow = await page.evaluate(() =>
      [document.documentElement, ...document.querySelectorAll('main')]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => `${element.tagName} ${element.scrollWidth}/${element.clientWidth}`),
    );
    expect(overflow).toEqual([]);
  });

  test('renders a window of rows in the virtual table and follows the scroll', async ({ page }) => {
    await openPage(page, '/controls/table-layout', 'Table layout');
    const live = example(page, 'Virtual scroll');
    const table = live.getByRole('table', { name: 'Audit log' });
    await expect(table).toHaveAttribute('aria-rowcount', '5001');
    await expect(live.locator('star-table')).toHaveClass(/star-table--virtual/);
    expect(await bodyRows(table).count()).toBeLessThan(40);
    await expect(bodyRows(table).first()).toHaveAttribute('aria-rowindex', '2');

    await live
      .locator('.star-table__scroll')
      .evaluate((viewport) => (viewport.scrollTop = 44 * 3000));
    await expect(table.locator('tr[aria-rowindex="3002"]')).toBeVisible();
    await expect(table.locator('tr[aria-rowindex="3002"]')).toContainText('ENT-03001');
    expect(await bodyRows(table).count()).toBeLessThan(40);
    // Spacer rows keep the scroll height and are hidden from assistive technology.
    await expect(table.locator('tr.star-table__spacer').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    await live.locator('.star-table__scroll').evaluate((viewport) => (viewport.scrollTop = 1e9));
    await expect(table.locator('tr[aria-rowindex="5001"]')).toContainText('ENT-05000');
  });
});

test.describe('table: export', () => {
  test('downloads a CSV file with a byte order mark, quoting and a number', async ({ page }) => {
    await openPage(page, '/controls/table-export', 'Table export');
    const live = example(page, 'Download and print');
    const download = page.waitForEvent('download');
    // Keyboard path: focus the button and press Enter.
    await live.getByRole('button', { name: 'Export CSV' }).focus();
    await page.keyboard.press('Enter');
    const file = await download;
    expect(file.suggestedFilename()).toBe('orders.csv');
    const text = (await readDownload(file)).toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    const lines = text.slice(1).split('\r\n');
    // 57 orders and a header, all pages; the selection column is not exported.
    expect(lines.length).toBe(58);
    expect(lines[0]).toBe('Order,Customer,Product,Status,Placed,Total');
    expect(lines[1]).toBe('ORD-1001,Ava Stone <ava@example.com>,Cable kit,Open,"Jan 1, 2026",12.5');
  });

  test('exports the selected rows only', async ({ page }) => {
    await openPage(page, '/controls/table-export', 'Table export');
    const live = example(page, 'Download and print');
    const button = live.getByRole('button', { name: 'Export selected rows' });
    await expect(button).toBeDisabled();
    const boxes = live.locator('tbody').getByRole('checkbox', { name: 'Select row' });
    await boxes.nth(0).check();
    await boxes.nth(3).check();
    await expect(live.getByRole('status')).toHaveText('2 selected');
    await expect(button).toBeEnabled();
    const download = page.waitForEvent('download');
    await button.click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('selected-orders.csv');
    const lines = (await readDownload(file)).toString('utf8').slice(1).split('\r\n');
    expect(lines.length).toBe(3);
    expect(lines[1]).toContain('ORD-1001');
    expect(lines[2]).toContain('ORD-1004');
  });

  test('downloads an .xlsx file that is a ZIP with the sheet and the row data', async ({
    page,
  }) => {
    await openPage(page, '/controls/table-export', 'Table export');
    const download = page.waitForEvent('download');
    await example(page, 'Download and print').getByRole('button', { name: 'Export Excel' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('orders.xlsx');
    const bytes = await readDownload(file);
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('PK\u0003\u0004');
    const text = bytes.toString('utf8');
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('<sheet name="Orders"');
    // 57 orders and one header row.
    expect(text.match(/<row r="/g)?.length).toBe(58);
    expect(text).toContain('ORD-1001');
    // The total is a number cell; the customer text comes from exportValue.
    expect(text).toContain('<c r="F2"><v>12.5</v></c>');
    expect(text).toContain('Ava Stone &lt;ava@example.com&gt;');
  });

  test('prints the table through a hidden frame', async ({ page }) => {
    // The frame document calls print(): count the calls in the top window.
    await page.addInitScript(() => {
      window.print = () => {
        const top = window.top as unknown as { printed?: string[] };
        top.printed = [...(top.printed ?? []), document.title];
      };
    });
    await openPage(page, '/controls/table-export', 'Table export');
    await example(page, 'Download and print').getByRole('button', { name: 'Print' }).click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { printed?: string[] }).printed))
      .toEqual(['Orders']);
    const frame = page.frameLocator('iframe[aria-hidden="true"]');
    await expect(frame.locator('h1')).toHaveText('Orders');
    await expect(frame.locator('thead th')).toHaveText([
      'Order',
      'Customer',
      'Product',
      'Status',
      'Placed',
      'Total',
    ]);
    await expect(frame.locator('tbody tr')).toHaveCount(57);
    // The frame is out of the way: no size, hidden from assistive technology.
    await expect(page.locator('iframe[aria-hidden="true"]')).toHaveCSS('visibility', 'hidden');
  });

  test('shows the CSV text with a separator and with rows from the options', async ({ page }) => {
    await openPage(page, '/controls/table-export', 'Table export');
    const live = example(page, 'Export text and options');
    const text = live.getByLabel('CSV text');
    await live.getByRole('button', { name: 'Comma separated' }).click();
    await expect(text).toContainText('Order,Customer,Product,Status,Placed,Total');
    expect((await text.textContent())!.split('\r\n').length).toBe(4);

    await live.getByRole('button', { name: 'Semicolon separated' }).click();
    await expect(text).toContainText('Order;Customer;Product;Status;Placed;Total');
    await expect(text).toContainText(
      'ORD-1001;Ava Stone <ava@example.com>;Cable kit;Open;Jan 1, 2026;12.5',
    );

    await live.getByRole('button', { name: 'Rows from the options' }).click();
    // The text changes after the click: wait for the new content before counting lines.
    await expect(text).toContainText('ORD-1041');
    await expect.poll(async () => (await text.textContent())!.split('\r\n').length).toBe(2);
    const lines = (await text.textContent())!.split('\r\n');
    expect(lines[1]).toContain('ORD-1041');
  });
});

test.describe('table: pages', () => {
  for (const [path, heading] of [
    ['/controls/table', 'Table'],
    ['/controls/table-sort-filter', 'Table sorting and filtering'],
    ['/controls/table-paging', 'Table paging'],
    ['/controls/table-selection', 'Table selection'],
    ['/controls/table-edit', 'Table editing'],
    ['/controls/table-columns', 'Table columns'],
    ['/controls/table-layout', 'Table layout'],
    ['/controls/table-export', 'Table export'],
    ['/controls/table-interaction', 'Table interaction'],
  ] as const) {
    test(`${path} opens without a console error and names every table`, async ({ page }) => {
      const errors = collectErrors(page);
      await openPage(page, path, heading);
      await expect(page.locator('docs-api')).toBeVisible();
      const tables = page.locator('docs-example star-table table');
      expect(await tables.count()).toBeGreaterThan(0);
      for (const table of await tables.all())
        await expect(table).toHaveAttribute('aria-label', /.+/);
      expect(errors).toEqual([]);
    });
  }

  test('the navigation has a Table group with every page', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Pages' });
    await expect(nav.getByRole('heading', { name: 'Table', exact: true })).toBeVisible();
    await nav.getByRole('searchbox', { name: 'Search pages' }).fill('xlsx');
    await expect(nav.getByRole('link')).toHaveText(['Table export']);
  });
});

test.describe('table: width', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // A table fills the live area of its example (the area inside the padding of the card). A
  // narrow wrapper in the docs (a width cap on a stack) made it about 415 px wide.
  for (const [path, heading] of [
    ['/controls/table', 'Table'],
    ['/controls/table-sort-filter', 'Table sorting and filtering'],
    ['/controls/table-paging', 'Table paging'],
    ['/controls/table-selection', 'Table selection'],
    ['/controls/table-edit', 'Table editing'],
    ['/controls/table-columns', 'Table columns'],
    ['/controls/table-layout', 'Table layout'],
    ['/controls/table-export', 'Table export'],
    ['/controls/table-interaction', 'Table interaction'],
    ['/controls/tree-table', 'Tree table'],
  ] as const) {
    test(`${path}: every table is as wide as the live area of its example`, async ({ page }) => {
      await openPage(page, path, heading);
      const widths = await page.locator('.docs-example__live').evaluateAll((lives) =>
        lives.flatMap((live) =>
          [...live.querySelectorAll('star-table, star-tree-table')]
            .filter((table) => !table.closest('.docs-stack--narrow'))
            .map((table) => {
              const style = getComputedStyle(live);
              return {
                table: table.getBoundingClientRect().width,
                live:
                  live.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
              };
            }),
        ),
      );
      expect(widths.length).toBeGreaterThan(0);
      expect(widths.every((w) => w.live > 800)).toBe(true);
      for (const w of widths) expect(Math.abs(w.table - w.live)).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('table: tools panel', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  // The last button of the tools panel ends at the end edge of the panel. The closed Columns
  // popover has no box: as a zero-size flex item it took the 8 px gap and moved the buttons.
  for (const [path, heading] of [
    ['/controls/table-columns', 'Table columns'],
    ['/controls/table-sort-filter', 'Table sorting and filtering'],
    ['/controls/table-layout', 'Table layout'],
  ] as const) {
    test(`${path}: the tool buttons end at the end edge of the panel`, async ({ page }) => {
      await openPage(page, path, heading);
      const panels = await page.locator('[data-star-part="toolsPanel"]').evaluateAll((tools) =>
        tools.map((panel) => {
          const end =
            panel.getBoundingClientRect().right - parseFloat(getComputedStyle(panel).paddingRight);
          const boxes = [...panel.children]
            .filter((child) => getComputedStyle(child).display !== 'contents')
            .map((child) => child.getBoundingClientRect());
          return {
            end,
            lastEnd: Math.max(...boxes.map((box) => box.right)),
            empty: boxes.filter((box) => box.width === 0 || box.height === 0).length,
          };
        }),
      );
      expect(panels.length).toBeGreaterThan(0);
      // The closed popover host has no box of its own.
      const hosts = page.locator('[data-star-part="toolsPanel"] > star-popover');
      expect(await hosts.count()).toBeGreaterThan(0);
      for (const host of await hosts.all()) {
        await expect(host).toHaveCSS('display', 'contents');
      }
      for (const panel of panels) {
        expect(panel.empty).toBe(0);
        expect(Math.abs(panel.end - panel.lastEnd)).toBeLessThanOrEqual(0.5);
      }
    });
  }
});
