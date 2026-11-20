import { starEditorFormatHtml, starEditorReadSource, starEditorUnclosed } from './editor-source';

const VALUE =
  '<h2>Release 4.2</h2><p>The <b>new</b>dashboard ships <span style="color: var(--star-accent)">today</span>.</p><ul><li>Faster reports<ul><li>PDF</li></ul></li><li>Saved filters</li></ul><table><tbody><tr><th scope="row">Plan</th><td>Pro</td></tr></tbody></table><pre>  keep\n  this</pre>';

describe('editor source view', () => {
  it('indents blocks and keeps inline content as it is', () => {
    expect(starEditorFormatHtml(VALUE, document)).toBe(
      [
        '<h2>Release 4.2</h2>',
        '<p>The <b>new</b>dashboard ships <span style="color: var(--star-accent)">today</span>.</p>',
        '<ul>',
        '  <li>Faster reports<ul><li>PDF</li></ul></li>',
        '  <li>Saved filters</li>',
        '</ul>',
        '<table>',
        '  <tbody>',
        '    <tr>',
        '      <th scope="row">Plan</th>',
        '      <td>Pro</td>',
        '    </tr>',
        '  </tbody>',
        '</table>',
        '<pre>  keep\n  this</pre>',
      ].join('\n'),
    );
  });

  it('round trips: the source reads back to the same value', () => {
    const result = starEditorReadSource(starEditorFormatHtml(VALUE, document), document);
    expect(result).toEqual({ html: VALUE, changed: false, unclosed: null });
  });

  it('keeps significant white space between inline elements on the round trip', () => {
    for (const value of [
      '<b>a</b> <i>b</i>',
      '<p>x</p> <b>y</b> <i>z</i>',
      '<blockquote><p>a</p> tail <b>x</b></blockquote>',
      '<p>One <b>two</b> <i>three</i> four</p><p> lead and trail </p>',
      '<ul><li><b>a</b> <i>b</i></li><li>c <u>d</u></li></ul>',
      '<pre>  a  <b>b</b>\n\n  c </pre>',
      '<table><tbody><tr><td>a <b>b</b></td></tr></tbody></table>',
    ]) {
      const result = starEditorReadSource(starEditorFormatHtml(value, document), document);
      expect(result.html, value).toBe(value);
      expect(result.changed, value).toBe(false);
    }
  });

  it('drops only the indentation between blocks', () => {
    const source = '<ul>\n  <li>a</li>\n  <li>b</li>\n</ul>\n<p>c</p>';
    expect(starEditorReadSource(source, document).html).toBe(
      '<ul><li>a</li><li>b</li></ul><p>c</p>',
    );
  });

  it('sanitizes the source and migrates legacy tags', () => {
    const result = starEditorReadSource(
      '<p onclick="x()">A</p>\n<center>B</center>\n<script>alert(1)</script>',
      document,
    );
    expect(result.html).toBe('<p>A</p><div class="star-text-center">B</div>');
    expect(result.changed).toBe(true);
  });

  it('finds an element that is not closed', () => {
    expect(starEditorUnclosed('<p>One<p>Two</p>')).toBeNull();
    expect(starEditorUnclosed('<ul><li>One<li>Two</ul>')).toBeNull();
    expect(starEditorUnclosed('<p><b>bold</p>')).toBe('b');
    expect(starEditorUnclosed('<div><p>x</p>')).toBe('div');
    expect(starEditorUnclosed('<p>a<br>b<img src="x"></p>')).toBeNull();
  });
});
