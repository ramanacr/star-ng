import { buildPrintDocument } from './table-export';

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
