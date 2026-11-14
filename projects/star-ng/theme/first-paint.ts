import { STAR_THEME_DEFAULT_STORAGE_KEY } from './theme.service';

/**
 * Source of the first-paint theme script. Put it in a `<script>` element in the `<head>` of
 * `index.html`, before the stylesheets. It sets `data-theme` on `<html>` before the browser
 * paints, so a dark-theme user does not see a light frame while the application starts.
 *
 * The rule is the same as in `StarThemeService`: the saved choice (`system`, `light` or
 * `dark`), else the system setting.
 *
 * ```ts
 * // For example in a build script or a server-side template:
 * const html = `<script>${starThemeFirstPaintScript()}</script>`;
 * ```
 *
 * @param storageKey The `localStorage` key. Use the value of `STAR_THEME_STORAGE_KEY`.
 */
export function starThemeFirstPaintScript(storageKey = STAR_THEME_DEFAULT_STORAGE_KEY): string {
  const key = JSON.stringify(storageKey);
  return (
    `(function(){var m='system';try{m=localStorage.getItem(${key})||'system'}catch(e){}` +
    `var d=m==='dark'||(m!=='light'&&window.matchMedia&&` +
    `window.matchMedia('(prefers-color-scheme: dark)').matches);` +
    `document.documentElement.setAttribute('data-theme',d?'dark':'light')})();`
  );
}
