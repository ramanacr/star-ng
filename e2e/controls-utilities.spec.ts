import { expect, Page, test } from '@playwright/test';
import { collectErrors, example, openPage } from './support';

const PAGES: readonly [path: string, heading: string][] = [
  ['/controls/splitter', 'Splitter'],
  ['/controls/speed-dial', 'Speed dial'],
  ['/controls/dock', 'Dock'],
  ['/controls/scroll-top', 'Scroll top'],
  ['/controls/block-ui', 'Block UI'],
  ['/controls/meter-group', 'Meter group'],
  ['/controls/terminal', 'Terminal'],
  ['/controls/inplace', 'Inplace'],
  ['/controls/scroll-panel', 'Scroll panel'],
  ['/controls/float-label', 'Float label'],
  ['/controls/image-compare', 'Image compare'],
  ['/controls/focus-trap', 'Focus trap'],
  ['/controls/ripple', 'Ripple'],
  ['/controls/animate-on-scroll', 'Animate on scroll'],
  ['/controls/theme-switch', 'Theme switch'],
];

test.describe('utilities: pages', () => {
  for (const [path, heading] of PAGES) {
    test(`${path} opens without errors and loads no remote file`, async ({ page }) => {
      const errors = collectErrors(page);
      const remote: string[] = [];
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (!['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol.startsWith('http')) {
          remote.push(request.url());
        }
      });
      await openPage(page, path, heading);
      await expect(page.locator('docs-example').first()).toBeVisible();
      await expect(page.locator('.docs-example__live').first()).not.toBeEmpty();
      expect(errors).toEqual([]);
      expect(remote).toEqual([]);
    });
  }
});

test.describe('splitter', () => {
  test('resizes with the arrow keys, Home and End', async ({ page }) => {
    await openPage(page, '/controls/splitter', 'Splitter');
    const live = example(page, 'Horizontal');
    const gutter = live.getByRole('separator', { name: 'Resize the order panes' });
    await expect(gutter).toHaveAttribute('aria-valuenow', '50');
    await expect(gutter).toHaveAttribute('aria-orientation', 'vertical');

    await gutter.focus();
    await page.keyboard.press('ArrowRight');
    await expect(gutter).toHaveAttribute('aria-valuenow', '52');
    await expect(live.getByRole('status')).toHaveText('First pane: 52%');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(gutter).toHaveAttribute('aria-valuenow', '48');
    await page.keyboard.press('Home');
    await expect(gutter).toHaveAttribute('aria-valuenow', '15');
    await page.keyboard.press('End');
    await expect(gutter).toHaveAttribute('aria-valuenow', '85');
    // Up and Down do nothing in a horizontal splitter.
    await page.keyboard.press('ArrowUp');
    await expect(gutter).toHaveAttribute('aria-valuenow', '85');
  });

  test('a vertical splitter uses the up and down arrows and keeps its minimum', async ({
    page,
  }) => {
    await openPage(page, '/controls/splitter', 'Splitter');
    const gutter = example(page, 'Vertical with a minimum size').getByRole('separator');
    await expect(gutter).toHaveAttribute('aria-orientation', 'horizontal');
    await expect(gutter).toHaveAttribute('aria-valuenow', '40');
    await gutter.focus();
    await page.keyboard.press('ArrowDown');
    await expect(gutter).toHaveAttribute('aria-valuenow', '42');
    await page.keyboard.press('Home');
    await expect(gutter).toHaveAttribute('aria-valuenow', '25');
    await page.keyboard.press('ArrowUp');
    await expect(gutter).toHaveAttribute('aria-valuenow', '25');
  });

  test('resizes when the gutter is dragged', async ({ page }) => {
    await openPage(page, '/controls/splitter', 'Splitter');
    const live = example(page, 'Horizontal');
    const gutter = live.getByRole('separator');
    const splitter = live.locator('star-splitter');
    const box = (await splitter.boundingBox())!;
    const handle = (await gutter.boundingBox())!;
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.7, handle.y + handle.height / 2, { steps: 5 });
    await page.mouse.up();
    const value = Number(await gutter.getAttribute('aria-valuenow'));
    expect(value).toBeGreaterThan(65);
    expect(value).toBeLessThan(75);
  });
});

