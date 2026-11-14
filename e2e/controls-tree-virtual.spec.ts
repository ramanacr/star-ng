import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

// Windowed rendering of the tree and the tree select, on the docs examples "Large tree with
// windowed rendering": 10 sites x 10 warehouses x 10 aisles x 10 orders = 11,110 open nodes.
// Keys: site `b1`, warehouse `b1-2`, aisle `b1-2-3`, order `o1-2-3-4`.

const HEADING = 'Large tree with windowed rendering';
const ROW = 34; // virtualItemSize
const TOTAL_ROWS = 11110;

/** Index (0-based) of a row in the fully open tree. */
function rowIndex(site: number, warehouse?: number, aisle?: number, order?: number): number {
  let index = (site - 1) * 1111;
  if (warehouse === undefined) return index;
  index += 1 + (warehouse - 1) * 111;
  if (aisle === undefined) return index;
  index += 1 + (aisle - 1) * 11;
  return order === undefined ? index : index + order;
}

const rowsOf = (tree: Locator) => tree.getByRole('treeitem');
const rowOf = (tree: Locator, key: string) => tree.locator(`[data-key="${key}"]`);

/** Sets the scroll position of the tree (its scroll area is the element with role tree). */
async function scrollTo(tree: Locator, top: number): Promise<void> {
  await tree.evaluate((element, value) => {
    element.scrollTop = value;
  }, top);
}

async function openTree(page: Page): Promise<Locator> {
  await openPage(page, '/controls/tree', 'Tree');
  const tree = example(page, HEADING).getByRole('tree', { name: 'Orders by site' });
  await expect(rowOf(tree, 'b1')).toBeVisible();
  return tree;
}

