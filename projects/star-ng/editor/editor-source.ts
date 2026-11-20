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

function openTag(element: Element): string {
  const copy = element.cloneNode(false) as Element;
  const html = copy.outerHTML;
  return html.slice(0, html.length - `</${element.localName}>`.length);
}

/**
 * True when every child of `parent` is a block element or white space only: white space in it
 * has no meaning, so the source view may indent its children and drop the indentation again.
 */
/** Other elements that are blocks or have no text, for the layout of a typed source. */
const LAYOUT_TOO = new Set([
  'CENTER',
  'SECTION',
  'ARTICLE',
  'HEADER',
  'FOOTER',
  'NAV',
  'MAIN',
  'ASIDE',
  'ADDRESS',
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
]);

function blocksOnly(parent: ParentNode): boolean {
  const nodes = [...parent.childNodes];
  return (
    nodes.some((node) => node instanceof Element) &&
    nodes.every((node) =>
      node instanceof Element
        ? BLOCK.has(node.tagName) || LAYOUT_TOO.has(node.tagName)
        : node.nodeType === 3
          ? !node.textContent!.trim()
          : true,
    )
  );
}

/**
 * The value as indented HTML: the children of a container that holds only blocks go on their own
 * lines; any other content (text, inline elements, mixed content, `pre`) stays exactly as it is,
 * on one line. Only white space that has no meaning is added, so the source reads back to the
 * same value.
 */
export function starEditorFormatHtml(html: string, doc: Document): string {
  const template = doc.createElement('template');
  template.innerHTML = html;
  if (!blocksOnly(template.content)) return html;
  const lines: string[] = [];
  const line = (element: Element, depth: number) => {
    const indent = '  '.repeat(depth);
    if (element.tagName !== 'PRE' && element.children.length && blocksOnly(element)) {
      lines.push(indent + openTag(element));
      for (const child of element.children) line(child, depth + 1);
      lines.push(`${indent}</${element.localName}>`);
    } else lines.push(indent + element.outerHTML);
  };
  for (const child of template.content.children) line(child, 0);
  return lines.join('\n');
}

/** Removes white space text in containers that hold only blocks (the indentation of the source). */
function dropLayout(parent: ParentNode): void {
  const layout = blocksOnly(parent);
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === 3 && layout) node.remove();
    else if (node instanceof Element && node.tagName !== 'PRE') dropLayout(node);
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
