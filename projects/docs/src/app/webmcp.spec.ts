import { isDocsPage, searchDocsPages } from './webmcp';

describe('docs WebMCP tools', () => {
  it('finds pages by label, keyword and group words', () => {
    expect(searchDocsPages('dark mode').map((page) => page.path)).toContain('guides/dark-mode');
    expect(searchDocsPages('table').map((page) => page.path)).toContain('controls/table');
    const zoneless = searchDocsPages('zoneless');
    expect(zoneless.map((page) => page.path)).toEqual(['guides/angular-features']);
    expect(zoneless[0]).toEqual({
      label: 'Angular features',
      group: 'Guides',
      path: 'guides/angular-features',
    });
  });

  it('returns nothing for unknown words and caps the list', () => {
    expect(searchDocsPages('no-such-word-anywhere')).toEqual([]);
    expect(searchDocsPages('', 5)).toHaveLength(5);
  });

  it('knows the paths of the navigation only', () => {
    expect(isDocsPage('controls/table')).toBe(true);
    expect(isDocsPage('controls/no-such-control')).toBe(false);
    expect(isDocsPage('')).toBe(false);
  });
});
