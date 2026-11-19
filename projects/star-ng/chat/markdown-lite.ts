/**
 * A small Markdown subset for chat messages and AI responses, parsed into data that a template
 * renders with text bindings. No HTML string is ever built, so raw HTML in a message stays text.
 *
 * Blocks: paragraphs (split by blank lines; single line breaks are kept) and fenced code blocks
 * (three backticks, with an optional language). Inline: `**bold**`, `*italic*`, `` `code` `` and
 * `[text](url)` links. A link is kept only for `http:`, `https:` and `mailto:` addresses; any other
 * address (for example `javascript:`) shows as plain text.
 */

/** One inline piece of a line. */
export type StarMdInline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong'; readonly text: string }
  | { readonly kind: 'em'; readonly text: string }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'link'; readonly text: string; readonly href: string };

/** One block of a message. */
export type StarMdBlock =
  | { readonly kind: 'paragraph'; readonly lines: readonly (readonly StarMdInline[])[] }
  | { readonly kind: 'code'; readonly language: string; readonly text: string };

const FENCE = /^\s*```\s*([\w+#.-]*)\s*$/;
const INLINE =
  /`([^`\n]+)`|\*\*([^*\n]+?)\*\*|\*([^*\s\n](?:[^*\n]*[^*\s\n])?)\*|\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** The address when it is safe to link (`http:`, `https:`, `mailto:`), else `null`. */
export function starSafeLink(href: string): string | null {
  const trimmed = href.trim();
  // Control characters and spaces can hide a scheme from the check ("java\tscript:").
  if (/[\s\p{Cc}]/u.test(trimmed)) return null;
  return SAFE_LINK.test(trimmed) ? trimmed : null;
}

/** Inline pieces of one line. */
export function starParseInline(line: string): StarMdInline[] {
  const parts: StarMdInline[] = [];
  let last = 0;
  const push = (piece: StarMdInline) => {
    const previous = parts[parts.length - 1];
    if (piece.kind === 'text' && previous?.kind === 'text') {
      parts[parts.length - 1] = { kind: 'text', text: previous.text + piece.text };
    } else if (piece.text) {
      parts.push(piece);
    }
  };
  for (const match of line.matchAll(INLINE)) {
    const at = match.index ?? 0;
    if (at > last) push({ kind: 'text', text: line.slice(last, at) });
    const [whole, code, strong, em, linkText, href] = match;
    if (code !== undefined) push({ kind: 'code', text: code });
    else if (strong !== undefined) push({ kind: 'strong', text: strong });
    else if (em !== undefined) push({ kind: 'em', text: em });
    else {
      const safe = starSafeLink(href);
      push(safe ? { kind: 'link', text: linkText, href: safe } : { kind: 'text', text: whole });
    }
    last = at + whole.length;
  }
  if (last < line.length) push({ kind: 'text', text: line.slice(last) });
  return parts;
}

/** Blocks of a message. An open fence (while a response streams) runs to the end of the text. */
export function starParseMarkdownLite(source: string): StarMdBlock[] {
  const blocks: StarMdBlock[] = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) {
      blocks.push({ kind: 'paragraph', lines: paragraph.map(starParseInline) });
      paragraph = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const fence = FENCE.exec(lines[i]);
    if (fence) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) code.push(lines[i++]);
      blocks.push({ kind: 'code', language: fence[1] ?? '', text: code.join('\n') });
      continue;
    }
    if (!lines[i].trim()) flush();
    else paragraph.push(lines[i]);
  }
  flush();
  return blocks;
}
