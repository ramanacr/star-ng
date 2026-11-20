import {
  starEditorIndentItem,
  starEditorItems,
  starEditorListAt,
  starEditorOutdentItem,
  starEditorToggleCheck,
  starEditorToggleList,
} from './editor-list';

function area(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

function rangeIn(start: Node, end: Node = start): Range {
  const range = document.createRange();
  range.setStart(start.firstChild ?? start, 0);
  range.setEnd(end.firstChild ?? end, (end.firstChild ?? end).textContent!.length);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

afterEach(() => document.body.replaceChildren());

describe('starEditorToggleList', () => {
  it('turns paragraphs into one list and back', () => {
    const el = area('<p>One</p><p>Two</p><h2>After</h2>');
    const [one, two] = el.querySelectorAll('p');
    starEditorToggleList(el, rangeIn(one, two), 'ul');
    expect(el.innerHTML).toBe('<ul><li>One</li><li>Two</li></ul><h2>After</h2>');
    expect(document.getSelection()!.toString()).toBe('OneTwo');
    const [a, b] = el.querySelectorAll('li');
    starEditorToggleList(el, rangeIn(a, b), 'ul');
    expect(el.innerHTML).toBe('<p>One</p><p>Two</p><h2>After</h2>');
  });

  it('changes the kind of a list, and makes a checklist with unchecked items', () => {
    const el = area('<ul><li>One</li><li>Two</li></ul>');
    const [one] = el.querySelectorAll('li');
    starEditorToggleList(el, rangeIn(one), 'ol');
    expect(el.innerHTML).toBe('<ol><li>One</li><li>Two</li></ol>');
    starEditorToggleList(el, rangeIn(el.querySelector('li')!), 'checklist');
    expect(el.innerHTML).toBe(
      '<ul class="star-checklist"><li data-checked="false">One</li><li data-checked="false">Two</li></ul>',
    );
    expect(starEditorListAt(el.querySelector('li')!.firstChild, el)).toBe('checklist');
    starEditorToggleCheck(el.querySelector('li')!);
    expect(el.querySelector('li')!.getAttribute('data-checked')).toBe('true');
  });

  it('takes one middle item out of its list', () => {
    const el = area('<ol><li>One</li><li>Two</li><li>Three</li></ol>');
    starEditorToggleList(el, rangeIn(el.querySelectorAll('li')[1]), 'ol');
    expect(el.innerHTML).toBe('<ol><li>One</li></ol><p>Two</p><ol><li>Three</li></ol>');
  });

  it('joins a new item to the list just before it', () => {
    const el = area('<ul><li>One</li></ul><p>Two</p>');
    starEditorToggleList(el, rangeIn(el.querySelector('p')!), 'ul');
    expect(el.innerHTML).toBe('<ul><li>One</li><li>Two</li></ul>');
  });
});

describe('list nesting', () => {
  it('indents under the item before and outdents back, with the items after it', () => {
    const el = area('<ul><li>One</li><li>Two</li><li>Three</li></ul>');
    const [, two, three] = el.querySelectorAll('li');
    expect(starEditorIndentItem(el.querySelector('li')!)).toBe(false);
    expect(starEditorIndentItem(two)).toBe(true);
    expect(starEditorIndentItem(three)).toBe(true);
    expect(el.innerHTML).toBe('<ul><li>One<ul><li>Two</li><li>Three</li></ul></li></ul>');
    expect(starEditorOutdentItem(two)).toBe(true);
    expect(el.innerHTML).toBe('<ul><li>One</li><li>Two<ul><li>Three</li></ul></li></ul>');
    expect(starEditorOutdentItem(two)).toBe(false);
  });

  it('finds the innermost items of a range', () => {
    const el = area('<ul><li>One<ul><li>Two</li></ul></li></ul>');
    const two = el.querySelectorAll('li')[1];
    expect(starEditorItems(el, rangeIn(two))).toEqual([two]);
  });
});
