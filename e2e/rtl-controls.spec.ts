import { expect, Locator, Page, test } from '@playwright/test';
import { example, openPage } from './support';

/**
 * Right-to-left behavior of the controls in a real browser: key direction, which side a popup
 * or a panel opens to, mirrored icons and scrolling. The page is opened with `dir="rtl"` on
 * `<html>` (the docs application reads the saved choice). Layout checks need real geometry, so
 * jsdom (`specs/rtl.spec.ts`) cannot do them.
 */

test.describe('right-to-left controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('star-direction', 'rtl'));
  });

  const popup = (page: Page) => page.locator('.cdk-overlay-container');
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  /**
   * Box of an element that is still moving (a popup that is placed or scales in, a slide-in
   * panel): polls until two reads, one poll interval apart, are the same.
   */
  const settledBox = async (locator: Locator) => {
    let last = '';
    let current!: NonNullable<Awaited<ReturnType<Locator['boundingBox']>>>;
    await expect
      .poll(
        async () => {
          current = await box(locator);
          const key = JSON.stringify(current);
          const same = key === last;
          last = key;
          return same;
        },
        { intervals: [50, 100, 250] },
      )
      .toBe(true);
    return current;
  };
  const centerX = async (locator: Locator) => {
    const b = await box(locator);
    return b.x + b.width / 2;
  };

  test.describe('keys follow the visual direction', () => {
    test('tabs: the first tab is on the right and Arrow left selects the next one', async ({
      page,
    }) => {
      await openPage(page, '/controls/tabs', 'Tabs');
      const live = example(page, 'Basic tabs');
      const details = live.getByRole('tab', { name: /^Details/ });
      const items = live.getByRole('tab', { name: /^Items/ });
      expect(await centerX(details)).toBeGreaterThan(await centerX(items));

      await details.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(items).toBeFocused();
      await expect(items).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(details).toBeFocused();
    });

    test('select button: Arrow left selects the next option', async ({ page }) => {
      await openPage(page, '/controls/select-button', 'Select button and toggle button');
      const live = example(page, 'Single choice');
      const group = live.getByRole('radiogroup', { name: 'Period' });
      const day = group.getByRole('radio', { name: 'Day' });
      const week = group.getByRole('radio', { name: 'Week' });
      expect(await centerX(day)).toBeGreaterThan(await centerX(week));
      await day.focus();
      await day.press('ArrowLeft');
      await expect(week).toBeFocused();
      await expect(live.getByRole('status')).toHaveText('Period: Week');
    });

    test('one-time code: Arrow left moves to the next box, which is on the left', async ({
      page,
    }) => {
      await openPage(page, '/controls/input-otp', 'One-time code');
      const group = example(page, 'Six digits').getByRole('group', { name: 'Verification code' });
      const box1 = group.getByRole('textbox', { name: 'Character 1 of 6' });
      const box2 = group.getByRole('textbox', { name: 'Character 2 of 6' });
      expect(await centerX(box1)).toBeGreaterThan(await centerX(box2));
      await box1.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(box2).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(box1).toBeFocused();
    });

    test('time picker: the hour column is on the right and Arrow left moves to the minutes', async ({
      page,
    }) => {
      await openPage(page, '/controls/time-picker', 'Time picker');
      await example(page, 'Limits and step').getByRole('button', { name: 'Choose time' }).click();
      const dialog = page.getByRole('dialog', { name: 'Choose time' });
      const hours = dialog.getByRole('listbox', { name: 'Hour' });
      const minutes = dialog.getByRole('listbox', { name: 'Minute' });
      expect(await centerX(hours)).toBeGreaterThan(await centerX(minutes));
      const hour = hours.getByRole('option', { name: '08', exact: true });
      await expect(hour).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(minutes.getByRole('option', { name: '30', exact: true })).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(hour).toBeFocused();
    });

    test('date and time: the hour column is on the right of the minutes', async ({ page }) => {
      await openPage(page, '/controls/date-picker', 'Date picker');
      const live = example(page, 'Date and time');
      await live.evaluate((element) => element.scrollIntoView({ block: 'start' }));
      await live.getByRole('button', { name: 'Choose date' }).click();
      const time = page.getByRole('dialog', { name: 'Choose date' }).getByRole('group', {
        name: 'Time',
      });
      const hours = time.getByRole('listbox', { name: 'Hour' });
      const minutes = time.getByRole('listbox', { name: 'Minute' });
      expect(await centerX(hours)).toBeGreaterThan(await centerX(minutes));
      const hour = hours.getByRole('option', { name: '09', exact: true });
      await hour.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(minutes.getByRole('option', { name: '30', exact: true })).toBeFocused();
    });

    test('color panel: the saturation and the hue grow toward the left', async ({ page }) => {
      await openPage(page, '/controls/color-picker', 'Color picker');
      await example(page, 'Basic').getByRole('button', { name: 'Custom color' }).click();
      const panel = page.getByRole('dialog', { name: 'Custom color' });
      const area = panel.getByRole('slider', { name: 'Saturation and brightness' });
      const hue = panel.getByRole('slider', { name: 'Hue' });
      await expect(area).toBeFocused();
      // Arrow left is toward the end of the line: more saturation.
      await page.keyboard.press('ArrowLeft');
      await expect(area).toHaveAttribute('aria-valuetext', 'Saturation 70%, brightness 90%');
      await hue.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(hue).toHaveAttribute('aria-valuenow', '244');
      // Full saturation is at the left edge, so its thumb is left of the middle.
      await area.focus();
      await page.keyboard.press('End');
      const areaBox = await box(area);
      const thumb = await box(area.locator('.star-color__thumb'));
      expect(thumb.x + thumb.width / 2).toBeLessThan(areaBox.x + areaBox.width / 4);
    });

    test('calendar: Arrow left is the following day, the week starts on the right', async ({
      page,
    }) => {
      await openPage(page, '/controls/calendar', 'Calendar');
      const live = example(page, 'Inline calendar');
      const grid = live.getByRole('grid');
      const active = () => live.locator('.star-calendar__day[tabindex="0"]');
      const first = grid.getByRole('columnheader').first();
      const last = grid.getByRole('columnheader').last();
      expect(await centerX(first)).toBeGreaterThan(await centerX(last));

      await active().focus();
      await expect(active()).toBeFocused();
      const start = await active().getAttribute('data-date');
      await page.keyboard.press('ArrowLeft');
      // Wait for the move: the attribute is read at once, and the focus follows after a render.
      await expect(active()).not.toHaveAttribute('data-date', start!);
      await expect(active()).toBeFocused();
      const next = await active().getAttribute('data-date');
      expect(new Date(next!).getTime() - new Date(start!).getTime()).toBe(24 * 3600 * 1000);
      // The following day is visually to the left of the day before it.
      expect(await centerX(active())).toBeLessThan(
        await centerX(live.locator(`[data-date="${start}"]`)),
      );
      await page.keyboard.press('ArrowRight');
      await expect(active()).toHaveAttribute('data-date', start!);
      await expect(active()).toBeFocused();
    });

    test('tree: Arrow left opens a branch and Arrow right closes it', async ({ page }) => {
      await openPage(page, '/controls/tree', 'Tree');
      const tree = example(page, 'Expand and collapse').getByRole('tree');
      const media = tree.getByRole('treeitem', { name: /Media/ });
      await expect(media).toHaveAttribute('aria-expanded', 'false');
      await media.focus();
      await page.keyboard.press('ArrowRight');
      await expect(media).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('ArrowLeft');
      await expect(media).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('ArrowRight');
      await expect(media).toHaveAttribute('aria-expanded', 'false');
    });

    test('splitter: Arrow left grows the first pane (on the right), a drag measures from the right', async ({
      page,
    }) => {
      await openPage(page, '/controls/splitter', 'Splitter');
      const live = example(page, 'Horizontal');
      const gutter = live.getByRole('separator', { name: 'Resize the order panes' });
      await expect(gutter).toHaveAttribute('aria-valuenow', '50');
      await gutter.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(gutter).toHaveAttribute('aria-valuenow', '52');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(gutter).toHaveAttribute('aria-valuenow', '48');

      // Drag the gutter to a quarter of the width from the left: the first pane is on the right,
      // so it gets three quarters.
      const splitter = live.locator('star-splitter');
      const frame = await box(splitter);
      const handle = await box(gutter);
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
      await page.mouse.down();
      await page.mouse.move(frame.x + frame.width * 0.25, handle.y + handle.height / 2, {
        steps: 6,
      });
      await page.mouse.up();
      const size = Number(await gutter.getAttribute('aria-valuenow'));
      expect(size).toBeGreaterThan(70);
      expect(size).toBeLessThan(80);
    });

    test('galleria: Arrow left shows the next image', async ({ page }) => {
      await openPage(page, '/controls/galleria', 'Galleria');
      const live = example(page, 'Images and thumbnails');
      const stage = live.locator('.star-galleria__stage');
      await expect(live.locator('.star-galleria__stage img')).toHaveAttribute(
        'alt',
        /Loading dock 1/,
      );
      await stage.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(live.locator('.star-galleria__stage img')).toHaveAttribute(
        'alt',
        /Loading dock 2/,
      );
      // The previous button is on the right, the next button on the left.
      expect(await centerX(live.getByRole('button', { name: 'Previous image' }))).toBeGreaterThan(
        await centerX(live.getByRole('button', { name: 'Next image' })),
      );
    });

    test('slider: the minimum is on the right and the arrow keys follow the thumb', async ({
      page,
    }) => {
      await openPage(page, '/controls/slider', 'Slider');
      const slider = example(page, 'Single value').getByRole('slider', { name: 'Volume' });
      await expect(slider).toHaveValue('40');
      const thumbAt = async () =>
        slider.evaluate((input: HTMLInputElement) => {
          const rect = input.getBoundingClientRect();
          const share =
            (input.valueAsNumber - Number(input.min)) / (Number(input.max) - Number(input.min));
          // Native direction: where the browser puts the thumb.
          return getComputedStyle(input).direction === 'rtl'
            ? rect.right - share * rect.width
            : rect.left + share * rect.width;
        });
      const before = await thumbAt();
      await slider.focus();
      await page.keyboard.press('ArrowLeft');
      // Arrow left moves the thumb to the left: the value rises, because 100 is on the left.
      await expect(slider).toHaveValue('41');
      expect(await thumbAt()).toBeLessThan(before);
      await page.keyboard.press('ArrowRight');
      await expect(slider).toHaveValue('40');
      // The painted fill runs from the right edge to the thumb (value 40 is 40 % from the right):
      // a pixel near the right edge has the primary color, one near the left edge does not.
      const pixel = async (fromLeft: number) => {
        const at = await box(slider);
        const png = await page.screenshot({
          clip: { x: at.x, y: at.y + at.height / 2 - 1, width: at.width, height: 2 },
        });
        return page.evaluate(
          async ({ data, share }) => {
            const image = new Image();
            image.src = `data:image/png;base64,${data}`;
            await image.decode();
            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext('2d')!;
            context.drawImage(image, 0, 0);
            const [red, , blue] = context.getImageData(
              Math.floor(image.width * share),
              0,
              1,
              1,
            ).data;
            return blue - red;
          },
          { data: png.toString('base64'), share: fromLeft },
        );
      };
      await slider.blur();
      expect(await pixel(0.92)).toBeGreaterThan(100);
      expect(await pixel(0.08)).toBeLessThan(40);
    });

    test('rating: the first star is on the right and Arrow left selects the next star', async ({
      page,
    }) => {
      await openPage(page, '/controls/rating', 'Rating');
      const live = example(page, 'Basic');
      const group = live.getByRole('radiogroup', { name: 'Service rating' });
      const star = (n: number) => group.getByRole('radio', { name: `${n} of 5` });
      await expect(star(3)).toBeChecked();
      expect(await centerX(group.locator('label').first())).toBeGreaterThan(
        await centerX(group.locator('label').last()),
      );
      await star(3).focus();
      await page.keyboard.press('ArrowLeft');
      await expect(star(4)).toBeChecked();
      await page.keyboard.press('ArrowRight');
      await expect(star(3)).toBeChecked();
    });

    test('table: Arrow left makes a column wider, and the resize handle is on the left edge', async ({
      page,
    }) => {
      await openPage(page, '/controls/table-columns', 'Table columns');
      const live = example(page, 'Resize columns');
      const table = live.getByRole('table', { name: 'Orders with resizable columns' });
      const handle = table.getByRole('separator', { name: 'Resize Customer' });
      const header = table.getByRole('columnheader', { name: 'Customer' });
      const headerBox = await box(header);
      const handleBox = await box(handle);
      expect(handleBox.x + handleBox.width / 2).toBeLessThan(headerBox.x + headerBox.width / 2);
      const start = headerBox.width;

      await handle.focus();
      await page.keyboard.press('ArrowLeft');
      await expect(header).toHaveCSS('width', `${Math.round(start + 16)}px`);
      await page.keyboard.press('ArrowRight');
      await expect(header).toHaveCSS('width', `${Math.round(start)}px`);

      // A drag to the left widens the column.
      const at = await box(handle);
      await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
      await page.mouse.down();
      await page.mouse.move(at.x + at.width / 2 - 30, at.y + at.height / 2, { steps: 5 });
      await page.mouse.up();
      expect((await box(header)).width).toBeGreaterThan(start + 20);
    });
  });

  test.describe('menus', () => {
    test('menu: a submenu opens to the left with Arrow left and closes with Arrow right', async ({
      page,
    }) => {
      await openPage(page, '/controls/menu', 'Menu');
      const trigger = example(page, 'Nested submenu').getByRole('button', { name: 'View' });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(popup(page).getByRole('menu')).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      const layout = popup(page).getByRole('menuitem', { name: 'Layout' });
      await expect(layout).toBeFocused();
      // The root menu is aligned with the right edge of its trigger.
      const root = await settledBox(popup(page).getByRole('menu').first());
      const triggerBox = await box(trigger);
      expect(Math.abs(root.x + root.width - (triggerBox.x + triggerBox.width))).toBeLessThan(2);

      await page.keyboard.press('ArrowLeft');
      const single = popup(page).getByRole('menuitem', { name: 'Single column' });
      await expect(single).toBeFocused();
      const parent = await settledBox(layout);
      const sub = await settledBox(single);
      expect(sub.x + sub.width).toBeLessThanOrEqual(parent.x + 4);

      await page.keyboard.press('ArrowRight');
      await expect(popup(page).getByRole('menuitem', { name: 'Single column' })).toHaveCount(0);
      await expect(layout).toBeFocused();
    });

    test('menubar: Arrow left moves to the next item and a dropdown starts at the right edge', async ({
      page,
    }) => {
      await openPage(page, '/controls/menubar', 'Menubar');
      const bar = example(page, 'File, edit and view').getByRole('menubar', { name: 'Main' });
      const file = bar.getByRole('menuitem', { name: 'File' });
      const edit = bar.getByRole('menuitem', { name: 'Edit' });
      expect(await centerX(file)).toBeGreaterThan(await centerX(edit));
      await file.click();
      // Escape only closes a dropdown that is open: wait for it, then for it to be gone.
      await expect(popup(page).getByRole('menu')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(popup(page).getByRole('menu')).toHaveCount(0);
      await expect(file).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(edit).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(file).toBeFocused();

      await page.keyboard.press('ArrowDown');
      const menu = await settledBox(popup(page).getByRole('menu').first());
      const fileBox = await box(file);
      expect(Math.abs(menu.x + menu.width - (fileBox.x + fileBox.width))).toBeLessThan(2);
    });

    test('cascade select: Arrow left opens a submenu and Arrow right returns to the parent', async ({
      page,
    }) => {
      await openPage(page, '/controls/cascade-select', 'Cascade select');
      const city = example(page, 'Country, state and city').getByRole('button', { name: 'City' });
      await city.focus();
      await page.keyboard.press('Enter');
      const germany = page.getByRole('menuitem', { name: 'Germany' });
      await expect(germany).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(germany).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      const bavaria = page.getByRole('menuitem', { name: 'Bavaria' });
      await expect(bavaria).toBeFocused();
      // The submenu opens to the left of its parent.
      const submenu = await settledBox(bavaria);
      expect(submenu.x + submenu.width).toBeLessThanOrEqual((await settledBox(germany)).x + 4);
      await page.keyboard.press('ArrowRight');
      await expect(germany).toBeFocused();
    });

    test('mega menu: Arrow left moves to the next item and the panel starts at the right edge', async ({
      page,
    }) => {
      await openPage(page, '/controls/mega-menu', 'Mega menu');
      const bar = example(page, 'Panel with columns').getByRole('menubar', { name: 'Catalogue' });
      const products = bar.getByRole('menuitem', { name: 'Products' });
      const orders = bar.getByRole('menuitem', { name: 'Orders' });
      expect(await centerX(products)).toBeGreaterThan(await centerX(orders));
      await products.click();
      // Escape only closes a panel that is open: wait for it, then for it to be gone.
      await expect(page.locator('.star-mega-menu__panel')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.star-mega-menu__panel')).toHaveCount(0);
      await expect(products).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(orders).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(products).toBeFocused();
      await page.keyboard.press('ArrowDown');
      const panel = await settledBox(page.locator('.star-mega-menu__panel'));
      const item = await box(products);
      expect(Math.abs(panel.x + panel.width - (item.x + item.width))).toBeLessThan(2);
    });

    test('select: the list is aligned with the right edge of the field', async ({ page }) => {
      await openPage(page, '/controls/select', 'Select');
      const field = example(page, 'Objects as options').getByRole('combobox');
      await field.click();
      // The panel is a native popover, so it is found from the page.
      const panel = page.getByRole('listbox', { name: 'Country', exact: true });
      await expect(panel).toBeVisible();
      const fieldBox = await box(field);
      const panelBox = await settledBox(panel);
      expect(Math.abs(panelBox.x + panelBox.width - (fieldBox.x + fieldBox.width))).toBeLessThan(3);
    });

    test('date picker: the popup is aligned with the right edge of the field', async ({ page }) => {
      await openPage(page, '/controls/date-picker', 'Date picker');
      const live = example(page, 'Single date');
      const field = live.locator('.star-date__control');
      await live
        .getByRole('button', { name: /calendar|choose date/i })
        .first()
        .click();
      const panel = page.locator('.star-date__panel');
      await expect(panel).toBeVisible();
      const fieldBox = await box(field);
      const panelBox = await settledBox(panel);
      expect(Math.abs(panelBox.x + panelBox.width - (fieldBox.x + fieldBox.width))).toBeLessThan(3);
    });
  });

  test.describe('side names', () => {
    test('speed dial: left and right are physical, start and end follow the direction', async ({
      page,
    }) => {
      await openPage(page, '/controls/speed-dial', 'Speed dial');
      const dial = async (live: Locator, name: string) => {
        const root = live.locator('star-speed-dial').filter({
          has: page.getByRole('button', { name, exact: true }),
        });
        const fab = root.getByRole('button', { name, exact: true });
        // Measured before the click: the open button rotates, which widens its box.
        const fabBox = await box(fab);
        await fab.click();
        const actions = root.locator('.star-speed-dial__action');
        await expect(actions).toHaveCount(3);
        // The actions scale in: measure after the open animation, or a box is a fraction off.
        await root.evaluate((element) =>
          Promise.all(
            element.getAnimations({ subtree: true }).map((animation) => animation.finished),
          ),
        );
        return { fabBox, actions: [await box(actions.nth(0)), await box(actions.nth(2))] };
      };
      const directions = example(page, 'Directions');
      const left = await dial(directions, 'Actions left');
      for (const action of left.actions)
        expect(action.x + action.width).toBeLessThan(left.fabBox.x);
      // The first action is next to the button.
      expect(left.actions[0].x).toBeGreaterThan(left.actions[1].x);

      const right = await dial(directions, 'Actions right');
      for (const action of right.actions)
        expect(action.x).toBeGreaterThan(right.fabBox.x + right.fabBox.width);
      expect(right.actions[0].x).toBeLessThan(right.actions[1].x);

      const logical = example(page, 'Start and end');
      const start = await dial(logical, 'Actions at the start');
      for (const action of start.actions)
        expect(action.x).toBeGreaterThan(start.fabBox.x + start.fabBox.width);
      expect(start.actions[0].x).toBeLessThan(start.actions[1].x);
      const end = await dial(logical, 'Actions at the end');
      for (const action of end.actions) expect(action.x + action.width).toBeLessThan(end.fabBox.x);
      expect(end.actions[0].x).toBeGreaterThan(end.actions[1].x);
    });

    test('speed dial keys: the arrow that points along the list moves on', async ({ page }) => {
      await openPage(page, '/controls/speed-dial', 'Speed dial');
      const root = example(page, 'Start and end')
        .locator('star-speed-dial')
        .filter({ has: page.getByRole('button', { name: 'Actions at the start', exact: true }) });
      await root.getByRole('button', { name: 'Actions at the start', exact: true }).click();
      const actions = root.locator('.star-speed-dial__action');
      await expect(actions.first()).toBeFocused();
      // The list of "start" opens to the right in right-to-left.
      await page.keyboard.press('ArrowRight');
      await expect(actions.nth(1)).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(actions.first()).toBeFocused();
    });

    test('drawer: left and right are the screen edges, start and end follow the direction', async ({
      page,
    }) => {
      await openPage(page, '/controls/drawer', 'Drawer');
      const live = example(page, 'Position and size');
      const viewport = page.viewportSize()!;
      const drawer = page
        .locator('dialog.star-drawer')
        .filter({ hasText: 'This drawer is pinned' });
      const sides: Record<string, 'left' | 'right'> = {
        left: 'left',
        right: 'right',
        start: 'right',
        end: 'left',
      };
      for (const [name, side] of Object.entries(sides)) {
        await live.getByRole('button', { name, exact: true }).click();
        await expect(drawer).toBeVisible();
        // The slide-in transition ends.
        await expect
          .poll(async () => Math.round((await box(drawer)).x))
          .toBe(side === 'left' ? 0 : Math.round(viewport.width - (await box(drawer)).width));
        await page.keyboard.press('Escape');
        await expect(drawer).toBeHidden();
      }
    });

    test('toast: corners with start and end follow the direction', async ({ page }) => {
      await openPage(page, '/controls/toast', 'Toast');
      const live = example(page, 'Corners that follow the direction');
      const viewport = page.viewportSize()!;
      await live.getByRole('button', { name: 'Message at the start' }).click();
      const start = live.locator('.star-toast-stack--bottom-start');
      await expect(start.getByText('Corner: start')).toBeVisible();
      // Start is the right side in right-to-left.
      expect((await settledBox(start)).x).toBeGreaterThan(viewport.width / 2);
      await live.getByRole('button', { name: 'Message at the end' }).click();
      const end = live.locator('.star-toast-stack--bottom-end');
      await expect(end.getByText('Corner: end')).toBeVisible();
      const endBox = await settledBox(end);
      expect(endBox.x + endBox.width).toBeLessThan(viewport.width / 2);
      // The accent line is on the start side: the right border of the message.
      await expect(start.locator('.star-toast').first()).toHaveCSS('border-right-width', '4px');
      await expect(start.locator('.star-toast').first()).toHaveCSS('border-left-width', '1px');
    });

    test('tooltip: left and right are physical, start and end follow the direction', async ({
      page,
    }) => {
      await openPage(page, '/controls/tooltip', 'Tooltip');
      const live = example(page, 'Positions');
      const tooltip = page.getByRole('tooltip');
      const show = async (name: string) => {
        const button = live.getByRole('button', { name, exact: true });
        await button.hover();
        await expect(tooltip).toBeVisible();
        const result = { button: await box(button), tip: await settledBox(tooltip) };
        await page.mouse.move(0, 0);
        await expect(tooltip).toHaveCount(0);
        return result;
      };
      const left = await show('Left');
      expect(left.tip.x + left.tip.width).toBeLessThanOrEqual(left.button.x + 1);
      const right = await show('Right');
      expect(right.tip.x).toBeGreaterThanOrEqual(right.button.x + right.button.width - 1);
      const start = await show('Start');
      expect(start.tip.x).toBeGreaterThanOrEqual(start.button.x + start.button.width - 1);
      const end = await show('End');
      expect(end.tip.x + end.tip.width).toBeLessThanOrEqual(end.button.x + 1);
    });

    test('popover: aligned with the right edge of its anchor', async ({ page }) => {
      await openPage(page, '/controls/popover', 'Popover');
      const button = example(page, 'Details popover').getByRole('button', { name: 'Details' });
      await button.click();
      const panel = page.getByRole('dialog', { name: 'Order details' });
      await expect(panel).toBeVisible();
      const buttonBox = await box(button);
      const panelBox = await settledBox(panel);
      expect(Math.abs(panelBox.x + panelBox.width - (buttonBox.x + buttonBox.width))).toBeLessThan(
        3,
      );
    });
  });

  test.describe('scrolling', () => {
    test('carousel: pages run to the left and the scroll offset is negative', async ({ page }) => {
      await openPage(page, '/controls/carousel', 'Carousel');
      const region = example(page, 'One slide per page').getByRole('region', {
        name: 'Warehouse photos',
      });
      const track = region.locator('.star-carousel__track');
      const next = region.getByRole('button', { name: 'Next slides' });
      const previous = region.getByRole('button', { name: 'Previous slides' });
      // Previous is on the right, next on the left.
      expect(await centerX(previous)).toBeGreaterThan(await centerX(next));
      await expect(previous).toBeDisabled();
      const dot = () =>
        region
          .locator('.star-carousel__dot')
          .evaluateAll((dots) => dots.findIndex((d) => d.getAttribute('aria-current') === 'true'));
      expect(await dot()).toBe(0);

      await next.focus();
      await page.keyboard.press('Enter');
      await expect.poll(dot).toBe(1);
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeLessThan(-50);
      // The second slide is in view: it is the one at the right edge of the track. The track
      // scrolls smoothly, so the position is polled until the scroll has arrived.
      const slideAtStart = (name: string) => async () => {
        const trackBox = await box(track);
        const slide = await box(region.getByRole('group', { name }));
        return Math.abs(slide.x + slide.width - (trackBox.x + trackBox.width));
      };
      await expect.poll(slideAtStart('2 of 6')).toBeLessThan(2);

      await page.keyboard.press('Space');
      await expect.poll(dot).toBe(2);
      await expect.poll(slideAtStart('3 of 6')).toBeLessThan(2);
      await previous.focus();
      await page.keyboard.press('Enter');
      await expect.poll(dot).toBe(1);
      await expect.poll(slideAtStart('2 of 6')).toBeLessThan(2);
      await page.keyboard.press('Enter');
      await expect.poll(dot).toBe(0);
      await expect(previous).toBeDisabled();
      await expect.poll(slideAtStart('1 of 6')).toBeLessThan(2);
      expect(await track.evaluate((el) => el.scrollLeft)).toBe(0);
    });
  });

  test.describe('table scrolling', () => {
    test('frozen columns stick to the right edge while the table scrolls to the left', async ({
      page,
    }) => {
      // A narrow window, so that the wide table overflows.
      await page.setViewportSize({ width: 700, height: 900 });
      await openPage(page, '/controls/table-columns', 'Table columns');
      const live = example(page, 'Frozen columns');
      const table = live.getByRole('table', { name: 'Wide orders' });
      await table.scrollIntoViewIfNeeded();
      const first = table.getByRole('columnheader', { name: 'Order' });
      const second = table.getByRole('columnheader', { name: 'Customer' });
      const scroll = live.locator('.star-table__scroll');
      // The scroll area starts at its right edge: the first column is there.
      expect(await scroll.evaluate((viewport) => viewport.scrollLeft)).toBeLessThanOrEqual(0);
      const right = (await box(scroll)).x + (await box(scroll)).width;
      const at = await box(first);
      expect(Math.abs(at.x + at.width - right)).toBeLessThan(3);

      // In right-to-left the scroll offset runs below zero.
      await scroll.evaluate((viewport) => (viewport.scrollLeft = -300));
      expect(await scroll.evaluate((viewport) => viewport.scrollLeft)).toBeLessThan(-50);
      // Both frozen headers stay at the right edge of the scroll area, next to each other (a
      // pixel of border is allowed).
      await expect
        .poll(async () => {
          const a = await box(first);
          const b = await box(second);
          return Math.abs(a.x + a.width - right) < 3 && Math.abs(b.x + b.width - a.x) < 2;
        })
        .toBe(true);
    });
  });

  test.describe('table pinning', () => {
    test('end pins stick to the left edge and the shadow mirrors', async ({ page }) => {
      await page.setViewportSize({ width: 700, height: 900 });
      await openPage(page, '/controls/table-columns', 'Table columns');
      const live = example(page, 'Pin to start and end');
      const table = live.getByRole('table', { name: 'Orders with pinned columns' });
      await table.scrollIntoViewIfNeeded();
      const scroll = live.locator('.star-table__scroll');
      const total = table.locator('thead th[data-field="total"]');
      const atLeft = () =>
        scroll.evaluate((viewport) => {
          const cell = viewport.querySelector('th[data-field="total"]')!.getBoundingClientRect();
          const area = viewport.getBoundingClientRect();
          return Math.abs(cell.left - (area.left + viewport.clientLeft)) < 2;
        });
      await expect.poll(atLeft).toBe(true);
      await scroll.evaluate((viewport) => (viewport.scrollLeft = -200));
      await expect.poll(atLeft).toBe(true);
      // The separator shadow is on the inner (right) edge of the end pin.
      const shadow = await total.evaluate((cell) => getComputedStyle(cell).boxShadow);
      expect(shadow).toMatch(/ 6px 0px 6px -6px/);
    });
  });

  test.describe('icons and geometry', () => {
    const scaleOf = (locator: Locator) =>
      locator.evaluate((element) => getComputedStyle(element).scale);

    test('direction icons turn around, icons with a fixed meaning do not', async ({ page }) => {
      await openPage(page, '/controls/breadcrumb', 'Breadcrumb');
      const separator = example(page, 'Trail with a home link')
        .locator('.star-breadcrumb__sep')
        .first();
      expect(await scaleOf(separator)).toBe('-1 1');

      await openPage(page, '/controls/paginator', 'Paginator');
      const live = example(page, 'Pages of a list');
      expect(await scaleOf(live.locator('[aria-label="Next page"] i'))).toBe('-1 1');
      expect(await scaleOf(live.locator('[aria-label="Previous page"] i'))).toBe('-1 1');

      await openPage(page, '/controls/calendar', 'Calendar');
      expect(
        await scaleOf(example(page, 'Inline calendar').locator('.star-calendar__nav i').first()),
      ).toBe('-1 1');

      await openPage(page, '/controls/stepper', 'Stepper');
      // A check mark is not directional.
      const done = example(page, 'Free navigation').locator('.ph-check').first();
      expect(await scaleOf(done)).toBe('none');
    });

    test('mirrored icons stay as they are in left-to-right', async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('star-direction', 'ltr'));
      await openPage(page, '/controls/paginator', 'Paginator');
      const live = example(page, 'Pages of a list');
      expect(await scaleOf(live.locator('[aria-label="Next page"] i'))).toBe('none');
    });

    test('the tree expander points to the end when closed and down when open', async ({ page }) => {
      await openPage(page, '/controls/tree', 'Tree');
      const tree = example(page, 'Expand and collapse').getByRole('tree');
      const toggle = tree.getByRole('treeitem', { name: /Media/ }).locator('.star-tree__toggle i');
      // Where the arrow points after `scale` and `rotate` (a caret that points right is (1, 0);
      // y grows downward).
      const pointing = (locator: Locator) =>
        locator.evaluate((element) => {
          const style = getComputedStyle(element);
          const scale = style.scale === 'none' ? 1 : Number(style.scale.split(' ')[0]);
          const rotate = style.rotate === 'none' ? 0 : parseFloat(style.rotate);
          const radians = (rotate * Math.PI) / 180;
          return {
            x: Math.round(scale * Math.cos(radians)) || 0,
            y: Math.round(scale * Math.sin(radians)) || 0,
          };
        });
      // Closed: points left, the end of the line in right-to-left.
      expect(await pointing(toggle)).toEqual({ x: -1, y: 0 });
      await toggle.click();
      await expect.poll(() => pointing(toggle)).toEqual({ x: 0, y: 1 });
    });

    test('image compare keeps the left image on the left', async ({ page }) => {
      await openPage(page, '/controls/image-compare', 'Image compare');
      const compare = example(page, 'Before and after').locator('star-image-compare');
      await expect(compare).toHaveCSS('direction', 'ltr');
      const range = compare.getByRole('slider');
      await range.focus();
      await page.keyboard.press('ArrowRight');
      await expect(range).toHaveValue('51');
      // The divider moved to the right with the key.
      const frame = await box(compare);
      const divider = await box(compare.locator('.star-compare__divider'));
      expect(divider.x + divider.width / 2).toBeGreaterThan(frame.x + frame.width / 2);
    });

    test('chart: the plot keeps its direction, the legend starts on the right', async ({
      page,
    }) => {
      await openPage(page, '/controls/chart', 'Chart');
      const live = example(page, 'Bar chart');
      const svg = live.locator('.star-chart__svg');
      await expect(svg).toHaveCSS('direction', 'ltr');
      const legend = await box(live.locator('.star-chart__legend li').first());
      const frame = await box(live.locator('.star-chart'));
      expect(legend.x + legend.width).toBeGreaterThan(frame.x + frame.width - 40);
    });

    test('switch: the thumb starts on the right and moves left when checked', async ({ page }) => {
      await openPage(page, '/controls/toggle-switch', 'Toggle switch');
      const live = example(page, 'Small');
      const control = live.getByRole('switch');
      const thumb = live.locator('.star-switch__thumb').first();
      const track = live.locator('.star-switch__track').first();
      const trackBox = await box(track);
      const middle = trackBox.x + trackBox.width / 2;
      await expect.poll(async () => (await centerX(thumb)) > middle).toBe(true);
      await control.click();
      await expect.poll(async () => (await centerX(thumb)) < middle).toBe(true);
    });

    test('progress and skeleton animations run toward the left', async ({ page }) => {
      await openPage(page, '/controls/progress-bar', 'Progress bar');
      const fill = page.locator('.star-progress--indeterminate .star-progress__fill').first();
      await expect(fill).toHaveCSS('animation-name', 'star-indeterminate-rtl');
      await openPage(page, '/controls/skeleton', 'Skeleton');
      const wave = page.locator('.star-skeleton:not(.star-skeleton--static)').first();
      expect(
        await wave.evaluate((element) => getComputedStyle(element, '::after').animationName),
      ).toBe('star-wave-rtl');
    });

    test('the page stays inside the viewport and the docs layout mirrors', async ({ page }) => {
      await openPage(page, '/controls/button', 'Button');
      const nav = await box(page.locator('.docs-nav'));
      const main = await box(page.locator('.docs-main'));
      expect(nav.x).toBeGreaterThan(main.x);
      const wider = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(wider).toBe(false);
    });
  });

  test.describe('a change at run time', () => {
    test('tooltips, menus and the tree follow a switch from ltr to rtl without a reload', async ({
      page,
    }) => {
      await page.addInitScript(() => localStorage.setItem('star-direction', 'ltr'));
      await openPage(page, '/controls/tooltip', 'Tooltip');
      const live = example(page, 'Positions');
      const tooltip = page.getByRole('tooltip');
      // In left-to-right "start" is the left side.
      const startButton = live.getByRole('button', { name: 'Start', exact: true });
      await startButton.hover();
      await expect(tooltip).toBeVisible();
      let tip = await box(tooltip);
      let at = await box(startButton);
      expect(tip.x + tip.width).toBeLessThanOrEqual(at.x + 1);
      await page.mouse.move(0, 0);
      await expect(tooltip).toHaveCount(0);

      // Switch the direction with the docs button. The tooltip directive keeps its overlay.
      await page.locator('.docs-header__dir').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await startButton.hover();
      await expect(tooltip).toBeVisible();
      tip = await box(tooltip);
      at = await box(startButton);
      expect(tip.x).toBeGreaterThanOrEqual(at.x + at.width - 1);
      await page.mouse.move(0, 0);

      // A menu opened after the switch uses the new direction for its arrow keys. The page changes
      // with the router, not with a reload.
      await page
        .getByRole('navigation', { name: 'Pages' })
        .getByRole('link', { name: 'Menu', exact: true })
        .click();
      await expect(page.getByRole('heading', { level: 1, name: 'Menu' })).toBeVisible();
      const trigger = example(page, 'Nested submenu').getByRole('button', { name: 'View' });
      await trigger.focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowLeft');
      await expect(popup(page).getByRole('menuitem', { name: 'Single column' })).toBeFocused();
    });

    test('the theme switch dial opens inside the window in both directions', async ({ page }) => {
      await openPage(page, '/', 'StarNG');
      const viewport = page.viewportSize()!;
      for (const dir of ['rtl', 'ltr', 'rtl']) {
        await expect(page.locator('html')).toHaveAttribute('dir', dir);
        const header = page.locator('.docs-header');
        await header.getByRole('button', { name: /^Theme: / }).click();
        const items = header.locator('.star-speed-dial__action');
        await expect(items).toHaveCount(3);
        for (const item of await items.all()) {
          const b = await box(item);
          expect(b.x).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
        }
        await page.keyboard.press('Escape');
        await page.locator('.docs-header__dir').click();
      }
    });
  });

  test('the Right-to-left guide describes the controls and the helpers', async ({ page }) => {
    await openPage(page, '/guides/right-to-left', 'Right-to-left');
    await expect(page.getByRole('heading', { level: 2, name: 'Switch it on' })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'What the library does' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'What the application must do' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Known limits' })).toBeVisible();
    // The island has its own direction while the page is right to left too.
    const island = example(page, 'A right-to-left island').locator('[dir="rtl"]');
    await expect(island).toBeVisible();
    // The navigation lists the guide.
    await expect(
      page.getByRole('navigation', { name: 'Pages' }).getByRole('link', { name: 'Right-to-left' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('a right-to-left island on a left-to-right page', () => {
  test('layout, keys and mirrored icons follow the island only', async ({ page }) => {
    await openPage(page, '/guides/right-to-left', 'Right-to-left');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    const island = example(page, 'A right-to-left island').locator('[dir="rtl"]');
    const tabs = island.getByRole('tab');
    const one = tabs.nth(0);
    const two = tabs.nth(1);
    const oneBox = (await one.boundingBox())!;
    const twoBox = (await two.boundingBox())!;
    expect(oneBox.x).toBeGreaterThan(twoBox.x);
    await one.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(two).toBeFocused();
    // The paginator arrows of the island are turned around.
    const next = island.locator('[aria-label="Next page"] i');
    expect(await next.evaluate((element) => getComputedStyle(element).scale)).toBe('-1 1');
  });
});
