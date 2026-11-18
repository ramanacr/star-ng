import AxeBuilder from '@axe-core/playwright';
import { expect, Locator, Page, test } from '@playwright/test';
import { appendFileSync } from 'node:fs';
import { DOCS_PAGES, example } from './support';

/**
 * Automated accessibility scan (axe-core) of the docs application.
 *
 * Part 1 scans every page of the docs navigation at rest, in the light and the dark theme.
 * Part 2 opens a state that is hidden at rest (a panel, a popup, a dialog, an error, a scrolled
 * list ...) and scans again. A test fails on any violation that is not in `ALLOWED`.
 *
 * Set `A11Y_REPORT=<file>` to append every violation (before the allow-list is applied) to a file
 * as one JSON object per line. Use it to triage a new rule set.
 */

/** Rule sets of the scan: WCAG 2.0 / 2.1 / 2.2 level A and AA, and the axe best practices. */
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

const THEMES = ['light', 'dark'] as const;
type Theme = (typeof THEMES)[number];

/**
 * The allow-list: the only violations the scan accepts. No rule is switched off for the whole
 * scan. An entry names one rule and the smallest selector that covers the element; the element
 * must match `selector` itself (not an ancestor). Every entry needs a reason. The Accessibility
 * guide of the docs application lists the entries: change both together.
 */
interface Allowed {
  readonly rule: string;
  readonly selector: string;
  readonly reason: string;
}
const ALLOWED: readonly Allowed[] = [
  {
    rule: 'region',
    selector:
      '.cdk-overlay-container, .cdk-overlay-container *, .cdk-overlay-popover, .cdk-overlay-popover *',
    reason:
      'A menu, a tooltip or another popup is moved by the Angular CDK to .cdk-overlay-container at ' +
      'the end of <body>, outside <main>. It is a transient widget: it takes the focus (menu) or is ' +
      'tied to its trigger with aria-describedby (tooltip), so a landmark user does not need to find ' +
      'it. "region" is a best-practice rule and reports every portaled popup. Only popups are ' +
      'excluded: the page itself is still checked for this rule.',
  },
  {
    rule: 'scrollable-region-focusable',
    selector: '.star-listbox[aria-disabled="true"]',
    reason:
      'A disabled listbox leaves the tab order on purpose, like a disabled button or select (see ' +
      'the test "a disabled listbox is out of the tab order"). axe wants every scrollable area to ' +
      'take the focus, so it reports a disabled list that is taller than its max-height. The ' +
      'options of a disabled list cannot be used, so a keyboard user loses nothing but the ' +
      'reading of the hidden options. An enabled list is checked.',
  },
];

interface Finding {
  readonly rule: string;
  readonly impact: string;
  readonly target: string;
  readonly help: string;
  readonly url: string;
}

/** Runs axe on the open page and returns the violations that are not in the allow-list. */
async function scan(page: Page, where: string): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const findings: Finding[] = [];
  for (const violation of results.violations) {
    for (const node of violation.nodes) {
      findings.push({
        rule: violation.id,
        impact: node.impact ?? violation.impact ?? 'unknown',
        target: node.target.join(' >> '),
        help: violation.help,
        url: violation.helpUrl,
      });
    }
  }
  if (process.env['A11Y_REPORT']) {
    for (const finding of findings) {
      appendFileSync(
        process.env['A11Y_REPORT'],
        JSON.stringify({ where, ...finding, html: undefined }) + '\n',
      );
    }
  }
  const remaining: Finding[] = [];
  for (const finding of findings) {
    const entries = ALLOWED.filter((entry) => entry.rule === finding.rule);
    let allowed = false;
    for (const entry of entries) {
      allowed ||= await page
        .locator(finding.target)
        .first()
        .evaluate((element, selector) => element.matches(selector), entry.selector)
        .catch(() => false);
    }
    if (!allowed) remaining.push(finding);
  }
  return remaining.map(
    (item) => `${item.rule} [${item.impact}] ${item.target} - ${item.url} (${item.help})`,
  );
}

/** Opens a docs page in the given theme, without motion, and waits until it has settled. */
async function openForScan(page: Page, path: string, theme: Theme): Promise<void> {
  await page.addInitScript((name) => localStorage.setItem('star-theme', name), theme);
  await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await settle(page);
}

/** Waits for lazy examples and for every finite animation and transition to end. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(250);
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
}

for (const theme of THEMES) {
  test.describe(`axe, pages at rest, ${theme} theme`, { tag: '@a11y' }, () => {
    test('the scan covers the whole navigation', () => {
      expect(DOCS_PAGES.length).toBeGreaterThan(90);
    });

    for (const path of DOCS_PAGES) {
      test(`${path}`, async ({ page }) => {
        await openForScan(page, `/${path}`, theme);
        expect(await scan(page, `${path} ${theme}`)).toEqual([]);
      });
    }
  });
}

/**
 * Part 2: states that are hidden at rest. Each entry opens one state on a docs page. The entry
 * checks that the state is really open (so a renamed button cannot make the scan pass without
 * looking at anything). The test then scans the whole page again.
 */
interface State {
  readonly name: string;
  readonly path: string;
  readonly open: (page: Page) => Promise<void>;
}

/** A file that a test gives to a file input. */
const file = (name: string, mimeType: string) => ({ name, mimeType, buffer: Buffer.from('data') });

/** The container of popups. A page can also have an inline menu or listbox. */
const popup = (page: Page) => page.locator('.cdk-overlay-container');

/** Scrolls an element to the middle of its content. */
const scrollToMiddle = (target: Locator) =>
  target.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
  });

