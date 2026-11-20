/**
 * Inline and block formats of `star-editor` that change the DOM directly (not
 * `document.execCommand`): text color, highlight, font size, subscript, superscript, clear
 * formatting, indentation and the horizontal rule. The editor's own history makes them undoable.
 */
import {
  starEditorBlocks,
  starEditorClosest,
  starEditorRestore,
  starEditorUnwrap,
} from './editor-dom';

/** A style that the toolbar sets on a span. */
export type StarEditorInlineStyle = 'color' | 'background-color' | 'font-size';

/** Font size steps of the toolbar, as CSS values (`normal` has none). */
export const STAR_EDITOR_FONT_SIZES = {
  small: '0.875em',
  normal: '',
  large: '1.25em',
  larger: '1.5em',
  largest: '2em',
} as const;

export type StarEditorFontSize = keyof typeof STAR_EDITOR_FONT_SIZES;

/** Palette of the color and highlight menus: token names, shown as `var(--star-…)`. */
export const STAR_EDITOR_PALETTE = {
  text: ['accent', 'success', 'warning', 'danger', 'text-muted'],
  highlight: ['accent-soft', 'success-soft', 'warning-soft', 'danger-soft', 'surface-muted'],
} as const;

/** One step of indentation outside lists. */
const INDENT_STEP = 2.5;
const INDENT_MAX = 8;

/** Inline elements that clear formatting removes. */
const INLINE_FORMATS = new Set([
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'STRIKE',
  'DEL',
  'INS',
  'SUB',
  'SUP',
  'CODE',
  'MARK',
  'SMALL',
  'FONT',
  'SPAN',
  'KBD',
]);

/**
 * The text nodes of `range`, split at its ends so each one is fully in the range. Empty text
 * nodes and caret holders count too, so a caret in an empty span keeps its place.
 */
export function starEditorTextNodes(area: HTMLElement, range: Range): Text[] {
  if (range.collapsed) return [];
  let { startContainer, startOffset, endContainer, endOffset } = range;
  if (endContainer.nodeType === 3 && endOffset < (endContainer as Text).length)
    (endContainer as Text).splitText(endOffset);
  if (startContainer.nodeType === 3 && startOffset > 0) {
    const rest = (startContainer as Text).splitText(startOffset);
    if (endContainer === startContainer) {
      endContainer = rest;
      endOffset -= startOffset;
    }
    startContainer = rest;
    startOffset = 0;
  }
  range.setStart(startContainer, startOffset);
  range.setEnd(endContainer, endOffset);
  const root = range.commonAncestorContainer;
  const candidates: Text[] = root.nodeType === 3 ? [root as Text] : [];
  // 4: NodeFilter.SHOW_TEXT.
  const walker = area.ownerDocument.createTreeWalker(root, 4);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) candidates.push(node as Text);
  return candidates.filter(
    (text) =>
      text.length > 0 &&
      area.contains(text) &&
      range.intersectsNode(text) &&
      // A boundary at the very end (or start) of a text node does not select it.
      !(text === range.endContainer && range.endOffset === 0) &&
      !(text === range.startContainer && range.startOffset === text.length),
  );
}

/**
 * Splits `ancestor` so that it holds only the branch of `node`: the content before and after
 * goes into copies of `ancestor` next to it.
 */
export function starEditorIsolate(node: Node, ancestor: Element): void {
  const doc = ancestor.ownerDocument;
  const before = doc.createRange();
  before.setStart(ancestor, 0);
  before.setEndBefore(node);
  const after = doc.createRange();
  after.setStartAfter(node);
  after.setEnd(ancestor, ancestor.childNodes.length);
  for (const [part, where] of [
    [before, 'before'],
    [after, 'after'],
  ] as const) {
    if (part.collapsed) continue;
    const content = part.extractContents();
    // Empty copies of partly selected elements are left out; items, breaks and images count.
    if (!content.textContent && !content.querySelector('li,br,img,hr,table,iframe')) continue;
    const copy = ancestor.cloneNode(false) as Element;
    copy.appendChild(content);
    ancestor[where](copy);
  }
}

/** Selects from the start of `first` to the end of `last`. */
function selectNodes(range: Range, first: Node, last: Node): void {
  range.setStartBefore(first);
  range.setEndAfter(last);
  starEditorRestore(range);
}

/** Inline ancestors of `node` up to its block, the nearest first. */
function inlineAncestors(node: Node, area: HTMLElement): HTMLElement[] {
  const result: HTMLElement[] = [];
  for (
    let element = node.parentElement;
    element && element !== area;
    element = element.parentElement
  ) {
    if (!INLINE_FORMATS.has(element.tagName) && element.tagName !== 'A') break;
    result.push(element);
  }
  return result;
}

/** A caret holder for a collapsed selection: the next typed text goes in `wrapper`. */
function holdCaret(range: Range, wrapper: HTMLElement): void {
  wrapper.appendChild(wrapper.ownerDocument.createTextNode('​'));
  range.insertNode(wrapper);
  range.setStart(wrapper.firstChild!, 1);
  range.collapse(true);
  starEditorRestore(range);
}

/**
 * Sets a style of the selected text (`value`), or removes it (`null` or `''`). Spans that carry
 * the style are split at the ends of the selection, so text outside keeps its style.
 */
