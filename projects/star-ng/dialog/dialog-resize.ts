import type { StarDialogDimensions, StarDialogFrame } from './dialog-drag';

/** Smallest size that resizing gives a dialog, in CSS pixels. */
export const STAR_DIALOG_MIN_SIZE: StarDialogDimensions = { width: 240, height: 160 };

/**
 * New frame of a dialog whose corner handle moved by `dx` / `dy` physical pixels. The handle is
 * at the bottom end corner: bottom right in left-to-right, bottom left in right-to-left. The
 * opposite edges stay where they are. With `viewport`, the box stays inside the window.
 */
export function resizeFrame(
  start: StarDialogFrame,
  dx: number,
  dy: number,
  rtl: boolean,
  viewport: StarDialogDimensions | null,
): StarDialogFrame {
  let width = Math.max(STAR_DIALOG_MIN_SIZE.width, start.width + (rtl ? -dx : dx));
  let height = Math.max(STAR_DIALOG_MIN_SIZE.height, start.height + dy);
  if (viewport) {
    const room = rtl ? start.left + start.width : viewport.width - start.left;
    width = Math.max(Math.min(width, room), Math.min(STAR_DIALOG_MIN_SIZE.width, room));
    const below = viewport.height - start.top;
    height = Math.max(Math.min(height, below), Math.min(STAR_DIALOG_MIN_SIZE.height, below));
  }
  const left = rtl ? start.left + start.width - width : start.left;
  return { left, top: start.top, width, height };
}
