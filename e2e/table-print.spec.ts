import { Browser, BrowserContext, expect, Page, test } from '@playwright/test';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { example, openPage } from './support';

/**
 * A real print check of the table print export, with the print engine of Chromium.
 *
 * `print()` of `StarTable` writes a document into a hidden frame and calls `window.print()` of
 * the frame. The print dialog cannot be driven, so the tests replace `print` of the frame, keep
 * the exact HTML of the frame document, and give the same HTML to `page.pdf()`. That is the
 * print pipeline of headless Chromium (print media, page breaks, repeated table header,
 * shrink to fit). The PDF is then read with pdf.js: text, position and colors of every page.
 *
 * Not covered: other browsers' print engines, real printers, the print dialog (paper choice,
 * scale, "Headers and footers", "Background graphics") and the preview of the browser.
 */

const POINTS_PER_INCH = 72;
/** Margin of 0.4 inch on each side, close to the default of the Chromium print dialog. */
const MARGIN_INCH = 0.4;
const MARGIN = MARGIN_INCH * POINTS_PER_INCH;
/** Slack for the rounding of the text positions of the PDF. */
const SLACK = 0.75;

interface Paper {
  readonly name: string;
  readonly format: 'A4' | 'Letter';
  readonly landscape: boolean;
}
const A4_PORTRAIT: Paper = { name: 'A4 portrait', format: 'A4', landscape: false };
const A4_LANDSCAPE: Paper = { name: 'A4 landscape', format: 'A4', landscape: true };
const LETTER_PORTRAIT: Paper = { name: 'US Letter portrait', format: 'Letter', landscape: false };
const PAPERS: readonly Paper[] = [A4_PORTRAIT, A4_LANDSCAPE, LETTER_PORTRAIT];

/** What the frame reports when it calls `print()`. */
interface Captured {
  readonly html: string;
  readonly borderCollapse: string;
  readonly rowBreakInside: string;
  readonly violations: readonly string[];
}

interface PdfItem {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly right: number;
  readonly size: number;
}
interface PdfLine {
  readonly y: number;
  readonly items: readonly PdfItem[];
}
interface PdfPage {
  readonly width: number;
  readonly height: number;
  readonly lines: readonly PdfLine[];
  readonly items: readonly PdfItem[];
  readonly fillColors: ReadonlySet<string>;
}

interface PdfTextItem {
  readonly str: string;
  readonly width: number;
  readonly transform: readonly number[];
}

/** Replaces `print` of the frame: the test gets the document and the print dialog stays closed. */
async function stubFramePrint(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (window === window.top) return;
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(event.violatedDirective),
    );
    window.print = () => {
      const table = document.querySelector('table');
      const row = document.querySelector('tbody tr');
      (window.top as unknown as { __printed?: unknown }).__printed = {
        html: '<!doctype html>' + document.documentElement.outerHTML,
        borderCollapse: table ? getComputedStyle(table).borderCollapse : '',
        rowBreakInside: row ? getComputedStyle(row).breakInside : '',
        violations,
      };
    };
  });
}

async function readCaptured(page: Page): Promise<Captured> {
  await expect
    .poll(() => page.evaluate(() => !!(window as unknown as { __printed?: unknown }).__printed))
    .toBe(true);
  return page.evaluate(() => (window as unknown as { __printed: Captured }).__printed);
}

/** Opens a docs page, presses a print button and returns the document of the print frame. */
async function capture(page: Page, button: string, exampleHeading: string): Promise<Captured> {
  await stubFramePrint(page);
  await openPage(page, '/controls/table-export', 'Table export');
  await example(page, exampleHeading).getByRole('button', { name: button }).click();
  return readCaptured(page);
}

/** Renders HTML with the print pipeline of Chromium and reads the PDF. */
async function renderPdf(
  context: BrowserContext,
  html: string,
  paper: Paper,
  options: { dark?: boolean } = {},
): Promise<PdfPage[]> {
  const page = await context.newPage();
  try {
    await page.emulateMedia({ media: 'print', colorScheme: options.dark ? 'dark' : 'light' });
    await page.setContent(html);
    const bytes = await page.pdf({
      format: paper.format,
      landscape: paper.landscape,
      printBackground: true,
      margin: {
        top: `${MARGIN_INCH}in`,
        bottom: `${MARGIN_INCH}in`,
        left: `${MARGIN_INCH}in`,
        right: `${MARGIN_INCH}in`,
      },
    });
    return await readPdf(bytes);
  } finally {
    await page.close();
  }
}

