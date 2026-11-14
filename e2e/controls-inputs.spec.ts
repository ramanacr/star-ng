import { expect, Page, test } from '@playwright/test';
import { example, lowContrast, openPage } from './support';

/** Puts a pasted text into a box: the clipboard is not available to the test, so it sends the event. */
async function paste(page: Page, selector: string, text: string): Promise<void> {
  await page.locator(selector).evaluate((box, value) => {
    const data = new DataTransfer();
    data.setData('text', value);
    box.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
    );
  }, text);
}

test.describe('input number', () => {
  test('steps with the keyboard, clamps at the limits and keeps the value in sync', async ({
    page,
  }) => {
    await openPage(page, '/controls/input-number', 'Input number');
    const live = example(page, 'Decimal with buttons');
    const quantity = live.getByRole('spinbutton', { name: 'Quantity' });

    await expect(quantity).toHaveValue('3');
    await quantity.focus();
    await page.keyboard.press('ArrowUp');
    await expect(quantity).toHaveValue('4');
    await expect(live.locator('.docs-output')).toHaveText('Quantity: 4');
    await page.keyboard.press('PageUp');
    await expect(quantity).toHaveValue('14');
    await page.keyboard.press('End');
    await expect(quantity).toHaveValue('20');
    await expect(quantity).toHaveAttribute('aria-valuenow', '20');
    await expect(live.getByRole('button', { name: 'Increase' })).toBeDisabled();
    await page.keyboard.press('Home');
    await expect(quantity).toHaveValue('0');
    await expect(live.getByRole('button', { name: 'Decrease' })).toBeDisabled();

    await live.getByRole('button', { name: 'Increase' }).click();
    await expect(live.locator('.docs-output')).toHaveText('Quantity: 1');
  });

  test('typed text is parsed in the locale and formatted on blur', async ({ page }) => {
    await openPage(page, '/controls/input-number', 'Input number');
    const live = example(page, 'Currency and locale');
    const euro = live.getByRole('spinbutton', { name: 'Price in euro' });
    const dollar = live.getByRole('spinbutton', { name: 'Price in dollars' });

    await expect(euro).toHaveValue(/^1\.234,50\s€$/);
    await expect(dollar).toHaveValue('$1,234.50');
    await euro.focus();
    await euro.fill('2000,5');
    await euro.blur();
    await expect(euro).toHaveValue(/^2\.000,50\s€$/);
    // Both fields share one value.
    await expect(dollar).toHaveValue('$2,000.50');
  });

  test('formats percent, unit and suffix, and respects disabled and read-only', async ({
    page,
  }) => {
    await openPage(page, '/controls/input-number', 'Input number');
    const modes = example(page, 'Percent, unit and suffix');
    await expect(modes.getByRole('spinbutton', { name: 'Share' })).toHaveValue('25%');
    await expect(modes.getByRole('spinbutton', { name: 'Weight' })).toHaveValue(/2\s?kg/);
    await expect(modes.getByRole('spinbutton', { name: 'Items' })).toHaveValue('40 items');

    const states = example(page, 'Disabled and read-only');
    await expect(states.getByRole('spinbutton', { name: 'Disabled number' })).toBeDisabled();
    const readOnly = states.getByRole('spinbutton', { name: 'Read-only number' });
    await readOnly.focus();
    await page.keyboard.press('ArrowUp');
    await expect(readOnly).toHaveValue('12');
  });
});

