import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

test.describe('configuration guide', () => {
  test.beforeEach(async ({ page }) => {
    await openPage(page, '/guides/configuration', 'Configuration');
  });

  test('starKeyFilter blocks keys that the filter does not allow', async ({ page }) => {
    const live = example(page, 'Filtered fields');
    const quantity = live.getByLabel('Quantity');
    // The page is prerendered: keys typed before the hydration reach the plain input. Retry.
    await expect(async () => {
      await quantity.fill('');
      await quantity.pressSequentially('12a-3.');
      await expect(quantity).toHaveValue('12-3', { timeout: 500 });
    }).toPass();
    const hex = live.getByLabel('Color code (hex)');
    await hex.pressSequentially('c0ffeg');
    await expect(hex).toHaveValue('c0ffe');
  });

  test('starKeyFilter with validateOnly shows an error and does not block', async ({ page }) => {
    const live = example(page, 'Filtered fields');
    const reference = live.getByLabel('Reference');
    await expect(async () => {
      await reference.fill('');
      await reference.pressSequentially('ORD 1042');
      await expect(reference).toHaveAttribute('aria-invalid', 'true', { timeout: 500 });
    }).toPass();
    await expect(reference).toHaveValue('ORD 1042');
    await expect(live.getByText('Use letters, digits and the underscore only.')).toBeVisible();
    await reference.fill('ORD_1042');
    await expect(reference).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('starCopy copies and announces the result', async ({ page }) => {
    const live = example(page, 'Copy button');
    await live.getByRole('button', { name: 'Copy order id' }).click();
    await expect(live.getByText(/Copy: (copied|failed)/)).toBeVisible();
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText(/Copied|Copy failed/);
  });

  test('the select defaults of one component apply to its select', async ({ page }) => {
    const live = example(page, 'Defaults for one part of the page');
    await expect(live.locator('star-select')).toHaveClass(/star-select--sm/);
  });
});

test.describe('styling hooks', () => {
  test('pass-through and unstyled mode reach the parts', async ({ page }) => {
    await openPage(page, '/guides/styling-hooks', 'Styling hooks');
    await expect(page.locator('docs-styling-hooks-guide[ngh]')).toHaveCount(0, {
      timeout: 15_000,
    });
    const select = example(page, 'Pass-through on a select').locator('star-select');
    await expect(select).toHaveAttribute('data-star-part', 'root');
    const trigger = select.locator('[data-star-part="trigger"]');
    await expect(trigger).toHaveAttribute('data-test', 'city-trigger');
    await expect(trigger).toHaveCSS('font-weight', '600');

    const buttons = example(page, 'Unstyled button').locator('star-button');
    await expect(buttons.nth(0)).not.toHaveAttribute('data-star-unstyled', /.*/);
    await expect(buttons.nth(1)).toHaveAttribute('data-star-unstyled', '');
    const styled = buttons.nth(0).locator('button');
    const plain = buttons.nth(1).locator('button');
    expect(await styled.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      'rgba(0, 0, 0, 0)',
    );
    expect(await plain.evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
    expect(await plain.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('4px');
    await plain.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(plain).toBeFocused();
    expect(await plain.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(example(page, 'Unstyled button').getByRole('status')).toHaveText(
      'Pressed 1 times',
    );
  });

  test('an unstyled select works with the keyboard', async ({ page }) => {
    await openPage(page, '/guides/styling-hooks', 'Styling hooks');
    await expect(page.locator('docs-styling-hooks-guide[ngh]')).toHaveCount(0, {
      timeout: 15_000,
    });
    const combobox = example(page, 'Unstyled select').getByRole('combobox', { name: 'Plain city' });
    await combobox.focus();
    await page.keyboard.press('ArrowDown');
    const listbox = page.getByRole('listbox', { name: 'Plain city' });
    await expect(listbox).toBeVisible();
    await expect(page.locator('.star-panel[data-star-unstyled]')).toHaveCount(1);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(combobox).toHaveText(/Vienna/);
  });
});

test('unstyled mode does not reach a styled control or content inside an unstyled one', async ({
  page,
}) => {
  await openPage(page, '/guides/styling-hooks', 'Styling hooks');
  const live = example(page, 'Unstyled button');
  // The row around the two buttons becomes part of an unstyled control, as the content of an
  // unstyled dialog or card would be.
  await live.locator('.docs-row').evaluate((row) => {
    row.setAttribute('data-star-unstyled', '');
    row.setAttribute('data-star-part', 'content');
  });
  const styled = live.locator('star-button').nth(0);
  await expect(styled).not.toHaveAttribute('data-star-unstyled', /.*/);
  expect(
    await styled.locator('button').evaluate((el) => getComputedStyle(el).backgroundColor),
  ).not.toBe('rgba(0, 0, 0, 0)');
  const output = live.getByRole('status');
  await output.evaluate((el) => el.parentElement!.setAttribute('data-star-unstyled', ''));
  expect(
    await output.evaluate((el) => getComputedStyle(el).getPropertyValue('--star-primary').trim()),
  ).not.toBe('');
});

test('a token set on the unstyled control itself reaches the content inside it', async ({
  page,
}) => {
  await openPage(page, '/guides/styling-hooks', 'Styling hooks');
  const live = example(page, 'Unstyled button');
  // The row plays an unstyled control whose host sets a token, as `<star-card class="brand">`.
  await live.locator('.docs-row').evaluate((row) => {
    row.setAttribute('data-star-part', 'root');
    row.setAttribute('data-star-unstyled', '');
    (row as HTMLElement).style.setProperty('--star-primary', 'rgb(1, 2, 3)');
  });
  const nested = live.locator('star-button').nth(0);
  expect(
    await nested.evaluate((el) => getComputedStyle(el).getPropertyValue('--star-primary').trim()),
  ).toBe('rgb(1, 2, 3)');
  // A token that the host does not set comes from the theme around it, also the accent and the
  // focus ring, which unstyled mode turns into the text color on the unstyled host.
  for (const token of ['--star-surface', '--star-accent', '--star-focus-ring']) {
    const theme = await page.evaluate(
      (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
      token,
    );
    expect(theme).not.toBe('');
    expect(
      await nested.evaluate(
        (el, name) => getComputedStyle(el).getPropertyValue(name).trim(),
        token,
      ),
    ).toBe(theme);
  }
});
