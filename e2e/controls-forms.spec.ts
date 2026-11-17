import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { example, openPage } from './support';

test.describe('button', () => {
  test('a loading button is busy and disabled, then emits again', async ({ page }) => {
    await openPage(page, '/controls/button', 'Button');
    const live = example(page, 'Loading and disabled');
    const save = live.getByRole('button', { name: 'Save changes' });

    await save.click();
    await expect(save).toBeDisabled();
    await expect(save).toHaveAttribute('aria-busy', 'true');
    await expect(live.getByRole('status')).toHaveText('Saved 1 times');
    await expect(save).toBeEnabled();

    await expect(live.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  test('an icon-only button has its accessible name and works with the keyboard', async ({
    page,
  }) => {
    await openPage(page, '/controls/button', 'Button');
    const settings = example(page, 'Icons').getByRole('button', { name: 'Settings' });
    await settings.focus();
    await expect(settings).toBeFocused();
    await expect(settings).toHaveText('');
  });
});

test.describe('field and input', () => {
  test('links label, hint and control', async ({ page }) => {
    await openPage(page, '/controls/field', 'Field and input');
    const input = example(page, 'Label and hint').getByRole('textbox', { name: 'Full name' });
    await expect(input).toBeVisible();
    await expect(input).toHaveAccessibleDescription('As shown on your account.');
  });

  test('shows the first Signal Forms error after the user leaves the control', async ({ page }) => {
    await openPage(page, '/controls/field', 'Field and input');
    const live = example(page, 'Validation with Signal Forms');
    const input = live.getByRole('textbox', { name: 'Email' });

    await expect(live.getByRole('alert')).toHaveCount(0);
    await input.focus();
    await input.blur();
    await expect(live.getByRole('alert')).toHaveText('Enter an email address.');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('avery');
    await expect(live.getByRole('alert')).toHaveText('Enter a valid email address.');
    await input.fill('avery@example.com');
    await expect(live.getByRole('alert')).toHaveCount(0);
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });
});

test.describe('checkbox, radio and toggle switch', () => {
  test('checkbox toggles with the keyboard and clears the mixed state', async ({ page }) => {
    await openPage(page, '/controls/checkbox', 'Checkbox');
    const news = example(page, 'Two-way binding').getByRole('checkbox', {
      name: 'Send me product news',
    });
    await expect(news).toBeChecked();
    await news.focus();
    await page.keyboard.press('Space');
    await expect(news).not.toBeChecked();
    await expect(example(page, 'Two-way binding').getByRole('status')).toHaveText(
      'Subscribed: false',
    );

    const all = example(page, 'Indeterminate').getByRole('checkbox', { name: 'All regions' });
    expect(await all.evaluate((box: HTMLInputElement) => box.indeterminate)).toBe(true);
    await all.click();
    expect(await all.evaluate((box: HTMLInputElement) => box.indeterminate)).toBe(false);
    await expect(all).toBeChecked();
  });

  test('a read-only checkbox keeps its value', async ({ page }) => {
    await openPage(page, '/controls/checkbox', 'Checkbox');
    const readOnly = example(page, 'Disabled and read-only').getByRole('checkbox', {
      name: 'Read-only',
    });
    await readOnly.click();
    await expect(readOnly).toBeChecked();
  });

  test('checkbox in a Signal Form drives the form validity', async ({ page }) => {
    await openPage(page, '/controls/checkbox', 'Checkbox');
    const live = example(page, 'Signal Forms');
    await expect(live.getByRole('status')).toHaveText('Valid: false');
    await live.getByRole('checkbox', { name: 'I accept the terms' }).check();
    await expect(live.getByRole('status')).toHaveText('Valid: true');
  });

  test('radio group selects with the arrow keys and skips a disabled option', async ({ page }) => {
    await openPage(page, '/controls/radio', 'Radio');
    const live = example(page, 'Group');
    const group = live.getByRole('radiogroup', { name: 'Plan' });
    await expect(group.getByRole('radio', { name: 'Team' })).toBeChecked();

    await group.getByRole('radio', { name: 'Team' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(group.getByRole('radio', { name: 'Business' })).toBeChecked();
    await expect(live.getByRole('status')).toHaveText('Plan: business');

    const delivery = example(page, 'Disabled option').getByRole('radiogroup', { name: 'Delivery' });
    await expect(delivery.getByRole('radio', { name: /Pick-up/ })).toBeDisabled();
    await delivery.getByRole('radio', { name: 'Express' }).focus();
    await page.keyboard.press('ArrowDown');
    await expect(delivery.getByRole('radio', { name: 'Standard' })).toBeChecked();
  });

  test('toggle switch has the switch role and toggles', async ({ page }) => {
    await openPage(page, '/controls/toggle-switch', 'Toggle switch');
    const live = example(page, 'Two-way binding');
    const alerts = live.getByRole('switch', { name: 'Email alerts' });
    await expect(alerts).toBeChecked();
    await alerts.focus();
    await page.keyboard.press('Space');
    await expect(alerts).not.toBeChecked();
    await expect(live.getByRole('status')).toHaveText('Alerts: off');
    await expect(example(page, 'Disabled').getByRole('switch')).toBeDisabled();
  });
});

test.describe('tag, badge and spinner', () => {
  test('badge caps the count and reads its meaning', async ({ page }) => {
    await openPage(page, '/controls/badge', 'Badge');
    const live = example(page, 'Counts');
    await expect(live.getByRole('status', { name: '4 unread messages' })).toHaveText('4');
    await expect(live.getByRole('status', { name: '99+ open alerts' })).toHaveText('99+');
  });

  test('spinner has a default and a custom accessible name', async ({ page }) => {
    await openPage(page, '/controls/spinner', 'Spinner');
    await expect(example(page, 'Sizes').getByRole('progressbar', { name: 'Loading' })).toHaveCount(
      3,
    );
    await expect(
      example(page, 'Accessible name').getByRole('progressbar', { name: 'Loading orders' }),
    ).toBeVisible();
  });

  test('control text can be overridden for a part of the page', async ({ page }) => {
    await openPage(page, '/guides/i18n', 'Internationalisation');
    const live = example(page, 'Default and overridden text');
    await expect(live.getByRole('progressbar', { name: 'Loading', exact: true })).toBeVisible();
    await expect(live.getByRole('progressbar', { name: 'Wird geladen' })).toBeVisible();
  });
});

test.describe('forms guide', () => {
  test('Reactive Forms group follows a Signal Forms rule', async ({ page }) => {
    await openPage(page, '/guides/forms', 'Forms');
    const live = example(page, 'Reactive Forms');
    const confirmed = live.getByRole('checkbox', { name: 'Confirmed' });
    await confirmed.check();
    await expect(live.getByRole('status')).toContainText('"confirmed": true');

    await live.getByRole('switch', { name: 'Lock the form' }).check();
    await expect(confirmed).toBeDisabled();
    // A disabled control leaves the value of a Reactive Forms group.
    await expect(live.getByRole('status')).not.toContainText('confirmed');
  });

  test('a star-field label names and focuses each StarNG control (#55)', async ({ page }) => {
    await openPage(page, '/guides/forms', 'Forms');
    const live = example(page, 'Labels');
    const controls = [
      { label: 'Warehouse', control: live.getByRole('combobox', { name: 'Warehouse' }) },
      { label: 'Notify teams', control: live.getByRole('combobox', { name: 'Notify teams' }) },
      {
        label: 'Destination city',
        control: live.getByRole('combobox', { name: 'Destination city' }),
      },
      { label: 'Ship date', control: live.getByRole('textbox', { name: 'Ship date' }) },
      { label: 'Pickup time', control: live.locator('star-time-picker input') },
      { label: 'Cost center', control: live.getByRole('button', { name: /^Cost center/ }) },
    ];
    for (const { label, control } of controls) {
      // getByLabel finds the control through label[for] or aria-labelledby.
      const byLabel = live.getByLabel(label);
      await expect(byLabel, label).toHaveCount(1);
      await expect(byLabel, label).toBeVisible();
      await expect(control, label).toHaveCount(1);
      await live.locator('label.star-field__label', { hasText: label }).click();
      await expect(control, label).toBeFocused();
      await expect(byLabel, label).toBeFocused();
    }
    await expect(live.getByRole('combobox', { name: 'Warehouse' })).toHaveAccessibleDescription(
      'The order ships from here.',
    );
  });

  test('the Labels example has no axe violations (#55)', async ({ page }) => {
    await openPage(page, '/guides/forms', 'Forms');
    await expect(example(page, 'Labels').locator('star-field')).toHaveCount(6);
    const results = await new AxeBuilder({ page })
      .include('docs-example .docs-example__live')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
      .analyze();
    const found = results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    );
    expect(found).toEqual([]);
  });
});
