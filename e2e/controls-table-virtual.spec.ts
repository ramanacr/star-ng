import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, example, needsDevBuild, openPage } from './support';

/**
 * Virtual scroll of the table with rows of different heights (row detail, groups, stacked
 * layout), with real layout. The examples are on the Table layout page.
 */

const DETAIL = 'Virtual scroll with row detail';
const GROUPS = 'Virtual scroll with groups';
const STACK = 'Virtual scroll in the stacked layout';
/** Upper limit of rendered rows: the rows in view of a 24rem area plus 5 above and 5 below. */
const MAX_ROWS = 45;

const ticket = (n: number) => `TCK-${String(n).padStart(5, '0')}`;
const bodyRows = (table: Locator) => table.locator('tbody tr.star-table__row');

async function open(page: Page, heading: string, name: string) {
  await openPage(page, '/controls/table-layout', 'Table layout');
  const live = example(page, heading);
  const table = live.getByRole('table', { name });
  const scroll = live.locator('.star-table__scroll');
  await table.scrollIntoViewIfNeeded();
  await expect(bodyRows(table).first()).toBeVisible();
  await settle(scroll);
  return { live, table, scroll, host: live.locator('star-table') };
}

/** Waits until the scroll offset, the scroll height and the rendered rows stop changing. */
async function settle(scroll: Locator): Promise<void> {
  await scroll.evaluate(async (el) => {
    const frame = () => new Promise((done) => requestAnimationFrame(() => setTimeout(done, 10)));
    let last = '';
    for (let i = 0; i < 100; i++) {
      await frame();
      await frame();
      const rows = el.querySelectorAll('tbody tr[data-vi]');
      const state = [
        el.scrollTop,
        el.scrollHeight,
        rows.length,
        rows[0]?.getAttribute('data-vi'),
        rows[rows.length - 1]?.getBoundingClientRect().height,
      ].join('|');
      if (state === last) return;
      last = state;
    }
    // Measuring and scroll corrections that never end would be a feedback loop.
    throw new Error(`The table did not settle: ${last}`);
  });
}

/** Where to scroll: a share of the largest scroll offset, a distance, or an offset. */
type ScrollTarget = { readonly share: number } | { readonly by: number } | { readonly top: number };

/** Sets the scroll offset and waits until the table has rendered and measured the rows. */
async function scrollTo(scroll: Locator, target: ScrollTarget): Promise<void> {
  await scroll.evaluate((el, to) => {
    if ('share' in to) el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * to.share);
    else if ('by' in to) el.scrollTop += to.by;
    else el.scrollTop = to.top;
  }, target);
  await settle(scroll);
}

/** Scrolls to the end until the end stays the end (the last rows were measured). */
async function scrollToEnd(scroll: Locator): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await scrollTo(scroll, { share: 1 });
    const atEnd = await scroll.evaluate(
      (el) => Math.abs(el.scrollTop - (el.scrollHeight - el.clientHeight)) <= 1,
    );
    if (atEnd) return;
  }
}

/** The first row in view below the sticky header: its ticket number and its top in the area. */
async function topRow(scroll: Locator): Promise<{ id: string; top: number }> {
  return scroll.evaluate((el) => {
    const area = el.getBoundingClientRect();
    const head = el.querySelector('thead')!.getBoundingClientRect();
    const line = Math.max(area.top + el.clientTop, head.bottom);
    const row = Array.from(el.querySelectorAll<HTMLElement>('tbody tr.star-table__row')).find(
      (item) => item.getBoundingClientRect().bottom > line + 1,
    );
    return {
      id: /TCK-\d{5}/.exec(row?.textContent ?? '')?.[0] ?? '',
      top: (row?.getBoundingClientRect().top ?? 0) - area.top,
    };
  });
}

/** Top of the row of a ticket in the scroll area, or null when it is not rendered. */
async function topOf(scroll: Locator, id: string): Promise<number | null> {
  return scroll.evaluate((el, wanted) => {
    const row = Array.from(el.querySelectorAll<HTMLElement>('tbody tr.star-table__row')).find(
      (item) => item.textContent?.includes(wanted),
    );
    return row ? row.getBoundingClientRect().top - el.getBoundingClientRect().top : null;
  }, id);
}

