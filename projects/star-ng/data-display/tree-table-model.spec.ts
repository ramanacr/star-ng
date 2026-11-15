import { ariaRowCount, ariaRowIndex, revealRowOffset, rowWindow } from './tree-table-model';

describe('tree table model', () => {
  describe('rowWindow', () => {
    // 10,000 rows of 50 px in a 250 px scroll area: 5 rows are visible, 6 with the partial row.
    it('starts at the top with the visible rows and the buffer after them', () => {
      expect(rowWindow(10000, 50, 0, 250, 8)).toEqual({
        start: 0,
        end: 14,
        before: 0,
        after: (10000 - 14) * 50,
      });
    });

    it('moves with the scroll position and keeps a buffer on both sides', () => {
      // scrollTop 5,000 px is row 100.
      const window = rowWindow(10000, 50, 5000, 250, 8);
      expect(window.start).toBe(92);
      expect(window.end).toBe(100 + 6 + 8);
      expect(window.before).toBe(92 * 50);
      expect(window.after).toBe((10000 - window.end) * 50);
    });

    it('keeps the total height: spacers and rendered rows add up to all rows', () => {
      for (const top of [0, 1, 49, 50, 12345, 499000, 499750, 1e9]) {
        const w = rowWindow(10000, 50, top, 250, 8);
        expect(w.before + (w.end - w.start) * 50 + w.after).toBe(10000 * 50);
        expect(w.start).toBeGreaterThanOrEqual(0);
        expect(w.end).toBeLessThanOrEqual(10000);
      }
    });

    it('shows the last rows when the scroll position is past the end', () => {
      // The rows got fewer and the browser has not clamped the scroll position yet.
      const window = rowWindow(100, 50, 1e6, 250, 2);
      expect(window.end).toBe(100);
      expect(window.after).toBe(0);
      expect(window.start).toBe(100 - 6 - 2);
    });

    it('renders every row of a short list and nothing of an empty list', () => {
      expect(rowWindow(3, 50, 0, 250, 8)).toEqual({ start: 0, end: 3, before: 0, after: 0 });
      expect(rowWindow(0, 50, 0, 250, 8)).toEqual({ start: 0, end: 0, before: 0, after: 0 });
    });

    it('ignores a negative scroll position and a missing viewport size', () => {
      expect(rowWindow(100, 50, -30, 0, 0)).toEqual({
        start: 0,
        end: 1,
        before: 0,
        after: 99 * 50,
      });
    });
  });

  describe('revealRowOffset', () => {
    it('is null for a row that is fully visible below the header', () => {
      // Header 40 px, viewport 290 px: the rows see 250 px, that is 5 rows of 50 px.
      expect(revealRowOffset(2, 50, 0, 290, 40)).toBeNull();
      expect(revealRowOffset(4, 50, 0, 290, 40)).toBeNull();
    });

    it('scrolls down until the row ends at the bottom edge', () => {
      expect(revealRowOffset(5, 50, 0, 290, 40)).toBe(300 - 250);
      expect(revealRowOffset(9999, 50, 0, 290, 40)).toBe(10000 * 50 - 250);
    });

    it('scrolls up until the row starts below the header, not under it', () => {
      // At scroll position 500 the first fully visible row is row 10; row 9 is under the header.
      expect(revealRowOffset(10, 50, 500, 290, 40)).toBeNull();
      expect(revealRowOffset(9, 50, 500, 290, 40)).toBe(450);
      expect(revealRowOffset(0, 50, 500, 290, 40)).toBe(0);
    });

    it('does not break with a header taller than the viewport', () => {
      expect(revealRowOffset(3, 50, 0, 30, 40)).toBe(150);
    });
  });

  describe('aria row numbers', () => {
    it('counts the header row: the first body row is row 2', () => {
      expect(ariaRowIndex(0)).toBe(2);
      expect(ariaRowIndex(9999)).toBe(10001);
    });

    it('counts the header row in the row count', () => {
      expect(ariaRowCount(10000)).toBe(10001);
      expect(ariaRowCount(0)).toBe(1);
    });
  });
});
