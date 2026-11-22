import { expect, test } from '@playwright/test';
import { DOCS_PAGES, openPage } from './support';

/**
 * The experimental WebMCP tools of the docs (`projects/docs/src/app/webmcp.ts`). The docs load
 * the tools module only in a browser that has the WebMCP API, after the application is stable.
 * Chromium has no WebMCP API by default, so the test installs a stub `modelContext` (on
 * `document` and on `navigator`) before the page scripts run. The stub keeps each registered
 * tool, and the test calls `execute` of the tools as an agent would.
 */

/** A registered tool, as the stub keeps it. */
interface StubTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, { type: string; description?: string }>;
    required?: string[];
  };
  annotations?: { readOnlyHint?: boolean };
  execute: (args: Record<string, unknown>) => unknown;
}

declare global {
  interface Window {
    __webMcpTools: StubTool[];
    __webMcpSignals: AbortSignal[];
  }
}

const TOOL_NAMES = ['star_ng_search_docs', 'star_ng_open_docs_page'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__webMcpTools = [];
    window.__webMcpSignals = [];
    const modelContext = {
      registerTool(tool: StubTool, options?: { signal?: AbortSignal }) {
        window.__webMcpTools.push(tool);
        if (options?.signal) window.__webMcpSignals.push(options.signal);
        return Promise.resolve();
      },
    };
    for (const host of [document, navigator]) {
      Object.defineProperty(host, 'modelContext', { value: modelContext, configurable: true });
    }
  });
});

test.describe('docs WebMCP tools', () => {
  test('registers the two tools with valid input schemas', async ({ page }) => {
    await openPage(page, '/', 'StarNG');
    await expect
      .poll(() => page.evaluate(() => window.__webMcpTools.map((tool) => tool.name).sort()))
      .toEqual([...TOOL_NAMES].sort());

    const tools = await page.evaluate(() =>
      window.__webMcpTools.map((tool) => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        readOnly: tool.annotations?.readOnlyHint ?? false,
        executable: typeof tool.execute === 'function',
      })),
    );
    for (const tool of tools) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
      expect(tool.executable, tool.name).toBe(true);
      const schema = tool.inputSchema;
      expect(schema.type, tool.name).toBe('object');
      expect(Object.keys(schema.properties).length, tool.name).toBeGreaterThan(0);
      for (const [key, property] of Object.entries(schema.properties)) {
        expect(property.type, `${tool.name}.${key}`).toBe('string');
        expect(property.description, `${tool.name}.${key}`).toBeTruthy();
      }
      for (const key of schema.required ?? []) {
        expect(Object.keys(schema.properties), `${tool.name} requires ${key}`).toContain(key);
      }
    }
    const byName = Object.fromEntries(tools.map((tool) => [tool.name, tool]));
    expect(byName['star_ng_search_docs'].inputSchema.required).toEqual(['query']);
    expect(byName['star_ng_search_docs'].readOnly).toBe(true);
    expect(byName['star_ng_open_docs_page'].inputSchema.required).toEqual(['path']);
    expect(byName['star_ng_open_docs_page'].readOnly).toBe(false);
    // Each registration has an abort signal (it ends when the application is destroyed).
    expect(await page.evaluate(() => window.__webMcpSignals.filter((s) => !s.aborted).length)).toBe(
      2,
    );
  });

  test('search returns pages of the navigation', async ({ page }) => {
    await openPage(page, '/', 'StarNG');
    await expect.poll(() => page.evaluate(() => window.__webMcpTools.length)).toBe(2);
    const search = (query: string) =>
      page.evaluate(async (words) => {
        const tool = window.__webMcpTools.find((item) => item.name === 'star_ng_search_docs')!;
        return JSON.parse(String(await tool.execute({ query: words }))) as {
          label: string;
          group: string;
          path: string;
        }[];
      }, query);

    const table = await search('table filter');
    expect(table.length).toBeGreaterThan(0);
    expect(table.map((match) => match.path)).toContain('controls/table-sort-filter');
    for (const match of table) {
      expect(DOCS_PAGES).toContain(match.path);
      expect(match.label).toBeTruthy();
      expect(match.group).toBeTruthy();
    }

    // An empty query lists the navigation (up to the limit of 20), in navigation order.
    const all = await search('');
    expect(all.map((match) => match.path)).toEqual(DOCS_PAGES.slice(0, 20));
    expect(await search('no-such-words-anywhere')).toEqual([]);
  });

  test('open goes to a docs page and ignores an unknown path', async ({ page }) => {
    await openPage(page, '/', 'StarNG');
    await expect.poll(() => page.evaluate(() => window.__webMcpTools.length)).toBe(2);
    const open = (path: string) =>
      page.evaluate(async (value) => {
        const tool = window.__webMcpTools.find((item) => item.name === 'star_ng_open_docs_page')!;
        return String(await tool.execute({ path: value }));
      }, path);

    expect(await open('/controls/table/')).toBe('Opened /controls/table.');
    await expect(page).toHaveURL(/\/controls\/table$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Table' })).toBeVisible();

    expect(await open('controls/no-such-page')).toBe(
      'No docs page has the path "controls/no-such-page".',
    );
    expect(await open('https://example.com/')).toMatch(/^No docs page has the path/);
    await expect(page).toHaveURL(/\/controls\/table$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Table' })).toBeVisible();
  });

  test('the tools code loads only in a browser with the WebMCP API', async ({ browser }) => {
    /** Opens the home page and returns whether a loaded script has the tool code. */
    const loadsTools = async (withApi: boolean): Promise<boolean> => {
      const context = await browser.newContext();
      const page = await context.newPage();
      if (!withApi) {
        // A browser where no `modelContext` has `registerTool` (Chromium may have the object).
        await page.addInitScript(() => {
          for (const host of [document, navigator]) {
            Object.defineProperty(host, 'modelContext', { value: undefined, configurable: true });
          }
        });
      } else {
        await page.addInitScript(() => {
          const modelContext = { registerTool: () => Promise.resolve() };
          for (const host of [document, navigator]) {
            Object.defineProperty(host, 'modelContext', {
              value: modelContext,
              configurable: true,
            });
          }
        });
      }
      const bodies: Promise<string>[] = [];
      page.on('response', (response) => {
        if (response.request().resourceType() === 'script') {
          bodies.push(response.text().catch(() => ''));
        }
      });
      await openPage(page, '/', 'StarNG');
      await page.waitForLoadState('networkidle');
      const texts = await Promise.all(bodies);
      await context.close();
      return texts.some((text) => text.includes('star_ng_open_docs_page'));
    };
    expect(await loadsTools(false)).toBe(false);
    expect(await loadsTools(true)).toBe(true);
  });
});
