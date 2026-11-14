import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  STAR_THEME_FIRST_PAINT_HASH,
  starThemeFirstPaintElement,
  starThemeFirstPaintFileScript,
  starThemeFirstPaintHash,
  starThemeFirstPaintScript,
} from './first-paint';

describe('starThemeFirstPaintScript', () => {
  const run = (script: string) => new Function(script)();
  const theme = () => document.documentElement.getAttribute('data-theme');

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
    })) as unknown as typeof window.matchMedia;
  });

  it('uses the system setting when no choice is saved', () => {
    run(starThemeFirstPaintScript());
    expect(theme()).toBe('dark');
  });

  it('uses the saved choice', () => {
    localStorage.setItem('star-theme', 'light');
    run(starThemeFirstPaintScript());
    expect(theme()).toBe('light');
  });

  it('reads a custom storage key', () => {
    localStorage.setItem('my-app-theme', 'light');
    run(starThemeFirstPaintScript('my-app-theme'));
    expect(theme()).toBe('light');
  });
});

describe('first-paint file form', () => {
  const file = readFileSync(
    resolve(process.cwd(), 'projects/star-ng/theme/star-theme-first-paint.js'),
    'utf8',
  );
  const run = (script: string, currentScript: Element | null) => {
    Object.defineProperty(document, 'currentScript', { value: currentScript, configurable: true });
    try {
      new Function(script)();
    } finally {
      delete (document as unknown as Record<string, unknown>)['currentScript'];
    }
  };
  const theme = () => document.documentElement.getAttribute('data-theme');

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
    })) as unknown as typeof window.matchMedia;
  });

  it('the static file has exactly the text of starThemeFirstPaintFileScript()', () => {
    expect(file.trimEnd()).toBe(starThemeFirstPaintFileScript());
  });

  it('the file is the inline script with a key read from the element', () => {
    // The only difference is how the key is found: the same text results after replacing it.
    const keyExpression =
      /document\.currentScript&&document\.currentScript\.getAttribute\('data-storage-key'\)\|\|"star-theme"/;
    expect(starThemeFirstPaintFileScript().replace(keyExpression, '"star-theme"')).toBe(
      starThemeFirstPaintScript(),
    );
  });

  it('uses the default key without an attribute or without a current script', () => {
    localStorage.setItem('star-theme', 'light');
    run(file, null);
    expect(theme()).toBe('light');
    const element = document.createElement('script');
    run(file, element);
    expect(theme()).toBe('light');
  });

  it('reads the key from data-storage-key', () => {
    localStorage.setItem('star-theme', 'dark');
    localStorage.setItem('my-app-theme', 'light');
    const element = document.createElement('script');
    element.setAttribute('data-storage-key', 'my-app-theme');
    run(file, element);
    expect(theme()).toBe('light');
  });
});

describe('first-paint hash', () => {
  const sha256 = (text: string) =>
    `'sha256-${createHash('sha256').update(Buffer.from(text, 'utf8')).digest('base64')}'`;

  it('STAR_THEME_FIRST_PAINT_HASH is the digest of the default script text', () => {
    expect(STAR_THEME_FIRST_PAINT_HASH).toBe(sha256(starThemeFirstPaintScript()));
  });

  it('starThemeFirstPaintHash matches an independent digest', async () => {
    expect(await starThemeFirstPaintHash()).toBe(STAR_THEME_FIRST_PAINT_HASH);
    expect(await starThemeFirstPaintHash('my-app-theme')).toBe(
      sha256(starThemeFirstPaintScript('my-app-theme')),
    );
  });

  it('a custom key gives another hash', async () => {
    expect(await starThemeFirstPaintHash('other')).not.toBe(STAR_THEME_FIRST_PAINT_HASH);
  });

  it('hashes the UTF-8 bytes of a key with non-ASCII characters', async () => {
    expect(await starThemeFirstPaintHash('thème-é')).toBe(
      sha256(starThemeFirstPaintScript('thème-é')),
    );
  });

  it('the script text has no leading or trailing white space', () => {
    const text = starThemeFirstPaintScript();
    expect(text).toBe(text.trim());
  });
});

describe('starThemeFirstPaintElement', () => {
  it('wraps the script text exactly, with the nonce', () => {
    expect(starThemeFirstPaintElement('abc123+/=')).toBe(
      `<script nonce="abc123+/=">${starThemeFirstPaintScript()}</script>`,
    );
    expect(starThemeFirstPaintElement('a_b-c', 'k')).toBe(
      `<script nonce="a_b-c">${starThemeFirstPaintScript('k')}</script>`,
    );
  });

  it('rejects a nonce that is not base64 or base64url', () => {
    for (const bad of [
      '',
      'a"b',
      'a b',
      '"><img src=x onerror=alert(1)>',
      "a'b",
      'a<b',
      '=abc',
      'a===',
      'a\nb',
    ]) {
      expect(() => starThemeFirstPaintElement(bad), JSON.stringify(bad)).toThrow();
    }
  });

  it('keeps a storage key from closing the script element', () => {
    const html = starThemeFirstPaintElement('abc', '</script><b>');
    expect(html.match(/<\/script>/g)).toHaveLength(1);
    expect(html).not.toContain('<b>');
    localStorage.setItem('</script><b>', 'light');
    document.documentElement.removeAttribute('data-theme');
    new Function(starThemeFirstPaintScript('</script><b>'))();
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
