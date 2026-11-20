/**
 * Lists of `star-editor`: bulleted, numbered and checklist, with nesting. A checklist is
 * `<ul class="star-checklist">` with `data-checked="true|false"` on each item.
 */
import { starEditorBlocks, starEditorClosest, starEditorRestore } from './editor-dom';
import { starEditorIsolate } from './editor-format';

export type StarEditorListKind = 'ul' | 'ol' | 'checklist';

export const STAR_EDITOR_CHECKLIST_CLASS = 'star-checklist';

/** The kind of a `ul` or `ol` element. */
export function starEditorListKindOf(list: Element): StarEditorListKind {
  if (list.tagName === 'OL') return 'ol';
  return list.classList.contains(STAR_EDITOR_CHECKLIST_CLASS) ? 'checklist' : 'ul';
}

/** The kind of the nearest list at `node`, or `null`. */
export function starEditorListAt(node: Node | null, area: HTMLElement): StarEditorListKind | null {
  const list = starEditorClosest(node, area, ['UL', 'OL']);
  return list ? starEditorListKindOf(list) : null;
}

/** A selection kept by its nodes while the list elements move. */
interface Kept {
  readonly start: [Node, number];
  readonly end: [Node, number];
}

function keep(range: Range): Kept {
  return {
    start: [range.startContainer, range.startOffset],
    end: [range.endContainer, range.endOffset],
  };
}

function restore(area: HTMLElement, range: Range, kept: Kept): void {
  if (!area.contains(kept.start[0]) || !area.contains(kept.end[0])) return;
  range.setStart(...kept.start);
  range.setEnd(...kept.end);
  starEditorRestore(range);
}

function makeList(doc: Document, kind: StarEditorListKind): HTMLElement {
  const list = doc.createElement(kind === 'ol' ? 'ol' : 'ul');
  if (kind === 'checklist') list.className = STAR_EDITOR_CHECKLIST_CLASS;
  return list;
}

/** Changes a list to another kind, with the check state of its items. */
function retype(list: HTMLElement, kind: StarEditorListKind): HTMLElement {
  let target = list;
  if ((kind === 'ol') !== (list.tagName === 'OL')) {
    target = makeList(list.ownerDocument, kind);
    for (const attribute of [...list.attributes])
      if (attribute.name !== 'start' && attribute.name !== 'reversed' && attribute.name !== 'type')
        target.setAttribute(attribute.name, attribute.value);
    while (list.firstChild) target.appendChild(list.firstChild);
    list.replaceWith(target);
  }
  target.classList.toggle(STAR_EDITOR_CHECKLIST_CLASS, kind === 'checklist');
  if (!target.classList.length) target.removeAttribute('class');
  for (const item of target.children) {
    if (kind === 'checklist') {
      if (!item.hasAttribute('data-checked')) item.setAttribute('data-checked', 'false');
    } else item.removeAttribute('data-checked');
  }
  return target;
}

/** Takes an item out of its list as a paragraph; nested lists follow it. */
function unlist(item: HTMLElement): void {
  const list = item.parentElement!;
  starEditorIsolate(item, list);
  const doc = item.ownerDocument;
  const paragraph = doc.createElement('p');
  const nested: Element[] = [];
  for (const child of [...item.childNodes]) {
    if (child instanceof Element && (child.tagName === 'UL' || child.tagName === 'OL'))
      nested.push(child);
    else paragraph.appendChild(child);
  }
  if (!paragraph.childNodes.length) paragraph.appendChild(doc.createElement('br'));
  list.replaceWith(paragraph, ...nested);
}

/**
 * The list button of `kind`: the selected blocks become items of a list of that kind; items of a
 * list of another kind change the kind of their list; when every selected block is already an
 * item of that kind, the items become paragraphs again.
 */
