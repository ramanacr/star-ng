import { expect, Locator, Page, test } from '@playwright/test';
import { collectErrors, editorTool, example, openPage } from './support';

const pdf = (name: string, size = 1) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.alloc(size, 'a'),
});

const rows = (live: Locator) => live.locator('.star-upload__file');
const fileInput = (live: Locator) => live.locator('input[type="file"]').first();

/** The value text of an editor example: the `pre` element next to the editor. */
const valueOf = (live: Locator) => live.locator('pre');

test.describe('file upload', () => {
  test('single mode replaces the file, multiple mode adds files, and a file is removed', async ({
    page,
  }) => {
    await openPage(page, '/controls/file-upload', 'File upload');
    const live = example(page, 'Single and multiple');
    const single = live.locator('star-file-upload').nth(0);
    const several = live.locator('star-file-upload').nth(1);

    await fileInput(single).setInputFiles(pdf('one.pdf'));
    await fileInput(single).setInputFiles(pdf('two.pdf'));
    await expect(rows(single)).toHaveCount(1);
    await expect(rows(single)).toContainText('two.pdf');

    await fileInput(several).setInputFiles(pdf('one.pdf'));
    await fileInput(several).setInputFiles(pdf('two.pdf'));
    await expect(rows(several)).toHaveCount(2);
    await expect(live.getByRole('status')).toHaveText('Single: 1 file. Multiple: 2 files.');

    // The remove button works with the keyboard.
    const remove = several.getByRole('button', { name: 'Remove one.pdf' });
    await remove.focus();
    await page.keyboard.press('Enter');
    await expect(rows(several)).toHaveCount(1);
    await expect(rows(several)).toContainText('two.pdf');
    await expect(live.getByRole('status')).toHaveText('Single: 1 file. Multiple: 1 files.');
  });

  test('accepts a file of an allowed type and size and shows the limits as a hint', async ({
    page,
  }) => {
    await openPage(page, '/controls/file-upload', 'File upload');
    const live = example(page, 'Accepted types, size and count');

    await expect(live.locator('.star-upload__hint')).toContainText('.pdf, image/*');
    await expect(live.locator('.star-upload__hint')).toContainText('up to 3 files');
    await expect(fileInput(live)).toHaveAttribute('accept', '.pdf,image/*');

    await fileInput(live).setInputFiles([
      pdf('invoice.pdf'),
      { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('p') },
    ]);
    await expect(rows(live).locator('.star-upload__name')).toHaveText(['invoice.pdf', 'photo.png']);
    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(live.getByRole('status')).toHaveText('Added: 2. Rejected in the last try: 0.');
  });

  test('rejects a file of a wrong type, a file that is too large and files over the limit', async ({
    page,
  }) => {
    await openPage(page, '/controls/file-upload', 'File upload');
    const live = example(page, 'Accepted types, size and count');
    const alert = live.getByRole('alert');

    await fileInput(live).setInputFiles({
      name: 'setup.exe',
      mimeType: 'application/x-msdownload',
      buffer: Buffer.from('x'),
    });
    await expect(alert).toHaveText('setup.exe: this file type is not allowed.');
    await expect(rows(live)).toHaveCount(0);

    await fileInput(live).setInputFiles(pdf('huge.pdf', 1_100_000));
    await expect(alert).toContainText('huge.pdf: the file is larger than');
    await expect(rows(live)).toHaveCount(0);

    await fileInput(live).setInputFiles([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf'), pdf('d.pdf')]);
    await expect(rows(live)).toHaveCount(3);
    await expect(alert).toHaveText('You can add up to 3 files.');
    await expect(live.getByRole('status')).toHaveText('Added: 3. Rejected in the last try: 1.');

    // Removing a file clears the list of rejected files.
    await live.getByRole('button', { name: 'Remove a.pdf' }).click();
    await expect(alert).toHaveCount(0);
    await expect(rows(live)).toHaveCount(2);
  });

  test('takes dropped files, highlights the zone and applies the same checks', async ({ page }) => {
    await openPage(page, '/controls/file-upload', 'File upload');
    const live = example(page, 'Drag and drop');
    const zone = live.locator('.star-upload__zone');
    const host = live.locator('star-file-upload');

    await zone.dispatchEvent('dragenter');
    await expect(host).toHaveClass(/star-upload--dragging/);
    await zone.dispatchEvent('dragleave');
    await expect(host).not.toHaveClass(/star-upload--dragging/);

    const transfer = await page.evaluateHandle(() => {
      const data = new DataTransfer();
      data.items.add(new File(['x'], 'photo.png', { type: 'image/png' }));
      data.items.add(new File(['x'], 'notes.txt', { type: 'text/plain' }));
      return data;
    });
    await zone.dispatchEvent('drop', { dataTransfer: transfer });
    await expect(rows(live).locator('.star-upload__name')).toHaveText(['photo.png']);
    await expect(live.getByRole('alert')).toHaveText('notes.txt: this file type is not allowed.');
    await expect(host).not.toHaveClass(/star-upload--dragging/);
  });

  test('reorders the files with the buttons', async ({ page }) => {
    await openPage(page, '/controls/file-upload', 'File upload');
    const live = example(page, 'Order and thumbnails');
    const names = rows(live).locator('.star-upload__name');

    await fileInput(live).setInputFiles([pdf('first.pdf'), pdf('second.pdf')]);
    await expect(names).toHaveText(['first.pdf', 'second.pdf']);
    await expect(live.getByRole('button', { name: 'Move up: first.pdf' })).toBeDisabled();

    await live.getByRole('button', { name: 'Move down: first.pdf' }).click();
    await expect(names).toHaveText(['second.pdf', 'first.pdf']);
    await live.getByRole('button', { name: 'Move up: first.pdf' }).click();
    await expect(names).toHaveText(['first.pdf', 'second.pdf']);

    // An image file shows a thumbnail, and the control releases it with the file.
    await fileInput(live).setInputFiles({
      name: 'shelf.png',
      mimeType: 'image/png',
      buffer: Buffer.from('x'),
    });
    await expect(live.locator('.star-upload__thumb')).toHaveCount(1);
    await expect(live.locator('.star-upload__thumb')).toHaveAttribute('src', /^blob:/);
  });

  test('shows progress, then done or an error message', async ({ page }) => {
    await openPage(page, '/controls/file-upload', 'File upload');
    const live = example(page, 'Progress and status');

    await fileInput(live).setInputFiles([pdf('report.pdf'), pdf('will-fail.pdf')]);
    await expect(rows(live)).toHaveCount(2);
    await expect(live.getByRole('progressbar', { name: 'Uploading report.pdf' })).toBeVisible();
    await expect(rows(live).nth(0)).toContainText('Uploaded', { timeout: 10_000 });
    await expect(rows(live).nth(1)).toContainText('The server did not accept the file.');
    await expect(rows(live).nth(1)).toHaveClass(/star-upload__file--error/);
  });

  test('read-only shows the files without remove buttons, disabled turns the input off', async ({
    page,
  }) => {
    await openPage(page, '/controls/file-upload', 'File upload');
    const live = example(page, 'Disabled and read-only');
    const readonly = live.locator('star-file-upload').nth(0);
    const disabled = live.locator('star-file-upload').nth(1);

    await expect(rows(readonly)).toHaveCount(2);
    await expect(readonly.getByRole('button', { name: /^Remove/ })).toHaveCount(0);
    await expect(fileInput(readonly)).toBeDisabled();
    await expect(fileInput(disabled)).toBeDisabled();
  });

  test('has no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/file-upload', 'File upload');
    await fileInput(example(page, 'Single and multiple')).setInputFiles(pdf('one.pdf'));
    await expect(rows(example(page, 'Single and multiple'))).toHaveCount(1);
    expect(errors).toEqual([]);
  });
});

