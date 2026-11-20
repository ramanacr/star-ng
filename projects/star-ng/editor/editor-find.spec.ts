import {
  starEditorCounts,
  starEditorFind,
  starEditorInputRule,
  starEditorReplace,
  starEditorReplaceAll,
} from './editor-find';

function area(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

const ANY = { matchCase: false, wholeWord: false };

afterEach(() => document.body.replaceChildren());

describe('starEditorFind', () => {
  it('finds matches across inline formatting but not across blocks', () => {
    const el = area('<p>New <b>dash</b>board and the dashboard</p><p>dash</p><p>board</p>');
    const found = starEditorFind(el, 'dashboard', ANY);
    expect(found.map((range) => range.toString())).toEqual(['dashboard', 'dashboard']);
    expect(starEditorFind(el, 'dashboard', ANY)[0].startContainer.parentElement!.tagName).toBe('B');
    expect(starEditorFind(el, 'dashboardboard', ANY)).toEqual([]);
  });

  it('matches case and whole words when asked', () => {
    const el = area('<p>Report, reports and REPORT</p>');
    expect(starEditorFind(el, 'report', ANY).length).toBe(3);
    expect(starEditorFind(el, 'report', { matchCase: true, wholeWord: false }).length).toBe(1);
    expect(starEditorFind(el, 'report', { matchCase: false, wholeWord: true }).length).toBe(2);
    expect(starEditorFind(el, 'a.d', ANY).length).toBe(0);
    expect(starEditorFind(el, '', ANY)).toEqual([]);
  });

  it('replaces one match and all matches', () => {
    const el = area('<p>Plan A, plan B</p><ul><li>plan C</li></ul>');
    const [first] = starEditorFind(el, 'plan', ANY);
    starEditorReplace(first, 'Tier');
    expect(el.innerHTML).toBe('<p>Tier A, plan B</p><ul><li>plan C</li></ul>');
    expect(starEditorReplaceAll(el, 'plan', 'tier', { matchCase: true, wholeWord: true })).toBe(2);
    expect(el.innerHTML).toBe('<p>Tier A, tier B</p><ul><li>tier C</li></ul>');
  });
});

describe('starEditorCounts', () => {
  it('counts words and characters', () => {
    expect(starEditorCounts(area('<p>The new dashboard</p><p>ships today.</p>'))).toEqual({
      words: 5,
      characters: 29,
    });
    expect(starEditorCounts(area(''))).toEqual({ words: 0, characters: 0 });
  });
});

describe('starEditorInputRule', () => {
  function typedAt(html: string): { el: HTMLElement; range: Range } {
    const el = area(html);
    const text = el.querySelector('p')?.firstChild ?? el.firstChild!;
    const range = document.createRange();
    range.setStart(text, text.textContent!.length);
    range.collapse(true);
    return { el, range };
  }

  it('turns block markers into headings, quotes and lists', () => {
    for (const [marker, html] of [
      ['# ', '<h1><br></h1>'],
      ['## ', '<h2><br></h2>'],
      ['> ', '<blockquote><br></blockquote>'],
      ['- ', '<ul><li><br></li></ul>'],
      ['1. ', '<ol><li><br></li></ol>'],
      ['[] ', '<ul class="star-checklist"><li data-checked="false"><br></li></ul>'],
    ]) {
      const { el, range } = typedAt(`<p>${marker}</p>`);
      expect(starEditorInputRule(el, range)).toBe(true);
      expect(el.innerHTML).toBe(html);
    }
  });

  it('makes **text** bold and leaves other text alone', () => {
    const { el, range } = typedAt('<p>The **new**</p>');
    expect(starEditorInputRule(el, range)).toBe(true);
    expect(el.innerHTML).toBe('<p>The <b>new</b></p>');
    const other = typedAt('<p>Text # </p>');
    expect(starEditorInputRule(other.el, other.range)).toBe(false);
  });
});