const STATES: readonly State[] = [
  // Panels of select-like controls.
  {
    name: 'select panel',
    path: 'controls/select',
    open: async (page) => {
      await example(page, 'Objects as options').getByRole('combobox', { name: 'Country' }).click();
      await expect(page.getByRole('listbox', { name: 'Country', exact: true })).toBeVisible();
    },
  },
  {
    name: 'select panel with groups',
    path: 'controls/select',
    open: async (page) => {
      await example(page, 'Groups').getByRole('combobox', { name: 'Country by region' }).click();
      await expect(page.getByRole('listbox', { name: 'Country by region' })).toBeVisible();
    },
  },
  {
    name: 'select panel with virtual scroll',
    path: 'controls/select',
    open: async (page) => {
      await example(page, 'Virtual scroll').getByRole('combobox', { name: 'Order' }).click();
      await expect(page.getByRole('listbox', { name: 'Order' })).toBeVisible();
    },
  },
  {
    name: 'multi-select panel',
    path: 'controls/multi-select',
    open: async (page) => {
      await example(page, 'Basic').getByRole('combobox', { name: 'Departments' }).click();
      const list = page.getByRole('listbox', { name: 'Departments' });
      await expect(list).toBeVisible();
      await list.getByRole('option').first().click();
    },
  },
  {
    name: 'multi-select panel with chips and filter',
    path: 'controls/multi-select',
    open: async (page) => {
      await example(page, 'Chips, filter and clear button')
        .getByRole('combobox', { name: 'Departments as chips' })
        // The corner, not the center: a chip remove button has a 24 px target, and the center of
        // the field can lie on it.
        .click({ position: { x: 4, y: 4 } });
      await expect(page.getByRole('listbox', { name: 'Departments as chips' })).toBeVisible();
    },
  },
  {
    name: 'cascade select with a submenu',
    path: 'controls/cascade-select',
    open: async (page) => {
      await example(page, 'Country, state and city').getByRole('button', { name: 'City' }).click();
      await expect(page.getByRole('menuitem', { name: 'Germany' })).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('menuitem', { name: 'Bavaria' })).toBeFocused();
    },
  },
  {
    name: 'tree select panel',
    path: 'controls/tree-select',
    open: async (page) => {
      await example(page, 'Single node').getByRole('button', { name: 'Department' }).click();
      await expect(page.getByRole('tree')).toBeVisible();
    },
  },
  {
    name: 'autocomplete suggestions',
    path: 'controls/autocomplete',
    open: async (page) => {
      const input = example(page, 'Local options').getByRole('combobox', { name: 'City' });
      await input.click();
      await input.pressSequentially('a');
      await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    },
  },
  {
    name: 'autocomplete with objects and groups',
    path: 'controls/autocomplete',
    open: async (page) => {
      const input = example(page, 'Objects, groups and template').getByRole('combobox', {
        name: 'Person',
      });
      await input.click();
      await input.pressSequentially('a');
      await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible();
    },
  },
  {
    name: 'listbox with a filter and a selection',
    path: 'controls/listbox',
    open: async (page) => {
      const live = example(page, 'Multiple with filter');
      await live.getByRole('searchbox', { name: 'Search' }).fill('a');
      await live.getByRole('option').first().click();
      await expect(live.getByRole('listbox', { name: 'Queues' })).toBeVisible();
    },
  },
  {
    name: 'select panel with lazy loading rows',
    path: 'controls/select',
    open: async (page) => {
      await example(page, 'Lazy loading')
        .getByRole('combobox', { name: 'Order, loaded on demand' })
        .click();
      const list = page.getByRole('listbox', { name: 'Order, loaded on demand' });
      await expect(list.getByRole('option').first()).toBeVisible();
    },
  },
  {
    name: 'editable select panel',
    path: 'controls/select',
    open: async (page) => {
      await example(page, 'Editable').getByRole('combobox', { name: 'City, editable' }).fill('r');
      await expect(page.getByRole('listbox', { name: 'City, editable' })).toBeVisible();
    },
  },
  {
    name: 'multi-select panel with an Add row',
    path: 'controls/multi-select',
    open: async (page) => {
      await example(page, 'Custom values').getByRole('combobox', { name: 'Order labels' }).click();
      await page.locator('.star-panel__filter').getByRole('searchbox').fill('Archive');
      await expect(page.getByRole('option', { name: 'Add “Archive”' })).toBeVisible();
    },
  },
  {
    name: 'autocomplete with an Add row',
    path: 'controls/autocomplete',
    open: async (page) => {
      const input = example(page, 'Custom values').getByRole('combobox', {
        name: 'Keywords with new ones',
      });
      await input.click();
      await input.pressSequentially('ui');
      await expect(page.getByRole('option', { name: 'Add “ui”' })).toBeVisible();
    },
  },
  {
    name: 'date picker popup',
    path: 'controls/date-picker',
    open: async (page) => {
      await example(page, 'Single date').getByRole('button', { name: 'Choose date' }).click();
      await expect(page.locator('.star-date__panel')).toBeVisible();
    },
  },
  {
    name: 'date range popup',
    path: 'controls/date-picker',
    open: async (page) => {
      await example(page, 'Date range').getByRole('button', { name: 'Choose date' }).click();
      await expect(page.locator('.star-date__panel')).toBeVisible();
    },
  },
  {
    name: 'date and time popup',
    path: 'controls/date-picker',
    open: async (page) => {
      await example(page, 'Date and time').getByRole('button', { name: 'Choose date' }).click();
      await expect(page.locator('.star-date__panel')).toBeVisible();
    },
  },
  {
    name: 'date and time popup with a chosen time',
    path: 'controls/date-picker',
    open: async (page) => {
      await example(page, 'Date and time').getByRole('button', { name: 'Choose date' }).click();
      await expect(page.getByRole('group', { name: 'Time' })).toBeVisible();
      await page.getByRole('listbox', { name: 'Hour' }).getByRole('option').first().focus();
    },
  },
  {
    name: 'color picker panel',
    path: 'controls/color-picker',
    open: async (page) => {
      await example(page, 'Basic').getByRole('button', { name: 'Custom color' }).click();
      await expect(page.getByRole('dialog', { name: 'Custom color' })).toBeVisible();
    },
  },
  {
    name: 'paginator rows per page open',
    path: 'controls/paginator',
    open: async (page) => {
      await example(page, 'Pages of a list')
        .getByRole('combobox', { name: 'Rows per page' })
        .click();
      await expect(page.getByRole('listbox')).toBeVisible();
    },
  },
  {
    name: 'date picker popup with special dates',
    path: 'controls/date-picker',
    open: async (page) => {
      await example(page, 'Special dates').getByRole('button', { name: 'Choose date' }).click();
      await expect(page.locator('.star-calendar__day--special').first()).toBeVisible();
    },
  },
  {
    name: 'date picker touch sheet',
    path: 'controls/date-picker',
    open: async (page) => {
      await example(page, 'Touch mode')
        .getByRole('button', { name: 'Choose date' })
        .first()
        .click();
      await expect(page.locator('dialog.star-date__sheet')).toBeVisible();
    },
  },
  {
    name: 'date picker with kept invalid text',
    path: 'controls/date-picker',
    open: async (page) => {
      const input = example(page, 'Display and input formats').getByRole('textbox', {
        name: 'Invoice due date',
      });
      await input.fill('31/02/2026');
      await input.press('Tab');
      await expect(input).toHaveAttribute('aria-invalid', 'true');
    },
  },
  {
    name: 'time picker panel with seconds',
    path: 'controls/time-picker',
    open: async (page) => {
      await example(page, 'Seconds and steps').getByRole('button', { name: 'Choose time' }).click();
      await expect(page.getByRole('listbox', { name: 'Second' })).toBeVisible();
    },
  },
  {
    name: 'month view of the date picker',
    path: 'controls/date-picker',
    open: async (page) => {
      await example(page, 'Month and year views')
        .getByRole('button', { name: 'Choose date' })
        .first()
        .click();
      await expect(page.locator('.star-date__panel')).toBeVisible();
    },
  },
  {
    name: 'time picker panel',
    path: 'controls/time-picker',
    open: async (page) => {
      await example(page, 'Limits and step').getByRole('button', { name: 'Choose time' }).click();
      await expect(page.getByRole('dialog', { name: 'Choose time' })).toBeVisible();
    },
  },
  {
    name: 'time picker panel, 12-hour clock',
    path: 'controls/time-picker',
    open: async (page) => {
      await example(page, '12-hour clock').getByRole('button', { name: 'Choose time' }).click();
      await expect(page.getByRole('listbox', { name: 'AM or PM' })).toBeVisible();
    },
  },

  // Menus.
  {
    name: 'popup menu',
    path: 'controls/menu',
    open: async (page) => {
      await example(page, 'Popup menu').getByRole('button', { name: 'File' }).click();
      await expect(popup(page).getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'menu with icons, shortcuts and a danger item',
    path: 'controls/menu',
    open: async (page) => {
      await example(page, 'Separators, disabled and danger items')
        .getByRole('button', { name: 'Order actions' })
        .click();
      await expect(popup(page).getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'menu with a submenu',
    path: 'controls/menu',
    open: async (page) => {
      await example(page, 'Nested submenu').getByRole('button', { name: 'View' }).click();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowRight');
      await expect(page.getByRole('menuitem', { name: 'Single column' })).toBeFocused();
    },
  },
  {
    name: 'menubar with an open menu',
    path: 'controls/menubar',
    open: async (page) => {
      await example(page, 'File, edit and view')
        .getByRole('menuitem', { name: 'File', exact: true })
        .click();
      await expect(popup(page).getByRole('menu').first()).toBeVisible();
    },
  },
  {
    name: 'context menu',
    path: 'controls/context-menu',
    open: async (page) => {
      await example(page, 'Right-click area').getByLabel('Order row').click({ button: 'right' });
      await expect(popup(page).getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'mega menu panel',
    path: 'controls/mega-menu',
    open: async (page) => {
      await example(page, 'Panel with columns').getByRole('menuitem', { name: 'Products' }).click();
      await expect(page.locator('.star-mega-menu__panel')).toBeVisible();
    },
  },
  {
    name: 'split button menu',
    path: 'controls/split-button',
    open: async (page) => {
      await example(page, 'Main action and menu')
        .getByRole('button', { name: 'More actions' })
        .click();
      await expect(popup(page).getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'drop-down list',
    path: 'controls/dropdown',
    open: async (page) => {
      await example(page, 'Choose from a list').getByRole('button', { name: 'Export as' }).click();
      await expect(page.getByRole('listbox', { name: 'Export format' })).toBeFocused();
    },
  },
  {
    name: 'action strip shown by the focus',
    path: 'controls/action-strip',
    open: async (page) => {
      const edit = example(page, 'Row actions')
        .getByRole('toolbar', { name: 'Order 1001 actions' })
        .getByRole('button', { name: 'Edit' });
      await edit.focus();
      await expect(edit).toBeVisible();
    },
  },
  {
    name: 'action strip in a table row',
    path: 'controls/action-strip',
    open: async (page) => {
      const row = example(page, 'In a table row').getByRole('row').nth(1);
      await row.getByRole('cell').first().hover();
      await expect(row.getByRole('toolbar')).toHaveCSS('opacity', '1');
    },
  },
  {
    name: 'action strip with its menu',
    path: 'controls/action-strip',
    open: async (page) => {
      await example(page, 'More actions in a menu')
        .getByRole('button', { name: 'More actions' })
        .click();
      await expect(popup(page).getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'theme switch of the docs header',
    path: 'controls/theme-switch',
    open: async (page) => {
      await page
        .locator('.docs-header')
        .getByRole('button', { name: /^Theme: / })
        .click();
      await expect(page.locator('.docs-header .star-speed-dial__action')).toHaveCount(3);
    },
  },

  // Overlays.
  {
    name: 'dialog',
    path: 'controls/dialog',
    open: async (page) => {
      await example(page, 'Header and footer').getByRole('button', { name: 'Edit order' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'dialog with a select and a menu inside',
    path: 'controls/dialog',
    open: async (page) => {
      await example(page, 'Menus and selects inside a modal')
        .getByRole('button', { name: 'Open order dialog' })
        .click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'More actions' }).click();
      // A menu opened inside a modal dialog stays in the dialog.
      await expect(dialog.getByRole('menu')).toBeVisible();
    },
  },
  {
    name: 'non-modal dialog',
    path: 'controls/dialog',
    open: async (page) => {
      await example(page, 'Close rules').getByRole('button', { name: 'Non-modal' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'dialog opened from code',
    path: 'controls/dialog',
    open: async (page) => {
      await example(page, 'Dialog from code').getByRole('button', { name: 'Edit note' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'command palette open with a filter',
    path: 'controls/command-palette',
    open: async (page) => {
      await example(page, 'Commands in groups')
        .getByRole('button', { name: 'Open command palette' })
        .click();
      const field = page.getByRole('combobox', { name: 'Command palette' });
      await expect(field).toBeFocused();
      await field.fill('go');
      await expect(page.getByRole('option', { name: 'Go to dashboard' })).toBeVisible();
    },
  },
  {
    name: 'command palette with no match',
    path: 'controls/command-palette',
    open: async (page) => {
      await example(page, 'Option and empty templates')
        .getByRole('button', { name: 'Find a person' })
        .click();
      await page.getByRole('combobox', { name: 'Find a person' }).fill('zzz');
      await expect(
        page.locator('.star-command-palette__message').filter({ visible: true }),
      ).toHaveText('No person matches “zzz”.');
    },
  },
  {
    name: 'app sidebar collapsed with a group open',
    path: 'controls/app-sidebar',
    open: async (page) => {
      const nav = page.getByRole('navigation', { name: 'Workspace' });
      await nav.getByRole('button', { name: 'Reports' }).click();
      await page.getByRole('button', { name: 'Collapse sidebar' }).click();
      await expect(nav.getByRole('button', { name: 'Monthly' })).toBeVisible();
    },
  },
  {
    name: 'app sidebar in its drawer',
    path: 'controls/app-sidebar',
    open: async (page) => {
      await example(page, 'Overlay mode').getByRole('button', { name: 'Menu' }).click();
      await expect(page.getByRole('dialog', { name: 'Shop' })).toBeVisible();
    },
  },
  {
    name: 'two windows, one minimized',
    path: 'controls/window',
    open: async (page) => {
      const area = example(page, 'Windows in the page');
      await area.getByRole('button', { name: 'Open notes' }).click();
      const notes = page.getByRole('dialog', { name: 'Notes' });
      await expect(notes).toBeVisible();
      await notes.getByRole('button', { name: 'Minimize' }).click();
      await area.getByRole('button', { name: 'Open order summary' }).click();
      await expect(page.getByRole('dialog', { name: 'Order summary' })).toBeVisible();
    },
  },
  {
    name: 'window opened from code',
    path: 'controls/window',
    open: async (page) => {
      await example(page, 'Open from code')
        .getByRole('button', { name: 'Open order window' })
        .click();
      await expect(page.getByRole('dialog', { name: 'Order 1001' })).toBeVisible();
    },
  },
  {
    name: 'maximized dialog with move and resize controls',
    path: 'controls/dialog',
    open: async (page) => {
      await example(page, 'Maximize').getByRole('button', { name: 'Open order lines' }).click();
      const dialog = page.getByRole('dialog', { name: 'Order lines' });
      await dialog.getByRole('button', { name: 'Maximize' }).click();
      await expect(dialog.getByRole('button', { name: 'Restore' })).toBeVisible();
    },
  },
  {
    name: 'resizable dialog',
    path: 'controls/dialog',
    open: async (page) => {
      await example(page, 'Resize').getByRole('button', { name: 'Open resizable dialog' }).click();
      await expect(page.getByRole('button', { name: 'Resize dialog' })).toBeVisible();
    },
  },
  {
    name: 'headless dialog',
    path: 'controls/dialog',
    open: async (page) => {
      await example(page, 'Headless').getByRole('button', { name: 'Open headless dialog' }).click();
      await expect(page.getByRole('dialog', { name: 'Shipping label for ORD-1042' })).toBeVisible();
    },
  },
  {
    name: 'confirm dialog',
    path: 'controls/confirm',
    open: async (page) => {
      await example(page, 'Confirm dialog').getByRole('button', { name: 'Delete order' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
    },
  },
  {
    name: 'notice with one button',
    path: 'controls/confirm',
    open: async (page) => {
      await example(page, 'Focus, labels and acknowledge-only')
        .getByRole('button', { name: 'Show notice' })
        .click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
    },
  },
  {
    name: 'confirm popup',
    path: 'controls/confirm',
    open: async (page) => {
      await example(page, 'Confirm popup').getByRole('button', { name: 'Archive' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
    },
  },
  {
    name: 'confirm popup with danger severity',
    path: 'controls/confirm',
    open: async (page) => {
      await example(page, 'Delete from a row')
        .getByRole('button', { name: 'Delete INV-2041' })
        .click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
    },
  },
  {
    name: 'drawer',
    path: 'controls/drawer',
    open: async (page) => {
      await example(page, 'Details drawer').getByRole('button', { name: 'Open details' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'non-modal drawer',
    path: 'controls/drawer',
    open: async (page) => {
      await example(page, 'Modes').getByRole('button', { name: 'Non-modal' }).click();
      await expect(page.getByRole('dialog', { name: 'Filters' })).toBeVisible();
    },
  },
  {
    name: 'full screen drawer',
    path: 'controls/drawer',
    open: async (page) => {
      await example(page, 'Modes').getByRole('button', { name: 'Full screen' }).click();
      await expect(page.getByRole('dialog', { name: 'Invoice INV-2041' })).toBeVisible();
    },
  },
  {
    name: 'bottom sheet with a component',
    path: 'controls/bottom-sheet',
    open: async (page) => {
      await example(page, 'Sheet from a component')
        .getByRole('button', { name: 'Export invoice' })
        .click();
      await expect(page.getByRole('dialog', { name: 'Export invoice INV-2041' })).toBeVisible();
    },
  },
  {
    name: 'action sheet',
    path: 'controls/bottom-sheet',
    open: async (page) => {
      await example(page, 'Action sheet').getByRole('button', { name: 'Order actions' }).click();
      await expect(page.getByRole('dialog', { name: 'Order ORD-1042 actions' })).toBeVisible();
    },
  },
  {
    name: 'popover',
    path: 'controls/popover',
    open: async (page) => {
      await example(page, 'Details popover').getByRole('button', { name: 'Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Order details' })).toBeVisible();
    },
  },
  {
    name: 'popover with a field',
    path: 'controls/popover',
    open: async (page) => {
      await example(page, 'Field in a popover')
        .getByRole('button', { name: 'Rename order' })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'tooltip shown',
    path: 'controls/tooltip',
    open: async (page) => {
      await example(page, 'Positions').getByRole('button', { name: 'Top', exact: true }).hover();
      await expect(page.getByRole('tooltip')).toBeVisible();
    },
  },
  {
    name: 'tooltip of an icon button shown by focus',
    path: 'controls/tooltip',
    open: async (page) => {
      await example(page, 'Icon button').getByRole('button', { name: 'Export orders' }).focus();
      await expect(page.getByRole('tooltip')).toBeVisible();
    },
  },
  {
    name: 'toasts of every severity',
    path: 'controls/toast',
    open: async (page) => {
      const live = example(page, 'Severities');
      for (const name of ['Success', 'Info', 'Warn', 'Error']) {
        await live.getByRole('button', { name, exact: true }).click();
      }
      await expect(page.locator('.star-toast')).toHaveCount(4);
    },
  },
  {
    name: 'sticky toast',
    path: 'controls/toast',
    open: async (page) => {
      await example(page, 'Sticky and timed messages')
        .getByRole('button', { name: 'Sticky message' })
        .click();
      await expect(page.locator('.star-toast')).toHaveCount(1);
    },
  },

  // Disclosure panels.
  {
    name: 'accordion section open',
    path: 'controls/accordion',
    open: async (page) => {
      const button = example(page, 'One section at a time').getByRole('button', {
        name: 'Returns',
      });
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
    },
  },
  {
    name: 'accordion with several sections open',
    path: 'controls/accordion',
    open: async (page) => {
      const live = example(page, 'Several sections and lazy content');
      for (const name of ['Summary', 'History']) {
        const button = live.getByRole('button', { name });
        if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
        await expect(button).toHaveAttribute('aria-expanded', 'true');
      }
    },
  },
  {
    name: 'panel collapsed',
    path: 'controls/panel',
    open: async (page) => {
      const button = example(page, 'Panel with actions').getByRole('button', {
        name: 'Collapse Order notes',
      });
      await button.click();
      await expect(
        example(page, 'Panel with actions').getByRole('button', { name: 'Expand Order notes' }),
      ).toHaveAttribute('aria-expanded', 'false');
    },
  },
  {
    name: 'panel menu with a section open',
    path: 'controls/panel-menu',
    open: async (page) => {
      const button = example(page, 'Sections that open in place').getByRole('button', {
        name: 'Account',
      });
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true');
    },
  },

  // Forms.
  {
    name: 'invalid field with its error',
    path: 'controls/field',
    open: async (page) => {
      const live = example(page, 'Validation with Signal Forms');
      const input = live.getByRole('textbox');
      await input.fill('not an address');
      await input.blur();
      await expect(live.getByRole('alert')).toBeVisible();
    },
  },
  {
    name: 'invalid date picker with its error',
    path: 'controls/date-picker',
    open: async (page) => {
      const live = example(page, 'Signal Forms');
      const input = live.getByRole('textbox', { name: 'Required delivery date' });
      await input.fill('31/02/2026');
      await input.blur();
      await expect(live.getByRole('alert')).toBeVisible();
    },
  },
  {
    name: 'file upload with a file',
    path: 'controls/file-upload',
    open: async (page) => {
      const live = example(page, 'Accepted types, size and count');
      await live
        .locator('input[type="file"]')
        .setInputFiles([file('invoice.pdf', 'application/pdf')]);
      await expect(live.getByText('invoice.pdf')).toBeVisible();
    },
  },
  {
    name: 'file upload with a rejected file',
    path: 'controls/file-upload',
    open: async (page) => {
      const live = example(page, 'Accepted types, size and count');
      await live
        .locator('input[type="file"]')
        .setInputFiles([
          file('invoice.pdf', 'application/pdf'),
          file('setup.exe', 'application/octet-stream'),
        ]);
      await expect(live.getByText('setup.exe')).toBeVisible();
    },
  },

  // Data.
  {
    name: 'table with the column panel open',
    path: 'controls/table-columns',
    open: async (page) => {
      await example(page, 'Hide and move columns').getByRole('button', { name: 'Columns' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'table with a filter select open',
    path: 'controls/table-sort-filter',
    open: async (page) => {
      await example(page, 'Column filters')
        .getByRole('combobox', { name: 'Filter by Status' })
        .click();
      await expect(page.getByRole('listbox')).toBeVisible();
    },
  },
  {
    name: 'table with a filter text',
    path: 'controls/table-sort-filter',
    open: async (page) => {
      const live = example(page, 'Column filters');
      await live.getByRole('searchbox', { name: 'Filter by Customer' }).fill('a');
      await expect(live.getByRole('table')).toBeVisible();
    },
  },
  {
    name: 'table with an expanded row',
    path: 'controls/table',
    open: async (page) => {
      const live = example(page, 'Row detail');
      await live.getByRole('button', { name: 'Expand row' }).first().click();
      await expect(live.getByRole('button', { name: 'Collapse row' })).toHaveCount(1);
    },
  },
  {
    name: 'table with a cell in edit mode',
    path: 'controls/table-edit',
    open: async (page) => {
      const live = example(page, 'Inline cell edit');
      await live.locator('button[data-edit="ORD-1001|product"]').click();
      await expect(live.locator('.star-table__editor').first()).toBeVisible();
    },
  },
  {
    name: 'table with a choice editor open',
    path: 'controls/table-edit',
    open: async (page) => {
      const live = example(page, 'Inline cell edit');
      await live.getByRole('button', { name: 'Edit Product' }).first().click();
      await expect(live.getByRole('combobox', { name: 'Edit Product' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await expect(page.getByRole('listbox')).toBeVisible();
    },
  },
  {
    name: 'table with a row in edit and a validation message',
    path: 'controls/table-edit',
    open: async (page) => {
      const live = example(page, 'Row edit with validation');
      await live.getByRole('button', { name: 'Edit row' }).first().click();
      const customer = live.getByRole('textbox', { name: 'Edit Customer' });
      await customer.fill('');
      await expect(customer).toHaveAttribute('aria-invalid', 'true');
      await expect(live.locator('.star-table__error')).toBeVisible();
    },
  },
  {
    name: 'table with a new row in edit and a changed batch cell',
    path: 'controls/table-edit',
    open: async (page) => {
      const live = example(page, 'Add and delete rows');
      await live.getByRole('button', { name: 'Add order' }).click();
      await expect(live.locator('.star-table__row--editing')).toHaveCount(1);
      const batch = example(page, 'Batch edit with undo');
      await batch
        .getByRole('button', { name: /^Edit Customer/ })
        .first()
        .click();
      const editor = batch.getByRole('textbox', { name: 'Edit Customer' });
      await editor.fill('Changed customer');
      await editor.press('Enter');
      await expect(batch.locator('.star-table__cell--changed')).toHaveCount(1);
    },
  },
  {
    name: 'table with a filter select open (Region)',
    path: 'controls/table-sort-filter',
    open: async (page) => {
      await example(page, 'Column filters')
        .getByRole('combobox', { name: 'Filter by Region' })
        .click();
      await expect(page.getByRole('listbox')).toBeVisible();
    },
  },
  {
    name: 'tree with every branch expanded',
    path: 'controls/tree',
    open: async (page) => {
      const tree = example(page, 'Expand and collapse').getByRole('tree');
      // Opening a branch adds items below it, and a locator of "the closed items" points at other
      // items after each change. So open the first closed branch with its key, wait until the
      // number of open branches grows, and look again.
      const open = tree.getByRole('treeitem', { expanded: true });
      const closed = tree.getByRole('treeitem', { expanded: false });
      for (let step = 0; step < 10 && (await closed.count()) > 0; step++) {
        const opened = await open.count();
        await closed.first().focus();
        await page.keyboard.press('ArrowRight');
        await expect(open).toHaveCount(opened + 1);
      }
      await expect(closed).toHaveCount(0);
    },
  },
  {
    name: 'tree with a loading row',
    path: 'controls/tree',
    open: async (page) => {
      const live = example(page, 'Lazy children');
      await live.locator('[data-key="atlas"]').click();
      await expect(live.locator('.star-tree__loading')).toBeVisible();
    },
  },
  {
    name: 'tree with the node context menu open',
    path: 'controls/tree',
    open: async (page) => {
      const live = example(page, 'Context menu and events');
      await live.locator('[data-key="web"]').click({ button: 'right' });
      await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeVisible();
    },
  },
  {
    name: 'tree after a keyboard move',
    path: 'controls/tree',
    open: async (page) => {
      // The keyboard move and its live announcement (a pointer drag cannot stay in progress).
      const live = example(page, 'Drag and drop');
      await live.locator('[data-key="mobile"]').focus();
      await page.keyboard.press('Control+Shift+ArrowUp');
      await expect(live.locator('[aria-live]')).toHaveText('Mobile moved before Web platform');
    },
  },
  {
    name: 'tree table with a row expanded',
    path: 'controls/tree-table',
    open: async (page) => {
      const live = example(page, 'Expand and collapse');
      await live.getByRole('button', { name: 'Expand Operations' }).click();
      await expect(live.getByRole('button', { name: 'Collapse Operations' })).toBeVisible();
    },
  },
  {
    name: 'tree table with checked rows and a mixed parent',
    path: 'controls/tree-table',
    open: async (page) => {
      const live = example(page, 'Checkbox selection');
      await live.getByRole('checkbox', { name: 'Texts' }).click();
      await expect(live.getByRole('checkbox', { name: 'Content' })).toHaveAttribute(
        'aria-checked',
        'mixed',
      );
    },
  },
  {
    name: 'tree table with a loading row',
    path: 'controls/tree-table',
    open: async (page) => {
      const live = example(page, 'Lazy children');
      await live.getByRole('button', { name: 'Expand Invoices' }).click();
      await expect(live.locator('.star-tree-table__loading')).toBeVisible();
    },
  },
  {
    name: 'tree table with a cell in edit',
    path: 'controls/tree-table',
    open: async (page) => {
      const live = example(page, 'Cell edit');
      await live.locator('tbody tr[data-key="website"]').focus();
      await page.keyboard.press('Enter');
      await expect(live.getByRole('textbox', { name: 'Edit Owner' })).toBeFocused();
    },
  },
  {
    name: 'tree table with the row context menu open',
    path: 'controls/tree-table',
    open: async (page) => {
      const live = example(page, 'Context menu');
      await live.locator('tbody tr[data-key="shop"]').click({ button: 'right' });
      await expect(page.getByRole('menuitem', { name: 'Archive' })).toBeVisible();
    },
  },
  {
    name: 'tree table filtered with no result',
    path: 'controls/tree-table',
    open: async (page) => {
      const live = example(page, 'Sort, filter and page');
      await live.getByRole('searchbox', { name: 'Search' }).fill('zzz');
      await expect(live.locator('.star-table__empty')).toBeVisible();
    },
  },
  {
    name: 'org chart with a collapsed branch',
    path: 'controls/org-chart',
    open: async (page) => {
      await page
        .getByRole('button', { name: /^Collapse row: / })
        .first()
        .click();
      await expect(page.getByRole('button', { name: /^Expand row: / }).first()).toBeVisible();
    },
  },

  // Charts, gauges and codes.
  {
    name: 'sparklines in right-to-left',
    path: 'controls/sparkline',
    open: async (page) => {
      await page.evaluate(() => (document.documentElement.dir = 'rtl'));
      const line = example(page, 'In a table').locator('star-sparkline').first();
      await expect(line).toHaveAttribute('aria-label', /^Trend up/);
    },
  },

  {
    name: 'interactive gauge after keyboard input',
    path: 'controls/gauge',
    open: async (page) => {
      const live = example(page, 'Interactive with Signal Forms');
      const gauge = live.getByRole('slider', { name: 'Volume' });
      await gauge.focus();
      await page.keyboard.press('End');
      await expect(gauge).toHaveAttribute('aria-valuenow', '100');
    },
  },

  {
    name: 'barcode with a value that cannot be encoded',
    path: 'controls/barcode',
    open: async (page) => {
      const live = example(page, 'Error state');
      await expect(live.locator('.star-barcode__error')).toBeVisible();
      await live.getByRole('textbox', { name: 'Barcode value' }).fill('5901234123457');
      await expect(live.locator('star-barcode svg')).toBeVisible();
      await live.getByRole('textbox', { name: 'Barcode value' }).fill('59012341234X');
      await expect(live.locator('.star-barcode__error')).toBeVisible();
    },
  },

  // Steps and media.
  {
    name: 'stepper on the second step',
    path: 'controls/stepper',
    open: async (page) => {
      const live = example(page, 'Linear wizard');
      await live.getByRole('textbox').fill('Ana');
      await live.getByRole('button', { name: 'Next' }).click();
      await expect(live.locator('[aria-current="step"]')).toContainText('Confirm');
    },
  },
  {
    name: 'carousel on the second page',
    path: 'controls/carousel',
    open: async (page) => {
      const live = example(page, 'One slide per page');
      await live.getByRole('button', { name: 'Next slides' }).click();
      await expect(live.getByRole('button', { name: 'Page 2' })).toHaveAttribute(
        'aria-current',
        'true',
      );
    },
  },
  {
    name: 'galleria on the third image',
    path: 'controls/galleria',
    open: async (page) => {
      const live = example(page, 'Images and thumbnails');
      await live.getByRole('button', { name: 'Show Loading dock 3' }).click();
      await expect(live.locator('.star-galleria__stage img')).toHaveAttribute(
        'alt',
        /Loading dock 3/,
      );
    },
  },
  {
    name: 'image preview',
    path: 'controls/image',
    open: async (page) => {
      await example(page, 'Preview').getByRole('button', { name: 'Preview: Shelf photo' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'speed dial open',
    path: 'controls/speed-dial',
    open: async (page) => {
      const live = example(page, 'Actions');
      await live.getByRole('button', { name: 'Quick actions' }).click();
      await expect(live.locator('.star-speed-dial__action')).toHaveCount(3);
    },
  },
  {
    name: 'terminal with output',
    path: 'controls/terminal',
    open: async (page) => {
      const live = example(page, 'Command handler');
      const input = live.getByRole('textbox', { name: 'Command' });
      await input.fill('status');
      await input.press('Enter');
      await input.fill('help');
      await input.press('Enter');
      await expect(live.getByText('Commands: help, status, date')).toBeVisible();
    },
  },
  {
    name: 'editor with content',
    path: 'controls/editor',
    open: async (page) => {
      const live = example(page, 'Toolbar and value');
      const editor = live.getByRole('textbox', { name: 'Delivery note' });
      await editor.click();
      await page.keyboard.type('Leave the parcel at the loading dock.');
      await live.getByRole('button', { name: 'Bold' }).click();
      await expect(editor).toContainText('loading dock');
    },
  },

  // Virtual scroll, scrolled to the middle.
  {
    name: 'listbox with virtual scroll in the middle',
    path: 'controls/listbox',
    open: async (page) => {
      const list = example(page, 'Large list with virtual scroll').getByRole('listbox', {
        name: 'Invoice number',
      });
      await scrollToMiddle(list);
      await expect.poll(() => list.getByRole('option').first().textContent()).not.toContain('0001');
    },
  },
  {
    name: 'listbox with groups and checkboxes in the middle',
    path: 'controls/listbox',
    open: async (page) => {
      const list = example(page, 'Large list with groups and checkboxes').getByRole('listbox', {
        name: 'Shipments',
      });
      await scrollToMiddle(list);
      await expect(list.getByRole('option').first()).toBeVisible();
    },
  },
  {
    name: 'select panel with 10,000 grouped options in the middle',
    path: 'controls/select',
    open: async (page) => {
      await example(page, 'Large list with groups')
        .getByRole('combobox', { name: 'Shipment' })
        .click();
      const list = page.getByRole('listbox', { name: 'Shipment', exact: true });
      await expect(list).toBeVisible();
      await scrollToMiddle(list);
      await expect
        .poll(() => list.getByRole('option').first().textContent())
        .not.toContain('Shipment 1');
      await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize', '10000');
    },
  },
  {
    name: 'multi-select panel with 10,000 options in the middle',
    path: 'controls/multi-select',
    open: async (page) => {
      await example(page, 'Large list').getByRole('combobox', { name: 'Parcels' }).click();
      const list = page.getByRole('listbox', { name: 'Parcels', exact: true });
      await expect(list).toBeVisible();
      await list.getByRole('option').first().click();
      await scrollToMiddle(list);
      await expect
        .poll(() => list.getByRole('option').first().textContent())
        .not.toContain('Parcel 1');
      await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize', '10000');
    },
  },
  {
    name: 'autocomplete with 10,000 suggestions in the middle',
    path: 'controls/autocomplete',
    open: async (page) => {
      await example(page, 'Large list')
        .getByRole('button', { name: /show options/i })
        .click();
      const list = page.getByRole('listbox', { name: 'Ticket', exact: true });
      await expect(list).toBeVisible();
      await scrollToMiddle(list);
      await expect
        .poll(() => list.getByRole('option').first().textContent())
        .not.toContain('Ticket 0000');
      await expect(list.getByRole('option').first()).toHaveAttribute('aria-setsize', '10000');
    },
  },
  {
    name: 'tree with windowed rendering in the middle',
    path: 'controls/tree',
    open: async (page) => {
      const tree = example(page, 'Large tree with windowed rendering').getByRole('tree', {
        name: 'Orders by site',
      });
      await scrollToMiddle(tree);
      await expect(tree.getByRole('treeitem').first()).toBeVisible();
    },
  },
  {
    name: 'tree select with windowed rendering open',
    path: 'controls/tree-select',
    open: async (page) => {
      await example(page, 'Large tree with windowed rendering')
        .getByRole('button', { name: 'Orders by site' })
        .click();
      const tree = page.getByRole('tree');
      await expect(tree).toBeVisible();
      await scrollToMiddle(tree);
    },
  },
  {
    name: 'tree table with windowed rendering in the middle',
    path: 'controls/tree-table',
    open: async (page) => {
      const live = example(page, 'Large tree table with windowed rendering');
      await live.scrollIntoViewIfNeeded();
      await scrollToMiddle(live.locator('.star-table__scroll'));
      await expect(live.getByRole('row').nth(2)).toBeVisible();
    },
  },
  {
    name: 'table with virtual scroll in the middle',
    path: 'controls/table-layout',
    open: async (page) => {
      const live = example(page, 'Virtual scroll');
      await live.scrollIntoViewIfNeeded();
      await scrollToMiddle(live.locator('.star-table__scroll'));
      await expect(live.getByRole('row').nth(2)).toBeVisible();
    },
  },
  {
    name: 'table with virtual scroll and groups in the middle',
    path: 'controls/table-layout',
    open: async (page) => {
      const live = example(page, 'Virtual scroll with groups');
      await live.scrollIntoViewIfNeeded();
      await scrollToMiddle(live.locator('.star-table__scroll'));
      await expect(live.getByRole('row').nth(2)).toBeVisible();
    },
  },
];

for (const theme of THEMES) {
  test.describe(`axe, opened states, ${theme} theme`, { tag: '@a11y' }, () => {
    for (const state of STATES) {
      test(`${state.name} (${state.path})`, async ({ page }) => {
        await openForScan(page, `/${state.path}`, theme);
        await state.open(page);
        await settle(page);
        expect(await scan(page, `${state.name} | ${state.path} ${theme}`)).toEqual([]);
      });
    }
  });
}

/**
 * Part 3: what axe does not measure. axe does not read the color of ::placeholder text, so this
 * test does: the placeholder of every text field of three docs pages must reach 4.5:1 (WCAG 1.4.3)
 * against the fill of the field, in both themes.
 */
for (const theme of THEMES) {
  test.describe(`placeholder contrast, ${theme} theme`, { tag: '@a11y' }, () => {
    for (const path of ['controls/field', 'controls/date-picker', 'controls/autocomplete']) {
      test(`${path}`, async ({ page }) => {
        await openForScan(page, `/${path}`, theme);
        const measured = await page.evaluate(() => {
          // "rgb(1, 2, 3)" has 0-255 channels, "color(srgb 0.1 0.2 0.3)" has 0-1 channels.
          const channels = (color: string) => {
            const unit = color.startsWith('color(') ? 1 : 255;
            const numbers = (color.replace('color(srgb', '').match(/[0-9.]+/g) ?? []).map(Number);
            return numbers.slice(0, 3).map((value) => {
              const share = value / unit;
              return share <= 0.03928 ? share / 12.92 : ((share + 0.055) / 1.055) ** 2.4;
            });
          };
          const luminance = (color: string) => {
            const [red, green, blue] = channels(color);
            return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
          };
          // The first fill that is not transparent, from the field outwards.
          const fillOf = (element: Element | null): string => {
            for (let node = element; node; node = node.parentElement) {
              const color = getComputedStyle(node).backgroundColor;
              if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
            }
            return 'rgb(255, 255, 255)';
          };
          return Array.from(
            document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
              'input[placeholder], textarea[placeholder]',
            ),
          )
            .filter((field) => field.offsetWidth > 0 && !field.disabled)
            .map((field) => {
              const text = luminance(getComputedStyle(field, '::placeholder').color);
              const fill = luminance(fillOf(field));
              const ratio = (Math.max(text, fill) + 0.05) / (Math.min(text, fill) + 0.05);
              return { name: field.placeholder, ratio: Math.round(ratio * 100) / 100 };
            });
        });
        expect(measured.length, 'placeholders measured').toBeGreaterThan(0);
        expect(measured.filter((item) => item.ratio < 4.5)).toEqual([]);
      });
    }
  });
}