test.describe('editor', () => {
  test('types text and stores it in the value', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Toolbar and value');
    const area = live.getByRole('textbox', { name: 'Delivery note' });

    await expect(area).toHaveAttribute('data-placeholder', 'Write the delivery note');
    await area.click();
    await page.keyboard.type('Leave at the dock');
    await expect(valueOf(live)).toContainText('Leave at the dock');
  });

  test('Ctrl+B makes the selected text bold and the button shows it is pressed', async ({
    page,
  }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Toolbar and value');
    const area = live.getByRole('textbox', { name: 'Delivery note' });
    const bold = live.getByRole('button', { name: 'Bold' });

    await area.click();
    await page.keyboard.type('Fragile');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');
    await expect(valueOf(live)).toContainText('<b>Fragile</b>');
    await expect(bold).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Control+B');
    await expect(valueOf(live)).not.toContainText('<b>');
    await expect(bold).toHaveAttribute('aria-pressed', 'false');
  });

  test('a toolbar button runs its command from the keyboard, and arrows move in the toolbar', async ({
    page,
  }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Toolbar and value');
    const area = live.getByRole('textbox', { name: 'Delivery note' });

    await area.click();
    await page.keyboard.type('Handle with care');
    await page.keyboard.press('Control+A');

    const italic = live.getByRole('button', { name: 'Italic' });
    await italic.focus();
    await page.keyboard.press('Enter');
    await expect(valueOf(live)).toContainText('<i>Handle with care</i>');
    await expect(area).toBeFocused();

    await live.getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(italic).toBeFocused();
    await page.keyboard.press('End');
    await expect(live.getByRole('button', { name: 'Link' })).toBeFocused();
  });

  test('a bulleted list from the toolbar makes list items', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Toolbar and value');
    const area = live.getByRole('textbox', { name: 'Delivery note' });

    await area.click();
    await page.keyboard.type('Boxes');
    await live.getByRole('button', { name: 'Bulleted list' }).click();
    await expect(valueOf(live)).toContainText('<ul><li>Boxes</li></ul>');
    await expect(area.locator('li')).toHaveCount(1);
  });

  test('the link form accepts only a safe address and sets rel for a new tab', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Toolbar and value');
    const area = live.getByRole('textbox', { name: 'Delivery note' });
    const link = live.getByRole('button', { name: 'Link' });

    await area.click();
    await page.keyboard.type('Tracking');
    await page.keyboard.press('Control+A');
    await link.click();
    await expect(link).toHaveAttribute('aria-expanded', 'true');
    const address = live.getByRole('textbox', { name: 'Link address (https://…)' });
    await expect(address).toBeFocused();
    await address.fill('javascript:alert(1)');
    await page.keyboard.press('Enter');
    await expect(address).toHaveAttribute('aria-invalid', 'true');
    await expect(area.locator('a')).toHaveCount(0);

    await address.fill('https://example.com/track');
    await live.getByRole('checkbox', { name: 'Open in a new tab' }).check();
    await live.getByRole('button', { name: 'Apply' }).click();
    await expect(address).toHaveCount(0);
    await expect(area.locator('a')).toHaveAttribute('href', 'https://example.com/track');
    await expect(valueOf(live)).toContainText(
      '<a href="https://example.com/track" target="_blank" rel="noopener noreferrer">Tracking</a>',
    );

    // The caret in the link: the form shows the address and can remove the link.
    await area.locator('a').click();
    await link.click();
    await expect(address).toHaveValue('https://example.com/track');
    await live.getByRole('button', { name: 'Remove link' }).click();
    await expect(area.locator('a')).toHaveCount(0);
    await expect(valueOf(live)).toContainText('Tracking');

    // A host name without a scheme is accepted and gets https:// (no browser URL check).
    await page.keyboard.press('Control+A');
    await link.click();
    await address.fill('example.com/x');
    await page.keyboard.press('Enter');
    await expect(address).toHaveCount(0);
    await expect(area.locator('a')).toHaveAttribute('href', 'https://example.com/x');

    // Escape closes the form and the focus goes back to the text.
    await link.click();
    // The form moves the focus to its field after it renders; Escape works from there.
    await expect(address).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(address).toHaveCount(0);
    await expect(area).toBeFocused();
  });

  test('shows sanitized HTML and stores the sanitized HTML after an edit', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'HTML that is sanitized');
    const area = live.getByRole('textbox', { name: 'Sanitized content' });

    // The area shows only safe markup.
    await expect(area.locator('b')).toHaveText('ORD-1042');
    const shown = await area.evaluate((el) => el.innerHTML);
    expect(shown).not.toContain('<script');
    expect(shown).not.toContain('onclick');
    // Only the allowed style (color) stays; position goes.
    expect(shown).toContain('style="color: #c62828"');
    expect(shown).not.toMatch(/href="javascript:/i);
    await expect(area.locator('a')).not.toHaveAttribute('href');

    // The model keeps the value that the page set until the user edits the area.
    await expect(valueOf(live)).toContainText('<script>alert(1)</script>');
    await area.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('!');
    await expect(valueOf(live)).toContainText('ORD-1042');
    await expect(valueOf(live)).not.toContainText('<script');
    await expect(valueOf(live)).not.toContainText('onclick');
    // An unsafe URL goes; the link text stays.
    await expect(valueOf(live)).toContainText('<a>open');
    await expect(valueOf(live)).not.toContainText('javascript:');
  });

  test('read-only and disabled editors cannot be edited', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Disabled and read-only');
    const readonly = live.getByRole('textbox', { name: 'Saved note' });
    const disabled = live.getByRole('textbox', { name: 'Locked note' });

    await expect(readonly).toHaveAttribute('contenteditable', 'false');
    await expect(readonly).toHaveAttribute('aria-readonly', 'true');
    await expect(disabled).toHaveAttribute('aria-disabled', 'true');
    await expect(live.getByRole('button', { name: 'Bold' }).first()).toBeDisabled();
    await expect(live.getByRole('button', { name: 'Bold' }).last()).toBeDisabled();
  });

  test('full toolbar: text style, inline code and center alignment', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Full toolbar');
    const area = live.getByRole('textbox', { name: 'Product announcement' });
    const toolbar = live.getByRole('toolbar', { name: 'Product announcement formatting' });
    await expect(page.locator('star-editor[ngh]')).toHaveCount(0, { timeout: 15_000 });
    await expect(toolbar.locator('[tabindex="0"]')).toHaveCount(1);

    await area.locator('p').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Shift+Home');
    const center = await editorTool(live, 'Center');
    await center.click();
    await expect(area.locator('p')).toHaveClass('star-text-center');
    await expect(await editorTool(live, 'Center')).toHaveAttribute('aria-pressed', 'true');
    await expect(valueOf(live)).toContainText('<p class="star-text-center">');

    await area.locator('b').evaluate((bold) => {
      const range = document.createRange();
      range.selectNodeContents(bold);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
    });
    await (await editorTool(live, 'Code')).click();
    await expect(area.locator('code')).toHaveText('new dashboard');

    await area.locator('p').click();
    await live.getByRole('combobox', { name: 'Text style' }).selectOption('h1');
    await expect(area.locator('h1')).toHaveCount(1);
    await expect(valueOf(live)).toContainText('<h1');

    // Arrow keys move through the toolbar, the selects included.
    await live.getByRole('button', { name: 'Redo' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('combobox', { name: 'Text style' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('combobox', { name: 'Font size' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(live.getByRole('button', { name: 'Bold' })).toBeFocused();
  });

  test('maxLength stops typing and the counter describes the area', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Plain text and a length limit');
    const area = live.getByRole('textbox', { name: 'Delivery summary' });
    await expect(area).toHaveAccessibleDescription(/of 120 characters/);
    await area.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('x'.repeat(100));
    await expect(live.locator('.star-editor__counter')).toHaveText('120 of 120 characters');
    await expect(valueOf(live)).toContainText('Deliver before noon.');
    expect((await valueOf(live).textContent())!.replace(/\n/g, '').length).toBe(120);
  });

  test('pasteAsText inserts plain text, the other editor sanitizes HTML', async ({ page }) => {
    await openPage(page, '/controls/editor', 'Editor');
    const live = example(page, 'Paste as plain text');
    const paste = (name: string) =>
      live.getByRole('textbox', { name }).evaluate((area) => {
        area.focus();
        const data = new DataTransfer();
        data.setData('text/html', '<b onclick="alert(1)">Bold</b><script>alert(1)</script>');
        data.setData('text/plain', 'Bold');
        area.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
        );
        return area.innerHTML;
      });
    const formatted = await paste('Pasted with formats');
    expect(formatted).toContain('<b>Bold</b>');
    expect(formatted).not.toMatch(/onclick|script/);
    const plain = await paste('Pasted as plain text');
    expect(plain).toBe('Bold');
  });

  test('has no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/editor', 'Editor');
    await example(page, 'Toolbar and value').getByRole('textbox').click();
    await page.keyboard.type('Hello');
    expect(errors).toEqual([]);
  });
});

