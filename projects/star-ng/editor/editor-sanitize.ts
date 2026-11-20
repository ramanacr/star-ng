/**
 * The HTML sanitizer of `star-editor`: one allow-list for the value, a paste, a drop and the
 * source view. The rules follow the sanitizer of Aurora RTE (MIT, same owner,
 * https://github.com/ramanacr/aurora-rte, `security-policy.ts` and `html.ts`): restricted elements
 * go with their content, unknown elements are unwrapped, event handlers go, URLs need an allowed
 * protocol (`javascript:`, `vbscript:` and `data:` never, except `data:` images), and legacy
 * tags are migrated. The HTML is parsed in an inert `template` (no script runs, no image loads)
 * and walked as a DOM, not with regular expressions.
 */

/** The allow-list of the sanitizer (see `sanitize` of `star-editor`). */
export interface StarEditorSanitizeConfig {
  /** Elements that stay (lower case). Other elements are unwrapped: their content stays. */
  readonly tags: readonly string[];
  /** Attributes that stay, per element; `'*'` is for every element. */
  readonly attributes: Readonly<Record<string, readonly string[]>>;
  /** Protocols of `href` and `src`, for example `'https:'`. Relative addresses always pass. */
  readonly protocols: readonly string[];
  /**
   * Hosts whose pages an `iframe` may show (the embed blocks), for example
   * `'www.youtube-nocookie.com'`. Empty (the default): no `iframe`.
   */
  readonly embedHosts?: readonly string[];
}

/** The default allow-list. Spread it to make an own one. */
export const STAR_EDITOR_SANITIZE_DEFAULTS: StarEditorSanitizeConfig = {
  tags: [
    'p',
    'br',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'b',
    'strong',
    'i',
    'em',
    'u',
    's',
    'del',
    'ins',
    'sub',
    'sup',
    'code',
    'pre',
    'kbd',
    'mark',
    'small',
    'abbr',
    'q',
    'cite',
    'blockquote',
    'ul',
    'ol',
    'li',
    'dl',
    'dt',
    'dd',
    'a',
    'span',
    'div',
    'hr',
    'img',
    'figure',
    'figcaption',
    'table',
    'caption',
    'colgroup',
    'col',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
  ],
  attributes: {
    '*': ['class', 'title', 'dir', 'lang', 'style'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    ol: ['start', 'reversed', 'type'],
    li: ['value', 'data-checked'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
    col: ['span'],
    colgroup: ['span'],
    iframe: ['src', 'title', 'width', 'height', 'allowfullscreen'],
  },
  protocols: ['http:', 'https:', 'mailto:', 'tel:'],
  embedHosts: [],
};

/** Elements that go with their content, even when an allow-list names them. */
const DROP = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'noembed',
  'noframes',
  'object',
  'embed',
  'applet',
  'svg',
  'math',
  'textarea',
  'select',
  'option',
  'optgroup',
  'button',
  'input',
  'form',
  'base',
  'meta',
  'link',
  'title',
  'head',
  'frame',
  'frameset',
  'xmp',
  'plaintext',
  'audio',
  'video',
  'source',
  'track',
  'canvas',
  'portal',
  'dialog',
]);

/** Protocols that never pass. */
const NEVER_PROTOCOLS = new Set(['javascript:', 'vbscript:', 'data:', 'file:', 'blob:']);

/** `data:` images that an `img` may show (no SVG: it can carry script in other contexts). */
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp|avif|bmp);base64,[a-z0-9+/=]+$/i;

/** Values of attributes that are not free text. */
const ATTRIBUTE_VALUES: Readonly<Record<string, RegExp>> = {
  width: /^\d{1,4}$/,
  height: /^\d{1,4}$/,
  colspan: /^\d{1,3}$/,
  rowspan: /^\d{1,3}$/,
  span: /^\d{1,3}$/,
  start: /^-?\d{1,6}$/,
  value: /^-?\d{1,6}$/,
  type: /^[1aAiI]$/,
  scope: /^(row|col|rowgroup|colgroup)$/,
  dir: /^(ltr|rtl|auto)$/,
  'data-checked': /^(true|false)$/,
  reversed: /^(|reversed)$/,
  allowfullscreen: /^(|allowfullscreen|true)$/,
};

const LENGTH = (max: Readonly<Record<string, number>>) => (value: string) => {
  const match = /^(\d{1,5}(?:\.\d{1,4})?)(px|pt|em|rem|%)$/.exec(value);
  return !!match && match[2] in max && Number(match[1]) <= max[match[2]];
};

const COLOR =
  /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([\d\s.,%/]{1,40}\)|[a-z]{3,20}|var\(--star-[a-z0-9-]{1,40}\))$/;

