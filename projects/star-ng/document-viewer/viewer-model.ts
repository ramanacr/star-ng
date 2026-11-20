import { StarDocumentPageSize } from './document-renderer';

/** Zoom of the viewer: a scale factor (1 = 100 %), the page width, or the whole page. */
export type StarDocumentZoom = number | 'fit-width' | 'fit-page';

/** Rotation of the pages, clockwise. */
export type StarDocumentRotation = 0 | 90 | 180 | 270;

/** Smallest and largest scale factor. */
export const STAR_DOCUMENT_MIN_SCALE = 0.1;
export const STAR_DOCUMENT_MAX_SCALE = 8;

/** Zoom presets of the toolbar and of the zoom-in and zoom-out steps. */
export const STAR_DOCUMENT_ZOOM_STEPS: readonly number[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

/** The size of a page after a rotation: 90 and 270 degrees swap width and height. */
export function starRotatedSize(
  size: StarDocumentPageSize,
  rotation: number,
): StarDocumentPageSize {
  return rotation % 180 === 0 ? size : { width: size.height, height: size.width };
}

/**
 * The scale factor of a zoom for a page (already rotated) in a view: `fit-width` fills the view
 * width, `fit-page` shows the whole page; `padding` is kept on each side. Limited to 10 % to
 * 800 %. Without a measured view (server, hidden), the fit modes give 1.
 */
export function starDocumentScale(
  zoom: StarDocumentZoom,
  page: StarDocumentPageSize,
  view: { readonly width: number; readonly height: number },
  padding: number,
): number {
  let scale: number;
  if (typeof zoom === 'number') scale = zoom;
  else if (!view.width || !page.width || !page.height) scale = 1;
  else {
    const width = (view.width - 2 * padding) / page.width;
    scale =
      zoom === 'fit-width' ? width : Math.min(width, (view.height - 2 * padding) / page.height);
  }
  return Math.min(STAR_DOCUMENT_MAX_SCALE, Math.max(STAR_DOCUMENT_MIN_SCALE, scale));
}

/** The next preset above (`direction` 1) or below (-1) the scale, or the last preset. */
export function starDocumentZoomStep(scale: number, direction: 1 | -1): number {
  const steps = STAR_DOCUMENT_ZOOM_STEPS;
  if (direction > 0) return steps.find((s) => s > scale + 1e-9) ?? steps[steps.length - 1];
  return [...steps].reverse().find((s) => s < scale - 1e-9) ?? steps[0];
}

/**
 * Top offsets of pages one below the other: entry `i` is the top of page `i`, the last entry the
 * end of the last page plus its gap. `padding` comes before the first page.
 */
export function starDocumentLayout(
  heights: readonly number[],
  gap: number,
  padding: number,
): number[] {
  const offsets = [padding];
  for (const height of heights) offsets.push(offsets[offsets.length - 1] + height + gap);
  return offsets;
}

/** Index of the page whose slot (page and the gap below it) contains `position`. */
export function starDocumentPageAt(offsets: readonly number[], position: number): number {
  let lo = 0;
  let hi = Math.max(0, offsets.length - 2);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= position) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

/**
 * Pages to render for a scroll position: the pages in view plus `buffer` pages on each side,
 * as `[start, end)`. The other pages release their canvases.
 */
export function starDocumentWindow(
  offsets: readonly number[],
  scroll: number,
  viewport: number,
  buffer: number,
): { start: number; end: number } {
  const count = offsets.length - 1;
  if (count <= 0) return { start: 0, end: 0 };
  const from = Math.max(0, Math.min(scroll, offsets[count] - viewport));
  const first = starDocumentPageAt(offsets, from);
  let end = first + 1;
  while (end < count && offsets[end] < from + viewport) end++;
  return { start: Math.max(0, first - buffer), end: Math.min(count, end + buffer) };
}

/** Number of matches of `query` in `text`, without case, not overlapping. */
export function starCountMatches(text: string, query: string): number {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return 0;
  const haystack = text.toLocaleLowerCase();
  let count = 0;
  let at = haystack.indexOf(needle);
  while (at >= 0) {
    count++;
    at = haystack.indexOf(needle, at + needle.length);
  }
  return count;
}