async function readPdf(bytes: Uint8Array): Promise<PdfPage[]> {
  const document = await pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 }).promise;
  const names = new Map(Object.entries(pdfjs.OPS).map(([name, code]) => [code as number, name]));
  const pages: PdfPage[] = [];
  for (let number = 1; number <= document.numPages; number++) {
    const page = await document.getPage(number);
    const [, , width, height] = page.view;
    const content = await page.getTextContent();
    const items = (content.items as unknown as PdfTextItem[])
      .filter((item) => item.str.trim() !== '')
      .map((item) => ({
        str: item.str.trim(),
        x: item.transform[4],
        y: item.transform[5],
        right: item.transform[4] + item.width,
        size: Math.abs(item.transform[0]),
      }));
    const operators = await page.getOperatorList();
    const fillColors = new Set<string>();
    operators.fnArray.forEach((code, index) => {
      if (names.get(code) === 'setFillRGBColor') fillColors.add(String(operators.argsArray[index]));
    });
    // Text of the same baseline is one line, from the top of the page down.
    const lines: { y: number; items: PdfItem[] }[] = [];
    for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
      if (line) line.items.push(item);
      else lines.push({ y: item.y, items: [item] });
    }
    for (const line of lines) line.items.sort((a, b) => a.x - b.x);
    pages.push({ width, height, lines, items, fillColors });
  }
  return pages;
}

/** The print document and its PDFs, one per paper (rendered once). */
class Printout {
  private readonly cache = new Map<string, Promise<PdfPage[]>>();
  constructor(
    readonly context: BrowserContext,
    readonly captured: Captured,
  ) {}
  pdf(paper: Paper): Promise<PdfPage[]> {
    let result = this.cache.get(paper.name);
    if (!result) {
      result = renderPdf(this.context, this.captured.html, paper);
      this.cache.set(paper.name, result);
    }
    return result;
  }
}

async function openPrintout(
  browser: Browser,
  button: string,
  exampleHeading: string,
): Promise<Printout> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const captured = await capture(page, button, exampleHeading);
  await page.close();
  return new Printout(context, captured);
}

/** First item of every line that starts with the pattern, over all pages, in print order. */
function firstColumn(pages: readonly PdfPage[], pattern: RegExp): string[] {
  return pages.flatMap((page) =>
    page.lines.flatMap((line) => (pattern.test(line.items[0].str) ? [line.items[0].str] : [])),
  );
}

function headerLineIndex(page: PdfPage, headers: readonly string[]): number {
  return page.lines.findIndex(
    (line) =>
      line.items.length === headers.length &&
      line.items.every((item, index) => item.str === headers[index]),
  );
}

function inBounds(pages: readonly PdfPage[]): { right: number; left: number; bottom: number } {
  let right = Infinity;
  let left = Infinity;
  let bottom = Infinity;
  for (const page of pages) {
    for (const item of page.items) {
      right = Math.min(right, page.width - MARGIN - item.right);
      left = Math.min(left, item.x - MARGIN);
      bottom = Math.min(bottom, item.y - MARGIN);
    }
  }
  return { right, left, bottom };
}

const minimumSize = (pages: readonly PdfPage[]) =>
  Math.min(...pages.flatMap((page) => page.items.map((item) => item.size)));

const INVOICE_HEADERS = ['Invoice', 'Customer', 'Project', 'Status', 'Quantity', 'Amount', 'Note'];
const INVOICE_ID = /^INV-\d{4}$/;
const allInvoiceIds = Array.from(
  { length: 240 },
  (_, index) => `INV-${String(index + 1).padStart(4, '0')}`,
);

