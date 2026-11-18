import { expect, Page, test } from '@playwright/test';
import { example, openPage } from './support';

// The tree depth features on the docs pages: filter modes, propagation with locked nodes, lazy
// children, drag and drop with the keyboard alternative, the context menu, the methods, and the
// tree select pass-through.

async function open(page: Page, heading: string) {
  await openPage(page, '/controls/tree', 'Tree');
  const live = example(page, heading);
  await live.scrollIntoViewIfNeeded();
  const tree = live.getByRole('tree');
  const row = (key: string) => tree.locator(`[data-key="${key}"]`);
  const keys = () =>
    tree
      .getByRole('treeitem')
      .evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset['key']));
  return { live, tree, row, keys };
}

test.describe('tree depth', () => {
  test('lenient filter keeps a match with its subtree and searches the lead', async ({ page }) => {
    const { live, row, keys } = await open(page, 'Filter modes');
    await live.getByRole('searchbox').fill('chen');
    await expect(row('mobile')).toBeVisible();
    expect(await keys()).toEqual(['eng', 'mobile']);
    await live.getByRole('searchbox').fill('engineering');
    expect(await keys()).toEqual(['eng']);
    await row('eng').click();
    expect(await keys()).toEqual(['eng', 'web', 'mobile', 'ops']);
  });

  test('checkbox propagation skips locked nodes', async ({ page }) => {
    const { live, row } = await open(page, 'Checkbox propagation and locked nodes');
    await row('fin').click();
    await expect(row('fin')).toHaveAttribute('aria-checked', 'true');
    await expect(row('tax')).toHaveAttribute('aria-checked', 'false');
    await expect(live.getByRole('status')).toContainText('Value: audit, payroll');
    await row('payroll').click();
    await expect(row('fin')).toHaveAttribute('aria-checked', 'mixed');
    await expect(live.getByRole('status')).toContainText('unchecked Payroll');
  });

  test('a lazy node shows a loading row, then its children', async ({ page }) => {
    const { live, row } = await open(page, 'Lazy children');
    await row('atlas').click();
    await expect(row('atlas')).toHaveAttribute('aria-busy', 'true');
    await expect(live.locator('.star-tree__loading')).toBeVisible();
    await expect(row('atlas-design')).toBeVisible();
    await expect(row('atlas')).not.toHaveAttribute('aria-busy', 'true');
    await expect(live.locator('.star-tree__loading')).toHaveCount(0);
  });

  test('Ctrl+Shift and the arrows move a node; the owner updates the nodes', async ({ page }) => {
    const { live, row, keys } = await open(page, 'Drag and drop');
    await row('mobile').focus();
    await page.keyboard.press('Control+Shift+ArrowUp');
    await expect(live.getByRole('status')).toHaveText('Last move: Mobile before Web platform');
    expect((await keys()).slice(0, 3)).toEqual(['eng', 'mobile', 'web']);
    await expect(row('mobile')).toBeFocused();
    await expect(live.locator('[aria-live]')).toHaveText('Mobile moved before Web platform');
    await page.keyboard.press('Control+Shift+ArrowLeft');
    await expect(row('mobile')).toHaveAttribute('aria-level', '1');
    await expect(row('mobile')).toBeFocused();
  });

  test('drags a node into another with the pointer', async ({ page }) => {
    const { live, row } = await open(page, 'Drag and drop');
    await row('ops').dragTo(row('fin'));
    await expect(live.getByRole('status')).toHaveText('Last move: Operations inside Finance');
    await expect(row('ops')).toHaveAttribute('aria-level', '2');
  });

  test('the context menu opens on right click and Shift+F10', async ({ page }) => {
    const { live, row } = await open(page, 'Context menu and events');
    await row('web').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(live.getByRole('status')).toHaveText('Last action: Archive Web platform');
    await row('ops').focus();
    await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    await expect(live.getByRole('status')).toHaveText('Last action: Rename Operations');
  });

  test('the methods expand, collapse and scroll to a node', async ({ page }) => {
    const { live, row } = await open(page, 'Methods');
    await live.getByRole('button', { name: 'Show Tax' }).click();
    await expect(row('tax')).toBeInViewport();
    await live.getByRole('button', { name: 'Collapse all' }).click();
    await expect(row('tax')).toHaveCount(0);
    await live.getByRole('button', { name: 'Expand all' }).click();
    await expect(row('web')).toBeVisible();
  });
});

test.describe('tree select depth', () => {
  test('chips, lenient filter and lazy children in the panel', async ({ page }) => {
    await openPage(page, '/controls/tree-select', 'Tree select');
    const chips = example(page, 'Chips, filter mode and propagation');
    await chips.scrollIntoViewIfNeeded();
    await expect(chips.locator('.star-chip')).toHaveText(['Web platform', 'Mobile']);
    await chips.getByRole('button', { name: /Units/ }).click();
    await page.locator('.star-tree-select__panel').getByRole('searchbox').fill('dara');
    await expect(page.locator('.star-tree-select__panel [data-key="ops"]')).toBeVisible();
    await page.keyboard.press('Escape');

    const lazy = example(page, 'Lazy children');
    await lazy.getByRole('button', { name: /Team/ }).click();
    const panel = page.locator('.star-tree-select__panel');
    await panel.locator('[data-key="beacon"] .star-tree__toggle').click();
    await expect(panel.locator('[data-key="beacon-build"]')).toBeVisible();
    await panel.locator('[data-key="beacon-build"]').click();
    await expect(lazy.getByRole('status')).toHaveText('Team: beacon-build');
  });
});
