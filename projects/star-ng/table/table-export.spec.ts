import {
  addPrintStyle,
  buildPrintDocument,
  fitPrintDocument,
  PRINT_FIT_STEPS,
  PRINT_STYLE,
  printColumnAlign,
  printContext,
  printFitStyle,
  stylePrintDocument,
} from './table-export';

/** Parses the print document the way the browser does, to inspect it as a tree. */
function parse(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('buildPrintDocument', () => {
  it('has one title heading, a header row in thead and one tr per row', () => {
    const doc = parse(
      buildPrintDocument(
        'Orders',
        ['Order', 'Total'],
        [
          ['A-1', 1],
          ['A-2', 2],
          ['A-3', 3],
        ],
      ),
    );
    expect(doc.querySelectorAll('h1')).toHaveLength(1);
    expect(doc.querySelector('h1')?.textContent).toBe('Orders');
    expect(doc.querySelectorAll('thead tr')).toHaveLength(1);
    expect(doc.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('aligns the header of a column of numbers to the right, like its cells', () => {
    const doc = parse(
      buildPrintDocument(
        'Orders',
        ['Order', 'Total'],
        [
          ['A-1', 12.5],
          ['A-2', 3],
        ],
      ),
    );
    const headers = [...doc.querySelectorAll('th')];
    expect(headers[0].classList.contains('e')).toBe(false);
    expect(headers[1].classList.contains('e')).toBe(true);
    expect(doc.querySelectorAll('td.e')).toHaveLength(2);
    expect(PRINT_STYLE).toContain('th.e,td.e{text-align:end}');
  });

  it('keeps the header of a mixed or empty column to the left', () => {
    const doc = parse(
      buildPrintDocument(
        'Mixed',
        ['Text', 'Mixed', 'Empty'],
        [
          ['a', 1, ''],
          ['b', 'two', ''],
        ],
      ),
    );
    expect([...doc.querySelectorAll('th')].map((th) => th.classList.contains('e'))).toEqual([
      false,
      false,
      false,
    ]);
    // A table without rows has no number column.
    const none = parse(buildPrintDocument('None', ['Total'], []));
    expect(none.querySelector('th')?.classList.contains('e')).toBe(false);
  });

  it('gives a long unbroken word soft break points, and keeps its text', () => {
    const word = 'Q2FsY3VsYXRlZC1mcm9tLXRoZS1zaWduZWQ=';
    const doc = parse(buildPrintDocument('Long', ['Note'], [['Signature ' + word + ' end']]));
    const cell = doc.querySelector('td')!;
    // 36 characters in pieces of 12: two break points. The text itself does not change.
    expect(cell.querySelectorAll('wbr')).toHaveLength(2);
    expect(cell.textContent).toBe('Signature ' + word + ' end');
  });

  it('does not touch words up to 20 characters, such as codes and names', () => {
    const doc = parse(
      buildPrintDocument('Short', ['Code'], [['INV-0001', 'Warehouse scanner', 'x'.repeat(20)]]),
    );
    expect(doc.querySelectorAll('wbr')).toHaveLength(0);
  });

  it('escapes each piece of a long word, so an entity is never cut', () => {
    const word = '&'.repeat(30);
    const doc = parse(buildPrintDocument('Entities', ['Note'], [[word]]));
    expect(doc.querySelector('td')?.textContent).toBe(word);
    expect(doc.querySelectorAll('wbr')).toHaveLength(2);
  });

  it('does not let the style shrink a column to one character', () => {
    // overflow-wrap:anywhere would, and the longest cell text would take the table width.
    const css = PRINT_STYLE;
    expect(css).not.toMatch(/th,td{[^}]*overflow-wrap:anywhere/);
    expect(css).toMatch(/th,td{[^}]*overflow-wrap:break-word/);
  });

  it('never wraps a cell of one short word, so a code or a date is not cut at a hyphen', () => {
    const doc = parse(
      buildPrintDocument(
        'Codes',
        ['Code', 'Text', 'Long'],
        [['INV-0001', 'Warehouse scanner', 'x'.repeat(21)]],
      ),
    );
    const cells = [...doc.querySelectorAll('td')];
    expect(cells.map((cell) => cell.classList.contains('s'))).toEqual([true, false, false]);
    expect(PRINT_STYLE).toContain('td.s{white-space:nowrap}');
  });

  it('escapes markup in the title, the headers and the cells', () => {
    const doc = parse(buildPrintDocument('<b>T</b>', ['<i>H</i>'], [['<script>1</script>']]));
    expect(doc.querySelector('h1')?.textContent).toBe('<b>T</b>');
    expect(doc.querySelector('th')?.textContent).toBe('<i>H</i>');
    expect(doc.querySelector('td')?.textContent).toBe('<script>1</script>');
    expect(doc.querySelector('script')).toBeNull();
  });
});

describe('print fit', () => {
  it('puts the table in a wrapper that a container query can measure', () => {
    const doc = parse(buildPrintDocument('Wrapped', ['A'], [['a']]));
    expect(doc.querySelector('div.fit > table')).not.toBeNull();
    expect(PRINT_STYLE).toContain('.fit{container-type:inline-size}');
  });

  it('has the steps in a fixed order: wrap, smaller text down to 6 pt, then break words', () => {
    expect(PRINT_FIT_STEPS.map((step) => step.size)).toEqual([12, 12, 11, 10, 9, 8, 8]);
    expect(PRINT_FIT_STEPS.map((step) => step.wrap)).toEqual([
      false,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
    expect(PRINT_FIT_STEPS.map((step) => step.anywhere)).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
    // 8 px are 6 pt: the floor of the text size.
    expect(Math.min(...PRINT_FIT_STEPS.map((step) => step.size)) * 0.75).toBe(6);
  });

  it('applies each step below the minimum width of the step before it', () => {
    const css = printFitStyle([1000, 900, 800, 700, 600, 500, 200]);
    const queries = [...css.matchAll(/@container \(width < (\d+)px\)/g)].map((m) => Number(m[1]));
    expect(queries).toEqual([1000, 900, 800, 700, 600, 500]);
    // Step 1 wraps the short words; the last step breaks words; the sizes follow the steps.
    expect(css.indexOf('td.s{white-space:normal}')).toBeGreaterThan(-1);
    expect(css.indexOf('font-size:11px')).toBeGreaterThan(css.indexOf('width < 900px'));
    expect(css.lastIndexOf('font-size:8px')).toBeGreaterThan(css.indexOf('width < 500px'));
    expect(css).toMatch(/width < 500px\)\{table\{font-size:8px[^}]*\}[^@]*overflow-wrap:anywhere/);
    // Padding shrinks with the text: 4 px by 8 px at 12 px, 2.67 px by 5.33 px at 8 px.
    expect(css).toContain('padding:2.67px 5.33px');
    // Step 1 keeps the text size (12 px) and only wraps; step 0, the table as it is built, has no rule.
    expect(css.startsWith('@container (width < 1000px){table{font-size:12px}')).toBe(true);
  });

  it('leaves out a step that is not narrower, and has no rule when no step helps', () => {
    expect(printFitStyle([800, 800, 800, 800, 800, 800, 800])).toBe('');
    expect(printFitStyle([])).toBe('');
    const css = printFitStyle([800, 800, 700, 700, 650, 650, 100]);
    expect(
      [...css.matchAll(/@container \(width < (\d+)px\)/g)].map((match) => Number(match[1])),
    ).toEqual([800, 700, 650]);
    // Each step that is used waits for the narrowest step before it: 11 px (700), 9 px (650), 8 px.
    expect(css).toContain('font-size:11px');
    expect(css).toContain('font-size:9px');
    expect(css).toContain('font-size:8px');
    expect(css).not.toContain('font-size:12px');
    expect(css).not.toContain('font-size:10px');
  });

  it('shares the width of the last step between the columns by their longest word', () => {
    const css = printFitStyle([1000, 900, 800, 700, 600, 500, 200], [10, 30, 60]);
    expect(css).toContain('table{font-size:8px;table-layout:fixed}');
    expect(css).toContain('table th{box-sizing:border-box}');
    expect(css).toContain('table th:nth-child(1){width:10%}');
    expect(css).toContain('table th:nth-child(2){width:30%}');
    expect(css).toContain('table th:nth-child(3){width:60%}');
    // The shares never add up to more than the table width.
    const shares = [...css.matchAll(/nth-child\(\d+\)\{width:([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(shares.reduce((sum, share) => sum + share, 0)).toBeLessThanOrEqual(100);
    const thirds = printFitStyle([100, 90, 80, 70, 60, 50, 20], [1, 1, 1]);
    const third = [...thirds.matchAll(/\{width:([\d.]+)%/g)].map((m) => Number(m[1]));
    expect(third).toEqual([33.33, 33.33, 33.33]);
    // Without column widths the last step keeps the automatic layout.
    expect(printFitStyle([1000, 900, 800, 700, 600, 500, 200])).not.toContain('table-layout');
  });

  describe('fitPrintDocument', () => {
    afterEach(() => vi.restoreAllMocks());

    /** A layout of the table that depends on the probe style: wider text, wider table. */
    function stubLayout(doc: Document, widthOf: (probe: string) => number) {
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        const probe = doc.head.querySelector('style:last-of-type')?.textContent ?? '';
        const width = this.tagName === 'TABLE' ? widthOf(probe) : widthOf(probe) / 4;
        return { width } as DOMRect;
      });
    }

    it('measures the table at every step, adds the query style and removes its probe', () => {
      const doc = parse(buildPrintDocument('Orders', ['Order', 'Total'], [['A-1', 1]]));
      stylePrintDocument(doc);
      // Wider for bigger text, narrower when the short words may wrap, as the engine would.
      stubLayout(doc, (probe) => {
        const size = Number(/font-size:(\d+)px/.exec(probe)?.[1] ?? 12);
        const wrap = probe.includes('white-space:normal') ? 0.9 : 1;
        const anywhere = probe.includes('overflow-wrap:anywhere') ? 0.2 : 1;
        return Math.round(size * 100 * wrap * anywhere);
      });
      const { widths, columns } = fitPrintDocument(doc);
      expect(widths).toEqual([1200, 1080, 990, 900, 810, 720, 144]);
      // The columns are read at the last step that keeps words whole (8 px, wrapped): 720 / 4.
      expect(columns).toEqual([180, 180]);
      const styles = [...doc.head.querySelectorAll('style')];
      // The base style and the style with the queries; the probe is gone.
      expect(styles).toHaveLength(2);
      expect(styles[1].textContent).toContain('@container (width < 1200px)');
      expect(styles[1].textContent).toContain('table th:nth-child(2){width:50%}');
    });

    it('adds no style when the table is no wider at any step', () => {
      const doc = parse(buildPrintDocument('Orders', ['Order'], [['A-1']]));
      stylePrintDocument(doc);
      stubLayout(doc, () => 300);
      expect(fitPrintDocument(doc).widths).toEqual(Array(PRINT_FIT_STEPS.length).fill(300));
      expect(doc.head.querySelectorAll('style')).toHaveLength(1);
    });

    it('does nothing for a document without a table', () => {
      const doc = parse('<!doctype html><title>x</title><p>none</p>');
      expect(fitPrintDocument(doc)).toEqual({ widths: [], columns: [] });
      expect(doc.head.querySelectorAll('style')).toHaveLength(0);
    });
  });
});

describe('print document without inline style', () => {
  it('has no style element and no style attribute, whatever the content', () => {
    const html = buildPrintDocument(
      'Orders',
      ['Order', 'Total', 'Zone'],
      [['A-1', 12.5, 'North']],
      {
        align: ['start', 'end', 'center'],
        lang: 'fr',
        dir: 'rtl',
      },
    );
    const doc = parse(html);
    expect(doc.querySelectorAll('style')).toHaveLength(0);
    expect(doc.querySelectorAll('[style]')).toHaveLength(0);
    expect(html).not.toMatch(/<style|\sstyle=/i);
  });

  it('has a base style with logical alignment, for right-to-left', () => {
    expect(PRINT_STYLE).toContain('text-align:start');
    expect(PRINT_STYLE).toContain('th.c,td.c{text-align:center}');
    expect(PRINT_STYLE).toContain('th.e,td.e{text-align:end}');
    expect(PRINT_STYLE).not.toMatch(/text-align:(left|right)/);
  });
});

describe('print column alignment', () => {
  it('takes the alignment from the column, not from the type of the printed text', () => {
    const doc = parse(
      buildPrintDocument(
        'Parts',
        ['Part', 'Stock', 'Price', 'Zone'],
        [
          ['Bolt', '12 pcs', '$1.50', 'A'],
          ['Nut', '8 pcs', '$0.75', 'B'],
        ],
        { align: ['start', 'end', 'end', 'center'] },
      ),
    );
    const classes = (selector: string) =>
      [...doc.querySelectorAll(selector)].map((cell) => cell.getAttribute('class') ?? '');
    // The cells hold text, but the columns are right-aligned (and centered): so are the headers.
    expect(classes('th')).toEqual(['', 'e', 'e', 'c']);
    // A cell of one short word also has the class `s`: "12 pcs" has two words.
    expect(classes('tbody tr:first-child td')).toEqual(['s', 'e', 'e s', 'c s']);
    expect(classes('tbody tr:last-child td')).toEqual(['s', 'e', 'e s', 'c s']);
  });

  it('lets an explicit start alignment win over number cells', () => {
    const doc = parse(buildPrintDocument('Ids', ['Id'], [[1], [2]], { align: ['start'] }));
    expect(doc.querySelector('th')?.hasAttribute('class')).toBe(false);
    expect(doc.querySelector('td')?.hasAttribute('class')).toBe(false);
  });

  describe('printColumnAlign', () => {
    it('uses an explicit align first', () => {
      expect(printColumnAlign('end', ['a'])).toBe('end');
      expect(printColumnAlign('center', [1, 2])).toBe('center');
      expect(printColumnAlign('start', [1, 2])).toBe('start');
    });

    it('puts a column in which every value is a number at the end', () => {
      expect(printColumnAlign(undefined, [1, 2.5, 0])).toBe('end');
    });

    it('keeps mixed, text, empty and missing values at the start', () => {
      expect(printColumnAlign(undefined, [1, 'two'])).toBe('start');
      expect(printColumnAlign(undefined, ['a'])).toBe('start');
      expect(printColumnAlign(undefined, [1, null])).toBe('start');
      expect(printColumnAlign(undefined, [])).toBe('start');
    });
  });
});

describe('print language and direction', () => {
  function tree(markup: string): { root: Document; leaf: Element } {
    const root = parse(`<!doctype html><html${markup}`);
    return { root, leaf: root.querySelector('#leaf')! };
  }

  it('puts lang and dir on the html element, escaped', () => {
    const doc = parse(buildPrintDocument('T', ['A'], [['a']], { lang: 'ar-EG', dir: 'rtl' }));
    expect(doc.documentElement.getAttribute('lang')).toBe('ar-EG');
    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
    const odd = parse(buildPrintDocument('T', ['A'], [['a']], { lang: 'x"><b>' }));
    expect(odd.documentElement.getAttribute('lang')).toBe('x"><b>');
    expect(odd.querySelector('b')).toBeNull();
  });

  it('adds no attribute when there is none to give', () => {
    const doc = parse(buildPrintDocument('T', ['A'], [['a']]));
    expect(doc.documentElement.hasAttribute('lang')).toBe(false);
    expect(doc.documentElement.hasAttribute('dir')).toBe(false);
  });

  it('takes the nearest lang and dir of the table', () => {
    const { root, leaf } = tree(
      ' lang="en" dir="ltr"><body><section lang="de"><div dir="rtl"><p id="leaf"></p></div></section></body></html>',
    );
    expect(printContext(leaf, root)).toEqual({ lang: 'de', dir: 'rtl' });
  });

  it('starts at the element itself', () => {
    const { root, leaf } = tree(
      ' lang="en"><body><p id="leaf" lang="fr" dir="rtl"></p></body></html>',
    );
    expect(printContext(leaf, root)).toEqual({ lang: 'fr', dir: 'rtl' });
  });

  it('falls back to the document, and to nothing', () => {
    const withRoot = tree(' lang="es" dir="rtl"><body><p id="leaf"></p></body></html>');
    expect(printContext(withRoot.leaf, withRoot.root)).toEqual({ lang: 'es', dir: 'rtl' });
    const bare = tree('><body><p id="leaf"></p></body></html>');
    expect(printContext(bare.leaf, bare.root)).toEqual({});
    expect(printContext(null, withRoot.root)).toEqual({ lang: 'es', dir: 'rtl' });
  });

  it('skips an empty lang, a dir of auto and an unusable lang', () => {
    const { root, leaf } = tree(
      ' lang="en" dir="ltr"><body><div lang="" dir="auto"><p id="leaf" lang="a b"></p></div></body></html>',
    );
    expect(printContext(leaf, root)).toEqual({ lang: 'en', dir: 'ltr' });
    const upper = tree('><body><p id="leaf" dir="RTL"></p></body></html>');
    expect(printContext(upper.leaf, upper.root)).toEqual({ dir: 'rtl' });
  });
});

describe('addPrintStyle', () => {
  afterEach(() => vi.restoreAllMocks());

  type Sheets = { text: string }[];

  it('falls back to a style element where there are no constructed style sheets', () => {
    const doc = parse('<!doctype html><title>x</title>');
    const style = addPrintStyle(doc, 'a{color:red}');
    expect(doc.head.querySelector('style')?.textContent).toBe('a{color:red}');
    style.set('b{color:blue}');
    expect(doc.head.querySelector('style')?.textContent).toBe('b{color:blue}');
    style.remove();
    expect(doc.head.querySelector('style')).toBeNull();
  });

  /** A document of a window that has constructed style sheets, as the frame of Chromium has. */
  function documentWithSheets(sheet?: new () => unknown) {
    class FakeSheet {
      text = '';
      replaceSync(text: string) {
        this.text = text;
      }
    }
    const doc = parse('<!doctype html><title>x</title>');
    Object.defineProperty(doc, 'defaultView', { value: { CSSStyleSheet: sheet ?? FakeSheet } });
    Object.defineProperty(doc, 'adoptedStyleSheets', { value: [], writable: true });
    return doc as Document & { adoptedStyleSheets: unknown[] };
  }

  it('adopts a constructed sheet of the realm of the document, and no style element', () => {
    const doc = documentWithSheets();
    stylePrintDocument(doc);
    expect((doc.adoptedStyleSheets as Sheets).map((sheet) => sheet.text)).toEqual([PRINT_STYLE]);
    expect(doc.querySelectorAll('style')).toHaveLength(0);
  });

  it('keeps the order of the sheets, changes a sheet and removes only that sheet', () => {
    const doc = documentWithSheets();
    const first = addPrintStyle(doc, 'a{}');
    const second = addPrintStyle(doc, 'b{}');
    const texts = () => (doc.adoptedStyleSheets as Sheets).map((sheet) => sheet.text);
    expect(texts()).toEqual(['a{}', 'b{}']);
    first.set('c{}');
    expect(texts()).toEqual(['c{}', 'b{}']);
    second.remove();
    expect(texts()).toEqual(['c{}']);
  });

  it('falls back to a style element when a constructed sheet cannot be made', () => {
    const doc = documentWithSheets(
      class {
        replaceSync(): void {
          throw new Error('not allowed');
        }
      },
    );
    addPrintStyle(doc, 'a{}');
    expect(doc.querySelector('style')?.textContent).toBe('a{}');
    expect(doc.adoptedStyleSheets).toHaveLength(0);
  });

  it('measures with constructed sheets and leaves the base sheet and one sheet of queries', () => {
    const doc = documentWithSheets();
    doc.body.innerHTML =
      '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>';
    stylePrintDocument(doc);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(() => {
      const sheets = doc.adoptedStyleSheets as Sheets;
      const size = Number(/font-size:(\d+)px/.exec(sheets[sheets.length - 1].text)?.[1] ?? 12);
      return { width: size * 50 } as DOMRect;
    });
    fitPrintDocument(doc);
    const texts = (doc.adoptedStyleSheets as Sheets).map((sheet) => sheet.text);
    // The base sheet and the sheet with the queries. The probe is gone, no style element exists.
    expect(texts).toHaveLength(2);
    expect(texts[0]).toBe(PRINT_STYLE);
    expect(texts[1]).toContain('@container (width < 600px)');
    expect(doc.querySelectorAll('style')).toHaveLength(0);
  });
});