export function starEditorSetStyle(
  area: HTMLElement,
  range: Range,
  property: StarEditorInlineStyle,
  value: string | null,
): void {
  const doc = area.ownerDocument;
  if (range.collapsed) {
    if (!value) return;
    const span = doc.createElement('span');
    span.style.setProperty(property, value);
    holdCaret(range, span);
    return;
  }
  const nodes = starEditorTextNodes(area, range);
  for (const node of nodes) {
    for (const span of inlineAncestors(node, area).filter(
      (element) => element.tagName === 'SPAN' && element.style.getPropertyValue(property),
    )) {
      starEditorIsolate(node, span);
      span.style.removeProperty(property);
      if (!span.getAttribute('style')) span.removeAttribute('style');
      if (!span.attributes.length) starEditorUnwrap(span);
    }
    if (!value) continue;
    const parent = node.parentElement!;
    if (parent.tagName === 'SPAN' && parent.childNodes.length === 1 && parent !== area) {
      parent.style.setProperty(property, value);
    } else {
      const span = doc.createElement('span');
      span.style.setProperty(property, value);
      node.replaceWith(span);
      span.appendChild(node);
    }
  }
  if (nodes.length) selectNodes(range, nodes[0], nodes.at(-1)!);
}

/** The value of `property` at `node` (the nearest span with it), or `''`. */
export function starEditorStyleAt(
  node: Node | null,
  area: HTMLElement,
  property: StarEditorInlineStyle,
): string {
  for (
    let element = node instanceof Element ? node : node?.parentElement;
    element && element !== area;
    element = element.parentElement
  ) {
    const value = (element as HTMLElement).style?.getPropertyValue(property);
    if (value) return value;
  }
  return '';
}

/** The font size step at `node`. */
export function starEditorFontSizeAt(node: Node | null, area: HTMLElement): StarEditorFontSize {
  const value = starEditorStyleAt(node, area, 'font-size');
  const entry = Object.entries(STAR_EDITOR_FONT_SIZES).find(([, size]) => size && size === value);
  return (entry?.[0] as StarEditorFontSize | undefined) ?? 'normal';
}

/**
 * Subscript or superscript (`tag`): removes it when the whole selection has it, else puts the
 * selection in it. The other one of the two goes, as they exclude each other.
 */
export function starEditorToggleScript(area: HTMLElement, range: Range, tag: 'SUB' | 'SUP'): void {
  const other = tag === 'SUB' ? 'SUP' : 'SUB';
  const doc = area.ownerDocument;
  if (range.collapsed) {
    const current = starEditorClosest(range.startContainer, area, [tag]);
    if (current) {
      // The caret leaves the element: the next text is normal.
      range.setStartAfter(current);
      range.collapse(true);
      starEditorRestore(range);
    } else holdCaret(range, doc.createElement(tag.toLowerCase()));
    return;
  }
  const nodes = starEditorTextNodes(area, range);
  const remove = nodes.length > 0 && nodes.every((node) => starEditorClosest(node, area, [tag]));
  for (const node of nodes) {
    for (const element of inlineAncestors(node, area).filter(
      (el) => el.tagName === other || (remove && el.tagName === tag),
    )) {
      starEditorIsolate(node, element);
      starEditorUnwrap(element);
    }
    if (!remove && !starEditorClosest(node, area, [tag])) {
      const wrapper = doc.createElement(tag.toLowerCase());
      node.replaceWith(wrapper);
      wrapper.appendChild(node);
    }
  }
  if (nodes.length) selectNodes(range, nodes[0], nodes.at(-1)!);
}

/**
 * Clear formatting: the selected text loses its inline formats (bold, italic, code, colors,
 * sizes …) and its blocks lose their alignment and indentation. Links stay.
 */
export function starEditorClearFormat(area: HTMLElement, range: Range): void {
  const nodes = starEditorTextNodes(area, range);
  for (const node of nodes) {
    for (const element of inlineAncestors(node, area).filter((el) => el.tagName !== 'A')) {
      starEditorIsolate(node, element);
      starEditorUnwrap(element);
    }
  }
  for (const block of starEditorBlocks(area, range)) {
    block.style.removeProperty('margin-inline-start');
    block.style.removeProperty('text-align');
    if (!block.getAttribute('style')) block.removeAttribute('style');
    block.classList.remove('star-text-center', 'star-text-end', 'star-text-justify');
    if (!block.classList.length) block.removeAttribute('class');
  }
  if (nodes.length) selectNodes(range, nodes[0], nodes.at(-1)!);
}

/** The indentation steps of a block outside a list. */
export function starEditorIndentOf(block: HTMLElement): number {
  const value = /^(\d+(?:\.\d+)?)rem$/.exec(block.style.getPropertyValue('margin-inline-start'));
  return value ? Math.round(Number(value[1]) / INDENT_STEP) : 0;
}

/** Moves blocks outside lists one step in (`delta` 1) or out (`delta` -1). */
export function starEditorIndentBlocks(blocks: readonly HTMLElement[], delta: 1 | -1): void {
  for (const block of blocks) {
    const steps = Math.max(0, Math.min(INDENT_MAX, starEditorIndentOf(block) + delta));
    if (steps) block.style.setProperty('margin-inline-start', `${steps * INDENT_STEP}rem`);
    else block.style.removeProperty('margin-inline-start');
    if (!block.getAttribute('style')) block.removeAttribute('style');
  }
}

/** Inserts a horizontal rule after the block of the caret, and a new paragraph after it. */
export function starEditorInsertRule(area: HTMLElement, range: Range): void {
  const doc = area.ownerDocument;
  const rule = doc.createElement('hr');
  const blocks = starEditorBlocks(area, range);
  let block: Element | null = blocks.at(-1) ?? null;
  // A rule cannot go in a list item or a cell: after the list or the table.
  while (block && block.parentElement !== area) block = block.parentElement;
  if (block) block.after(rule);
  else area.appendChild(rule);
  const paragraph = doc.createElement('p');
  paragraph.appendChild(doc.createElement('br'));
  rule.after(paragraph);
  range.setStart(paragraph, 0);
  range.collapse(true);
  starEditorRestore(range);
}