test.describe('table print: the long table (240 rows) in the print engine', () => {
  let printout: Printout;
  test.beforeAll(async ({ browser }) => {
    printout = await openPrintout(browser, 'Print invoices', 'Print a long table');
  });
  test.afterAll(async () => {
    await printout.context.close();
  });

  for (const paper of PAPERS) {
    test.describe(paper.name, () => {
      test('prints all rows once, in order, not only the rows of the page on the screen', async () => {
        const pages = await printout.pdf(paper);
        test
          .info()
          .annotations.push({ type: 'pages', description: `${paper.name}: ${pages.length}` });
        expect(pages.length).toBeGreaterThan(1);
        expect(firstColumn(pages, INVOICE_ID)).toEqual(allInvoiceIds);
        // The document itself has all 240 rows, while the table on the screen shows 10.
        expect((printout.captured.html.match(/<tr>/g) ?? []).length).toBe(241);
      });

      test('repeats the header row at the top of every page', async () => {
        const pages = await printout.pdf(paper);
        pages.forEach((page, index) => {
          // The title is above the header on the first page only.
          expect(headerLineIndex(page, INVOICE_HEADERS), `page ${index + 1}`).toBe(
            index === 0 ? 1 : 0,
          );
        });
      });

      test('does not split a row across two pages', async () => {
        const pages = await printout.pdf(paper);
        for (const [index, page] of pages.entries()) {
          const header = headerLineIndex(page, INVOICE_HEADERS);
          const first = page.lines[header + 1];
          // The first line below the header starts a row: it is not the rest of a wrapped cell.
          expect(first.items[0].str, `first body line of page ${index + 1}`).toMatch(INVOICE_ID);
          expect(first.items[0].x).toBeCloseTo(page.lines[header].items[0].x, 0);
          // Every line of a page ends above the bottom margin.
          for (const line of page.lines) expect(line.y).toBeGreaterThanOrEqual(MARGIN - SLACK);
        }
      });

      test('keeps every column inside the page at the full text size', async () => {
        const pages = await printout.pdf(paper);
        const bounds = inBounds(pages);
        expect(bounds.right).toBeGreaterThanOrEqual(-SLACK);
        expect(bounds.left).toBeGreaterThanOrEqual(-SLACK);
        expect(bounds.bottom).toBeGreaterThanOrEqual(-SLACK);
        // 12px text is 9pt: the engine did not have to shrink the page to fit.
        expect(minimumSize(pages)).toBeGreaterThan(8.9);
      });

      test('right-aligns the number columns and their headers', async () => {
        const pages = await printout.pdf(paper);
        const quantity: PdfItem[] = [];
        const amount: PdfItem[] = [];
        const customer: PdfItem[] = [];
        const headers: Record<string, PdfItem> = {};
        for (const page of pages) {
          const header = page.lines[headerLineIndex(page, INVOICE_HEADERS)];
          header.items.forEach((item) => (headers[item.str] = item));
          for (const line of page.lines) {
            if (!INVOICE_ID.test(line.items[0].str)) continue;
            quantity.push(...line.items.filter((item) => /^[1-9]$/.test(item.str)));
            amount.push(...line.items.filter((item) => /^\d{2,}(\.\d+)?$/.test(item.str)));
            customer.push(line.items[1]);
          }
        }
        expect(quantity).toHaveLength(240);
        expect(amount).toHaveLength(240);
        for (const column of [quantity, amount]) {
          const right = column.map((item) => item.right);
          expect(Math.max(...right) - Math.min(...right)).toBeLessThan(SLACK);
        }
        // The numbers have different widths, so equal right edges are not by chance.
        const left = amount.map((item) => item.x);
        expect(Math.max(...left) - Math.min(...left)).toBeGreaterThan(5);
        // The header sits above the numbers, on the right.
        expect(headers['Quantity'].right).toBeCloseTo(quantity[0].right, 0);
        expect(headers['Amount'].right).toBeCloseTo(amount[0].right, 0);
        // A text column stays left-aligned.
        const textLeft = customer.map((item) => item.x);
        expect(Math.max(...textLeft) - Math.min(...textLeft)).toBeLessThan(SLACK);
      });

      test('has the title once, at the top of the first page, and no date or page number', async () => {
        const pages = await printout.pdf(paper);
        const all = pages.flatMap((page) => page.items);
        const titles = all.filter((item) => item.str === 'Invoices');
        expect(titles).toHaveLength(1);
        expect(pages[0].lines[0].items.map((item) => item.str)).toEqual(['Invoices']);
        expect(titles[0].size).toBeCloseTo(12, 0);
        // The export adds no caption, no print date and no page number of its own (the
        // browser adds them with "Headers and footers", which page.pdf() leaves off).
        expect(printout.captured.html).not.toMatch(
          /<caption|<time|<footer|page-?number|counter\(/i,
        );
        expect(
          all.some((item) => /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}|Page \d|\d+ of \d+/.test(item.str)),
        ).toBe(false);
      });

      test('leaves out the hidden column, the selection column and the action column', async () => {
        const pages = await printout.pdf(paper);
        const all = pages.flatMap((page) => page.items.map((item) => item.str));
        // Region is hidden: none of its values is printed.
        for (const region of ['Europe', 'Asia', 'Americas']) expect(all).not.toContain(region);
        // The action column is a button "Open" in every row. The status "Open" is in 80 rows
        // (every third row), so a printed button would make 320.
        expect(all.filter((text) => text === 'Open')).toHaveLength(80);
        // Seven header cells, none for the selection column.
        for (const page of pages)
          expect(headerLineIndex(page, INVOICE_HEADERS)).toBeGreaterThanOrEqual(0);
      });

      test('wraps long cell text inside the cell', async () => {
        const pages = await printout.pdf(paper);
        const signature =
          'Q2FsY3VsYXRlZC1mcm9tLXRoZS1zaWduZWQtYWNjZXB0YW5jZS1mb3JtLTIwMjYtMDEtMTUtdmVyeS1sb25nLXJlZmVyZW5jZS1mb3ItdGhlLXdyYXAtY2hlY2s';
        // The note cells of row INV-0013, from its first line to the line before INV-0014.
        const noteLines: string[] = [];
        for (const page of pages) {
          const noteX = page.lines[headerLineIndex(page, INVOICE_HEADERS)].items[6].x;
          let inRow = false;
          for (const line of page.lines) {
            if (INVOICE_ID.test(line.items[0].str)) inRow = line.items[0].str === 'INV-0013';
            if (inRow) {
              noteLines.push(
                line.items
                  .filter((item) => item.x >= noteX - SLACK)
                  .map((item) => item.str)
                  .join(''),
              );
            }
          }
        }
        // The unbroken text is cut into several lines, and no character of it is lost.
        expect(noteLines.filter(Boolean).length).toBeGreaterThan(1);
        expect(noteLines.join('').replace(/\s/g, '')).toBe('Signature' + signature);
        // The wrapped note and the delivery notes grow the rows, not the page.
        expect(inBounds(pages).right).toBeGreaterThanOrEqual(-SLACK);
        expect(minimumSize(pages)).toBeGreaterThan(8.9);
      });
    });
  }
});

