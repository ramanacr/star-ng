import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, editorTool, example, openPage } from './support';

/** Opens the editor page and waits until every editor is hydrated. */
async function openEditor(page: Page): Promise<void> {
  await openPage(page, '/controls/editor', 'Editor');
  await expect(page.locator('star-editor[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

/** Selects the whole text of `target` in the page. */
async function selectText(target: Locator): Promise<void> {
  await target.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);
  });
}

test.describe('editor formatting', () => {
  test('colors the selected text from the palette and undoes it', async ({ page }) => {
    const errors = collectErrors(page);
    await openEditor(page);
    const live = example(page, 'Full toolbar');
    const area = live.getByRole('textbox', { name: 'Product announcement' });
    await selectText(area.locator('b'));
    await (await editorTool(live, 'Text color')).click();
    const panel = live.getByRole('group', { name: 'Text color' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Red' }).click();
    await expect(panel).toBeHidden();
    await expect(area.locator('span[style*="--star-danger"]')).toHaveText('new dashboard');
    await expect(live.locator('pre')).toContainText('color: var(--star-danger)');

    await area.click();
    await page.keyboard.press('Control+Z');
    await expect(area.locator('span[style*="--star-danger"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('nests a checklist item with Tab and checks it with Ctrl+Enter', async ({ page }) => {
    await openEditor(page);
    const live = example(page, 'Lists, checklists and nesting');
    const area = live.getByRole('textbox', { name: 'Launch plan' });
    const last = area.locator(':scope > ul > li').last();
    await last.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Tab');
    await expect(area.locator(':scope > ul > li')).toHaveCount(2);
    await expect(area.locator('ul ul > li')).toHaveCount(3);
    await page.keyboard.press('Control+Enter');
    await expect(area.locator('li', { hasText: 'Send the announcement' })).toHaveAttribute(
      'data-checked',
      'true',
    );
    await page.keyboard.press('Shift+Tab');
    await expect(area.locator(':scope > ul > li')).toHaveCount(3);
  });

  test('a narrow toolbar keeps one tab stop and opens the More actions panel', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await openEditor(page);
    const live = example(page, 'Full toolbar');
    const toolbar = live.getByRole('toolbar', { name: 'Product announcement formatting' });
    const more = toolbar.getByRole('button', { name: 'More actions' });
    await expect(more).toBeVisible();
    await expect(toolbar.locator('[tabindex="0"]')).toHaveCount(1);
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
    await expect(toolbar.getByRole('button', { name: 'Clear formatting' })).toBeVisible();
    await toolbar.getByRole('button', { name: 'Clear formatting' }).focus();
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
    await expect(more).toHaveAttribute('aria-expanded', 'false');
  });
});

test.describe('editor paste and security', () => {
  test('cleans a Word paste', async ({ page }) => {
    await openEditor(page);
    const live = example(page, 'Paste as plain text');
    const area = live.getByRole('textbox', { name: 'Pasted with formats' });
    await area.click();
    const html = await area.evaluate((element) => {
      const data = new DataTransfer();
      data.setData(
        'text/html',
        '<p class="MsoListParagraphCxSpFirst" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;</span></span>Faster reports<o:p></o:p></p><p class="MsoListParagraphCxSpLast" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">·<span>&nbsp;</span></span><span style="font-family:Calibri;font-weight:bold">Saved filters</span></p>',
      );
      data.setData('text/plain', 'Faster reports\nSaved filters');
      element.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
      return element.innerHTML;
    });
    expect(html).toContain('<li>Faster reports</li>');
    expect(html).toContain('<b>Saved filters</b>');
    expect(html).not.toMatch(/Mso|mso-|Calibri/);
  });

  test('the allow-list removes images and http links', async ({ page }) => {
    await openEditor(page);
    const area = example(page, 'Own sanitizer allow-list').getByRole('textbox', {
      name: 'Strict announcement',
    });
    await expect(area.locator('img')).toHaveCount(0);
    await expect(area.locator('a').first()).not.toHaveAttribute('href');
    await expect(area.locator('a').last()).toHaveAttribute('href', 'https://example.com/release');
  });
});

test.describe('editor images', () => {
  test('the image panel needs alternative text, and the handle resizes the image', async ({
    page,
  }) => {
    await openEditor(page);
    const live = example(page, 'Images and embeds');
    const area = live.getByRole('textbox', { name: 'Release with images' });
    await area.locator('p').click();
    await live.getByRole('button', { name: 'Image', exact: true }).click();
    const panel = live.getByRole('group', { name: 'Image' });
    await expect(panel.getByRole('textbox', { name: 'Image address (https://…)' })).toBeFocused();
    await panel
      .getByRole('textbox', { name: 'Image address (https://…)' })
      .fill('https://example.com/report.png');
    await panel.getByRole('button', { name: 'Apply' }).click();
    await expect(panel.getByText('Describe the image, or mark it as decorative.')).toBeVisible();
    await expect(panel.getByRole('textbox', { name: 'Alternative text' })).toBeFocused();
    await panel.getByRole('textbox', { name: 'Alternative text' }).fill('Monthly report');
    await panel.getByRole('button', { name: 'Apply' }).click();
    await expect(area.locator('img[alt="Monthly report"]')).toHaveCount(1);

    await area.locator('figure img').click();
    const handle = live.getByRole('slider', { name: 'Image width' });
    await expect(handle).toHaveAttribute('aria-valuenow', '240');
    await handle.focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(area.locator('figure img')).toHaveAttribute('width', '290');
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 90, box.y + box.height / 2);
    await page.mouse.up();
    await expect(area.locator('figure img')).toHaveAttribute('width', '200');
  });
});
