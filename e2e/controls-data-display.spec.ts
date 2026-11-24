import { expect, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

test.describe('tree table', () => {
  test('opens and closes rows with the arrow keys and moves to the parent', async ({ page }) => {
    await openPage(page, '/controls/tree-table', 'Tree table');
    const live = example(page, 'Expand and collapse');
    const grid = live.getByRole('treegrid', { name: 'Departments' });
    const rows = grid.locator('tbody tr');
    const status = live.getByRole('status');
    const row = (key: string) => grid.locator(`tbody tr[data-key="${key}"]`);

    // Engineering is open at the start: its two children show, the others stay closed.
    await expect(rows).toHaveCount(5);
    await expect(status).toHaveText('Open: eng');
    await expect(row('eng')).toHaveAttribute('aria-expanded', 'true');
    await expect(row('apps')).toHaveAttribute('aria-expanded', 'false');
    await expect(row('finance')).not.toHaveAttribute('aria-expanded');
    await expect(row('apps')).toHaveAttribute('aria-level', '2');

    await row('eng').focus();
    await page.keyboard.press('ArrowDown');
    await expect(row('platform')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(row('apps')).toBeFocused();

    // Arrow right opens the branch and keeps the focus on the row.
    await page.keyboard.press('ArrowRight');
    await expect(row('apps')).toHaveAttribute('aria-expanded', 'true');
    await expect(rows).toHaveCount(7);
    await expect(row('web')).toHaveAttribute('aria-level', '3');
    await expect(status).toHaveText('Open: eng, apps');
    await expect(row('apps')).toBeFocused();

    // Arrow left on a leaf moves to its parent. On an open branch it closes it.
    await page.keyboard.press('ArrowDown');
    await expect(row('web')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(row('apps')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(row('apps')).toHaveAttribute('aria-expanded', 'false');
    await expect(rows).toHaveCount(5);
    await expect(status).toHaveText('Open: eng');
    await expect(row('apps')).toBeFocused();

    // Arrow up moves back, and the arrows stop at the first and last row.
    await page.keyboard.press('ArrowUp');
    await expect(row('platform')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(row('eng')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(row('eng')).toHaveAttribute('aria-expanded', 'false');
    await expect(rows).toHaveCount(3);
    await expect(status).toHaveText('Open: none');
  });

  test('a leaf row ignores arrow right and the toggle button opens a row with a click', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree-table', 'Tree table');
    const live = example(page, 'Expand and collapse');
    const grid = live.getByRole('treegrid', { name: 'Departments' });
    const rows = grid.locator('tbody tr');

    await grid.locator('tbody tr[data-key="finance"]').focus();
    await page.keyboard.press('ArrowRight');
    await expect(rows).toHaveCount(5);

    await grid.getByRole('button', { name: 'Expand Operations' }).click();
    await expect(rows).toHaveCount(7);
    await expect(live.getByRole('status')).toHaveText('Open: eng, ops');
    await expect(grid.getByRole('button', { name: 'Collapse Operations' })).toBeVisible();
    await expect(grid.locator('tbody tr[data-key="logistics"]')).toBeVisible();
  });

  test('shows the column values with the width and the alignment of each column', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree-table', 'Tree table');
    const grid = example(page, 'Column width and alignment').getByRole('treegrid');
    await expect(grid.locator('tbody tr')).toHaveCount(9);
    await expect(grid.getByRole('columnheader')).toHaveText(['Department', 'Staff', 'Budget']);
    await expect(grid.getByRole('columnheader', { name: 'Budget' })).toHaveCSS('width', /^\d/);
    const budget = grid.locator('tbody tr[data-key="web"] td').nth(2);
    await expect(budget).toHaveText('1.3M');
    await expect(budget).toHaveClass(/star-table__cell--end/);
  });
});

test.describe('data view', () => {
  test('switches between list and grid with the layout buttons', async ({ page }) => {
    await openPage(page, '/controls/data-view', 'Data view');
    const live = example(page, 'List and grid layout');
    const list = live.getByRole('radio', { name: 'List' });
    const grid = live.getByRole('radio', { name: 'Grid' });
    const items = live.locator('.star-data-view__items');

    await expect(list).toHaveAttribute('aria-checked', 'true');
    await expect(grid).toHaveAttribute('aria-checked', 'false');
    await expect(items).not.toHaveClass(/star-data-view__items--grid/);
    await expect(live.getByRole('status')).toHaveText('Layout: list');
    await expect(live.getByText('Grid card')).toHaveCount(0);

    await grid.focus();
    await page.keyboard.press('Enter');
    await expect(grid).toHaveAttribute('aria-checked', 'true');
    await expect(items).toHaveClass(/star-data-view__items--grid/);
    await expect(live.getByRole('status')).toHaveText('Layout: grid');
    await expect(live.getByText('Grid card')).toHaveCount(10);

    await list.focus();
    await page.keyboard.press('Space');
    await expect(list).toHaveAttribute('aria-checked', 'true');
    await expect(live.getByRole('status')).toHaveText('Layout: list');
  });

  test('pages through the items with the paginator', async ({ page }) => {
    await openPage(page, '/controls/data-view', 'Data view');
    const live = example(page, 'Paging');
    const items = live.locator('.star-data-view__item');

    await expect(items).toHaveCount(4);
    await expect(items.first()).toContainText('Desk lamp');
    await expect(live.getByRole('status')).toHaveText('First item on the page: 1');

    await live.getByRole('button', { name: /next/i }).click();
    await expect(items).toHaveCount(4);
    await expect(items.first()).toContainText('Wall clock');
    await expect(live.getByRole('status')).toHaveText('First item on the page: 5');

    await live.getByRole('button', { name: /next/i }).click();
    await expect(items).toHaveCount(2);
    await expect(items.first()).toContainText('Coffee mug');
    await expect(live.getByRole('status')).toHaveText('First item on the page: 9');
    await expect(live.getByRole('button', { name: /next/i })).toBeDisabled();
  });

  test('shows the items in the order that the page sets and an empty message', async ({ page }) => {
    await openPage(page, '/controls/data-view', 'Data view');
    const sorting = example(page, 'Sorting by the page');
    const names = sorting.locator('.star-data-view__item strong');
    await expect(names).toHaveText([
      'Backpack',
      'Desk lamp',
      'Notebook',
      'Wall clock',
      'Water bottle',
    ]);

    await sorting.getByRole('button', { name: 'Sort by price' }).click();
    await expect(names).toHaveText([
      'Notebook',
      'Water bottle',
      'Wall clock',
      'Desk lamp',
      'Backpack',
    ]);

    const empty = example(page, 'Empty state');
    await expect(empty.locator('.star-data-view__item')).toHaveCount(0);
    await expect(empty).toContainText('No products match this filter.');
  });
});

test.describe('order list', () => {
  test('moves the selected item with the buttons and announces the position', async ({ page }) => {
    await openPage(page, '/controls/order-list', 'Order list');
    const live = example(page, 'Reorder text items');
    const list = live.getByRole('listbox', { name: 'Release steps' });
    const options = list.getByRole('option');
    const status = live.getByRole('status');
    const button = (name: string) => live.getByRole('button', { name, exact: true });

    await expect(options).toHaveText(['Plan', 'Build', 'Test', 'Release']);
    // Nothing is selected: every move button is disabled.
    await expect(button('Move up')).toBeDisabled();
    await expect(button('Move to bottom')).toBeDisabled();

    await list.getByRole('option', { name: 'Build' }).click();
    await expect(list.getByRole('option', { name: 'Build' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await button('Move down').click();
    await expect(options).toHaveText(['Plan', 'Test', 'Build', 'Release']);
    await expect(status.first()).toHaveText('Order: Plan > Test > Build > Release');
    await expect(live.locator('[aria-live=polite]')).toHaveText('Build, position 3 of 4');

    await button('Move to top').click();
    await expect(options).toHaveText(['Build', 'Plan', 'Test', 'Release']);
    // The first item cannot move up or to the top.
    await expect(button('Move up')).toBeDisabled();
    await expect(button('Move to top')).toBeDisabled();

    await button('Move to bottom').click();
    await expect(options).toHaveText(['Plan', 'Test', 'Release', 'Build']);
    await expect(button('Move down')).toBeDisabled();
    await button('Move up').click();
    await expect(options).toHaveText(['Plan', 'Test', 'Build', 'Release']);
  });

  test('moves the focused item with Alt and the arrow keys and keeps the focus on it', async ({
    page,
  }) => {
    await openPage(page, '/controls/order-list', 'Order list');
    const live = example(page, 'Reorder text items');
    const list = live.getByRole('listbox', { name: 'Release steps' });
    const options = list.getByRole('option');
    const status = live.getByRole('status');

    await options.nth(2).focus();
    await expect(options.nth(2)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Alt+ArrowUp');
    await expect(options).toHaveText(['Plan', 'Test', 'Build', 'Release']);
    await expect(status).toHaveText('Order: Plan > Test > Build > Release');
    await expect(options.nth(1)).toBeFocused();

    await page.keyboard.press('Alt+ArrowUp');
    await expect(options).toHaveText(['Test', 'Plan', 'Build', 'Release']);
    await expect(options.nth(0)).toBeFocused();
    // At the top the item stays where it is.
    await page.keyboard.press('Alt+ArrowUp');
    await expect(options).toHaveText(['Test', 'Plan', 'Build', 'Release']);

    await page.keyboard.press('Alt+ArrowDown');
    await expect(options).toHaveText(['Plan', 'Test', 'Build', 'Release']);
    await expect(options.nth(1)).toBeFocused();

    // Plain arrows only move the focus, and they stop at the ends.
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(3)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(options.nth(2)).toBeFocused();
    await expect(options).toHaveText(['Plan', 'Test', 'Build', 'Release']);
  });

  test('keeps the objects in the model and shows their label', async ({ page }) => {
    await openPage(page, '/controls/order-list', 'Order list');
    const live = example(page, 'Objects with optionLabel');
    const options = live.getByRole('listbox', { name: 'Task playlist' }).getByRole('option');

    await expect(live.getByRole('status')).toHaveText('Ids: 1, 2, 3, 4');
    await options.nth(3).focus();
    await page.keyboard.press('Alt+ArrowUp');
    await page.keyboard.press('Alt+ArrowUp');
    await expect(options).toHaveText([
      'Review the report',
      'Book the meeting room',
      'Send the invoices',
      'Update the roadmap',
    ]);
    await expect(live.getByRole('status')).toHaveText('Ids: 1, 4, 2, 3');
  });
});

test.describe('order list depth', () => {
  test('selects a range with Shift and moves the selected items together', async ({ page }) => {
    await openPage(page, '/controls/order-list', 'Order list');
    const live = example(page, 'Several selected items');
    const list = live.getByRole('listbox', { name: 'Batch order' });
    await list.getByRole('option', { name: 'Pack' }).click();
    await page.keyboard.press('Shift+ArrowDown');
    await expect(live.getByRole('status')).toHaveText('Selected: Pack, Label');
    await list.getByRole('option', { name: 'Load' }).click({ modifiers: ['ControlOrMeta'] });
    await expect(live.getByRole('status')).toHaveText('Selected: Pack, Label, Load');
    await live.getByRole('button', { name: 'Move to bottom' }).click();
    await expect(list.getByRole('option')).toHaveText(['Weigh', 'Ship', 'Pack', 'Label', 'Load']);
  });

  test('filters, names the list by its header and reorders by drag', async ({ page }) => {
    await openPage(page, '/controls/order-list', 'Order list');
    const live = example(page, 'Header, filter and drag and drop');
    const list = live.getByRole('listbox', { name: 'Delivery queue' });
    await expect(list.getByRole('option')).toHaveCount(5);
    await list
      .getByRole('option', { name: 'Order 1045' })
      .dragTo(list.getByRole('option', { name: 'Order 1041' }));
    await expect(list.getByRole('option').first()).toHaveText('Order 1045');
    await expect(live.getByRole('status')).toContainText('Last moved: Order 1045');
    await live.getByRole('searchbox').fill('1043');
    await expect(list.getByRole('option')).toHaveText(['Order 1043']);
  });
});

test.describe('pick list', () => {
  test('moves selected items with the buttons and shows the counts', async ({ page }) => {
    await openPage(page, '/controls/pick-list', 'Pick list');
    const live = example(page, 'Move text items');
    const source = live.getByRole('listbox', { name: /Available/ });
    const target = live.getByRole('listbox', { name: /Selected/ });
    const button = (name: string) => live.getByRole('button', { name, exact: true });

    await expect(source.getByRole('option')).toHaveText(['Berlin', 'Lisbon', 'Oslo', 'Prague']);
    await expect(target.getByRole('option')).toHaveCount(0);
    // The empty text is next to the listbox: a listbox holds options only.
    await expect(target).toHaveText('');
    await expect(
      live.locator('.star-pick-list__side').nth(1).locator('.star-listbox__empty'),
    ).toHaveText('No options available');
    await expect(button('Move selected to target')).toBeDisabled();
    await expect(button('Move all to source')).toBeDisabled();

    // Space selects an item, and a click adds to the selection.
    await source.getByRole('option', { name: 'Lisbon' }).focus();
    await page.keyboard.press('Space');
    await expect(source.getByRole('option', { name: 'Lisbon' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await source.getByRole('option', { name: 'Prague' }).click();
    await button('Move selected to target').click();
    await expect(source.getByRole('option')).toHaveText(['Berlin', 'Oslo']);
    await expect(target.getByRole('option')).toHaveText(['Lisbon', 'Prague']);
    await expect(live.getByRole('status')).toHaveText('Chosen: Lisbon, Prague');
    await expect(live.getByRole('heading', { name: /Available/ })).toContainText('2');
    await expect(live.getByRole('heading', { name: /Selected/ })).toContainText('2');

    await button('Move all to target').click();
    await expect(source.getByRole('option')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Chosen: Lisbon, Prague, Berlin, Oslo');

    await target.getByRole('option', { name: 'Oslo' }).click();
    await button('Move selected to source').click();
    await expect(source.getByRole('option')).toHaveText(['Oslo']);
    await button('Move all to source').click();
    await expect(target.getByRole('option')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Chosen: none');
    await expect(source.getByRole('option')).toHaveCount(4);
  });

  test('moves one item with Enter or a double click', async ({ page }) => {
    await openPage(page, '/controls/pick-list', 'Pick list');
    const live = example(page, 'Move text items');
    const source = live.getByRole('listbox', { name: /Available/ });
    const target = live.getByRole('listbox', { name: /Selected/ });

    await source.getByRole('option', { name: 'Oslo' }).focus();
    await page.keyboard.press('Enter');
    await expect(target.getByRole('option')).toHaveText(['Oslo']);
    await expect(source.getByRole('option')).toHaveText(['Berlin', 'Lisbon', 'Prague']);

    await source.getByRole('option', { name: 'Berlin' }).dblclick();
    await expect(target.getByRole('option')).toHaveText(['Oslo', 'Berlin']);
    await expect(live.getByRole('status')).toHaveText('Chosen: Oslo, Berlin');

    await target.getByRole('option', { name: 'Oslo' }).focus();
    await page.keyboard.press('Enter');
    await expect(target.getByRole('option')).toHaveText(['Berlin']);
    await expect(source.getByRole('option')).toHaveText(['Lisbon', 'Prague', 'Oslo']);
  });

  test('uses the headers and the labels of objects', async ({ page }) => {
    await openPage(page, '/controls/pick-list', 'Pick list');
    const live = example(page, 'Objects and headers');
    const source = live.getByRole('listbox', { name: /Available people/ });
    const target = live.getByRole('listbox', { name: /Project team/ });

    await expect(source.getByRole('option')).toHaveText(['Ada Ford', 'Ben Hale', 'Cora Lind']);
    await expect(live.getByRole('status')).toHaveText('Team size: 1');
    await source.getByRole('option', { name: 'Ben Hale' }).focus();
    await page.keyboard.press('Enter');
    await expect(target.getByRole('option')).toHaveText(['Dan Moss', 'Ben Hale']);
    await expect(live.getByRole('status')).toHaveText('Team size: 2');
  });

  test('filters, moves by keyboard and by drag, and reorders the target', async ({ page }) => {
    await openPage(page, '/controls/pick-list', 'Pick list');
    const live = example(page, 'Filter, drag and drop and reorder');
    const source = live.getByRole('listbox', { name: /Cities/ });
    const target = live.getByRole('listbox', { name: /Route/ });

    await live.getByRole('searchbox', { name: 'Find a city' }).fill('l');
    await expect(source.getByRole('option')).toHaveText(['Lisbon', 'Lyon', 'Leeds']);
    await source.getByRole('option', { name: 'Lyon' }).focus();
    await page.keyboard.press('Enter');
    await expect(target.getByRole('option')).toHaveText(['Berlin', 'Lyon']);
    await expect(live.getByRole('status')).toHaveText('Last move: to the route: Lyon');

    await source
      .getByRole('option', { name: 'Leeds' })
      .dragTo(target.getByRole('option', { name: 'Berlin' }));
    await expect(target.getByRole('option')).toHaveText(['Leeds', 'Berlin', 'Lyon']);

    await target.getByRole('option', { name: 'Lyon' }).click();
    await live
      .getByRole('group', { name: 'Move selected item' })
      .getByRole('button', { name: 'Move to top' })
      .click();
    await expect(target.getByRole('option')).toHaveText(['Lyon', 'Leeds', 'Berlin']);
    await expect(live.getByRole('status')).toHaveText('Last move: route reordered: Lyon');
  });
});

test.describe('organization chart', () => {
  test('hides and shows a branch with the toggle button', async ({ page }) => {
    await openPage(page, '/controls/org-chart', 'Organization chart');
    const live = example(page, 'Expand and collapse');
    const chart = live.getByRole('list', { name: 'Company' });
    const status = live.getByRole('status');
    const labels = chart.locator('.star-org__label');

    await expect(labels).toHaveText([
      'Maya Brandt',
      'Leo Fischer',
      'Ines Costa',
      'Omar Haddad',
      'Nora Lindqvist',
    ]);
    // Nested lists: the grandchildren are three lists deep.
    await expect(live.locator('star-org-chart ul ul ul li')).toHaveCount(2);
    await expect(status).toHaveText('Collapsed: none');

    const collapse = live.getByRole('button', { name: 'Collapse row: Leo Fischer' });
    await collapse.focus();
    await expect(collapse).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Enter');
    await expect(labels).toHaveText(['Maya Brandt', 'Leo Fischer', 'Nora Lindqvist']);
    await expect(status).toHaveText('Collapsed: eng');

    const expand = live.getByRole('button', { name: 'Expand row: Leo Fischer' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect(expand).toBeFocused();
    await page.keyboard.press('Space');
    await expect(labels).toHaveCount(5);
    await expect(status).toHaveText('Collapsed: none');

    // A leaf has no toggle.
    await expect(live.getByRole('button', { name: /Nora Lindqvist/ })).toHaveCount(0);

    // The root collapses to one node.
    await live.getByRole('button', { name: 'Collapse row: Maya Brandt' }).click();
    await expect(labels).toHaveText(['Maya Brandt']);
    await expect(status).toHaveText('Collapsed: ceo');
  });

  test('selects one node with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/org-chart', 'Organization chart');
    const live = example(page, 'Selectable nodes');
    const selected = live.getByRole('status').filter({ hasText: 'Selected:' });
    const last = live.getByRole('status').filter({ hasText: 'Last node:' });
    const node = (name: RegExp) => live.getByRole('button', { name });

    await expect(selected).toHaveText('Selected: none');
    const operations = node(/Nora Lindqvist/);
    await operations.focus();
    await expect(operations).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Enter');
    await expect(operations).toHaveAttribute('aria-pressed', 'true');
    await expect(selected).toHaveText('Selected: ops');
    await expect(last).toHaveText('Last node: Nora Lindqvist');

    // Only one node is selected at a time.
    const leo = node(/Leo Fischer Engineering/);
    await leo.focus();
    await page.keyboard.press('Space');
    await expect(leo).toHaveAttribute('aria-pressed', 'true');
    await expect(operations).toHaveAttribute('aria-pressed', 'false');
    await expect(selected).toHaveText('Selected: eng');
    await expect(last).toHaveText('Last node: Leo Fischer');
    await expect(live.locator('.star-org__node--selected')).toHaveCount(1);
  });

  test('draws custom node content with the level of each node', async ({ page }) => {
    await openPage(page, '/controls/org-chart', 'Organization chart');
    const live = example(page, 'Custom node content');
    const cards = live.locator('.star-org__card');
    await expect(cards).toHaveCount(5);
    await expect(cards.first()).toContainText('Maya Brandt');
    await expect(cards.first()).toContainText('Level 0');
    await expect(cards.nth(2)).toContainText('Ines Costa');
    await expect(cards.nth(2)).toContainText('Level 2');
    await expect(live.locator('.star-org__label')).toHaveCount(0);
  });
});

test.describe('data display pages', () => {
  test('open without a console error', async ({ page }) => {
    const errors = collectErrors(page);
    for (const [path, heading] of [
      ['/controls/tree-table', 'Tree table'],
      ['/controls/data-view', 'Data view'],
      ['/controls/order-list', 'Order list'],
      ['/controls/pick-list', 'Pick list'],
      ['/controls/org-chart', 'Organization chart'],
    ] as const) {
      await openPage(page, path, heading);
      await expect(page.locator('docs-example').first()).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});

test.describe('empty state', () => {
  test('shows the variants, emits retry and announces the state that replaces loading', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/empty-state', 'Empty state');
    const variants = example(page, 'Variants');
    await expect(
      variants.getByRole('heading', { level: 3, name: 'No orders found' }),
    ).toBeVisible();
    await expect(
      variants.getByRole('heading', { level: 3, name: "You're all caught up" }),
    ).toBeVisible();
    await variants.getByRole('button', { name: 'Retry' }).click();
    await expect(variants.getByText('Retry pressed 1 times.')).toBeVisible();

    const status = example(page, 'Heading level and status region');
    await status.getByRole('button', { name: 'Load messages' }).click();
    const region = status.getByRole('status');
    await expect(region).toContainText('No messages');
    await expect(region.getByRole('heading', { level: 3, name: 'No messages' })).toBeVisible();

    // The table shows the empty state as plain text in its single cell.
    const table = example(page, 'In a table').getByRole('table', { name: 'Orders of today' });
    await expect(table.locator('.star-table__empty star-empty-state')).toHaveText(
      'No orders today.',
    );
    await expect(table.getByRole('heading')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('description list', () => {
  test('renders dl pairs, the placeholder and the tooltip of a cut value', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/description-list', 'Description list');
    const stacked = example(page, 'Label and value pairs');
    const pairs = stacked.locator('dl > div');
    await expect(pairs).toHaveCount(4);
    await expect(pairs.nth(0).locator('dt')).toHaveText('Organization');
    await expect(pairs.nth(0).locator('dd')).toHaveText('Example Trading');
    await expect(pairs.nth(3).locator('dd [aria-hidden="true"]')).toHaveText('—');
    await expect(pairs.nth(3).locator('dd')).toContainText('No value');

    // Projected items render in the dl; their element is not in the page.
    const content = example(page, 'Content as the value');
    await expect(content.locator('star-description-item')).toHaveCount(0);
    await expect(content.locator('dd a[href="mailto:orders@example.com"]')).toBeVisible();
    await expect(content.locator('dl > div').nth(3).locator('dd')).toContainText('No value');

    // Columns flow into three columns on a wide page.
    const columns = example(page, 'Columns').locator('dl');
    await expect(columns).toHaveCSS('column-count', '3');

    const long = example(page, 'Long values');
    const [wrapped, cut] = [
      long.locator('star-description-list').nth(0),
      long.locator('star-description-list').nth(1),
    ];
    await expect(wrapped.locator('[tabindex]')).toHaveCount(0);
    const value = cut.locator('.star-description-list__text[tabindex="0"]').first();
    await value.focus();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toHaveText(
      'Unit 4, North Industrial Park, 1200 Harbor Road, Example City',
    );
    await expect(value).toHaveAttribute('aria-describedby', (await tooltip.getAttribute('id'))!);
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    await expect(cut.locator('dl > div').nth(2).locator('dd')).toHaveText('Not set');
    expect(errors).toEqual([]);
  });
});
