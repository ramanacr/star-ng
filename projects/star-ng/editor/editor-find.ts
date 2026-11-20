/**
 * Find and replace, counts and Markdown-style input rules of `star-editor`, after the find and
 * replace, counts and input rules features of Aurora RTE (MIT, same owner,
 * https://github.com/ramanacr/aurora-rte, `find-replace.ts`, `counts.ts`, `markdown.ts`).
 */
import { starEditorRestore, starEditorText } from './editor-dom';

export interface StarEditorFindOptions {
  readonly matchCase: boolean;
  readonly wholeWord: boolean;
}

/** Elements whose text is one unit: a match does not cross their edge. */
const BLOCK =
  /^(P|H[1-6]|LI|BLOCKQUOTE|PRE|DIV|TD|TH|FIGCAPTION|CAPTION|DT|DD|UL|OL|TABLE|TR|FIGURE)$/;

/** The text of `root` with the text nodes and their start in the text; blocks are separated. */
function textMap(root: Node): { text: string; nodes: { node: Text; start: number }[] } {
  let text = '';
  const nodes: { node: Text; start: number }[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      nodes.push({ node: node as Text, start: text.length });
      text += (node as Text).data;
      return;
    }
    const block = node instanceof Element && BLOCK.test(node.tagName);
    if (block || (node instanceof Element && node.tagName === 'BR')) text += '\u0000';
    for (const child of node.childNodes) walk(child);
    if (block) text += '\u0000';
  };
  walk(root);
  return { text, nodes };
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The ranges of every match of `query` in `area`, in reading order. */
export function starEditorFind(
  area: HTMLElement,
  query: string,
  options: StarEditorFindOptions,
): Range[] {
  if (!query) return [];
  const { text, nodes } = textMap(area);
  const source = options.wholeWord
    ? `(?<![\\p{L}\\p{N}_])${escape(query)}(?![\\p{L}\\p{N}_])`
    : escape(query);
  const pattern = new RegExp(source, options.matchCase ? 'gu' : 'giu');
  /** The text node and offset of a place in the text; an end prefers the node before it. */
  const at = (offset: number, end: boolean): [Text, number] | null => {
    for (const { node, start } of nodes) {
      const stop = start + node.data.length;
      if (end ? offset > start && offset <= stop : offset >= start && offset < stop)
        return [node, offset - start];
    }
    return null;
  };
  const ranges: Range[] = [];
  for (const match of text.matchAll(pattern)) {
    if (!match[0] || match[0].includes('\u0000')) continue;
    const start = at(match.index, false);
    const end = at(match.index + match[0].length, true);
    if (!start || !end) continue;
    const range = area.ownerDocument.createRange();
    range.setStart(...start);
    range.setEnd(...end);
    ranges.push(range);
  }
  return ranges;
}

/** Replaces the text of `range` by `replacement`, in the formatting of its first character. */
export function starEditorReplace(range: Range, replacement: string): Range {
  const doc = range.startContainer.ownerDocument!;
  const node = doc.createTextNode(replacement);
  range.deleteContents();
  range.insertNode(node);
  node.parentNode?.normalize();
  const result = doc.createRange();
  // After normalize the node may be merged: select by the offset in its parent text.
  result.setStart(range.startContainer, range.startOffset);
  result.collapse(true);
  return result;
}

/** Replaces every match (from the end, so the earlier ranges stay right). The count of changes. */
export function starEditorReplaceAll(
  area: HTMLElement,
  query: string,
  replacement: string,
  options: StarEditorFindOptions,
): number {
  const ranges = starEditorFind(area, query, options);
  for (const range of [...ranges].reverse()) {
    range.deleteContents();
    if (replacement) range.insertNode(area.ownerDocument.createTextNode(replacement));
  }
  area.normalize();
  return ranges.length;
}

/** Words and characters of the text of `root` (line breaks do not count as characters). */
export function starEditorCounts(root: Node): { words: number; characters: number } {
  const text = starEditorText(root);
  const words = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu)?.length ?? 0;
  return { words, characters: text.replace(/\n/g, '').length };
}

/** Block rules: the text typed at the start of a block, and the block it makes. */
const BLOCK_RULES: readonly [RegExp, string][] = [
  [/^#[ \u00a0]$/, 'h1'],
  [/^##[ \u00a0]$/, 'h2'],
  [/^###[ \u00a0]$/, 'h3'],
  [/^>[ \u00a0]$/, 'blockquote'],
  [/^[-*][ \u00a0]$/, 'ul'],
  [/^1[.)][ \u00a0]$/, 'ol'],
  [/^\[ ?\][ \u00a0]$/, 'checklist'],
];

/**
 * Applies a Markdown-style input rule at the caret, after the user typed a space or `*`:
 * `# `, `## ` and `### ` make headings, `> ` a quote, `- ` or `* ` a bulleted list, `1. ` a
 * numbered list, `[] ` a checklist, and `**text**` bold text. True when a rule ran.
 */
export function starEditorInputRule(area: HTMLElement, range: Range): boolean {
  if (!range.collapsed || range.startContainer.nodeType !== 3) return false;
  const node = range.startContainer as Text;
  const doc = area.ownerDocument;
  const before = node.data.slice(0, range.startOffset);
  // Inline: **text** just before the caret.
  const bold = /\*\*([^*\s][^*]*?)\*\*$/.exec(before);
  if (bold) {
    const start = range.startOffset - bold[0].length;
    const marked = doc.createRange();
    marked.setStart(node, start);
    marked.setEnd(node, range.startOffset);
    marked.deleteContents();
    const element = doc.createElement('b');
    element.textContent = bold[1];
    marked.insertNode(element);
    const after = doc.createRange();
    after.setStartAfter(element);
    after.collapse(true);
    starEditorRestore(after);
    return true;
  }
  // Block rules: the marker is the whole text before the caret, at the start of a top block.
  const parent = node.parentElement;
  if (!parent) return false;
  const loose = parent === area;
  if (loose && node.previousSibling && !(node.previousSibling instanceof HTMLElement)) return false;
  if (!loose && (parent.parentElement !== area || parent.firstChild !== node)) return false;
  if (!loose && !/^(P|DIV|H[1-6])$/.test(parent.tagName)) return false;
  const container = loose ? null : parent;
  const rule = BLOCK_RULES.find(([pattern]) => pattern.test(before));
  if (!rule) return false;
  node.deleteData(0, range.startOffset);
  const holder =
    container ??
    (() => {
      const paragraph = doc.createElement('p');
      node.replaceWith(paragraph);
      paragraph.appendChild(node);
      return paragraph;
    })();
  if (!node.data) node.remove();
  if (!holder.childNodes.length) holder.appendChild(doc.createElement('br'));
  const tag = rule[1];
  let target: HTMLElement;
  if (tag === 'ul' || tag === 'ol' || tag === 'checklist') {
    const list = doc.createElement(tag === 'ol' ? 'ol' : 'ul');
    if (tag === 'checklist') list.className = 'star-checklist';
    const item = doc.createElement('li');
    if (tag === 'checklist') item.setAttribute('data-checked', 'false');
    while (holder.firstChild) item.appendChild(holder.firstChild);
    list.appendChild(item);
    holder.replaceWith(list);
    target = item;
  } else {
    target = doc.createElement(tag);
    while (holder.firstChild) target.appendChild(holder.firstChild);
    holder.replaceWith(target);
  }
  const caret = doc.createRange();
  caret.setStart(target, 0);
  caret.collapse(true);
  starEditorRestore(caret);
  return true;
}