test.describe('speed dial', () => {
  test('opens, moves with the arrow keys, runs an action and returns the focus', async ({
    page,
  }) => {
    await openPage(page, '/controls/speed-dial', 'Speed dial');
    const live = example(page, 'Actions');
    const fab = live.getByRole('button', { name: 'Quick actions' });
    await expect(fab).toHaveAttribute('aria-expanded', 'false');
    // The closed list is inert: no focus, no clicks.
    await expect(live.locator('.star-speed-dial__list')).toHaveAttribute('inert', '');

    await fab.focus();
    await page.keyboard.press('Enter');
    await expect(fab).toHaveAttribute('aria-expanded', 'true');
    const first = live.getByRole('button', { name: 'New order' });
    const second = live.getByRole('button', { name: 'Search' });
    const third = live.getByRole('button', { name: 'Print' });
    await expect(first).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await expect(second).toBeFocused();
    await page.keyboard.press('End');
    await expect(third).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(third).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(second).toBeFocused();
    await page.keyboard.press('Home');
    await expect(first).toBeFocused();

    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Last action: Search');
    await expect(fab).toHaveAttribute('aria-expanded', 'false');
    await expect(fab).toBeFocused();
  });

  test('Escape closes the list and returns the focus to the button', async ({ page }) => {
    await openPage(page, '/controls/speed-dial', 'Speed dial');
    const live = example(page, 'Actions');
    const fab = live.getByRole('button', { name: 'Quick actions' });
    await fab.click();
    await expect(live.getByRole('button', { name: 'New order' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(fab).toHaveAttribute('aria-expanded', 'false');
    await expect(fab).toBeFocused();
    await expect(live.locator('.star-speed-dial__list')).toHaveAttribute('inert', '');
  });

  test('marks the current choice and changes it', async ({ page }) => {
    await openPage(page, '/controls/speed-dial', 'Speed dial');
    const live = example(page, 'Current choice and own icon');
    await live.getByRole('button', { name: 'Sort' }).click();
    await expect(live.getByRole('button', { name: 'Date' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(live.getByRole('button', { name: 'Amount' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // This list opens down: Arrow down moves forward. Focus moves to the first action after
    // the list renders: wait for it, so the key does not arrive too early.
    await expect(live.getByRole('button', { name: 'Date' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(live.getByRole('button', { name: 'Amount' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Sorted by: Amount');
    await live.getByRole('button', { name: 'Sort' }).click();
    await expect(live.getByRole('button', { name: 'Amount' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('a half circle opens around the button and a click outside closes it', async ({ page }) => {
    await openPage(page, '/controls/speed-dial', 'Speed dial');
    const live = example(page, 'Circle layouts, mask and events');
    const fab = live.getByRole('button', { name: 'Actions on a half circle' });
    await fab.click();
    await expect(live.getByRole('status')).toHaveText('Half circle: open');
    const top = live.locator('.star-speed-dial--circular').first().locator('li').nth(1);
    await expect(top).toHaveCSS('translate', '0px -72px');
    await page.getByRole('heading', { level: 1 }).click();
    await expect(fab).toHaveAttribute('aria-expanded', 'false');
    await expect(live.getByRole('status')).toHaveText('Half circle: closed');
  });
});

test.describe('dock', () => {
  test('items are named buttons that run on Enter', async ({ page }) => {
    await openPage(page, '/controls/dock', 'Dock');
    const live = example(page, 'Bottom dock');
    const nav = live.getByRole('navigation', { name: 'Apps' });
    await expect(nav.getByRole('button')).toHaveCount(5);
    await nav.getByRole('button', { name: 'Inbox' }).focus();
    await page.keyboard.press('Tab');
    await expect(nav.getByRole('button', { name: 'Calendar' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Opened: Calendar');
  });

  test('an item grows when it has the keyboard focus', async ({ page }) => {
    await openPage(page, '/controls/dock', 'Dock');
    const nav = example(page, 'Bottom dock').getByRole('navigation', { name: 'Apps' });
    await nav.getByRole('button', { name: 'Reports' }).focus();
    await expect(nav.getByRole('button', { name: 'Reports' })).toHaveCSS('scale', '1.3');
  });

  test('the left dock is a column', async ({ page }) => {
    await openPage(page, '/controls/dock', 'Dock');
    const list = example(page, 'Left position').locator('.star-dock__list');
    await expect(list).toHaveCSS('flex-direction', 'column');
  });
});

test.describe('scroll top', () => {
  test('appears after the threshold and scrolls the container to the top', async ({ page }) => {
    // Reduced motion makes the scroll immediate.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPage(page, '/controls/scroll-top', 'Scroll top');
    const live = example(page, 'Scroll container');
    const host = live.locator('star-scroll-top');
    const list = live.getByLabel('Order list');
    const button = live.getByRole('button', { name: 'Scroll to top' });
    await expect(host).not.toHaveClass(/star-scroll-top--visible/);
    await expect(button).toHaveAttribute('tabindex', '-1');

    await list.evaluate((element) => element.scrollTo({ top: 300 }));
    await expect(host).toHaveClass(/star-scroll-top--visible/);
    await expect(button).toHaveAttribute('tabindex', '0');

    await button.click();
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(host).not.toHaveClass(/star-scroll-top--visible/);
  });
});

test.describe('block UI', () => {
  test('blocks the content: inert, busy and a mask with the message', async ({ page }) => {
    await openPage(page, '/controls/block-ui', 'Block UI');
    const live = example(page, 'Block a form');
    const block = live.locator('star-block-ui');
    const note = live.getByRole('textbox', { name: 'Note' });
    await expect(block).not.toHaveAttribute('aria-busy', 'true');
    await expect(live.locator('.star-block-ui__mask')).toHaveCount(0);

    await live.getByRole('button', { name: 'Block', exact: true }).click();
    await expect(block).toHaveAttribute('aria-busy', 'true');
    await expect(live.locator('.star-block-ui__content')).toHaveAttribute('inert', '');
    await expect(live.locator('.star-block-ui__mask')).toContainText('Saving…');
    await note.focus();
    await expect(note).not.toBeFocused();

    await live.getByRole('button', { name: 'Unblock' }).click();
    await expect(block).not.toHaveAttribute('aria-busy', 'true');
    await note.focus();
    await expect(note).toBeFocused();
  });

  test('blocks for a short time while work runs', async ({ page }) => {
    await openPage(page, '/controls/block-ui', 'Block UI');
    const live = example(page, 'Block a form');
    await live.getByRole('button', { name: /^Save/ }).click();
    await expect(live.locator('.star-block-ui__mask')).toBeVisible();
    await expect(live.locator('.star-block-ui__mask')).toHaveCount(0, { timeout: 5000 });
  });
});

test.describe('meter group', () => {
  test('every part is a meter with a value text and the colors come from the chart palette', async ({
    page,
  }) => {
    await openPage(page, '/controls/meter-group', 'Meter group');
    const live = example(page, 'Storage by type');
    const group = live.getByRole('group', { name: 'Storage used' });
    const parts = group.getByRole('meter');
    await expect(parts).toHaveCount(3);
    await expect(parts.nth(0)).toHaveAccessibleName('Documents');
    await expect(parts.nth(0)).toHaveAttribute('aria-valuetext', '30 GB of 100');
    await expect(parts.nth(1)).toHaveAttribute('aria-valuetext', '20 GB of 100');
    await expect(group.locator('.star-meter-group__legend')).toContainText('Backups');
    expect(
      await parts.evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLElement).style.background),
      ),
    ).toEqual(['var(--star-chart-1)', 'var(--star-chart-2)', 'var(--star-chart-3)']);
  });

  test('without max the parts fill the bar', async ({ page }) => {
    await openPage(page, '/controls/meter-group', 'Meter group');
    const parts = example(page, 'Scale from the sum').getByRole('meter');
    const widths = await parts.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).style.width),
    );
    expect(widths.reduce((sum, width) => sum + parseFloat(width), 0)).toBeCloseTo(100, 1);
  });
});

test.describe('terminal', () => {
  test('prints a response, an error, and recalls a command with the arrow keys', async ({
    page,
  }) => {
    await openPage(page, '/controls/terminal', 'Terminal');
    const live = example(page, 'Command handler');
    const input = live.getByRole('textbox', { name: 'Command' });
    const log = live.getByRole('log', { name: 'Diagnostics' });
    await expect(log).toContainText('Type help for the commands.');

    await input.focus();
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    await expect(log).toContainText('Commands: help, status, date');
    await expect(live.getByRole('status')).toHaveText('Last command: help');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();

    await page.keyboard.type('reboot');
    await page.keyboard.press('Enter');
    await expect(log.locator('.star-terminal__response--error')).toHaveText(
      'Unknown command: reboot',
    );

    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveValue('reboot');
    await page.keyboard.press('ArrowUp');
    await expect(input).toHaveValue('help');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveValue('reboot');
    await page.keyboard.press('ArrowDown');
    await expect(input).toHaveValue('');
  });

  test('runs a command from the page and clears the log', async ({ page }) => {
    await openPage(page, '/controls/terminal', 'Terminal');
    const live = example(page, 'Command handler');
    const log = live.getByRole('log', { name: 'Diagnostics' });
    await live.getByRole('button', { name: 'Run "status"' }).click();
    await expect(log).toContainText('Open orders: 38');
    await live.getByRole('button', { name: 'Clear' }).click();
    await expect(log).not.toContainText('Open orders: 38');
  });
});

test.describe('inplace', () => {
  test('activates, edits and goes back with Escape', async ({ page }) => {
    await openPage(page, '/controls/inplace', 'Inplace');
    const live = example(page, 'Edit a value');
    const display = live.getByRole('button', { name: 'Edit requester' });
    await expect(display).toContainText('Ana Rivera');
    await display.focus();
    await page.keyboard.press('Enter');
    const input = live.getByRole('textbox', { name: 'Requester' });
    await expect(input).toBeFocused();

    await input.fill('Lee Chen');
    await page.keyboard.press('Escape');
    await expect(live.getByRole('textbox', { name: 'Requester' })).toHaveCount(0);
    await expect(display).toBeFocused();
    await expect(display).toContainText('Lee Chen');
  });

  test('the close button goes back to the value', async ({ page }) => {
    await openPage(page, '/controls/inplace', 'Inplace');
    const live = example(page, 'Edit a value');
    await live.getByRole('button', { name: 'Edit requester' }).click();
    await live.getByRole('textbox', { name: 'Requester' }).fill('Sam Ortiz');
    await live.getByRole('button', { name: 'Close' }).click();
    const display = live.getByRole('button', { name: 'Edit requester' });
    await expect(display).toContainText('Sam Ortiz');
    await expect(display).toBeFocused();
  });

  test('the active state is two-way and a disabled inplace cannot be opened', async ({ page }) => {
    await openPage(page, '/controls/inplace', 'Inplace');
    const live = example(page, 'Two-way active state and disabled');
    await expect(live.getByRole('status')).toHaveText('Editing: false');
    await live.getByRole('button', { name: 'Edit title' }).click();
    await expect(live.getByRole('status')).toHaveText('Editing: true');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('status')).toHaveText('Editing: false');
    await expect(live.getByRole('button', { name: 'Locked value' })).toBeDisabled();
  });
});

test.describe('scroll panel', () => {
  test('is a named region that takes focus and scrolls with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/scroll-panel', 'Scroll panel');
    const panel = example(page, 'Fixed height').getByRole('region', { name: 'Order notes' });
    await panel.focus();
    await expect(panel).toBeFocused();
    expect(await panel.evaluate((element) => element.scrollTop)).toBe(0);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test('a maximum height scrolls only a long content', async ({ page }) => {
    await openPage(page, '/controls/scroll-panel', 'Scroll panel');
    const short = example(page, 'Maximum height').getByRole('region', { name: 'Short notes' });
    expect(await short.evaluate((element) => element.scrollHeight <= element.clientHeight)).toBe(
      true,
    );
  });
});

test.describe('float label', () => {
  test('the label moves up on focus and stays up with a value', async ({ page }) => {
    await openPage(page, '/controls/float-label', 'Float label');
    const live = example(page, 'Text input and textarea');
    const input = live.getByLabel('Customer name');
    const label = live.locator('.star-float__label').first();
    const top = async () => (await label.boundingBox())!.y;
    const resting = await top();
    await input.focus();
    await expect.poll(top).toBeLessThan(resting - 5);

    await input.fill('Ana Rivera');
    await page.keyboard.press('Tab');
    await expect.poll(top).toBeLessThan(resting - 5);
    await expect(live.getByRole('status')).toHaveText('Customer: Ana Rivera');

    await input.fill('');
    await page.locator('body').click({ position: { x: 1, y: 1 } });
    await expect.poll(top).toBeGreaterThan(resting - 2);
  });

  test('the label is a real label: the control is named by it', async ({ page }) => {
    await openPage(page, '/controls/float-label', 'Float label');
    const live = example(page, 'Text input and textarea');
    await expect(live.getByRole('textbox', { name: 'Delivery note' })).toBeVisible();
    await expect(live.locator('.star-float__wrap').nth(1)).toHaveJSProperty('tagName', 'LABEL');
  });

  test('the label of a select moves up when an option is chosen', async ({ page }) => {
    await openPage(page, '/controls/float-label', 'Float label');
    const live = example(page, 'Select');
    const label = live.locator('.star-float__label');
    const top = async () => (await label.boundingBox())!.y;
    const resting = await top();
    await live.getByRole('combobox', { name: 'City' }).click();
    await page.getByRole('option', { name: 'Oslo' }).click();
    await expect.poll(top).toBeLessThan(resting - 5);
  });
});

test.describe('image compare', () => {
  test('moves the divider with the keyboard on the slider', async ({ page }) => {
    await openPage(page, '/controls/image-compare', 'Image compare');
    const live = example(page, 'Before and after');
    const slider = live.getByRole('slider', { name: 'Compare before and after' });
    await expect(slider).toHaveAttribute('aria-valuetext', '50%');
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('status')).toHaveText('Divider at 52%');
    await expect(slider).toHaveAttribute('aria-valuetext', '52%');
    await page.keyboard.press('Home');
    await expect(live.getByRole('status')).toHaveText('Divider at 0%');
    await page.keyboard.press('End');
    await expect(live.getByRole('status')).toHaveText('Divider at 100%');
  });

  test('shows two images with alt text from inline data', async ({ page }) => {
    await openPage(page, '/controls/image-compare', 'Image compare');
    const images = example(page, 'Before and after').locator('img');
    await expect(images).toHaveCount(2);
    for (const image of await images.all()) {
      await expect(image).toHaveAttribute('src', /^data:image\/svg\+xml/);
      expect(await image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(
        0,
      );
    }
    await expect(images.nth(0)).toHaveAttribute('alt', 'After: colored shapes');
    await expect(images.nth(1)).toHaveAttribute('alt', 'Before: grey shapes');
  });
});

test.describe('focus trap', () => {
  test('keeps Tab inside the row while it is on', async ({ page }) => {
    await openPage(page, '/controls/focus-trap', 'Focus trap');
    const live = example(page, 'Trap Tab in a row');
    const toggle = live.getByRole('switch', { name: 'Keep Tab in this row' });
    const two = live.getByRole('button', { name: 'Two', exact: true });

    // Off: Tab leaves the row.
    await two.focus();
    await page.keyboard.press('Tab');
    await expect(toggle).not.toBeFocused();

    await toggle.check();
    await expect(live.getByRole('status')).toHaveText('Trap is on.');
    await two.focus();
    await page.keyboard.press('Tab');
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(two).toBeFocused();
  });
});

test.describe('ripple', () => {
  test('draws an ink circle on press and removes it after the animation', async ({ page }) => {
    await openPage(page, '/controls/ripple', 'Ripple');
    const button = example(page, 'On buttons').getByRole('button', { name: 'Save' });
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await expect(button.locator('.star-ripple__ink')).toHaveCount(1);
    await expect(button.locator('.star-ripple__ink')).toHaveAttribute('aria-hidden', 'true');
    await page.mouse.up();
    await expect(button.locator('.star-ripple__ink')).toHaveCount(0);
  });

  test('draws nothing when the user asks for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPage(page, '/controls/ripple', 'Ripple');
    const button = example(page, 'On buttons').getByRole('button', { name: 'Save' });
    const box = (await button.boundingBox())!;
    await page.mouse.move(box.x + 10, box.y + 10);
    await page.mouse.down();
    await expect(button.locator('.star-ripple__ink')).toHaveCount(0);
    await page.mouse.up();
  });
});

test.describe('animate on scroll', () => {
  test('a block appears the first time it comes into view and stays', async ({ page }) => {
    await openPage(page, '/controls/animate-on-scroll', 'Animate on scroll');
    const box = example(page, 'Reveal while scrolling').getByLabel('Scrollable list of blocks');
    const items = box.locator('.docs-reveal-box__item');
    await expect(items.first()).toHaveClass(/star-reveal--in/);
    await expect(items.last()).not.toHaveClass(/star-reveal--in/);

    await box.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect(items.last()).toHaveClass(/star-reveal--in/);
    await box.evaluate((element) => element.scrollTo({ top: 0 }));
    await expect(items.last()).toHaveClass(/star-reveal--in/);
  });

  test('shows all blocks at once with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPage(page, '/controls/animate-on-scroll', 'Animate on scroll');
    const last = example(page, 'Reveal while scrolling').locator('.docs-reveal-box__item').last();
    await expect(last).toHaveCSS('opacity', '1');
  });
});

test.describe('theme switch', () => {
  test('opens, moves with the arrow keys and applies a theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openPage(page, '/controls/theme-switch', 'Theme switch');
    const live = example(page, 'Theme switch');
    const button = live.getByRole('button', { name: 'Theme: System' });
    await expect(live.getByRole('status')).toHaveText('Choice: system. Theme in use: light.');

    await button.focus();
    await page.keyboard.press('Enter');
    await expect(live.getByRole('button', { name: 'System', exact: true })).toBeFocused();
    await expect(live.getByRole('button', { name: 'System', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(live.getByRole('button', { name: 'Dark', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(live.getByRole('status')).toHaveText('Choice: dark. Theme in use: dark.');
    await expect(live.getByRole('button', { name: 'Theme: Dark' })).toBeFocused();
  });

  test('Escape closes the list without a change', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await openPage(page, '/controls/theme-switch', 'Theme switch');
    const live = example(page, 'Theme switch');
    const button = live.getByRole('button', { name: 'Theme: System' });
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('the switch is not fixed to a corner by itself', async ({ page }) => {
    await openPage(page, '/controls/theme-switch', 'Theme switch');
    const position = await example(page, 'Theme switch')
      .locator('star-theme-switch')
      .evaluate((element) => getComputedStyle(element).position);
    expect(position).not.toBe('fixed');
  });
});

test.describe('drag and drop directives', () => {
  const hydrated = (page: Page) =>
    expect(page.locator('docs-drag-drop-page[ngh]')).toHaveCount(0, { timeout: 15_000 });

  test('moves an order with the keyboard and announces each step', async ({ page }) => {
    await openPage(page, '/controls/drag-drop', 'Drag and drop');
    await hydrated(page);
    const live = example(page, 'Move orders between lists');
    const open = live.getByRole('region', { name: 'Open orders' });
    const shipped = live.getByRole('region', { name: 'Shipped orders' });
    const order = open.locator('.star-draggable', { hasText: 'ORD-1042' });
    await expect(order).toHaveAttribute('tabindex', '0');
    await expect(order).toHaveAccessibleDescription(/Press Space to pick up/);
    await order.focus();
    await page.keyboard.press('Space');
    await expect(order).toHaveClass(/star-draggable--picked/);
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText('Picked up ORD-1042');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(shipped).toHaveClass(/star-droppable--over/);
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText('Over Shipped orders');
    await page.keyboard.press('Space');
    await expect(shipped.locator('.star-draggable', { hasText: 'ORD-1042' })).toHaveCount(1);
    // The owner re-creates the item in the other list; the focus follows it.
    await expect(shipped.locator('.star-draggable', { hasText: 'ORD-1042' })).toBeFocused();
    await expect(live.getByRole('status')).toHaveText('ORD-1042 moved to Shipped');
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText(
      'ORD-1042 dropped on Shipped orders',
    );
  });

  test('Escape cancels a keyboard drag', async ({ page }) => {
    await openPage(page, '/controls/drag-drop', 'Drag and drop');
    await hydrated(page);
    const live = example(page, 'Move orders between lists');
    const order = live.locator('.star-draggable', { hasText: 'ORD-1043' });
    await order.focus();
    await page.keyboard.press('Space');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(order).not.toHaveClass(/star-draggable--picked/);
    await expect(live.locator('.star-droppable--over')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('No move yet');
  });

  test('drags an order with the mouse', async ({ page }) => {
    await openPage(page, '/controls/drag-drop', 'Drag and drop');
    await hydrated(page);
    const live = example(page, 'Move orders between lists');
    const shipped = live.getByRole('region', { name: 'Shipped orders' });
    await live.locator('.star-draggable', { hasText: 'ORD-1044' }).dragTo(shipped);
    await expect(shipped.locator('.star-draggable', { hasText: 'ORD-1044' })).toHaveCount(1);
  });

  test('a zone of another scope refuses the item', async ({ page }) => {
    await openPage(page, '/controls/drag-drop', 'Drag and drop');
    await hydrated(page);
    const live = example(page, 'Scopes, a handle and a copy effect');
    await live.locator('.star-draggable', { hasText: 'Draft order ORD-1050' }).focus();
    await page.keyboard.press('Space');
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText(
      'No drop zone accepts this item',
    );
  });
});
