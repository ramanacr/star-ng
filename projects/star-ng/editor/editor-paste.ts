/**
 * Paste cleanup of `star-editor` for HTML from word processors and web pages, after the paste
 * cleaner of Aurora RTE (MIT, same owner, https://github.com/ramanacr/aurora-rte,
 * `paste-cleaner.ts`). It keeps the structure (headings, paragraphs, lists, tables, links, bold,
 * italic, underline, strikethrough, subscript, superscript) and drops the look of the source
 * (fonts, sizes, black text, white backgrounds, classes, Office markup). The sanitizer runs
 * after it.
 */
import { STAR_EDITOR_CONTENT_CLASSES } from './editor-sanitize';

/** Colors of the source that are the default look, not a choice of the author. */
const DEFAULT_COLOR =
  /^(windowtext|black|#000|#000000|rgb\(0,\s*0,\s*0\)|inherit|initial|currentcolor|auto)$/i;
const DEFAULT_BACKGROUND =
  /^(transparent|white|#fff|#ffffff|rgb\(255,\s*255,\s*255\)|rgba\(0,\s*0,\s*0,\s*0\)|inherit|initial|window)$/i;

/** Inline styles that mean a semantic format, as the element that the editor uses. */
const STYLE_TAGS: readonly [RegExp, string, string][] = [
  [/^(bold|bolder|[6-9]00)$/, 'font-weight', 'b'],
  [/^italic$/, 'font-style', 'i'],
  [/underline/, 'text-decoration', 'u'],
  [/line-through/, 'text-decoration', 's'],
  [/underline/, 'text-decoration-line', 'u'],
  [/line-through/, 'text-decoration-line', 's'],
  [/^super$/, 'vertical-align', 'sup'],
  [/^sub$/, 'vertical-align', 'sub'],
];

function declarations(style: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of style.split(';')) {
    const colon = part.indexOf(':');
    if (colon > 0) map.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim());
  }
  return map;
}

/** True when the HTML comes from Microsoft Word (or another Office application). */
function fromOffice(html: string): boolean {
  return /class="?Mso|urn:schemas-microsoft-com|mso-[a-z-]+\s*:/i.test(html);
}

/** The list, level and kind of a Word list paragraph, or `null`. */
function wordListItem(
  paragraph: Element,
): { list: string; level: number; ordered: boolean } | null {
  const style = paragraph.getAttribute('style') ?? '';
  const list = /mso-list:\s*(l\d+)\s+level(\d+)/i.exec(style);
  if (!list && !/^MsoListParagraph/i.test(paragraph.getAttribute('class') ?? '')) return null;
  const marker = paragraph.querySelector('[style*="mso-list" i]');
  const text = (marker?.textContent ?? '').replace(/\u00a0/g, ' ').trim();
  return {
    list: list?.[1] ?? 'l0',
    level: list ? Number(list[2]) : 1,
    ordered: /^[\da-z]{1,4}[.)]/i.test(text),
  };
}

/** True for a text node with only white space. */
const blank = (node: Node | null) => node?.nodeType === 3 && !node.textContent!.trim();

/** Word list paragraphs in a row (of one Word list) become a (nested) `ul` or `ol`. */
function wordLists(root: DocumentFragment): void {
  const doc = root.ownerDocument;
  for (const first of [...root.querySelectorAll('p')]) {
    const head = root.contains(first) ? wordListItem(first) : null;
    if (!head) continue;
    const run: { element: Element; level: number; ordered: boolean }[] = [];
    for (let node: Element | null = first; node && node.tagName === 'P';) {
      const item = wordListItem(node);
      if (!item || item.list !== head.list) break;
      run.push({ element: node, ...item });
      node = node.nextElementSibling;
    }
    const top = doc.createElement(head.ordered ? 'ol' : 'ul');
    first.before(top);
    const stack: { list: Element; level: number }[] = [{ list: top, level: head.level }];
    for (const { element, level, ordered } of run) {
      while (stack.length > 1 && level < stack.at(-1)!.level) stack.pop();
      if (level > stack.at(-1)!.level) {
        const parentItem = stack.at(-1)!.list.lastElementChild ?? stack.at(-1)!.list;
        const nested = doc.createElement(ordered ? 'ol' : 'ul');
        parentItem.appendChild(nested);
        stack.push({ list: nested, level });
      }
      for (const marker of element.querySelectorAll('[style*="mso-list" i]')) marker.remove();
      const item = doc.createElement('li');
      while (element.firstChild) item.appendChild(element.firstChild);
      stack.at(-1)!.list.appendChild(item);
      if (element !== first && blank(element.previousSibling)) element.previousSibling!.remove();
      element.remove();
    }
  }
}