/** Style properties that stay, with a check of the value. */
const STYLES: Readonly<Record<string, (value: string) => boolean>> = {
  color: (value) => COLOR.test(value),
  'background-color': (value) => COLOR.test(value),
  'font-size': (value) =>
    /^(x-small|small|medium|large|x-large|xx-large|smaller|larger)$/.test(value) ||
    LENGTH({ px: 96, pt: 72, em: 6, rem: 6, '%': 400 })(value),
  'text-align': (value) => /^(left|right|center|justify|start|end)$/.test(value),
  'margin-inline-start': LENGTH({ em: 40, rem: 40 }),
  width: (value) =>
    value === 'auto' || LENGTH({ px: 4000, pt: 3000, '%': 100, em: 200, rem: 200 })(value),
  height: (value) => value === 'auto' || LENGTH({ px: 4000, em: 200, rem: 200 })(value),
};

/**
 * The declarations of a `style` attribute that the editor keeps (see `STYLES`), joined by `'; '`.
 * `!important` goes.
 */
export function starEditorSafeStyle(style: string): string {
  const kept: string[] = [];
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon < 0) continue;
    const name = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration
      .slice(colon + 1)
      .replace(/!\s*important/i, '')
      .trim()
      .toLowerCase();
    if (Object.hasOwn(STYLES, name) && STYLES[name](value)) kept.push(`${name}: ${value}`);
  }
  return kept.join('; ');
}

/**
 * True when `url` may stay in an `href` or `src`: a relative address, or one of `protocols`.
 * Control characters and spaces are ignored for the check, as browsers ignore them in a scheme.
 * With `image`, a `data:` image and a `blob:` address pass too.
 */
export function starEditorUrlAllowed(
  url: string,
  protocols: readonly string[],
  image: boolean,
): boolean {
  // eslint-disable-next-line no-control-regex
  const bare = url.replace(/[\u0000- \u007f-\u009f]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(bare)?.[1]?.toLowerCase();
  if (!scheme) return !bare.startsWith('\\') && !/^\/\\/.test(bare);
  if (image && scheme === 'data') return DATA_IMAGE.test(bare);
  if (image && scheme === 'blob') return true;
  const protocol = `${scheme}:`;
  return !NEVER_PROTOCOLS.has(protocol) && protocols.includes(protocol);
}

/** `<font size>` 1 to 7 as a font size of the editor (3 is the normal size). */
const FONT_SIZES: Readonly<Record<string, string>> = {
  '1': '0.875em',
  '2': '0.875em',
  '4': '1.25em',
  '5': '1.5em',
  '6': '2em',
  '7': '2em',
};

/** Classes of the logical alignment (the start has none). */
const ALIGN_CLASSES: Readonly<Record<string, string>> = {
  center: 'star-text-center',
  right: 'star-text-end',
  end: 'star-text-end',
  justify: 'star-text-justify',
};

function rename(element: Element, tag: string): Element {
  const next = element.ownerDocument.createElement(tag);
  for (const attribute of [...element.attributes])
    next.setAttribute(attribute.name, attribute.value);
  while (element.firstChild) next.appendChild(element.firstChild);
  element.replaceWith(next);
  return next;
}

/**
 * Turns legacy markup into current markup, in place: `<font>` into a `<span>` with a color and a
 * size, `<center>` into a centered `<div>`, `<strike>` into `<s>`, and the `align` attribute
 * into an alignment class. Returns the number of changes.
 */
export function starEditorMigrateLegacy(root: ParentNode): number {
  let count = 0;
  for (const font of [...root.querySelectorAll('font')]) {
    const styles: string[] = [];
    const color = font.getAttribute('color');
    if (color) styles.push(`color: ${color}`);
    const size = FONT_SIZES[font.getAttribute('size')?.trim() ?? ''];
    if (size) styles.push(`font-size: ${size}`);
    const span = font.ownerDocument.createElement('span');
    if (styles.length) span.setAttribute('style', styles.join('; '));
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
    count++;
  }
  for (const center of [...root.querySelectorAll('center')]) {
    rename(center, 'div').classList.add(ALIGN_CLASSES['center']);
    count++;
  }
  for (const strike of [...root.querySelectorAll('strike')]) {
    rename(strike, 's');
    count++;
  }
  for (const aligned of [...root.querySelectorAll('[align]')]) {
    const align = ALIGN_CLASSES[aligned.getAttribute('align')!.trim().toLowerCase()];
    aligned.removeAttribute('align');
    if (align) aligned.classList.add(align);
    count++;
  }
  return count;
}

/** Sets the `rel` tokens of a link: other tokens stay, `opener` goes, `add` is added. */
function setRel(anchor: Element, add: readonly string[]): void {
  const tokens = (anchor.getAttribute('rel') ?? '')
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token && token !== 'opener');
  for (const token of add) if (!tokens.includes(token)) tokens.push(token);
  if (tokens.length) anchor.setAttribute('rel', tokens.join(' '));
  else anchor.removeAttribute('rel');
}

