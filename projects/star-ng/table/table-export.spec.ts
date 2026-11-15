import {
  buildPrintDocument,
  fitPrintDocument,
  PRINT_FIT_STEPS,
  printFitStyle,
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
    expect(headers[0].classList.contains('n')).toBe(false);
    expect(headers[1].classList.contains('n')).toBe(true);
    expect(doc.querySelectorAll('td.n')).toHaveLength(2);
    expect(doc.querySelector('style')?.textContent).toContain('th.n,td.n{text-align:right}');
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
    expect([...doc.querySelectorAll('th')].map((th) => th.classList.contains('n'))).toEqual([
      false,
      false,
      false,
    ]);
    // A table without rows has no number column.
    const none = parse(buildPrintDocument('None', ['Total'], []));
    expect(none.querySelector('th')?.classList.contains('n')).toBe(false);
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
    const css = parse(buildPrintDocument('Any', ['A'], [['a']])).querySelector(
      'style',
    )!.textContent!;
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
    expect(doc.querySelector('style')?.textContent).toContain('td.s{white-space:nowrap}');
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
    expect(doc.querySelector('style')?.textContent).toContain('.fit{container-type:inline-size}');
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
