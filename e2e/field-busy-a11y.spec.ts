import { CDPSession, expect, Locator, test } from '@playwright/test';
import { example, openPage } from './support';

/**
 * The busy state of a field (an async validator runs, `pending()`) as assistive technology gets
 * it. The checks read the accessibility tree of Chromium (CDP `Accessibility.getFullAXTree`, the
 * tree that Chromium maps to the platform APIs that screen readers read) and the ARIA snapshot of
 * Playwright. They do not replace a pass with a real screen reader (NVDA, JAWS, VoiceOver): the
 * Accessibility guide of the docs lists the manual steps.
 *
 * The DevTools protocol reports the busy state only for live regions, not for a text box, so
 * busy is checked as `aria-busy` on the focused control itself (Core-AAM maps it to the busy
 * state of the platform). Name, validity, description, the busy icon and the alert come from the
 * accessibility tree.
 *
 * Example: Field, "Async validation". The validator takes 800 ms; the name `admin` is taken.
 * Chromium only (CDP).
 */

interface AXValue {
  readonly value?: unknown;
}
interface AXNode {
  readonly ignored: boolean;
  readonly role?: AXValue;
  readonly name?: AXValue;
  /** The accessible description (computed from `aria-describedby`). */
  readonly description?: AXValue;
  readonly properties?: readonly { readonly name: string; readonly value: AXValue }[];
}

/** What assistive technology gets about the "User name" text box. */
interface TextboxState {
  /** `aria-busy` of the text box itself. */
  readonly busy: boolean;
  /** The `invalid` property of the accessibility tree. */
  readonly invalid: string;
  /** The accessible description (the text of the `aria-describedby` elements). */
  readonly description: string;
}

async function textbox(cdp: CDPSession, input: Locator): Promise<TextboxState> {
  const { nodes } = (await cdp.send('Accessibility.getFullAXTree')) as { nodes: AXNode[] };
  const node = nodes.find(
    (entry) =>
      !entry.ignored && entry.role?.value === 'textbox' && entry.name?.value === 'User name',
  );
  if (!node) throw new Error('no text box "User name" in the accessibility tree');
  const invalid = node.properties?.find((entry) => entry.name === 'invalid')?.value.value;
  return {
    busy: (await input.getAttribute('aria-busy')) === 'true',
    invalid: String(invalid ?? 'false'),
    description: String(node.description?.value ?? '')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

/** True when the busy icon of the field is in the document and left out of the tree. */
async function busyIconHidden(cdp: CDPSession): Promise<boolean> {
  const { result } = (await cdp.send('Runtime.evaluate', {
    expression: `document.querySelector('[data-star-part="pendingIcon"]')`,
  })) as { result: { objectId?: string } };
  if (!result.objectId) return false;
  const { node } = (await cdp.send('DOM.describeNode', { objectId: result.objectId })) as {
    node: { backendNodeId: number };
  };
  const { nodes } = (await cdp.send('Accessibility.getPartialAXTree', {
    backendNodeId: node.backendNodeId,
    fetchRelatives: false,
  })) as { nodes: AXNode[] };
  return nodes.length > 0 && nodes.every((entry) => entry.ignored);
}

test.describe('field busy state in the accessibility tree @a11y', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'reads the tree through CDP');

  test('the text box is busy while the validator runs, then describes the error', async ({
    page,
  }) => {
    await openPage(page, '/controls/field', 'Field');
    const live = example(page, 'Async validation');
    const input = live.getByRole('textbox', { name: 'User name' });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Accessibility.enable');
    await cdp.send('DOM.enable');
    const state = () => textbox(cdp, input);

    // At rest: not busy, valid, described by the hint.
    expect(await state()).toEqual({
      busy: false,
      invalid: 'false',
      description: 'Letters and digits.',
    });

    // A taken name. While the validator runs, the text box itself is busy (not only its
    // wrapper), it stays valid and described by the hint, and the busy icon (decoration, no
    // text) is not in the tree.
    await input.fill('admin');
    await input.press('Tab');
    await expect
      .poll(state, { timeout: 2_000, intervals: [50] })
      .toEqual({ busy: true, invalid: 'false', description: 'Letters and digits.' });
    expect(await busyIconHidden(cdp)).toBe(true);

    // Resolved: busy is gone (on the control and on the wrapper), the text box is invalid and
    // described by the error, which is an alert (a live region, read out when it appears).
    await expect
      .poll(state, { timeout: 5_000 })
      .toEqual({ busy: false, invalid: 'true', description: 'This user name is taken.' });
    await expect(live.locator('star-field')).not.toHaveAttribute('aria-busy', /.*/);
    await expect(live.getByRole('alert')).toHaveText('This user name is taken.');
    await expect(live).toMatchAriaSnapshot(`
      - textbox "User name"
      - alert: This user name is taken.
    `);

    // A free name: busy again while it runs, then valid, and the hint describes it again.
    await input.fill('ada');
    await expect
      .poll(async () => (await state()).busy, { timeout: 2_000, intervals: [50] })
      .toBe(true);
    await expect
      .poll(state, { timeout: 5_000 })
      .toEqual({ busy: false, invalid: 'false', description: 'Letters and digits.' });
    await expect(live.getByRole('alert')).toHaveCount(0);
  });
});