test.describe('password', () => {
  test('shows and hides the password with the button', async ({ page }) => {
    await openPage(page, '/controls/password', 'Password');
    const live = example(page, 'Sign-in field');
    const input = live.locator('input');
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveAttribute('autocomplete', 'current-password');

    await input.fill('open-sesame');
    await page.keyboard.press('Tab');
    const toggle = live.getByRole('button', { name: 'Show password' });
    await expect(toggle).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(input).toHaveAttribute('type', 'text');
    await expect(live.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.keyboard.press('Space');
    await expect(input).toHaveAttribute('type', 'password');
  });

  test('feedback grows from weak to strong and the rules turn green', async ({ page }) => {
    await openPage(page, '/controls/password', 'Password');
    const live = example(page, 'New password with feedback');
    const input = live.locator('input');
    await expect(input).toHaveAttribute('autocomplete', 'new-password');
    const level = live.locator('.star-password__level');

    await input.fill('abc');
    await expect(level).toHaveText('Password strength: weak');
    await input.fill('Abcdefgh1234!');
    await expect(level).toHaveText('Password strength: strong');
    await expect(live.locator('.star-password__rule--ok')).toHaveCount(5);
  });

  test('custom rules replace the default rules', async ({ page }) => {
    await openPage(page, '/controls/password', 'Password');
    const live = example(page, 'Custom rules');
    const input = live.locator('input');
    const rules = live.locator('.star-password__rules li');
    await expect(rules).toHaveCount(2);

    await input.fill('abc d');
    await expect(rules.filter({ hasText: 'At least 8 characters' })).not.toHaveClass(/--ok/);
    await expect(rules.filter({ hasText: 'No spaces' })).not.toHaveClass(/--ok/);
    await input.fill('abcdefgh');
    await expect(rules.filter({ hasText: 'At least 8 characters' })).toHaveClass(/--ok/);
    await expect(rules.filter({ hasText: 'No spaces' })).toHaveClass(/--ok/);
  });
});

test.describe('input mask', () => {
  test('types into the mask, skips literals and clears a partial value on blur', async ({
    page,
  }) => {
    await openPage(page, '/controls/input-mask', 'Input mask');
    const live = example(page, 'Phone number');
    const phone = live.getByRole('textbox', { name: 'Phone' });

    await expect(phone).toHaveAttribute('placeholder', '(___) ___-____');
    await phone.focus();
    await expect(phone).toHaveValue('(___) ___-____');
    await phone.pressSequentially('5551234567');
    await expect(phone).toHaveValue('(555) 123-4567');
    await expect(live.locator('.docs-output')).toHaveText('Value: (555) 123-4567');

    await phone.fill('');
    await phone.pressSequentially('555');
    await page.keyboard.press('Tab');
    await expect(phone).toHaveValue('');
    await expect(live.locator('.docs-output')).toHaveText('Value: (empty)');
  });

  test('with unmask the value has only the typed characters', async ({ page }) => {
    await openPage(page, '/controls/input-mask', 'Input mask');
    const live = example(page, 'Raw value');
    const serial = live.getByRole('textbox', { name: 'Serial number' });
    await serial.focus();
    await serial.pressSequentially('ab1234x9');
    await expect(serial).toHaveValue('ab-1234-x9');
    await expect(live.locator('.docs-output')).toHaveText('Value: ab1234x9');
  });
});

test.describe('one-time code', () => {
  test('fills the boxes, moves with Backspace and the arrow keys, and completes', async ({
    page,
  }) => {
    await openPage(page, '/controls/input-otp', 'One-time code');
    const live = example(page, 'Six digits');
    const group = live.getByRole('group', { name: 'Verification code' });
    const box = (index: number) => group.getByRole('textbox', { name: `Character ${index} of 6` });

    await box(1).click();
    // A letter is not allowed with integerOnly.
    await page.keyboard.type('a');
    await expect(box(1)).toHaveValue('');
    await page.keyboard.type('12345');
    await expect(live.locator('.docs-output')).toHaveText('Value: 12345. Completed: no');
    await expect(box(6)).toBeFocused();
    await page.keyboard.type('6');
    await expect(live.locator('.docs-output')).toHaveText('Value: 123456. Completed: 123456');

    // Backspace clears the box, then goes back to the box before.
    await page.keyboard.press('Backspace');
    await expect(box(6)).toHaveValue('');
    await page.keyboard.press('Backspace');
    await expect(box(5)).toBeFocused();
    await expect(box(5)).toHaveValue('');
    await expect(live.locator('.docs-output')).toHaveText('Value: 1234. Completed: 123456');

    await page.keyboard.press('ArrowLeft');
    await expect(box(4)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(box(5)).toBeFocused();
  });

  test('a pasted code fills every box', async ({ page }) => {
    await openPage(page, '/controls/input-otp', 'One-time code');
    const live = example(page, 'Six digits');
    const group = live.getByRole('group', { name: 'Verification code' });
    await group.getByRole('textbox', { name: 'Character 1 of 6' }).click();
    await paste(page, 'star-input-otp input >> nth=0', '98 76 54');
    await expect(live.locator('.docs-output')).toHaveText('Value: 987654. Completed: 987654');
    await expect(group.getByRole('textbox', { name: 'Character 6 of 6' })).toHaveValue('4');
  });

  test('a masked code hides its characters and a disabled code cannot be edited', async ({
    page,
  }) => {
    await openPage(page, '/controls/input-otp', 'One-time code');
    const pin = example(page, 'Four characters, masked').getByRole('group', { name: 'PIN' });
    await expect(pin.locator('input')).toHaveCount(4);
    await expect(pin.locator('input').first()).toHaveAttribute('type', 'password');

    const used = example(page, 'Disabled').getByRole('group', { name: 'Used code' });
    await expect(used.locator('input:disabled')).toHaveCount(6);
    await expect(used.locator('input').nth(2)).toHaveValue('3');
  });
});

test.describe('tags field', () => {
  test('adds with Enter and separators, removes with Backspace, clears with Escape', async ({
    page,
  }) => {
    await openPage(page, '/controls/input-tags', 'Tags field');
    const live = example(page, 'Basic');
    const field = live.locator('input.star-ac__input');
    const status = live.locator('.docs-output');
    await expect(status).toHaveText('urgent, billing');

    await field.click();
    await page.keyboard.type('newsletter');
    await page.keyboard.press('Enter');
    await expect(status).toHaveText('urgent, billing, newsletter');
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();

    await page.keyboard.type('a,b;');
    await expect(status).toHaveText('urgent, billing, newsletter, a, b');

    // Escape clears the typed text, Backspace in the empty field removes the last chip.
    await page.keyboard.type('draft');
    await page.keyboard.press('Escape');
    await expect(field).toHaveValue('');
    await page.keyboard.press('Backspace');
    await expect(status).toHaveText('urgent, billing, newsletter, a');

    // Tab with typed text adds the value and keeps the focus.
    await page.keyboard.type('late');
    await page.keyboard.press('Tab');
    await expect(status).toHaveText('urgent, billing, newsletter, a, late');
    await expect(field).toBeFocused();

    await live.getByRole('button', { name: 'Remove billing' }).click();
    await expect(status).toHaveText('urgent, newsletter, a, late');
    await live.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(status).toHaveText('(none)');
  });

  test('pasted text splits at the separators', async ({ page }) => {
    await openPage(page, '/controls/input-tags', 'Tags field');
    const live = example(page, 'Basic');
    await live.locator('input.star-ac__input').click();
    await paste(page, 'star-input-tags >> nth=0 >> input.star-ac__input', 'one, two; three');
    await expect(live.locator('.docs-output')).toHaveText('urgent, billing, one, two, three');
  });

  test('rejects an invalid value, a duplicate and a value over the limit', async ({ page }) => {
    await openPage(page, '/controls/input-tags', 'Tags field');
    const live = example(page, 'Validation and limit');
    const field = live.locator('input.star-ac__input');
    const status = live.locator('.docs-output');

    await field.click();
    await page.keyboard.type('not-an-email');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('alert')).toHaveText('not-an-email is not valid.');
    await expect(status).toHaveText('Rejected: not-an-email: invalid');
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(field).toHaveValue('not-an-email');

    await field.fill('AVERY@example.com');
    await page.keyboard.press('Enter');
    await expect(live.getByRole('alert')).toHaveText('AVERY@example.com is already added.');
    await expect(status).toHaveText('Rejected: AVERY@example.com: duplicate');

    await field.fill('kim@example.com');
    await page.keyboard.press('Enter');
    await field.fill('lee@example.com');
    await page.keyboard.press('Enter');
    await expect(live.locator('.star-chip')).toHaveCount(3);
    // At the limit the field takes no more text.
    await expect(field).not.toBeEditable();
  });

  test('a disabled field has no remove buttons', async ({ page }) => {
    await openPage(page, '/controls/input-tags', 'Tags field');
    const live = example(page, 'Disabled');
    await expect(live.locator('.star-chip')).toHaveCount(2);
    await expect(live.getByRole('button')).toHaveCount(0);
    await expect(live.locator('input')).toBeDisabled();
  });
});

test.describe('input group and icon field', () => {
  test('the icon field keeps the input usable and room for the icon', async ({ page }) => {
    await openPage(page, '/controls/input-group', 'Input group and icon field');
    const live = example(page, 'Icon field');
    const search = live.getByRole('searchbox', { name: 'Search orders' });
    await search.fill('INV-1042');
    await expect(search).toHaveValue('INV-1042');
    await expect(search).toHaveCSS('padding-left', '44px');
    await expect(live.locator('.star-icon-field__icon').first()).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    // The end position puts the room on the right.
    await expect(live.getByRole('textbox', { name: 'Email' })).toHaveCSS('padding-right', '44px');
  });

  test('add-ons join the input and keep it labelled', async ({ page }) => {
    await openPage(page, '/controls/input-group', 'Input group and icon field');
    const live = example(page, 'Add-ons');
    await expect(live.getByRole('textbox', { name: 'Website' })).toBeVisible();
    await expect(live.getByText('https://')).toBeVisible();
    const weight = live.getByRole('group', { name: 'Weight' });
    await weight.getByRole('textbox', { name: 'Weight' }).fill('2.5');
    await expect(weight.getByRole('textbox')).toHaveValue('2.5');
    await expect(weight.getByText('kg')).toBeVisible();
  });

  test('the button of a group follows the input in the Tab order', async ({ page }) => {
    await openPage(page, '/controls/input-group', 'Input group and icon field');
    const group = example(page, 'With a button').getByRole('group', { name: 'Coupon' });
    await group.getByRole('textbox', { name: 'Coupon code' }).fill('SPRING');
    await page.keyboard.press('Tab');
    await expect(group.getByRole('button', { name: 'Apply' })).toBeFocused();
  });
});

test.describe('slider', () => {
  test('a slider changes with the arrow keys and Home / End', async ({ page }) => {
    await openPage(page, '/controls/slider', 'Slider');
    const live = example(page, 'Single value');
    const volume = live.getByRole('slider', { name: 'Volume' });
    await expect(volume).toHaveValue('40');
    await volume.focus();
    await page.keyboard.press('ArrowRight');
    await expect(volume).toHaveValue('41');
    await expect(live.locator('.docs-output')).toHaveText('Volume: 41');
    await expect(live.locator('output')).toHaveText('41');
    await page.keyboard.press('End');
    await expect(live.locator('.docs-output')).toHaveText('Volume: 100');
    await page.keyboard.press('Home');
    await expect(live.locator('.docs-output')).toHaveText('Volume: 0');
    await page.keyboard.press('PageUp');
    expect(Number(await volume.inputValue())).toBeGreaterThan(1);
  });

  test('steps and the formatted value follow the format function', async ({ page }) => {
    await openPage(page, '/controls/slider', 'Slider');
    const live = example(page, 'Steps and formatted value');
    const discount = live.getByRole('slider', { name: 'Discount' });
    await expect(live.locator('output')).toHaveText('15 %');
    await discount.focus();
    await page.keyboard.press('ArrowRight');
    await expect(live.locator('output')).toHaveText('20 %');
    await expect(discount).toHaveAttribute('aria-valuetext', '20 %');
    await page.keyboard.press('End');
    await expect(live.locator('output')).toHaveText('50 %');
  });

  test('the range slider keeps the low handle under the high handle', async ({ page }) => {
    await openPage(page, '/controls/slider', 'Slider');
    const live = example(page, 'Range');
    const low = live.getByRole('slider', { name: 'Price range minimum' });
    const high = live.getByRole('slider', { name: 'Price range maximum' });
    const status = live.locator('.docs-output');
    await expect(status).toHaveText('From 100 to 300');

    await low.focus();
    await page.keyboard.press('ArrowRight');
    await expect(status).toHaveText('From 110 to 300');
    await page.keyboard.press('End');
    await expect(status).toHaveText('From 300 to 300');
    await page.keyboard.press('Tab');
    await expect(high).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(status).toHaveText('From 300 to 310');
    await page.keyboard.press('Home');
    await expect(status).toHaveText('From 300 to 300');
  });

  test('a disabled slider cannot take focus', async ({ page }) => {
    await openPage(page, '/controls/slider', 'Slider');
    await expect(
      example(page, 'Disabled').getByRole('slider', { name: 'Locked value' }),
    ).toBeDisabled();
  });
});

test.describe('rating', () => {
  test('the arrow keys change the rating and the value is shown', async ({ page }) => {
    await openPage(page, '/controls/rating', 'Rating');
    const live = example(page, 'Basic');
    const group = live.getByRole('radiogroup', { name: 'Service rating' });
    await expect(group.getByRole('radio', { name: '3 of 5' })).toBeChecked();

    await group.getByRole('radio', { name: '3 of 5' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: '4 of 5' })).toBeChecked();
    await expect(live.locator('.docs-output')).toHaveText('Rating: 4');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(live.locator('.docs-output')).toHaveText('Rating: 2');

    await group.getByRole('radio', { name: '5 of 5' }).check({ force: true });
    await expect(live.locator('.docs-output')).toHaveText('Rating: 5');
  });

  test('the count sets the number of stars and read-only stars keep their value', async ({
    page,
  }) => {
    await openPage(page, '/controls/rating', 'Rating');
    const ten = example(page, 'Ten stars').getByRole('radiogroup', { name: 'Detailed rating' });
    await expect(ten.getByRole('radio')).toHaveCount(10);
    await expect(ten.getByRole('radio', { name: '7 of 10' })).toBeChecked();

    const states = example(page, 'Read-only and disabled');
    const readOnly = states.getByRole('radiogroup', { name: 'Average rating' });
    await expect(readOnly.getByRole('radio', { name: '4 of 5' })).toBeChecked();
    await expect(readOnly.getByRole('radio').first()).toBeDisabled();
    await expect(
      states.getByRole('radiogroup', { name: 'Closed rating' }).getByRole('radio').first(),
    ).toBeDisabled();
  });
});

