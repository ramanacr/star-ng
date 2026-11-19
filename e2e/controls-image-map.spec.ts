import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage as openDocsPage } from './support';

/**
 * Opens a docs page and waits until the controls are hydrated. The page is prerendered, so it is
 * visible before the application runs, and a key before hydration is lost. A hydrated component
 * loses its `ngh` attribute.
 */
async function openPage(page: Page, path: string, heading: string | RegExp): Promise<void> {
  await openDocsPage(page, path, heading);
  await expect(page.locator('star-image-editor[ngh], star-map[ngh]')).toHaveCount(0, {
    timeout: 15_000,
  });
}

/** The text description of the image (the element that the canvas points at). */
async function description(editor: Locator): Promise<Locator> {
  const id = await editor.locator('canvas').getAttribute('aria-describedby');
  return editor.locator(`[id="${id}"]`);
}

test.describe('image editor', () => {
  test('edits with the toolbar keys, crops with the keyboard and exports', async ({ page }) => {
    await openPage(page, '/controls/image-editor', 'Image editor');
    const live = example(page, 'Edit an image');
    const editor = live.locator('star-image-editor');
    const crop = editor.getByRole('button', { name: 'Crop', exact: true });
    await expect(crop).not.toHaveAttribute('aria-disabled', 'true');
    const text = await description(editor);
    await expect(text).toHaveText('Image 960 × 600 pixels. No edits.');

    // The canvas has the pixels of the screen: CSS size times devicePixelRatio.
    const pixels = await editor.locator('canvas').evaluate((canvas: HTMLCanvasElement) => ({
      ok:
        Math.abs(canvas.width - canvas.getBoundingClientRect().width * window.devicePixelRatio) <=
        1,
    }));
    expect(pixels.ok).toBe(true);

    // The toolbar is one tab stop; the arrow keys move to Rotate right.
    await crop.focus();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await expect(editor.getByRole('button', { name: 'Rotate right' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(text).toHaveText('Image 600 × 960 pixels. Edits: rotated by 90°.');
    await page.keyboard.press('Control+z');
    await expect(text).toHaveText('Image 960 × 600 pixels. No edits.');

    // Crop with a fixed ratio and the keyboard.
    await crop.click();
    await editor.getByRole('button', { name: '1:1' }).click();
    const box = editor.getByRole('group', { name: /^Crop area/ });
    await expect(box).toHaveAttribute('aria-label', 'Crop area 600 × 600 pixels at 180, 0');
    await box.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(box).toHaveAttribute('aria-label', 'Crop area 590 × 590 pixels at 190, 0');
    await page.keyboard.press('Enter');
    await expect(text).toHaveText('Image 590 × 590 pixels. Edits: cropped to 590 × 590.');
    await expect(crop).toBeFocused();

    // The export reads the canvas: an inline SVG source does not taint it.
    await live.getByRole('button', { name: 'Export PNG' }).click();
    await expect(live.getByRole('status').first()).toHaveText(/^PNG, \d+ bytes$/);
    await expect(live.getByRole('img', { name: 'Preview of the edited image' })).toBeVisible();
  });

  test('adds an annotation from the keyboard and deletes it from the list', async ({ page }) => {
    await openPage(page, '/controls/image-editor', 'Image editor');
    const editor = example(page, 'Edit an image').locator('star-image-editor');
    const annotate = editor.getByRole('button', { name: 'Annotate', exact: true });
    await expect(annotate).not.toHaveAttribute('aria-disabled', 'true');
    await annotate.click();
    await editor.getByRole('button', { name: 'Ellipse' }).click();
    await editor.getByRole('button', { name: 'Color 3' }).click();
    await editor.getByRole('button', { name: 'Add to the image' }).click();
    const list = editor.getByRole('listbox', { name: 'Annotations' });
    await expect(list.getByRole('option', { name: 'Ellipse 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await list.focus();
    await page.keyboard.press('Delete');
    await expect(editor.getByText('No annotations yet.')).toBeVisible();
    // The focus stays in the editor (on Add), so Control+Z brings the annotation back.
    await expect(editor.getByRole('button', { name: 'Add to the image' })).toBeFocused();
    await page.keyboard.press('Control+z');
    await expect(list.getByRole('option', { name: 'Ellipse 1' })).toBeVisible();
  });
});
