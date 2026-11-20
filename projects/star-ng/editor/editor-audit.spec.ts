import { starEditorAudit, starEditorContrast } from './editor-audit';

function area(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

afterEach(() => document.body.replaceChildren());

describe('starEditorAudit', () => {
  it('finds the problems in reading order and fixes them', () => {
    const el = area(
      '<h1>Release</h1><h3>Plans</h3><p><img src="a.png"> <a href="/x"></a> <span style="color: #dddddd">pale</span> <span style="color: #c62828">red</span></p><table><tbody><tr><td>A</td></tr></tbody></table>',
    );
    const issues = starEditorAudit(el);
    expect(issues.map((issue) => [issue.kind, issue.detail])).toEqual([
      ['heading', [1, 3]],
      ['alt', []],
      ['emptyLink', []],
      ['contrast', [1.4]],
      ['tableHeader', []],
    ]);
    for (const issue of issues) issue.fix();
    expect(el.innerHTML).toBe(
      '<h1>Release</h1><h2>Plans</h2><p><img src="a.png" alt="">  pale <span style="color: #c62828">red</span></p><table><thead><tr><th scope="col">A</th></tr></thead></table>',
    );
    expect(starEditorAudit(el)).toEqual([]);
  });

  it('accepts a link with an image that has alternative text, and a first heading 2', () => {
    const el = area('<h2>Start</h2><p><a href="/x"><img src="a.png" alt="Home"></a></p>');
    expect(starEditorAudit(el)).toEqual([]);
  });
});

describe('starEditorContrast', () => {
  it('computes the WCAG ratio', () => {
    expect(starEditorContrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(starEditorContrast('rgb(255, 255, 255)', '#fff')).toBeCloseTo(1, 5);
    expect(starEditorContrast('var(--star-accent)', '#fff')).toBeNull();
  });
});