/** A link that opens a new tab cannot reach back to this page (reverse tabnabbing). */
function safeTarget(anchor: Element): void {
  if (!anchor.hasAttribute('target')) return;
  const target = anchor.getAttribute('target')!.trim().toLowerCase();
  if (!target || target === '_self' || target === '_parent' || target === '_top') {
    anchor.removeAttribute('target');
    setRel(anchor, []);
  } else {
    anchor.setAttribute('target', '_blank');
    setRel(anchor, ['noopener', 'noreferrer']);
  }
}

function allowedEmbed(src: string, hosts: readonly string[]): boolean {
  if (!hosts.length || !/^https:\/\//i.test(src)) return false;
  try {
    return hosts.includes(new URL(src).host.toLowerCase());
  } catch {
    return false;
  }
}

function cleanAttributes(element: Element, tag: string, config: StarEditorSanitizeConfig): void {
  const allowed = new Set([...(config.attributes['*'] ?? []), ...(config.attributes[tag] ?? [])]);
  for (const { name, value } of [...element.attributes]) {
    const lower = name.toLowerCase();
    let keep =
      allowed.has(lower) &&
      !/^on/.test(lower) &&
      !lower.includes(':') &&
      lower !== 'srcdoc' &&
      lower !== 'formaction';
    if (keep && lower in ATTRIBUTE_VALUES) keep = ATTRIBUTE_VALUES[lower].test(value.trim());
    if (keep && (lower === 'href' || lower === 'src'))
      keep = starEditorUrlAllowed(value, config.protocols, lower === 'src' && tag === 'img');
    if (keep && lower === 'src' && tag === 'iframe')
      keep = allowedEmbed(value.trim(), config.embedHosts ?? []);
    if (!keep) {
      element.removeAttribute(name);
      continue;
    }
    if (lower === 'style') {
      const style = starEditorSafeStyle(value);
      if (style) element.setAttribute(name, style);
      else element.removeAttribute(name);
    } else if (/[<>]/.test(value)) {
      // HTML does not escape < and > in attribute values: a later parse in another context
      // (for example in a noscript element) could read them as markup.
      element.setAttribute(name, value.replace(/[<>]/g, ''));
    }
  }
  if (tag === 'a') safeTarget(element);
}

function walk(parent: ParentNode, config: StarEditorSanitizeConfig, tags: Set<string>): void {
  for (const node of [...parent.childNodes]) {
    if (node.nodeType === 3) continue;
    if (node.nodeType !== 1) {
      node.remove();
      continue;
    }
    const element = node as Element;
    const tag = element.localName.toLowerCase();
    const embed =
      tag === 'iframe' &&
      allowedEmbed(element.getAttribute('src')?.trim() ?? '', config.embedHosts ?? []);
    if ((DROP.has(tag) || tag === 'iframe') && !embed) {
      element.remove();
      continue;
    }
    if (element.namespaceURI !== 'http://www.w3.org/1999/xhtml') {
      element.remove();
      continue;
    }
    if (!tags.has(tag) && !embed) {
      walk(element, config, tags);
      element.replaceWith(...element.childNodes);
      continue;
    }
    cleanAttributes(element, tag, config);
    if (embed) {
      // An embed shows another site: no content, a sandbox without same-origin access.
      element.replaceChildren();
      element.setAttribute('sandbox', 'allow-scripts allow-popups allow-presentation');
      element.setAttribute('loading', 'lazy');
      element.setAttribute('referrerpolicy', 'no-referrer');
      continue;
    }
    walk(element, config, tags);
    if (tag === 'span' && !element.attributes.length) element.replaceWith(...element.childNodes);
  }
}

function once(html: string, doc: Document, config: StarEditorSanitizeConfig): string {
  const template = doc.createElement('template');
  template.innerHTML = html;
  starEditorMigrateLegacy(template.content);
  walk(template.content, config, new Set(config.tags.map((tag) => tag.toLowerCase())));
  return template.innerHTML;
}

/**
 * Sanitizes `html` with the allow-list `config` (default `STAR_EDITOR_SANITIZE_DEFAULTS`).
 * The result is stable: sanitizing it again gives the same HTML (a second pass runs when the first
 * result parses differently, as a guard against mutation on a new parse).
 */
export function starEditorSanitize(
  html: string,
  doc: Document,
  config: StarEditorSanitizeConfig = STAR_EDITOR_SANITIZE_DEFAULTS,
): string {
  if (!html) return '';
  let result = once(html, doc, config);
  for (let pass = 0; pass < 2; pass++) {
    const again = once(result, doc, config);
    if (again === result) break;
    result = again;
  }
  return result;
}