/** The slide position that the page dots show. */
async function currentDot(region: Locator): Promise<number> {
  return region
    .locator('.star-carousel__dot')
    .evaluateAll((dots) => dots.findIndex((dot) => dot.getAttribute('aria-current') === 'true'));
}

test.describe('carousel', () => {
  test('next and previous with the keyboard move one page and stop at the ends', async ({
    page,
  }) => {
    await openPage(page, '/controls/carousel', 'Carousel');
    const region = example(page, 'One slide per page').getByRole('region', {
      name: 'Warehouse photos',
    });
    const next = region.getByRole('button', { name: 'Next slides' });
    const previous = region.getByRole('button', { name: 'Previous slides' });
    const track = region.locator('.star-carousel__track');

    await expect(region).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(region.getByRole('group', { name: '1 of 6' })).toBeVisible();
    await expect(previous).toBeDisabled();
    expect(await currentDot(region)).toBe(0);

    await next.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => currentDot(region)).toBe(1);
    await expect(previous).toBeEnabled();
    await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(50);

    await page.keyboard.press('Space');
    await expect.poll(() => currentDot(region)).toBe(2);

    await previous.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => currentDot(region)).toBe(1);
    await page.keyboard.press('Enter');
    await expect.poll(() => currentDot(region)).toBe(0);
    await expect(previous).toBeDisabled();

    // A page dot goes straight to its page, and the last page disables next.
    await region.getByRole('button', { name: 'Page 6' }).click();
    await expect(next).toBeDisabled();
    expect(await currentDot(region)).toBe(5);
  });

  test('several slides per page give fewer pages', async ({ page }) => {
    await openPage(page, '/controls/carousel', 'Carousel');
    const region = example(page, 'Several slides per page').getByRole('region', {
      name: 'Warehouse photo pages',
    });
    await expect(region.locator('.star-carousel__dot')).toHaveCount(2);
    await region.getByRole('button', { name: 'Next slides' }).click();
    await expect(region.getByRole('button', { name: 'Next slides' })).toBeDisabled();
    await expect.poll(() => currentDot(region)).toBe(1);
  });

  test('autoplay has a pause button', async ({ page }) => {
    await openPage(page, '/controls/carousel', 'Carousel');
    const region = example(page, 'Autoplay').getByRole('region', { name: 'Automatic photos' });
    const track = region.locator('.star-carousel__track');

    await expect(track).toHaveAttribute('aria-live', 'off');
    await region.getByRole('button', { name: 'Pause slides' }).click();
    await expect(region.getByRole('button', { name: 'Play slides' })).toBeVisible();
    await expect(track).toHaveAttribute('aria-live', 'polite');
  });

  test('has no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/carousel', 'Carousel');
    await example(page, 'One slide per page').getByRole('button', { name: 'Next slides' }).click();
    expect(errors).toEqual([]);
  });
});

