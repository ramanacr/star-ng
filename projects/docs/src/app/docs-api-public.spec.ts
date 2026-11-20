import * as hierarchicalGrid from '@star-ng/ui/hierarchical-grid';
import * as pivotGrid from '@star-ng/ui/pivot-grid';
import { DOCS_API } from './generated/docs-data';

/** Entry points whose docs API must list public exports only. */
const ENTRIES: Readonly<Record<string, object>> = {
  '@star-ng/ui/pivot-grid': pivotGrid,
  '@star-ng/ui/hierarchical-grid': hierarchicalGrid,
};

describe('docs API data of the grid entry points', () => {
  it('lists only classes that the entry point exports', () => {
    for (const [entry, api] of Object.entries(ENTRIES)) {
      const names = Object.entries(DOCS_API)
        .filter(([, item]) => item.entry === entry)
        .map(([name]) => name);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) expect(Object.keys(api)).toContain(name);
    }
  });
});
