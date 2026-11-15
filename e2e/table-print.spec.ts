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
  readonly format: 'A4' | 'A5' | 'Letter';
  readonly landscape: boolean;
}
const A4_PORTRAIT: Paper = { name: 'A4 portrait', format: 'A4', landscape: false };
const A4_LANDSCAPE: Paper = { name: 'A4 landscape', format: 'A4', landscape: true };
const LETTER_PORTRAIT: Paper = { name: 'US Letter portrait', format: 'Letter', landscape: false };
const A5_PORTRAIT: Paper = { name: 'A5 portrait', format: 'A5', landscape: false };
const PAPERS: readonly Paper[] = [A4_PORTRAIT, A4_LANDSCAPE, LETTER_PORTRAIT];
/** Paper sizes in points, as the PDF reports them (rounded). */
const PAPER_WIDTH: Record<Paper['format'], number> = { A4: 595.28, A5: 419.53, Letter: 612 };
const PAPER_HEIGHT: Record<Paper['format'], number> = { A4: 841.89, A5: 595.28, Letter: 792 };

/**
 * Width in CSS pixels that the print engine gives the layout of the table: the paper minus the
 * margins (and the 16 px margin of the document body). 96 CSS pixels are 72 points.
 */
function contentWidth(paper: Paper): number {
  const points = paper.landscape ? PAPER_HEIGHT[paper.format] : PAPER_WIDTH[paper.format];
  return (points - 2 * MARGIN) / 0.75 - 32;
}