/** Replaces `element` by a new element `tag` around its children. */
function wrapChildren(element: Element, tag: string): void {
  const doc = element.ownerDocument;
  const wrapper = doc.createElement(tag);
  while (element.firstChild) wrapper.appendChild(element.firstChild);
  element.appendChild(wrapper);
}

/** Cleans one element: Office and source styles go, semantic styles become elements. */
function cleanElement(element: Element): void {
  const style = element.getAttribute('style');
  if (style !== null) {
    const map = declarations(style);
    for (const [pattern, property, tag] of STYLE_TAGS) {
      const value = map.get(property);
      if (value && pattern.test(value.toLowerCase()) && element.tagName !== tag.toUpperCase())
        wrapChildren(element, tag);
    }
    // Google Docs marks normal text with font-weight: normal on a b wrapper.
    if (element.tagName === 'B' && /^(normal|[1-4]00)$/.test(map.get('font-weight') ?? '')) {
      element.replaceWith(...element.childNodes);
      return;
    }
    const kept: string[] = [];
    const color = map.get('color');
    if (color && !DEFAULT_COLOR.test(color)) kept.push(`color: ${color}`);
    const background = map.get('background-color') ?? map.get('background');
    if (
      background &&
      !DEFAULT_BACKGROUND.test(background) &&
      /^[#a-z0-9(),.\s%]+$/i.test(background)
    )
      kept.push(`background-color: ${background}`);
    const align = map.get('text-align');
    if (align && /^(center|right|justify|end)$/i.test(align)) kept.push(`text-align: ${align}`);
    if (/^(TD|TH|COL|IMG)$/.test(element.tagName)) {
      const width = map.get('width');
      if (width) kept.push(`width: ${width}`);
    }
    if (kept.length) element.setAttribute('style', kept.join('; '));
    else element.removeAttribute('style');
  }
  const classes = [...element.classList].filter((name) => STAR_EDITOR_CONTENT_CLASSES.has(name));
  if (classes.length) element.setAttribute('class', classes.join(' '));
  else element.removeAttribute('class');
  const image = element.tagName === 'IMG';
  for (const name of element.getAttributeNames()) {
    const sized = /^(width|height)$/i.test(name);
    if (
      /^(lang|id|valign|bgcolor|border|cellpadding|cellspacing)$|^data-/i.test(name) ||
      (sized && !image)
    )
      if (name !== 'data-checked') element.removeAttribute(name);
  }
}

/**
 * Cleans pasted HTML of a word processor (Microsoft Word, Google Docs) or a web page. The
 * sanitizer of the editor runs after it.
 */
export function starEditorCleanPaste(html: string, doc: Document): string {
  if (!html) return '';
  // Conditional comments of Office carry XML islands; the parser keeps them as comments.
  const office = fromOffice(html);
  const template = doc.createElement('template');
  template.innerHTML = html
    .replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '')
    .replace(/<\?xml[^>]*>/gi, '');
  const root = template.content;
  for (const node of [...root.querySelectorAll('style, meta, link, title, xml')]) node.remove();
  // Office tags such as <o:p> and <w:sdt>: keep their text.
  for (const element of [...root.querySelectorAll('*')])
    if (element.tagName.includes(':')) element.replaceWith(...element.childNodes);
  for (const br of [...root.querySelectorAll('br.Apple-interchange-newline')]) br.remove();
  if (office) wordLists(root);
  for (const element of [...root.querySelectorAll('*')])
    if (root.contains(element)) cleanElement(element);
  // A Google Docs wrapper and spans that are left without attributes go.
  for (const span of [...root.querySelectorAll('span, font')])
    if (!span.attributes.length) span.replaceWith(...span.childNodes);
  return template.innerHTML.trim();
}