export function starEditorToggleList(
  area: HTMLElement,
  range: Range,
  kind: StarEditorListKind,
): void {
  const kept = keep(range);
  const doc = area.ownerDocument;
  const blocks = starEditorBlocks(area, range);
  if (!blocks.length) {
    const list = makeList(doc, kind);
    const item = doc.createElement('li');
    if (kind === 'checklist') item.setAttribute('data-checked', 'false');
    item.appendChild(doc.createElement('br'));
    list.appendChild(item);
    area.appendChild(list);
    range.setStart(item, 0);
    range.collapse(true);
    starEditorRestore(range);
    return;
  }
  const items = blocks.map((block) => starEditorClosest(block, area, ['LI']));
  if (items.every((item) => item && starEditorListKindOf(item.parentElement!) === kind)) {
    for (const item of new Set(items)) unlist(item!);
    restore(area, range, kept);
    return;
  }
  let open: HTMLElement | null = null;
  for (const [index, block] of blocks.entries()) {
    const item = items[index];
    if (item) {
      const list = item.parentElement!;
      if (starEditorListKindOf(list) !== kind) retype(list, kind);
      open = null;
      continue;
    }
    // Consecutive blocks go in one new list (or the list just before them).
    const previous = block.previousElementSibling as HTMLElement | null;
    if (
      !open &&
      previous &&
      (previous.tagName === 'UL' || previous.tagName === 'OL') &&
      starEditorListKindOf(previous) === kind
    )
      open = previous;
    if (!open || block.previousElementSibling !== open) {
      open = makeList(doc, kind);
      block.before(open);
    }
    const li = doc.createElement('li');
    if (kind === 'checklist') li.setAttribute('data-checked', 'false');
    for (const name of ['class', 'style', 'dir'])
      if (block.hasAttribute(name)) li.setAttribute(name, block.getAttribute(name)!);
    while (block.firstChild) li.appendChild(block.firstChild);
    if (!li.childNodes.length) li.appendChild(doc.createElement('br'));
    open.appendChild(li);
    block.remove();
  }
  restore(area, range, kept);
}

/** Moves a list item one level in, under the item before it. False when it has none. */
export function starEditorIndentItem(item: HTMLElement): boolean {
  const previous = item.previousElementSibling;
  if (!previous || previous.tagName !== 'LI') return false;
  const list = item.parentElement!;
  let nested = [...previous.children]
    .reverse()
    .find((child) => child.tagName === 'UL' || child.tagName === 'OL');
  if (!nested) {
    nested = list.cloneNode(false) as Element;
    nested.removeAttribute('start');
    previous.appendChild(nested);
  }
  nested.appendChild(item);
  // The items after it that were nested under it stay with it.
  return true;
}

/** Moves a nested list item one level out, after its parent item. False when it is not nested. */
export function starEditorOutdentItem(item: HTMLElement): boolean {
  const list = item.parentElement!;
  const parentItem = list.parentElement;
  if (!parentItem || parentItem.tagName !== 'LI') return false;
  const following = [];
  for (let next = item.nextElementSibling; next; next = next.nextElementSibling)
    following.push(next);
  if (following.length) {
    const rest = list.cloneNode(false) as Element;
    rest.append(...following);
    item.appendChild(rest);
  }
  parentItem.after(item);
  if (!list.children.length) list.remove();
  return true;
}

/** Indent (`delta` 1) or outdent (-1) the items of the range, keeping the selection. */
export function starEditorIndentItems(
  area: HTMLElement,
  range: Range,
  items: readonly HTMLElement[],
  delta: 1 | -1,
): boolean {
  const kept = keep(range);
  let changed = false;
  for (const item of delta === 1 ? items : [...items].reverse())
    changed = (delta === 1 ? starEditorIndentItem(item) : starEditorOutdentItem(item)) || changed;
  restore(area, range, kept);
  return changed;
}

/** The list items of the range (the innermost ones). */
export function starEditorItems(area: HTMLElement, range: Range): HTMLElement[] {
  const items = starEditorBlocks(area, range)
    .map((block) => starEditorClosest(block, area, ['LI']))
    .filter((item): item is HTMLElement => !!item);
  return [...new Set(items)];
}

/** Checks or unchecks a checklist item. */
export function starEditorToggleCheck(item: Element): void {
  item.setAttribute(
    'data-checked',
    item.getAttribute('data-checked') === 'true' ? 'false' : 'true',
  );
}