test.describe('windowed tree', () => {
  test('renders far fewer rows than nodes and numbers them from the data', async ({ page }) => {
    const errors = collectErrors(page);
    const tree = await openTree(page);
    await expect(example(page, HEADING).getByRole('status')).toContainText(
      `${TOTAL_ROWS} nodes, 0 orders checked`,
    );
    const count = await rowsOf(tree).count();
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(60);

    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-level', '1');
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-setsize', '10');
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-posinset', '1');
    await expect(rowOf(tree, 'b1-1')).toHaveAttribute('aria-level', '2');
    await expect(rowOf(tree, 'b1-1-2')).toHaveAttribute('aria-level', '3');
    await expect(rowOf(tree, 'o1-1-1-3')).toHaveAttribute('aria-level', '4');
    await expect(rowOf(tree, 'o1-1-1-3')).toHaveAttribute('aria-setsize', '10');
    await expect(rowOf(tree, 'o1-1-1-3')).toHaveAttribute('aria-posinset', '3');
    expect(errors).toEqual([]);
  });

  test('scrolling shows later rows and removes earlier ones', async ({ page }) => {
    const tree = await openTree(page);
    await scrollTo(tree, rowIndex(10, 10, 10, 10) * ROW);
    const last = rowOf(tree, 'o10-10-10-10');
    await expect(last).toBeVisible();
    await expect(last).toHaveAttribute('aria-posinset', '10');
    await expect(rowOf(tree, 'b1')).toHaveCount(0);
    expect(await rowsOf(tree).count()).toBeLessThan(60);

    await scrollTo(tree, rowIndex(6, 5, 4) * ROW);
    await expect(rowOf(tree, 'b6-5-4')).toBeVisible();
    await expect(rowOf(tree, 'o10-10-10-10')).toHaveCount(0);

    await scrollTo(tree, 0);
    await expect(rowOf(tree, 'b1')).toBeVisible();
  });

  test('End focuses the last row, Home the first, Arrow down and up move one row', async ({
    page,
  }) => {
    const tree = await openTree(page);
    await rowOf(tree, 'b1').focus();
    await page.keyboard.press('End');
    await expect(rowOf(tree, 'o10-10-10-10')).toBeFocused();
    await expect(rowOf(tree, 'o10-10-10-10')).toBeInViewport();
    await page.keyboard.press('ArrowUp');
    await expect(rowOf(tree, 'o10-10-10-9')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(rowOf(tree, 'o10-10-10-10')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(rowOf(tree, 'b1')).toBeFocused();
    await expect(rowOf(tree, 'b1')).toBeInViewport();
    await page.keyboard.press('ArrowDown');
    await expect(rowOf(tree, 'b1-1')).toBeFocused();
  });

  test('Arrow down past the window scrolls and keeps the focus on a row', async ({ page }) => {
    const tree = await openTree(page);
    await rowOf(tree, 'b1').focus();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowDown');
    // Row 30 of the tree: site 1, warehouse 1, aisle 3 (index 1 + 1 + 2 * 11 = 24) + 6.
    await expect(rowOf(tree, 'o1-1-3-6')).toBeFocused();
    await expect(rowOf(tree, 'o1-1-3-6')).toBeInViewport();
    await expect(rowOf(tree, 'b1')).toHaveCount(0);
  });

  test('Arrow left on a deep row goes to its parent, also when the parent is not rendered', async ({
    page,
  }) => {
    const tree = await openTree(page);
    // The order 10 of aisle 4 of warehouse 5 of site 3 at the top of the window: its aisle
    // row is 10 rows above and not rendered.
    const leaf = rowIndex(3, 5, 4, 10);
    await scrollTo(tree, leaf * ROW);
    await expect(rowOf(tree, 'o3-5-4-10')).toBeVisible();
    await expect(rowOf(tree, 'b3-5-4')).toHaveCount(0);
    await rowOf(tree, 'o3-5-4-10').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(rowOf(tree, 'b3-5-4')).toBeFocused();
    await expect(rowOf(tree, 'b3-5-4')).toBeInViewport();
    await page.keyboard.press('ArrowLeft'); // closes the aisle
    await expect(rowOf(tree, 'b3-5-4')).toHaveAttribute('aria-expanded', 'false');
    await expect(rowOf(tree, 'b3-5-4')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // to the warehouse
    await expect(rowOf(tree, 'b3-5')).toBeFocused();
  });

  test('Arrow right opens a closed branch, then goes to its first child', async ({ page }) => {
    const tree = await openTree(page);
    await rowOf(tree, 'b1-1-1').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(rowOf(tree, 'o1-1-1-1')).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(rowOf(tree, 'o1-1-1-1')).toBeVisible();
    await expect(rowOf(tree, 'b1-1-1')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(rowOf(tree, 'o1-1-1-1')).toBeFocused();
  });

  test('collapsing a large branch keeps the focus on the branch row', async ({ page }) => {
    const tree = await openTree(page);
    await scrollTo(tree, rowIndex(2) * ROW);
    await expect(rowOf(tree, 'b2')).toBeVisible();
    await rowOf(tree, 'b2').focus();
    await expect(rowOf(tree, 'b2')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowLeft'); // closes 1,110 rows below it
    await expect(rowOf(tree, 'b2')).toHaveAttribute('aria-expanded', 'false');
    await expect(rowOf(tree, 'b2')).toBeFocused();
    await expect(rowOf(tree, 'b2')).toHaveAttribute('tabindex', '0');
    await expect(rowOf(tree, 'b3')).toBeVisible();
    await expect(rowOf(tree, 'b2-1')).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await expect(rowOf(tree, 'b3')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await expect(rowOf(tree, 'b2-1')).toBeVisible();
    await expect(rowOf(tree, 'b2')).toBeFocused();
  });

  test('collapsing from the mouse and the star key work over all rows', async ({ page }) => {
    const tree = await openTree(page);
    await rowOf(tree, 'b1').locator('.star-tree__toggle').click();
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-expanded', 'false');
    await expect(rowOf(tree, 'b2')).toBeVisible();
    await rowOf(tree, 'b2').focus();
    await page.keyboard.press('ArrowLeft'); // b2 closed
    await page.keyboard.press('*'); // opens b1, b2, ... on the top level
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-expanded', 'true');
    // b1 is open again: b2 is 1,111 rows further down.
    await scrollTo(tree, rowIndex(2) * ROW);
    await expect(rowOf(tree, 'b2')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('End');
    await expect(rowOf(tree, 'o10-10-10-10')).toBeFocused();
  });

  test('checking a parent selects children that are not rendered', async ({ page }) => {
    const tree = await openTree(page);
    const status = example(page, HEADING).getByRole('status');
    await rowOf(tree, 'b1').click();
    // 1,000 orders below the site, only a handful are in the DOM.
    await expect(status).toContainText('1000 orders checked');
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-checked', 'true');
    await expect(rowOf(tree, 'o1-1-1-2')).toHaveAttribute('aria-checked', 'true');
    await expect(rowOf(tree, 'o10-10-10-10')).toHaveCount(0);
    await expect(rowOf(tree, 'o1-10-10-10')).toHaveCount(0);

    // A far row that renders later is shown as checked.
    await scrollTo(tree, rowIndex(1, 10, 10, 10) * ROW);
    await expect(rowOf(tree, 'o1-10-10-10')).toHaveAttribute('aria-checked', 'true');
    await scrollTo(tree, rowIndex(1, 10, 10) * ROW);
    await expect(rowOf(tree, 'b1-10-10')).toHaveAttribute('aria-checked', 'true');
    await scrollTo(tree, rowIndex(1, 10, 10, 10) * ROW);
    await expect(rowOf(tree, 'o1-10-10-10')).toBeVisible();

    // Unchecking one order makes every ancestor mixed.
    await rowOf(tree, 'o1-10-10-10').click();
    await expect(status).toContainText('999 orders checked');
    await scrollTo(tree, rowIndex(1, 10, 10) * ROW);
    await expect(rowOf(tree, 'b1-10-10')).toHaveAttribute('aria-checked', 'mixed');
    await scrollTo(tree, 0);
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-checked', 'mixed');
    await expect(rowOf(tree, 'b1-1')).toHaveAttribute('aria-checked', 'true');

    // Space on a site that is not checked checks its 1,000 orders; a second Space clears them.
    await scrollTo(tree, rowIndex(4) * ROW);
    await rowOf(tree, 'b4').focus();
    await page.keyboard.press('Space');
    await expect(status).toContainText('1999 orders checked');
    await page.keyboard.press('Space');
    await expect(status).toContainText('999 orders checked');
  });

  test('the filter keeps the sibling numbers of the shown rows', async ({ page }) => {
    const tree = await openTree(page);
    const live = example(page, HEADING);
    await live.getByRole('searchbox').fill('Order 3-4-5-');
    // One site, one warehouse, one aisle and 10 orders match.
    await expect(rowOf(tree, 'b3')).toHaveAttribute('aria-setsize', '1');
    await expect(rowOf(tree, 'b3')).toHaveAttribute('aria-posinset', '1');
    await expect(rowOf(tree, 'b3-4-5')).toHaveAttribute('aria-level', '3');
    await expect(rowOf(tree, 'o3-4-5-2')).toHaveAttribute('aria-posinset', '2');
    await expect(rowOf(tree, 'b1')).toHaveCount(0);
    await live.getByRole('searchbox').fill('no such order');
    await expect(rowsOf(tree)).toHaveCount(0);
    await expect(live.getByText('No results found')).toBeVisible();
    await live.getByRole('searchbox').fill('');
    await expect(rowOf(tree, 'b1')).toBeVisible();
  });

  test('the focus does not drop to the page body when the focused row scrolls out', async ({
    page,
  }) => {
    const tree = await openTree(page);
    await rowOf(tree, 'b1-1').focus();
    await expect(rowOf(tree, 'b1-1')).toBeFocused();
    await tree.hover();
    await page.mouse.wheel(0, 30000);
    await expect(rowOf(tree, 'b1-1')).toHaveCount(0);
    // The focus waits on the scroll area, which also holds the Tab stop now.
    await expect(tree).toBeFocused();
    await expect(tree).toHaveAttribute('tabindex', '0');
    const active = await page.evaluate(() => document.activeElement?.tagName);
    expect(active).not.toBe('BODY');

    // The keys still work from there: Arrow down moves from the active row, which scrolls back.
    await page.keyboard.press('ArrowDown');
    await expect(rowOf(tree, 'b1-1-1')).toBeFocused();
    await expect(rowOf(tree, 'b1-1-1')).toBeInViewport();
    await expect(tree).toHaveAttribute('tabindex', '-1');
  });

  test('the focus returns to the row when it renders again', async ({ page }) => {
    const tree = await openTree(page);
    await rowOf(tree, 'b1-1').focus();
    await tree.hover();
    await page.mouse.wheel(0, 30000);
    await expect(tree).toBeFocused();
    await page.mouse.wheel(0, -60000);
    await expect(rowOf(tree, 'b1-1')).toBeFocused();
  });

  test('Tab enters the tree on the active row and leaves it', async ({ page }) => {
    const tree = await openTree(page);
    await rowOf(tree, 'b1-1').focus();
    await page.keyboard.press('End');
    await expect(rowOf(tree, 'o10-10-10-10')).toBeFocused();
    await tree.hover();
    await page.mouse.wheel(0, -60000);
    await expect(tree).toBeFocused();
    // The viewport is the one Tab stop: Tab from the row before the tree comes back to the row.
    await page.keyboard.press('Shift+Tab');
    await expect(tree).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(rowOf(tree, 'o10-10-10-10')).toBeFocused();
    await expect(rowOf(tree, 'o10-10-10-10')).toBeInViewport();
  });
});

test.describe('windowed tree select', () => {
  async function openPanel(page: Page): Promise<{ tree: Locator; live: Locator }> {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const live = example(page, HEADING);
    await live.getByRole('button', { name: 'Orders by site' }).click();
    const tree = page.getByRole('tree', { name: 'Orders by site' });
    await expect(rowOf(tree, 'b1')).toBeFocused();
    return { tree, live };
  }

  test('opens a panel with a window of rows and moves the focus into it', async ({ page }) => {
    const errors = collectErrors(page);
    const { tree } = await openPanel(page);
    const count = await rowsOf(tree).count();
    expect(count).toBeGreaterThan(3);
    expect(count).toBeLessThan(60);
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-setsize', '10');
    expect(errors).toEqual([]);
  });

  test('End reaches the last row, Arrow left goes to its parent', async ({ page }) => {
    const { tree } = await openPanel(page);
    await page.keyboard.press('End');
    await expect(rowOf(tree, 'o10-10-10-10')).toBeFocused();
    await expect(rowOf(tree, 'o10-10-10-10')).toBeInViewport();
    await page.keyboard.press('ArrowLeft');
    await expect(rowOf(tree, 'b10-10-10')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(rowOf(tree, 'b1')).toBeFocused();
  });

  test('checks a site with Enter and shows the count in the value', async ({ page }) => {
    const { tree, live } = await openPanel(page);
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toContainText('1000 orders checked');
    await expect(rowOf(tree, 'b1')).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('End');
    await page.keyboard.press('Space');
    await expect(live.getByRole('status')).toContainText('1001 orders checked');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('tree')).toHaveCount(0);
    await expect(live.getByRole('button', { name: 'Orders by site' })).toBeFocused();
  });

  test('the filter works in the panel', async ({ page }) => {
    const { tree } = await openPanel(page);
    await page.locator('.star-tree-select__panel').getByRole('searchbox').fill('Order 7-7-7-');
    await expect(rowOf(tree, 'b7')).toHaveAttribute('aria-setsize', '1');
    await expect(rowOf(tree, 'o7-7-7-10')).toHaveAttribute('aria-posinset', '10');
    await expect(rowOf(tree, 'b1')).toHaveCount(0);
  });
});
