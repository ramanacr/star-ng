import { expect, Locator, test } from '@playwright/test';
import { example, openPage } from './support';

test.describe('accordion', () => {
  test('opens a section with Enter, moves between headers with arrows and skips a disabled one', async ({
    page,
  }) => {
    await openPage(page, '/controls/accordion', 'Accordion');
    const live = example(page, 'One section at a time');
    const shipping = live.getByRole('button', { name: 'Shipping', exact: true });
    const returns = live.getByRole('button', { name: 'Returns', exact: true });
    const status = live.getByRole('status');

    await expect(shipping).toHaveAttribute('aria-expanded', 'true');
    await expect(status).toHaveText('Open: shipping');

    await shipping.focus();
    await page.keyboard.press('ArrowDown');
    await expect(returns).toBeFocused();
    // Billing is disabled: the next header is Shipping again.
    await page.keyboard.press('ArrowDown');
    await expect(shipping).toBeFocused();
    await page.keyboard.press('End');
    await expect(returns).toBeFocused();
    await page.keyboard.press('Home');
    await expect(shipping).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(returns).toHaveAttribute('aria-expanded', 'true');
    await expect(shipping).toHaveAttribute('aria-expanded', 'false');
    await expect(status).toHaveText('Open: returns');
    await expect(live.getByRole('region', { name: 'Returns' })).not.toHaveAttribute('inert');
    // Shipping is closed now. Billing is disabled and closed too.
    await expect(live.locator('[role=region]').first()).toHaveAttribute('inert', '');
    await expect(live.locator('[role=region][inert]')).toHaveCount(2);

    await page.keyboard.press('Space');
    await expect(status).toHaveText('Open: none');
  });

  test('keeps several sections open and renders lazy content on first open', async ({ page }) => {
    await openPage(page, '/controls/accordion', 'Accordion');
    const live = example(page, 'Several sections and lazy content');
    await expect(live.getByText('Twelve items, one parcel.')).toBeVisible();
    await expect(live.getByText('Created on Monday.')).toHaveCount(0);

    await live.getByRole('button', { name: 'History', exact: true }).click();
    await expect(live.getByText('Created on Monday.')).toBeVisible();
    await expect(live.getByRole('button', { name: 'Summary', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });
});

test.describe('panel and fieldset', () => {
  test('the panel collapses from the keyboard and its body becomes inert', async ({ page }) => {
    await openPage(page, '/controls/panel', 'Panel and fieldset');
    const live = example(page, 'Panel with actions');
    const toggle = live.getByRole('button', { name: 'Collapse Order notes' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('The panel is collapsed.');
    const expand = live.getByRole('button', { name: 'Expand Order notes' });
    await expect(expand).toHaveAttribute('aria-expanded', 'false');
    await expect(live.locator('[role=region]')).toHaveAttribute('inert', '');

    await page.keyboard.press('Space');
    await expect(live.getByRole('status')).toHaveText('The panel is open.');
  });

  test('the fieldset keeps its legend as the group name and collapses', async ({ page }) => {
    await openPage(page, '/controls/panel', 'Panel and fieldset');
    const live = example(page, 'Fieldset');
    await expect(live.getByRole('group', { name: 'Contact person' })).toBeVisible();
    const toggle = live.getByRole('button', { name: 'Contact person' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(live.locator('.star-accordion__region')).toHaveAttribute('inert', '');
  });
});

test.describe('card, avatar, skeleton, chip', () => {
  test('the card shows its title, subtitle and footer', async ({ page }) => {
    await openPage(page, '/controls/card', 'Card');
    const card = example(page, 'Title, actions and footer');
    await expect(card.getByRole('heading', { name: 'Open orders' })).toBeVisible();
    await expect(card.getByText('Last 30 days')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Export' })).toBeVisible();
    await expect(example(page, 'Body only').getByRole('heading')).toHaveCount(0);
  });

  test('the avatar shows initials and falls back when the image fails', async ({ page }) => {
    await openPage(page, '/controls/avatar', 'Avatar');
    const live = example(page, 'Initials and icon');
    const jane = live.getByRole('img', { name: 'Jane Doe' });
    await expect(jane).toHaveText('JD');
    await expect(jane).toHaveClass(/star-avatar--circle/);
    await expect(live.getByRole('img', { name: 'Sam Lee' })).toHaveClass(/star-avatar--square/);

    const broken = example(page, 'Image with a fallback').getByRole('img', {
      name: 'Broken Image',
    });
    await expect(broken).toHaveText('BI');
  });

  test('the skeleton is hidden from assistive technology and swaps with the content', async ({
    page,
  }) => {
    await openPage(page, '/controls/skeleton', 'Skeleton');
    const live = example(page, 'Loading state');
    await expect(live.locator('star-skeleton').first()).toHaveAttribute('aria-hidden', 'true');
    await live.getByRole('button', { name: 'Show content' }).click();
    await expect(live.locator('star-skeleton')).toHaveCount(0);
    await expect(live.getByText('Orchard Supply')).toBeVisible();
  });

  test('a chip is removed with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/chip', 'Chip');
    const live = example(page, 'Removable');
    await expect(live.getByRole('status')).toHaveText('3 chips left.');
    await live.getByRole('button', { name: 'Remove Beta' }).focus();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('2 chips left.');
    await expect(live.getByRole('button', { name: 'Remove Beta' })).toHaveCount(0);
  });
});

test.describe('message', () => {
  test('an error message is an alert and the others are status messages', async ({ page }) => {
    await openPage(page, '/controls/message', 'Message');
    const live = example(page, 'Severities');
    await expect(live.getByRole('alert')).toHaveText('The payment was declined.');
    await expect(live.getByRole('status')).toHaveCount(3);
  });

  test('a closable message closes from the keyboard and can come back', async ({ page }) => {
    await openPage(page, '/controls/message', 'Message');
    const live = example(page, 'Closable');
    const message = live.locator('star-message');
    await expect(message).toBeVisible();

    await message.getByRole('button', { name: 'Close' }).focus();
    await page.keyboard.press('Enter');
    await expect(message).toBeHidden();
    await expect(live.getByText('Closed: 1')).toBeVisible();

    await live.getByRole('button', { name: 'Show again' }).click();
    await expect(live.locator('star-message')).toBeVisible();
  });
});

test.describe('progress bar', () => {
  test('exposes the value and clamps it between 0 and 100', async ({ page }) => {
    await openPage(page, '/controls/progress-bar', 'Progress bar');
    const live = example(page, 'Determinate');
    const bar = live.getByRole('progressbar', { name: 'Upload' });
    await expect(bar).toHaveAttribute('aria-valuenow', '40');
    await expect(bar).toContainText('40%');

    const more = live.getByRole('button', { name: 'More' });
    for (let i = 0; i < 5; i++) await more.click();
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
    await expect(bar).toHaveAttribute('aria-valuemax', '100');

    const indeterminate = example(page, 'Indeterminate').getByRole('progressbar');
    await expect(indeterminate).not.toHaveAttribute('aria-valuenow');
  });
});

test.describe('stepper', () => {
  test('free navigation: a completed step is announced and any step opens', async ({ page }) => {
    await openPage(page, '/controls/stepper', 'Stepper');
    const live = example(page, 'Free navigation');
    const list = live.getByRole('list', { name: 'Checkout steps' });
    await expect(list.getByRole('button', { name: /Address/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
    await expect(list.getByRole('button', { name: /Cart/ })).toContainText('(completed)');
    await expect(live.locator('.star-stepper__item--done')).toHaveCount(1);
    await expect(live.getByText('Enter the delivery address.')).toBeVisible();
    await expect(live.getByText('Three items in the cart.')).toBeHidden();

    await list.getByRole('button', { name: /Payment/ }).focus();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Active step: pay');
    await expect(live.getByText('Choose a way to pay.')).toBeVisible();
    await expect(live.getByText('Enter the delivery address.')).toBeHidden();
  });

  test('linear wizard: later steps unlock after the earlier step is completed', async ({
    page,
  }) => {
    await openPage(page, '/controls/stepper', 'Stepper');
    const live = example(page, 'Linear wizard');
    const confirm = live.getByRole('button', { name: /Confirm/ });
    const next = live.getByRole('button', { name: 'Next', exact: true });
    const back = live.getByRole('button', { name: 'Back', exact: true });
    await expect(confirm).toBeDisabled();
    await expect(next).toBeDisabled();
    await expect(back).toBeDisabled();

    await live.getByLabel('Your name').fill('Ada');
    await expect(confirm).toBeEnabled();
    await expect(next).toBeEnabled();

    await next.focus();
    await page.keyboard.press('Enter');
    await expect(live.getByText('Welcome, Ada. Your account is ready.')).toBeVisible();
    await expect(confirm).toHaveAttribute('aria-current', 'step');
    await expect(next).toBeDisabled();

    await back.focus();
    await page.keyboard.press('Enter');
    await expect(live.getByLabel('Your name')).toBeVisible();
    await expect(live.getByRole('button', { name: /Name/ })).toHaveAttribute(
      'aria-current',
      'step',
    );
  });
});

test.describe('tabs', () => {
  test('arrow keys select the next enabled tab and Home and End jump to the ends', async ({
    page,
  }) => {
    await openPage(page, '/controls/tabs', 'Tabs');
    const live = example(page, 'Basic tabs');
    const tab = (name: RegExp) => live.getByRole('tab', { name });
    const status = live.getByRole('status');

    await expect(tab(/^Details/)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(/^Details/)).toHaveAttribute('tabindex', '0');
    await expect(tab(/^Items/)).toHaveAttribute('tabindex', '-1');
    await expect(live.getByRole('tabpanel', { name: 'Details' })).toHaveText(
      /Order ORD-1042 for Orchard Supply/,
    );
    await expect(live.getByRole('tabpanel', { name: 'Items' })).toBeHidden();

    await tab(/^Details/).focus();
    await page.keyboard.press('ArrowRight');
    await expect(tab(/^Items/)).toBeFocused();
    await expect(tab(/^Items/)).toHaveAttribute('aria-selected', 'true');
    await expect(status).toHaveText('Selected: items');

    // Billing is disabled: the arrow goes on to History.
    await page.keyboard.press('ArrowRight');
    await expect(tab(/^History/)).toBeFocused();
    await expect(status).toHaveText('Selected: history');
    await page.keyboard.press('ArrowRight');
    await expect(tab(/^Details/)).toBeFocused();
    await page.keyboard.press('End');
    await expect(tab(/^History/)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tab(/^Details/)).toBeFocused();
    await expect(tab(/^Billing/)).toBeDisabled();
  });

  test('manual activation moves only the focus until Enter, and lazy content waits for it', async ({
    page,
  }) => {
    await openPage(page, '/controls/tabs', 'Tabs');
    const live = example(page, 'Pill tabs with manual activation');
    const daily = live.getByRole('tab', { name: 'Daily' });
    const weekly = live.getByRole('tab', { name: 'Weekly' });
    await expect(live.getByText('Weekly totals, loaded on first use.')).toHaveCount(0);

    await daily.focus();
    await page.keyboard.press('ArrowRight');
    await expect(weekly).toBeFocused();
    await expect(weekly).toHaveAttribute('aria-selected', 'false');
    await expect(daily).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('Enter');
    await expect(weekly).toHaveAttribute('aria-selected', 'true');
    await expect(live.getByText('Weekly totals, loaded on first use.')).toBeVisible();
  });
});

test.describe('paginator', () => {
  test('moves through the pages with the keyboard and reports the range', async ({ page }) => {
    await openPage(page, '/controls/paginator', 'Paginator');
    const live = example(page, 'Pages of a list');
    const nav = live.getByRole('navigation', { name: 'Pagination' });
    const report = live.locator('.star-paginator__report');
    await expect(report).toHaveText('1–10 of 95');
    await expect(nav.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await expect(nav.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );

    await nav.getByRole('button', { name: 'Next page' }).focus();
    await page.keyboard.press('Enter');
    await expect(report).toHaveText('11–20 of 95');
    await expect(nav.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.keyboard.press('Enter');
    await expect(report).toHaveText('21–30 of 95');

    await nav.getByRole('button', { name: 'Last page' }).focus();
    await page.keyboard.press('Space');
    await expect(report).toHaveText('91–95 of 95');
    await expect(nav.getByRole('button', { name: 'Next page' })).toBeDisabled();
    await expect(live.getByRole('status').last()).toContainText('records 91 to 95');
  });

  test('changing the rows per page keeps the first visible record', async ({ page }) => {
    await openPage(page, '/controls/paginator', 'Paginator');
    const live = example(page, 'Pages of a list');
    const report = live.locator('.star-paginator__report');
    await live.getByRole('button', { name: 'Last page' }).click();
    await expect(report).toHaveText('91–95 of 95');

    await live.getByLabel('Rows per page').selectOption('25');
    await expect(report).toHaveText('76–95 of 95');
    await expect(live.getByRole('button', { name: 'Page 4' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the compact paginator has no report, first or last button', async ({ page }) => {
    await openPage(page, '/controls/paginator', 'Paginator');
    const live = example(page, 'Compact');
    await expect(live.locator('.star-paginator__report')).toHaveCount(0);
    await expect(live.getByRole('button', { name: 'First page' })).toHaveCount(0);
    await expect(live.getByLabel('Rows per page')).toHaveCount(0);
    await expect(live.locator('.star-paginator__page')).toHaveCount(3);
  });
});

test.describe('breadcrumb', () => {
  test('marks the current page and keeps a name for the icon-only home link', async ({ page }) => {
    await openPage(page, '/controls/breadcrumb', 'Breadcrumb');
    const nav = example(page, 'Trail with a home link').getByRole('navigation', {
      name: 'Breadcrumb',
    });
    await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    await expect(nav.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(nav.locator('[aria-current=page]')).toHaveText('ORD-1042');
    await expect(nav.getByRole('link')).toHaveCount(2);
  });
});

test.describe('toolbar', () => {
  test('arrow keys move the focus between its controls and Enter runs one', async ({ page }) => {
    await openPage(page, '/controls/toolbar', 'Toolbar');
    const live = example(page, 'Start and end groups');
    const toolbar = live.getByRole('toolbar', { name: 'Order actions' });
    const create = toolbar.getByRole('button', { name: 'New' });
    const edit = toolbar.getByRole('button', { name: 'Edit' });
    const exportButton = toolbar.getByRole('button', { name: 'Export' });

    await create.focus();
    await page.keyboard.press('ArrowRight');
    await expect(edit).toBeFocused();
    await page.keyboard.press('End');
    await expect(exportButton).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(create).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(exportButton).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Last action: Edit');

    // Roving tabindex: only the focused control is in the tab order.
    await expect(edit.locator('xpath=self::button')).toHaveAttribute('tabindex', '0');
    await expect(create).toHaveAttribute('tabindex', '-1');
  });
});

test.describe('divider and timeline', () => {
  test('dividers have the separator role and a label', async ({ page }) => {
    await openPage(page, '/controls/divider', 'Divider');
    const live = example(page, 'Horizontal');
    await expect(live.getByRole('separator').first()).toHaveText('or');
    const vertical = example(page, 'Vertical').getByRole('separator');
    await expect(vertical.first()).toHaveAttribute('aria-orientation', 'vertical');
  });

  test('the timeline is an ordered list with a time element per dated event', async ({ page }) => {
    await openPage(page, '/controls/timeline', 'Timeline');
    const live = example(page, 'Vertical');
    const list = live.getByRole('list', { name: 'Order history' });
    await expect(list.getByRole('listitem')).toHaveCount(4);
    await expect(list.getByRole('listitem').first()).toContainText('Ordered');
    await expect(list.locator('time').first()).toHaveText('12 Mar');
    await expect(example(page, 'Custom content').getByRole('listitem').nth(1)).toContainText(
      '2. Packed',
    );
  });
});

test.describe('hit areas of small targets (WCAG 2.5.8)', () => {
  /**
   * A point near each corner of a 21 x 21 px square, centered on the target, must hit the target (a rounded corner of the target cuts the last pixel, so the square is a little smaller than 24)
   * or one of its children. The test does not read the box of the element: a hit area can come
   * from a pseudo-element.
   */
  const hasHitArea = (target: Locator) =>
    target.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      return [-1, 1].flatMap((dx) =>
        [-1, 1].map((dy) => {
          const hit = document.elementFromPoint(cx + dx * 10.5, cy + dy * 10.5);
          return !!hit && node.contains(hit);
        }),
      );
    });

  test('the chip remove button, the tree toggle and the home link are at least 24 px', async ({
    page,
  }) => {
    await openPage(page, '/controls/chip', 'Chip');
    const remove = example(page, 'Removable').getByRole('button', { name: 'Remove Beta' });
    await remove.scrollIntoViewIfNeeded();
    expect(await hasHitArea(remove)).toEqual([true, true, true, true]);

    await openPage(page, '/controls/breadcrumb', 'Breadcrumb');
    const home = example(page, 'Trail with a home link').getByRole('link', { name: 'Home' });
    await home.scrollIntoViewIfNeeded();
    expect(await hasHitArea(home)).toEqual([true, true, true, true]);

    await openPage(page, '/controls/tree', 'Tree');
    const toggle = example(page, 'Expand and collapse')
      .getByRole('tree', { name: 'Folders' })
      .locator('[data-key="docs"] .star-tree__toggle');
    await toggle.scrollIntoViewIfNeeded();
    expect(await hasHitArea(toggle)).toEqual([true, true, true, true]);
  });
});
