import { starFilterMatch, starFilterMatchAny, starFilterTexts } from './filter-match';

describe('starFilterMatch', () => {
  it('matches "contains" by default, without case and accents', () => {
    expect(starFilterMatch('Málaga', 'mala')).toBe(true);
    expect(starFilterMatch('Zürich', 'ZUR')).toBe(true);
    expect(starFilterMatch('Berlin', 'paris')).toBe(false);
  });

  it('matches every value for an empty or blank query', () => {
    expect(starFilterMatch('Berlin', '')).toBe(true);
    expect(starFilterMatch('Berlin', '  ', 'notContains')).toBe(true);
  });

  it('supports the match modes', () => {
    expect(starFilterMatch('Berlin', 'ber', 'startsWith')).toBe(true);
    expect(starFilterMatch('Berlin', 'lin', 'startsWith')).toBe(false);
    expect(starFilterMatch('Berlin', 'LIN', 'endsWith')).toBe(true);
    expect(starFilterMatch('Berlin', 'ber', 'endsWith')).toBe(false);
    expect(starFilterMatch('Berlin', 'berlin', 'equals')).toBe(true);
    expect(starFilterMatch('Berlin', 'berli', 'equals')).toBe(false);
    expect(starFilterMatch('Berlin', 'paris', 'notContains')).toBe(true);
    expect(starFilterMatch('Berlin', 'erl', 'notContains')).toBe(false);
  });

  it('reads null and numbers as text', () => {
    expect(starFilterMatch(null, 'a')).toBe(false);
    expect(starFilterMatch(5000, '50', 'startsWith')).toBe(true);
  });

  it('compares with the locale (Intl.Collator, sensitivity base)', () => {
    expect(starFilterMatch('Ärzte', 'arz', 'startsWith', 'de')).toBe(true);
    expect(starFilterMatch('Île', 'ile', 'equals', 'fr')).toBe(true);
    expect(starFilterMatch('Berlin', 'rli', 'contains', 'de')).toBe(true);
    expect(starFilterMatch('Berlin', 'xyz', 'contains', 'de')).toBe(false);
  });
});

describe('starFilterMatchAny', () => {
  it('matches when one text matches, and for notContains when none has the query', () => {
    expect(starFilterMatchAny(['Berlin', 'BER'], 'ber', 'equals')).toBe(true);
    expect(starFilterMatchAny(['Berlin', 'BER'], 'ber', 'notContains')).toBe(false);
    expect(starFilterMatchAny(['Paris', 'PAR'], 'ber', 'notContains')).toBe(true);
  });
});

describe('starFilterTexts', () => {
  const city = { code: 'BER', name: 'Berlin' };
  it('uses the label without filterBy, else the fields', () => {
    expect(starFilterTexts(city, null, (c) => c.name)).toEqual(['Berlin']);
    expect(starFilterTexts(city, 'code', (c) => c.name)).toEqual(['BER']);
    expect(starFilterTexts(city, ['code', (c) => c.name.length], (c) => c.name)).toEqual([
      'BER',
      6,
    ]);
  });
});

describe('starFilterMatch folding before the locale compare', () => {
  it('folds the Turkish dotted capital I to a dotless i, so it does not match "is"', () => {
    expect(starFilterMatch('İstanbul', 'is', 'startsWith', 'tr')).toBe(false);
    expect(starFilterMatch('Ärzte', 'arz', 'startsWith', 'de')).toBe(true);
  });
});
