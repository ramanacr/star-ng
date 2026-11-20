import {
  STAR_EDITOR_SANITIZE_DEFAULTS,
  starEditorMigrateLegacy,
  starEditorSafeStyle,
  starEditorSanitize,
  starEditorUrlAllowed,
} from './editor-sanitize';

const clean = (html: string) => starEditorSanitize(html, document);

describe('starEditorSanitize: XSS vectors', () => {
  // Each vector must leave no script, no handler and no script URL in the result.
  const VECTORS: readonly string[] = [
    '<script>alert(1)</script>',
    '<SCRIPT SRC=https://example.com/x.js></SCRIPT>',
    '<img src=x onerror=alert(1)>',
    '<img src="javascript:alert(1)">',
    '<img src=" jav&#x09;ascript:alert(1)">',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="java\nscript:alert(1)">x</a>',
    '<a href=" \u0001javascript:alert(1)">x</a>',
    '<a href="vbscript:msgbox(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
    '<img src="data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=">',
    '<svg><script>alert(1)</script></svg>',
    '<svg onload=alert(1)></svg>',
    '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '<object data="javascript:alert(1)"></object>',
    '<embed src="javascript:alert(1)">',
    '<form action="javascript:alert(1)"><button>x</button></form>',
    '<input autofocus onfocus=alert(1)>',
    '<details open ontoggle=alert(1)>',
    '<body onload=alert(1)>',
    '<p style="background:url(javascript:alert(1))">x</p>',
    '<p style="width: expression(alert(1))">x</p>',
    '<p style="color: red; behavior: url(x.htc)">x</p>',
    '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    '<style><img src=x onerror=alert(1)></style>',
    '<template><img src=x onerror=alert(1)></template>',
    '<textarea><img src=x onerror=alert(1)></textarea>',
    '<base href="javascript:alert(1)//">',
    '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
    '<link rel="stylesheet" href="javascript:alert(1)">',
    '<a href="#" onclick="alert(1)">x</a>',
    '<p><!--<img src=x onerror=alert(1)>--></p>',
    '<img src=x srcset="javascript:alert(1)">',
    '<a href="https://example.com" formaction="javascript:alert(1)">x</a>',
    '<div xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="javascript:alert(1)">x</div>',
    '<span data-x="1" onmouseover="alert(1)">x</span>',
  ];

  for (const vector of VECTORS) {
    it(`neutralizes ${vector.slice(0, 60)}`, () => {
      const result = clean(vector);
      expect(result).not.toMatch(/<script|<svg|<math|<iframe|<object|<embed|<style|<form/i);
      expect(result).not.toMatch(/\son[a-z]+\s*=/i);
      expect(result).not.toMatch(/javascript:|vbscript:|expression\(|url\(|data:text|svg\+xml/i);
      // Sanitizing the result again changes nothing (no mutation on a second parse).
      expect(clean(result)).toBe(result);
    });
  }

  it('drops id and name (DOM clobbering)', () => {
    expect(clean('<p id="cookie" name="x">a</p>')).toBe('<p>a</p>');
  });
});

describe('starEditorSanitize: what stays', () => {
  it('keeps structure and allowed formats', () => {
    const html =
      '<h2>Week 12</h2><p><b>All</b> <i>orders</i> <u>shipped</u> <s>late</s> H<sub>2</sub>O x<sup>2</sup> <code>ORD-1</code></p><ul><li>One</li></ul><ol start="3"><li>Three</li></ol><blockquote><p>Quote</p></blockquote><hr>';
    expect(clean(html)).toBe(html);
  });

  it('keeps allowed styles and drops the rest', () => {
    expect(
      clean(
        '<p><span style="color: #c62828; font-weight: bold; background-color: var(--star-warning-soft); font-size: 1.25em; position: fixed">x</span></p>',
      ),
    ).toBe(
      '<p><span style="color: #c62828; background-color: var(--star-warning-soft); font-size: 1.25em">x</span></p>',
    );
    expect(clean('<p style="margin-inline-start: 2.5rem; text-align: center">x</p>')).toBe(
      '<p style="margin-inline-start: 2.5rem; text-align: center">x</p>',
    );
    expect(clean('<p style="">x</p>')).toBe('<p>x</p>');
  });

  it('keeps safe links and image sources, and gives a new tab rel', () => {
    expect(clean('<a href="https://example.com/a" target="_blank">a</a>')).toBe(
      '<a href="https://example.com/a" target="_blank" rel="noopener noreferrer">a</a>',
    );
    expect(
      clean('<a href="/orders">a</a><a href="#top">b</a><a href="mailto:a@example.com">c</a>'),
    ).toBe('<a href="/orders">a</a><a href="#top">b</a><a href="mailto:a@example.com">c</a>');
    expect(clean('<img src="data:image/png;base64,iVBORw0KGgo=" alt="Dot">')).toBe(
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="Dot">',
    );
    expect(clean('<img src="blob:https://example.com/1" alt="Box">')).toContain('blob:');
    expect(clean('<a href="blob:https://example.com/1">a</a>')).toBe('<a>a</a>');
  });

  it('unwraps unknown elements and keeps their text', () => {
    expect(clean('<section><article><p>Text</p></article></section>')).toBe('<p>Text</p>');
    expect(clean('<custom-tag>Text</custom-tag>')).toBe('Text');
  });

  it('keeps table, figure and checklist markup', () => {
    const table =
      '<table class="star-editor-table"><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td colspan="2" rowspan="1" style="width: 120px">1</td></tr></tbody></table>';
    expect(clean(table)).toBe(table);
    const figure =
      '<figure><img src="https://example.com/a.png" alt="A" width="200"><figcaption>A</figcaption></figure>';
    expect(clean(figure)).toBe(figure);
    const checklist = '<ul class="star-checklist"><li data-checked="true">Done</li></ul>';
    expect(clean(checklist)).toBe(checklist);
    expect(clean('<li data-checked="maybe" data-x="1">a</li>')).toBe('<li>a</li>');
  });

  it('follows an owner allow-list', () => {
    const config = {
      ...STAR_EDITOR_SANITIZE_DEFAULTS,
      tags: STAR_EDITOR_SANITIZE_DEFAULTS.tags.filter((tag) => tag !== 'u'),
      attributes: { ...STAR_EDITOR_SANITIZE_DEFAULTS.attributes, h2: ['id'] },
      protocols: ['https:'],
    };
    expect(starEditorSanitize('<h2 id="a">A</h2><u>b</u>', document, config)).toBe(
      '<h2 id="a">A</h2>b',
    );
    expect(
      starEditorSanitize(
        '<a href="http://example.com">a</a><a href="https://example.com">b</a>',
        document,
        config,
      ),
    ).toBe('<a>a</a><a href="https://example.com">b</a>');
    // Never allowed, even when listed.
    expect(
      starEditorSanitize('<script>1</script><p onclick="x">a</p>', document, {
        ...config,
        tags: [...config.tags, 'script'],
        attributes: { '*': ['onclick'] },
        protocols: ['javascript:'],
      }),
    ).toBe('<p>a</p>');
  });
});

describe('starEditorMigrateLegacy', () => {
  it('turns font, center, strike and align into current markup', () => {
    expect(clean('<font color="#ff0000" size="5">Red</font>')).toBe(
      '<span style="color: #ff0000; font-size: 1.5em">Red</span>',
    );
    expect(clean('<center>Mid</center>')).toBe('<div class="star-text-center">Mid</div>');
    expect(clean('<strike>Old</strike>')).toBe('<s>Old</s>');
    expect(clean('<p align="right">End</p>')).toBe('<p class="star-text-end">End</p>');
    expect(clean('<font face="Arial">Plain</font>')).toBe('Plain');
  });

  it('works on a fragment and reports the count', () => {
    const template = document.createElement('template');
    template.innerHTML = '<center>a</center><font color="red">b</font>';
    expect(starEditorMigrateLegacy(template.content)).toBe(2);
  });
});

describe('starEditorUrlAllowed and starEditorSafeStyle', () => {
  it('checks URL protocols', () => {
    const protocols = ['http:', 'https:'];
    expect(starEditorUrlAllowed('https://example.com', protocols, false)).toBe(true);
    expect(starEditorUrlAllowed('/a', protocols, false)).toBe(true);
    expect(starEditorUrlAllowed('ftp://example.com', protocols, false)).toBe(false);
    expect(starEditorUrlAllowed('data:image/png;base64,AA==', protocols, true)).toBe(true);
    expect(starEditorUrlAllowed('data:image/png;base64,AA==', protocols, false)).toBe(false);
  });

  it('keeps only known style properties with safe values', () => {
    expect(starEditorSafeStyle('color: rgb(1, 2, 3); width: 50%; float: left')).toBe(
      'color: rgb(1, 2, 3); width: 50%',
    );
    expect(starEditorSafeStyle('color: red !important')).toBe('color: red');
    expect(starEditorSafeStyle('color: var(--evil)')).toBe('');
    expect(starEditorSafeStyle('font-size: 99999px')).toBe('');
  });
});

describe('starEditorSanitize: review round 1', () => {
  it('keeps only the classes of the editor, and the classes that the owner lists', () => {
    expect(clean('<p class="star-text-center cdk-overlay-container star-dialog">a</p>')).toBe(
      '<p class="star-text-center">a</p>',
    );
    expect(clean('<table class="star-editor-table star-editor-table--rows"></table>')).toBe(
      '<table class="star-editor-table star-editor-table--rows"></table>',
    );
    expect(
      starEditorSanitize('<p class="note other">a</p>', document, {
        ...STAR_EDITOR_SANITIZE_DEFAULTS,
        classes: ['note'],
      }),
    ).toBe('<p class="note">a</p>');
  });

  it('allows width and height styles only on images, tables, cells, columns and frames', () => {
    expect(clean('<a href="/x" style="width: 100%; height: 4000px; color: red">a</a>')).toBe(
      '<a href="/x" style="color: red">a</a>',
    );
    expect(clean('<img src="a.png" alt="" style="width: 50%">')).toBe(
      '<img src="a.png" alt="" style="width: 50%">',
    );
  });

  it('checks every URL attribute that an owner allows, and never keeps ping', () => {
    const config = {
      ...STAR_EDITOR_SANITIZE_DEFAULTS,
      attributes: {
        ...STAR_EDITOR_SANITIZE_DEFAULTS.attributes,
        q: ['cite'],
        img: ['src', 'alt', 'srcset', 'longdesc'],
        a: ['href', 'ping'],
      },
    };
    expect(
      starEditorSanitize(
        '<q cite="javascript:alert(1)">a</q><q cite="https://example.com/s">b</q><img src="a.png" alt="" srcset="a.png 1x, javascript:alert(1) 2x" longdesc="vbscript:x"><a href="/a" ping="https://example.com/track">c</a>',
        document,
        config,
      ),
    ).toBe(
      '<q>a</q><q cite="https://example.com/s">b</q><img src="a.png" alt=""><a href="/a">c</a>',
    );
  });

  it('treats a protocol-relative address as https', () => {
    const httpOnly = { ...STAR_EDITOR_SANITIZE_DEFAULTS, protocols: ['http:'] };
    expect(starEditorSanitize('<a href="//example.com/a">a</a>', document, httpOnly)).toBe(
      '<a>a</a>',
    );
    expect(clean('<a href="//example.com/a">a</a>')).toBe('<a href="//example.com/a">a</a>');
  });
});
