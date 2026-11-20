import { starAssignKeyTips, starKeyTipMatch, starRibbonGroupModes } from './ribbon-model';

describe('starRibbonGroupModes', () => {
  const widths = [
    { full: 200, small: 120, collapsed: 60 },
    { full: 160, small: 100, collapsed: 60 },
    { full: 100, small: 80, collapsed: 60 },
  ];

  it('keeps every group full when they fit', () => {
    expect(starRibbonGroupModes(widths, 460)).toEqual(['full', 'full', 'full']);
  });

  it('makes the groups small from the last to the first', () => {
    expect(starRibbonGroupModes(widths, 440)).toEqual(['full', 'full', 'small']);
    expect(starRibbonGroupModes(widths, 380)).toEqual(['full', 'small', 'small']);
    expect(starRibbonGroupModes(widths, 300)).toEqual(['small', 'small', 'small']);
  });

  it('then collapses them from the last to the first', () => {
    expect(starRibbonGroupModes(widths, 290)).toEqual(['small', 'small', 'collapsed']);
    expect(starRibbonGroupModes(widths, 240)).toEqual(['small', 'collapsed', 'collapsed']);
    expect(starRibbonGroupModes(widths, 10)).toEqual(['collapsed', 'collapsed', 'collapsed']);
  });

  it('counts the gap between groups', () => {
    expect(starRibbonGroupModes(widths, 460, 10)).toEqual(['full', 'full', 'small']);
  });

  it('keeps everything full when the width is unknown', () => {
    expect(starRibbonGroupModes(widths, 0)).toEqual(['full', 'full', 'full']);
    expect(starRibbonGroupModes([], 100)).toEqual([]);
  });
});

describe('starAssignKeyTips', () => {
  it('keeps the given key tips and assigns the first free letter of the label', () => {
    const tips = starAssignKeyTips([
      { id: 'home', label: 'Home', keyTip: 'h' },
      { id: 'help', label: 'Help' },
      { id: 'insert', label: 'Insert' },
      { id: 'image', label: 'Image' },
    ]);
    expect([...tips]).toEqual([
      ['home', 'H'],
      ['help', 'E'],
      ['insert', 'I'],
      ['image', 'M'],
    ]);
  });

  it('uses digits, then two characters, and never makes one tip the prefix of another', () => {
    const tips = starAssignKeyTips(
      [
        { id: 'a', label: 'Ab', keyTip: 'AB' },
        { id: 'b', label: 'A' },
        { id: 'c', label: 'B' },
        { id: 'd', label: '' },
      ],
      ['B'],
    );
    expect(tips.get('a')).toBe('AB');
    // "A" is the start of "AB" and "B" is reserved.
    expect(tips.get('b')).toBe('1');
    expect(tips.get('c')).toBe('2');
    expect(tips.get('d')).toBe('3');
    const many = starAssignKeyTips(
      Array.from({ length: 12 }, (_, i) => ({ id: `${i}`, label: '1' })),
    );
    const values = [...many.values()];
    expect(new Set(values).size).toBe(12);
    for (const value of values) {
      expect(values.filter((other) => other !== value && other.startsWith(value))).toEqual([]);
    }
  });

  it('ignores accents and gives a duplicate explicit tip a free one', () => {
    const tips = starAssignKeyTips([
      { id: 'one', label: 'Édition', keyTip: 'E' },
      { id: 'two', label: 'Ébauche', keyTip: 'E' },
    ]);
    expect(tips.get('one')).toBe('E');
    expect(tips.get('two')).toBe('B');
  });
});

describe('starKeyTipMatch', () => {
  const tips = new Map([
    ['paste', 'V'],
    ['font', 'FF'],
    ['size', 'FS'],
  ]);

  it('finds an exact match, a partial match or nothing', () => {
    expect(starKeyTipMatch(tips, 'v')).toEqual({ id: 'paste', partial: false });
    expect(starKeyTipMatch(tips, 'F')).toEqual({ id: null, partial: true });
    expect(starKeyTipMatch(tips, 'FS')).toEqual({ id: 'size', partial: false });
    expect(starKeyTipMatch(tips, 'Q')).toEqual({ id: null, partial: false });
  });
});
