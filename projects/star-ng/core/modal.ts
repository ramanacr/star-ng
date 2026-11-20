/**
 * True when a modal dialog that does not contain `element` is open: a native modal `<dialog>`
 * (`:modal`) or a visible element with `aria-modal="true"`. Page-wide shortcuts (the ribbon
 * KeyTips, the command palette hotkey) ignore their keys then. Shared by the entry points; not
 * public API.
 */
export function ɵstarModalOutside(doc: Document, element: Element): boolean {
  const outside = (modal: Element) => !modal.contains(element);
  // Only a connected element that shows counts (`checkVisibility()` where the browser has it).
  const visible = (modal: Element) => {
    if (!modal.isConnected || modal.closest('[hidden], dialog:not([open])')) return false;
    const check = (modal as Element & { checkVisibility?: () => boolean }).checkVisibility;
    return check ? check.call(modal) : true;
  };
  let modals: Element[] = [];
  try {
    modals = [...doc.querySelectorAll(':modal')];
  } catch {
    // An engine without `:modal`: the aria-modal check below still works.
  }
  modals.push(...[...doc.querySelectorAll('[aria-modal="true"]')].filter(visible));
  return modals.some(outside);
}
