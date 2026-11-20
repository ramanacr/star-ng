import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

// Windowed rendering of the tree table, on the docs example "Large tree table with windowed
// rendering": 10 sites x 10 warehouses x 10 aisles x 10 bins = 11,110 open rows.
// Keys: site `b1`, warehouse `b1-2`, aisle `b1-2-3`, bin `o1-2-3-4`.

const HEADING = 'Large tree table with windowed rendering';
const TOTAL_ROWS = 11110;
const ROW_COUNT = TOTAL_ROWS + 1; // aria-rowcount: the header row counts

/** Index (0-based) of a row in the fully open table. */
function rowIndex(site: number, warehouse?: number, aisle?: number, bin?: number): number {
  let index = (site - 1) * 1111;
  if (warehouse === undefined) return index;
  index += 1 + (warehouse - 1) * 111;
  if (aisle === undefined) return index;
  index += 1 + (aisle - 1) * 11;
  return bin === undefined ? index : index + bin;
}

interface Parts {
  grid: Locator;
  scroller: Locator;
  rows: Locator;
  row: (key: string) => Locator;
  /** Row height in pixels (`virtualItemSize`), read from the page. */
  rowHeight: number;
}

async function openTable(page: Page): Promise<Parts> {
  await openPage(page, '/controls/tree-table', 'Tree table');
  const live = example(page, HEADING);
  const grid = live.getByRole('treegrid', { name: 'Stock by site' });
  const parts = {
    grid,
    scroller: live.locator('.star-table__scroll'),
    rows: grid.locator('tbody tr[data-key]'),
    row: (key: string) => grid.locator(`tbody tr[data-key="${key}"]`),
  };
  await parts.scroller.scrollIntoViewIfNeeded();
  await expect(parts.row('b1')).toBeVisible();
  const rowHeight = await parts.row('b1').evaluate((row) => row.getBoundingClientRect().height);
  return { ...parts, rowHeight };
}

/** Sets the scroll position of the scroll area. */
async function scrollTo(scroller: Locator, top: number): Promise<void> {
  await scroller.evaluate((element, value) => {
    element.scrollTop = value;
  }, top);
}

