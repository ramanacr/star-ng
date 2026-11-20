import {
  starEditorEmbedUrl,
  starEditorImageOf,
  starEditorPutEmbed,
  starEditorPutImage,
} from './editor-media';

const HOSTS = ['www.youtube-nocookie.com', 'player.vimeo.com', 'maps.example.com'];

function area(html: string): HTMLElement {
  const element = document.createElement('div');
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

function caret(node: Node, offset: number): Range {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  return range;
}

afterEach(() => document.body.replaceChildren());

describe('starEditorEmbedUrl', () => {
  it('turns video pages into players on the allowed hosts', () => {
    expect(starEditorEmbedUrl('https://www.youtube.com/watch?v=abc123XYZ_-', HOSTS)).toBe(
      'https://www.youtube-nocookie.com/embed/abc123XYZ_-',
    );
    expect(starEditorEmbedUrl('https://youtu.be/abc123XYZ', HOSTS)).toBe(
      'https://www.youtube-nocookie.com/embed/abc123XYZ',
    );
    expect(starEditorEmbedUrl('https://vimeo.com/76979871', HOSTS)).toBe(
      'https://player.vimeo.com/video/76979871',
    );
    expect(starEditorEmbedUrl('https://maps.example.com/embed?q=1', HOSTS)).toBe(
      'https://maps.example.com/embed?q=1',
    );
  });

  it('refuses other hosts, plain http pages and script addresses', () => {
    expect(starEditorEmbedUrl('https://www.youtube.com/watch?v=abc123XYZ', [])).toBeNull();
    expect(starEditorEmbedUrl('https://other.example.com/', HOSTS)).toBeNull();
    expect(starEditorEmbedUrl('http://maps.example.com/', HOSTS)).toBeNull();
    expect(starEditorEmbedUrl('javascript:alert(1)', HOSTS)).toBeNull();
    expect(starEditorEmbedUrl('not a url', HOSTS)).toBeNull();
  });
});

describe('starEditorPutImage', () => {
  it('inserts an inline image at the caret', () => {
    const el = area('<p>Logo here</p>');
    starEditorPutImage(
      el,
      caret(el.querySelector('p')!.firstChild!, 4),
      { src: 'https://example.com/a.png', alt: 'Logo', caption: '', width: 120 },
      null,
    );
    expect(el.innerHTML).toBe(
      '<p>Logo<img src="https://example.com/a.png" alt="Logo" width="120"> here</p>',
    );
  });

  it('puts an image with a caption in a figure block, and edits it', () => {
    const el = area('<p>Text</p>');
    const image = starEditorPutImage(
      el,
      caret(el.querySelector('p')!.firstChild!, 4),
      { src: 'a.png', alt: '', caption: 'The new dashboard', width: null },
      null,
    );
    expect(el.innerHTML).toBe(
      '<p>Text</p><figure><img src="a.png" alt=""><figcaption>The new dashboard</figcaption></figure><p><br></p>',
    );
    expect(starEditorImageOf(image)).toEqual({
      src: 'a.png',
      alt: '',
      caption: 'The new dashboard',
      width: null,
    });
    starEditorPutImage(el, caret(el, 0), { src: 'b.png', alt: 'B', caption: '', width: 50 }, image);
    expect(el.innerHTML).toBe('<p>Text</p><img src="b.png" alt="B" width="50"><p><br></p>');
  });
});

describe('starEditorPutEmbed', () => {
  it('puts an iframe with a title in a protected block', () => {
    const el = area('<p></p>');
    starEditorPutEmbed(
      el,
      caret(el.querySelector('p')!, 0),
      'https://player.vimeo.com/video/1',
      'Demo',
    );
    expect(el.innerHTML).toBe(
      '<div class="star-editor-embed" contenteditable="false"><iframe sandbox="allow-scripts allow-popups allow-presentation" loading="lazy" referrerpolicy="no-referrer" src="https://player.vimeo.com/video/1" title="Demo" allowfullscreen=""></iframe></div><p><br></p>',
    );
  });
});

describe('starEditorPutEmbed: sandbox before the address', () => {
  it('sets every frame attribute before src, and never connects a frame without sandbox', () => {
    const el = area('<p></p>');
    const calls: string[] = [];
    const original = HTMLIFrameElement.prototype.setAttribute;
    const observer = new MutationObserver(() => undefined);
    const connected: (string | null)[] = [];
    observer.observe(el, { childList: true, subtree: true });
    HTMLIFrameElement.prototype.setAttribute = function (name: string, value: string) {
      calls.push(name);
      return original.call(this, name, value);
    };
    try {
      starEditorPutEmbed(
        el,
        caret(el.querySelector('p')!, 0),
        'https://player.vimeo.com/video/1',
        'Demo',
      );
    } finally {
      HTMLIFrameElement.prototype.setAttribute = original;
    }
    for (const record of observer.takeRecords())
      for (const node of record.addedNodes)
        for (const frame of (node as Element).querySelectorAll?.('iframe') ?? [])
          connected.push(frame.getAttribute('sandbox'));
    observer.disconnect();
    const src = calls.indexOf('src');
    for (const name of ['sandbox', 'referrerpolicy', 'loading'])
      expect(calls.indexOf(name), name).toBeGreaterThanOrEqual(0);
    for (const name of ['sandbox', 'referrerpolicy', 'loading'])
      expect(calls.indexOf(name), name).toBeLessThan(src);
    expect(connected).toEqual(['allow-scripts allow-popups allow-presentation']);
  });
});
