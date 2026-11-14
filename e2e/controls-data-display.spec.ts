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

test.describe('pick list', () => {
  test('moves selected items with the buttons and shows the counts', async ({ page }) => {
    await openPage(page, '/controls/pick-list', 'Pick list');
    const live = example(page, 'Move text items');
    const source = live.getByRole('listbox', { name: /Available/ });
    const target = live.getByRole('listbox', { name: /Selected/ });
    const button = (name: string) => live.getByRole('button', { name, exact: true });

    await expect(source.getByRole('option')).toHaveText(['Berlin', 'Lisbon', 'Oslo', 'Prague']);
    await expect(target.getByRole('option')).toHaveCount(0);
    await expect(target).toContainText('No options available');
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