test.describe('table print: the orders example of the docs page', () => {
  let printout: Printout;
  test.beforeAll(async ({ browser }) => {
    printout = await openPrintout(browser, 'Print', 'Download and print');
  });
  test.afterAll(async () => {
    await printout.context.close();
  });
  const ORDER_HEADERS = ['Order', 'Customer', 'Product', 'Status', 'Placed', 'Total'];

  for (const paper of PAPERS) {
    test(`${paper.name}: 57 rows, a repeated header, no column cut off, totals on the right`, async () => {
      const pages = await printout.pdf(paper);
      const ids = firstColumn(pages, /^ORD-\d{4}$/);
      expect(ids).toEqual(Array.from({ length: 57 }, (_, i) => `ORD-${1001 + i}`));
      pages.forEach((page, index) => {
        expect(headerLineIndex(page, ORDER_HEADERS), `page ${index + 1}`).toBe(index === 0 ? 1 : 0);
      });
      const bounds = inBounds(pages);
      expect(bounds.right).toBeGreaterThanOrEqual(-SLACK);
      expect(bounds.left).toBeGreaterThanOrEqual(-SLACK);
      expect(minimumSize(pages)).toBeGreaterThan(8.9);
      // The totals are numbers: same right edge in every row, and the header above them.
      const right: number[] = [];
      const headerRight: number[] = [];
      for (const page of pages) {
        headerRight.push(page.lines[headerLineIndex(page, ORDER_HEADERS)].items[5].right);
        for (const line of page.lines) {
          if (/^ORD-\d{4}$/.test(line.items[0].str)) right.push(line.items.at(-1)!.right);
        }
      }
      expect(Math.max(...right) - Math.min(...right)).toBeLessThan(SLACK);
      expect(headerRight[0]).toBeCloseTo(right[0], 0);
    });
  }
});

