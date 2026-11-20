import { booleanAttribute } from '@angular/core';
import { starIsRtl } from './direction';

/**
 * Keyboard helpers shared by the data grids (`star-table`, `star-tree-table`). They are internal
 * (`ɵ` names): the entry points use them, applications do not.
 */

/** Shift+F10 or the context menu key: the keyboard way to open a context menu. */
export function ɵstarIsContextMenuKey(event: KeyboardEvent): boolean {
  return (event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu';
}

/**
 * Opens the context menu of an element from the keyboard, as a right click does: it dispatches a
 * `contextmenu` event at the bottom of the element, 16 pixels from its inline start. `button` is
 * 0, so a CDK context menu trigger focuses the first item as a keyboard user expects.
 */
export function ɵstarOpenContextMenu(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  element.dispatchEvent(
    new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: starIsRtl(element) ? rect.right - 16 : rect.left + 16,
      clientY: rect.bottom,
    }),
  );
}

/**
 * Input transform of an optional boolean such as `cellNavigation`: `undefined` stays `undefined`
 * (automatic), any other value works as `booleanAttribute` (`''` and `'true'` are true).
 */
export function ɵstarOptionalBoolean(value: boolean | string | undefined): boolean | undefined {
  return value === undefined ? undefined : booleanAttribute(value);
}
