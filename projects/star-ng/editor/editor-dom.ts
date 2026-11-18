/**
 * DOM helpers of `star-editor`. They work on the editing area only and never on the server: the
 * editor calls them from event handlers.
 */

/** The zero-width space that holds the caret in an empty `code` element. */
const ZWSP = String.fromCharCode(0x200b);

/** Number of text characters in the area (line breaks and caret holders do not count). */
export function starEditorPlainLength(area: Node): number {
  return (area.textContent ?? '').split(ZWSP).join('').length;
}

/** Block elements that the toolbar formats or aligns. */
const BLOCKS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'DIV', 'PRE']);

/** Classes of the logical text alignment. Start is the default and has no class. */
export const STAR_EDITOR_ALIGN_CLASSES = {
  center: 'star-text-center',
  end: 'star-text-end',
} as const;

export type StarEditorAlignment = 'start' | 'center' | 'end';

/** The range of the selection when it is inside `area`, else `null`. */
export function starEditorRange(area: HTMLElement): Range | null {
  const selection = area.ownerDocument.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  return area.contains(range.commonAncestorContainer) ? range : null;
}

/** Selects `range` again (after a popover or a toolbar button took the focus). */
export function starEditorRestore(range: Range | null): void {
  if (!range) return;
  const selection = range.startContainer.ownerDocument?.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** The element of `node`, or its parent for a text node. */
function elementOf(node: Node | null): Element | null {
  return node instanceof Element ? node : (node?.parentElement ?? null);
}

/** The nearest ancestor of `node` (or `node`) inside `area` that has one of `tags`. */
export function starEditorClosest(
  node: Node | null,
  area: HTMLElement,
  tags: readonly string[],
): HTMLElement | null {
  for (let element = elementOf(node); element && element !== area; element = element.parentElement)
    if (tags.includes(element.tagName)) return element as HTMLElement;
  return null;
}

/** Tag names from `node` up to the area, the nearest first. */
export function starEditorPath(node: Node | null, area: HTMLElement): string[] {
  const tags: string[] = [];
  for (let element = elementOf(node); element && element !== area; element = element.parentElement)
    tags.push(element.tagName);
  return tags;
}

/** The block elements that the range touches. Text straight in the area is wrapped in a `p`. */
export function starEditorBlocks(area: HTMLElement, range: Range): HTMLElement[] {
  const doc = area.ownerDocument;
  // Loose inline content at the top level: put it in a paragraph first.
  for (const node of [...area.childNodes]) {
    if (node instanceof Element && BLOCKS.has(node.tagName)) continue;
    if (node instanceof Element && (node.tagName === 'UL' || node.tagName === 'OL')) continue;
    if (!range.intersectsNode(node)) continue;
    const paragraph = doc.createElement('p');
    area.insertBefore(paragraph, node);
    while (
      paragraph.nextSibling &&
      !(paragraph.nextSibling instanceof Element && BLOCKS.has(paragraph.nextSibling.tagName))
    ) {
      const next: ChildNode = paragraph.nextSibling;
      if (next instanceof Element && (next.tagName === 'UL' || next.tagName === 'OL')) break;
      paragraph.appendChild(next);
    }
  }
  const blocks = [...area.querySelectorAll<HTMLElement>([...BLOCKS].join(','))].filter((block) =>
    range.intersectsNode(block),
  );
  // Only the innermost blocks: a paragraph in a quote is aligned, not the quote.
  return blocks.filter(
    (block) => !blocks.some((other) => other !== block && block.contains(other)),
  );
}

/** Sets the logical alignment of the blocks of the range, with a class (kept by the sanitizer). */
export function starEditorAlign(
  area: HTMLElement,
  range: Range,
  alignment: StarEditorAlignment,
): void {
  for (const block of starEditorBlocks(area, range)) {
    block.classList.remove(STAR_EDITOR_ALIGN_CLASSES.center, STAR_EDITOR_ALIGN_CLASSES.end);
    if (alignment !== 'start') block.classList.add(STAR_EDITOR_ALIGN_CLASSES[alignment]);
    if (!block.classList.length) block.removeAttribute('class');
  }
}

/** The alignment of the block at `node`. */
export function starEditorAlignmentAt(node: Node | null, area: HTMLElement): StarEditorAlignment {
  const block = starEditorClosest(node, area, [...BLOCKS]);
  if (block?.classList.contains(STAR_EDITOR_ALIGN_CLASSES.center)) return 'center';
  if (block?.classList.contains(STAR_EDITOR_ALIGN_CLASSES.end)) return 'end';
  return 'start';
}

/** Replaces `element` by its children. */
export function starEditorUnwrap(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  parent.removeChild(element);
}

/** Inline code: removes the `code` around the selection, or puts the selection in one. */
export function starEditorToggleCode(area: HTMLElement, range: Range): void {
  const code = starEditorClosest(range.commonAncestorContainer, area, ['CODE']);
  if (code) {
    starEditorUnwrap(code);
    return;
  }
  const doc = area.ownerDocument;
  const element = doc.createElement('code');
  if (range.collapsed) {
    // An empty code element where the caret is: the next typed text goes in it.
    element.appendChild(doc.createTextNode('\u200b'));
    range.insertNode(element);
  } else {
    const content = range.extractContents();
    for (const inner of content.querySelectorAll('code')) starEditorUnwrap(inner);
    element.appendChild(content);
    range.insertNode(element);
  }
  range.selectNodeContents(element);
  starEditorRestore(range);
}
const BREAK_BEFORE = new Set([...BLOCKS, 'UL', 'OL', 'TR', 'BR']);

/**
 * Plain text of the area: block elements and line breaks become new lines. `innerText` does the
 * same in a browser, but needs layout, so the editor walks the nodes itself.
 */
export function starEditorText(root: Node): string {
  let text = '';
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      text += (node.nodeValue ?? '').replace(/\u200b/g, '');
      return;
    }
    if (!(node instanceof Element)) return;
    if (BREAK_BEFORE.has(node.tagName) && text && !text.endsWith('\n')) text += '\n';
    if (node.tagName === 'BR') return;
    for (const child of node.childNodes) walk(child);
    if (BLOCKS.has(node.tagName) && text && !text.endsWith('\n')) text += '\n';
  };
  walk(root);
  return text.replace(/\n+$/, '');
}

/** HTML for plain text: one paragraph per line, with the text escaped. */
export function starEditorTextToHtml(text: string): string {
  if (!text) return '';
  const escape = (line: string) =>
    line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${line ? escape(line) : '<br>'}</p>`)
    .join('');
}
