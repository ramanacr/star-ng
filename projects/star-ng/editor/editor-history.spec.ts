import { StarEditorHistory, starEditorPathRange, starEditorSelectionPath } from './editor-history';

const state = (html: string) => ({ html, selection: null });

describe('StarEditorHistory', () => {
  it('undoes and redoes, and a new change drops the redo', () => {
    const history = new StarEditorHistory();
    history.reset(state('a'));
    expect(history.canUndo).toBe(false);
    history.record(state('ab'));
    history.record(state('abc'));
    expect(history.undo()!.html).toBe('ab');
    expect(history.undo()!.html).toBe('a');
    expect(history.undo()).toBeNull();
    expect(history.redo()!.html).toBe('ab');
    history.record(state('abX'));
    expect(history.canRedo).toBe(false);
    expect(history.undo()!.html).toBe('ab');
  });

  it('merges typing in a row into one step, and skips a change without new HTML', () => {
    const history = new StarEditorHistory();
    history.reset(state(''));
    history.record(state('a'));
    history.record(state('ab'), true);
    history.record(state('ab'));
    expect(history.undo()!.html).toBe('');
  });

  it('keeps at most the limit', () => {
    const history = new StarEditorHistory(3);
    history.reset(state('0'));
    for (const html of ['1', '2', '3', '4']) history.record(state(html));
    expect(history.undo()!.html).toBe('3');
    expect(history.undo()!.html).toBe('2');
    expect(history.undo()).toBeNull();
  });
});

describe('selection paths', () => {
  it('finds the same place after the HTML is set again', () => {
    const area = document.createElement('div');
    area.innerHTML = '<p>One <b>two</b></p>';
    const range = document.createRange();
    range.setStart(area.querySelector('b')!.firstChild!, 1);
    range.setEnd(area.querySelector('b')!.firstChild!, 3);
    const path = starEditorSelectionPath(area, range);
    area.innerHTML = '<p>One <b>two</b></p>';
    expect(starEditorPathRange(area, path)!.toString()).toBe('wo');
    area.innerHTML = '';
    expect(starEditorPathRange(area, path)).toBeNull();
    expect(starEditorSelectionPath(area, null)).toBeNull();
  });
});
