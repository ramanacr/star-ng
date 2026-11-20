import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  STAR_EDITOR_FULL_TOOLBAR,
  STAR_EDITOR_SANITIZE_DEFAULTS,
  StarEditor,
  StarEditorUpload,
} from '@star-ng/ui/editor';

@Component({
  imports: [StarEditor],
  template: `
    <star-editor
      [(value)]="html"
      [toolbar]="toolbar"
      [upload]="upload()"
      [sanitize]="rules"
      ariaLabel="Announcement"
    />
  `,
})
class Host {
  readonly html = signal('<p>Release notes</p>');
  readonly toolbar = STAR_EDITOR_FULL_TOOLBAR;
  readonly upload = signal<StarEditorUpload | null>(null);
  readonly rules = { ...STAR_EDITOR_SANITIZE_DEFAULTS, embedHosts: ['player.vimeo.com'] };
}

async function setup(html?: string) {
  const fixture = TestBed.createComponent(Host);
  if (html) fixture.componentInstance.html.set(html);
  await fixture.whenStable();
  const el = fixture.nativeElement as HTMLElement;
  const area = el.querySelector<HTMLElement>('.star-editor__area')!;
  const button = (name: string) => el.querySelector<HTMLButtonElement>(`[aria-label="${name}"]`)!;
  const field = (label: string) =>
    [...el.querySelectorAll('label')]
      .find((l) => l.textContent!.trim().startsWith(label))!
      .querySelector('input')!;
  const type = (input: HTMLInputElement, value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const range = document.createRange();
  const text = area.querySelector('p')!.firstChild!;
  range.setStart(text, Math.min(7, text.textContent!.length));
  range.collapse(true);
  document.getSelection()!.removeAllRanges();
  document.getSelection()!.addRange(range);
  return { fixture, el, area, button, field, type, host: fixture.componentInstance };
}

describe('StarEditor images', () => {
  it('needs alternative text or decorative, then inserts the image', async () => {
    const { fixture, el, button, field, type, host } = await setup();
    button('Image').click();
    await fixture.whenStable();
    const panel = el.querySelector('[role=group][aria-label=Image]')!;
    expect(button('Image').getAttribute('aria-expanded')).toBe('true');
    type(field('Image address'), 'https://example.com/dashboard.png');
    panel.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    const alt = field('Alternative text');
    expect(alt.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(alt.getAttribute('aria-describedby')!)!.textContent).toContain(
      'Describe the image',
    );
    type(alt, 'New dashboard');
    type(field('Caption'), 'The new dashboard');
    type(field('Width'), '320');
    panel.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(host.html()).toBe(
      '<p>Release notes</p><figure><img src="https://example.com/dashboard.png" alt="New dashboard" width="320"><figcaption>The new dashboard</figcaption></figure><p><br></p>',
    );
    expect(el.querySelector('star-editor-image')).toBeNull();
  });

  it('refuses a script address and accepts a decorative image', async () => {
    const { fixture, el, button, field, type, host } = await setup();
    button('Image').click();
    await fixture.whenStable();
    type(field('Image address'), 'javascript:alert(1)');
    const form = el.querySelector('star-editor-image form')!;
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(field('Image address').getAttribute('aria-invalid')).toBe('true');
    type(field('Image address'), 'https://example.com/line.png');
    field('Decorative').click();
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(host.html()).toBe('<p>Release<img src="https://example.com/line.png" alt=""> notes</p>');
  });

  it('stores a chosen file with the upload hook', async () => {
    const { fixture, el, button, field, type, host } = await setup();
    const files: File[] = [];
    host.upload.set(async (file) => {
      files.push(file);
      return 'https://cdn.example.com/1.png';
    });
    await fixture.whenStable();
    button('Image').click();
    await fixture.whenStable();
    const input = el.querySelector<HTMLInputElement>('star-editor-image input[type=file]')!;
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    type(field('Alternative text'), 'Screenshot');
    el.querySelector('star-editor-image form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    expect(files).toEqual([file]);
    expect(host.html()).toContain('src="https://cdn.example.com/1.png" alt="Screenshot"');
  });

  it('selects an image on click, resizes it with the keyboard handle, and edits it', async () => {
    const { fixture, el, area, button, field, type, host } = await setup(
      '<p>Logo <img src="https://example.com/a.png" alt="Logo" width="200"></p>',
    );
    area.querySelector('img')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await fixture.whenStable();
    const handle = el.querySelector<HTMLElement>('[role=slider][aria-label="Image width"]')!;
    expect(handle.getAttribute('aria-valuenow')).toBe('200');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    handle.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowLeft', shiftKey: true, bubbles: true }),
    );
    expect(host.html()).toContain('width="160"');
    await fixture.whenStable();
    expect(handle.getAttribute('aria-valuenow')).toBe('160');
    button('Image').click();
    await fixture.whenStable();
    expect(field('Alternative text').value).toBe('Logo');
    type(field('Alternative text'), 'Company logo');
    el.querySelector('star-editor-image form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    expect(host.html()).toBe(
      '<p>Logo <img src="https://example.com/a.png" alt="Company logo" width="160"></p>',
    );
  });
});

describe('StarEditor embeds', () => {
  it('embeds only players on the embed hosts, with a title', async () => {
    const { fixture, el, button, field, type, host } = await setup();
    button('Embed').click();
    await fixture.whenStable();
    const form = el.querySelector('star-editor-embed form')!;
    type(field('Video or page address'), 'https://www.youtube.com/watch?v=abc123XYZ');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await fixture.whenStable();
    expect(el.querySelector('star-editor-embed')!.textContent).toContain('not on the list');
    type(field('Video or page address'), 'https://vimeo.com/76979871');
    type(field('Title'), 'Product tour');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(host.html()).toContain(
      '<div class="star-editor-embed"><iframe src="https://player.vimeo.com/video/76979871" title="Product tour" allowfullscreen="" sandbox="allow-scripts allow-popups allow-presentation" loading="lazy" referrerpolicy="no-referrer"></iframe></div>',
    );
  });

  it('keeps the live frame sandboxed after insert, undo, redo and a value from outside', async () => {
    const { fixture, el, area, button, field, type, host } = await setup();
    const sandboxed = () => {
      const frame = area.querySelector('iframe')!;
      expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-popups allow-presentation');
      expect(frame.getAttribute('referrerpolicy')).toBe('no-referrer');
      expect(frame.getAttribute('loading')).toBe('lazy');
    };
    const key = (init: KeyboardEventInit) =>
      area.dispatchEvent(
        new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
      );
    button('Embed').click();
    await fixture.whenStable();
    type(field('Video or page address'), 'https://vimeo.com/76979871');
    type(field('Title'), 'Product tour');
    el.querySelector('star-editor-embed form')!.dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    sandboxed();
    key({ key: 'z', ctrlKey: true });
    expect(area.querySelector('iframe')).toBeNull();
    key({ key: 'y', ctrlKey: true });
    sandboxed();
    host.html.set(
      '<div class="star-editor-embed"><iframe src="https://player.vimeo.com/video/1" title="Tour"></iframe></div>',
    );
    await fixture.whenStable();
    sandboxed();
  });
});
