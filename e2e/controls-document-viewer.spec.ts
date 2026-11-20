import { expect, Page, test } from '@playwright/test';
import { example, openPage as openDocsPage } from './support';

/** Opens the document viewer page and waits until the viewers are hydrated. */
async function openPage(page: Page): Promise<void> {
  await openDocsPage(page, '/controls/document-viewer', 'Document viewer');
  await expect(page.locator('star-document-viewer[ngh]')).toHaveCount(0, { timeout: 15_000 });
}

test.describe('document viewer', () => {
  test('navigates, windows the canvases and announces the page', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Generated report');
    const field = live.getByRole('textbox', { name: 'Page number' });
    await expect(live.locator('.star-document-viewer__count')).toHaveText('of 12');
    await expect(field).toHaveValue('1');
    const pages = live.locator('.star-document-viewer__pages');
    // Only the pages in view plus one have a canvas.
    await expect(pages.locator('canvas').first()).toBeVisible();
    expect(await pages.locator('canvas').count()).toBeLessThanOrEqual(4);
    await expect(pages.getByRole('document', { name: 'Page 1 of 12' })).toBeVisible();

    await live.getByRole('button', { name: 'Next page' }).click();
    await expect(field).toHaveValue('2');
    await expect(page.locator('.cdk-live-announcer-element')).toHaveText('Page 2 of 12');

    await pages.focus();
    await page.keyboard.press('End');
    await expect(field).toHaveValue('12');
    await expect(pages.getByRole('document', { name: 'Page 12 of 12' })).toBeInViewport();
    expect(await pages.locator('canvas').count()).toBeLessThanOrEqual(4);
    await page.keyboard.press('Home');
    await expect(field).toHaveValue('1');

    await field.fill('7');
    await field.press('Enter');
    await expect(live.getByRole('status')).toContainText('Page 7.');
    await expect(
      live
        .getByRole('navigation', { name: 'Page thumbnails' })
        .getByRole('button', { name: 'Page 7' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('searches with Control+F and zooms', async ({ page }) => {
    await openPage(page);
    const live = example(page, 'Generated report');
    const pages = live.locator('.star-document-viewer__pages');
    await pages.focus();
    await page.keyboard.press('Control+f');
    const search = live.getByRole('searchbox', { name: 'Search in document' });
    await expect(search).toBeFocused();
    await search.fill('toner');
    await search.press('Enter');
    const status = live.locator('.star-document-viewer__search-status');
    await expect(status).toHaveText(/\d+ results? on \d+ pages?/);
    await search.press('Enter');
    await expect(live.getByRole('textbox', { name: 'Page number' })).not.toHaveValue('1');
    await search.press('Escape');
    await expect(search).toHaveCount(0);

    const canvas = pages.locator('star-document-page').first();
    const before = (await canvas.boundingBox())!.width;
    await live.getByRole('combobox', { name: 'Zoom' }).selectOption('2');
    await expect
      .poll(async () => (await pages.locator('star-document-page').first().boundingBox())!.width)
      .toBeGreaterThan(before);
  });

  test('shows image pages one at a time, and the error state', async ({ page }) => {
    await openPage(page);
    const images = example(page, 'Image pages');
    await expect(images.locator('.star-document-viewer__count')).toHaveText('of 5');
    await expect(images.getByRole('img', { name: 'Page 1 of 5' })).toBeVisible();
    await expect(images.locator('.star-document-viewer__page')).toHaveCount(1);
    await images.getByRole('button', { name: 'Next page' }).click();
    await expect(images.getByRole('img', { name: 'Page 2 of 5' })).toBeVisible();
    await expect(images.getByRole('button', { name: 'Search in document' })).toHaveCount(0);

    const error = example(page, 'Error state');
    await expect(error.getByRole('alert')).toContainText('missing.pdf was not found');
  });
});