/** What the frame reports when it calls `print()`. */
interface Captured {
  /**
   * The frame document as HTML. The print style is made of constructed style sheets, which
   * `outerHTML` does not hold: their rules are written into one `style` element of this copy,
   * so `page.pdf()` can print the same rules in a page that has no policy.
   */
  readonly html: string;
  /** `style` elements and `style` attributes of the frame itself, before the copy above. */
  readonly styleElements: number;
  readonly styleAttributes: number;
  readonly adoptedSheets: number;
  readonly lang: string | null;
  readonly dir: string | null;
  /** Computed in the frame: the border width of the first body cell. */
  readonly cellBorder: string;
  readonly borderCollapse: string;
  readonly rowBreakInside: string;
  readonly violations: readonly string[];
  /** Text of the header cells and of the body cells, as the frame has them when it prints. */
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** What a test does to the frame document before the table is measured and printed. */
interface FrameStress {
  /** Style rules added to the document, so wide text is in the layout that is measured. */
  readonly css?: string;
  /** Adds eight columns to the table (24 in all, for the table with 16 columns). */
  readonly extraColumns?: boolean;
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
async function stubFramePrint(page: Page, stress: FrameStress = {}): Promise<void> {
  await page.addInitScript((stress) => {
    if (window === window.top) return;
    // Before the load event, so before the table is measured by the frame code of the library.
    if (stress.css || stress.extraColumns) {
      document.addEventListener('DOMContentLoaded', () => {
        if (stress.css) {
          const style = document.createElement('style');
          style.textContent = stress.css;
          document.head.append(style);
        }
        if (stress.extraColumns) {
          const values: ((row: number) => string)[] = [
            () => 'North hub',
            (row) => (row % 2 ? 'High' : 'Low'),
            () => 'Web shop',
            () => 'EUR',
            (row) => `REF-${20000 + row}`,
            () => 'Ava Stone',
            (row) => `+1 555 01${String(row).padStart(2, '0')}`,
            () => 'Call before delivery',
          ];
          const names = [
            'Warehouse',
            'Priority',
            'Channel',
            'Currency',
            'Reference',
            'Contact',
            'Phone',
            'Comment',
          ];
          for (const row of document.querySelectorAll('thead tr')) {
            for (const name of names) {
              const cell = document.createElement('th');
              cell.scope = 'col';
              cell.textContent = name;
              row.append(cell);
            }
          }
          document.querySelectorAll('tbody tr').forEach((row, index) => {
            for (const value of values) {
              const text = value(index);
              const cell = document.createElement('td');
              cell.textContent = text;
              if (!/\s/.test(text) && text.length <= 20) cell.className = 's';
              row.append(cell);
            }
          });
        }
      });
    }
    const violations: string[] = [];
    document.addEventListener('securitypolicyviolation', (event) =>
      violations.push(event.violatedDirective),
    );
    window.print = () => {
      const table = document.querySelector('table');
      const row = document.querySelector('tbody tr');
      const rules = Array.from(document.adoptedStyleSheets, (sheet) =>
        Array.from(sheet.cssRules, (rule) => rule.cssText).join('\n'),
      ).join('\n');
      const cell = document.querySelector('tbody td');
      (window.top as unknown as { __printed?: unknown }).__printed = {
        html:
          '<!doctype html>' +
          document.documentElement.outerHTML.replace('</head>', `<style>${rules}</style></head>`),
        styleElements: document.querySelectorAll('style').length,
        styleAttributes: document.querySelectorAll('[style]').length,
        adoptedSheets: document.adoptedStyleSheets.length,
        lang: document.documentElement.getAttribute('lang'),
        dir: document.documentElement.getAttribute('dir'),
        cellBorder: cell ? getComputedStyle(cell).borderTopWidth : '',
        borderCollapse: table ? getComputedStyle(table).borderCollapse : '',
        rowBreakInside: row ? getComputedStyle(row).breakInside : '',
        violations,
        headers: Array.from(
          document.querySelectorAll('thead th'),
          (cell) => cell.textContent ?? '',
        ),
        rows: Array.from(document.querySelectorAll('tbody tr'), (row) =>
          Array.from(row.children, (cell) => cell.textContent ?? ''),
        ),
      };
    };
  }, stress);
}

async function readCaptured(page: Page): Promise<Captured> {
  await expect
    .poll(() => page.evaluate(() => !!(window as unknown as { __printed?: unknown }).__printed))
    .toBe(true);
  return page.evaluate(() => (window as unknown as { __printed: Captured }).__printed);
}

/** Opens a docs page, presses a print button and returns the document of the print frame. */
async function capture(
  page: Page,
  button: string,
  exampleHeading: string,
  stress: FrameStress = {},
): Promise<Captured> {
  await stubFramePrint(page, stress);
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
  stress: FrameStress = {},
): Promise<Printout> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const captured = await capture(page, button, exampleHeading, stress);
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

/** The smallest text that the table is allowed to get: 8 px are 6 pt. */
const TEXT_FLOOR = 6 - 0.1;

const squeeze = (text: string) => text.replace(/\s/g, '');

/**
 * Checks that the PDF holds the whole table, once: the title and the header cells at the top of
 * the first page, the header cells at the top of every other page, and then every cell of every
 * row, in order, complete, with whole rows on each page (no row is split between two pages). The
 * text of a page is read in the order of the PDF content, which is the order of the table: cell
 * by cell, row by row. A word that the table had to break at the end of a line is still all
 * there, in pieces of the same cell. Spaces are left out because the line breaks decide them.
 */
function expectWholeTable(
  pages: readonly PdfPage[],
  title: string,
  headers: readonly string[],
  rows: readonly (readonly string[])[],
): void {
  const header = squeeze(headers.join(''));
  const rowText = rows.map((row) => squeeze(row.join('')));
  let next = 0;
  pages.forEach((page, index) => {
    const text = squeeze(page.items.map((item) => item.str).join(''));
    const top = index === 0 ? squeeze(title) + header : header;
    expect(text.startsWith(top), `page ${index + 1} starts with ${top.slice(0, 40)}`).toBe(true);
    let position = top.length;
    while (next < rowText.length && text.startsWith(rowText[next], position)) {
      position += rowText[next].length;
      next++;
    }
    expect(position, `page ${index + 1} has whole rows only, from row ${next + 1} on`).toBe(
      text.length,
    );
  });
  expect(next).toBe(rowText.length);
}

/** Nothing outside the page box, and no text smaller than the floor of the table. */
function expectInsidePage(pages: readonly PdfPage[]): void {
  const bounds = inBounds(pages);
  expect(bounds.right).toBeGreaterThanOrEqual(-SLACK);
  expect(bounds.left).toBeGreaterThanOrEqual(-SLACK);
  expect(bounds.bottom).toBeGreaterThanOrEqual(-SLACK);
  expect(minimumSize(pages)).toBeGreaterThan(TEXT_FLOOR);
}

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

const WIDE_HEADERS = [
  'Order',
  'Customer',
  'Email',
  'Product',
  'Region',
  'Status',
  'Placed',
  'Shipped',
  'Quantity',
  'Unit price',
  'Discount',
  'Tax',
  'Total',
  'Carrier',
  'Tracking',
  'Note',
];

test.describe('table print: a wide table (16 columns)', () => {
  let printout: Printout;
  test.beforeAll(async ({ browser }) => {
    printout = await openPrintout(browser, 'Print wide table', 'Print a wide table');
  });
  test.afterAll(async () => {
    await printout.context.close();
  });

  for (const paper of PAPERS) {
    test(`${paper.name}: fits the page width and loses no column, no cell and no row`, async () => {
      const pages = await printout.pdf(paper);
      const { headers, rows } = printout.captured;
      expect(headers).toEqual(WIDE_HEADERS);
      expect(rows).toHaveLength(30);
      // Every header, every cell of every row, once and in order, inside the page. This holds
      // for the fonts of any platform: a table that is too wide for the paper wraps, gets smaller
      // text or breaks words, and never loses its right edge.
      expectWholeTable(pages, 'Wide orders', headers, rows);
      expectInsidePage(pages);
      // Every page starts with the header row: checked by expectWholeTable.
      const size = minimumSize(pages);
      test.info().annotations.push({
        type: 'text size',
        description: `${paper.name}: ${size.toFixed(1)}pt on ${pages.length} page(s)`,
      });
      // The size depends on the fonts of the platform. It is never above the normal size
      // (9 pt) and never below the floor (6 pt).
      expect(size).toBeLessThan(9.1);
    });
  }

  test('the table is wider than a portrait page, and the document knows what to do', async () => {
    // The first query of the fit style names the width at which the table fits as it is built.
    const natural = Number(/@container \(width < (\d+)px\)/.exec(printout.captured.html)?.[1]);
    expect(natural).toBeGreaterThan(contentWidth(A4_PORTRAIT));
  });
});

/**
 * The same print pipeline with text that is much wider than the fonts of this platform: a
 * monospace font, and for the table with 24 columns also letter spacing. The style is added to
 * the frame document before the library measures the table, as a wide font of a platform would
 * be. On the paper sizes below the table is far wider than the page (more than the 1.5 times
 * that the print engine of Chromium can shrink a page), so a table that relied on the shrink to
 * fit would lose its right columns.
 */
const WIDE_TEXT = 'body,table,th,td{font-family:"Courier New",Courier,monospace}';
const WIDER_TEXT = WIDE_TEXT + 'th,td{letter-spacing:1px}';
const STRESS_PAPERS: readonly Paper[] = [A4_PORTRAIT, LETTER_PORTRAIT, A5_PORTRAIT];

test.describe('table print: stress with wide text on narrow paper', () => {
  const cases = [
    { name: '16 columns, wide font', columns: 16, stress: { css: WIDE_TEXT } },
    {
      name: '24 columns, wide font and letter spacing',
      columns: 24,
      stress: { css: WIDER_TEXT, extraColumns: true },
    },
  ];
  for (const { name, columns, stress } of cases) {
    test.describe(name, () => {
      let printout: Printout;
      test.beforeAll(async ({ browser }) => {
        printout = await openPrintout(browser, 'Print wide table', 'Print a wide table', stress);
      });
      test.afterAll(async () => {
        await printout.context.close();
      });

      test('is a real stress: wider than 1.5 times every paper below', () => {
        expect(printout.captured.headers).toHaveLength(columns);
        const natural = Number(/@container \(width < (\d+)px\)/.exec(printout.captured.html)?.[1]);
        for (const paper of STRESS_PAPERS) {
          expect(natural, paper.name).toBeGreaterThan(1.5 * contentWidth(paper));
        }
      });

      for (const paper of STRESS_PAPERS) {
        test(`${paper.name}: every header and every cell is on the page, complete, once`, async () => {
          const pages = await printout.pdf(paper);
          const { headers, rows } = printout.captured;
          expect(rows).toHaveLength(30);
          expectWholeTable(pages, 'Wide orders', headers, rows);
          expectInsidePage(pages);
          // The header row is on every page, and a row is not split: expectWholeTable.
          test.info().annotations.push({
            type: 'text size',
            description: `${paper.name}: ${minimumSize(pages).toFixed(1)}pt on ${pages.length} page(s)`,
          });
        });
      }

      test('without the fit rules the same document loses its right edge (A4 portrait)', async () => {
        // The old behavior, to show that the stress works: the table is not wrapped or shrunk
        // by the document, so the engine shrinks the page by 1.5 times at most and cuts the rest.
        const old = printout.captured.html.replace(
          /@container[^{]*\{(?:[^{}]*\{[^{}]*\})*\s*\}/g,
          '',
        );
        expect(old).not.toContain('@container');
        const pages = await renderPdf(printout.context, old, A4_PORTRAIT);
        const { headers } = printout.captured;
        const text = squeeze(pages.flatMap((page) => page.items.map((item) => item.str)).join(''));
        expect(text).not.toContain(squeeze(headers.join('')));
      });
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

  test('without unsafe-inline in style-src the frame keeps its style and reports no violation', async ({
    page,
  }) => {
    await removeUnsafeInline(page);
    // The violations of the page itself (not of the frame) are counted before and after the click.
    await page.addInitScript(() => {
      if (window !== window.top) return;
      const store: string[] = ((window as any).__hostViolations = []);
      document.addEventListener('securitypolicyviolation', (event) =>
        store.push(`${event.violatedDirective} ${event.blockedURI}`),
      );
    });
    await stubFramePrint(page);
    await openPage(page, '/controls/table-export', 'Table export');
    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute('content');
    expect(policy).toContain("style-src 'self';");
    expect(policy).not.toMatch(/style-src[^;]*unsafe-inline/);
    const hostBefore = await page.evaluate(() => (window as any).__hostViolations.length);
    await example(page, HEADING).getByRole('button', { name: BUTTON }).click();
    const captured = await readCaptured(page);
    const hostAfter = await page.evaluate(() => (window as any).__hostViolations.slice());

    // Before: the style element of the frame was blocked and the table was plain. Now the
    // document has no style element and no style attribute, and its sheets are constructed.
    expect(captured.violations).toEqual([]);
    expect(hostAfter.length).toBe(hostBefore);
    expect(captured.styleElements).toBe(0);
    expect(captured.styleAttributes).toBe(0);
    expect(captured.adoptedSheets).toBeGreaterThanOrEqual(1);
    expect(captured.borderCollapse).toBe('collapse');
    expect(captured.rowBreakInside).toBe('avoid');
    expect(captured.cellBorder).toBe('1px');
    expect(captured.html).toContain('INV-0240');
    // The fit rules use the same way: they are in the sheets, not in a style element.
    expect(captured.html).toContain('@container');

    // The PDF of the same rules has the header fill (#eeeeee) and all rows. Without the rules
    // the same document has no fill.
    const context = page.context();
    const pages = await renderPdf(context, captured.html, A4_PORTRAIT);
    expect(new Set(pages.flatMap((pdfPage) => [...pdfPage.fillColors])).has('#eeeeee')).toBe(true);
    expect(firstColumn(pages, INVOICE_ID)).toEqual(allInvoiceIds);
    const plain = captured.html.replace(/<style>[\s\S]*?<\/style>/, '');
    const unstyled = await renderPdf(context, plain, A4_PORTRAIT);
    expect(new Set(unstyled.flatMap((pdfPage) => [...pdfPage.fillColors])).has('#eeeeee')).toBe(
      false,
    );
  });

  test('without constructed style sheets the frame gets a style element, which a strict policy blocks', async ({
    page,
  }) => {
    await removeUnsafeInline(page);
    // The fallback path: a frame window without constructed style sheets.
    await page.addInitScript(() => {
      if (window === window.top) return;
      delete (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync;
    });
    const captured = await capture(page, BUTTON, HEADING);
    expect(captured.adoptedSheets).toBe(0);
    expect(captured.styleElements).toBeGreaterThanOrEqual(1);
    expect(captured.violations).toContain('style-src-elem');
    expect(captured.html).toContain('INV-0240');
    expect(captured.borderCollapse).toBe('separate');
  });

  test('without constructed style sheets the style element works under the policy of the docs', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (window === window.top) return;
      delete (CSSStyleSheet.prototype as { replaceSync?: unknown }).replaceSync;
    });
    const captured = await capture(page, BUTTON, HEADING);
    expect(captured.adoptedSheets).toBe(0);
    expect(captured.violations).toEqual([]);
    expect(captured.borderCollapse).toBe('collapse');
    expect(captured.cellBorder).toBe('1px');
  });
});

test.describe('table print: alignment of formatted numbers', () => {
  let printout: Printout;
  test.beforeAll(async ({ browser }) => {
    printout = await openPrintout(browser, 'Print parts', 'Print formatted numbers');
  });
  test.afterAll(async () => {
    await printout.context.close();
  });

  test('the cells of the number columns are strings, because of the format function', () => {
    expect(printout.captured.headers).toEqual(['Code', 'Part', 'Zone', 'Stock', 'Price']);
    expect(printout.captured.rows[0]).toEqual([
      'PRT-100',
      'Steel bolt',
      'North',
      '1,250 pcs',
      '$0.35',
    ]);
  });

  test('aligns the columns by the column definition, headers included', async () => {
    const pages = await printout.pdf(A4_PORTRAIT);
    expect(pages).toHaveLength(1);
    const header = pages[0].lines[headerLineIndex(pages[0], printout.captured.headers)];
    const head = Object.fromEntries(header.items.map((item) => [item.str, item]));
    const rows = pages[0].lines.filter((line) => /^PRT-/.test(line.items[0].str));
    expect(rows).toHaveLength(4);
    const column = (index: number) => rows.map((line) => line.items[index]);
    const spread = (values: number[]) => Math.max(...values) - Math.min(...values);

    // Stock: a number column without align. Right edges are equal, left edges differ.
    const stock = column(3);
    expect(stock.map((item) => item.str)).toEqual(['1,250 pcs', '48 pcs', '9 pcs', '305 pcs']);
    expect(spread(stock.map((item) => item.right))).toBeLessThan(SLACK);
    expect(spread(stock.map((item) => item.x))).toBeGreaterThan(5);
    expect(head['Stock'].right).toBeCloseTo(stock[0].right, 0);
    // Price: align 'end'.
    const price = column(4);
    expect(price.map((item) => item.str)).toEqual(['$0.35', '$12.50', '$120.00', '$7.75']);
    expect(spread(price.map((item) => item.right))).toBeLessThan(SLACK);
    expect(spread(price.map((item) => item.x))).toBeGreaterThan(5);
    expect(head['Price'].right).toBeCloseTo(price[0].right, 0);
    // Zone: align 'center'. The middle of every cell is the middle of the header.
    const middle = (item: PdfItem) => (item.x + item.right) / 2;
    for (const item of column(2)) {
      expect(Math.abs(middle(item) - middle(head['Zone']))).toBeLessThan(1);
    }
    expect(spread(column(2).map((item) => item.x))).toBeGreaterThan(2);
    // A text column stays at the start.
    expect(spread(column(1).map((item) => item.x))).toBeLessThan(SLACK);
    expect(head['Part'].x).toBeCloseTo(column(1)[0].x, 0);
  });
});

test.describe('table print: language and direction', () => {
  test('sets lang from the page, and dir', async ({ page }) => {
    const captured = await capture(page, 'Print invoices', 'Print a long table');
    expect(captured.lang).toBe(await page.locator('html').getAttribute('lang'));
    expect(captured.lang).toBeTruthy();
    expect(captured.dir).toBe('ltr');
    expect(captured.html).toMatch(/^<!doctype html><html lang="[^"]+" dir="ltr">/);
  });

  test('takes the nearest lang of the table, before the lang of the page', async ({ page }) => {
    await stubFramePrint(page);
    await openPage(page, '/controls/table-export', 'Table export');
    const live = example(page, 'Print a long table');
    await live.locator('star-table').evaluate((table) => table.setAttribute('lang', 'fr-CA'));
    await live.getByRole('button', { name: 'Print invoices' }).click();
    const captured = await readCaptured(page);
    expect(captured.lang).toBe('fr-CA');
    expect(await page.locator('html').getAttribute('lang')).not.toBe('fr-CA');
  });

  test.describe('right-to-left', () => {
    let printout: Printout;
    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      await context.addInitScript(() => localStorage.setItem('star-direction', 'rtl'));
      const page = await context.newPage();
      const captured = await capture(page, 'Print invoices', 'Print a long table');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await page.close();
      printout = new Printout(context, captured);
    });
    test.afterAll(async () => {
      await printout.context.close();
    });

    test('the printout is right-to-left', () => {
      expect(printout.captured.dir).toBe('rtl');
      expect(printout.captured.html).toContain('dir="rtl"');
    });

    test('puts the first column on the right, text at the start and numbers at the end', async () => {
      const pages = await printout.pdf(A4_PORTRAIT);
      const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
      const head: Record<string, PdfItem> = {};
      const invoice: PdfItem[] = [];
      const customer: PdfItem[] = [];
      const quantity: PdfItem[] = [];
      const amount: PdfItem[] = [];
      for (const page of pages) {
        const header = page.lines.find(
          (line) =>
            line.items.length === INVOICE_HEADERS.length &&
            INVOICE_HEADERS.every((name) => line.items.some((item) => item.str === name)),
        )!;
        for (const item of header.items) head[item.str] = item;
        for (const line of page.lines) {
          // The invoice number is the rightmost item of its line in right-to-left.
          const first = line.items[line.items.length - 1];
          if (!INVOICE_ID.test(first.str)) continue;
          invoice.push(first);
          // The customer is the item next to the invoice number (a name can wrap in two lines).
          customer.push(line.items[line.items.length - 2]);
          quantity.push(...line.items.filter((item) => /^[1-9]$/.test(item.str)));
          amount.push(...line.items.filter((item) => /^\d{2,}(\.\d+)?$/.test(item.str)));
        }
      }
      expect(invoice.map((item) => item.str)).toEqual(allInvoiceIds);
      // The column order is mirrored: the first column is the rightmost.
      const xs = INVOICE_HEADERS.map((name) => head[name].x);
      expect(xs).toEqual([...xs].sort((a, b) => b - a));
      // Text columns are at the start of the line, on the right: right edges are equal.
      expect(spread(invoice.map((item) => item.right))).toBeLessThan(SLACK);
      expect(customer).toHaveLength(240);
      expect(spread(customer.map((item) => item.right))).toBeLessThan(SLACK);
      expect(spread(customer.map((item) => item.x))).toBeGreaterThan(5);
      expect(head['Customer'].right).toBeCloseTo(customer[0].right, 0);
      // Number columns are at the end of the line, on the left: left edges are equal.
      for (const [name, items] of [
        ['Quantity', quantity],
        ['Amount', amount],
      ] as const) {
        expect(items, name).toHaveLength(240);
        expect(spread(items.map((item) => item.x)), name).toBeLessThan(SLACK);
        expect(head[name].x, name).toBeCloseTo(items[0].x, 0);
      }
      expect(spread(amount.map((item) => item.right))).toBeGreaterThan(5);
      expectInsidePage(pages);
    });
  });
});