test.describe('table print: a wide table (16 columns)', () => {
  let printout: Printout;
  test.beforeAll(async ({ browser }) => {
    printout = await openPrintout(browser, 'Print wide table', 'Print a wide table');
  });
  test.afterAll(async () => {
    await printout.context.close();
  });

  for (const paper of PAPERS) {
    test(`${paper.name}: fits the page width and loses no row`, async () => {
      const pages = await printout.pdf(paper);
      expect(firstColumn(pages, /^ORD-\d{4}$/)).toEqual(
        Array.from({ length: 30 }, (_, i) => `ORD-${1001 + i}`),
      );
      // Nothing is cut at the right edge: the engine shrinks the page to fit. The shrunk text
      // can reach a few points into the right margin, but stays far inside the paper
      // (a printer cannot print the outer 14 points anyway).
      const bounds = inBounds(pages);
      expect(bounds.right).toBeGreaterThan(-MARGIN + 14);
      expect(bounds.left).toBeGreaterThanOrEqual(-SLACK);
      // Every page starts with the header row.
      for (const page of pages) {
        const top = page.lines[pages[0] === page ? 1 : 0].items.map((item) => item.str);
        expect(top).toContain('Order');
        expect(top).toContain('Tracking');
      }
      const size = minimumSize(pages);
      test.info().annotations.push({
        type: 'text size',
        description: `${paper.name}: ${size.toFixed(1)}pt on ${pages.length} page(s)`,
      });
      if (paper.landscape) {
        // Landscape is wide enough for about 95% of the text size (9pt), over more pages.
        expect(size).toBeGreaterThan(8);
        expect(pages.length).toBeGreaterThan(1);
      } else {
        // Portrait: Chromium scales the whole page down to fit, to about 70%.
        // The table is readable but small. Use landscape for a table like this.
        expect(size).toBeLessThan(8);
        expect(size).toBeGreaterThan(5);
      }
    });
  }
});

