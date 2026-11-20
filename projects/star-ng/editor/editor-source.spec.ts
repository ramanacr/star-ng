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
        '  <li>',
        '    Faster reports',
        '    <ul>',
        '      <li>PDF</li>',
        '    </ul>',
        '  </li>',
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
