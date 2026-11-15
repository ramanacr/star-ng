import { STAR_THEME_DEFAULT_STORAGE_KEY } from './theme-key';

/**
 * Builds the script text. `keyExpression` is JavaScript source that gives the storage key.
 * The inline form uses a string literal; the file form reads an attribute of its own element.
 */
function firstPaintSource(keyExpression: string): string {
  return (
    `(function(){var m='system';try{m=localStorage.getItem(${keyExpression})||'system'}catch(e){}` +
    `var d=m==='dark'||(m!=='light'&&window.matchMedia&&` +
    `window.matchMedia('(prefers-color-scheme: dark)').matches);` +
    `document.documentElement.setAttribute('data-theme',d?'dark':'light')})();`
  );
}

/** A string literal that is safe inside an HTML `<script>` element (it escapes every `<`). */
function scriptLiteral(value: string): string {
  return JSON.stringify(value).replace(/</g, String.raw`\u003c`);
}

/**
 * Source of the first-paint theme script. It sets `data-theme` on `<html>` before the browser
 * paints, so a dark-theme user does not see a light frame while the application starts.
 *
 * The rule is the same as in `StarThemeService`: the saved choice (`system`, `light` or
 * `dark`), else the system setting.
 *
 * A strict Content Security Policy (`script-src 'self'`, no `'unsafe-inline'`) blocks an inline
 * script. There are three ways that work with it. See the "Content Security Policy" section of
 * the "Dark mode" guide:
 *
 * 1. the static file `@star-ng/ui/theme/star-theme-first-paint.js` (see
 *    `starThemeFirstPaintFileScript`), loaded with `<script src>`;
 * 2. the hash of this text in the policy (`STAR_THEME_FIRST_PAINT_HASH`,
 *    `starThemeFirstPaintHash`);
 * 3. a nonce (`starThemeFirstPaintElement`).
 *
 * ```ts
 * // For example in a build script or a server-side template:
 * const html = `<script>${starThemeFirstPaintScript()}</script>`;
 * ```
 *
 * @param storageKey The `localStorage` key. Use the value of `STAR_THEME_STORAGE_KEY`.
 */
export function starThemeFirstPaintScript(storageKey = STAR_THEME_DEFAULT_STORAGE_KEY): string {
  return firstPaintSource(scriptLiteral(storageKey));
}

/**
 * Text of the static file `@star-ng/ui/theme/star-theme-first-paint.js`. It is the same script as
 * `starThemeFirstPaintScript()`, but the storage key comes from the `data-storage-key`
 * attribute of its own `<script>` element (default `'star-theme'`), so a custom key needs no
 * inline code:
 *
 * ```html
 * <script src="star-theme-first-paint.js" data-storage-key="my-app-theme"></script>
 * ```
 *
 * A unit test keeps the file and this function identical.
 */
export function starThemeFirstPaintFileScript(): string {
  return firstPaintSource(
    `document.currentScript&&document.currentScript.getAttribute('data-storage-key')||${scriptLiteral(
      STAR_THEME_DEFAULT_STORAGE_KEY,
    )}`,
  );
}

/**
 * CSP hash source of `starThemeFirstPaintScript()` with the default storage key. Put it in
 * `script-src`, and write the script between the tags with no extra character: no space, no
 * line break. A unit test recomputes it, so it cannot be stale.
 */
export const STAR_THEME_FIRST_PAINT_HASH = "'sha256-mHrWsD/vOGmnKvtGE+U7/5fQm439nYWV30PcQ/ez708='";

/**
 * Computes the CSP hash source (`'sha256-...'`, with the quotes) of the exact text of
 * `starThemeFirstPaintScript(storageKey)`. The browser hashes the UTF-8 bytes of the text
 * between `<script>` and `</script>`. Use it for a custom storage key (needs Web Crypto, so a
 * secure context or a current Node.js version).
 */
export async function starThemeFirstPaintHash(
  storageKey = STAR_THEME_DEFAULT_STORAGE_KEY,
): Promise<string> {
  const bytes = new TextEncoder().encode(starThemeFirstPaintScript(storageKey));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  let binary = '';
  for (const byte of digest) binary += String.fromCharCode(byte);
  return `'sha256-${btoa(binary)}'`;
}

/** A nonce is base64 or base64url text (`A-Z a-z 0-9 + / - _`, at most two `=` at the end). */
const NONCE = /^[A-Za-z0-9+/_-]+={0,2}$/;

/**
 * The full `<script nonce="...">...</script>` element text of the first-paint script, for a
 * server-rendered page. Add `'nonce-<same value>'` to `script-src`. Use a new random nonce
 * (at least 128 bits) for each response.
 *
 * @throws Error when the nonce is not a valid base64 or base64url value. The check keeps
 * markup out of the attribute.
 */
export function starThemeFirstPaintElement(
  nonce: string,
  storageKey = STAR_THEME_DEFAULT_STORAGE_KEY,
): string {
  if (typeof nonce !== 'string' || !NONCE.test(nonce)) {
    throw new Error('starThemeFirstPaintElement: the nonce must be a base64 or base64url value.');
  }
  return `<script nonce="${nonce}">${starThemeFirstPaintScript(storageKey)}</script>`;
}
