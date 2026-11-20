/**
 * The HTML source view of `star-editor`: the value as indented HTML, and the way back with the
 * sanitizer, after the source mode of Aurora RTE (MIT, same owner,
 * https://github.com/ramanacr/aurora-rte, `source-mode.ts`). Only white space between blocks
 * changes, so the text and its inline formatting stay exactly as they are.
 */
import { starEditorSanitize, StarEditorSanitizeConfig } from './editor-sanitize';

/** Elements that start a new line in the source. */
const BLOCK = new Set([
  'P',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'UL',
  'OL',
  'LI',
  'BLOCKQUOTE',
  'PRE',
  'DIV',
  'HR',
  'FIGURE',
  'FIGCAPTION',
  'TABLE',
  'CAPTION',
  'COLGROUP',
  'COL',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TH',
  'TD',
  'DL',
  'DT',
  'DD',
  'IFRAME',
]);

/** Elements that hold only blocks: white space in them has no meaning. */
const CONTAINER = new Set(['UL', 'OL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'COLGROUP', 'DL']);

/** Elements whose end tag may be left out (the parser closes them). */
const OPTIONAL_END = new Set([
  'p',
  'li',
  'dt',
  'dd',
  'tr',
  'td',
  'th',
  'thead',
  'tbody',
  'tfoot',
  'colgroup',
  'caption',
]);

const VOID = new Set([
  'br',
  'hr',
  'img',
  'col',
  'wbr',
  'input',
  'meta',
  'link',
  'source',
  'area',
  'base',
  'embed',
  'param',
  'track',
]);

function hasBlocks(element: Element): boolean {
  return [...element.children].some((child) => BLOCK.has(child.tagName));
}

function openTag(element: Element): string {
  const copy = element.cloneNode(false) as Element;
  const html = copy.outerHTML;
  return html.slice(0, html.length - `</${element.localName}>`.length);
}

/** The value as indented HTML: one block per line, inline content as it is. */
export function starEditorFormatHtml(html: string, doc: Document): string {
  const template = doc.createElement('template');
  template.innerHTML = html;
  const lines: string[] = [];
  const walk = (parent: ParentNode, depth: number) => {
    let inline = '';
    const flush = () => {
      if (inline.trim()) lines.push('  '.repeat(depth) + inline.trim());
      inline = '';
    };
    for (const node of parent.childNodes) {
      const element = node instanceof Element ? node : null;
      if (element && BLOCK.has(element.tagName)) {
        flush();
        if (hasBlocks(element) && element.tagName !== 'PRE') {
          lines.push('  '.repeat(depth) + openTag(element));
          walk(element, depth + 1);
          lines.push(`${'  '.repeat(depth)}</${element.localName}>`);
        } else lines.push('  '.repeat(depth) + element.outerHTML);
      } else if (element) inline += element.outerHTML;
      else if (node.nodeType === 3) {
        const holder = doc.createElement('span');
        holder.textContent = node.textContent;
        inline += holder.innerHTML;
      }
    }
    flush();
  };
  walk(template.content, 0);
  return lines.join('\n');
}

/** Removes white space text between blocks (the indentation of the source). */
function dropLayout(parent: ParentNode): void {
  const top = !(parent instanceof Element) || CONTAINER.has(parent.tagName);
  const mixed = parent instanceof Element && hasBlocks(parent);
  const block = (side: ChildNode | null) =>
    !side || (side instanceof Element && BLOCK.has(side.tagName));
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === 3 && (top || mixed)) {
      let text = node.textContent!;
      if (top && !text.trim()) {
        node.remove();
        continue;
      }
      // White space next to a block (or at the start or end) is layout.
      if (block(node.previousSibling)) text = text.replace(/^\s+/, '');
      if (block(node.nextSibling)) text = text.replace(/\s+$/, '');
      if (text) node.textContent = text;
      else node.remove();
    } else if (node instanceof Element && node.tagName !== 'PRE') dropLayout(node);
  }
}

/** The first element of the source that is opened and never closed, or `null`. */
export function starEditorUnclosed(source: string): string | null {
  const stack: string[] = [];
  const clean = source.replace(/<!--[\s\S]*?-->/g, '');
  for (const match of clean.matchAll(/<(\/?)([a-zA-Z][\w-]*)(?:\s[^<>]*?)?(\/?)>/g)) {
    const [, closing, raw, selfClosing] = match;
    const tag = raw.toLowerCase();
    if (VOID.has(tag) || selfClosing) continue;
    if (!closing) stack.push(tag);
    else {
      const at = stack.lastIndexOf(tag);
      if (at < 0) continue;
      // Elements between it and the end tag must have an optional end tag.
      const skipped = stack.splice(at);
      const missing = skipped.slice(1).find((name) => !OPTIONAL_END.has(name));
      if (missing) return missing;
    }
  }
  return stack.find((name) => !OPTIONAL_END.has(name)) ?? null;
}

/** The result of reading the source back. */
export interface StarEditorSourceResult {
  /** The sanitized HTML for the value. */
  readonly html: string;
  /** Markup was removed or changed by the sanitizer (not allowed, or legacy). */
  readonly changed: boolean;
  /** An element that is not closed, or `null`. */
  readonly unclosed: string | null;
}

/** Reads the source back: the layout white space goes, then the sanitizer runs. */
export function starEditorReadSource(
  source: string,
  doc: Document,
  config?: StarEditorSanitizeConfig,
): StarEditorSourceResult {
  const template = doc.createElement('template');
  template.innerHTML = source;
  dropLayout(template.content);
  const parsed = template.innerHTML;
  const html = starEditorSanitize(parsed, doc, config);
  return { html, changed: html !== parsed, unclosed: starEditorUnclosed(source) };
}