/** True when the rendered rows cover the whole view: no empty spacer area is visible. */
async function viewIsCovered(scroll: Locator): Promise<boolean> {
  return scroll.evaluate((el) => {
    const area = el.getBoundingClientRect();
    const rows = Array.from(el.querySelectorAll<HTMLElement>('tbody tr[data-vi]')).map((row) =>
      row.getBoundingClientRect(),
    );
    const body = el.querySelector('tbody')!.getBoundingClientRect();
    const top = Math.max(area.top + el.clientTop, body.top);
    const bottom = Math.min(area.top + el.clientTop + el.clientHeight, body.bottom);
    return (
      rows.length > 0 &&
      Math.min(...rows.map((row) => row.top)) <= top + 1 &&
      Math.max(...rows.map((row) => row.bottom)) >= bottom - 1
    );
  });
}

test.describe('table virtual scroll with rows of different heights', () => {
  test('renders a bounded number of rows at the start, the middle and the end of 50,000 rows', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const { table, scroll, host } = await open(page, DETAIL, 'Tickets with detail');
    await expect(host).toHaveClass(/star-table--variable/);
    await expect(table).toHaveAttribute('aria-rowcount', '50001');
    expect(await bodyRows(table).count()).toBeLessThan(MAX_ROWS);
    await expect(bodyRows(table).first()).toHaveAttribute('aria-rowindex', '2');
    expect(await viewIsCovered(scroll)).toBe(true);

    // The middle: the first row in view is near the middle of the data (estimates place it).
    await scrollTo(scroll, { share: 0.5 });
    expect(await bodyRows(table).count()).toBeLessThan(MAX_ROWS);
    expect(await viewIsCovered(scroll)).toBe(true);
    const middle = Number((await topRow(scroll)).id.slice(4));
    expect(middle).toBeGreaterThan(50_000 * 0.4);
    expect(middle).toBeLessThan(50_000 * 0.6);

    // The end: the last row is in view and the scroll bar is at its end.
    await scrollToEnd(scroll);
    const last = table.locator('tr[aria-rowindex="50001"]');
    await expect(last).toContainText(ticket(50_000));
    await expect(last).toBeInViewport();
    expect(await bodyRows(table).count()).toBeLessThan(MAX_ROWS);
    const end = await scroll.evaluate((el) => ({
      top: el.scrollTop,
      max: el.scrollHeight - el.clientHeight,
    }));
    expect(Math.abs(end.top - end.max)).toBeLessThanOrEqual(1);
    expect(await viewIsCovered(scroll)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('scrolling up into rows never measured moves the rows by the scroll distance only', async ({
    page,
  }) => {
    const { scroll } = await open(page, DETAIL, 'Tickets with detail');
    // Rows near 60 % were never rendered: their height is the estimate until they are measured.
    await scrollTo(scroll, { share: 0.6 });
    for (let step = 0; step < 8; step++) {
      const before = await topRow(scroll);
      await scrollTo(scroll, { by: -150 });
      const after = await topOf(scroll, before.id);
      expect(after, `row ${before.id} is still rendered`).not.toBeNull();
      // Rows above the view got their real height; the table moved the scroll offset by the
      // difference, so the row moved by the 150 px of the scroll, not more, not less.
      expect(Math.abs(after! - before.top - 150), `step ${step}`).toBeLessThanOrEqual(2);
    }
  });

  test('expanding a row pushes later rows down without a jump of the first row in view', async ({
    page,
  }) => {
    const { table, scroll, live } = await open(page, DETAIL, 'Tickets with detail');
    await scrollTo(scroll, { share: 0.3 });
    const first = await topRow(scroll);
    const firstNumber = Number(first.id.slice(4));
    const next = ticket(firstNumber + 1);
    const later = ticket(firstNumber + 2);
    const laterTop = (await topOf(scroll, later))!;

    const row = bodyRows(table).filter({ hasText: next });
    await row.getByRole('button', { name: 'Expand row' }).click();
    const detail = table.locator('tr.star-table__expansion');
    await expect(detail).toHaveCount(1);
    await settle(scroll);
    await expect(live.getByRole('status')).toContainText('Open: 1');

    const now = await topRow(scroll);
    expect(now.id).toBe(first.id);
    expect(Math.abs(now.top - first.top)).toBeLessThanOrEqual(1);
    const height = (await detail.boundingBox())!.height;
    expect(height).toBeGreaterThan(20);
    expect(Math.abs((await topOf(scroll, later))! - laterTop - height)).toBeLessThanOrEqual(2);

    // The button names the detail row, which is rendered, and the detail row is numbered.
    const button = row.getByRole('button', { name: 'Collapse row' });
    const id = await button.getAttribute('aria-controls');
    expect(id).toBeTruthy();
    await expect(table.locator(`[id="${id}"]`)).toHaveCount(1);
    const index = Number(await row.getAttribute('aria-rowindex'));
    await expect(detail).toHaveAttribute('aria-rowindex', String(index + 1));
    await expect(bodyRows(table).filter({ hasText: later })).toHaveAttribute(
      'aria-rowindex',
      String(index + 2),
    );
    await expect(table).toHaveAttribute('aria-rowcount', '50002');

    // Closing it moves the later rows back up.
    await button.click();
    await expect(detail).toHaveCount(0);
    await settle(scroll);
    expect(Math.abs((await topOf(scroll, later))! - laterTop)).toBeLessThanOrEqual(2);
    expect((await topRow(scroll)).id).toBe(first.id);
  });

  test('keeps the focused row rendered when it leaves the view, and Tab goes on to the next row', async ({
    page,
  }) => {
    const { table, scroll } = await open(page, DETAIL, 'Tickets with detail');
    const third = bodyRows(table).filter({ hasText: ticket(3) });
    await third.getByRole('button', { name: 'Expand row' }).focus();
    await scrollTo(scroll, { share: 0.5 });

    // The row stays in the DOM, out of view, and keeps the focus and its position number.
    const focused = () =>
      page.evaluate(() => {
        const row = document.activeElement?.closest('tr');
        return /TCK-\d{5}/.exec(row?.textContent ?? '')?.[0] ?? document.activeElement?.tagName;
      });
    expect(await focused()).toBe(ticket(3));
    await expect(third).toHaveAttribute('aria-rowindex', '4');
    expect(await bodyRows(table).count()).toBeLessThan(MAX_ROWS + 1);

    // Tab: the checkbox of the same row, then the next row, scrolled into view.
    await page.keyboard.press('Tab');
    expect(await focused()).toBe(ticket(3));
    await page.keyboard.press('Tab');
    await expect.poll(focused).toBe(ticket(4));
    await expect(bodyRows(table).filter({ hasText: ticket(4) })).toBeInViewport();
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Expand row');

    // Shift + Tab twice goes back to the expand button of the row before.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect.poll(focused).toBe(ticket(3));
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Expand row');

    // Space opens the detail of the focused row.
    await page.keyboard.press('Space');
    await expect(table.locator('tr.star-table__expansion')).toHaveCount(1);

    // Shift + Tab from a focused row below the window: the row before scrolls in.
    await scrollTo(scroll, { share: 0.5 });
    const middle = await topRow(scroll);
    const number = Number(middle.id.slice(4));
    await bodyRows(table)
      .filter({ hasText: middle.id })
      .getByRole('button', { name: 'Expand row' })
      .focus();
    await scrollTo(scroll, { top: 0 });
    expect(await focused()).toBe(middle.id);
    await page.keyboard.press('Shift+Tab');
    await expect.poll(focused).toBe(ticket(number - 1));
    await expect(page.locator(':focus')).toHaveAttribute('aria-label', 'Select row');
    await expect(bodyRows(table).filter({ hasText: ticket(number - 1) })).toBeInViewport();
  });

  test('Tab reaches rows that were not rendered when the focus entered the table', async ({
    page,
  }) => {
    const { table, scroll } = await open(page, DETAIL, 'Tickets with detail');
    const start = bodyRows(table).first().getByRole('button', { name: 'Expand row' });
    await start.focus();
    await expect(start).toBeFocused();
    // Two tab stops per row: the expand button and the checkbox.
    for (let i = 0; i < 2 * 40; i++) await page.keyboard.press('Tab');
    const row = bodyRows(table).filter({ hasText: ticket(41) });
    await expect(row.getByRole('button', { name: 'Expand row' })).toBeFocused();
    await settle(scroll);
    await expect(row).toBeInViewport();
    expect(await bodyRows(table).count()).toBeLessThan(MAX_ROWS + 1);
  });

  test('selects, sorts and exports all rows, not only the rendered ones @dev', async ({ page }) => {
    needsDevBuild();
    const { table, scroll, live, host } = await open(page, DETAIL, 'Tickets with detail');
    await table.getByRole('checkbox', { name: 'Select all rows' }).check();
    await expect(live.getByRole('status')).toContainText('selected: 50000');

    const sort = table.getByRole('button', { name: 'Ticket' });
    await sort.click();
    await sort.click();
    await expect(table.getByRole('columnheader', { name: 'Ticket' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await settle(scroll);
    await expect(bodyRows(table).first()).toContainText(ticket(50_000));

    // The CSV has the header and all 50,000 rows (window.ng exists in a development build only: tag @dev).
    const lines = await host.evaluate((el) => {
      const ng = (window as unknown as { ng: { getComponent(el: Element): unknown } }).ng;
      const table = ng.getComponent(el) as { toCsv(): string };
      return table.toCsv().split('\r\n');
    });
    expect(lines).toHaveLength(50_001);
    expect(lines[1]).toContain(ticket(50_000));
  });
});

test.describe('table virtual scroll with groups', () => {
  test('numbers the heading rows and removes the rows of a closed group from the scroll height', async ({
    page,
  }) => {
    const { table, scroll, live } = await open(page, GROUPS, 'Tickets by city');
    // 20,000 rows, 8 headings and the header row.
    await expect(table).toHaveAttribute('aria-rowcount', '20009');
    const heading = table.locator('tr.star-table__group').first();
    await expect(heading).toHaveAttribute('aria-rowindex', '2');
    await expect(bodyRows(table).first()).toHaveAttribute('aria-rowindex', '3');
    const toggle = heading.getByRole('button');
    await expect(toggle).toContainText('2500');
    const city = (await toggle.textContent())!.replace(/\d+/g, '').trim();

    const before = await scroll.evaluate((el) => el.scrollHeight);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(live.getByRole('status')).toHaveText(`Closed: ${city}`);
    await settle(scroll);
    const after = await scroll.evaluate((el) => el.scrollHeight);
    // At least 2,500 rows of 40 px left the scroll height.
    expect(before - after).toBeGreaterThan(2_500 * 40);
    await expect(table).toHaveAttribute('aria-rowcount', String(20_009 - 2_500));
    await expect(table.locator('tr.star-table__group').nth(1)).toHaveAttribute(
      'aria-rowindex',
      '3',
    );

    // No row of the closed group is rendered anywhere, and the view stays covered.
    for (const share of [0.25, 0.5, 1]) {
      await scrollTo(scroll, { share });
      expect(await viewIsCovered(scroll)).toBe(true);
      const cities = await bodyRows(table).locator('td:last-child').allTextContents();
      expect(cities).not.toContain(city);
      expect(await bodyRows(table).count()).toBeLessThan(MAX_ROWS);
    }

    // Opening the group again gives the rows their space back.
    await scrollTo(scroll, { top: 0 });
    await toggle.click();
    await settle(scroll);
    expect(await scroll.evaluate((el) => el.scrollHeight)).toBeGreaterThan(after + 2_500 * 40);
  });
});

test.describe('table virtual scroll in the stacked layout', () => {
  test('scrolls through all rows at a 400 px wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 800 });
    const errors = collectErrors(page);
    const { table, scroll, host } = await open(page, STACK, 'Tickets stacked');
    await expect(host).toHaveClass(/star-table--stack/);
    await expect(host).toHaveClass(/star-table--variable/);
    // Each row is a block of label and value lines, much taller than one table line.
    expect(
      await bodyRows(table)
        .first()
        .evaluate((row) => getComputedStyle(row).display),
    ).toBe('block');
    expect((await bodyRows(table).first().boundingBox())!.height).toBeGreaterThan(100);

    const seen = new Set<string>();
    for (let step = 0; step <= 10; step++) {
      await scrollTo(scroll, { share: step / 10 });
      expect(await viewIsCovered(scroll), `step ${step}`).toBe(true);
      expect(await bodyRows(table).count()).toBeLessThan(MAX_ROWS);
      seen.add((await topRow(scroll)).id);
    }
    expect(seen.size).toBe(11);

    await scrollToEnd(scroll);
    const last = table.locator('tr[aria-rowindex="1001"]');
    await expect(last).toContainText(ticket(1000));
    await expect(last).toBeInViewport();
    const end = await scroll.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop);
    expect(Math.abs(end)).toBeLessThanOrEqual(1);
    // No sideways scroll in the stacked layout.
    expect(await scroll.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(errors).toEqual([]);
  });
});
