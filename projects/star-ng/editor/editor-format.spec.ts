import {
  starEditorClearFormat,
  starEditorFontSizeAt,
  starEditorIndentBlocks,
  starEditorInsertRule,
  starEditorIsolate,
  starEditorSetStyle,
  starEditorStyleAt,
  starEditorTextNodes,
  starEditorToggleScript,
} from './editor-format';

function area(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

/** A range over `text` (a text node) from `start` to `end`, also the document selection. */
function rangeOver(text: Node, start: number, end: number, endNode: Node = text): Range {
  const range = document.createRange();
  range.setStart(text, start);
  range.setEnd(endNode, end);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

afterEach(() => document.body.replaceChildren());

describe('starEditorTextNodes and starEditorIsolate', () => {
  it('splits the text at the ends of the range', () => {
    const el = area('<p>Orders shipped today</p>');
    const text = el.querySelector('p')!.firstChild!;
    const range = rangeOver(text, 7, 14);
    const nodes = starEditorTextNodes(el, range);
    expect(nodes.map((n) => n.data)).toEqual(['shipped']);
    expect(el.querySelector('p')!.childNodes.length).toBe(3);
  });

  it('returns nothing for a caret', () => {
    const el = area('<p>Orders</p>');
    expect(starEditorTextNodes(el, rangeOver(el.querySelector('p')!.firstChild!, 2, 2))).toEqual(
      [],
    );
  });

  it('isolates a node in copies of its ancestor', () => {
    const el = area('<p><b>one two three</b></p>');
    const b = el.querySelector('b')!;
    const mid = (b.firstChild as Text).splitText(4);
    mid.splitText(3);
    starEditorIsolate(mid, b);
    expect(el.innerHTML).toBe('<p><b>one </b><b>two</b><b> three</b></p>');
  });
});

describe('starEditorSetStyle', () => {
  it('sets a color on the selection and keeps the rest', () => {
    const el = area('<p>Orders shipped today</p>');
    starEditorSetStyle(
      el,
      rangeOver(el.querySelector('p')!.firstChild!, 7, 14),
      'color',
      'var(--star-danger)',
    );
    expect(el.innerHTML).toBe(
      '<p>Orders <span style="color: var(--star-danger);">shipped</span> today</p>',
    );
    expect(document.getSelection()!.toString()).toBe('shipped');
  });

  it('changes and removes the color of part of a span', () => {
    const el = area('<p><span style="color: red;">Orders shipped</span></p>');
    const text = el.querySelector('span')!.firstChild!;
    starEditorSetStyle(el, rangeOver(text, 7, 14), 'color', 'blue');
    expect(el.innerHTML).toBe(
      '<p><span style="color: red;">Orders </span><span style="color: blue;">shipped</span></p>',
    );
    const blue = el.querySelectorAll('span')[1].firstChild!;
    starEditorSetStyle(el, rangeOver(blue, 0, 7), 'color', null);
    expect(el.innerHTML).toBe('<p><span style="color: red;">Orders </span>shipped</p>');
  });

  it('keeps other styles of a span', () => {
    const el = area('<p><span style="color: red; font-size: 2em;">Big</span></p>');
    starEditorSetStyle(el, rangeOver(el.querySelector('span')!.firstChild!, 0, 3), 'color', null);
    expect(el.innerHTML).toBe('<p><span style="font-size: 2em;">Big</span></p>');
    expect(starEditorFontSizeAt(el.querySelector('span')!.firstChild, el)).toBe('largest');
  });

  it('puts a caret holder in a styled span for a collapsed selection', () => {
    const el = area('<p>Orders</p>');
    starEditorSetStyle(
      el,
      rangeOver(el.querySelector('p')!.firstChild!, 6, 6),
      'background-color',
      'yellow',
    );
    expect(el.querySelector('span')!.getAttribute('style')).toBe('background-color: yellow;');
    expect(starEditorStyleAt(document.getSelection()!.anchorNode, el, 'background-color')).toBe(
      'yellow',
    );
  });
});

describe('starEditorToggleScript', () => {
  it('wraps the selection in sub, replaces sup, and unwraps again', () => {
    const el = area('<p>H2O</p>');
    starEditorToggleScript(el, rangeOver(el.querySelector('p')!.firstChild!, 1, 2), 'SUP');
    expect(el.innerHTML).toBe('<p>H<sup>2</sup>O</p>');
    starEditorToggleScript(el, rangeOver(el.querySelector('sup')!.firstChild!, 0, 1), 'SUB');
    expect(el.innerHTML).toBe('<p>H<sub>2</sub>O</p>');
    starEditorToggleScript(el, rangeOver(el.querySelector('sub')!.firstChild!, 0, 1), 'SUB');
    expect(el.innerHTML).toBe('<p>H2O</p>');
  });
});

describe('starEditorClearFormat', () => {
  it('removes inline formats and alignment, and keeps links', () => {
    const el = area(
      '<p class="star-text-center" style="margin-inline-start: 2.5rem;"><b>Bold <a href="/a"><i>link</i></a></b> <span style="color: red;">red</span></p>',
    );
    const p = el.querySelector('p')!;
    const range = document.createRange();
    range.selectNodeContents(p);
    starEditorClearFormat(el, range);
    expect(el.innerHTML).toBe('<p>Bold <a href="/a">link</a> red</p>');
  });
});

describe('starEditorIndentBlocks and starEditorInsertRule', () => {
  it('indents in steps and back to none', () => {
    const el = area('<p>One</p>');
    const p = el.querySelector('p')!;
    starEditorIndentBlocks([p], 1);
    starEditorIndentBlocks([p], 1);
    expect(p.getAttribute('style')).toBe('margin-inline-start: 5rem;');
    starEditorIndentBlocks([p], -1);
    starEditorIndentBlocks([p], -1);
    starEditorIndentBlocks([p], -1);
    expect(p.hasAttribute('style')).toBe(false);
  });

  it('inserts a rule after the block, outside a list, with a paragraph after it', () => {
    const el = area('<ul><li>One</li></ul><p>Two</p>');
    starEditorInsertRule(el, rangeOver(el.querySelector('li')!.firstChild!, 1, 1));
    expect(el.innerHTML).toBe('<ul><li>One</li></ul><hr><p><br></p><p>Two</p>');
  });
});
