/** A position in CSS pixels from the top left corner of the window. */
export interface StarDialogPoint {
  readonly x: number;
  readonly y: number;
}

/** A size in CSS pixels. */
export interface StarDialogDimensions {
  readonly width: number;
  readonly height: number;
}

/** Position and size of the dialog box in the window. */
export interface StarDialogFrame extends StarDialogDimensions {
  readonly left: number;
  readonly top: number;
}

/** Pixels per key press when the keyboard moves or resizes a dialog. */
export const STAR_DIALOG_KEY_STEP = 10;

/** Physical direction of an arrow key, or `null` for any other key. */
export function arrowDelta(key: string): StarDialogPoint | null {
  switch (key) {
    case 'ArrowLeft':
      return { x: -1, y: 0 };
    case 'ArrowRight':
      return { x: 1, y: 0 };
    case 'ArrowUp':
      return { x: 0, y: -1 };
    case 'ArrowDown':
      return { x: 0, y: 1 };
    default:
      return null;
  }
}

/**
 * Keeps a box of `size` at `point` inside a window of `viewport`. A box larger than the window
 * stays at the top left edge.
 */
export function clampToViewport(
  point: StarDialogPoint,
  size: StarDialogDimensions,
  viewport: StarDialogDimensions,
): StarDialogPoint {
  return {
    x: Math.min(Math.max(point.x, 0), Math.max(viewport.width - size.width, 0)),
    y: Math.min(Math.max(point.y, 0), Math.max(viewport.height - size.height, 0)),
  };
}

/**
 * Follows one pointer from its `pointerdown` until release: `move` gets the distance from the
 * start point, `end` runs once on `pointerup` or `pointercancel`. Events of other pointers are
 * ignored. Returns a function that stops the tracking without calling `end` (for a close or a
 * destroy in the middle of a drag).
 */
export function trackPointer(
  start: PointerEvent,
  move: (dx: number, dy: number) => void,
  end: () => void,
): () => void {
  const view = (start.target as Node | null)?.ownerDocument?.defaultView;
  if (!view) return () => undefined;
  const same = (event: PointerEvent) => event.pointerId === start.pointerId;
  const onMove = (event: PointerEvent) => {
    if (same(event)) move(event.clientX - start.clientX, event.clientY - start.clientY);
  };
  const stop = () => {
    view.removeEventListener('pointermove', onMove);
    view.removeEventListener('pointerup', onEnd);
    view.removeEventListener('pointercancel', onEnd);
  };
  const onEnd = (event: PointerEvent) => {
    if (!same(event)) return;
    stop();
    end();
  };
  view.addEventListener('pointermove', onMove);
  view.addEventListener('pointerup', onEnd);
  view.addEventListener('pointercancel', onEnd);
  return stop;
}