test.describe('windowed tree table', () => {
  test('renders far fewer rows than the table has, in one table with a header', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const { grid, rows, row, scroller } = await openTable(page);
    await expect(example(page, HEADING).getByRole('status')).toContainText(
      `${TOTAL_ROWS} rows, 1110 branches open`,
    );
    const count = await rows.count();
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(60);

    // One table: real table elements, the treegrid role, one header row.
    expect(await grid.evaluate((table) => table.tagName)).toBe('TABLE');
    await expect(grid.locator('thead tr')).toHaveCount(1);
    await expect(grid.getByRole('columnheader')).toHaveText(['Location', 'Kind', 'Units']);
    expect(await scroller.locator('table').count()).toBe(1);

    // The numbers come from the data, not from the DOM.
    await expect(row('b1')).toHaveAttribute('aria-level', '1');
    await expect(row('b1')).toHaveAttribute('aria-setsize', '10');
    await expect(row('b1')).toHaveAttribute('aria-posinset', '1');
    await expect(row('b1')).toHaveAttribute('aria-expanded', 'true');
    await expect(row('b1-1-2')).toHaveAttribute('aria-level', '3');
    await expect(row('o1-1-1-3')).toHaveAttribute('aria-level', '4');
    await expect(row('o1-1-1-3')).toHaveAttribute('aria-setsize', '10');
    await expect(row('o1-1-1-3')).toHaveAttribute('aria-posinset', '3');
    await expect(row('o1-1-1-3')).not.toHaveAttribute('aria-expanded');
    expect(errors).toEqual([]);
  });

  test('aria-rowcount counts all rows and the header, aria-rowindex numbers the rendered rows', async ({
    page,
  }) => {
    const { grid, rows, row, scroller, rowHeight } = await openTable(page);
    await expect(grid).toHaveAttribute('aria-rowcount', String(ROW_COUNT));
    await expect(grid.locator('thead tr')).toHaveAttribute('aria-rowindex', '1');
    await expect(row('b1')).toHaveAttribute('aria-rowindex', '2');
    await expect(row('b1-1')).toHaveAttribute('aria-rowindex', '3');

    // In the middle of the list: row 5,000 (0-based) is the row number 5,002 with the header.
    await scrollTo(scroller, 5000 * rowHeight);
    const rendered = () =>
      rows.evaluateAll((trs) =>
        trs.map((tr) => [tr.getAttribute('data-key'), Number(tr.getAttribute('aria-rowindex'))]),
      );
    // The window follows the scroll after a frame: wait until it shows the middle rows.
    await expect
      .poll(async () => {
        const first = (await rendered())[0]?.[1] as number | undefined;
        return first !== undefined && first > 4980 && first < 5010;
      })
      .toBe(true);
    const middle = await rendered();
    expect(middle.length).toBeGreaterThan(5);
    expect(middle.length).toBeLessThan(60);
    // The rendered rows are consecutive and the numbers go up by one.
    middle.forEach(([, aria], i) => expect(aria).toBe((middle[0][1] as number) + i));
    const first = middle[0][1] as number;
    expect(first).toBeGreaterThan(4980);
    expect(first).toBeLessThan(5010);
    await expect(grid).toHaveAttribute('aria-rowcount', String(ROW_COUNT));
    // The row number matches the place of the row in the fully open table.
    const bin = rowIndex(5, 5, 5, 1);
    await scrollTo(scroller, bin * rowHeight);
    await expect(row('o5-5-5-1')).toHaveAttribute('aria-rowindex', String(bin + 2));
    await expect(row('o5-5-5-1')).toHaveAttribute('aria-posinset', '1');
    // Rows that are not rendered have no tr, but they stay in the count.
    await expect(row('b1')).toHaveCount(0);
  });

  test('scrolling shows later rows and removes earlier ones, and the spacers keep the height', async ({
    page,
  }) => {
    const { grid, rows, row, scroller, rowHeight } = await openTable(page);
    const total = await scroller.evaluate((element) => element.scrollHeight);
    await scrollTo(scroller, rowIndex(10, 10, 10, 10) * rowHeight);
    const last = row('o10-10-10-10');
    await expect(last).toBeVisible();
    await expect(last).toHaveAttribute('aria-posinset', '10');
    await expect(last).toHaveAttribute('aria-rowindex', String(ROW_COUNT));
    await expect(row('b1')).toHaveCount(0);
    expect(await rows.count()).toBeLessThan(60);
    // The two spacer rows stand for the rows that are not in the DOM: the height does not change.
    expect(await scroller.evaluate((element) => element.scrollHeight)).toBe(total);
    await expect(grid.locator('tbody tr.star-table__spacer')).toHaveCount(1);

    await scrollTo(scroller, rowIndex(6, 5, 4) * rowHeight);
    await expect(row('b6-5-4')).toBeVisible();
    await expect(row('o10-10-10-10')).toHaveCount(0);
    await expect(grid.locator('tbody tr.star-table__spacer')).toHaveCount(2);

    await scrollTo(scroller, 0);
    await expect(row('b1')).toBeVisible();
    await expect(grid.locator('tbody tr.star-table__spacer')).toHaveCount(1);
  });

  test('the header stays at the top and its columns stay aligned with the body', async ({
    page,
  }) => {
    const { grid, scroller, row, rowHeight } = await openTable(page);

    const aligned = async (key: string) => {
      const heads = await grid.locator('thead th').evaluateAll((ths) =>
        ths.map((th) => {
          const box = th.getBoundingClientRect();
          return [Math.round(box.left), Math.round(box.width)];
        }),
      );
      const cells = await row(key)
        .locator('td')
        .evaluateAll((tds) =>
          tds.map((td) => {
            const box = td.getBoundingClientRect();
            return [Math.round(box.left), Math.round(box.width)];
          }),
        );
      expect(cells).toEqual(heads);
    };

    await aligned('b1');
    const area = await scroller.boundingBox();
    for (const [site, warehouse, aisle, bin] of [
      [5, 5, 5, 5],
      [9, 9, 9, 9],
      [3, 2, undefined, undefined],
    ] as const) {
      await scrollTo(scroller, rowIndex(site, warehouse, aisle, bin) * rowHeight);
      const key = bin
        ? `o${site}-${warehouse}-${aisle}-${bin}`
        : aisle
          ? `b${site}-${warehouse}-${aisle}`
          : `b${site}-${warehouse}`;
      await expect(row(key)).toBeVisible();
      // The header is at the top of the scroll area and visible.
      const header = grid.locator('thead');
      await expect(header).toBeInViewport({ ratio: 1 });
      const headerBox = (await header.boundingBox())!;
      expect(Math.abs(headerBox.y - area!.y)).toBeLessThan(4);
      // The row at the scroll position is the first one below the header.
      const top = (await row(key).boundingBox())!;
      expect(Math.abs(top.y - (headerBox.y + headerBox.height))).toBeLessThan(2);
      await aligned(key);
    }
    // A column with a width keeps it at any scroll position: the Kind column is 8rem wide.
    const kind = await grid.getByRole('columnheader', { name: 'Kind' }).boundingBox();
    expect(Math.round(kind!.width)).toBe(Math.round(8 * (await rootFontSize(page))));
  });

  test('End focuses the last row, Home the first, Arrow down and up move one row', async ({
    page,
  }) => {
    const { row } = await openTable(page);
    await row('b1').focus();
    await page.keyboard.press('End');
    await expect(row('o10-10-10-10')).toBeFocused();
    await expect(row('o10-10-10-10')).toBeInViewport();
    await page.keyboard.press('ArrowUp');
    await expect(row('o10-10-10-9')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(row('o10-10-10-10')).toBeFocused();
    await page.keyboard.press('ArrowDown'); // the last row: nothing below
    await expect(row('o10-10-10-10')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(row('b1')).toBeFocused();
    await expect(row('b1')).toBeInViewport();
    await page.keyboard.press('ArrowDown');
    await expect(row('b1-1')).toBeFocused();
  });

  test('a row that the keys reach is fully visible, below the sticky header', async ({ page }) => {
    const { grid, row } = await openTable(page);
    await row('b1').focus();
    for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowDown');
    // Row 30 of the table: site 1, warehouse 1, aisle 3 (index 1 + 1 + 2 * 11 = 24) + 6.
    await expect(row('o1-1-3-6')).toBeFocused();
    await expect(row('b1')).toHaveCount(0);
    const header = (await grid.locator('thead').boundingBox())!;
    const focused = (await row('o1-1-3-6').boundingBox())!;
    expect(focused.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
    await expect(row('o1-1-3-6')).toBeInViewport({ ratio: 1 });
    // Going up reveals the row above the window, not under the header.
    for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowUp');
    await expect(row('o1-1-2-5')).toBeFocused(); // index 30 - 12 = 18: aisle 2 starts at 13
    const upHeader = (await grid.locator('thead').boundingBox())!;
    const up = (await row('o1-1-2-5').boundingBox())!;
    expect(up.y).toBeGreaterThanOrEqual(upHeader.y + upHeader.height - 1);
  });

  test('Arrow left on a deep row goes to its parent, also when the parent is not rendered', async ({
    page,
  }) => {
    const { row, scroller, rowHeight } = await openTable(page);
    // The bin 10 of aisle 4 of warehouse 5 of site 3 at the top of the window: its aisle row is
    // 10 rows above and not rendered.
    await scrollTo(scroller, rowIndex(3, 5, 4, 10) * rowHeight);
    await expect(row('o3-5-4-10')).toBeVisible();
    await expect(row('b3-5-4')).toHaveCount(0);
    await row('o3-5-4-10').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(row('b3-5-4')).toBeFocused();
    await expect(row('b3-5-4')).toBeInViewport();
    await page.keyboard.press('ArrowLeft'); // closes the aisle
    await expect(row('b3-5-4')).toHaveAttribute('aria-expanded', 'false');
    await expect(row('b3-5-4')).toBeFocused();
    await page.keyboard.press('ArrowLeft'); // to the warehouse
    await expect(row('b3-5')).toBeFocused();
  });

  test('Arrow right opens a closed branch and keeps the focus on it', async ({ page }) => {
    const { row, grid } = await openTable(page);
    await row('b1-1-1').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(row('o1-1-1-1')).toHaveCount(0);
    await expect(grid).toHaveAttribute('aria-rowcount', String(ROW_COUNT - 10));
    await page.keyboard.press('ArrowRight');
    await expect(row('o1-1-1-1')).toBeVisible();
    await expect(row('b1-1-1')).toBeFocused();
    await expect(grid).toHaveAttribute('aria-rowcount', String(ROW_COUNT));
    // On an open branch the key does nothing more.
    await page.keyboard.press('ArrowRight');
    await expect(row('b1-1-1')).toBeFocused();
    await expect(row('b1-1-1')).toHaveAttribute('aria-expanded', 'true');
  });

  test('collapsing a large branch keeps the focus on the branch row', async ({ page }) => {
    const { row, grid, scroller, rowHeight } = await openTable(page);
    await scrollTo(scroller, rowIndex(2) * rowHeight);
    await expect(row('b2')).toBeVisible();
    await row('b2').focus();
    await expect(row('b2')).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('ArrowLeft'); // closes 1,110 rows below it
    await expect(row('b2')).toHaveAttribute('aria-expanded', 'false');
    await expect(row('b2')).toBeFocused();
    await expect(row('b2')).toHaveAttribute('tabindex', '0');
    await expect(grid).toHaveAttribute('aria-rowcount', String(ROW_COUNT - 1110));
    await expect(row('b3')).toBeVisible();
    await expect(row('b3')).toHaveAttribute('aria-rowindex', String(rowIndex(2) + 3));
    await expect(row('b2-1')).toHaveCount(0);
    await page.keyboard.press('ArrowDown');
    await expect(row('b3')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await expect(row('b2-1')).toBeVisible();
    await expect(row('b2')).toBeFocused();
  });

  test('the toggle button opens and closes a row with the mouse', async ({ page }) => {
    const { row, grid } = await openTable(page);
    await row('b1').getByRole('button', { name: 'Collapse Site 1' }).click();
    await expect(row('b1')).toHaveAttribute('aria-expanded', 'false');
    await expect(grid).toHaveAttribute('aria-rowcount', String(ROW_COUNT - 1110));
    await expect(row('b2')).toBeVisible();
    await expect(row('b2')).toHaveAttribute('aria-rowindex', '3');
    await row('b1').getByRole('button', { name: 'Expand Site 1' }).click();
    await expect(row('b1')).toHaveAttribute('aria-expanded', 'true');
    await expect(grid).toHaveAttribute('aria-rowcount', String(ROW_COUNT));
    await expect(row('b1-1')).toBeVisible();
  });

  test('the focus does not drop to the page body when the focused row scrolls out', async ({
    page,
  }) => {
    const { row, scroller } = await openTable(page);
    await row('b1-1').focus();
    await expect(row('b1-1')).toBeFocused();
    await scroller.hover();
    await page.mouse.wheel(0, 30000);
    await expect(row('b1-1')).toHaveCount(0);
    // The focus waits on the scroll area, which also holds the Tab stop now.
    await expect(scroller).toBeFocused();
    await expect(scroller).toHaveAttribute('tabindex', '0');
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

    // The keys still work from there: Arrow down moves from the active row, which scrolls back.
    await page.keyboard.press('ArrowDown');
    await expect(row('b1-1-1')).toBeFocused();
    await expect(row('b1-1-1')).toBeInViewport();
    await expect(scroller).toHaveAttribute('tabindex', '-1');
  });

  test('the focus returns to the row when it renders again', async ({ page }) => {
    const { row, scroller } = await openTable(page);
    await row('b1-1').focus();
    await scroller.hover();
    await page.mouse.wheel(0, 30000);
    await expect(scroller).toBeFocused();
    await page.mouse.wheel(0, -60000);
    await expect(row('b1-1')).toBeFocused();
  });

  test('Tab enters the table on the active row and leaves it', async ({ page }) => {
    const { row, scroller } = await openTable(page);
    await row('b1-1').focus();
    await page.keyboard.press('End');
    await expect(row('o10-10-10-10')).toBeFocused();
    await scroller.hover();
    await page.mouse.wheel(0, -60000);
    await expect(scroller).toBeFocused();
    // The scroll area is the one Tab stop: Shift+Tab leaves, Tab comes back to the active row.
    await page.keyboard.press('Shift+Tab');
    await expect(scroller).not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(row('o10-10-10-10')).toBeFocused();
    await expect(row('o10-10-10-10')).toBeInViewport();
  });

  test('the default rendering has no windowing: all rows, no spacers, no row numbers', async ({
    page,
  }) => {
    await openPage(page, '/controls/tree-table', 'Tree table');
    const grid = example(page, 'Expand and collapse').getByRole('treegrid', {
      name: 'Departments',
    });
    await expect(grid.locator('tbody tr')).toHaveCount(5);
    await expect(grid.locator('tbody tr.star-table__spacer')).toHaveCount(0);
    await expect(grid).not.toHaveAttribute('aria-rowcount');
    await expect(grid.locator('tr[aria-rowindex]')).toHaveCount(0);
    await expect(
      example(page, 'Expand and collapse').locator('.star-table__scroll'),
    ).not.toHaveAttribute('tabindex');
  });
});

test.describe('windowed tree table, right-to-left', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('star-direction', 'rtl'));
  });

  test('Arrow left opens a branch, Arrow right goes to the parent that is not rendered', async ({
    page,
  }) => {
    const { row, scroller, rowHeight } = await openTable(page);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await scrollTo(scroller, rowIndex(3, 5, 4, 10) * rowHeight);
    await expect(row('b3-5-4')).toHaveCount(0);
    await row('o3-5-4-10').focus();
    await page.keyboard.press('ArrowRight'); // toward the start: the parent
    await expect(row('b3-5-4')).toBeFocused();
    await page.keyboard.press('ArrowRight'); // closes the aisle
    await expect(row('b3-5-4')).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('ArrowLeft'); // opens it again
    await expect(row('b3-5-4')).toHaveAttribute('aria-expanded', 'true');
    await expect(row('b3-5-4')).toBeFocused();
  });
});

/** Root font size in pixels (8rem is the width of the Kind column). */
async function rootFontSize(page: Page): Promise<number> {
  return page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
}