test.describe('galleria', () => {
  const gallery = (page: Page, name: string) =>
    example(page, 'Images and thumbnails').getByRole('region', { name });

  test('a thumbnail shows its image and the active thumbnail has aria-current', async ({
    page,
  }) => {
    await openPage(page, '/controls/galleria', 'Galleria');
    const region = gallery(page, 'Site photos');
    const stage = region.locator('.star-galleria__stage');

    await expect(stage.locator('img')).toHaveAttribute('alt', 'Loading dock 1');
    await expect(region.locator('.star-galleria__count')).toHaveText('1 / 5');

    await region.getByRole('button', { name: 'Show Loading dock 3' }).click();
    await expect(stage.locator('img')).toHaveAttribute('alt', 'Loading dock 3');
    await expect(stage.locator('figcaption')).toHaveText('Loading dock 3 of 5');
    await expect(region.locator('.star-galleria__count')).toHaveText('3 / 5');
    await expect(region.getByRole('button', { name: 'Show Loading dock 3' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    await expect(region.getByRole('button', { name: 'Show Loading dock 1' })).not.toHaveAttribute(
      'aria-current',
      'true',
    );
  });

  test('a thumbnail works with the keyboard', async ({ page }) => {
    await openPage(page, '/controls/galleria', 'Galleria');
    const region = gallery(page, 'Site photos');
    const thumb = region.getByRole('button', { name: 'Show Loading dock 4' });

    await thumb.focus();
    await page.keyboard.press('Enter');
    await expect(region.locator('.star-galleria__count')).toHaveText('4 / 5');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await expect(region.locator('.star-galleria__count')).toHaveText('5 / 5');
  });

  test('arrow keys and the arrow buttons step through the images and wrap around', async ({
    page,
  }) => {
    await openPage(page, '/controls/galleria', 'Galleria');
    const region = gallery(page, 'Site photos');
    const count = region.locator('.star-galleria__count');

    await region.locator('.star-galleria__stage').focus();
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText('2 / 5');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(count).toHaveText('5 / 5');
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText('1 / 5');

    await region.getByRole('button', { name: 'Previous image' }).click();
    await expect(count).toHaveText('5 / 5');
    await region.getByRole('button', { name: 'Next image' }).click();
    await expect(count).toHaveText('1 / 5');
  });

  test('activeIndex is a two-way model', async ({ page }) => {
    await openPage(page, '/controls/galleria', 'Galleria');
    const live = example(page, 'Active image from outside');
    await expect(live.getByRole('status')).toHaveText('Active index: 2');
    await live.getByRole('button', { name: 'Show Loading dock 1' }).click();
    await expect(live.getByRole('status')).toHaveText('Active index: 0');
    await live.getByRole('button', { name: 'Next image' }).click();
    await expect(live.getByRole('status')).toHaveText('Active index: 1');
  });

  test('has no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/galleria', 'Galleria');
    await gallery(page, 'Site photos').getByRole('button', { name: 'Next image' }).click();
    expect(errors).toEqual([]);
  });
});

test.describe('image', () => {
  test('a plain image is a lazy img without a button', async ({ page }) => {
    await openPage(page, '/controls/image', 'Image');
    const live = example(page, 'Plain image');
    await expect(live.getByRole('img', { name: 'Shelf photo' })).toHaveAttribute('loading', 'lazy');
    await expect(live.getByRole('button')).toHaveCount(0);
  });

  test('opens the preview, zooms, closes with Escape and returns the focus', async ({ page }) => {
    await openPage(page, '/controls/image', 'Image');
    const trigger = example(page, 'Preview').getByRole('button', { name: 'Preview: Shelf photo' });
    const dialog = page.getByRole('dialog', { name: 'Shelf photo' });
    await expect(dialog).toBeHidden();

    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((el) => el.matches(':modal'))).toBe(true);
    await expect(dialog.getByRole('img', { name: 'Shelf photo' })).toBeVisible();

    await expect(dialog.getByText('100%')).toBeVisible();
    await dialog.getByRole('button', { name: 'Zoom in' }).click();
    await expect(dialog.getByText('125%')).toBeVisible();
    await dialog.getByRole('button', { name: 'Zoom out' }).click();
    await dialog.getByRole('button', { name: 'Zoom out' }).click();
    await expect(dialog.getByText('75%')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('zoom stops at 50% and 300%', async ({ page }) => {
    await openPage(page, '/controls/image', 'Image');
    const trigger = example(page, 'Preview').getByRole('button', { name: 'Preview: Shelf photo' });
    const dialog = page.getByRole('dialog', { name: 'Shelf photo' });

    await trigger.click();
    const zoomOut = dialog.getByRole('button', { name: 'Zoom out' });
    for (let step = 0; step < 2; step++) await zoomOut.click();
    await expect(zoomOut).toBeDisabled();
    await expect(dialog.getByText('50%')).toBeVisible();
    const zoomIn = dialog.getByRole('button', { name: 'Zoom in' });
    for (let step = 0; step < 10; step++) await zoomIn.click();
    await expect(zoomIn).toBeDisabled();
    await expect(dialog.getByText('300%')).toBeVisible();
  });

  test('the close button closes the preview and returns the focus', async ({ page }) => {
    await openPage(page, '/controls/image', 'Image');
    const trigger = example(page, 'Preview').getByRole('button', { name: 'Preview: Shelf photo' });
    const dialog = page.getByRole('dialog', { name: 'Shelf photo' });

    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test('has no console errors', async ({ page }) => {
    const errors = collectErrors(page);
    await openPage(page, '/controls/image', 'Image');
    await example(page, 'Preview').getByRole('button', { name: 'Preview: Shelf photo' }).click();
    await page.keyboard.press('Escape');
    expect(errors).toEqual([]);
  });
});

test.describe('galleria stage surface', () => {
  for (const theme of ['light', 'dark'] as const) {
    test(`the stage is opaque and dark in the ${theme} theme`, async ({ page }) => {
      await page.addInitScript((value) => localStorage.setItem('star-theme', value), theme);
      await openPage(page, '/controls/galleria', 'Galleria');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      const stage = example(page, 'Images and thumbnails')
        .getByRole('region', { name: 'Site photos' })
        .locator('.star-galleria__stage');
      const [red, green, blue, alpha] = await stage.evaluate((node) => {
        const match = getComputedStyle(node).backgroundColor.match(/[\d.]+/g) ?? [];
        const [r, g, b, a = 1] = match.map(Number);
        return [r, g, b, a];
      });
      expect(alpha).toBe(1);
      const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
      expect(luminance).toBeLessThan(0.15);
    });
  }
});
