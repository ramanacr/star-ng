/**
 * Images and embeds of `star-editor`. The embed providers follow the embeds feature of Aurora
 * RTE (MIT, same owner, https://github.com/ramanacr/aurora-rte, `embeds.ts`).
 */
import { starEditorBlocks, starEditorRestore } from './editor-dom';
import { STAR_EDITOR_FRAME_ATTRIBUTES } from './editor-sanitize';

/** An image of the image panel. */
export interface StarEditorImageValue {
  readonly src: string;
  /** Alternative text; `''` for a decorative image. */
  readonly alt: string;
  /** Text under the image (`figure` with `figcaption`); `''` for none. */
  readonly caption: string;
  /** Width in CSS pixels; `null` for the natural width. */
  readonly width: number | null;
}

/**
 * Upload of an image file that the user chose: give back the address of the stored image. Without
 * it, the editor puts the file in the HTML as a `data:` address.
 */
export type StarEditorUpload = (file: File) => Promise<string>;

/** Class of the block around an embed. */
export const STAR_EDITOR_EMBED_CLASS = 'star-editor-embed';

/** Known video sites: the page address of a video becomes the address of its player. */
const PROVIDERS: readonly { pattern: RegExp; player: (url: URL) => string | null }[] = [
  {
    pattern: /^(www\.|m\.)?(youtube\.com|youtu\.be)$/,
    player: (url) => {
      const id = url.host.endsWith('youtu.be')
        ? url.pathname.slice(1)
        : (url.searchParams.get('v') ?? /^\/(embed|shorts)\/([\w-]+)/.exec(url.pathname)?.[2]);
      return id && /^[\w-]{6,20}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    },
  },
  {
    pattern: /^(www\.)?vimeo\.com$/,
    player: (url) => {
      const id = /^\/(\d+)/.exec(url.pathname)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    },
  },
];

/**
 * The player address for an embed: a known video page becomes its player; another `https:`
 * address stays. `null` when the result is not on `hosts` (the embed hosts of the allow-list).
 */
export function starEditorEmbedUrl(raw: string, hosts: readonly string[]): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const provider = PROVIDERS.find((rule) => rule.pattern.test(url.host.toLowerCase()));
  const player = provider ? provider.player(url) : url.protocol === 'https:' ? url.href : null;
  if (!player) return null;
  return hosts.includes(new URL(player).host.toLowerCase()) ? player : null;
}

/** Reads an image file as a `data:` address. */
export function starEditorReadFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** The image value of an `img` element (and its figure). */
export function starEditorImageOf(image: HTMLImageElement): StarEditorImageValue {
  const figure = image.parentElement?.tagName === 'FIGURE' ? image.parentElement : null;
  const width = Number(image.getAttribute('width'));
  return {
    src: image.getAttribute('src') ?? '',
    alt: image.getAttribute('alt') ?? '',
    caption: figure?.querySelector('figcaption')?.textContent ?? '',
    width: width > 0 ? width : null,
  };
}

function setImage(image: HTMLImageElement, value: StarEditorImageValue): void {
  image.setAttribute('src', value.src);
  image.setAttribute('alt', value.alt);
  if (value.width) image.setAttribute('width', String(Math.round(value.width)));
  else image.removeAttribute('width');
  image.removeAttribute('height');
}

/** Puts a block after the block of the range (outside lists and tables) and a paragraph after it. */
function insertBlock(area: HTMLElement, range: Range, block: HTMLElement): void {
  let anchor: Element | null = starEditorBlocks(area, range).at(-1) ?? null;
  while (anchor && anchor.parentElement !== area) anchor = anchor.parentElement;
  if (anchor && !anchor.textContent?.trim() && !anchor.querySelector('img,iframe,table,hr'))
    anchor.replaceWith(block);
  else if (anchor) anchor.after(block);
  else area.appendChild(block);
  if (!block.nextElementSibling) {
    const paragraph = area.ownerDocument.createElement('p');
    paragraph.appendChild(area.ownerDocument.createElement('br'));
    block.after(paragraph);
  }
  range.setStart(block.nextElementSibling!, 0);
  range.collapse(true);
  starEditorRestore(range);
}

/**
 * Inserts an image at the range, or updates `existing`. An image with a caption is a `figure`
 * block; an image without one goes inline at the caret.
 */
export function starEditorPutImage(
  area: HTMLElement,
  range: Range,
  value: StarEditorImageValue,
  existing: HTMLImageElement | null,
): HTMLImageElement {
  const doc = area.ownerDocument;
  const image = existing ?? doc.createElement('img');
  setImage(image, value);
  const figure = image.parentElement?.tagName === 'FIGURE' ? image.parentElement : null;
  if (value.caption) {
    if (figure) {
      let caption = figure.querySelector('figcaption');
      if (!caption) caption = figure.appendChild(doc.createElement('figcaption'));
      caption.textContent = value.caption;
    } else {
      const block = doc.createElement('figure');
      const caption = doc.createElement('figcaption');
      caption.textContent = value.caption;
      if (existing) {
        existing.replaceWith(block);
        block.append(existing, caption);
      } else {
        block.append(image, caption);
        insertBlock(area, range, block);
      }
    }
  } else if (figure) {
    figure.replaceWith(image);
  } else if (!existing) {
    range.deleteContents();
    range.insertNode(image);
    range.setStartAfter(image);
    range.collapse(true);
    starEditorRestore(range);
  }
  return image;
}

/** Inserts an embed (an `iframe` in a `div.star-editor-embed`) after the block of the range. */
export function starEditorPutEmbed(
  area: HTMLElement,
  range: Range,
  src: string,
  title: string,
): void {
  const doc = area.ownerDocument;
  const block = doc.createElement('div');
  block.className = STAR_EDITOR_EMBED_CLASS;
  const frame = doc.createElement('iframe');
  // The sandbox applies when the frame navigates: set it (and the referrer and loading rules) on
  // the detached frame before the address, and insert the frame last.
  for (const [name, value] of STAR_EDITOR_FRAME_ATTRIBUTES) frame.setAttribute(name, value);
  frame.setAttribute('src', src);
  frame.setAttribute('title', title);
  frame.setAttribute('allowfullscreen', '');
  block.appendChild(frame);
  insertBlock(area, range, block);
  starEditorProtectEmbeds(area);
}

/**
 * Embeds in the live area: each block is one unit (its content cannot be edited), and each frame
 * has the sandbox, referrer and loading attributes of the sanitized value. The editor runs it on
 * every HTML that enters the area (insert, undo, redo, source view, value).
 */
export function starEditorProtectEmbeds(area: HTMLElement): void {
  for (const block of area.querySelectorAll(`.${STAR_EDITOR_EMBED_CLASS}`))
    block.setAttribute('contenteditable', 'false');
  for (const frame of area.querySelectorAll('iframe'))
    for (const [name, value] of STAR_EDITOR_FRAME_ATTRIBUTES)
      if (frame.getAttribute(name) !== value) frame.setAttribute(name, value);
}