test.describe('knob', () => {
  test('moves with the keyboard and shows the formatted value', async ({ page }) => {
    await openPage(page, '/controls/knob', 'Knob');
    const live = example(page, 'Basic');
    const knob = live.getByRole('slider', { name: 'Progress' });
    await expect(knob).toHaveAttribute('aria-valuenow', '60');
    await knob.focus();
    await page.keyboard.press('ArrowUp');
    await expect(live.locator('.docs-output')).toHaveText('Value: 61');
    await expect(knob).toHaveAttribute('aria-valuetext', '61%');
    await page.keyboard.press('PageUp');
    await expect(live.locator('.docs-output')).toHaveText('Value: 71');
    await page.keyboard.press('ArrowLeft');
    await expect(live.locator('.docs-output')).toHaveText('Value: 70');
    await page.keyboard.press('End');
    await expect(live.locator('.docs-output')).toHaveText('Value: 100');
    await page.keyboard.press('Home');
    await expect(live.locator('.docs-output')).toHaveText('Value: 0');
  });

  test('a click on the dial sets the value from the angle', async ({ page }) => {
    await openPage(page, '/controls/knob', 'Knob');
    const live = example(page, 'Basic');
    const knob = live.getByRole('slider', { name: 'Progress' });
    const box = (await knob.boundingBox())!;
    // The top of the dial is the middle of the 270 degree arc.
    await page.mouse.click(box.x + box.width / 2, box.y + 8);
    await expect(knob).toHaveAttribute('aria-valuenow', '50');
  });

  test('uses the range and the step, and read-only and disabled knobs do not move', async ({
    page,
  }) => {
    await openPage(page, '/controls/knob', 'Knob');
    const temperature = example(page, 'Range, step and size').getByRole('slider', {
      name: 'Temperature',
    });
    await temperature.focus();
    await page.keyboard.press('ArrowUp');
    await expect(temperature).toHaveAttribute('aria-valuetext', '21.5°');
    await page.keyboard.press('End');
    await expect(temperature).toHaveAttribute('aria-valuenow', '30');

    const states = example(page, 'Read-only and disabled');
    const disk = states.getByRole('slider', { name: 'Disk use' });
    await disk.focus();
    await page.keyboard.press('ArrowUp');
    await expect(disk).toHaveAttribute('aria-valuenow', '72');
    await expect(states.getByRole('slider', { name: 'Locked value' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

test.describe('color picker', () => {
  test('selects a swatch with the keyboard and a click', async ({ page }) => {
    await openPage(page, '/controls/color-picker', 'Color picker');
    const live = example(page, 'Basic');
    const group = live.getByRole('radiogroup', { name: 'Label color' });
    await expect(group.getByRole('radio', { name: '#4f46e5' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    const green = group.getByRole('radio', { name: '#16a34a' });
    await green.focus();
    await page.keyboard.press('Enter');
    await expect(live.locator('.docs-output')).toHaveText('Value: #16a34a');
    await expect(green).toHaveAttribute('aria-checked', 'true');

    await group.getByRole('radio', { name: '#dc2626' }).click();
    await expect(live.locator('.docs-output')).toHaveText('Value: #dc2626');
    await expect(green).toHaveAttribute('aria-checked', 'false');
  });

  test('the hex field takes a valid value and restores the old value after a wrong one', async ({
    page,
  }) => {
    await openPage(page, '/controls/color-picker', 'Color picker');
    const live = example(page, 'Basic');
    const hex = live.getByRole('textbox', { name: 'Label color hex value' });
    await hex.fill('zzz');
    await page.keyboard.press('Enter');
    await expect(hex).toHaveValue('#4f46e5');
    await hex.fill('0F766E');
    await page.keyboard.press('Enter');
    await expect(live.locator('.docs-output')).toHaveText('Value: #0f766e');
    await expect(hex).toHaveValue('#0f766e');
  });

  test('custom swatches replace the presets and a disabled picker cannot change', async ({
    page,
  }) => {
    await openPage(page, '/controls/color-picker', 'Color picker');
    const custom = example(page, 'Custom swatches').getByRole('radiogroup', {
      name: 'Category color',
    });
    await expect(custom.getByRole('radio')).toHaveCount(4);
    await expect(custom.getByRole('radio', { name: '#0f766e' })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    const disabled = example(page, 'Disabled');
    await expect(disabled.getByRole('radio').first()).toBeDisabled();
    await expect(disabled.getByRole('textbox', { name: 'Locked color hex value' })).toBeDisabled();
  });
});

test.describe('select button and toggle button', () => {
  test('single mode: the arrow keys move and select, with one tab stop', async ({ page }) => {
    await openPage(page, '/controls/select-button', 'Select button and toggle button');
    const live = example(page, 'Single choice');
    const group = live.getByRole('radiogroup', { name: 'Period' });
    const week = group.getByRole('radio', { name: 'Week' });
    await expect(week).toBeChecked();
    await expect(group.getByRole('radio', { name: 'Day' })).toHaveAttribute('tabindex', '-1');

    await week.focus();
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'Month' })).toBeChecked();
    await expect(live.locator('.docs-output')).toHaveText('Period: Month');
    // Past the last option the focus goes round to the first.
    await page.keyboard.press('ArrowRight');
    await expect(group.getByRole('radio', { name: 'Day' })).toBeChecked();
    await expect(group.getByRole('radio', { name: 'Day' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(group.getByRole('radio', { name: 'Month' })).toBeChecked();
  });

  test('clicking the selected option clears it unless allowEmpty is off', async ({ page }) => {
    await openPage(page, '/controls/select-button', 'Select button and toggle button');
    const period = example(page, 'Single choice');
    await period.getByRole('radio', { name: 'Week' }).click();
    await expect(period.getByRole('status')).toHaveText('Period:');

    const view = example(page, 'Objects with icons').getByRole('radiogroup', { name: 'View' });
    await expect(view.getByRole('radio', { name: 'Grid' })).toBeChecked();
    await view.getByRole('radio', { name: 'Grid' }).click();
    await expect(view.getByRole('radio', { name: 'Grid' })).toBeChecked();
    await view.getByRole('radio', { name: 'Map' }).click();
    await expect(view.getByRole('radio', { name: 'Map' })).toBeChecked();
  });

  test('multiple mode uses toggle buttons that Tab and Space reach', async ({ page }) => {
    await openPage(page, '/controls/select-button', 'Select button and toggle button');
    const live = example(page, 'Multiple and small');
    const group = live.getByRole('group', { name: 'Text style' });
    await expect(group.getByRole('button', { name: 'Bold' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await group.getByRole('button', { name: 'Bold' }).focus();
    await page.keyboard.press('Tab');
    await expect(group.getByRole('button', { name: 'Italic' })).toBeFocused();
    await page.keyboard.press('Space');
    await expect(group.getByRole('button', { name: 'Italic' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(live.locator('.docs-output')).toHaveText('Bold, Italic');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect(live.locator('.docs-output')).toHaveText('Italic');
  });

  test('the toggle button flips its state, label and icon', async ({ page }) => {
    await openPage(page, '/controls/select-button', 'Select button and toggle button');
    const live = example(page, 'Toggle button');
    const pin = live.getByRole('button', { name: 'Pin', exact: true });
    await expect(pin).toHaveAttribute('aria-pressed', 'false');
    await pin.focus();
    await page.keyboard.press('Space');
    const pinned = live.getByRole('button', { name: 'Pinned' });
    await expect(pinned).toHaveAttribute('aria-pressed', 'true');
    await expect(pinned.locator('i')).toHaveClass(/ph-fill/);
    await expect(live.getByRole('button', { name: 'Locked' })).toBeDisabled();
  });
});

// Controls that paint text on a fill: the text must reach WCAG AA (4.5:1) in both themes.
const FILLED = '.star-chip, .star-segmented__item--on, .star-toggle-btn.star-segmented__item--on';
const PAGES = ['/controls/input-tags', '/controls/select-button'];

for (const theme of ['light', 'dark'] as const) {
  test(`chips and selected segments have AA contrast in the ${theme} theme`, async ({ page }) => {
    await page.addInitScript((value) => localStorage.setItem('star-theme', value), theme);
    for (const path of PAGES) {
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await expect(page.locator(FILLED).first()).toBeVisible();
      expect(await lowContrast(page.locator(FILLED)), path).toEqual([]);
    }
  });
}