test.describe('table print: state of the table', () => {
  test('prints the sorted and filtered rows, all pages of them', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await stubFramePrint(page);
    await openPage(page, '/controls/table-export', 'Table export');
    const live = example(page, 'Print a long table');
    await live.getByLabel('Filter by Customer').fill('ben');
    const amount = live.getByRole('columnheader', { name: 'Amount' });
    await amount.getByRole('button').click();
    await amount.getByRole('button').click();
    await expect(amount).toHaveAttribute('aria-sort', 'descending');
    const onScreen = ((await live.locator('tbody').innerText()).match(/INV-\d{4}/g) ?? []).slice();
    expect(onScreen).toHaveLength(10);
    await live.getByRole('button', { name: 'Print invoices' }).click();
    const captured = await readCaptured(page);
    const pages = await renderPdf(context, captured.html, A4_PORTRAIT);
    // Customers 'Ben Carter' are every fifth invoice: 48 of 240, on several printed pages.
    const ids = firstColumn(pages, INVOICE_ID);
    expect(ids).toHaveLength(48);
    expect(pages.length).toBeGreaterThan(1);
    // The first printed rows are the rows on the first page of the screen, in the same order.
    expect(ids.slice(0, 10)).toEqual(onScreen);
    // Every printed row is a Ben Carter row, and the amounts fall from row to row.
    const amounts: number[] = [];
    for (const pdfPage of pages) {
      for (const line of pdfPage.lines) {
        if (!INVOICE_ID.test(line.items[0].str)) continue;
        expect('Ben Carter').toContain(line.items[1].str);
        expect(line.items[1].str).toMatch(/^Ben/);
        amounts.push(Number(line.items.find((item) => /^\d{2,}(\.\d+)?$/.test(item.str))!.str));
      }
    }
    expect(amounts).toHaveLength(48);
    expect(amounts).toEqual([...amounts].sort((a, b) => b - a));
    await context.close();
  });

  test('the dark theme does not reach the printout: black text on white paper', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    await context.addInitScript(() => localStorage.setItem('star-theme', 'dark'));
    const page = await context.newPage();
    const captured = await capture(page, 'Print invoices', 'Print a long table');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // The page is dark: the print frame does not carry its theme.
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
      'rgb(255, 255, 255)',
    );
    expect(captured.html).not.toMatch(/--star-|data-theme|<link|color-scheme|prefers-color-scheme/);
    // Rendered for a dark system too, with background graphics on: the only fill colors are
    // the black text, the gray border and the light gray header, on white paper.
    const pages = await renderPdf(context, captured.html, A4_PORTRAIT, { dark: true });
    const colors = new Set(pages.flatMap((pdfPage) => [...pdfPage.fillColors]));
    expect([...colors].sort()).toEqual(['#000000', '#999999', '#eeeeee']);
    const probe = await context.newPage();
    await probe.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await probe.setContent(captured.html);
    const style = await probe.evaluate(() => ({
      text: getComputedStyle(document.body).color,
      paper: getComputedStyle(document.documentElement).backgroundColor,
      canvas: getComputedStyle(document.body).backgroundColor,
    }));
    expect(style).toEqual({
      text: 'rgb(0, 0, 0)',
      paper: 'rgba(0, 0, 0, 0)',
      canvas: 'rgba(0, 0, 0, 0)',
    });
    await context.close();
  });
});

/** Serves the docs page with a policy that has no 'unsafe-inline' in style-src. */
async function removeUnsafeInline(page: Page): Promise<void> {
  await page.route('**/controls/table-export', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "style-src 'self' 'unsafe-inline'",
      "style-src 'self'",
    );
    expect(body).toContain("style-src 'self'; img-src");
    return route.fulfill({ response, body });
  });
}

test.describe('table print: Content Security Policy', () => {
  const BUTTON = 'Print invoices';
  const HEADING = 'Print a long table';

  test('the frame style works under the policy of the docs application', async ({ page }) => {
    const policy = async () =>
      page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    const captured = await capture(page, BUTTON, HEADING);
    expect(await policy()).toContain("style-src 'self' 'unsafe-inline'");
    expect(await policy()).toContain("script-src 'self'");
    // The srcdoc frame inherits the policy of the page. Its inline style is allowed by
    // 'unsafe-inline', and the call to print() is made by the page, not by a script of the frame.
    expect(captured.violations).toEqual([]);
    expect(captured.borderCollapse).toBe('collapse');
    expect(captured.rowBreakInside).toBe('avoid');
  });

  test('without unsafe-inline in style-src the inline style of the frame is blocked', async ({
    page,
  }) => {
    await removeUnsafeInline(page);
    const captured = await capture(page, BUTTON, HEADING);
    // The print dialog still opens, with the rows, but the table has no style.
    expect(captured.html).toContain('INV-0240');
    expect(captured.violations).toContain('style-src-elem');
    expect(captured.borderCollapse).toBe('separate');
    expect(captured.rowBreakInside).toBe('auto');
  });

  test('a constructed style sheet is not blocked, and styles the frame under that policy', async ({
    page,
  }) => {
    await removeUnsafeInline(page);
    const captured = await capture(page, BUTTON, HEADING);
    const css = /<style>([\s\S]*?)<\/style>/.exec(captured.html)![1];
    const frame = page.frames().find((candidate) => candidate.url() === 'about:srcdoc')!;
    const result = await frame.evaluate((text) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(text);
      document.adoptedStyleSheets = [sheet];
      return {
        borderCollapse: getComputedStyle(document.querySelector('table')!).borderCollapse,
        rowBreakInside: getComputedStyle(document.querySelector('tbody tr')!).breakInside,
      };
    }, css);
    expect(result).toEqual({ borderCollapse: 'collapse', rowBreakInside: 'avoid' });
  });
});
